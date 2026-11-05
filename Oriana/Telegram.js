/**
 * ======================================================================
 * ORIANA — SISTEMA DE GESTIÓN
 * Backend: Integración con Telegram (Telegram.js)
 * ======================================================================
 */

// ─── COLA DE TELEGRAM Y PROCESAMIENTO EN SEGUNDO PLANO ────────────────────────

/** Encola el objeto de reporte completo cuando la hoja de registros está bloqueada. */
function encolarReportePendiente(pkg) {
  try {
    const ss = getSpreadsheet();
    const hoja = getOrCreateSheet(ss, NOMBRE_HOJA_COLA, [
      "ID_Cola", "FechaEncola", "Estado", "Intentos", "Payload"
    ]);
    const id = Utilities.getUuid();
    hoja.appendRow([id, new Date(), "PENDIENTE_REGISTRO", 0, JSON.stringify(pkg)]);
    return true;
  } catch (e) {
    console.error("Error al encolar reporte pendiente: " + e);
    return false;
  }
}

/** Encola un mensaje de texto pre-construido para Telegram. */
function encolarMensajeTelegramTexto(ss, msg) {
  try {
    const hoja = getOrCreateSheet(ss, NOMBRE_HOJA_COLA, [
      "ID_Cola", "FechaEncola", "Estado", "Intentos", "Payload"
    ]);
    const id = Utilities.getUuid();
    hoja.appendRow([id, new Date(), "PENDIENTE", 0, msg]);
  } catch (e) {
    console.error("Error al encolar texto de Telegram: " + e);
  }
}

/** Envía un mensaje directamente al bot de Telegram. Devuelve true si tiene éxito. */
function enviarTelegramDirecto(msg) {
  try {
    const token = getTelegramToken();
    const response = UrlFetchApp.fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method:          "post",
      contentType:     "application/json",
      muteHttpExceptions: true,
      payload:         JSON.stringify({
        chat_id:    CHAT_ID_TELEGRAM,
        text:       msg,
        parse_mode: "HTML"
      })
    });

    const status = response.getResponseCode();
    if (status === 200) {
      return true;
    } else {
      console.error(`Telegram API Error Directo ${status}: ${response.getContentText()}`);
      if (status === 429) {
        const headers = response.getHeaders();
        const retryAfter = headers["Retry-After"] || headers["retry-after"];
        console.warn(`Telegram Rate Limit hit in direct message. Retry after: ${retryAfter}`);
      }
      return false;
    }
  } catch (e) {
    console.error("Excepción enviando Telegram directo: " + e);
    return false;
  }
}

/** Envía un mensaje a un chat_id específico. Devuelve true si tiene éxito. */
function enviarTelegramAChat(msg, chatId) {
  try {
    const token = getTelegramToken();
    const response = UrlFetchApp.fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method:          "post",
      contentType:     "application/json",
      muteHttpExceptions: true,
      payload:         JSON.stringify({
        chat_id:    String(chatId),
        text:       msg,
        parse_mode: "HTML"
      })
    });
    return response.getResponseCode() === 200;
  } catch (e) {
    console.error("Excepción enviando a chat " + chatId + ": " + e);
    return false;
  }
}

/**
 * Encola un mensaje de Telegram en la hoja COLA_TELEGRAM.
 */
function encolarNotificacionTelegram(ss, regs, todoElDia, turnoBase) {
  try {
    const msg = construirMensajeTelegram(ss, regs, todoElDia, turnoBase);
    encolarMensajeTelegramTexto(ss, msg);
  } catch (e) {
    console.error("Error al encolar Telegram: " + e);
  }
}

/**
 * Procesador de cola — ejecutado por trigger cada 1 minuto.
 * Lee los mensajes y registros PENDIENTES y los procesa en orden.
 */
