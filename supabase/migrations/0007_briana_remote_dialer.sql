-- ============================================================================
-- MIGRACIÓN: 0007_briana_remote_dialer.sql
-- Proyecto: NEXUS SYSTEM — Módulo BRIANA (Marcado Remoto & Telemetría SIM)
-- Descripción: Tablas devices, operator_sessions, contacts_queue, call_logs,
--              call_schedules y call_commands con Realtime y RLS.
-- Idempotente: Sí
-- Dependencias: 0001_core_and_auth_tables.sql, 0003_calls_and_incidents.sql
-- ============================================================================

-- 1. ENUMS DE DOMINIO
DO $$ BEGIN
    CREATE TYPE public.briana_device_status AS ENUM ('available', 'in_shift', 'offline', 'maintenance');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE public.briana_queue_status AS ENUM (
        'pending',
        'assigned',
        'in_call',
        'rescheduled',
        'completed_effective',
        'exhausted',
        'invalid_number'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE public.briana_call_outcome AS ENUM (
        'efectiva',
        'buzon_de_voz',
        'sin_respuesta',
        'ocupado',
        'rechazada',
        'cancelada_antes_de_conectar',
        'cortada_no_efectiva',
        'reprogramada',
        'numero_equivocado'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE public.briana_initiated_from AS ENUM ('pc_web', 'android_app');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE public.briana_ended_by AS ENUM (
        'operator_pc',
        'operator_phone',
        'remote_party',
        'network_or_no_answer'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. TABLA: devices (Flota Samsung Galaxy A57 / A37)
CREATE TABLE IF NOT EXISTS public.devices (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_uid          TEXT UNIQUE NOT NULL,
    model               TEXT NOT NULL,
    sim_phone_number    TEXT,
    carrier_name        TEXT,
    pairing_pin         TEXT UNIQUE NOT NULL,
    pin_expires_at      TIMESTAMPTZ NOT NULL,
    status              public.briana_device_status NOT NULL DEFAULT 'available',
    battery_pct         INT CHECK (battery_pct IS NULL OR battery_pct BETWEEN 0 AND 100),
    network_type        TEXT,
    app_version         TEXT,
    is_default_dialer   BOOLEAN NOT NULL DEFAULT false,
    last_heartbeat_at   TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_devices_pairing_pin ON public.devices(pairing_pin);
CREATE INDEX IF NOT EXISTS idx_devices_status ON public.devices(status);

DROP TRIGGER IF EXISTS tr_briana_devices_updated_at ON public.devices;
CREATE TRIGGER tr_briana_devices_updated_at
    BEFORE UPDATE ON public.devices
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- 3. TABLA: operator_sessions (Vinculación Operador PC <-> Samsung por Jornada)
CREATE TABLE IF NOT EXISTS public.operator_sessions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operator_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    device_id           UUID NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
    campaign_id         UUID REFERENCES public.call_campaigns(id) ON DELETE SET NULL,
    pairing_pin_used    TEXT NOT NULL,
    is_active           BOOLEAN NOT NULL DEFAULT true,
    started_at          TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    ended_at            TIMESTAMPTZ,
    ended_reason        TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_active_session_device
    ON public.operator_sessions(device_id) WHERE is_active = true;
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_session_operator
    ON public.operator_sessions(operator_id) WHERE is_active = true;

-- 4. TABLA: contacts_queue (Cola de contactos con lock y control de reintentos)
CREATE TABLE IF NOT EXISTS public.contacts_queue (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id             UUID NOT NULL REFERENCES public.call_campaigns(id) ON DELETE CASCADE,
    full_name               TEXT NOT NULL,
    phone_number            TEXT NOT NULL,
    document_id             TEXT,
    metadata                JSONB NOT NULL DEFAULT '{}'::jsonb,
    status                  public.briana_queue_status NOT NULL DEFAULT 'pending',
    priority                INT NOT NULL DEFAULT 0,
    attempt_count           INT NOT NULL DEFAULT 0,
    max_attempts            INT NOT NULL DEFAULT 5,
    assigned_operator_id    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    locked_until            TIMESTAMPTZ,
    next_retry_at           TIMESTAMPTZ,
    last_attempt_at         TIMESTAMPTZ,
    last_outcome            public.briana_call_outcome,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_queue_campaign_status ON public.contacts_queue(campaign_id, status, priority DESC, next_retry_at);
CREATE INDEX IF NOT EXISTS idx_queue_assigned_operator ON public.contacts_queue(assigned_operator_id, status);
CREATE INDEX IF NOT EXISTS idx_queue_phone ON public.contacts_queue(phone_number);

DROP TRIGGER IF EXISTS tr_contacts_queue_updated_at ON public.contacts_queue;
CREATE TRIGGER tr_contacts_queue_updated_at
    BEFORE UPDATE ON public.contacts_queue
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- 5. TABLA: call_logs (Telemetría exacta de cada intento)
CREATE TABLE IF NOT EXISTS public.call_logs (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    call_uuid               UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
    session_id              UUID NOT NULL REFERENCES public.operator_sessions(id) ON DELETE CASCADE,
    contact_id              UUID NOT NULL REFERENCES public.contacts_queue(id) ON DELETE CASCADE,
    campaign_id             UUID NOT NULL REFERENCES public.call_campaigns(id) ON DELETE CASCADE,
    operator_id             UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    device_id               UUID NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
    attempt_number          INT NOT NULL CHECK (attempt_number >= 1),
    call_channel            TEXT NOT NULL DEFAULT 'sim' CHECK (call_channel IN ('sim', 'whatsapp')),
    initiated_from          public.briana_initiated_from NOT NULL,
    ended_by                public.briana_ended_by,
    is_connected            BOOLEAN NOT NULL DEFAULT false,
    dialing_at              TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    ringing_at              TIMESTAMPTZ,
    active_at               TIMESTAMPTZ,
    disconnected_at         TIMESTAMPTZ,
    talk_duration_seconds   INT NOT NULL DEFAULT 0 CHECK (talk_duration_seconds >= 0),
    outcome                 public.briana_call_outcome,
    is_effective            BOOLEAN NOT NULL DEFAULT false,
    operator_notes          TEXT,
    telecom_disconnect_code INT,
    telecom_disconnect_msg  TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_call_logs_contact ON public.call_logs(contact_id, attempt_number);
CREATE INDEX IF NOT EXISTS idx_call_logs_operator_date ON public.call_logs(operator_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_call_logs_campaign_outcome ON public.call_logs(campaign_id, outcome, is_effective);

-- 6. TABLA: call_schedules (Reprogramaciones con fecha y hora exacta)
CREATE TABLE IF NOT EXISTS public.call_schedules (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id          UUID NOT NULL REFERENCES public.contacts_queue(id) ON DELETE CASCADE,
    campaign_id         UUID NOT NULL REFERENCES public.call_campaigns(id) ON DELETE CASCADE,
    operator_id         UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    source_call_log_id  UUID REFERENCES public.call_logs(id) ON DELETE SET NULL,
    scheduled_for       TIMESTAMPTZ NOT NULL,
    notes               TEXT,
    status              TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'executed', 'cancelled')),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_schedules_pending_due
    ON public.call_schedules(scheduled_for) WHERE status = 'pending';

-- 7. TABLA: call_commands (Comandos PC -> APK con acuse de recibo)
CREATE TABLE IF NOT EXISTS public.call_commands (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id          UUID NOT NULL REFERENCES public.operator_sessions(id) ON DELETE CASCADE,
    device_id           UUID NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
    contact_id          UUID REFERENCES public.contacts_queue(id) ON DELETE SET NULL,
    call_uuid           UUID NOT NULL,
    command_type        TEXT NOT NULL CHECK (command_type IN ('DIAL', 'DIAL_WHATSAPP', 'HANGUP', 'END_SHIFT')),
    payload             JSONB NOT NULL DEFAULT '{}'::jsonb,
    status              TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'acked', 'executed', 'expired', 'failed')),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    acked_at            TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_commands_device_pending
    ON public.call_commands(device_id, status, created_at) WHERE status = 'pending';

-- 8. PUBLICACIÓN REALTIME
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.devices;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.operator_sessions;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.contacts_queue;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.call_logs;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.call_schedules;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.call_commands;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 9. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operator_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_commands ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.fn_is_briana_supervisor_or_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_roles ur
        JOIN public.roles r ON r.id = ur.role_id
        WHERE ur.user_id = auth.uid()
          AND r.name IN ('fundador_dev', 'superadmin', 'admin', 'module_admin', 'coordinador_general', 'coordinador', 'supervisor')
    );
$$;

DROP POLICY IF EXISTS "devices_select_auth" ON public.devices;
CREATE POLICY "devices_select_auth" ON public.devices
    FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "sessions_select_own_or_admin" ON public.operator_sessions;
CREATE POLICY "sessions_select_own_or_admin" ON public.operator_sessions
    FOR SELECT USING (operator_id = auth.uid() OR public.fn_is_briana_supervisor_or_admin());

DROP POLICY IF EXISTS "sessions_insert_own" ON public.operator_sessions;
CREATE POLICY "sessions_insert_own" ON public.operator_sessions
    FOR INSERT WITH CHECK (operator_id = auth.uid() OR public.fn_is_briana_supervisor_or_admin());

DROP POLICY IF EXISTS "sessions_update_own_or_admin" ON public.operator_sessions;
CREATE POLICY "sessions_update_own_or_admin" ON public.operator_sessions
    FOR UPDATE USING (operator_id = auth.uid() OR public.fn_is_briana_supervisor_or_admin());

DROP POLICY IF EXISTS "queue_select_assigned_or_admin" ON public.contacts_queue;
CREATE POLICY "queue_select_assigned_or_admin" ON public.contacts_queue
    FOR SELECT USING (assigned_operator_id = auth.uid() OR public.fn_is_briana_supervisor_or_admin());

DROP POLICY IF EXISTS "queue_update_assigned_or_admin" ON public.contacts_queue;
CREATE POLICY "queue_update_assigned_or_admin" ON public.contacts_queue
    FOR UPDATE USING (assigned_operator_id = auth.uid() OR public.fn_is_briana_supervisor_or_admin());

DROP POLICY IF EXISTS "call_logs_select_own_or_admin" ON public.call_logs;
CREATE POLICY "call_logs_select_own_or_admin" ON public.call_logs
    FOR SELECT USING (operator_id = auth.uid() OR public.fn_is_briana_supervisor_or_admin());

DROP POLICY IF EXISTS "call_logs_insert_own" ON public.call_logs;
CREATE POLICY "call_logs_insert_own" ON public.call_logs
    FOR INSERT WITH CHECK (operator_id = auth.uid() OR public.fn_is_briana_supervisor_or_admin());

DROP POLICY IF EXISTS "schedules_own_or_admin" ON public.call_schedules;
CREATE POLICY "schedules_own_or_admin" ON public.call_schedules
    FOR ALL USING (operator_id = auth.uid() OR public.fn_is_briana_supervisor_or_admin());

DROP POLICY IF EXISTS "commands_via_session_or_admin" ON public.call_commands;
CREATE POLICY "commands_via_session_or_admin" ON public.call_commands
    FOR ALL USING (
        public.fn_is_briana_supervisor_or_admin()
        OR EXISTS (
            SELECT 1 FROM public.operator_sessions s
            WHERE s.id = call_commands.session_id AND s.operator_id = auth.uid()
        )
    );
