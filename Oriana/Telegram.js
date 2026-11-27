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

/** Envía un mensaje a un chat_id específico usando el bot de balances. Devuelve true si tiene éxito. */
function enviarTelegramAChat(msg, chatId) {
  try {
    const token = getTelegramTokenBalance();
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
      String(d.detalle).split("\n").forEach(line => {
        if (line.trim() !== "") msg += `   ✔️ ${escapeHtml(line)}\n`;
      });
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

// ─── BOT INTERACTIVO (WEBHOOK) ────────────────────────────────────────────────

const TEXTO_AYUDA =
`🤖 <b>ORIANA — Asistente</b>

Puedes escribirme en lenguaje natural o usar comandos:

📊 <b>Balances:</b>
• "balance del día" / /dia
• "balance de ayer" / /ayer
• "balance de la semana" / /semana
• "balance del mes" / /mes

👤 <b>Rendimiento de un operador:</b>
• "rendimiento de Juan" / /operador Juan
• "rendimiento de Juan esta semana"

🛠 <b>Otros:</b>
• /id → ver tu Chat ID
• /ayuda → este mensaje`;

/** Recibe las actualizaciones de Telegram (webhook). */
function doPost(e) {
  try {
    const contents = e && e.postData ? e.postData.contents : null;
    if (!contents) return ContentService.createTextOutput("OK");

    const update = JSON.parse(contents);
    const msg = update.message || update.edited_message;
    if (!msg || !msg.text) return ContentService.createTextOutput("OK");

    // Anti-duplicados: Telegram a veces retransmite el mismo update; lo ignoramos.
    const updateId = update.update_id || 0;
    if (updateId > 0) {
      const props = PropertiesService.getScriptProperties();
      const lastId = parseInt(props.getProperty("LAST_TELEGRAM_UPDATE_ID") || "0") || 0;
      if (updateId <= lastId) return ContentService.createTextOutput("OK");
      props.setProperty("LAST_TELEGRAM_UPDATE_ID", String(updateId));
    }

    const chatId = String(msg.chat.id);
    const texto  = String(msg.text || "").trim();
    const nombre = (msg.from && (msg.from.first_name || msg.from.username)) || "";

    console.log("📩 Telegram recibido: chat=" + chatId + " texto=" + JSON.stringify(texto));

    try {
      procesarComandoTelegram(chatId, texto, nombre);
    } catch (err) {
      console.error("Error procesando comando '" + texto + "': " + err);
      try {
        enviarTelegramAChat("⚠️ No pude procesar tu solicitud.\nMensaje: " + texto + "\nError: " + err, chatId);
      } catch (e2) {}
    }
    return ContentService.createTextOutput("OK");
  } catch (err) {
    console.error("Error en doPost (Telegram): " + err);
    return ContentService.createTextOutput("OK");
  }
}

/** Procesa un mensaje entrante y responde según lo solicitado. */
function procesarComandoTelegram(chatId, texto, nombre) {
  if (!esChatAutorizado(chatId)) {
    enviarTelegramAChat("🔒 No estás autorizado para usar este bot.\n🆔 Tu Chat ID es: <code>" + chatId + "</code>", chatId);
    return;
  }

  const t = String(texto || "").toLowerCase();
  let respuesta = "";

  if (/^\/?(start|hola|inicio)\b/.test(t)) {
    respuesta = "👋 ¡Hola" + (nombre ? " " + escapeHtml(nombre) : "") + "!\n\n" + TEXTO_AYUDA;
  }
  else if (t.includes("/id") || t.includes("chat id") || t.includes("mi id")) {
    respuesta = "🆔 Tu Chat ID es: <code>" + chatId + "</code>";
  }
  else if (t.includes("/operador") || t.includes("/op") || t.includes("/rendimiento") || t.includes("rendimiento") || t.includes("operador")) {
    respuesta = construirRendimientoOperador(extraerOperador(texto), detectarPeriodo(t));
  }
  else if (t.includes("ayuda") || t.includes("help") || t.includes("comandos")) {
    respuesta = TEXTO_AYUDA;
  }
  else if (t.includes("semana")) {
    respuesta = construirBalancePeriodo("SEMANA");
  }
  else if (t.includes("mes")) {
    respuesta = construirBalancePeriodo("MES");
  }
  else if (t.includes("ayer")) {
    respuesta = construirBalancePeriodo("AYER");
  }
  else if (t.includes("dia") || t.includes("hoy") || t.includes("balance") || t === "/dia" || t === "/hoy" || t === "/balance") {
    respuesta = construirBalancePeriodo("HOY");
  }
  else {
    respuesta = "🤔 No entendí tu mensaje.\n\n" + TEXTO_AYUDA;
  }

  enviarTelegramAChat(respuesta, chatId);
}

/** Detecta el periodo en el texto: SEMANA, MES, AYER o HOY (por defecto). */
function detectarPeriodo(t) {
  if (t.includes("semana")) return "SEMANA";
  if (t.includes("mes")) return "MES";
  if (t.includes("ayer")) return "AYER";
  return "HOY";
}

/** Extrae el nombre del operador de un texto de comando. */
function extraerOperador(texto) {
  let s = String(texto || "");
  s = s.replace(/^\/(operador|op|rendimiento)\s*/i, "");
  s = s.replace(/rendimiento\s+(de\s+)?/i, "");
  s = s.replace(/operador\s+/i, "");
  return s.trim();
}

/** Llama a getMe para validar un token. Devuelve el objeto parseado de la respuesta. */
function getMeTelegram(token) {
  try {
    const response = UrlFetchApp.fetch(`https://api.telegram.org/bot${token}/getMe`, {
      method: "get",
      muteHttpExceptions: true
    });
    return JSON.parse(response.getContentText());
  } catch (e) {
    return { ok: false, description: "Error consultando getMe: " + e };
  }
}

/** Configura el webhook del bot de balances apuntando a la URL de este web app. */
function configurarWebhookTelegram() {
  try {
    const token = getTelegramTokenBalance();
    if (!token) return { success: false, message: "No hay token del bot de balances. Péguelo y guárdelo primero." };

    if (!/^\d+:[A-Za-z0-9_-]{30,}$/.test(token)) {
      return { success: false, message: "El token guardado tiene formato incorrecto (" + token.length + " caracteres). Vuelva a pegarlo completo en 'Token del Bot de Balances' y presione Guardar." };
    }

    // Validar el token antes de configurar
    const me = getMeTelegram(token);
    if (!me || !me.ok) {
      return { success: false, message: "Token inválido o revocado (Telegram: Unauthorized). Cree un bot nuevo en @BotFather y guárdelo de nuevo." };
    }

    const url = ScriptApp.getService().getUrl();
    const response = UrlFetchApp.fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
      method: "post",
      contentType: "application/json",
      muteHttpExceptions: true,
      payload: JSON.stringify({ url: url })
    });
    const body = response.getContentText();
    let json = {};
    try { json = JSON.parse(body); } catch (e) {}

    if (json && json.ok) {
      const botNombre = (me.result && (me.result.username || me.result.first_name)) || "";
      return { success: true, message: "✅ Webhook configurado correctamente" + (botNombre ? " (@" + botNombre + ")" : "") + "." };
    }
    return { success: false, message: "No se pudo configurar el webhook. Telegram: " + body };
  } catch (e) {
    return { success: false, message: "Error configurando webhook: " + e };
  }
}

