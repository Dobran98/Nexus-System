/**
 * ======================================================================
 * ORIANA — SISTEMA DE GESTIÓN
 * Backend: Acceso a Datos y Base de Registros (Database.js)
 * ======================================================================
 */

// ─── GUARDAR REPORTE ──────────────────────────────────────────────────────────

/**
 * Guarda los registros de un reporte.
 */
function guardarRegistro(pkg) {
  const lock = LockService.getScriptLock();
  let lockAcquired = false;
  try {
    lockAcquired = lock.tryLock(8000);
  } catch (e) {
    console.error("Error al intentar obtener lock: " + e);
  }

  if (!lockAcquired) {
    const encoladoOk = encolarReportePendiente(pkg);
    if (encoladoOk) {
      return { success: true, message: "✅ Reporte recibido y en cola para guardado automático en segundo plano." };
    } else {
      return { success: false, message: "El sistema está ocupado. Intente de nuevo en unos segundos." };
    }
  }

  try {
    const ss   = getSpreadsheet();
    const hoja = getOrCreateSheet(ss, NOMBRE_HOJA_REGISTROS);
    const regs = pkg.registros;
    const now  = new Date();
    const isAnalista = String(pkg.rol).toUpperCase().includes("ANALISTA");

    // ── Verificación de duplicados (solo para no-analistas) ───────────────
    if (!isAnalista) {
      const ult  = hoja.getLastRow();
      if (ult > 1) {
        // Optimización: leer solo los últimos 1000 registros para evitar sobrecarga en hojas grandes
        const filasALeer = Math.min(1000, ult - 1);
        const filaInicio = ult - filasALeer + 1;
        const data = hoja.getRange(filaInicio, 1, filasALeer, 6).getValues();
        for (let r = 0; r < regs.length; r++) {
          const d = regs[r];
          for (let i = 0; i < data.length; i++) {
            const fRow = data[i][2] instanceof Date
              ? Utilities.formatDate(data[i][2], Session.getScriptTimeZone(), "yyyy-MM-dd")
              : String(data[i][2]).substring(0, 10);
            const uRow = String(data[i][3]).trim().toLowerCase();
            const cRow = String(data[i][5]).trim().toLowerCase();

            if (uRow === String(d.usuario).trim().toLowerCase()
              && fRow === d.fechaReporte
              && cRow === String(d.campana).trim().toLowerCase()) {
              return { success: false, message: `⛔ Ya existe reporte de "${d.campana}" para el día ${d.fechaReporte}.` };
            }
          }
        }
      }
    }

    // Diccionarios de usuarios y turnos
    const dictNombres = {};
    const dictTurnos = {};
    try {
      const dataUsu = obtenerDatosUsuariosCached();
      for (let i = 1; i < dataUsu.length; i++) {
        const uKey = String(dataUsu[i][0]).trim().toLowerCase();
        dictNombres[uKey] = String(dataUsu[i][2] || dataUsu[i][0]).trim();
        dictTurnos[uKey] = String(dataUsu[i][4] || "MAÑANA").trim().toUpperCase();
      }
    } catch (e) {}

    // ── Escribir registros ─────────────────────────────────────────────────
    regs.forEach(d => {
      let ef   = d.efectivas;
      let kVal = d.municipios;
      const mUp = String(d.modo).toUpperCase();
      const esCustom = (d.variables && typeof d.variables === "object" && Object.keys(d.variables).length > 0);

      if (mUp.includes("ESPECIAL") || mUp.includes("ESEQUIBO") ||
          mUp.includes("ANALISTA") || mUp.includes("CUALITATIV") || esCustom) {
        ef   = d.efectivas;
        kVal = d.detalle;
      }

      // 1. Escribir en la base global consolidada (BD_Registros)
      hoja.appendRow([
        d.idOperador || "S/ID",
        now,
        d.fechaReporte,
        String(d.usuario).toUpperCase(),
        d.modo,
        d.campana,
        ef,
        d.totales     || 0,
        d.incidencias || 0,
        d.estados     || "",
        kVal          || "",
        "",
        "",
        d.variables ? JSON.stringify(d.variables) : ""
      ]);

      // 2. Escribir dinámicamente en la hoja del Modo de Trabajo correspondiente
      guardarEnHojaModo(ss, d, now, dictNombres, dictTurnos);
    });

    try {
      lock.releaseLock();
    } catch (err) {}

    // Intentamos enviar el mensaje directamente a Telegram
    const msg = construirMensajeTelegram(ss, regs, pkg.todoElDia, pkg.turnoUsuario || "MAÑANA");
    const enviadoOk = enviarTelegramDirecto(msg);

    if (!enviadoOk) {
      encolarMensajeTelegramTexto(ss, msg);
    }

    // Sincronizar / refrescar hojas dinámicas por modo de trabajo
    try {
      actualizarHojasPorModo();
    } catch (ex) {
      console.warn("Aviso al sincronizar hojas dinámicas por modo: " + ex);
    }

    return { success: true, message: "✅ Guardado exitosamente." };
  } catch (e) {
    return { success: false, message: "Error: " + e };
  } finally {
    try {
      lock.releaseLock();
    } catch (err) {}
  }
}

