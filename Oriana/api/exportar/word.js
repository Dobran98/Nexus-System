const { supabase } = require('../../lib/supabase');

module.exports = async function handler(req, res) {
  const { f1, f2, tipo = 1 } = req.body || {};

  try {
    // 1. Cargar usuarios para turnos y nombres
    const { data: usersData } = await supabase.from('usuarios').select('usuario, nombre, turno');
    const dictUsu = {};
    (usersData || []).forEach(u => {
      dictUsu[String(u.usuario).toLowerCase().trim()] = {
        nombre: u.nombre || u.usuario,
        turno: (u.turno || 'MAÑANA').toUpperCase()
      };
    });

    // 2. Cargar configuración de modos para etiquetas dinámicas
    const { data: configData } = await supabase.from('modos_config').select('*');
    const configMap = {};
    (configData || []).forEach(c => {
      configMap[c.modo] = {
        etiquetaPrincipal: c.etiqueta_principal || 'Efectivas / Realizadas',
        etiquetaTotales: c.etiqueta_totales || 'Totales / Asignadas',
        tieneTotales: c.tiene_totales ?? true,
        tieneIncidencias: c.tiene_incidencias ?? false
      };
    });

    // 3. Cargar registros en rango
    let query = supabase.from('registros').select('*');
    if (f1) query = query.gte('fecha_reporte', f1);
    if (f2) query = query.lte('fecha_reporte', f2);

    const { data: registros, error } = await query;
    if (error) throw error;

    const resumenGeneral = {};
    const resumenPorModo = {};
    const resumenPorOp   = {};

    (registros || []).forEach(r => {
      const uKey = String(r.usuario || '').trim().toLowerCase();
      const modo = String(r.modo || '').trim().toUpperCase();
      const efec = parseInt(r.efectivas) || 0;
      const tot  = parseInt(r.totales) || 0;
      const inc  = parseInt(r.incidencias) || 0;

      if (!resumenGeneral[modo]) resumenGeneral[modo] = { efectivas: 0, totales: 0, incidencias: 0 };
      if (!resumenPorModo[modo]) resumenPorModo[modo] = {};
      if (!resumenPorModo[modo][uKey]) resumenPorModo[modo][uKey] = { efectivas: 0, totales: 0, incidencias: 0 };
      if (!resumenPorOp[uKey]) resumenPorOp[uKey] = {};
      if (!resumenPorOp[uKey][modo]) resumenPorOp[uKey][modo] = { efectivas: 0, totales: 0, incidencias: 0 };

      resumenGeneral[modo].efectivas += efec;
      resumenGeneral[modo].totales += tot;
      resumenGeneral[modo].incidencias += inc;

      resumenPorModo[modo][uKey].efectivas += efec;
      resumenPorModo[modo][uKey].totales += tot;
      resumenPorModo[modo][uKey].incidencias += inc;

      resumenPorOp[uKey][modo].efectivas += efec;
      resumenPorOp[uKey][modo].totales += tot;
      resumenPorOp[uKey][modo].incidencias += inc;
    });

    let titulo, nombreArchivo;
    if (tipo === 1) {
      titulo = 'Reporte General';
      nombreArchivo = `Reporte_General_${f1}_al_${f2}.doc`;
    } else if (tipo === 2) {
      titulo = 'Reporte General por Modo';
      nombreArchivo = `Reporte_General_Modos_${f1}_al_${f2}.doc`;
    } else {
      titulo = 'Reporte General por Operadores';
      nombreArchivo = `Reporte_General_Operadores_${f1}_al_${f2}.doc`;
    }

    let html = `<html xmlns:o='urn:schemas-microsoft-com:office:office'
      xmlns:w='urn:schemas-microsoft-com:office:word'
      xmlns='http://www.w3.org/TR/REC-html40'>
      <head><meta charset="utf-8"><title>${titulo}</title></head>
      <body style="font-family: Arial, sans-serif;">
      <div style="text-align:center; margin-bottom:30px;">
        <h2><b><i>${titulo}</i></b></h2>
        <p style="font-size:14px;">en el rango de fecha ${f1} al ${f2}.</p>
      </div>`;

    const modosOrdenados = Object.keys(resumenGeneral).sort();
    if (modosOrdenados.length === 0) {
      html += '<p style="text-align:center;">No hay registros para este rango de fechas.</p></body></html>';
      return res.status(200).json({
        success: true,
        base64: Buffer.from(html).toString('base64'),
        filename: nombreArchivo
      });
    }

    const armarLinea = (m, d) => {
      const cfg = configMap[m] || { etiquetaPrincipal: 'Efectivas / Realizadas', etiquetaTotales: 'Totales / Asignadas' };
      let txt = `<li style="margin-bottom:10px; font-size:14px;"><b>Modo: ${m}</b>
                 <ul style="padding-left:20px; margin-top:3px;">
                   <li>${cfg.etiquetaPrincipal}: <b>${d.efectivas}</b></li>`;
      if (cfg.tieneTotales || d.totales > 0) {
        txt += `<li>${cfg.etiquetaTotales}: ${d.totales}</li>`;
      }
      if (cfg.tieneIncidencias && d.incidencias > 0) {
        txt += `<li>Incidencias Totales: ${d.incidencias}</li>`;
      }
      txt += '</ul></li>';
      return txt;
    };

    if (tipo === 1) {
      let gE = 0, gT = 0;
      html += '<ul style="list-style-type:none; padding-left:10px;">';
      modosOrdenados.forEach(m => {
        gE += resumenGeneral[m].efectivas;
        gT += resumenGeneral[m].totales;
        html += armarLinea(m, resumenGeneral[m]);
      });
      html += `</ul><br><div style="border-top:2px solid #000; padding-top:10px; margin-top:20px;">
        <p style="font-size:16px; margin:5px 0;"><b>General total efectivas / actividades: ${gE}</b></p>
        <p style="font-size:16px; margin:5px 0;"><b>General total llamadas / datos procesados: ${gT}</b></p>
      </div>`;
    } else if (tipo === 2) {
      modosOrdenados.forEach(m => {
        const cfg = configMap[m] || { etiquetaPrincipal: 'Efectivas / Realizadas', etiquetaTotales: 'Totales / Asignadas' };
        html += `<h3 style="color:#1e40af; margin-bottom:10px; border-bottom:1px solid #ccc; padding-bottom:3px;">Modo: ${m}</h3>
                 <ul style="list-style-type:none; padding-left:15px; margin-top:0;">`;
        Object.keys(resumenPorModo[m]).sort().forEach(uKey => {
          const ud = dictUsu[uKey] || { nombre: uKey.toUpperCase() };
          const d  = resumenPorModo[m][uKey];
          html += `<li style="margin-bottom:15px; font-size:14px;"><b>Operador: ${ud.nombre}</b>
                     <ul style="padding-left:20px; margin-top:3px;">
                       <li>${cfg.etiquetaPrincipal}: <b>${d.efectivas}</b></li>`;
          if (cfg.tieneTotales || d.totales > 0) {
            html += `<li>${cfg.etiquetaTotales}: ${d.totales}</li>`;
          }
          if (cfg.tieneIncidencias && d.incidencias > 0) {
            html += `<li>Incidencias: ${d.incidencias}</li>`;
          }
          html += '</ul></li>';
        });
        html += '</ul><br>';
      });
    } else {
      Object.keys(resumenPorOp).sort().forEach(uKey => {
        const ud = dictUsu[uKey] || { nombre: uKey.toUpperCase(), turno: 'No especificado' };
        html += `<div style="margin-bottom:25px;">
          <h3 style="color:#1e40af; margin-bottom:10px; border-bottom:1px solid #ccc; padding-bottom:3px;">
            Operador: ${ud.nombre} — Turno: ${ud.turno}
          </h3>
          <ul style="list-style-type:none; padding-left:15px; margin-top:0;">`;
        Object.keys(resumenPorOp[uKey]).sort().forEach(m => {
          html += armarLinea(m, resumenPorOp[uKey][m]);
        });
        html += '</ul></div>';
      });
    }

    html += '</body></html>';

    return res.status(200).json({
      success: true,
      base64: Buffer.from(html).toString('base64'),
      filename: nombreArchivo
    });
  } catch (err) {
    console.error('Error generando Word:', err);
    return res.status(500).json({ success: false, message: 'Error generando documento Word: ' + err.message });
  }
};
