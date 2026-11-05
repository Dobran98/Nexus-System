-- ============================================================
-- MIGRACIÓN: 0002_attendance_and_telemetry.sql
-- Proyecto: NEXUS SYSTEM — Intranet Empresarial Unificada
-- Descripción: Control de presencia (QR / Biometría / Geolocalización),
--              eventos de marcación (clock_in/out/break), y telemetría
--              de latencia operativa entre marcación y primera tarea.
-- Idempotente: Sí — uso de IF NOT EXISTS, CREATE OR REPLACE
-- Dependencias: 0001_core_and_auth_tables.sql (public.profiles, audit trigger)
-- Fecha: 2026-11-05
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- SECCIÓN 1: TABLA attendance_records
-- Cabecera diaria de asistencia por usuario. UNIQUE(user_id, work_date)
-- garantiza exactamente un registro de asistencia por persona por día.
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.attendance_records (
    id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id              UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    work_date            DATE        NOT NULL,
    status               TEXT        NOT NULL
                                     CHECK (status IN ('present', 'late', 'absent', 'excused')),
    total_active_seconds INT         NOT NULL DEFAULT 0
                                     CHECK (total_active_seconds >= 0),
    -- Resumen calculado al final del día vía Edge Function de cierre de jornada
    clock_in_summary     TIMESTAMPTZ,
    clock_out_summary    TIMESTAMPTZ,
    break_total_seconds  INT         DEFAULT 0
                                     CHECK (break_total_seconds >= 0),
    supervisor_note      TEXT        CHECK (supervisor_note IS NULL OR length(supervisor_note) <= 500),
    created_at           TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    UNIQUE (user_id, work_date)
);

CREATE INDEX IF NOT EXISTS idx_attendance_user_date
    ON public.attendance_records(user_id, work_date DESC);

CREATE INDEX IF NOT EXISTS idx_attendance_date_status
    ON public.attendance_records(work_date DESC, status);

