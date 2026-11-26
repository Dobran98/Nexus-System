# 🛡️ MANUAL DE ENCUESTAS, GOBERNANZA Y ADMINISTRACIÓN RBAC

**Dirigido a:** `Coordinador`, `Coordinador General`, `Admin`, `Superadmin`, `Fundador Dev`  
**Rutas:** `/users` (`/admin/usuarios`), Modal **Encuestas**, Modal **Emitir Aviso**, Modal **Módulos**

---

## 1. Gestión de Personal y Roles (`/users`)

Los roles `Coordinador General`, `Admin`, `Superadmin` y `Fundador Dev` administran el ciclo completo de credenciales `@impress.com`:

- **Crear Usuario:** Asignar nombre completo, cédula, correo `@impress.com`, rol en la jerarquía oficial (`Analista - Operador` hasta `Superadmin`), turno, extensión Briana (`110XX`) y áreas autorizadas.
- **Congelar / Reactivar:** Suspender temporalmente un acceso sin borrar su historial de auditoría.
- **Liberar Cooldown (7 Días):** Desbloquear la edición de perfil de un colaborador antes de cumplir la semana.
- **Scoring & Purga 500MB:** Consultar el ranking de desempeño ponderado y ejecutar limpieza preventiva de logs > 90 días.

> [!CAUTION]
> **Seguridad de Rangos:** Ningún `Admin` o `Coordinador General` puede crear ni visualizar cuentas `Superadmin` o `Fundador Dev` (*Stealth Governance*). Solo un `Superadmin` o el `Fundador Dev` puede otorgar el rol `Superadmin`.

---

## 2. Sistema de Encuestas Corporativas (`Nexus Surveys`)

Disponible desde el botón **Encuestas** del Navbar:

1. **Para Analistas y Supervisores:** Permite responder sondeos activos (escala 1–5 estrellas, selección múltiple y texto libre) sin duplicidad.
2. **Para Coordinadores y Admins:**
   - **Pestaña Crear Nueva Encuesta:** Definir título, categoría, vigencia en días y constructor dinámico de preguntas. Al publicar, se envía notificación automática al personal.
   - **Pestaña Resultados & Analítica:** Visualizar total de respuestas, promedios por pregunta, barras de porcentaje y comentarios cualitativos, además de cerrar o reactivar el sondeo.

---

## 3. Consola de Gobernanza de Módulos (Feature Flags — Solo Fundador Dev / Superadmin)

Desde el botón dorado **Módulos** en el Navbar, el `Fundador Dev` controla en tiempo real la disponibilidad de cada sistema:

- 🟢 **Público:** Accesible para todos los roles autorizados.
- 🟡 **Solo Pruebas Dev:** Visible y operable únicamente para `Fundador Dev` y `Superadmin` para validar cambios en caliente antes de liberarlos.
- 🔴 **Mantenimiento:** Bloquea el acceso general mostrando el mensaje de mantenimiento configurado.

---

## 4. Emisión de Avisos Transversales (`Emitir Aviso`)

Permite enviar comunicados **Globales** (a toda la intranet), **Por Rol** o **Individuales** con la opción **"Desplegar como Alerta Flotante Inmediata"**, visible encima de cualquier iframe (Asys, Briana, Oriana o JADE).
