const { supabase } = require('./lib/supabase');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Método no permitido' });
  }

  const args = req.body?.args || [];
  const rulesData = args[0] || req.body?.rules || {};

  try {
    if (!supabase) throw new Error('Base de datos no inicializada');

    const rows = Object.keys(rulesData).map(perfil => {
      const list = rulesData[perfil];
      const val = (Array.isArray(list) && list.length === 1 && list[0] === '*') ? '*' : (Array.isArray(list) ? list.join(',') : String(list));
      return {
        perfil: perfil.toUpperCase().trim(),
        modos_permitidos: val
      };
    });

    for (const row of rows) {
      await supabase.from('reglas_acceso').upsert(row, { onConflict: 'perfil' });
    }

    return res.status(200).json({ success: true, message: 'Reglas de acceso guardadas correctamente.' });
  } catch (err) {
    console.error('Error en guardarReglasAcceso:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

