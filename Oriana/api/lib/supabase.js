const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

let supabase = null;

if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false }
  });
} else {
  console.warn('⚠️ Advertencia: SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY no están configuradas.');
}

/**
 * Supera el límite de 1.000 filas de Supabase/PostgREST consultando en bloques
 * usando .range(from, to) hasta recuperar el 100% de los registros coincidentes.
 * 
 * @param {Function} builderFn Función que retorna una nueva consulta base de Supabase
 * @returns {Promise<Array>} Array con todas las filas encontradas
 */
async function fetchAllRows(builderFn) {
  if (!supabase) throw new Error('Base de datos no inicializada');
  let allRows = [];
  let from = 0;
  const pageSize = 1000;

  while (true) {
    const query = builderFn();
    const { data, error } = await query.range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    allRows = allRows.concat(data);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  return allRows;
}

module.exports = { supabase, fetchAllRows };
