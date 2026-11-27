# 📘 MANUAL GENERAL DEL ECOSISTEMA NEXUS SYSTEM

**Versión del Documento:** 4.0.0 · **Actualización:** Noviembre 2026  
**Arquitectura:** Next.js 14 (App Router) · Supabase PostgreSQL 15 + Realtime · Vercel · Android Nativo (Kotlin + Jetpack Compose)  
**Clasificación:** Documentación Maestra Corporativa — Todos los Niveles

---

## 1. Visión General y Mapa del Ecosistema

**NEXUS SYSTEM** es la Intranet Corporativa Unificada diseñada para centralizar en una sola plataforma segura el control de asistencia, las operaciones telefónicas celulares sin PBX (vía flota Samsung Galaxy A57/A37 + WhatsApp), la analítica de gestión diaria, la planificación territorial, el triage de incidencias y la gobernanza integral de personal.

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                     NEXUS INTRANET — LOBBY MAESTRO (SSO)                     ║
║   Identidad Única (@username) · Estado DENTRO/FUERA · Notificaciones · Docs  ║
╠═══════════════╦═══════════════╦═══════════════╦═══════════════╦══════════════╣
║  🟢 ASYS      ║  🔵 BRIANA    ║  🟣 ORIANA    ║  🟡 RECLASIF. ║  💎 JADE     ║
║  Asistencia   ║  SIM Samsung  ║  Command      ║  Triage &     ║  Misiones &  ║
║  QR + Puente  ║  & WhatsApp   ║  Center       ║  Auditoría    ║  Rendición   ║
╠═══════════════╩═══════════════╩═══════════════╩═══════════════╩══════════════╣
║  🗳️ ELECCIONES (335 Municipios) · 📋 ENCUESTAS · 👤 /users + Fotos · 🎛️ FLAGS ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

### Catálogo de Módulos Activos e Integrados

| Módulo | Ruta Interna | Propósito Principal | Tecnología Base |
| :--- | :--- | :--- | :--- |
| **ASYS** | `/asistencia` | Control de presencia QR + GPS, guardias, permisos y Monitor Puente Admin | SPA + Supabase + SSO + Modal Puente |
| **BRIANA** | `/llamadas` | Marcador Remoto PC ↔ Samsung A57/A37 (SIM y WhatsApp), tipificación y Dashboard Realtime | Next.js + Supabase Realtime + APK Kotlin |
| **ORIANA** | `/oriana` | Reporte diario de gestión, áreas de trabajo y auditoría cruzada | SPA + Supabase + SSO |
| **RECLASIFICACIÓN** | `/reclasificacion` | Triage ágil de incidencias sin bloqueo de Excel y reparto equitativo | Next.js + API Supabase + RPC |
| **JADE** | `/planificacion` | Planificación territorial, misiones, Classroom y rendición | GAS Bridge + BD Planificación |
| **ELECCIONES** | `/elecciones` | Sala Nacional Electoral por franjas horarias (9AM – 8PM) | Next.js + API Electoral |
| **ENCUESTAS** | Modal `/#encuestas` | Sondeos de clima laboral y evaluación de puesto | Modal React + `/api/encuestas` |
| **GOBERNANZA** | `/users` & Modales | CRUD de personal `@impress.com`, Fotos Corporativas, RBAC, Avisos y Feature Flags | Next.js + Supabase Admin + RPC |

---

## 2. Matriz Jerárquica de Roles (RBAC — 6 Niveles)

El sistema gobierna el acceso mediante una jerarquía estricta ordenada **del nivel más bajo al más alto**, centralizada en `@/lib/rbac`:

