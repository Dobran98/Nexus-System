/**
 * ======================================================================
 * ORIANA — SISTEMA DE GESTIÓN
 * Backend: Dashboards y Generación de Reportes (Reports.js)
 * ======================================================================
 */

// ─── DASHBOARD Y REPORTES ────────────────────────────────────────────────────

/**
 * Obtiene la lista de usuarios para los selectores del frontend, usando la caché de usuarios.
 */
function obtenerListaUsuarios() {
  try {
    const data = obtenerDatosUsuariosCached();
    const users = [];
    for (let i = 1; i < data.length; i++) {
      if (data[i][0]) {
        users.push({
          usuario: String(data[i][0]).trim(),
          nombre: String(data[i][2]).trim() || String(data[i][0]).trim()
        });
      }
    }
    return users.sort((a, b) => a.nombre.localeCompare(b.nombre));
  } catch (e) {
    console.error("Error en obtenerListaUsuarios: " + e);
    return [];
  }
}

function obtenerDatosDashboard(f1, f2, usuario) {
  const ss = getSpreadsheet();
  const hoja = ss.getSheetByName(NOMBRE_HOJA_REGISTROS);
  if (!hoja) return { datos: [], totalEfec: 0, totalTot: 0, variablesTotales: [] };

  const data = hoja.getDataRange().getValues();
  const d1 = new Date(f1 + "T00:00:00");
  const d2 = new Date(f2 + "T23:59:59");

  const map = {};
  const mapVars = {};
  let totalEfec = 0;
  let totalTot = 0;

  for (let i = 1; i < data.length; i++) {
    const fd = new Date(data[i][2]);
    if (fd >= d1 && fd <= d2) {
      const uName = String(data[i][3]).toLowerCase();
      if (usuario === "TODOS" || uName === usuario.toLowerCase()) {
        const modo = String(data[i][4]).trim().toUpperCase();
        const efec = parseInt(data[i][6]) || 0;
        const tot = parseInt(data[i][7]) || 0;

        if (!map[modo]) map[modo] = { efectivas: 0, totales: 0 };
        map[modo].efectivas += efec;
        map[modo].totales += tot;
        totalEfec += efec;
        totalTot += tot;

        const vars = parseVariables(data[i][13]);
        Object.keys(vars).forEach(k => {
          const num = parseFloat(vars[k]);
          if (isNaN(num)) return;
          mapVars[k] = (mapVars[k] || 0) + num;
        });
      }
    }
  }

  const arr = Object.keys(map)
    .map(k => ({ modo: k, efectivas: map[k].efectivas, totales: map[k].totales }))
    .sort((a, b) => b.efectivas - a.efectivas);

  const variablesTotales = Object.keys(mapVars)
    .map(k => ({ variable: k, etiqueta: obtenerEtiquetaVariable(k) || k, total: mapVars[k] }))
    .sort((a, b) => b.total - a.total);

  return { datos: arr, totalEfec, totalTot, variablesTotales };
}

