/**
 * Admin.gs - Versión Suite Pro con 9 Franjas Horarias
 * ACTUALIZADO: 9AM, 11AM, 12M, 1PM, 2PM, 3PM, 4PM, 5PM, 6-8PM
 *
 * Estructura de DB_DATA_DEF:
 *   A(0)=ESTADO  B(1)=MUNICIPIO  C(2)=CENTROS_TOT  D(3)=CENTROS_ACTIVOS(8AM)
 *   E(4)=FALTAN  F(5)=EFECTIVIDAD  G(6)=MESAS_TOT  H(7)=MESAS_ACTIVAS
 *   I(8)=FALT_MESAS  J(9)=EFEC_MESAS
 *   K(10)=9AM  L(11)=11AM  M(12)=12M  N(13)=1PM  O(14)=2PM
 *   P(15)=3PM  Q(16)=4PM   R(17)=5PM  S(18)=6-8PM  T(19)=TOTAL
 *
 * Estructura de CONFIG:
 *   A=Estado  B(idx1)=h9 C(idx2)=h10 D(idx3)=h11 E(idx4)=h12 F(idx5)=h13 G(idx6)=h14
 *   H(idx7)=h15 I(idx8)=h16 J(idx9)=h17 K(idx10)=h20
 *   (Aviso en L2/M2/N2 — ver Main.gs)
 */

// ============================================================
// HELPER: Evalúa si una franja debe estar bloqueada
// ============================================================
function evaluarEstadoBloqueo(valorBD, autoCerradoPorReloj) {
  if (valorBD === false || valorBD === "FALSE") return false;
  if (valorBD === true  || valorBD === "TRUE")  return true;
  return autoCerradoPorReloj;
}

// ============================================================
// HELPER: Calcula los 9 cierres automáticos por reloj
// Cada franja abre cuando termina la anterior (+ 10 min de gracia)
// ============================================================
function calcularAutoBloqueos(mins) {
  return {
    h9:  !(mins < 550),                       // Abre al inicio, cierra a 9:10AM
    h10: !(mins >= 550  && mins < 610),       // Abre 9:10AM, cierra 10:10AM
    h11: !(mins >= 610  && mins < 670),       // Abre 10:10AM, cierra 11:10AM
    h12: !(mins >= 670  && mins < 730),       // Abre 11:10AM, cierra 12:10PM
    h13: !(mins >= 730  && mins < 790),       // Abre 12:10PM, cierra 1:10PM
    h14: !(mins >= 790  && mins < 850),       // Abre 1:10PM,  cierra 2:10PM
    h15: !(mins >= 850  && mins < 910),       // Abre 2:10PM,  cierra 3:10PM
    h16: !(mins >= 910  && mins < 970),       // Abre 3:10PM,  cierra 4:10PM
    h17: !(mins >= 970  && mins < 1030),      // Abre 4:10PM,  cierra 5:10PM
    h20: !(mins >= 1030 && mins < 1210)       // Abre 5:10PM,  cierra 8:10PM
  };
}

// ============================================================
// HELPER: Calcula bloqueos finales mezclando BD + reloj
// ============================================================
function calcularBloqueos(filaConfig, autoBloqueos) {
  const fc = filaConfig || [];
  return {
    h9:  evaluarEstadoBloqueo(fc[1], autoBloqueos.h9),
    h10: evaluarEstadoBloqueo(fc[2], autoBloqueos.h10),
    h11: evaluarEstadoBloqueo(fc[3], autoBloqueos.h11),
    h12: evaluarEstadoBloqueo(fc[4], autoBloqueos.h12),
    h13: evaluarEstadoBloqueo(fc[5], autoBloqueos.h13),
    h14: evaluarEstadoBloqueo(fc[6], autoBloqueos.h14),
    h15: evaluarEstadoBloqueo(fc[7], autoBloqueos.h15),
    h16: evaluarEstadoBloqueo(fc[8], autoBloqueos.h16),
    h17: evaluarEstadoBloqueo(fc[9], autoBloqueos.h17),
    h20: evaluarEstadoBloqueo(fc[10], autoBloqueos.h20)
  };
}

