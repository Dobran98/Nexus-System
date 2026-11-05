const { supabase, fetchAllRows } = require('./lib/supabase');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Método no permitido' });
  }

  try {
    if (!supabase) throw new Error('Base de datos no inicializada');

    const data = await fetchAllRows(() => supabase.from('config_variables').select('*').order('id', { ascending: true }));

    const result = {};
    (data || []).forEach(r => {
      const modo = String(r.modo || '').trim();
      const variable = String(r.variable || '').trim();
      if (!modo || !variable) return;
      if (!result[modo]) result[modo] = [];
      result[modo].push({
        variable,
        etiqueta: r.etiqueta || variable,
        tipo: r.tipo || 'NUMERO',
        obligatorio: !!r.obligatorio,
        padre: r.depende_de || ''
      });
    });

    return res.status(200).json(result);
  } catch (err) {
    console.error('Error en obtenerTodasVariables:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