function procesarColaTelegram() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return; // Si hay otro procesador corriendo, saltar

  try {
    const ss   = getSpreadsheet();
    const hoja = ss.getSheetByName(NOMBRE_HOJA_COLA);
    if (!hoja || hoja.getLastRow() < 2) return;

    const MAX_INTENTOS = 3;
    const data = hoja.getDataRange().getValues();
    let token;

    try {
      token = getTelegramToken();
    } catch (e) {
      console.error("No hay token de Telegram. Ejecute setupTelegramToken().");
      return;
    }

    for (let i = 1; i < data.length; i++) {
      const estado   = String(data[i][2]).trim().toUpperCase();
      const intentos = parseInt(data[i][3]) || 0;
      const payload  = String(data[i][4]);

      if (estado === "ENVIADO" || intentos >= MAX_INTENTOS) continue;

      if (estado === "PENDIENTE_REGISTRO") {
        try {
          const pkg = JSON.parse(payload);
          // Pasamos true en alreadyLocked para evitar deadlock con el bloqueo de procesarColaTelegram
          const guardadoExitoso = procesarRegistroEncolado(ss, pkg, true);
          if (guardadoExitoso) {
            const msg = construirMensajeTelegram(ss, pkg.registros, pkg.todoElDia, pkg.turnoUsuario || "MAÑANA");
            const enviadoOk = enviarTelegramDirecto(msg);
            if (enviadoOk) {
              hoja.getRange(i + 1, 3, 1, 2).setValues([["ENVIADO", intentos + 1]]);
            } else {
              hoja.getRange(i + 1, 3, 1, 3).setValues([["PENDIENTE", intentos + 1, msg]]);
            }
          } else {
            throw new Error("No se pudo obtener el bloqueo de base de datos para guardar el registro.");
          }
        } catch (e) {
          hoja.getRange(i + 1, 3, 1, 2).setValues([["PENDIENTE_REGISTRO", intentos + 1]]);
          console.error(`Error procesando PENDIENTE_REGISTRO en cola (fila ${i+1}): ${e}`);
        }
      } else if (estado === "PENDIENTE" || estado === "ERROR") {
        try {
          const response = UrlFetchApp.fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method:          "post",
            contentType:     "application/json",
            muteHttpExceptions: true,
            payload:         JSON.stringify({
              chat_id:    CHAT_ID_TELEGRAM,
              text:       payload,
              parse_mode: "HTML"
            })
          });

          const status = response.getResponseCode();
          
          if (status === 429) {
            const headers = response.getHeaders();
            const retryAfter = parseInt(headers["Retry-After"] || headers["retry-after"] || "5") || 5;
            console.warn(`Telegram API 429: Rate limited. Retrying after ${retryAfter} seconds.`);
            Utilities.sleep(retryAfter * 1000);
            // Salir del bucle para detener el procesamiento de la cola por esta ejecución
            break;
          } else if (status !== 200) {
            const body = response.getContentText();
            throw new Error(`Telegram API Error ${status}: ${body}`);
          }

          hoja.getRange(i + 1, 3, 1, 2).setValues([["ENVIADO", intentos + 1]]);
          Utilities.sleep(300);
        } catch (e) {
          hoja.getRange(i + 1, 3, 1, 2).setValues([["ERROR", intentos + 1]]);
          console.error(`Error enviando mensaje en cola ${data[i][0]}: ${e}`);
        }
      }
    }

    limpiarColaAntigua(hoja);
  } finally {
    lock.releaseLock();
  }
}

/** Elimina registros ENVIADOS con más de 24 horas de antigüedad. */
function limpiarColaAntigua(hoja) {
  const data    = hoja.getDataRange().getValues();
  const limite  = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const filasBorrar = [];

  for (let i = data.length - 1; i >= 1; i--) {
    const estado = String(data[i][2]).trim().toUpperCase();
    const fecha  = data[i][1] instanceof Date ? data[i][1] : new Date(data[i][1]);
    if (estado === "ENVIADO" && fecha < limite) {
      filasBorrar.push(i + 1);
    }
  }

  filasBorrar.forEach(f => hoja.deleteRow(f));
}

/**
 * Construye el texto completo del mensaje de Telegram en HTML.
 */