// ============================================================
// OBTENER DATA ELECTORAL (Monitor Estadal)
// ============================================================
function obtenerDataElectoral(estado, rol) {
  let hojaData   = SS.getSheetByName(SHEET_DATA);
  let datos = [];
  if (hojaData) {
    datos = hojaData.getDataRange().getValues().slice(1);
  }
  if (!hojaData || datos.length === 0) {
    try {
      ejecutarInicializacionDB("SISTEMA", "AutoInit");
      hojaData = SS.getSheetByName(SHEET_DATA);
      if (hojaData) {
        datos = hojaData.getDataRange().getValues().slice(1);
      }
    } catch (e) {
      if (!hojaData) {
        throw new Error("La hoja '" + SHEET_DATA + "' no existe y falló la inicialización automática: " + e.message);
      }
    }
  }
  const hojaConfig = SS.getSheetByName(SHEET_CONFIG);

  const configTotal = hojaConfig ? hojaConfig.getDataRange().getValues() : [];
  const esAdmin    = (rol === "Analista" || rol === "Admin");

  const estadoLimpio = (estado || "").toString().toUpperCase().trim();

  let filaConfig = configTotal.find(r => r && r[0] && r[0].toString().toUpperCase().trim() === estadoLimpio);
  if (!filaConfig) filaConfig = configTotal.find(r => r && r[0] && r[0].toString().toUpperCase().trim() === "GLOBAL");

  const now  = new Date();
  const mins = now.getHours() * 60 + now.getMinutes();
  const auto = calcularAutoBloqueos(mins);
  const bloqueosInterfaz = calcularBloqueos(filaConfig, auto);

  const municipios = datos
    .filter(f => esAdmin ? true : (f[0] && f[0].toString().toUpperCase().trim() === estadoLimpio))
    .map(f => {
      const cTotales = Number(f[2]) || 0;
      const cActivos = Number(f[3]) || 0;
      const cEfecNum = cTotales > 0 ? ((cActivos / cTotales) * 100).toFixed(2) : "0.00";

      const mTotales = Number(f[6]) || 0;
      const mActivas = Number(f[7]) || 0;
      const mEfecNum = mTotales > 0 ? ((mActivas / mTotales) * 100).toFixed(2) : "0.00";

      return {
        estado: f[0], municipio: f[1],
        cTotales, cActivos,
        cFaltan: cTotales - cActivos, cEfectividad: cEfecNum,
        mTotales, mActivas,
        mFaltan: mTotales - mActivas, mEfectividad: mEfecNum,
        // 10 franjas horarias
        h9:  f[10] || 0, h10: f[11] || 0, h11: f[12] || 0, h12: f[13] || 0,
        h13: f[14] || 0, h14: f[15] || 0, h15: f[16] || 0,
        h16: f[17] || 0, h17: f[18] || 0, h20: f[19] || 0
      };
    });

  return { municipios, bloqueos: bloqueosInterfaz };
}

