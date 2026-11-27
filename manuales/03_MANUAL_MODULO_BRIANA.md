# 🔵 MANUAL DEL MÓDULO BRIANA — MARCADO REMOTO SAMSUNG (SIM & WHATSAPP)

**Ruta en Nexus:** `/llamadas` · **App Android:** `BrianaDialer.apk` (Samsung Galaxy A57 / A37)  
**Público:** `Analista - Operador`, `Supervisor`, `Coordinador`, `Admin`

---

## 1. Propósito y Arquitectura del Módulo

**BRIANA** elimina el costo de centrales VoIP/PBX externas conectando el navegador del operador en PC con la flota rotativa de teléfonos **Samsung Galaxy A57 y A37** con línea celular física (SIM propia) y **WhatsApp**, mediante **Supabase Realtime** y la aplicación nativa **BrianaDialer** (Kotlin + Android `TelecomManager` + `InCallService` + `NotificationListenerService`).

```
[PC Operador (/llamadas)] ──(Supabase Realtime)──▶ [APK BrianaDialer (Samsung)]
       ▲                                                 │              │
       │                                           [Llamada SIM]  [WhatsApp]
       │                                           Telecom API    NotifMonitor
       │                                                 │              │
[Modal Cierre Obligatorio] ◀──(Telemetría Exacta)────────┴──────────────┘
```

---

## 2. Preparación del Teléfono Samsung (Inicio de Turno)

Como los teléfonos rotan diariamente entre operadores, cada teléfono cuenta con un **Modo Turno Operador**:

1. Abra la app **BrianaDialer** en el Samsung asignado.
2. En la primera configuración del equipo:
   - Pulse **"Activar Modo Turno Operador"** y acepte establecer BrianaDialer como app de marcado predeterminada durante la jornada.
   - Pulse **"Permiso Monitor WhatsApp (Notificaciones)"** y habilite el acceso para **BrianaDialer** en los ajustes de Android.
   - En Ajustes → Aplicaciones → BrianaDialer → Batería, seleccione **"No restringido"** para evitar cortes en OneUI cuando la pantalla se apague.
3. En pantalla aparecerá el **Código Único de Vinculación** del teléfono (ej. `BRN-4829`) junto con su nivel de batería y red.

---

## 3. Flujo Operativo en PC (`/llamadas` → Marcador SIM)

### Paso A: Vincular Sesión
1. Ingrese a `/llamadas` con su sesión personal de Nexus.
2. Introduzca el código `BRN-XXXX` que muestra su Samsung y pulse **"Vincular y Comenzar Turno"**.
3. El sistema asignará automáticamente el siguiente contacto disponible de `contacts_queue` (priorizando reprogramados cuya hora ya venció).

### Paso B: Realizar la Llamada (SIM o WhatsApp)
- **Opción 1 — Llamar por SIM (Samsung):**
  - Al pulsar el botón verde en PC, la APK ejecuta `TelecomManager.placeCall()` usando la SIM física del teléfono.
  - Puede pulsar **"Colgar Llamada"** desde la PC o colgar desde la pantalla del Samsung (`Call.disconnect()`).
- **Opción 2 — Llamar por WhatsApp:**
  - Al pulsar **"Llamar por WhatsApp"**, la APK normaliza automáticamente el teléfono (ej. `0414...` → `58414...`) y abre el chat directo en WhatsApp / WhatsApp Business.
  - Toque el ícono de llamada VoIP en la pantalla del Samsung. El servicio `BrianaWhatsAppMonitorService` detecta timbre, conexión real y colgado automáticamente.
  - *Nota técnica:* Por restricción de WhatsApp en Android, si necesita colgar una llamada WhatsApp en curso hágalo desde el botón rojo en el teléfono (o use *"Cancelar Espera WhatsApp"* en PC si canceló antes de pulsar llamar).

### Paso C: Detección Automática vs Modal Obligatorio de Cierre
- **Si la llamada NUNCA conectó** (`DIALING`/`RINGING` → `DISCONNECTED` sin pasar por `ACTIVE`): Briana la registra automáticamente como **No Efectiva** (`sin_respuesta`, `ocupado`, `rechazada` o `cancelada_antes_de_conectar`) con `0s` de conversación y carga el siguiente número.
- **Si la llamada SÍ conectó** (`STATE_ACTIVE` alcanzado, cronómetro real en marcha): al finalizar la llamada se abre automáticamente en la PC el **Modal Obligatorio de Cierre** para tipificar:
  1. **Efectiva:** Contacto exitoso con el titular (+ notas opcionales).
  2. **No efectiva / Buzón de voz / Cortada:** Sub-opciones *Buzón de Voz* o *Cortada / Incompleta* (no infla las llamadas efectivas y reencola según máximo de intentos).
  3. **Reprogramar llamada:** Selector exacto de fecha y hora para volver a asignar el contacto en ese horario.
  4. **Número equivocado / No pertenece al titular:** Marca el registro como `invalid_number` para excluirlo de futuros reintentos y auditar calidad de data.

### Paso D: Cierre de Turno
Al finalizar su jornada, pulse **"Cerrar Turno y Liberar Teléfono"** en PC y desactive el **Modo Turno** en la APK para restaurar el marcador nativo de Samsung y liberar el equipo.

---

## 4. Dashboard Ejecutivo en Tiempo Real (`Dashboard Admin`)

Los roles `Supervisor`, `Coordinador`, `Coordinador General` y `Admin` disponen de la pestaña **Dashboard Admin** en `/llamadas`, actualizada en vivo con **Supabase Realtime**:

| Vista / Herramienta | Capacidad Operativa |
| :--- | :--- |
| **KPIs Globales** | Total de data, total llamados, pendientes, llamadas efectivas vs. fallidas y porcentaje de efectividad. |
| **Flota Samsung en Vivo** | Estado de cada A57/A37, PIN activo, operador en turno, porcentaje de batería y tipo de red (`WIFI` / `CELLULAR`). |
| **Análisis de Persistencia** | Métrica de efectividad acumulada al **1er**, **2do**, **3er** y **4to+ intento**. |
| **Trazabilidad por Intento** | Filtros de búsqueda por contacto, operador o teléfono mostrando duración real, origen (`pc_web` / `android_app`) y causa exacta de corte (`ended_by`). |
| **Reprogramados & Inválidos** | Listado vivo de citas programadas y auditoría de números marcados como no titulares. |
| **Cargar Contactos (`Modal`)** | Importación directa de listados a `contacts_queue` con deduplicación telefónica por lotes. |

> [!TIP]
> **Modo Legacy (`Briana Clásico`):** Para consultar campañas históricas de extensiones `110XX`, utilice el selector **"Briana Clásico"** en la barra superior de `/llamadas`.
