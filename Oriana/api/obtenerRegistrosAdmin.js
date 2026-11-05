const { supabase, fetchAllRows } = require('./lib/supabase');

function formatDateDDMMYYYY(dateStr) {
  if (!dateStr) return '';
  const parts = String(dateStr).substring(0, 10).split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Método no permitido' });
  }

  const args = req.body?.args || [];
  const p = parseInt(args[0]) || 1;
  const c = parseInt(args[1]) || 20;
  const t1 = args[2] ? String(args[2]).toLowerCase().trim() : '';
  const t2 = args[3] ? String(args[3]).toLowerCase().trim() : '';
  const fd = args[4] ? String(args[4]).trim() : '';
  const arrModos = Array.isArray(args[5]) ? args[5].map(m => String(m).toUpperCase().trim()) : [];
  const arrOps = Array.isArray(args[6]) ? args[6].map(o => String(o).toUpperCase().trim()) : [];
  const tipoTabla = args[7] || '';
  const arrTurnos = Array.isArray(args[8]) ? args[8].map(t => String(t).toUpperCase().trim()) : [];

  try {
    if (!supabase) throw new Error('Base de datos no inicializada');

    // 1. Obtener mapeo de turnos de usuarios (todos los usuarios)
    const uData = await fetchAllRows(() => supabase.from('usuarios').select('usuario, turno'));
    const dictTurnos = {};
    (uData || []).forEach(u => {
      dictTurnos[String(u.usuario).toLowerCase().trim()] = String(u.turno || 'MAÑANA').toUpperCase().trim();
    });

    // 2. Traer todos los registros filtrados sin truncar en 1.000 filas
    const data = await fetchAllRows(() => {
      let query = supabase.from('registros').select('*');

      if (fd) {
        query = query.eq('fecha_reporte', fd);
      }

      if (arrModos.length > 0) {
        query = query.in('modo_trabajo', arrModos);
      }

      if (arrOps.length > 0) {
        query = query.in('usuario_operador', arrOps);
      }

      return query.order('id', { ascending: false });
    });

    // 3. Filtros en memoria para búsquedas de texto y condiciones de analista/regular
    let filtered = (data || []).filter(r => {
      const uKey = String(r.usuario_operador || '').toLowerCase().trim();
      const turnoOp = dictTurnos[uKey] || 'MAÑANA';
      const mRow = String(r.modo_trabajo || '').toUpperCase().trim();
      const isAnalyst = mRow.includes('ANALISTA') || mRow.includes('CUALITATIV');

      if (tipoTabla === 'ANALISTAS' && !isAnalyst) return false;
      if (tipoTabla === 'REGULARES' && isAnalyst) return false;

      if (arrTurnos.length > 0 && !arrTurnos.includes(turnoOp)) return false;

      const strRow = `${r.usuario_operador} ${r.modo_trabajo} ${r.campana} ${r.estados_abarcados} ${r.municipios_detalles}`.toLowerCase();
      if (t1 && !strRow.includes(t1)) return false;
      if (t2 && !strRow.includes(t2)) return false;

      return true;
    });

    const total = filtered.length;
    const pags = Math.ceil(total / c) || 1;
    const curP = Math.min(Math.max(1, p), pags);

    const slice = filtered.slice((curP - 1) * c, curP * c);

    const datos = slice.map(r => {
      const uKey = String(r.usuario_operador || '').toLowerCase().trim();
      return {
        rowId: r.id,
        id: r.id_operador || 'S/ID',
        fecha: formatDateDDMMYYYY(r.fecha_reporte),
        usuario: r.usuario_operador,
        turno: dictTurnos[uKey] || 'MAÑANA',
        modo: r.modo_trabajo,
        campana: r.campana,
        efectivas: r.llamadas_efectivas,
        incidencias: r.incidencias_reportadas,
        valEfec: r.admin_efectivas,
        valInc: r.admin_incidencias
      };
    });

    return res.status(200).json({
      datos,
      totalPaginas: pags,
      paginaActual: curP,
      totalRegistros: total
    });
  } catch (err) {
    console.error('Error en obtenerRegistrosAdmin:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};
