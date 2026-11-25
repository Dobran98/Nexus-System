# Documentación del Sistema: Sala Nacional Electoral

Este documento describe detalladamente el diseño, la arquitectura y el funcionamiento del **Sistema de Votación y Monitoreo de la Sala Nacional**, construido íntegramente sobre **Google Apps Script (GAS)** y **Google Sheets**.

---

## 1. Objetivo Principal del Sistema
El objetivo fundamental de la plataforma es **monitorear en tiempo real la cantidad de centros electorales y mesas activas** distribuidas por municipios dentro de cada estado. Adicionalmente, el sistema lleva un registro exhaustivo y segmentado de:
*   Cantidad de votantes regulares movilizados por municipio.
*   Cantidad de **condominios movilizados** a votar.
*   Cantidad de **votantes específicos provenientes de dichos condominios**.

Toda esta información permite a la Sala Nacional tomar decisiones basadas en datos de participación durante las 9 franjas horarias estipuladas para el proceso.

---

## 2. Arquitectura Tecnológica
El sistema funciona mediante una arquitectura **Serverless / Monolítica**, aprovechando el ecosistema de Google Workspace:
*   **Servidor/Backend:** Google Apps Script procesa la lógica de negocio, gestiona el acceso a datos y sirve el frontend HTML.
*   **Base de Datos:** Google Sheets actúa como el almacén de datos (Base de Datos Transaccional y de Configuración).
*   **Cliente/Frontend:** Aplicación de una sola página (SPA) inyectada dinámicamente con HTML, JavaScript y Tailwind CSS.

---

## 3. Estructura de la Base de Datos (Google Sheets)
La base de datos (hoja de cálculo principal) está particionada en las siguientes tablas (hojas):

| Nombre de Hoja | Descripción |
| :--- | :--- |
| **`DB_USUARIOS`** | Control de identidades. Almacena: Usuario, Rol, Estado Asignado, Password y Columnas para gestionar Tokens Temporales (hasta 2 sesiones activas simultáneas) y su hora de último acceso. |
| **`DB_DATA_DEF`** | Tabla principal de Votación. Contiene por cada Estado/Municipio: Centros Totales, Centros Activos, Mesas Totales, Mesas Activas, y las columnas para cada franja horaria (9AM, 11AM, 12M, 1PM, 2PM, 3PM, 4PM, 5PM, 6-8PM). *En estas franjas se totalizan los votos por municipio, los condominios movilizados y los votantes por condominio.* |
| **`BD_INCIDENCIAS`** | Registro de alertas. Contiene: Fecha/ID, Estado, Municipio, Bloque de Problema, Categoría, Descripción, Usuario reportador, Comuna y Estatus (Pendiente/Resuelto). |
| **`CONFIG`** | Matriz de Control Maestro. Administra si una franja horaria específica para un estado específico está bloqueada manualmente, además del aviso global de la plataforma. |
| **`AUDITORIA`** | Log inmutable. Todo guardado, log-in o modificación se registra con: Fecha, Usuario, Rol, Estado, Acción y Detalles. |
| **`DATA_MUNICIPAL`** | Monitoreo de Personal (Directorio). Relaciona responsables (Cédula, Nombre, Teléfono) con un municipio específico y sus propios reportes de centros y las franjas horarias. |
| **`METAS_ESTADALES`** | Configuración Estratégica. Define la cantidad de votos y/o movilizaciones que cada Estado debe alcanzar. El sistema usa esta meta cruzada con los reportes de `DB_DATA_DEF` para calcular en tiempo real los porcentajes de cumplimiento y efectividad. |

---

## 4. Descripción de los Módulos del Backend (.js/.gs)
El código Apps Script está dividido lógicamente para mantener el orden.

### 4.1. `Main.js` (Núcleo)
*   **`doGet()`:** La función punto de entrada. Despliega el archivo `Index.html` con permisos para ser incrustado y con un título definido.
*   **`obtenerEstadisticas()`:** El "cerebro" matemático. Barre `DB_DATA_DEF`, `BD_INCIDENCIAS`, y `METAS_ESTADALES` para compilar un único objeto JSON que contiene: totalizaciones nacionales, efectividades (Centros abiertos vs Totales, Votantes vs Meta, Condominios vs Meta), agrupaciones de incidencias y los datos para poblar los gráficos.
*   **`ejecutarInicializacionDB()`:** Script de migración y configuración que reconstruye y formatea `DB_DATA_DEF` si esta llega a corromperse, reinsertando las fórmulas de cálculo de porcentajes.
*   **Manejo de Avisos:** Funciones `enviarAvisoGlobal` y `obtenerAvisoGlobal` para mostrar un "Marquee" rojo en el frontend de forma sincrónica.

### 4.2. `Auth.js` (Autenticación y Seguridad)
*   **`iniciarSesion(user, pass)`:** Verifica la identidad y gestiona un sistema de slots (2 sesiones por usuario). Comprueba la diferencia de tiempo entre el momento actual y el último ping. Si hay cupo, inyecta un UUID (Token) y registra en auditoría.
*   **`validarSupervision()`:** Exige credenciales nivel "Analista" o "Admin" para acciones que requieran llave de autorización en el frontend.
*   **`logoutManual(token)`:** Invalida el token en la BD, forzando la salida del usuario.

