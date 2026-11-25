# Manual de Usuario - Sistema Sala Nacional Electoral

Bienvenido al sistema de monitoreo y carga de datos electorales. Este manual detalla las instrucciones de uso para cada uno de los roles existentes en la plataforma.

## Aspectos Generales (Para todos los usuarios)

*   **Acceso al Sistema:** Ingresar mediante el enlace proporcionado. Se requiere Usuario y Contraseña. El sistema permite un máximo de 2 sesiones activas simultáneas por usuario.
*   **Cierre de Sesión:** Por seguridad, la sesión se cerrará automáticamente tras 15 minutos de inactividad (sin mover el ratón). Para salir manualmente de forma segura, utilice el botón de "Cerrar Sesión".
*   **Avisos Globales:** Preste atención a la cinta de notificaciones superior (marquesina roja), donde la Sala Nacional emitirá comunicados y directrices importantes en tiempo real.
*   **Reloj del Sistema:** En la parte superior de la pantalla, un reloj le indicará cuántos minutos faltan para el cierre de la franja horaria actual. Cuando falten 10 minutos, el reloj cambiará de color a estado de alerta (Warning).

---

## 1. Manual del Operador (Nivel Estadal)

**Perfil:** Usuario estándar encargado de registrar la participación y el estado de los centros de un Estado específico.
**Funciones Principales:** Actualizar la cantidad de centros activos, mesas activas y la carga de votos/movilización en las franjas horarias correspondientes (9 AM a 6-8 PM).

**Instrucciones de Uso:**
1.  **Ingreso y Navegación:** Al iniciar sesión, el sistema lo ubicará en la pantalla de **Monitor Estadal**.
2.  **Filtrado:** Seleccione su Municipio en el buscador para visualizar únicamente los renglones que le corresponden actualizar.
3.  **Carga de Datos:**
    *   Verá un renglón por cada municipio. Las celdas de las horas (franjas) se muestran con fondo **blanco** si están abiertas para escritura, o fondo **gris** si están bloqueadas por el servidor (debido a la hora o por control maestro).
    *   Ingrese las cifras de: *Centros Activos*, *Mesas Activas* y la cantidad de votantes o condominios movilizados en la franja actual.
    *   **Auto-corrección:** Si por error intenta ingresar un número de "Centros Activos" superior al total de centros asignados a ese municipio, el sistema le emitirá una alerta visual y corregirá automáticamente la celda para evitar inconsistencias.
4.  **Guardado Seguro:** Tras ingresar la data, presione el botón **"Guardar"**. El sistema bloqueará temporalmente el registro para procesarlo de forma segura y dejará rastro de su actualización.

---

## 2. Manual del Operador Auxiliar

**Perfil:** Usuario de nivel estadal enfocado en el área de talento humano y supervisión local.
**Funciones Principales:** Actualizar el directorio de responsables y hacer seguimiento a la carga de datos municipal.

**Instrucciones de Uso:**
1.  **Ingreso:** Diríjase a la pestaña de **Monitoreo Municipal**.
2.  **Gestión del Directorio:**
    *   En esta pantalla visualizará la lista de municipios correspondientes a su Estado.
    *   Su tarea es mantener actualizados los datos del personal responsable a nivel municipal (Cédula, Nombre y Teléfono).
3.  **Supervisión:** Desde esta misma vista, usted puede monitorear el reporte de centros y el llenado de las 9 franjas horarias de su jurisdicción, funcionando como un supervisor del Operador estándar.

---

## 3. Manual del Operador 0800

**Perfil:** Usuario dedicado a la recepción de reportes telefónicos y registro de novedades.
**Funciones Principales:** Recibir llamadas y emitir alertas (Tickets) en el sistema de incidencias.

**Instrucciones de Uso:**
1.  **Ingreso:** Al autenticarse, su usuario lo llevará directamente y de forma exclusiva a la pantalla de **Centro de Incidencias**.
2.  **Registro de Nueva Incidencia:**
    *   Al recibir una llamada, complete el formulario de reporte seleccionando: Estado, Municipio y la Comuna/Centro afectado.
    *   Clasifique el problema seleccionando el **Bloque de Problema** y la **Categoría**.
    *   Redacte una **Descripción** clara y concisa de la situación.
    *   Presione "Guardar" para generar el ticket.
3.  **Gestión de Estatus:**
    *   Las incidencias creadas se guardan con estatus **Pendiente**.
    *   A través de su panel, puede visualizar la lista de problemas reportados y actualizar su estado a **Resuelto** una vez que se confirme la solución en el centro electoral.

---

## 4. Manual del Administrador / Analista

**Perfil:** Nivel máximo de control con visión completa a nivel nacional (Sala Nacional).
**Funciones Principales:** Monitoreo global de estadísticas, control maestro de bloqueos, revisión de auditorías y generación de reportes oficiales.

**Instrucciones de Uso:**
1.  **Monitor Nacional (Dashboard):**
    *   Acceda a los gráficos en tiempo real, totalizaciones nacionales y al cálculo automático del % de efectividad y cumplimiento basado en las "Metas Estadales".
2.  **Control Maestro de Franjas:**
    *   Diríjase al módulo **CONFIG**. Desde aquí tiene la potestad de forzar la apertura o cierre de las celdas de los operadores.
    *   Puede liberar una franja horaria específica para un estado en particular en caso de que requieran editar fuera del tiempo estipulado, o bloquear un estado completo.
3.  **Auditoría y Transparencia:**
    *   En la pestaña **Auditoría**, puede visualizar un registro inmutable de toda la actividad del sistema (inicios de sesión, qué usuario modificó qué dato, a qué hora exacta y en qué estado).
4.  **Generación de Reportes:**
    *   **Exportar a PDF:** Presione el botón de PDF para descargar una visual ("foto") completa del Dashboard, incluyendo todos los gráficos renderizados.
    *   **Exportar a Excel (.xlsx):** Utilice este botón para descargar la matriz de datos completa y pre-formateada en columnas precisas, ideal para presentar informes, aplicar tablas dinámicas o cruzar datos en reuniones de sala.
    *   *Nota:* A diferencia de los operadores, usted tiene acceso irrestricto al directorio de la data municipal a nivel nacional.