-- Trigger de updated_at para attendance_records
DROP TRIGGER IF EXISTS tr_attendance_updated_at ON public.attendance_records;
CREATE TRIGGER tr_attendance_updated_at
    BEFORE UPDATE ON public.attendance_records
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- ──────────────────────────────────────────────────────────────
-- SECCIÓN 2: TABLA clock_events
-- Eventos atómicos de marcación. Cada entrada, pausa y salida
-- genera una fila independiente. Permite reconstruir la jornada
-- completa de cualquier operador en cualquier fecha.
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.clock_events (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    attendance_id       UUID        NOT NULL REFERENCES public.attendance_records(id) ON DELETE CASCADE,
    event_type          TEXT        NOT NULL
                                    CHECK (event_type IN (
                                        'clock_in',
                                        'break_start',
                                        'break_end',
                                        'clock_out'
                                    )),
    event_timestamp     TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    verification_method TEXT        NOT NULL
                                    CHECK (verification_method IN (
                                        'qr_scan',
                                        'biometric',
                                        'manual_supervisor'
                                    )),
    -- Coordenadas GPS del marcaje (opcionales si el dispositivo no tiene GPS)
    latitude            NUMERIC(10, 8)
                                    CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
    longitude           NUMERIC(11, 8)
                                    CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180),
    -- Huella del dispositivo que originó el marcaje (hash SHA-256 de UserAgent + modelo)
    device_fingerprint  TEXT        NOT NULL
                                    CHECK (length(device_fingerprint) BETWEEN 16 AND 128),
    -- Metadatos adicionales del escaneo (ej: precisión GPS, calidad de señal QR)
    metadata            JSONB       DEFAULT '{}'::JSONB,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_clock_events_attendance
    ON public.clock_events(attendance_id, event_timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_clock_events_type_date
    ON public.clock_events(event_type, event_timestamp DESC);

-- ──────────────────────────────────────────────────────────────
-- SECCIÓN 3: FUNCIÓN Y TRIGGER — Validación de secuencia de eventos
-- Un clock_in no puede registrarse si ya existe uno sin clock_out.
-- break_end debe ir después de un break_start.
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_validate_clock_event_sequence()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_last_event TEXT;
BEGIN
    -- Obtener el último evento registrado para esta asistencia
    SELECT event_type INTO v_last_event
    FROM   public.clock_events
    WHERE  attendance_id = NEW.attendance_id
    ORDER  BY event_timestamp DESC
    LIMIT  1;

    -- Validar secuencia de estados
    CASE NEW.event_type
        WHEN 'clock_in' THEN
            IF v_last_event IS NOT NULL AND v_last_event != 'clock_out' THEN
                RAISE EXCEPTION
                    'No se puede registrar clock_in: ya existe un evento activo (último: %). '
                    'Finalice la jornada actual antes de registrar una nueva entrada.',
                    v_last_event;
            END IF;

        WHEN 'break_start' THEN
            IF v_last_event NOT IN ('clock_in', 'break_end') THEN
                RAISE EXCEPTION
                    'No se puede iniciar pausa: el último evento fue %. '
                    'Se requiere clock_in o break_end previo.',
                    COALESCE(v_last_event, 'ninguno');
            END IF;

        WHEN 'break_end' THEN
            IF v_last_event != 'break_start' THEN
                RAISE EXCEPTION
                    'No se puede finalizar pausa: el último evento fue %. '
                    'Se requiere break_start previo.',
                    COALESCE(v_last_event, 'ninguno');
            END IF;

        WHEN 'clock_out' THEN
            IF v_last_event NOT IN ('clock_in', 'break_end') THEN
                RAISE EXCEPTION
                    'No se puede registrar salida: el último evento fue %. '
                    'Se requiere clock_in o break_end previo.',
                    COALESCE(v_last_event, 'ninguno');
            END IF;
    END CASE;

    -- Validar que el timestamp no sea futuro (tolerancia de 60 segundos)
    IF NEW.event_timestamp > (now() + INTERVAL '60 seconds') THEN
        RAISE EXCEPTION
            'El timestamp del evento no puede ser en el futuro: %',
            NEW.event_timestamp;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_validate_clock_sequence ON public.clock_events;
CREATE TRIGGER tr_validate_clock_sequence
    BEFORE INSERT ON public.clock_events
    FOR EACH ROW EXECUTE FUNCTION public.fn_validate_clock_event_sequence();

-- ──────────────────────────────────────────────────────────────
-- SECCIÓN 4: FUNCIÓN Y TRIGGER — Recalcular total_active_seconds
-- Se dispara AFTER INSERT en clock_events cuando event_type = 'clock_out'.
-- Suma todos los intervalos activos (clock_in → break_start → clock_out)
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_recalculate_active_seconds()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_total_active INT := 0;
    v_events       RECORD;
    v_session_start TIMESTAMPTZ;
BEGIN
    -- Solo recalcular cuando se registra una salida o fin de pausa
    IF NEW.event_type NOT IN ('clock_out', 'break_start') THEN
        RETURN NEW;
    END IF;

    -- Calcular segundos activos: suma de (inicio_segmento → fin_segmento)
    -- Segmentos activos: clock_in|break_end → break_start|clock_out
    SELECT COALESCE(SUM(active_seconds), 0)::INT
    INTO   v_total_active
    FROM (
        WITH ordered_events AS (
            SELECT
                event_type,
                event_timestamp,
                LAG(event_timestamp) OVER (ORDER BY event_timestamp) AS prev_ts,
                LAG(event_type)      OVER (ORDER BY event_timestamp) AS prev_type
            FROM public.clock_events
            WHERE attendance_id = NEW.attendance_id
            ORDER BY event_timestamp
        )
        SELECT
            EXTRACT(EPOCH FROM (event_timestamp - prev_ts))::INT AS active_seconds
        FROM ordered_events
        WHERE event_type IN ('break_start', 'clock_out')
        AND   prev_type  IN ('clock_in', 'break_end')
        AND   prev_ts IS NOT NULL
    ) segments;

    -- Actualizar el registro de asistencia
    UPDATE public.attendance_records
    SET    total_active_seconds = v_total_active,
           updated_at           = timezone('utc', now()),
           clock_out_summary    = CASE
                                      WHEN NEW.event_type = 'clock_out'
                                      THEN NEW.event_timestamp
                                      ELSE clock_out_summary
                                  END
    WHERE  id = NEW.attendance_id;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_recalculate_active_seconds ON public.clock_events;
CREATE TRIGGER tr_recalculate_active_seconds
    AFTER INSERT ON public.clock_events
    FOR EACH ROW
    WHEN (NEW.event_type IN ('clock_out', 'break_start'))
    EXECUTE FUNCTION public.fn_recalculate_active_seconds();

-- ──────────────────────────────────────────────────────────────
-- SECCIÓN 5: TABLA workflow_latency_logs
-- Mide el tiempo entre el clock_in y la primera acción en un
-- módulo de trabajo (llamadas, Oriana, incidencias).
-- Esta tabla es el insumo principal del sistema de scoring de latencia.
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.workflow_latency_logs (
    id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    attendance_id           UUID        NOT NULL REFERENCES public.attendance_records(id) ON DELETE CASCADE,
    clock_in_time           TIMESTAMPTZ NOT NULL,
    first_task_event_time   TIMESTAMPTZ,
    -- Columna calculada: diferencia en segundos entre clock_in y primera tarea
    latency_seconds         INT
                                        GENERATED ALWAYS AS (
                                            CASE
                                                WHEN first_task_event_time IS NOT NULL
                                                THEN EXTRACT(EPOCH FROM
                                                         (first_task_event_time - clock_in_time)
                                                     )::INT
                                                ELSE NULL
                                            END
                                        ) STORED,
    task_module             TEXT        NOT NULL
                                        CHECK (task_module IN (
                                            'calls',
                                            'oriana_analysis',
                                            'incidents'
                                        )),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    -- Garantizar un único log de latencia por jornada/módulo
    UNIQUE (attendance_id, task_module)
);

CREATE INDEX IF NOT EXISTS idx_latency_user_date
    ON public.workflow_latency_logs(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_latency_module
    ON public.workflow_latency_logs(task_module, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_latency_seconds
    ON public.workflow_latency_logs(latency_seconds)
    WHERE latency_seconds IS NOT NULL;

-- ──────────────────────────────────────────────────────────────
-- SECCIÓN 6: TABLA telemetry_daily_aggregates
-- Resumen diario permanente de latencias. Se puebla mediante
-- la función de purga (0005_scoring_and_partitioning.sql).
-- Nunca se purga — es el histórico analítico de largo plazo.
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.telemetry_daily_aggregates (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    summary_date     DATE        NOT NULL,
    task_module      TEXT        NOT NULL
                                 CHECK (task_module IN ('calls', 'oriana_analysis', 'incidents')),
    total_events     INT         NOT NULL DEFAULT 0 CHECK (total_events >= 0),
    avg_latency_sec  INT         NOT NULL DEFAULT 0,
    min_latency_sec  INT,
    max_latency_sec  INT,
    p50_latency_sec  INT,
    p95_latency_sec  INT,
    total_operators  INT         DEFAULT 0,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    UNIQUE (summary_date, task_module)
);

CREATE INDEX IF NOT EXISTS idx_telemetry_agg_date
    ON public.telemetry_daily_aggregates(summary_date DESC);

CREATE INDEX IF NOT EXISTS idx_telemetry_agg_module
    ON public.telemetry_daily_aggregates(task_module);

-- ──────────────────────────────────────────────────────────────
-- SECCIÓN 7: TRIGGERS DE AUDITORÍA — attendance_records y clock_events
-- ──────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS tr_audit_attendance ON public.attendance_records;
CREATE TRIGGER tr_audit_attendance
    AFTER INSERT OR UPDATE OR DELETE ON public.attendance_records
    FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();

-- clock_events no tiene auditoría de fila completa para reducir volumen
-- en audit_logs (es la tabla de mayor frecuencia de escritura).
-- La inmutabilidad se garantiza via RLS (sin UPDATE/DELETE permitido a usuarios).

-- ──────────────────────────────────────────────────────────────
-- SECCIÓN 8: ROW LEVEL SECURITY — attendance_records
-- ──────────────────────────────────────────────────────────────
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "attendance_select" ON public.attendance_records;
CREATE POLICY "attendance_select"
    ON public.attendance_records FOR SELECT
    TO authenticated
    USING (
        public.is_own_record(user_id)
        OR public.current_user_has_any_role(
               ARRAY['supervisor', 'module_admin', 'superadmin', 'auditor']
           )
    );

DROP POLICY IF EXISTS "attendance_insert_own" ON public.attendance_records;
CREATE POLICY "attendance_insert_own"
    ON public.attendance_records FOR INSERT
    TO authenticated
    WITH CHECK (public.is_own_record(user_id));

DROP POLICY IF EXISTS "attendance_update_supervisor" ON public.attendance_records;
CREATE POLICY "attendance_update_supervisor"
    ON public.attendance_records FOR UPDATE
    TO authenticated
    USING  (public.current_user_has_any_role(ARRAY['supervisor', 'module_admin', 'superadmin']))
    WITH CHECK (public.current_user_has_any_role(ARRAY['supervisor', 'module_admin', 'superadmin']));

DROP POLICY IF EXISTS "attendance_delete_superadmin" ON public.attendance_records;
CREATE POLICY "attendance_delete_superadmin"
    ON public.attendance_records FOR DELETE
    TO authenticated
    USING (public.current_user_has_role('superadmin'));

-- ──────────────────────────────────────────────────────────────
-- SECCIÓN 9: ROW LEVEL SECURITY — clock_events
-- ──────────────────────────────────────────────────────────────
ALTER TABLE public.clock_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clock_events FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clock_events_select" ON public.clock_events;
CREATE POLICY "clock_events_select"
    ON public.clock_events FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.attendance_records ar
            WHERE ar.id = clock_events.attendance_id
            AND (
                public.is_own_record(ar.user_id)
                OR public.current_user_has_any_role(
                       ARRAY['supervisor', 'module_admin', 'superadmin', 'auditor']
                   )
            )
        )
    );

DROP POLICY IF EXISTS "clock_events_insert" ON public.clock_events;
CREATE POLICY "clock_events_insert"
    ON public.clock_events FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.attendance_records ar
            WHERE ar.id = clock_events.attendance_id
            AND   public.is_own_record(ar.user_id)
        )
    );

