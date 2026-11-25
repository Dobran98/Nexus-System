/**
 * Condominios.gs - Módulo de Reporte de Votantes por Condominios/Urbanizaciones
 * VERSIÓN 1.0 — Con 10 franjas horarias (incluye 10:00 AM, agregada de última hora)
 *
 * Estructura DB_CONDOMINIOS:
 *   A(0)=ESTADO  B(1)=MUNICIPIO  C(2)=PARROQUIA  D(3)=CONDOMINIO
 *   E(4)=RESPONSABLE  F(5)=TELEFONO  G(6)=TOTAL_VOTANTES_REG
 *   H(7)=h9   I(8)=h10  J(9)=h11   K(10)=h12  L(11)=h13
 *   M(12)=h14  N(13)=h15  O(14)=h16  P(15)=h17  Q(16)=h20
 *   R(17)=TOTAL (fórmula)  S(18)=% CUMPLIMIENTO (fórmula)
 *
 * Roles con acceso (mismos que Monitor Estadal):
 *   Admin, Analista → visión nacional + edición + agregar condominios
 *   Operador, Estadal Reporte → visión estadal + edición
 *   Operador Auxiliar, Operador 0800 → sin acceso
 */

// Franjas horarias para condominios: incluye 10:00 AM
const COND_HORAS_KEYS   = ['h9','h10','h11','h12','h13','h14','h15','h16','h17','h20'];
const COND_HORAS_LABELS = ['9:00 AM','10:00 AM','11:00 AM','12:00 M','1:00 PM','2:00 PM','3:00 PM','4:00 PM','5:00 PM','6-8:00 PM'];

// Índice de columnas de horas en el array de la hoja (0-indexed)
const COND_HORAS_IDX = { h9:7, h10:8, h11:9, h12:10, h13:11, h14:12, h15:13, h16:14, h17:15, h20:16 };

// Roles que tienen acceso al módulo
function _condRolPermitido(rol) {
  return ['Admin','Analista','Operador','Estadal Reporte','Estadal Auxiliar'].includes(rol);
}
function _condRolNacional(rol) {
  return ['Admin','Analista'].includes(rol);
}

// ============================================================
// OBTENER DATA CONDOMINIOS — Con filtrado RBAC por rol/estado
// ============================================================
function obtenerDataCondominios(estadoUsuario, rol) {
  if (!_condRolPermitido(rol)) {
    throw new Error("Su rol no tiene acceso al módulo de Condominios ⛔");
  }

  try {
    const hoja = SS.getSheetByName(SHEET_CONDOMINIOS);
    if (!hoja) return { puedeEditar: false, puedeAgregar: false, registros: [], error: 'HOJA_NO_EXISTE' };

    const datos = hoja.getDataRange().getValues();
    if (datos.length < 2) return { puedeEditar: true, puedeAgregar: _condRolNacional(rol), registros: [] };

    const esNacional  = _condRolNacional(rol);
    const estadoLimpio = (estadoUsuario || "").toString().toUpperCase().trim();

    const dataFiltrada = datos.slice(1).filter(f =>
      esNacional ? true : (f[0] && f[0].toString().toUpperCase().trim() === estadoLimpio)
    );

    const registros = dataFiltrada.map(f => ({
      estado:            f[0] ? f[0].toString() : "",
      municipio:         f[1] ? f[1].toString() : "",
      parroquia:         f[2] ? f[2].toString() : "",
      condominio:        f[3] ? f[3].toString() : "",
      responsable:       f[4] ? f[4].toString() : "No asignado",
      telefono:          f[5] ? f[5].toString() : "N/A",
      totalReg:          Number(f[6]) || 0,
      h9:  Number(f[7])  || 0,
      h10: Number(f[8])  || 0,
      h11: Number(f[9])  || 0,
      h12: Number(f[10]) || 0,
      h13: Number(f[11]) || 0,
      h14: Number(f[12]) || 0,
      h15: Number(f[13]) || 0,
      h16: Number(f[14]) || 0,
      h17: Number(f[15]) || 0,
      h20: Number(f[16]) || 0
    }));

    return {
      puedeEditar:   _condRolPermitido(rol),
      puedeAgregar:  _condRolNacional(rol),
      registros
    };
  } catch (e) {
    console.error("Error obtenerDataCondominios: " + e.message);
    throw new Error("Error al obtener condominios: " + e.message);
  }
}