/**
 * Procesar reporte encolado.
 */
function procesarRegistroEncolado(ss, pkg, alreadyLocked) {
  let lockAcquired = false;
  const lock = LockService.getScriptLock();
  
  if (!alreadyLocked) {
    if (!lock.tryLock(10000)) return false;
    lockAcquired = true;
  }

  try {
    const hoja = getOrCreateSheet(ss, NOMBRE_HOJA_REGISTROS);
    const regs = pkg.registros;
    const now  = new Date();
    const isAnalista = String(pkg.rol).toUpperCase().includes("ANALISTA");

    if (!isAnalista) {
      const ult  = hoja.getLastRow();
      if (ult > 1) {
        const filasALeer = Math.min(1000, ult - 1);
        const filaInicio = ult - filasALeer + 1;
        const data = hoja.getRange(filaInicio, 1, filasALeer, 6).getValues();
        for (let r = 0; r < regs.length; r++) {
          const d = regs[r];
          for (let i = 0; i < data.length; i++) {
            const fRow = data[i][2] instanceof Date
              ? Utilities.formatDate(data[i][2], Session.getScriptTimeZone(), "yyyy-MM-dd")
              : String(data[i][2]).substring(0, 10);
            const uRow = String(data[i][3]).trim().toLowerCase();
            const cRow = String(data[i][5]).trim().toLowerCase();

            if (uRow === String(d.usuario).trim().toLowerCase()
              && fRow === d.fechaReporte
              && cRow === String(d.campana).trim().toLowerCase()) {
              console.log(`Duplicado detectado en background para ${d.usuario} - ${d.campana}. Omitiendo escritura.`);
              return true;
            }
          }
        }
      }
    }

    // Diccionarios de usuarios y turnos
    const dictNombres = {};
    const dictTurnos = {};
    try {
      const dataUsu = obtenerDatosUsuariosCached();
      for (let i = 1; i < dataUsu.length; i++) {
        const uKey = String(dataUsu[i][0]).trim().toLowerCase();
        dictNombres[uKey] = String(dataUsu[i][2] || dataUsu[i][0]).trim();
        dictTurnos[uKey] = String(dataUsu[i][4] || "MAÑANA").trim().toUpperCase();
      }
    } catch (e) {}

    regs.forEach(d => {
      let ef   = d.efectivas;
      let kVal = d.municipios;
      const mUp = String(d.modo).toUpperCase();
      const esCustom = (d.variables && typeof d.variables === "object" && Object.keys(d.variables).length > 0);

      if (mUp.includes("ESPECIAL") || mUp.includes("ESEQUIBO") ||
          mUp.includes("ANALISTA") || mUp.includes("CUALITATIV") || esCustom) {
        ef   = d.efectivas;
        kVal = d.detalle;
      }

      // 1. Guardar en BD_Registros
      hoja.appendRow([
        d.idOperador || "S/ID",
        now,
        d.fechaReporte,
        String(d.usuario).toUpperCase(),
        d.modo,
        d.campana,
        ef,
        d.totales     || 0,
        d.incidencias || 0,
        d.estados     || "",
        kVal          || "",
        "",
        "",
        d.variables ? JSON.stringify(d.variables) : ""
      ]);

      // 2. Guardar en hoja dinámica por Modo de Trabajo
      guardarEnHojaModo(ss, d, now, dictNombres, dictTurnos);
    });

    try {
      actualizarHojasPorModo();
    } catch (ex) {
      console.warn("Aviso actualizando hojas por modo (background): " + ex);
    }

    return true;
  } catch (e) {
    console.error("Error al escribir registro encolado: " + e);
    return false;
  } finally {
    if (lockAcquired) {
      try {
        lock.releaseLock();
      } catch (err) {}
    }
  }
}

