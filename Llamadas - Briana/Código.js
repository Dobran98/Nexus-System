// --- CARPETA DESTINO PARA LOS SHEETS DE REPORTES ---
// URL: https://drive.google.com/drive/u/0/folders/1mbNRTI8qfbuakILy_EDu4vSWwlPHrqK8
const CARPETA_REPORTES_ID = "1DyAHKSg6t16wkkNi4eyxbfnp1ZPmKwyZ";
// --- CARPETA RAÍZ PARA DATOS DE CAMPAÑAS (CSVs) ---
const CARPETA_DATA_RAIZ_ID = "1mbNRTI8qfbuakILy_EDu4vSWwlPHrqK8";

// --- ESCALA DE PRIORIDAD PARA GESTIONES FALLIDAS (EDITABLE) ---
// La posición más alta (índice 0) tiene mayor prioridad sobre las de abajo.
const ESCALA_PRIORIDAD_FALLIDAS = [
  "No es el responsable",
  "Renuncio a la responsabilidad",
  "Numero equivocado",
  "Numero no asignado",
  "Numero suspendido",
  "Otros"
];

// --- OBTENER NÚMEROS EXITOSOS EN TIEMPO REAL ---
function obtenerTelefonosExitosos(nombreCampana) {
  let dataGestiones = obtenerGestionesCampana(nombreCampana, 0);
  let exitosos = [];
  if (dataGestiones.length > 1) {
    const cabeceras = dataGestiones[0];
    let idxResultado = cabeceras.indexOf("Resultado");

    // Buscar la columna Teléfono, Celular o ID
    let idxTel = cabeceras.findIndex(h => {
      let ht = h.toString().toLowerCase().trim();
      return ht.includes("tel") || ht.includes("cel") || ht === "id";
    });

    if (idxResultado !== -1 && idxTel !== -1) {
      for (let i = 1; i < dataGestiones.length; i++) {
        let status = dataGestiones[i][idxResultado] ? dataGestiones[i][idxResultado].toString().trim().toLowerCase() : "";
        let isExito = status === "exitosa" || status.includes("answered") || status.includes("contestó") || status.includes("efectiv");
        if (isExito) {
          exitosos.push(dataGestiones[i][idxTel].toString().trim());
        }
      }
    }
  }
  return exitosos;
}

function doGet(e) {
  const template = HtmlService.createTemplateFromFile('Index');
  // Se captura el parámetro para la vista previa
  template.previewFormName = (e.parameter && e.parameter.preview) ? e.parameter.preview : "";

  return template.evaluate()
    .setTitle('Sistema Briana')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// --- FUNCIÓN PARA OBTENER URL DE LA APP (VISTA PREVIA) ---
function getAppUrl() {
  return ScriptApp.getService().getUrl();
}

function obtenerFormularioPorNombre(nombre) {
  const forms = obtenerFormularios();
  const form = forms.find(f => f.nombre === nombre);
  if (!form) return [];
  return JSON.parse(form.campos);
}

// --- GESTIÓN DE BASES DE DATOS (CSV) DE OPERADORES ---
function obtenerOCrearCarpetaCampana(nombreCampana) {
  let carpetaRaiz;
  const nombreCarpetaRaiz = "Briana_Campañas_Data";

  try {
    // Intento obtener la carpeta por ID (Más seguro y rápido)
    if (CARPETA_DATA_RAIZ_ID && CARPETA_DATA_RAIZ_ID !== "PONER_AQUI_ID_DE_CARPETA_DATA_RAIZ") {
      carpetaRaiz = DriveApp.getFolderById(CARPETA_DATA_RAIZ_ID);
    } else {
      throw new Error("ID no configurado");
    }
  } catch (e) {
    // Contingencia: Si el ID falla o no está puesto, buscamos por nombre
    const iteradorRaiz = DriveApp.getFoldersByName(nombreCarpetaRaiz);
    if (iteradorRaiz.hasNext()) {
      carpetaRaiz = iteradorRaiz.next();
    } else {
      carpetaRaiz = DriveApp.createFolder(nombreCarpetaRaiz);
    }
  }

  let carpetaCampana;
  const iteradorCampana = carpetaRaiz.getFoldersByName(nombreCampana);
  if (iteradorCampana.hasNext()) {
    carpetaCampana = iteradorCampana.next();
  } else {
    carpetaCampana = carpetaRaiz.createFolder(nombreCampana);
  }
  return carpetaCampana;
}

function guardarArchivoEnDrive(nombreCampana, nombreArchivo, matrizDatos) {
  const carpeta = obtenerOCrearCarpetaCampana(nombreCampana);

  const contenidoCsv = matrizDatos.map(fila =>
    fila.map(celda => {
      let valorSeguro = (celda == null) ? "" : celda.toString();
      return `"${valorSeguro.replace(/"/g, '""')}"`;
    }).join(",")
  ).join("\n");

  const archivosViejos = carpeta.getFilesByName(nombreArchivo);
  while (archivosViejos.hasNext()) archivosViejos.next().setTrashed(true);

  carpeta.createFile(nombreArchivo, contenidoCsv, MimeType.CSV);
}

// --- CREDENCIALES Y USUARIOS ---
function validarCredenciales(usuario, password, extension) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hoja = ss.getSheetByName("Usuarios");
  if (!hoja) return { success: false, mensaje: "Error: Hoja 'Usuarios' no encontrada" };
  const datos = hoja.getDataRange().getValues();
  const uIn = usuario.toString().trim().toLowerCase();
  const pIn = password.toString().trim();
  for (let i = 1; i < datos.length; i++) {
    if (datos[i][0].toString().toLowerCase() === uIn && datos[i][1].toString() === pIn) {
      const rol = datos[i][2].toString().toLowerCase().trim();
      const usuarioReal = datos[i][0].toString();
      const turno = datos[i][3] || ""; // Capturar turno (columna D de Usuarios)

      // Registro de extensión con turno
      registrarExtension(usuarioReal, extension, turno);
      const permisoReporte = (datos[i][4] === true || datos[i][4] === "S");

      return { success: true, rol: rol, usuario: usuarioReal, permisoReporte: permisoReporte };
    }
  }
  return { success: false, mensaje: "Usuario o clave incorrectos" };
}

function registrarExtension(usuario, extension, turno) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let hoja = ss.getSheetByName("Extensiones");
    if (!hoja) {
      hoja = ss.insertSheet("Extensiones");
      hoja.appendRow(["Usuario", "Extensión", "Fecha", "Turno"]);
      hoja.getRange(1, 1, 1, 4).setFontWeight("bold").setBackground("#f3f4f6");
    }

    const datos = hoja.getDataRange().getValues();
    const fechaActual = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
    const uIn = usuario.toString().toLowerCase().trim();
    let filaEncontrada = -1;

    // Buscar si el usuario ya tiene un registro previo
    for (let i = 1; i < datos.length; i++) {
      if (datos[i][0].toString().toLowerCase().trim() === uIn) {
        filaEncontrada = i + 1;
        break;
      }
    }

    if (filaEncontrada !== -1) {
      // Si existe, actualizamos Extensión, Fecha y Turno (Columnas B, C, D)
      hoja.getRange(filaEncontrada, 2, 1, 3).setValues([[extension, fechaActual, turno]]);
    } else {
      // Si no existe, agregamos una nueva fila
      hoja.appendRow([usuario, extension, fechaActual, turno]);
    }
  } catch (e) {
    console.error("Error al registrar extensión: " + e.message);
  }
}

function guardarNuevoUsuario(u, p, r, t, pr) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let hoja = ss.getSheetByName("Usuarios") || ss.insertSheet("Usuarios");
  if (hoja.getLastRow() === 0) hoja.appendRow(["Usuario", "Password", "Rol", "Turno", "Permiso Reporte"]);
  hoja.appendRow([u, p, r, t || "", pr || "N"]);
  return { success: true };
}

function obtenerListaUsuarios(filaCampanaActual = null) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hojaUsuarios = ss.getSheetByName("Usuarios");
  const hojaCampanas = ss.getSheetByName("Campañas");
  if (!hojaUsuarios) return [];
  const datosUsuarios = hojaUsuarios.getDataRange().getValues().slice(1);
  const todosLosUsuarios = datosUsuarios.map(r => ({ usuario: r[0], turno: r[3] ? r[3].toString().toLowerCase() : "" }));

  if (!hojaCampanas) return todosLosUsuarios;
  const datosCampanas = hojaCampanas.getDataRange().getValues().slice(1);
  let usuariosOcupados = [];
  datosCampanas.forEach((fila, index) => {
    if (fila[2] === "Activa" && (index + 2) != filaCampanaActual) {
      usuariosOcupados = usuariosOcupados.concat(fila[4] ? fila[4].toString().split(',') : []);
    }
  });
  return todosLosUsuarios.filter(u => !usuariosOcupados.includes(u.usuario));
}

function obtenerTodosLosUsuarios() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hoja = ss.getSheetByName("Usuarios");
  if (!hoja) return [];
  const datos = hoja.getDataRange().getValues().slice(1);
  return datos.map((f, i) => ({
    usuario: f[0],
    password: f[1],
    rol: f[2],
    turno: f[3] || "",
    permisoReporte: (f[4] === true || f[4] === "S"),
    fila: i + 2
  }));
}

function eliminarUsuario(fila) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hoja = ss.getSheetByName("Usuarios");
  if (hoja) { hoja.deleteRow(fila); return { success: true }; }
  return { success: false };
}

function actualizarUsuario(fila, u, p, r, t, pr) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hoja = ss.getSheetByName("Usuarios");
  if (hoja) {
    hoja.getRange(parseInt(fila), 1, 1, 5).setValues([[u, p, r, t || "", pr || "N"]]);
    return { success: true };
  }
  return { success: false, mensaje: "Hoja no encontrada" };
}

// --- CAMPAÑAS ---
let _cachedCampanasArray = null;

function obtenerCampanas() {
  if (_cachedCampanasArray) return _cachedCampanasArray;

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let hoja = ss.getSheetByName("Campañas");
  if (!hoja) return [];
  const datos = hoja.getDataRange().getValues();

  const hoy = new Date();
  const timezone = Session.getScriptTimeZone();
  const hoyFormatted = Utilities.formatDate(hoy, timezone, "yyyy-MM-dd");

  const result = datos.slice(1).map((fila, index) => {
    let fechaInicioObj = fila[1];
    let fechaInicioFormatted = "";
    if (fechaInicioObj) {
      if (fechaInicioObj instanceof Date) {
        fechaInicioFormatted = Utilities.formatDate(fechaInicioObj, timezone, "yyyy-MM-dd");
      } else {
        fechaInicioFormatted = fechaInicioObj.toString().split('T')[0];
      }
    }

    let fechaFinObj = fila[6];
    let fechaFinFormatted = "";
    if (fechaFinObj) {
      if (fechaFinObj instanceof Date) {
        fechaFinFormatted = Utilities.formatDate(fechaFinObj, timezone, "yyyy-MM-dd");
      } else {
        fechaFinFormatted = fechaFinObj.toString().split('T')[0];
      }
    }

    let estatus = fila[2];

    // --- LÓGICA DE CIERRE AUTOMÁTICO SOLICITADA ---
    if (estatus === "Activa" && fechaFinFormatted && hoyFormatted > fechaFinFormatted) {
      estatus = "Finalizada";
      hoja.getRange(index + 2, 3).setValue(estatus);
    }
    // ----------------------------------------------

    return {
      nombre: fila[0],
      fechaInicio: fechaInicioFormatted,
      estatus: estatus,
      descripcion: fila[3] || "",
      usuarios: fila[4],
      dialogo: fila[5],
      fechaFin: fechaFinFormatted,
      formularioId: fila[7] || "",
      reporteId: fila[8] || "",
      tipoAsignacion: fila[9] || "Issabel",
      distribucion: fila[10] || "",
      tipoCampana: fila[11] || "Saliente",
      columnasVisibles: fila[12] || "",
      meta: fila[13] || 0,
      sla: fila[14] || 0,
      fila: index + 2
    };
  });

  _cachedCampanasArray = result;
  return result;
}

function obtenerCampanasOperador(nombreUsuario) {
  const todas = obtenerCampanas();
  return todas.filter(c => {
    const listaUser = c.usuarios ? c.usuarios.split(',') : [];
    return listaUser.includes(nombreUsuario) && c.estatus === "Activa";
  });
}

function guardarOActualizarCampana(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let hoja = ss.getSheetByName("Campañas") || ss.insertSheet("Campañas");

  const filaDatos = [
    data.nombre,
    data.fecha,
    data.estatus,
    data.descripcion,
    data.usuarios.join(','),
    data.dialogo,
    data.fechaFin,
    data.formularioId,
    data.reporteId || "",
    data.tipoAsignacion || "Issabel",
    data.distribucion || "",
    data.tipoCampana || "Saliente",
    data.columnasVisibles || "",
    data.meta || 0,
    data.sla || 0
  ];

  if (data.fila) hoja.getRange(parseInt(data.fila), 1, 1, 15).setValues([filaDatos]);
  else hoja.appendRow(filaDatos);

  // Limpiar caché de metadatos para esta campaña para forzar actualización
  PropertiesService.getScriptProperties().deleteProperty("METADATA_" + data.nombre);

  obtenerOCrearSheetReporte(data.nombre, []);
  return { success: true };
}

function guardarConfiguracionColumnas(nombreCampana, columnasStr) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hoja = ss.getSheetByName("Campañas");
  if (!hoja) return { success: false };
  const datos = hoja.getDataRange().getValues();
  for (let i = 1; i < datos.length; i++) {
    if (datos[i][0] === nombreCampana) {
      hoja.getRange(i + 1, 13).setValue(columnasStr);
      return { success: true };
    }
  }
  return { success: false };
}

function eliminarCampanaPorFila(fila) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hoja = ss.getSheetByName("Campañas");
  if (hoja) { hoja.deleteRow(fila); return { success: true }; }
  return { success: false };
}

// --- FORMULARIOS ---
function guardarNuevoFormulario(nombre, campos, fila) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let hoja = ss.getSheetByName("Formularios") || ss.insertSheet("Formularios");
  const datos = [nombre, JSON.stringify(campos), new Date()];
  if (fila) hoja.getRange(parseInt(fila), 1, 1, 3).setValues([datos]);
  else hoja.appendRow(datos);
  return { success: true };
}

function obtenerFormularios() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let hoja = ss.getSheetByName("Formularios");
  if (!hoja) return [];
  return hoja.getDataRange().getValues().slice(1).map((f, i) => ({ nombre: f[0], campos: f[1], fila: i + 2 }));
}

function eliminarFormulario(fila) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hoja = ss.getSheetByName("Formularios");
  if (hoja) { hoja.deleteRow(fila); return { success: true }; }
  return { success: false };
}

function obtenerFuentesDatos() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const formularios = obtenerFormularios();

  // Extraer todos los nombres de pestañas únicos usados en los formularios
  let pestanasRequeridas = new Set(["Estados"]); // "Estados" siempre por retrocompatibilidad

  formularios.forEach(f => {
    try {
      const parsed = JSON.parse(f.campos || "[]");
      const campos = Array.isArray(parsed) ? parsed : (parsed.campos || []);
      campos.forEach(c => {
        if (c.tipo === 'select_busqueda' && c.nombrePestana) {
          pestanasRequeridas.add(c.nombrePestana.trim());
        }
      });
    } catch (e) { }
  });

  const fuentes = {};

  pestanasRequeridas.forEach(nombre => {
    const hoja = ss.getSheetByName(nombre);
    if (hoja) {
      const data = hoja.getDataRange().getDisplayValues();
      if (data.length > 1) {
        fuentes[nombre] = data.slice(1).filter(row => row.some(cell => cell.trim() !== ""));
      }
    }
  });

  return fuentes;
}

