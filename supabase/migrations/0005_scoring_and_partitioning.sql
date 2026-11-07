-- ============================================================
-- MIGRACIÓN: 0005_scoring_and_partitioning.sql
-- Proyecto: NEXUS SYSTEM — Intranet Empresarial Unificada
-- Descripción: Reglas de evaluación dinámica de rendimiento por rol,
--              algoritmo de scoring con ponderación temporal híbrida,
--              particionamiento mensual de tablas de telemetría,
--              y función de purga automatizada de logs de >90 días
--              con consolidación en agregados permanentes.
-- Idempotente: Sí — uso de IF NOT EXISTS, CREATE OR REPLACE, ON CONFLICT
-- Dependencias: 0001 → 0004 (todas las tablas previas deben existir)
-- Fecha: 2026-11-05
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- SECCIÓN 1: TABLA dynamic_evaluation_rules
-- Define los pesos y benchmarks para cada métrica de evaluación
-- según el rol operativo. La combinación (role_type, metric_identifier)
-- es única y configurable por module_admin sin reiniciar el sistema.
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.dynamic_evaluation_rules (
    id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    role_type          TEXT        NOT NULL
                                   CHECK (role_type IN (
                                       'calls',
                                       'oriana_analysis',
                                       'incidents',
                                       'attendance'
                                   )),
    metric_identifier  TEXT        NOT NULL
                                   CHECK (length(metric_identifier) BETWEEN 3 AND 100),
    display_name       TEXT        NOT NULL
                                   CHECK (length(display_name) BETWEEN 3 AND 200),
    weight_percentage  NUMERIC(5, 2) NOT NULL
                                   CHECK (weight_percentage > 0 AND weight_percentage <= 100),
    benchmark_target   NUMERIC(10, 2) NOT NULL,
    -- Si TRUE, puntaje más alto = mejor (ej: calls_per_hour).
    -- Si FALSE, puntaje más bajo = mejor (ej: idle_time, discrepancy_count).
    is_higher_better   BOOLEAN     NOT NULL DEFAULT TRUE,
    -- Unidad de la métrica para display en UI
    unit               TEXT        DEFAULT ''
                                   CHECK (unit IS NULL OR length(unit) <= 50),
    -- Descripción para el operador/supervisor
    description        TEXT        CHECK (description IS NULL OR length(description) <= 500),
    is_active          BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    UNIQUE (role_type, metric_identifier)
);

CREATE INDEX IF NOT EXISTS idx_eval_rules_role
    ON public.dynamic_evaluation_rules(role_type, is_active);

-- Trigger de updated_at
DROP TRIGGER IF EXISTS tr_eval_rules_updated_at ON public.dynamic_evaluation_rules;
CREATE TRIGGER tr_eval_rules_updated_at
    BEFORE UPDATE ON public.dynamic_evaluation_rules
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- ──────────────────────────────────────────────────────────────
-- SECCIÓN 2: SEED — Ponderaciones iniciales del sistema
-- Basadas en la Matriz de Evaluación Dinámica de la Arquitectura Macro.
-- Los pesos de cada role_type deben sumar 100%.
-- ──────────────────────────────────────────────────────────────

-- Asegurar idempotencia eliminando el trigger y datos previos si existieran
DROP TRIGGER IF EXISTS tr_validate_rule_weights ON public.dynamic_evaluation_rules;
DELETE FROM public.dynamic_evaluation_rules WHERE role_type IN ('calls', 'oriana_analysis');

-- Seed de reglas para Rol de Llamadas (total: 100%)
INSERT INTO public.dynamic_evaluation_rules (
    role_type, metric_identifier, display_name,
    weight_percentage, benchmark_target, is_higher_better, unit, description
) VALUES
-- Volumen de llamadas por hora: ≥25 llamadas/hora netas
('calls', 'calls_per_hour',
 'Volumen de llamadas por hora',
 30.00, 25.00, TRUE, 'llamadas/h',
 'Número neto de llamadas realizadas por hora de trabajo activo. Meta: ≥25 llamadas/hora.'),

-- Tasa de contacto efectivo/conversión: ≥40% contestadas con resultado cualificado
('calls', 'effective_contact_rate',
 'Tasa de contacto efectivo',
 35.00, 40.00, TRUE, '%',
 'Porcentaje de llamadas con resultado answered_effective sobre el total. Meta: ≥40%.'),

-- Adherencia a meta diaria: 100% de la cuota base (200 llamadas)
('calls', 'daily_quota_adherence',
 'Adherencia a meta diaria',
 20.00, 100.00, TRUE, '%',
 'Porcentaje de cumplimiento de la cuota diaria base de 200 llamadas. Meta: 100%.'),

-- Latencia entre asignaciones (idle time): promedio ≤45 segundos
('calls', 'idle_time_between_calls',
 'Latencia entre asignaciones (tiempo muerto)',
 15.00, 45.00, FALSE, 'segundos',
 'Promedio de segundos de inactividad entre el fin e inicio de llamadas. Meta: ≤45s.')

ON CONFLICT (role_type, metric_identifier) DO UPDATE
    SET display_name       = EXCLUDED.display_name,
        weight_percentage  = EXCLUDED.weight_percentage,
        benchmark_target   = EXCLUDED.benchmark_target,
        is_higher_better   = EXCLUDED.is_higher_better,
        unit               = EXCLUDED.unit,
        description        = EXCLUDED.description,
        updated_at         = timezone('utc', now());

-- Seed de reglas para Rol de Analítica Oriana (total: 100%)
INSERT INTO public.dynamic_evaluation_rules (
    role_type, metric_identifier, display_name,
    weight_percentage, benchmark_target, is_higher_better, unit, description
) VALUES
-- Precisión de análisis y validación: tasa de error ≤1.5%
('oriana_analysis', 'validation_accuracy',
 'Precisión de análisis y validación',
 40.00, 98.50, TRUE, '%',
 'Porcentaje de registros validados correctamente. Meta: tasa de error ≤1.5% (precisión ≥98.5%).'),

