# Arquitectura Técnica Integral: Briana Remote Dialer & Telemetría SIM (PC ↔ Samsung Galaxy A57/A37)

**Proyecto:** NEXUS SYSTEM — Módulo BRIANA  
**Versión de Diseño:** 1.0 (Etapa 1 — Arquitectura y Diseño)  
**Stack:** Next.js 14 (Vercel) · Supabase (PostgreSQL 15 + RLS + Realtime) · Android Nativo (Kotlin + Jetpack Compose + `android.telecom`)  
**Flota Objetivo:** 10–12 dispositivos Samsung Galaxy A57 / A37 con SIM física y saldo propio (0 costo VoIP).

---

## 1. Arquitectura Técnica Integral

### 1.1 Topología de Comunicación en Tiempo Real

```
┌──────────────────────────────┐        HTTPS / REST        ┌──────────────────────────────────┐
│   PC OPERADOR / ADMIN        │ ─────────────────────────▶ │   NEXT.JS (VERCEL API ROUTES)    │
│   Briana Web UI (React)      │ ◀───────────────────────── │   Auth SSO · Cola · Cierre       │
└──────────────┬───────────────┘                            └────────────────┬─────────────────┘
               │                                                             │
               │ Supabase Realtime (WSS)                                     │ Service Role / RLS
               │ - Canal: session:{session_id}                               ▼
               │ - Postgres Changes (call_logs,             ┌──────────────────────────────────┐
               │   contacts_queue, operator_sessions)       │      SUPABASE POSTGRESQL 15      │
               ▼                                            │  devices · operator_sessions     │
┌──────────────────────────────────────────────┐            │  contacts_queue · call_logs      │
│          SUPABASE REALTIME ENGINE            │ ◀────────▶ │  call_schedules · call_commands  │
│  Broadcast (Baja latencia <150ms) + WAL CDC  │            └──────────────────────────────────┘
└──────────────────────┬───────────────────────┘
                       │ WebSocket Persistente (WSS) + Heartbeat 20s
                       │ (+ Respaldo Room Outbox Queue offline/retry)
                       ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│                      SAMSUNG GALAXY A57 / A37 — APK NATIVA (KOTLIN)                          │
│  ┌────────────────────────────┐   ┌───────────────────────────┐   ┌───────────────────────┐  │
│  │  BrianaForegroundService   │◀─▶│   BrianaInCallService     │◀─▶│  Android Telecom API  │  │
│  │  (phoneCall + connectedDev)│   │   (Call.Callback + Timer) │   │  (SIM Física / Móvil) │  │
│  └──────────────┬─────────────┘   └───────────────────────────┘   └───────────────────────┘  │
│                 ▼                                                                            │
│  ┌────────────────────────────┐   ┌───────────────────────────┐                              │
│  │  Room Local Outbox (SQLite)│   │  Jetpack Compose UI       │                              │
│  │  Reintento automático HTTP │   │  (PIN BRN-XXXX + Turno)   │                              │
│  └────────────────────────────┘   └───────────────────────────┘                              │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Flujo de Estados de Llamada (PC ↔ Supabase ↔ Samsung SIM)

```
[PC: Cola asigna contacto] ──(Operador pulsa "Llamar" en PC o APK)──▶ [call_commands: DIAL]
                                                                            │
   ┌────────────────────────────────────────────────────────────────────────┘
   ▼
[APK: TelecomManager.placeCall(tel:+58...)] ──▶ Estado: DIALING / RINGING
   │                                            (is_connected = false, active_at = NULL)
   │
   ├──(Cuelga antes de contestar / Rechazo / Ocupado / Sin Respuesta)
   │      └──▶ DISCONNECTED (sin pasar por ACTIVE)
   │           • is_connected = false, talk_duration_seconds = 0
   │           • ended_by = operator_pc | operator_phone | network_or_no_answer
   │           • Auto-registro en call_logs como 'no_efectiva' + attempt_count++
   │           • PC avanza directo al siguiente contacto (sin modal bloqueante)
   │
   └──(Destinatario o Buzón contesta)
          └──▶ ACTIVE (active_at = NOW(), inicia cronómetro real)
                 │
                 ▼ (Operador cuelga desde PC, desde Teléfono o cuelga el ciudadano)
               DISCONNECTED
                 • is_connected = true
                 • talk_duration_seconds = FLOOR(disconnected_at - active_at)
                 • ended_by = operator_pc | operator_phone | remote_party
                 • PC abre MODAL OBLIGATORIO DE CIERRE:
                     1. Efectiva (+ notas)
                     2. No efectiva / Buzón de voz / Cortada
                     3. Reprogramar llamada (fecha/hora exacta -> call_schedules)
                     4. Número equivocado / No pertenece al titular (marca inválido)
