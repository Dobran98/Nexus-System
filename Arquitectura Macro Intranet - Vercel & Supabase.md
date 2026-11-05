# **Documento de Arquitectura Macro: Sistema Unificado de Intranet Empresarial**

Plataforma unificada para la gestión integral de Control de Asistencia Biométrica/QR, Telemetría de Operaciones, Gestión de Telefonía Móvil Corporativa, Módulo de Incidencias y Reportería Oriana. Diseñado sobre una infraestructura Serverless desacoplada con despliegue en Vercel y persistencia en Supabase.

# **1\. Arquitectura General y Estructura Monorepo Desacoplada**

La plataforma adopta una topología de Monorepo administrada mediante Turborepo/pnpm workspaces. Este enfoque garantiza total desacoplamiento operacional entre las aplicaciones periféricas, mientras centraliza los contratos de interfaces, esquemas de base de datos y librerías transversales mediante un SDK de TypeScript autogenerado.

## **Estructura de Directorios**

```
root/
├── apps/
│   ├── attendance/         # Aplicación Next.js para marcado QR/Geolocalización
│   ├── oriana/             # Next.js para análisis de datos y reportes ejecutivos
│   ├── calls-incidents/    # Next.js: Discador guiado, logs y gestión de SLAs
│   └── admin-portal/       # Panel maestro: RBAC, cargas masivas y analítica global
├── packages/
│   ├── database/           # Cliente Supabase, tipos generados (database.types.ts)
│   ├── auth/               # Middlewares de sesión, validadores RBAC y cookies
│   ├── ui/                 # Design System (Tailwind CSS, Radix UI, componentes base)
│   ├── telemetry/          # SDK para cálculo de latencia de flujo y auditoría
│   └── utils/              # Funciones criptográficas, parsing de CSV/Excel y fechas
├── supabase/
│   ├── migrations/         # Scripts DDL estructurados cronológicamente
│   ├── functions/          # Deno Edge Functions (agregaciones, purgas, webhooks)
│   └── seed.sql            # Semilla base: Catálogos, permisos y reglas dinámicas
├── turbo.json
└── package.json
```

## **Principios de Desacoplamiento y Despliegue en Vercel**

* **Independencia de Build y Runtime:** Cada aplicativo bajo `/apps` se compila de forma aislada hacia un proyecto dedicado en Vercel, permitiendo despliegues continuos, escalabilidad independiente y asignación de subdominios (`asistencia.empresa.internal`, `llamadas.empresa.internal`).  
* **Seguridad Tipada de Punta a Punta:** Todo cambio en el esquema SQL de Supabase actualiza el paquete `@intranet/database` a través del CLI de Supabase, propagando advertencias de tipado en tiempo de compilación a todas las aplicaciones cliente.  
* **Consumo Transversal de Telemetría:** El módulo `@intranet/telemetry` inyecta automáticamente metadatos contextuales (dirección IP, navegador, versión del dispositivo y marcas de tiempo con precisión de microsegundos) sin requerir configuración manual por cada equipo de desarrollo.

# **2\. Gobernanza de Acceso Basada en Roles (RBAC) y Seguridad**

La plataforma opera bajo el paradigma de Mínimo Privilegio. La autorización no se delega a las capas del frontend, sino que se valida criptográficamente mediante el JWT provisto por Supabase Auth y se ejecuta a nivel del motor relacional mediante Row-Level Security (RLS).

## **Matriz de Roles y Alcance Operativo**

