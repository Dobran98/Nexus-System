const { supabase } = require('../../lib/supabase');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Método no permitido' });
  }

  const { rowId, ef, inc, user, rol, lista } = req.body || {};

  try {
    // 1. Guardado masivo
    if (Array.isArray(lista)) {
      let actualizados = 0;
      for (const item of lista) {
        if (item.rowId) {
          await supabase
            .from('registros')
            .update({ val_efec: item.efectivas || null, val_inc: item.incidencias || null })
            .eq('id', item.rowId);
          actualizados++;
        }
      }

      await supabase.from('logs_auditoria').insert([{
        admin: user || 'ADMIN',
        accion: 'VALIDACIÓN MASIVA',
        detalle: `${actualizados} filas actualizadas`,
        rol: rol || ''
      }]);

      return res.status(200).json({ success: true, actualizados });
    }

    // 2. Guardado individual
    if (rowId) {
      const { error } = await supabase
        .from('registros')
        .update({ val_efec: ef || null, val_inc: inc || null })
        .eq('id', rowId);

      if (error) throw error;

      await supabase.from('logs_auditoria').insert([{
        admin: user || 'ADMIN',
        accion: 'VALIDACIÓN INDIVIDUAL',
        detalle: `Fila ID ${rowId}: Efec=${ef}, Inc=${inc}`,
        rol: rol || ''
      }]);

      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ success: false, message: 'Parámetros insuficientes' });
  } catch (err) {
    console.error('Error en validar:', err);
    return res.status(500).json({ success: false, message: 'Error al validar: ' + err.message });
  }
};
