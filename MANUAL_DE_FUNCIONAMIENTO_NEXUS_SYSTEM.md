# MANUAL DE FUNCIONAMIENTO Y OPERACIONES
## PLATAFORMA INTEGRAL DE INTRANET EMPRESARIAL — NEXUS SYSTEM

---

**Versión:** 2.0.0  
**Fecha de Emisión:** Noviembre 2026  
**Clasificación:** Documento Oficial de Operaciones  
**Repositorio Oficial:** `https://github.com/Dobran98/Nexus-System.git`  
**Arquitectura Base:** Monorepo Desacoplado (Next.js 14 App Router / Supabase PostgreSQL 15 / Vercel Serverless)

---

## ÍNDICE GENERAL

1. [INTRODUCCIÓN Y PROPÓSITO DEL SISTEMA](#1-introducción-y-propósito-del-sistema)
2. [ARQUITECTURA GENERAL Y REQUISITOS TÉCNICOS](#2-arquitectura-general-y-requisitos-técnicos)
3. [GOBERNANZA DE ACCESO, ROLES Y PERFILES (RBAC)](#3-gobernanza-de-acceso-roles-y-perfiles-rbac)
4. [MÓDULO DE ASISTENCIA BIOMÉTRICA Y QR (ASYS)](#4-módulo-de-asistencia-biométrica-y-qr-asys)
5. [MÓDULO DE TELEFONÍA CELULAR SIN PBX (BRIANA)](#5-módulo-de-telefonía-celular-sin-pbx-briana)
6. [MÓDULO DE GESTIÓN DE INCIDENCIAS Y SLAS](#6-módulo-de-gestión-de-incidencias-y-slas)
7. [MÓDULO DE INGESTA MASIVA Y ANÁLISIS DE DATOS (ORIANA)](#7-módulo-de-ingesta-masiva-y-análisis-de-datos-oriana)
8. [MATRIZ DE EVALUACIÓN DINÁMICA Y SCORING](#8-matriz-de-evaluación-dinámica-y-scoring)
9. [CICLO DE VIDA DE DATOS, AUDITORÍA Y CUOTAS SUPABASE](#9-ciclo-de-vida-de-datos-auditoría-y-cuotas-supabase)
10. [GUÍA DE CONTINGENCIAS Y RESOLUCIÓN DE PROBLEMAS](#10-guía-de-contingencias-y-resolución-de-problemas)

---

## 1. INTRODUCCIÓN Y PROPÓSITO DEL SISTEMA

El **NEXUS SYSTEM** es la plataforma unificada de intranet institucional diseñada para centralizar, controlar y auditar la totalidad de las operaciones críticas de la organización:

- **Control de Presencia:** Marcación digital de asistencia mediante Código QR dinámico, biometría y geolocalización.
- **Telefonía Celular Corporativa:** Gestión guiada de campañas telefónicas sobre terminales Samsung Enterprise sin dependencia de conmutadores PBX tradicionales.
- **Gestión de Incidencias:** Mesa de tickets operativos con acuerdos de nivel de servicio (SLA) automáticos según criticidad.
- **Procesamiento de Datos:** Ingesta masiva de bases de datos, validación estructurada y reportería analítica (Oriana Command Center).
- **Evaluación de Rendimiento:** Algoritmo ponderado dinámico para calificar la productividad de operadores en roles híbridos.

---

## 2. ARQUITECTURA GENERAL Y REQUISITOS TÉCNICOS

### 2.1 Topología del Sistema
El sistema opera bajo una estructura monorepo desacoplada gestionada con **Turborepo** y **pnpm workspaces**:

```
NEXUS SYSTEM/
├── apps/
│   ├── attendance/         # Aplicación Next.js: Marcación QR y telemetría de jornada
│   ├── calls-incidents/    # Aplicación Next.js: Discador guiado, tickets y SLAs
│   ├── oriana/             # Aplicación Next.js: Análisis de datos y reportes
│   └── admin-portal/       # Aplicación Next.js: Gobernanza, perfiles e ingesta masiva
├── packages/
│   ├── database/           # Contratos TypeScript generados (database.types.ts)
│   ├── ui/                 # Design System corporativo (@intranet/ui)
│   └── auth/               # Middlewares de seguridad y validadores Zod
└── supabase/
    └── migrations/         # Scripts DDL estructurados (0001 a 0005)
```

### 2.2 Requisitos de Hardware y Conectividad
- **Estaciones de Trabajo (PC/Laptop):** Procesador dual-core 2.0 GHz, 4 GB RAM, monitor 1366x768 mínimo, conexión a internet estable (mínimo 2 Mbps).
- **Navegadores Homologados:** Google Chrome (v115+), Microsoft Edge (v115+), Mozilla Firefox (v118+).
- **Terminales Móviles Samsung:** Dispositivos Samsung Galaxy A15 / A25 Enterprise Edition o superior con Android 13+, cámara trasera funcional para escaneo QR y chip celular activo con cobertura móvil de voz.

---

## 3. GOBERNANZA DE ACCESO, ROLES Y PERFILES (RBAC)

### 3.1 Jerarquía y Privilegios
El acceso se rige estrictamente por el principio de **Mínimo Privilegio**:

| Rol | Identificador | Nivel | Alcance Funcional |
| :--- | :--- | :--- | :--- |
| **Superadmin** | `superadmin` | 100 | Gestión total de infraestructura, bypass auditado de RLS y mantenimiento de base de datos. |
| **Admin de Módulo** | `module_admin` | 80 | Configuración de campañas, asignación de inventario Samsung y parametrización de metas. |
| **Supervisor** | `supervisor` | 60 | Asignación operativa de leads, aprobación de tickets, revisión de latencias y auditoría. |
| **Operador** | `multi_operator` | 40 | Marcaje de asistencia, ejecución de llamadas en terminal Samsung y reporte de incidencias. |
| **Analista** | `data_analyst` | 40 | Validación de lotes de datos, detección de discrepancias y emisión de reportes Oriana. |
| **Auditor** | `auditor` | 20 | Acceso de solo lectura a trazas criptográficas, métricas agregadas y tablas de auditoría. |

### 3.2 Política de Restricción Semanal de Edición de Perfil
Para salvaguardar la consistencia de la nómina y evitar fraudes:
1. **Campos Inmutables:** Cédula (`document_id`), nombre legal (`full_name`) y estado (`is_active`) están permanentemente bloqueados para el usuario.
2. **Campos Protegidos:** Teléfono móvil y dirección física disponen de una **cuota estricta de una (1) modificación cada 7 días naturales**.
3. **Bloqueo Visual:** La interfaz del portal administrativo despliega un contador regresivo (`DD:HH:MM:SS`) inhabilitando los campos hasta el cumplimiento exacto del plazo de 7 días.

---

## 4. MÓDULO DE ASISTENCIA BIOMÉTRICA Y QR (ASYS)

### 4.1 Flujo Operativo de Marcación
1. **Inicio de Sesión:** El colaborador ingresa al aplicativo de asistencia (`/apps/attendance`).
2. **Presentación de Credencial:** Se escanea el Código QR institucional dinámico o se valida la huella digital.
3. **Registro Automático:** El sistema captura:
   - Tipo de evento: Entrada (`clock_in`), Inicio de Almuerzo (`break_start`), Fin de Almuerzo (`break_end`), Salida (`clock_out`).
   - Coordenadas geográficas (Latitud y Longitud GPS).
   - Huella digital de hardware (`device_fingerprint`).
4. **Validación de Secuencia:** El motor PostgreSQL rechaza eventos anómalos (ejemplo: registrar salida sin haber marcado entrada previa).

```
[Inicio de Turno] ──> clock_in ──> [Jornada Activa]
                           │
                           ├──> break_start ──> [Pausa Almuerzo] ──> break_end
                           │
                           └──> clock_out ──> [Cierre de Jornada y Cálculo Neto]
```

### 4.2 Telemetría de Latencia Inicial
El sistema mide con precisión de segundos el intervalo entre el `clock_in` y la primera acción efectiva en el sistema (abrir el discador de llamadas o cargar el módulo Oriana). Esta latencia se registra en `workflow_latency_logs` y alimenta el scoring diario.

---

## 5. MÓDULO DE TELEFONÍA CELULAR SIN PBX (BRIANA)

### 5.1 Filosofía de Operación
NEXUS no emplea servidores Asterisk ni softphones virtuales que saturan el ancho de banda. Las llamadas se ejecutan físicamente sobre la red celular corporativa mediante terminales Samsung Galaxy corporativos asignados a cada operador.

```
┌────────────────────────────────┐       ┌────────────────────────────────┐
│   INTRANET NEXUS (PC/Navegador)│       │  TERMINAL SAMSUNG CORPORATIVO  │
│                                │       │                                │
│ 1. Muestra número en pantalla  │       │ 2. Operador digita y marca en  │
│ 2. Operador pulsa "INICIAR"    │       │    el celular sobre red móvil  │
│ 3. Cronómetro activo           │       │ 3. Conversación con usuario    │
│ 4. Operador pulsa "FINALIZAR"  │       │ 4. Cuelga llamada              │
│ 5. Tipifica y guarda gestión   │       │                                │
└────────────────────────────────┘       └────────────────────────────────┘
```

### 5.2 Uso del Discador Guiado (`GuidedDialer`)
1. **Recepción de Lead:** El operador visualiza el número telefónico asignado, nombre del titular y prioridad en cola.
2. **Inicio de Gestión:** Al pulsar **"Iniciar Marcación Manual"**:
   - Se registra el `start_time` en milisegundos.
   - El operador digita el número en su terminal Samsung.
   - El temporizador de llamada se activa en pantalla.
3. **Finalización:** Al concluir la llamada, el operador pulsa **"Finalizar Llamada"**:
   - Se captura automáticamente el `end_time`.
   - La base de datos calcula de forma inmutable la duración neta (`duration_seconds`).
4. **Tipificación Obligatoria:** El operador debe seleccionar una de las 5 opciones:
   - `answered_effective`: Contacto cualificado y efectivo.
   - `busy`: Línea ocupada.
   - `no_answer`: No contestan o buzón de voz directo.
   - `invalid_number`: Número errado, inexistente o fuera de servicio.
   - `rejected`: Llamada cortada o rechazada explícitamente.
5. **Control de Tiempo Muerto (`idle_time_prior_call`):** El sistema cronometra los segundos transcurridos entre la finalización de una llamada y el inicio de la siguiente. Si el tiempo excede los **45 segundos**, la interfaz emite una alerta visual en ámbar.

---

## 6. MÓDULO DE GESTIÓN DE INCIDENCIAS Y SLAS

### 6.1 Matriz de Severidad y Tiempos de Respuesta
Cualquier operador o supervisor puede emitir tickets de incidencia operativa a través del portal. Los acuerdos de nivel de servicio (SLA) se asignan de forma automática:

| Severidad | Código | Tiempo Máximo de Resolución (SLA) | Escalamiento Automático |
| :--- | :--- | :--- | :--- |
| **Crítica** | `critical` | **1 hora** | Notificación inmediata a Superadmin y Coordinador General. |
| **Alta** | `high` | **4 horas** | Alerta a Supervisores de Guardia. |
| **Media** | `medium` | **24 horas** | Revisión ordinaria en mesa de ayuda. |
| **Baja** | `low` | **72 horas** | Programación técnica de rutina. |

### 6.2 Ciclo de Vida del Ticket
- `open`: Ticket emitido y en cola de asignación.
- `investigating`: Técnico asignado trabajando en la resolución.
- `resolved`: Solución implementada; requiere confirmación del reportante.
- `closed`: Cierre definitivo auditado con notas de resolución.

Si la fecha actual supera el `sla_due_date` sin que el ticket esté resuelto, el sistema marca irreversiblemente la bandera `sla_breached = TRUE`.

---

## 7. MÓDULO DE INGESTA MASIVA Y ANÁLISIS DE DATOS (ORIANA)

### 7.1 Ingestor Masivo Drag & Drop
Ubicado en el portal administrativo (`/apps/admin-portal/src/app/ingest`), permite la incorporación de grandes volúmenes de contactos sin degradar la base de datos:

1. **Carga de Archivo:** Admite arrastrar archivos delimitados por comas (`.csv` o `.txt`) con capacidad de hasta **50,000 registros por lote**.
2. **Normalización Automática:** Convierte formatos telefónicos locales (`0414...`) a estándar internacional E.164 (`+58414...`).
3. **Detección de Duplicados en Memoria:** Compara los números telefónicos dentro del archivo antes de enviar la solicitud a la red; marca en color ámbar las filas duplicadas e impide su inserción repetida.
4. **Transmisión por Lotes (Chunking):** Envía la información en bloques de 100 registros mediante streaming para no saturar los límites de tiempo de ejecución serverless.
5. **Monitoreo con Barra de Progreso:** Muestra el porcentaje de avance (0% a 100%) y entrega un resumen de inserciones exitosas versus duplicados omitidos.

### 7.2 Validación y Control de Calidad Oriana
Los analistas procesan los lotes validando consistencia comunal y territorial:
- Registro de discrepancias (`discrepancy_count`).
- Cálculo automático de precisión porcentual (`validation_accuracy`).
- Hash criptográfico por registro (`record_hash`) para certificar que ningún insumo sea alterado posterior a su revisión.

---

## 8. MATRIZ DE EVALUACIÓN DINÁMICA Y SCORING

### 8.1 Ponderaciones por Rol Operativo
El sistema evalúa el rendimiento diario en base a parámetros configurables:

#### Campaña de Llamadas:
- **Volumen de llamadas por hora (30%):** Meta $\ge 25$ llamadas/hora netas.
- **Tasa de contacto efectivo (35%):** Meta $\ge 40\%$ contestadas y cualificadas.
- **Cumplimiento de cuota diaria (20%):** Meta base de 200 llamadas/día.
- **Latencia entre llamadas (15%):** Meta promedio $\le 45$ segundos de tiempo muerto.

#### Analítica Oriana:
- **Precisión de validación (40%):** Tasa de error $\le 1.5\%$ (precisión $\ge 98.5\%$).
- **Velocidad de procesamiento (30%):** Meta $\ge 120$ registros validados/hora.
- **Puntualidad de entrega (20%):** Entrega con $\ge 30$ minutos de antelación al corte.
- **Discrepancias en auditoría (10%):** Cero observaciones materiales.

### 8.2 Algoritmo de Scoring para Funciones Híbridas
Si un colaborador asume múltiples funciones durante el mismo día (por ejemplo, llamadas en la mañana y análisis de datos en la tarde), el puntaje final se pondera proporcionalmente según el tiempo dedicado a cada labor:

$$S_d = \sum_{m=1}^{M} \left( \frac{T_m}{T_{\text{total}}} \sum_{i=1}^{K_m} \left( N_{m,i} \times W_{m,i} \right) \right)$$

Donde:
- $T_m$: Minutos dedicados al módulo $m$.
- $T_{\text{total}}$: Minutos totales de la jornada laboral.
- $N_{m,i}$: Subpuntaje normalizado (0 a 100).
- $W_{m,i}$: Peso porcentual de la métrica $i$.

---

## 9. CICLO DE VIDA DE DATOS, AUDITORÍA Y CUOTAS SUPABASE

### 9.1 Permanencia bajo Cuota Supabase Free Tier (500 MB)
Para garantizar la continuidad operativa gratuita y sin degradación de rendimiento:

```
┌────────────────────────────────────────────────────────┐
│     DATOS OPERACIONALES DETALLADOS (Últimos 90 días)   │
│     - call_interactions individuales                   │
│     - workflow_latency_logs por evento                 │
│     - registros crudos                                 │
└──────────────────────────┬─────────────────────────────┘
                           │
             [Función de Purga Nocturna 02:00 UTC]
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│          CONSOLIDACIÓN EN AGREGADOS PERMANENTES        │
│          - telemetry_daily_aggregates                  │
│          - call_daily_aggregates                       │
│          - registros_daily_aggregates                  │
│          (Histórico de KPIs de por vida: ~2 MB/año)    │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│      ELIMINACIÓN DE DETALLES OBSOLETOS (>90 días)      │
│      - Purgado de logs de llamadas finalizadas         │
│      - DROP de particiones mensuales vencidas          │
│      - Mantenimiento del uso de disco en ~180-250 MB   │
└────────────────────────────────────────────────────────┘
```

### 9.2 Auditoría Inmutable (`audit_logs`)
- Toda mutación (`INSERT`, `UPDATE`, `DELETE`) en tablas críticas dispara el trigger `fn_audit_trigger`.
- Se registra el usuario (`actor_id`), IP de origen, User-Agent, datos previos (`old_data`) y datos nuevos (`new_data`).
- Cada fila calcula automáticamente un **hash SHA-256 inmutable** (`content_hash`).
- RLS prohíbe de forma absoluta cualquier `UPDATE` o `DELETE` sobre la tabla de auditoría.

---

## 10. GUÍA DE CONTINGENCIAS Y RESOLUCIÓN DE PROBLEMAS

### 10.1 Códigos de Error Frecuentes

| Código de Error | Causa Raíz | Procedimiento de Resolución |
| :--- | :--- | :--- |
| `DEVICE_NOT_ASSIGNED_TO_OPERATOR` | El terminal Samsung en uso está registrado a nombre de otro colaborador. | El supervisor debe ingresar a `/admin-portal` y ejecutar la reasignación del dispositivo. |
| `DURATION_TOO_SHORT` | La llamada duró menos de 1 segundo (pulsación accidental). | Descartar el registro o reintentar la marcación real. |
| `INVALID_TIME_RANGE` | El reloj del cliente está desincronizado respecto a los servidores de Supabase. | Configurar la hora de la computadora en modo "Automático / Red". |
| `EDICION_PERFIL_BLOQUEADA` | Intento de modificar teléfono o dirección antes de cumplir 7 días desde la última edición. | Esperar que el contador regresivo llegue a cero o solicitar excepción a RRHH. |
| `IMEI_LUHN_INVALID` | El IMEI ingresado al inventario tiene un error tipográfico en el dígito verificador. | Verificar el IMEI marcando `*#06#` en el teléfono Samsung y corregir la entrada. |

### 10.2 Procedimiento ante Fallas de Conexión Local
1. **Pérdida Momentánea de Internet:** Los formularios del Discador conservan en memoria local (`sessionStorage`) los datos de la última llamada finalizada para evitar pérdida de información.
2. **Reanudación:** Al restablecerse el enlace, la intranet envía automáticamente el paquete de interacción pendiente con su estampa de tiempo original intacta.
3. **Falla Crítica de Terminal Celular:** El supervisor marcará el dispositivo como `maintenance` o `lost` en la tabla `corporate_devices` y asignará un equipo de respaldo de la reserva técnica.

---

*Manual elaborado y certificado por la Dirección de Arquitectura de Sistemas.*  
*NEXUS SYSTEM v2.0 — Todos los derechos reservados.*
