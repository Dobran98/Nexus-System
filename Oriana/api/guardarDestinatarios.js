const { supabase } = require('./lib/supabase');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Método no permitido' });
  }

  const args = req.body?.args || [];
  const lista = args[0] || req.body?.lista || [];

  try {
    if (!supabase) throw new Error('Base de datos no inicializada');

    await supabase.from('config_destinatarios').delete().neq('id', 0);

    if (Array.isArray(lista) && lista.length > 0) {
      const rows = lista.map(d => {
        const chat_id = String(d.chatId || '').trim();
        const frecuencia = String(d.frecuencia || 'DIARIO').trim().toUpperCase() === 'SEMANAL' ? 'SEMANAL' : 'DIARIO';
        const activo = d.activo !== false;
        return { chat_id, frecuencia, activo };
      }).filter(r => r.chat_id);

      if (rows.length > 0) {
        const { error } = await supabase.from('config_destinatarios').insert(rows);
        if (error) throw error;
      }
    }

    return res.status(200).json({ success: true, message: 'Destinatarios guardados correctamente.' });
  } catch (err) {
    console.error('Error en guardarDestinatarios:', err);
    return res.status(500).json({ success: false, message: 'Error al guardar destinatarios: ' + err.message });
  }
};