// --- LOGICA DE GOOGLE SHEETS PARA REPORTES EN CARPETA ASIGNADA ---
function obtenerOCrearSheetReporte(nombreCampana, preguntasFormulario) {
  let folder;
  try {
    folder = DriveApp.getFolderById(CARPETA_REPORTES_ID);
  } catch (e) {
    Logger.log("Error de Carpeta: Asegurate de tener acceso a la carpeta de reportes.");
    return null;
  }

  const nombreArchivo = "Reporte_Gestiones_" + nombreCampana;
  const archivos = folder.getFilesByName(nombreArchivo);

  let ssReporte;
  let isNew = false;

  if (archivos.hasNext()) {
    const file = archivos.next();
    ssReporte = SpreadsheetApp.openById(file.getId());
  } else {
    ssReporte = SpreadsheetApp.create(nombreArchivo);
    const file = DriveApp.getFileById(ssReporte.getId());
    file.moveTo(folder);
    isNew = true;
  }

  const hoja = ssReporte.getSheets()[0];
  hoja.setName("Gestiones");

  let cabeceras = ["Campaña", "Resultado", "Usuario", "Fecha"];

  if (preguntasFormulario && preguntasFormulario.length > 0) {
    preguntasFormulario.forEach(pregunta => {
      if (!cabeceras.includes(pregunta)) cabeceras.push(pregunta);
    });
  }

  if (isNew) {
    hoja.appendRow(cabeceras);
    hoja.getRange(1, 1, 1, cabeceras.length).setFontWeight("bold").setBackground("#e2e8f0");
    hoja.setFrozenRows(1);
  } else {
    let cabecerasActuales = hoja.getRange(1, 1, 1, hoja.getLastColumn() || 1).getValues()[0];
    let actualizadas = false;

    cabeceras.forEach(c => {
      if (!cabecerasActuales.includes(c)) {
        cabecerasActuales.push(c);
        actualizadas = true;
      }
    });

    if (actualizadas) {
      hoja.getRange(1, 1, 1, cabecerasActuales.length).setValues([cabecerasActuales]);
      hoja.getRange(1, 1, 1, cabecerasActuales.length).setFontWeight("bold").setBackground("#e2e8f0");
    }
  }

  return ssReporte;
}

// --- DATA Y GESTIONES (ESTADISTICAS GENERALES) ---
// SE MANTIENE INTACTO A PETICIÓN TUYA - NO SE TOCÓ.
function obtenerEstadisticasLlamadas(nombreCampana) {
  let dataReporte = obtenerGestionesCampana(nombreCampana, 0);
  let exitosas = 0, fallidas = 0, total = 0;
  let totalUnicos = 0;
  let statsOperadores = {};

  let totalData = obtenerTotalFilasCampana(nombreCampana);

  if (dataReporte.length > 1) {
    total = dataReporte.length - 1;
    const cabeceras = dataReporte[0];

    let idxResultado = cabeceras.findIndex(c => c.toString().toUpperCase().trim() === "ESTADO DE LA LLAMADA");

    if (idxResultado === -1) {
      idxResultado = cabeceras.findIndex(c => {
        let txt = c.toString().toUpperCase().trim();
        return txt === "ESTADO" || txt === "RESULTADO";
      });
    }

    let idxUsuario = cabeceras.findIndex(c => c.toString().toLowerCase().trim() === "usuario");

    let idxTelGestiones = cabeceras.findIndex(h => {
      let txt = h.toString().toLowerCase().trim();
      return txt.includes("tel") || txt.includes("cel") || txt === "id" || txt.includes("cédula") || txt.includes("cedula");
    });
    if (idxTelGestiones === -1) idxTelGestiones = cabeceras.length > 4 ? 4 : 0;

    // Obtenemos el tipo de asignación
    const campanas = obtenerCampanas();
    const campanaObj = campanas.find(c => c.nombre === nombreCampana);
    const tipoAsignacion = campanaObj ? campanaObj.tipoAsignacion : "";

    let unicosSet = new Set();
    let estadoPorId = {};
    let estadoPorOperadorYId = {};

    if (idxResultado !== -1) {
      for (let i = 1; i < dataReporte.length; i++) {
        let valId = dataReporte[i][idxTelGestiones];
        let keyUnica = valId ? valId.toString().trim() : "FILA_" + i;

        if (tipoAsignacion === 'Incidencias' || tipoAsignacion === 'ExploracionDuplicados') {
          keyUnica = "FILA_" + i; // Contamos cada gestión de forma totalmente individual
        }

        unicosSet.add(keyUnica);

        let celdaValor = dataReporte[i][idxResultado];
        let status = celdaValor ? celdaValor.toString().trim().toLowerCase() : "";
        let usuario = idxUsuario !== -1 && dataReporte[i][idxUsuario] ? dataReporte[i][idxUsuario].toString().trim() : "Desconocido";

        if (!statsOperadores[usuario]) {
          statsOperadores[usuario] = { exitosas: 0, fallidas: 0, total: 0 };
        }

        let isExitosa = (status === "exitosa" || status.includes("answered") || status.includes("contestó") || status.includes("efectiv"));
        let isFallida = (status === "fallida" || status.includes("failed") || status.includes("no answer") || status.includes("abandon") || (!isExitosa && status !== ""));

        // Estado Global
        if (!estadoPorId[keyUnica]) estadoPorId[keyUnica] = "ninguno";
        if (isExitosa) estadoPorId[keyUnica] = "exitosa";
        else if (isFallida && estadoPorId[keyUnica] !== "exitosa") estadoPorId[keyUnica] = "fallida";

        // Estado por Operador
        let opKey = usuario + "|_" + keyUnica;
        if (!estadoPorOperadorYId[opKey]) estadoPorOperadorYId[opKey] = "ninguno";
        if (isExitosa) estadoPorOperadorYId[opKey] = "exitosa";
        else if (isFallida && estadoPorOperadorYId[opKey] !== "exitosa") estadoPorOperadorYId[opKey] = "fallida";
      }

      totalUnicos = unicosSet.size;

      for (let k in estadoPorId) {
        if (estadoPorId[k] === "exitosa") exitosas++;
        else if (estadoPorId[k] === "fallida") fallidas++;
      }

      for (let k in estadoPorOperadorYId) {
        let usuario = k.split("|_")[0];
        let state = estadoPorOperadorYId[k];

        statsOperadores[usuario].total++;
        if (state === "exitosa") statsOperadores[usuario].exitosas++;
        else if (state === "fallida") statsOperadores[usuario].fallidas++;
      }
    }
  }

  // Efectividad Global (Exitosas vs Total de la Data)
  let efectividad = totalData > 0 ? ((exitosas / totalData) * 100).toFixed(2) : 0;

  // Efectividad en Gestiones (Exitosas vs Total Realizadas)
  let efectividadGestiones = totalUnicos > 0 ? ((exitosas / totalUnicos) * 100).toFixed(2) : 0;

  let operadores = [];
  for (let op in statsOperadores) {
    let opStats = statsOperadores[op];
    let opEfectividad = opStats.total > 0 ? ((opStats.exitosas / opStats.total) * 100).toFixed(2) : 0;
    operadores.push({
      nombre: op,
      exitosas: opStats.exitosas,
      fallidas: opStats.fallidas,
      total: opStats.total,
      efectividad: opEfectividad
    });
  }

  return { exitosas, fallidas, total, totalRealizadas: totalUnicos, efectividad, efectividadGestiones, operadores, totalData };
}

// --- MÓDULO: CONTADOR DE OPERADOR (REINICIO DIARIO) ---
function obtenerContadorOperador(nombreCampana, usuario) {
  let dataReporte = obtenerGestionesCampana(nombreCampana, 0);
  let exitosas = 0, fallidas = 0;
  let incidencias = 0;

  if (dataReporte.length > 1) {
    const cabeceras = dataReporte[0];

    let idxResultado = cabeceras.findIndex(c => c.toString().toUpperCase().trim() === "ESTADO DE LA LLAMADA");
    if (idxResultado === -1) {
      idxResultado = cabeceras.findIndex(c => {
        let txt = c.toString().toUpperCase().trim();
        return txt === "ESTADO" || txt === "RESULTADO" || txt === "ESTATUS";
      });
    }

    let idxUsuario = cabeceras.findIndex(c => c.toString().toLowerCase().trim() === "usuario");
    let idxFecha = cabeceras.findIndex(c => c.toString().toLowerCase().trim() === "fecha");

    let idxTelGestiones = cabeceras.findIndex(h => {
      let txt = h.toString().toLowerCase().trim();
      return txt.includes("tel") || txt.includes("cel") || txt === "id" || txt.includes("cédula") || txt.includes("cedula");
    });
    if (idxTelGestiones === -1) idxTelGestiones = cabeceras.length > 4 ? 4 : 0;

    const timezone = Session.getScriptTimeZone();
    let fechaHoy = Utilities.formatDate(new Date(), timezone, "yyyy-MM-dd");
    let uTarget = usuario.toString().toLowerCase().trim();

    let estadoPorId = {};

    // Optimizamos: No volvemos a llamar a obtenerCampanas si ya tenemos el objeto, 
    // pero para compatibilidad buscamos en el cache global.
    const campanas = obtenerCampanas();
    const campanaObj = campanas.find(c => c.nombre === nombreCampana);
    const tipoAsignacion = campanaObj ? campanaObj.tipoAsignacion : "";

    if (idxResultado !== -1 && idxUsuario !== -1 && idxFecha !== -1) {
      for (let i = 1; i < dataReporte.length; i++) {
        let userRow = dataReporte[i][idxUsuario] ? dataReporte[i][idxUsuario].toString().toLowerCase().trim() : "";
        let valFecha = dataReporte[i][idxFecha];
        let fFila = "";

        if (valFecha instanceof Date) {
          fFila = Utilities.formatDate(valFecha, timezone, "yyyy-MM-dd");
        } else {
          // Si es displayValue, intentamos normalizar
          let s = valFecha ? valFecha.toString().trim() : "";
          if (s.includes(' ')) s = s.split(' ')[0]; // Quitar hora si existe
          if (s.includes('/')) {
            let p = s.split('/');
            if (p[0].length === 4) fFila = `${p[0]}-${p[1].padStart(2, '0')}-${p[2].padStart(2, '0')}`; // yyyy/mm/dd
            else if (p[2].length === 4) fFila = `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`; // dd/mm/yyyy
          } else {
            fFila = s;
          }
        }

        if (userRow === uTarget && fFila.includes(fechaHoy)) {
          incidencias++; // Cada registro o fila procesada

          let valId = dataReporte[i][idxTelGestiones];
          let keyUnica = valId ? valId.toString().trim() : "FILA_" + i;

          if (tipoAsignacion === 'Incidencias' || tipoAsignacion === 'ExploracionDuplicados') {
            keyUnica = "FILA_" + i; // Contamos cada gestión de forma totalmente individual
          }

          let status = dataReporte[i][idxResultado] ? dataReporte[i][idxResultado].toString().trim().toLowerCase() : "";

          let isExitosa = (status === "exitosa" || status.includes("answered") || status.includes("contestó") || status.includes("efectiv"));
          let isFallida = (status === "fallida" || status.includes("failed") || status.includes("no answer") || status.includes("abandon") || (!isExitosa && status !== ""));

          if (!estadoPorId[keyUnica]) estadoPorId[keyUnica] = "ninguno";
          if (isExitosa) estadoPorId[keyUnica] = "exitosa";
          else if (isFallida && estadoPorId[keyUnica] !== "exitosa") estadoPorId[keyUnica] = "fallida";
        }
      }

      for (let k in estadoPorId) {
        if (estadoPorId[k] === "exitosa") exitosas++;
        else if (estadoPorId[k] === "fallida") fallidas++;
      }
    }
  }
  return { exitosas, fallidas, incidencias };
}

function obtenerMisEstadisticasHoy(usuario) {
  const timezone = Session.getScriptTimeZone();
  const hoyStr = Utilities.formatDate(new Date(), timezone, "yyyy-MM-dd");

  // OPTIMIZACIÓN EXTREMA (0 SEGUNDOS): Leemos solo las campañas que realmente han tenido actividad hoy
  const propKey = "CAMPANAS_ACTIVAS_" + hoyStr;
  const props = PropertiesService.getScriptProperties();
  const activasStr = props.getProperty(propKey);

  let nombresActivasHoy = [];

  if (activasStr) {
    nombresActivasHoy = JSON.parse(activasStr);
  } else {
    // FALLBACK INTELIGENTE: Si el caché está vacío (ej: primera vez tras actualización o inicio de día),
    // escaneamos solo las campañas con estatus "Activa" para reconstruir el índice.
    // Esto solo pasará UNA VEZ al día para el primer usuario, el resto irá a 0 segundos.
    const hoyInicio = new Date();
    hoyInicio.setHours(0, 0, 0, 0);

    const campanasActivas = obtenerCampanas().filter(c => c.estatus === "Activa");
    campanasActivas.forEach(c => {
      const fileId = getReporteFileId(c.nombre);
      if (fileId) {
        try {
          const file = DriveApp.getFileById(fileId);
          if (file.getLastUpdated() >= hoyInicio) {
            nombresActivasHoy.push(c.nombre);
          }
        } catch (e) { }
      }
    });

    if (nombresActivasHoy.length > 0) {
      props.setProperty(propKey, JSON.stringify(nombresActivasHoy));
    } else {
      return []; // Realmente no hay actividad hoy
    }
  }

  const campanas = obtenerCampanas().filter(c => nombresActivasHoy.includes(c.nombre));

  let resultados = [];

  // Solo iteramos sobre las 1 o 2 campañas que de verdad se tocaron hoy
  campanas.forEach(c => {
    let stats = obtenerContadorOperador(c.nombre, usuario);
    if (stats.exitosas > 0 || stats.fallidas > 0 || stats.incidencias > 0) {
      resultados.push({
        nombre: c.nombre,
        tipoAsignacion: c.tipoAsignacion,
        exitosas: stats.exitosas,
        fallidas: stats.fallidas,
        incidencias: stats.incidencias
      });
    }
  });

  return resultados;
}
// -------------------------------------------------------------------------