// ============================================================
// GUARDAR REPORTE DE CONDOMINIOS — Batch update con LockService
// Respeta los mismos bloqueos horarios del sistema principal
// ============================================================
function guardarReporteCondominios(filasModificadas, user, token) {
  if (!validarSesion(token)) throw new Error("Sesión expirada ⚠️");
  if (!_condRolPermitido(user.rol)) throw new Error("No tiene permisos para guardar en Condominios ⛔");

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);

    const hoja = SS.getSheetByName(SHEET_CONDOMINIOS);
    if (!hoja) throw new Error("La hoja 'DB_CONDOMINIOS' no existe. Créela primero desde el Panel Admin.");

    // ⚡ BATCH READ
    const rango     = hoja.getDataRange();
    const registros = rango.getValues();

    // ⚡ MAP INDEX O(1)
    const indice = new Map();
    for (let i = 1; i < registros.length; i++) {
      const key = (registros[i][0]||"").toString().toUpperCase() + "||" +
                  (registros[i][1]||"").toString().toUpperCase() + "||" +
                  (registros[i][3]||"").toString().toUpperCase();
      indice.set(key, i);
    }

    // Obtener bloqueos horarios actuales (mismo motor que el monitor principal)
    const now  = new Date();
    const mins = now.getHours() * 60 + now.getMinutes();
    const auto = calcularAutoBloqueos(mins);
    // Para h10 (10AM): abierto entre 9:10AM y 11:10AM (min 550 a 670)
    const h10Auto = !(mins >= 550 && mins < 670);

    // ⚙️ MODIFICAR EN MEMORIA
    filasModificadas.forEach(datos => {
      const key = (datos.estado||"").toUpperCase() + "||" +
                  (datos.municipio||"").toUpperCase() + "||" +
                  (datos.condominio||"").toUpperCase();
      const idx = indice.get(key);
      if (idx === undefined) return;

      // Preservar valores en franjas bloqueadas
      const actuales = registros[idx];

      // 10 franjas horarias
      registros[idx][7]  = auto.h9   ? actuales[7]  : (Number(datos.h9)  || 0);
      registros[idx][8]  = h10Auto   ? actuales[8]  : (Number(datos.h10) || 0);
      registros[idx][9]  = auto.h11  ? actuales[9]  : (Number(datos.h11) || 0);
      registros[idx][10] = auto.h12  ? actuales[10] : (Number(datos.h12) || 0);
      registros[idx][11] = auto.h13  ? actuales[11] : (Number(datos.h13) || 0);
      registros[idx][12] = auto.h14  ? actuales[12] : (Number(datos.h14) || 0);
      registros[idx][13] = auto.h15  ? actuales[13] : (Number(datos.h15) || 0);
      registros[idx][14] = auto.h16  ? actuales[14] : (Number(datos.h16) || 0);
      registros[idx][15] = auto.h17  ? actuales[15] : (Number(datos.h17) || 0);
      registros[idx][16] = auto.h20  ? actuales[16] : (Number(datos.h20) || 0);
    });

    // ⚡ BATCH WRITE
    rango.setValues(registros);
    registrarAccionAuditoria(user, "ACTUALIZACIÓN CONDOMINIOS", `${filasModificadas.length} condominios actualizados.`);
    SpreadsheetApp.flush();
    invalidarCacheEstadisticas();
    return { success: true };
  } catch (e) {
    throw new Error("Error al guardar condominios: " + e.message);
  } finally {
    lock.releaseLock();
  }
}

