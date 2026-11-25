import psycopg2
import json

conn = psycopg2.connect('postgresql://postgres.pzkqjdkphcwmblbyorbr:yfcLIxzEWObS4Dio@aws-0-us-east-1.pooler.supabase.com:6543/postgres')
cur = conn.cursor()

print("==> Instalando funciones de Scoring Dinámico y Telemetría FIT (Fase 11)...")

sql_scoring = """
-- ──────────────────────────────────────────────────────────────
-- FUNCIÓN: nexus_calculate_daily_scores
-- Calcula y persiste en public.daily_scores el rendimiento ponderado:
--   Asys: 30% (Puntualidad, asistencia y horas)
--   Briana: 40% (Eficacia de contacto + FIT First Interaction Time)
--   Oriana: 30% (Precisión de reportes y volumen)
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.nexus_calculate_daily_scores(
    p_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user RECORD;
    v_processed_count INT := 0;
    
    -- Variables Asys
    v_clock_in TIMESTAMPTZ;
    v_clock_out TIMESTAMPTZ;
    v_asys_estado TEXT;
    v_asys_score NUMERIC := 0;
    v_retardo_min INT := 0;
    v_turno TEXT;
    
    -- Variables Briana
    v_first_call_time TIMESTAMPTZ;
    v_fit_seconds INT := NULL;
    v_fit_minutes NUMERIC := NULL;
    v_fit_score NUMERIC := 0;
    v_total_calls INT := 0;
    v_effective_calls INT := 0;
    v_briana_score NUMERIC := 0;
    v_effective_rate NUMERIC := 0;
    
    -- Variables Oriana
    v_oriana_records INT := 0;
    v_oriana_llamadas NUMERIC := 0;
    v_oriana_efectivas NUMERIC := 0;
    v_oriana_incidencias NUMERIC := 0;
    v_oriana_accuracy NUMERIC := 0;
    v_oriana_score NUMERIC := 0;
    
    -- Consolidación
    v_final_score NUMERIC := 0;
    v_is_hybrid BOOLEAN := FALSE;
    v_dominant_role TEXT := 'attendance';
    v_total_minutes INT := 0;
    v_breakdown JSONB;
BEGIN
    FOR v_user IN (
        SELECT 
            u.id as user_id,
            u.email,
            COALESCE(p.full_name, split_part(u.email, '@', 1)) as full_name,
            COALESCE(leg.usuario, split_part(u.email, '@', 1)) as legacy_username,
            COALESCE(leg.turno, 'Mañana') as turno,
            COALESCE(leg.areas_ids, '["Todas"]'::jsonb) as areas_ids
        FROM auth.users u
        LEFT JOIN public.profiles p ON u.id = p.id
        LEFT JOIN (
            SELECT DISTINCT ON (email) * 
            FROM public.usuarios 
            WHERE email IS NOT NULL AND email <> ''
        ) leg ON LOWER(u.email) = LOWER(leg.email)
    ) LOOP
        -- 1. ASYS (30%): Asistencia y Puntualidad
        SELECT 
            MIN(a.timestamp) FILTER (WHERE a.tipo ILIKE '%entrada%'),
            MAX(a.timestamp) FILTER (WHERE a.tipo ILIKE '%salida%'),
            MAX(a.estado) FILTER (WHERE a.tipo ILIKE '%entrada%')
        INTO v_clock_in, v_clock_out, v_asys_estado
        FROM public.asistencias a
        WHERE a.timestamp::DATE = p_date
        AND (
            LOWER(a.id_usuario) = LOWER(v_user.legacy_username)
            OR LOWER(a.nombre_completo) = LOWER(v_user.full_name)
            OR LOWER(a.id_usuario) = LOWER(split_part(v_user.email, '@', 1))
        );
        
        IF v_clock_in IS NOT NULL THEN
            -- Calcular minutos desde la hora programada según turno
            v_turno := v_user.turno;
            v_retardo_min := CASE 
                WHEN v_turno ILIKE '%tarde%' THEN GREATEST(0, (EXTRACT(HOUR FROM v_clock_in) * 60 + EXTRACT(MINUTE FROM v_clock_in)) - (13 * 60))
                WHEN v_turno ILIKE '%noche%' THEN GREATEST(0, (EXTRACT(HOUR FROM v_clock_in) * 60 + EXTRACT(MINUTE FROM v_clock_in)) - (18 * 60))
                ELSE GREATEST(0, (EXTRACT(HOUR FROM v_clock_in) * 60 + EXTRACT(MINUTE FROM v_clock_in)) - (8 * 60))
            END;
            
            IF v_retardo_min <= 15 THEN
                v_asys_score := 100.0;
            ELSIF v_retardo_min <= 45 THEN
                v_asys_score := GREATEST(40.0, 100.0 - ((v_retardo_min - 15) * 2.0));
            ELSE
                v_asys_score := 40.0;
            END IF;
            
            IF v_clock_out IS NOT NULL THEN
                v_total_minutes := GREATEST(0, EXTRACT(EPOCH FROM (v_clock_out - v_clock_in))::INT / 60);
            ELSE
                v_total_minutes := 480; -- 8 horas por defecto si jornada activa
            END IF;
        ELSE
            v_asys_score := 0.0;
            v_total_minutes := 0;
            v_retardo_min := 0;
        END IF;

        -- 2. BRIANA (40%): Telefonía y First Interaction Time (FIT)
        SELECT 
            MIN(g.fecha),
            COUNT(*),
            COUNT(*) FILTER (WHERE g.resultado ILIKE '%efectiv%' OR g.resultado ILIKE '%contactad%')
        INTO v_first_call_time, v_total_calls, v_effective_calls
        FROM public.briana_gestiones g
        WHERE g.fecha::DATE = p_date
        AND (
            LOWER(g.usuario) = LOWER(v_user.legacy_username)
            OR LOWER(g.usuario) = LOWER(split_part(v_user.email, '@', 1))
        );

        IF v_total_calls > 0 THEN
            -- Calcular First Interaction Time (FIT)
            IF v_clock_in IS NOT NULL AND v_first_call_time IS NOT NULL THEN
                v_fit_seconds := GREATEST(0, EXTRACT(EPOCH FROM (v_first_call_time - v_clock_in))::INT);
                v_fit_minutes := ROUND((v_fit_seconds / 60.0)::numeric, 1);
                
                -- Benchmark FIT: <= 15 min = 100 pts; 15-30 min = proporcional; > 30 min = 40 pts
                IF v_fit_minutes <= 15 THEN
                    v_fit_score := 100.0;
                ELSIF v_fit_minutes <= 30 THEN
                    v_fit_score := GREATEST(40.0, 100.0 - ((v_fit_minutes - 15) * 3.5));
                ELSE
                    v_fit_score := 40.0;
                END IF;
            ELSE
                v_fit_seconds := NULL;
                v_fit_minutes := NULL;
                v_fit_score := 75.0; -- Neutro si no hubo check-in formal
            END IF;

            v_effective_rate := ROUND((v_effective_calls::NUMERIC / v_total_calls::NUMERIC * 100.0), 1);
            
            -- Ponderación interna Briana: 50% Efectividad (meta 40%), 25% Volumen (meta 80 llamadas), 25% FIT
            v_briana_score := ROUND(
                (LEAST(100.0, (v_effective_rate / 40.0) * 100.0) * 0.50) +
                (LEAST(100.0, (v_total_calls / 80.0) * 100.0) * 0.25) +
                (v_fit_score * 0.25),
                1
            );
        ELSE
            v_briana_score := 0.0;
            v_effective_rate := 0.0;
            v_fit_score := 0.0;
            v_fit_seconds := NULL;
            v_fit_minutes := NULL;
        END IF;

        -- 3. ORIANA (30%): Analítica y Reportes
        SELECT 
            COUNT(*),
            COALESCE(SUM(llamadas_totales), 0),
            COALESCE(SUM(llamadas_efectivas), 0),
            COALESCE(SUM(incidencias_reportadas), 0)
        INTO v_oriana_records, v_oriana_llamadas, v_oriana_efectivas, v_oriana_incidencias
        FROM public.registros r
        WHERE r.fecha_reporte = p_date
        AND (
            LOWER(r.usuario_operador) = LOWER(v_user.legacy_username)
            OR LOWER(r.usuario_operador) = LOWER(split_part(v_user.email, '@', 1))
        );

        IF v_oriana_records > 0 THEN
            -- Precisión de reporte: deducción por incidencias graves
            IF v_oriana_llamadas > 0 THEN
                v_oriana_accuracy := GREATEST(50.0, 100.0 - ((v_oriana_incidencias / v_oriana_llamadas) * 100.0));
            ELSE
                v_oriana_accuracy := 95.0;
            END IF;
            
            -- Subscore Oriana: 60% Precisión + 40% Volumen procesado (meta 100 registros/llamadas)
            v_oriana_score := ROUND(
                (v_oriana_accuracy * 0.60) +
                (LEAST(100.0, (GREATEST(v_oriana_llamadas, v_oriana_records * 10) / 100.0) * 100.0) * 0.40),
                1
            );
        ELSE
            v_oriana_score := 0.0;
            v_oriana_accuracy := 0.0;
        END IF;

        -- 4. PONDERACIÓN CROSS-MODULE (30% - 40% - 30%)
        IF v_briana_score > 0 AND v_oriana_score > 0 THEN
            v_is_hybrid := TRUE;
            v_dominant_role := 'multi_operator';
            v_final_score := ROUND((v_asys_score * 0.30) + (v_briana_score * 0.40) + (v_oriana_score * 0.30), 1);
        ELSIF v_briana_score > 0 THEN
            v_is_hybrid := FALSE;
            v_dominant_role := 'calls';
            -- Distribución sin Oriana: Asys 30% + Briana 70%
            v_final_score := ROUND((v_asys_score * 0.30) + (v_briana_score * 0.70), 1);
        ELSIF v_oriana_score > 0 THEN
            v_is_hybrid := FALSE;
            v_dominant_role := 'oriana_analysis';
            -- Distribución sin Briana: Asys 30% + Oriana 70%
            v_final_score := ROUND((v_asys_score * 0.30) + (v_oriana_score * 0.70), 1);
        ELSIF v_asys_score > 0 THEN
            v_is_hybrid := FALSE;
            v_dominant_role := 'attendance';
            v_final_score := v_asys_score;
        ELSE
            v_is_hybrid := FALSE;
            v_dominant_role := 'attendance';
            v_final_score := 0.0;
        END IF;

        -- Estructura del desglose JSONB
        v_breakdown := jsonb_build_object(
            'asys', jsonb_build_object(
                'score', v_asys_score,
                'weight', 0.30,
                'clock_in', v_clock_in,
                'clock_out', v_clock_out,
                'retardo_min', v_retardo_min,
                'status', COALESCE(v_asys_estado, CASE WHEN v_asys_score > 0 THEN 'Presente' ELSE 'Inasistente' END)
            ),
            'briana', jsonb_build_object(
                'score', v_briana_score,
                'weight', 0.40,
                'total_calls', v_total_calls,
                'effective_calls', v_effective_calls,
                'effective_rate_pct', v_effective_rate,
                'fit_seconds', v_fit_seconds,
                'fit_minutes', v_fit_minutes,
                'fit_score', v_fit_score
            ),
            'oriana', jsonb_build_object(
                'score', v_oriana_score,
                'weight', 0.30,
                'records_count', v_oriana_records,
                'total_processed', v_oriana_llamadas,
                'incidencias', v_oriana_incidencias,
                'accuracy_pct', v_oriana_accuracy
            ),
            'fit_telemetry', jsonb_build_object(
                'first_interaction_time', v_first_call_time,
                'fit_minutes', v_fit_minutes,
                'benchmark_met', (v_fit_minutes IS NOT NULL AND v_fit_minutes <= 15)
            )
        );

        -- Persistir en daily_scores solo si hubo al menos asistencia o actividad
        IF v_asys_score > 0 OR v_briana_score > 0 OR v_oriana_score > 0 THEN
            INSERT INTO public.daily_scores (
                user_id,
                score_date,
                final_score,
                score_breakdown,
                total_minutes,
                dominant_role,
                is_hybrid_day,
                calculated_at
            ) VALUES (
                v_user.user_id,
                p_date,
                v_final_score,
                v_breakdown,
                v_total_minutes,
                v_dominant_role,
                v_is_hybrid,
                timezone('utc', now())
            )
            ON CONFLICT (user_id, score_date) DO UPDATE SET
                final_score     = EXCLUDED.final_score,
                score_breakdown = EXCLUDED.score_breakdown,
                total_minutes   = EXCLUDED.total_minutes,
                dominant_role   = EXCLUDED.dominant_role,
                is_hybrid_day   = EXCLUDED.is_hybrid_day,
                calculated_at   = EXCLUDED.calculated_at;

            v_processed_count := v_processed_count + 1;
        END IF;

    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'score_date', p_date,
        'scores_calculated', v_processed_count,
        'calculated_at', timezone('utc', now())
    );
END;
$$;

-- ──────────────────────────────────────────────────────────────
-- FUNCIÓN: nexus_get_daily_leaderboard
-- Retorna el ranking ordenado de scoring dinámico por fecha
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.nexus_get_daily_leaderboard(
    p_date DATE DEFAULT CURRENT_DATE,
    p_limit INT DEFAULT 50
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_results JSONB;
BEGIN
    SELECT COALESCE(jsonb_agg(r_row), '[]'::jsonb) INTO v_results
    FROM (
        SELECT 
            ds.id,
            ds.user_id,
            p.full_name,
            u.email,
            COALESCE(leg.usuario, split_part(u.email, '@', 1)) as legacy_username,
            COALESCE(leg.turno, 'Mañana') as turno,
            COALESCE(ext.extension, '11001') as extension,
            ds.score_date,
            ds.final_score,
            ds.dominant_role,
            ds.is_hybrid_day,
            ds.total_minutes,
            ds.score_breakdown,
            ds.calculated_at
        FROM public.daily_scores ds
        JOIN auth.users u ON ds.user_id = u.id
        LEFT JOIN public.profiles p ON ds.user_id = p.id
        LEFT JOIN (
            SELECT DISTINCT ON (email) * 
            FROM public.usuarios 
            WHERE email IS NOT NULL AND email <> ''
        ) leg ON LOWER(u.email) = LOWER(leg.email)
        LEFT JOIN (
            SELECT DISTINCT ON (usuario) usuario, extension
            FROM public.briana_extensiones
        ) ext ON LOWER(leg.usuario) = LOWER(ext.usuario)
        WHERE ds.score_date = p_date
        ORDER BY ds.final_score DESC, ds.total_minutes DESC
        LIMIT p_limit
    ) r_row;

    RETURN v_results;
END;
$$;
"""

cur.execute(sql_scoring)
conn.commit()
print("==> Funciones SQL de Scoring Dinámico y FIT instaladas exitosamente.")

# Ejecutar una prueba con la fecha 2026-11-23
print("==> Probando cálculo de scores para 2026-11-23...")
cur.execute("SELECT public.nexus_calculate_daily_scores('2026-11-23'::date);")
res = cur.fetchone()[0]
print("Resultado del cálculo:", res)

# Consultar Leaderboard de esa fecha
cur.execute("SELECT public.nexus_get_daily_leaderboard('2026-11-23'::date, 5);")
lb = cur.fetchone()[0]
print(f"Top 5 Leaderboard (total {len(lb)} calculados):")
for item in lb:
    print(f" - {item['full_name']} ({item['email']}): Score={item['final_score']} | Dominante={item['dominant_role']} | Min={item['total_minutes']}")

conn.close()
