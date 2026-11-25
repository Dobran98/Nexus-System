import psycopg2

conn = psycopg2.connect('postgresql://postgres.pzkqjdkphcwmblbyorbr:yfcLIxzEWObS4Dio@aws-0-us-east-1.pooler.supabase.com:6543/postgres')
cur = conn.cursor()

print("==> Instalando funciones de Purga Nocturna & Ciclo de Vida de Base de Datos (Fase 12)...")

sql_lifecycle = """
-- ──────────────────────────────────────────────────────────────
-- TIPO: purge_execution_report
-- ──────────────────────────────────────────────────────────────
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'purge_execution_report') THEN
        CREATE TYPE public.purge_execution_report AS (
            phase                TEXT,
            rows_aggregated      BIGINT,
            rows_deleted         BIGINT,
            partitions_dropped   INT,
            execution_time_ms    INT,
            error_detail         TEXT
        );
    END IF;
END $$;

-- ──────────────────────────────────────────────────────────────
-- FUNCIÓN: nexus_get_database_storage_stats
-- Retorna el tamaño actual de la base de datos, porcentaje de 500MB
-- y el top de tablas más pesadas para monitoreo del Free Tier.
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.nexus_get_database_storage_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_db_size_bytes BIGINT;
    v_db_size_pretty TEXT;
    v_quota_bytes BIGINT := 524288000; -- 500 MB Free Tier
    v_usage_pct NUMERIC;
    v_tables JSONB;
BEGIN
    v_db_size_bytes := pg_database_size(current_database());
    v_db_size_pretty := pg_size_pretty(v_db_size_bytes);
    v_usage_pct := ROUND((v_db_size_bytes::NUMERIC / v_quota_bytes::NUMERIC) * 100.0, 2);

    SELECT COALESCE(jsonb_agg(t_row), '[]'::jsonb) INTO v_tables
    FROM (
        SELECT 
            table_name,
            total_bytes,
            pg_size_pretty(total_bytes) as total_size,
            approx_rows
        FROM (
            SELECT 
                c.relname as table_name,
                pg_total_relation_size(c.oid) as total_bytes,
                c.reltuples::bigint as approx_rows
            FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public'
            AND c.relkind = 'r'
            ORDER BY total_bytes DESC
            LIMIT 10
        ) sub
    ) t_row;

    RETURN jsonb_build_object(
        'database_size_bytes', v_db_size_bytes,
        'database_size_pretty', v_db_size_pretty,
        'quota_bytes', v_quota_bytes,
        'quota_pretty', '500 MB',
        'usage_percentage', v_usage_pct,
        'status', CASE 
            WHEN v_usage_pct >= 85.0 THEN 'CRITICAL'
            WHEN v_usage_pct >= 70.0 THEN 'WARNING'
            ELSE 'HEALTHY'
        END,
        'largest_tables', v_tables,
        'checked_at', timezone('utc', now())
    );
END;
$$;

-- ──────────────────────────────────────────────────────────────
-- FUNCIÓN: archive_and_purge_lifecycle
-- Ejecuta la consolidación y purga de registros > retention_days
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.archive_and_purge_lifecycle(
    p_retention_days     INT  DEFAULT 90,
    p_dry_run            BOOL DEFAULT FALSE
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
    v_report             public.purge_execution_report;
BEGIN
    -- FASE 1: CONSOLIDAR REGISTROS ORIANA > RETENTION_DAYS
    v_start_time := clock_timestamp();
    v_rows_agg := 0;

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

        GET DIAGNOSTICS v_rows_agg = ROW_COUNT;
    ELSE
        SELECT COUNT(*) INTO v_rows_agg
        FROM public.registros
        WHERE fecha_reporte < v_cutoff_date_only;
    END IF;

    v_report.phase              := 'PHASE_1_ORIANA_AGGREGATION';
    v_report.rows_aggregated    := v_rows_agg;
    v_report.rows_deleted       := 0;
    v_report.partitions_dropped := 0;
    v_report.execution_time_ms  := EXTRACT(MILLISECONDS FROM clock_timestamp() - v_start_time)::INT;
    v_report.error_detail       := NULL;
    RETURN NEXT v_report;

    -- FASE 2: PURGA DE COLA DE TELEGRAM Y NOTIFICACIONES EXPIRADAS
    v_start_time := clock_timestamp();
    v_rows_del   := 0;

    IF NOT p_dry_run THEN
        DELETE FROM public.cola_telegram
        WHERE estado = 'ENVIADO'
        AND fecha_encola < (now() - INTERVAL '30 days');
        GET DIAGNOSTICS v_rows_del = ROW_COUNT;

        -- Purgar notificaciones leídas > 60 días
        DELETE FROM public.nexus_notificaciones
        WHERE leida = true
        AND created_at < (now() - INTERVAL '60 days');
    ELSE
        SELECT COUNT(*) INTO v_rows_del
        FROM public.cola_telegram
        WHERE estado = 'ENVIADO'
        AND fecha_encola < (now() - INTERVAL '30 days');
    END IF;

    v_report.phase              := 'PHASE_2_NOTIFICATIONS_AND_TELEGRAM_PURGE';
    v_report.rows_aggregated    := 0;
    v_report.rows_deleted       := v_rows_del;
    v_report.partitions_dropped := 0;
    v_report.execution_time_ms  := EXTRACT(MILLISECONDS FROM clock_timestamp() - v_start_time)::INT;
    v_report.error_detail       := NULL;
    RETURN NEXT v_report;

    -- FASE 3: PURGA DE AUDIT LOGS ANTIGUOS (> 180 DÍAS)
    v_start_time := clock_timestamp();
    v_rows_del := 0;

    IF NOT p_dry_run THEN
        DELETE FROM public.audit_logs
        WHERE created_at < (now() - INTERVAL '180 days');
        GET DIAGNOSTICS v_rows_del = ROW_COUNT;
    ELSE
        SELECT COUNT(*) INTO v_rows_del
        FROM public.audit_logs
        WHERE created_at < (now() - INTERVAL '180 days');
    END IF;

    v_report.phase              := 'PHASE_3_AUDIT_LOGS_PURGE';
    v_report.rows_aggregated    := 0;
    v_report.rows_deleted       := v_rows_del;
    v_report.partitions_dropped := 0;
    v_report.execution_time_ms  := EXTRACT(MILLISECONDS FROM clock_timestamp() - v_start_time)::INT;
    v_report.error_detail       := NULL;
    RETURN NEXT v_report;

END;
$$;
"""

cur.execute(sql_lifecycle)
conn.commit()
print("==> Funciones SQL de Lifecycle instaladas exitosamente.")

# Probar estadísticas de almacenamiento
print("==> Consultando estadísticas de almacenamiento actual...")
cur.execute("SELECT public.nexus_get_database_storage_stats();")
stats = cur.fetchone()[0]
print(f"Tamaño DB: {stats['database_size_pretty']} / {stats['quota_pretty']} ({stats['usage_percentage']}%) - Estado: {stats['status']}")
print("Tablas más grandes:")
for t in stats['largest_tables'][:5]:
    print(f" - {t['table_name']}: {t['total_size']} (~{t['approx_rows']} filas)")

# Probar dry run de purga
print("==> Ejecutando dry-run de purga a 90 días...")
cur.execute("SELECT * FROM public.archive_and_purge_lifecycle(90, TRUE);")
for row in cur.fetchall():
    print(" - Dry run:", row)

conn.close()