// ============================================================
// AGREGAR NUEVO CONDOMINIO — Solo Admin/Analista
// ============================================================
function agregarCondominio(datos, user, token) {
  if (!validarSesion(token)) throw new Error("Sesión expirada ⚠️");
  if (!_condRolNacional(user.rol)) throw new Error("Solo Admin/Analista pueden agregar condominios ⛔");

  if (!datos.estado || !datos.municipio || !datos.condominio) {
    throw new Error("Estado, Municipio y Nombre del Condominio son obligatorios ❌");
  }

  const hoja = SS.getSheetByName(SHEET_CONDOMINIOS);
  if (!hoja) throw new Error("La hoja 'DB_CONDOMINIOS' no existe.");

  // Verificar que no exista ya
  const registros = hoja.getDataRange().getValues();
  const existe = registros.some(r =>
    r[0] && r[0].toString().toUpperCase() === datos.estado.toUpperCase() &&
    r[1] && r[1].toString().toUpperCase() === datos.municipio.toUpperCase() &&
    r[3] && r[3].toString().toUpperCase() === datos.condominio.toUpperCase()
  );
  if (existe) throw new Error(`El condominio '${datos.condominio}' ya existe en ${datos.municipio} ❌`);

  const totalCols = 17; // A hasta Q (sin fórmulas, se agregan manual)
  const nuevaFila = [
    datos.estado.toUpperCase().trim(),
    datos.municipio.toUpperCase().trim(),
    (datos.parroquia  || "").toUpperCase().trim(),
    datos.condominio.toUpperCase().trim(),
    datos.responsable || "",
    datos.telefono    || "",
    Number(datos.totalReg) || 0,
    0,0,0,0,0,0,0,0,0,0  // 10 horas en cero
  ];

  const lastRow = hoja.getLastRow();
  hoja.appendRow(nuevaFila);

  // Agregar fórmulas en columnas R y S
  const fila = lastRow + 1;
  hoja.getRange(fila, 18).setFormula(`=SUM(H${fila}:Q${fila})`);
  hoja.getRange(fila, 19).setFormula(`=IFERROR(R${fila}/G${fila}*100,0)`);

  registrarAccionAuditoria(user, "NUEVO CONDOMINIO",
    `Agregado: ${datos.condominio} en ${datos.municipio}, ${datos.estado}`);
  SpreadsheetApp.flush();
  return { success: true };
}

// ============================================================
// REINICIAR DATOS DE UN CONDOMINIO (botón Reinicio)
// Solo Admin/Analista pueden reiniciar
// ============================================================
function reiniciarCondominio(estado, municipio, condominio, user, token) {
  if (!validarSesion(token)) throw new Error("Sesión expirada ⚠️");
  if (!_condRolNacional(user.rol)) throw new Error("Solo Admin/Analista pueden reiniciar datos ⛔");

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    const hoja = SS.getSheetByName(SHEET_CONDOMINIOS);
    if (!hoja) throw new Error("La hoja 'DB_CONDOMINIOS' no existe.");

    const registros = hoja.getDataRange().getValues();
    const idx = registros.findIndex(r =>
      r[0] && r[0].toString().toUpperCase() === estado.toUpperCase() &&
      r[1] && r[1].toString().toUpperCase() === municipio.toUpperCase() &&
      r[3] && r[3].toString().toUpperCase() === condominio.toUpperCase()
    );

    if (idx === -1) throw new Error("Condominio no encontrado en la base de datos.");

    // Limpiar las 10 columnas de horas (H a Q = columnas 8 a 17)
    hoja.getRange(idx + 1, 8, 1, 10).setValues([[0,0,0,0,0,0,0,0,0,0]]);

    registrarAccionAuditoria(user, "REINICIO CONDOMINIO",
      `Datos reiniciados a 0: ${condominio} en ${municipio}, ${estado}`);
    SpreadsheetApp.flush();
    invalidarCacheEstadisticas();
    return { success: true };
  } catch (e) {
    throw new Error("Error al reiniciar: " + e.message);
  } finally {
    lock.releaseLock();
  }
}

