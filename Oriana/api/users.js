const { supabase } = require('../lib/supabase');

module.exports = async function handler(req, res) {
  try {
    const { data, error } = await supabase
      .from('usuarios')
      .select('usuario, nombre')
      .order('nombre', { ascending: true });

    if (error) throw error;
    return res.status(200).json(data || []);
  } catch (err) {
    return res.status(500).json({ error: 'Error cargando usuarios' });
  }
};