function procesarDataCampaña(nombreCampana, matrizDatos) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let hoja = ss.getSheetByName("Data_Campañas") || ss.insertSheet("Data_Campañas");
  if (hoja.getLastRow() === 0) hoja.appendRow(["Campaña", "Archivo_Drive", "Fecha_Carga"]);

  hoja.appendRow([nombreCampana, "BASE_DATOS_" + nombreCampana + ".csv", new Date()]);
  guardarArchivoEnDrive(nombreCampana, "BASE_DATOS_" + nombreCampana + ".csv", matrizDatos);

  let cabecerasCliente = (matrizDatos && matrizDatos.length > 0) ? matrizDatos[0] : [];
  let preguntasFormulario = [];
  let hojaCampanas = ss.getSheetByName("Campañas");

  if (hojaCampanas) {
    let datosCampanas = hojaCampanas.getDataRange().getValues();
    let formId = "";
    for (let i = 1; i < datosCampanas.length; i++) {
      if (datosCampanas[i][0] === nombreCampana) {
        formId = datosCampanas[i][7];
        break;
      }
    }

    if (formId) {
      let hojaForms = ss.getSheetByName("Formularios");
      if (hojaForms) {
        let datosForms = hojaForms.getDataRange().getValues();
        for (let i = 1; i < datosForms.length; i++) {
          if (datosForms[i][0] === formId) {
            let parsed = JSON.parse(datosForms[i][1]);
            let camposForm = Array.isArray(parsed) ? parsed : (parsed.campos || []);
            preguntasFormulario = camposForm.map(c => c.label);
            break;
          }
        }
      }
    }
  }

  let cabecerasCombinadas = cabecerasCliente.concat(preguntasFormulario);
  obtenerOCrearSheetReporte(nombreCampana, cabecerasCombinadas);

  return { success: true };
}

function obtenerDataCampaña(nombreCampana, pagina = 1, limitePorPagina = 1000) {
  const carpeta = obtenerOCrearCarpetaCampana(nombreCampana);
  const archivos = carpeta.getFilesByName("BASE_DATOS_" + nombreCampana + ".csv");

  if (archivos.hasNext()) {
    const csvContent = archivos.next().getBlob().getDataAsString();
    const matriz = Utilities.parseCsv(csvContent);

    // Si página = 0, devolver todo (compatibilidad)
    if (pagina === 0) return matriz;

    const totalFilas = matriz.length;
    const totalPaginas = Math.ceil((totalFilas) / limitePorPagina);

    const inicio = (pagina - 1) * limitePorPagina;
    const fin = Math.min(inicio + limitePorPagina, totalFilas);

    if (inicio >= totalFilas) return [];

    return matriz.slice(inicio, fin);
  }
  return [];
}

// --- VERSIÓN CON METADATA DE PAGINACIÓN PARA DATA DE CAMPAÑA ---
function obtenerDataCampañaPaginada(nombreCampana, pagina = 1, limitePorPagina = 1000) {
  try {
    const carpeta = obtenerOCrearCarpetaCampana(nombreCampana);
    const archivos = carpeta.getFilesByName("BASE_DATOS_" + nombreCampana + ".csv");

    if (!archivos.hasNext()) {
      return { data: [], metadata: { totalRegistros: 0, paginaActual: 1, totalPaginas: 0 } };
    }

    const csvContent = archivos.next().getBlob().getDataAsString();
    const matriz = Utilities.parseCsv(csvContent);
    const totalFilas = matriz.length;
    const totalPaginas = Math.ceil(totalFilas / limitePorPagina);

    const inicio = (pagina - 1) * limitePorPagina;
    const fin = Math.min(inicio + limitePorPagina, totalFilas);

    if (inicio >= totalFilas) {
      return { data: [], metadata: { totalRegistros: totalFilas, paginaActual: pagina, totalPaginas } };
    }

    return {
      data: matriz.slice(inicio, fin),
      metadata: {
        totalRegistros: totalFilas,
        paginaActual: pagina,
        totalPaginas: totalPaginas,
        tieneAnterior: pagina > 1,
        tieneSiguiente: pagina < totalPaginas,
        limitePorPagina: limitePorPagina
      }
    };
  } catch (e) {
    return { error: e.message, data: [], metadata: {} };
  }
}

// --- CONTADOR RÁPIDO DE REGISTROS EN DATA CSV ---
function obtenerConteoDataCampana(nombreCampana) {
  try {
    const carpeta = obtenerOCrearCarpetaCampana(nombreCampana);
    const archivos = carpeta.getFilesByName("BASE_DATOS_" + nombreCampana + ".csv");

    if (!archivos.hasNext()) return { total: 0, columnas: [] };

    const csvContent = archivos.next().getBlob().getDataAsString();
    const matriz = Utilities.parseCsv(csvContent);

    return {
      total: matriz.length > 0 ? matriz.length - 1 : 0,
      columnas: matriz.length > 0 ? matriz[0] : []
    };
  } catch (e) {
    return { total: 0, columnas: [], error: e.message };
  }
}

function obtenerTotalFilasCampana(nombreCampana) {
  if (!nombreCampana) return 0;
  const carpeta = obtenerOCrearCarpetaCampana(nombreCampana);
  const archivos = carpeta.getFilesByName("BASE_DATOS_" + nombreCampana + ".csv");

  if (archivos.hasNext()) {
    const csvContent = archivos.next().getBlob().getDataAsString();
    const matriz = Utilities.parseCsv(csvContent);
    return matriz.length > 1 ? matriz.length - 1 : 0;
  }
  return 0;
}

/**
 * Obtiene metadatos de campaña de forma acelerada usando caché persistente.
 * Reduce el tiempo de ejecución en ~800ms al evitar lecturas de Sheets.
 */
function getCampanaMetadataCached(nombreCampana) {
  const prop = PropertiesService.getScriptProperties();
  const key = "METADATA_" + nombreCampana;
  let cached = prop.getProperty(key);

  if (cached) return JSON.parse(cached);

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let hojaCampanas = ss.getSheetByName("Campañas");
  if (!hojaCampanas) return null;

  let datosCampanas = hojaCampanas.getDataRange().getValues();
  let formId = "";
  let reporteId = "";
  for (let i = 1; i < datosCampanas.length; i++) {
    if (datosCampanas[i][0] === nombreCampana) {
      formId = datosCampanas[i][7];
      reporteId = datosCampanas[i][8];
      break;
    }
  }

  let preguntasOrdenadas = [];
  if (formId) {
    let hojaForms = ss.getSheetByName("Formularios");
    if (hojaForms) {
      let datosForms = hojaForms.getDataRange().getValues();
      for (let i = 1; i < datosForms.length; i++) {
        if (datosForms[i][0] === formId) {
          let parsed = JSON.parse(datosForms[i][1]);
          let camposForm = Array.isArray(parsed) ? parsed : (parsed.campos || []);
          preguntasOrdenadas = camposForm.map(c => c.label);
          break;
        }
      }
    }
  }

  const metadata = { formId, reporteId, preguntasOrdenadas };
  prop.setProperty(key, JSON.stringify(metadata));
  return metadata;
}