// ============================================================
// REINICIAR TODOS LOS CONDOMINIOS DE UN ESTADO
// Solo Admin/Analista
// ============================================================
function reiniciarCondominiosPorEstado(estado, user, token) {
  if (!validarSesion(token)) throw new Error("Sesión expirada ⚠️");
  if (!_condRolNacional(user.rol)) throw new Error("Solo Admin/Analista pueden reiniciar datos ⛔");

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    const hoja = SS.getSheetByName(SHEET_CONDOMINIOS);
    if (!hoja) throw new Error("La hoja 'DB_CONDOMINIOS' no existe.");

    const registros = hoja.getDataRange().getValues();
    let count = 0;

    for (let i = 1; i < registros.length; i++) {
      if (registros[i][0] && registros[i][0].toString().toUpperCase() === estado.toUpperCase()) {
        hoja.getRange(i + 1, 8, 1, 10).setValues([[0,0,0,0,0,0,0,0,0,0]]);
        count++;
      }
    }

    registrarAccionAuditoria(user, "REINICIO MASIVO CONDOMINIOS",
      `${count} condominios reiniciados en ${estado}`);
    SpreadsheetApp.flush();
    invalidarCacheEstadisticas();
    return { success: true, count };
  } catch (e) {
    throw new Error("Error en reinicio masivo: " + e.message);
  } finally {
    lock.releaseLock();
  }
}

// ============================================================
// EXPORTAR CONDOMINIOS A XLSX
// ============================================================
function obtenerMatrizCondominiosExport(token) {
  if (!validarSesion(token)) throw new Error("Acceso denegado 🔒");

  const hojaUser    = SS.getSheetByName(SHEET_USUARIOS);
  const users       = hojaUser.getDataRange().getValues();
  const sessionUser = users.find(u => u[6].toString() === token || u[8].toString() === token);

  if (!sessionUser || !_condRolNacional(sessionUser[3])) {
    throw new Error("Su rol no tiene permisos para exportar condominios 🔒");
  }

  const hoja = SS.getSheetByName(SHEET_CONDOMINIOS);
  if (!hoja) throw new Error("La hoja 'DB_CONDOMINIOS' no existe.");

  const datos = hoja.getDataRange().getValues();
  if (datos.length < 2) throw new Error("No hay datos de condominios para exportar.");

  const matriz = [[
    "ESTADO","MUNICIPIO","PARROQUIA","CONDOMINIO","RESPONSABLE","TELÉFONO","TOTAL REG.",
    "9:00 AM","10:00 AM","11:00 AM","12:00 M","1:00 PM","2:00 PM","3:00 PM","4:00 PM","5:00 PM","6-8:00 PM",
    "TOTAL VOTOS","% CUMPLIMIENTO"
  ]];

  for (let i = 1; i < datos.length; i++) {
    const f = datos[i];
    if (!f[0]) continue;
    const totalReg  = Number(f[6])  || 0;
    const totalVot  = COND_HORAS_KEYS.reduce((s, k) => s + (Number(f[COND_HORAS_IDX[k]]) || 0), 0);
    const pctCumpl  = totalReg > 0 ? ((totalVot / totalReg) * 100).toFixed(2) + "%" : "0%";

    matriz.push([
      f[0], f[1], f[2], f[3], f[4], f[5], totalReg,
      Number(f[7])||0, Number(f[8])||0, Number(f[9])||0, Number(f[10])||0,
      Number(f[11])||0, Number(f[12])||0, Number(f[13])||0, Number(f[14])||0,
      Number(f[15])||0, Number(f[16])||0,
      totalVot, pctCumpl
    ]);
  }

  registrarAccionAuditoria(
    { usuario: sessionUser[1], rol: sessionUser[3] },
    "EXPORTAR CONDOMINIOS EXCEL", "Descarga de matriz completa de condominios"
  );
  return matriz;
}

