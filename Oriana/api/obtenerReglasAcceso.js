const { supabase } = require('./lib/supabase');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Método no permitido' });
  }

  try {
    if (!supabase) throw new Error('Base de datos no inicializada');

    const { data, error } = await supabase
      .from('reglas_acceso')
      .select('perfil, modos_permitidos');

    if (error) throw error;

    const rules = {
      ADMIN: ["*"],
      ANALISTA: [],
      OPERADOR: []
    };

    (data || []).forEach(r => {
      const perfil = String(r.perfil || '').toUpperCase().trim();
      const modosStr = String(r.modos_permitidos || '').trim();
      if (perfil) {
        rules[perfil] = (modosStr === '*') ? ['*'] : modosStr.split(',').map(m => m.trim()).filter(Boolean);
      }
    });

    return res.status(200).json({
      rules,
      superRules: {
        analistasTodos: true,
        todosModos: false
      }
    });
  } catch (err) {
    console.error('Error en obtenerReglasAcceso:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

