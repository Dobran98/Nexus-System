/**
 * Main.gs - Motor Central Sala Nacional
 * VERSIÓN SUITE PRO: Orquestación, Analítica, Cruce de Datas, Histórico y METAS ESTADALES
 * ACTUALIZADO: 9 franjas horarias (9AM, 11AM, 12M, 1PM, 2PM, 3PM, 4PM, 5PM, 6-8PM)
 */

const SS = SpreadsheetApp.getActiveSpreadsheet();

const SHEET_USUARIOS   = "DB_USUARIOS";
const SHEET_DATA       = "DB_DATA_DEF";    // NUEVA HOJA CON 9 FRANJAS HORARIAS
const SHEET_INCIDENTES = "BD_INCIDENCIAS";
const SHEET_CONFIG     = "CONFIG";
const SHEET_AUDITORIA  = "AUDITORIA";
const SHEET_COMUNAS    = "DETALLADO_COMUNAS";
const SHEET_MUNICIPAL  = "DATA_MUNICIPAL";
const SHEET_HISTORICO  = "DATA_HISTORICA";
const SHEET_METAS      = "METAS_ESTADALES";
const SHEET_CONDOMINIOS = "DB_CONDOMINIOS";

// ============================================================
// NOMBRES DISPLAY DE LAS 9 FRANJAS (para encabezados Excel etc.)
// ============================================================
const HORAS_DISPLAY = ["9:00 AM","10:00 AM","11:00 AM","12:00 M","1:00 PM","2:00 PM","3:00 PM","4:00 PM","5:00 PM","6-8:00 PM"];
const HORAS_KEYS    = ["h9","h10","h11","h12","h13","h14","h15","h16","h17","h20"];

function doGet() {
  try {
    return HtmlService.createTemplateFromFile('Index')
      .evaluate()
      .setTitle("SALA NACIONAL Sistema de Votacion")
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  } catch (e) {
    return HtmlService.createHtmlOutput("<h1>Error Crítico de Despliegue</h1><p>" + e.message + "</p>");
  }
}

function include(filename) { return HtmlService.createHtmlOutputFromFile(filename).getContent(); }

function validarSesion(token) {
  if (!token) return false;
  try {
    // 1. Intentar desde CacheService (muy rápido — evita leer Sheets)
    const cache  = CacheService.getScriptCache();
    const cached = cache.get('session_' + token);
    if (cached) {
      // Renovar TTL otros 10 minutos
      cache.put('session_' + token, cached, 600);
      return true;
    }

    // 2. Fallback: buscar en hoja DB_USUARIOS (solo si no está en caché)
    const hoja  = SS.getSheetByName(SHEET_USUARIOS);
    const datos = hoja.getDataRange().getValues();
    const ahora = new Date();

    for (let i = 1; i < datos.length; i++) {
      const t1 = datos[i][6] ? datos[i][6].toString() : "";
      const t2 = datos[i][8] ? datos[i][8].toString() : "";
      if (t1 !== token && t2 !== token) continue;

      const colToken = (t1 === token) ? 7 : 9;
      const colTime  = (t1 === token) ? 8 : 10;

      const ultimoAcceso = new Date(datos[i][colTime - 1]);
      if ((ahora - ultimoAcceso) / 60000 > 10) {
        hoja.getRange(i + 1, colToken).clearContent();
        cache.remove('session_' + token);
        return false;
      }

      hoja.getRange(i + 1, colTime).setValue(ahora);
      // Guardar en caché para las próximas peticiones
      const userData = { usuario: datos[i][1], rol: datos[i][3], estado: datos[i][4] };
      cache.put('session_' + token, JSON.stringify(userData), 600);
      return true;
    }
  } catch (e) { console.error('validarSesion error: ' + e.message); return false; }
  return false;
}