function generarReporteXLSX(f1, f2, fm) {
  const ss = getSpreadsheet();
  const h = ss.getSheetByName(NOMBRE_HOJA_REGISTROS);
  if (!h) return { success: false, message: "No existe la hoja de registros." };
  const data = h.getDataRange().getValues();
  const d1 = new Date(f1 + "T00:00:00");
  const d2 = new Date(f2 + "T23:59:59");

  // Descubrir variables dinámicas presentes en el rango
  const varCols = [];   // [{ key, etiqueta }]
  const filas = [];   // [{ idx, vars }]

  for (let i = 1; i < data.length; i++) {
    const fd = new Date(data[i][2]);
    if (fd >= d1 && fd <= d2) {
      if (fm !== "TODOS" && String(data[i][4]) !== fm) continue;
      const vars = parseVariables(data[i][13]);
      filas.push({ idx: i, vars });
      Object.keys(vars).forEach(k => {
        if (!varCols.some(v => v.key === k)) {
          varCols.push({ key: k, etiqueta: obtenerEtiquetaVariable(k) || k });
        }
      });
    }
  }

  const header = ["ID", "Fecha", "Usuario", "Modo", "Actividad/Campaña",
    "Efectivas/Evaluaciones", "Totales", "Incidencias",
    "Estados", "Detalle/Muni", "V.Ef", "V.Inc"];
  varCols.forEach(v => header.push(v.etiqueta));

  const out = [header];

  filas.forEach(f => {
    const r = data[f.idx];
    const row = [r[0], r[2], r[3], r[4], r[5], r[6], r[7], r[8], r[9], r[10], r[11], r[12]];
    varCols.forEach(v => row.push(f.vars[v.key] !== undefined ? f.vars[v.key] : ""));
    out.push(row);
  });

  // Fila de totalización (variables separadas + total unificado)
  if (filas.length > 0) {
    const tot = ["TOTALES", "", "", "", "", "", "", "", "", "", "", ""];
    tot[5] = filas.reduce((a, f) => a + (parseInt(data[f.idx][6]) || 0), 0);
    tot[6] = filas.reduce((a, f) => a + (parseInt(data[f.idx][7]) || 0), 0);
    tot[7] = filas.reduce((a, f) => a + (parseInt(data[f.idx][8]) || 0), 0);
    varCols.forEach(v => {
      const s = filas.reduce((a, f) => {
        const val = parseFloat(f.vars[v.key]);
        return a + (isNaN(val) ? 0 : val);
      }, 0);
      tot.push(s);
    });
    out.push(tot);
  }

  const t = SpreadsheetApp.create("Temp_Export");
  t.getSheets()[0].getRange(1, 1, out.length, out[0].length).setValues(out);
  SpreadsheetApp.flush();
  const url = `https://docs.google.com/spreadsheets/d/${t.getId()}/export?format=xlsx`;
  const b = UrlFetchApp.fetch(url, {
    headers: { Authorization: "Bearer " + ScriptApp.getOAuthToken() }
  }).getBlob();
  DriveApp.getFileById(t.getId()).setTrashed(true);

  return { success: true, base64: Utilities.base64Encode(b.getBytes()), filename: "Reporte.xlsx" };
}

