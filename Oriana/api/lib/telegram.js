const { supabase } = require('./supabase');

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID_TELEGRAM = process.env.CHAT_ID_TELEGRAM || "-1003081975085";

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

async function enviarTelegramDirecto(msg, targetChatId = null) {
  if (!TELEGRAM_BOT_TOKEN) {
    console.warn("⚠️ TELEGRAM_BOT_TOKEN no configurado.");
    return false;
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: String(targetChatId || CHAT_ID_TELEGRAM),
        text: msg,
        parse_mode: "HTML"
      })
    });
    return res.ok;
  } catch (err) {
    console.error("Error al enviar telegram directo:", err);
    return false;
  }
}

async function encolarMensajeTelegram(payload, estado = 'PENDIENTE') {
  if (!supabase) return false;
  try {
    const { error } = await supabase.from('cola_telegram').insert({
      estado,
      intentos: 0,
      payload
    });
    if (error) throw error;
    return true;
  } catch (err) {
    console.error("Error al encolar telegram en supabase:", err);
    return false;
  }
}

function construirMensajeTelegram(regs, todoElDia, turnoBase, usuarioInfo = {}, configMap = {}, emojis = { modos: {}, campanas: {}, variables: {} }, variablesDefs = {}, indicadores = []) {
  if (!regs || regs.length === 0) return '';

  const primer = regs[0];
  const nombreCompleto = usuarioInfo.nombre || primer.usuario;
  const rolBase = usuarioInfo.rol || "Operador";
  const turnoReal = usuarioInfo.turno || turnoBase || "MAÑANA";
  const turnoEfectivo = String(turnoReal).toUpperCase().trim();
  const fechaReporte = primer.fechaReporte;

  const msgJornada = todoElDia ? `☀️🌙 Todo el día (Doble Turno)` : escapeHtml(turnoEfectivo);

  let msg = `📊 <b>REPORTE DE OPERATIVIDAD</b> 📊\n➖➖➖➖➖➖➖➖➖➖\n`;
  msg += `👤 <b>Operador:</b> ${escapeHtml(nombreCompleto)}\n`;
  msg += `💼 <b>Rol:</b> ${escapeHtml(rolBase)}\n`;
  msg += `🕒 <b>Jornada:</b> ${msgJornada}\n`;
  msg += `📅 <b>Fecha:</b> ${escapeHtml(fechaReporte)}\n➖➖➖➖➖➖➖➖➖➖\n\n`;

  const totalsPorModo = {};

  regs.forEach(d => {
    const m = String(d.modo || "").trim().toUpperCase();
    let ic = "🔹";
    if (m.includes("1X10")) ic = "🟡";
    else if (m.includes("INCIDENCIA")) ic = "🟥";
    else if (m.includes("ESPECIAL")) ic = "🔸";
    else if (m.includes("ESEQUIBO")) ic = "🛑";
    else if (m.includes("ANALISTA") || m.includes("CUALITATIV")) ic = "🧠";
    else if (m.includes("ISABELL") || m.includes("ISSABEL") || m.includes("COBRANZA")) ic = "🔵";

    const modeEmoji = emojis.modos[m] || emojis.modos[String(d.modo || "").trim()] || ic;
    const ef = parseInt(d.efectivas) || 0;
    const varsObj = (d.variables && typeof d.variables === "object") ? d.variables : {};

    if (Object.keys(varsObj).length > 0) {
      if (!totalsPorModo[m]) totalsPorModo[m] = {};
      Object.keys(varsObj).forEach(k => {
        const num = parseFloat(varsObj[k]);
        if (!isNaN(num)) totalsPorModo[m][k] = (totalsPorModo[m][k] || 0) + num;
      });

      msg += `${modeEmoji} <b>MODO: ${escapeHtml(d.modo)}</b>\n`;
      if (d.campana) {
        const campEmoji = emojis.campanas[String(d.campana).trim()] || "📌";
        msg += `   ${campEmoji} Actividad: ${escapeHtml(d.campana)}\n`;
      }

      const defs = variablesDefs[d.modo] || variablesDefs[m] || [];
      const orden = defs.length ? defs : Object.keys(varsObj).map(k => ({ variable: k, etiqueta: k, padre: "" }));

      orden.forEach(vd => {
        if (varsObj[vd.variable] === undefined) return;
        const esPadre = !vd.padre;
        const varEmoji = emojis.variables[vd.variable] || (esPadre ? "📊" : "└");
        const indent = esPadre ? "   " : "      ";
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
          if (d.estados) msg += `   🗺️ <b>Estados Abarcados:</b> ${escapeHtml(d.estados)}\n`;
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
      const indMatch = (indicadores || []).filter(i => String(i.modo).trim().toUpperCase() === mKey);
      const nombreInd = indMatch.length ? indMatch.map(i => i.indicador).join(" / ") : mKey;
      const emojiModo = emojis.modos[mKey] || "🔹";

      msg += `${emojiModo} <b>${escapeHtml(nombreInd)}</b>${nombreInd !== mKey ? ` <i>(${escapeHtml(mKey)})</i>` : ""}\n`;

      const defs = variablesDefs[mKey] || [];
      const orden = defs.length ? defs : Object.keys(totalsPorModo[mKey]).map(k => ({ variable: k, etiqueta: k, padre: "" }));

      orden.forEach(vd => {
        if (totalsPorModo[mKey][vd.variable] === undefined) return;
        const esPadre = !vd.padre;
        const indent = esPadre ? "   " : "      ";
        const pref = esPadre ? "📊" : "└";
        const varEmoji = emojis.variables[vd.variable] || pref;
        msg += `${indent}${varEmoji} ${escapeHtml(vd.etiqueta || vd.variable)}: <b>${totalsPorModo[mKey][vd.variable]}</b>\n`;
      });
    });
  }

  if (msg.length > 4000) {
    msg = msg.substring(0, 4000) + "\n\n⚠️ <i>[MENSAJE RECORTADO]</i>";
  }

  return msg;
}

module.exports = {
  escapeHtml,
  enviarTelegramDirecto,
  encolarMensajeTelegram,
  construirMensajeTelegram
};
