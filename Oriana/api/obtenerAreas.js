const { supabase } = require('./lib/supabase');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Método no permitido' });
  }

  try {
    if (!supabase) throw new Error('Base de datos no inicializada');

    const { data, error } = await supabase
      .from('areas_trabajo')
      .select('id_area, nombre_area')
      .order('id_area', { ascending: true });

    if (error) throw error;

    const areas = (data || []).map(r => ({
      id: r.id_area,
      nombre: r.nombre_area
    }));

    return res.status(200).json(areas);
  } catch (err) {
    console.error('Error en obtenerAreas:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

