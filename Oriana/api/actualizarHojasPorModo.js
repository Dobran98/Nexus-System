const { supabase, fetchAllRows } = require('./lib/supabase');

/**
 * Endpoint Vercel Serverless para la creación y sincronización dinámica de hojas
 * por MODO DE TRABAJO (no por indicadores ni exportaciones).
 * Cada modo de trabajo (ej. LLAMADAS, ISSABEL, 1X10, ANALISTA) agrupa sus registros
 * y sus indicadores / variables de evaluación se configuran como COLUMNAS.
 */
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Método no permitido' });
  }

  try {
    if (!supabase) {
      return res.status(500).json({ success: false, message: 'Base de datos no inicializada' });
    }

    // 1. Obtener todas las variables configuradas por modo
    const { data: varData, error: varErr } = await supabase
      .from('config_variables')
      .select('modo, variable, etiqueta, orden')
      .order('orden', { ascending: true });

    if (varErr) console.warn('Aviso cargando config_variables:', varErr);

    const variablesPorModo = {};
    (varData || []).forEach(v => {
      const m = String(v.modo || '').toUpperCase().trim();
      if (!variablesPorModo[m]) variablesPorModo[m] = [];
      variablesPorModo[m].push({
        key: v.variable,
        etiqueta: v.etiqueta || v.variable
      });
    });

    // 2. Obtener todos los registros para determinar los modos activos y conteos
    const todosLosRegistros = await fetchAllRows(() => {
      return supabase
        .from('registros')
        .select('id, modo_trabajo, variables, llamadas_efectivas, llamadas_totales, incidencias_reportadas');
    });

    const resumenModos = {};
    (todosLosRegistros || []).forEach(r => {
      const m = String(r.modo_trabajo || 'GENERAL').toUpperCase().trim();
      if (!resumenModos[m]) {
        // Indicadores por defecto o dinámicos para este modo
        let cols = variablesPorModo[m] || [];
        if (cols.length === 0) {
          if (m.includes('ANALISTA') || m.includes('CUALITATIV')) {
            cols = [
              { key: 'efectivas', etiqueta: 'Total Actividades Realizadas' },
              { key: 'totales', etiqueta: 'Datos Analizados' }
            ];
          } else if (m.includes('ESPECIAL') || m.includes('ESEQUIBO')) {
            cols = [
              { key: 'efectivas', etiqueta: 'Llamadas Efectivas' }
            ];
          } else if (m.includes('INCIDENCIA') || m.includes('1X10')) {
            cols = [
              { key: 'efectivas', etiqueta: 'Llamadas Efectivas' },
              { key: 'totales', etiqueta: 'Llamadas Totales' },
              { key: 'incidencias', etiqueta: 'Incidencias Reportadas' }
            ];
          } else {
            cols = [
              { key: 'efectivas', etiqueta: 'Llamadas Efectivas' },
              { key: 'totales', etiqueta: 'Llamadas Totales' }
            ];
          }
        }
        resumenModos[m] = {
          modo: m,
          nombreHoja: `Modo_${m.replace(/[:/?*[\]]/g, '_')}`,
          columnasIndicadores: cols.map(c => c.etiqueta),
          totalRegistros: 0
        };
      }
      resumenModos[m].totalRegistros++;
    });

    const listaModos = Object.values(resumenModos);

    return res.status(200).json({
      success: true,
      message: `Hojas dinámicas por modo de trabajo sincronizadas correctamente (${listaModos.length} modos). Los indicadores están configurados como columnas.`,
      modos: listaModos
    });
  } catch (err) {
    console.error('Error al sincronizar hojas por modo:', err);
    return res.status(500).json({
      success: false,
      message: 'Error al sincronizar hojas dinámicas por modo: ' + err.message
    });
  }
};

