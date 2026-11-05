-- ============================================================
-- MIGRACIÓN: 0004_oriana_reports.sql
-- Proyecto: NEXUS SYSTEM — Intranet Empresarial Unificada
-- Descripción: Módulo de reportería Oriana — cabecera de reportes,
--              sub-métricas de validación, registros individuales de
--              análisis con hash de integridad, tablas de configuración
--              dinámica de modos/campañas, y cola de mensajería Telegram.
-- Idempotente: Sí — uso de IF NOT EXISTS, CREATE OR REPLACE, ON CONFLICT
-- Dependencias: 0001_core_and_auth_tables.sql, 0003_calls_and_incidents.sql
-- Fecha: 2026-11-05
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- SECCIÓN 1: TABLA oriana_reports
-- Cabecera principal de cada reporte Oriana. Un analista puede
-- tener múltiples reportes en curso, pero solo uno en estado
-- 'review_pending' por batch_reference.
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.oriana_reports (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    analyst_id          UUID        NOT NULL REFERENCES public.profiles(id),
    report_title        TEXT        NOT NULL
                                    CHECK (length(report_title) BETWEEN 3 AND 300),
    batch_reference     TEXT        NOT NULL
                                    CHECK (length(batch_reference) BETWEEN 3 AND 100),
    total_records       INT         NOT NULL
                                    CHECK (total_records > 0),
    processed_records   INT         NOT NULL DEFAULT 0
                                    CHECK (processed_records >= 0),
    status              TEXT        NOT NULL DEFAULT 'draft'
                                    CHECK (status IN (
                                        'draft',
                                        'review_pending',
                                        'approved',
                                        'rejected'
                                    )),
    -- Fecha límite de entrega (SLA de analítica)
    submission_deadline TIMESTAMPTZ NOT NULL,
    -- Notas del revisor/supervisor al aprobar o rechazar
    reviewer_id         UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
    reviewer_notes      TEXT        CHECK (reviewer_notes IS NULL OR length(reviewer_notes) <= 2000),
    reviewed_at         TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),

    -- processed_records no puede superar total_records
    CONSTRAINT chk_processed_lte_total
        CHECK (processed_records <= total_records),
    -- submission_deadline debe ser posterior a la creación
    CONSTRAINT chk_deadline_future
        CHECK (submission_deadline > created_at)
);