| Rol | Identificador | Alcance y Facultades |
| :---- | :---- | :---- |
| **Superadmin** | `superadmin` | Control de infraestructura, ejecución de migraciones, configuración de variables de entorno y bypass auditado de RLS. |
| **Administrador de Módulo** | `module_admin` | Configuración de campañas de llamadas, definición de metas dinámicas y administración de inventario de dispositivos Samsung. |
| **Supervisor** | `supervisor` | Asignación operativa de bases de datos, reasignación de incidentes, aprobación de solicitudes de edición de perfil y revisión de latencias. |
| **Operador Multifunción** | `multi_operator` | Registro de asistencia, ejecución de llamadas asignadas, reporte de tickets de incidencia y subida de análisis Oriana según su asignación activa. |
| **Analista de Datos** | `data_analyst` | Procesamiento y validación masiva de registros, cálculo de métricas de precisión y publicación formal de reportes Oriana. |
| **Auditor** | `auditor` | Acceso universal de solo lectura a trazas criptográficas, tablas de cambios (`audit_logs`) e historial de interacciones operativas. |

## **Políticas Row-Level Security (RLS)**

Toda consulta SQL efectuada desde el SDK cliente evalúa la identidad inyectada en `auth.uid()`. Se definen funciones auxiliares de PostgreSQL (`security definer`) para consultar los roles del usuario sin incurrir en recursión de políticas RLS:

```
CREATE OR REPLACE FUNCTION public.current_user_has_role(required_role text)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid() AND r.name = required_role
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
```

Las políticas de lectura y escritura aíslan rigurosamente las filas. Un operador estándar solo puede leer sus asignaciones pendientes y escribir sus propios registros de asistencia o interacciones de llamadas.

## **Sistema de Auditoría Inmutable (`audit_logs`)**

Cualquier operación de mutación (`INSERT`, `UPDATE`, `DELETE`) en tablas críticas dispara triggers a nivel de base de datos que persisten el estado previo y posterior en formato JSONB. Esta tabla cuenta con políticas RLS que prohíben explícitamente cualquier mutación directa, incluso por parte del Superadmin en el flujo convencional de la aplicación.

# **3\. Esquemas de Datos SQL Detallados e Instrucciones de Migración**

## **Tablas Core y Seguridad**

```
-- Extensiones requeridas
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Roles del sistema
CREATE TABLE public.roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Perfiles de usuario vinculados a Supabase Auth
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    document_id TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    phone_number TEXT,
    address TEXT,
    is_active BOOLEAN DEFAULT true NOT NULL,
    last_profile_edit_at TIMESTAMPTZ,
    profile_edit_count_week INT DEFAULT 0 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Asignación de Roles
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    role_id UUID REFERENCES public.roles(id) ON DELETE CASCADE NOT NULL,
    assigned_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, role_id)
);

-- Logs de Auditoría Inmutables
CREATE TABLE public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES public.profiles(id),
    action TEXT NOT NULL,
    entity_name TEXT NOT NULL,
    entity_id UUID NOT NULL,
    old_data JSONB,
    new_data JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);
```

## **Módulos de Asistencia y Telemetría Operativa**

```
-- Cabecera de Asistencia
CREATE TABLE public.attendance_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    work_date DATE NOT NULL,
    status TEXT CHECK (status IN ('present', 'late', 'absent', 'excused')) NOT NULL,
    total_active_seconds INT DEFAULT 0 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, work_date)
);

-- Eventos de Marcación (QR / Biometría / Geolocalización)
CREATE TABLE public.clock_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attendance_id UUID REFERENCES public.attendance_records(id) ON DELETE CASCADE NOT NULL,
    event_type TEXT CHECK (event_type IN ('clock_in', 'break_start', 'break_end', 'clock_out')) NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    verification_method TEXT CHECK (verification_method IN ('qr_scan', 'biometric', 'manual_supervisor')) NOT NULL,
    latitude NUMERIC(10, 8),
    longitude NUMERIC(11, 8),
    device_fingerprint TEXT NOT NULL,
    metadata JSONB
);

-- Telemetría de Latencia Operativa
CREATE TABLE public.workflow_latency_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    attendance_id UUID REFERENCES public.attendance_records(id) ON DELETE CASCADE NOT NULL,
    clock_in_time TIMESTAMPTZ NOT NULL,
    first_task_event_time TIMESTAMPTZ,
    latency_seconds INT GENERATED ALWAYS AS (
        EXTRACT(EPOCH FROM (first_task_event_time - clock_in_time))::INT
    ) STORED,
    task_module TEXT CHECK (task_module IN ('calls', 'oriana_analysis', 'incidents')) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);
```