// ============================================================
// AVISO GLOBAL — Columnas L(12), M(13), N(14) de CONFIG
// (Se movieron de G/H/I para liberar espacio a los 9 bloqueos B-J)
// ============================================================
function enviarAvisoGlobal(msg, minutos) {
  const hoja = SS.getSheetByName(SHEET_CONFIG);
  if (hoja) {
    if (!msg) {
      hoja.getRange("L2").setValue("");
      hoja.getRange("N2").clearContent();
      return true;
    }
    const ahora = new Date();
    const duracionMins = parseInt(minutos) || 5;
    const fechaExpiracion = new Date(ahora.getTime() + (duracionMins * 60000));

    hoja.getRange("L2").setValue(msg);
    hoja.getRange("M2").setValue(ahora);
    hoja.getRange("N2").setValue(fechaExpiracion);
  }
  return true;
}

function obtenerAvisoGlobal() {
  const hoja = SS.getSheetByName(SHEET_CONFIG);
  if (!hoja) return { mensaje: "", expira: null };
  const msg = hoja.getRange("L2").getValue();
  if (!msg) return { mensaje: "", expira: null };
  const expira = hoja.getRange("N2").getValue();

  if (expira && expira instanceof Date) {
    if (new Date() > expira) return { mensaje: "", expira: null };
    return { mensaje: msg.toString(), expira: expira.getTime() };
  }
  return { mensaje: msg.toString(), expira: null };
}

// ============================================================
// METAS ESTADALES
// ============================================================
function obtenerMetasEstatales() {
  const hoja = SS.getSheetByName(SHEET_METAS);
  if (!hoja) return {};
  const datos = hoja.getDataRange().getValues().slice(1);
  let metas = {};
  datos.forEach(f => {
    if (f[0]) {
      metas[f[0].toString().toUpperCase().trim()] = Number(f[1]) || 0;
    }
  });
  return metas;
}

// ============================================================
// ESTADÍSTICAS NACIONALES — 9 FRANJAS HORARIAS
// Columnas en DB_DATA_DEF:
//   K(10)=9AM  L(11)=11AM  M(12)=12M  N(13)=1PM  O(14)=2PM
//   P(15)=3PM  Q(16)=4PM   R(17)=5PM  S(18)=6-8PM
// ============================================================
// ============================================================
// INVALIDAR CACHÉ DE ESTADÍSTICAS (llamar después de guardar datos)
// ============================================================
function invalidarCacheEstadisticas() {
  try {
    const cache = CacheService.getScriptCache();
    cache.remove('stats_nacional');
  } catch(e) { /* silencioso */ }
}

