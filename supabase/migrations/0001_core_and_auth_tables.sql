-- ============================================================
-- MIGRACIÓN: 0001_core_and_auth_tables.sql
-- Proyecto: NEXUS SYSTEM — Intranet Empresarial Unificada
-- Descripción: Tablas core de identidad, roles, perfiles de usuario,
--              triggers de validación semanal de edición de perfil
--              y sistema de auditoría inmutable con hash SHA-256.
-- Idempotente: Sí — uso de IF NOT EXISTS, CREATE OR REPLACE, ON CONFLICT
-- Dependencias: Supabase Auth (schema auth.users debe existir)
-- Fecha: 2026-11-05
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- SECCIÓN 0: EXTENSIONES
-- ──────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ──────────────────────────────────────────────────────────────
-- SECCIÓN 1: TABLA roles
-- Catálogo inmutable de roles del sistema. Solo el superadmin
-- puede INSERT/DELETE vía service_role; los clientes solo SELECT.
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.roles (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT        UNIQUE NOT NULL
                                CHECK (name IN (
                                    'superadmin',
                                    'module_admin',
                                    'supervisor',
                                    'multi_operator',
                                    'data_analyst',
                                    'auditor'
                                )),
    description     TEXT,
    privilege_level INT         NOT NULL DEFAULT 0
                                CHECK (privilege_level BETWEEN 0 AND 100),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- Seed idempotente de roles del sistema
INSERT INTO public.roles (name, description, privilege_level) VALUES
    ('superadmin',      'Control total de infraestructura y bypass auditado de RLS',      100),
    ('module_admin',    'Configuración de campañas, metas y parque de dispositivos Samsung', 80),
    ('supervisor',      'Asignación operativa, aprobación de ediciones y revisión de latencias', 60),
    ('multi_operator',  'Registro de asistencia, ejecución de llamadas y reporte de incidencias', 40),
    ('data_analyst',    'Procesamiento y validación masiva de registros Oriana',             40),
    ('auditor',         'Acceso universal de solo lectura a trazas y audit_logs',            20)
ON CONFLICT (name) DO UPDATE
    SET description     = EXCLUDED.description,
        privilege_level = EXCLUDED.privilege_level;

-- ──────────────────────────────────────────────────────────────
-- SECCIÓN 2: TABLA profiles
-- Vinculada 1:1 con auth.users de Supabase Auth.
-- Se crea automáticamente vía trigger al registrar un usuario.
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
    id                      UUID        PRIMARY KEY
                                        REFERENCES auth.users(id) ON DELETE CASCADE,
    document_id             TEXT        UNIQUE NOT NULL
                                        CHECK (length(document_id) BETWEEN 4 AND 20),
    full_name               TEXT        NOT NULL
                                        CHECK (length(full_name) BETWEEN 2 AND 200),
    phone_number            TEXT
                                        CHECK (phone_number IS NULL OR
                                               phone_number ~ '^\+?[0-9\s\-()\.]{7,20}$'),
    address                 TEXT
                                        CHECK (address IS NULL OR length(address) <= 500),
    is_active               BOOLEAN     NOT NULL DEFAULT true,
    last_profile_edit_at    TIMESTAMPTZ,
    profile_edit_count_week INT         NOT NULL DEFAULT 0
                                        CHECK (profile_edit_count_week >= 0),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- Índices de rendimiento para profiles
CREATE INDEX IF NOT EXISTS idx_profiles_document_id ON public.profiles(document_id);
CREATE INDEX IF NOT EXISTS idx_profiles_is_active   ON public.profiles(is_active);
CREATE INDEX IF NOT EXISTS idx_profiles_fullname_gin
    ON public.profiles USING GIN (to_tsvector('spanish', full_name));

-- ──────────────────────────────────────────────────────────────
-- SECCIÓN 3: TABLA user_roles
-- Asignación N:M de roles a perfiles de usuario.
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_roles (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role_id     UUID        NOT NULL REFERENCES public.roles(id)    ON DELETE CASCADE,
    assigned_by UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    UNIQUE (user_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON public.user_roles(role_id);

-- ──────────────────────────────────────────────────────────────
-- SECCIÓN 4: TABLA audit_logs
-- Registro inmutable de todas las mutaciones en tablas críticas.
-- RLS bloquea toda escritura directa; solo los triggers internos
-- (SECURITY DEFINER) pueden hacer INSERT aquí.
-- content_hash: columna GENERATED ALWAYS AS para integridad SHA-256.
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id     UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
    action       TEXT        NOT NULL
                             CHECK (action IN (
                                 'INSERT', 'UPDATE', 'DELETE',
                                 'LOGIN',  'LOGOUT',
                                 'ROLE_ASSIGN', 'ROLE_REVOKE',
                                 'BULK_UPLOAD', 'EXPORT', 'RLS_BYPASS'
                             )),
    entity_name  TEXT        NOT NULL
                             CHECK (length(entity_name) BETWEEN 1 AND 100),
    entity_id    UUID        NOT NULL,
    old_data     JSONB,
    new_data     JSONB,
    ip_address   INET,
    user_agent   TEXT        CHECK (user_agent IS NULL OR length(user_agent) <= 512),
    -- Hash SHA-256 calculado por el motor, nunca por el cliente
    content_hash TEXT        NOT NULL
                             GENERATED ALWAYS AS (
                                 encode(
                                     digest(
                                         COALESCE(actor_id::TEXT, 'anon')
                                         || '|' || action
                                         || '|' || entity_name
                                         || '|' || entity_id::TEXT
                                         || '|' || COALESCE(old_data::TEXT, 'null')
                                         || '|' || COALESCE(new_data::TEXT, 'null'),
                                         'sha256'
                                     ),
                                     'hex'
                                 )
                             ) STORED,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_audit_actor   ON public.audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_entity  ON public.audit_logs(entity_name, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_action  ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_created ON public.audit_logs(created_at DESC);

-- ──────────────────────────────────────────────────────────────
-- SECCIÓN 5: FUNCIONES DE AUTORIZACIÓN (SECURITY DEFINER)
-- Evaluadas dentro de las políticas RLS para evitar recursión.
-- ──────────────────────────────────────────────────────────────

-- 5.1 Verificar un rol específico
CREATE OR REPLACE FUNCTION public.current_user_has_role(required_role TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, auth
AS $$
BEGIN
    IF required_role IS NULL OR required_role = '' THEN
        RETURN FALSE;
    END IF;
    RETURN EXISTS (
        SELECT 1
        FROM   public.user_roles ur
        JOIN   public.roles      r  ON ur.role_id = r.id
        JOIN   public.profiles   p  ON ur.user_id = p.id
        WHERE  ur.user_id   = auth.uid()
        AND    r.name        = required_role
        AND    p.is_active   = true
    );
END;
$$;

-- 5.2 Verificar al menos uno de un array de roles
CREATE OR REPLACE FUNCTION public.current_user_has_any_role(required_roles TEXT[])
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, auth
AS $$
BEGIN
    IF required_roles IS NULL OR array_length(required_roles, 1) = 0 THEN
        RETURN FALSE;
    END IF;
    RETURN EXISTS (
        SELECT 1
        FROM   public.user_roles ur
        JOIN   public.roles      r  ON ur.role_id = r.id
        JOIN   public.profiles   p  ON ur.user_id = p.id
        WHERE  ur.user_id   = auth.uid()
        AND    r.name        = ANY(required_roles)
        AND    p.is_active   = true
    );
END;
$$;

-- 5.3 Nivel máximo de privilegio del usuario autenticado
CREATE OR REPLACE FUNCTION public.current_user_privilege_level()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, auth
AS $$
DECLARE v_level INT := 0;
BEGIN
    SELECT COALESCE(MAX(r.privilege_level), 0)
    INTO   v_level
    FROM   public.user_roles ur
    JOIN   public.roles      r ON ur.role_id = r.id
    JOIN   public.profiles   p ON ur.user_id = p.id
    WHERE  ur.user_id = auth.uid()
    AND    p.is_active = true;
    RETURN v_level;
END;
$$;

-- 5.4 Comprobar si una fila pertenece al usuario autenticado
CREATE OR REPLACE FUNCTION public.is_own_record(record_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, auth
AS $$
    SELECT record_user_id IS NOT NULL AND record_user_id = auth.uid();
$$;

-- ──────────────────────────────────────────────────────────────
-- SECCIÓN 6: TRIGGERS
-- ──────────────────────────────────────────────────────────────

-- 6.1 Trigger genérico de auditoría
-- Se instala en todas las tablas críticas. Captura OLD/NEW en JSONB
-- y enmascara campos sensibles antes de persistir en audit_logs.
CREATE OR REPLACE FUNCTION public.fn_audit_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_actor_id   UUID;
    v_old_data   JSONB := NULL;
    v_new_data   JSONB := NULL;
    v_entity_id  UUID;
    v_ip         INET;
    v_ua         TEXT;
BEGIN
    -- Resolver actor desde JWT de Supabase
    BEGIN
        v_actor_id := auth.uid();
    EXCEPTION WHEN OTHERS THEN
        v_actor_id := NULL;
    END;

    -- Serializar estado anterior (UPDATE / DELETE)
    IF TG_OP IN ('UPDATE', 'DELETE') THEN
        v_old_data := to_jsonb(OLD)
            - 'password_hash'
            - 'backup_clave_original'
            - 'knox_enrollment_id'
            - 'clave';
    END IF;

    -- Serializar estado nuevo (INSERT / UPDATE)
    IF TG_OP IN ('INSERT', 'UPDATE') THEN
        v_new_data := to_jsonb(NEW)
            - 'password_hash'
            - 'backup_clave_original'
            - 'knox_enrollment_id'
            - 'clave';
    END IF;

    -- Resolver ID de la entidad modificada
    IF TG_OP = 'DELETE' THEN
        v_entity_id := (to_jsonb(OLD) ->> 'id')::UUID;
    ELSE
        v_entity_id := (to_jsonb(NEW) ->> 'id')::UUID;
    END IF;

    -- Metadatos de red desde variables de sesión de PostgREST
    BEGIN
        v_ip := (current_setting('request.headers', true)::JSONB ->> 'x-forwarded-for')::INET;
        v_ua :=  current_setting('request.headers', true)::JSONB ->> 'user-agent';
    EXCEPTION WHEN OTHERS THEN
        v_ip := NULL;
        v_ua := NULL;
    END;

    -- Insertar en audit_logs (política RLS no aplica dentro de SECURITY DEFINER)
    INSERT INTO public.audit_logs (
        actor_id, action, entity_name, entity_id,
        old_data, new_data, ip_address, user_agent
    ) VALUES (
        v_actor_id, TG_OP, TG_TABLE_NAME, v_entity_id,
        v_old_data, v_new_data, v_ip, v_ua
    );

    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Trigger de auditoría [% en %]: %', TG_OP, TG_TABLE_NAME, SQLERRM;
END;
$$;

-- Instalar trigger de auditoría en profiles
DROP TRIGGER IF EXISTS tr_audit_profiles ON public.profiles;
CREATE TRIGGER tr_audit_profiles
    AFTER INSERT OR UPDATE OR DELETE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();

-- Instalar trigger de auditoría en user_roles
DROP TRIGGER IF EXISTS tr_audit_user_roles ON public.user_roles;
CREATE TRIGGER tr_audit_user_roles
    AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
    FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();

-- 6.2 Trigger de creación automática de perfil al registrar usuario en Auth
CREATE OR REPLACE FUNCTION public.fn_create_profile_on_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
    INSERT INTO public.profiles (id, document_id, full_name)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data ->> 'document_id', NEW.id::TEXT),
        COALESCE(NEW.raw_user_meta_data ->> 'full_name',   NEW.email)
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;

-- Solo crear el trigger si el schema auth está disponible
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'auth' AND tablename = 'users') THEN
        DROP TRIGGER IF EXISTS tr_create_profile_on_signup ON auth.users;
        CREATE TRIGGER tr_create_profile_on_signup
            AFTER INSERT ON auth.users
            FOR EACH ROW EXECUTE FUNCTION public.fn_create_profile_on_signup();
    END IF;
END;
$$;

-- 6.3 Trigger de restricción de edición de perfil (cuota: 1 vez/7 días)
CREATE OR REPLACE FUNCTION public.fn_enforce_profile_update_frequency()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Bloqueo absoluto de campos protegidos: forzar valor original sin importar el payload
    NEW.document_id := OLD.document_id;
    NEW.is_active   := OLD.is_active;

    -- Verificar cuota semanal solo cuando cambian campos de frecuencia limitada
    IF (NEW.phone_number IS DISTINCT FROM OLD.phone_number)
    OR (NEW.address      IS DISTINCT FROM OLD.address)
    THEN
        IF OLD.last_profile_edit_at IS NOT NULL
        AND OLD.last_profile_edit_at > (now() - INTERVAL '7 days')
        THEN
            RAISE EXCEPTION
                'Restricción de edición de perfil: se permite 1 actualización cada 7 días. '
                'Última edición: %. Próxima edición permitida: %.',
                OLD.last_profile_edit_at::DATE,
                (OLD.last_profile_edit_at + INTERVAL '7 days')::DATE;
        END IF;
        NEW.last_profile_edit_at    := now();
        NEW.profile_edit_count_week := OLD.profile_edit_count_week + 1;
    END IF;

    -- Siempre actualizar el timestamp de modificación
    NEW.updated_at := timezone('utc', now());
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_enforce_profile_edit_limits ON public.profiles;
CREATE TRIGGER tr_enforce_profile_edit_limits
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.fn_enforce_profile_update_frequency();

-- 6.4 Trigger de actualización de updated_at en profiles
-- (separado del trigger de restricción para orden de ejecución explícito)
CREATE OR REPLACE FUNCTION public.fn_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := timezone('utc', now());
    RETURN NEW;
END;
$$;

-- ──────────────────────────────────────────────────────────────
-- SECCIÓN 7: ROW LEVEL SECURITY — TABLA roles
-- ──────────────────────────────────────────────────────────────
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "roles_select_all_authenticated" ON public.roles;
CREATE POLICY "roles_select_all_authenticated"
    ON public.roles FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "roles_write_superadmin" ON public.roles;
CREATE POLICY "roles_write_superadmin"
    ON public.roles FOR ALL
    TO authenticated
    USING  (public.current_user_has_role('superadmin'))
    WITH CHECK (public.current_user_has_role('superadmin'));

-- ──────────────────────────────────────────────────────────────
-- SECCIÓN 8: ROW LEVEL SECURITY — TABLA profiles
-- ──────────────────────────────────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own_or_elevated" ON public.profiles;
CREATE POLICY "profiles_select_own_or_elevated"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (
        public.is_own_record(id)
        OR public.current_user_has_any_role(
               ARRAY['supervisor', 'module_admin', 'superadmin', 'auditor']
           )
    );

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING  (public.is_own_record(id))
    WITH CHECK (public.is_own_record(id));

DROP POLICY IF EXISTS "profiles_insert_superadmin" ON public.profiles;
CREATE POLICY "profiles_insert_superadmin"
    ON public.profiles FOR INSERT
    TO authenticated
    WITH CHECK (public.current_user_has_role('superadmin'));

DROP POLICY IF EXISTS "profiles_delete_superadmin" ON public.profiles;
CREATE POLICY "profiles_delete_superadmin"
    ON public.profiles FOR DELETE
    TO authenticated
    USING (public.current_user_has_role('superadmin'));

-- ──────────────────────────────────────────────────────────────
-- SECCIÓN 9: ROW LEVEL SECURITY — TABLA user_roles
-- ──────────────────────────────────────────────────────────────
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_roles_select" ON public.user_roles;
CREATE POLICY "user_roles_select"
    ON public.user_roles FOR SELECT
    TO authenticated
    USING (
        public.is_own_record(user_id)
        OR public.current_user_has_any_role(
               ARRAY['supervisor', 'module_admin', 'superadmin', 'auditor']
           )
    );

DROP POLICY IF EXISTS "user_roles_insert_superadmin" ON public.user_roles;
CREATE POLICY "user_roles_insert_superadmin"
    ON public.user_roles FOR INSERT
    TO authenticated
    WITH CHECK (public.current_user_has_role('superadmin'));

DROP POLICY IF EXISTS "user_roles_delete_superadmin" ON public.user_roles;
CREATE POLICY "user_roles_delete_superadmin"
    ON public.user_roles FOR DELETE
    TO authenticated
    USING (public.current_user_has_role('superadmin'));

-- ──────────────────────────────────────────────────────────────
-- SECCIÓN 10: ROW LEVEL SECURITY — TABLA audit_logs
-- INMUTABLE: SELECT solo para auditores y superiores.
-- INSERT/UPDATE/DELETE COMPLETAMENTE BLOQUEADOS desde clientes.
-- ──────────────────────────────────────────────────────────────
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_logs_select_auditor" ON public.audit_logs;
CREATE POLICY "audit_logs_select_auditor"
    ON public.audit_logs FOR SELECT
    TO authenticated
    USING (
        public.current_user_has_any_role(
            ARRAY['auditor', 'supervisor', 'module_admin', 'superadmin']
        )
    );

-- Bloqueo total de escritura directa desde cliente (service_role bypass RLS)
DROP POLICY IF EXISTS "audit_logs_insert_deny" ON public.audit_logs;
CREATE POLICY "audit_logs_insert_deny"
    ON public.audit_logs FOR INSERT
    TO authenticated
    WITH CHECK (FALSE);

DROP POLICY IF EXISTS "audit_logs_update_deny" ON public.audit_logs;
CREATE POLICY "audit_logs_update_deny"
    ON public.audit_logs FOR UPDATE
    TO authenticated
    USING (FALSE);

DROP POLICY IF EXISTS "audit_logs_delete_deny" ON public.audit_logs;
CREATE POLICY "audit_logs_delete_deny"
    ON public.audit_logs FOR DELETE
    TO authenticated
    USING (FALSE);

-- ──────────────────────────────────────────────────────────────
-- SECCIÓN 11: GRANTS
-- El rol anon nunca debe leer datos sensibles.
-- ──────────────────────────────────────────────────────────────
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- anon: solo puede ejecutar funciones de autenticación pública
REVOKE ALL ON public.profiles   FROM anon;
REVOKE ALL ON public.user_roles FROM anon;
REVOKE ALL ON public.audit_logs FROM anon;
REVOKE ALL ON public.roles      FROM anon;

-- authenticated: permisos base (las políticas RLS los restringen)
GRANT SELECT, INSERT, UPDATE         ON public.profiles   TO authenticated;
GRANT SELECT, INSERT, DELETE         ON public.user_roles TO authenticated;
GRANT SELECT                         ON public.audit_logs TO authenticated;
GRANT SELECT                         ON public.roles      TO authenticated;

-- ──────────────────────────────────────────────────────────────
-- SECCIÓN 12: VERIFICACIÓN DE INTEGRIDAD (COMENTADA PARA PRODUCCIÓN)
-- Descomentarla solo para verificación manual tras la migración.
-- ──────────────────────────────────────────────────────────────
-- DO $$
-- BEGIN
--     ASSERT (SELECT COUNT(*) FROM public.roles) = 6,
--         'Error: Se esperaban exactamente 6 roles en el sistema';
--     RAISE NOTICE '✅ 0001_core_and_auth_tables: migración verificada correctamente.';
-- END;
-- $$;

-- ──────────────────────────────────────────────────────────────
-- FIN DE MIGRACIÓN 0001
-- ──────────────────────────────────────────────────────────────