function generarReporteWord(f1, f2, tipo) {
  const ss = getSpreadsheet();
  const hojaReg = ss.getSheetByName(NOMBRE_HOJA_REGISTROS);
  if (!hojaReg) return { success: false, message: "Faltan hojas de base de datos." };

  // Optimización: Usar caché para obtener datos de usuarios
  const dataUsu = obtenerDatosUsuariosCached();
  const dictUsu = {};
  for (let i = 1; i < dataUsu.length; i++) {
    const uKey = String(dataUsu[i][0]).trim().toLowerCase();
    const rawT = dataUsu[i][4];
    dictUsu[uKey] = {
      nombre: dataUsu[i][2] || dataUsu[i][0],
      turno: (rawT !== undefined && String(rawT).trim() !== "")
        ? String(rawT).trim().toUpperCase() : "MAÑANA"
    };
  }

  const dataReg = hojaReg.getDataRange().getValues();
  const d1 = new Date(f1 + "T00:00:00");
  const d2 = new Date(f2 + "T23:59:59");

  const resumenGeneral = {};
  const resumenPorModo = {};
  const resumenPorOp = {};

  const asegurarVars = obj => { if (!obj.vars) obj.vars = {}; return obj.vars; };

  for (let i = 1; i < dataReg.length; i++) {
    const fd = new Date(dataReg[i][2]);
    if (fd >= d1 && fd <= d2) {
      const uKey = String(dataReg[i][3]).trim().toLowerCase();
      const modo = String(dataReg[i][4]).trim().toUpperCase();
      const efec = parseInt(dataReg[i][6]) || 0;
      const tot = parseInt(dataReg[i][7]) || 0;
      const inc = parseInt(dataReg[i][8]) || 0;

      if (!resumenGeneral[modo]) resumenGeneral[modo] = { efectivas: 0, totales: 0, incidencias: 0, vars: {} };
      if (!resumenPorModo[modo]) resumenPorModo[modo] = {};
      if (!resumenPorModo[modo][uKey]) resumenPorModo[modo][uKey] = { efectivas: 0, totales: 0, incidencias: 0, vars: {} };
      if (!resumenPorOp[uKey]) resumenPorOp[uKey] = {};
      if (!resumenPorOp[uKey][modo]) resumenPorOp[uKey][modo] = { efectivas: 0, totales: 0, incidencias: 0, vars: {} };

      resumenGeneral[modo].efectivas += efec;
      resumenGeneral[modo].totales += tot;
      resumenGeneral[modo].incidencias += inc;
      resumenPorModo[modo][uKey].efectivas += efec;
      resumenPorModo[modo][uKey].totales += tot;
      resumenPorModo[modo][uKey].incidencias += inc;
      resumenPorOp[uKey][modo].efectivas += efec;
      resumenPorOp[uKey][modo].totales += tot;
      resumenPorOp[uKey][modo].incidencias += inc;

      const vars = parseVariables(dataReg[i][13]);
      Object.keys(vars).forEach(k => {
        const num = parseFloat(vars[k]);
        if (isNaN(num)) return;
        const gV = asegurarVars(resumenGeneral[modo]);
        const mV = asegurarVars(resumenPorModo[modo][uKey]);
        const oV = asegurarVars(resumenPorOp[uKey][modo]);
        gV[k] = (gV[k] || 0) + num;
        mV[k] = (mV[k] || 0) + num;
        oV[k] = (oV[k] || 0) + num;
      });
    }
  }

  let titulo, nombreArchivo;
  if (tipo === 1) { titulo = "Reporte General"; nombreArchivo = `Reporte_General_${f1}_al_${f2}.doc`; }
  else if (tipo === 2) { titulo = "Reporte General por Modo"; nombreArchivo = `Reporte_General_Modos_${f1}_al_${f2}.doc`; }
  else { titulo = "Reporte General por Operadores"; nombreArchivo = `Reporte_General_Operadores_${f1}_al_${f2}.doc`; }

  let html = `<html xmlns:o='urn:schemas-microsoft-com:office:office'
    xmlns:w='urn:schemas-microsoft-com:office:word'
    xmlns='http://www.w3.org/TR/REC-html40'>
    <head><meta charset="utf-8"><title>${titulo}</title></head>
    <body style="font-family: Arial, sans-serif;">
    <div style="text-align:center; margin-bottom:30px;">
      <h2><b><i>${titulo}</i></b></h2>
      <p style="font-size:14px;">en el rango de fecha ${f1} al ${f2}.</p>
    </div>`;

  const modosOrdenados = Object.keys(resumenGeneral).sort();
  if (modosOrdenados.length === 0) {
    html += `<p style="text-align:center;">No hay registros para este rango de fechas.</p></body></html>`;
    return { success: true, base64: Utilities.base64Encode(Utilities.newBlob(html).getBytes()), filename: nombreArchivo };
  }

  const lineasVariables = d => {
    if (!d.vars || Object.keys(d.vars).length === 0) return "";
    let txt = "";
    Object.keys(d.vars).sort().forEach(k => {
      txt += `<li>${obtenerEtiquetaVariable(k) || k}: <b>${d.vars[k]}</b></li>`;
    });
    return txt;
  };

  const armarLinea = (m, d) => {
    const isCuali = m.includes("ANALISTA") || m.includes("CUALITATIV");
    const tieneVars = d.vars && Object.keys(d.vars).length > 0;
    let txt = `<li style="margin-bottom:10px; font-size:14px;"><b>Modo: ${m}</b>
               <ul style="padding-left:20px; margin-top:3px;">`;
    if (tieneVars) {
      txt += lineasVariables(d);
      if (d.efectivas > 0) txt += `<li>Total Actividades/Efectivas (unificado): <b>${d.efectivas}</b></li>`;
    } else if (isCuali) {
      txt += `<li>Actividades Realizadas: <b>${d.efectivas}</b></li>
              <li>Datos Analizados Totales: <b>${d.totales}</b></li>`;
    } else {
      txt += `<li>Llamadas Efectivas: <b>${d.efectivas}</b></li>
              <li>Llamadas Totales: ${d.totales}</li>`;
      if (d.incidencias > 0) txt += `<li>Incidencias Totales: ${d.incidencias}</li>`;
    }
    txt += `</ul></li>`;
    return txt;
  };

  if (tipo === 1) {
    let gE = 0, gT = 0;
    html += `<ul style="list-style-type:none; padding-left:10px;">`;
    modosOrdenados.forEach(m => {
      gE += resumenGeneral[m].efectivas;
      gT += resumenGeneral[m].totales;
      html += armarLinea(m, resumenGeneral[m]);
    });
    html += `</ul><br><div style="border-top:2px solid #000; padding-top:10px; margin-top:20px;">
      <p style="font-size:16px; margin:5px 0;"><b>General total efectivas/actividades: ${gE}</b></p>
      <p style="font-size:16px; margin:5px 0;"><b>General total llamadas/datos procesados: ${gT}</b></p>
    </div>`;
  } else if (tipo === 2) {
    modosOrdenados.forEach(m => {
      html += `<h3 style="color:#1e40af; margin-bottom:10px; border-bottom:1px solid #ccc; padding-bottom:3px;">Modo: ${m}</h3>
               <ul style="list-style-type:none; padding-left:15px; margin-top:0;">`;
      const isCuali = m.includes("ANALISTA") || m.includes("CUALITATIV");
      Object.keys(resumenPorModo[m]).sort().forEach(uKey => {
        const ud = dictUsu[uKey] || { nombre: uKey.toUpperCase() };
        const d = resumenPorModo[m][uKey];
        const tieneVars = d.vars && Object.keys(d.vars).length > 0;
        html += `<li style="margin-bottom:15px; font-size:14px;"><b>Operador: ${ud.nombre}</b>
                   <ul style="padding-left:20px; margin-top:3px;">`;
        if (tieneVars) {
          html += lineasVariables(d);
          if (d.efectivas > 0) html += `<li>Total Actividades/Efectivas (unificado): <b>${d.efectivas}</b></li>`;
        } else if (isCuali) {
          html += `<li>Actividades Realizadas: <b>${d.efectivas}</b></li>
                   <li>Datos Analizados Totales: <b>${d.totales}</b></li>`;
        } else {
          html += `<li>Llamadas Efectivas: <b>${d.efectivas}</b></li>
                   <li>Llamadas Totales: ${d.totales}</li>`;
          if (d.incidencias > 0) html += `<li>Incidencias: ${d.incidencias}</li>`;
        }
        html += `</ul></li>`;
      });
      html += `</ul><br>`;
    });
  } else {
    Object.keys(resumenPorOp).sort().forEach(uKey => {
      const ud = dictUsu[uKey] || { nombre: uKey.toUpperCase(), turno: "No especificado" };
      html += `<div style="margin-bottom:25px;">
        <h3 style="color:#1e40af; margin-bottom:10px; border-bottom:1px solid #ccc; padding-bottom:3px;">
          Operador: ${ud.nombre} — Turno: ${ud.turno}
        </h3>
        <ul style="list-style-type:none; padding-left:15px; margin-top:0;">`;
      Object.keys(resumenPorOp[uKey]).sort().forEach(m => {
        html += armarLinea(m, resumenPorOp[uKey][m]);
      });
      html += `</ul></div>`;
    });
  }

  html += `</body></html>`;
  return {
    success: true,
    base64: Utilities.base64Encode(Utilities.newBlob(html).getBytes()),
    filename: nombreArchivo
  };
}

