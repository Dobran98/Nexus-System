# Reporte de Librerías Externas y Optimización de Latencia

Al analizar el código fuente de tu interfaz (`Index.html`, `Scripts.html`, `Estilos.html`), he identificado el uso de **7 dependencias externas** (5 de JavaScript y 2 de Google Fonts) que se están importando vía red (CDNs) al momento de cargar la página.

A continuación, presento el desglose de cada una y las estrategias para sustituirlas o mitigarlas con el fin de **reducir significativamente los tiempos de latencia**.

---

## 1. Librerías de JavaScript (Cargadas vía `<script>`)

| Librería | Función en el Sistema | Impacto en Latencia | ¿Sustituible por código interno? |
| :--- | :--- | :--- | :--- |
| **Tailwind CSS (CDN)**<br>`cdn.tailwindcss.com` | Estilos y maquetación de la interfaz. | 🔴 **CRÍTICO**. Ejecuta JavaScript en el navegador del cliente para compilar las clases "on-the-fly". Esto bloquea el renderizado y causa parpadeos (FOUC). | **SÍ (Altamente Recomendado)** |
| **SweetAlert2**<br>`sweetalert2@11` | Modales y alertas bonitas en pantalla. | 🟡 **Medio**. Descarga un archivo extra, aunque es ligero. | **SÍ** |
| **Chart.js**<br>`chart.js` | Gráficas estadísticas en el Dashboard. | 🟡 **Medio**. Es pesada, pero necesaria para la visualización. | **Parcialmente** |
| **html2pdf.js**<br>`html2pdf.bundle...` | Exportación a PDF de los reportes. | 🟢 **Bajo** (en inicio). Es muy pesada (trae html2canvas y jsPDF), pero bloquea si se carga al inicio. | **Parcialmente** |
| **SheetJS (XLSX)**<br>`xlsx.full.min.js` | Exportación de matrices a Excel. | 🟢 **Bajo** (en inicio). | **Parcialmente** |

---

## 2. Tipografías e Iconos (Cargadas vía `<link>`)

| Recurso | Función | Impacto | ¿Sustituible por código interno? |
| :--- | :--- | :--- | :--- |
| **Google Fonts**<br>(Inter, JetBrains) | Fuentes personalizadas. | 🟡 **Medio**. Requiere resolución DNS externa y bloquea el renderizado de texto. | **SÍ** |
| **Material Symbols** | Iconografía del sistema. | 🟡 **Medio**. Carga toda una fuente web inmensa para usar solo algunos iconos. | **SÍ** |

---

## 3. Plan de Acción: ¿Qué sustituir y cómo?

Para lograr una carga ultrarrápida (baja latencia) en el sistema alojado en Google Apps Script, podemos aplicar las siguientes sustituciones de código:

### Sustitución 1: Eliminar el compilador de Tailwind del navegador (PRIORIDAD 1)
En lugar de mandar el script de Tailwind para que el navegador del usuario descifre y compile los estilos, **debemos precompilar Tailwind**.
- **Acción**: Ejecutar Tailwind localmente con Node.js en tu entorno de desarrollo para generar un archivo CSS estático puro que contenga solo las clases que estás usando.
- **Sustitución interna**: Pegar ese código CSS minificado directamente dentro de una etiqueta `<style>` en tu archivo `Estilos.html`.
- **Beneficio**: Elimina por completo el tiempo de ejecución en cliente, reduciendo drásticamente el TTI (Time to Interactive).

### Sustitución 2: Reemplazar SweetAlert2 con modales nativos de HTML/Tailwind
- **Acción**: Dado que ya tienes Tailwind (que sirve para diseñar), no necesitas cargar una librería extra solo para alertas.
- **Sustitución interna**: Crear un elemento `<dialog>` o un div `<div id="modal-alerta">` usando Tailwind para que luzca igual a SweetAlert. El control se haría con 10 líneas de JavaScript puro (Vanilla JS) agregadas a `Scripts.html`.
- **Beneficio**: Te ahorras una petición HTTP y la carga de la librería.

### Sustitución 3: Iconos embebidos (SVG) en lugar de Google Material Symbols
- **Acción**: En vez de descargar toda la tipografía de "Material Symbols", identifica los 5 o 10 iconos exactos que utilizas (ej: "descargar", "cerrar", "usuario", "ajustes").
- **Sustitución interna**: Descarga el código `SVG` de esos iconos y pégalos directamente en el código de `Index.html` (o `Scripts.html`).
- **Beneficio**: Ahorras una resolución DNS a Google Fonts y la descarga de un archivo `.woff2`.

### Sustitución 4: Lazy Loading para Librerías Pesadas (PDF y Excel)
- **Acción**: Escribir de cero en JS puro un exportador a PDF o Excel es muy complejo y propenso a errores. Sin embargo, **nadie necesita generar un PDF en el primer segundo que carga la página**.
- **Sustitución interna**: Quitar los `<script src="...">` del `<head>`. En su lugar, usar código nativo para inyectar estos scripts dinámicamente **sólo cuando el usuario hace clic** en "Descargar PDF" o "Descargar Excel".
  ```javascript
  function cargarLibreriaYDescargar(url, callback) {
      let script = document.createElement('script');
      script.src = url;
      script.onload = callback;
      document.body.appendChild(script);
  }
  ```

### Sustitución 5: Fuentes del Sistema
- **Acción**: Quitar las llamadas a Google Fonts.
- **Sustitución interna**: Cambiar la familia tipográfica en tu CSS (o Tailwind config) por la pila de sistema predeterminada: `font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;`.
- **Beneficio**: El navegador no descarga ninguna fuente; usa la nativa del sistema operativo (que suele verse excelente y cargar en 0 milisegundos).

---

**Conclusión:**
Si incorporas estas 5 medidas en el HTML, **el sistema pasará de requerir 7 peticiones a servidores externos a requerir solo 1 (Chart.js)**, logrando que el portal web cargue casi instantáneamente, eliminando "parpadeos" blancos al iniciar sesión.
