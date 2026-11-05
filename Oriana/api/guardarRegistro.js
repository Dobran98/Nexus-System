const { supabase } = require('./lib/supabase');
const { enviarTelegramDirecto, encolarMensajeTelegram, construirMensajeTelegram } = require('./lib/telegram');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Método no permitido' });
  }

  const args = req.body?.args || [];
  const pkg = args[0] || req.body?.pkg;

  if (!pkg || !Array.isArray(pkg.registros) || pkg.registros.length === 0) {
    return res.status(400).json({ success: false, message: 'Paquete de registros inválido o vacío.' });
  }

  try {
    if (!supabase) throw new Error('Base de datos no inicializada');

    const regs = pkg.registros;
    const isAnalista = String(pkg.rol || '').toUpperCase().includes('ANALISTA');

    // ── 1. Verificación de duplicados (solo para no-analistas) ───────────
    if (!isAnalista) {
      for (const d of regs) {
        const uOp = String(d.usuario || '').trim();
        const fRep = String(d.fechaReporte || '').trim();
        const cCamp = String(d.campana || '').trim();

        const { data: dups, error: dupErr } = await supabase
          .from('registros')
          .select('id')
          .ilike('usuario_operador', uOp)
          .eq('fecha_reporte', fRep)
          .ilike('campana', cCamp)
          .limit(1);

        if (dupErr) console.warn('Advertencia en chequeo de duplicados:', dupErr);

        if (dups && dups.length > 0) {
          return res.status(200).json({
            success: false,
            message: `⛔ Ya existe reporte de "${cCamp}" para el día ${fRep}.`
          });
        }
      }
    }

    // ── 2. Preparar filas para inserción en PostgreSQL ───────────────────
    const nowIso = new Date().toISOString();
    const rowsToInsert = regs.map(d => {
      let ef = d.efectivas;
      let kVal = d.municipios;
      const mUp = String(d.modo || '').toUpperCase();
      const esCustom = (d.variables && typeof d.variables === "object" && Object.keys(d.variables).length > 0);

      if (mUp.includes("ESPECIAL") || mUp.includes("ESEQUIBO") ||
          mUp.includes("ANALISTA") || mUp.includes("CUALITATIV") || esCustom) {
        ef = d.efectivas;
        kVal = d.detalle;
      }

      const efVal = (ef !== undefined && ef !== '') ? parseInt(ef) || 0 : 0;

      return {
        id_operador: String(d.idOperador || 'S/ID'),
        fecha_registro: nowIso,
        fecha_reporte: String(d.fechaReporte || ''),
        usuario_operador: String(d.usuario || '').toUpperCase().trim(),
        modo_trabajo: String(d.modo || '').trim(),
        campana: String(d.campana || '').trim(),
        llamadas_efectivas: efVal,
        llamadas_totales: parseInt(d.totales) || 0,
        incidencias_reportadas: parseInt(d.incidencias) || 0,
        estados_abarcados: String(d.estados || ''),
        municipios_detalles: kVal ? String(kVal) : '',
        variables: (d.variables && typeof d.variables === 'object') ? d.variables : {}
      };
    });

    const { error: insertErr } = await supabase.from('registros').insert(rowsToInsert);
    if (insertErr) throw insertErr;

    // ── 3. Preparar y Enviar Notificación a Telegram ────────────────────
    try {
      const uFirst = regs[0].usuario;
      const { data: uData } = await supabase
        .from('usuarios')
        .select('*')
        .ilike('usuario', String(uFirst).trim())
        .limit(1);

      const userInfo = uData && uData.length > 0 ? {
        nombre: uData[0].nombre_apellido || uData[0].usuario,
        rol: uData[0].rol,
        turno: uData[0].turno
      } : {
        nombre: uFirst,
        rol: pkg.rol || 'Operador',
        turno: pkg.turnoUsuario || 'MAÑANA'
      };

      // Cargar configuración, emojis, variables e indicadores
      const [cfgRes, emojiRes, varRes, indRes] = await Promise.all([
        supabase.from('configuracion').select('*'),
        supabase.from('config_emojis').select('*'),
        supabase.from('config_variables').select('*'),
        supabase.from('config_indicadores').select('*')
      ]);

      const configMap = {};
      (cfgRes.data || []).forEach(c => { configMap[c.modo] = c.detalle || {}; });

      const emojis = { modos: {}, campanas: {}, variables: {} };
      (emojiRes.data || []).forEach(r => {
        const tipo = String(r.tipo || '').toUpperCase();
        if (tipo === 'MODO') emojis.modos[r.nombre] = r.emoji;
        else if (tipo === 'CAMPAÑA' || tipo === 'CAMPANA') emojis.campanas[r.nombre] = r.emoji;
        else if (tipo === 'VARIABLE') emojis.variables[r.nombre] = r.emoji;
      });

      const variablesDefs = {};
      (varRes.data || []).forEach(r => {
        if (!variablesDefs[r.modo]) variablesDefs[r.modo] = [];
        variablesDefs[r.modo].push({
          variable: r.variable,
          etiqueta: r.etiqueta || r.variable,
          padre: r.depende_de || ''
        });
      });

      const indicadores = indRes.data || [];

      const msg = construirMensajeTelegram(
        regs,
        pkg.todoElDia,
        pkg.turnoUsuario || 'MAÑANA',
        userInfo,
        configMap,
        emojis,
        variablesDefs,
        indicadores
      );

      const enviadoOk = await enviarTelegramDirecto(msg);

      if (!enviadoOk) {
        await encolarMensajeTelegram({ msg, regs, pkg }, 'PENDIENTE');
      }
    } catch (tgErr) {
      console.error('Error al despachar mensaje a Telegram:', tgErr);
      await encolarMensajeTelegram({ regs, pkg }, 'PENDIENTE');
    }

    return res.status(200).json({ success: true, message: '✅ Guardado exitosamente.' });
  } catch (err) {
    console.error('Error en guardarRegistro:', err);
    return res.status(500).json({ success: false, message: 'Error: ' + err.message });
  }
};
