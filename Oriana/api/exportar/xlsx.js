const ExcelJS = require('exceljs');
const { supabase } = require('../../lib/supabase');

module.exports = async function handler(req, res) {
  const { f1, f2, fm = 'TODOS' } = req.body || {};

  try {
    let query = supabase.from('registros').select('*');
    if (f1) query = query.gte('fecha_reporte', f1);
    if (f2) query = query.lte('fecha_reporte', f2);
    if (fm && fm !== 'TODOS') query = query.eq('modo', fm);

    const { data, error } = await query.order('id', { ascending: true });
    if (error) throw error;

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Registros');

    worksheet.columns = [
      { header: 'ID', key: 'id', width: 12 },
      { header: 'Fecha', key: 'fecha', width: 14 },
      { header: 'Usuario', key: 'usuario', width: 18 },
      { header: 'Modo', key: 'modo', width: 22 },
      { header: 'Actividad / Campaña', key: 'campana', width: 30 },
      { header: 'Efectivas / Unidades', key: 'efectivas', width: 18 },
      { header: 'Totales', key: 'totales', width: 12 },
      { header: 'Incidencias', key: 'incidencias', width: 12 },
      { header: 'Estados', key: 'estados', width: 20 },
      { header: 'Detalle / Municipios', key: 'detalle', width: 30 },
      { header: 'V. Efec', key: 'valEfec', width: 10 },
      { header: 'V. Inc', key: 'valInc', width: 15 }
    ];

    (data || []).forEach(r => {
      worksheet.addRow({
        id: r.id_operador || r.id,
        fecha: r.fecha_reporte,
        usuario: r.usuario,
        modo: r.modo,
        campana: r.campana,
        efectivas: r.efectivas,
        totales: r.totales,
        incidencias: r.incidencias,
        estados: r.estados,
        detalle: r.municipios_detalle,
        valEfec: r.val_efec || '',
        valInc: r.val_inc || ''
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const base64 = Buffer.from(buffer).toString('base64');

    return res.status(200).json({
      success: true,
      base64,
      filename: `Reporte_${f1 || 'inicio'}_al_${f2 || 'fin'}.xlsx`
    });
  } catch (err) {
    console.error('Error generando Excel:', err);
    return res.status(500).json({ success: false, message: 'Error generando Excel: ' + err.message });
  }
};
