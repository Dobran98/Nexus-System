# AGENTS.md

Guía para trabajar en este repositorio. Solo contiene lo que no es obvio.

## Qué es esto

App web serverless en **Google Apps Script (GAS) + Google Sheets**. `doGet()` sirve una SPA (HTML/JS/Tailwind). Runtime **V8**, zona horaria **America/Caracas**. Desplegada como `USER_DEPLOYING` con acceso `ANYONE_ANONYMOUS` (ver `appsscript.json`). Google Sheets es la base de datos.

## Trampas críticas (léelas antes de tocar código)

- Los `.js` son archivos **servidor `.gs` de Apps Script**, NO Node ni navegador (ver `scriptExtensions` en `.clasp.json`). Sin `require`, sin npm, sin `import`. Solo globales GAS: `SpreadsheetApp`, `HtmlService`, `LockService`, etc.
- `Electoral.js` es un **stub vacío intencional**. Su lógica (`obtenerDataElectoral`, `actualizarTablaElectoral`) vive en `Admin.js`. No pongas nada ahí.
- `build.js.txt` es un ofuscador que espera carpetas `src/`/`dist/` que **no existen aquí**. NO es parte del flujo; ignóralo para cambios normales.
- No hay `package.json`, tests, lint ni CI. La verificación es manual: `clasp push` y probar la web app desplegada.

## Despliegue / comandos

- Desplegar: `clasp push` desde la **raíz del repo** (layout plano, sin build). Opcional `clasp deploy` para nueva versión.
- Los `.html` son plantillas GAS. El servidor las inyecta con `include('Estilos.html')` / `include('Scripts.html')` dentro de `Index.html`.
- El frontend llama al backend con `google.script.run`.

## Mapa de módulos (backend)

- `Main.js`: entrypoint `doGet()`, `include()`, constantes de nombres de hojas, `HORAS_KEYS`/`HORAS_DISPLAY` (9 franjas), analítica `obtenerEstadisticas()`, init/migración de BD.
- `Auth.js`: sesiones y tokens UUID (máx **2 sesiones** concurrentes/usuario, token expira a **10 min** de inactividad de ping, cierre por inactividad a **15 min**), `validarSupervision()`.
- `Admin.js`: escrituras de data electoral con `LockService.getScriptLock()`, motor de bloqueo de franjas horarias y Control Maestro.
- `Incidencias.js` / `Municipal.js`: lecturas/escrituras filtradas por rol.
- Frontend: `Index.html` (shell) + `Scripts.html` (JS) + `Estilos.html` (CSS/Tailwind CDN) + `ModalSupervision.html`.

## Datos y convenciones

- Nombres de hojas son constantes fijas en `Main.js`: `DB_USUARIOS`, `DB_DATA_DEF`, `BD_INCIDENCIAS`, `CONFIG`, `AUDITORIA`, `DATA_MUNICIPAL`, `METAS_ESTADALES`.
- Claves de las 9 franjas horarias: `h9, h11, h12, h13, h14, h15, h16, h17, h20`.
- **RBAC** (Admin/Analista, Operador, Operador Auxiliar, Operador 0800): la data se filtra **por rol en el servidor**. Nunca confíes en el cliente para el alcance geográfico.
- Toda mutación debe registrarse en `AUDITORIA`.
- Escrituras de data electoral: tomar el script lock y **nunca** permitir que "Centros Activos" supere a "Totales".
- Código, comentarios y UI están en **español**. Mantén esa convención.

## Docs de referencia (detalle completo)

- `Documentacion Sistema elecciones.md` — arquitectura y flujo completo.
- `Roles_Sistema_Elecciones.md` — RBAC y matriz de permisos.
- `Reporte_Librerias_Latencia.md` — dependencias CDN y optimización.
