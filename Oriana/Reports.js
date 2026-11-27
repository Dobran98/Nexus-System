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
          nombre:  String(data[i][2]).trim() || String(data[i][0]).trim()
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
  const ss   = getSpreadsheet();
  const hoja = ss.getSheetByName(NOMBRE_HOJA_REGISTROS);
  if (!hoja) return { datos: [], totalEfec: 0, totalTot: 0, variablesTotales: [] };

  const data = hoja.getDataRange().getValues();
  const d1   = new Date(f1 + "T00:00:00");
  const d2   = new Date(f2 + "T23:59:59");

  const map       = {};
  const mapVars   = {};
  let totalEfec   = 0;
  let totalTot    = 0;

  for (let i = 1; i < data.length; i++) {
    const fd = new Date(data[i][2]);
    if (fd >= d1 && fd <= d2) {
      const uName = String(data[i][3]).toLowerCase();
      if (usuario === "TODOS" || uName === usuario.toLowerCase()) {
        const modo = String(data[i][4]).trim().toUpperCase();
        const efec = parseInt(data[i][6]) || 0;
        const tot  = parseInt(data[i][7]) || 0;

        if (!map[modo]) map[modo] = { efectivas: 0, totales: 0 };
        map[modo].efectivas += efec;
        map[modo].totales   += tot;
        totalEfec += efec;
        totalTot  += tot;

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
  const ss   = getSpreadsheet();
  const h    = ss.getSheetByName(NOMBRE_HOJA_REGISTROS);
  if (!h) return { success: false, message: "No existe la hoja de registros." };

  const data = h.getDataRange().getValues();
  const d1   = new Date(f1 + "T00:00:00");
  const d2   = new Date(f2 + "T23:59:59");
  const tz   = Session.getScriptTimeZone();

  // Diccionario usuario -> { nombre, turno }
  const dictUsu = {};
  try {
    const dataUsu = obtenerDatosUsuariosCached();
    for (let i = 1; i < dataUsu.length; i++) {
      const uKey = String(dataUsu[i][0]).trim().toLowerCase();
      const rawT = dataUsu[i][4];
      dictUsu[uKey] = {
        nombre: String(dataUsu[i][2] || dataUsu[i][0]).trim(),
        turno:  (rawT !== undefined && String(rawT).trim() !== "")
          ? String(rawT).trim().toUpperCase() : "MAÑANA"
      };
    }
  } catch (e) { console.error("Error leyendo usuarios para export XLSX: " + e); }

  // Filtrar filas y descubrir variables dinámicas presentes en el rango
  const filas   = [];   // [{ idx, vars }]
  const varCols = [];   // [{ key, etiqueta }]

  for (let i = 1; i < data.length; i++) {
    const fd = new Date(data[i][2]);
    if (fd < d1 || fd > d2) continue;
    if (fm !== "TODOS" && String(data[i][4]).trim().toUpperCase() !== String(fm).trim().toUpperCase()) continue;
    const vars = parseVariables(data[i][13]);
    filas.push({ idx: i, vars });
    Object.keys(vars).forEach(k => {
      if (!varCols.some(v => v.key === k)) {
        varCols.push({ key: k, etiqueta: obtenerEtiquetaVariable(k) || k });
      }
    });
  }

  // ── Agregaciones ────────────────────────────────────────────────────────────
  const porModo = {};   // modo -> { act, efec, tot, inc, vars }
  const porOp   = {};   // usuarioKey -> { nombre, turno, act, efec, tot, inc, vars }
  const porVar  = {};   // varKey -> total
  let totalEfec = 0, totalTot = 0, totalInc = 0;

  filas.forEach(f => {
    const r     = data[f.idx];
    const uKey  = String(r[3]).trim().toLowerCase();
    const nombre = dictUsu[uKey] ? dictUsu[uKey].nombre : String(r[3]).trim();
    const turno = dictUsu[uKey] ? dictUsu[uKey].turno : "MAÑANA";
    const modo  = String(r[4]).trim().toUpperCase();
    const efec  = parseInt(r[6]) || 0;
    const tot   = parseInt(r[7]) || 0;
    const inc   = parseInt(r[8]) || 0;

    totalEfec += efec; totalTot += tot; totalInc += inc;

    if (!porModo[modo]) porModo[modo] = { act: 0, efec: 0, tot: 0, inc: 0, vars: {} };
    porModo[modo].act++; porModo[modo].efec += efec; porModo[modo].tot += tot; porModo[modo].inc += inc;

    if (!porOp[uKey]) porOp[uKey] = { nombre, turno, act: 0, efec: 0, tot: 0, inc: 0, vars: {} };
    porOp[uKey].act++; porOp[uKey].efec += efec; porOp[uKey].tot += tot; porOp[uKey].inc += inc;

    Object.keys(f.vars).forEach(k => {
      const num = parseFloat(f.vars[k]);
      if (isNaN(num)) return;
      porVar[k] = (porVar[k] || 0) + num;
      porModo[modo].vars[k] = (porModo[modo].vars[k] || 0) + num;
      porOp[uKey].vars[k]  = (porOp[uKey].vars[k] || 0) + num;
    });
  });

  const totalAct = filas.length;

  const filaFecha = v => (v instanceof Date) ? Utilities.formatDate(v, tz, "dd/MM/yyyy") : String(v).substring(0, 10);
  const filaHora  = v => (v instanceof Date) ? Utilities.formatDate(v, tz, "HH:mm") : "";

  // ── Construir libro temporal multi-hoja ─────────────────────────────────────
  const t = SpreadsheetApp.create("Reporte_Operatividad");
  const shResumen = t.getSheets()[0]; shResumen.setName("Resumen");

  // 1) Resumen
  const resumen = [];
  resumen.push(["ORIANA — REPORTE DE OPERATIVIDAD"]);
  resumen.push(["Rango de fechas", f1 + " al " + f2]);
  resumen.push(["Modo", (fm === "TODOS" || !fm) ? "Todos los modos" : fm]);
  resumen.push(["Generado", Utilities.formatDate(new Date(), tz, "dd/MM/yyyy HH:mm")]);
  resumen.push([]);
  resumen.push(["INDICADORES GENERALES"]);
  resumen.push(["Total Actividades Reportadas", totalAct]);
  resumen.push(["Total Efectivas/Evaluaciones", totalEfec]);
  resumen.push(["Total Llamadas/Datos Procesados", totalTot]);
  resumen.push(["Total Incidencias", totalInc]);
  escribirFilas(shResumen, resumen);

  // 2) Registros (detalle)
  const shReg = t.insertSheet("Registros");
  const headerReg = ["Fecha", "Hora", "Nombre y Apellido", "Usuario", "Turno", "Modo",
    "Campaña/Actividad", "Efectivas/Evaluaciones", "Totales", "Incidencias", "Estados",
    "Detalle/Municipios"];
  varCols.forEach(v => headerReg.push(v.etiqueta));
  headerReg.push("V.Efectivas", "V.Incidencias");

  const filasReg = [headerReg];
  filas.forEach(f => {
    const r     = data[f.idx];
    const uKey  = String(r[3]).trim().toLowerCase();
    const nombre = dictUsu[uKey] ? dictUsu[uKey].nombre : String(r[3]).trim();
    const turno = dictUsu[uKey] ? dictUsu[uKey].turno : "MAÑANA";
    const row = [filaFecha(r[2]), filaHora(r[1]), nombre, String(r[3]).trim(), turno,
      String(r[4]).trim(), r[5], r[6], r[7], r[8], r[9], r[10]];
    varCols.forEach(v => row.push(f.vars[v.key] !== undefined ? f.vars[v.key] : ""));
    row.push(r[11], r[12]);
    filasReg.push(row);
  });

  if (filas.length > 0) {
    const totRow = ["TOTALES", "", "", "", "", "", "", totalEfec, totalTot, totalInc, "", ""];
    varCols.forEach(v => totRow.push(porVar[v.key] || 0));
    totRow.push("", "");
    filasReg.push(totRow);
  }
  escribirFilas(shReg, filasReg);

  // 3) Por Modo
  const shModo = t.insertSheet("Por Modo");
  const headerModo = ["Modo", "Actividades", "Efectivas", "Totales", "Incidencias"];
  varCols.forEach(v => headerModo.push(v.etiqueta));
  const filasModo = [headerModo];
  Object.keys(porModo).sort().forEach(m => {
    const row = [m, porModo[m].act, porModo[m].efec, porModo[m].tot, porModo[m].inc];
    varCols.forEach(v => row.push(porModo[m].vars[v.key] || 0));
    filasModo.push(row);
  });
  escribirFilas(shModo, filasModo);

  // 4) Por Operador
  const shOp = t.insertSheet("Por Operador");
  const headerOp = ["Operador", "Turno", "Actividades", "Efectivas", "Totales", "Incidencias"];
  varCols.forEach(v => headerOp.push(v.etiqueta));
  const filasOp = [headerOp];
  Object.keys(porOp).sort((a, b) => porOp[a].nombre.localeCompare(porOp[b].nombre)).forEach(uKey => {
    const o = porOp[uKey];
    const row = [o.nombre, o.turno, o.act, o.efec, o.tot, o.inc];
    varCols.forEach(v => row.push(o.vars[v.key] || 0));
    filasOp.push(row);
  });
  escribirFilas(shOp, filasOp);

  // 5) Por Variable (solo si hay variables)
  if (varCols.length > 0) {
    const shVar = t.insertSheet("Por Variable");
    const filasVar = [["Variable", "Total"]];
    Object.keys(porVar).sort().forEach(k => filasVar.push([obtenerEtiquetaVariable(k) || k, porVar[k]]));
    escribirFilas(shVar, filasVar);
  }

  SpreadsheetApp.flush();
  const url = `https://docs.google.com/spreadsheets/d/${t.getId()}/export?format=xlsx`;
  const b   = UrlFetchApp.fetch(url, {
    headers: { Authorization: "Bearer " + ScriptApp.getOAuthToken() }
  }).getBlob();
  DriveApp.getFileById(t.getId()).setTrashed(true);

  return { success: true, base64: Utilities.base64Encode(b.getBytes()), filename: `Reporte_Operatividad_${f1}_al_${f2}.xlsx` };
}

/** Escribe un conjunto de filas (normalizando su ancho) en una hoja. */
function escribirFilas(sheet, rows) {
  const max  = rows.reduce((m, r) => Math.max(m, r.length), 0);
  const norm = rows.map(r => { const nr = r.slice(); while (nr.length < max) nr.push(""); return nr; });
  if (norm.length === 0) return;
  sheet.getRange(1, 1, norm.length, max).setValues(norm);
}

function generarReporteWord(f1, f2, tipo) {
  const ss      = getSpreadsheet();
  const hojaReg = ss.getSheetByName(NOMBRE_HOJA_REGISTROS);
  if (!hojaReg) return { success: false, message: "Faltan hojas de base de datos." };

  // Optimización: Usar caché para obtener datos de usuarios
  const dataUsu = obtenerDatosUsuariosCached();
  const dictUsu = {};
  for (let i = 1; i < dataUsu.length; i++) {
    const uKey  = String(dataUsu[i][0]).trim().toLowerCase();
    const rawT  = dataUsu[i][4];
    dictUsu[uKey] = {
      nombre: dataUsu[i][2] || dataUsu[i][0],
      turno:  (rawT !== undefined && String(rawT).trim() !== "")
        ? String(rawT).trim().toUpperCase() : "MAÑANA"
    };
  }

  const dataReg  = hojaReg.getDataRange().getValues();
  const d1       = new Date(f1 + "T00:00:00");
  const d2       = new Date(f2 + "T23:59:59");

  const resumenGeneral    = {};
  const resumenPorModo    = {};
  const resumenPorOp      = {};

  const asegurarVars = obj => { if (!obj.vars) obj.vars = {}; return obj.vars; };

  for (let i = 1; i < dataReg.length; i++) {
    const fd = new Date(dataReg[i][2]);
    if (fd >= d1 && fd <= d2) {
      const uKey = String(dataReg[i][3]).trim().toLowerCase();
      const modo = String(dataReg[i][4]).trim().toUpperCase();
      const efec = parseInt(dataReg[i][6]) || 0;
      const tot  = parseInt(dataReg[i][7]) || 0;
      const inc  = parseInt(dataReg[i][8]) || 0;

      if (!resumenGeneral[modo])         resumenGeneral[modo]         = { efectivas: 0, totales: 0, incidencias: 0, vars: {} };
      if (!resumenPorModo[modo])         resumenPorModo[modo]         = {};
      if (!resumenPorModo[modo][uKey])   resumenPorModo[modo][uKey]   = { efectivas: 0, totales: 0, incidencias: 0, vars: {} };
      if (!resumenPorOp[uKey])           resumenPorOp[uKey]           = {};
      if (!resumenPorOp[uKey][modo])     resumenPorOp[uKey][modo]     = { efectivas: 0, totales: 0, incidencias: 0, vars: {} };

      resumenGeneral[modo].efectivas       += efec;
      resumenGeneral[modo].totales         += tot;
      resumenGeneral[modo].incidencias     += inc;
      resumenPorModo[modo][uKey].efectivas += efec;
      resumenPorModo[modo][uKey].totales   += tot;
      resumenPorModo[modo][uKey].incidencias += inc;
      resumenPorOp[uKey][modo].efectivas   += efec;
      resumenPorOp[uKey][modo].totales     += tot;
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
  if      (tipo === 1) { titulo = "Reporte General";              nombreArchivo = `Reporte_General_${f1}_al_${f2}.doc`; }
  else if (tipo === 2) { titulo = "Reporte General por Modo";     nombreArchivo = `Reporte_General_Modos_${f1}_al_${f2}.doc`; }
  else                 { titulo = "Reporte General por Operadores"; nombreArchivo = `Reporte_General_Operadores_${f1}_al_${f2}.doc`; }

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
        const d  = resumenPorModo[m][uKey];
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
    success:  true,
    base64:   Utilities.base64Encode(Utilities.newBlob(html).getBytes()),
    filename: nombreArchivo
  };
}

/**
 * Crea o refresca los archivos de indicadores en Google Drive.
 * Estructura: CARPETA_RAIZ / MODO / INDICADOR / archivo(INDICADOR)
 * Columnas: Fecha, Hora, Nombre y Apellido, Modo, Campaña/Actividad, [variables...], Total
 */
function actualizarArchivosIndicadores() {
  const indicadores = obtenerIndicadores();
  if (!indicadores.length) return { success: true, message: "No hay indicadores macro configurados." };

  const ss      = getSpreadsheet();
  const hojaReg = ss.getSheetByName(NOMBRE_HOJA_REGISTROS);
  const data    = hojaReg ? hojaReg.getDataRange().getValues() : [];

  // Diccionario usuario -> nombre completo
  const dictNombres = {};
  try {
    const dataUsu = obtenerDatosUsuariosCached();
    for (let i = 1; i < dataUsu.length; i++) {
      const uKey = String(dataUsu[i][0]).trim().toLowerCase();
      dictNombres[uKey] = String(dataUsu[i][2] || dataUsu[i][0]).trim();
    }
  } catch (e) { console.error("Error leyendo usuarios para indicadores: " + e); }

  const tz   = Session.getScriptTimeZone();
  const raiz = obtenerCarpetaRaizIndicadores();
  let procesados = 0;

  indicadores.forEach(ind => {
    const modo   = String(ind.modo).trim().toUpperCase();
    const nombre = String(ind.indicador).trim();
    if (!modo || !nombre) return;

    const carpetaModo      = getOrCreateFolder(raiz, modo);
    const carpetaIndicador = getOrCreateFolder(carpetaModo, nombre);
    const archivo          = getOrCreateArchivoIndicador(carpetaIndicador, nombre);

    const variables = obtenerVariablesModo(modo);
    const cabecera = ["Fecha", "Hora", "Nombre y Apellido", "Modo", "Campaña/Actividad"];
    variables.forEach(v => cabecera.push(v.etiqueta || v.variable));
    cabecera.push("Total");

    const filas = [cabecera];
    for (let i = 1; i < data.length; i++) {
      const mRow = String(data[i][4]).trim().toUpperCase();
      if (mRow !== modo) continue;

      const uKey = String(data[i][3]).trim().toLowerCase();
      const nombreCompleto = dictNombres[uKey] || String(data[i][3]).trim();
      const fecha = (data[i][2] instanceof Date)
        ? Utilities.formatDate(data[i][2], tz, "yyyy-MM-dd")
        : String(data[i][2]).substring(0, 10);
      const hora = (data[i][1] instanceof Date)
        ? Utilities.formatDate(data[i][1], tz, "HH:mm")
        : "";

      const vars = parseVariables(data[i][13]);
      const row = [fecha, hora, nombreCompleto, String(data[i][4]).trim(), data[i][5]];
      variables.forEach(v => row.push(vars[v.variable] !== undefined ? vars[v.variable] : ""));
      row.push(parseInt(data[i][6]) || 0);  // Total = efectivas (suma de variables principales)
      filas.push(row);
    }

    const hoja = archivo.getSheets()[0];
    hoja.clear();
    const ncols = cabecera.length;
    if (filas.length === 1) {
      hoja.getRange(1, 1, 1, ncols).setValues([cabecera]);
    } else {
      hoja.getRange(1, 1, filas.length, ncols).setValues(filas);
    }
    procesados++;
  });

  return { success: true, message: `Indicadores macro actualizados en Drive (${procesados}).` };
}

// ─── HELPERS DE CARPETAS Y ARCHIVOS EN DRIVE ───────────────────────────────────

function obtenerCarpetaRaizIndicadores() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty("DRIVE_INDICADORES_ROOT");
  if (id) {
    try { return DriveApp.getFolderById(id); } catch (e) {}
  }
  const carpeta = DriveApp.createFolder("ORIANA_Indicadores");
  props.setProperty("DRIVE_INDICADORES_ROOT", carpeta.getId());
  return carpeta;
}

function getOrCreateFolder(parent, nombre) {
  const it = parent.getFoldersByName(nombre);
  if (it.hasNext()) return it.next();
  return parent.createFolder(nombre);
}

function getOrCreateArchivoIndicador(carpetaIndicador, nombre) {
  const it = carpetaIndicador.getFilesByName(nombre);
  while (it.hasNext()) {
    const f = it.next();
    if (f.getMimeType() === MimeType.GOOGLE_SHEETS) {
      return SpreadsheetApp.openById(f.getId());
    }
  }
  const ss = SpreadsheetApp.create(nombre);
  const file = DriveApp.getFileById(ss.getId());
  carpetaIndicador.addFile(file);
  DriveApp.getRootFolder().removeFile(file);
  return ss;
}

// ─── REPORTES CONSOLIDADOS PROGRAMADOS (DIARIO / SEMANAL) ─────────────────────

/** Formatea un número con separador de miles (punto). Ej: 1628 -> "1.628". */
function formatearNumero(n) {
  const num = Number(n) || 0;
  const s = String(Math.round(num));
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/**
 * Construye el "Balance General" detallado:
 * totales, desglose por indicador y sus variables, por actividad, y por operador.
 */
function construirBalanceGeneral(f1, f2, titulo) {
  const ss   = getSpreadsheet();
  const hoja = ss.getSheetByName(NOMBRE_HOJA_REGISTROS);
  if (!hoja) return "📭 Sin registros disponibles.";

  const data = hoja.getDataRange().getValues();
  const d1   = new Date(f1 + "T00:00:00");
  const d2   = new Date(f2 + "T23:59:59");

  const dictUsu = {};
  try {
    const dataUsu = obtenerDatosUsuariosCached();
    for (let i = 1; i < dataUsu.length; i++) {
      dictUsu[String(dataUsu[i][0]).trim().toLowerCase()] = String(dataUsu[i][2] || dataUsu[i][0]).trim();
    }
  } catch (e) {}

  const porActividad = {};   // campaña/actividad -> { modo, efec, rep, vars }
  const porModo      = {};   // modo -> { efec, rep, vars }
  const porOp        = {};   // usuarioKey -> { nombre, efec, rep }
  let totalReportes = 0, totalEfec = 0, totalTot = 0, totalInc = 0;

  for (let i = 1; i < data.length; i++) {
    const fd = new Date(data[i][2]);
    if (fd < d1 || fd > d2) continue;

    const uKey = String(data[i][3]).trim().toLowerCase();
    const modo = String(data[i][4]).trim().toUpperCase();
    const camp = String(data[i][5]).trim() || "(sin actividad)";
    const efec = parseInt(data[i][6]) || 0;
    const tot  = parseInt(data[i][7]) || 0;
    const inc  = parseInt(data[i][8]) || 0;
    const vars = parseVariables(data[i][13]);

    totalReportes++; totalEfec += efec; totalTot += tot; totalInc += inc;

    if (!porActividad[camp]) porActividad[camp] = { modo: modo, efec: 0, rep: 0, vars: {} };
    porActividad[camp].efec += efec;
    porActividad[camp].rep++;
    Object.keys(vars).forEach(k => {
      const n = parseFloat(vars[k]);
      if (!isNaN(n)) porActividad[camp].vars[k] = (porActividad[camp].vars[k] || 0) + n;
    });

    if (!porModo[modo]) porModo[modo] = { efec: 0, rep: 0, vars: {} };
    porModo[modo].efec += efec;
    porModo[modo].rep++;
    Object.keys(vars).forEach(k => {
      const n = parseFloat(vars[k]);
      if (!isNaN(n)) porModo[modo].vars[k] = (porModo[modo].vars[k] || 0) + n;
    });

    if (!porOp[uKey]) porOp[uKey] = { nombre: dictUsu[uKey] || String(data[i][3]).trim(), efec: 0, rep: 0 };
    porOp[uKey].efec += efec;
    porOp[uKey].rep++;
  }

  const totalActividades = Object.keys(porActividad).length;

  let msg = `📊 <b>BALANCE GENERAL ${titulo}</b> 📊\n`;
  msg += `📅 ${escapeHtml(f1)}${f2 !== f1 ? " al " + escapeHtml(f2) : ""}\n➖➖➖➖➖➖➖➖➖➖\n`;
  msg += `📋 <b>Total Actividades Trabajadas: ${totalActividades}</b>\n`;
  msg += `📋 <b>Total Reportes: ${totalReportes}</b>\n`;

  // Total por indicador(modo) y sus variables
  const modos = Object.keys(porModo).sort();
  if (modos.length) {
    msg += `\n<b>Total por Indicador(Modo) y sus variables:</b>\n`;
    modos.forEach(m => {
      const nombreInd = obtenerNombreIndicador(m) || m;
      msg += `${escapeHtml(nombreInd)}:\n`;
      const defs = obtenerVariablesModo(m);
      if (defs.length) {
        defs.forEach(v => {
          msg += `📊 ${escapeHtml(v.etiqueta || v.variable)}: ${formatearNumero(porModo[m].vars[v.variable] || 0)}\n`;
        });
      } else {
        msg += `📊 ${escapeHtml(nombreInd)}: ${formatearNumero(porModo[m].efec)}\n`;
      }
      msg += `\n`;
    });
  }

  msg += `🏆 <b>Total Efectivas/Actividades: ${formatearNumero(totalEfec)}</b>\n`;
  msg += `☎️ Total Llamadas/Datos: ${formatearNumero(totalTot)}\n`;
  msg += `⚠️ Total Incidencias: ${formatearNumero(totalInc)}\n`;

  // Resumen por actividad
  const acts = Object.keys(porActividad).sort();
  if (acts.length) {
    msg += `\n📌 <b>POR ACTIVIDAD:</b>\n`;
    acts.forEach(a => msg += `📌 ${escapeHtml(a)}: ${formatearNumero(porActividad[a].efec)} (${porActividad[a].rep} Rep.)\n`);
  }

  // Detalle por actividad
  acts.forEach(a => {
    const act = porActividad[a];
    const nombreInd = obtenerNombreIndicador(act.modo) || act.modo;
    msg += `\nMODO: ${escapeHtml(act.modo)}\n`;
    msg += `ACTIVIDAD: ${escapeHtml(a)}: ${formatearNumero(act.efec)} (${act.rep} Rep.)\n`;
    msg += `📊 <b>POR INDICADOR:</b>\n`;
    msg += `🔹 ${escapeHtml(nombreInd)}: ${formatearNumero(act.efec)} (${act.rep} Rep.)\n`;

    const defsAct = obtenerVariablesModo(act.modo);
    const varsKeys = defsAct.length ? defsAct.map(v => v.variable) : Object.keys(act.vars);
    if (varsKeys.length) {
      msg += `📊 <b>POR VARIABLE:</b>\n`;
      varsKeys.forEach(k => {
        const etiqueta = obtenerEtiquetaVariable(k) || k;
        msg += `📊 ${escapeHtml(etiqueta)}: ${formatearNumero(act.vars[k] || 0)}\n`;
      });
    }
  });

  // Por operador
  const ops = Object.keys(porOp).sort((a, b) => porOp[b].efec - porOp[a].efec);
  if (ops.length) {
    msg += `\n👥 <b>POR OPERADOR:</b>\n`;
    ops.forEach(u => msg += `👤 ${escapeHtml(porOp[u].nombre)}: ${formatearNumero(porOp[u].efec)} (${porOp[u].rep} Rep.)\n`);
  }

  if (msg.length > 4000) msg = msg.substring(0, 4000) + "\n\n⚠️ <i>[MENSAJE RECORTADO]</i>";
  return msg;
}

/** Rango de fechas y título para un periodo: "HOY", "AYER", "SEMANA", "MES". */
function rangoPeriodo(periodo) {
  const tz  = Session.getScriptTimeZone();
  const hoy = new Date();
  const fmt = d => Utilities.formatDate(d, tz, "yyyy-MM-dd");
  if (periodo === "SEMANA") {
    const d1 = new Date(hoy); d1.setDate(d1.getDate() - 7);
    return { f1: fmt(d1), f2: fmt(hoy), titulo: "SEMANAL" };
  }
  if (periodo === "MES") {
    const d1 = new Date(hoy); d1.setDate(d1.getDate() - 30);
    return { f1: fmt(d1), f2: fmt(hoy), titulo: "MENSUAL" };
  }
  if (periodo === "AYER") {
    const ayer = new Date(hoy); ayer.setDate(ayer.getDate() - 1);
    return { f1: fmt(ayer), f2: fmt(ayer), titulo: "DE AYER" };
  }
  return { f1: fmt(hoy), f2: fmt(hoy), titulo: "DE HOY" };
}

/** Balance general para un periodo ("HOY", "AYER", "SEMANA", "MES"). */
function construirBalancePeriodo(periodo) {
  const r = rangoPeriodo(periodo);
  return construirBalanceGeneral(r.f1, r.f2, r.titulo);
}

/** Rendimiento de los operadores que coincidan con el nombre, para un periodo. */
function construirRendimientoOperador(nombre, periodo) {
  const r = rangoPeriodo(periodo || "SEMANA");
  const query = String(nombre || "").trim().toLowerCase();
  if (!query) return construirBalancePeriodo(periodo || "SEMANA");

  const ss   = getSpreadsheet();
  const hoja = ss.getSheetByName(NOMBRE_HOJA_REGISTROS);
  if (!hoja) return "📭 Sin registros disponibles.";

  const data = hoja.getDataRange().getValues();
  const d1 = new Date(r.f1 + "T00:00:00");
  const d2 = new Date(r.f2 + "T23:59:59");

  const dictUsu = {};
  try {
    const dataUsu = obtenerDatosUsuariosCached();
    for (let i = 1; i < dataUsu.length; i++) {
      dictUsu[String(dataUsu[i][0]).trim().toLowerCase()] = String(dataUsu[i][2] || dataUsu[i][0]).trim();
    }
  } catch (e) {}

  // Conjunto de variables principales (las que suman al total, sin dependencia)
  const principales = new Set();
  try {
    const allVars = obtenerTodasVariables();
    Object.keys(allVars).forEach(m => {
      allVars[m].forEach(v => { if (!v.padre) principales.add(v.variable); });
    });
  } catch (e) {}

  const porModo = {}, porVar = {}, porActividad = {};
  let act = 0, efec = 0, tot = 0, inc = 0;
  const nombresMatch = new Set();

  for (let i = 1; i < data.length; i++) {
    const fd = new Date(data[i][2]);
    if (fd < d1 || fd > d2) continue;
    const uKey = String(data[i][3]).trim().toLowerCase();
    const nombreCompleto = dictUsu[uKey] || String(data[i][3]).trim();
    if (!nombreCompleto.toLowerCase().includes(query) && !uKey.includes(query)) continue;

    const modo = String(data[i][4]).trim().toUpperCase();
    const e = parseInt(data[i][6]) || 0;
    const t = parseInt(data[i][7]) || 0;
    const ic = parseInt(data[i][8]) || 0;
    const camp = String(data[i][5]).trim() || "(sin actividad)";

    nombresMatch.add(nombreCompleto);
    act++; efec += e; tot += t; inc += ic;
    if (!porModo[modo]) porModo[modo] = { act: 0, efec: 0, tot: 0 };
    porModo[modo].act++; porModo[modo].efec += e; porModo[modo].tot += t;

    if (!porActividad[camp]) porActividad[camp] = { efec: 0, act: 0 };
    porActividad[camp].efec += e;
    porActividad[camp].act++;

    const vars = parseVariables(data[i][13]);
    Object.keys(vars).forEach(k => {
      const num = parseFloat(vars[k]);
      if (isNaN(num)) return;
      // Solo acumulamos variables principales (ej. "Llamadas Totales", no "Efectivas/Fallidas")
      if (principales.has(k)) porVar[k] = (porVar[k] || 0) + num;
    });
  }

  if (nombresMatch.size === 0) return `🔎 No encontré al operador "${escapeHtml(nombre)}" en el periodo ${r.titulo.toLowerCase()}.`;

  let msg = `📊 <b>RENDIMIENTO: ${escapeHtml([...nombresMatch].join(", "))}</b> 📊\n`;
  msg += `📅 ${escapeHtml(r.f1)}${r.f2 !== r.f1 ? " al " + escapeHtml(r.f2) : ""} (${r.titulo})\n➖➖➖➖➖➖➖➖➖➖\n`;
  msg += `📋 <b>Actividades Reportadas: ${act}</b>\n`;
  msg += `🏆 Efectivas/Actividades: <b>${formatearNumero(efec)}</b>\n`;
  msg += `☎️ Llamadas/Datos: ${formatearNumero(tot)}\n`;
  msg += `⚠️ Incidencias: ${formatearNumero(inc)}\n`;

  const acts = Object.keys(porActividad).sort();
  if (acts.length) {
    msg += `\n📌 <b>POR ACTIVIDAD:</b>\n`;
    acts.forEach(a => msg += `   📌 ${escapeHtml(a)}: <b>${formatearNumero(porActividad[a].efec)}</b> (${porActividad[a].act})\n`);
  }

  const modos = Object.keys(porModo).sort();
  if (modos.length) {
    msg += `\n📊 <b>POR INDICADOR:</b>\n`;
    modos.forEach(m => {
      const nombreInd = obtenerNombreIndicador(m) || m;
      msg += `   🔹 ${escapeHtml(nombreInd)}: <b>${formatearNumero(porModo[m].efec)}</b> (${porModo[m].act} act.)\n`;
    });
  }

  const varsKeys = Object.keys(porVar).sort();
  if (varsKeys.length) {
    msg += `\n📊 <b>VARIABLES PRINCIPALES:</b>\n`;
    varsKeys.forEach(k => msg += `   📊 ${escapeHtml(obtenerEtiquetaVariable(k))}: <b>${formatearNumero(porVar[k])}</b>\n`);
  }

  if (msg.length > 4000) msg = msg.substring(0, 4000) + "\n\n⚠️ <i>[MENSAJE RECORTADO]</i>";
  return msg;
}

/**
 * Envía el reporte consolidado (balance general) a los destinatarios activos que correspondan a la frecuencia.
 * frecuencia: "DIARIO" | "SEMANAL".
 */
function enviarReporteConsolidado(frecuencia) {
  const freq = String(frecuencia || "DIARIO").toUpperCase();
  const r = (freq === "SEMANAL") ? rangoPeriodo("SEMANA") : rangoPeriodo("HOY");
  const msg = construirBalanceGeneral(r.f1, r.f2, r.titulo);
  const destinatarios = obtenerDestinatarios();

  let enviados = 0;
  destinatarios.forEach(d => {
    if (!d.activo) return;
    if (freq === "SEMANAL" && d.frecuencia !== "SEMANAL") return;
    if (freq === "DIARIO" && d.frecuencia === "SEMANAL") return;
    if (enviarTelegramAChat(msg, d.chatId)) enviados++;
  });

  return { success: true, enviados, message: `Reporte consolidado ${r.titulo} enviado a ${enviados} destinatarios.` };
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
