const { supabase } = require('./lib/supabase');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Método no permitido' });
  }

  const args = req.body?.args || [];
  const modo = args[0] || req.body?.modo;
  const lista = args[1] || req.body?.lista || [];

  if (!modo) {
    return res.status(400).json({ success: false, message: 'Modo requerido' });
  }

  try {
    if (!supabase) throw new Error('Base de datos no inicializada');

    const mBusca = String(modo).trim();

    // Eliminar variables previas para este modo
    const { error: delErr } = await supabase
      .from('config_variables')
      .delete()
      .eq('modo', mBusca);

    if (delErr) throw delErr;

    if (Array.isArray(lista) && lista.length > 0) {
      const rows = lista.map(v => {
        const variable = String(v.variable || '').trim();
        return {
          modo: mBusca,
          variable,
          etiqueta: String(v.etiqueta || '').trim() || variable,
          tipo: String(v.tipo || '').toUpperCase() === 'TEXTO' ? 'TEXTO' : 'NUMERO',
          obligatorio: v.obligatorio === true || String(v.obligatorio).toUpperCase() === 'SI',
          depende_de: String(v.padre || '').trim()
        };
      }).filter(r => r.variable);

      if (rows.length > 0) {
        const { error: insErr } = await supabase.from('config_variables').insert(rows);
        if (insErr) throw insErr;
      }
    }

    return res.status(200).json({ success: true, message: 'Variables de evaluación guardadas correctamente.' });
  } catch (err) {
    console.error('Error en guardarVariablesModo:', err);
    return res.status(500).json({ success: false, message: 'Error al guardar variables: ' + err.message });
  }
};

