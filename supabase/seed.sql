-- =============================================================================
-- NEXUS SYSTEM — Semilla Base de Datos
-- Catálogos, permisos y reglas dinámicas de evaluación
-- Ejecutar DESPUÉS de todas las migraciones 0001–0005
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
INSERT INTO public.dynamic_evaluation_rules (role_type, metric_identifier, weight_percentage, benchmark_target) VALUES
  ('calls', 'call_volume_per_hour',          30.00, 25.00),
  ('calls', 'effective_contact_rate',        35.00, 40.00),
  ('calls', 'daily_quota_adherence',         20.00, 100.00),
  ('calls', 'idle_time_between_calls_sec',   15.00, 45.00)
ON CONFLICT (role_type, metric_identifier) DO UPDATE
  SET weight_percentage = EXCLUDED.weight_percentage,
      benchmark_target  = EXCLUDED.benchmark_target;

-- -------------------------
-- 3. Reglas de Evaluación Dinámica — Rol Analítica (Oriana)
-- -------------------------
INSERT INTO public.dynamic_evaluation_rules (role_type, metric_identifier, weight_percentage, benchmark_target) VALUES
  ('oriana_analysis', 'validation_accuracy_pct',       40.00, 98.50),
  ('oriana_analysis', 'records_processed_per_hour',    30.00, 120.00),
  ('oriana_analysis', 'oriana_delivery_punctuality',   20.00, 30.00),
  ('oriana_analysis', 'audit_discrepancies',           10.00, 0.00)
ON CONFLICT (role_type, metric_identifier) DO UPDATE
  SET weight_percentage = EXCLUDED.weight_percentage,
      benchmark_target  = EXCLUDED.benchmark_target;

-- -------------------------
-- 4. Variables de configuración base
-- -------------------------
INSERT INTO public.config_variables (key, value, description) VALUES
  ('max_csv_records_per_batch',   '100',    'Registros por lote en ingesta masiva'),
  ('profile_edit_cooldown_days',  '7',      'Días mínimos entre ediciones de perfil'),
  ('log_purge_days',              '90',     'Antigüedad en días para purga de logs de telemetría'),
  ('sla_low_hours',               '72',     'SLA para incidencias de severidad baja (horas)'),
  ('sla_medium_hours',            '24',     'SLA para incidencias de severidad media (horas)'),
  ('sla_high_hours',              '8',      'SLA para incidencias de severidad alta (horas)'),
  ('sla_critical_hours',          '2',      'SLA para incidencias críticas (horas)'),
  ('daily_call_quota',            '200',    'Cuota diaria base de llamadas por operador'),
  ('max_idle_seconds',            '45',     'Latencia máxima permitida entre llamadas (segundos)'),
  ('storage_budget_mb',           '500',    'Presupuesto de almacenamiento Supabase Free Tier (MB)')
ON CONFLICT (key) DO UPDATE
  SET value       = EXCLUDED.value,
      description = EXCLUDED.description;

