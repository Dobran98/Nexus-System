-- =============================================================================
-- NEXUS SYSTEM — Semilla Base de Datos
-- Catálogos, permisos y reglas dinámicas de evaluación
-- Ejecutar DESPUÉS de todas las migraciones 0001–0006
-- =============================================================================

-- -------------------------
-- 1. Semilla de Roles del Sistema
-- -------------------------
INSERT INTO public.roles (id, name, description) VALUES
  (gen_random_uuid(), 'superadmin',      'Control total de infraestructura y bypass auditado de RLS'),
  (gen_random_uuid(), 'module_admin',    'Administrador de módulo: campañas, dispositivos, metas'),
  (gen_random_uuid(), 'supervisor',      'Asignación operativa, aprobación de ediciones de perfil'),
  (gen_random_uuid(), 'multi_operator',  'Operador multifunción: asistencia, llamadas, Oriana, tickets'),
  (gen_random_uuid(), 'data_analyst',    'Analista: procesamiento masivo, métricas, reportes Oriana'),
  (gen_random_uuid(), 'auditor',         'Solo lectura: trazas criptográficas e historial de operaciones')
ON CONFLICT (name) DO UPDATE
  SET description = EXCLUDED.description;

-- -------------------------
-- 2. Reglas de Evaluación Dinámica — Rol Llamadas
-- -------------------------
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

-- -------------------------
-- 3. Reglas de Evaluación Dinámica — Rol Analítica (Oriana)
-- -------------------------
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
