const { supabase } = require('./lib/supabase');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Método no permitido' });
  }

  const args = req.body?.args || [];
  const rowId = args[0] || req.body?.rowId;
  const ef = args[1] !== undefined ? args[1] : req.body?.ef;
  const inc = args[2] !== undefined ? args[2] : req.body?.inc;
  const user = args[3] || req.body?.user || 'Admin';
  const rol = args[4] || req.body?.rol || '';

  if (!rowId) {
    return res.status(400).json({ success: false, message: 'Fila inválida' });
  }

  try {
    if (!supabase) throw new Error('Base de datos no inicializada');

    const efVal = (ef !== '' && ef !== null && ef !== undefined) ? Number(ef) : null;
    const incVal = (inc !== '' && inc !== null && inc !== undefined) ? Number(inc) : null;

    const { error: updErr } = await supabase
      .from('registros')
      .update({
        admin_efectivas: efVal,
        admin_incidencias: incVal
      })
      .eq('id', rowId);

    if (updErr) throw updErr;

    await supabase.from('logs_auditoria').insert({
      usuario: user,
      accion: 'VALIDACIÓN INDIVIDUAL',
      detalle: `Fila ID ${rowId}: Efec=${ef}, Inc=${inc}`,
      rol: rol || ''
    });

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Error en guardarValidacionAdmin:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

