# Database Lifecycle — Particionamiento, Agregaciones Diarias y Purga de Logs

> **Documento:** `database-lifecycle.md`  
> **Versión:** 2.0.0  
> **Fecha:** 2026-11-05  
> **Autor:** Arquitectura NEXUS SYSTEM  
> **Stack:** PostgreSQL 15 (Supabase Free Tier 500 MB) · Deno Edge Functions · TypeScript 5.3 strict

---

## Tabla de Contenidos

1. [Restricciones del Supabase Free Tier](#1-restricciones-del-supabase-free-tier)
2. [Estrategia de Particionamiento por Rango Temporal](#2-estrategia-de-particionamiento-por-rango-temporal)
3. [Tabla de Agregados Diarios](#3-tabla-de-agregados-diarios)
4. [Función de Purga y Consolidación](#4-función-de-purga-y-consolidación)
5. [Scheduler — Supabase Edge Function (Deno)](#5-scheduler--supabase-edge-function-deno)
6. [Tipos TypeScript para el Ciclo de Vida de Datos](#6-tipos-typescript-para-el-ciclo-de-vida-de-datos)
7. [SDK de Gestión de Ciclo de Vida](#7-sdk-de-gestión-de-ciclo-de-vida)
8. [Monitoreo de Cuotas en Tiempo Real](#8-monitoreo-de-cuotas-en-tiempo-real)
9. [Política de Retención por Tabla](#9-política-de-retención-por-tabla)
10. [Estrategia de Índices y Vacuum](#10-estrategia-de-índices-y-vacuum)
11. [Estimación de Crecimiento y Proyección de Almacenamiento](#11-estimación-de-crecimiento-y-proyección-de-almacenamiento)

---

## 1. Restricciones del Supabase Free Tier

El Free Tier de Supabase impone las siguientes restricciones que rigen toda la estrategia de lifecycle del NEXUS SYSTEM:

| Recurso | Límite Free Tier | Límite de Alerta Interna | Acción si se supera |
|---------|-----------------|--------------------------|---------------------|
| **Almacenamiento PostgreSQL** | 500 MB | 400 MB (80%) | Purga de emergencia de logs > 30 días |
| **Filas totales** | Sin límite estricto | — | — |
| **Requests API por mes** | 500,000 | 400,000 | Caching agresivo con SWR |
| **Edge Function invocations** | 500,000 | 400,000 | Consolidar múltiples purgas en 1 job |
| **Bandwidth** | 5 GB/mes | 4 GB/mes | Paginación estricta (máx. 100 filas/request) |
| **Tiempo de pausa de proyecto** | Pausa tras 1 semana de inactividad | — | Ping diario automatizado |

> [!WARNING]
> El proyecto se **pausa automáticamente** en el Free Tier tras 7 días sin actividad. El scheduler de Edge Functions debe incluir un ping de keep-alive diario para prevenir pausas no planificadas.

> [!IMPORTANT]
> El presupuesto de almacenamiento se distribuye así:  
> — `audit_logs` (inmutables): máx. 100 MB  
> — `registros` / `call_interactions` (operacionales, 90 días): máx. 150 MB  
> — `workflow_latency_logs` (telemetría, 90 días): máx. 80 MB  
> — Tablas maestras (profiles, roles, campaigns...): máx. 50 MB  
> — Índices totales: máx. 100 MB  
> — Buffer de seguridad: 20 MB

---

## 2. Estrategia de Particionamiento por Rango Temporal

### 2.1 Particionamiento de Telemetría de Latencia

```sql
-- ============================================================
-- TABLA MAESTRA PARTICIONADA: workflow_latency_logs_partitioned
-- Partición mensual por RANGE sobre created_at
-- Solo se mantienen particiones de los últimos 3 meses activos
-- ============================================================
CREATE TABLE IF NOT EXISTS public.workflow_latency_logs_partitioned (
    id                      UUID        NOT NULL DEFAULT gen_random_uuid(),
    user_id                 UUID        NOT NULL,
    attendance_id           UUID        NOT NULL,
    clock_in_time           TIMESTAMPTZ NOT NULL,
    first_task_event_time   TIMESTAMPTZ,
    latency_seconds         INT
                            GENERATED ALWAYS AS (
                                EXTRACT(EPOCH FROM (first_task_event_time - clock_in_time))::INT
                            ) STORED,
    task_module             TEXT        NOT NULL
                            CHECK (task_module IN ('calls', 'oriana_analysis', 'incidents')),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    PRIMARY KEY (created_at, id)   -- created_at en la clave para soportar particionamiento
) PARTITION BY RANGE (created_at);

-- ============================================================
-- FUNCIÓN: create_monthly_partition
-- Crea partición para el mes indicado si no existe
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_monthly_latency_partition(
    p_year  INT,
    p_month INT
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_partition_name TEXT;
  v_start_date     DATE;
  v_end_date       DATE;
BEGIN
  -- Validar entradas
  IF p_year < 2024 OR p_year > 2099 THEN
    RAISE EXCEPTION 'Año inválido: %', p_year;
  END IF;
  IF p_month < 1 OR p_month > 12 THEN
    RAISE EXCEPTION 'Mes inválido: %', p_month;
  END IF;

  v_partition_name := format('workflow_latency_logs_%s_%s',
    p_year,
    LPAD(p_month::TEXT, 2, '0')
  );
  v_start_date := make_date(p_year, p_month, 1);
  v_end_date   := v_start_date + INTERVAL '1 month';

  -- Crear partición solo si no existe
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE n.nspname = 'public' AND c.relname = v_partition_name
  ) THEN
    EXECUTE format(
      'CREATE TABLE public.%I
       PARTITION OF public.workflow_latency_logs_partitioned
       FOR VALUES FROM (%L) TO (%L)',
      v_partition_name,
      v_start_date,
      v_end_date
    );

    -- Índices en la partición nueva
    EXECUTE format(
      'CREATE INDEX ON public.%I (user_id, created_at DESC)',
      v_partition_name
    );
    EXECUTE format(
      'CREATE INDEX ON public.%I (task_module, created_at)',
      v_partition_name
    );

    RAISE NOTICE 'Partición % creada (% a %)',
      v_partition_name, v_start_date, v_end_date;
  ELSE
    RAISE NOTICE 'Partición % ya existe, omitiendo', v_partition_name;
  END IF;
END;
$$;

-- ============================================================
-- INICIALIZACIÓN: Crear particiones para los próximos 3 meses
-- ============================================================
DO $$
DECLARE
  v_current_date DATE := date_trunc('month', now());
  v_month_offset INT;
BEGIN
  FOR v_month_offset IN 0..2 LOOP
    PERFORM public.create_monthly_latency_partition(
      EXTRACT(YEAR  FROM (v_current_date + (v_month_offset || ' months')::INTERVAL))::INT,
      EXTRACT(MONTH FROM (v_current_date + (v_month_offset || ' months')::INTERVAL))::INT
    );
  END LOOP;
END;
$$;
```

### 2.2 Particionamiento de Registros Operacionales (Oriana)

```sql
-- ============================================================
-- TABLA MAESTRA PARTICIONADA: registros_partitioned
-- Basado en fecha_reporte (DATE), partición mensual
-- Los registros de Oriana son los de mayor volumen
-- ============================================================
CREATE TABLE IF NOT EXISTS public.registros_partitioned (
    id                     BIGSERIAL   NOT NULL,
    id_operador            TEXT        DEFAULT 'S/ID',
    fecha_registro         TIMESTAMPTZ DEFAULT NOW(),
    fecha_reporte          DATE        NOT NULL,   -- Partición key
    usuario_operador       TEXT        NOT NULL,
    modo_trabajo           TEXT        NOT NULL,
    campana                TEXT        NOT NULL,
    llamadas_efectivas     NUMERIC     DEFAULT 0,
    llamadas_totales       NUMERIC     DEFAULT 0,
    incidencias_reportadas NUMERIC     DEFAULT 0,
    estados_abarcados      TEXT        DEFAULT '',
    municipios_detalles    TEXT        DEFAULT '',
    admin_efectivas        NUMERIC,
    admin_incidencias      NUMERIC,
    variables              JSONB       DEFAULT '{}'::JSONB,
    created_at             TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (fecha_reporte, id)
) PARTITION BY RANGE (fecha_reporte);

-- Función auxiliar para crear particiones de registros
CREATE OR REPLACE FUNCTION public.create_monthly_registros_partition(
    p_year  INT,
    p_month INT
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_partition_name TEXT;
  v_start_date     DATE;
  v_end_date       DATE;
BEGIN
  v_partition_name := format('registros_%s_%s', p_year, LPAD(p_month::TEXT, 2, '0'));
  v_start_date     := make_date(p_year, p_month, 1);
  v_end_date       := v_start_date + INTERVAL '1 month';

  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE n.nspname = 'public' AND c.relname = v_partition_name
  ) THEN
    EXECUTE format(
      'CREATE TABLE public.%I
       PARTITION OF public.registros_partitioned
       FOR VALUES FROM (%L) TO (%L)',
      v_partition_name, v_start_date, v_end_date
    );
    EXECUTE format(
      'CREATE INDEX ON public.%I (usuario_operador, fecha_reporte DESC)',
      v_partition_name
    );
    EXECUTE format(
      'CREATE INDEX ON public.%I (modo_trabajo)',
      v_partition_name
    );
  END IF;
END;
$$;
```

---

## 3. Tabla de Agregados Diarios

Los logs de telemetría y call_interactions se consolidan en estas tablas antes de ser purgados, preservando los KPIs históricos sin mantener filas individuales.

```sql
-- ============================================================
-- TABLA: telemetry_daily_aggregates
-- Resumen diario de latencias operativas por módulo
-- Dato permanente — NUNCA se purga
-- ============================================================
CREATE TABLE IF NOT EXISTS public.telemetry_daily_aggregates (
    id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    summary_date         DATE        NOT NULL,
    task_module          TEXT        NOT NULL
                         CHECK (task_module IN ('calls', 'oriana_analysis', 'incidents')),
    total_events         INT         NOT NULL DEFAULT 0
                         CHECK (total_events >= 0),
    avg_latency_sec      INT         NOT NULL DEFAULT 0,
    min_latency_sec      INT,
    max_latency_sec      INT,
    p50_latency_sec      INT,         -- Percentil 50 (mediana)
    p95_latency_sec      INT,         -- Percentil 95
    total_operators      INT         DEFAULT 0,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    UNIQUE (summary_date, task_module)
);

CREATE INDEX IF NOT EXISTS idx_telemetry_agg_date   ON public.telemetry_daily_aggregates(summary_date DESC);
CREATE INDEX IF NOT EXISTS idx_telemetry_agg_module ON public.telemetry_daily_aggregates(task_module);

-- ============================================================
-- TABLA: call_daily_aggregates
-- Resumen diario de rendimiento de llamadas por operador
-- ============================================================
CREATE TABLE IF NOT EXISTS public.call_daily_aggregates (
    id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    summary_date            DATE        NOT NULL,
    operator_id             UUID        NOT NULL,
    campaign_id             UUID,
    total_calls             INT         NOT NULL DEFAULT 0,
    effective_calls         INT         NOT NULL DEFAULT 0,   -- answered_effective
    busy_calls              INT         NOT NULL DEFAULT 0,
    no_answer_calls         INT         NOT NULL DEFAULT 0,
    invalid_calls           INT         NOT NULL DEFAULT 0,
    rejected_calls          INT         NOT NULL DEFAULT 0,
    avg_duration_sec        INT,
    avg_idle_time_prior_sec INT,
    daily_quota_met         BOOLEAN     DEFAULT FALSE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    UNIQUE (summary_date, operator_id, campaign_id)
);

CREATE INDEX IF NOT EXISTS idx_call_agg_date     ON public.call_daily_aggregates(summary_date DESC);
CREATE INDEX IF NOT EXISTS idx_call_agg_operator ON public.call_daily_aggregates(operator_id);

-- ============================================================
-- TABLA: registros_daily_aggregates
-- KPIs diarios de registros Oriana (antes de purgar detalles)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.registros_daily_aggregates (
    id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    summary_date            DATE        NOT NULL,
    usuario_operador        TEXT        NOT NULL,
    modo_trabajo            TEXT        NOT NULL,
    total_registros         INT         NOT NULL DEFAULT 0,
    total_llamadas_efectivas NUMERIC    DEFAULT 0,
    total_llamadas_totales  NUMERIC     DEFAULT 0,
    total_incidencias       NUMERIC     DEFAULT 0,
    tasa_efectividad        NUMERIC(5,2),   -- (efectivas/totales) * 100
    created_at              TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    UNIQUE (summary_date, usuario_operador, modo_trabajo)
);

CREATE INDEX IF NOT EXISTS idx_reg_agg_date     ON public.registros_daily_aggregates(summary_date DESC);
CREATE INDEX IF NOT EXISTS idx_reg_agg_usuario  ON public.registros_daily_aggregates(usuario_operador);
```

---

## 4. Función de Purga y Consolidación

```sql
-- ============================================================
-- FUNCIÓN PRINCIPAL: archive_and_purge_lifecycle
-- Ejecuta en 3 fases:
--   1. Consolidación de agregados
--   2. Purga de logs detallados (> 90 días)
--   3. Gestión de particiones obsoletas
-- Retorna un reporte de ejecución tipado
-- ============================================================
CREATE TYPE public.purge_execution_report AS (
    phase                TEXT,
    rows_aggregated      BIGINT,
    rows_deleted         BIGINT,
    partitions_dropped   INT,
    execution_time_ms    INT,
    error_detail         TEXT
);

CREATE OR REPLACE FUNCTION public.archive_and_purge_lifecycle(
    p_retention_days     INT  DEFAULT 90,    -- Días a retener logs detallados
    p_dry_run            BOOL DEFAULT FALSE  -- Si TRUE, no ejecuta cambios
)
RETURNS SETOF public.purge_execution_report
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cutoff_date        TIMESTAMPTZ := now() - (p_retention_days || ' days')::INTERVAL;
  v_cutoff_date_only   DATE        := v_cutoff_date::DATE;
  v_start_time         TIMESTAMPTZ;
  v_rows_agg           BIGINT      := 0;
  v_rows_del           BIGINT      := 0;
  v_parts_dropped      INT         := 0;
  v_report             public.purge_execution_report;

BEGIN
  -- ═══════════════════════════════════════════
  -- FASE 1: CONSOLIDAR TELEMETRÍA DE LATENCIA
  -- ═══════════════════════════════════════════
  v_start_time := clock_timestamp();

  IF NOT p_dry_run THEN
    INSERT INTO public.telemetry_daily_aggregates (
        summary_date,
        task_module,
        total_events,
        avg_latency_sec,
        min_latency_sec,
        max_latency_sec,
        p50_latency_sec,
        p95_latency_sec,
        total_operators
    )
    SELECT
        created_at::DATE,
        task_module,
        COUNT(*)::INT,
        AVG(latency_seconds)::INT,
        MIN(latency_seconds),
        MAX(latency_seconds),
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY latency_seconds)::INT,
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_seconds)::INT,
        COUNT(DISTINCT user_id)::INT
    FROM   public.workflow_latency_logs
    WHERE  created_at < v_cutoff_date
    GROUP  BY created_at::DATE, task_module
    ON CONFLICT (summary_date, task_module)
    DO UPDATE SET
        total_events    = EXCLUDED.total_events,
        avg_latency_sec = EXCLUDED.avg_latency_sec,
        min_latency_sec = EXCLUDED.min_latency_sec,
        max_latency_sec = EXCLUDED.max_latency_sec,
        p50_latency_sec = EXCLUDED.p50_latency_sec,
        p95_latency_sec = EXCLUDED.p95_latency_sec,
        total_operators = EXCLUDED.total_operators;

    GET DIAGNOSTICS v_rows_agg = ROW_COUNT;
  ELSE
    SELECT COUNT(*) INTO v_rows_agg
    FROM public.workflow_latency_logs
    WHERE created_at < v_cutoff_date;
  END IF;

  v_report.phase             := 'PHASE_1_TELEMETRY_AGGREGATION';
  v_report.rows_aggregated   := v_rows_agg;
  v_report.rows_deleted      := 0;
  v_report.partitions_dropped := 0;
  v_report.execution_time_ms := EXTRACT(MILLISECONDS FROM clock_timestamp() - v_start_time)::INT;
  v_report.error_detail      := NULL;
  RETURN NEXT v_report;

  -- ═══════════════════════════════════════════
  -- FASE 2: CONSOLIDAR LLAMADAS POR OPERADOR
  -- ═══════════════════════════════════════════
  v_start_time := clock_timestamp();
  v_rows_agg   := 0;

  IF NOT p_dry_run THEN
    INSERT INTO public.call_daily_aggregates (
        summary_date, operator_id, campaign_id,
        total_calls, effective_calls, busy_calls,
        no_answer_calls, invalid_calls, rejected_calls,
        avg_duration_sec, avg_idle_time_prior_sec, daily_quota_met
    )
    SELECT
        ci.created_at::DATE,
        ci.operator_id,
        ca.campaign_id,
        COUNT(*)::INT,
        COUNT(*) FILTER (WHERE ci.result = 'answered_effective')::INT,
        COUNT(*) FILTER (WHERE ci.result = 'busy')::INT,
        COUNT(*) FILTER (WHERE ci.result = 'no_answer')::INT,
        COUNT(*) FILTER (WHERE ci.result = 'invalid_number')::INT,
        COUNT(*) FILTER (WHERE ci.result = 'rejected')::INT,
        AVG(ci.duration_seconds)::INT,
        AVG(ci.idle_time_prior_call)::INT,
        (COUNT(*) >= (
          SELECT daily_quota_per_operator
          FROM   public.call_campaigns cc
          WHERE  cc.id = ca.campaign_id
          LIMIT  1
        ))
    FROM   public.call_interactions ci
    JOIN   public.call_assignments  ca ON ci.assignment_id = ca.id
    WHERE  ci.created_at < v_cutoff_date
    GROUP  BY ci.created_at::DATE, ci.operator_id, ca.campaign_id
    ON CONFLICT (summary_date, operator_id, campaign_id)
    DO UPDATE SET
        total_calls             = EXCLUDED.total_calls,
        effective_calls         = EXCLUDED.effective_calls,
        busy_calls              = EXCLUDED.busy_calls,
        no_answer_calls         = EXCLUDED.no_answer_calls,
        invalid_calls           = EXCLUDED.invalid_calls,
        rejected_calls          = EXCLUDED.rejected_calls,
        avg_duration_sec        = EXCLUDED.avg_duration_sec,
        avg_idle_time_prior_sec = EXCLUDED.avg_idle_time_prior_sec,
        daily_quota_met         = EXCLUDED.daily_quota_met;

    GET DIAGNOSTICS v_rows_agg = ROW_COUNT;
  END IF;

  -- ═══════════════════════════════════════════
  -- FASE 3: CONSOLIDAR REGISTROS ORIANA
  -- ═══════════════════════════════════════════
  IF NOT p_dry_run THEN
    INSERT INTO public.registros_daily_aggregates (
        summary_date, usuario_operador, modo_trabajo,
        total_registros, total_llamadas_efectivas,
        total_llamadas_totales, total_incidencias, tasa_efectividad
    )
    SELECT
        fecha_reporte,
        usuario_operador,
        modo_trabajo,
        COUNT(*)::INT,
        SUM(llamadas_efectivas),
        SUM(llamadas_totales),
        SUM(incidencias_reportadas),
        CASE
          WHEN SUM(llamadas_totales) > 0
          THEN ROUND((SUM(llamadas_efectivas) / SUM(llamadas_totales)) * 100, 2)
          ELSE 0
        END
    FROM   public.registros
    WHERE  fecha_reporte < v_cutoff_date_only
    GROUP  BY fecha_reporte, usuario_operador, modo_trabajo
    ON CONFLICT (summary_date, usuario_operador, modo_trabajo)
    DO UPDATE SET
        total_registros          = EXCLUDED.total_registros,
        total_llamadas_efectivas = EXCLUDED.total_llamadas_efectivas,
        total_llamadas_totales   = EXCLUDED.total_llamadas_totales,
        total_incidencias        = EXCLUDED.total_incidencias,
        tasa_efectividad         = EXCLUDED.tasa_efectividad;
  END IF;

  v_report.phase              := 'PHASE_2_CALLS_AND_REGISTROS_AGGREGATION';
  v_report.rows_aggregated    := v_rows_agg;
  v_report.rows_deleted       := 0;
  v_report.partitions_dropped := 0;
  v_report.execution_time_ms  := EXTRACT(MILLISECONDS FROM clock_timestamp() - v_start_time)::INT;
  v_report.error_detail       := NULL;
  RETURN NEXT v_report;

  -- ═══════════════════════════════════════════
  -- FASE 4: PURGA DE LOGS DETALLADOS
  -- ═══════════════════════════════════════════
  v_start_time := clock_timestamp();
  v_rows_del   := 0;

  IF NOT p_dry_run THEN
    -- Purgar telemetría detallada
    DELETE FROM public.workflow_latency_logs
    WHERE created_at < v_cutoff_date;
    GET DIAGNOSTICS v_rows_del = ROW_COUNT;

    -- Purgar interacciones de llamadas completadas antiguas
    DELETE FROM public.call_interactions
    WHERE created_at < v_cutoff_date
    AND   result IN ('answered_effective', 'busy', 'no_answer', 'invalid_number', 'rejected');

    -- Purgar registros Oriana individuales (ya consolidados)
    DELETE FROM public.registros
    WHERE fecha_reporte < v_cutoff_date_only;

    -- Purgar cola de Telegram enviada (no relevante mantener > 30 días)
    DELETE FROM public.cola_telegram
    WHERE estado = 'ENVIADO'
    AND   fecha_encola < (now() - INTERVAL '30 days');

    -- Purgar logs de auditoría de baja criticidad > 180 días
    -- (LOGIN/LOGOUT se consolidan; INSERT/UPDATE/DELETE se mantienen 365 días)
    DELETE FROM public.audit_logs
    WHERE action IN ('LOGIN', 'LOGOUT')
    AND   created_at < (now() - INTERVAL '180 days');
  ELSE
    SELECT COUNT(*) INTO v_rows_del
    FROM public.workflow_latency_logs
    WHERE created_at < v_cutoff_date;
  END IF;

  v_report.phase              := 'PHASE_3_DETAIL_PURGE';
  v_report.rows_aggregated    := 0;
  v_report.rows_deleted       := v_rows_del;
  v_report.partitions_dropped := 0;
  v_report.execution_time_ms  := EXTRACT(MILLISECONDS FROM clock_timestamp() - v_start_time)::INT;
  v_report.error_detail       := NULL;
  RETURN NEXT v_report;

  -- ═══════════════════════════════════════════
  -- FASE 5: DROP DE PARTICIONES OBSOLETAS
  -- ═══════════════════════════════════════════
  v_start_time    := clock_timestamp();
  v_parts_dropped := 0;

  IF NOT p_dry_run THEN
    DECLARE
      v_partition_name TEXT;
      v_cutoff_month   DATE := date_trunc('month', v_cutoff_date);
    BEGIN
      FOR v_partition_name IN
        SELECT c.relname
        FROM   pg_class     c
        JOIN   pg_namespace n ON c.relnamespace = n.oid
        JOIN   pg_inherits  i ON c.oid = i.inhrelid
        JOIN   pg_class     p ON i.inhparent = p.oid
        WHERE  n.nspname = 'public'
        AND    p.relname IN ('workflow_latency_logs_partitioned', 'registros_partitioned')
        AND    c.relname ~ '^(workflow_latency_logs|registros)_[0-9]{4}_[0-9]{2}$'
      LOOP
        -- Extraer año y mes del nombre de la partición
        DECLARE
          v_part_year  INT := substring(v_partition_name FROM '_([0-9]{4})_[0-9]{2}$')::INT;
          v_part_month INT := substring(v_partition_name FROM '_[0-9]{4}_([0-9]{2})$')::INT;
          v_part_date  DATE;
        BEGIN
          v_part_date := make_date(v_part_year, v_part_month, 1);
          IF v_part_date < v_cutoff_month THEN
            EXECUTE format('DROP TABLE IF EXISTS public.%I', v_partition_name);
            v_parts_dropped := v_parts_dropped + 1;
            RAISE NOTICE 'Partición % eliminada', v_partition_name;
          END IF;
        END;
      END LOOP;
    END;
  END IF;

  v_report.phase              := 'PHASE_4_PARTITION_CLEANUP';
  v_report.rows_aggregated    := 0;
  v_report.rows_deleted       := 0;
  v_report.partitions_dropped := v_parts_dropped;
  v_report.execution_time_ms  := EXTRACT(MILLISECONDS FROM clock_timestamp() - v_start_time)::INT;
  v_report.error_detail       := NULL;
  RETURN NEXT v_report;

END;
$$;
```

---

## 5. Scheduler — Supabase Edge Function (Deno)

```typescript
// supabase/functions/lifecycle-scheduler/index.ts
// Invocada diariamente a las 02:00 UTC vía pg_cron o Supabase Cron
// Deno runtime — sin dependencias de Node.js
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ─────────────────────────────────────────────
// TIPOS DE RESPUESTA DE LA FUNCIÓN DE PURGA
// ─────────────────────────────────────────────
interface PurgeExecutionReport {
  readonly phase:               string;
  readonly rows_aggregated:     number;
  readonly rows_deleted:        number;
  readonly partitions_dropped:  number;
  readonly execution_time_ms:   number;
  readonly error_detail:        string | null;
}

interface LifecycleJobResult {
  readonly success:             boolean;
  readonly executed_at:         string;
  readonly total_duration_ms:   number;
  readonly dry_run:             boolean;
  readonly phases:              readonly PurgeExecutionReport[];
  readonly errors:              readonly string[];
}

// ─────────────────────────────────────────────
// VALIDACIÓN DE VARIABLES DE ENTORNO
// ─────────────────────────────────────────────
function getRequiredEnv(key: string): string {
  const value = Deno.env.get(key);
  if (!value || value.trim() === '') {
    throw new Error(`Variable de entorno requerida no configurada: ${key}`);
  }
  return value.trim();
}

// ─────────────────────────────────────────────
// HANDLER PRINCIPAL
// ─────────────────────────────────────────────
Deno.serve(async (req: Request): Promise<Response> => {
  const startTime = Date.now();
  const errors: string[] = [];

  // Verificar método HTTP
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Método no permitido. Use POST.' }),
      { status: 405, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Verificar Authorization header (Bearer token del scheduler interno)
  const authHeader = req.headers.get('Authorization');
  const expectedToken = Deno.env.get('SCHEDULER_SECRET_TOKEN');
  if (!authHeader || !expectedToken || authHeader !== `Bearer ${expectedToken}`) {
    return new Response(
      JSON.stringify({ error: 'No autorizado' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Parsear parámetros opcionales del body
  let dryRun = false;
  let retentionDays = 90;
  try {
    const body = await req.json() as { dry_run?: boolean; retention_days?: number };
    dryRun = body.dry_run === true;
    if (typeof body.retention_days === 'number' && body.retention_days >= 30) {
      retentionDays = Math.min(body.retention_days, 365); // máx 365 días
    }
  } catch {
    // Body vacío o inválido es aceptable — usar defaults
  }

  // Crear cliente con service_role (bypass RLS para operaciones de mantenimiento)
  const supabase = createClient(
    getRequiredEnv('SUPABASE_URL'),
    getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
    {
      auth: {
        autoRefreshToken: false,
        persistSession:   false,
      },
    }
  );

  const phases: PurgeExecutionReport[] = [];

  try {
    // ────────────────────────────────────────
    // PASO 1: Crear partición del próximo mes (mantenimiento preventivo)
    // ────────────────────────────────────────
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);

    const { error: partitionError } = await supabase.rpc(
      'create_monthly_latency_partition',
      {
        p_year:  nextMonth.getFullYear(),
        p_month: nextMonth.getMonth() + 1,
      }
    );
    if (partitionError) {
      errors.push(`Error creando partición preventiva: ${partitionError.message}`);
    }

    // ────────────────────────────────────────
    // PASO 2: Ejecutar ciclo de purga principal
    // ────────────────────────────────────────
    const { data: purgeData, error: purgeError } = await supabase.rpc(
      'archive_and_purge_lifecycle',
      {
        p_retention_days: retentionDays,
        p_dry_run:        dryRun,
      }
    );

    if (purgeError) {
      errors.push(`Error en ciclo de purga: ${purgeError.message}`);
    } else if (Array.isArray(purgeData)) {
      phases.push(...(purgeData as PurgeExecutionReport[]));
    }

    // ────────────────────────────────────────
    // PASO 3: Registrar ejecución en audit_logs (via service_role)
    // ────────────────────────────────────────
    if (!dryRun) {
      await supabase
        .from('audit_logs')
        .insert({
          actor_id:    null,            // Operación de sistema
          action:      'INSERT',        // Mejor representación disponible en el enum
          entity_name: 'audit_logs',   // Auto-referencial: log de log de mantenimiento
          entity_id:   crypto.randomUUID(),
          new_data:    {
            job:              'lifecycle_scheduler',
            retention_days:   retentionDays,
            phases_completed: phases.length,
            total_deleted:    phases.reduce((s, p) => s + (p.rows_deleted ?? 0), 0),
            executed_at:      new Date().toISOString(),
          },
          ip_address:  null,
          user_agent:  'supabase-edge-function/lifecycle-scheduler',
        });
    }

    // ────────────────────────────────────────
    // PASO 4: Keep-alive ping (evitar pausa del proyecto)
    // ────────────────────────────────────────
    await supabase.from('roles').select('id').limit(1);

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    errors.push(`Error inesperado: ${message}`);
  }

  const result: LifecycleJobResult = {
    success:           errors.length === 0,
    executed_at:       new Date().toISOString(),
    total_duration_ms: Date.now() - startTime,
    dry_run:           dryRun,
    phases,
    errors,
  };

  return new Response(
    JSON.stringify(result, null, 2),
    {
      status:  errors.length === 0 ? 200 : 207,
      headers: { 'Content-Type': 'application/json' },
    }
  );
});
```

---

## 6. Tipos TypeScript para el Ciclo de Vida de Datos

```typescript
// packages/database/src/types/lifecycle.types.ts
import type { Database } from './database.types';

// Tipos de fila de tablas de agregados
export type TelemetryDailyAggregateRow =
  Database['public']['Tables']['telemetry_daily_aggregates']['Row'];

export type CallDailyAggregateRow =
  Database['public']['Tables']['call_daily_aggregates']['Row'];

export type RegistrosDailyAggregateRow =
  Database['public']['Tables']['registros_daily_aggregates']['Row'];

// ─────────────────────────────────────────────
// PARÁMETROS DE CONSULTA DE AGREGADOS
// ─────────────────────────────────────────────
export interface AggregateQueryParams {
  readonly startDate:  string;    // ISO date YYYY-MM-DD
  readonly endDate:    string;    // ISO date YYYY-MM-DD
  readonly module?:    'calls' | 'oriana_analysis' | 'incidents';
  readonly operatorId?: string;   // UUID
  readonly limit?:     number;    // Default: 90
  readonly offset?:    number;    // Default: 0
}

// ─────────────────────────────────────────────
// INFORME DE SALUD DE ALMACENAMIENTO
// ─────────────────────────────────────────────
export interface StorageHealthReport {
  readonly total_size_mb:         number;
  readonly free_tier_limit_mb:    number;    // Siempre 500
  readonly usage_percentage:      number;
  readonly alert_threshold_pct:   number;    // Siempre 80
  readonly is_critical:           boolean;   // > 90%
  readonly is_warning:            boolean;   // > 80%
  readonly tables: readonly TableStorageInfo[];
  readonly checked_at:            string;    // ISO 8601
}

export interface TableStorageInfo {
  readonly table_name:    string;
  readonly size_mb:       number;
  readonly row_count:     number;
  readonly oldest_record: string | null;   // ISO date
  readonly newest_record: string | null;   // ISO date
}

// ─────────────────────────────────────────────
// VALIDACIÓN DE RANGO DE FECHAS EN RUNTIME
// ─────────────────────────────────────────────
export function validateDateRange(params: AggregateQueryParams): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

  if (!ISO_DATE.test(params.startDate)) {
    errors.push(`startDate inválida: "${params.startDate}". Formato esperado: YYYY-MM-DD`);
  }
  if (!ISO_DATE.test(params.endDate)) {
    errors.push(`endDate inválida: "${params.endDate}". Formato esperado: YYYY-MM-DD`);
  }

  if (errors.length === 0) {
    const start = new Date(params.startDate);
    const end   = new Date(params.endDate);

    if (isNaN(start.getTime())) errors.push('startDate no es una fecha válida');
    if (isNaN(end.getTime()))   errors.push('endDate no es una fecha válida');

    if (errors.length === 0) {
      if (start > end) {
        errors.push('startDate debe ser anterior o igual a endDate');
      }
      const diffDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
      if (diffDays > 365) {
        errors.push('El rango no puede superar 365 días por consulta');
      }
    }
  }

  if (params.limit !== undefined) {
    if (!Number.isInteger(params.limit) || params.limit < 1 || params.limit > 1000) {
      errors.push('limit debe ser un entero entre 1 y 1000');
    }
  }

  return { valid: errors.length === 0, errors };
}
```

---

## 7. SDK de Gestión de Ciclo de Vida

```typescript
// packages/database/src/lifecycle.sdk.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types/database.types';
import type {
  AggregateQueryParams,
  StorageHealthReport,
  TelemetryDailyAggregateRow,
  CallDailyAggregateRow,
} from './types/lifecycle.types';
import { validateDateRange } from './types/lifecycle.types';

type SupabaseDB = SupabaseClient<Database>;

// ─────────────────────────────────────────────
// CONSULTA DE AGREGADOS DE TELEMETRÍA
// ─────────────────────────────────────────────
export async function getTelemetryAggregates(
  client:  SupabaseDB,
  params:  AggregateQueryParams
): Promise<{ data: TelemetryDailyAggregateRow[]; error: string | null }> {
  const validation = validateDateRange(params);
  if (!validation.valid) {
    return { data: [], error: validation.errors.join('; ') };
  }

  let query = client
    .from('telemetry_daily_aggregates')
    .select('*')
    .gte('summary_date', params.startDate)
    .lte('summary_date', params.endDate)
    .order('summary_date', { ascending: false })
    .limit(params.limit ?? 90)
    .range(params.offset ?? 0, (params.offset ?? 0) + (params.limit ?? 90) - 1);

  if (params.module) {
    query = query.eq('task_module', params.module);
  }

  const { data, error } = await query;
  if (error) return { data: [], error: error.message };
  return { data: data ?? [], error: null };
}

// ─────────────────────────────────────────────
// INFORME DE SALUD DE ALMACENAMIENTO
// ─────────────────────────────────────────────
export async function getStorageHealthReport(
  client: SupabaseDB
): Promise<StorageHealthReport> {
  // Consulta de tamaño de tablas via pg_stat_user_tables
  const { data, error } = await client.rpc('get_storage_usage_report');

  // Fallback si la función RPC no existe
  const tables = error || !data
    ? []
    : (data as Array<{
        table_name: string;
        size_mb: number;
        row_count: number;
        oldest_record: string | null;
        newest_record: string | null;
      }>);

  const totalSizeMb = tables.reduce((sum, t) => sum + (t.size_mb ?? 0), 0);
  const usagePct    = (totalSizeMb / 500) * 100;

  return {
    total_size_mb:        Math.round(totalSizeMb * 100) / 100,
    free_tier_limit_mb:   500,
    usage_percentage:     Math.round(usagePct * 100) / 100,
    alert_threshold_pct:  80,
    is_critical:          usagePct > 90,
    is_warning:           usagePct > 80,
    tables,
    checked_at:           new Date().toISOString(),
  };
}

// ─────────────────────────────────────────────
-- FUNCIÓN SQL: get_storage_usage_report (complemento del SDK)
-- ─────────────────────────────────────────────

/*
CREATE OR REPLACE FUNCTION public.get_storage_usage_report()
RETURNS TABLE (
  table_name    TEXT,
  size_mb       NUMERIC,
  row_count     BIGINT,
  oldest_record TEXT,
  newest_record TEXT
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    relname::TEXT,
    ROUND(pg_relation_size(oid) / 1024.0 / 1024.0, 3),
    reltuples::BIGINT,
    NULL::TEXT,
    NULL::TEXT
  FROM pg_class c
  JOIN pg_namespace n ON c.relnamespace = n.oid
  WHERE n.nspname = 'public'
  AND   c.relkind = 'r'
  ORDER BY pg_relation_size(oid) DESC;
$$;
*/
```

---

## 8. Monitoreo de Cuotas en Tiempo Real

```typescript
// apps/admin-portal/src/app/api/storage-health/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@intranet/database';
import { getStorageHealthReport } from '@intranet/database/lifecycle.sdk';
import { resolveAuthenticatedUser, requireRole } from '@intranet/auth';

export const runtime = 'edge';
export const revalidate = 300; // 5 minutos de caché en Edge

export async function GET(request: NextRequest): Promise<NextResponse> {
  // Solo superadmin y module_admin pueden ver el estado de almacenamiento
  const user = await resolveAuthenticatedUser(request);
  requireRole(user, ['superadmin', 'module_admin'], 'storage-health endpoint');

  const client = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const report = await getStorageHealthReport(client);

  // Alertas automáticas en el header de respuesta
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (report.is_critical) {
    headers.set('X-Storage-Alert', 'CRITICAL');
  } else if (report.is_warning) {
    headers.set('X-Storage-Alert', 'WARNING');
  } else {
    headers.set('X-Storage-Alert', 'OK');
  }

  return NextResponse.json(report, {
    status: 200,
    headers,
  });
}
```

---

## 9. Política de Retención por Tabla

| Tabla | Tipo | Retención Detallada | Destino al Expirar | Prioridad |
|-------|------|--------------------|--------------------|-----------|
| `audit_logs` (mutaciones) | Inmutable | **365 días** | Nunca se purga | Crítica |
| `audit_logs` (login/logout) | Operacional | **180 días** | DELETE directo | Alta |
| `workflow_latency_logs` | Telemetría | **90 días** | → `telemetry_daily_aggregates` | Media |
| `call_interactions` | Operacional | **90 días** | → `call_daily_aggregates` | Media |
| `registros` | Operacional | **90 días** | → `registros_daily_aggregates` | Media |
| `cola_telegram` (ENVIADO) | Temporal | **30 días** | DELETE directo | Baja |
| `clock_events` | Inmutable | **180 días** | → Resumen en `attendance_records` | Alta |
| `oriana_metrics` | Analítica | **365 días** | Archivo en tabla fría | Alta |
| `profiles`, `roles`, `user_roles` | Maestros | **Permanente** | Soft delete (`is_active = false`) | Crítica |
| `call_campaigns`, `call_assignments` | Maestros | **Permanente** | Status `completed` | Alta |
| `incidents` | Operacional | **365 días** | Status `closed` + resumen | Alta |
| `telemetry_daily_aggregates` | Agregado | **Permanente** | Nunca se purga | Crítica |
| `call_daily_aggregates` | Agregado | **Permanente** | Nunca se purga | Crítica |

---

## 10. Estrategia de Índices y Vacuum

```sql
-- ============================================================
-- ÍNDICES COMPUESTOS OPTIMIZADOS PARA QUERIES FRECUENTES
-- Incluyen solo columnas de alta cardinalidad en posición líder
-- ============================================================

-- Consultas de asistencia por usuario y fecha (más frecuente)
CREATE INDEX IF NOT EXISTS idx_attendance_user_date
  ON public.attendance_records (user_id, work_date DESC);

-- Consultas de llamadas por campaña y operador
CREATE INDEX IF NOT EXISTS idx_call_interactions_op_date
  ON public.call_interactions (operator_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_call_assignments_campaign_state
  ON public.call_assignments (campaign_id, state)
  WHERE state IN ('queued', 'calling');  -- Índice parcial: solo activos

-- Búsqueda de incidencias abiertas por severidad
CREATE INDEX IF NOT EXISTS idx_incidents_open_severity
  ON public.incidents (severity, created_at DESC)
  WHERE status IN ('open', 'investigating');  -- Índice parcial

-- Búsqueda full-text de nombres en profiles (para búsqueda de operadores)
CREATE INDEX IF NOT EXISTS idx_profiles_fullname_gin
  ON public.profiles USING GIN (to_tsvector('spanish', full_name));

-- ============================================================
-- CONFIGURACIÓN DE AUTOVACUUM POR TABLA
-- Las tablas de alta escritura necesitan vacuum más agresivo
-- ============================================================

-- call_interactions: alta velocidad de INSERT
ALTER TABLE public.call_interactions SET (
  autovacuum_vacuum_scale_factor  = 0.05,   -- Vacuum al 5% de filas muertas
  autovacuum_analyze_scale_factor = 0.02,
  autovacuum_vacuum_cost_delay    = 10
);

-- workflow_latency_logs: alta escritura continua
ALTER TABLE public.workflow_latency_logs SET (
  autovacuum_vacuum_scale_factor  = 0.05,
  autovacuum_analyze_scale_factor = 0.02
);

-- audit_logs: solo INSERT, vacuum menos crítico
ALTER TABLE public.audit_logs SET (
  autovacuum_vacuum_scale_factor  = 0.2,
  autovacuum_analyze_scale_factor = 0.1
);
```

---

## 11. Estimación de Crecimiento y Proyección de Almacenamiento

Basado en 60 operadores activos con cuota de 200 llamadas/día:

| Tabla | Filas/Día | Tamaño/Fila | MB/Día | MB/90 días | MB/Mes Agregado |
|-------|-----------|-------------|--------|------------|-----------------|
| `call_interactions` | 12,000 | 512 B | ~6 MB | ~540 MB → purgada | ~2 MB |
| `workflow_latency_logs` | 12,000 | 256 B | ~3 MB | ~270 MB → purgada | ~1 MB |
| `attendance_records` | 60 | 256 B | ~0.015 MB | ~1.4 MB | Permanente |
| `clock_events` | 240 | 384 B | ~0.09 MB | ~8 MB → purgada | ~0.3 MB |
| `registros` | 300 | 512 B | ~0.15 MB | ~13.5 MB → purgada | ~0.5 MB |
| `audit_logs` | ~1,000 | 1 KB | ~1 MB | ~90 MB | Permanente |

**Proyección a 12 meses con estrategia de purga activa:**

```
Tablas permanentes:  ~120 MB  (audit_logs 365d + maestros + agregados)
Tablas operacionales: ~80 MB  (90 días rolling window)
Índices totales:      ~80 MB
Buffer de seguridad:  ~220 MB
─────────────────────────────
TOTAL PROYECTADO:    ~500 MB  ← En el límite del Free Tier
```

> [!TIP]
> Si el crecimiento de operadores supera 80 personas, se debe evaluar migrar `audit_logs` de más de 90 días a un bucket de Supabase Storage en formato JSONL comprimido (gzip), reduciendo la presión sobre PostgreSQL en aproximadamente 60 MB/trimestre.

> [!NOTE]
> El scheduler de purga ejecuta a las 02:00 UTC para evitar picos de carga operacional. El parámetro `p_dry_run = TRUE` debe ejecutarse en staging antes de cada cambio a la lógica de retención para verificar volúmenes de purga esperados.