function obtenerEstadisticas() {
  // Intentar desde caché (2 minutos = 120 segundos)
  try {
    const cache  = CacheService.getScriptCache();
    const cached = cache.get('stats_nacional');
    if (cached) return JSON.parse(cached);
  } catch(e) { /* fallback a cálculo directo */ }
  const hoja = SS.getSheetByName(SHEET_DATA);
  if (!hoja) return {};
  const d = hoja.getDataRange().getValues().slice(1);
  const metas = obtenerMetasEstatales();

  const estados24 = ["AMAZONAS","ANZOATEGUI","APURE","ARAGUA","BARINAS","BOLIVAR","CARABOBO","CARACAS","COJEDES","DELTA AMACURO","FALCON","GUARICO","LA GUAIRA","LARA","MERIDA","MIRANDA","MONAGAS","NUEVA ESPARTA","PORTUGUESA","SUCRE","TACHIRA","TRUJILLO","YARACUY","ZULIA"];

  let res = {
    porEstado: {},
    nacionalHoras: { h9:0, h11:0, h12:0, h13:0, h14:0, h15:0, h16:0, h17:0, h20:0 },
    incidenciasPorEstado: {}, incidenciasPorMunicipio: {},
    topIncidenciasGlobal: { labels:[], data:[] }, topIncidenciasPorEstado: {},
    semaforoEstados: [], semaforoMunicipios:[],
    resumenIncidencias: { reportadas: 0, resueltas: 0 },
    incidenciasPorHora: { h9:0, h11:0, h12:0, h13:0, h14:0, h15:0, h16:0, h17:0, h20:0 },
    comparativaMunicipal: { estadalVotantes: 0, municipalVotantes: 0, estadalCentros: 0, municipalCentros: 0 },
    historicoNacional: { actual: 0, pasado: 0, dif: 0, pct: "0.00" }
  };

  estados24.forEach(e => {
    res.porEstado[e] = {
      metaCentros: 0,
      actual: 0,
      meta: metas[e] || 0,
      votantes: 0,
      h9:0, h11:0, h12:0, h13:0, h14:0, h15:0, h16:0, h17:0, h20:0
    };
    res.incidenciasPorEstado[e] = 0;
    res.incidenciasPorMunicipio[e] = {};
    res.topIncidenciasPorEstado[e] = {};
  });

  // 1. DATA ESTADAL — leer 9 columnas K(10) a S(18)
  let totalVotantesEstadal = 0;
  let totalCentrosEstadal  = 0;

  d.forEach(f => {
    const edo = f[0] ? f[0].toString().toUpperCase().trim() : "";
    if (!res.porEstado[edo]) return;

    const h9  = Number(f[10]) || 0; const h11 = Number(f[11]) || 0;
    const h12 = Number(f[12]) || 0; const h13 = Number(f[13]) || 0;
    const h14 = Number(f[14]) || 0; const h15 = Number(f[15]) || 0;
    const h16 = Number(f[16]) || 0; const h17 = Number(f[17]) || 0;
    const h20 = Number(f[18]) || 0;

    const totalVotosFila = h9 + h11 + h12 + h13 + h14 + h15 + h16 + h17 + h20;
    const activos       = Number(f[3]) || 0;
    const centrosTotales = Number(f[2]) || 0;

    res.porEstado[edo].metaCentros += centrosTotales;
    res.porEstado[edo].actual      += activos;
    res.porEstado[edo].votantes    += totalVotosFila;

    res.porEstado[edo].h9  += h9;  res.porEstado[edo].h11 += h11;
    res.porEstado[edo].h12 += h12; res.porEstado[edo].h13 += h13;
    res.porEstado[edo].h14 += h14; res.porEstado[edo].h15 += h15;
    res.porEstado[edo].h16 += h16; res.porEstado[edo].h17 += h17;
    res.porEstado[edo].h20 += h20;

    res.nacionalHoras.h9  += h9;  res.nacionalHoras.h11 += h11;
    res.nacionalHoras.h12 += h12; res.nacionalHoras.h13 += h13;
    res.nacionalHoras.h14 += h14; res.nacionalHoras.h15 += h15;
    res.nacionalHoras.h16 += h16; res.nacionalHoras.h17 += h17;
    res.nacionalHoras.h20 += h20;

    totalVotantesEstadal += totalVotosFila;
    totalCentrosEstadal  += activos;
  });

  res.comparativaMunicipal.estadalVotantes = totalVotantesEstadal;
  res.comparativaMunicipal.estadalCentros  = totalCentrosEstadal;

  // 2. DATA INCIDENCIAS
  const hojaInc = SS.getSheetByName(SHEET_INCIDENTES);
  if (hojaInc) {
    const dataInc = hojaInc.getDataRange().getValues().slice(1);
    let conteoIncGlobal = {};

    dataInc.forEach(f => {
      const fecha     = new Date(f[0]);
      const edo       = f[1] ? f[1].toString().toUpperCase().trim() : "";
      const mun       = f[2] ? f[2].toString().toUpperCase().trim() : "";
      const categoria = f[4];
      const cantidad  = Number(f[8]) || 1;
      const estatus   = f[10] ? f[10].toString().toUpperCase().trim() : "PENDIENTE";

      const horaRep = fecha.getHours();
      if      (horaRep < 9)  res.incidenciasPorHora.h9  += cantidad;
      else if (horaRep < 11) res.incidenciasPorHora.h11 += cantidad;
      else if (horaRep < 12) res.incidenciasPorHora.h12 += cantidad;
      else if (horaRep < 13) res.incidenciasPorHora.h13 += cantidad;
      else if (horaRep < 14) res.incidenciasPorHora.h14 += cantidad;
      else if (horaRep < 15) res.incidenciasPorHora.h15 += cantidad;
      else if (horaRep < 16) res.incidenciasPorHora.h16 += cantidad;
      else if (horaRep < 17) res.incidenciasPorHora.h17 += cantidad;
      else                   res.incidenciasPorHora.h20 += cantidad;

      res.resumenIncidencias.reportadas += cantidad;
      if (estatus === "RESUELTA") res.resumenIncidencias.resueltas += cantidad;

      if (res.incidenciasPorEstado[edo] !== undefined) {
        res.incidenciasPorEstado[edo] += cantidad;
        if (!res.incidenciasPorMunicipio[edo][mun]) res.incidenciasPorMunicipio[edo][mun] = 0;
        res.incidenciasPorMunicipio[edo][mun] += cantidad;
        if (categoria) {
          if (!res.topIncidenciasPorEstado[edo][categoria]) res.topIncidenciasPorEstado[edo][categoria] = 0;
          res.topIncidenciasPorEstado[edo][categoria] += cantidad;
        }
      }
      if (categoria) conteoIncGlobal[categoria] = (conteoIncGlobal[categoria] || 0) + cantidad;
    });

    const top4G = Object.entries(conteoIncGlobal).sort((a,b) => b[1]-a[1]).slice(0,4);
    res.topIncidenciasGlobal.labels = top4G.map(i => i[0]);
    res.topIncidenciasGlobal.data   = top4G.map(i => i[1]);
  }

  // 3. DATA MUNICIPAL — 9 columnas de horas (f[6]-f[14])
  const hojaMun = SS.getSheetByName(SHEET_MUNICIPAL);
  if (hojaMun) {
    const dataMun = hojaMun.getDataRange().getValues().slice(1);
    let totalVotMun = 0, totalCenMun = 0;
    dataMun.forEach(f => {
      const cActivos = Number(f[5]) || 0;
      const votos = (Number(f[6])||0)+(Number(f[7])||0)+(Number(f[8])||0)+(Number(f[9])||0)+
                    (Number(f[10])||0)+(Number(f[11])||0)+(Number(f[12])||0)+(Number(f[13])||0)+(Number(f[14])||0);
      totalCenMun += cActivos;
      totalVotMun += votos;
    });
    res.comparativaMunicipal.municipalVotantes = totalVotMun;
    res.comparativaMunicipal.municipalCentros  = totalCenMun;
  }

  // 4. DATA HISTÓRICA
  const hojaHist = SS.getSheetByName(SHEET_HISTORICO);
  if (hojaHist) {
    const dataHist = hojaHist.getDataRange().getValues().slice(1);
    let totalPasado = 0;
    dataHist.forEach(f => { totalPasado += (Number(f[1]) || 0); });

    res.historicoNacional.actual = totalVotantesEstadal;
    res.historicoNacional.pasado = totalPasado;
    res.historicoNacional.dif    = totalVotantesEstadal - totalPasado;
    res.historicoNacional.pct    = totalPasado > 0
      ? (((totalVotantesEstadal - totalPasado) / totalPasado) * 100).toFixed(2)
      : "0.00";
  }

  // 5. SEMÁFOROS
  const arrEstados = estados24.map(e => {
    const m = res.porEstado[e].metaCentros, a = res.porEstado[e].actual;
    return { estado: e, pct: (m > 0 ? parseFloat(((a/m)*100).toFixed(2)) : 0.00), faltan: m - a };
  });
  res.semaforoEstados = arrEstados.sort((a,b) => a.pct - b.pct).slice(0, 3);

  let arrMun = [];
  for (let edo in res.incidenciasPorMunicipio) {
    for (let mun in res.incidenciasPorMunicipio[edo]) {
      arrMun.push({ estado: edo, municipio: mun, cantidad: res.incidenciasPorMunicipio[edo][mun] });
    }
  }
  res.semaforoMunicipios = arrMun.sort((a,b) => b.cantidad - a.cantidad).slice(0, 3);

  // Guardar resultado en caché por 2 minutos
  try {
    const cache = CacheService.getScriptCache();
    cache.put('stats_nacional', JSON.stringify(res), 120);
  } catch(e) { /* silencioso si el objeto es muy grande */ }

  return res;
}

