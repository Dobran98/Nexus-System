const { supabase, fetchAllRows } = require('./lib/supabase');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Método no permitido' });
  }

  try {
    if (!supabase) throw new Error('Base de datos no inicializada');

    const data = await fetchAllRows(() => supabase.from('config_destinatarios').select('*'));

    const result = (data || []).map(r => ({
      chatId: String(r.chat_id || '').trim(),
      frecuencia: String(r.frecuencia || 'DIARIO').trim().toUpperCase(),
      activo: r.activo !== false
    })).filter(r => r.chatId);

    return res.status(200).json(result);
  } catch (err) {
    console.error('Error en obtenerDestinatarios:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