-- Eventos de reloj son inmutables: no UPDATE ni DELETE por operadores
DROP POLICY IF EXISTS "clock_events_update_deny" ON public.clock_events;
CREATE POLICY "clock_events_update_deny"
    ON public.clock_events FOR UPDATE
    TO authenticated
    USING (public.current_user_has_role('superadmin'))
    WITH CHECK (public.current_user_has_role('superadmin'));

DROP POLICY IF EXISTS "clock_events_delete_deny" ON public.clock_events;
CREATE POLICY "clock_events_delete_deny"
    ON public.clock_events FOR DELETE
    TO authenticated
    USING (public.current_user_has_role('superadmin'));

-- ──────────────────────────────────────────────────────────────
-- SECCIÓN 10: ROW LEVEL SECURITY — workflow_latency_logs
-- ──────────────────────────────────────────────────────────────
ALTER TABLE public.workflow_latency_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_latency_logs FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "latency_select" ON public.workflow_latency_logs;
CREATE POLICY "latency_select"
    ON public.workflow_latency_logs FOR SELECT
    TO authenticated
    USING (
        public.is_own_record(user_id)
        OR public.current_user_has_any_role(
               ARRAY['supervisor', 'module_admin', 'superadmin', 'data_analyst', 'auditor']
           )
    );

