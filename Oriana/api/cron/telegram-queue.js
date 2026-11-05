const { supabase } = require('../lib/supabase');
const { enviarTelegramDirecto } = require('../lib/telegram');

module.exports = async function handler(req, res) {
  // Opcional: verificar autorización CRON_SECRET de Vercel
  const authHeader = req.headers['authorization'];
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.warn('Cron request without matching CRON_SECRET');
  }

  try {
    if (!supabase) {
      return res.status(200).json({ success: false, message: 'Base de datos no inicializada' });
    }

    // Obtener hasta 10 mensajes pendientes
    const { data: items, error } = await supabase
      .from('cola_telegram')
      .select('*')
      .in('estado', ['PENDIENTE', 'ERROR', 'PENDIENTE_REGISTRO'])
      .lt('intentos', 5)
      .order('fecha_encola', { ascending: true })
      .limit(10);

    if (error) throw error;

    let procesados = 0;
    for (const item of (items || [])) {
      const payload = item.payload || {};
      const msg = payload.msg || (typeof payload === 'string' ? payload : null);

      if (msg) {
        const ok = await enviarTelegramDirecto(msg);
        if (ok) {
          await supabase.from('cola_telegram').update({
            estado: 'ENVIADO',
            intentos: (item.intentos || 0) + 1,
            updated_at: new Date().toISOString()
          }).eq('id_cola', item.id_cola);
          procesados++;
        } else {
          await supabase.from('cola_telegram').update({
            estado: 'ERROR',
            intentos: (item.intentos || 0) + 1,
            updated_at: new Date().toISOString()
          }).eq('id_cola', item.id_cola);
        }
      }
    }

    // Limpiar cola antigua (mensajes ENVIADOS con más de 24 horas)
    const fechaLimite = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    await supabase.from('cola_telegram')
      .delete()
      .eq('estado', 'ENVIADO')
      .lt('updated_at', fechaLimite);

    return res.status(200).json({ success: true, procesados });
  } catch (err) {
    console.error('Error en cron telegram-queue:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};
