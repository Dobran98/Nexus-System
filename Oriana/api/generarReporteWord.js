const { supabase, fetchAllRows } = require('./lib/supabase');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Método no permitido' });
  }

  const args = req.body?.args || [];
  const f1 = args[0] || req.body?.f1;
  const f2 = args[1] || req.body?.f2;
  const tipo = parseInt(args[2]) || parseInt(req.body?.tipo) || 1;

  if (!f1 || !f2) {
    return res.status(400).json({ success: false, message: 'Fechas requeridas' });
  }

  try {
    if (!supabase) throw new Error('Base de datos no inicializada');

    // Cargar usuarios
    const uData = await fetchAllRows(() => supabase.from('usuarios').select('usuario, nombre_apellido, turno'));
    const dictUsu = {};
    (uData || []).forEach(u => {
      const uKey = String(u.usuario).trim().toLowerCase();
      dictUsu[uKey] = {
        nombre: u.nombre_apellido || u.usuario,
        turno: u.turno || 'MAÑANA'
      };
    });

    // Cargar variables y etiquetas
    const varDefs = await fetchAllRows(() => supabase.from('config_variables').select('variable, etiqueta'));
    const labelMap = {};
    (varDefs || []).forEach(v => {
      labelMap[v.variable] = v.etiqueta || v.variable;
    });

    // Cargar configuracion
    const cfgData = await fetchAllRows(() => supabase.from('configuracion').select('*'));
    const configMap = {};
    (cfgData || []).forEach(c => {
      configMap[c.modo] = c.detalle || {};
    });

    // Cargar registros
    const dataReg = await fetchAllRows(() => {
      return supabase
        .from('registros')
        .select('*')
        .gte('fecha_reporte', f1)
        .lte('fecha_reporte', f2);
    });

    const resumenGeneral = {};
    const resumenPorModo = {};
    const resumenPorOp = {};

    const asegurarVars = obj => { if (!obj.vars) obj.vars = {}; return obj.vars; };

    (dataReg || []).forEach(r => {
      const uKey = String(r.usuario_operador || '').trim().toLowerCase();
      const modo = String(r.modo_trabajo || '').trim().toUpperCase();
      const efec = parseInt(r.llamadas_efectivas) || 0;
      const tot = parseInt(r.llamadas_totales) || 0;
      const inc = parseInt(r.incidencias_reportadas) || 0;

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

      const vars = (r.variables && typeof r.variables === 'object') ? r.variables : {};
      Object.keys(vars).forEach(k => {
        const num = parseFloat(vars[k]);
        if (isNaN(num)) return;
        const vG = asegurarVars(resumenGeneral[modo]); vG[k] = (vG[k] || 0) + num;
        const vM = asegurarVars(resumenPorModo[modo][uKey]); vM[k] = (vM[k] || 0) + num;
        const vO = asegurarVars(resumenPorOp[uKey][modo]); vO[k] = (vO[k] || 0) + num;
      });
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
      html += `<p style="text-align:center;">No hay registros para este rango de fechas.</p></body></html>`;
      return res.status(200).json({
        success: true,
        base64: Buffer.from(html, 'utf-8').toString('base64'),
        filename: nombreArchivo
      });
    }

    const armarLinea = (m, d) => {
      const cfg = configMap[m] || {};
      const etiqPrincipal = cfg.etiquetaPrincipal || 'Efectivas / Realizadas';
      const etiqTotales = cfg.etiquetaTotales || 'Totales / Asignadas';

      let txt = `<li style="margin-bottom:10px; font-size:14px;"><b>Modo: ${m}</b>
                 <ul style="padding-left:20px; margin-top:3px;">`;
      txt += `<li>${etiqPrincipal}: <b>${d.efectivas}</b></li>`;
      if (cfg.tieneTotales || d.totales > 0) {
        txt += `<li>${etiqTotales}: ${d.totales}</li>`;
      }
      if (cfg.tieneIncidencias && d.incidencias > 0) {
        txt += `<li>Incidencias Totales: ${d.incidencias}</li>`;
      }
      if (d.vars && Object.keys(d.vars).length > 0) {
        txt += `<li><b>Variables de evaluación:</b><ul style="padding-left:15px; margin-top:2px;">`;
        Object.keys(d.vars).forEach(k => {
          txt += `<li>${labelMap[k] || k}: <b>${d.vars[k]}</b></li>`;
        });
        txt += `</ul></li>`;
      }
      txt += `</ul></li>`;
      return txt;
    };

    if (tipo === 1) {
      let gE = 0, gT = 0;
      html += `<ul style="list-style-type:none; padding-left:10px;">`;
      modosOrdenados.forEach(m => {
        gE += resumenGeneral[m].efectivas;
        gT += resumenGeneral[m].totales;
        html += armarLinea(m, resumenGeneral[m]);
      });
      html += `</ul><br><div style="border-top:2px solid #000; padding-top:10px; margin-top:20px;">
        <p style="font-size:16px; margin:5px 0;"><b>General total efectivas/actividades: ${gE}</b></p>
        <p style="font-size:16px; margin:5px 0;"><b>General total llamadas/datos procesados: ${gT}</b></p>
      </div>`;
    } else if (tipo === 2) {
      modosOrdenados.forEach(m => {
        html += `<h3 style="color:#1e40af; margin-bottom:10px; border-bottom:1px solid #ccc; padding-bottom:3px;">Modo: ${m}</h3>
                 <ul style="list-style-type:none; padding-left:15px; margin-top:0;">`;
        const cfg = configMap[m] || {};
        const etiqPrincipal = cfg.etiquetaPrincipal || 'Efectivas / Realizadas';
        const etiqTotales = cfg.etiquetaTotales || 'Totales / Asignadas';

        Object.keys(resumenPorModo[m]).sort().forEach(uKey => {
          const ud = dictUsu[uKey] || { nombre: uKey.toUpperCase() };
          const d = resumenPorModo[m][uKey];
          html += `<li style="margin-bottom:15px; font-size:14px;"><b>Operador: ${ud.nombre}</b>
                     <ul style="padding-left:20px; margin-top:3px;">
                       <li>${etiqPrincipal}: <b>${d.efectivas}</b></li>`;
          if (cfg.tieneTotales || d.totales > 0) {
            html += `<li>${etiqTotales}: ${d.totales}</li>`;
          }
          if (cfg.tieneIncidencias && d.incidencias > 0) {
            html += `<li>Incidencias: ${d.incidencias}</li>`;
          }
          if (d.vars && Object.keys(d.vars).length > 0) {
            html += `<li><b>Variables:</b><ul style="padding-left:15px;">`;
            Object.keys(d.vars).forEach(k => {
              txt = `<li>${labelMap[k] || k}: <b>${d.vars[k]}</b></li>`;
              html += txt;
            });
            html += `</ul></li>`;
          }
          html += `</ul></li>`;
        });
        html += `</ul><br>`;
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
        html += `</ul></div>`;
      });
    }

    html += `</body></html>`;

    return res.status(200).json({
      success: true,
      base64: Buffer.from(html, 'utf-8').toString('base64'),
      filename: nombreArchivo
    });
  } catch (err) {
    console.error('Error en generarReporteWord:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};
