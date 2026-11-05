const { supabase } = require('../../lib/supabase');
const { construirMensajeTelegram, enviarTelegramDirecto } = require('../../lib/telegram');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Método no permitido' });
  }

  const pkg = req.body || {};
  const regs = pkg.registros || [];
  if (regs.length === 0) {
    return res.status(400).json({ success: false, message: 'No se recibieron registros' });
  }

  try {
    const isAnalista = String(pkg.rol || '').toUpperCase().includes('ANALISTA');

    // 1. Verificación de duplicados para no-analistas
    if (!isAnalista) {
      for (const d of regs) {
        const { data: dups } = await supabase
          .from('registros')
          .select('id')
          .eq('fecha_reporte', d.fechaReporte)
          .ilike('usuario', d.usuario)
          .ilike('campana', d.campana)
          .limit(1);

        if (dups && dups.length > 0) {
          return res.status(200).json({
            success: false,
            message: `⛔ Ya existe reporte de "${d.campana}" para el día ${d.fechaReporte}.`
          });
        }
      }
    }

    // 2. Insertar registros en Supabase
    const toInsert = regs.map(d => ({
      id_operador: d.idOperador || 'S/ID',
      fecha_reporte: d.fechaReporte,
      usuario: String(d.usuario || '').toUpperCase(),
      modo: d.modo,
      campana: d.campana,
      efectivas: parseInt(d.efectivas) || 0,
      totales: parseInt(d.totales) || 0,
      incidencias: parseInt(d.incidencias) || 0,
      estados: d.estados || '',
      municipios_detalle: d.detalle || d.municipios || ''
    }));

    const { error: insertErr } = await supabase.from('registros').insert(toInsert);
    if (insertErr) throw insertErr;

    // 3. Obtener configuración de modos para Telegram
    const { data: configData } = await supabase.from('modos_config').select('*');
    const configMap = {};
    (configData || []).forEach(r => {
      configMap[r.modo] = {
        etiquetaPrincipal: r.etiqueta_principal,
        etiquetaTotales: r.etiqueta_totales,
        tieneTotales: r.tiene_totales,
        tieneIncidencias: r.tiene_incidencias,
        tieneGeografia: r.tiene_geografia,
        tieneDetalle: r.tiene_detalle,
        esMultiActividad: r.es_multi_actividad,
        icono: r.icono
      };
    });

    // 4. Enviar a Telegram o encolar
    const msg = construirMensajeTelegram(regs, pkg.todoElDia, pkg.turnoUsuario || 'MAÑANA', configMap);
    const enviadoOk = await enviarTelegramDirecto(msg);

    if (!enviadoOk) {
      await supabase.from('cola_telegram').insert([{
        estado: 'PENDIENTE',
        intentos: 0,
        payload: { text: msg }
      }]);
    }

    return res.status(200).json({ success: true, message: '✅ Guardado exitosamente.' });
  } catch (err) {
    console.error('Error al guardar reporte:', err);
    return res.status(500).json({ success: false, message: 'Error interno: ' + err.message });
  }
};
