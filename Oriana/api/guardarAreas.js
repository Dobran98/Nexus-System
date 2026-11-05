const { supabase } = require('./lib/supabase');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Método no permitido' });
  }

  const args = req.body?.args || [];
  const lista = args[0] || req.body?.areas || [];

  try {
    if (!supabase) throw new Error('Base de datos no inicializada');

    // Limpiar tabla existente e insertar nuevas áreas
    await supabase.from('areas_trabajo').delete().neq('id_area', 'dummy_never_match');

    if (Array.isArray(lista) && lista.length > 0) {
      const rows = lista.map((a, idx) => ({
        id_area: String(a.id || idx + 1),
        nombre_area: String(a.nombre || '').trim()
      })).filter(r => r.nombre_area);

      if (rows.length > 0) {
        const { error } = await supabase.from('areas_trabajo').insert(rows);
        if (error) throw error;
      }
    }

    return res.status(200).json({ success: true, message: 'Áreas guardadas correctamente.' });
  } catch (err) {
    console.error('Error en guardarAreas:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

