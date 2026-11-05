const { supabase, fetchAllRows } = require('./lib/supabase');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Método no permitido' });
  }

  try {
    if (!supabase) throw new Error('Base de datos no inicializada');

    const data = await fetchAllRows(() => supabase.from('config_indicadores').select('*'));

    const result = (data || []).map(r => ({
      indicador: String(r.indicador || '').trim(),
      modo: String(r.modo || '').trim()
    })).filter(r => r.indicador && r.modo);

    return res.status(200).json(result);
  } catch (err) {
    console.error('Error en obtenerIndicadores:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

