const { supabase } = require('./lib/supabase');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Método no permitido' });
  }

  const args = req.body?.args || [];
  const lista = args[0] || req.body?.lista || [];
  const user = args[1] || req.body?.user || 'Admin';
  const rol = args[2] || req.body?.rol || '';

  try {
    if (!supabase) throw new Error('Base de datos no inicializada');

    let actualizados = 0;
    for (const item of lista) {
      if (item.rowId) {
        const efVal = (item.efectivas !== '' && item.efectivas !== null && item.efectivas !== undefined) ? Number(item.efectivas) : null;
        const incVal = (item.incidencias !== '' && item.incidencias !== null && item.incidencias !== undefined) ? Number(item.incidencias) : null;

        const { error } = await supabase
          .from('registros')
          .update({
            admin_efectivas: efVal,
            admin_incidencias: incVal
          })
          .eq('id', item.rowId);

        if (!error) actualizados++;
      }
    }

    await supabase.from('logs_auditoria').insert({
      usuario: user,
      accion: 'VALIDACIÓN MASIVA',
      detalle: `${actualizados} filas actualizadas`,
      rol: rol || ''
    });

    return res.status(200).json({ success: true, actualizados });
  } catch (err) {
    console.error('Error en guardarValidacionMasiva:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