/**
 * Crea o refresca dinámicamente las hojas de cálculo POR MODO DE TRABAJO.
 * En lugar de organizar hojas por indicador macro, cada MODO DE TRABAJO
 * (ej. Llamadas, ISSABEL, 1x10, ANALISTA) posee su propia hoja dedicada en el Spreadsheet
 * y opcionalmente en Google Drive (carpeta ORIANA_Modos_Trabajo).
 *
 * Los indicadores y variables de evaluación se configuran como COLUMNAS
 * dentro de la hoja de cada modo, junto con todos los datos correspondientes:
 * ID_Operador, Fecha, Hora, Nombre y Apellido, Usuario, Turno, Modo,
 * Campaña / Actividad, [Columnas de Indicadores / Variables], Estados,
 * Municipios / Detalle, (Admin) Efectivas, (Admin) Incidencias, Total.
 */
function actualizarHojasPorModo() {
  const ss      = getSpreadsheet();
  const hojaReg = ss.getSheetByName(NOMBRE_HOJA_REGISTROS);
  const data = hojaReg ? hojaReg.getDataRange().getValues() : [];

  // Diccionario usuario -> nombre completo y turno
  const dictNombres = {};
  const dictTurnos  = {};
  const dictTurnos = {};
  try {
    const dataUsu = obtenerDatosUsuariosCached();
    for (let i = 1; i < dataUsu.length; i++) {
      const uKey = String(dataUsu[i][0]).trim().toLowerCase();
      dictNombres[uKey] = String(dataUsu[i][2] || dataUsu[i][0]).trim();
      dictTurnos[uKey]  = String(dataUsu[i][4] || "MAÑANA").trim().toUpperCase();
      dictTurnos[uKey] = String(dataUsu[i][4] || "MAÑANA").trim().toUpperCase();
    }
  } catch (e) {
    console.error("Error leyendo usuarios para hojas por modo: " + e);
  }

  const tz = (typeof Session !== "undefined" && Session.getScriptTimeZone) ? Session.getScriptTimeZone() : "America/Caracas";

  // Recolectar modos únicos presentes en los registros y en la configuración
  const modosSet = new Set();
  for (let i = 1; i < data.length; i++) {
    const m = String(data[i][4] || "").trim();
    if (m) modosSet.add(m);
  }
  try {
    const cfgHojas = (typeof obtenerConfiguracionCached === "function") ? obtenerConfiguracionCached() : null;
    if (cfgHojas && typeof cfgHojas === "object") {
      Object.keys(cfgHojas).forEach(m => {
        if (m && m.trim()) modosSet.add(m.trim());
      });
    }
  } catch (e) {}

  if (modosSet.size === 0) {
    return { success: true, message: "No hay modos de trabajo registrados para generar hojas." };
  }

  let procesados = 0;
  let carpetaRaizDrive = null;
  try {
    carpetaRaizDrive = obtenerCarpetaRaizModos();
  } catch (e) {
    console.warn("DriveApp no disponible o sin permisos para carpeta Drive: " + e);
  }

  modosSet.forEach(modo => {
    // 1. Obtener o crear la hoja dinámica en el Google Spreadsheet actual
    const { hoja, cabeceras, indicadores } = getOrCreateHojaModo(ss, modo);

    // 2. Filtrar filas de BD_Registros que pertenecen a este modo
    const filas = [cabeceras];
    for (let i = 1; i < data.length; i++) {
      const mRow = String(data[i][4] || "").trim().toUpperCase();
      if (mRow !== modo.toUpperCase()) continue;

      const uKey = String(data[i][3] || "").trim().toLowerCase();
      const nombreCompleto = dictNombres[uKey] || String(data[i][3] || "").trim();
      const turno = dictTurnos[uKey] || "MAÑANA";
      const fecha = (data[i][2] instanceof Date)
        ? Utilities.formatDate(data[i][2], tz, "yyyy-MM-dd")
        : String(data[i][2] || "").substring(0, 10);
      const hora = (data[i][1] instanceof Date)
        ? Utilities.formatDate(data[i][1], tz, "HH:mm")
        : "";

      const vars = parseVariables(data[i][13]);
      const efVal  = parseInt(data[i][6]) || 0;
      const totVal = parseInt(data[i][7]) || 0;
      const incVal = parseInt(data[i][8]) || 0;

      // Columnas base
      const row = [
        data[i][0] || "S/ID",
        fecha,
        hora,
        String(nombreCompleto).toUpperCase(),
        String(data[i][3] || "").toUpperCase(),
        String(turno).toUpperCase(),
        modo,
        data[i][5] || ""
      ];

      // Indicadores y variables configurados como columnas
      let sumaInd = 0;
      indicadores.forEach(ind => {
        let val = "";
        if (vars[ind.key] !== undefined) {
          val = vars[ind.key];
          const num = parseFloat(val);
          if (!isNaN(num)) sumaInd += num;
        } else if (ind.key === "efectivas") {
          val = efVal;
          sumaInd += efVal;
        } else if (ind.key === "totales") {
          val = totVal;
        } else if (ind.key === "incidencias") {
          val = incVal;
        }
        row.push(val);
      });

      // Estados, municipios, admin val, total
      row.push(
        data[i][9] || "",
        data[i][10] || "",
        data[i][11] || "",
        data[i][12] || "",
        sumaInd > 0 ? sumaInd : efVal
      );

      filas.push(row);
    }

    // 3. Volcar datos en la hoja del modo del Spreadsheet principal
    hoja.clear();
    const ncols = cabeceras.length;
    if (filas.length === 1) {
      hoja.getRange(1, 1, 1, ncols).setValues([cabeceras]);
    } else {
      hoja.getRange(1, 1, filas.length, ncols).setValues(filas);
    }
    try {
      hoja.getRange(1, 1, 1, ncols)
        .setFontWeight("bold")
        .setBackground("#1e40af")
        .setFontColor("#ffffff");
      hoja.setFrozenRows(1);
    } catch (e) {}

    // 4. Sincronizar también con archivo individual en Google Drive si está disponible
    if (carpetaRaizDrive) {
      try {
        const ssDrive = getOrCreateArchivoModo(carpetaRaizDrive, modo);
        const hojaDrive = ssDrive.getSheets()[0];
        hojaDrive.clear();
        if (filas.length === 1) {
          hojaDrive.getRange(1, 1, 1, ncols).setValues([cabeceras]);
        } else {
          hojaDrive.getRange(1, 1, filas.length, ncols).setValues(filas);
        }
        hojaDrive.getRange(1, 1, 1, ncols)
          .setFontWeight("bold")
          .setBackground("#1e40af")
          .setFontColor("#ffffff");
        hojaDrive.setFrozenRows(1);
      } catch (driveErr) {
        console.warn("Aviso al guardar archivo en Drive para modo " + modo + ": " + driveErr);
      }
    }

    try {
      hoja.getRange(1, 1, 1, ncols)
        .setFontWeight("bold")
        .setBackground("#1e40af")
        .setFontColor("#ffffff");
      hoja.setFrozenRows(1);
    } catch (e) { }

    // 4. Sincronizar también con archivo individual en Google Drive si está disponible
    if (carpetaRaizDrive) {
      try {
        const ssDrive = getOrCreateArchivoModo(carpetaRaizDrive, modo);
        const hojaDrive = ssDrive.getSheets()[0];
        hojaDrive.clear();
        if (filas.length === 1) {
          hojaDrive.getRange(1, 1, 1, ncols).setValues([cabeceras]);
        } else {
          hojaDrive.getRange(1, 1, filas.length, ncols).setValues(filas);
        }
        hojaDrive.getRange(1, 1, 1, ncols)
          .setFontWeight("bold")
          .setBackground("#1e40af")
          .setFontColor("#ffffff");
        hojaDrive.setFrozenRows(1);
      } catch (driveErr) {
        console.warn("Aviso al guardar archivo en Drive para modo " + modo + ": " + driveErr);
      }
    }

    procesados++;
  });

  return {
    success: true,
    message: `Hojas dinámicas por modo de trabajo actualizadas (${procesados} modos). Indicadores configurados como columnas.`
  };
}

