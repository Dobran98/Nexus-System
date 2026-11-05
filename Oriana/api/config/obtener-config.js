const { supabase } = require('../../lib/supabase');

module.exports = async function handler(req, res) {
  try {
    const { data, error } = await supabase
      .from('modos_config')
      .select('*')
      .order('modo', { ascending: true });

    if (error) throw error;

    const config = {};
    (data || []).forEach(row => {
      config[row.modo] = {
        campanas: row.campanas || [],
        tipoMetrica: row.tipo_metrica || 'LLAMADAS',
        etiquetaPrincipal: row.etiqueta_principal || 'Llamadas Efectivas',
        tieneTotales: row.tiene_totales ?? true,
        etiquetaTotales: row.etiqueta_totales || 'Llamadas Totales Realizadas',
        tieneDetalle: row.tiene_detalle ?? false,
        tieneIncidencias: row.tiene_incidencias ?? false,
        tieneGeografia: row.tiene_geografia ?? false,
        esMultiActividad: row.es_multi_actividad ?? false,
        icono: row.icono || '🔹'
      };
    });

    return res.status(200).json(config);
  } catch (err) {
    console.error('Error en obtener-config:', err);
    return res.status(500).json({ error: 'Error al obtener la configuración' });
  }
};