// ─── ADMINISTRACIÓN DE REGISTROS ─────────────────────────────────────────────

function obtenerRegistrosAdmin(p, c, t1, t2, fd, arrModos, arrOps, tipoTabla, arrTurnos) {
  const ss      = getSpreadsheet();
  const hoja    = ss.getSheetByName(NOMBRE_HOJA_REGISTROS);
  const ult     = hoja.getLastRow();

  if (ult < 2) return { datos: [], totalPaginas: 0, totalRegistros: 0, paginaActual: 1 };

  // Diccionario de turnos por usuario usando caché
  let dictTurnos = {};
  try {
    const dataUsu = obtenerDatosUsuariosCached();
    for (let i = 1; i < dataUsu.length; i++) {
      const uKey  = String(dataUsu[i][0]).trim().toLowerCase();
      const rawT  = dataUsu[i][4];
      dictTurnos[uKey] = (rawT !== undefined && String(rawT).trim() !== "")
        ? String(rawT).trim().toUpperCase() : "MAÑANA";
    }
  } catch (e) {
    console.error("Error cargando usuarios en obtenerRegistrosAdmin: " + e);
  }

  const raw          = hoja.getRange(2, 1, ult - 1, 13).getValues();
  const dataConFila  = raw.map((r, i) => ({ fila: i + 2, data: r }));

  const txt1 = t1 ? t1.toLowerCase() : "";
  const txt2 = t2 ? t2.toLowerCase() : "";

  let filt = dataConFila.filter(item => {
    const r           = item.data;
    const usuarioKey  = String(r[3]).toLowerCase().trim();
    const turnoOp     = dictTurnos[usuarioKey] || "MAÑANA";
    const mRow        = String(r[4]).toUpperCase().trim();
    const isAnalyst   = mRow.includes("ANALISTA") || mRow.includes("CUALITATIV");

    if (tipoTabla === "ANALISTAS" && !isAnalyst) return false;
    if (tipoTabla === "REGULARES" && isAnalyst)  return false;

    if (fd) {
      const fRow = r[2] instanceof Date
        ? Utilities.formatDate(r[2], Session.getScriptTimeZone(), "yyyy-MM-dd")
        : String(r[2]).substring(0, 10);
      if (fRow !== fd) return false;
    }

    if (arrModos  && arrModos.length  > 0 && !arrModos.includes(mRow))                           return false;
    if (arrOps    && arrOps.length    > 0 && !arrOps.includes(String(r[3]).toUpperCase().trim())) return false;
    if (arrTurnos && arrTurnos.length > 0 && !arrTurnos.includes(turnoOp))                        return false;

    const str = r.join(" ").toLowerCase();
    if (txt1 && !str.includes(txt1)) return false;
    if (txt2 && !str.includes(txt2)) return false;

    return true;
  });

  filt.reverse();
  const total = filt.length;
  const pags  = Math.ceil(total / c) || 1;
  const curP  = Math.min(Math.max(1, p), pags);

  const res = filt.slice((curP - 1) * c, curP * c).map(item => {
    const r          = item.data;
    const usuarioKey = String(r[3]).toLowerCase().trim();
    return {
      rowId:      item.fila,
      id:         r[0],
      fecha:      r[2] instanceof Date
        ? Utilities.formatDate(r[2], Session.getScriptTimeZone(), "dd/MM/yyyy")
        : r[2],
      usuario:    r[3],
      turno:      dictTurnos[usuarioKey] || "MAÑANA",
      modo:       r[4],
      campana:    r[5],
      efectivas:  r[6],
      incidencias: r[8],
      valEfec:    r[11],
      valInc:     r[12]
    };
  });

  return { datos: res, totalPaginas: pags, paginaActual: curP, totalRegistros: total };
}

// ─── VALIDACIÓN ADMINISTRATIVA ────────────────────────────────────────────────