/**
 * Alias de compatibilidad: redirige llamadas anteriores hacia la creación dinámica por modo.
 */
function actualizarArchivosIndicadores() {
  return actualizarHojasPorModo();
}

// ─── HELPERS DE CARPETAS Y ARCHIVOS EN DRIVE POR MODO ─────────────────────────

function obtenerCarpetaRaizModos() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty("DRIVE_MODOS_ROOT") || props.getProperty("DRIVE_INDICADORES_ROOT");
  if (id) {
    try { return DriveApp.getFolderById(id); } catch (e) { }
  }
  const carpeta = DriveApp.createFolder("ORIANA_Modos_Trabajo");
  props.setProperty("DRIVE_MODOS_ROOT", carpeta.getId());
  return carpeta;
}

function getOrCreateFolder(parent, nombre) {
  const it = parent.getFoldersByName(nombre);
  if (it.hasNext()) return it.next();
  return parent.createFolder(nombre);
}

function getOrCreateArchivoModo(carpetaRaiz, nombreModo) {
  const nombreLimpio = String(nombreModo || "GENERAL").trim().replace(/[:\/?*\[\]]/g, "_");
  const nombreArchivo = `Modo_${nombreLimpio}`;
  const it = carpetaRaiz.getFilesByName(nombreArchivo);
  while (it.hasNext()) {
    const f = it.next();
    if (f.getMimeType() === MimeType.GOOGLE_SHEETS) {
      return SpreadsheetApp.openById(f.getId());
    }
  }
  const ss = SpreadsheetApp.create(nombreArchivo);
  const file = DriveApp.getFileById(ss.getId());
  carpetaRaiz.addFile(file);
  DriveApp.getRootFolder().removeFile(file);
  return ss;
}