function construirMensajeTelegram(ss, regs, todoElDia, turnoBase) {
  const nombreIngresado = String(regs[0].usuario || "").toLowerCase().trim();
  let nombreCompleto    = regs[0].usuario;
  let rolBase           = "Operador";
  let myIdUser          = "";
  let dictTurnos        = {};
  let turnoBaseDeDB     = "";

  // Optimización: Usar caché de usuarios para obtener datos de usuarios
  try {
    const uData = obtenerDatosUsuariosCached();
    for (let i = 1; i < uData.length; i++) {
      const uName  = String(uData[i][0]).trim().toLowerCase();
      const rawT   = uData[i][4];
      const uTurno = (rawT !== undefined && String(rawT).trim() !== "")
        ? String(rawT).trim().toUpperCase()
        : "MAÑANA";
      const uId    = String(uData[i][5] || "").trim();

      if (uId) dictTurnos[uId] = uTurno;

      if (uName === nombreIngresado) {
        if (uData[i][2]) nombreCompleto = String(uData[i][2]).trim();
        rolBase  = String(uData[i][3] || "Operador").trim();
        myIdUser = uId;
        turnoBaseDeDB = uTurno;
      }
    }
  } catch (e) {
    console.error("Error leyendo usuarios en caché para Telegram: " + e);
  }

  const turnoReal = turnoBaseDeDB || turnoBase || "MAÑANA";
  let turnoEfectivo   = String(turnoReal).toUpperCase().trim();
  const fechaReporte  = regs[0].fechaReporte;

  // Verificar cruce de turno en hoja externa
  if (myIdUser !== "") {
    try {
      const ssCross   = SpreadsheetApp.openById(ID_HOJA_CROSS);
      const hojaCross = ssCross.getSheetByName("CrossTurnos");
      if (hojaCross) {
        const crossData = hojaCross.getDataRange().getValues();
        for (let i = 1; i < crossData.length; i++) {
          const cEstado = String(crossData[i][4]).trim().toLowerCase();
          if (cEstado !== "aprobada") continue;

          let fDate = "";
          const cFecha = crossData[i][1];
          if (cFecha instanceof Date) {
            fDate = Utilities.formatDate(cFecha, Session.getScriptTimeZone(), "yyyy-MM-dd");
          } else if (typeof cFecha === "string") {
            const parts = cFecha.split("/");
            fDate = parts.length === 3
              ? `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`
              : cFecha;
          }

          if (fDate === fechaReporte) {
            const u1 = String(crossData[i][2]).trim();
            const u2 = String(crossData[i][3]).trim();
            if (u1 === myIdUser && dictTurnos[u2]) { turnoEfectivo = dictTurnos[u2]; break; }
            if (u2 === myIdUser && dictTurnos[u1]) { turnoEfectivo = dictTurnos[u1]; break; }
          }
        }
      }
    } catch (e) {
      console.error("Error verificando CrossTurnos: " + e);
    }
  }

  // Detectar reporte retardado
  const now           = new Date();
  const tiempoDecimal = now.getHours() + (now.getMinutes() / 60);
  let esRetardado     = false;

  if (todoElDia && turnoEfectivo === "MAÑANA") {
    if (tiempoDecimal >= 19.5) esRetardado = true;
  } else {
    if (turnoEfectivo === "MAÑANA" && tiempoDecimal >= 14.5) esRetardado = true;
    if (turnoEfectivo === "TARDE"  && tiempoDecimal >= 19.5) esRetardado = true;
  }

  const notaTurno  = (turnoEfectivo !== String(turnoBase).toUpperCase().trim())
    ? ` (🔄 <b>Cruce aplicado</b>)` : ``;
  const msgJornada = todoElDia
    ? `☀️🌙 Todo el día (Doble Turno)` : escapeHtml(turnoEfectivo);

  let msg = esRetardado ? `🚨🚨 <b>REPORTE RETARDADO</b> 🚨🚨\n\n` : ``;
  msg += `📊 <b>REPORTE DE OPERATIVIDAD</b> 📊\n➖➖➖➖➖➖➖➖➖➖\n`;
  msg += `👤 <b>Operador:</b> ${escapeHtml(nombreCompleto)}\n`;
  msg += `💼 <b>Rol:</b> ${escapeHtml(rolBase)}\n`;
  msg += `🕒 <b>Jornada:</b> ${msgJornada}${notaTurno}\n`;
  msg += `📅 <b>Fecha:</b> ${escapeHtml(fechaReporte)}\n➖➖➖➖➖➖➖➖➖➖\n\n`;

  const emojis = obtenerEmojis();
  const totalsPorModo = {};   // modo -> { variable: suma }
  regs.forEach(d => {
    const m  = String(d.modo).toUpperCase();
    let ic   = "🔹";

    if (m.includes("1X10"))                                   ic = "🟡";
    else if (m.includes("INCIDENCIA"))                        ic = "🟥";
    else if (m.includes("ESPECIAL"))                          ic = "🔸";
    else if (m.includes("ESEQUIBO"))                          ic = "🛑";
    else if (m.includes("ANALISTA") || m.includes("CUALITATIV")) ic = "🧠";
    else if (m.includes("ISABELL") || m.includes("ISSABEL") || m.includes("COBRANZA")) ic = "🔵";

    const modeEmoji = emojis.modos[String(d.modo).trim().toUpperCase()] || emojis.modos[String(d.modo).trim()] || ic;

    const ef = parseInt(d.efectivas) || 0;

    const varsObj = (d.variables && typeof d.variables === "object") ? d.variables : {};

    // Acumular totales por variable, agrupados por modo/indicador
    if (Object.keys(varsObj).length > 0) {
      if (!totalsPorModo[m]) totalsPorModo[m] = {};
      Object.keys(varsObj).forEach(k => {
        const num = parseFloat(varsObj[k]);
        if (!isNaN(num)) totalsPorModo[m][k] = (totalsPorModo[m][k] || 0) + num;
      });
    }

    if (Object.keys(varsObj).length > 0) {
      msg += `${modeEmoji} <b>MODO: ${escapeHtml(d.modo)}</b>\n`;
      if (d.campana) {
        const campEmoji = emojis.campanas[String(d.campana).trim()] || "📌";
        msg += `   ${campEmoji} Actividad: ${escapeHtml(d.campana)}\n`;
      }

      // Renderizar variables en orden de configuración, indentando las dependientes
      const defs = obtenerVariablesModo(d.modo);
      const orden = defs.length ? defs : Object.keys(varsObj).map(k => ({ variable: k, etiqueta: obtenerEtiquetaVariable(k), padre: "" }));

      orden.forEach(vd => {
        if (varsObj[vd.variable] === undefined) return;
        const esPadre  = !vd.padre;
        const varEmoji = emojis.variables[vd.variable] || (esPadre ? "📊" : "└");
        const indent   = esPadre ? "   " : "      ";
        msg += `${indent}${varEmoji} ${escapeHtml(vd.etiqueta || vd.variable)}: <b>${varsObj[vd.variable]}</b>\n`;
      });

      if (d.detalle) msg += `   📝 Detalle: ${escapeHtml(d.detalle)}\n`;
    } else if (m.includes("ANALISTA") || m.includes("CUALITATIV")) {
      msg += `${modeEmoji} <b>MODO: ${escapeHtml(d.modo)}</b>\n`;
      if (d.detalle) {
        String(d.detalle).split("\n").forEach(line => {
          if (line.trim() !== "") msg += `   ✔️ ${escapeHtml(line)}\n`;
        });
      }
      msg += `   📊 Total Actividades Realizadas: ${ef} | Datos Analizados: ${d.totales || 0}\n`;
    } else {
      msg += `${modeEmoji} <b>CAMPAÑA: ${escapeHtml(d.campana)}</b>\n   ⚙️ Modo: ${escapeHtml(d.modo)}\n`;

      if (m.includes("ESPECIAL") || m.includes("ESEQUIBO")) {
        msg += `   📞 Llamadas Efectivas: <b>${ef}</b>\n   📝 Detalle: ${escapeHtml(d.detalle)}\n`;
      } else if (m.includes("ISSABEL") || m.includes("ISABELL")) {
        msg += `   📞 Llamadas Efectivas: <b>${ef}</b>\n   ☎️ Llamadas Totales: ${d.totales || 0}\n`;
      } else {
        msg += `   📞 Llamadas Efectivas: <b>${ef}</b>\n`;
        if (m.includes("INCIDENCIA") || m.includes("1X10")) {
          msg += `   ☎️ Llamadas Totales: ${d.totales || 0}\n`;
          msg += `   ⚠️ Incidencias Abarcadas: ${d.incidencias || 0}\n`;
          if (d.estados)    msg += `   🗺️ <b>Estados Abarcados:</b> ${escapeHtml(d.estados)}\n`;
          if (!m.includes("1X10") && d.municipios) msg += `   🏘️ <b>Municipios Abarcados:</b> ${escapeHtml(d.municipios)}\n`;
        }
      }
    }
    msg += `\n`;
  });

  msg += `➖➖➖➖➖➖➖➖➖➖\n`;
  msg += `📋 <b>TOTAL ACTIVIDADES REPORTADAS: ${regs.length}</b>\n`;

  const modosConVars = Object.keys(totalsPorModo).sort();
  if (modosConVars.length > 0) {
    msg += `\n📊 <b>TOTALES POR INDICADOR:</b>\n`;
    modosConVars.forEach(mKey => {
      const nombreInd = obtenerNombreIndicador(mKey) || mKey;
      const emojiModo = emojis.modos[mKey] || "🔹";
      msg += `${emojiModo} <b>${escapeHtml(nombreInd)}</b>${nombreInd !== mKey ? ` <i>(${escapeHtml(mKey)})</i>` : ""}\n`;

      const defs = obtenerVariablesModo(mKey);
      const orden = defs.length ? defs : Object.keys(totalsPorModo[mKey]).map(k => ({ variable: k, etiqueta: obtenerEtiquetaVariable(k), padre: "" }));

      orden.forEach(vd => {
        if (totalsPorModo[mKey][vd.variable] === undefined) return;
        const esPadre  = !vd.padre;
        const indent   = esPadre ? "   " : "      ";
        const pref     = esPadre ? "📊" : "└";
        const varEmoji = emojis.variables[vd.variable] || pref;
        msg += `${indent}${varEmoji} ${escapeHtml(vd.etiqueta || vd.variable)}: <b>${totalsPorModo[mKey][vd.variable]}</b>\n`;
      });
    });
  }

  if (msg.length > 4000) msg = msg.substring(0, 4000) + "\n\n⚠️ <i>[MENSAJE RECORTADO]</i>";

  return msg;
}