## **Módulos de Telefonía Celular Corporativa e Incidencias**

El flujo de llamadas no depende de una central PBX. Se gestiona mediante terminales celulares corporativos Samsung operados de forma manual o guiada por la intranet.

```
-- Parque de Terminales Móviles Samsung
CREATE TABLE public.corporate_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assigned_user_id UUID REFERENCES public.profiles(id),
    imei TEXT UNIQUE NOT NULL,
    phone_number TEXT NOT NULL,
    model TEXT NOT NULL, -- Ej: 'Samsung Galaxy A15 Enterprise'
    knox_enrollment_id TEXT,
    battery_health_percentage INT,
    status TEXT CHECK (status IN ('available', 'assigned', 'maintenance', 'lost')) DEFAULT 'available' NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Campañas de Asignación de Leads/Números
CREATE TABLE public.call_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    status TEXT CHECK (status IN ('draft', 'active', 'paused', 'completed')) DEFAULT 'draft' NOT NULL,
    daily_quota_per_operator INT DEFAULT 200 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Asignación Individual de Leads a Operadores
CREATE TABLE public.call_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES public.call_campaigns(id) ON DELETE CASCADE NOT NULL,
    operator_id UUID REFERENCES public.profiles(id) NOT NULL,
    customer_phone TEXT NOT NULL,
    customer_name TEXT,
    priority INT DEFAULT 1 NOT NULL,
    state TEXT CHECK (state IN ('queued', 'calling', 'completed', 'rescheduled')) DEFAULT 'queued' NOT NULL,
    assigned_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Interacciones Reales Ejecutadas en el Dispositivo
CREATE TABLE public.call_interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id UUID REFERENCES public.call_assignments(id) ON DELETE CASCADE NOT NULL,
    operator_id UUID REFERENCES public.profiles(id) NOT NULL,
    device_id UUID REFERENCES public.corporate_devices(id) NOT NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    duration_seconds INT GENERATED ALWAYS AS (
        EXTRACT(EPOCH FROM (end_time - start_time))::INT
    ) STORED,
    result TEXT CHECK (result IN ('answered_effective', 'busy', 'no_answer', 'invalid_number', 'rejected')) NOT NULL,
    idle_time_prior_call INT DEFAULT 0, -- Latencia en segundos desde la última llamada finalizada
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Gestión de Incidencias Operativas y SLAs
CREATE TABLE public.incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id UUID REFERENCES public.profiles(id) NOT NULL,
    assigned_to UUID REFERENCES public.profiles(id),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    severity TEXT CHECK (severity IN ('low', 'medium', 'high', 'critical')) NOT NULL,
    status TEXT CHECK (status IN ('open', 'investigating', 'resolved', 'closed')) DEFAULT 'open' NOT NULL,
    sla_due_date TIMESTAMPTZ NOT NULL,
    resolution_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    resolved_at TIMESTAMPTZ
);
```

## **Módulo de Reportería y Análisis Oriana**

