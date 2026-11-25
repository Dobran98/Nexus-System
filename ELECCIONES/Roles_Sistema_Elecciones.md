# Roles y Accesos: Sistema de Votación y Monitoreo de la Sala Nacional

Este documento describe en detalle el esquema de Control de Acceso Basado en Roles (RBAC), el funcionamiento de la concurrencia de sesiones y los alcances permitidos para cada tipo de usuario en el Sistema Electoral.

## 1. Funcionamiento General del Sistema de Roles y Sesiones

El sistema valida la identidad de los usuarios y administra sus permisos de la siguiente manera:
- **Autenticación y Sesiones Concurrentes**: Cada usuario puede tener hasta un máximo de **dos (2) sesiones activas simultáneas**. Si se intenta un tercer inicio de sesión, el sistema lo bloqueará.
- **Tokens de Sesión**: Al iniciar sesión, el backend genera un UUID único que se almacena y se envía periódicamente ("heartbeat" cada 60 segundos) para validar que el usuario sigue activo y con permisos válidos.
- **Inactividad**: Tras 15 minutos sin interacción con el sistema (sin movimiento de ratón), la sesión se cierra automáticamente por seguridad.
- **Auditoría Estricta**: Absolutamente todas las acciones (inicios de sesión exitosos o fallidos, salidas manuales, modificaciones de votos, aperturas forzadas y autorizaciones de supervisores) son registradas en una bitácora inmutable junto con el nombre de usuario, su rol asignado y la marca de tiempo.

---

## 2. Descripción y Alcance de los Roles

El sistema cuenta con 4 niveles o perfiles principales de acceso, diseñados para compartimentar la información, enfocar el flujo de trabajo y proteger la integridad de los datos nacionales.

### 2.1. Administrador / Analista
Es el rol de más alto nivel, con privilegios globales y acceso a herramientas de control del sistema y visualización estratégica.
- **Visión Geográfica**: Completa (Nivel Nacional). Tienen acceso de lectura y escritura a la información de todos los estados y municipios.
- **Gestión de Datos y Votación**: Pueden visualizar la consolidación de datos, estadísticas y acceder a la matriz completa nacional.
- **Control Maestro (Bloqueos)**: Tienen la capacidad exclusiva de intervenir el "Control Maestro" para forzar la apertura o el cierre de franjas horarias específicas para cualquier estado, saltándose las reglas y horarios automáticos del sistema.
- **Autorización de Cambios**: Los operadores regulares se encuentran con restricciones al querer hacer cambios bloqueados; un Administrador/Analista puede ingresar sus credenciales en el "Modal de Supervisión" del frontend del operador para validar y autorizar modificaciones protegidas.
- **Exportación de Datos**: Son los únicos habilitados para generar y descargar informes completos en formatos PDF y hojas de cálculo (Excel).
- **Acceso a Módulos Exclusivos**: Tienen acceso a la base de Auditoría completa y al Directorio Municipal a nivel nacional.

### 2.2. Operador
Es el usuario estándar de captura de información, encargado de la carga directa de datos asociados a los centros de votación.
- **Visión Geográfica**: Restringida (Nivel Estadal). Solo pueden ver e interactuar con el estado (y sus respectivos municipios) que se les ha asignado previamente en la base de datos.
- **Gestión de Datos y Votación**: Su función principal es ingresar al "Monitor Estadal". Allí deben actualizar el número de "Centros Activos" y cargar la cantidad de votos recabados para cada una de las 9 franjas horarias establecidas (desde las 9:00 AM hasta el horario extendido de las 6-8:00 PM).
- **Limitaciones**: No ven las totalizaciones nacionales y el sistema restringe su capacidad para alterar datos en horas que ya han sido bloqueadas. Para cualquier cambio especial, requieren la intervención en pantalla de un usuario supervisor (Analista/Admin).

### 2.3. Operador Auxiliar
Es un usuario de soporte operativo local, enfocado en el mantenimiento de la estructura de personal de la región.
- **Visión Geográfica**: Restringida (Nivel Estadal).
- **Gestión de Personal**: Su trabajo se centra en la pantalla de "Monitoreo Municipal". No están encargados de cargar los votos en la matriz.
- **Directorio Local**: Tienen la responsabilidad exclusiva de registrar y actualizar la información de los responsables asignados a nivel municipal (Cédula de identidad, Nombres completos y Teléfonos de contacto) en su respectivo estado. 

### 2.4. Operador 0800
Rol especializado en la recepción, registro y seguimiento de anomalías operativas.
- **Visión Geográfica**: Transversal pero orientada a los reportes (pueden registrar tickets para cualquier estado del país).
- **Gestión de Incidencias**: Su área de trabajo es exclusiva para el "Centro de Incidencias". Su labor consiste en recibir llamadas, registrar alertas, clasificar el problema por categoría, redactar una descripción, definir la urgencia y asignar el estatus.
- **Limitaciones**: No tienen acceso a los tableros de votación, ni al ingreso de transmisión de datos, ni a los totales nacionales electorales.

---

## 3. Matriz de Permisos por Rol

| Función / Módulo | Admin / Analista | Operador | Operador Auxiliar | Operador 0800 |
| :--- | :---: | :---: | :---: | :---: |
| **Visualizar Tablero Nacional** | ✅ | ❌ | ❌ | ❌ |
| **Cargar Data Electoral (Por Estado)** | ✅ | ✅ | ❌ | ❌ |
| **Actualizar Directorio de Personal** | ✅ | ❌ | ✅ | ❌ |
| **Apertura de Tickets / Incidencias** | ✅ | ❌ | ❌ | ✅ |
| **Exportar Reportes (PDF / Excel)** | ✅ | ❌ | ❌ | ❌ |
| **Activar Control Maestro (Horarios)**| ✅ | ❌ | ❌ | ❌ |
| **Validar Excepciones (Supervisión)** | ✅ | ❌ | ❌ | ❌ |
