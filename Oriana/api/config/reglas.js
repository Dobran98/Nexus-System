const { supabase } = require('../../lib/supabase');

module.exports = async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const { data, error } = await supabase
        .from('reglas_acceso')
        .select('*');

      if (error) throw error;

      const rules = { ADMIN: ['*'], ANALISTA: [], OPERADOR: [] };
      let analistasTodos = true;
      let todosModos = false;

      (data || []).forEach(r => {
        const p = String(r.perfil).toUpperCase().trim();
        rules[p] = r.modos_permitidos || [];
        if (r.analistas_todos !== undefined) analistasTodos = r.analistas_todos;
        if (r.todos_modos !== undefined) todosModos = r.todos_modos;
      });

      return res.status(200).json({
        rules,
        superRules: { analistasTodos, todosModos }
      });
    } catch (err) {
      return res.status(500).json({ error: 'Error cargando reglas' });
    }
  }

  if (req.method === 'POST') {
    try {
      const { rulesData, superRulesData } = req.body || {};
      const updates = Object.keys(rulesData || {}).map(perfil => ({
        perfil: perfil.toUpperCase(),
        modos_permitidos: rulesData[perfil],
        analistas_todos: superRulesData?.analistasTodos ?? true,
        todos_modos: superRulesData?.todosModos ?? false,
        updated_at: new Date().toISOString()
      }));

      for (const item of updates) {
        await supabase.from('reglas_acceso').upsert(item, { onConflict: 'perfil' });
      }

      return res.status(200).json({ success: true, message: 'Reglas de acceso guardadas correctamente.' });
    } catch (err) {
      return res.status(500).json({ success: false, message: 'Error guardando reglas: ' + err.message });
    }
  }

  return res.status(405).json({ message: 'Método no permitido' });
};