// ============================================================
// ACTUALIZAR TABLA ELECTORAL (Guardar datos)
// Escribe en: D(4)=cActivos, H(8)=mActivas, cols K-S(11-19)=9 horas
// ============================================================
function actualizarTablaElectoral(filasNuevas, user, token) {
  if (!validarSesion(token)) throw new Error("Sesión expirada ⚠️");

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    const hoja = SS.getSheetByName(SHEET_DATA);
    if (!hoja) throw new Error("La hoja '" + SHEET_DATA + "' no existe. Por favor, inicialice la base de datos en el Panel de Administración.");

    // ⚡ BATCH READ: leer todo el rango UNA sola vez
    const rango    = hoja.getDataRange();
    const registros = rango.getValues();

    const configTotal = SS.getSheetByName(SHEET_CONFIG).getDataRange().getValues();
    const now  = new Date();
    const mins = now.getHours() * 60 + now.getMinutes();
    const auto = calcularAutoBloqueos(mins);

    // ⚡ MAP INDEX: índice O(1) por estado+municipio
    const indice = new Map();
    for (let i = 1; i < registros.length; i++) {
      indice.set(
        (registros[i][0] || "").toString().toUpperCase() + "||" + (registros[i][1] || "").toString().toUpperCase(),
        i
      );
    }

    // ⚡ MODIFICAR EN MEMORIA: no tocar Sheets dentro del bucle
    filasNuevas.forEach(datos => {
      const key = (datos.estado || "").toString().toUpperCase() + "||" + (datos.municipio || "").toString().toUpperCase();
      const idx = indice.get(key);
      if (idx === undefined) return;

      let fc = configTotal.find(r => r && r[0] && r[0].toString().toUpperCase().trim() === (datos.estado || "").toString().toUpperCase().trim());
      if (!fc) fc = configTotal.find(r => r && r[0] && r[0].toString().toUpperCase().trim() === "GLOBAL");

      const b = calcularBloqueos(fc, auto);

      // Leer valores actuales (para preservar si bloqueado)
      const act = {
        h9:  registros[idx][10], h10: registros[idx][11], h11: registros[idx][12],
        h12: registros[idx][13], h13: registros[idx][14],
        h14: registros[idx][15], h15: registros[idx][16],
        h16: registros[idx][17], h17: registros[idx][18],
        h20: registros[idx][19]
      };

      // Validar que centros activos no superen el total
      const centrosTotales = Number(registros[idx][2]);
      const centrosActivos = Number(datos.cActivos);
      if (centrosActivos > centrosTotales) {
        throw new Error(`Límite excedido en ${datos.municipio}: ${centrosActivos} reportados de ${centrosTotales} totales.`);
      }

      // ⚙️ MODIFICAR ARRAY EN MEMORIA
      registros[idx][3] = centrosActivos;
      registros[idx][7] = Number(datos.mActivas) || 0;
      registros[idx][10] = b.h9  ? act.h9  : (Number(datos.h9)  || 0);
      registros[idx][11] = b.h10 ? act.h10 : (Number(datos.h10) || 0);
      registros[idx][12] = b.h11 ? act.h11 : (Number(datos.h11) || 0);
      registros[idx][13] = b.h12 ? act.h12 : (Number(datos.h12) || 0);
      registros[idx][14] = b.h13 ? act.h13 : (Number(datos.h13) || 0);
      registros[idx][15] = b.h14 ? act.h14 : (Number(datos.h14) || 0);
      registros[idx][16] = b.h15 ? act.h15 : (Number(datos.h15) || 0);
      registros[idx][17] = b.h16 ? act.h16 : (Number(datos.h16) || 0);
      registros[idx][18] = b.h17 ? act.h17 : (Number(datos.h17) || 0);
      registros[idx][19] = b.h20 ? act.h20 : (Number(datos.h20) || 0);
    });

    // ⚡ BATCH WRITE: escribir TODO el rango de vuelta en UNA operación
    rango.setValues(registros);

    registrarAccionAuditoria(user, "ACTUALIZACIÓN DATA", `Carga procesada: ${filasNuevas.length} registros.`);
    SpreadsheetApp.flush();

    // Invalidar caché de estadísticas para que los dashboards vean los datos frescos
    invalidarCacheEstadisticas();

    return { success: true };
  } catch (e) {
    throw new Error("Fallo en persistencia: " + e.message);
  } finally {
    lock.releaseLock();
  }
}

// ============================================================
// OBTENER CONFIGURACIÓN DE BLOQUEOS
// ============================================================
function obtenerConfiguracionBloqueos(estadoTarget) {
  const hoja  = SS.getSheetByName(SHEET_CONFIG);
  const datos = hoja.getDataRange().getValues();
  let config  = datos.find(r => r && r[0] && r[0].toString().trim().toUpperCase() === (estadoTarget || "").toString().trim().toUpperCase());
  if (!config) config = datos.find(r => r && r[0] && r[0].toString().trim().toUpperCase() === "GLOBAL");

  const now  = new Date();
  const mins = now.getHours() * 60 + now.getMinutes();
  const auto = calcularAutoBloqueos(mins);

  return calcularBloqueos(config, auto);
}

