const { supabase } = require('./lib/supabase');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Método no permitido' });
  }

  const args = req.body?.args || [];
  const modo = args[0] || req.body?.modo;
  const payload = args[1] !== undefined ? args[1] : req.body?.payload;

  if (!modo) {
    return res.status(400).json({ success: false, message: 'Modo requerido' });
  }

  try {
    if (!supabase) throw new Error('Base de datos no inicializada');

    let campanasStr = '';
    let detalle = {};

    if (typeof payload === 'string') {
      campanasStr = payload;
    } else if (payload && typeof payload === 'object') {
      const camps = Array.isArray(payload.campanas) ? payload.campanas : [];
      campanasStr = camps.join(', ');
      detalle = {
        tipoMetrica: payload.tipoMetrica || 'LLAMADAS',
        etiquetaPrincipal: payload.etiquetaPrincipal || 'Llamadas Efectivas',
        tieneTotales: !!payload.tieneTotales,
        etiquetaTotales: payload.etiquetaTotales || 'Totales / Asignadas',
        tieneDetalle: !!payload.tieneDetalle,
        tieneIncidencias: !!payload.tieneIncidencias,
        tieneGeografia: !!payload.tieneGeografia,
        esMultiActividad: !!payload.esMultiActividad,
        icono: payload.icono || '🔹'
      };
    }

    const { error } = await supabase.from('configuracion').upsert({
      modo: String(modo).trim(),
      campanas: campanasStr,
      detalle,
      updated_at: new Date().toISOString()
    }, { onConflict: 'modo' });

    if (error) throw error;

    return res.status(200).json({ success: true, message: 'Configuración guardada exitosamente.' });
  } catch (err) {
    console.error('Error en guardarNuevaConfiguracion:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

