const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8533958111:AAFtWPPBE50TEOUUdNbvBVLP6vWsblTgx88';
const CHAT_ID_TELEGRAM   = process.env.CHAT_ID_TELEGRAM || '-1003081975085';

function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

async function enviarTelegramDirecto(msg) {
  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID_TELEGRAM,
        text: msg,
        parse_mode: 'HTML'
      })
    });

    if (res.status === 200) {
      return true;
    } else {
      const errText = await res.text();
      console.error(`Telegram API Error ${res.status}: ${errText}`);
      return false;
    }
  } catch (e) {
    console.error('Error enviando Telegram directo:', e);
    return false;
  }
}

function construirMensajeTelegram(regs, todoElDia, turnoBase, configMap = {}, datosUsuario = {}) {
  const nombreCompleto = datosUsuario.nombre || regs[0].usuario;
  const rolBase        = datosUsuario.rol || 'Operador';
  const turnoReal      = datosUsuario.turno || turnoBase || 'MAÑANA';
  const fechaReporte   = regs[0].fechaReporte;

  // Detección de retardo según horario Caracas
  const now = new Date();
  const tiempoDecimal = now.getHours() + (now.getMinutes() / 60);
  let esRetardado = false;

  if (todoElDia && turnoReal === 'MAÑANA') {
    if (tiempoDecimal >= 19.5) esRetardado = true;
  } else {
    if (turnoReal === 'MAÑANA' && tiempoDecimal >= 14.5) esRetardado = true;
    if (turnoReal === 'TARDE'  && tiempoDecimal >= 19.5) esRetardado = true;
  }

  const msgJornada = todoElDia
    ? '☀️🌙 Todo el día (Doble Turno)'
    : escapeHtml(turnoReal);

  let msg = esRetardado ? '🚨🚨 <b>REPORTE RETARDADO</b> 🚨🚨\n\n' : '';
  msg += '📊 <b>REPORTE DE OPERATIVIDAD</b> 📊\n➖➖➖➖➖➖➖➖➖➖\n';
  msg += `👤 <b>Operador:</b> ${escapeHtml(nombreCompleto)}\n`;
  msg += `💼 <b>Rol:</b> ${escapeHtml(rolBase)}\n`;
  msg += `🕒 <b>Jornada:</b> ${msgJornada}\n`;
  msg += `📅 <b>Fecha:</b> ${escapeHtml(fechaReporte)}\n➖➖➖➖➖➖➖➖➖➖\n\n`;

  let sum = 0;
  regs.forEach(d => {
    const m = String(d.modo || '').trim();
    const cfg = configMap[m] || {
      etiquetaPrincipal: 'Efectivas / Realizadas',
      etiquetaTotales: 'Totales / Asignadas',
      icono: '🔹'
    };

    const ic = cfg.icono || '🔹';
    const ef = parseInt(d.efectivas) || 0;
    sum += ef;

    const etiqPrincipal = cfg.etiquetaPrincipal || 'Efectivas / Realizadas';
    const etiqTotales   = cfg.etiquetaTotales || 'Totales / Asignadas';

    if (cfg.esMultiActividad) {
      msg += `${ic} <b>MODO: ${escapeHtml(m)}</b>\n`;
      if (d.campana) {
        msg += `   📂 <b>Actividad / Campaña:</b> ${escapeHtml(d.campana)}\n`;
      }
      if (d.detalle) {
        String(d.detalle).split('\n').forEach(line => {
          if (line.trim() !== '') msg += `   ✔️ ${escapeHtml(line)}\n`;
        });
      }
      msg += `   🎯 <b>${escapeHtml(etiqPrincipal)}: ${ef}</b>`;
      if (cfg.tieneTotales && d.totales !== undefined && d.totales !== '') {
        msg += ` | 📊 ${escapeHtml(etiqTotales)}: ${d.totales}`;
      }
      msg += '\n';
    } else {
      msg += `${ic} <b>CAMPAÑA: ${escapeHtml(d.campana)}</b>\n   ⚙️ Modo: ${escapeHtml(m)}\n`;
      msg += `   🎯 ${escapeHtml(etiqPrincipal)}: <b>${ef}</b>\n`;

      if (cfg.tieneTotales) {
        msg += `   📊 ${escapeHtml(etiqTotales)}: ${d.totales || 0}\n`;
      }

      if (cfg.tieneIncidencias && (d.incidencias || d.incidencias === 0)) {
        msg += `   ⚠️ Incidencias: ${d.incidencias || 0}\n`;
      }

      if (cfg.tieneGeografia) {
        if (d.estados) msg += `   🗺️ <b>Estados Abarcados:</b> ${escapeHtml(d.estados)}\n`;
        if (d.municipios) msg += `   🏘️ <b>Municipios Abarcados:</b> ${escapeHtml(d.municipios)}\n`;
      }

      if (cfg.tieneDetalle && d.detalle) {
        msg += `   📝 Detalle: ${escapeHtml(d.detalle)}\n`;
      }
    }
    msg += '\n';
  });

  msg += '➖➖➖➖➖➖➖➖➖➖\n';
  msg += sum > 0
    ? `🏆 <b>TOTAL GENERAL REGISTRADO: ${sum}</b>\n`
    : '📋 <b>REPORTE COMPLETADO</b>\n';

  if (msg.length > 4000) msg = msg.substring(0, 4000) + '\n\n⚠️ <i>[MENSAJE RECORTADO]</i>';
  return msg;
}

module.exports = {
  escapeHtml,
  enviarTelegramDirecto,
  construirMensajeTelegram
};