// ============================================================
// ESTADÍSTICAS DE CONDOMINIOS (para gráficos del Panel Analítico)
// ============================================================
function obtenerEstadisticasCondominios() {
  try {
    const hoja = SS.getSheetByName(SHEET_CONDOMINIOS);
    if (!hoja) return null;

    const datos = hoja.getDataRange().getValues().slice(1).filter(f => f[0]);
    if (datos.length === 0) return null;

    let totalVotantes = 0, totalReg = 0;
    const porEstado = {};
    const topCondominios = [];

    datos.forEach(f => {
      const edo       = f[0] ? f[0].toString().toUpperCase() : "";
      const condNom   = f[3] ? f[3].toString() : "";
      const totalRegC = Number(f[6]) || 0;
      const votantes  = COND_HORAS_KEYS.reduce((s, k) => s + (Number(f[COND_HORAS_IDX[k]]) || 0), 0);

      totalReg      += totalRegC;
      totalVotantes += votantes;

      if (!porEstado[edo]) porEstado[edo] = { votantes: 0, totalReg: 0, count: 0 };
      porEstado[edo].votantes  += votantes;
      porEstado[edo].totalReg  += totalRegC;
      porEstado[edo].count++;

      topCondominios.push({ estado: edo, municipio: f[1], condominio: condNom, votantes, totalReg: totalRegC });
    });

    // Top 10 condominios con más votos
    const top10 = topCondominios.sort((a, b) => b.votantes - a.votantes).slice(0, 10);
    // Bottom 5 condominios sin reportar (votantes = 0)
    const sinReporte = topCondominios.filter(c => c.votantes === 0).slice(0, 5);
    const pctGlobal  = totalReg > 0 ? ((totalVotantes / totalReg) * 100).toFixed(2) : "0.00";

    return {
      totalCondominios: datos.length,
      totalVotantes,
      totalReg,
      pctGlobal,
      porEstado,
      top10,
      sinReporte,
      sinReporteCount: topCondominios.filter(c => c.votantes === 0).length
    };
  } catch (e) {
    console.error("Error obtenerEstadisticasCondominios: " + e.message);
    return null;
  }
}

// ============================================================
// INICIALIZAR HOJA DB_CONDOMINIOS (desde Panel Admin)
// ============================================================
function inicializarHojaCondominios(token) {
  if (!validarSesion(token)) throw new Error("Acceso denegado 🔐");

  const hojaU = SS.getSheetByName(SHEET_USUARIOS);
  const users  = hojaU.getDataRange().getValues();
  const sesionU = users.find(u => u[6].toString() === token || u[8].toString() === token);
  if (!sesionU || sesionU[3] !== "Admin") throw new Error("Solo el Admin puede inicializar la hoja 🔐");

  let hoja = SS.getSheetByName(SHEET_CONDOMINIOS);
  if (hoja) {
    hoja.clearContents();
  } else {
    hoja = SS.insertSheet(SHEET_CONDOMINIOS);
  }

  const headers = [
    "ESTADO","MUNICIPIO","PARROQUIA","CONDOMINIO","RESPONSABLE","TELÉFONO",
    "TOTAL VOTANTES REG.",
    "9:00 AM","10:00 AM","11:00 AM","12:00 M","1:00 PM","2:00 PM","3:00 PM","4:00 PM","5:00 PM","6-8:00 PM",
    "TOTAL","% CUMPLIMIENTO"
  ];

  hoja.getRange(1, 1, 1, headers.length).setValues([headers]);
  hoja.getRange(1, 1, 1, headers.length)
    .setBackground("#0d47a1")
    .setFontColor("#ffffff")
    .setFontWeight("bold");

  hoja.setFrozenRows(1);
  hoja.setFrozenColumns(4);

  registrarAccionAuditoria(
    { usuario: sesionU[1], rol: sesionU[3] },
    "INICIALIZAR HOJA",
    "DB_CONDOMINIOS creada con estructura de 10 franjas horarias"
  );
  SpreadsheetApp.flush();
  return { success: true, mensaje: "Hoja DB_CONDOMINIOS inicializada correctamente." };
}