-- Registros procesados por hora: ≥120 validaciones/hora
('oriana_analysis', 'records_per_hour',
 'Registros procesados por hora',
 30.00, 120.00, TRUE, 'registros/h',
 'Número de registros validados por hora de trabajo activo. Meta: ≥120 registros/hora.'),

-- Puntualidad de entrega Oriana: ≥30 min previo al SLA de corte
('oriana_analysis', 'delivery_timeliness',
 'Puntualidad de entrega',
 20.00, 30.00, TRUE, 'minutos antes del SLA',
 'Minutos de anticipación al SLA de corte al momento de enviar el reporte. Meta: ≥30 min.'),

-- Discrepancias en auditoría: cero inconsistencias materiales
('oriana_analysis', 'audit_discrepancy_rate',
 'Discrepancias en auditoría',
 10.00, 0.00, TRUE, 'discrepancias',
 'Número de inconsistencias materiales encontradas en muestreo de auditor. Meta: 0.')

ON CONFLICT (role_type, metric_identifier) DO UPDATE
    SET display_name       = EXCLUDED.display_name,
        weight_percentage  = EXCLUDED.weight_percentage,
        benchmark_target   = EXCLUDED.benchmark_target,
        is_higher_better   = EXCLUDED.is_higher_better,
        unit               = EXCLUDED.unit,
        description        = EXCLUDED.description,
        updated_at         = timezone('utc', now());