### 4.3. `Admin.js` (Lógica de Carga y Reglas Electorales)
*   **Motor de Bloqueos (`calcularAutoBloqueos` / `calcularBloqueos`):** Determina qué campos están editables. Una franja (ej. 9AM) solo se abre tras pasar cierta hora del día o al ser liberada manualmente por el Admin en `CONFIG`.
*   **`actualizarTablaElectoral()`:** Función crítica. Utiliza un candado de concurrencia (`LockService.getScriptLock()`) para evitar colisiones si dos usuarios guardan al mismo tiempo. Valida que los "Centros Activos" jamás superen los "Totales". Preserva valores en las horas bloqueadas para evitar sobreescritura maliciosa.
*   **Control Maestro:** Funciones (`actualizarBloqueoDetallado`, `liberarEstadoCompleto`) llamadas por el panel Admin para bloquear celdas a voluntad.

### 4.4. `Incidencias.js` y `Municipal.js`
Manejan el alta y la consulta para sus respectivas hojas. Su característica clave es la **filtración basada en rol**. Si un "Operador Auxiliar" pide los datos, solo recibe los de su estado asignado. Si es un "Admin", recibe la matriz completa.

---

## 5. Funcionamiento del Frontend (`Scripts.html`, `Estilos.html`, `Index.html`)
El usuario solo interactúa con un archivo (una vez renderizado).

### Flujo de Vida de la Aplicación
1.  **Carga Inicial:** `doGet()` evalúa el HTML e incrusta el CSS y JS (`<?!= include('Estilos.html'); ?>`).
2.  **Verificación Local (LocalStorage):** Al iniciar (`window.onload`), el sistema busca si existe un `sala_token` en el caché del navegador. Si existe, hace una validación silenciosa en el backend.
3.  **Inicio de Sesión:** Si no hay token, se muestra la vista de Login. Al ingresar, el backend retorna un token y el perfil del usuario, que se almacena.
4.  **Ruteo por Rol (`mostrarDashboard()`):** Se revelan las pestañas según los permisos del usuario. (Ej. El "Operador" ve el *Monitor* pero no el *Admin*).
5.  **Heartbeat (Latido):** El frontend tiene un `setInterval` cada 60 segundos que envía el Token al backend. Esto mantiene viva la sesión y permite verificar si hay nuevos "Avisos Globales".
6.  **Inactividad:** Cada acción del ratón resetea una variable. Si pasan 15 minutos sin moverse, el frontend gatilla el cierre de sesión automático.

### Interfaz y Componentes (Tailwind)
*   Se emplea un diseño **Glassmorphism**, creando tarjetas semitransparentes sobre un fondo animado (`bg-mesh`).
*   Las tablas usan **Inputs de Datos Dinámicos**: Si un operador escribe una cantidad superior a la permitida, la celda se auto-corrige inmediatamente (JS) y muestra un `SweetAlert2` sin tocar el servidor.
*   El **Reloj Superior** calcula (vía JS del cliente) cuántos minutos faltan para el cierre de la franja actual. Cambia de color cuando faltan 10 minutos (estado Warning).

---

## 6. Resumen de Perfiles y Roles (RBAC)
El sistema funciona con Control de Acceso Basado en Roles (Role-Based Access Control):
*   **Admin / Analista:** Visión completa (Nacional). Pueden exportar data (PDF/Excel), forzar aperturas y cierres (Control Maestro), ver Auditoría y el Directorio Municipal. Visualizan el progreso de votos y movilización de condominios a nivel de todo el país.
*   **Operador (Nivel Estadal):** Usuario estándar. Solo ve su Estado. Su labor es actualizar "Centros Activos", "Mesas Activas", la cantidad de votantes por municipio, y la movilización/votación de condominios en los inputs horarios, pulsando "Guardar".
*   **Operador Auxiliar:** Visión Estadal, pero enfocado en la pantalla de *Monitoreo Municipal* (Actualiza responsables de talento humano a nivel de municipio y supervisa la carga).
*   **Operador 0800:** Destinado exclusivamente a la pantalla de *Centro de Incidencias*. Recibe llamadas y emite alertas (Tickets) de problemas en los centros electorales.

---

## 7. Procedimientos Clave de Operación

### ¿Cómo se guardan los votos y la movilización de condominios?
1.  El Operador ingresa a **Monitor Estadal**.
2.  Filtra su Municipio.
3.  El frontend renderiza un renglón por cada municipio. Las celdas de las 9 franjas se colorean de gris si están bloqueadas por el servidor, o blancas si están abiertas.
4.  Se tipean las cifras (centros, mesas, votantes, condominios movilizados, votantes por condominio) y se pulsa "Guardar".
5.  El Backend bloquea temporalmente el archivo (`LockService`), busca la fila (basado en el nombre del Estado y Municipio), inyecta los números de las celdas abiertas, y libera el archivo, registrando el suceso en la auditoría.

### ¿Cómo se mide el progreso contra las Metas?
El archivo `METAS_ESTADALES` actúa como el marco de referencia. A medida que los Operadores cargan data en cada franja horaria, la función `obtenerEstadisticas()` procesa la sumatoria de votantes y condominios a nivel nacional/estadal y la divide entre el objetivo definido en `METAS_ESTADALES`. Esto alimenta los gráficos en el Dashboard del Administrador, mostrando el porcentaje de alcance y efectividad en tiempo real.

### ¿Cómo funciona el reporte local PDF / EXCEL?
*   **PDF:** Se utiliza `html2pdf.js`. El script clona el elemento `#zonaImpresionPDF`, remueve temporalmente restricciones de scroll (para que las gráficas ocultas salgan en foto), renderiza el canvas, crea el PDF en orientación Landscape y lo descarga.
*   **Excel (.xlsx):** Se usa `xlsx.full.min.js`. El backend devuelve una **matriz bidimensional pura** (Array de Arrays). El frontend toma la matriz y la convierte a una Hoja Excel real (no un CSV), permitiendo formatear el ancho de las columnas (`ws['!cols']`) antes de su descarga.
