const { supabase, fetchAllRows } = require('./lib/supabase');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Método no permitido' });
  }

  const args = req.body?.args || [];
  const f1 = args[0] || req.body?.f1;
  const f2 = args[1] || req.body?.f2;
  const usuario = args[2] || req.body?.usuario || 'TODOS';

  if (!f1 || !f2) {
    return res.status(400).json({ success: false, message: 'Rango de fechas requerido' });
  }

  try {
    if (!supabase) throw new Error('Base de datos no inicializada');

    // Cargar mapa de etiquetas de variables
    const varDefs = await fetchAllRows(() => supabase.from('config_variables').select('variable, etiqueta'));
    const labelMap = {};
    (varDefs || []).forEach(v => {
      labelMap[v.variable] = v.etiqueta || v.variable;
    });

    // Usamos fetchAllRows para garantizar que NO se trunque a 1.000 filas
    const data = await fetchAllRows(() => {
      let q = supabase
        .from('registros')
        .select('modo_trabajo, usuario_operador, llamadas_efectivas, llamadas_totales, variables, fecha_reporte')
        .gte('fecha_reporte', f1)
        .lte('fecha_reporte', f2);

      if (usuario !== 'TODOS' && usuario) {
        q = q.ilike('usuario_operador', usuario.trim());
      }
      return q;
    });

    const map = {};
    const mapVars = {};
    let totalEfec = 0;
    let totalTot = 0;

    (data || []).forEach(r => {
      const modo = String(r.modo_trabajo || '').trim().toUpperCase();
      const efec = parseInt(r.llamadas_efectivas) || 0;
      const tot = parseInt(r.llamadas_totales) || 0;

      if (!map[modo]) map[modo] = { efectivas: 0, totales: 0 };
      map[modo].efectivas += efec;
      map[modo].totales += tot;
      totalEfec += efec;
      totalTot += tot;

      const vars = (r.variables && typeof r.variables === 'object') ? r.variables : {};
      Object.keys(vars).forEach(k => {
        const num = parseFloat(vars[k]);
        if (!isNaN(num)) {
          mapVars[k] = (mapVars[k] || 0) + num;
        }
      });
    });

    const arr = Object.keys(map)
      .map(k => ({ modo: k, efectivas: map[k].efectivas, totales: map[k].totales }))
      .sort((a, b) => b.efectivas - a.efectivas);

    const variablesTotales = Object.keys(mapVars)
      .map(k => ({ variable: k, etiqueta: labelMap[k] || k, total: mapVars[k] }))
      .sort((a, b) => b.total - a.total);

    return res.status(200).json({ datos: arr, totalEfec, totalTot, variablesTotales });
  } catch (err) {
    console.error('Error en obtenerDatosDashboard:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};