// ─── REPORTES CONSOLIDADOS PROGRAMADOS (DIARIO / SEMANAL) ─────────────────────

/**
 * Construye el texto consolidado (resumen por modo y por variable) para un rango de fechas.
 */
function construirMensajeConsolidado(f1, f2, tituloFreq) {
  const ss = getSpreadsheet();
  const hoja = ss.getSheetByName(NOMBRE_HOJA_REGISTROS);
  if (!hoja) return "📭 Sin registros disponibles.";

  const data = hoja.getDataRange().getValues();
  const d1 = new Date(f1 + "T00:00:00");
  const d2 = new Date(f2 + "T23:59:59");

  const porModo = {};
  const porVar = {};
  let totalEfec = 0, totalTot = 0;

  for (let i = 1; i < data.length; i++) {
    const fd = new Date(data[i][2]);
    if (fd >= d1 && fd <= d2) {
      const modo = String(data[i][4]).trim().toUpperCase();
      const efec = parseInt(data[i][6]) || 0;
      const tot = parseInt(data[i][7]) || 0;

      if (!porModo[modo]) porModo[modo] = { efectivas: 0, totales: 0 };
      porModo[modo].efectivas += efec;
      porModo[modo].totales += tot;
      totalEfec += efec;
      totalTot += tot;

      const vars = parseVariables(data[i][13]);
      Object.keys(vars).forEach(k => {
        const num = parseFloat(vars[k]);
        if (isNaN(num)) return;
        porVar[k] = (porVar[k] || 0) + num;
      });
    }
  }

  let msg = `📊 <b>REPORTE CONSOLIDADO (${tituloFreq})</b> 📊\n`;
  msg += `📅 Rango: ${escapeHtml(f1)}${f2 !== f1 ? " al " + escapeHtml(f2) : ""}\n`;
  msg += `➖➖➖➖➖➖➖➖➖➖\n`;
  msg += `🏆 <b>Total efectivas/actividades: ${totalEfec}</b>\n`;
  msg += `☎️ Total llamadas/datos procesados: ${totalTot}\n`;

  const modos = Object.keys(porModo).sort();
  if (modos.length) {
    msg += `\n📋 <b>Desglose por modo:</b>\n`;
    modos.forEach(m => {
      msg += `   🔹 ${escapeHtml(m)}: <b>${porModo[m].efectivas}</b> (totales: ${porModo[m].totales})\n`;
    });
  }

  const varsKeys = Object.keys(porVar).sort();
  if (varsKeys.length) {
    msg += `\n📊 <b>Variables de evaluación:</b>\n`;
    varsKeys.forEach(k => {
      msg += `   📊 ${escapeHtml(obtenerEtiquetaVariable(k))}: <b>${porVar[k]}</b>\n`;
    });
  }

  if (msg.length > 4000) msg = msg.substring(0, 4000) + "\n\n⚠️ <i>[MENSAJE RECORTADO]</i>";
  return msg;
}

