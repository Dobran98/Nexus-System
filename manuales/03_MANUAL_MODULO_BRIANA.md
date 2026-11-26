# 🔵 MANUAL DEL MÓDULO BRIANA — TELEFONÍA CELULAR & CONTACT CENTER

**Ruta en Nexus:** `/llamadas`  
**Público:** `Analista - Operador`, `Supervisor`, `Coordinador`, `Admin`

---

## 1. Propósito del Módulo

**BRIANA** es la plataforma de Contact Center sin central PBX física. Permite operar campañas salientes de llamadas masivas directamente desde teléfonos móviles corporativos (terminales asignados con extensión `110XX`) mediante un **Discador Guiado** y **Tipificación en Tiempo Real**.

```
[Extensión 110XX] ──▶ [Lote Asignado] ──▶ [Llamar Siguiente] ──▶ [Encuesta/Incidencia]
                                                                        │
                        [Siguiente Contacto] ◀── [Tipificar Resultado] ◀┘
```

---

## 2. Flujo de Trabajo para el Analista - Operador

1. Ingrese a **Módulo Briana** desde el Lobby o pulse **"Abrir Discador"** en su Estación de Trabajo.
2. Verifique en la tarjeta de bienvenida Nexus su nombre y **Extensión (`110XX`)** y haga clic en **"Ingresar a Briana"**.
3. En la sección **Campañas Salientes**, seleccione la campaña activa asignada a su puesto.
4. Pulse **"Llamar Siguiente"**:
   - El sistema abrirá el marcador telefónico del dispositivo o mostrará el número del ciudadano.
   - Se iniciará la medición automática del **FIT (*First Interaction Time*)** para el Scoring de desempeño.
5. Durante la llamada, complete los campos del formulario dinámico de la campaña.
6. Al colgar, seleccione la **Tipificación Exacta**:
   - **Contacto Efectivo / Encuesta Completa**
   - **No Contesta / Buzón de Voz**
   - **Número Equivocado / Fuera de Servicio**
   - **Rechaza / Ocupado (Reintentar)**
7. Pulse **"Guardar y Continuar"** para avanzar automáticamente al próximo número del lote.

> [!TIP]
> **Meta de Cadencia:** Mantenga un intervalo inferior a **30 segundos** entre la finalización de una llamada y el inicio de la siguiente para optimizar su puntaje en el **Scoring Dinámico (40% del peso total)**.

---

## 3. Supervisión y Gestión de Campañas

Los usuarios con rol `Supervisor`, `Coordinador` o `Admin` tienen acceso al panel lateral de administración de Briana:

| Sección | Capacidad Operativa |
| :--- | :--- |
| **Campañas Salientes** | Crear campañas, cargar listados de contactos y activar/pausar colas de marcado. |
| **Asignación de Lotes** | Distribuir contactos pendientes entre operadores activos o reasignar lotes rezagados. |
| **Formularios Dinámicos** | Diseñar preguntas personalizadas que aparecen al operador durante la llamada. |
| **Reportes y Exportación** | Descargar sábanas de gestión telefónica en formato **Excel (`.xlsx`)** con métricas de efectividad. |

---

## 4. Preguntas Frecuentes (FAQ)

- **¿Qué hago si la llamada se corta antes de terminar el formulario?** Tipifique como *"Llamada Interrumpida"* para que el sistema reprograme el contacto sin contabilizarlo como rechazo.
- **No veo contactos en mi cola:** Verifique en su Estación de Trabajo si tiene lotes asignados; de lo contrario, solicite a su Supervisor la asignación de un nuevo lote mediante el modal de carga.