function registrarGestion(nombreCampana, resultado, dataForm, usuario, csvHeaders = null, preguntasOrdenadas = null) {
  // --- VALIDACIÓN DE SEGURIDAD (ANTIGRAVITY ARCHITECT) ---
  let hasIdentificador = false;
  for (let key in dataForm) {
    let kLow = key.toLowerCase();
    if (kLow.includes("tel") || kLow.includes("cel") || kLow === "id") {
      if (dataForm[key]) {
        hasIdentificador = true;
        break;
      }
    }
  }
  if (!hasIdentificador) {
    return { success: false, error: { message: "No se encontró un número telefónico o ID válido en la gestión." } };
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let hoja = ss.getSheetByName("Gestiones") || ss.insertSheet("Gestiones");
  if (hoja.getLastRow() === 0) {
    hoja.appendRow(["Campaña", "Resultado", "Usuario", "Fecha"]);
  }
  const fecha = new Date();
  hoja.appendRow([nombreCampana, resultado, usuario, fecha]);

  // Aceleración mediante caché de metadatos
  if (!preguntasOrdenadas) {
    const meta = getCampanaMetadataCached(nombreCampana);
    if (meta) {
      preguntasOrdenadas = meta.preguntasOrdenadas;
    }
  }

  // --- OPTIMIZACIÓN EXTREMA: REGISTRO DE CAMPAÑAS ACTIVAS HOY ---
  try {
    const tz = Session.getScriptTimeZone();
    const hoyStr = Utilities.formatDate(fecha, tz, "yyyy-MM-dd");
    const propKey = "CAMPANAS_ACTIVAS_" + hoyStr;
    const props = PropertiesService.getScriptProperties();
    let activasStr = props.getProperty(propKey);
    let activas = activasStr ? JSON.parse(activasStr) : [];

    if (!activas.includes(nombreCampana)) {
      activas.push(nombreCampana);
      props.setProperty(propKey, JSON.stringify(activas));
    }
  } catch (e) {
    console.warn("No se pudo registrar la campaña activa hoy: " + e.message);
  }
  // -------------------------------------------------------------

  actualizarReporteConSheetCarpeta(nombreCampana, dataForm, resultado, usuario, fecha, preguntasOrdenadas, csvHeaders);

  // No hacemos flush aquí para permitir que GAS optimice el retorno de la llamada
  return { success: true };
}

function actualizarReporteConSheetCarpeta(nombreCampana, dataForm, resultado, usuario, fecha, preguntasOrdenadas, csvHeaders = null) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let reporteId = "";
  let filaCampana = -1;

  // Aceleración mediante caché de metadatos
  const meta = getCampanaMetadataCached(nombreCampana);
  let hojaCampanas = ss.getSheetByName("Campañas");
  if (meta && meta.reporteId) {
    reporteId = meta.reporteId;
  } else {
    if (hojaCampanas) {
      const dataC = hojaCampanas.getDataRange().getValues();
      for (let i = 1; i < dataC.length; i++) {
        if (dataC[i][0] === nombreCampana) {
          reporteId = dataC[i][8];
          filaCampana = i + 1;
          break;
        }
      }
    }
  }

  let ssReporte;
  if (reporteId) {
    try {
      ssReporte = SpreadsheetApp.openById(reporteId);
    } catch (e) { reporteId = ""; }
  }

  if (!ssReporte) {
    ssReporte = obtenerOCrearSheetReporte(nombreCampana, preguntasOrdenadas);
    if (!ssReporte) return;
    if (filaCampana !== -1 && hojaCampanas) {
      hojaCampanas.getRange(filaCampana, 9).setValue(ssReporte.getId());
    }
  }

  const hoja = ssReporte.getSheets()[0];
  let cabecerasActuales = hoja.getRange(1, 1, 1, Math.max(1, hoja.getLastColumn())).getValues()[0];
  const baseHeaders = ["Campaña", "Resultado", "Usuario", "Fecha"];

  if (!csvHeaders) {
    const dataCSV = obtenerDataCampaña(nombreCampana, 0);
    csvHeaders = (dataCSV && dataCSV.length > 0) ? dataCSV[0] : [];
  }

  let clienteHeaders = csvHeaders.filter(k =>
    !baseHeaders.includes(k) &&
    !preguntasOrdenadas.includes(k) &&
    k !== ""
  );

  let ordenDeseado = baseHeaders.concat(clienteHeaders).concat(preguntasOrdenadas);

  let requiereReordenar = false;
  if (cabecerasActuales.length !== ordenDeseado.length) requiereReordenar = true;
  else {
    for (let i = 0; i < ordenDeseado.length; i++) {
      if (cabecerasActuales[i] !== ordenDeseado[i]) {
        requiereReordenar = true;
        break;
      }
    }
  }

  if (requiereReordenar) {
    hoja.getRange(1, 1, 1, ordenDeseado.length).setValues([ordenDeseado]);
    hoja.getRange(1, 1, 1, ordenDeseado.length).setFontWeight("bold").setBackground("#e2e8f0");
    cabecerasActuales = ordenDeseado;
  }

  let nuevaFila = new Array(cabecerasActuales.length).fill("");
  const idxCampana = cabecerasActuales.indexOf("Campaña");
  const idxResultado = cabecerasActuales.indexOf("Resultado");
  const idxUsuario = cabecerasActuales.indexOf("Usuario");
  const idxFecha = cabecerasActuales.indexOf("Fecha");

  if (idxCampana !== -1) nuevaFila[idxCampana] = nombreCampana;
  if (idxResultado !== -1) nuevaFila[idxResultado] = resultado;
  if (idxUsuario !== -1) nuevaFila[idxUsuario] = usuario;
  if (idxFecha !== -1) nuevaFila[idxFecha] = Utilities.formatDate(fecha, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");

  Object.keys(dataForm).forEach(k => {
    const idx = cabecerasActuales.indexOf(k);
    if (idx !== -1 && !baseHeaders.includes(k)) {
      nuevaFila[idx] = dataForm[k];
    }
  });

  hoja.appendRow(nuevaFila);
  SpreadsheetApp.flush();
}

let _cachedFolderReportes = null;
let _cachedReportesFiles = null;

function getFolderReportes() {
  if (!_cachedFolderReportes) {
    _cachedFolderReportes = DriveApp.getFolderById(CARPETA_REPORTES_ID);
  }
  return _cachedFolderReportes;
}

function getReporteFileId(nombreCampana) {
  const fileName = "Reporte_Gestiones_" + nombreCampana;
  const prop = PropertiesService.getScriptProperties();
  const cacheKey = "FILEID_" + nombreCampana;

  // 1. Intento por caché local (rápido)
  if (_cachedReportesFiles && _cachedReportesFiles[fileName]) {
    return _cachedReportesFiles[fileName];
  }

  // 2. Intento por PropertiesService (persistente entre ejecuciones)
  let persistentId = prop.getProperty(cacheKey);
  if (persistentId) {
    if (!_cachedReportesFiles) _cachedReportesFiles = {};
    _cachedReportesFiles[fileName] = persistentId;
    return persistentId;
  }

  // 3. Búsqueda en Drive (lento, solo si no hay caché)
  try {
    const folder = getFolderReportes();
    const archivos = folder.getFilesByName(fileName);
    if (archivos.hasNext()) {
      const file = archivos.next();
      const id = file.getId();

      // Guardar en ambos niveles de caché
      if (!_cachedReportesFiles) _cachedReportesFiles = {};
      _cachedReportesFiles[fileName] = id;
      prop.setProperty(cacheKey, id);

      return id;
    }
  } catch (e) {
    console.error("Error buscando archivo: " + e.message);
  }
  return null;
}

/**
 * Bundles metadata (stats, exitosos, forms) for an operator.
 * Excludes large matrices to avoid GAS serialization limits.
 */
function getContextoOperador(nombreCampana, usuario) {
  try {
    const gestiones = obtenerGestionesCampana(nombreCampana, 0);
    const formularios = obtenerFormularios();

    let exitosos = [];
    let stats = { exitosas: 0, fallidas: 0, incidencias: 0 };

    if (gestiones && gestiones.length > 1) {
      const cabeceras = gestiones[0];

      let idxResultado = cabeceras.findIndex(c => {
        let txt = (c || "").toString().toUpperCase().trim();
        return txt === "ESTADO DE LA LLAMADA" || txt === "ESTADO" || txt === "RESULTADO" || txt === "ESTATUS";
      });
      let idxUsuario = cabeceras.findIndex(c => (c || "").toString().toLowerCase().trim() === "usuario");
      let idxFecha = cabeceras.findIndex(c => (c || "").toString().toLowerCase().trim() === "fecha");
      let idxTel = cabeceras.findIndex(h => {
        let ht = (h || "").toString().toLowerCase().trim();
        return ht.includes("tel") || ht.includes("cel") || ht === "id" || ht.includes("cédula") || ht.includes("cedula");
      });

      const tz = Session.getScriptTimeZone();
      const fechaHoy = Utilities.formatDate(new Date(), tz, "yyyy-MM-dd");
      const uTarget = usuario.toString().toLowerCase().trim();

      for (let i = 1; i < gestiones.length; i++) {
        const fila = gestiones[i];

        if (idxResultado !== -1 && idxTel !== -1) {
          let statusRaw = fila[idxResultado] ? fila[idxResultado].toString().trim().toLowerCase() : "";
          let isExito = statusRaw === "exitosa" || statusRaw.includes("answered") || statusRaw.includes("contestó") || statusRaw.includes("efectiv");
          if (isExito) {
            let telVal = fila[idxTel];
            if (telVal) exitosos.push(telVal.toString().trim());
          }
        }

        if (idxUsuario !== -1 && idxFecha !== -1 && idxResultado !== -1) {
          let uFila = fila[idxUsuario] ? fila[idxUsuario].toString().toLowerCase().trim() : "";
          let fFilaRaw = fila[idxFecha];
          let fFila = "";

          if (fFilaRaw instanceof Date) {
            fFila = Utilities.formatDate(fFilaRaw, tz, "yyyy-MM-dd");
          } else if (fFilaRaw) {
            fFila = fFilaRaw.toString().split(' ')[0];
            if (fFila.includes('/')) {
              let p = fFila.split('/');
              if (p[0].length === 4) fFila = `${p[0]}-${p[1].padStart(2, '0')}-${p[2].padStart(2, '0')}`;
              else fFila = `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`;
            }
          }

          if (uFila === uTarget && fFila === fechaHoy) {
            let res = fila[idxResultado] ? fila[idxResultado].toString().toLowerCase().trim() : "";
            let isEx = res === "exitosa" || res.includes("answered") || res.includes("contestó") || res.includes("efectiv");
            if (isEx) stats.exitosas++;
            else stats.fallidas++;
            if (res.includes("(resuelta)") || res.includes("(resuelta general)")) stats.incidencias++;
          }
        }
      }
    }

    return {
      exitosos: exitosos,
      formularios: formularios,
      stats: stats
    };
  } catch (e) {
    console.error("Error en getContextoOperador: " + e.message);
    return { error: e.message };
  }
}

function obtenerGestionesCampana(nombreCampana, pagina = 1, limitePorPagina = 500) {
  try {
    const fileId = getReporteFileId(nombreCampana);
    if (!fileId) return [];

    const ss = SpreadsheetApp.openById(fileId);
    const hoja = ss.getSheets()[0];
    const totalFilas = hoja.getLastRow();

    if (totalFilas === 0) return [];

    // Si página = 0, devolver TODO (usamos getDisplayValues para consistencia)
    if (pagina === 0) {
      return hoja.getDataRange().getDisplayValues();
    }

    const inicio = (pagina - 1) * limitePorPagina + 1;
    const fin = Math.min(inicio + limitePorPagina - 1, totalFilas);

    if (inicio > totalFilas) return [];

    const datos = hoja.getRange(inicio, 1, fin - inicio + 1, hoja.getLastColumn()).getDisplayValues();

    if (pagina === 1 && totalFilas > 0) {
      const cabecera = hoja.getRange(1, 1, 1, hoja.getLastColumn()).getDisplayValues()[0];
      return [cabecera].concat(datos);
    }

    return datos;
  } catch (e) {
    console.error("Error en obtenerGestionesCampana: " + e.message);
    return [];
  }
}

// --- FUNCIÓN AUXILIAR: OBTENER GESTIONES CON METADATA DE PAGINACIÓN ---
function obtenerGestionesCampanaPaginadas(nombreCampana, pagina = 1, limitePorPagina = 500) {
  try {
    const fileId = getReporteFileId(nombreCampana);
    if (!fileId) return { error: "Campaña no encontrada", data: [], metadata: {} };

    const ss = SpreadsheetApp.openById(fileId);
    const hoja = ss.getSheets()[0];
    const totalFilas = hoja.getLastRow();
    const totalPaginas = Math.ceil((totalFilas - 1) / limitePorPagina); // -1 por cabecera

    if (totalFilas === 0 || totalFilas === 1) {
      return {
        data: [],
        metadata: {
          paginaActual: 1,
          totalPaginas: 0,
          totalRegistros: 0,
          tieneAnterior: false,
          tieneSiguiente: false
        }
      };
    }

    const inicio = Math.max(1, (pagina - 1) * limitePorPagina + 1);
    const fin = Math.min(inicio + limitePorPagina - 1, totalFilas);

    const datos = hoja.getRange(inicio, 1, fin - inicio + 1, hoja.getLastColumn()).getDisplayValues();

    // Incluir cabecera si es primera página
    let resultados = [];
    if (pagina === 1) {
      const cabecera = hoja.getRange(1, 1, 1, hoja.getLastColumn()).getDisplayValues()[0];
      resultados = [cabecera].concat(datos);
    } else {
      resultados = datos;
    }

    return {
      data: resultados,
      metadata: {
        paginaActual: pagina,
        totalPaginas: totalPaginas,
        totalRegistros: totalFilas - 1,
        tieneAnterior: pagina > 1,
        tieneSiguiente: pagina < totalPaginas,
        limitePorPagina: limitePorPagina
      }
    };
  } catch (e) {
    console.error("Error en obtenerGestionesCampanaPaginadas: " + e.message);
    return { error: e.message, data: [], metadata: {} };
  }
}

// --- CONTADOR RÁPIDO DE GESTIONES (SIN CARGAR DATA) ---
function obtenerConteoGestiones(nombreCampana) {
  try {
    const fileId = getReporteFileId(nombreCampana);
    if (!fileId) return { exitosas: 0, fallidas: 0, total: 0 };

    const ss = SpreadsheetApp.openById(fileId);
    const hoja = ss.getSheets()[0];
    const lastRow = hoja.getLastRow();
    const lastCol = hoja.getLastColumn();

    if (lastRow <= 1) return { exitosas: 0, fallidas: 0, total: 0 };

    const data = hoja.getRange(1, 1, lastRow, lastCol).getDisplayValues();
    const cabeceras = data[0].map(h => h.toString().toLowerCase().trim());

    const idxResultado = cabeceras.findIndex(c =>
      c === "resultado" || c === "estado de la llamada" || c === "estado"
    );

    if (idxResultado === -1) return { exitosas: 0, fallidas: 0, total: lastRow - 1 };

    let exitosas = 0, fallidas = 0;

    for (let i = 1; i < data.length; i++) {
      const res = (data[i][idxResultado] || "").toString().toLowerCase().trim();
      if (res === "exitosa" || res.includes("answered") || res.includes("contestó") || res.includes("efectiv")) {
        exitosas++;
      } else if (res === "fallida" || res.includes("failed") || res.includes("no answer") || res.includes("abandon") || (res !== "" && !res.includes("exitos"))) {
        fallidas++;
      }
    }

    return { exitosas, fallidas, total: lastRow - 1 };
  } catch (e) {
    console.error("Error en obtenerConteoGestiones: " + e.message);
    return { exitosas: 0, fallidas: 0, total: 0, error: e.message };
  }
}

// --- PANEL DE SUPERVISOR: MÉTRICAS EN TIEMPO REAL ---
function obtenerPanelSupervisor() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const hojaExtensiones = ss.getSheetByName("Extensiones");

    const resultado = {
      operadoresActivos: [],
      campanasActivas: [],
      metricasGlobales: {
        llamadasHoy: 0,
        exitosasHoy: 0,
        fallidasHoy: 0,
        efectividadHoy: 0,
        operadoresConectados: 0
      },
      ultimosRegistros: []
    };

    // 1. Obtener extensiones activas (ultimos 5 minutos)
    if (hojaExtensiones) {
      const datosExt = hojaExtensiones.getDataRange().getValues();
      const ahora = new Date();
      const hace5min = new Date(ahora.getTime() - 5 * 60000);

      for (let i = 1; i < datosExt.length; i++) {
        const fechaStr = datosExt[i][2];
        if (fechaStr) {
          const fechaExt = new Date(fechaStr);
          if (fechaExt >= hace5min) {
            if (!resultado.operadoresActivos.find(o => o.usuario === datosExt[i][0])) {
              resultado.operadoresActivos.push({
                usuario: datosExt[i][0],
                extension: datosExt[i][1],
                ultimoAcceso: Utilities.formatDate(fechaExt, Session.getScriptTimeZone(), "HH:mm:ss"),
                turno: datosExt[i][3] || ""
              });
            }
          }
        }
      }
      resultado.metricasGlobales.operadoresConectados = resultado.operadoresActivos.length;
    }

    // 2. Obtener campañas activas
    const campanas = obtenerCampanas().filter(c => c.estatus === "Activa");
    resultado.campanasActivas = campanas.map(c => ({
      nombre: c.nombre,
      tipoAsignacion: c.tipoAsignacion,
      tipoCampana: c.tipoCampana,
      usuarios: c.usuarios
    }));

    // 3. Calcular métricas globales del día
    const fechaHoy = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
    let totalHoy = 0, exitosasHoy = 0, fallidasHoy = 0;

    for (let c of campanas) {
      const gestData = obtenerGestionesCampana(c.nombre, 0);
      if (gestData.length > 1) {
        const idxFecha = gestData[0].findIndex(h => (h || "").toString().toLowerCase().trim() === "fecha");
        const idxResult = gestData[0].findIndex(h => (h || "").toString().toLowerCase().trim() === "resultado");

        if (idxFecha !== -1 && idxResult !== -1) {
          for (let i = 1; i < gestData.length; i++) {
            const fecha = (gestData[i][idxFecha] || "").toString();
            if (fecha.includes(fechaHoy)) {
              totalHoy++;
              const res = (gestData[i][idxResult] || "").toString().toLowerCase().trim();
              if (res === "exitosa" || res.includes("answered") || res.includes("contestó") || res.includes("efectiv")) {
                exitosasHoy++;
              } else if (res === "fallida" || res.includes("failed") || res.includes("no answer") || res.includes("abandon")) {
                fallidasHoy++;
              }
            }
          }
        }
      }
    }

    resultado.metricasGlobales.llamadasHoy = totalHoy;
    resultado.metricasGlobales.exitosasHoy = exitosasHoy;
    resultado.metricasGlobales.fallidasHoy = fallidasHoy;
    resultado.metricasGlobales.efectividadHoy = totalHoy > 0 ? ((exitosasHoy / totalHoy) * 100).toFixed(1) : 0;

    // 4. Últimos registros de gestión (últimas 10 llamadas)
    const hojaGestiones = ss.getSheetByName("Gestiones");
    if (hojaGestiones) {
      const ultimos = hojaGestiones.getDataRange().getValues();
      const start = Math.max(1, ultimos.length - 10);
      for (let i = ultimos.length - 1; i >= start; i--) {
        if (ultimos[i][0]) {
          resultado.ultimosRegistros.push({
            campaña: ultimos[i][0],
            resultado: ultimos[i][1],
            usuario: ultimos[i][2],
            fecha: ultimos[i][3] ? Utilities.formatDate(ultimos[i][3], Session.getScriptTimeZone(), "HH:mm:ss") : ""
          });
        }
      }
    }

    return resultado;
  } catch (e) {
    console.error("Error en obtenerPanelSupervisor: " + e.message);
    return { error: e.message, operadoresActivos: [], campanasActivas: [], metricasGlobales: {} };
  }
}

// --- MÉTRICAS RÁPIDAS POR OPERADOR (PARA SUPERVISOR) ---
function obtenerMetricasOperadorSupervisor(usuario) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const hojaGestiones = ss.getSheetByName("Gestiones");

    if (!hojaGestiones) return { error: "Hoja de gestions no encontrada" };

    const datos = hojaGestiones.getDataRange().getValues();
    const fechaHoy = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");

    let exitosas = 0, fallidas = 0, total = 0;

    for (let i = 1; i < datos.length; i++) {
      const fecha = datos[i][3];
      if (fecha && fecha.toString().includes(fechaHoy)) {
        const user = (datos[i][2] || "").toString().trim();
        if (user.toLowerCase() === usuario.toLowerCase()) {
          total++;
          const res = (datos[i][1] || "").toString().toLowerCase().trim();
          if (res === "exitosa" || res.includes("answered") || res.includes("contestó") || res.includes("efectiv")) {
            exitosas++;
          } else {
            fallidas++;
          }
        }
      }
    }

    return {
      usuario: usuario,
      exitosas: exitosas,
      fallidas: fallidas,
      total: total,
      efectividad: total > 0 ? ((exitosas / total) * 100).toFixed(1) : 0
    };
  } catch (e) {
    return { error: e.message };
  }
}

// --- AUTO REFRESCO GLOBAL ---
function triggerGlobalRefresh() {
  const timestamp = new Date().getTime().toString();
  PropertiesService.getScriptProperties().setProperty('GLOBAL_REFRESH_TIME', timestamp);
  return timestamp;
}

function checkGlobalRefresh() {
  const time = PropertiesService.getScriptProperties().getProperty('GLOBAL_REFRESH_TIME');
  return time ? time : "0";
}

