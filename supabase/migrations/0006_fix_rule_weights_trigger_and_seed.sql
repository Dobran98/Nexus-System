-- =============================================================================
-- MIGRACIÓN: 0006_fix_rule_weights_trigger_and_seed.sql
-- Proyecto: NEXUS SYSTEM — Intranet Empresarial Unificada
-- Descripción: Corrección de función de validación de pesos para soportar
--              UPSERT en dynamic_evaluation_rules e inserción de semillas
--              de roles y reglas dinámicas de evaluación.
-- Idempotente: Sí
-- =============================================================================

-- 1. Actualizar función de validación de pesos
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
    AND    metric_identifier != NEW.metric_identifier;

    v_total_weight := COALESCE(v_total_weight, 0) + NEW.weight_percentage;

    IF v_total_weight > 100.01 THEN
        RAISE EXCEPTION
            'Los pesos de las reglas para el rol "%" superan el 100 por ciento (total actual: %). '
            'Ajuste los pesos antes de continuar.',
            NEW.role_type, v_total_weight;
    END IF;

    RETURN NEW;
END;
$$;

-- 2. Semilla de Roles del Sistema
INSERT INTO public.roles (id, name, description) VALUES
  (gen_random_uuid(), 'superadmin',      'Control total de infraestructura y bypass auditado de RLS'),
  (gen_random_uuid(), 'module_admin',    'Administrador de módulo: campañas, dispositivos, metas'),
  (gen_random_uuid(), 'supervisor',      'Asignación operativa, aprobación de ediciones de perfil'),
  (gen_random_uuid(), 'multi_operator',  'Operador multifunción: asistencia, llamadas, Oriana, tickets'),
  (gen_random_uuid(), 'data_analyst',    'Analista: procesamiento masivo, métricas, reportes Oriana'),
  (gen_random_uuid(), 'auditor',         'Solo lectura: trazas criptográficas e historial de operaciones')
ON CONFLICT (name) DO UPDATE
  SET description = EXCLUDED.description;

-- 3. Limpiar reglas existentes para inserción limpia y exacta de 100% por rol
DELETE FROM public.dynamic_evaluation_rules WHERE role_type IN ('calls', 'oriana_analysis');

-- 4. Semilla de Reglas de Evaluación Dinámica — Rol Llamadas
INSERT INTO public.dynamic_evaluation_rules (
    role_type, metric_identifier, display_name,
    weight_percentage, benchmark_target, is_higher_better, unit, description
) VALUES
('calls', 'calls_per_hour',
 'Volumen de llamadas por hora',
 30.00, 25.00, TRUE, 'llamadas/h',
 'Número neto de llamadas realizadas por hora de trabajo activo. Meta: ≥25 llamadas/hora.'),

('calls', 'effective_contact_rate',
 'Tasa de contacto efectivo',
 35.00, 40.00, TRUE, '%',
 'Porcentaje de llamadas con resultado answered_effective sobre el total. Meta: ≥40%.'),

('calls', 'daily_quota_adherence',
 'Adherencia a meta diaria',
 20.00, 100.00, TRUE, '%',
 'Porcentaje de cumplimiento de la cuota diaria base de 200 llamadas. Meta: 100%.'),

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

-- 5. Semilla de Reglas de Evaluación Dinámica — Rol Analítica (Oriana)
INSERT INTO public.dynamic_evaluation_rules (
    role_type, metric_identifier, display_name,
    weight_percentage, benchmark_target, is_higher_better, unit, description
) VALUES
('oriana_analysis', 'validation_accuracy',
 'Precisión de análisis y validación',
 40.00, 98.50, TRUE, '%',
 'Porcentaje de registros validados correctamente. Meta: tasa de error ≤1.5% (precisión ≥98.5%).'),

('oriana_analysis', 'records_per_hour',
 'Registros procesados por hora',
 30.00, 120.00, TRUE, 'registros/h',
 'Número de registros validados por hora de trabajo activo. Meta: ≥120 registros/hora.'),

('oriana_analysis', 'delivery_timeliness',
 'Puntualidad de entrega',
 20.00, 30.00, TRUE, 'minutos antes del SLA',
 'Minutos de anticipación al SLA de corte al momento de enviar el reporte. Meta: ≥30 min.'),

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