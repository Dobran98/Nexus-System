# RBAC Security — Políticas RLS y Triggers de Auditoría Inmutable

> **Documento:** `rbac-security.md`  
> **Versión:** 2.0.0  
> **Fecha:** 2026-11-05  
> **Autor:** Arquitectura NEXUS SYSTEM  
> **Stack:** PostgreSQL 15 (Supabase) · Next.js 14 App Router · TypeScript 5.3 strict

---

## Tabla de Contenidos

1. [Modelo de Roles y Jerarquía de Privilegios](#1-modelo-de-roles-y-jerarquía-de-privilegios)
2. [Tipos TypeScript del Sistema de Autorización](#2-tipos-typescript-del-sistema-de-autorización)
3. [Funciones de Seguridad PostgreSQL (`SECURITY DEFINER`)](#3-funciones-de-seguridad-postgresql-security-definer)
4. [Políticas RLS por Tabla](#4-políticas-rls-por-tabla)
5. [Sistema de Auditoría Inmutable](#5-sistema-de-auditoría-inmutable)
6. [Triggers DDL de Auditoría](#6-triggers-ddl-de-auditoría)
7. [Middleware de Autorización TypeScript](#7-middleware-de-autorización-typescript)
8. [Validaciones en Tiempo de Ejecución](#8-validaciones-en-tiempo-de-ejecución)
9. [Gestión de Sesión y JWT Claims](#9-gestión-de-sesión-y-jwt-claims)
10. [Matriz de Riesgos y Controles Compensatorios](#10-matriz-de-riesgos-y-controles-compensatorios)

---

## 1. Modelo de Roles y Jerarquía de Privilegios

### 1.1 Taxonomía de Roles del Sistema

El NEXUS SYSTEM opera bajo el principio de **Mínimo Privilegio Dinámico**: la autorización no se delega nunca al frontend y se valida criptográficamente mediante el JWT de Supabase Auth evaluado en tiempo de ejecución dentro del motor PostgreSQL.

```
JERARQUÍA DE ROLES (de mayor a menor privilegio)
─────────────────────────────────────────────────
superadmin
    └── module_admin
            └── supervisor
                    ├── multi_operator
                    └── data_analyst
                            └── auditor (solo lectura universal)
```

| Rol | Identificador DB | Nivel | Puede escalar a |
|-----|-----------------|-------|-----------------|
| Superadministrador | `superadmin` | 100 | — |
| Administrador de Módulo | `module_admin` | 80 | — |
| Supervisor | `supervisor` | 60 | — |
| Operador Multifunción | `multi_operator` | 40 | — |
| Analista de Datos | `data_analyst` | 40 | — |
| Auditor | `auditor` | 20 | — |

### 1.2 DDL — Tablas de Gestión de Roles

```sql
-- ============================================================
-- EXTENSIONES REQUERIDAS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- TABLA: roles
-- Catálogo inmutable de roles del sistema
-- ============================================================
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

-- ============================================================
-- TABLA: profiles
-- Vinculada 1:1 con auth.users de Supabase
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id                      UUID        PRIMARY KEY
                                        REFERENCES auth.users(id) ON DELETE CASCADE,
    document_id             TEXT        UNIQUE NOT NULL,
    full_name               TEXT        NOT NULL,
    phone_number            TEXT,
    address                 TEXT,
    is_active               BOOLEAN     NOT NULL DEFAULT true,
    last_profile_edit_at    TIMESTAMPTZ,
    profile_edit_count_week INT         NOT NULL DEFAULT 0
                                        CHECK (profile_edit_count_week >= 0),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- ============================================================
-- TABLA: user_roles
-- Asignación N:M de roles a perfiles
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_roles (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role_id     UUID        NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    assigned_by UUID        REFERENCES public.profiles(id),
    UNIQUE (user_id, role_id)
);

-- Índices de rendimiento
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON public.user_roles(role_id);
```

---

## 2. Tipos TypeScript del Sistema de Autorización

Todos los tipos del módulo `@intranet/auth` se derivan del cliente Supabase tipado y amplían las definiciones con discriminated unions para garantizar exhaustividad en tiempo de compilación.

```typescript
// packages/auth/src/types/rbac.types.ts
// Importación del cliente tipado generado por Supabase CLI
import type { Database } from '@intranet/database';

// ─────────────────────────────────────────────
// ENUMERACIÓN DE ROLES — fuente de verdad única
// ─────────────────────────────────────────────
export const SYSTEM_ROLES = [
  'superadmin',
  'module_admin',
  'supervisor',
  'multi_operator',
  'data_analyst',
  'auditor',
] as const;

export type SystemRole = (typeof SYSTEM_ROLES)[number];

// Mapa de niveles de privilegio numérico
export const ROLE_PRIVILEGE_LEVEL: Record<SystemRole, number> = {
  superadmin:     100,
  module_admin:   80,
  supervisor:     60,
  multi_operator: 40,
  data_analyst:   40,
  auditor:        20,
} as const;

// ─────────────────────────────────────────────
// TIPOS DE FILA DE BASE DE DATOS
// ─────────────────────────────────────────────
export type RoleRow    = Database['public']['Tables']['roles']['Row'];
export type ProfileRow = Database['public']['Tables']['profiles']['Row'];
export type UserRoleRow = Database['public']['Tables']['user_roles']['Row'];

// ─────────────────────────────────────────────
// CONTEXTO DE USUARIO AUTENTICADO
// ─────────────────────────────────────────────
export interface AuthenticatedUser {
  readonly id:          string;        // UUID — auth.uid()
  readonly email:       string;
  readonly roles:       readonly SystemRole[];
  readonly profile:     ProfileRow;
  readonly sessionJwt:  string;
  readonly issuedAt:    number;        // Unix timestamp
  readonly expiresAt:   number;        // Unix timestamp
}

// ─────────────────────────────────────────────
// RESULTADO DE VERIFICACIÓN RLS
// ─────────────────────────────────────────────
export type RLSCheckResult =
  | { readonly authorized: true;  readonly userId: string; readonly roles: readonly SystemRole[] }
  | { readonly authorized: false; readonly reason: RLSViolationReason };

export type RLSViolationReason =
  | 'UNAUTHENTICATED'
  | 'INSUFFICIENT_PRIVILEGE'
  | 'ROLE_NOT_FOUND'
  | 'PROFILE_INACTIVE'
  | 'SESSION_EXPIRED'
  | 'JWT_MALFORMED';

// ─────────────────────────────────────────────
// PAYLOADS DE OPERACIONES AUDITABLES
// ─────────────────────────────────────────────
export interface AuditableOperation<TPayload = unknown> {
  readonly actorId:    string;
  readonly action:     AuditAction;
  readonly entityName: AuditableEntity;
  readonly entityId:   string;
  readonly payload:    TPayload;
  readonly ipAddress:  string;
  readonly userAgent:  string;
}

export type AuditAction =
  | 'INSERT'
  | 'UPDATE'
  | 'DELETE'
  | 'LOGIN'
  | 'LOGOUT'
  | 'ROLE_ASSIGN'
  | 'ROLE_REVOKE'
  | 'BULK_UPLOAD'
  | 'EXPORT'
  | 'RLS_BYPASS';    // Solo superadmin en modo mantenimiento

export type AuditableEntity =
  | 'profiles'
  | 'user_roles'
  | 'attendance_records'
  | 'clock_events'
  | 'call_interactions'
  | 'call_assignments'
  | 'incidents'
  | 'oriana_reports'
  | 'corporate_devices'
  | 'audit_logs';    // Solo READ permitido sobre sí misma

// ─────────────────────────────────────────────
// REGISTRO DE AUDITORÍA INMUTABLE
// ─────────────────────────────────────────────
export interface AuditLogRow {
  readonly id:          string;
  readonly actor_id:    string | null;
  readonly action:      AuditAction;
  readonly entity_name: AuditableEntity;
  readonly entity_id:   string;
  readonly old_data:    Record<string, unknown> | null;
  readonly new_data:    Record<string, unknown> | null;
  readonly ip_address:  string | null;
  readonly user_agent:  string | null;
  readonly created_at:  string;         // ISO 8601
  readonly hash:        string;         // SHA-256 del contenido
}

// ─────────────────────────────────────────────
// GUARDS DE TIPO EN TIEMPO DE EJECUCIÓN
// ─────────────────────────────────────────────
export function isSystemRole(value: unknown): value is SystemRole {
  return typeof value === 'string' && (SYSTEM_ROLES as readonly string[]).includes(value);
}

export function isAuthenticatedUser(value: unknown): value is AuthenticatedUser {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj['id']    === 'string' &&
    typeof obj['email'] === 'string' &&
    Array.isArray(obj['roles']) &&
    (obj['roles'] as unknown[]).every(isSystemRole) &&
    typeof obj['sessionJwt'] === 'string' &&
    typeof obj['issuedAt']   === 'number' &&
    typeof obj['expiresAt']  === 'number'
  );
}
```

---

## 3. Funciones de Seguridad PostgreSQL (`SECURITY DEFINER`)

Estas funciones se ejecutan con los privilegios del propietario (`postgres`), no del invocador. Esto evita la recursión de políticas RLS y centraliza la evaluación de identidad.

```sql
-- ============================================================
-- FUNCIÓN: current_user_has_role
-- Verifica si el usuario autenticado tiene un rol específico
-- SECURITY DEFINER: evita recursión en políticas RLS
-- ============================================================
CREATE OR REPLACE FUNCTION public.current_user_has_role(required_role TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, auth
AS $$
BEGIN
  -- Validación de entrada en tiempo de ejecución
  IF required_role IS NULL OR required_role = '' THEN
    RAISE EXCEPTION 'required_role no puede ser nulo o vacío';
  END IF;

  IF required_role NOT IN (
    'superadmin', 'module_admin', 'supervisor',
    'multi_operator', 'data_analyst', 'auditor'
  ) THEN
    RAISE EXCEPTION 'Rol inválido: %', required_role;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM   public.user_roles ur
    JOIN   public.roles      r  ON ur.role_id = r.id
    JOIN   public.profiles   p  ON ur.user_id = p.id
    WHERE  ur.user_id = auth.uid()
    AND    r.name     = required_role
    AND    p.is_active = true
  );
END;
$$;

-- ============================================================
-- FUNCIÓN: current_user_has_any_role
-- Verifica si el usuario tiene AL MENOS UNO de los roles dados
-- ============================================================
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
    WHERE  ur.user_id = auth.uid()
    AND    r.name     = ANY(required_roles)
    AND    p.is_active = true
  );
END;
$$;

-- ============================================================
-- FUNCIÓN: current_user_privilege_level
-- Retorna el nivel numérico máximo del usuario autenticado
-- ============================================================
CREATE OR REPLACE FUNCTION public.current_user_privilege_level()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, auth
AS $$
DECLARE
  v_level INT := 0;
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

-- ============================================================
-- FUNCIÓN: is_own_record
-- Verifica si una fila pertenece al usuario autenticado
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_own_record(record_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, auth
AS $$
  SELECT record_user_id = auth.uid();
$$;
```

---

## 4. Políticas RLS por Tabla

> [!IMPORTANT]
> Todas las tablas críticas tienen RLS habilitado con `FORCE ROW LEVEL SECURITY`. El rol `service_role` puede bypassear RLS únicamente desde Edge Functions internas firmadas; el `anon` key NUNCA tiene acceso de escritura a tablas críticas.

### 4.1 Tabla `profiles`

```sql
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;

-- Los usuarios ven SOLO su propio perfil (a menos que sean supervisores o superior)
CREATE POLICY "profiles_select_own_or_elevated"
ON public.profiles FOR SELECT
TO authenticated
USING (
  public.is_own_record(id)
  OR public.current_user_has_any_role(ARRAY['supervisor', 'module_admin', 'superadmin'])
);

-- Solo el propio usuario puede actualizar su perfil (el trigger enforce_profile_update_frequency actúa sobre esto)
CREATE POLICY "profiles_update_own"
ON public.profiles FOR UPDATE
TO authenticated
USING  ( public.is_own_record(id) )
WITH CHECK (
  public.is_own_record(id)
  -- document_id e is_active no se pueden editar (el trigger lo fuerza)
);

-- Solo superadmin puede INSERT de perfiles directos (normalmente se hace via auth trigger)
CREATE POLICY "profiles_insert_superadmin"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK ( public.current_user_has_role('superadmin') );

-- Solo superadmin puede desactivar (soft delete) perfiles
CREATE POLICY "profiles_delete_superadmin"
ON public.profiles FOR DELETE
TO authenticated
USING ( public.current_user_has_role('superadmin') );
```

### 4.2 Tabla `user_roles`

```sql
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles FORCE ROW LEVEL SECURITY;

CREATE POLICY "user_roles_select_elevated"
ON public.user_roles FOR SELECT
TO authenticated
USING (
  public.current_user_has_any_role(ARRAY['supervisor', 'module_admin', 'superadmin'])
  OR public.is_own_record(user_id)
);

CREATE POLICY "user_roles_insert_superadmin"
ON public.user_roles FOR INSERT
TO authenticated
WITH CHECK ( public.current_user_has_role('superadmin') );

CREATE POLICY "user_roles_delete_superadmin"
ON public.user_roles FOR DELETE
TO authenticated
USING ( public.current_user_has_role('superadmin') );
```

### 4.3 Tabla `attendance_records`

```sql
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records FORCE ROW LEVEL SECURITY;

-- Lectura: propio usuario o supervisor+
CREATE POLICY "attendance_select"
ON public.attendance_records FOR SELECT
TO authenticated
USING (
  public.is_own_record(user_id)
  OR public.current_user_has_any_role(ARRAY['supervisor', 'module_admin', 'superadmin', 'auditor'])
);

-- Inserción: propio usuario (marcaje de asistencia)
CREATE POLICY "attendance_insert_own"
ON public.attendance_records FOR INSERT
TO authenticated
WITH CHECK ( public.is_own_record(user_id) );

-- Actualización: solo supervisor+ (correcciones aprobadas)
CREATE POLICY "attendance_update_supervisor"
ON public.attendance_records FOR UPDATE
TO authenticated
USING ( public.current_user_has_any_role(ARRAY['supervisor', 'module_admin', 'superadmin']) )
WITH CHECK ( public.current_user_has_any_role(ARRAY['supervisor', 'module_admin', 'superadmin']) );

-- Eliminación: solo superadmin
CREATE POLICY "attendance_delete_superadmin"
ON public.attendance_records FOR DELETE
TO authenticated
USING ( public.current_user_has_role('superadmin') );
```

### 4.4 Tabla `call_interactions`

```sql
ALTER TABLE public.call_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_interactions FORCE ROW LEVEL SECURITY;

-- Lectura: propio operador o supervisor+
CREATE POLICY "call_interactions_select"
ON public.call_interactions FOR SELECT
TO authenticated
USING (
  public.is_own_record(operator_id)
  OR public.current_user_has_any_role(ARRAY['supervisor', 'module_admin', 'superadmin', 'auditor'])
);

-- Inserción: solo el operador asignado en la campaña activa
CREATE POLICY "call_interactions_insert_own_operator"
ON public.call_interactions FOR INSERT
TO authenticated
WITH CHECK (
  public.is_own_record(operator_id)
  AND public.current_user_has_any_role(ARRAY['multi_operator', 'supervisor', 'module_admin', 'superadmin'])
);

-- Actualización: supervisor+
CREATE POLICY "call_interactions_update_supervisor"
ON public.call_interactions FOR UPDATE
TO authenticated
USING ( public.current_user_has_any_role(ARRAY['supervisor', 'module_admin', 'superadmin']) )
WITH CHECK ( public.current_user_has_any_role(ARRAY['supervisor', 'module_admin', 'superadmin']) );
```

### 4.5 Tabla `audit_logs` — Escritura COMPLETAMENTE BLOQUEADA

```sql
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs FORCE ROW LEVEL SECURITY;

-- Solo lectura para auditores y superiores
CREATE POLICY "audit_logs_select_auditor"
ON public.audit_logs FOR SELECT
TO authenticated
USING (
  public.current_user_has_any_role(ARRAY['auditor', 'supervisor', 'module_admin', 'superadmin'])
);

-- ⛔ BLOQUEO TOTAL DE ESCRITURA — incluso superadmin en flujo normal
-- Solo el trigger interno (SECURITY DEFINER) puede escribir aquí
CREATE POLICY "audit_logs_insert_deny_all"
ON public.audit_logs FOR INSERT
TO authenticated
WITH CHECK (FALSE);   -- Siempre rechazado desde cliente

CREATE POLICY "audit_logs_update_deny_all"
ON public.audit_logs FOR UPDATE
TO authenticated
USING (FALSE);

CREATE POLICY "audit_logs_delete_deny_all"
ON public.audit_logs FOR DELETE
TO authenticated
USING (FALSE);
```

---

## 5. Sistema de Auditoría Inmutable

### 5.1 DDL — Tabla `audit_logs` con Hash de Integridad

```sql
-- ============================================================
-- TABLA: audit_logs
-- Registro inmutable de todas las mutaciones críticas
-- Hash SHA-256 para detección de manipulación ex-post
-- ============================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id    UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
    action      TEXT        NOT NULL
                            CHECK (action IN (
                                'INSERT', 'UPDATE', 'DELETE',
                                'LOGIN', 'LOGOUT',
                                'ROLE_ASSIGN', 'ROLE_REVOKE',
                                'BULK_UPLOAD', 'EXPORT', 'RLS_BYPASS'
                            )),
    entity_name TEXT        NOT NULL,
    entity_id   UUID        NOT NULL,
    old_data    JSONB,
    new_data    JSONB,
    ip_address  INET,
    user_agent  TEXT,
    -- Hash SHA-256 del contenido del log para verificar integridad
    content_hash TEXT       NOT NULL
                            GENERATED ALWAYS AS (
                                encode(
                                    digest(
                                        COALESCE(actor_id::text, 'anon') ||
                                        '|' || action ||
                                        '|' || entity_name ||
                                        '|' || entity_id::text ||
                                        '|' || COALESCE(old_data::text, 'null') ||
                                        '|' || COALESCE(new_data::text, 'null'),
                                        'sha256'
                                    ),
                                    'hex'
                                )
                            ) STORED,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- Índices para consultas de auditoría eficientes
CREATE INDEX IF NOT EXISTS idx_audit_actor     ON public.audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_entity    ON public.audit_logs(entity_name, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_action    ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_created   ON public.audit_logs(created_at DESC);
```

---

## 6. Triggers DDL de Auditoría

### 6.1 Función Generic de Auditoría

```sql
-- ============================================================
-- FUNCIÓN: fn_audit_trigger
-- Trigger genérico para capturar OLD/NEW en JSONB
-- Se instala en CADA tabla crítica con auditoría requerida
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_audit_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_actor_id    UUID;
  v_action      TEXT;
  v_old_data    JSONB := NULL;
  v_new_data    JSONB := NULL;
  v_entity_id   UUID;
  v_ip_address  INET;
  v_user_agent  TEXT;
BEGIN
  -- Resolver actor desde JWT
  BEGIN
    v_actor_id := auth.uid();
  EXCEPTION WHEN OTHERS THEN
    v_actor_id := NULL;  -- Operación de sistema sin sesión de usuario
  END;

  -- Resolver acción DML
  v_action := TG_OP;  -- 'INSERT', 'UPDATE', 'DELETE'

  -- Capturar estado anterior (UPDATE / DELETE)
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    v_old_data := to_jsonb(OLD);
    -- Enmascarar campos sensibles en el log
    v_old_data := v_old_data
      - 'password_hash'
      - 'backup_clave_original'
      - 'knox_enrollment_id';
  END IF;

  -- Capturar estado nuevo (INSERT / UPDATE)
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    v_new_data := to_jsonb(NEW);
    v_new_data := v_new_data
      - 'password_hash'
      - 'backup_clave_original'
      - 'knox_enrollment_id';
  END IF;

  -- Resolver entity_id: buscar columna 'id' en la fila
  IF TG_OP = 'DELETE' THEN
    v_entity_id := (to_jsonb(OLD)->>'id')::UUID;
  ELSE
    v_entity_id := (to_jsonb(NEW)->>'id')::UUID;
  END IF;

  -- Metadatos de red desde variables de sesión
  BEGIN
    v_ip_address := current_setting('request.headers', true)::jsonb->>'x-forwarded-for';
    v_user_agent := current_setting('request.headers', true)::jsonb->>'user-agent';
  EXCEPTION WHEN OTHERS THEN
    v_ip_address := NULL;
    v_user_agent := NULL;
  END;

  -- Insertar en audit_logs usando service_role (bypass RLS intencional)
  INSERT INTO public.audit_logs (
    actor_id, action, entity_name, entity_id,
    old_data, new_data, ip_address, user_agent
  ) VALUES (
    v_actor_id, v_action, TG_TABLE_NAME, v_entity_id,
    v_old_data, v_new_data, v_ip_address, v_user_agent
  );

  -- Retornar fila correcta según operación
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;

EXCEPTION WHEN OTHERS THEN
  -- Nunca fallar silenciosamente: re-lanzar con contexto
  RAISE EXCEPTION 'Error en trigger de auditoría [tabla: %, op: %]: %',
    TG_TABLE_NAME, TG_OP, SQLERRM;
END;
$$;

-- ============================================================
-- INSTALACIÓN DE TRIGGERS EN TABLAS CRÍTICAS
-- ============================================================

-- profiles
DROP TRIGGER IF EXISTS tr_audit_profiles ON public.profiles;
CREATE TRIGGER tr_audit_profiles
  AFTER INSERT OR UPDATE OR DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();

-- user_roles
DROP TRIGGER IF EXISTS tr_audit_user_roles ON public.user_roles;
CREATE TRIGGER tr_audit_user_roles
  AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();

-- attendance_records
DROP TRIGGER IF EXISTS tr_audit_attendance ON public.attendance_records;
CREATE TRIGGER tr_audit_attendance
  AFTER INSERT OR UPDATE OR DELETE ON public.attendance_records
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();

-- call_interactions
DROP TRIGGER IF EXISTS tr_audit_call_interactions ON public.call_interactions;
CREATE TRIGGER tr_audit_call_interactions
  AFTER INSERT OR UPDATE OR DELETE ON public.call_interactions
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();

-- incidents
DROP TRIGGER IF EXISTS tr_audit_incidents ON public.incidents;
CREATE TRIGGER tr_audit_incidents
  AFTER INSERT OR UPDATE OR DELETE ON public.incidents
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();

-- oriana_reports
DROP TRIGGER IF EXISTS tr_audit_oriana ON public.oriana_reports;
CREATE TRIGGER tr_audit_oriana
  AFTER INSERT OR UPDATE OR DELETE ON public.oriana_reports
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();

-- corporate_devices
DROP TRIGGER IF EXISTS tr_audit_devices ON public.corporate_devices;
CREATE TRIGGER tr_audit_devices
  AFTER INSERT OR UPDATE OR DELETE ON public.corporate_devices
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();
```

### 6.2 Trigger de Restricción de Edición de Perfil

```sql
-- ============================================================
-- FUNCIÓN: enforce_profile_update_frequency
-- Aplica cuota de 1 edición cada 7 días en campos sensibles
-- Bloquea modificación de campos protegidos (document_id, is_active)
-- ============================================================
CREATE OR REPLACE FUNCTION public.enforce_profile_update_frequency()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1. Bloquear edición de campos absolutamente protegidos
  --    El trigger fuerza los valores originales, independiente del payload
  NEW.document_id := OLD.document_id;
  NEW.is_active   := OLD.is_active;

  -- 2. Verificar cuota de edición en campos de frecuencia limitada
  IF (NEW.phone_number IS DISTINCT FROM OLD.phone_number)
  OR (NEW.address IS DISTINCT FROM OLD.address)
  THEN
    -- Verificar si ya editó dentro de la ventana de 7 días
    IF OLD.last_profile_edit_at IS NOT NULL
    AND OLD.last_profile_edit_at > (now() - INTERVAL '7 days')
    THEN
      RAISE EXCEPTION
        'Restricción de edición: solo 1 actualización cada 7 días. '
        'Última edición: %. Próxima permitida: %',
        OLD.last_profile_edit_at,
        (OLD.last_profile_edit_at + INTERVAL '7 days')::DATE;
    END IF;

    -- Actualizar metadatos de control
    NEW.last_profile_edit_at    := now();
    NEW.profile_edit_count_week := OLD.profile_edit_count_week + 1;
  END IF;

  -- 3. Forzar timestamp de actualización
  NEW.updated_at := timezone('utc', now());

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_enforce_profile_edit_limits ON public.profiles;
CREATE TRIGGER tr_enforce_profile_edit_limits
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_profile_update_frequency();
```

---

## 7. Middleware de Autorización TypeScript

```typescript
// packages/auth/src/middleware/rbac.middleware.ts
import { createServerClient } from '@supabase/ssr';
import type { NextRequest, NextResponse } from 'next/server';
import type { Database } from '@intranet/database';
import {
  type AuthenticatedUser,
  type RLSCheckResult,
  type SystemRole,
  SYSTEM_ROLES,
  ROLE_PRIVILEGE_LEVEL,
  isSystemRole,
} from '../types/rbac.types';

// ─────────────────────────────────────────────
// CLIENTE SUPABASE TIPADO PARA SERVER-SIDE
// ─────────────────────────────────────────────
function createSupabaseServerClient(request: NextRequest) {
  const response = { headers: new Headers() };
  return {
    client: createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => request.cookies.getAll(),
          setAll: (cookies) => {
            cookies.forEach(({ name, value, options }) => {
              response.headers.append(
                'Set-Cookie',
                `${name}=${value}; ${Object.entries(options ?? {})
                  .map(([k, v]) => `${k}=${v}`)
                  .join('; ')}`
              );
            });
          },
        },
      }
    ),
    response,
  };
}

// ─────────────────────────────────────────────
// RESOLVER USUARIO AUTENTICADO CON ROLES
// ─────────────────────────────────────────────
export async function resolveAuthenticatedUser(
  request: NextRequest
): Promise<AuthenticatedUser | null> {
  const { client } = createSupabaseServerClient(request);

  // 1. Verificar sesión JWT válida
  const { data: { session }, error: sessionError } = await client.auth.getSession();
  if (sessionError || !session) return null;

  // 2. Verificar que el token no haya expirado (doble verificación client-side)
  const nowSecs = Math.floor(Date.now() / 1000);
  if (session.expires_at && session.expires_at < nowSecs) return null;

  // 3. Obtener perfil del usuario
  const { data: profile, error: profileError } = await client
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single();

  if (profileError || !profile || !profile.is_active) return null;

  // 4. Obtener roles asignados
  const { data: userRoles, error: rolesError } = await client
    .from('user_roles')
    .select('roles!inner(name)')
    .eq('user_id', session.user.id);

  if (rolesError) return null;

  // 5. Extraer y validar roles — filtrar solo roles del sistema conocidos
  const roles: SystemRole[] = (userRoles ?? [])
    .flatMap((ur) => {
      const roleName = (ur as { roles: { name: string } }).roles?.name;
      return isSystemRole(roleName) ? [roleName] : [];
    });

  return {
    id:         session.user.id,
    email:      session.user.email ?? '',
    roles,
    profile,
    sessionJwt: session.access_token,
    issuedAt:   session.user.created_at
                  ? Math.floor(new Date(session.user.created_at).getTime() / 1000)
                  : 0,
    expiresAt:  session.expires_at ?? 0,
  };
}

// ─────────────────────────────────────────────
// VERIFICADOR DE AUTORIZACIÓN CON RESULTADO TIPADO
// ─────────────────────────────────────────────
export function checkAuthorization(
  user: AuthenticatedUser | null,
  requiredRoles: readonly SystemRole[]
): RLSCheckResult {
  if (!user) {
    return { authorized: false, reason: 'UNAUTHENTICATED' };
  }

  // Verificar que la sesión no haya expirado
  const nowSecs = Math.floor(Date.now() / 1000);
  if (user.expiresAt < nowSecs) {
    return { authorized: false, reason: 'SESSION_EXPIRED' };
  }

  if (!user.profile.is_active) {
    return { authorized: false, reason: 'PROFILE_INACTIVE' };
  }

  if (user.roles.length === 0) {
    return { authorized: false, reason: 'ROLE_NOT_FOUND' };
  }

  const hasRequiredRole = requiredRoles.some((r) => user.roles.includes(r));
  if (!hasRequiredRole) {
    return { authorized: false, reason: 'INSUFFICIENT_PRIVILEGE' };
  }

  return {
    authorized: true,
    userId: user.id,
    roles:  user.roles,
  };
}

// ─────────────────────────────────────────────
// VERIFICADOR POR NIVEL DE PRIVILEGIO MÍNIMO
// ─────────────────────────────────────────────
export function checkMinimumPrivilegeLevel(
  user: AuthenticatedUser | null,
  minimumLevel: number
): RLSCheckResult {
  if (!user) return { authorized: false, reason: 'UNAUTHENTICATED' };

  const userMaxLevel = Math.max(
    0,
    ...user.roles.map((r) => ROLE_PRIVILEGE_LEVEL[r])
  );

  if (userMaxLevel < minimumLevel) {
    return { authorized: false, reason: 'INSUFFICIENT_PRIVILEGE' };
  }

  return { authorized: true, userId: user.id, roles: user.roles };
}

// ─────────────────────────────────────────────
// HELPER: REQUIERE ROL — lanza si no autorizado
// ─────────────────────────────────────────────
export function requireRole(
  user: AuthenticatedUser | null,
  requiredRoles: readonly SystemRole[],
  context?: string
): asserts user is AuthenticatedUser {
  const result = checkAuthorization(user, requiredRoles);
  if (!result.authorized) {
    throw new AuthorizationError(result.reason, requiredRoles, context);
  }
}

// ─────────────────────────────────────────────
// ERROR DE AUTORIZACIÓN TIPADO
// ─────────────────────────────────────────────
export class AuthorizationError extends Error {
  public readonly reason:        string;
  public readonly requiredRoles: readonly SystemRole[];
  public readonly context:       string | undefined;
  public readonly statusCode:    number = 403;

  constructor(
    reason: string,
    requiredRoles: readonly SystemRole[],
    context?: string
  ) {
    super(
      `Acceso denegado [${reason}]. Roles requeridos: [${requiredRoles.join(', ')}]` +
      (context ? ` — Contexto: ${context}` : '')
    );
    this.name          = 'AuthorizationError';
    this.reason        = reason;
    this.requiredRoles = requiredRoles;
    this.context       = context;
  }
}
```

---

## 8. Validaciones en Tiempo de Ejecución

```typescript
// packages/auth/src/validators/runtime.validators.ts
import { z } from 'zod';
import { SYSTEM_ROLES, type SystemRole, type AuditAction, type AuditableEntity } from '../types/rbac.types';

// ─────────────────────────────────────────────
// ESQUEMA ZOD — VALIDACIÓN DE PAYLOAD DE AUDITORÍA
// ─────────────────────────────────────────────
export const AuditLogPayloadSchema = z.object({
  actorId: z
    .string()
    .uuid('actor_id debe ser un UUID válido'),
  action: z.enum([
    'INSERT', 'UPDATE', 'DELETE',
    'LOGIN', 'LOGOUT',
    'ROLE_ASSIGN', 'ROLE_REVOKE',
    'BULK_UPLOAD', 'EXPORT', 'RLS_BYPASS',
  ] as const satisfies readonly AuditAction[]),
  entityName: z.enum([
    'profiles', 'user_roles', 'attendance_records',
    'clock_events', 'call_interactions', 'call_assignments',
    'incidents', 'oriana_reports', 'corporate_devices', 'audit_logs',
  ] as const satisfies readonly AuditableEntity[]),
  entityId: z
    .string()
    .uuid('entity_id debe ser un UUID válido'),
  oldData: z.record(z.unknown()).nullable().optional(),
  newData: z.record(z.unknown()).nullable().optional(),
  ipAddress: z
    .string()
    .ip({ version: 'v4', message: 'ip_address debe ser IPv4 válida' })
    .or(z.string().ip({ version: 'v6', message: 'ip_address debe ser IPv6 válida' }))
    .nullable()
    .optional(),
  userAgent: z
    .string()
    .max(512, 'user_agent demasiado largo')
    .nullable()
    .optional(),
});

export type AuditLogPayload = z.infer<typeof AuditLogPayloadSchema>;

// ─────────────────────────────────────────────
// ESQUEMA ZOD — ASIGNACIÓN DE ROL
// ─────────────────────────────────────────────
export const RoleAssignmentSchema = z.object({
  targetUserId: z
    .string()
    .uuid('targetUserId debe ser un UUID válido'),
  roleName: z.enum(SYSTEM_ROLES as unknown as [SystemRole, ...SystemRole[]], {
    errorMap: () => ({ message: `roleName debe ser uno de: ${SYSTEM_ROLES.join(', ')}` }),
  }),
});

export type RoleAssignmentInput = z.infer<typeof RoleAssignmentSchema>;

// ─────────────────────────────────────────────
// ESQUEMA ZOD — ACTUALIZACIÓN DE PERFIL
// ─────────────────────────────────────────────
export const ProfileUpdateSchema = z.object({
  phone_number: z
    .string()
    .regex(
      /^\+?[0-9\s\-()]{7,20}$/,
      'Número de teléfono con formato inválido'
    )
    .nullable()
    .optional(),
  address: z
    .string()
    .min(5,  'Dirección demasiado corta (mínimo 5 caracteres)')
    .max(500, 'Dirección demasiado larga (máximo 500 caracteres)')
    .nullable()
    .optional(),
  // Campos protegidos: si se envían son ignorados por el trigger,
  // pero los rechazamos explícitamente en el cliente para feedback temprano
  document_id: z.undefined({ message: 'document_id no puede ser modificado' }).optional(),
  is_active:   z.undefined({ message: 'is_active no puede ser modificado' }).optional(),
  full_name:   z.undefined({ message: 'full_name no puede ser modificado por el usuario' }).optional(),
}).strict('Solo se permiten campos phone_number y address');

export type ProfileUpdateInput = z.infer<typeof ProfileUpdateSchema>;

// ─────────────────────────────────────────────
// VALIDADOR EN TIEMPO DE EJECUCIÓN CON RESULTADO TYPED
// ─────────────────────────────────────────────
export type ValidationResult<T> =
  | { success: true;  data: T }
  | { success: false; errors: Record<string, string[]> };

export function validateAuditPayload(raw: unknown): ValidationResult<AuditLogPayload> {
  const result = AuditLogPayloadSchema.safeParse(raw);
  if (result.success) return { success: true, data: result.data };
  return {
    success: false,
    errors: Object.fromEntries(
      Object.entries(result.error.flatten().fieldErrors)
        .map(([k, v]) => [k, v ?? []])
    ),
  };
}

export function validateRoleAssignment(raw: unknown): ValidationResult<RoleAssignmentInput> {
  const result = RoleAssignmentSchema.safeParse(raw);
  if (result.success) return { success: true, data: result.data };
  return {
    success: false,
    errors: Object.fromEntries(
      Object.entries(result.error.flatten().fieldErrors)
        .map(([k, v]) => [k, v ?? []])
    ),
  };
}

export function validateProfileUpdate(raw: unknown): ValidationResult<ProfileUpdateInput> {
  const result = ProfileUpdateSchema.safeParse(raw);
  if (result.success) return { success: true, data: result.data };
  return {
    success: false,
    errors: Object.fromEntries(
      Object.entries(result.error.flatten().fieldErrors)
        .map(([k, v]) => [k, v ?? []])
    ),
  };
}
```

---

## 9. Gestión de Sesión y JWT Claims

```typescript
// packages/auth/src/session/jwt.utils.ts
import { jwtDecode } from 'jwt-decode';
import type { SystemRole } from '../types/rbac.types';
import { isSystemRole } from '../types/rbac.types';

// ─────────────────────────────────────────────
// ESTRUCTURA DEL JWT DE SUPABASE
// ─────────────────────────────────────────────
interface SupabaseJwtPayload {
  readonly aud:   string;
  readonly exp:   number;
  readonly iat:   number;
  readonly iss:   string;
  readonly sub:   string;        // auth.uid()
  readonly email: string;
  readonly role:  'authenticated' | 'anon' | 'service_role';
  readonly app_metadata?: {
    readonly provider?: string;
  };
  readonly user_metadata?: Record<string, unknown>;
}

// ─────────────────────────────────────────────
// DECODIFICADOR TIPADO CON VALIDACIÓN
// ─────────────────────────────────────────────
export function decodeSupabaseJwt(token: string): SupabaseJwtPayload | null {
  try {
    const decoded = jwtDecode<SupabaseJwtPayload>(token);

    // Validaciones de integridad mínimas
    if (!decoded.sub || typeof decoded.sub !== 'string') return null;
    if (!decoded.exp || typeof decoded.exp !== 'number') return null;
    if (decoded.role !== 'authenticated') return null;

    // Verificar expiración
    const nowSecs = Math.floor(Date.now() / 1000);
    if (decoded.exp < nowSecs) return null;

    return decoded;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────
// EXTRACTOR DE USER_ID VALIDADO
// ─────────────────────────────────────────────
export function extractUserId(token: string): string | null {
  const payload = decodeSupabaseJwt(token);
  if (!payload) return null;

  // UUID v4 pattern validation
  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidPattern.test(payload.sub)) return null;

  return payload.sub;
}
```

---

## 10. Matriz de Riesgos y Controles Compensatorios

| ID | Amenaza | Vector | Probabilidad | Impacto | Control Principal | Control Compensatorio |
|----|---------|--------|-------------|---------|-------------------|----------------------|
| R-01 | Escalada de privilegios | Manipulación de JWT client-side | Baja | Crítico | RLS evalúa `auth.uid()` en DB | Auditoría de cada `user_roles` INSERT |
| R-02 | Inyección SQL | Parámetros de API sin sanitizar | Media | Alto | Supabase SDK usa prepared statements | Validación Zod pre-query |
| R-03 | Acceso a filas de otros usuarios | Omisión de RLS en query directo | Baja | Alto | `FORCE ROW LEVEL SECURITY` en todas las tablas | Auditoría de selects masivos por `auditor` |
| R-04 | Manipulación de logs de auditoría | Write directo a `audit_logs` | Muy Baja | Crítico | Policy `WITH CHECK (FALSE)` para INSERT/UPDATE/DELETE | Hash SHA-256 de contenido en columna STORED |
| R-05 | Edición fraudulenta de perfil | Múltiples updates en 7 días | Media | Alto | Trigger `enforce_profile_update_frequency` | Registro en `audit_logs` de cada UPDATE |
| R-06 | Uso de `service_role` key desde frontend | Exposición de credentials | Baja | Crítico | `service_role` solo en Edge Functions firmadas | Rotación mensual de API keys |
| R-07 | Session Hijacking | Robo de JWT de cookies | Baja | Alto | `Secure; HttpOnly; SameSite=Strict` en cookies | Refresco de token cada 1 hora |
| R-08 | Fuga de datos en logs | Almacenamiento de datos sensibles en old/new JSONB | Media | Medio | Enmascarado de `password_hash` y `knox_enrollment_id` en trigger | RLS de solo lectura para auditor |

> [!CAUTION]
> El `service_role` anon key de Supabase **nunca debe ser expuesto en el cliente**. Toda operación privilegiada que requiera bypass de RLS se realiza exclusivamente desde Supabase Edge Functions invocadas mediante tokens firmados OIDC.

> [!NOTE]
> La columna `content_hash` en `audit_logs` es de tipo `GENERATED ALWAYS AS ... STORED`. Esto significa que PostgreSQL la recalcula en cada INSERT y no puede ser sobreescrita por ningún usuario, garantizando integridad criptográfica verificable.