// --- OBTENER DATA GENERAL CON GESTIONES CRUZADAS Y COMPLETAS ---
function obtenerDataConsolidada(nombreCampana) {
  const dataCSV = obtenerDataCampaña(nombreCampana, 0);
  const dataGestiones = obtenerGestionesCampana(nombreCampana, 0);

  if (!dataCSV || dataCSV.length === 0) return dataGestiones;

  const cabeceraCSV = dataCSV[0];
  let nuevaCabecera = [...cabeceraCSV];
  let columnasExtra = [];

  if (dataGestiones && dataGestiones.length > 0) {
    const cabeceraGestiones = dataGestiones[0];
    cabeceraGestiones.forEach((h, i) => {
      if (!cabeceraCSV.includes(h)) {
        columnasExtra.push({ nombre: h, index: i });
      }
    });
    nuevaCabecera = nuevaCabecera.concat(columnasExtra.map(c => c.nombre));
  }

  const resultadoFinal = [nuevaCabecera];

  let indicesCSVEnGestiones = cabeceraCSV.map(h => {
    if (dataGestiones && dataGestiones.length > 0) {
      return dataGestiones[0].indexOf(h);
    }
    return -1;
  });

  // Helper para calificar el estado (movido arriba para ser accesible globalmente)
  const idxResultadoGestiones = dataGestiones && dataGestiones.length > 0 ? dataGestiones[0].indexOf("Resultado") : -1;
  let idxEspecificoGestiones = -1;
  if (dataGestiones && dataGestiones.length > 0) {
    let cabecerasNormalizadas = dataGestiones[0].map(h => h.toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim());
    idxEspecificoGestiones = cabecerasNormalizadas.findIndex(ht => ht === "estado de la llamada especifico");
    if (idxEspecificoGestiones === -1) idxEspecificoGestiones = cabecerasNormalizadas.findIndex(ht => ht.includes("estado") && ht.includes("especifico"));
    if (idxEspecificoGestiones === -1) idxEspecificoGestiones = cabecerasNormalizadas.findIndex(ht => ht.includes("estado") && !ht.includes("resultado") && !ht.includes("sub"));
    if (idxEspecificoGestiones === -1) idxEspecificoGestiones = cabecerasNormalizadas.findIndex(ht => ht.includes("estado"));
  }

  function obtenerScore(rowGestion, idxResOriginal, idxEspOriginal) {
    if (!rowGestion || typeof rowGestion === "string") return 999; // Fallback de seguridad

    let idxRes = idxResOriginal !== undefined ? idxResOriginal : idxResultadoGestiones;
    let idxEsp = idxEspOriginal !== undefined ? idxEspOriginal : idxEspecificoGestiones;

    let estadoResultado = idxRes !== -1 ? (rowGestion[idxRes] || "").toString().trim().toLowerCase() : "";
    let esExitosa = (estadoResultado === "exitosa" || estadoResultado.includes("answered") || estadoResultado.includes("contestó") || estadoResultado.includes("efectiv"));
    if (esExitosa) return -2; // Mejor puntuación posible

    // Extraer columna específica quitando acentos para la comparación exacta
    let valEsp = idxEsp !== -1 ? (rowGestion[idxEsp] || "").toString() : estadoResultado;
    let estadoEspecifico = valEsp.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

    // Comparamos sin acentos contra la escala mutable
    let idxPrioridad = ESCALA_PRIORIDAD_FALLIDAS.findIndex(p => {
      return p.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim() === estadoEspecifico;
    });

    if (idxPrioridad !== -1) return idxPrioridad;
    return ESCALA_PRIORIDAD_FALLIDAS.length; // Cualquier otra fallida que no esté en la escala
  }

  // Agrupamos las gestiones usando el "Row CSV Original" como llave (firma única)
  const mapaGestiones = {};
  if (dataGestiones && dataGestiones.length > 1 && idxResultadoGestiones !== -1) {
    for (let i = 1; i < dataGestiones.length; i++) {
      let rowGestion = dataGestiones[i];
      // Construimos la porción de row original tal como estaba en el CSV
      let rowOriginal = indicesCSVEnGestiones.map(idx => idx !== -1 ? rowGestion[idx] : "");
      let key = JSON.stringify(rowOriginal);

      if (!mapaGestiones[key]) {
        mapaGestiones[key] = [];
      }
      mapaGestiones[key].push(rowGestion);
    }

    // Ordenamos cada arreglo para que la "Mejor Gestión" quede siempre en la posición 0
    // Ideal para descartar reintentos fallidos en el mismo id_incidencia
    for (let key in mapaGestiones) {
      mapaGestiones[key].sort((a, b) => {
        let scoreA = obtenerScore(a, idxResultadoGestiones, idxEspecificoGestiones);
        let scoreB = obtenerScore(b, idxResultadoGestiones, idxEspecificoGestiones);
        return scoreA - scoreB; // Menor es mejor (-2 > 0 > 1)
      });
    }
  }

  let matchedKeys = new Set(); // Para saber a quiénes emparejamos (y no duplicarlos en huérfanos)

  for (let i = 1; i < dataCSV.length; i++) {
    const rowCSV = dataCSV[i];
    let key = JSON.stringify(rowCSV); // Firma exacta de la fila
    matchedKeys.add(key);

    let arrayGestiones = mapaGestiones[key];

    if (arrayGestiones && arrayGestiones.length > 0) {
      // Tomamos la PRIMERA gestión (que por estar ordenado es la de MAYOR ÉXITO)

      // Así evitamos duplicar la misma gestión 3 veces si la fila no era exactamente igual
      let rowGestion = arrayGestiones.shift();
      let filaConsolidada = [...rowCSV];
      columnasExtra.forEach(col => {
        filaConsolidada.push(rowGestion ? (rowGestion[col.index] || "") : "");
      });
      resultadoFinal.push(filaConsolidada);

      // Las retries fallidas NO se borrarán de mapaGestiones, quedan flotando.
      // Pero no las agregaremos al reporte final para lograr el efecto 'quitar la fallida'.
    } else {
      // Si esta incidencia/fila no tiene gestión vinculada, se queda vacía en esas columnas extra
      let filaConsolidada = [...rowCSV];
      columnasExtra.forEach(col => {
        filaConsolidada.push("");
      });
      resultadoFinal.push(filaConsolidada);
    }
  }

  // Atrapamos aquellas gestiones genuinamente "huérfanas" (filas borradas en el CSV maestro que lograron obtener gestión)
  // Las re-intentos de clientes YA MATCHEADOS (que están vivas en el Set) simplemente se descartan (para que no nazcan "clones fallidos").
  for (let key in mapaGestiones) {
    if (!matchedKeys.has(key) && mapaGestiones[key].length > 0) {
      // Al no estar en matchedKeys, es seguro pushearlas. Agarramos LA MEJOR de ellas.
      let rowGestion = mapaGestiones[key][0];

      let rowOriginal;
      try { rowOriginal = JSON.parse(key); } catch (e) { rowOriginal = new Array(cabeceraCSV.length).fill(""); }

      let filaConsolidada = [...rowOriginal];
      columnasExtra.forEach(col => {
        filaConsolidada.push(rowGestion ? (rowGestion[col.index] || "") : "");
      });
      resultadoFinal.push(filaConsolidada);
    }
  }

  // --- POST-PROCESAMIENTO: ESCALA DE PRIORIDAD ---
  // Averiguar de qué tipo es la campaña
  const campanas = obtenerCampanas();
  const cInfo = campanas.find(c => c.nombre === nombreCampana);
  const tipoAsignacion = cInfo ? cInfo.tipoAsignacion : "Issabel";

  if (tipoAsignacion === "Incidencias" || tipoAsignacion === "ExploracionDuplicados") {
    // Modo Incidencias o Duplicados: Cada registro/incidencia tiene RESPUESTA TOTALMENTE INDIVIDUAL.
    // Como ya deduplicamos múltiples gestiones/reintentos del mismo registro exacto (misma fila CSV) en el arrayGestiones.shift() ordenado arriba, 
    // la lista 'resultadoFinal' ya está pura e individualizada sin cruzar respuestas entre personas diferentes que compartan teléfono.
    return resultadoFinal;
  }

  const idxResultadoFinal = nuevaCabecera.indexOf("Resultado");
  let idxTelFinal = nuevaCabecera.findIndex(h => h.toLowerCase().includes("tel") || h.toLowerCase().includes("cel") || h.toLowerCase() === "id");
  if (idxTelFinal === -1) idxTelFinal = 0;

  let cabeceraFinalNormalizada = nuevaCabecera.map(h => h.toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim());
  let idxEspecificoFinal = cabeceraFinalNormalizada.findIndex(ht => ht === "estado de la llamada especifico");
  if (idxEspecificoFinal === -1) idxEspecificoFinal = cabeceraFinalNormalizada.findIndex(ht => ht.includes("estado") && ht.includes("especifico"));
  if (idxEspecificoFinal === -1) idxEspecificoFinal = cabeceraFinalNormalizada.findIndex(ht => ht.includes("estado") && !ht.includes("resultado") && !ht.includes("sub"));
  if (idxEspecificoFinal === -1) idxEspecificoFinal = cabeceraFinalNormalizada.findIndex(ht => ht.includes("estado"));

  // Agrupar filas finales por número de teléfono
  const agrupadoPorTel = {};
  for (let i = 1; i < resultadoFinal.length; i++) {
    let fila = resultadoFinal[i];
    let tel = fila[idxTelFinal] ? fila[idxTelFinal].toString().trim() : "DESCONOCIDO_" + i;
    if (!agrupadoPorTel[tel]) agrupadoPorTel[tel] = [];
    agrupadoPorTel[tel].push(fila);
  }

  const dataPurificada = [nuevaCabecera];

  for (let tel in agrupadoPorTel) {
    let grupo = agrupadoPorTel[tel];

    // Determinar la MEJOR fila basándose en su score
    let mejorFila = grupo[0];
    let mejorScore = obtenerScore(mejorFila, idxResultadoFinal, idxEspecificoFinal);

    for (let j = 1; j < grupo.length; j++) {
      let scoreActual = obtenerScore(grupo[j], idxResultadoFinal, idxEspecificoFinal);
      // -2 es el rey, luego 0 es superior a 1, 1 a 2, etc. (menor > mayor si >= 0)
      if (scoreActual === -2 && mejorScore !== -2) {
        mejorScore = scoreActual;
        mejorFila = grupo[j];
      } else if (scoreActual >= 0 && (mejorScore === -1 || (mejorScore >= 0 && scoreActual < mejorScore))) {
        mejorScore = scoreActual;
        mejorFila = grupo[j];
      }
    }

    // Para Issabel o Manual: Seleccionar solo 1 fila por teléfono reduciendo duplicidad
    dataPurificada.push(mejorFila);
  }

  return dataPurificada;
}

// --- REPORTE DE REACTIVACIÓN (CONTACTOS FALLIDOS POR ESCALA) ---
function obtenerReporteReactivacion(nombresCampanas) {
  if (!nombresCampanas || nombresCampanas.length === 0) return { error: "No se seleccionaron campañas." };

  const CABECERA_REPORTE = [
    "Campaña", "Fecha/Hora Última Gestión", "Usuario", "Teléfono", "Cédula",
    "Nombre", "Apellido", "Estado de Llamada Específico", "Resultado", "Observaciones"
  ];

  const norm = (s) => (s || "").toString().trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  const getScore = (res, esp) => {
    let r = norm(res);
    let e = norm(esp);
    if (r === "exitosa" || r.includes("answered") || r.includes("contest") || r.includes("efectiv")) return -2;
    if (r === "" && e === "") return -1;
    let idx = ESCALA_PRIORIDAD_FALLIDAS.findIndex(p => norm(p) === e);
    if (idx !== -1) return idx;
    return ESCALA_PRIORIDAD_FALLIDAS.length; // Otra fallida
  };

  const filas = [];

  for (let ci = 0; ci < nombresCampanas.length; ci++) {
    const nombreCampana = nombresCampanas[ci];
    const gestiones = obtenerGestionesCampana(nombreCampana, 0);
    if (!gestiones || gestiones.length < 2) continue;

    const cabeceras = gestiones[0];
    const cabNorm = cabeceras.map(h => norm(h));

    // Índices - Búsqueda más precisa
    let idxResultado = cabNorm.findIndex(h => h === "ESTADO DE LA LLAMADA");
    if (idxResultado === -1) idxResultado = cabNorm.findIndex(h => h === "ESTADO DE LA LLAMADA" || h === "estatus" || h === "resultado");

    let idxEspecifico = cabNorm.findIndex(h => h.includes("especif"));
    if (idxEspecifico === -1) idxEspecifico = cabNorm.findIndex(h => h.includes("detalle") || h.includes("sub"));
    // Si no se encuentra uno específico, y el de resultado es genérico, intentar buscar "estado" que no sea el de resultado
    if (idxEspecifico === -1) {
      idxEspecifico = cabNorm.findIndex((h, i) => i !== idxResultado && (h.includes("estado") || h.includes("llamada")));
    }

    const idxUsuario = cabNorm.findIndex(h => h === "usuario");
    const idxFecha = cabNorm.findIndex(h => h === "fecha");
    const idxTel = cabNorm.findIndex(h => h.includes("tel") || h.includes("cel") || h === "telefono" || h === "id");
    const idxCedula = cabNorm.findIndex(h => h.includes("cedula") || h.includes("cédula") || h.includes("identificacion"));
    const idxNombre = cabNorm.findIndex(h => h === "nombre");
    const idxApellido = cabNorm.findIndex(h => h === "apellido");
    const idxObs = cabNorm.findIndex(h => h.includes("observ"));

    if (idxResultado === -1) continue;

    const porTelefono = {};
    for (let r = 1; r < gestiones.length; r++) {
      const fila = gestiones[r];
      const telVal = idxTel !== -1 ? fila[idxTel] : "";
      const cedVal = idxCedula !== -1 ? fila[idxCedula] : "";

      const idUnico = (telVal || cedVal || "SIN_ID_" + r).toString().trim();
      if (idUnico === "" || idUnico.startsWith("SIN_ID_")) continue;

      const res = fila[idxResultado] || "";
      const esp = idxEspecifico !== -1 ? (fila[idxEspecifico] || "") : "";
      const score = getScore(res, esp);

      // Si no tenemos este teléfono, o el nuevo score es "mejor" (más prioritario o exitoso)
      // O si tienen el mismo score, nos quedamos con el más reciente
      if (!porTelefono[idUnico] || score < porTelefono[idUnico].score) {
        porTelefono[idUnico] = { fila, score, tel: telVal, cedula: cedVal };
      } else if (score === porTelefono[idUnico].score) {
        const fechaN = idxFecha !== -1 ? (fila[idxFecha] || "") : "";
        const fechaA = idxFecha !== -1 ? (porTelefono[idUnico].fila[idxFecha] || "") : "";
        if (fechaN > fechaA) {
          porTelefono[idUnico] = { fila, score, tel: telVal, cedula: cedVal };
        }
      }
    }

    for (let idUnico in porTelefono) {
      const { fila, score, tel, cedula } = porTelefono[idUnico];
      if (score === -2 || score === -1 || score === ESCALA_PRIORIDAD_FALLIDAS.length) continue;

      filas.push({
        campana: nombreCampana,
        fecha: idxFecha !== -1 ? fila[idxFecha] : "",
        usuario: idxUsuario !== -1 ? fila[idxUsuario] : "",
        tel: tel,
        cedula: cedula,
        nombre: idxNombre !== -1 ? fila[idxNombre] : "",
        apellido: idxApellido !== -1 ? fila[idxApellido] : "",
        estadoEsp: idxEspecifico !== -1 ? fila[idxEspecifico] : "",
        resultado: fila[idxResultado],
        obs: idxObs !== -1 ? fila[idxObs] : "",
        priority: score
      });
    }
  }

  filas.sort((a, b) => {
    if (a.campana !== b.campana) return a.campana.localeCompare(b.campana);
    return a.priority - b.priority;
  });

  const resultado = [CABECERA_REPORTE];
  filas.forEach(f => {
    resultado.push([f.campana, f.fecha, f.usuario, f.tel, f.cedula, f.nombre, f.apellido, f.estadoEsp, f.resultado, f.obs]);
  });

  return resultado;
}