/**
 * Envía el reporte consolidado a los destinatarios activos que correspondan a la frecuencia.
 * frecuencia: "DIARIO" | "SEMANAL".
 */
function enviarReporteConsolidado(frecuencia) {
  const freq = String(frecuencia || "DIARIO").toUpperCase();
  const tz = Session.getScriptTimeZone();
  const hoy = new Date();

  let f1, f2, tituloFreq;
  if (freq === "SEMANAL") {
    const d1 = new Date(hoy); d1.setDate(d1.getDate() - 7);
    const d2 = new Date(hoy);
    f1 = Utilities.formatDate(d1, tz, "yyyy-MM-dd");
    f2 = Utilities.formatDate(d2, tz, "yyyy-MM-dd");
    tituloFreq = "SEMANAL";
  } else {
    const ayer = new Date(hoy); ayer.setDate(ayer.getDate() - 1);
    f1 = Utilities.formatDate(ayer, tz, "yyyy-MM-dd");
    f2 = f1;
    tituloFreq = "DIARIO";
  }

  const msg = construirMensajeConsolidado(f1, f2, tituloFreq);
  const destinatarios = obtenerDestinatarios();

  let enviados = 0;
  destinatarios.forEach(d => {
    if (!d.activo) return;
    if (freq === "SEMANAL" && d.frecuencia !== "SEMANAL") return;
    if (freq === "DIARIO" && d.frecuencia === "SEMANAL") return;
    if (enviarTelegramAChat(msg, d.chatId)) enviados++;
  });

  return { success: true, enviados, message: `Reporte consolidado ${tituloFreq} enviado a ${enviados} destinatarios.` };
}

