const { supabase } = require('../../lib/supabase');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Método no permitido' });
  }

  const { modo, payload } = req.body || {};
  if (!modo) {
    return res.status(400).json({ success: false, message: 'Nombre de modo requerido' });
  }

  try {
    const modoClean = String(modo).trim().toUpperCase();
    let cfg = typeof payload === 'object' ? payload : { campanas: [] };
    const campanasArr = Array.isArray(cfg.campanas) ? cfg.campanas : [];

    const record = {
      modo: modoClean,
      campanas: campanasArr,
      tipo_metrica: cfg.tipoMetrica || 'LLAMADAS',
      etiqueta_principal: cfg.etiquetaPrincipal || 'Efectivas / Realizadas',
      tiene_totales: cfg.tieneTotales ?? true,
      etiqueta_totales: cfg.etiquetaTotales || 'Totales / Asignadas',
      tiene_detalle: cfg.tieneDetalle ?? false,
      tiene_incidencias: cfg.tieneIncidencias ?? false,
      tiene_geografia: cfg.tieneGeografia ?? false,
      es_multi_actividad: cfg.esMultiActividad ?? false,
      icono: cfg.icono || '🔹',
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from('modos_config')
      .upsert(record, { onConflict: 'modo' });

    if (error) throw error;

    return res.status(200).json({ success: true, message: `Configuración de "${modoClean}" guardada con éxito.` });
  } catch (err) {
    console.error('Error guardando configuración:', err);
    return res.status(500).json({ success: false, message: 'Error en base de datos: ' + err.message });
  }
};