/** Consulta getWebhookInfo de un token. Devuelve el objeto parseado. */
function getWebhookInfoTelegram(token) {
  try {
    const response = UrlFetchApp.fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`, {
      method: "get",
      muteHttpExceptions: true
    });
    return JSON.parse(response.getContentText());
  } catch (e) {
    return { ok: false, description: "Error: " + e };
  }
}

/** Diagnóstico legible del estado de ambos bots y sus webhooks. */
function diagnosticoWebhook() {
  const lineas = [];
  const appUrl = ScriptApp.getService().getUrl();
  lineas.push("🔗 URL de la app: " + appUrl);
  lineas.push("");

  try {
    const tokOp = getTelegramToken();
    const meOp = getMeTelegram(tokOp);
    const botOp = (meOp && meOp.ok) ? (meOp.result.username || meOp.result.first_name) : "TOKEN INVÁLIDO";
    const whOp = getWebhookInfoTelegram(tokOp);
    const whUrlOp = (whOp && whOp.result && whOp.result.url) ? whOp.result.url : "(sin webhook)";
    lineas.push("🤖 BOT OPERATIVO: @" + botOp);
    lineas.push("   Webhook: " + whUrlOp);
  } catch (e) { lineas.push("🤖 BOT OPERATIVO: error " + e); }

  lineas.push("");

  try {
    const tokBal = getTelegramTokenBalance();
    const meBal = getMeTelegram(tokBal);
    const botBal = (meBal && meBal.ok) ? (meBal.result.username || meBal.result.first_name) : "TOKEN INVÁLIDO";
    const whBal = getWebhookInfoTelegram(tokBal);
    const whUrlBal = (whBal && whBal.result && whBal.result.url) ? whBal.result.url : "(sin webhook)";
    lineas.push("📊 BOT BALANCES: @" + botBal);
    lineas.push("   Webhook: " + whUrlBal);
    if (whBal && whBal.result) {
      lineas.push("   Pendientes: " + (whBal.result.pending_update_count || 0));
      if (whBal.result.last_error_message) {
        lineas.push("   ⚠️ Último error de entrega: " + whBal.result.last_error_message);
      }
    }
  } catch (e) { lineas.push("📊 BOT BALANCES: error " + e); }

  return { success: true, message: lineas.join("\n") };
}

/** Borra el webhook del bot de balances (para reiniciar). */
function borrarWebhookBalance() {
  try {
    const token = getTelegramTokenBalance();
    const response = UrlFetchApp.fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
      method: "post",
      contentType: "application/json",
      muteHttpExceptions: true,
      payload: JSON.stringify({ url: "" })
    });
    return { success: true, message: "Webhook del bot de balances borrado: " + response.getContentText() };
  } catch (e) {
    return { success: false, message: "Error borrando webhook: " + e };
  }
}

/** Borra el webhook del bot operativo (por si se configuró por error). */
function borrarWebhookOperativo() {
  try {
    const token = getTelegramToken();
    const response = UrlFetchApp.fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
      method: "post",
      contentType: "application/json",
      muteHttpExceptions: true,
      payload: JSON.stringify({ url: "" })
    });
    return { success: true, message: "Webhook del bot operativo borrado: " + response.getContentText() };
  } catch (e) {
    return { success: false, message: "Error borrando webhook: " + e };
  }
}

// ─── SONDEO (getUpdates) — alternativa confiable al webhook ────────────────────

/**
 * Procesa los mensajes pendientes del bot de balances (polling vía getUpdates).
 * Se ejecuta por un trigger cada 1 minuto. No depende del webhook.
 */
function procesarMensajesBot() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return;
  try {
    const token = getTelegramTokenBalance();
    const props = PropertiesService.getScriptProperties();
    const offset = parseInt(props.getProperty("TELEGRAM_OFFSET_BALANCE") || "0") || 0;

    const response = UrlFetchApp.fetch(`https://api.telegram.org/bot${token}/getUpdates`, {
      method: "post",
      contentType: "application/json",
      muteHttpExceptions: true,
      payload: JSON.stringify({ offset: offset, timeout: 0, allowed_updates: ["message"] })
    });

    const body = JSON.parse(response.getContentText());
    if (!body || !body.ok || !body.result || !body.result.length) return;

    let nuevoOffset = offset;
    body.result.forEach(update => {
      nuevoOffset = Math.max(nuevoOffset, (update.update_id || 0) + 1);
      const msg = update.message;
      if (!msg || !msg.text) return;
      const chatId = String(msg.chat.id);
      const texto  = String(msg.text || "").trim();
      const nombre = (msg.from && (msg.from.first_name || msg.from.username)) || "";
      console.log("📩 Sondeo recibido: chat=" + chatId + " texto=" + JSON.stringify(texto));
      try {
        procesarComandoTelegram(chatId, texto, nombre);
      } catch (e) {
        console.error("Error procesando '" + texto + "': " + e);
        try { enviarTelegramAChat("⚠️ Error al procesar: " + e, chatId); } catch (e2) {}
      }
    });

    props.setProperty("TELEGRAM_OFFSET_BALANCE", String(nuevoOffset));
  } catch (e) {
    console.error("Error en procesarMensajesBot: " + e);
  } finally {
    lock.releaseLock();
  }
}

/** Instala el trigger de sondeo del bot de balances (cada 1 minuto). */
function instalarTriggerBot() {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === "procesarMensajesBot") {
      ScriptApp.deleteTrigger(t);
    }
  });
  ScriptApp.newTrigger("procesarMensajesBot")
    .timeBased()
    .everyMinutes(1)
    .create();
  return { success: true, message: "Trigger del bot de balances instalado (cada 1 minuto)." };
}

/** Activa el modo sondeo: borra el webhook e instala el trigger. */
function activarSondeoBot() {
  try {
    const token = getTelegramTokenBalance();
    // Borrar webhook para liberar getUpdates
    UrlFetchApp.fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
      method: "post",
      contentType: "application/json",
      muteHttpExceptions: true,
      payload: JSON.stringify({ url: "" })
    });
    const r = instalarTriggerBot();
    return { success: true, message: "Bot activado en modo sondeo (sin webhook). " + r.message };
  } catch (e) {
    return { success: false, message: "Error activando sondeo: " + e };
  }
}