/** Handler de trigger diario. */
function enviarReporteConsolidadoDiario() {
  return enviarReporteConsolidado("DIARIO");
}

/** Handler de trigger semanal (domingo). */
function enviarReporteConsolidadoSemanal() {
  return enviarReporteConsolidado("SEMANAL");
}

/** Instala (o reinstala) los triggers de reportes diario y semanal. */
function instalarTriggersReportes() {
  ScriptApp.getProjectTriggers().forEach(t => {
    const h = t.getHandlerFunction();
    if (h === "enviarReporteConsolidadoDiario" || h === "enviarReporteConsolidadoSemanal") {
      ScriptApp.deleteTrigger(t);
    }
  });

  ScriptApp.newTrigger("enviarReporteConsolidadoDiario")
    .timeBased()
    .everyDays(1)
    .atHour(HORA_REPORTE_DIARIO)
    .create();

  ScriptApp.newTrigger("enviarReporteConsolidadoSemanal")
    .timeBased()
    .everyWeeks(1)
    .onWeekDay(ScriptApp.WeekDay.SUNDAY)
    .atHour(HORA_REPORTE_SEMANAL)
    .create();

  return { success: true, message: "Triggers de reportes instalados (diario " + HORA_REPORTE_DIARIO + ":00 y semanal domingo " + HORA_REPORTE_SEMANAL + ":00)." };
}