```
-- Reportes Oriana Principales
CREATE TABLE public.oriana_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    analyst_id UUID REFERENCES public.profiles(id) NOT NULL,
    report_title TEXT NOT NULL,
    batch_reference TEXT NOT NULL,
    total_records INT NOT NULL,
    processed_records INT DEFAULT 0 NOT NULL,
    status TEXT CHECK (status IN ('draft', 'review_pending', 'approved', 'rejected')) DEFAULT 'draft' NOT NULL,
    submission_deadline TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Métricas Oriana y Desgloses Consolidados
CREATE TABLE public.oriana_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID REFERENCES public.oriana_reports(id) ON DELETE CASCADE NOT NULL,
    validation_accuracy NUMERIC(5, 2) NOT NULL, -- Porcentaje de 0.00 a 100.00
    discrepancy_count INT DEFAULT 0 NOT NULL,
    processing_time_minutes INT NOT NULL,
    audit_notes TEXT
);

-- Registros Individuales de Análisis
CREATE TABLE public.data_analysis_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID REFERENCES public.oriana_reports(id) ON DELETE CASCADE NOT NULL,
    record_hash TEXT NOT NULL,
    input_data JSONB NOT NULL,
    validation_state TEXT CHECK (validation_state IN ('valid', 'discrepant', 'ignored')) NOT NULL,
    validated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);
```

# **4\. Matriz de Evaluación Dinámica y Ponderación de Rendimiento**

Los colaboradores de la intranet asumen funciones heterogéneas según las contingencias del día (ej. un operador ejecuta campañas de llamadas en la mañana y asume validación de reportes Oriana en la tarde). El sistema implementa una matriz con reglas de scoring dinámico (`dynamic_evaluation_rules`).

## **Configuración de Ponderaciones por Rol**

```
CREATE TABLE public.dynamic_evaluation_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_type TEXT NOT NULL,
    metric_identifier TEXT NOT NULL,
    weight_percentage NUMERIC(5, 2) NOT NULL,
    benchmark_target NUMERIC(10, 2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(role_type, metric_identifier)
);
```

## **Distribución de Pesos por Función**

| Rol Operativo | Métrica de Evaluación | Ponderación | Criterio de Benchmark / Meta Diaria |
| :---- | :---- | :---- | :---- |
| **Rol Llamadas** | Volumen de llamadas por hora | 30% | \$\\ge 25\$ llamadas/hora netas de interacción |
| **Rol Llamadas** | Tasa de contacto efectivo / conversión | 35% | \$\\ge 40%\$ contestadas con resultado cualificado |
| **Rol Llamadas** | Adherencia a meta diaria | 20% | Cumplimiento del 100% de la cuota base (200 llamadas) |
| **Rol Llamadas** | Latencia entre asignaciones (idle time) | 15% | Promedio de transición \$\\le 45\$ segundos entre fin e inicio |
| **Rol Analítica** | Precisión de análisis y validación | 40% | Tasa de error/rechazo \$\\le 1.5%\$ sobre registros |
| **Rol Analítica** | Registros procesados por hora | 30% | \$\\ge 120\$ validaciones estructuradas por hora |
| **Rol Analítica** | Puntualidad de entrega Oriana | 20% | Depósito final con \$\\ge 30\$ minutos previo al SLA de corte |
| **Rol Analítica** | Discrepancias en auditoría | 10% | Cero inconsistencias materiales en muestreo de auditor |

## **Algoritmo de Normalización y Scoring Integral**

El score diario de un operador (\$S\_d\$) se calcula consolidando los subpuntajes normalizados (\$N\_i\$) multiplicados por su respectivo factor de peso ponderado (\$W\_i\$). Si el operador ejecuta funciones híbridas en la jornada, el score final pondera el tiempo transcurrido en cada función:

\$\$S\_d \= \\sum\_{m=1}^{M} \\left( \\frac{T\_m}{T\_{\\text{total}}} \\sum\_{i=1}^{K\_m} \\left( N\_{m,i} \\times W\_{m,i} \\right) \\right)\$\$

Donde:

* \$T\_m\$: Minutos totales registrados en el módulo \$m\$.  
* \$T\_{\\text{total}}\$: Horas productivas totales calculadas entre `clock_in` y `clock_out`.  
* \$N\_{m,i} \= \\min\\left(100, \\left(\\frac{\\text{Resultado Real}}{\\text{Target}}\\right) \\times 100\\right)\$ (para métricas directas) o su función inversa para métricas de tiempo o latencia.

