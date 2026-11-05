const ExcelJS = require('exceljs');
const { supabase, fetchAllRows } = require('./lib/supabase');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Método no permitido' });
  }

  const args = req.body?.args || [];
  const f1 = args[0] || req.body?.f1;
  const f2 = args[1] || req.body?.f2;
  const fm = args[2] || req.body?.fm || 'TODOS';

  if (!f1 || !f2) {
    return res.status(400).json({ success: false, message: 'Fechas requeridas' });
  }

  try {
    if (!supabase) throw new Error('Base de datos no inicializada');

    // Cargar mapa de etiquetas de variables
    const varDefs = await fetchAllRows(() => supabase.from('config_variables').select('variable, etiqueta'));
    const labelMap = {};
    (varDefs || []).forEach(v => {
      labelMap[v.variable] = v.etiqueta || v.variable;
    });

    // Recuperar todos los registros sin límite de 1.000 filas
    const data = await fetchAllRows(() => {
      let query = supabase
        .from('registros')
        .select('*')
        .gte('fecha_reporte', f1)
        .lte('fecha_reporte', f2)
        .order('fecha_reporte', { ascending: true });

      if (fm !== 'TODOS' && fm) {
        query = query.eq('modo_trabajo', fm);
      }
      return query;
    });

    // Descubrir variables dinámicas presentes en los registros seleccionados
    const varCols = [];
    (data || []).forEach(r => {
      const vars = (r.variables && typeof r.variables === 'object') ? r.variables : {};
      Object.keys(vars).forEach(k => {
        if (!varCols.some(v => v.key === k)) {
          varCols.push({ key: k, etiqueta: labelMap[k] || k });
        }
      });
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Reporte');

    const baseColumns = [
      { header: 'ID', key: 'id', width: 12 },
      { header: 'Fecha', key: 'fecha', width: 14 },
      { header: 'Usuario', key: 'usuario', width: 22 },
      { header: 'Modo', key: 'modo', width: 24 },
      { header: 'Actividad / Campaña', key: 'campana', width: 35 },
      { header: 'Efectivas', key: 'efectivas', width: 14 },
      { header: 'Totales', key: 'totales', width: 14 },
      { header: 'Incidencias', key: 'incidencias', width: 14 },
      { header: 'Estados', key: 'estados', width: 20 },
      { header: 'Detalle / Municipios', key: 'detalle', width: 30 },
      { header: 'Val. Efec', key: 'valEfec', width: 12 },
      { header: 'Val. Inc', key: 'valInc', width: 12 }
    ];

    varCols.forEach(v => {
      baseColumns.push({ header: v.etiqueta, key: v.key, width: 18 });
    });

    worksheet.columns = baseColumns;

    // Estilo de cabecera
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E40AF' }
    };

    let sumEf = 0, sumTot = 0, sumInc = 0;
    const sumVars = {};
    varCols.forEach(v => { sumVars[v.key] = 0; });

    (data || []).forEach(r => {
      const vars = (r.variables && typeof r.variables === 'object') ? r.variables : {};
      const ef = parseInt(r.llamadas_efectivas) || 0;
      const tot = parseInt(r.llamadas_totales) || 0;
      const inc = parseInt(r.incidencias_reportadas) || 0;

      sumEf += ef;
      sumTot += tot;
      sumInc += inc;

      const rowObj = {
        id: r.id_operador || 'S/ID',
        fecha: r.fecha_reporte,
        usuario: r.usuario_operador,
        modo: r.modo_trabajo,
        campana: r.campana,
        efectivas: ef,
        totales: tot,
        incidencias: inc,
        estados: r.estados_abarcados,
        detalle: r.municipios_detalles,
        valEfec: r.admin_efectivas,
        valInc: r.admin_incidencias
      };

      varCols.forEach(v => {
        const val = vars[v.key] !== undefined ? vars[v.key] : '';
        rowObj[v.key] = val;
        const num = parseFloat(val);
        if (!isNaN(num)) sumVars[v.key] += num;
      });

      worksheet.addRow(rowObj);
    });

    // Fila de totales al final
    if (data.length > 0) {
      const totObj = {
        id: 'TOTALES',
        fecha: '',
        usuario: '',
        modo: '',
        campana: '',
        efectivas: sumEf,
        totales: sumTot,
        incidencias: sumInc,
        estados: '',
        detalle: '',
        valEfec: '',
        valInc: ''
      };
      varCols.forEach(v => {
        totObj[v.key] = sumVars[v.key];
      });
      const totRow = worksheet.addRow(totObj);
      totRow.font = { bold: true };
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const base64 = Buffer.from(buffer).toString('base64');

    return res.status(200).json({
      success: true,
      base64,
      filename: `Reporte_${f1}_al_${f2}.xlsx`
    });
  } catch (err) {
    console.error('Error en generarReporteXLSX:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};
