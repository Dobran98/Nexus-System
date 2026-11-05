const { supabase, fetchAllRows } = require('./lib/supabase');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Método no permitido' });
  }

  try {
    if (!supabase) throw new Error('Base de datos no inicializada');

    const data = await fetchAllRows(() => supabase.from('config_emojis').select('*'));

    const result = { modos: {}, campanas: {}, variables: {} };

    (data || []).forEach(r => {
      const tipo = String(r.tipo || '').trim().toUpperCase();
      const nombre = String(r.nombre || '').trim();
      const emoji = String(r.emoji || '').trim();
      if (!nombre || !emoji) return;

      if (tipo === 'MODO') result.modos[nombre] = emoji;
      else if (tipo === 'CAMPAÑA' || tipo === 'CAMPANA') result.campanas[nombre] = emoji;
      else if (tipo === 'VARIABLE') result.variables[nombre] = emoji;
    });

    return res.status(200).json(result);
  } catch (err) {
    console.error('Error en obtenerEmojis:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