# **5\. Salvaguardas, Privacidad y Políticas de Datos**

## **Términos de Uso, Disclaimer y Consentimiento**

La intranet despliega una barrera obligatoria de aceptación (*blocking modal*) durante el primer inicio de sesión o tras actualizaciones contractuales. El consentimiento registra de forma explícita:

* La captura de telemetría de red y geolocalización únicamente al momento de la marcación de entrada y salida (`clock_events`).  
* Registro de tiempos muertos entre llamadas y eventos de interfaz para fines estrictos de optimización de procesos de soporte.  
* Política estricta de cookies técnicas esenciales; proscripción total de rastreadores de publicidad o analítica de terceros.

## **Políticas de Edición de Perfil y Restricción Semanal**

Para prevenir falsificación de identidad o alteraciones en nómina:

1. **Campos Protegidos:** Documento de identidad (`document_id`), nombre legal y rol no son editables por el colaborador.  
2. **Campos con Frecuencia Limitada:** Teléfono personal y dirección física disponen de una ventana de actualización sujeta a una cuota de 1 modificación cada 7 días naturales.

```
CREATE OR REPLACE FUNCTION public.enforce_profile_update_frequency()
RETURNS TRIGGER AS $$
BEGIN
  -- Verificar si se alteraron campos regulados
  IF (NEW.phone_number IS DISTINCT FROM OLD.phone_number) OR (NEW.address IS DISTINCT FROM OLD.address) THEN
    IF OLD.last_profile_edit_at IS NOT NULL AND OLD.last_profile_edit_at > (now() - INTERVAL '7 days') THEN
      RAISE EXCEPTION 'Solo está permitida una actualización de datos personales cada 7 días. Su última edición fue el %', OLD.last_profile_edit_at;
    END IF;
    NEW.last_profile_edit_at := now();
    NEW.profile_edit_count_week := OLD.profile_edit_count_week + 1;
  END IF;
  
  -- Bloquear edición de campos restringidos
  NEW.document_id := OLD.document_id;
  NEW.is_active := OLD.is_active;
  NEW.updated_at := timezone('utc'::text, now());
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_check_profile_editing_limits
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.enforce_profile_update_frequency();
```

## **Panel de Administración Centralizado**

* **Carga Masiva de Bases de Datos:** Procesador streaming en Node.js/Edge para ingesta de archivos CSV y Excel de hasta 50,000 registros de clientes. El sistema realiza parsing sintáctico, validación de prefijos telefónicos, remoción de duplicados y particionamiento en lotes balanceados entre operadores disponibles según su carga activa.  
* **Exportación Segura de Datos Auditados:** Todas las descargas de bases procesadas requieren autenticación biométrica/MFA del Administrador y quedan registradas en `audit_logs` con la firma criptográfica (SHA-256) del payload descargado.

## **Optimización de Almacenamiento en Supabase Free Tier**

Dadas las restricciones de espacio (500 MB en PostgreSQL en el tier gratuito de Supabase), se implementa una arquitectura de particionado y purgado:

```
-- Creación de la tabla de telemetría particionada por fecha (Rango mensual)
CREATE TABLE public.workflow_latency_logs_partitioned (
    id UUID DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    attendance_id UUID NOT NULL,
    clock_in_time TIMESTAMPTZ NOT NULL,
    first_task_event_time TIMESTAMPTZ,
    task_module TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    PRIMARY KEY (created_at, id)
) PARTITION BY RANGE (created_at);
```

### **Estrategia de Purgado Automatizado hacia Agregados**

Una función programada vía `pg_cron` o ejecutada mediante Supabase Edge Functions con triggers diarios consolida y purga logs detallados de más de 90 días:

