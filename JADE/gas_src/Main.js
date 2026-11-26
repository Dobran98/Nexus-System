function doGet(e) {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('JADE - Sistema de Control y Planificación')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) { return HtmlService.createHtmlOutputFromFile(filename).getContent(); }

// ENRUTADORES DE VISTAS (AQUÍ FALTABAN VALIDACIONES Y VISOR)
function cargarVistaLogin() { return HtmlService.createHtmlOutputFromFile('Login').getContent(); }
function cargarVistaDashboard() { return HtmlService.createHtmlOutputFromFile('Dashboard').getContent(); }
function cargarVistaHome() { return HtmlService.createHtmlOutputFromFile('Home').getContent(); }
function cargarVistaFormulario() { return HtmlService.createHtmlOutputFromFile('Formulario').getContent(); }
function cargarVistaFormularioExtra() { return HtmlService.createHtmlOutputFromFile('FormularioExtra').getContent(); }
function cargarVistaMisActividades() { return HtmlService.createHtmlOutputFromFile('MisActividades').getContent(); }
function cargarVistaClassroom() { return HtmlService.createHtmlOutputFromFile('Classroom').getContent(); }
function cargarVistaValidaciones() { return HtmlService.createHtmlOutputFromFile('Validaciones').getContent(); }
function cargarVistaRendicion() { return HtmlService.createHtmlOutputFromFile('Rendicion').getContent(); }
function cargarVistaMonitor() { return HtmlService.createHtmlOutputFromFile('Monitor').getContent(); }
function cargarVistaUsuarios() { return HtmlService.createHtmlOutputFromFile('Usuarios').getContent(); }
function cargarVistaIndicadores() { return HtmlService.createHtmlOutputFromFile('Indicadores').getContent(); }
function cargarVistaMap() { return HtmlService.createHtmlOutputFromFile('mapa').getContent(); }
function cargarVistaVisor() { return HtmlService.createTemplateFromFile('Visor').evaluate().getContent(); }
function cargarVistaMisiones() { return HtmlService.createHtmlOutputFromFile('Misiones').getContent(); }