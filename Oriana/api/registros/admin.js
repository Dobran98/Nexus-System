const { supabase } = require('../../lib/supabase');

module.exports = async function handler(req, res) {
  const { p = 1, c = 20, t1 = '', fd = '', arrModos = [], arrOps = [], tipoTabla = 'REGULARES', arrTurnos = [] } = req.body || {};

  try {
    const page = Math.max(1, parseInt(p) || 1);
    const limit = Math.max(1, parseInt(c) || 20);

    // Obtener mapa de turnos de usuarios
    const { data: usersData } = await supabase.from('usuarios').select('usuario, turno');
    const dictTurnos = {};
    (usersData || []).forEach(u => {
      dictTurnos[String(u.usuario).toLowerCase().trim()] = (u.turno || 'MAÑANA').toUpperCase();
    });

    let query = supabase.from('registros').select('*', { count: 'exact' });

    // Filtro por fecha específica
    if (fd) {
      query = query.eq('fecha_reporte', fd);
    }

    // Filtro por tipo de tabla
    const isAn = tipoTabla === 'ANALISTAS';
    if (isAn) {
      query = query.ilike('modo', '%ANALISTA%');
    } else {
      query = query.not('modo', 'ilike', '%ANALISTA%');
    }

    // Filtro por Modos
    if (Array.isArray(arrModos) && arrModos.length > 0) {
      query = query.in('modo', arrModos);
    }

    // Filtro por Operadores
    if (Array.isArray(arrOps) && arrOps.length > 0) {
      query = query.in('usuario', arrOps.map(o => o.toUpperCase()));
    }

    // Búsqueda de texto en campaña o modo
    if (t1) {
      query = query.or(`campana.ilike.%${t1}%,modo.ilike.%${t1}%`);
    }

    // Orden cronológico inverso (los más recientes primero)
    query = query.order('id', { ascending: false });

    // Paginación en base de datos
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    const { data, count, error } = await query.range(from, to);

    if (error) throw error;

    const totalRegistros = count || 0;
    const totalPaginas = Math.ceil(totalRegistros / limit) || 1;

    const datos = (data || []).map(r => {
      const uKey = String(r.usuario || '').toLowerCase().trim();
      const turnoOp = dictTurnos[uKey] || 'MAÑANA';

      // Formato fecha DD/MM/YYYY
      let fStr = r.fecha_reporte;
      if (fStr && fStr.includes('-')) {
        const parts = fStr.split('-');
        fStr = `${parts[2]}/${parts[1]}/${parts[0]}`;
      }

      return {
        rowId: r.id,
        id: r.id_operador || String(r.id),
        fecha: fStr,
        usuario: r.usuario,
        turno: turnoOp,
        modo: r.modo,
        campana: r.campana,
        efectivas: r.efectivas,
        incidencias: r.incidencias,
        valEfec: r.val_efec,
        valInc: r.val_inc
      };
    });

    return res.status(200).json({
      datos,
      totalPaginas,
      paginaActual: page,
      totalRegistros
    });
  } catch (err) {
    console.error('Error en registros/admin:', err);
    return res.status(500).json({ error: 'Error cargando registros: ' + err.message });
  }
};