// ============================================================
// CONTROL MAESTRO — Toggle de bloqueo por hora/estado
// mapaHoras: nombre → columna en CONFIG (1-indexed)
// h9=2, h11=3, h12=4, h13=5, h14=6, h15=7, h16=8, h17=9, h20=10
// ============================================================
function actualizarBloqueoDetallado(estadoTarget, horaId, nuevoEstatus, tokenAdmin) {
  if (!validarSesion(tokenAdmin)) throw new Error("Acceso denegado 🔐");

  const hoja  = SS.getSheetByName(SHEET_CONFIG);
  const datos = hoja.getDataRange().getValues();
  const mapaHoras = { "h9":2, "h11":3, "h12":4, "h13":5, "h14":6, "h15":7, "h16":8, "h17":9, "h20":10 };
  const col = mapaHoras[horaId];

  if (!col) throw new Error("ID de hora no válido: " + horaId + " ❌");

  const valorAGuardar = nuevoEstatus ? true : false;

  if (estadoTarget.toUpperCase() === "GLOBAL") {
    const lastRow = hoja.getLastRow();
    if (lastRow > 1) {
      const valoresMasivos = Array.from({length: lastRow - 1}, () => [valorAGuardar]);
      hoja.getRange(2, col, lastRow - 1, 1).setValues(valoresMasivos);
    }
  } else {
    let filaIndex = datos.findIndex(r => r && r[0] && r[0].toString().trim().toUpperCase() === (estadoTarget || "").toString().trim().toUpperCase());
    if (filaIndex === -1) {
      // Agregar fila para el estado con 9 slots vacíos
      hoja.appendRow([estadoTarget, "", "", "", "", "", "", "", "", ""]);
      filaIndex = hoja.getLastRow() - 1;
    }
    hoja.getRange(filaIndex + 1, col).setValue(valorAGuardar);
  }

  registrarAccionAuditoria({usuario: "ADMIN"}, "CONTROL MAESTRO",
    `${estadoTarget} - ${horaId} -> ${nuevoEstatus ? 'BLOQUEADO MANUAL' : 'ABIERTO MANUAL'}`);
  return true;
}

// ============================================================
// LIBERAR ESTADO COMPLETO (Volver al modo automático reloj)
// ============================================================
function liberarEstadoCompleto(estadoTarget, tokenAdmin) {
  if (!validarSesion(tokenAdmin)) throw new Error("Acceso denegado 🔐");

  const hoja  = SS.getSheetByName(SHEET_CONFIG);
  const datos = hoja.getDataRange().getValues();

  if (estadoTarget.toUpperCase() === "GLOBAL") {
    const lastRow = hoja.getLastRow();
    if (lastRow > 1) {
      const emptyVals = Array.from({length: lastRow - 1}, () => ["","","","","","","","",""]);
      hoja.getRange(2, 2, lastRow - 1, 9).setValues(emptyVals);
    }
  } else {
    const filaIndex = datos.findIndex(r => r && r[0] && r[0].toString().trim().toUpperCase() === (estadoTarget || "").toString().toUpperCase().trim());
    if (filaIndex !== -1) {
      hoja.getRange(filaIndex + 1, 2, 1, 9).setValues([["","","","","","","","",""]]);
    }
  }

  registrarAccionAuditoria({usuario: "ADMIN"}, "LIBERACIÓN (MODO AUTOMÁTICO)", estadoTarget);
  return true;
}

// ============================================================
// EXPULSAR USUARIO
// ============================================================
function expulsarUsuario(nombreUsuario, tokenAdmin) {
  if (!validarSesion(tokenAdmin)) throw new Error("Acceso denegado 🔐");
  try {
    const hoja = SS.getSheetByName("DB_USUARIOS");
    const usuarios = hoja.getRange("B:B").getValues();
    const target = nombreUsuario.toString().trim().toLowerCase();
    let filaEncontrada = -1;
    for (let i = 0; i < usuarios.length; i++) {
      if (usuarios[i][0].toString().trim().toLowerCase() === target) {
        filaEncontrada = i + 1; break;
      }
    }
    if (filaEncontrada !== -1) {
      hoja.getRange(filaEncontrada, 7).clearContent();
      hoja.getRange(filaEncontrada, 9).clearContent();
      registrarAccionAuditoria({usuario: "ADMIN"}, "EXPULSIÓN", `Acceso revocado a: ${nombreUsuario}`);
      return true;
    } else {
      throw new Error(`El usuario '${target}' no existe.`);
    }
  } catch (e) { throw new Error("Error al expulsar: " + e.message); }
}