```
CREATE OR REPLACE FUNCTION public.archive_and_purge_old_telemetry()
RETURNS void AS $$
BEGIN
  -- 1. Insertar métricas agregadas antes de purgar
  INSERT INTO public.telemetry_daily_aggregates (summary_date, module, avg_latency_sec, total_events)
  SELECT 
    created_at::DATE,
    task_module,
    AVG(latency_seconds)::INT,
    COUNT(*)
  FROM public.workflow_latency_logs
  WHERE created_at < (now() - INTERVAL '90 days')
  GROUP BY created_at::DATE, task_module;

  -- 2. Eliminar logs detallados
  DELETE FROM public.workflow_latency_logs
  WHERE created_at < (now() - INTERVAL '90 days');
  
  -- 3. Limpiar interacciones de llamadas completadas antiguas
  DELETE FROM public.call_interactions
  WHERE created_at < (now() - INTERVAL '90 days');
END;
$$ LANGUAGE plpgsql;
```

# **6\. Guía de Ejecución y Prompts de Implementación para Antigravity**

Para asegurar un desarrollo sin desviaciones arquitectónicas, se define el siguiente flujo de ingeniería de prompts ordenado secuencialmente para el entorno Antigravity IDE.

## **Fase 1: Análisis y Generación de Especificación Técnica (.md)**

```
Prompt de Entrada para Antigravity:
"Actúa como Principal Software Architect. Analiza la estructura monorepo de este proyecto. Genera de forma exhaustiva los archivos de documentación técnica modular dentro de la carpeta /docs/specs/:
1. rbac-security.md: Documentación de políticas RLS y triggers de auditoría inmutable.
2. database-lifecycle.md: Estrategia de particionamiento, agregaciones diarias y purga de logs para permanecer bajo cuotas de Supabase Free Tier.
3. samsung-hardware-integration.md: Flujo operativo de marcación y captura de interacciones en terminales celulares sin soporte PBX.
Asegúrate de especificar tipado estricto en TypeScript para cada interacción y no omitas detalles de validaciones en tiempo de ejecución."
```

## **Fase 2: Ejecución de Migraciones SQL y Configuración de Base de Datos**

```
Prompt de Entrada para Antigravity:
"Toma como referencia los esquemas de datos especificados en la arquitectura macro. Genera secuencialmente los scripts de migración dentro del directorio /supabase/migrations/ con la nomenclatura [TIMESTAMP]_[feature_name].sql:
1. 0001_core_and_auth_tables.sql: Perfiles, roles, triggers de validación semanal de perfil y logs de auditoría.
2. 0002_attendance_and_telemetry.sql: Control de presencia, escaneo QR y cálculo de latencia.
3. 0003_calls_and_incidents.sql: Parque de terminales Samsung, campañas, interacciones y tickets de SLA.
4. 0004_oriana_reports.sql: Reportería, sub-métricas y validaciones.
5. 0005_scoring_and_partitioning.sql: Reglas de evaluación dinámica y función de purga automática de logs de >90 días.
Verifica que cada script sea idempotente, aplique las políticas RLS correspondientes y compile sin errores sintácticos."
```

## **Fase 3: Integración del Frontend y Flujo de Despliegue en Vercel**

```
Prompt de Entrada para Antigravity:
"Genera los componentes de interfaz para la aplicación /apps/calls-incidents utilizando Next.js App Router, Tailwind CSS y componentes de @intranet/ui:
1. Interfaz del Discador Guiado: Lector de la asignación actual de la campaña, temporizador de latencia en espera, campo de registro de llamada manual desde el dispositivo Samsung corporativo y selector de resultado de interacción.
2. Panel de Restricción de Perfil: Componente en /apps/admin-portal para visualización de perfil de usuario que implemente el bloqueo visual e inputs desactivados si last_profile_edit_at es menor a 7 días, mostrando contador regresivo.
3. Ingestor Masivo: Componente Drag & Drop para archivos .csv/.xlsx con previsualización de datos, detección de duplicados y barra de progreso de carga a Supabase.
Todo el código debe implementar tipado derivado de database.types.ts generado por el SDK de Supabase."
```