CREATE INDEX IF NOT EXISTS idx_oriana_reports_analyst
    ON public.oriana_reports(analyst_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_oriana_reports_status
    ON public.oriana_reports(status, submission_deadline);

CREATE INDEX IF NOT EXISTS idx_oriana_reports_batch
    ON public.oriana_reports(batch_reference);

-- Trigger de updated_at
DROP TRIGGER IF EXISTS tr_oriana_reports_updated_at ON public.oriana_reports;
CREATE TRIGGER tr_oriana_reports_updated_at
    BEFORE UPDATE ON public.oriana_reports
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- Trigger para registrar reviewer_at al cambiar status
CREATE OR REPLACE FUNCTION public.fn_oriana_reports_before_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Registrar timestamp de revisión al cambiar a estados terminales
    IF NEW.status IN ('approved', 'rejected') AND
       OLD.status NOT IN ('approved', 'rejected')
    THEN
        NEW.reviewed_at := now();
    END IF;

    -- Impedir retroceso de estado: approved/rejected → draft no permitido
    IF OLD.status IN ('approved', 'rejected') AND
       NEW.status = 'draft'
    THEN
        RAISE EXCEPTION
            'No se puede revertir un reporte ya % a draft. '
            'Cree un nuevo reporte.', OLD.status;
    END IF;

    NEW.updated_at := timezone('utc', now());
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_oriana_reports_before_update ON public.oriana_reports;
CREATE TRIGGER tr_oriana_reports_before_update
    BEFORE UPDATE ON public.oriana_reports
    FOR EACH ROW EXECUTE FUNCTION public.fn_oriana_reports_before_update();

-- Trigger de auditoría
DROP TRIGGER IF EXISTS tr_audit_oriana_reports ON public.oriana_reports;
CREATE TRIGGER tr_audit_oriana_reports
    AFTER INSERT OR UPDATE OR DELETE ON public.oriana_reports
    FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();

-- ──────────────────────────────────────────────────────────────
-- SECCIÓN 2: TABLA oriana_metrics
-- Sub-métricas de calidad por reporte Oriana.
-- Una fila por reporte — relación 1:1 con oriana_reports.
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.oriana_metrics (
    id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id                UUID        UNIQUE NOT NULL
                                         REFERENCES public.oriana_reports(id) ON DELETE CASCADE,
    validation_accuracy      NUMERIC(5, 2) NOT NULL
                                         CHECK (validation_accuracy BETWEEN 0.00 AND 100.00),
    discrepancy_count        INT         NOT NULL DEFAULT 0
                                         CHECK (discrepancy_count >= 0),
    processing_time_minutes  INT         NOT NULL
                                         CHECK (processing_time_minutes > 0),
    records_per_hour         NUMERIC(10, 2),
    audit_notes              TEXT        CHECK (audit_notes IS NULL OR length(audit_notes) <= 2000),
    created_at               TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_oriana_metrics_report
    ON public.oriana_metrics(report_id);

-- Trigger para calcular records_per_hour sin subquery en GENERATED column
CREATE OR REPLACE FUNCTION public.fn_calculate_oriana_records_per_hour()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_total_records INT;
BEGIN
    SELECT total_records INTO v_total_records
    FROM public.oriana_reports
    WHERE id = NEW.report_id;

    IF NEW.processing_time_minutes > 0 AND v_total_records IS NOT NULL THEN
        NEW.records_per_hour := ROUND(
            (v_total_records::NUMERIC / (NEW.processing_time_minutes::NUMERIC / 60.0)),
            2
        );
    ELSE
        NEW.records_per_hour := NULL;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_calc_records_per_hour ON public.oriana_metrics;
CREATE TRIGGER tr_calc_records_per_hour
    BEFORE INSERT OR UPDATE ON public.oriana_metrics
    FOR EACH ROW EXECUTE FUNCTION public.fn_calculate_oriana_records_per_hour();

-- ──────────────────────────────────────────────────────────────
-- SECCIÓN 3: TABLA data_analysis_submissions
-- Registros individuales de cada fila analizada en un reporte.
-- record_hash: SHA-256 del input_data para detectar duplicados.
-- Esta tabla tiene el mayor volumen de escritura del módulo Oriana.
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.data_analysis_submissions (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id        UUID        NOT NULL REFERENCES public.oriana_reports(id) ON DELETE CASCADE,
    -- Hash SHA-256 del contenido del registro para evitar duplicados
    record_hash      TEXT        NOT NULL
                                 CHECK (record_hash ~ '^[a-f0-9]{64}$'),
    input_data       JSONB       NOT NULL,
    validation_state TEXT        NOT NULL
                                 CHECK (validation_state IN ('valid', 'discrepant', 'ignored')),
    -- Notas del analista sobre esta fila específica
    analyst_note     TEXT        CHECK (analyst_note IS NULL OR length(analyst_note) <= 500),
    validated_at     TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),

    -- Un mismo hash no puede aparecer dos veces en el mismo reporte
    UNIQUE (report_id, record_hash)
);

CREATE INDEX IF NOT EXISTS idx_submissions_report
    ON public.data_analysis_submissions(report_id, validated_at DESC);

CREATE INDEX IF NOT EXISTS idx_submissions_state
    ON public.data_analysis_submissions(validation_state, report_id);

-- Índice parcial para discrepancias (consultas de auditoría frecuentes)
CREATE INDEX IF NOT EXISTS idx_submissions_discrepant
    ON public.data_analysis_submissions(report_id, validated_at DESC)
    WHERE validation_state = 'discrepant';

-- ──────────────────────────────────────────────────────────────
-- SECCIÓN 4: TRIGGER — Actualizar processed_records en oriana_reports
-- Al insertar un nuevo submission, se actualiza el contador
-- del reporte padre según el validation_state.
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_update_report_progress()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_valid_count      INT;
    v_discrepant_count INT;
BEGIN
    -- Recalcular contadores del reporte padre
    SELECT
        COUNT(*) FILTER (WHERE validation_state = 'valid'),
        COUNT(*) FILTER (WHERE validation_state = 'discrepant')
    INTO v_valid_count, v_discrepant_count
    FROM public.data_analysis_submissions
    WHERE report_id = NEW.report_id;

    -- Actualizar processed_records (valid + discrepant; ignored no cuenta)
    UPDATE public.oriana_reports
    SET    processed_records = v_valid_count + v_discrepant_count,
           updated_at        = timezone('utc', now())
    WHERE  id = NEW.report_id;

    -- Actualizar metrics: discrepancy_count si ya existe la fila de métricas
    UPDATE public.oriana_metrics
    SET    discrepancy_count = v_discrepant_count
    WHERE  report_id = NEW.report_id;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_update_report_progress ON public.data_analysis_submissions;
CREATE TRIGGER tr_update_report_progress
    AFTER INSERT OR UPDATE ON public.data_analysis_submissions
    FOR EACH ROW EXECUTE FUNCTION public.fn_update_report_progress();

-- ──────────────────────────────────────────────────────────────
-- SECCIÓN 5: TABLA registros
-- Tabla principal de registros operacionales de Oriana.
-- Compatible con el schema existente en Oriana Command Center.
-- Extendida con constraint de fecha e índices de rendimiento.
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.registros (
    id                     BIGSERIAL   PRIMARY KEY,
    id_operador            TEXT        DEFAULT 'S/ID',
    fecha_registro         TIMESTAMPTZ DEFAULT NOW(),
    fecha_reporte          DATE        NOT NULL,
    usuario_operador       TEXT        NOT NULL
                                       CHECK (length(usuario_operador) BETWEEN 1 AND 200),
    modo_trabajo           TEXT        NOT NULL
                                       CHECK (length(modo_trabajo) BETWEEN 1 AND 200),
    campana                TEXT        NOT NULL
                                       CHECK (length(campana) BETWEEN 1 AND 500),
    llamadas_efectivas     NUMERIC     DEFAULT 0 CHECK (llamadas_efectivas >= 0),
    llamadas_totales       NUMERIC     DEFAULT 0 CHECK (llamadas_totales >= 0),
    incidencias_reportadas NUMERIC     DEFAULT 0 CHECK (incidencias_reportadas >= 0),
    estados_abarcados      TEXT        DEFAULT '',
    municipios_detalles    TEXT        DEFAULT '',
    admin_efectivas        NUMERIC,
    admin_incidencias      NUMERIC,
    -- Campo JSONB para variables dinámicas según modo de trabajo
    variables              JSONB       DEFAULT '{}'::JSONB,
    created_at             TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_registros_fecha_reporte
    ON public.registros(fecha_reporte DESC);

CREATE INDEX IF NOT EXISTS idx_registros_usuario
    ON public.registros(usuario_operador, fecha_reporte DESC);

CREATE INDEX IF NOT EXISTS idx_registros_modo
    ON public.registros(modo_trabajo, fecha_reporte DESC);

CREATE INDEX IF NOT EXISTS idx_registros_fecha_reg
    ON public.registros(fecha_registro DESC);

-- ──────────────────────────────────────────────────────────────
-- SECCIÓN 6: TABLA registros_daily_aggregates
-- KPIs diarios de registros Oriana (antes de purgar detalles).
-- Poblada por la función de purga — nunca se elimina.
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.registros_daily_aggregates (
    id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    summary_date             DATE        NOT NULL,
    usuario_operador         TEXT        NOT NULL,
    modo_trabajo             TEXT        NOT NULL,
    total_registros          INT         NOT NULL DEFAULT 0,
    total_llamadas_efectivas NUMERIC     DEFAULT 0,
    total_llamadas_totales   NUMERIC     DEFAULT 0,
    total_incidencias        NUMERIC     DEFAULT 0,
    tasa_efectividad         NUMERIC(5, 2),
    created_at               TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    UNIQUE (summary_date, usuario_operador, modo_trabajo)
);

CREATE INDEX IF NOT EXISTS idx_reg_agg_date
    ON public.registros_daily_aggregates(summary_date DESC);

CREATE INDEX IF NOT EXISTS idx_reg_agg_usuario
    ON public.registros_daily_aggregates(usuario_operador, summary_date DESC);

-- ──────────────────────────────────────────────────────────────
-- SECCIÓN 7: TABLAS DE CONFIGURACIÓN DINÁMICA DE ORIANA
-- Compatibles con el schema Oriana Command Center existente.
-- Se mantienen aquí para unificación bajo el monorepo NEXUS.
-- ──────────────────────────────────────────────────────────────

-- 7.1 Configuración de modos y campañas vinculadas
CREATE TABLE IF NOT EXISTS public.configuracion (
    modo       TEXT        PRIMARY KEY,
    campanas   TEXT        NOT NULL,
    detalle    JSONB       DEFAULT '{}'::JSONB,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7.2 Variables dinámicas de evaluación por modo
CREATE TABLE IF NOT EXISTS public.config_variables (
    id          SERIAL      PRIMARY KEY,
    modo        TEXT        NOT NULL REFERENCES public.configuracion(modo) ON DELETE CASCADE,
    variable    TEXT        NOT NULL CHECK (length(variable) BETWEEN 1 AND 100),
    etiqueta    TEXT,
    tipo        TEXT        DEFAULT 'NUMERO'
                            CHECK (tipo IN ('NUMERO', 'TEXTO', 'BOOLEANO', 'LISTA')),
    obligatorio BOOLEAN     DEFAULT false,
    depende_de  TEXT        DEFAULT '',
    updated_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (modo, variable)
);

CREATE INDEX IF NOT EXISTS idx_config_vars_modo
    ON public.config_variables(modo);

-- 7.3 Destinatarios de reportes programados (Telegram)
CREATE TABLE IF NOT EXISTS public.config_destinatarios (
    id         SERIAL      PRIMARY KEY,
    chat_id    TEXT        NOT NULL UNIQUE,
    frecuencia TEXT        DEFAULT 'DIARIO'
                           CHECK (frecuencia IN ('DIARIO', 'SEMANAL')),
    activo     BOOLEAN     DEFAULT true,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7.4 Emojis de UI para modos, campañas y variables
CREATE TABLE IF NOT EXISTS public.config_emojis (
    id         SERIAL      PRIMARY KEY,
    tipo       TEXT        NOT NULL CHECK (tipo IN ('MODO', 'CAMPAÑA', 'VARIABLE')),
    nombre     TEXT        NOT NULL,
    emoji      TEXT        NOT NULL CHECK (length(emoji) <= 10),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (tipo, nombre)
);

-- 7.5 Cola de mensajes Telegram con reintentos
CREATE TABLE IF NOT EXISTS public.cola_telegram (
    id_cola      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    fecha_encola TIMESTAMPTZ DEFAULT NOW(),
    estado       TEXT        NOT NULL DEFAULT 'PENDIENTE'
                             CHECK (estado IN ('PENDIENTE', 'ENVIADO', 'ERROR', 'REINTENTO')),
    intentos     INTEGER     DEFAULT 0 CHECK (intentos >= 0 AND intentos <= 5),
    payload      JSONB       NOT NULL,
    error_detail TEXT,
    updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cola_telegram_estado
    ON public.cola_telegram(estado)
    WHERE estado != 'ENVIADO';

CREATE INDEX IF NOT EXISTS idx_cola_telegram_fecha
    ON public.cola_telegram(fecha_encola DESC);

-- 7.6 Logs de auditoría legacy de Oriana (compatibilidad con sistema existente)
-- Esta tabla es el equivalente legacy de public.audit_logs para el módulo Oriana
CREATE TABLE IF NOT EXISTS public.logs_auditoria (
    id         BIGSERIAL   PRIMARY KEY,
    fecha_hora TIMESTAMPTZ DEFAULT NOW(),
    usuario    TEXT,
    accion     TEXT,
    detalle    TEXT,
    rol        TEXT,
    -- Índice para consultas por rango de fecha
    CONSTRAINT chk_logs_fecha_not_future
        CHECK (fecha_hora <= now() + INTERVAL '5 seconds')
);

CREATE INDEX IF NOT EXISTS idx_logs_auditoria_fecha
    ON public.logs_auditoria(fecha_hora DESC);

CREATE INDEX IF NOT EXISTS idx_logs_auditoria_usuario
    ON public.logs_auditoria(usuario, fecha_hora DESC);

-- ──────────────────────────────────────────────────────────────
-- SECCIÓN 8: VISTAS DE ANÁLISIS ORIANA
-- ──────────────────────────────────────────────────────────────

-- Vista: estado de reportes Oriana con métricas
CREATE OR REPLACE VIEW public.v_oriana_reports_summary AS
SELECT
    r.id,
    r.report_title,
    r.batch_reference,
    r.status,
    p.full_name                                             AS analyst_name,
    r.total_records,
    r.processed_records,
    ROUND(r.processed_records::NUMERIC / NULLIF(r.total_records, 0)::NUMERIC * 100, 1)
                                                            AS progress_pct,
    m.validation_accuracy,
    m.discrepancy_count,
    m.processing_time_minutes,
    r.submission_deadline,
    CASE
        WHEN r.status IN ('approved')                     THEN 'CUMPLIDO'
        WHEN r.submission_deadline < now()
             AND r.status NOT IN ('approved', 'rejected') THEN 'VENCIDO'
        WHEN r.submission_deadline < (now() + INTERVAL '30 minutes')
             AND r.status NOT IN ('approved')             THEN 'EN_RIESGO'
        ELSE                                                   'EN_TIEMPO'
    END                                                     AS deadline_state,
    r.created_at,
    r.reviewed_at
FROM   public.oriana_reports  r
JOIN   public.profiles         p  ON p.id = r.analyst_id
LEFT JOIN public.oriana_metrics m ON m.report_id = r.id;

-- Vista: rendimiento diario de analistas Oriana
CREATE OR REPLACE VIEW public.v_analyst_daily_performance AS
SELECT
    reg.usuario_operador,
    reg.fecha_reporte                                AS work_date,
    reg.modo_trabajo,
    COUNT(*)                                         AS total_registros,
    SUM(reg.llamadas_efectivas)                      AS total_efectivas,
    SUM(reg.llamadas_totales)                        AS total_llamadas,
    SUM(reg.incidencias_reportadas)                  AS total_incidencias,
    CASE
        WHEN SUM(reg.llamadas_totales) > 0
        THEN ROUND(SUM(reg.llamadas_efectivas)::NUMERIC
                   / SUM(reg.llamadas_totales)::NUMERIC * 100, 2)
        ELSE 0
    END                                              AS tasa_efectividad_pct
FROM   public.registros reg
WHERE  reg.fecha_reporte >= (now() - INTERVAL '30 days')::DATE
GROUP  BY reg.usuario_operador, reg.fecha_reporte, reg.modo_trabajo;

-- ──────────────────────────────────────────────────────────────
-- SECCIÓN 9: ROW LEVEL SECURITY — oriana_reports
-- ──────────────────────────────────────────────────────────────
ALTER TABLE public.oriana_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oriana_reports FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "oriana_reports_select" ON public.oriana_reports;
CREATE POLICY "oriana_reports_select"
    ON public.oriana_reports FOR SELECT
    TO authenticated
    USING (
        public.is_own_record(analyst_id)
        OR public.current_user_has_any_role(
               ARRAY['supervisor', 'module_admin', 'superadmin', 'auditor']
           )
    );

DROP POLICY IF EXISTS "oriana_reports_insert" ON public.oriana_reports;
CREATE POLICY "oriana_reports_insert"
    ON public.oriana_reports FOR INSERT
    TO authenticated
    WITH CHECK (
        public.is_own_record(analyst_id)
        AND public.current_user_has_any_role(
                ARRAY['data_analyst', 'supervisor', 'module_admin', 'superadmin']
            )
    );

DROP POLICY IF EXISTS "oriana_reports_update" ON public.oriana_reports;
CREATE POLICY "oriana_reports_update"
    ON public.oriana_reports FOR UPDATE
    TO authenticated
    USING (
        -- El analista puede editar sus propios reportes en draft/review_pending
        (public.is_own_record(analyst_id) AND
         (SELECT status FROM public.oriana_reports WHERE id = oriana_reports.id)
         IN ('draft', 'review_pending'))
        -- El supervisor puede aprobar/rechazar cualquier reporte
        OR public.current_user_has_any_role(ARRAY['supervisor', 'module_admin', 'superadmin'])
    )
    WITH CHECK (
        (public.is_own_record(analyst_id) AND
         (SELECT status FROM public.oriana_reports WHERE id = oriana_reports.id)
         IN ('draft', 'review_pending'))
        OR public.current_user_has_any_role(ARRAY['supervisor', 'module_admin', 'superadmin'])
    );

-- ──────────────────────────────────────────────────────────────
-- SECCIÓN 10: ROW LEVEL SECURITY — oriana_metrics
-- ──────────────────────────────────────────────────────────────
ALTER TABLE public.oriana_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oriana_metrics FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "oriana_metrics_select" ON public.oriana_metrics;
CREATE POLICY "oriana_metrics_select"
    ON public.oriana_metrics FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.oriana_reports r
            WHERE r.id = oriana_metrics.report_id
            AND (
                public.is_own_record(r.analyst_id)
                OR public.current_user_has_any_role(
                       ARRAY['supervisor', 'module_admin', 'superadmin', 'auditor']
                   )
            )
        )
    );

DROP POLICY IF EXISTS "oriana_metrics_insert" ON public.oriana_metrics;
CREATE POLICY "oriana_metrics_insert"
    ON public.oriana_metrics FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.oriana_reports r
            WHERE r.id = oriana_metrics.report_id
            AND public.is_own_record(r.analyst_id)
            AND public.current_user_has_any_role(
                    ARRAY['data_analyst', 'supervisor', 'module_admin', 'superadmin']
                )
        )
    );

-- ──────────────────────────────────────────────────────────────
-- SECCIÓN 11: ROW LEVEL SECURITY — data_analysis_submissions
-- ──────────────────────────────────────────────────────────────
ALTER TABLE public.data_analysis_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_analysis_submissions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "submissions_select" ON public.data_analysis_submissions;
CREATE POLICY "submissions_select"
    ON public.data_analysis_submissions FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.oriana_reports r
            WHERE r.id = data_analysis_submissions.report_id
            AND (
                public.is_own_record(r.analyst_id)
                OR public.current_user_has_any_role(
                       ARRAY['supervisor', 'module_admin', 'superadmin', 'auditor']
                   )
            )
        )
    );

