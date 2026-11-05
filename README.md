# 🌐 NEXUS SYSTEM — Macro Intranet Empresarial

Plataforma unificada para la gestión integral de Control de Asistencia Biométrica/QR, Telemetría de Operaciones, Gestión de Telefonía Celular Corporativa (sin PBX), Módulo de Incidencias con SLA, y Reportería de Datos Oriana.

**Repositorio Oficial:** [https://github.com/Dobran98/Nexus-System.git](https://github.com/Dobran98/Nexus-System.git)

---

## 🏛 Arquitectura Monorepo

```
NEXUS SYSTEM/
├── docs/
│   └── specs/
│       ├── rbac-security.md                 # Matriz RBAC, RLS y triggers de auditoría SHA-256
│       ├── database-lifecycle.md            # Particionamiento RANGE, agregados y purga 90d (Free Tier)
│       └── samsung-hardware-integration.md  # Telefonía celular Samsung sin PBX, dialer y Knox
├── supabase/
│   └── migrations/
│       ├── 0001_core_and_auth_tables.sql       # Tablas core, roles, profiles y audit_logs
│       ├── 0002_attendance_and_telemetry.sql   # Asistencias, eventos de reloj y latencia operativa
│       ├── 0003_calls_and_incidents.sql        # Terminales Samsung, campañas, llamadas y tickets SLA
│       ├── 0004_oriana_reports.sql             # Reportería Oriana, analítica y cola Telegram
│       └── 0005_scoring_and_partitioning.sql   # Reglas dinámicas, algoritmo híbrido y scheduler
├── Asys/                                    # Módulo de Control de Asistencia y QR
├── Llamadas - Briana/                       # Módulo de Campañas Telefónicas y Formularios
├── Oriana/                                  # Módulo de Análisis de Datos y Command Center
├── [Futuro] Evaluacion/                     # Módulo de Evaluación de Desempeño
├── [Futuro] Fichas/                         # Módulo de Gestión de Fichas Técnicas
├── Arquitectura Macro Intranet - Vercel & Supabase.md
└── .gitignore
```

---

## 🔒 Seguridad y Gobernanza de Acceso

- **Row-Level Security (RLS):** Toda consulta SQL evalúa criptográficamente `auth.uid()` con políticas forzadas (`FORCE ROW LEVEL SECURITY`).
- **Auditoría Inmutable:** Registro continuo de mutaciones con cálculo SHA-256 en base de datos (`content_hash`) y bloqueo estricto de inserciones directas client-side.
- **Cuota Semanal de Perfil:** Bloqueo automático para permitir un máximo de 1 actualización de datos personales cada 7 días (`tr_enforce_profile_edit_limits`).

---

## ⚙️ Ciclo de Vida y Cuotas Supabase (Free Tier)

- **Particionamiento Mensual:** Telemetría de latencia particionada por rangos de fecha (`PARTITION BY RANGE`).
- **Agregaciones Diarias Permanentes:** `telemetry_daily_aggregates`, `call_daily_aggregates` y `registros_daily_aggregates`.
- **Purga Automatizada:** Ejecución nocturna vía Edge Function de Supabase (`fn_archive_and_purge_lifecycle`) con retención configurable (default 90 días).

---

## 📱 Hardware Celular Samsung (Sin PBX)

- **Discador Guiado:** Máquina de estados en TypeScript con captura precisa de tiempos de llamada y tiempos muertos entre marcaciones.
- **Validación Criptográfica:** Algoritmo de Luhn para IMEI (15 dígitos) y verificación de modelo corporativo Samsung.

---

## 🚀 Despliegue

- **Frontend:** Vercel (Next.js App Router desacoplado).
- **Backend / Persistencia:** Supabase PostgreSQL 15+.
