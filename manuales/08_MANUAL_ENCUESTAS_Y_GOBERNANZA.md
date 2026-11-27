# 🛡️ MANUAL DE ENCUESTAS, GOBERNANZA, MODALES Y RBAC

**Dirigido a:** `Coordinador`, `Coordinador General`, `Admin`, `Superadmin`, `Fundador Dev`  
**Rutas & Modales:** `/users` (`/admin/usuarios`), **Monitor ASYS**, **Encuestas**, **Emitir Aviso**, **Módulos (Feature Flags)**

---

## 1. Gestión Corporativa de Personal y Fotos (`/users`)

Los roles `Coordinador General`, `Admin`, `Superadmin` y `Fundador Dev` administran el ciclo completo de credenciales `@impress.com`:

- **Crear Usuario:** Asignar nombre completo, cédula, correo `@impress.com`, rol en la jerarquía oficial (`Analista - Operador` hasta `Superadmin`), turno, extensión/terminal y **fotografía corporativa (`foto_url`)**.
- **Editar & Fotos Corporativas:** Actualizar datos de contacto, áreas autorizadas y fotografía visible en perfiles y directorio sin salir de la intranet.
- **Congelar / Reactivar:** Suspender temporalmente un acceso (`is_active = false`) conservando toda la bitácora de auditoría.
- **Liberar Cooldown (7 Días):** Desbloquear la edición del perfil en `/profile` antes de cumplir la semana reglamentaria.
- **Monitor ASYS (Modal Puente):** Consultar sesiones abiertas en sala, ausentes del día, aprobar permisos y registrar marcajes manuales de asistencia desde `/users`.
- **Scoring & Lifecycle 500 MB:** Consultar el ranking ponderado (`Asys 30% + Briana 40% + Oriana 30%`, recalculo permitido para Supervisor+) y ejecutar purgas de mantenimiento (> 90 días, exclusivo Superadmin / Fundador Dev / Cron).

> [!CAUTION]
> **Seguridad de Rangos (Stealth Governance):** Ningún `Admin` o `Coordinador General` puede visualizar, editar ni asignar cuentas `Superadmin` o `Fundador Dev`. La validación en backend usa `getUserRbacContext` e identidad exacta verificada.

---

## 2. Sistema de Encuestas Corporativas (`Nexus Surveys`)

Disponible desde el botón **Encuestas** del Navbar (`EncuestasModal`):

1. **Para Analistas y Supervisores:** Permite responder sondeos activos (calificación 1–5 estrellas, opción múltiple y comentario abierto) evitando duplicidad.
2. **Para Coordinadores, Coordinadores Generales y Admins:**
   - **Crear Nueva Encuesta:** Definir título, categoría, días de vigencia y constructor dinámico de preguntas. Al publicar, emite una notificación global (`global@impress.com`) al personal.
   - **Resultados & Analítica:** Visualizar total de respuestas, promedios por pregunta, desglose porcentual y retroalimentación textual, además de abrir o cerrar el sondeo.

---

## 3. Emisión de Avisos Transversales (`Emitir Aviso`)

El modal **Emitir Aviso** (`EmitirAvisoModal` + `GlobalNotificationOverlay`) permite a `Supervisores` y rangos superiores enviar comunicados:

- **Alcance:** 🌐 **Global** (toda la plataforma), 👤 **Individual** (usuario específico) o 👥 **Por Rol** (`multi_operator`, `supervisor`, `coordinador`, `coordinador_general`, `module_admin`, `data_analyst`, `auditor`).
- **Alerta Flotante Inmediata (`Popup`):** Despliega un modal prioritario sobre cualquier vista o iframe abierto (`Asys`, `Briana`, `Oriana`, `JADE`) exigiendo confirmación de lectura.

---

## 4. Consola de Gobernanza de Módulos (`Feature Flags`)

Exclusiva para `Fundador Dev` y `Superadmin` desde el botón **Módulos** (`ModuleGovernanceModal`):

- 🟢 **Público:** Operativo para todos los roles autorizados.
- 🟡 **Solo Pruebas Dev:** Visible y accesible únicamente para `Fundador Dev` y `Superadmin` para pruebas en caliente antes de liberar cambios.
- 🔴 **Mantenimiento:** Bloquea temporalmente el acceso mostrando un aviso institucional (`ModuleBlockedScreen`).