```

### 1.3 Garantía de Cero Pérdida de Eventos con Pantalla Apagada (OneUI / Doze)

1. **`ForegroundService` Dual (`foregroundServiceType="phoneCall|dataSync"`):** Mantiene el proceso vivo con notificación persistente visible mientras el **"Modo Turno Operador"** esté activo.
2. **`PowerManager.PARTIAL_WAKE_LOCK`:** Adquirido exclusivamente durante una llamada activa o comando de marcación pendiente para evitar que el CPU entre en suspensión profunda mientras la pantalla está bloqueada.
3. **WebSocket + Heartbeat cada 20s:** El `SupabaseRealtimeManager` envía pings periódicos; si detecta caída de red (cambio 4G/Wi-Fi), reconecta con *backoff* exponencial (1s, 2s, 4s, 8s) y consulta comandos pendientes (`status = 'pending'`) en `call_commands` para no perder ninguna orden.
4. **Patrón Outbox en Room (SQLite local):** Toda transición crítica (`ACTIVE`, `DISCONNECTED`, `ended_by`, `talk_duration_seconds`) se persiste primero en Room y un `WorkManager` / corrutina la envía por HTTPS a `/api/briana/telemetry` hasta recibir `200 OK` (idempotente por `call_uuid`).

---

## 2. Esquema SQL Completo para Supabase (PostgreSQL 15 + RLS)

> Diseñado para integrarse limpiamente con `public.profiles`, `public.user_roles` y `public.call_campaigns` ya existentes en Nexus-System.

```sql
-- ============================================================================
-- MIGRACIÓN: Briana Remote Dialer & SIM Telemetry
-- Compatible con Nexus-System (Supabase PostgreSQL 15 + Realtime + RLS)
-- ============================================================================

