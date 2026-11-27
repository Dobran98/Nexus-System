# 🟢 MANUAL DEL MÓDULO ASYS — CONTROL DE ASISTENCIA Y GUARDIAS

**Ruta en Nexus:** `/asistencia` · **Puente Administrativo:** `/users` → Botón **Monitor ASYS**  
**Público:** `Analista - Operador`, `Supervisor`, `Coordinador`, `Admin`

---

## 1. Propósito del Módulo

**ASYS** gestiona la presencia física, puntualidad, permisos laborales, guardias, suplencias y fotografía corporativa de todo el personal mediante **Códigos QR Maestros**, **Geolocalización GPS en tiempo real** y un **Monitor Puente Administrativo** integrado en la intranet.

```
[Llegada a Sede] ──▶ [Activar GPS] ──▶ [Escanear QR Maestro] ──▶ [Estado: ● DENTRO]
                                                                       │
[Salida de Sede] ◀── [Estado: ● FUERA] ◀── [Escanear QR Maestro] ◀─────┘
```

---

## 2. Guía Paso a Paso para el Personal (Marcado QR)

1. Ingrese a **Módulo Asys** (`/asistencia`) desde el Lobby o pulse **"Marcar Ahora"** en su Estación de Trabajo.
2. El sistema iniciará sesión automáticamente mediante **Nexus SSO** (sin pedirle usuario ni contraseña nuevamente).
3. Pulse **"Registrar Asistencia / Escanear QR"** y permita **Ubicación (GPS)** y **Cámara**.
4. Apunte la cámara hacia el **Código QR Maestro** ubicado en la entrada de su sala.
5. Verá la confirmación inmediata con la hora oficial, tipo (`Entrada` o `Salida`) y distancia en metros respecto a la sede.

> [!IMPORTANT]
> **Validación de Rango Geográfico:** El sistema calcula la distancia entre su dispositivo y las coordenadas de la sede. Si el GPS está apagado o con baja señal, el registro puede marcarse como *"Fuera de Rango"* y alertar al supervisor.

---

## 3. Permisos, Reposos y Suplencias

Desde la vista de usuario en ASYS también puede:
- **Solicitar Permiso:** Indicar fecha de inicio, fecha de fin, motivo (médico, personal, académico) y observaciones.
- **Consultar Historial:** Ver sus marcajes diarios, horas acumuladas y amonestaciones si las hubiera.
- **Ver Guardias Asignadas:** Consultar turnos especiales o de fin de semana programados.

---

## 4. Monitor Puente ASYS & Funciones Administrativas en Intranet

Los roles `Supervisor`, `Coordinador`, `Coordinador General` y `Admin` cuentan con dos vías de operación:
1. **Monitor Puente ASYS (`AsysAdminBridgeModal` en `/users`):** Modal directo dentro de la intranet sin necesidad de abrir el módulo externo, que permite:
   - Consultar en vivo **Sesiones Abiertas (Dentro)** y **Ausentes Hoy**.
   - Ejecutar **Marcajes Manuales Justificados (Entrada / Salida)** a colaboradores con falla de GPS o dispositivo.
   - Aprobar o rechazar solicitudes de **Permisos**.
2. **Panel Completo ASYS (`/asistencia`):**

| Pestaña / Widget | Función Principal |
| :--- | :--- |
| **Dashboard General** | Muestra el **Código QR Maestro** imprimible, sesiones abiertas y ausencias del día. |
| **Gestión de Guardias & Suplencias** | Programación de guardias ordinarias, nocturnas, fin de semana y reemplazos temporales. |
| **Validación de Horarios & Amonestaciones** | Revisión de horarios especiales y bitácora de auditoría de puntualidad. |
| **Identidad Visual** | Sincronizada con la fotografía corporativa (`foto_url`) asignada desde `/users`. |

---

## 5. Solución de Problemas Frecuentes (FAQ)

- **La cámara no abre al escanear el QR:** Verifique que no tenga otra app usando la cámara y que la URL comience con `https://`.
- **Aparece "Fuera de Rango" estando en la oficina:** Conéctese al WiFi de la sede o acérquese brevemente a una ventana para que el GPS calibre con precisión menor a 50 metros.
- **Olvidé marcar mi Salida ayer:** Informe a su Supervisor o Administrador para que registre la salida manual desde el **Monitor ASYS** en `/users`.
