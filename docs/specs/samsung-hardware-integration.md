# Samsung Hardware Integration — Flujo Operativo de Marcación y Captura de Interacciones

> **Documento:** `samsung-hardware-integration.md`  
> **Versión:** 2.0.0  
> **Fecha:** 2026-11-05  
> **Autor:** Arquitectura NEXUS SYSTEM  
> **Stack:** PostgreSQL 15 (Supabase) · Next.js 14 App Router · TypeScript 5.3 strict · Samsung Knox 3.x

---

## Tabla de Contenidos

1. [Contexto Operativo — Sin PBX, Sin VOIP Central](#1-contexto-operativo--sin-pbx-sin-voip-central)
2. [Inventario de Terminales Samsung Corporativos](#2-inventario-de-terminales-samsung-corporativos)
3. [Tipos TypeScript del Sistema de Hardware](#3-tipos-typescript-del-sistema-de-hardware)
4. [Flujo de Marcación Manual Guiada](#4-flujo-de-marcación-manual-guiada)
5. [Captura de Interacciones — Flujo Completo](#5-captura-de-interacciones--flujo-completo)
6. [SDK de Interacciones de Llamadas](#6-sdk-de-interacciones-de-llamadas)
7. [API Route — Registro de Interacción](#7-api-route--registro-de-interacción)
8. [Validaciones en Tiempo de Ejecución](#8-validaciones-en-tiempo-de-ejecución)
9. [Componente de Interfaz — Discador Guiado](#9-componente-de-interfaz--discador-guiado)
10. [Gestión de Dispositivos — DDL y SDK](#10-gestión-de-dispositivos--ddl-y-sdk)
11. [Métricas de Latencia entre Llamadas](#11-métricas-de-latencia-entre-llamadas)
12. [Fingerprinting y Anti-Fraude de Dispositivo](#12-fingerprinting-y-anti-fraude-de-dispositivo)
13. [Troubleshooting y Códigos de Error](#13-troubleshooting-y-códigos-de-error)

---

## 1. Contexto Operativo — Sin PBX, Sin VOIP Central

### 1.1 Modelo de Telefonía del NEXUS SYSTEM

El NEXUS SYSTEM opera bajo un modelo de telefonía **100% celular corporativo manual**, sin infraestructura PBX (Private Branch Exchange), sin softphones VOIP centralizados (Asterisk, Issabel, 3CX) ni integración con operadoras de telefonía para CDR automáticos.

Este diseño responde a las siguientes restricciones del entorno operativo:
- **Sin infraestructura física de red dedicada** para telefonía.
- **Rotación de terminales** entre operadores según disponibilidad.
- **Campañas de llamadas salientes** a números de gestión pública con alta variabilidad.
- **Necesidad de trazabilidad auditada** de cada interacción telefónica sin dependencia de operadora.

### 1.2 Diagrama del Flujo Operativo

```
FLUJO DE LLAMADA SIN PBX — NEXUS SYSTEM
════════════════════════════════════════

[INTRANET WEB]           [TERMINAL SAMSUNG]         [SUPABASE DB]
     │                         │                          │
     │  1. Muestra próximo      │                          │
     │     número asignado     │                          │
     │◄────────────────────────┤                          │
     │                         │                          │
     │  2. Operador marca       │                          │
     │     manualmente el nº   │                          │
     │     en el celular ──────►│ LLAMADA CELULAR          │
     │                         │ (Red móvil corporativa)  │
     │  3. Operador presiona    │                          │
     │     "INICIAR LLAMADA"   │                          │
     │     en la intranet      │                          │
     │   → start_time capturado│                          │
     │                         │ ... CONVERSACIÓN ...     │
     │                         │                          │
     │  4. Finaliza la llamada │                          │
     │     Selecciona resultado │                          │
     │     Escribe notas        │                          │
     │   → end_time capturado  │                          │
     │                         │                          │
     │  5. POST /api/calls/log  │                          │
     │─────────────────────────────────────────────────► │
     │                         │                          │  INSERT
     │                         │                          │  call_interactions
     │                         │                          │  (con audit trigger)
     │◄─────────────────────────────────────────────────  │
     │                         │                          │
     │  6. Muestra siguiente    │                          │
     │     número en cola      │                          │
     │     (idle_time medido)  │                          │
     └─────────────────────────┘                          │
```

### 1.3 Restricciones de Diseño

| Restricción | Implicación de Diseño |
|-------------|----------------------|
| Sin CDR automático de operadora | El operador activa/desactiva el temporizador manualmente en la intranet |
| Sin softphone integrado | La duración es capturada por diferencia entre `start_time` y `end_time` |
| Sin detección automática de resultado | El operador selecciona el resultado (`answered_effective`, `busy`, etc.) |
| Sin grabación de llamadas | Solo se persisten metadatos: duración, resultado, notas |
| Terminales rotativos | El `device_id` se selecciona al inicio de la sesión de trabajo |

---

## 2. Inventario de Terminales Samsung Corporativos

### 2.1 DDL — Tabla `corporate_devices`

```sql
-- ============================================================
-- TABLA: corporate_devices
-- Inventario de terminales celulares Samsung corporativos
-- ============================================================
CREATE TABLE IF NOT EXISTS public.corporate_devices (
    id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    assigned_user_id        UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
    imei                    TEXT        UNIQUE NOT NULL
                            CHECK (imei ~ '^[0-9]{15}$'),           -- IMEI de 15 dígitos
    imei2                   TEXT                                      -- Dual SIM
                            CHECK (imei2 IS NULL OR imei2 ~ '^[0-9]{15}$'),
    phone_number            TEXT        NOT NULL
                            CHECK (phone_number ~ '^\+?[0-9\s\-()]{7,20}$'),
    model                   TEXT        NOT NULL,                     -- Ej: 'Samsung Galaxy A15'
    android_version         TEXT,                                     -- Ej: '14'
    knox_version            TEXT,                                     -- Ej: '3.9'
    knox_enrollment_id      TEXT        UNIQUE,                       -- ID de enrollamiento MDM
    battery_health_pct      INT         CHECK (battery_health_pct BETWEEN 0 AND 100),
    storage_free_gb         NUMERIC(5,2),
    status                  TEXT        NOT NULL
                            CHECK (status IN ('available', 'assigned', 'maintenance', 'lost', 'decommissioned'))
                            DEFAULT 'available',
    last_seen_at            TIMESTAMPTZ,                             -- Último ping de telemetría
    notes                   TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_devices_assigned_user ON public.corporate_devices(assigned_user_id);
CREATE INDEX IF NOT EXISTS idx_devices_status        ON public.corporate_devices(status);
CREATE INDEX IF NOT EXISTS idx_devices_phone         ON public.corporate_devices(phone_number);

-- Trigger de updated_at en dispositivos
CREATE OR REPLACE FUNCTION public.fn_update_device_timestamp()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := timezone('utc', now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_update_device_ts ON public.corporate_devices;
CREATE TRIGGER tr_update_device_ts
  BEFORE UPDATE ON public.corporate_devices
  FOR EACH ROW EXECUTE FUNCTION public.fn_update_device_timestamp();

-- RLS en corporate_devices
ALTER TABLE public.corporate_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.corporate_devices FORCE ROW LEVEL SECURITY;

-- Solo supervisores y superiores pueden ver todos los dispositivos
CREATE POLICY "devices_select_elevated"
ON public.corporate_devices FOR SELECT
TO authenticated
USING (
  public.current_user_has_any_role(ARRAY['supervisor', 'module_admin', 'superadmin'])
  -- El operador asignado puede ver SU dispositivo
  OR assigned_user_id = auth.uid()
);

-- Solo module_admin y superadmin pueden INSERT/UPDATE/DELETE
CREATE POLICY "devices_write_admin"
ON public.corporate_devices FOR INSERT
TO authenticated
WITH CHECK ( public.current_user_has_any_role(ARRAY['module_admin', 'superadmin']) );

CREATE POLICY "devices_update_admin"
ON public.corporate_devices FOR UPDATE
TO authenticated
USING ( public.current_user_has_any_role(ARRAY['module_admin', 'superadmin']) )
WITH CHECK ( public.current_user_has_any_role(ARRAY['module_admin', 'superadmin']) );
```

---

## 3. Tipos TypeScript del Sistema de Hardware

```typescript
// packages/database/src/types/hardware.types.ts
import type { Database } from './database.types';

// ─────────────────────────────────────────────
// TIPOS DE FILA DE BASE DE DATOS
// ─────────────────────────────────────────────
export type CorporateDeviceRow     = Database['public']['Tables']['corporate_devices']['Row'];
export type CorporateDeviceInsert  = Database['public']['Tables']['corporate_devices']['Insert'];
export type CorporateDeviceUpdate  = Database['public']['Tables']['corporate_devices']['Update'];
export type CallInteractionRow     = Database['public']['Tables']['call_interactions']['Row'];
export type CallInteractionInsert  = Database['public']['Tables']['call_interactions']['Insert'];
export type CallAssignmentRow      = Database['public']['Tables']['call_assignments']['Row'];

// ─────────────────────────────────────────────
// ENUMERACIONES DE DOMINIO — Dispositivos
// ─────────────────────────────────────────────
export const DEVICE_STATUSES = [
  'available',
  'assigned',
  'maintenance',
  'lost',
  'decommissioned',
] as const;

export type DeviceStatus = (typeof DEVICE_STATUSES)[number];

// ─────────────────────────────────────────────
// ENUMERACIONES DE DOMINIO — Resultados de Llamada
// ─────────────────────────────────────────────
export const CALL_RESULTS = [
  'answered_effective',
  'busy',
  'no_answer',
  'invalid_number',
  'rejected',
] as const;

export type CallResult = (typeof CALL_RESULTS)[number];

// Etiquetas de UI para los resultados
export const CALL_RESULT_LABELS: Record<CallResult, string> = {
  answered_effective: '✅ Contestó — Efectiva',
  busy:               '🔴 Ocupado',
  no_answer:          '📵 No contestó',
  invalid_number:     '❌ Número inválido / no existe',
  rejected:           '🚫 Rechazó la llamada',
} as const;

// ─────────────────────────────────────────────
// ESTADO DE SESIÓN DE LLAMADAS DEL OPERADOR
// ─────────────────────────────────────────────
export type CallSessionState =
  | { readonly phase: 'idle';    readonly lastCallEndAt: string | null }
  | { readonly phase: 'dialing'; readonly startedAt: string; readonly assignmentId: string }
  | { readonly phase: 'in_call'; readonly startedAt: string; readonly assignmentId: string }
  | { readonly phase: 'logging'; readonly startedAt: string; readonly endedAt: string; readonly assignmentId: string };

// ─────────────────────────────────────────────
// PAYLOAD DE REGISTRO DE INTERACCIÓN
// ─────────────────────────────────────────────
export interface CallInteractionPayload {
  readonly assignmentId:     string;    // UUID de call_assignments
  readonly operatorId:       string;    // UUID del operador
  readonly deviceId:         string;    // UUID del terminal Samsung
  readonly startTime:        string;    // ISO 8601 — cuando el operador presionó "Iniciar"
  readonly endTime:          string;    // ISO 8601 — cuando el operador presionó "Finalizar"
  readonly result:           CallResult;
  readonly idleTimePriorCall: number;  // Segundos desde la última llamada finalizada
  readonly notes:            string | null;
}

// ─────────────────────────────────────────────
// RESPUESTA TIPADA DE REGISTRO DE LLAMADA
// ─────────────────────────────────────────────
export type CallInteractionResponse =
  | {
      readonly success:        true;
      readonly interactionId:  string;
      readonly durationSeconds: number;
      readonly nextAssignment: CallAssignmentRow | null;
    }
  | {
      readonly success: false;
      readonly error:   CallRegistrationError;
    };

export type CallRegistrationError =
  | 'ASSIGNMENT_NOT_FOUND'
  | 'DEVICE_NOT_ASSIGNED_TO_OPERATOR'
  | 'DEVICE_UNAVAILABLE'
  | 'INVALID_TIME_RANGE'
  | 'DURATION_TOO_SHORT'       // < 1 segundo
  | 'DURATION_TOO_LONG'        // > 7200 segundos (2 horas)
  | 'ASSIGNMENT_ALREADY_LOGGED'
  | 'OPERATOR_SESSION_MISMATCH'
  | 'DB_INSERT_FAILED';

// ─────────────────────────────────────────────
// FINGERPRINT DE DISPOSITIVO SAMSUNG
// ─────────────────────────────────────────────
export interface SamsungDeviceFingerprint {
  readonly imei:              string;
  readonly model:             string;
  readonly androidVersion:    string;
  readonly knoxVersion:       string | null;
  readonly screenResolution:  string;        // Ej: "2340x1080"
  readonly userAgent:         string;
  readonly computedHash:      string;        // SHA-256 de los campos anteriores
}

// ─────────────────────────────────────────────
// GUARDS DE TIPO EN TIEMPO DE EJECUCIÓN
// ─────────────────────────────────────────────
export function isCallResult(value: unknown): value is CallResult {
  return typeof value === 'string' && (CALL_RESULTS as readonly string[]).includes(value);
}

export function isDeviceStatus(value: unknown): value is DeviceStatus {
  return typeof value === 'string' && (DEVICE_STATUSES as readonly string[]).includes(value);
}

export function isValidImei(imei: string): boolean {
  if (!/^\d{15}$/.test(imei)) return false;
  // Algoritmo de Luhn para validación de IMEI
  let sum = 0;
  for (let i = 0; i < 15; i++) {
    let digit = parseInt(imei[i], 10);
    if (i % 2 !== 0) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return sum % 10 === 0;
}
```

---

## 4. Flujo de Marcación Manual Guiada

### 4.1 Secuencia de Eventos — Paso a Paso

```typescript
// packages/database/src/types/call-session.types.ts

// Estados del discador guiado (State Machine)
export type DialerPhase =
  | 'LOADING_ASSIGNMENT'      // Cargando próximo número de la cola
  | 'READY_TO_DIAL'           // Número visible, operador listo
  | 'CALL_INITIATED'          // Operador presionó "Iniciar Llamada" — timer activo
  | 'CALL_IN_PROGRESS'        // Llamada en curso (timer corriendo)
  | 'CALL_ENDED_LOGGING'      // Operador presionó "Finalizar" — seleccionando resultado
  | 'SAVING'                  // POST en curso a /api/calls/log
  | 'SAVED_IDLE'              // Guardado exitoso — mostrando siguiente asignación
  | 'ERROR'                   // Error irrecuperable
  | 'NO_MORE_ASSIGNMENTS'     // Cola agotada para esta campaña
  | 'QUOTA_REACHED';          // Cuota diaria completada

// Eventos que transicionan entre estados
export type DialerEvent =
  | { type: 'ASSIGNMENT_LOADED';  assignment: CallAssignmentRow }
  | { type: 'START_CALL';         startTime: string }
  | { type: 'END_CALL';           endTime: string }
  | { type: 'SELECT_RESULT';      result: CallResult }
  | { type: 'ADD_NOTE';           notes: string }
  | { type: 'SUBMIT_LOG' }
  | { type: 'SAVE_SUCCESS';       response: CallInteractionResponse }
  | { type: 'SAVE_ERROR';         error: CallRegistrationError }
  | { type: 'RETRY' }
  | { type: 'NEXT_ASSIGNMENT' };

import type { CallAssignmentRow, CallResult } from './hardware.types';
```

### 4.2 Función de Transición de Estado

```typescript
// apps/calls-incidents/src/lib/dialer/state-machine.ts
import type { DialerPhase, DialerEvent } from '@intranet/database/call-session.types';
import type { CallAssignmentRow, CallResult, CallRegistrationError } from '@intranet/database/hardware.types';

export interface DialerState {
  readonly phase:          DialerPhase;
  readonly assignment:     CallAssignmentRow | null;
  readonly startTime:      string | null;    // ISO 8601
  readonly endTime:        string | null;    // ISO 8601
  readonly selectedResult: CallResult | null;
  readonly notes:          string;
  readonly idleStartedAt:  string | null;    // Para calcular idle_time_prior_call
  readonly errorCode:      CallRegistrationError | null;
  readonly callsToday:     number;
  readonly dailyQuota:     number;
}

export const initialDialerState: DialerState = {
  phase:           'LOADING_ASSIGNMENT',
  assignment:      null,
  startTime:       null,
  endTime:         null,
  selectedResult:  null,
  notes:           '',
  idleStartedAt:   null,
  errorCode:       null,
  callsToday:      0,
  dailyQuota:      200,
};

export function dialerReducer(
  state:  DialerState,
  event:  DialerEvent
): DialerState {
  switch (event.type) {
    case 'ASSIGNMENT_LOADED':
      if (state.phase !== 'LOADING_ASSIGNMENT' && state.phase !== 'SAVED_IDLE') {
        return state;  // Transición inválida — ignorar
      }
      if (state.callsToday >= state.dailyQuota) {
        return { ...state, phase: 'QUOTA_REACHED' };
      }
      return {
        ...state,
        phase:      'READY_TO_DIAL',
        assignment: event.assignment,
        startTime:  null,
        endTime:    null,
        selectedResult: null,
        notes:      '',
        errorCode:  null,
      };

    case 'START_CALL':
      if (state.phase !== 'READY_TO_DIAL') return state;
      return {
        ...state,
        phase:     'CALL_INITIATED',
        startTime: event.startTime,
      };

    case 'END_CALL':
      if (state.phase !== 'CALL_INITIATED' && state.phase !== 'CALL_IN_PROGRESS') {
        return state;
      }
      return {
        ...state,
        phase:   'CALL_ENDED_LOGGING',
        endTime: event.endTime,
      };

    case 'SELECT_RESULT':
      if (state.phase !== 'CALL_ENDED_LOGGING') return state;
      return { ...state, selectedResult: event.result };

    case 'ADD_NOTE':
      if (state.phase !== 'CALL_ENDED_LOGGING') return state;
      return { ...state, notes: event.notes };

    case 'SUBMIT_LOG':
      if (state.phase !== 'CALL_ENDED_LOGGING' || !state.selectedResult) return state;
      return { ...state, phase: 'SAVING' };

    case 'SAVE_SUCCESS':
      if (state.phase !== 'SAVING') return state;
      return {
        ...state,
        phase:        'SAVED_IDLE',
        assignment:   event.response.success ? event.response.nextAssignment : null,
        callsToday:   state.callsToday + 1,
        idleStartedAt: new Date().toISOString(),
        startTime:    null,
        endTime:      null,
        selectedResult: null,
        notes:        '',
      };

    case 'SAVE_ERROR':
      return { ...state, phase: 'ERROR', errorCode: event.error };

    case 'RETRY':
      if (state.phase !== 'ERROR') return state;
      return { ...state, phase: 'CALL_ENDED_LOGGING', errorCode: null };

    case 'NEXT_ASSIGNMENT':
      if (state.phase !== 'SAVED_IDLE') return state;
      return { ...state, phase: 'LOADING_ASSIGNMENT', assignment: null };

    default:
      // Exhaustividad: TypeScript alertará si falta un case
      const _exhaustiveCheck: never = event;
      return state;
  }
}
```

---

## 5. Captura de Interacciones — Flujo Completo

### 5.1 DDL — Tabla `call_interactions` con Validaciones

```sql
-- ============================================================
-- TABLA: call_interactions
-- Registro de cada llamada ejecutada desde terminal Samsung
-- La duración es ALWAYS GENERATED (no editable por usuario)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.call_interactions (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id    UUID        NOT NULL REFERENCES public.call_assignments(id) ON DELETE CASCADE,
    operator_id      UUID        NOT NULL REFERENCES public.profiles(id),
    device_id        UUID        NOT NULL REFERENCES public.corporate_devices(id),
    start_time       TIMESTAMPTZ NOT NULL,
    end_time         TIMESTAMPTZ NOT NULL,
    -- Duración calculada por el motor SQL — no editable
    duration_seconds INT
                     GENERATED ALWAYS AS (
                         EXTRACT(EPOCH FROM (end_time - start_time))::INT
                     ) STORED,
    result           TEXT        NOT NULL
                     CHECK (result IN (
                         'answered_effective',
                         'busy',
                         'no_answer',
                         'invalid_number',
                         'rejected'
                     )),
    idle_time_prior_call INT DEFAULT 0
                     CHECK (idle_time_prior_call >= 0),
    notes            TEXT        CHECK (length(notes) <= 1000),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),

    -- Restricciones de integridad de tiempo
    CONSTRAINT chk_end_after_start
        CHECK (end_time > start_time),
    CONSTRAINT chk_duration_max
        CHECK (EXTRACT(EPOCH FROM (end_time - start_time)) <= 7200),  -- Máx 2 horas
    CONSTRAINT chk_duration_min
        CHECK (EXTRACT(EPOCH FROM (end_time - start_time)) >= 1),     -- Mín 1 segundo
    CONSTRAINT chk_not_future
        CHECK (start_time <= timezone('utc', now()) + INTERVAL '30 seconds')  -- Tolerancia de 30s
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_call_int_operator  ON public.call_interactions(operator_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_call_int_device    ON public.call_interactions(device_id);
CREATE INDEX IF NOT EXISTS idx_call_int_result    ON public.call_interactions(result, created_at);
CREATE INDEX IF NOT EXISTS idx_call_int_assignment ON public.call_interactions(assignment_id);

-- ============================================================
-- FUNCIÓN: validate_call_interaction_device
-- Valida que el dispositivo está asignado al operador
-- ============================================================
CREATE OR REPLACE FUNCTION public.validate_call_interaction_device()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1. Verificar que el dispositivo existe y no está en mantenimiento/perdido
  IF NOT EXISTS (
    SELECT 1 FROM public.corporate_devices
    WHERE id = NEW.device_id
    AND   status IN ('available', 'assigned')
  ) THEN
    RAISE EXCEPTION
      'Dispositivo % no está disponible (status: maintenance/lost/decommissioned)',
      NEW.device_id;
  END IF;

  -- 2. Verificar que el dispositivo está asignado al operador
  --    (o está disponible si el operador lo tomó temporalmente)
  IF NOT EXISTS (
    SELECT 1 FROM public.corporate_devices
    WHERE id = NEW.device_id
    AND   (assigned_user_id = NEW.operator_id OR assigned_user_id IS NULL)
  ) THEN
    RAISE EXCEPTION
      'El dispositivo % no está asignado al operador %. '
      'Contacte a su supervisor para reasignación.',
      NEW.device_id,
      NEW.operator_id;
  END IF;

  -- 3. Verificar que la asignación pertenece al operador
  IF NOT EXISTS (
    SELECT 1 FROM public.call_assignments
    WHERE id = NEW.assignment_id
    AND   operator_id = NEW.operator_id
    AND   state IN ('queued', 'calling')
  ) THEN
    RAISE EXCEPTION
      'La asignación % no pertenece al operador % o ya fue completada.',
      NEW.assignment_id,
      NEW.operator_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_validate_call_device ON public.call_interactions;
CREATE TRIGGER tr_validate_call_device
  BEFORE INSERT ON public.call_interactions
  FOR EACH ROW EXECUTE FUNCTION public.validate_call_interaction_device();

-- ============================================================
-- FUNCIÓN: update_assignment_state_on_interaction
-- Actualiza el estado de la asignación tras registrar llamada
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_assignment_state_on_interaction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.call_assignments
  SET state = CASE
    WHEN NEW.result = 'answered_effective' THEN 'completed'
    WHEN NEW.result IN ('busy', 'no_answer') THEN 'rescheduled'
    ELSE 'completed'
  END
  WHERE id = NEW.assignment_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_update_assignment_state ON public.call_interactions;
CREATE TRIGGER tr_update_assignment_state
  AFTER INSERT ON public.call_interactions
  FOR EACH ROW EXECUTE FUNCTION public.update_assignment_state_on_interaction();
```

---

## 6. SDK de Interacciones de Llamadas

```typescript
// packages/database/src/calls.sdk.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types/database.types';
import type {
  CallInteractionPayload,
  CallInteractionResponse,
  CallAssignmentRow,
  CorporateDeviceRow,
} from './types/hardware.types';
import { isCallResult } from './types/hardware.types';

type SupabaseDB = SupabaseClient<Database>;

// ─────────────────────────────────────────────
// REGISTRAR INTERACCIÓN DE LLAMADA
// ─────────────────────────────────────────────
export async function registerCallInteraction(
  client:  SupabaseDB,
  payload: CallInteractionPayload
): Promise<CallInteractionResponse> {
  // Validación de integridad de tiempo client-side (antes de enviar a DB)
  const start = new Date(payload.startTime);
  const end   = new Date(payload.endTime);

  if (isNaN(start.getTime())) {
    return { success: false, error: 'INVALID_TIME_RANGE' };
  }
  if (isNaN(end.getTime())) {
    return { success: false, error: 'INVALID_TIME_RANGE' };
  }
  if (end <= start) {
    return { success: false, error: 'INVALID_TIME_RANGE' };
  }

  const durationSec = (end.getTime() - start.getTime()) / 1000;
  if (durationSec < 1) {
    return { success: false, error: 'DURATION_TOO_SHORT' };
  }
  if (durationSec > 7200) {
    return { success: false, error: 'DURATION_TOO_LONG' };
  }

  if (!isCallResult(payload.result)) {
    return { success: false, error: 'DB_INSERT_FAILED' };
  }

  // INSERT en Supabase — el trigger BEFORE INSERT valida el dispositivo
  const { data: interaction, error: insertError } = await client
    .from('call_interactions')
    .insert({
      assignment_id:         payload.assignmentId,
      operator_id:           payload.operatorId,
      device_id:             payload.deviceId,
      start_time:            payload.startTime,
      end_time:              payload.endTime,
      result:                payload.result,
      idle_time_prior_call:  Math.max(0, Math.floor(payload.idleTimePriorCall)),
      notes:                 payload.notes?.slice(0, 1000) ?? null,
    })
    .select('id, duration_seconds')
    .single();

  if (insertError) {
    // Mapear errores de PostgreSQL a errores tipados del dominio
    const pgMsg = insertError.message.toLowerCase();
    if (pgMsg.includes('no está asignado al operador')) {
      return { success: false, error: 'DEVICE_NOT_ASSIGNED_TO_OPERATOR' };
    }
    if (pgMsg.includes('no está disponible')) {
      return { success: false, error: 'DEVICE_UNAVAILABLE' };
    }
    if (pgMsg.includes('no pertenece al operador')) {
      return { success: false, error: 'ASSIGNMENT_NOT_FOUND' };
    }
    return { success: false, error: 'DB_INSERT_FAILED' };
  }

  if (!interaction) {
    return { success: false, error: 'DB_INSERT_FAILED' };
  }

  // Buscar próxima asignación en la cola del operador
  const { data: nextAssignment } = await client
    .from('call_assignments')
    .select('*')
    .eq('operator_id', payload.operatorId)
    .eq('state', 'queued')
    .order('priority', { ascending: false })
    .order('assigned_at', { ascending: true })
    .limit(1)
    .single();

  return {
    success:          true,
    interactionId:    interaction.id,
    durationSeconds:  interaction.duration_seconds ?? Math.floor(durationSec),
    nextAssignment:   nextAssignment ?? null,
  };
}

// ─────────────────────────────────────────────
// OBTENER PRÓXIMA ASIGNACIÓN EN COLA
// ─────────────────────────────────────────────
export async function getNextCallAssignment(
  client:     SupabaseDB,
  operatorId: string
): Promise<CallAssignmentRow | null> {
  if (!operatorId || typeof operatorId !== 'string') return null;

  const { data } = await client
    .from('call_assignments')
    .select('*, call_campaigns!inner(title, daily_quota_per_operator, status)')
    .eq('operator_id', operatorId)
    .eq('state', 'queued')
    .eq('call_campaigns.status', 'active')
    .order('priority', { ascending: false })
    .order('assigned_at', { ascending: true })
    .limit(1)
    .single();

  return data ?? null;
}

// ─────────────────────────────────────────────
// OBTENER DISPOSITIVO ASIGNADO AL OPERADOR
// ─────────────────────────────────────────────
export async function getOperatorDevice(
  client:     SupabaseDB,
  operatorId: string
): Promise<CorporateDeviceRow | null> {
  if (!operatorId) return null;

  const { data } = await client
    .from('corporate_devices')
    .select('*')
    .eq('assigned_user_id', operatorId)
    .in('status', ['assigned', 'available'])
    .single();

  return data ?? null;
}

// ─────────────────────────────────────────────
// ESTADÍSTICAS DE LLAMADAS DEL DÍA
// ─────────────────────────────────────────────
export interface DailyCallStats {
  readonly total:              number;
  readonly effective:          number;
  readonly busy:               number;
  readonly no_answer:          number;
  readonly invalid:            number;
  readonly rejected:           number;
  readonly avg_duration_sec:   number;
  readonly avg_idle_time_sec:  number;
  readonly effective_rate_pct: number;
  readonly quota_progress_pct: number;
}

export async function getDailyCallStats(
  client:     SupabaseDB,
  operatorId: string,
  date:       string   // YYYY-MM-DD
): Promise<DailyCallStats> {
  const { data } = await client
    .from('call_interactions')
    .select('result, duration_seconds, idle_time_prior_call')
    .eq('operator_id', operatorId)
    .gte('created_at', `${date}T00:00:00Z`)
    .lte('created_at', `${date}T23:59:59Z`);

  const interactions = data ?? [];
  const total        = interactions.length;

  if (total === 0) {
    return {
      total:              0,
      effective:          0,
      busy:               0,
      no_answer:          0,
      invalid:            0,
      rejected:           0,
      avg_duration_sec:   0,
      avg_idle_time_sec:  0,
      effective_rate_pct: 0,
      quota_progress_pct: 0,
    };
  }

  const effective = interactions.filter(i => i.result === 'answered_effective').length;
  const busy      = interactions.filter(i => i.result === 'busy').length;
  const noAnswer  = interactions.filter(i => i.result === 'no_answer').length;
  const invalid   = interactions.filter(i => i.result === 'invalid_number').length;
  const rejected  = interactions.filter(i => i.result === 'rejected').length;

  const avgDuration = interactions.reduce((s, i) => s + (i.duration_seconds ?? 0), 0) / total;
  const avgIdle     = interactions.reduce((s, i) => s + (i.idle_time_prior_call ?? 0), 0) / total;

  return {
    total,
    effective,
    busy,
    no_answer:          noAnswer,
    invalid,
    rejected,
    avg_duration_sec:   Math.round(avgDuration),
    avg_idle_time_sec:  Math.round(avgIdle),
    effective_rate_pct: Math.round((effective / total) * 100 * 100) / 100,
    quota_progress_pct: Math.min(100, Math.round((total / 200) * 100)),
  };
}
```

---

## 7. API Route — Registro de Interacción

```typescript
// apps/calls-incidents/src/app/api/calls/log/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import type { Database } from '@intranet/database';
import { registerCallInteraction } from '@intranet/database/calls.sdk';
import { resolveAuthenticatedUser, requireRole } from '@intranet/auth';
import { CallInteractionInputSchema } from '@/lib/validators/call.validators';

export const runtime = 'edge';

export async function POST(request: NextRequest): Promise<NextResponse> {
  // 1. Verificar autenticación y rol
  const user = await resolveAuthenticatedUser(request);
  requireRole(user, ['multi_operator', 'supervisor', 'module_admin', 'superadmin'], 'POST /api/calls/log');

  // 2. Parsear y validar body
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Body JSON inválido o vacío' },
      { status: 400 }
    );
  }

  const validation = CallInteractionInputSchema.safeParse(rawBody);
  if (!validation.success) {
    return NextResponse.json(
      {
        error: 'Datos de llamada inválidos',
        fieldErrors: validation.error.flatten().fieldErrors,
      },
      { status: 422 }
    );
  }

  const input = validation.data;

  // 3. Verificar que el operatorId del payload coincide con el usuario autenticado
  //    (un operador no puede registrar llamadas de otro operador)
  if (input.operatorId !== user.id) {
    if (!user.roles.includes('supervisor') && !user.roles.includes('module_admin') && !user.roles.includes('superadmin')) {
      return NextResponse.json(
        { error: 'No puede registrar llamadas para otro operador' },
        { status: 403 }
      );
    }
  }

  // 4. Crear cliente Supabase con cookies de sesión
  const response = NextResponse.next();
  const client = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll:  () => request.cookies.getAll(),
        setAll:  (cookies) => cookies.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        ),
      },
    }
  );

  // 5. Registrar la interacción
  const result = await registerCallInteraction(client, {
    assignmentId:        input.assignmentId,
    operatorId:          input.operatorId,
    deviceId:            input.deviceId,
    startTime:           input.startTime,
    endTime:             input.endTime,
    result:              input.result,
    idleTimePriorCall:   input.idleTimePriorCall,
    notes:               input.notes ?? null,
  });

  if (!result.success) {
    const statusMap: Record<string, number> = {
      ASSIGNMENT_NOT_FOUND:          404,
      DEVICE_NOT_ASSIGNED_TO_OPERATOR: 403,
      DEVICE_UNAVAILABLE:            409,
      INVALID_TIME_RANGE:            422,
      DURATION_TOO_SHORT:            422,
      DURATION_TOO_LONG:             422,
      ASSIGNMENT_ALREADY_LOGGED:     409,
      OPERATOR_SESSION_MISMATCH:     403,
      DB_INSERT_FAILED:              500,
    };

    return NextResponse.json(
      { error: result.error },
      { status: statusMap[result.error] ?? 500 }
    );
  }

  return NextResponse.json(result, { status: 201 });
}
```

---

## 8. Validaciones en Tiempo de Ejecución

```typescript
// apps/calls-incidents/src/lib/validators/call.validators.ts
import { z } from 'zod';
import { CALL_RESULTS } from '@intranet/database/hardware.types';

// Validador de ISO 8601 con timezone
const ISO8601Schema = z
  .string()
  .datetime({ offset: true, message: 'Debe ser una fecha ISO 8601 con timezone (ej: 2026-11-05T14:30:00-04:00)' });

// UUID v4
const UUIDSchema = z
  .string()
  .uuid('Debe ser un UUID v4 válido');

// ─────────────────────────────────────────────
// ESQUEMA PRINCIPAL — INPUT DE LLAMADA
// ─────────────────────────────────────────────
export const CallInteractionInputSchema = z
  .object({
    assignmentId: UUIDSchema,
    operatorId:   UUIDSchema,
    deviceId:     UUIDSchema,

    startTime: ISO8601Schema,
    endTime:   ISO8601Schema,

    result: z.enum(CALL_RESULTS as unknown as [string, ...string[]], {
      errorMap: () => ({
        message: `resultado debe ser uno de: ${CALL_RESULTS.join(', ')}`,
      }),
    }),

    idleTimePriorCall: z
      .number()
      .int('idleTimePriorCall debe ser un entero')
      .min(0, 'idleTimePriorCall no puede ser negativo')
      .max(86400, 'idleTimePriorCall no puede superar 24 horas (86400 s)'),

    notes: z
      .string()
      .max(1000, 'Las notas no pueden superar 1000 caracteres')
      .nullable()
      .optional(),
  })
  .refine(
    (data) => {
      const start = new Date(data.startTime);
      const end   = new Date(data.endTime);
      return end > start;
    },
    {
      message: 'endTime debe ser posterior a startTime',
      path:    ['endTime'],
    }
  )
  .refine(
    (data) => {
      const start  = new Date(data.startTime);
      const end    = new Date(data.endTime);
      const durSec = (end.getTime() - start.getTime()) / 1000;
      return durSec >= 1;
    },
    {
      message: 'La duración mínima de una llamada es 1 segundo',
      path:    ['endTime'],
    }
  )
  .refine(
    (data) => {
      const start  = new Date(data.startTime);
      const end    = new Date(data.endTime);
      const durSec = (end.getTime() - start.getTime()) / 1000;
      return durSec <= 7200;
    },
    {
      message: 'La duración máxima de una llamada es 2 horas (7200 s)',
      path:    ['endTime'],
    }
  )
  .refine(
    (data) => {
      const start  = new Date(data.startTime);
      const now    = Date.now();
      const diffMs = now - start.getTime();
      // La llamada no puede haber iniciado hace más de 24 horas
      return diffMs <= 86400 * 1000 && diffMs >= -30000; // 30s de tolerancia futura
    },
    {
      message: 'startTime no puede ser mayor a 24 horas en el pasado ni en el futuro',
      path:    ['startTime'],
    }
  );

export type CallInteractionInput = z.infer<typeof CallInteractionInputSchema>;

// ─────────────────────────────────────────────
// ESQUEMA DE REGISTRO DE DISPOSITIVO
// ─────────────────────────────────────────────
export const DeviceRegistrationSchema = z.object({
  imei: z
    .string()
    .regex(/^\d{15}$/, 'El IMEI debe tener exactamente 15 dígitos numéricos')
    .refine((imei) => {
      // Validación del algoritmo de Luhn
      let sum = 0;
      for (let i = 0; i < 15; i++) {
        let d = parseInt(imei[i], 10);
        if (i % 2 !== 0) { d *= 2; if (d > 9) d -= 9; }
        sum += d;
      }
      return sum % 10 === 0;
    }, 'El IMEI no pasa la validación de Luhn (dígito verificador incorrecto)'),

  phone_number: z
    .string()
    .regex(
      /^\+?[0-9\s\-()]{7,20}$/,
      'Número de teléfono con formato inválido (aceptado: +58-416-1234567)'
    ),

  model: z
    .string()
    .min(3, 'Modelo demasiado corto')
    .max(100, 'Modelo demasiado largo')
    .refine(
      (model) => model.toLowerCase().includes('samsung'),
      'Solo se permiten terminales Samsung corporativos en esta flota'
    ),

  knox_enrollment_id: z
    .string()
    .regex(/^KE-[A-Z0-9]{8,32}$/, 'knox_enrollment_id debe seguir el formato KE-XXXXXXXX')
    .nullable()
    .optional(),

  battery_health_pct: z
    .number()
    .int()
    .min(0).max(100)
    .nullable()
    .optional(),
});

export type DeviceRegistrationInput = z.infer<typeof DeviceRegistrationSchema>;
```

---

## 9. Componente de Interfaz — Discador Guiado

```typescript
// apps/calls-incidents/src/components/guided-dialer/GuidedDialer.tsx
'use client';

import { useReducer, useEffect, useCallback, useRef } from 'react';
import { useRouter }  from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@intranet/database';
import {
  dialerReducer,
  initialDialerState,
  type DialerState,
} from '@/lib/dialer/state-machine';
import {
  getNextCallAssignment,
  getDailyCallStats,
  type DailyCallStats,
} from '@intranet/database/calls.sdk';
import { CALL_RESULT_LABELS } from '@intranet/database/hardware.types';
import type { CallResult } from '@intranet/database/hardware.types';

interface GuidedDialerProps {
  readonly operatorId:    string;
  readonly deviceId:      string;
  readonly campaignId:    string;
  readonly dailyQuota:    number;
}

export default function GuidedDialer({
  operatorId,
  deviceId,
  campaignId,
  dailyQuota,
}: GuidedDialerProps) {
  const [state, dispatch] = useReducer(dialerReducer, {
    ...initialDialerState,
    dailyQuota,
  });

  const idleTimerRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const callTimerRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const [elapsed,    setElapsed]    = useState(0);
  const [idleTime,   setIdleTime]   = useState(0);
  const [dailyStats, setDailyStats] = useState<DailyCallStats | null>(null);

  const client = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Cargar próxima asignación
  const loadNextAssignment = useCallback(async () => {
    dispatch({ type: 'NEXT_ASSIGNMENT' });
    const assignment = await getNextCallAssignment(client, operatorId);
    if (assignment) {
      dispatch({ type: 'ASSIGNMENT_LOADED', assignment });
    } else {
      dispatch({ type: 'ASSIGNMENT_LOADED', assignment: null as any });
    }
  }, [operatorId]);

  // Iniciar llamada — captura startTime
  const handleStartCall = useCallback(() => {
    const startTime = new Date().toISOString();
    dispatch({ type: 'START_CALL', startTime });
    setElapsed(0);
    // Iniciar contador de duración
    callTimerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
  }, []);

  // Finalizar llamada — captura endTime
  const handleEndCall = useCallback(() => {
    if (callTimerRef.current) clearInterval(callTimerRef.current);
    const endTime = new Date().toISOString();
    dispatch({ type: 'END_CALL', endTime });
  }, []);

  // Enviar log de interacción
  const handleSubmit = useCallback(async () => {
    if (!state.startTime || !state.endTime || !state.selectedResult || !state.assignment) return;
    dispatch({ type: 'SUBMIT_LOG' });

    try {
      const response = await fetch('/api/calls/log', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignmentId:       state.assignment.id,
          operatorId,
          deviceId,
          startTime:          state.startTime,
          endTime:            state.endTime,
          result:             state.selectedResult,
          idleTimePriorCall:  idleTime,
          notes:              state.notes || null,
        }),
      });

      if (!response.ok) {
        const err = await response.json() as { error: string };
        dispatch({ type: 'SAVE_ERROR', error: err.error as any });
        return;
      }

      const data = await response.json();
      dispatch({ type: 'SAVE_SUCCESS', response: data });

      // Reiniciar timer de idle
      setIdleTime(0);
      if (idleTimerRef.current) clearInterval(idleTimerRef.current);
      idleTimerRef.current = setInterval(() => setIdleTime(t => t + 1), 1000);

      // Recargar estadísticas del día
      const today = new Date().toISOString().split('T')[0];
      const stats = await getDailyCallStats(client, operatorId, today);
      setDailyStats(stats);

    } catch (err) {
      dispatch({ type: 'SAVE_ERROR', error: 'DB_INSERT_FAILED' });
    }
  }, [state, operatorId, deviceId, idleTime]);

  // Cargar asignación inicial
  useEffect(() => {
    loadNextAssignment();
    return () => {
      if (callTimerRef.current) clearInterval(callTimerRef.current);
      if (idleTimerRef.current) clearInterval(idleTimerRef.current);
    };
  }, []);

  // ─── RENDERIZADO ───
  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      {/* Cabecera de estadísticas del día */}
      {dailyStats && (
        <div className="grid grid-cols-3 gap-4 p-4 bg-gray-900 rounded-xl">
          <Stat label="Llamadas hoy"   value={`${dailyStats.total} / ${dailyQuota}`} />
          <Stat label="Efectividad"    value={`${dailyStats.effective_rate_pct}%`} color="green" />
          <Stat label="Tiempo muerto"  value={formatSeconds(dailyStats.avg_idle_time_sec)} color="amber" />
        </div>
      )}

      {/* Panel principal del discador */}
      <DialerPanel
        state={state}
        elapsed={elapsed}
        idleTime={idleTime}
        onStartCall={handleStartCall}
        onEndCall={handleEndCall}
        onSelectResult={(result: CallResult) => dispatch({ type: 'SELECT_RESULT', result })}
        onAddNote={(notes: string) => dispatch({ type: 'ADD_NOTE', notes })}
        onSubmit={handleSubmit}
        onRetry={() => dispatch({ type: 'RETRY' })}
        onNextAssignment={loadNextAssignment}
      />
    </div>
  );
}

// Componentes auxiliares de UI (simplificados por legibilidad)
function Stat({ label, value, color = 'white' }: { label: string; value: string; color?: string }) {
  return (
    <div className="text-center">
      <div className={`text-2xl font-bold text-${color}-400`}>{value}</div>
      <div className="text-xs text-gray-400">{label}</div>
    </div>
  );
}

function formatSeconds(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// Importación necesaria para useState (omitida en bloque superior para claridad)
import { useState } from 'react';

// DialerPanel es el componente interno que renderiza según el phase del estado
function DialerPanel(props: {
  state: DialerState;
  elapsed: number;
  idleTime: number;
  onStartCall: () => void;
  onEndCall: () => void;
  onSelectResult: (r: CallResult) => void;
  onAddNote: (n: string) => void;
  onSubmit: () => void;
  onRetry: () => void;
  onNextAssignment: () => void;
}) {
  const { state, elapsed, idleTime } = props;

  if (state.phase === 'LOADING_ASSIGNMENT') {
    return <div className="text-center py-8 text-gray-400 animate-pulse">Cargando próximo número...</div>;
  }

  if (state.phase === 'NO_MORE_ASSIGNMENTS' || state.phase === 'QUOTA_REACHED') {
    return (
      <div className="text-center py-8">
        <div className="text-2xl font-bold text-green-400 mb-2">
          {state.phase === 'QUOTA_REACHED' ? '🎯 ¡Cuota diaria completada!' : '✅ Sin más asignaciones'}
        </div>
        <p className="text-gray-400">Ha completado todas las asignaciones de esta campaña por hoy.</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-2xl p-6 space-y-4">
      {/* Número a llamar */}
      {state.assignment && (
        <div className="text-center">
          <div className="text-sm text-gray-400 mb-1">Número a llamar</div>
          <div className="text-4xl font-mono font-bold text-white tracking-widest">
            {state.assignment.customer_phone}
          </div>
          {state.assignment.customer_name && (
            <div className="text-sm text-gray-400 mt-1">{state.assignment.customer_name}</div>
          )}
        </div>
      )}

      {/* Tiempo de inactividad */}
      {state.phase === 'READY_TO_DIAL' && idleTime > 0 && (
        <div className={`text-center text-sm font-mono ${idleTime > 45 ? 'text-red-400' : 'text-amber-400'}`}>
          ⏱ Tiempo inactivo: {formatSeconds(idleTime)}
          {idleTime > 45 && ' — ¡Por favor inicie la próxima llamada!'}
        </div>
      )}

      {/* Timer de llamada en curso */}
      {(state.phase === 'CALL_INITIATED' || state.phase === 'CALL_IN_PROGRESS') && (
        <div className="text-center text-3xl font-mono font-bold text-green-400">
          🔴 {formatSeconds(elapsed)}
        </div>
      )}

      {/* Botones de acción */}
      <div className="flex flex-col gap-3">
        {state.phase === 'READY_TO_DIAL' && (
          <button
            onClick={props.onStartCall}
            className="w-full py-4 bg-green-600 hover:bg-green-500 text-white font-bold rounded-xl text-lg transition"
          >
            📞 INICIAR LLAMADA
          </button>
        )}

        {(state.phase === 'CALL_INITIATED' || state.phase === 'CALL_IN_PROGRESS') && (
          <button
            onClick={props.onEndCall}
            className="w-full py-4 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl text-lg transition"
          >
            ⏹ FINALIZAR LLAMADA
          </button>
        )}

        {state.phase === 'CALL_ENDED_LOGGING' && (
          <>
            <div className="grid grid-cols-1 gap-2">
              {(Object.entries(CALL_RESULT_LABELS) as [CallResult, string][]).map(([result, label]) => (
                <button
                  key={result}
                  onClick={() => props.onSelectResult(result)}
                  className={`py-3 px-4 rounded-xl border-2 text-left font-medium transition ${
                    state.selectedResult === result
                      ? 'border-blue-500 bg-blue-900 text-white'
                      : 'border-gray-600 bg-gray-700 text-gray-300 hover:border-gray-400'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <textarea
              placeholder="Notas adicionales (opcional, máx 1000 caracteres)..."
              className="w-full bg-gray-700 text-white rounded-xl p-3 text-sm resize-none h-20"
              maxLength={1000}
              value={state.notes}
              onChange={(e) => props.onAddNote(e.target.value)}
            />

            <button
              onClick={props.onSubmit}
              disabled={!state.selectedResult}
              className="w-full py-4 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold rounded-xl text-lg transition"
            >
              💾 GUARDAR REGISTRO
            </button>
          </>
        )}

        {state.phase === 'SAVING' && (
          <div className="text-center py-4 text-blue-400 animate-pulse">Guardando...</div>
        )}

        {state.phase === 'SAVED_IDLE' && (
          <button
            onClick={props.onNextAssignment}
            className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-lg transition"
          >
            ➡️ SIGUIENTE NÚMERO
          </button>
        )}

        {state.phase === 'ERROR' && (
          <div className="text-center space-y-3">
            <div className="text-red-400 font-semibold">
              Error: {state.errorCode ?? 'Error desconocido'}
            </div>
            <button
              onClick={props.onRetry}
              className="w-full py-3 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl transition"
            >
              🔄 REINTENTAR
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
```

---

## 10. Gestión de Dispositivos — DDL y SDK

```typescript
// packages/database/src/devices.sdk.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types/database.types';
import type { CorporateDeviceRow, CorporateDeviceInsert, DeviceStatus } from './types/hardware.types';
import { isDeviceStatus, isValidImei } from './types/hardware.types';

type SupabaseDB = SupabaseClient<Database>;

// ─────────────────────────────────────────────
// ASIGNAR DISPOSITIVO A OPERADOR
// ─────────────────────────────────────────────
export interface DeviceAssignmentResult {
  readonly success:  boolean;
  readonly device?:  CorporateDeviceRow;
  readonly error?:   string;
}

export async function assignDeviceToOperator(
  client:     SupabaseDB,
  deviceId:   string,
  operatorId: string,
  actorId:    string   // Quien realiza la asignación (supervisor/admin)
): Promise<DeviceAssignmentResult> {
  // Verificar que el dispositivo existe y está disponible
  const { data: device } = await client
    .from('corporate_devices')
    .select('*')
    .eq('id', deviceId)
    .eq('status', 'available')
    .single();

  if (!device) {
    return { success: false, error: 'Dispositivo no encontrado o no disponible' };
  }

  // Liberar cualquier asignación previa del operador (1 operador = 1 dispositivo)
  await client
    .from('corporate_devices')
    .update({ assigned_user_id: null, status: 'available' })
    .eq('assigned_user_id', operatorId);

  // Asignar el nuevo dispositivo
  const { data: updated, error } = await client
    .from('corporate_devices')
    .update({
      assigned_user_id: operatorId,
      status:           'assigned',
      last_seen_at:     new Date().toISOString(),
    })
    .eq('id', deviceId)
    .select('*')
    .single();

  if (error || !updated) {
    return { success: false, error: error?.message ?? 'Error al asignar dispositivo' };
  }

  return { success: true, device: updated };
}

// ─────────────────────────────────────────────
// REGISTRAR NUEVO DISPOSITIVO SAMSUNG
// ─────────────────────────────────────────────
export async function registerSamsungDevice(
  client: SupabaseDB,
  input:  CorporateDeviceInsert
): Promise<{ success: boolean; device?: CorporateDeviceRow; error?: string }> {
  // Validar IMEI con algoritmo de Luhn
  if (!input.imei || !isValidImei(input.imei)) {
    return { success: false, error: 'IMEI inválido (falla en validación de Luhn)' };
  }

  // Verificar que el modelo es Samsung
  if (!input.model.toLowerCase().includes('samsung')) {
    return { success: false, error: 'Solo se permiten terminales Samsung corporativos' };
  }

  const { data, error } = await client
    .from('corporate_devices')
    .insert({
      ...input,
      status:     'available',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select('*')
    .single();

  if (error) {
    if (error.message.includes('unique') || error.message.includes('duplicate')) {
      return { success: false, error: 'Ya existe un dispositivo con ese IMEI' };
    }
    return { success: false, error: error.message };
  }

  return { success: true, device: data ?? undefined };
}

// ─────────────────────────────────────────────
// ACTUALIZAR ESTADO DE DISPOSITIVO
// ─────────────────────────────────────────────
export async function updateDeviceStatus(
  client:   SupabaseDB,
  deviceId: string,
  status:   DeviceStatus,
  notes?:   string
): Promise<{ success: boolean; error?: string }> {
  if (!isDeviceStatus(status)) {
    return { success: false, error: `Estado de dispositivo inválido: ${status}` };
  }

  const updatePayload: Partial<CorporateDeviceRow> = { status };
  if (notes) updatePayload.notes = notes.slice(0, 500);
  if (status === 'available') updatePayload.assigned_user_id = null;

  const { error } = await client
    .from('corporate_devices')
    .update(updatePayload)
    .eq('id', deviceId);

  if (error) return { success: false, error: error.message };
  return { success: true };
}
```

---

## 11. Métricas de Latencia entre Llamadas

```sql
-- ============================================================
-- VISTA: v_operator_idle_metrics
-- Calcula tiempos muertos entre llamadas consecutivas
-- Utilizada para el score de "Latencia entre asignaciones"
-- ============================================================
CREATE OR REPLACE VIEW public.v_operator_idle_metrics AS
SELECT
    ci.operator_id,
    ci.created_at::DATE                   AS work_date,
    COUNT(*)                              AS total_calls,
    AVG(ci.idle_time_prior_call)::INT     AS avg_idle_sec,
    MAX(ci.idle_time_prior_call)          AS max_idle_sec,
    MIN(ci.idle_time_prior_call)          AS min_idle_sec,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ci.idle_time_prior_call)::INT
                                          AS median_idle_sec,
    COUNT(*) FILTER (WHERE ci.idle_time_prior_call > 45)
                                          AS calls_with_excessive_idle,
    ROUND(
      COUNT(*) FILTER (WHERE ci.idle_time_prior_call <= 45)::NUMERIC
      / NULLIF(COUNT(*), 0)::NUMERIC * 100,
      2
    )                                     AS compliance_rate_pct
FROM public.call_interactions ci
WHERE ci.created_at >= (now() - INTERVAL '30 days')
GROUP BY ci.operator_id, ci.created_at::DATE;

-- Vista de rendimiento diario combinado
CREATE OR REPLACE VIEW public.v_daily_call_performance AS
SELECT
    ci.operator_id,
    p.full_name                                       AS operator_name,
    ci.created_at::DATE                               AS work_date,
    COUNT(*)                                          AS total_calls,
    COUNT(*) FILTER (WHERE ci.result = 'answered_effective')
                                                      AS effective_calls,
    ROUND(
      COUNT(*) FILTER (WHERE ci.result = 'answered_effective')::NUMERIC
      / NULLIF(COUNT(*), 0)::NUMERIC * 100, 2
    )                                                 AS effective_rate_pct,
    AVG(ci.duration_seconds)::INT                     AS avg_duration_sec,
    AVG(ci.idle_time_prior_call)::INT                 AS avg_idle_sec,
    -- Comparar con cuota del día
    COALESCE(
      (SELECT daily_quota_per_operator FROM public.call_campaigns cc
       JOIN public.call_assignments ca ON ca.campaign_id = cc.id
       WHERE ca.id = (SELECT assignment_id FROM public.call_interactions
                      WHERE operator_id = ci.operator_id
                      ORDER BY created_at LIMIT 1)
       LIMIT 1),
      200
    )                                                 AS daily_quota,
    COUNT(*) >= COALESCE(
      (SELECT daily_quota_per_operator FROM public.call_campaigns cc
       JOIN public.call_assignments ca ON ca.campaign_id = cc.id
       WHERE ca.id = (SELECT assignment_id FROM public.call_interactions
                      WHERE operator_id = ci.operator_id
                      ORDER BY created_at LIMIT 1)
       LIMIT 1),
      200
    )                                                 AS quota_met
FROM public.call_interactions ci
JOIN public.profiles p ON p.id = ci.operator_id
WHERE ci.created_at >= (now() - INTERVAL '30 days')
GROUP BY ci.operator_id, p.full_name, ci.created_at::DATE;
```

---

## 12. Fingerprinting y Anti-Fraude de Dispositivo

```typescript
// apps/calls-incidents/src/lib/device/fingerprint.ts
// Genera y valida la huella digital del terminal Samsung

export interface DeviceFingerprintResult {
  readonly hash:     string;
  readonly metadata: Record<string, string>;
  readonly isValid:  boolean;
}

/**
 * Genera una huella digital del dispositivo basada en características
 * disponibles en el navegador web de Android.
 * No requiere acceso Knox — compatible con Samsung Internet Browser.
 */
export async function generateDeviceFingerprint(): Promise<DeviceFingerprintResult> {
  const ua = navigator.userAgent;

  // Extraer modelo Samsung del UserAgent
  // Formato típico: "... Samsung Galaxy A15 Build/..."
  const samsungModelMatch = ua.match(/Samsung[- ]([A-Za-z0-9 ]+?)(?:\sBuild|\))/i);
  const modelHint = samsungModelMatch?.[1]?.trim() ?? 'Unknown Samsung';

  const metadata: Record<string, string> = {
    userAgent:        ua,
    model:            modelHint,
    platform:         navigator.platform ?? 'Android',
    language:         navigator.language,
    screenWidth:      String(screen.width),
    screenHeight:     String(screen.height),
    colorDepth:       String(screen.colorDepth),
    pixelRatio:       String(window.devicePixelRatio),
    timezone:         Intl.DateTimeFormat().resolvedOptions().timeZone,
    touchPoints:      String(navigator.maxTouchPoints),
    hardwareConcurrency: String(navigator.hardwareConcurrency ?? 0),
  };

  // Serializar para hash
  const fingerStr = Object.values(metadata).join('|');

  // Calcular SHA-256 en el navegador (Web Crypto API)
  let hash = 'unsupported';
  try {
    const encoder  = new TextEncoder();
    const data     = encoder.encode(fingerStr);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray  = Array.from(new Uint8Array(hashBuffer));
    hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch {
    // Fallback: hash simple sin WebCrypto (no debería ocurrir en Android moderno)
    hash = btoa(fingerStr).slice(0, 64);
  }

  // Validar que el UA indica que es un dispositivo Samsung real
  const isSamsung = ua.toLowerCase().includes('samsung') || ua.includes('SM-');

  return {
    hash,
    metadata,
    isValid: isSamsung,
  };
}

/**
 * Verifica si el hash del dispositivo actual coincide con el registrado en DB.
 * Esta verificación es ADICIONAL a la validación de RLS en Supabase.
 */
export async function verifyDeviceFingerprint(
  registeredHash: string
): Promise<{ matches: boolean; currentHash: string }> {
  const { hash: currentHash } = await generateDeviceFingerprint();
  return {
    matches:     currentHash === registeredHash,
    currentHash,
  };
}
```

---

## 13. Troubleshooting y Códigos de Error

| Código de Error | Causa Probable | Solución |
|-----------------|---------------|----------|
| `DEVICE_NOT_ASSIGNED_TO_OPERATOR` | El terminal Samsung seleccionado está asignado a otro operador | Pedir al supervisor reasignar el dispositivo |
| `DEVICE_UNAVAILABLE` | El dispositivo está en mantenimiento, perdido o dado de baja | Solicitar al module_admin otro terminal |
| `ASSIGNMENT_NOT_FOUND` | La asignación no existe o ya fue completada | Recargar la página para obtener la próxima asignación válida |
| `INVALID_TIME_RANGE` | `endTime` es igual o anterior a `startTime` | Verificar que el operador presionó "Iniciar" antes de "Finalizar" |
| `DURATION_TOO_SHORT` | La llamada duró menos de 1 segundo | Indica que el operador presionó "Iniciar" y "Finalizar" sin hacer la llamada |
| `DURATION_TOO_LONG` | La llamada duró más de 2 horas | Verificar si el operador olvidó presionar "Finalizar". Ajustar `endTime` manualmente con supervisión |
| `ASSIGNMENT_ALREADY_LOGGED` | Duplicado: ya se registró una interacción para esta asignación | Error de doble submit — ignorar, ya quedó guardado |
| `OPERATOR_SESSION_MISMATCH` | El `operatorId` del payload no coincide con el JWT de sesión | Cerrar sesión e ingresar de nuevo |
| `DB_INSERT_FAILED` | Error genérico de base de datos | Verificar conectividad. Si persiste, contactar al equipo técnico |

> [!IMPORTANT]
> En ausencia de integración PBX, la validación de duración real de llamada depende **exclusivamente** de la honestidad del operador al presionar "Iniciar" y "Finalizar". El sistema de scoring penaliza duraciones sospechosamente cortas (< 15 segundos) como "llamadas flash" que no generan contacto real, aplicando un factor de peso reducido sobre la métrica de `effective_calls`.

> [!TIP]
> Para detectar patrones fraudulentos, el módulo de auditoría ejecuta diariamente una consulta que identifica operadores con más del 30% de sus llamadas con `duration_seconds < 15`, generando una alerta automática en el panel del supervisor.

> [!NOTE]
> La integración con Samsung Knox (`knox_enrollment_id`) es **opcional** en la versión actual. Si el dispositivo está enrolado en Knox, se puede enriquecer el fingerprinting con datos MDM más precisos (IMEI verificado, versión de firmware). Sin Knox, se utiliza el fingerprinting basado en WebCrypto API descrito en la sección 12.