DROP POLICY IF EXISTS "latency_insert_own" ON public.workflow_latency_logs;
CREATE POLICY "latency_insert_own"
    ON public.workflow_latency_logs FOR INSERT
    TO authenticated
    WITH CHECK (public.is_own_record(user_id));

DROP POLICY IF EXISTS "latency_update_own" ON public.workflow_latency_logs;
CREATE POLICY "latency_update_own"
    ON public.workflow_latency_logs FOR UPDATE
    TO authenticated
    USING  (public.is_own_record(user_id))
    WITH CHECK (public.is_own_record(user_id));

-- ──────────────────────────────────────────────────────────────
-- SECCIÓN 11: ROW LEVEL SECURITY — telemetry_daily_aggregates
-- Solo supervisores y superiores pueden leer los agregados
-- ──────────────────────────────────────────────────────────────
ALTER TABLE public.telemetry_daily_aggregates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telemetry_daily_aggregates FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "telemetry_agg_select" ON public.telemetry_daily_aggregates;
CREATE POLICY "telemetry_agg_select"
    ON public.telemetry_daily_aggregates FOR SELECT
    TO authenticated
    USING (
        public.current_user_has_any_role(
            ARRAY['supervisor', 'module_admin', 'superadmin', 'data_analyst', 'auditor']
        )
    );

-- Solo procesos internos (service_role) pueden escribir en agregados
DROP POLICY IF EXISTS "telemetry_agg_write_deny" ON public.telemetry_daily_aggregates;
CREATE POLICY "telemetry_agg_write_deny"
    ON public.telemetry_daily_aggregates FOR INSERT
    TO authenticated
    WITH CHECK (FALSE);

-- ──────────────────────────────────────────────────────────────
-- SECCIÓN 12: GRANTS
-- ──────────────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE ON public.attendance_records        TO authenticated;
GRANT SELECT, INSERT         ON public.clock_events              TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.workflow_latency_logs     TO authenticated;
GRANT SELECT                 ON public.telemetry_daily_aggregates TO authenticated;

-- ──────────────────────────────────────────────────────────────
-- FIN DE MIGRACIÓN 0002
-- ──────────────────────────────────────────────────────────────