// ============================================================
// EXPORTAR AUDITORÍA CSV
// ============================================================
function generarCSVAuditoria(token) {
  if (!validarSesion(token)) throw new Error("Acceso denegado 🔒");
  const hojaUser = SS.getSheetByName(SHEET_USUARIOS);
  const users    = hojaUser.getDataRange().getValues();
  const sessionUser = users.find(u => u[6].toString() === token || u[8].toString() === token);

  if (!sessionUser || (sessionUser[3] !== "Admin" && sessionUser[3] !== "Analista")) {
    throw new Error("No tiene permisos para exportar este registro.");
  }

  const hoja  = SS.getSheetByName(SHEET_AUDITORIA);
  const datos = hoja.getDataRange().getValues();
  if (datos.length < 2) return "No hay datos";

  const csv = datos.map(fila =>
    fila.map(celda => {
      let texto = celda ? celda.toString().replace(/"/g, '""').replace(/\n/g, ' ') : "";
      return `"${texto}"`;
    }).join(",")
  ).join("\n");

  registrarAccionAuditoria({usuario: sessionUser[1], rol: sessionUser[3]}, "EXPORTAR AUDITORÍA", "Descarga de bitácora");
  return csv;
}

// ============================================================
// EXPORTAR MONITOR A EXCEL (9 franjas horarias)
// ============================================================
function obtenerDataExportacionMonitor(token) {
  if (!validarSesion(token)) throw new Error("Sesión expirada ⚠️");

  const hojaUser = SS.getSheetByName(SHEET_USUARIOS);
  const dataUsers = hojaUser.getDataRange().getValues();
  const userRow = dataUsers.find(u => u[6].toString() === token || u[8].toString() === token);
  if (!userRow) throw new Error("Usuario no identificado");

  const rol       = userRow[3];
  const estadoUser = userRow[4];
  const esGlobal  = (rol === "Admin" || rol === "Analista" || rol === "Operador Auxiliar");

  const hojaData = SS.getSheetByName(SHEET_DATA);
  if (!hojaData) throw new Error("La hoja '" + SHEET_DATA + "' no existe. Por favor, inicialice la base de datos en el Panel de Administración.");
  const datos    = hojaData.getDataRange().getValues();

  let matriz = [[
    "ESTADO","MUNICIPIO","CENTROS TOTALES","CENTROS ELECTORALES ACTIVOS 8AM","% APERTURA",
    "MESAS TOTALES","MESAS ACTIVAS","% MESAS",
    "9:00 AM","11:00 AM","12:00 M","1:00 PM","2:00 PM","3:00 PM","4:00 PM","5:00 PM","6-8:00 PM",
    "TOTAL VOTOS"
  ]];

  let sumCT=0, sumCA=0, sumMT=0, sumMA=0;
  let sumH9=0, sumH11=0, sumH12=0, sumH13=0, sumH14=0;
  let sumH15=0, sumH16=0, sumH17=0, sumH20=0;
  let sumVotosTotal = 0;

  for (let i = 1; i < datos.length; i++) {
    const row      = datos[i];
    const rowEdo   = row[0].toString();
    if (!esGlobal && rowEdo !== estadoUser) continue;

    const cT   = Number(row[2]) || 0;
    const cA   = Number(row[3]) || 0;
    const pctC = cT > 0 ? ((cA/cT)*100).toFixed(2) + "%" : "0%";

    const mT   = Number(row[6]) || 0;
    const mA   = Number(row[7]) || 0;
    const pctM = mT > 0 ? ((mA/mT)*100).toFixed(2) + "%" : "0%";

    const v9  = Number(row[10])||0; const v11 = Number(row[11])||0;
    const v12 = Number(row[12])||0; const v13 = Number(row[13])||0;
    const v14 = Number(row[14])||0; const v15 = Number(row[15])||0;
    const v16 = Number(row[16])||0; const v17 = Number(row[17])||0;
    const v20 = Number(row[18])||0;
    const totalMun = v9+v11+v12+v13+v14+v15+v16+v17+v20;

    sumCT += cT; sumCA += cA;
    sumMT += mT; sumMA += mA;
    sumH9+=v9; sumH11+=v11; sumH12+=v12; sumH13+=v13; sumH14+=v14;
    sumH15+=v15; sumH16+=v16; sumH17+=v17; sumH20+=v20;
    sumVotosTotal += totalMun;

    matriz.push([
      row[0], row[1],
      cT, cA, pctC,
      mT, mA, pctM,
      v9, v11, v12, v13, v14, v15, v16, v17, v20,
      totalMun
    ]);
  }

  const pctC_T = sumCT > 0 ? ((sumCA/sumCT)*100).toFixed(2)+"%" : "0%";
  const pctM_T = sumMT > 0 ? ((sumMA/sumMT)*100).toFixed(2)+"%" : "0%";
  matriz.push([
    "TOTAL GENERAL","---",
    sumCT, sumCA, pctC_T,
    sumMT, sumMA, pctM_T,
    sumH9, sumH11, sumH12, sumH13, sumH14, sumH15, sumH16, sumH17, sumH20,
    sumVotosTotal
  ]);

  registrarAccionAuditoria({usuario: userRow[1], rol}, "DESCARGA MONITOR", "Reporte Excel 9 franjas generado");
  return matriz;
}