function generarReporteAnalisisContactos(nombresCampanas, separarPorPersona, cruzarConBase, intentosIssabel) {
  if (!nombresCampanas || nombresCampanas.length === 0) return { error: "No se seleccionaron campañas" };

  let contactos = {};
  let todasLasFechas = new Set();

  // Mapeo de fechas de inicio de las campañas seleccionadas
  const campanasInfo = obtenerCampanas();
  const mapCampFechas = {};
  campanasInfo.forEach(c => mapCampFechas[c.nombre] = c.fechaInicio || "Sin_Fecha");

  const esExito = (str) => {
    let s = (str || "").toString().trim().toLowerCase();
    return s === "exitosa" || s.includes("answered") || s.includes("contestó") || s.includes("efectiv");
  };

  for (let i = 0; i < nombresCampanas.length; i++) {
    let nombreCampana = nombresCampanas[i];
    let dataGestiones = obtenerGestionesCampana(nombreCampana, 0);

    // Módulos independientes de extración
    if (dataGestiones && dataGestiones.length > 1) {
      let cabeceras = dataGestiones[0].map(h => h.toString().toLowerCase().trim());
      const excluirKeywords = ["comuna", "barrio", "localidad", "municipio", "empresa", "zona", "punto", "gestor"];

      let idxTel = cabeceras.findIndex(h => h.includes("tel") || h.includes("cel") || h === "id");
      let idxNombre = cabeceras.findIndex((h, index) => {
        if (index === idxTel) return false; // Evitar solapamiento con teléfono
        if (excluirKeywords.some(k => h.includes(k))) return false;
        return h.includes("nombre y apellido del responsable sala de gobierno popular") || h.includes("nombre") || h.includes("name") || h.includes("cliente") || h.includes("denunciante") || h.includes("responsable de sala") || h.includes("nombre y apellido") || h.includes("nombre apellido") || h.includes("responsable") || h.includes("Nombre del Vocero");
      });
      let idxCedula = cabeceras.findIndex(h => h.includes("cedula") || h.includes("cédula") || h.includes("dni") || h.includes("documento"));
      let idxResultado = cabeceras.findIndex(h => h === "estado de la llamada");
      let idxFecha = cabeceras.findIndex(h => h === "fecha" || h === "date");
      let idxUsuario = cabeceras.findIndex(h => h === "usuario" || h === "agente" || h === "operator");

      if (idxTel !== -1) {
        for (let j = 1; j < dataGestiones.length; j++) {
          let fila = dataGestiones[j];
          let tId_original = fila[idxTel] ? fila[idxTel].toString().trim() : "";
          if (!tId_original) continue;

          let nom = (idxNombre !== -1 && fila[idxNombre]) ? fila[idxNombre].toString().trim() : "";
          let ced = (idxCedula !== -1 && fila[idxCedula]) ? fila[idxCedula].toString().trim() : "";
          let res = (idxResultado !== -1 && fila[idxResultado]) ? fila[idxResultado].toString().trim() : "";
          let fecCompleta = (idxFecha !== -1 && fila[idxFecha]) ? fila[idxFecha].toString().trim() : "";
          let oper = (idxUsuario !== -1 && fila[idxUsuario]) ? fila[idxUsuario].toString().trim() : "N/A";

          let fecDia = "";
          let ts = 0;
          if (fecCompleta) {
            let sepDate = fecCompleta.split(" ");
            fecDia = sepDate[0]; // Captura solamente YYYY-MM-DD
            let dateObj = new Date(fecCompleta);
            if (!isNaN(dateObj.getTime())) {
              ts = dateObj.getTime();
            }
          }
          if (!fecDia) fecDia = mapCampFechas[nombreCampana] || "Sin_Fecha";
          todasLasFechas.add(fecDia);

          // Determinar la llave maestra
          let key = tId_original;
          if (separarPorPersona) {
            let valDistintivo = ced ? ced : nom;
            key = tId_original + "_" + valDistintivo.toLowerCase().replace(/\s+/g, '');
          }

          if (!contactos[key]) {
            contactos[key] = {
              tIdBase: tId_original,
              nombreOriginal: nom,
              cedulaOriginal: ced,
              ultimoNombre: nom,
              ultimaCedula: ced,
              maxTs: ts,
              campanas: new Set(),
              totalIntentos: 0,
              exitosas: 0,
              fallidas: 0,
              fechaReferencia: mapCampFechas[nombreCampana] || "Sin_Fecha",
              maxTsExito: 0,
              ultimaFechaExitosa: "N/A",
              ultimoOperadorExito: "N/A",
              ultimaCampanaExito: "N/A",
              ultimoResultadoGral: res,
              mejorHoraExito: "N/A",
              fechas: {}
            };
          } else {
            if (!contactos[key].nombreOriginal && nom) contactos[key].nombreOriginal = nom;
            if (!contactos[key].cedulaOriginal && ced) contactos[key].cedulaOriginal = ced;

            // Usar TS para mantener siempre los datos de la Persona con interacción más reciente
            if (ts > contactos[key].maxTs || (ts === 0 && contactos[key].maxTs === 0)) {
              contactos[key].maxTs = ts;
              contactos[key].ultimoResultadoGral = res;
              if (nom) contactos[key].ultimoNombre = nom;
              if (ced) contactos[key].ultimaCedula = ced;
            }
          }

          contactos[key].campanas.add(nombreCampana);
          contactos[key].totalIntentos++;

          let isSuccess = esExito(res);
          if (isSuccess) {
            contactos[key].exitosas++;
            // Actualizar datos del éxito más reciente
            if (ts > (contactos[key].maxTsExito || 0)) {
              contactos[key].maxTsExito = ts;
              contactos[key].ultimaFechaExitosa = fecCompleta;
              contactos[key].ultimoOperadorExito = oper;
              contactos[key].ultimaCampanaExito = nombreCampana;
              if (fecCompleta.includes(":")) {
                let horaPart = fecCompleta.split(" ")[1] || "";
                contactos[key].mejorHoraExito = horaPart ? horaPart.split(":")[0] + ":00" : "N/A";
              }
            }
          } else {
            contactos[key].fallidas++;
          }

          if (!contactos[key].fechas[fecDia]) {
            contactos[key].fechas[fecDia] = { total: 0, exito: 0, fallo: 0 };
          }

          contactos[key].fechas[fecDia].total++;
          if (isSuccess) {
            contactos[key].fechas[fecDia].exito++;
          } else {
            contactos[key].fechas[fecDia].fallo++;
          }
        }
      }
    }

    // Cruce Híbrido: Si se pide auditar la base
    if (cruzarConBase) {
      let dataBase = obtenerDataCampaña(nombreCampana, 0);
      if (dataBase && dataBase.length > 1) {
        let cabBase = dataBase[0].map(h => h.toString().toLowerCase().trim());
        const excluirKeywordsBase = ["comuna", "barrio", "localidad", "municipio", "empresa", "zona", "punto", "gestor"];

        let bTel = cabBase.findIndex(h => h.includes("tel") || h.includes("cel") || h === "id");
        let bNom = cabBase.findIndex((h, index) => {
          if (index === bTel) return false; // Evitar solapamiento con teléfono
          if (excluirKeywordsBase.some(k => h.includes(k))) return false;
          return h.includes("nombre y apellido del responsable sala de gobierno popular") || h.includes("nombre") || h.includes("name") || h.includes("responsable") || h.includes("denunciante") || h.includes("cliente") || h.includes("responsable de sala") || h.includes("nombre y apellido") || h.includes("Nombre del Vocero");
        });
        let bCed = cabBase.findIndex(h => h.includes("cedula") || h.includes("cédula") || h.includes("dni") || h.includes("documento"));

        if (bTel !== -1) {
          for (let k = 1; k < dataBase.length; k++) {
            let baseRow = dataBase[k];
            let rawTel = baseRow[bTel] ? baseRow[bTel].toString().trim() : "";
            if (!rawTel) continue;

            let nomB = (bNom !== -1 && baseRow[bNom]) ? baseRow[bNom].toString().trim() : "";
            let cedB = (bCed !== -1 && baseRow[bCed]) ? baseRow[bCed].toString().trim() : "";

            let kId = rawTel;
            if (separarPorPersona) {
              let distintivo = cedB ? cedB : nomB;
              kId = rawTel + "_" + distintivo.toLowerCase().replace(/\s+/g, '');
            }

            if (!contactos[kId]) {
              contactos[kId] = {
                tIdBase: rawTel,
                nombreOriginal: nomB,
                cedulaOriginal: cedB,
                ultimoNombre: nomB,
                ultimaCedula: cedB,
                maxTs: 0,
                campanas: new Set(),
                totalIntentos: 0,
                exitosas: 0,
                fallidas: 0,
                fechaReferencia: mapCampFechas[nombreCampana] || "Sin_Fecha",
                maxTsExito: 0,
                ultimaFechaExitosa: "N/A",
                ultimoOperadorExito: "N/A",
                ultimaCampanaExito: "N/A",
                ultimoResultadoGral: "Sin Gestión",
                mejorHoraExito: "N/A",
                fechas: {}
              };
            }
            contactos[kId].campanas.add(nombreCampana);
          }
        }
      }
    }

  }

  // Penalización post-loop si estamos en modo Issabel
  if (cruzarConBase && intentosIssabel > 0) {
    for (let key in contactos) {
      let ext = contactos[key];

      // Solo aplicamos la suma "fantasma" a los contactos que NO registran gestiones en Briana
      if (ext.totalIntentos === 0) {
        let difFantasmas = intentosIssabel;
        ext.fallidas += difFantasmas;
        ext.totalIntentos += difFantasmas;

        // Sumarlos a la fecha de referencia de la campaña para que cuadren los detalles
        let fRef = ext.fechaReferencia || "Sin_Fecha";
        todasLasFechas.add(fRef);
        if (!ext.fechas[fRef]) ext.fechas[fRef] = { total: 0, exito: 0, fallo: 0 };

        ext.fechas[fRef].total += difFantasmas;
        ext.fechas[fRef].fallo += difFantasmas;
      }
    }
  }

  let matResumen = [["Campaña(s) Involucradas", "Teléfono/ID", "Cédula Original", "Nombre Original", "Última Cédula Identificada", "Último Nombre Identificado", "Última Fecha Exitosa", "Estado Último Intento", "Operador del Éxito", "Campaña del Éxito", "Días desde Última Gestión", "Recomendación Horaria", "Total Intentos", "Exitosas", "Fallidas", "Efectividad %"]];
  let matDetalle = [["Fecha Día", "Campaña(s) Involucradas", "Teléfono/ID", "Cédula Original", "Nombre Original", "Última Cédula Identificada", "Último Nombre Identificado", "Última Fecha Exitosa", "Estado Último Intento", "Operador del Éxito", "Campaña del Éxito", "Días desde Última Gestión", "Recomendación Horaria", "Intentos del Día", "Exitosas Día", "Fallidas Día", "Efectividad Resumen Histórico"]];

  let listaFechasOrdenadas = Array.from(todasLasFechas).sort();

  for (let key in contactos) {
    let c = contactos[key];
    let camps = Array.from(c.campanas).join(", ");
    let efectividad = c.totalIntentos > 0 ? ((c.exitosas / c.totalIntentos) * 100).toFixed(2) + "%" : "0.00%";

    let msPerDay = 24 * 60 * 60 * 1000;
    let diasTranscurridos = c.maxTs > 0 ? Math.floor((new Date().getTime() - c.maxTs) / msPerDay) : "N/A";
    let recoHora = c.mejorHoraExito !== "N/A" ? "Llamar a las " + c.mejorHoraExito : "Sin datos";

    matResumen.push([
      camps,
      c.tIdBase,
      c.cedulaOriginal,
      c.nombreOriginal,
      c.ultimaCedula,
      c.ultimoNombre,
      c.ultimaFechaExitosa,
      c.ultimoResultadoGral,
      c.ultimoOperadorExito,
      c.ultimaCampanaExito,
      diasTranscurridos,
      recoHora,
      c.totalIntentos,
      c.exitosas,
      c.fallidas,
      efectividad
    ]);

    for (let f of listaFechasOrdenadas) {
      if (c.fechas[f]) {
        matDetalle.push([
          f,
          camps,
          c.tIdBase,
          c.cedulaOriginal,
          c.nombreOriginal,
          c.ultimaCedula,
          c.ultimoNombre,
          c.ultimaFechaExitosa,
          c.ultimoResultadoGral,
          c.ultimoOperadorExito,
          c.ultimaCampanaExito,
          c.maxTs > 0 ? Math.floor((new Date().getTime() - c.maxTs) / (24 * 60 * 60 * 1000)) : "N/A",
          c.mejorHoraExito !== "N/A" ? "Llamar a las " + c.mejorHoraExito : "Sin datos",
          c.fechas[f].total,
          c.fechas[f].exito,
          c.fechas[f].fallo,
          efectividad
        ]);
      }
    }
  }

  // Ordenar para mayor claridad:
  if (matResumen.length > 1) {
    let encR = matResumen.shift();
    matResumen.sort((a, b) => b[12] - a[12]); // Ordenar por 'Total Intentos' descendente (índice 12 ahora)
    matResumen.unshift(encR);
  }

  if (matDetalle.length > 1) {
    let encD = matDetalle.shift();
    matDetalle.sort((a, b) => {
      // a[0] es fecha (YYYY-MM-DD)
      if (a[0] > b[0]) return -1;
      if (a[0] < b[0]) return 1;
      // Si la fecha es igual, ordenar por intentos del día (índice 13 ahora) DESC
      return b[13] - a[13];
    });
    matDetalle.unshift(encD);
  }

  return { exito: true, resumen: matResumen, detalle: matDetalle };
}

