# 📘 MANUAL GENERAL DEL ECOSISTEMA NEXUS SYSTEM

**Versión del Documento:** 3.0.0 · **Actualización:** Noviembre 2026  
**Arquitectura:** Next.js 14 (App Router) · Supabase PostgreSQL 15 · Vercel Edge/Serverless · Google Apps Script Bridge  
**Clasificación:** Documentación Maestra Corporativa — Todos los Niveles

---

## 1. Visión General y Mapa del Ecosistema

**NEXUS SYSTEM** es la Intranet Corporativa Unificada diseñada para centralizar en una sola plataforma segura el control de asistencia, las operaciones telefónicas sin PBX, la analítica de gestión diaria, la planificación territorial, el triage de incidencias y la gobernanza de personal.

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                     NEXUS INTRANET — LOBBY MAESTRO (SSO)                     ║
║   Identidad Única (@username) · Estado DENTRO/FUERA · Notificaciones · Docs  ║
╠═══════════════╦═══════════════╦═══════════════╦═══════════════╦══════════════╣
║  🟢 ASYS      ║  🔵 BRIANA    ║  🟣 ORIANA    ║  🟡 RECLASIF. ║  💎 JADE     ║
║  Asistencia   ║  Telefonía    ║  Command      ║  Triage &     ║  Misiones &  ║
║  QR + GPS     ║  Celular 110X ║  Center       ║  Auditoría    ║  Rendición   ║
╠═══════════════╩═══════════════╩═══════════════╩═══════════════╩══════════════╣
║  🗳️ ELECCIONES (335 Municipios)  ·  📋 ENCUESTAS  ·  🎛️ FEATURE FLAGS (DEV)   ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

### Catálogo de Módulos Activos e Integrados

| Módulo | Ruta Interna | Propósito Principal | Tecnología Base |
| :--- | :--- | :--- | :--- |
| **ASYS** | `/asistencia` | Control de presencia QR + GPS, guardias, permisos y suplencias | SPA + Supabase + SSO |
| **BRIANA** | `/llamadas` | Discador guiado móvil sin PBX, campañas y tipificación FIT | SPA + Supabase + SSO |
| **ORIANA** | `/oriana` | Reporte diario de gestión, áreas de trabajo y auditoría | SPA + Supabase + SSO |
| **RECLASIFICACIÓN** | `/reclasificacion` | Triage ágil de incidencias sin bloqueo de Excel | Next.js + API Supabase |
| **JADE** | `/planificacion` | Planificación territorial, misiones, Classroom y rendición | GAS Clasp + Excel BD |
| **ELECCIONES** | `/elecciones` | Sala Nacional Electoral por franjas horarias (9AM – 8PM) | Next.js + API Electoral |
| **ENCUESTAS** | Modal `/#encuestas` | Sondeos de clima laboral y evaluación de puesto | Modal React + `/api/encuestas` |
| **GOBERNANZA** | `/users` & Modal | CRUD de personal `@impress.com`, RBAC y Feature Flags | Next.js + RPC Supabase |

---

## 2. Matriz Jerárquica de Roles (RBAC — 6 Niveles)

El sistema gobierna el acceso mediante una jerarquía estricta ordenada **del nivel más bajo al más alto**:

| Nivel | Rol Técnico | Nombre en Plataforma | Rango & Privilegios |
| :---: | :--- | :--- | :--- |
| **1** | `analista_operador` | **Analista - Operador** | Rol operativo base unificado. Acceso a Asys (marcaje QR), Briana (discador), Oriana (reporte diario), Encuestas y Manuales. |
| **2** | `supervisor` | **Supervisor** | Monitoreo de sala, seguimiento de sesiones abiertas, ausencias, tiempos FIT y revisión de equipo. |
| **3** | `coordinador` | **Coordinador** | Creación de encuestas operativas, gestión de áreas asignadas, permisos de sala y analítica de encuestas. |
| **4** | `coordinador_general` | **Coordinador General** | **Mismo rango que Admin.** Administración integral de personal, auditoría global y tableros ejecutivos. |
| **4** | `admin` | **Admin** | **Mismo rango que Coordinador General.** Gestión de usuarios, asignación de extensiones y emisión de directrices. |
| **5** | `superadmin` | **Superadmin** | Rango técnico superior delegable. Puede crear nuevos `Superadmin`, emitir avisos globales y gobernar módulos. |
| **6** | `fundador_dev` | **Fundador Dev** | **Exclusivo del Desarrollador Fundador.** Control absoluto e inmutable sobre arquitectura, ingesta, Feature Flags y auditoría. |

> [!IMPORTANT]
> **Gobierno Sigiloso (Stealth Governance):** Las cuentas `Fundador Dev` y `Superadmin` son completamente invisibles en listados, buscadores y tablas para cualquier rol de nivel 1 a 4. Nadie puede editar, degradar ni crear un `Fundador Dev` desde la interfaz administrativa.

---

## 3. Arquitectura de Inicio de Sesión Único (Seamless SSO)

1. El usuario inicia sesión **una sola vez** en `/login` con su correo institucional `@impress.com`.
2. Supabase emite una cookie de sesión segura (`HTTPOnly`), validada en `/api/auth/me`.
3. Al ingresar a **Asys, Briana u Oriana**, los módulos muestran un **escudo de carga Nexus (Zero-Flash Shield)** que sincroniza la identidad sin dejar ver jamás los formularios antiguos de login.
4. Todas las acciones quedan firmadas con el identificador técnico **`@username`** (ej. `@brando`, `@j.perez`).

---

## 4. Gobernanza de Módulos y Entornos de Prueba (Staging vs Producción)

El sistema cuenta con **tres mecanismos de seguridad** para probar actualizaciones antes de liberarlas a todo el personal:

### A. Consola de Feature Flags en Caliente (Botón `Módulos`)
Exclusiva para `Fundador Dev` y `Superadmin`. Permite alternar cada módulo entre:
- 🟢 **Público:** Visible y operativo para todos los roles autorizados.
- 🟡 **Solo Pruebas Dev:** Solo `Fundador Dev` y `Superadmin` pueden acceder; el personal general ve el estado bloqueado.
- 🔴 **Mantenimiento:** Cierra temporalmente el módulo mostrando un mensaje informativo.

### B. Vercel Preview Deployments (Ramas Git)
Para cambios estructurales profundos:
1. Crear rama dedicada (`git checkout -b feature/nueva-mejora`).
2. Subir cambios (`git push origin feature/nueva-mejora`).
3. Probar en la URL privada generada por Vercel sin afectar la rama `main` de producción.
4. Al validar, fusionar con `main`.

### C. Comunicación de Versiones
Al liberar un cambio en `main`, utilizar el botón **Emitir Aviso** del Navbar para enviar una alerta flotante informando las novedades al personal.

---

## 5. Trazabilidad, Scoring Dinámico y Ciclo de Vida (Cuota 500 MB)

- **Trazabilidad Completa:** Cada marcaje QR (con coordenadas GPS y distancia), cada llamada en Briana (con *First Interaction Time* — FIT), cada reporte en Oriana y cada cambio en `/users` queda auditado con fecha, hora, `@username` y rol.
- **Scoring Ponderado por Agente:** Asistencia y Puntualidad (`Asys: 30%`) + Eficacia de Contacto (`Briana: 40%`) + Precisión en Reportes (`Oriana: 30%`).
- **Purga Nocturna y Ciclo de Vida:** Mantenimiento automatizado (`/api/admin/lifecycle`) para compactar logs > 90 días y limpiar sesiones huérfanas, manteniendo Supabase cómodamente dentro del umbral de 500 MB.