function obtenerCatalogoComunas() {
  const hoja = SS.getSheetByName(SHEET_COMUNAS);
  if (!hoja) return [];
  const datos = hoja.getDataRange().getValues().slice(1);
  return datos.map(r => ({
    estado:    r[0] ? r[0].toString().trim().toUpperCase() : "",
    municipio: r[1] ? r[1].toString().trim().toUpperCase() : "",
    comuna:    r[2] ? r[2].toString().trim().toUpperCase() : ""
  })).filter(c => c.estado !== "" && c.comuna !== "");
}

function obtenerUsuariosActivos() {
  const d = SS.getSheetByName(SHEET_USUARIOS).getDataRange().getValues().slice(1);
  const ahora = new Date();
  return d.filter(f => (f[6] || f[8]) && (ahora - new Date(f[7])) / 60000 < 10)
          .map(f => ({ usuario: f[1], rol: f[3], estado: f[4] }));
}

function obtenerAuditoriaEnVivo() {
  const hoja = SS.getSheetByName(SHEET_AUDITORIA);
  if (!hoja) return [];
  const datos = hoja.getDataRange().getValues();
  if (datos.length < 2) return [];
  return datos.slice(-20).reverse().map(r =>
    `[${new Date(r[0]).toLocaleTimeString('es-VE', { hour12: true })}] ${r[1]} (${r[2]}): ${r[4]} -> ${r[5]}`
  );
}