// --- NUEVA FUNCIÓN: REPORTE ESTADÍSTICO FILTRADO ---
function obtenerDatosReporteExcel(nombresCampanas, fechaInicio, fechaFin) {
  try {
    if (!nombresCampanas || nombresCampanas.length === 0) return { error: "No se seleccionaron campañas" };

    const fInicio = fechaInicio ? new Date(fechaInicio + "T00:00:00") : null;
    const fFin = fechaFin ? new Date(fechaFin + "T23:59:59") : null;

    let resumenData = {}; // { "Fecha|Campaña|Usuario": { exitosas, fallidas, total } }
    let detalleRows = [];

    const esExitoLocal = (str) => {
      let s = (str || "").toString().trim().toLowerCase();
      return s === "exitosa" || s.includes("answered") || s.includes("contestó") || s.includes("efectiv");
    };

    const esFalloLocal = (str) => {
      let s = (str || "").toString().trim().toLowerCase();
      return (s === "fallida" || s.includes("failed") || s.includes("no answer") || s.includes("abandon") || (s !== "" && !esExitoLocal(s)));
    };

    nombresCampanas.forEach(nombreCampana => {
      const dataGestiones = obtenerGestionesCampana(nombreCampana, 0);
      if (dataGestiones && dataGestiones.length > 1) {
        const cabeceras = dataGestiones[0].map(h => h.toString().toLowerCase().trim());
        const idxResultado = cabeceras.indexOf("resultado");
        const idxFecha = cabeceras.indexOf("fecha");
        const idxUsuario = cabeceras.indexOf("usuario");

        if (idxFecha !== -1 && idxResultado !== -1) {
          for (let i = 1; i < dataGestiones.length; i++) {
            const fila = dataGestiones[i];
            const rawFecha = fila[idxFecha];
            const dateObj = new Date(rawFecha);

            if (isNaN(dateObj.getTime())) continue;

            // Filtrar por rango
            if (fInicio && dateObj < fInicio) continue;
            if (fFin && dateObj > fFin) continue;

            const fechaKey = Utilities.formatDate(dateObj, Session.getScriptTimeZone(), "yyyy-MM-dd");
            const res = fila[idxResultado] ? fila[idxResultado].toString().trim() : "";
            const user = idxUsuario !== -1 ? (fila[idxUsuario] || "N/A") : "N/A";
            const isExito = esExitoLocal(res);
            const isFallo = esFalloLocal(res);

            if (!isExito && !isFallo && res === "") continue;

            // Para Resumen Global (incluimos Usuario en la agrupación)
            const key = fechaKey + "|" + nombreCampana + "|" + user;
            if (!resumenData[key]) resumenData[key] = { exitosas: 0, fallidas: 0, total: 0 };

            if (isExito) resumenData[key].exitosas++;
            else if (isFallo) resumenData[key].fallidas++;
            resumenData[key].total++;

            // Para Detalle
            detalleRows.push([
              Utilities.formatDate(dateObj, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss"),
              nombreCampana,
              user,
              isExito ? "Exitosa" : (isFallo ? "Fallida" : res)
            ]);
          }
        }
      }
    });

    // Formatear Resumen para Excel
    let finalResumen = [["Fecha de Gestión", "Campaña", "Usuario", "Cantidad de Exitosas", "Cantidad de Fallidas", "Total Llamadas", "% Efectividad"]];
    const keys = Object.keys(resumenData).sort();

    keys.forEach(k => {
      const [fecha, campana, usuario] = k.split("|");
      const d = resumenData[k];
      const efectividad = d.total > 0 ? ((d.exitosas / d.total) * 100).toFixed(2) + "%" : "0.00%";
      finalResumen.push([fecha, campana, usuario, d.exitosas, d.fallidas, d.total, efectividad]);
    });

    // Formatear Detalle
    let finalDetalle = [["Fecha de Gestión", "Campaña", "Usuario", "Estado de la Llamada"]].concat(detalleRows);

    return { resumen: finalResumen, detalle: finalDetalle };
  } catch (e) {
    return { error: e.message };
  }
}

// --- AUTO REFRESCO GLOBAL ---
function triggerGlobalRefresh() {
  const timestamp = new Date().getTime().toString();
  PropertiesService.getScriptProperties().setProperty('GLOBAL_REFRESH_TIME', timestamp);
  return timestamp;
}

function checkGlobalRefresh() {
  const time = PropertiesService.getScriptProperties().getProperty('GLOBAL_REFRESH_TIME');
  return time ? time : "0";
}

// --- PANEL DE SUPERVISOR: MÉTRICAS EN TIEMPO REAL ---
function obtenerPanelSupervisor() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const hojaExtensiones = ss.getSheetByName("Extensiones");

    const resultado = {
      operadoresActivos: [],
      campanasActivas: [],
      metricasGlobales: {
        llamadasHoy: 0,
        exitosasHoy: 0,
        fallidasHoy: 0,
        efectividadHoy: 0,
        operadoresConectados: 0
      },
      ultimosRegistros: []
    };

    // 1. Obtener extensiones activas (últimos 5 minutos)
    if (hojaExtensiones) {
      const datosExt = hojaExtensiones.getDataRange().getValues();
      const ahora = new Date();
      const hace5min = new Date(ahora.getTime() - 5 * 60000);

      for (let i = 1; i < datosExt.length; i++) {
        const fechaStr = datosExt[i][2];
        if (fechaStr) {
          const fechaExt = new Date(fechaStr);
          if (fechaExt >= hace5min) {
            if (!resultado.operadoresActivos.find(o => o.usuario === datosExt[i][0])) {
              resultado.operadoresActivos.push({
                usuario: datosExt[i][0],
                extension: datosExt[i][1],
                ultimoAcceso: Utilities.formatDate(fechaExt, Session.getScriptTimeZone(), "HH:mm:ss"),
                turno: datosExt[i][3] || ""
              });
            }
          }
        }
      }
      resultado.metricasGlobales.operadoresConectados = resultado.operadoresActivos.length;
    }

    // 2. Obtener campañas activas
    const campanas = obtenerCampanas().filter(c => c.estatus === "Activa");
    resultado.campanasActivas = campanas.map(c => ({
      nombre: c.nombre,
      tipoAsignacion: c.tipoAsignacion,
      tipoCampana: c.tipoCampana,
      usuarios: c.usuarios
    }));

    // 3. Calcular métricas globales del día
    const fechaHoy = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
    let totalHoy = 0, exitosasHoy = 0, fallidasHoy = 0;

    for (let c of campanas) {
      const gestData = obtenerGestionesCampana(c.nombre, 0);
      if (gestData.length > 1) {
        const idxFecha = gestData[0].findIndex(h => (h || "").toString().toLowerCase().trim() === "fecha");
        const idxResult = gestData[0].findIndex(h => (h || "").toString().toLowerCase().trim() === "resultado");

        if (idxFecha !== -1 && idxResult !== -1) {
          for (let i = 1; i < gestData.length; i++) {
            const fecha = (gestData[i][idxFecha] || "").toString();
            if (fecha.includes(fechaHoy)) {
              totalHoy++;
              const res = (gestData[i][idxResult] || "").toString().toLowerCase().trim();
              if (res === "exitosa" || res.includes("answered") || res.includes("contestó") || res.includes("efectiv")) {
                exitosasHoy++;
              } else if (res === "fallida" || res.includes("failed") || res.includes("no answer") || res.includes("abandon")) {
                fallidasHoy++;
              }
            }
          }
        }
      }
    }

    resultado.metricasGlobales.llamadasHoy = totalHoy;
    resultado.metricasGlobales.exitosasHoy = exitosasHoy;
    resultado.metricasGlobales.fallidasHoy = fallidasHoy;
    resultado.metricasGlobales.efectividadHoy = totalHoy > 0 ? ((exitosasHoy / totalHoy) * 100).toFixed(1) : 0;

    // 4. Últimos registros de gestión (últimas 10 llamadas)
    const hojaGestiones = ss.getSheetByName("Gestiones");
    if (hojaGestiones) {
      const ultimos = hojaGestiones.getDataRange().getValues();
      const start = Math.max(1, ultimos.length - 10);
      for (let i = ultimos.length - 1; i >= start; i--) {
        if (ultimos[i][0]) {
          resultado.ultimosRegistros.push({
            campaña: ultimos[i][0],
            resultado: ultimos[i][1],
            usuario: ultimos[i][2],
            fecha: ultimos[i][3] ? Utilities.formatDate(ultimos[i][3], Session.getScriptTimeZone(), "HH:mm:ss") : ""
          });
        }
      }
    }

    return resultado;
  } catch (e) {
    console.error("Error en obtenerPanelSupervisor: " + e.message);
    return { error: e.message, operadoresActivos: [], campanasActivas: [], metricasGlobales: {} };
  }
}

// --- RANKING DE OPERADORES (DAILY/WEEKLY) ---
function obtenerRankingOperadores(tipo = "daily", fInicioStr = null, fFinStr = null) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const hojaGestiones = ss.getSheetByName("Gestiones");

    if (!hojaGestiones) return { error: "Hoja de gestiones no encontrada", ranking: [] };

    const datos = hojaGestiones.getDataRange().getValues();
    const ahora = new Date();
    const stats = {};

    let fechaInicio = new Date(0);
    let fechaFin = new Date(8640000000000000); // Fecha máxima

    if (tipo === "daily") {
      fechaInicio = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
    } else if (tipo === "weekly") {
      fechaInicio = new Date(ahora.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (tipo === "mensual") {
      fechaInicio = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
    } else if (tipo === "rango") {
      if (fInicioStr) fechaInicio = new Date(fInicioStr + "T00:00:00");
      if (fFinStr) fechaFin = new Date(fFinStr + "T23:59:59");
    } else {
      // historico
      fechaInicio = new Date(0);
    }

    const esExito = (res) => {
      const r = (res || "").toString().toLowerCase().trim();
      return r === "exitosa" || r.includes("answered") || r.includes("contestó") || r.includes("efectiv");
    };

    const esFallo = (res) => {
      const r = (res || "").toString().toLowerCase().trim();
      return r === "fallida" || r.includes("failed") || r.includes("no answer") || r.includes("abandon") || (r !== "" && !esExito(res));
    };

    for (let i = 1; i < datos.length; i++) {
      const fecha = datos[i][3];
      const usuario = (datos[i][2] || "").toString().trim();
      const resultado = datos[i][1];

      if (!fecha || !usuario) continue;

      let fDate = fecha instanceof Date ? fecha : new Date(fecha);

      if (!isNaN(fDate.getTime()) && fDate >= fechaInicio && fDate <= fechaFin) {
        if (!stats[usuario]) {
          stats[usuario] = { exitosas: 0, fallidas: 0, total: 0, campanas: new Set() };
        }

        stats[usuario].total++;
        if (esExito(resultado)) stats[usuario].exitosas++;
        else if (esFallo(resultado)) stats[usuario].fallidas++;

        stats[usuario].campanas.add(datos[i][0]);
      }
    }

    // Convertir a array y ordenar
    const ranking = Object.keys(stats).map(u => {
      const s = stats[u];
      return {
        posicion: 0,
        usuario: u,
        exitosas: s.exitosas,
        fallidas: s.fallidas,
        total: s.total,
        efectividad: s.total > 0 ? ((s.exitosas / s.total) * 100).toFixed(1) : 0,
        campanas: s.campanas.size
      };
    });

    // Ordenar por efectividad descendente, luego por total descendente
    ranking.sort((a, b) => {
      if (b.efectividad !== a.efectividad) return b.efectividad - a.efectividad;
      return b.total - a.total;
    });

    // Asignar posición
    ranking.forEach((r, i) => r.posicion = i + 1);

    return {
      tipo: tipo,
      fechaInicio: Utilities.formatDate(fechaInicio, Session.getScriptTimeZone(), "yyyy-MM-dd"),
      ranking: ranking
    };
  } catch (e) {
    return { error: e.message, ranking: [] };
  }
}

// --- HEATMAP DE MEJORES HORARIOS ---
function obtenerHeatmapHorarios(nombreCampana = null, tipoRango = "historico", fInicioStr = null, fFinStr = null) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const hojaCampanas = ss.getSheetByName("Campañas");
    const hojaGestiones = ss.getSheetByName("Gestiones");

    if (!hojaGestiones) return { error: "Hoja de gestiones no encontrada", heatmap: [] };

    const datos = hojaGestiones.getDataRange().getValues();
    const heatmap = {}; // { "HH": { exitosas: 0, fallidas: 0, total: 0 } }

    // Inicializar 24 horas
    for (let h = 0; h < 24; h++) {
      const hora = h.toString().padStart(2, "0") + ":00";
      heatmap[hora] = { exitosas: 0, fallidas: 0, total: 0 };
    }

    const ahora = new Date();
    let fechaInicio = new Date(0);
    let fechaFin = new Date(8640000000000000);

    if (tipoRango === "daily") {
      fechaInicio = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
    } else if (tipoRango === "weekly") {
      fechaInicio = new Date(ahora.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (tipoRango === "mensual") {
      fechaInicio = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
    } else if (tipoRango === "rango") {
      if (fInicioStr) fechaInicio = new Date(fInicioStr + "T00:00:00");
      if (fFinStr) fechaFin = new Date(fFinStr + "T23:59:59");
    }

    const esExito = (res) => {
      const r = (res || "").toString().toLowerCase().trim();
      return r === "exitosa" || r.includes("answered") || r.includes("contestó") || r.includes("efectiv");
    };

    const esFallo = (res) => {
      const r = (res || "").toString().toLowerCase().trim();
      return r === "fallida" || r.includes("failed") || r.includes("no answer") || r.includes("abandon") || (r !== "" && !esExito(res));
    };

    // Filtrar por campaña solo si se especifica una, de lo contrario tomar histórico general
    let campanasFiltrar = nombreCampana ? new Set([nombreCampana]) : null;

    for (let i = 1; i < datos.length; i++) {
      const campana = datos[i][0];
      const resultado = datos[i][1];
      const fecha = datos[i][3];

      // Filtrar por campaña si aplica
      if (campanasFiltrar && !campanasFiltrar.has(campana)) continue;

      if (fecha) {
        let fDate = fecha instanceof Date ? fecha : new Date(fecha);

        if (!isNaN(fDate.getTime()) && fDate >= fechaInicio && fDate <= fechaFin) {
          let horaStr = null;

          // Intentar procesar como objeto Date de JavaScript (Google Sheets V8)
          if (fDate instanceof Date && !isNaN(fDate.getTime())) {
            horaStr = fDate.getHours().toString().padStart(2, "0") + ":00";
          } else {
            // Fallback para strings (por si fue almacenado o parseado diferente)
            const fechaStr = fecha.toString();
            const horaMatch = fechaStr.match(/(\d{2}):(\d{2}):(\d{2})/);
            if (horaMatch) {
              horaStr = horaMatch[1] + ":00";
            }
          }

          if (horaStr && heatmap[horaStr]) {
            heatmap[horaStr].total++;
            if (esExito(resultado)) heatmap[horaStr].exitosas++;
            else if (esFallo(resultado)) heatmap[horaStr].fallidas++;
          }
        }
      }
    }

    // Convertir a array con efectividad
    const resultado = Object.keys(heatmap).map(hora => {
      const h = heatmap[hora];
      return {
        hora: hora,
        exitosas: h.exitosas,
        fallidas: h.fallidas,
        total: h.total,
        efectividad: h.total > 0 ? ((h.exitosas / h.total) * 100).toFixed(1) : 0
      };
    });

    // Ordenar por hora
    resultado.sort((a, b) => a.hora.localeCompare(b.hora));

    return { heatmap: resultado };
  } catch (e) {
    return { error: e.message, heatmap: [] };
  }
}

// --- SISTEMA DE REINTENTOS AUTOMÁTICOS PROGRAMADOS ---
// configuración: { campana: nombre, habilitado: booleano, reintentos: [{dias: 0-7, estados: []}] }

// Función para obtener configuración de reintentos
function obtenerConfiguracionReintentos(nombreCampana) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let hoja = ss.getSheetByName("ConfigReintentos");

    if (!hoja) {
      hoja = ss.insertSheet("ConfigReintentos");
      hoja.appendRow(["Campaña", "Habilitado", "IntervaloDías", "EstadosParaReintentar", "ÚltimoReintento", "Activo"]);
      hoja.getRange(1, 1, 1, 6).setFontWeight("bold").setBackground("#e2e8f0");
      return { habilitado: false, intervalor: 1, estados: [] };
    }

    const datos = hoja.getDataRange().getValues();
    for (let i = 1; i < datos.length; i++) {
      if (datos[i][0] === nombreCampana) {
        return {
          campana: datos[i][0],
          habilitado: datos[i][1] === true || datos[i][1] === "SI",
          intervaloDias: datos[i][2] || 1,
          estados: datos[i][3] ? datos[i][3].toString().split(",").map(s => s.trim()) : [],
          ultimoReintento: datos[i][4],
          activo: datos[i][5] === true || datos[i][5] === "SI"
        };
      }
    }

    return { habilitado: false, intervaloDias: 1, estados: [] };
  } catch (e) {
    return { error: e.message };
  }
}

// Función para guardar configuración de reintentos
function guardarConfiguracionReintentos(nombreCampana, habilitado, intervaloDias, estados) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let hoja = ss.getSheetByName("ConfigReintentos");

    if (!hoja) {
      hoja = ss.insertSheet("ConfigReintentos");
      hoja.appendRow(["Campaña", "Habilitado", "IntervaloDías", "EstadosParaReintentar", "ÚltimoReintento", "Activo"]);
      hoja.getRange(1, 1, 1, 6).setFontWeight("bold").setBackground("#e2e8f0");
    }

    const datos = hoja.getDataRange().getValues();
    let filaActual = -1;

    for (let i = 1; i < datos.length; i++) {
      if (datos[i][0] === nombreCampana) {
        filaActual = i + 1;
        break;
      }
    }

    const valores = [
      nombreCampana,
      habilitado ? "SI" : "NO",
      intervaloDias || 1,
      estados ? estados.join(", ") : "",
      "",
      habilitado ? "SI" : "NO"
    ];

    if (filaActual === -1) {
      hoja.appendRow(valores);
    } else {
      hoja.getRange(filaActual, 1, 1, 6).setValues([valores]);
    }

    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// Función para ejecutar reintentos programados (para ser llamada por trigger)
