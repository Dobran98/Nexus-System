const actualizarHojasPorModo = require('./actualizarHojasPorModo');

/**
 * Alias retrocompatible para actualizarArchivosIndicadores.
 * Redirige la ejecución a la creación dinámica de hojas por MODO DE TRABAJO,
 * con los indicadores configurados como columnas.
 */
module.exports = async function handler(req, res) {
  return actualizarHojasPorModo(req, res);
};