DROP POLICY IF EXISTS "submissions_insert" ON public.data_analysis_submissions;
CREATE POLICY "submissions_insert"
    ON public.data_analysis_submissions FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.oriana_reports r
            WHERE r.id = data_analysis_submissions.report_id
            AND public.is_own_record(r.analyst_id)
            AND r.status IN ('draft', 'review_pending')
            AND public.current_user_has_any_role(
                    ARRAY['data_analyst', 'supervisor', 'module_admin', 'superadmin']
                )
        )
    );

-- ──────────────────────────────────────────────────────────────
-- SECCIÓN 12: ROW LEVEL SECURITY — registros
-- Compatible con el sistema Oriana legacy.
-- ──────────────────────────────────────────────────────────────
ALTER TABLE public.registros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registros FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "registros_select" ON public.registros;
CREATE POLICY "registros_select"
    ON public.registros FOR SELECT
    TO authenticated
    USING (
        -- El operador puede ver sus propios registros
        usuario_operador = (
            SELECT full_name FROM public.profiles
            WHERE id = auth.uid() LIMIT 1
        )
        OR public.current_user_has_any_role(
               ARRAY['supervisor', 'module_admin', 'superadmin', 'data_analyst', 'auditor']
           )
    );

DROP POLICY IF EXISTS "registros_insert" ON public.registros;
CREATE POLICY "registros_insert"
    ON public.registros FOR INSERT
    TO authenticated
    WITH CHECK (
        public.current_user_has_any_role(
            ARRAY['multi_operator', 'data_analyst', 'supervisor', 'module_admin', 'superadmin']
        )
    );