| Nivel | Rol Técnico | Nombre en Plataforma | Rango & Privilegios |
| :---: | :--- | :--- | :--- |
| **1** | `analista_operador` / `multi_operator` | **Analista - Operador** | Rol operativo base unificado. Acceso a Asys (marcaje QR), Briana (marcador SIM/WhatsApp), Oriana (reporte diario), Encuestas y Manuales. |
| **2** | `supervisor` | **Supervisor** | Monitoreo de sala, Monitor ASYS, seguimiento de sesiones Samsung, cargas de colas Briana y revisión de equipo. |
| **3** | `coordinador` | **Coordinador** | Creación de encuestas operativas, gestión de áreas asignadas, permisos de sala y analítica de encuestas. |
| **4** | `coordinador_general` | **Coordinador General** | **Mismo rango que Admin.** Administración integral de personal, fotos corporativas, auditoría global y tableros ejecutivos. |
| **4** | `admin` / `module_admin` | **Admin** | **Mismo rango que Coordinador General.** Gestión de usuarios, asignaciones y emisión de directrices. |
| **5** | `superadmin` | **Superadmin** | Rango técnico superior delegable. Puede crear nuevos `Superadmin`, emitir avisos globales, ejecutar purgas Lifecycle y gobernar módulos. |
| **6** | `fundador_dev` | **Fundador Dev** | **Exclusivo del Desarrollador Fundador.** Control absoluto e inmutable sobre arquitectura, ingesta, Feature Flags y auditoría. |

> [!IMPORTANT]
> **Gobierno Sigiloso (Stealth Governance):** Las cuentas `Fundador Dev` y `Superadmin` son completamente invisibles en listados, buscadores y tablas para cualquier rol de nivel 1 a 4. La detección de fundador usa coincidencia exacta de identidad (`isFounderEmail`) y validación en `user_roles`.

---

## 3. Arquitectura de Inicio de Sesión Único (Seamless SSO)

1. El usuario inicia sesión **una sola vez** en `/login` con su correo institucional `@impress.com`.
2. Supabase emite una cookie de sesión segura (`HTTPOnly`), validada en `/api/auth/me` y `middleware.ts`.
3. Al ingresar a **Asys, Briana u Oriana**, los módulos muestran un **escudo de carga Nexus (Zero-Flash Shield)** que sincroniza la identidad sin exponer credenciales ni puertas traseras.
4. Todas las acciones quedan firmadas con el identificador técnico **`@username`** (ej. `@brando`, `@j.perez`).

---

## 4. Modales Corporativos e In-System Docs

Cada módulo y el Lobby Maestro cuentan con:
- **📖 Manuales In-System (`ModuleManualButton` / `ModuleManualModal`):** Guía interactiva contextual dentro de Asys, Briana, Oriana, JADE y el Navbar principal.
- **📢 Emitir Aviso (`EmitirAvisoModal` + `GlobalNotificationOverlay`):** Comunicados transversales Globales, Por Rol o Individuales con soporte de alerta flotante inmediata sobre cualquier iframe.
- **🎛️ Módulos (`ModuleGovernanceModal`):** Consola en vivo de *Feature Flags* (`Público`, `Solo Pruebas Dev`, `Mantenimiento`) para `Fundador Dev` y `Superadmin`.
- **🛡️ Monitor ASYS Puente (`AsysAdminBridgeModal`):** Gestión operativa de asistencia y marcaje manual directo desde `/users`.

---

## 5. Trazabilidad, Scoring Dinámico y Ciclo de Vida (Cuota 500 MB)

- **Trazabilidad Completa:** Cada marcaje QR (con GPS y distancia), cada llamada en Briana (canal `sim` o `whatsapp`, duración real en segundos, origen de inicio y causa de corte), cada reporte en Oriana y cada cambio en `/users` queda auditado.
- **Scoring Ponderado por Agente:** Asistencia y Puntualidad (`Asys: 30%`) + Eficacia de Contacto (`Briana: 40%`) + Precisión en Reportes (`Oriana: 30%`). Recálculo restringido a roles `Supervisor` o superiores.
- **Purga Nocturna y Ciclo de Vida:** Mantenimiento automatizado (`/api/admin/lifecycle`, protegido por `CRON_SECRET` / `Superadmin`) para compactar logs > 90 días y mantener Supabase dentro del umbral de 500 MB.
