# 🟢 MANUAL DEL MÓDULO ASYS — CONTROL DE ASISTENCIA Y GUARDIAS

**Ruta en Nexus:** `/asistencia`  
**Público:** `Analista - Operador`, `Supervisor`, `Coordinador`, `Admin`

---

## 1. Propósito del Módulo

**ASYS** gestiona la presencia física, puntualidad, permisos laborales, guardias y suplencias de todo el personal mediante **Códigos QR Maestros** y **Geolocalización GPS en tiempo real**.

```
[Llegada a Sede] ──▶ [Activar GPS] ──▶ [Escanear QR Maestro] ──▶ [Estado: ● DENTRO]
                                                                       │
[Salida de Sede] ◀── [Estado: ● FUERA] ◀── [Escanear QR Maestro] ◀─────┘
```

---

## 2. Guía Paso a Paso para el Personal (Marcado QR)

1. Ingrese a **Módulo Asys** desde el Lobby o pulse **"Marcar Ahora"** en su Estación de Trabajo.
2. El sistema iniciará sesión automáticamente mediante **Nexus SSO** (sin pedirle usuario ni contraseña nuevamente).
3. En su panel, pulse el botón **"Registrar Asistencia / Escanear QR"**.
4. Cuando el navegador solicite permiso de **Ubicación (GPS)** y **Cámara**, presione **Permitir**.
5. Apunte la cámara hacia el **Código QR Maestro** ubicado en la recepción o entrada de su sala.
6. Verá la confirmación inmediata con la hora oficial, tipo (`Entrada` o `Salida`) y distancia en metros respecto a la sede.

> [!IMPORTANT]
> **Validación de Rango Geográfico:** El sistema calcula la distancia entre su dispositivo y las coordenadas de la sede. Si el GPS está apagado o con baja señal, el registro puede marcarse como *"Fuera de Rango"* y generar alerta al supervisor.

---

## 3. Permisos, Reposos y Suplencias

Desde la vista de usuario en ASYS también puede:
- **Solicitar Permiso:** Indicar fecha de inicio, fecha de fin, motivo (médico, personal, académico) y comentarios.
- **Consultar Historial:** Ver sus marcajes diarios, horas acumuladas y amonestaciones si las hubiera.
- **Ver Guardias Asignadas:** Consultar si tiene turnos especiales o de fin de semana programados.

---

## 4. Funciones para Supervisores y Coordinadores

Al ingresar con rol de **Supervisor**, **Coordinador** o **Admin**, ASYS habilita el panel administrativo con las siguientes herramientas:

| Pestaña / Widget | Función Principal |
| :--- | :--- |
| **Dashboard General** | Muestra el **Código QR Maestro** imprimible, la lista en vivo de **Sesiones Abiertas (Dentro)** y la lista de **Ausentes Hoy**. |
| **Gestión de Permisos** | Aprobar o rechazar solicitudes de ausencia enviadas por el personal. |
| **Gestión de Guardias** | Programar guardias ordinarias, nocturnas, de fin de semana o feriados. |
| **Gestión de Suplencias** | Registrar reemplazos temporales entre operadores. |
| **Validación de Horarios** | Revisar y aprobar horarios especiales cargados por el equipo. |
| **Amonestaciones & Auditoría** | Verificar atrasos o inasistencias injustificadas y consultar la bitácora del módulo. |

---

## 5. Solución de Problemas Frecuentes (FAQ)

- **La cámara no abre al escanear el QR:** Verifique que no tenga otra app usando la cámara y que la URL comience con `https://`. En celulares Android/iOS, acepte los permisos del navegador.
- **Aparece "Fuera de Rango" estando en la oficina:** Conéctese al WiFi de la sede o acérquese brevemente a una ventana para que el chip GPS obtenga precisión menor a 50 metros.
- **Olvidé marcar mi Salida ayer:** Informe inmediatamente a su Supervisor o Coordinador para que realice el registro manual justificado y cierre la sesión abierta.