-- 1. ENUMS DE DOMINIO
DO $$ BEGIN
    CREATE TYPE public.briana_device_status AS ENUM ('available', 'in_shift', 'offline', 'maintenance');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE public.briana_queue_status AS ENUM (
        'pending',          -- Disponible en cola
        'assigned',         -- Asignado en pantalla a un operador
        'in_call',          -- Llamada en curso
        'rescheduled',      -- Reprogramado para fecha/hora específica
        'completed_effective', -- Contacto efectivo cerrado
        'exhausted',        -- Agotó máximo de reintentos sin éxito
        'invalid_number'    -- Número equivocado / no pertenece al titular
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
    device_uid          TEXT UNIQUE NOT NULL, -- Android ID / Hardware Fingerprint
    model               TEXT NOT NULL,        -- ej. "Samsung Galaxy A57", "Samsung Galaxy A37"
    sim_phone_number    TEXT,
    carrier_name        TEXT,
    pairing_pin         TEXT UNIQUE NOT NULL, -- ej. "BRN-4829"
    pin_expires_at      TIMESTAMPTZ NOT NULL,
    status              public.briana_device_status NOT NULL DEFAULT 'available',
    battery_pct         INT CHECK (battery_pct BETWEEN 0 AND 100),
    network_type        TEXT,                 -- 'WIFI', '4G', '5G'
    app_version         TEXT,
    is_default_dialer   BOOLEAN NOT NULL DEFAULT false,
    last_heartbeat_at   TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_devices_pairing_pin ON public.devices(pairing_pin);
CREATE INDEX IF NOT EXISTS idx_devices_status ON public.devices(status);

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

-- Garantiza que un dispositivo y un operador tengan a lo sumo 1 sesión activa simultánea
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_session_device
    ON public.operator_sessions(device_id) WHERE is_active = true;
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_session_operator
    ON public.operator_sessions(operator_id) WHERE is_active = true;

-- 4. TABLA: contacts_queue (Cola de contactos con control de reintentos y lock)
CREATE TABLE IF NOT EXISTS public.contacts_queue (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id         UUID NOT NULL REFERENCES public.call_campaigns(id) ON DELETE CASCADE,
    full_name           TEXT NOT NULL,
    phone_number        TEXT NOT NULL,
    document_id         TEXT,
    metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
    status              public.briana_queue_status NOT NULL DEFAULT 'pending',
    priority            INT NOT NULL DEFAULT 0,
    attempt_count       INT NOT NULL DEFAULT 0,
    max_attempts        INT NOT NULL DEFAULT 5,
    assigned_operator_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    locked_until        TIMESTAMPTZ,
    next_retry_at       TIMESTAMPTZ,
    last_attempt_at     TIMESTAMPTZ,
    last_outcome        public.briana_call_outcome,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_queue_campaign_status ON public.contacts_queue(campaign_id, status, priority DESC, next_retry_at);
CREATE INDEX IF NOT EXISTS idx_queue_assigned_operator ON public.contacts_queue(assigned_operator_id, status);
CREATE INDEX IF NOT EXISTS idx_queue_phone ON public.contacts_queue(phone_number);

-- 5. TABLA: call_logs (Telemetría exacta de cada intento de llamada)
CREATE TABLE IF NOT EXISTS public.call_logs (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    call_uuid               UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(), -- Idempotencia APK
    session_id              UUID NOT NULL REFERENCES public.operator_sessions(id) ON DELETE CASCADE,
    contact_id              UUID NOT NULL REFERENCES public.contacts_queue(id) ON DELETE CASCADE,
    campaign_id             UUID NOT NULL REFERENCES public.call_campaigns(id) ON DELETE CASCADE,
    operator_id             UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    device_id               UUID NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
    attempt_number          INT NOT NULL CHECK (attempt_number >= 1),
    initiated_from          public.briana_initiated_from NOT NULL,
    ended_by                public.briana_ended_by,
    is_connected            BOOLEAN NOT NULL DEFAULT false, -- true solo si entró a Telecom STATE_ACTIVE
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

-- 7. TABLA: call_commands (Cola de comandos PC -> APK con acuse de recibo)
CREATE TABLE IF NOT EXISTS public.call_commands (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id          UUID NOT NULL REFERENCES public.operator_sessions(id) ON DELETE CASCADE,
    device_id           UUID NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
    contact_id          UUID REFERENCES public.contacts_queue(id) ON DELETE SET NULL,
    call_uuid           UUID NOT NULL,
    command_type        TEXT NOT NULL CHECK (command_type IN ('DIAL', 'HANGUP', 'END_SHIFT')),
    payload             JSONB NOT NULL DEFAULT '{}'::jsonb, -- { "phone_number": "...", "contact_name": "..." }
    status              TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'acked', 'executed', 'expired', 'failed')),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    acked_at            TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_commands_device_pending
    ON public.call_commands(device_id, status, created_at) WHERE status = 'pending';

-- 8. REALTIME PUBLICATION
ALTER PUBLICATION supabase_realtime ADD TABLE public.devices;
ALTER PUBLICATION supabase_realtime ADD TABLE public.operator_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.contacts_queue;
ALTER PUBLICATION supabase_realtime ADD TABLE public.call_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.call_schedules;
ALTER PUBLICATION supabase_realtime ADD TABLE public.call_commands;

-- 9. ROW LEVEL SECURITY (RLS) COMPATIBLE CON NEXUS-SYSTEM
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operator_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_commands ENABLE ROW LEVEL SECURITY;

-- Helper de roles administrativos de Nexus
CREATE OR REPLACE FUNCTION public.fn_is_briana_supervisor_or_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_roles ur
        JOIN public.roles r ON r.id = ur.role_id
        WHERE ur.user_id = auth.uid()
          AND r.name IN ('fundador_dev', 'superadmin', 'admin', 'module_admin', 'coordinador_general', 'coordinador', 'supervisor')
    );
$$;

-- Políticas para operator_sessions: el operador ve/gestiona su propia sesión; supervisores/admins ven todas
CREATE POLICY "sessions_select_own_or_admin" ON public.operator_sessions
    FOR SELECT USING (operator_id = auth.uid() OR public.fn_is_briana_supervisor_or_admin());

CREATE POLICY "sessions_insert_own" ON public.operator_sessions
    FOR INSERT WITH CHECK (operator_id = auth.uid() OR public.fn_is_briana_supervisor_or_admin());

CREATE POLICY "sessions_update_own_or_admin" ON public.operator_sessions
    FOR UPDATE USING (operator_id = auth.uid() OR public.fn_is_briana_supervisor_or_admin());

-- Políticas para contacts_queue: operador ve los asignados a él; supervisores/admins ven toda la cola
CREATE POLICY "queue_select_assigned_or_admin" ON public.contacts_queue
    FOR SELECT USING (assigned_operator_id = auth.uid() OR public.fn_is_briana_supervisor_or_admin());

CREATE POLICY "queue_update_assigned_or_admin" ON public.contacts_queue
    FOR UPDATE USING (assigned_operator_id = auth.uid() OR public.fn_is_briana_supervisor_or_admin());

-- Políticas para call_logs: operador inserta/lee sus propios logs; supervisores/admins ven todos
CREATE POLICY "call_logs_select_own_or_admin" ON public.call_logs
    FOR SELECT USING (operator_id = auth.uid() OR public.fn_is_briana_supervisor_or_admin());

CREATE POLICY "call_logs_insert_own" ON public.call_logs
    FOR INSERT WITH CHECK (operator_id = auth.uid() OR public.fn_is_briana_supervisor_or_admin());

-- Políticas para call_schedules y call_commands
CREATE POLICY "schedules_own_or_admin" ON public.call_schedules
    FOR ALL USING (operator_id = auth.uid() OR public.fn_is_briana_supervisor_or_admin());

CREATE POLICY "commands_via_session_or_admin" ON public.call_commands
    FOR ALL USING (
        public.fn_is_briana_supervisor_or_admin()
        OR EXISTS (
            SELECT 1 FROM public.operator_sessions s
            WHERE s.id = call_commands.session_id AND s.operator_id = auth.uid()
        )
    );
```

### 2.1 Consultas SQL clave para el Dashboard Administrativo

```sql
-- A. Métricas Globales por Campaña
SELECT
    COUNT(*) AS total_contactos,
    COUNT(*) FILTER (WHERE attempt_count > 0) AS total_llamados,
    COUNT(*) FILTER (WHERE status IN ('pending', 'assigned', 'rescheduled')) AS pendientes,
    COUNT(*) FILTER (WHERE status = 'completed_effective') AS efectivos,
    COUNT(*) FILTER (WHERE status = 'invalid_number') AS invalidos,
    COUNT(*) FILTER (WHERE status = 'rescheduled') AS reprogramados,
    ROUND(
        100.0 * COUNT(*) FILTER (WHERE status = 'completed_effective')
        / NULLIF(COUNT(*) FILTER (WHERE attempt_count > 0), 0),
        2
    ) AS pct_efectividad
FROM public.contacts_queue
WHERE campaign_id = :campaign_id;

-- B. Análisis de Persistencia (Contactos efectivos tras X intentos)
SELECT
    CASE
        WHEN cl.attempt_number = 1 THEN '1er intento'
        WHEN cl.attempt_number = 2 THEN '2do intento'
        WHEN cl.attempt_number = 3 THEN '3er intento'
        ELSE '4to+ intento'
    END AS rango_intento,
    COUNT(*) AS total_efectivos
FROM public.call_logs cl
WHERE cl.campaign_id = :campaign_id
  AND cl.is_effective = true
GROUP BY 1
ORDER BY MIN(cl.attempt_number);
```

---

## 3. Diseño de la APK Android (Kotlin + Jetpack Compose + Telecom API)

### 3.1 Estructura de Paquetes (`com.nexus.briana.dialer`)

```text
app/src/main/java/com/nexus/briana/dialer/
├── BrianaApp.kt
├── data/
│   ├── local/
│   │   ├── BrianaDatabase.kt         # Room DB
│   │   └── PendingTelemetryDao.kt    # Outbox offline para eventos de llamada
│   ├── remote/
│   │   ├── SupabaseRealtimeClient.kt # Suscripción WSS a call_commands + heartbeat
│   │   └── NexusApiService.kt        # Retrofit/Ktor -> /api/briana/...
│   └── model/
│       └── CallTelemetryModels.kt    # CallCommand, CallStateEvent, DeviceHeartbeat
├── telecom/
│   ├── BrianaInCallService.kt        # Extends android.telecom.InCallService
│   ├── CallStateTracker.kt           # Máquina de estados + detección ACTIVE vs no conectado
│   └── TelecomCommandExecutor.kt     # TelecomManager.placeCall() + Call.disconnect()
├── service/
│   ├── BrianaForegroundService.kt    # Mantiene conexión en 2do plano + WakeLock parcial
│   └── BootReceiver.kt               # Reanuda servicio si hubo turno activo tras reinicio
└── ui/
    ├── pairing/PairingScreen.kt      # Muestra PIN único (BRN-XXXX), batería, red y botón Modo Turno
    └── incall/ActiveCallScreen.kt    # Pantalla de llamada en curso (Colgar + Marcador Buzón)
```

### 3.2 Lógica Crítica del `InCallService` y `Call.Callback`

- **`BrianaInCallService : InCallService()`** solo intercepta y controla llamadas cuando `ShiftPreferences.isShiftActive == true`.
- Al recibir `onCallAdded(call: Call)`:
  1. Se registra un `Call.Callback` sobre la instancia `call`.
  2. Se mantiene una bandera `var wasEverActive = false` y `var activeTimestampMs: Long? = null`.
  3. **`onStateChanged(call, state)`**:
     - `Call.STATE_DIALING` / `Call.STATE_RINGING`: Emite evento `ringing_at` a Supabase.
     - `Call.STATE_ACTIVE`: Marca `wasEverActive = true`, `activeTimestampMs = System.currentTimeMillis()`. Arranca cronómetro real de conversación.
     - `Call.STATE_DISCONNECTED`:
       - Calcula `talkDurationSec = if (wasEverActive && activeTimestampMs != null) ((now - activeTimestampMs) / 1000).toInt() else 0`.
       - Determina **`ended_by`**:
         - Si el comando vino de PC (`pendingHangupFromPc == true`) → `operator_pc`.
         - Si el operador pulsó Colgar en la UI del Samsung → `operator_phone`.
         - Si `call.details.disconnectCause.code == DisconnectCause.REMOTE` y `wasEverActive` → `remote_party`.
         - En otro caso (`BUSY`, `NO_ANSWER`, `REJECTED`, `ERROR`, `CANCELED`) → `network_or_no_answer`.
       - Encola el evento en `Room` y lo envía inmediatamente a Nexus-System.
- **Inicio de llamada desde PC:** Al recibir comando `DIAL` con `phone_number`, `TelecomCommandExecutor` invoca `telecomManager.placeCall(Uri.fromParts("tel", phoneNumber, null), extras)` marcando `initiated_from = "pc_web"`.
- **Corte remoto desde PC:** Al recibir comando `HANGUP`, invoca `activeCall?.disconnect()`, seteando `pendingHangupFromPc = true`.

### 3.3 Modo Turno Operador (Uso Dual del Samsung) y Permisos OneUI

1. **Activar Modo Turno:**
   - En Android 10+ (Samsung A57/A37 con Android 14/15), se solicita `RoleManager.ROLE_DIALER` mediante `roleManager.createRequestRoleIntent(RoleManager.ROLE_DIALER)`. Esto habilita `InCallService` sin necesidad de root ni Knox MDM pago.
   - Se inicia `BrianaForegroundService` y se genera/muestra el PIN de vinculación (`BRN-XXXX`).
2. **Desactivar Modo Turno (Fin de Jornada):**
   - Libera la sesión en `operator_sessions` (`is_active = false`), detiene el `ForegroundService` y ofrece un acceso rápido a **"Restaurar Teléfono Samsung predeterminado"** en Ajustes -> Aplicaciones predeterminadas, dejando el teléfono 100% normal.
3. **Blindaje OneUI (Samsung Galaxy A57 / A37):**
   - Solicitar `ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` para evitar que Samsung *Adaptive Battery* duerma el WebSocket.
   - Permisos en `AndroidManifest.xml`: `CALL_PHONE`, `READ_PHONE_STATE`, `MANAGE_OWN_CALLS`, `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_PHONE_CALL`, `POST_NOTIFICATIONS`, `WAKE_LOCK`, `INTERNET`.

---

## 4. Plan de Implementación por Fases

| Fase | Alcance | Entregables Principales |
| :--- | :--- | :--- |
| **Fase 1** | **Base de Datos & Realtime en Nexus-System** | Migración SQL (`devices`, `operator_sessions`, `contacts_queue`, `call_logs`, `call_schedules`, `call_commands`), políticas RLS, publicación Realtime y API Routes (`/api/briana/pairing`, `/api/briana/dial`, `/api/briana/hangup`, `/api/briana/telemetry`, `/api/briana/disposition`). |
| **Fase 2** | **APK Android (Kotlin + Jetpack Compose)** | Proyecto Android Studio completo: pantalla de PIN + telemetría, `BrianaForegroundService`, `SupabaseRealtimeClient`, `BrianaInCallService` con detección exacta `ACTIVE` vs no conectado, Room outbox y guía de permisos OneUI. |
| **Fase 3** | **UI Operador & Modales en Briana (Next.js)** | Pantalla de vinculación por PIN `BRN-XXXX`, cola automática de contactos, botón bidireccional Llamar/Colgar sincronizado en vivo, auto-registro de fallidas y modal obligatorio post-llamada (Efectiva / Buzón / Reprogramar fecha-hora / Número equivocado). |
| **Fase 4** | **Dashboard Administrativo en Tiempo Real** | Tablero en vivo con métricas globales, % de efectividad, trazabilidad por contacto e intento, análisis de persistencia (1er/2do/3er/+4to intento), cola de reprogramados y auditoría de números inválidos. |
