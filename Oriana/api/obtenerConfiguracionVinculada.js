const { supabase } = require('./lib/supabase');

function inferirConfiguracionModo(modo, campanas) {
  const mUp = String(modo || '').toUpperCase();
  const isAnalista = mUp.includes('ANALISTA') || mUp.includes('CUALITATIV');
  const isEspecial = mUp.includes('ESPECIAL') || mUp.includes('ESEQUIBO');
  const isIncidencia = mUp.includes('1X10') || mUp.includes('INCIDENCIA');
  const isIssabel = mUp.includes('ISSABEL') || mUp.includes('ISABELL');

  if (isAnalista) {
    return {
      campanas: campanas || [],
      tipoMetrica: 'DATOS',
      etiquetaPrincipal: 'Datos Analizados',
      tieneTotales: true,
      etiquetaTotales: 'Datos Totales en Base',
      tieneDetalle: true,
      tieneIncidencias: false,
      tieneGeografia: false,
      esMultiActividad: true,
      icono: '🧠'
    };
  }

  if (isEspecial) {
    return {
      campanas: campanas || [],
      tipoMetrica: 'LLAMADAS',
      etiquetaPrincipal: 'Llamadas Efectivas',
      tieneTotales: false,
      etiquetaTotales: 'Llamadas Totales',
      tieneDetalle: true,
      tieneIncidencias: false,
      tieneGeografia: false,
      esMultiActividad: false,
      icono: '🔸'
    };
  }

  if (isIncidencia) {
    return {
      campanas: campanas || [],
      tipoMetrica: 'LLAMADAS',
      etiquetaPrincipal: 'Llamadas Efectivas',
      tieneTotales: true,
      etiquetaTotales: 'Llamadas Totales Realizadas',
      tieneDetalle: false,
      tieneIncidencias: true,
      tieneGeografia: true,
      esMultiActividad: false,
      icono: mUp.includes('1X10') ? '🟡' : '🟥'
    };
  }

  if (isIssabel) {
    return {
      campanas: campanas || [],
      tipoMetrica: 'LLAMADAS',
      etiquetaPrincipal: 'Llamadas Efectivas',
      tieneTotales: true,
      etiquetaTotales: 'Llamadas Totales Realizadas',
      tieneDetalle: false,
      tieneIncidencias: false,
      tieneGeografia: false,
      esMultiActividad: false,
      icono: '🔵'
    };
  }

  return {
    campanas: campanas || [],
    tipoMetrica: 'LLAMADAS',
    etiquetaPrincipal: 'Llamadas Efectivas',
    tieneTotales: true,
    etiquetaTotales: 'Llamadas Totales Realizadas',
    tieneDetalle: false,
    tieneIncidencias: false,
    tieneGeografia: false,
    esMultiActividad: false,
    icono: '🔹'
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Método no permitido' });
  }

  try {
    if (!supabase) throw new Error('Base de datos no inicializada');

    const { data, error } = await supabase
      .from('configuracion')
      .select('*');

    if (error) throw error;

    const config = {};
    (data || []).forEach(r => {
      const modo = String(r.modo || '').trim();
      if (!modo) return;

      const campStr = r.campanas || '';
      const campanas = campStr.split(',').map(c => c.trim()).filter(Boolean);

      const detalle = r.detalle || {};
      if (detalle && Object.keys(detalle).length > 0) {
        config[modo] = {
          campanas,
          ...detalle
        };
      } else {
        config[modo] = inferirConfiguracionModo(modo, campanas);
      }
    });

    return res.status(200).json(config);
  } catch (err) {
    console.error('Error en obtenerConfiguracionVinculada:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

