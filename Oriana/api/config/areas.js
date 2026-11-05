const { supabase } = require('../../lib/supabase');

module.exports = async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const { data, error } = await supabase
        .from('areas_trabajo')
        .select('id, nombre')
        .order('id', { ascending: true });

      if (error) throw error;
      return res.status(200).json((data || []).map(r => ({ id: String(r.id), nombre: r.nombre })));
    } catch (err) {
      return res.status(500).json({ error: 'Error cargando áreas' });
    }
  }

  if (req.method === 'POST') {
    try {
      const lista = req.body || [];
      // Eliminar y reinsertar
      await supabase.from('areas_trabajo').delete().neq('id', 0);

      const toInsert = lista.map(item => ({
        id: parseInt(item.id) || undefined,
        nombre: String(item.nombre || '').trim().toUpperCase()
      }));

      const { error } = await supabase.from('areas_trabajo').insert(toInsert);
      if (error) throw error;

      return res.status(200).json({ success: true, message: 'Áreas de trabajo actualizadas con éxito.' });
    } catch (err) {
      return res.status(500).json({ success: false, message: 'Error guardando áreas: ' + err.message });
    }
  }

  return res.status(405).json({ message: 'Método no permitido' });
};