function registrarAccionAuditoria(user, accion, detalles) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const hoja = SS.getSheetByName(SHEET_AUDITORIA);
    if (!hoja) return;
    hoja.appendRow([new Date(), user ? user.usuario : "SISTEMA", user ? user.rol : "N/A", user ? user.estado : "N/A", accion, detalles || ""]);
    SpreadsheetApp.flush();
  } catch (e) { console.error("Error Auditoría: " + e.message); } finally { lock.releaseLock(); }
}

// ============================================================
// INICIALIZAR HOJA DB_DATA_DEF
// Crea (o recrea) la hoja con el nuevo esquema de 9 franjas horarias
// copiando estado/municipio/centros/mesas desde DB_DATA.
// Estructura nueva:
//   A: ESTADO | B: MUNICIPIOS | C: CENTROS TOTALES | D: CENTROS ELECTORALES ACTIVOS 8:00 AM
//   E: FALTAN (fórmula) | F: EFECTIVIDAD (fórmula) | G: MESAS TOTALES | H: MESAS ACTIVAS
//   I: FALTANTES (fórmula) | J: EFECTIVIDAD MESAS (fórmula)
//   K(10): 9:00 AM | L(11): 10:00 AM | M(12): 11:00 AM | N(13): 12:00 M | O(14): 1:00 PM
//   P(15): 2:00 PM | Q(16): 3:00 PM  | R(17): 4:00 PM  | S(18): 5:00 PM | T(19): 6-8:00 PM | U(20): TOTAL
// ============================================================
function ejecutarInicializacionDB(nombreUsuario, rolUsuario) {
  let hojaNew = SS.getSheetByName("DB_DATA_DEF");
  if (hojaNew) {
    hojaNew.clearContents();
  } else {
    hojaNew = SS.insertSheet("DB_DATA_DEF");
  }

  // Encabezados
  const headers = [
    "ESTADO","MUNICIPIOS","CANTIDAD DE CENTROS TOTALES",
    "CENTROS ELECTORALES ACTIVOS 8:00 AM","FALTAN","EFECTIVIDAD",
    "MESAS TOTALES","MESAS ACTIVAS","FALTANTES","EFECTIVIDAD MESAS",
    "9:00 AM","10:00 AM","11:00 AM","12:00 M","1:00 PM","2:00 PM",
    "3:00 PM","4:00 PM","5:00 PM","6:00-8:00 PM","TOTAL"
  ];
  hojaNew.getRange(1, 1, 1, headers.length).setValues([headers]);

  // Copiar datos estructurales de DB_DATA (sin las horas antiguas)
  const hojaOld = SS.getSheetByName("DB_DATA");
  if (hojaOld) {
    const datosViejos = hojaOld.getDataRange().getValues().slice(1);
    const registros = datosViejos
      .filter(f => f[0] && f[0].toString().trim() !== "")
      .map(f => [
        f[0] || "", f[1] || "",       // Estado, Municipio
        Number(f[2]) || 0,             // Centros Totales
        Number(f[3]) || 0,             // Centros Activos (8AM)
        0, 0,                          // FALTAN y EFECTIVIDAD (fórmulas abajo)
        Number(f[6]) || 0,             // Mesas Totales
        Number(f[7]) || 0,             // Mesas Activas
        0, 0,                          // FALTANTES MESAS y EFECTIVIDAD MESAS (fórmulas)
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0,  // 10 columnas de horas en cero
        0                              // TOTAL
      ]);

    if (registros.length > 0) {
      hojaNew.getRange(2, 1, registros.length, headers.length).setValues(registros);

      // Agregar fórmulas para columnas calculadas
      const n = registros.length;
      const fE  = Array.from({length: n}, (_, i) => [`=IF(C${i+2}>0,C${i+2}-D${i+2},0)`]);
      const fF  = Array.from({length: n}, (_, i) => [`=IFERROR(D${i+2}/C${i+2}*100,0)`]);
      const fI  = Array.from({length: n}, (_, i) => [`=IF(G${i+2}>0,G${i+2}-H${i+2},0)`]);
      const fJ  = Array.from({length: n}, (_, i) => [`=IFERROR(H${i+2}/G${i+2}*100,0)`]);
      const fT  = Array.from({length: n}, (_, i) => [`=SUM(K${i+2}:T${i+2})`]);

      hojaNew.getRange(2, 5, n, 1).setFormulas(fE);
      hojaNew.getRange(2, 6, n, 1).setFormulas(fF);
      hojaNew.getRange(2, 9, n, 1).setFormulas(fI);
      hojaNew.getRange(2, 10, n, 1).setFormulas(fJ);
      hojaNew.getRange(2, 21, n, 1).setFormulas(fT);
    }
  }

  // Formato del encabezado
  hojaNew.getRange(1, 1, 1, headers.length)
    .setBackground("#003366")
    .setFontColor("#FFFFFF")
    .setFontWeight("bold");

  // Congelar primera fila y primera columna
  hojaNew.setFrozenRows(1);
  hojaNew.setFrozenColumns(1);

  registrarAccionAuditoria({usuario: nombreUsuario || "SISTEMA", rol: rolUsuario || "AutoInit"}, "INICIALIZAR HOJA", "DB_DATA_DEF creada con " + (hojaNew.getLastRow() - 1) + " registros");
  SpreadsheetApp.flush();

  return { success: true, filas: hojaNew.getLastRow() - 1, mensaje: "DB_DATA_DEF inicializada correctamente con " + (hojaNew.getLastRow() - 1) + " registros." };
}

function inicializarHojaDB_DATA_DEF(token) {
  if (!validarSesion(token)) throw new Error("Acceso denegado 🔐");

  // Verificar rol Admin
  const hojaU = SS.getSheetByName(SHEET_USUARIOS);
  const users  = hojaU.getDataRange().getValues();
  const sesionU = users.find(u => u[6].toString() === token || u[8].toString() === token);
  if (!sesionU || sesionU[3] !== "Admin") throw new Error("Solo el Admin puede inicializar la hoja 🔐");

  return ejecutarInicializacionDB(sesionU[1], sesionU[3]);
}