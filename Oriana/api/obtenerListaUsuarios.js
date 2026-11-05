const { supabase } = require('./lib/supabase');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Método no permitido' });
  }

  try {
    if (!supabase) throw new Error('Base de datos no inicializada');

    const { data, error } = await supabase
      .from('usuarios')
      .select('usuario, nombre_apellido')
      .order('nombre_apellido', { ascending: true });

    if (error) throw error;

    const users = (data || []).map(r => ({
      usuario: r.usuario,
      nombre: r.nombre_apellido || r.usuario
    }));

    return res.status(200).json(users);
  } catch (err) {
    console.error('Error en obtenerListaUsuarios:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