function ejecutarReintentosProgramados(nombreCampana) {
  try {
    const config = obtenerConfiguracionReintentos(nombreCampana);
    if (!config.habilitado || !config.activo) {
      return { message: "Reintentos no habilitados para esta campaña" };
    }

    // Obtener la data consolidada con fallidas
    const dataConsolidada = obtenerDataConsolidada(nombreCampana);
    if (!dataConsolidada || dataConsolidada.length < 2) {
      return { message: "No hay datos para procesar" };
    }

    const cabeceras = dataConsolidada[0];
    const idxResultado = cabeceras.indexOf("Resultado");
    const idxEstadoEsp = cabeceras.findIndex(h =>
      (h || "").toString().toLowerCase().includes("estado") &&
      !(h || "").toString().toLowerCase().includes("resultado")
    );

    if (idxResultado === -1) {
      return { error: "No se encuentra columna de resultado" };
    }

    // Filtrar los registros fallidos que califican para reintento
    const aReintentar = [];
    const fechaLimite = new Date();
    fechaLimite.setDate(fechaLimite.getDate() - config.intervaloDias);

    for (let i = 1; i < dataConsolidada.length; i++) {
      const fila = dataConsolidada[i];
      const resultado = (fila[idxResultado] || "").toString().toLowerCase().trim();
      const estadoEsp = idxEstadoEsp !== -1 ? (fila[idxEstadoEsp] || "").toString().trim() : "";

      // Es fallida?
      const esFallida = resultado === "fallida" || resultado.includes("failed") ||
        resultado.includes("no answer") || resultado.includes("abandon");

      if (esFallida && config.estados.length > 0) {
        // Verificar si el estado específico está en la lista de reintento
        const estadoNormalizado = estadoEsp.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const califica = config.estados.some(est =>
          estadoNormalizado.includes(est.toLowerCase().trim())
        );

        if (califica) {
          aReintentar.push({ fila: i, datos: fila });
        }
      }
    }

    return {
      success: true,
      campana: nombreCampana,
      totalReintentos: aReintentar.length,
      registros: aReintentar.slice(0, 100), // Limitar a 100 por ejecución
      config: config
    };
  } catch (e) {
    return { error: e.message };
  }
}

// --- OBTENER ESTADÍSTICAS EN TIEMPO REAL POR CAMPANA ---
function obtenerEstadisticasTiempoReal(nombreCampana) {
  try {
    const conteoGestiones = obtenerConteoGestiones(nombreCampana);
    const conteoData = obtenerConteoDataCampana(nombreCampana);
    const heatmap = obtenerHeatmapHorarios(nombreCampana);

    return {
      campana: nombreCampana,
      gestione_: conteoGestiones,
      dataBase: conteoData,
      heatmap: heatmap.heatmap,
      timestamp: new Date().toISOString()
    };
  } catch (e) {
    return { error: e.message };
  }
}

// ======================================================================
// DASHBOARD ANALÍTICO EJECUTIVO (BATCH PROCESSING)
// ======================================================================
function obtenerDatosDashboard(filtros = { tipo: 'activas' }) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // Inicializar Estructura de Respuesta
    const respuesta = {
      campanas: [],
      listaNombresCampanas: [], // Para poblar el selector
      personal: { activos: 0, enPausa: 0, ausentes: 0, tasaAbsentismo: 0, metaAbsentismo: 5, distribucionTurnos: { mañana: { activos: 0, total: 0 }, tarde: { activos: 0, total: 0 } } },
      kpis: { productividadTotal: 0, cargaPorOperador: 0, efectividadGlobal: 0, operadoresActivos: 0, alertaCarga: false, evolucionTurno: [] },
      tipificaciones: []
    };

    // 1. CAMPAÑAS (Lectura Batch)
    const todasCampanas = obtenerCampanas();
    respuesta.listaNombresCampanas = todasCampanas.map(c => c.nombre).sort();

    let campanasAProcesar = [];
    if (filtros.tipo === 'todas') {
      campanasAProcesar = todasCampanas;
    } else if (filtros.tipo === 'especifica' && filtros.valor) {
      campanasAProcesar = todasCampanas.filter(c => c.nombre === filtros.valor);
    } else {
      campanasAProcesar = todasCampanas.filter(c => c.estatus === "Activa");
    }

    let totalGeneral = 0;
    let efectivasGeneral = 0;

    let evolucionHoras = {};
    for (let h = 0; h < 24; h++) {
      let hh = h < 10 ? '0' + h + ':00' : h + ':00';
      evolucionHoras[hh] = { prod: 0, efec: 0, total: 0 };
    }

    // Diccionario temporal para tipificaciones (SLA / Incidencias)
    let dictTipos = {};
    let opsTrabajandoHoy = new Set();
    const fechaHoyStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");

    campanasAProcesar.forEach(c => {
      // Cargar todas las gestiones para obtener el volumen exacto y tipificaciones correctas
      let dataGest = obtenerGestionesCampana(c.nombre, 0);
      let total = 0, efectivas = 0, fallidas = 0;

      if (dataGest && dataGest.length > 1) {
        let header = dataGest[0];
        // 1. Identificar Columna de Resultado (Métrica Principal)
        let idxResult = header.findIndex(h => (h || "").toString().toLowerCase().trim() === "estado de la llamada");
        if (idxResult === -1) {
          // Si no hay "estado de la llamada", buscar "resultado" o similar
          idxResult = header.findIndex(h => {
            let hl = (h || "").toString().toLowerCase().trim();
            return hl === "resultado" || (hl.includes("resultado") && !hl.includes("final"));
          });
        }
        // Fallback final: si sigue en -1, intentar con "estado" solo si no hay mejores opciones
        if (idxResult === -1) {
          idxResult = header.findIndex(h => (h || "").toString().toLowerCase().trim() === "estado");
        }

        // 2. Identificar Columna de Análisis Específico (Estados Geográficos / Tipificaciones)
        // Priorizamos "estado" (Amazonas, Apure) si no fue usado como resultado
        let idxEstadoEsp = header.findIndex((h, idx) => {
          if (idx === idxResult) return false;
          let hl = (h || "").toString().toLowerCase().trim();
          return hl === "estado" || hl === "ubicación" || hl === "region" || hl === "región" || hl === "departamento";
        });

        // Si no encontramos un estado geográfico explícito, buscamos tipificaciones o el "resultado" sobrante
        if (idxEstadoEsp === -1) {
          idxEstadoEsp = header.findIndex((h, idx) => {
            if (idx === idxResult) return false;
            let hl = (h || "").toString().toLowerCase().trim();
            return hl.includes("estado") || hl.includes("tipificación") || hl === "resultado" || hl.includes("tipifica");
          });
        }

        // 3. Identificar Columna de Duración (para TMR)
        let idxDuracion = header.findIndex(h => {
          let hl = (h || "").toString().toLowerCase().trim();
          return hl.includes("duraci") || hl.includes("tiempo") || hl.includes("tmr");
        });

        let idxFecha = header.findIndex(h => (h || "").toString().toLowerCase() === "fecha");
        let idxUsuario = header.findIndex(h => (h || "").toString().toLowerCase().trim() === "usuario");

        let idxTelGestiones = header.findIndex(h => {
          let hl = (h || "").toString().toLowerCase().trim();
          return hl.includes("tel") || hl.includes("cel") || hl === "id" || hl.includes("cédula") || hl.includes("cedula");
        });
        if (idxTelGestiones === -1) idxTelGestiones = header.length > 4 ? 4 : 0;

        let tipoAsignacion = c.tipoAsignacion || "";
        let unicosSet = new Set();
        let estadoPorId = {};

        // Recorrer registros para métricas
        for (let i = 1; i < dataGest.length; i++) {
          let valId = dataGest[i][idxTelGestiones];
          let keyUnica = valId ? valId.toString().trim() : "FILA_" + i;

          if (tipoAsignacion === 'Incidencias' || tipoAsignacion === 'ExploracionDuplicados') {
            keyUnica = "FILA_" + i;
          }

          unicosSet.add(keyUnica);

          let res = (dataGest[i][idxResult] || "").toString().toLowerCase().trim();
          let isExitosa = (res === "exitosa" || res.includes("answered") || res.includes("contestó") || res.includes("efectiv"));
          let isFallida = (res === "fallida" || res.includes("failed") || res.includes("no answer") || res.includes("abandon") || (!isExitosa && res !== ""));

          if (!estadoPorId[keyUnica]) estadoPorId[keyUnica] = "ninguno";
          if (isExitosa) estadoPorId[keyUnica] = "exitosa";
          else if (isFallida && estadoPorId[keyUnica] !== "exitosa") estadoPorId[keyUnica] = "fallida";

          // Evolución del turno (Mapeo simplificado basado en fecha/hora) y Ops Trabajando
          if (idxFecha !== -1) {
            let fechaGest = (dataGest[i][idxFecha] || "").toString().trim();
            if (fechaGest.includes(fechaHoyStr) && idxUsuario !== -1) {
              let userStr = (dataGest[i][idxUsuario] || "").toString().trim();
              if (userStr) opsTrabajandoHoy.add(userStr);
            }

            let d = new Date(fechaGest);
            if (!isNaN(d)) {
              let h = d.getHours();
              let hh = h < 10 ? '0' + h + ':00' : h + ':00';
              evolucionHoras[hh].total++;
              if (isExitosa) evolucionHoras[hh].efec++;
              evolucionHoras[hh].prod++;
            }
          }

          // Tipificaciones (Módulo 4) - Si la campaña tiene estado específico
          if (idxEstadoEsp !== -1) {
            let estado = (dataGest[i][idxEstadoEsp] || "").toString().trim();
            if (estado) {
              if (!dictTipos[estado]) dictTipos[estado] = { incidenciasAbiertas: 0, tmrSum: 0, moraSum: 0, metaSla: c.sla || 24, unicos: new Set() };

              if (!dictTipos[estado].unicos.has(keyUnica)) {
                dictTipos[estado].unicos.add(keyUnica);
                dictTipos[estado].incidenciasAbiertas++;

                // Métrica Real de Mora Regional
                if (isFallida) dictTipos[estado].moraSum++;

                // Métrica Real de TMR (si existe columna de tiempo)
                if (idxDuracion !== -1) {
                  let dStr = (dataGest[i][idxDuracion] || "0").toString().replace(",", ".");
                  dictTipos[estado].tmrSum += parseFloat(dStr) || 0;
                }
              }
            }
          }
        }

        // Sumarizados deduplicados
        for (let k in estadoPorId) {
          if (estadoPorId[k] === "exitosa") efectivas++;
          else if (estadoPorId[k] === "fallida") fallidas++;
        }
        total = unicosSet.size;
      }

      totalGeneral += total;
      efectivasGeneral += efectivas;

      respuesta.campanas.push({
        nombre: c.nombre,
        totalContactos: total,
        efectivos: efectivas,
        fallidos: fallidas,
        tasaEfectividad: total > 0 ? parseFloat(((efectivas / total) * 100).toFixed(1)) : 0,
        meta: parseFloat(c.meta) || 80,
        estado: "Activa"
      });
    });

    // 2. PERSONAL (Lectura Batch de Extensiones y Usuarios)
    const usuarios = obtenerTodosLosUsuarios();
    const hojaExtensiones = ss.getSheetByName("Extensiones");

    let opsActivos = 0;

    if (hojaExtensiones) {
      const extData = hojaExtensiones.getDataRange().getValues();
      const ahora = new Date();
      const hace10min = new Date(ahora.getTime() - 10 * 60000);

      for (let i = 1; i < extData.length; i++) {
        const fechaStr = extData[i][2];
        if (fechaStr) {
          const fUlt = new Date(fechaStr);
          if (fUlt >= hace10min) opsActivos++;
        }
      }
    }

    // Si no hay activos ahora, usamos los que trabajaron hoy para promedios
    let divisorOps = Math.max(opsActivos, opsTrabajandoHoy.size);
    if (divisorOps === 0) divisorOps = 1; // Fallback para evitar / 0

    usuarios.forEach(u => {
      let t = (u.turno || "").toLowerCase();
      if (t.includes('mañana')) respuesta.personal.distribucionTurnos.mañana.total++;
      if (t.includes('tarde')) respuesta.personal.distribucionTurnos.tarde.total++;
    });

    respuesta.personal.activos = opsActivos;
    respuesta.personal.enPausa = Math.floor(opsActivos * 0.15); // Estimado para dashboard
    respuesta.personal.ausentes = usuarios.length - opsActivos - respuesta.personal.enPausa;

    if (respuesta.personal.ausentes < 0) respuesta.personal.ausentes = 0;
    respuesta.personal.tasaAbsentismo = parseFloat(((respuesta.personal.ausentes / usuarios.length) * 100).toFixed(1)) || 0;

    // Repartir activos por turno (simplificación)
    respuesta.personal.distribucionTurnos.mañana.activos = Math.floor(opsActivos * 0.6);
    respuesta.personal.distribucionTurnos.tarde.activos = opsActivos - respuesta.personal.distribucionTurnos.mañana.activos;

    // 3. KPIs CONSOLIDADOS
    respuesta.kpis.productividadTotal = Math.floor(totalGeneral / divisorOps);
    respuesta.kpis.efectividadGlobal = totalGeneral > 0 ? parseFloat(((efectivasGeneral / totalGeneral) * 100).toFixed(1)) : 0;
    respuesta.kpis.operadoresActivos = opsActivos;
    respuesta.kpis.cargaPorOperador = Math.floor((totalGeneral * 1.5) / divisorOps); // factor carga
    respuesta.kpis.alertaCarga = respuesta.kpis.cargaPorOperador > 150;

    Object.keys(evolucionHoras).forEach(h => {
      let obj = evolucionHoras[h];
      respuesta.kpis.evolucionTurno.push({
        hora: h,
        productividad: obj.prod,
        efectividad: obj.total > 0 ? Math.round((obj.efec / obj.total) * 100) : 0
      });
    });

    // 4. TIPIFICACIONES (SLA)
    Object.keys(dictTipos).forEach(k => {
      let v = dictTipos[k];
      let tmr = parseFloat((v.tmrSum / v.incidenciasAbiertas).toFixed(1));
      let tasaMora = parseFloat(((v.moraSum / v.incidenciasAbiertas) * 100).toFixed(1));
      respuesta.tipificaciones.push({
        entidad: k,
        incidenciasAbiertas: v.incidenciasAbiertas,
        tiempoMedioResolucion: tmr,
        tasaMora: tasaMora,
        estadoSLA: tmr <= v.metaSla ? "Cumple" : "Breach"
      });
    });

    // Sort tipificaciones by volume
    respuesta.tipificaciones.sort((a, b) => b.incidenciasAbiertas - a.incidenciasAbiertas);
    respuesta.tipificaciones = respuesta.tipificaciones.slice(0, 10); // Top 10

    return respuesta;
  } catch (e) {
    return { error: "Dashboard Backend Error: " + e.message };
  }
}

/**
 * Ejecute esta función desde el Editor de GAS para resetear la memoria de hoy.
 */
function DEBUG_limpiarCacheHoy() {
  const props = PropertiesService.getScriptProperties();
  const timezone = Session.getScriptTimeZone();
  const hoyStr = Utilities.formatDate(new Date(), timezone, "yyyy-MM-dd");

  // 1. Limpiar el índice de campañas activas de hoy
  props.deleteProperty("CAMPANAS_ACTIVAS_" + hoyStr);

  // 2. Opcional: Limpiar metadatos de formularios (si hizo cambios estructurales)
  const todasKeys = props.getKeys();
  todasKeys.forEach(key => {
    if (key.startsWith("METADATA_")) {
      props.deleteProperty(key);
    }
  });

  console.log("Sistema Briana: Caché de hoy y metadatos reseteados con éxito.");
}
