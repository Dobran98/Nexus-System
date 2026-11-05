-- ============================================================
-- MIGRACIÓN: 0003_calls_and_incidents.sql
-- Proyecto: NEXUS SYSTEM — Intranet Empresarial Unificada
-- Descripción: Parque de terminales Samsung corporativos, campañas
--              de llamadas salientes, asignación de leads a operadores,
--              registro de interacciones (sin PBX) y gestión de tickets
--              de incidencias con SLA.
-- Idempotente: Sí — uso de IF NOT EXISTS, CREATE OR REPLACE
-- Dependencias: 0001_core_and_auth_tables.sql
-- Fecha: 2026-11-05
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- SECCIÓN 1: TABLA corporate_devices
-- Inventario de terminales Samsung. La columna imei tiene
-- validación de formato (15 dígitos) + CHECK de Luhn en trigger.
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.corporate_devices (
    id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    assigned_user_id     UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
    imei                 TEXT        UNIQUE NOT NULL
                                     CHECK (imei ~ '^[0-9]{15}$'),
    imei2                TEXT
                                     CHECK (imei2 IS NULL OR imei2 ~ '^[0-9]{15}$'),
    phone_number         TEXT        NOT NULL
                                     CHECK (phone_number ~ '^\+?[0-9\s\-()\.]{7,20}$'),
    model                TEXT        NOT NULL
                                     CHECK (length(model) BETWEEN 3 AND 100),
    android_version      TEXT,
    knox_version         TEXT,
    knox_enrollment_id   TEXT        UNIQUE
                                     CHECK (knox_enrollment_id IS NULL OR
                                            knox_enrollment_id ~ '^KE-[A-Z0-9]{8,32}$'),
    battery_health_pct   INT
                                     CHECK (battery_health_pct IS NULL OR
                                            battery_health_pct BETWEEN 0 AND 100),
    storage_free_gb      NUMERIC(5, 2),
    status               TEXT        NOT NULL DEFAULT 'available'
                                     CHECK (status IN (
                                         'available',
                                         'assigned',
                                         'maintenance',
                                         'lost',
                                         'decommissioned'
                                     )),
    last_seen_at         TIMESTAMPTZ,
    notes                TEXT        CHECK (notes IS NULL OR length(notes) <= 500),
    created_at           TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_devices_assigned_user
    ON public.corporate_devices(assigned_user_id);

CREATE INDEX IF NOT EXISTS idx_devices_status
    ON public.corporate_devices(status);

CREATE INDEX IF NOT EXISTS idx_devices_phone
    ON public.corporate_devices(phone_number);

-- Trigger de updated_at para corporate_devices
DROP TRIGGER IF EXISTS tr_devices_updated_at ON public.corporate_devices;
CREATE TRIGGER tr_devices_updated_at
    BEFORE UPDATE ON public.corporate_devices
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- ──────────────────────────────────────────────────────────────
-- SECCIÓN 2: FUNCIÓN — Validación del algoritmo de Luhn para IMEI
-- El CHECK de regex solo valida formato. Este trigger valida
-- la integridad del dígito verificador del IMEI (estándar ITU-T E.212).
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_validate_imei_luhn()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_imei TEXT  := NEW.imei;
    v_sum  INT   := 0;
    v_digit INT;
    i INT;
BEGIN
    -- Iterar los 15 dígitos del IMEI
    FOR i IN 1..15 LOOP
        v_digit := substring(v_imei, i, 1)::INT;
        -- Duplicar dígitos en posiciones pares (base-1)
        IF i % 2 = 0 THEN
            v_digit := v_digit * 2;
            IF v_digit > 9 THEN
                v_digit := v_digit - 9;
            END IF;
        END IF;
        v_sum := v_sum + v_digit;
    END LOOP;

    -- El IMEI es válido si la suma total es múltiplo de 10
    IF v_sum % 10 != 0 THEN
        RAISE EXCEPTION
            'IMEI inválido: % no pasa la verificación del algoritmo de Luhn '
            '(suma de verificación: %, esperado múltiplo de 10).',
            v_imei, v_sum;
    END IF;

    -- Validar que el modelo es Samsung (solo terminales corporativos Samsung permitidos)
    IF lower(NEW.model) NOT LIKE '%samsung%' THEN
        RAISE EXCEPTION
            'Solo se permiten terminales Samsung en la flota corporativa. '
            'Modelo recibido: %', NEW.model;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_validate_imei ON public.corporate_devices;
CREATE TRIGGER tr_validate_imei
    BEFORE INSERT OR UPDATE ON public.corporate_devices
    FOR EACH ROW EXECUTE FUNCTION public.fn_validate_imei_luhn();

-- ──────────────────────────────────────────────────────────────
-- SECCIÓN 3: TABLA call_campaigns
-- Campañas de llamadas salientes gestionadas por module_admin.
-- Define la cuota diaria base por operador.
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.call_campaigns (
    id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    title                  TEXT        NOT NULL
                                       CHECK (length(title) BETWEEN 3 AND 200),
    description            TEXT,
    status                 TEXT        NOT NULL DEFAULT 'draft'
                                       CHECK (status IN ('draft', 'active', 'paused', 'completed')),
    daily_quota_per_operator INT        NOT NULL DEFAULT 200
                                       CHECK (daily_quota_per_operator BETWEEN 1 AND 2000),
    created_by             UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_campaigns_status
    ON public.call_campaigns(status);

DROP TRIGGER IF EXISTS tr_campaigns_updated_at ON public.call_campaigns;
CREATE TRIGGER tr_campaigns_updated_at
    BEFORE UPDATE ON public.call_campaigns
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- ──────────────────────────────────────────────────────────────
-- SECCIÓN 4: TABLA call_assignments
-- Asignación individual de números/leads a operadores dentro
-- de una campaña. La prioridad determina el orden de marcación.
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.call_assignments (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id     UUID        NOT NULL REFERENCES public.call_campaigns(id) ON DELETE CASCADE,
    operator_id     UUID        NOT NULL REFERENCES public.profiles(id),
    customer_phone  TEXT        NOT NULL
                                CHECK (customer_phone ~ '^\+?[0-9\s\-()\.]{7,20}$'),
    customer_name   TEXT        CHECK (customer_name IS NULL OR length(customer_name) <= 200),
    priority        INT         NOT NULL DEFAULT 1
                                CHECK (priority BETWEEN 1 AND 10),
    state           TEXT        NOT NULL DEFAULT 'queued'
                                CHECK (state IN ('queued', 'calling', 'completed', 'rescheduled')),
    rescheduled_for TIMESTAMPTZ,
    assigned_at     TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_assignments_operator_state
    ON public.call_assignments(operator_id, state)
    WHERE state IN ('queued', 'calling');

CREATE INDEX IF NOT EXISTS idx_assignments_campaign
    ON public.call_assignments(campaign_id, state);

CREATE INDEX IF NOT EXISTS idx_assignments_priority
    ON public.call_assignments(operator_id, priority DESC, assigned_at ASC)
    WHERE state = 'queued';

-- ──────────────────────────────────────────────────────────────
-- SECCIÓN 5: TABLA call_interactions
-- Registro de cada llamada ejecutada desde terminal Samsung.
-- La duración es ALWAYS GENERATED: no puede ser manipulada por el cliente.
-- idle_time_prior_call: capturado por el discador guiado de la intranet.
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.call_interactions (
    id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id        UUID        NOT NULL REFERENCES public.call_assignments(id) ON DELETE CASCADE,
    operator_id          UUID        NOT NULL REFERENCES public.profiles(id),
    device_id            UUID        NOT NULL REFERENCES public.corporate_devices(id),
    start_time           TIMESTAMPTZ NOT NULL,
    end_time             TIMESTAMPTZ NOT NULL,
    -- Duración calculada por PostgreSQL — inmutable desde el cliente
    duration_seconds     INT
                                     GENERATED ALWAYS AS (
                                         EXTRACT(EPOCH FROM (end_time - start_time))::INT
                                     ) STORED,
    result               TEXT        NOT NULL
                                     CHECK (result IN (
                                         'answered_effective',
                                         'busy',
                                         'no_answer',
                                         'invalid_number',
                                         'rejected'
                                     )),
    -- Tiempo inactivo desde la última llamada finalizada (medido por la intranet)
    idle_time_prior_call INT         NOT NULL DEFAULT 0
                                     CHECK (idle_time_prior_call >= 0 AND
                                            idle_time_prior_call <= 86400),
    notes                TEXT        CHECK (notes IS NULL OR length(notes) <= 1000),
    created_at           TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),

    -- ── CONSTRAINTS DE INTEGRIDAD TEMPORAL ──
    CONSTRAINT chk_end_after_start
        CHECK (end_time > start_time),
    CONSTRAINT chk_duration_max_2h
        CHECK (EXTRACT(EPOCH FROM (end_time - start_time)) <= 7200),
    CONSTRAINT chk_duration_min_1s
        CHECK (EXTRACT(EPOCH FROM (end_time - start_time)) >= 1),
    CONSTRAINT chk_start_not_future
        CHECK (start_time <= timezone('utc', now()) + INTERVAL '60 seconds')
);

CREATE INDEX IF NOT EXISTS idx_call_int_operator
    ON public.call_interactions(operator_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_call_int_device
    ON public.call_interactions(device_id);

CREATE INDEX IF NOT EXISTS idx_call_int_result
    ON public.call_interactions(result, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_call_int_assignment
    ON public.call_interactions(assignment_id);

-- Índice parcial para análisis de llamadas efectivas
CREATE INDEX IF NOT EXISTS idx_call_int_effective
    ON public.call_interactions(operator_id, created_at::DATE)
    WHERE result = 'answered_effective';

-- ──────────────────────────────────────────────────────────────
-- SECCIÓN 6: TRIGGERS en call_interactions
-- ──────────────────────────────────────────────────────────────

-- 6.1 Validar que el dispositivo está disponible y asignado al operador
CREATE OR REPLACE FUNCTION public.fn_validate_call_interaction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Verificar disponibilidad del dispositivo
    IF NOT EXISTS (
        SELECT 1 FROM public.corporate_devices
        WHERE  id     = NEW.device_id
        AND    status IN ('available', 'assigned')
    ) THEN
        RAISE EXCEPTION
            'El dispositivo % no está disponible (mantenimiento, perdido o dado de baja). '
            'Contacte a su supervisor.', NEW.device_id;
    END IF;

    -- Verificar que el dispositivo está asignado al operador (o disponible para uso temporal)
    IF NOT EXISTS (
        SELECT 1 FROM public.corporate_devices
        WHERE  id = NEW.device_id
        AND    (assigned_user_id = NEW.operator_id OR assigned_user_id IS NULL)
    ) THEN
        RAISE EXCEPTION
            'El dispositivo % no está asignado al operador %. '
            'Solicite reasignación a su supervisor.', NEW.device_id, NEW.operator_id;
    END IF;

    -- Verificar que la asignación pertenece al operador y está activa
    IF NOT EXISTS (
        SELECT 1 FROM public.call_assignments
        WHERE  id          = NEW.assignment_id
        AND    operator_id = NEW.operator_id
        AND    state       IN ('queued', 'calling')
    ) THEN
        RAISE EXCEPTION
            'La asignación % no pertenece al operador % o ya fue completada/reagendada.',
            NEW.assignment_id, NEW.operator_id;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_validate_call ON public.call_interactions;
CREATE TRIGGER tr_validate_call
    BEFORE INSERT ON public.call_interactions
    FOR EACH ROW EXECUTE FUNCTION public.fn_validate_call_interaction();

-- 6.2 Actualizar estado de la asignación tras registrar la interacción
CREATE OR REPLACE FUNCTION public.fn_update_assignment_after_call()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.call_assignments
    SET    state = CASE
                      WHEN NEW.result = 'answered_effective' THEN 'completed'
                      WHEN NEW.result IN ('busy', 'no_answer') THEN 'rescheduled'
                      ELSE 'completed'
                  END
    WHERE  id = NEW.assignment_id;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_update_assignment_after_call ON public.call_interactions;
CREATE TRIGGER tr_update_assignment_after_call
    AFTER INSERT ON public.call_interactions
    FOR EACH ROW EXECUTE FUNCTION public.fn_update_assignment_after_call();

-- 6.3 Trigger de auditoría en interacciones
DROP TRIGGER IF EXISTS tr_audit_call_interactions ON public.call_interactions;
CREATE TRIGGER tr_audit_call_interactions
    AFTER INSERT OR UPDATE OR DELETE ON public.call_interactions
    FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();

-- ──────────────────────────────────────────────────────────────
-- SECCIÓN 7: TABLA call_daily_aggregates
-- KPIs diarios de rendimiento de llamadas por operador.
-- Se puebla por la función de purga y nunca se elimina.
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.call_daily_aggregates (
    id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    summary_date            DATE        NOT NULL,
    operator_id             UUID        NOT NULL,
    campaign_id             UUID,
    total_calls             INT         NOT NULL DEFAULT 0 CHECK (total_calls >= 0),
    effective_calls         INT         NOT NULL DEFAULT 0 CHECK (effective_calls >= 0),
    busy_calls              INT         NOT NULL DEFAULT 0 CHECK (busy_calls >= 0),
    no_answer_calls         INT         NOT NULL DEFAULT 0 CHECK (no_answer_calls >= 0),
    invalid_calls           INT         NOT NULL DEFAULT 0 CHECK (invalid_calls >= 0),
    rejected_calls          INT         NOT NULL DEFAULT 0 CHECK (rejected_calls >= 0),
    avg_duration_sec        INT,
    avg_idle_time_prior_sec INT,
    daily_quota_met         BOOLEAN     DEFAULT FALSE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    UNIQUE (summary_date, operator_id, campaign_id)
);

CREATE INDEX IF NOT EXISTS idx_call_agg_date
    ON public.call_daily_aggregates(summary_date DESC);

CREATE INDEX IF NOT EXISTS idx_call_agg_operator
    ON public.call_daily_aggregates(operator_id, summary_date DESC);

-- ──────────────────────────────────────────────────────────────
-- SECCIÓN 8: TABLA incidents
-- Gestión de incidencias operativas con SLA.
-- severity determina el tiempo de respuesta esperado:
--   critical → 1h, high → 4h, medium → 24h, low → 72h
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.incidents (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id      UUID        NOT NULL REFERENCES public.profiles(id),
    assigned_to      UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
    title            TEXT        NOT NULL
                                 CHECK (length(title) BETWEEN 5 AND 200),
    description      TEXT        NOT NULL
                                 CHECK (length(description) BETWEEN 10 AND 5000),
    severity         TEXT        NOT NULL
                                 CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    status           TEXT        NOT NULL DEFAULT 'open'
                                 CHECK (status IN (
                                     'open',
                                     'investigating',
                                     'resolved',
                                     'closed'
                                 )),
    -- SLA calculado según severity: definido al crear la incidencia
    sla_due_date     TIMESTAMPTZ NOT NULL,
    -- Indicador de incumplimiento de SLA (calculado por trigger o Edge Function)
    sla_breached     BOOLEAN     NOT NULL DEFAULT FALSE,
    resolution_notes TEXT        CHECK (resolution_notes IS NULL OR length(resolution_notes) <= 3000),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    resolved_at      TIMESTAMPTZ,
    closed_at        TIMESTAMPTZ,

    -- Coherencia: resolved_at solo aplica cuando status = resolved|closed
    CONSTRAINT chk_resolved_at_requires_status
        CHECK (resolved_at IS NULL OR status IN ('resolved', 'closed')),
    -- SLA debe ser igual o posterior a la creación
    CONSTRAINT chk_sla_after_created
        CHECK (sla_due_date >= created_at)
);

CREATE INDEX IF NOT EXISTS idx_incidents_reporter
    ON public.incidents(reporter_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_incidents_assigned
    ON public.incidents(assigned_to, status)
    WHERE status IN ('open', 'investigating');

CREATE INDEX IF NOT EXISTS idx_incidents_severity_open
    ON public.incidents(severity, created_at DESC)
    WHERE status IN ('open', 'investigating');

CREATE INDEX IF NOT EXISTS idx_incidents_sla_due
    ON public.incidents(sla_due_date)
    WHERE status IN ('open', 'investigating');

-- Trigger de updated_at y sla_breached check
CREATE OR REPLACE FUNCTION public.fn_incidents_before_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    NEW.updated_at := timezone('utc', now());

    -- Marcar SLA como incumplido si ya venció y la incidencia sigue abierta
    IF NEW.status IN ('open', 'investigating') AND NEW.sla_due_date < now() THEN
        NEW.sla_breached := TRUE;
    END IF;

    -- Registrar timestamps de resolución/cierre
    IF NEW.status = 'resolved' AND OLD.status != 'resolved' THEN
        NEW.resolved_at := now();
    END IF;
    IF NEW.status = 'closed' AND OLD.status != 'closed' THEN
        NEW.closed_at := now();
        IF NEW.resolved_at IS NULL THEN
            NEW.resolved_at := now();
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_incidents_before_update ON public.incidents;
CREATE TRIGGER tr_incidents_before_update
    BEFORE UPDATE ON public.incidents
    FOR EACH ROW EXECUTE FUNCTION public.fn_incidents_before_update();

-- Función auxiliar: calcular sla_due_date según severity
CREATE OR REPLACE FUNCTION public.fn_calculate_sla_due_date(p_severity TEXT)
RETURNS TIMESTAMPTZ
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT CASE p_severity
        WHEN 'critical' THEN now() + INTERVAL '1 hour'
        WHEN 'high'     THEN now() + INTERVAL '4 hours'
        WHEN 'medium'   THEN now() + INTERVAL '24 hours'
        WHEN 'low'      THEN now() + INTERVAL '72 hours'
        ELSE                 now() + INTERVAL '72 hours'
    END;
$$;

-- Trigger para calcular sla_due_date al insertar si no se provee
CREATE OR REPLACE FUNCTION public.fn_incidents_before_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Auto-calcular SLA si no se proveyó explícitamente
    IF NEW.sla_due_date IS NULL THEN
        NEW.sla_due_date := public.fn_calculate_sla_due_date(NEW.severity);
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_incidents_before_insert ON public.incidents;
CREATE TRIGGER tr_incidents_before_insert
    BEFORE INSERT ON public.incidents
    FOR EACH ROW EXECUTE FUNCTION public.fn_incidents_before_insert();

-- Trigger de auditoría en incidents
DROP TRIGGER IF EXISTS tr_audit_incidents ON public.incidents;
CREATE TRIGGER tr_audit_incidents
    AFTER INSERT OR UPDATE OR DELETE ON public.incidents
    FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();

-- ──────────────────────────────────────────────────────────────
-- SECCIÓN 9: VISTAS DE ANÁLISIS OPERATIVO
-- ──────────────────────────────────────────────────────────────

-- Vista: rendimiento diario de llamadas por operador
CREATE OR REPLACE VIEW public.v_daily_call_performance AS
SELECT
    ci.operator_id,
    p.full_name                                                   AS operator_name,
    ci.created_at::DATE                                           AS work_date,
    COUNT(*)                                                      AS total_calls,
    COUNT(*) FILTER (WHERE ci.result = 'answered_effective')      AS effective_calls,
    COUNT(*) FILTER (WHERE ci.result = 'busy')                    AS busy_calls,
    COUNT(*) FILTER (WHERE ci.result = 'no_answer')               AS no_answer_calls,
    ROUND(
        COUNT(*) FILTER (WHERE ci.result = 'answered_effective')::NUMERIC
        / NULLIF(COUNT(*), 0)::NUMERIC * 100, 2
    )                                                             AS effective_rate_pct,
    AVG(ci.duration_seconds)::INT                                 AS avg_duration_sec,
    AVG(ci.idle_time_prior_call)::INT                             AS avg_idle_sec,
    COUNT(*) FILTER (WHERE ci.idle_time_prior_call > 45)          AS calls_with_excessive_idle
FROM   public.call_interactions ci
JOIN   public.profiles          p  ON p.id = ci.operator_id
WHERE  ci.created_at >= (now() - INTERVAL '30 days')
GROUP  BY ci.operator_id, p.full_name, ci.created_at::DATE;

-- Vista: incidencias con SLA en riesgo o incumplidas
CREATE OR REPLACE VIEW public.v_incidents_sla_status AS
SELECT
    i.id,
    i.title,
    i.severity,
    i.status,
    i.sla_due_date,
    i.sla_breached,
    rp.full_name                                   AS reporter_name,
    ap.full_name                                   AS assigned_to_name,
    CASE
        WHEN i.status IN ('resolved', 'closed')   THEN 'CUMPLIDO'
        WHEN i.sla_due_date < now()               THEN 'INCUMPLIDO'
        WHEN i.sla_due_date < (now() + INTERVAL '2 hours') THEN 'EN_RIESGO'
        ELSE                                           'EN_TIEMPO'
    END                                            AS sla_state,
    EXTRACT(EPOCH FROM (i.sla_due_date - now()))::INT AS seconds_until_sla,
    i.created_at,
    i.resolved_at
FROM   public.incidents i
JOIN   public.profiles  rp ON rp.id = i.reporter_id
LEFT JOIN public.profiles ap ON ap.id = i.assigned_to;

-- ──────────────────────────────────────────────────────────────
-- SECCIÓN 10: ROW LEVEL SECURITY — corporate_devices
-- ──────────────────────────────────────────────────────────────
ALTER TABLE public.corporate_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.corporate_devices FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "devices_select" ON public.corporate_devices;
CREATE POLICY "devices_select"
    ON public.corporate_devices FOR SELECT
    TO authenticated
    USING (
        assigned_user_id = auth.uid()
        OR public.current_user_has_any_role(
               ARRAY['supervisor', 'module_admin', 'superadmin', 'auditor']
           )
    );

DROP POLICY IF EXISTS "devices_insert_admin" ON public.corporate_devices;
CREATE POLICY "devices_insert_admin"
    ON public.corporate_devices FOR INSERT
    TO authenticated
    WITH CHECK (
        public.current_user_has_any_role(ARRAY['module_admin', 'superadmin'])
    );

DROP POLICY IF EXISTS "devices_update_admin" ON public.corporate_devices;
CREATE POLICY "devices_update_admin"
    ON public.corporate_devices FOR UPDATE
    TO authenticated
    USING  (public.current_user_has_any_role(ARRAY['module_admin', 'superadmin']))
    WITH CHECK (public.current_user_has_any_role(ARRAY['module_admin', 'superadmin']));

DROP POLICY IF EXISTS "devices_delete_superadmin" ON public.corporate_devices;
CREATE POLICY "devices_delete_superadmin"
    ON public.corporate_devices FOR DELETE
    TO authenticated
    USING (public.current_user_has_role('superadmin'));

-- ──────────────────────────────────────────────────────────────
-- SECCIÓN 11: ROW LEVEL SECURITY — call_campaigns
-- ──────────────────────────────────────────────────────────────
ALTER TABLE public.call_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_campaigns FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "campaigns_select" ON public.call_campaigns;
CREATE POLICY "campaigns_select"
    ON public.call_campaigns FOR SELECT
    TO authenticated
    USING (
        public.current_user_has_any_role(
            ARRAY['multi_operator', 'supervisor', 'module_admin', 'superadmin', 'auditor']
        )
    );

DROP POLICY IF EXISTS "campaigns_write_admin" ON public.call_campaigns;
CREATE POLICY "campaigns_write_admin"
    ON public.call_campaigns FOR ALL
    TO authenticated
    USING  (public.current_user_has_any_role(ARRAY['module_admin', 'superadmin']))
    WITH CHECK (public.current_user_has_any_role(ARRAY['module_admin', 'superadmin']));

-- ──────────────────────────────────────────────────────────────
-- SECCIÓN 12: ROW LEVEL SECURITY — call_assignments
-- ──────────────────────────────────────────────────────────────
ALTER TABLE public.call_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_assignments FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "assignments_select" ON public.call_assignments;
CREATE POLICY "assignments_select"
    ON public.call_assignments FOR SELECT
    TO authenticated
    USING (
        public.is_own_record(operator_id)
        OR public.current_user_has_any_role(
               ARRAY['supervisor', 'module_admin', 'superadmin', 'auditor']
           )
    );

DROP POLICY IF EXISTS "assignments_insert_admin" ON public.call_assignments;
CREATE POLICY "assignments_insert_admin"
    ON public.call_assignments FOR INSERT
    TO authenticated
    WITH CHECK (
        public.current_user_has_any_role(ARRAY['supervisor', 'module_admin', 'superadmin'])
    );

DROP POLICY IF EXISTS "assignments_update_admin" ON public.call_assignments;
CREATE POLICY "assignments_update_admin"
    ON public.call_assignments FOR UPDATE
    TO authenticated
    USING  (public.current_user_has_any_role(ARRAY['supervisor', 'module_admin', 'superadmin']))
    WITH CHECK (public.current_user_has_any_role(ARRAY['supervisor', 'module_admin', 'superadmin']));

-- ──────────────────────────────────────────────────────────────
-- SECCIÓN 13: ROW LEVEL SECURITY — call_interactions
-- ──────────────────────────────────────────────────────────────
ALTER TABLE public.call_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_interactions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "call_int_select" ON public.call_interactions;
CREATE POLICY "call_int_select"
    ON public.call_interactions FOR SELECT
    TO authenticated
    USING (
        public.is_own_record(operator_id)
        OR public.current_user_has_any_role(
               ARRAY['supervisor', 'module_admin', 'superadmin', 'auditor']
           )
    );

DROP POLICY IF EXISTS "call_int_insert_own" ON public.call_interactions;
CREATE POLICY "call_int_insert_own"
    ON public.call_interactions FOR INSERT
    TO authenticated
    WITH CHECK (
        public.is_own_record(operator_id)
        AND public.current_user_has_any_role(
                ARRAY['multi_operator', 'supervisor', 'module_admin', 'superadmin']
            )
    );

DROP POLICY IF EXISTS "call_int_update_supervisor" ON public.call_interactions;
CREATE POLICY "call_int_update_supervisor"
    ON public.call_interactions FOR UPDATE
    TO authenticated
    USING  (public.current_user_has_any_role(ARRAY['supervisor', 'module_admin', 'superadmin']))
    WITH CHECK (public.current_user_has_any_role(ARRAY['supervisor', 'module_admin', 'superadmin']));

-- ──────────────────────────────────────────────────────────────
-- SECCIÓN 14: ROW LEVEL SECURITY — incidents
-- ──────────────────────────────────────────────────────────────
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incidents FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "incidents_select" ON public.incidents;
CREATE POLICY "incidents_select"
    ON public.incidents FOR SELECT
    TO authenticated
    USING (
        public.is_own_record(reporter_id)
        OR public.is_own_record(assigned_to)
        OR public.current_user_has_any_role(
               ARRAY['supervisor', 'module_admin', 'superadmin', 'auditor']
           )
    );

DROP POLICY IF EXISTS "incidents_insert" ON public.incidents;
CREATE POLICY "incidents_insert"
    ON public.incidents FOR INSERT
    TO authenticated
    WITH CHECK (
        public.is_own_record(reporter_id)
        AND public.current_user_has_any_role(
                ARRAY['multi_operator', 'data_analyst', 'supervisor', 'module_admin', 'superadmin']
            )
    );

DROP POLICY IF EXISTS "incidents_update_assigned_or_supervisor" ON public.incidents;
CREATE POLICY "incidents_update_assigned_or_supervisor"
    ON public.incidents FOR UPDATE
    TO authenticated
    USING (
        public.is_own_record(assigned_to)
        OR public.current_user_has_any_role(ARRAY['supervisor', 'module_admin', 'superadmin'])
    )
    WITH CHECK (
        public.is_own_record(assigned_to)
        OR public.current_user_has_any_role(ARRAY['supervisor', 'module_admin', 'superadmin'])
    );

-- ──────────────────────────────────────────────────────────────
-- SECCIÓN 15: ROW LEVEL SECURITY — call_daily_aggregates
-- Solo escritura desde service_role (Edge Function de purga)
-- ──────────────────────────────────────────────────────────────
ALTER TABLE public.call_daily_aggregates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_daily_aggregates FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "call_agg_select" ON public.call_daily_aggregates;
CREATE POLICY "call_agg_select"
    ON public.call_daily_aggregates FOR SELECT
    TO authenticated
    USING (
        public.is_own_record(operator_id)
        OR public.current_user_has_any_role(
               ARRAY['supervisor', 'module_admin', 'superadmin', 'data_analyst', 'auditor']
           )
    );

DROP POLICY IF EXISTS "call_agg_write_deny" ON public.call_daily_aggregates;
CREATE POLICY "call_agg_write_deny"
    ON public.call_daily_aggregates FOR INSERT
    TO authenticated
    WITH CHECK (FALSE);

-- ──────────────────────────────────────────────────────────────
-- SECCIÓN 16: GRANTS
-- ──────────────────────────────────────────────────────────────
GRANT SELECT                     ON public.corporate_devices     TO authenticated;
GRANT SELECT                     ON public.call_campaigns        TO authenticated;
GRANT SELECT                     ON public.call_assignments      TO authenticated;
GRANT SELECT, INSERT, UPDATE     ON public.call_interactions     TO authenticated;
GRANT SELECT, INSERT, UPDATE     ON public.incidents             TO authenticated;
GRANT SELECT                     ON public.call_daily_aggregates TO authenticated;
GRANT SELECT                     ON public.v_daily_call_performance TO authenticated;
GRANT SELECT                     ON public.v_incidents_sla_status TO authenticated;

-- ──────────────────────────────────────────────────────────────
-- FIN DE MIGRACIÓN 0003
-- ──────────────────────────────────────────────────────────────

