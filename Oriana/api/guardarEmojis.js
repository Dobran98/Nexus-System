const { supabase } = require('./lib/supabase');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Método no permitido' });
  }

  const args = req.body?.args || [];
  const lista = args[0] || req.body?.lista || [];

  try {
    if (!supabase) throw new Error('Base de datos no inicializada');

    // Limpiar tabla e insertar nueva configuración
    await supabase.from('config_emojis').delete().neq('id', 0);

    if (Array.isArray(lista) && lista.length > 0) {
      const rows = lista.map(e => {
        const tipo = String(e.tipo || '').trim().toUpperCase();
        const nombre = String(e.nombre || '').trim();
        const emoji = String(e.emoji || '').trim();
        return { tipo, nombre, emoji };
      }).filter(r => r.nombre && r.emoji && ['MODO', 'CAMPAÑA', 'VARIABLE', 'CAMPANA'].includes(r.tipo));

      if (rows.length > 0) {
        const { error } = await supabase.from('config_emojis').insert(rows);
        if (error) throw error;
      }
    }

    return res.status(200).json({ success: true, message: 'Repositorio de emojis guardado correctamente.' });
  } catch (err) {
    console.error('Error en guardarEmojis:', err);
    return res.status(500).json({ success: false, message: 'Error al guardar emojis: ' + err.message });
  }
};