DROP POLICY IF EXISTS "registros_update_admin" ON public.registros;
CREATE POLICY "registros_update_admin"
    ON public.registros FOR UPDATE
    TO authenticated
    USING  (public.current_user_has_any_role(ARRAY['supervisor', 'module_admin', 'superadmin']))
    WITH CHECK (public.current_user_has_any_role(ARRAY['supervisor', 'module_admin', 'superadmin']));

-- ──────────────────────────────────────────────────────────────
-- SECCIÓN 13: GRANTS
-- ──────────────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE     ON public.oriana_reports              TO authenticated;
GRANT SELECT, INSERT, UPDATE     ON public.oriana_metrics              TO authenticated;
GRANT SELECT, INSERT             ON public.data_analysis_submissions   TO authenticated;
GRANT SELECT, INSERT, UPDATE     ON public.registros                   TO authenticated;
GRANT SELECT                     ON public.registros_daily_aggregates  TO authenticated;
GRANT SELECT                     ON public.configuracion               TO authenticated;
GRANT SELECT                     ON public.config_variables            TO authenticated;
GRANT SELECT                     ON public.config_destinatarios        TO authenticated;
GRANT SELECT                     ON public.config_emojis               TO authenticated;
GRANT SELECT, INSERT, UPDATE     ON public.cola_telegram               TO authenticated;
GRANT SELECT, INSERT             ON public.logs_auditoria              TO authenticated;
GRANT SELECT                     ON public.v_oriana_reports_summary    TO authenticated;
GRANT SELECT                     ON public.v_analyst_daily_performance TO authenticated;

-- Secuencias necesarias para BIGSERIAL
GRANT USAGE ON SEQUENCE public.registros_id_seq            TO authenticated;
GRANT USAGE ON SEQUENCE public.logs_auditoria_id_seq       TO authenticated;
GRANT USAGE ON SEQUENCE public.config_variables_id_seq     TO authenticated;
GRANT USAGE ON SEQUENCE public.config_destinatarios_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE public.config_emojis_id_seq        TO authenticated;

-- ──────────────────────────────────────────────────────────────
-- FIN DE MIGRACIÓN 0004
-- ──────────────────────────────────────────────────────────────