function guardarValidacionMasiva(lista, user, rol) {
  const ss   = getSpreadsheet();
  const hoja = ss.getSheetByName(NOMBRE_HOJA_REGISTROS);
  let actualizados = 0;

  lista.forEach(x => {
    if (x.rowId > 0) {
      hoja.getRange(x.rowId, 12).setValue(x.efectivas);
      hoja.getRange(x.rowId, 13).setValue(x.incidencias);
      actualizados++;
    }
  });

  const hLog = getOrCreateSheet(ss, NOMBRE_HOJA_AUDITORIA,
    ["Fecha", "Admin", "Accion", "Detalle", "Rol"]);
  hLog.appendRow([new Date(), user, "VALIDACIÓN MASIVA", `${actualizados} filas actualizadas`, rol || ""]);

  return { success: true };
}

function guardarValidacionAdmin(rowId, ef, inc, user, rol) {
  const ss   = getSpreadsheet();
  const hoja = ss.getSheetByName(NOMBRE_HOJA_REGISTROS);

  if (rowId > 0) {
    hoja.getRange(rowId, 12).setValue(ef);
    hoja.getRange(rowId, 13).setValue(inc);

    const hLog = getOrCreateSheet(ss, NOMBRE_HOJA_AUDITORIA,
      ["Fecha", "Admin", "Accion", "Detalle", "Rol"]);
    hLog.appendRow([new Date(), user, "VALIDACIÓN INDIVIDUAL", `Fila ${rowId}: Efec=${ef}, Inc=${inc}`, rol || ""]);

    return { success: true };
  }
  return { success: false, message: "Fila inválida" };
}

// ─── GUARDADO EN HOJA DINÁMICA POR MODO DE TRABAJO ───────────────────────────

/**
 * Guarda un registro individual en la hoja dinámica específica de su Modo de Trabajo.
 * Las columnas contienen los indicadores y variables correspondientes a dicho modo.
 */
function guardarEnHojaModo(ss, d, now, dictNombres, dictTurnos) {
  try {
    const modo = String(d.modo || "").trim();
    if (!modo) return;

    const { hoja, indicadores } = getOrCreateHojaModo(ss, modo);
    const tz = (typeof Session !== "undefined" && Session.getScriptTimeZone) ? Session.getScriptTimeZone() : "America/Caracas";

    const uKey = String(d.usuario || "").trim().toLowerCase();
    const nombreCompleto = (dictNombres && dictNombres[uKey]) ? dictNombres[uKey] : String(d.usuario || "").toUpperCase();
    const turno = (dictTurnos && dictTurnos[uKey]) ? dictTurnos[uKey] : "MAÑANA";

    const fecha = d.fechaReporte;
    const hora = (now instanceof Date) ? Utilities.formatDate(now, tz, "HH:mm") : "";

    const varsObj = (d.variables && typeof d.variables === "object") ? d.variables : {};

    const efVal  = parseInt(d.efectivas) || 0;
    const totVal = parseInt(d.totales) || 0;
    const incVal = parseInt(d.incidencias) || 0;
    const kVal   = d.detalle ? String(d.detalle) : (d.municipios ? String(d.municipios) : "");

    // Datos base del registro
    const row = [
      d.idOperador || "S/ID",
      fecha,
      hora,
      String(nombreCompleto).toUpperCase(),
      String(d.usuario || "").toUpperCase(),
      String(turno).toUpperCase(),
      modo,
      d.campana || ""
    ];

    // Asignación de cada indicador/variable a su respectiva columna
    let sumaIndicadores = 0;
    indicadores.forEach(ind => {
      let val = "";
      if (varsObj[ind.key] !== undefined) {
        val = varsObj[ind.key];
        const num = parseFloat(val);
        if (!isNaN(num)) sumaIndicadores += num;
      } else if (ind.key === "efectivas") {
        val = efVal;
        sumaIndicadores += efVal;
      } else if (ind.key === "totales") {
        val = totVal;
      } else if (ind.key === "incidencias") {
        val = incVal;
      }
      row.push(val);
    });

    // Columnas de contexto y totales
    row.push(
      d.estados || "",
      kVal,
      "",
      "",
      sumaIndicadores > 0 ? sumaIndicadores : efVal
    );

    hoja.appendRow(row);
  } catch (err) {
    console.error("Error guardando en hoja dinámica del modo " + d.modo + ": " + err);
  }
}