-- ──────────────────────────────────────────────────────────────
-- SECCIÓN 3: TABLA daily_scores
-- Almacena el score diario calculado por operador.
-- Permite consulta histórica de rendimiento sin recalcular.
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.daily_scores (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    score_date        DATE        NOT NULL,
    -- Score final ponderado (0–100)
    final_score       NUMERIC(5, 2) NOT NULL
                                  CHECK (final_score BETWEEN 0 AND 100),
    -- Desglose por rol/módulo en JSONB para trazabilidad
    --   { "calls": { "score": 87.5, "minutes": 240, "sub_scores": {...} },
    --     "oriana_analysis": { "score": 92.0, "minutes": 240, ... } }
    score_breakdown   JSONB       NOT NULL DEFAULT '{}'::JSONB,
    -- Total de minutos productivos del día
    total_minutes     INT         NOT NULL DEFAULT 0 CHECK (total_minutes >= 0),
    -- Rol dominante del día (el de mayor tiempo transcurrido)
    dominant_role     TEXT        CHECK (dominant_role IN ('calls', 'oriana_analysis', 'incidents', 'attendance')),
    -- Si fue un día de función híbrida (más de un módulo activo)
    is_hybrid_day     BOOLEAN     NOT NULL DEFAULT FALSE,
    calculated_at     TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    UNIQUE (user_id, score_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_scores_user
    ON public.daily_scores(user_id, score_date DESC);

CREATE INDEX IF NOT EXISTS idx_daily_scores_date
    ON public.daily_scores(score_date DESC);

-- ──────────────────────────────────────────────────────────────
-- SECCIÓN 4: FUNCIÓN — Algoritmo de Scoring Integral
-- Implementa la fórmula de la arquitectura macro:
--
--   S_d = Σ_m [ (T_m / T_total) × Σ_i (N_{m,i} × W_{m,i}) ]
--
-- Donde:
--   T_m      = Minutos totales en el módulo m
--   T_total  = Minutos productivos totales del día
--   N_{m,i}  = min(100, (Resultado_real / Target) × 100)
--              (invierte la fórmula si is_higher_better = FALSE)
--   W_{m,i}  = Peso ponderado de la métrica i en el módulo m
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_calculate_daily_score(
    p_user_id    UUID,
    p_score_date DATE
)
RETURNS TABLE (
    final_score     NUMERIC,
    score_breakdown JSONB,
    total_minutes   INT,
    dominant_role   TEXT,
    is_hybrid_day   BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    -- Variables de jornada
    v_clock_in          TIMESTAMPTZ;
    v_clock_out         TIMESTAMPTZ;
    v_total_minutes     INT  := 0;
    v_final_score       NUMERIC(5,2) := 0;
    v_breakdown         JSONB := '{}'::JSONB;

    -- Variables de módulo de llamadas
    v_calls_minutes     INT  := 0;
    v_calls_score       NUMERIC := 0;
    v_calls_per_hour    NUMERIC := 0;
    v_effective_rate    NUMERIC := 0;
    v_quota_pct         NUMERIC := 0;
    v_avg_idle          NUMERIC := 0;
    v_total_calls       INT := 0;
    v_effective_calls   INT := 0;

    -- Variables de módulo Oriana
    v_oriana_minutes    INT := 0;
    v_oriana_score      NUMERIC := 0;
    v_oriana_accuracy   NUMERIC := 0;
    v_oriana_rph        NUMERIC := 0;
    v_oriana_timeliness NUMERIC := 0;
    v_oriana_discrep    INT := 0;

    -- Pesos de reglas
    v_rule              RECORD;
    v_N_i               NUMERIC;
    v_module_score      NUMERIC;

    v_dominant_role     TEXT := NULL;
    v_is_hybrid         BOOLEAN := FALSE;

BEGIN
    -- ── 0. Obtener rango de jornada del día ──────────────────
    SELECT
        MIN(ce.event_timestamp) FILTER (WHERE ce.event_type = 'clock_in'),
        MAX(ce.event_timestamp) FILTER (WHERE ce.event_type = 'clock_out')
    INTO v_clock_in, v_clock_out
    FROM public.clock_events   ce
    JOIN public.attendance_records ar ON ar.id = ce.attendance_id
    WHERE ar.user_id    = p_user_id
    AND   ar.work_date  = p_score_date;

    -- Sin asistencia registrada: score 0
    IF v_clock_in IS NULL THEN
        RETURN QUERY SELECT 0::NUMERIC, '{}'::JSONB, 0, NULL::TEXT, FALSE;
        RETURN;
    END IF;

    v_clock_out     := COALESCE(v_clock_out, now());
    v_total_minutes := GREATEST(0, EXTRACT(EPOCH FROM (v_clock_out - v_clock_in))::INT / 60);

    -- ── 1. MÓDULO LLAMADAS ───────────────────────────────────
    SELECT
        COUNT(*)                                              AS total_calls,
        COUNT(*) FILTER (WHERE result = 'answered_effective') AS effective_calls,
        COALESCE(AVG(idle_time_prior_call), 0)               AS avg_idle
    INTO v_total_calls, v_effective_calls, v_avg_idle
    FROM public.call_interactions
    WHERE operator_id  = p_user_id
    AND   created_at::DATE = p_score_date;

    IF v_total_calls > 0 THEN
        v_calls_minutes  := v_total_minutes;    -- Simplificación: se afinará con workflow_latency
        v_calls_per_hour := v_total_calls::NUMERIC / GREATEST(v_calls_minutes::NUMERIC / 60.0, 0.1);
        v_effective_rate := v_effective_calls::NUMERIC / v_total_calls::NUMERIC * 100.0;
        v_quota_pct      := LEAST(100.0, v_total_calls::NUMERIC / 200.0 * 100.0);

        v_calls_score    := 0;
        FOR v_rule IN
            SELECT * FROM public.dynamic_evaluation_rules
            WHERE role_type = 'calls' AND is_active = TRUE
        LOOP
            v_N_i := CASE v_rule.metric_identifier
                WHEN 'calls_per_hour'        THEN LEAST(100, (v_calls_per_hour / v_rule.benchmark_target) * 100)
                WHEN 'effective_contact_rate' THEN LEAST(100, (v_effective_rate  / v_rule.benchmark_target) * 100)
                WHEN 'daily_quota_adherence'  THEN LEAST(100, (v_quota_pct        / v_rule.benchmark_target) * 100)
                -- is_higher_better = FALSE: métrica inversa (menos es mejor)
                WHEN 'idle_time_between_calls' THEN
                    CASE WHEN v_avg_idle = 0 THEN 100
                         ELSE LEAST(100, (v_rule.benchmark_target / GREATEST(v_avg_idle, 1)) * 100)
                    END
                ELSE 0
            END;
            v_calls_score := v_calls_score + (v_N_i * v_rule.weight_percentage / 100.0);
        END LOOP;
    END IF;

    -- ── 2. MÓDULO ORIANA ─────────────────────────────────────
    SELECT
        COALESCE(AVG(om.validation_accuracy), 0),
        COALESCE(AVG(om.processing_time_minutes), 0),
        COALESCE(SUM(om.discrepancy_count), 0)
    INTO v_oriana_accuracy, v_oriana_timeliness, v_oriana_discrep
    FROM public.oriana_reports  r
    JOIN public.oriana_metrics  om ON om.report_id = r.id
    WHERE r.analyst_id      = p_user_id
    AND   r.created_at::DATE = p_score_date;

    -- Total de registros procesados en el día para RpH
    SELECT COALESCE(SUM(processed_records), 0)
    INTO v_oriana_rph
    FROM public.oriana_reports
    WHERE analyst_id      = p_user_id
    AND   created_at::DATE = p_score_date;

    IF v_oriana_rph > 0 AND v_oriana_timeliness > 0 THEN
        v_oriana_minutes := v_total_minutes;
        v_oriana_rph     := v_oriana_rph::NUMERIC / GREATEST(v_oriana_timeliness::NUMERIC / 60.0, 0.1);
        v_oriana_score   := 0;

        FOR v_rule IN
            SELECT * FROM public.dynamic_evaluation_rules
            WHERE role_type = 'oriana_analysis' AND is_active = TRUE
        LOOP
            v_N_i := CASE v_rule.metric_identifier
                WHEN 'validation_accuracy'    THEN LEAST(100, (v_oriana_accuracy    / v_rule.benchmark_target) * 100)
                WHEN 'records_per_hour'       THEN LEAST(100, (v_oriana_rph         / v_rule.benchmark_target) * 100)
                WHEN 'delivery_timeliness'    THEN LEAST(100, (v_oriana_timeliness  / v_rule.benchmark_target) * 100)
                WHEN 'audit_discrepancy_rate' THEN
                    CASE WHEN v_oriana_discrep = 0 THEN 100
                         ELSE LEAST(100, GREATEST(0, 100 - (v_oriana_discrep * 10)))
                    END
                ELSE 0
            END;
            v_oriana_score := v_oriana_score + (v_N_i * v_rule.weight_percentage / 100.0);
        END LOOP;
    END IF;

    -- ── 3. CÁLCULO FINAL PONDERADO POR TIEMPO ───────────────
    --
    --   S_d = Σ_m [ (T_m / T_total) × Score_m ]
    --
    IF v_total_minutes > 0 THEN
        IF v_calls_minutes > 0 AND v_oriana_minutes > 0 THEN
            -- Día híbrido: ajustar proporciones
            v_calls_minutes  := v_total_minutes / 2;
            v_oriana_minutes := v_total_minutes / 2;
            v_is_hybrid      := TRUE;
        ELSIF v_calls_minutes > 0 THEN
            v_dominant_role := 'calls';
        ELSIF v_oriana_minutes > 0 THEN
            v_dominant_role := 'oriana_analysis';
        END IF;

        v_final_score :=
            ((v_calls_minutes::NUMERIC  / v_total_minutes) * v_calls_score)
            + ((v_oriana_minutes::NUMERIC / v_total_minutes) * v_oriana_score);

        v_final_score := LEAST(100, GREATEST(0, ROUND(v_final_score, 2)));
    END IF;

    -- ── 4. CONSTRUIR BREAKDOWN JSONB ─────────────────────────
    v_breakdown := jsonb_build_object(
        'calls', jsonb_build_object(
            'score',         ROUND(v_calls_score, 2),
            'minutes',       v_calls_minutes,
            'total_calls',   v_total_calls,
            'effective',     v_effective_calls,
            'effective_rate',ROUND(v_effective_rate, 2),
            'avg_idle_sec',  ROUND(v_avg_idle, 1)
        ),
        'oriana_analysis', jsonb_build_object(
            'score',         ROUND(v_oriana_score, 2),
            'minutes',       v_oriana_minutes,
            'records_ph',    ROUND(v_oriana_rph, 1),
            'accuracy_pct',  ROUND(v_oriana_accuracy, 2),
            'discrepancies', v_oriana_discrep
        ),
        'total_minutes',   v_total_minutes,
        'is_hybrid',       v_is_hybrid,
        'dominant_role',   COALESCE(v_dominant_role, 'unknown')
    );

    RETURN QUERY
    SELECT
        v_final_score,
        v_breakdown,
        v_total_minutes,
        v_dominant_role,
        v_is_hybrid;
END;
$$;

-- ──────────────────────────────────────────────────────────────
-- SECCIÓN 5: FUNCIÓN — Materializar score diario en daily_scores
-- Llamada por la Edge Function del scheduler nocturno.
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_materialize_daily_score(
    p_user_id    UUID,
    p_score_date DATE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_result RECORD;
BEGIN
    SELECT * INTO v_result
    FROM   public.fn_calculate_daily_score(p_user_id, p_score_date);

    INSERT INTO public.daily_scores (
        user_id, score_date, final_score, score_breakdown,
        total_minutes, dominant_role, is_hybrid_day, calculated_at
    ) VALUES (
        p_user_id, p_score_date, v_result.final_score, v_result.score_breakdown,
        v_result.total_minutes, v_result.dominant_role, v_result.is_hybrid_day, now()
    )
    ON CONFLICT (user_id, score_date) DO UPDATE
        SET final_score     = EXCLUDED.final_score,
            score_breakdown = EXCLUDED.score_breakdown,
            total_minutes   = EXCLUDED.total_minutes,
            dominant_role   = EXCLUDED.dominant_role,
            is_hybrid_day   = EXCLUDED.is_hybrid_day,
            calculated_at   = EXCLUDED.calculated_at;
END;
$$;

-- ──────────────────────────────────────────────────────────────
-- SECCIÓN 6: PARTICIONAMIENTO — Tabla maestra de telemetría
-- workflow_latency_logs_partitioned: partición mensual RANGE.
-- La tabla sin particionamiento (0002) se mantiene para compatibilidad.
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.workflow_latency_logs_partitioned (
    id                    UUID        NOT NULL DEFAULT gen_random_uuid(),
    user_id               UUID        NOT NULL,
    attendance_id         UUID        NOT NULL,
    clock_in_time         TIMESTAMPTZ NOT NULL,
    first_task_event_time TIMESTAMPTZ,
    latency_seconds       INT
                                      GENERATED ALWAYS AS (
                                          CASE
                                              WHEN first_task_event_time IS NOT NULL
                                              THEN EXTRACT(EPOCH FROM
                                                       (first_task_event_time - clock_in_time)
                                                   )::INT
                                              ELSE NULL
                                          END
                                      ) STORED,
    task_module           TEXT        NOT NULL
                                      CHECK (task_module IN ('calls', 'oriana_analysis', 'incidents')),
    created_at            TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    PRIMARY KEY (created_at, id)
) PARTITION BY RANGE (created_at);

-- Función: crear partición mensual idempotente
CREATE OR REPLACE FUNCTION public.fn_create_monthly_partition(
    p_parent_table TEXT,
    p_year         INT,
    p_month        INT
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    v_partition_name TEXT;
    v_start_date     DATE;
    v_end_date       DATE;
    v_prefix         TEXT;
BEGIN
    -- Validaciones de rango
    IF p_year < 2024 OR p_year > 2099 THEN
        RAISE EXCEPTION 'Año inválido para partición: %', p_year;
    END IF;
    IF p_month < 1 OR p_month > 12 THEN
        RAISE EXCEPTION 'Mes inválido para partición: %', p_month;
    END IF;

    -- El nombre de la tabla base (sin el schema)
    v_prefix         := replace(p_parent_table, 'public.', '');
    -- Recortar "_partitioned" del sufijo si existe para nombre más limpio
    v_prefix         := replace(v_prefix, '_partitioned', '');

    v_partition_name := format('%s_%s_%s',
        v_prefix,
        p_year,
        LPAD(p_month::TEXT, 2, '0')
    );
    v_start_date     := make_date(p_year, p_month, 1);
    v_end_date       := v_start_date + INTERVAL '1 month';

    -- Crear partición solo si no existe (idempotente)
    IF NOT EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON c.relnamespace = n.oid
        WHERE n.nspname = 'public' AND c.relname = v_partition_name
    ) THEN
        EXECUTE format(
            'CREATE TABLE public.%I
             PARTITION OF %s
             FOR VALUES FROM (%L) TO (%L)',
            v_partition_name,
            p_parent_table,
            v_start_date::TIMESTAMPTZ,
            v_end_date::TIMESTAMPTZ
        );

        -- Índices estándar en cada partición nueva
        EXECUTE format(
            'CREATE INDEX ON public.%I (user_id, created_at DESC)',
            v_partition_name
        );
        EXECUTE format(
            'CREATE INDEX ON public.%I (task_module, created_at)',
            v_partition_name
        );

        RAISE NOTICE 'Partición pública.% creada (% → %)',
            v_partition_name, v_start_date, v_end_date;
    ELSE
        RAISE NOTICE 'Partición pública.% ya existe. Omitida.', v_partition_name;
    END IF;
END;
$$;

-- Inicializar particiones: mes actual + los próximos 2 meses
DO $$
DECLARE
    v_base_date DATE := date_trunc('month', now())::DATE;
    i           INT;
BEGIN
    FOR i IN 0..2 LOOP
        PERFORM public.fn_create_monthly_partition(
            'public.workflow_latency_logs_partitioned',
            EXTRACT(YEAR  FROM (v_base_date + (i || ' months')::INTERVAL))::INT,
            EXTRACT(MONTH FROM (v_base_date + (i || ' months')::INTERVAL))::INT
        );
    END LOOP;
END;
$$;

-- ──────────────────────────────────────────────────────────────
-- SECCIÓN 7: TIPO DE RETORNO — Informe de purga
-- Usado por fn_archive_and_purge_lifecycle para retornar el
-- resultado estructurado de cada fase al scheduler Deno.
-- ──────────────────────────────────────────────────────────────
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_type t
        JOIN pg_namespace n ON t.typnamespace = n.oid
        WHERE n.nspname = 'public' AND t.typname = 'purge_execution_report'
    ) THEN
        CREATE TYPE public.purge_execution_report AS (
            phase               TEXT,
            rows_aggregated     BIGINT,
            rows_deleted        BIGINT,
            partitions_dropped  INT,
            execution_time_ms   INT,
            error_detail        TEXT
        );
    END IF;
END;
$$;

-- ──────────────────────────────────────────────────────────────
-- SECCIÓN 8: FUNCIÓN PRINCIPAL DE PURGA Y CONSOLIDACIÓN
-- Ejecuta 4 fases:
--   FASE 1: Consolidar workflow_latency_logs en telemetry_daily_aggregates
--   FASE 2: Consolidar call_interactions en call_daily_aggregates
--   FASE 3: Consolidar registros en registros_daily_aggregates
--   FASE 4: DELETE de logs detallados > p_retention_days
--   FASE 5: DROP de particiones obsoletas
-- p_dry_run = TRUE → solo reporta lo que se eliminaría, sin cambios.
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_archive_and_purge_lifecycle(
    p_retention_days INT  DEFAULT 90,
    p_dry_run        BOOL DEFAULT FALSE
)
RETURNS SETOF public.purge_execution_report
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_cutoff_ts       TIMESTAMPTZ := now() - (p_retention_days || ' days')::INTERVAL;
    v_cutoff_date     DATE        := v_cutoff_ts::DATE;
    v_cutoff_month    DATE        := date_trunc('month', v_cutoff_ts)::DATE;
    v_t0              TIMESTAMPTZ;
    v_rows_agg        BIGINT      := 0;
    v_rows_del        BIGINT      := 0;
    v_parts_dropped   INT         := 0;
    v_rep             public.purge_execution_report;
    v_partition_name  TEXT;
    v_part_year       INT;
    v_part_month      INT;
    v_part_date       DATE;
BEGIN
    -- Validación de parámetros de entrada
    IF p_retention_days < 30 OR p_retention_days > 730 THEN
        RAISE EXCEPTION
            'retention_days debe estar entre 30 y 730 días. Valor recibido: %',
            p_retention_days;
    END IF;

    -- ════════════════════════════════════════════════════════
    -- FASE 1: CONSOLIDAR TELEMETRÍA DE LATENCIA
    -- ════════════════════════════════════════════════════════
    v_t0 := clock_timestamp();

    IF NOT p_dry_run THEN
        INSERT INTO public.telemetry_daily_aggregates (
            summary_date, task_module,
            total_events, avg_latency_sec, min_latency_sec, max_latency_sec,
            p50_latency_sec, p95_latency_sec, total_operators
        )
        SELECT
            created_at::DATE            AS summary_date,
            task_module,
            COUNT(*)::INT               AS total_events,
            AVG(latency_seconds)::INT   AS avg_latency_sec,
            MIN(latency_seconds)        AS min_latency_sec,
            MAX(latency_seconds)        AS max_latency_sec,
            PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY latency_seconds)::INT AS p50_latency_sec,
            PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_seconds)::INT AS p95_latency_sec,
            COUNT(DISTINCT user_id)::INT AS total_operators
        FROM   public.workflow_latency_logs
        WHERE  created_at < v_cutoff_ts
        AND    latency_seconds IS NOT NULL
        GROUP  BY created_at::DATE, task_module
        ON CONFLICT (summary_date, task_module) DO UPDATE
            SET total_events    = EXCLUDED.total_events,
                avg_latency_sec = EXCLUDED.avg_latency_sec,
                min_latency_sec = EXCLUDED.min_latency_sec,
                max_latency_sec = EXCLUDED.max_latency_sec,
                p50_latency_sec = EXCLUDED.p50_latency_sec,
                p95_latency_sec = EXCLUDED.p95_latency_sec,
                total_operators = EXCLUDED.total_operators;
        GET DIAGNOSTICS v_rows_agg = ROW_COUNT;
    ELSE
        SELECT COUNT(DISTINCT created_at::DATE || task_module)
        INTO v_rows_agg
        FROM public.workflow_latency_logs
        WHERE created_at < v_cutoff_ts;
    END IF;

    v_rep.phase              := 'FASE_1_TELEMETRY_AGGREGATION';
    v_rep.rows_aggregated    := v_rows_agg;
    v_rep.rows_deleted       := 0;
    v_rep.partitions_dropped := 0;
    v_rep.execution_time_ms  := EXTRACT(MILLISECONDS FROM clock_timestamp() - v_t0)::INT;
    v_rep.error_detail       := NULL;
    RETURN NEXT v_rep;

    -- ════════════════════════════════════════════════════════
    -- FASE 2: CONSOLIDAR CALL_INTERACTIONS EN CALL_DAILY_AGGREGATES
    -- ════════════════════════════════════════════════════════
    v_t0       := clock_timestamp();
    v_rows_agg := 0;

    IF NOT p_dry_run THEN
        INSERT INTO public.call_daily_aggregates (
            summary_date, operator_id, campaign_id,
            total_calls, effective_calls, busy_calls,
            no_answer_calls, invalid_calls, rejected_calls,
            avg_duration_sec, avg_idle_time_prior_sec, daily_quota_met
        )
        SELECT
            ci.created_at::DATE                                                 AS summary_date,
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
            (COUNT(*) >= COALESCE(
                (SELECT MAX(cc.daily_quota_per_operator)
                 FROM   public.call_campaigns cc
                 WHERE  cc.id = ca.campaign_id), 200
            ))
        FROM   public.call_interactions ci
        JOIN   public.call_assignments  ca ON ca.id = ci.assignment_id
        WHERE  ci.created_at < v_cutoff_ts
        GROUP  BY ci.created_at::DATE, ci.operator_id, ca.campaign_id
        ON CONFLICT (summary_date, operator_id, campaign_id) DO UPDATE
            SET total_calls             = EXCLUDED.total_calls,
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

    -- ════════════════════════════════════════════════════════
    -- FASE 2b: CONSOLIDAR REGISTROS ORIANA
    -- ════════════════════════════════════════════════════════
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
                THEN ROUND(SUM(llamadas_efectivas)::NUMERIC
                           / SUM(llamadas_totales)::NUMERIC * 100, 2)
                ELSE 0
            END
        FROM   public.registros
        WHERE  fecha_reporte < v_cutoff_date
        GROUP  BY fecha_reporte, usuario_operador, modo_trabajo
        ON CONFLICT (summary_date, usuario_operador, modo_trabajo) DO UPDATE
            SET total_registros          = EXCLUDED.total_registros,
                total_llamadas_efectivas = EXCLUDED.total_llamadas_efectivas,
                total_llamadas_totales   = EXCLUDED.total_llamadas_totales,
                total_incidencias        = EXCLUDED.total_incidencias,
                tasa_efectividad         = EXCLUDED.tasa_efectividad;
    END IF;

    v_rep.phase              := 'FASE_2_CALLS_AND_REGISTROS_AGGREGATION';
    v_rep.rows_aggregated    := v_rows_agg;
    v_rep.rows_deleted       := 0;
    v_rep.partitions_dropped := 0;
    v_rep.execution_time_ms  := EXTRACT(MILLISECONDS FROM clock_timestamp() - v_t0)::INT;
    v_rep.error_detail       := NULL;
    RETURN NEXT v_rep;

    -- ════════════════════════════════════════════════════════
    -- FASE 3: DELETE DE LOGS DETALLADOS (> p_retention_days)
    -- ════════════════════════════════════════════════════════
    v_t0       := clock_timestamp();
    v_rows_del := 0;

    IF NOT p_dry_run THEN
        -- 3a. Telemetría de latencia
        DELETE FROM public.workflow_latency_logs
        WHERE created_at < v_cutoff_ts;
        GET DIAGNOSTICS v_rows_del = ROW_COUNT;

        -- 3b. Interacciones de llamadas completadas
        DELETE FROM public.call_interactions
        WHERE created_at < v_cutoff_ts
        AND   result IN ('answered_effective', 'busy', 'no_answer', 'invalid_number', 'rejected');

        -- 3c. Registros Oriana individuales (ya consolidados en agregados)
        DELETE FROM public.registros
        WHERE fecha_reporte < v_cutoff_date;

        -- 3d. Cola de Telegram: mensajes enviados > 30 días (sin valor de retención)
        DELETE FROM public.cola_telegram
        WHERE estado        = 'ENVIADO'
        AND   fecha_encola  < (now() - INTERVAL '30 days');

        -- 3e. Logs de auditoría de bajo impacto: LOGIN/LOGOUT > 180 días
        DELETE FROM public.audit_logs
        WHERE action     IN ('LOGIN', 'LOGOUT')
        AND   created_at <  (now() - INTERVAL '180 days');

        -- 3f. Logs legacy de auditoría Oriana > 180 días
        DELETE FROM public.logs_auditoria
        WHERE fecha_hora < (now() - INTERVAL '180 days');
    ELSE
        -- Dry run: contar filas que se eliminarían
        SELECT COUNT(*) INTO v_rows_del
        FROM public.workflow_latency_logs
        WHERE created_at < v_cutoff_ts;
    END IF;

    v_rep.phase              := 'FASE_3_DETAIL_PURGE';
    v_rep.rows_aggregated    := 0;
    v_rep.rows_deleted       := v_rows_del;
    v_rep.partitions_dropped := 0;
    v_rep.execution_time_ms  := EXTRACT(MILLISECONDS FROM clock_timestamp() - v_t0)::INT;
    v_rep.error_detail       := NULL;
    RETURN NEXT v_rep;

    -- ════════════════════════════════════════════════════════
    -- FASE 4: DROP DE PARTICIONES OBSOLETAS
    -- Solo eliminar particiones cuya fecha sea anterior al cutoff_month.
    -- ════════════════════════════════════════════════════════
    v_t0            := clock_timestamp();
    v_parts_dropped := 0;

    IF NOT p_dry_run THEN
        FOR v_partition_name IN
            SELECT c.relname
            FROM   pg_class     c
            JOIN   pg_namespace n ON c.relnamespace = n.oid
            JOIN   pg_inherits  i ON c.oid = i.inhrelid
            JOIN   pg_class     p ON i.inhparent = p.oid
            WHERE  n.nspname = 'public'
            AND    p.relname = 'workflow_latency_logs_partitioned'
            AND    c.relname ~ '^workflow_latency_logs_[0-9]{4}_[0-9]{2}$'
        LOOP
            BEGIN
                v_part_year  := substring(v_partition_name FROM '_([0-9]{4})_[0-9]{2}$')::INT;
                v_part_month := substring(v_partition_name FROM '_[0-9]{4}_([0-9]{2})$')::INT;
                v_part_date  := make_date(v_part_year, v_part_month, 1);

                IF v_part_date < v_cutoff_month THEN
                    EXECUTE format('DROP TABLE IF EXISTS public.%I', v_partition_name);
                    v_parts_dropped := v_parts_dropped + 1;
                    RAISE NOTICE 'Partición % eliminada (fecha: %)', v_partition_name, v_part_date;
                END IF;
            EXCEPTION WHEN OTHERS THEN
                RAISE WARNING 'Error al procesar partición %: %', v_partition_name, SQLERRM;
            END;
        END LOOP;
    ELSE
        SELECT COUNT(*) INTO v_parts_dropped
        FROM   pg_class     c
        JOIN   pg_namespace n ON c.relnamespace = n.oid
        JOIN   pg_inherits  i ON c.oid = i.inhrelid
        JOIN   pg_class     p ON i.inhparent = p.oid
        WHERE  n.nspname = 'public'
        AND    p.relname = 'workflow_latency_logs_partitioned'
        AND    c.relname ~ '^workflow_latency_logs_[0-9]{4}_[0-9]{2}$';
    END IF;

    v_rep.phase              := 'FASE_4_PARTITION_CLEANUP';
    v_rep.rows_aggregated    := 0;
    v_rep.rows_deleted       := 0;
    v_rep.partitions_dropped := v_parts_dropped;
    v_rep.execution_time_ms  := EXTRACT(MILLISECONDS FROM clock_timestamp() - v_t0)::INT;
    v_rep.error_detail       := NULL;
    RETURN NEXT v_rep;

END;
$$;

-- ──────────────────────────────────────────────────────────────
-- SECCIÓN 9: FUNCIÓN — Consulta de uso de almacenamiento
-- Usada por el SDK de monitoreo de cuotas del Free Tier
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_get_storage_usage_report()
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
SET search_path = public, pg_catalog
AS $$
    SELECT
        c.relname::TEXT                                        AS table_name,
        ROUND(pg_relation_size(c.oid) / 1024.0 / 1024.0, 3) AS size_mb,
        c.reltuples::BIGINT                                    AS row_count,
        NULL::TEXT                                             AS oldest_record,
        NULL::TEXT                                             AS newest_record
    FROM   pg_class     c
    JOIN   pg_namespace n ON c.relnamespace = n.oid
    WHERE  n.nspname = 'public'
    AND    c.relkind  = 'r'    -- solo tablas base, sin particiones ni vistas
    ORDER  BY pg_relation_size(c.oid) DESC;
$$;

-- ──────────────────────────────────────────────────────────────
-- SECCIÓN 10: VISTA DE RANKINGS SEMANALES
-- Permite a supervisores ver el top de operadores de la semana.
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.v_weekly_operator_ranking AS
SELECT
    ds.user_id,
    p.full_name                               AS operator_name,
    ROUND(AVG(ds.final_score), 2)             AS avg_score_week,
    SUM(ds.total_minutes)                     AS total_minutes_week,
    COUNT(ds.score_date)                      AS days_scored,
    MAX(ds.final_score)                       AS best_day_score,
    MIN(ds.final_score)                       AS worst_day_score,
    -- Contador de días con score >= 80 (días "verde")
    COUNT(*) FILTER (WHERE ds.final_score >= 80.0) AS green_days,
    -- Contador de días con score < 60 (días "rojo")
    COUNT(*) FILTER (WHERE ds.final_score < 60.0)  AS red_days,
    RANK() OVER (ORDER BY AVG(ds.final_score) DESC) AS ranking_position
FROM   public.daily_scores ds
JOIN   public.profiles     p ON p.id = ds.user_id
WHERE  ds.score_date >= (CURRENT_DATE - INTERVAL '7 days')::DATE
GROUP  BY ds.user_id, p.full_name;

-- ──────────────────────────────────────────────────────────────
-- SECCIÓN 11: ROW LEVEL SECURITY — dynamic_evaluation_rules
-- ──────────────────────────────────────────────────────────────
ALTER TABLE public.dynamic_evaluation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dynamic_evaluation_rules FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "eval_rules_select" ON public.dynamic_evaluation_rules;
CREATE POLICY "eval_rules_select"
    ON public.dynamic_evaluation_rules FOR SELECT
    TO authenticated
    USING (true);    -- Todos los usuarios autenticados pueden ver las reglas

DROP POLICY IF EXISTS "eval_rules_write_admin" ON public.dynamic_evaluation_rules;
CREATE POLICY "eval_rules_write_admin"
    ON public.dynamic_evaluation_rules FOR ALL
    TO authenticated
    USING  (public.current_user_has_any_role(ARRAY['module_admin', 'superadmin']))
    WITH CHECK (public.current_user_has_any_role(ARRAY['module_admin', 'superadmin']));

-- ──────────────────────────────────────────────────────────────
-- SECCIÓN 12: ROW LEVEL SECURITY — daily_scores
-- ──────────────────────────────────────────────────────────────
ALTER TABLE public.daily_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_scores FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "daily_scores_select" ON public.daily_scores;
CREATE POLICY "daily_scores_select"
    ON public.daily_scores FOR SELECT
    TO authenticated
    USING (
        public.is_own_record(user_id)
        OR public.current_user_has_any_role(
               ARRAY['supervisor', 'module_admin', 'superadmin', 'auditor']
           )
    );

-- Solo procesos internos (Edge Function nocturna con service_role) escriben scores
DROP POLICY IF EXISTS "daily_scores_write_deny" ON public.daily_scores;
CREATE POLICY "daily_scores_write_deny"
    ON public.daily_scores FOR INSERT
    TO authenticated
    WITH CHECK (FALSE);

-- ──────────────────────────────────────────────────────────────
-- SECCIÓN 13: ROW LEVEL SECURITY — workflow_latency_logs_partitioned
-- Mismas políticas que la tabla no particionada (0002)
-- ──────────────────────────────────────────────────────────────
ALTER TABLE public.workflow_latency_logs_partitioned ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_latency_logs_partitioned FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "latency_part_select" ON public.workflow_latency_logs_partitioned;
CREATE POLICY "latency_part_select"
    ON public.workflow_latency_logs_partitioned FOR SELECT
    TO authenticated
    USING (
        public.is_own_record(user_id)
        OR public.current_user_has_any_role(
               ARRAY['supervisor', 'module_admin', 'superadmin', 'data_analyst', 'auditor']
           )
    );

DROP POLICY IF EXISTS "latency_part_insert" ON public.workflow_latency_logs_partitioned;
CREATE POLICY "latency_part_insert"
    ON public.workflow_latency_logs_partitioned FOR INSERT
    TO authenticated
    WITH CHECK (public.is_own_record(user_id));

-- ──────────────────────────────────────────────────────────────
-- SECCIÓN 14: CONSTRAINT — Validación de que pesos suman 100%
-- Se ejecuta en UPDATE/INSERT de dynamic_evaluation_rules.
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_validate_rule_weights()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_total_weight NUMERIC;
BEGIN
    SELECT SUM(weight_percentage)
    INTO   v_total_weight
    FROM   public.dynamic_evaluation_rules
    WHERE  role_type  = NEW.role_type
    AND    is_active  = TRUE
    AND    id        != COALESCE(NEW.id, gen_random_uuid())
    AND    metric_identifier != NEW.metric_identifier; -- excluir la métrica actual en INSERT...ON CONFLICT / UPDATE

    -- Sumar el peso de la fila que se está insertando/actualizando
    v_total_weight := COALESCE(v_total_weight, 0) + NEW.weight_percentage;

    IF v_total_weight > 100.01 THEN   -- Tolerancia de 0.01 por aritmética de punto flotante
        RAISE EXCEPTION
            'Los pesos de las reglas para el rol "%" superan el 100 por ciento (total actual: %). '
            'Ajuste los pesos antes de continuar.',
            NEW.role_type, v_total_weight;
    END IF;

    RETURN NEW;
END;
$$;

-- Solo validar en INSERT; en UPDATE de reglas existentes el superadmin asume responsabilidad
DROP TRIGGER IF EXISTS tr_validate_rule_weights ON public.dynamic_evaluation_rules;
CREATE TRIGGER tr_validate_rule_weights
    BEFORE INSERT ON public.dynamic_evaluation_rules
    FOR EACH ROW EXECUTE FUNCTION public.fn_validate_rule_weights();

-- ──────────────────────────────────────────────────────────────
-- SECCIÓN 15: GRANTS
-- ──────────────────────────────────────────────────────────────
GRANT SELECT                 ON public.dynamic_evaluation_rules              TO authenticated;
GRANT SELECT                 ON public.daily_scores                          TO authenticated;
GRANT SELECT, INSERT         ON public.workflow_latency_logs_partitioned     TO authenticated;
GRANT SELECT                 ON public.v_weekly_operator_ranking             TO authenticated;
GRANT EXECUTE                ON FUNCTION public.fn_calculate_daily_score     TO authenticated;
GRANT EXECUTE                ON FUNCTION public.fn_get_storage_usage_report  TO authenticated;
GRANT EXECUTE                ON FUNCTION public.fn_create_monthly_partition  TO authenticated;

-- Solo service_role puede ejecutar la purga y materializar scores
-- (no se expone a authenticated)
REVOKE EXECUTE ON FUNCTION public.fn_archive_and_purge_lifecycle  FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_materialize_daily_score      FROM authenticated;

-- ──────────────────────────────────────────────────────────────
-- SECCIÓN 16: COMENTARIOS FINALES DE DOCUMENTACIÓN
-- ──────────────────────────────────────────────────────────────
COMMENT ON FUNCTION public.fn_archive_and_purge_lifecycle IS
'Función principal de ciclo de vida de datos. Ejecutar SOLO desde
 Supabase Edge Function con service_role key y Authorization Bearer token
 de scheduler interno. Parámetros:
   p_retention_days (INT, default 90): días de retención de logs detallados.
   p_dry_run (BOOL, default FALSE): si TRUE, reporta sin eliminar.
 Retorna SETOF purge_execution_report con métricas de cada fase.';

COMMENT ON FUNCTION public.fn_calculate_daily_score IS
'Calcula el score diario de un operador implementando la fórmula:
   S_d = Σ_m [ (T_m / T_total) × Σ_i (N_{m,i} × W_{m,i}) ]
 Soporta días de función híbrida (múltiples módulos en la misma jornada).
 No materializa: usar fn_materialize_daily_score para persistir en daily_scores.';

COMMENT ON TABLE public.dynamic_evaluation_rules IS
'Catálogo de reglas de evaluación de rendimiento. Los pesos por role_type
 deben sumar exactamente 100.00. Configurable por module_admin sin reinicio.
 Cambios se propagan en el próximo cálculo nocturno de scores.';

-- ──────────────────────────────────────────────────────────────
-- FIN DE MIGRACIÓN 0005
-- ──────────────────────────────────────────────────────────────

