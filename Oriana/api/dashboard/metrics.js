const { supabase } = require('../../lib/supabase');

module.exports = async function handler(req, res) {
  const { f1, f2, usuario = 'TODOS' } = req.body || {};

  try {
    let query = supabase
      .from('registros')
      .select('modo, efectivas, totales');

    if (f1) query = query.gte('fecha_reporte', f1);
    if (f2) query = query.lte('fecha_reporte', f2);
    if (usuario && usuario !== 'TODOS') {
      query = query.ilike('usuario', usuario);
    }

    const { data, error } = await query;
    if (error) throw error;

    const map = {};
    let totalEfec = 0;
    let totalTot = 0;

    (data || []).forEach(r => {
      const modo = String(r.modo || '').trim().toUpperCase();
      const efec = parseInt(r.efectivas) || 0;
      const tot  = parseInt(r.totales) || 0;

      if (!map[modo]) map[modo] = { efectivas: 0, totales: 0 };
      map[modo].efectivas += efec;
      map[modo].totales += tot;
      totalEfec += efec;
      totalTot += tot;
    });

    const arr = Object.keys(map)
      .map(k => ({ modo: k, efectivas: map[k].efectivas, totales: map[k].totales }))
      .sort((a, b) => b.efectivas - a.efectivas);

    return res.status(200).json({ datos: arr, totalEfec, totalTot });
  } catch (err) {
    console.error('Error en dashboard/metrics:', err);
    return res.status(500).json({ error: 'Error calculando métricas: ' + err.message });
  }
};
