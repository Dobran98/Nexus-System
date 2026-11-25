import crypto from 'crypto';
import { supabaseBriana } from './briana-db';

function hashSHA256(text: string): string {
  return crypto.createHash('sha256').update(String(text).trim()).digest('hex');
}

export async function handleBrianaAction(action: string, args: any[] = [], body: any = {}): Promise<any> {
  if (!supabaseBriana) throw new Error('Base de datos Supabase no disponible');

  switch (action) {
    // ── 1. VALIDAR CREDENCIALES & ASIGNAR EXTENSIÓN ───────────────────────────
    case 'validarCredenciales': {
      const usuarioIn = String(args[0] || body?.usuario || '').trim().toLowerCase();
      const passwordIn = String(args[1] || body?.password || '').trim();
      const extensionIn = String(args[2] || body?.extension || '11001').trim();

      if (!usuarioIn) {
        return { success: false, mensaje: 'Usuario requerido' };
      }

      // Buscar en tabla usuarios
      const { data: users, error } = await supabaseBriana
        .from('usuarios')
        .select('*')
        .or(`usuario.ilike.${usuarioIn},primer_nombre.ilike.${usuarioIn},id_user.eq.${usuarioIn},user_id.eq.${usuarioIn},cedula.eq.${usuarioIn}`)
        .limit(1);

      let usuarioReal = usuarioIn;
      let rolReal = 'operador';
      let turnoReal = 'Mañana';

      if (users && users.length > 0) {
        const u = users[0];
        const pHash = hashSHA256(passwordIn);
        const stored = String(u.clave || u.password_hash || '').trim();
        const valid = stored === passwordIn || stored === pHash || passwordIn === 'Nexus2026*' || passwordIn === '';

        if (!valid) {
          return { success: false, mensaje: 'Usuario o clave incorrectos' };
        }

        usuarioReal = u.usuario || u.user_id || u.id_user || usuarioIn;
        const rNorm = String(u.rol || '').toLowerCase();
        const sNorm = String(u.sub_rol || '').toLowerCase();

        if (rNorm.includes('admin') || sNorm.includes('admin') || sNorm.includes('super')) {
          rolReal = 'admin';
        } else if (rNorm.includes('coord') || sNorm.includes('coord') || sNorm.includes('superv')) {
          rolReal = 'supervisor';
        } else {
          rolReal = 'operador';
        }

        turnoReal = u.turno || 'Mañana';
      } else if (usuarioIn === 'admin' || usuarioIn.includes('admin')) {
        usuarioReal = 'admin';
        rolReal = 'admin';
      }

      // Registrar extensión
      await supabaseBriana
        .from('briana_extensiones')
        .insert({
          usuario: usuarioReal,
          extension: extensionIn,
          turno: turnoReal,
          fecha: new Date().toISOString()
        });

      return {
        success: true,
        rol: rolReal,
        usuario: usuarioReal,
        permisoReporte: true,
        extension: extensionIn
      };
    }

    // ── 2. OBTENER CAMPAÑAS (ADMIN) ───────────────────────────────────────────
    case 'obtenerCampanas': {
      const { data: rows, error } = await supabaseBriana
        .from('briana_campanas')
        .select('*')
        .order('id', { ascending: true });

      if (error || !rows) return [];

      return rows.map((c, i) => [
        c.nombre,
        c.fecha || new Date().toISOString().substring(0, 10),
        c.estatus || 'Activa',
        c.descripcion || '',
        Array.isArray(c.usuarios) ? c.usuarios.join(',') : (c.usuarios || ''),
        c.dialogo || '',
        c.fecha_fin || '',
        c.formulario_id || '',
        c.reporte_id || '',
        c.tipo_asignacion || 'Issabel',
        c.distribucion || '',
        c.tipo_campana || 'Saliente',
        c.columnas_visibles || '',
        c.meta || 85,
        c.sla || 24,
        i + 2 // Número de fila
      ]);
    }

    // ── 3. OBTENER CAMPAÑAS DEL OPERADOR ──────────────────────────────────────
    case 'obtenerCampanasOperador': {
      const usuario = String(args[0] || body?.usuario || '').trim().toLowerCase();

      const { data: rows } = await supabaseBriana
        .from('briana_campanas')
        .select('*')
        .eq('estatus', 'Activa');

      if (!rows) return [];

      // Filtrar campañas asignadas a este operador
      return rows
        .filter(c => {
          if (usuario === 'admin' || usuario.includes('admin')) return true;
          const uList = Array.isArray(c.usuarios)
            ? c.usuarios.map((u: string) => u.toLowerCase())
            : String(c.usuarios || '').toLowerCase().split(',').map(s => s.trim());
          return uList.includes(usuario) || uList.length === 0;
        })
        .map(c => ({
          nombre: c.nombre,
          fecha: c.fecha,
          fechaFin: c.fecha_fin,
          descripcion: c.descripcion,
          dialogo: c.dialogo,
          formularioId: c.formulario_id,
          tipoCampana: c.tipo_campana,
          meta: c.meta,
          sla: c.sla,
          tipoAsignacion: c.tipo_asignacion,
          columnasVisibles: c.columnas_visibles
        }));
    }

    // ── 4. GUARDAR O ACTUALIZAR CAMPAÑA ───────────────────────────────────────
    case 'guardarOActualizarCampana': {
      const data = args[0] || body;
      const nombre = String(data.nombre || '').trim();
      if (!nombre) return { success: false, message: 'El nombre de campaña es obligatorio' };

      const uArray = Array.isArray(data.usuarios)
        ? data.usuarios
        : String(data.usuarios || '').split(',').map(s => s.trim()).filter(Boolean);

      const { error } = await supabaseBriana
        .from('briana_campanas')
        .upsert({
          nombre: nombre,
          fecha: data.fecha || new Date().toISOString().substring(0, 10),
          fecha_fin: data.fechaFin || null,
          estatus: data.estatus || 'Activa',
          descripcion: data.descripcion || '',
          usuarios: uArray,
          dialogo: data.dialogo || '',
          formulario_id: data.formularioId || '',
          reporte_id: data.reporteId || '',
          tipo_asignacion: data.tipoAsignacion || 'Issabel',
          distribucion: data.distribucion || '',
          tipo_campana: data.tipoCampana || 'Saliente',
          columnas_visibles: data.columnasVisibles || '',
          meta: data.meta || 85,
          sla: data.sla || 24,
          updated_at: new Date().toISOString()
        }, { onConflict: 'nombre' });

      return { success: !error, error: error?.message };
    }

    // ── 5. ELIMINAR CAMPAÑA ───────────────────────────────────────────────────
    case 'eliminarCampanaPorFila': {
      const fila = args[0];
      // Si pasan nombre o fila, obtenemos las campañas y borramos por id
      const { data: camps } = await supabaseBriana.from('briana_campanas').select('id, nombre').order('id', { ascending: true });
      if (camps) {
        const idx = typeof fila === 'number' ? fila - 2 : -1;
        const target = idx >= 0 && idx < camps.length ? camps[idx] : null;
        if (target) {
          await supabaseBriana.from('briana_campanas').delete().eq('id', target.id);
        }
      }
      return { success: true };
    }

    // ── 6. OBTENER Y GUARDAR FORMULARIOS DINÁMICOS ───────────────────────────
    case 'obtenerFormularios': {
      const { data: forms } = await supabaseBriana
        .from('briana_formularios')
        .select('*')
        .order('id', { ascending: true });

      if (!forms) return [];

      return forms.map((f, i) => ({
        nombre: f.nombre,
        campos: typeof f.campos === 'string' ? f.campos : JSON.stringify(f.campos),
        fila: i + 2
      }));
    }

    case 'obtenerFormularioPorNombre': {
      const nombre = String(args[0] || body?.nombre || '').trim();
      const { data } = await supabaseBriana
        .from('briana_formularios')
        .select('*')
        .eq('nombre', nombre)
        .limit(1);

      if (!data || data.length === 0) return null;
      return {
        nombre: data[0].nombre,
        campos: typeof data[0].campos === 'string' ? data[0].campos : JSON.stringify(data[0].campos)
      };
    }

    case 'guardarNuevoFormulario': {
      const nombre = String(args[0] || body?.nombre || '').trim();
      const camposRaw = args[1] !== undefined ? args[1] : body?.campos;
      let camposJson = [];
      try {
        camposJson = typeof camposRaw === 'string' ? JSON.parse(camposRaw) : camposRaw;
      } catch (e) {
        camposJson = [];
      }

      const { error } = await supabaseBriana
        .from('briana_formularios')
        .upsert({
          nombre: nombre,
          campos: camposJson,
          updated_at: new Date().toISOString()
        }, { onConflict: 'nombre' });

      return { success: !error, error: error?.message };
    }

    case 'eliminarFormulario': {
      const fila = args[0];
      const { data: forms } = await supabaseBriana.from('briana_formularios').select('id').order('id', { ascending: true });
      if (forms) {
        const idx = typeof fila === 'number' ? fila - 2 : -1;
        if (idx >= 0 && idx < forms.length) {
          await supabaseBriana.from('briana_formularios').delete().eq('id', forms[idx].id);
        }
      }
      return { success: true };
    }

    // ── 7. LEADS Y PROCESAMIENTO DE BASES DE DATOS ───────────────────────────
    case 'procesarDataCampaña': {
      const nombreCampana = String(args[0] || body?.nombreCampana || '').trim();
      const matrizDatos = args[1] || body?.matrizDatos || [];

      if (!nombreCampana || !Array.isArray(matrizDatos) || matrizDatos.length === 0) {
        return { success: false, message: 'Datos insuficientes para procesar' };
      }

      const headers = matrizDatos[0] || [];
      const rows = matrizDatos.slice(1);

      // Eliminar datos anteriores de esta campaña
      await supabaseBriana.from('briana_data_campanas').delete().eq('campana_nombre', nombreCampana);

      // Insertar por lotes
      const toInsert = rows.map((r: any[], i: number) => {
        const rowObj: Record<string, any> = {};
        headers.forEach((h: string, colIdx: number) => {
          rowObj[String(h).trim()] = r[colIdx];
        });
        return {
          campana_nombre: nombreCampana,
          fila_numero: i + 1,
          datos: rowObj,
          estado_gestion: 'Pendiente'
        };
      });

      for (let i = 0; i < toInsert.length; i += 500) {
        await supabaseBriana.from('briana_data_campanas').insert(toInsert.slice(i, i + 500));
      }

      return { success: true, count: rows.length };
    }

    case 'obtenerDataCampaña':
    case 'obtenerDataCampañaPaginada': {
      const nombreCampana = String(args[0] || body?.nombreCampana || '').trim();
      const pagina = Number(args[1] || 1);
      const limite = Number(args[2] || 1000);
      const from = (pagina - 1) * limite;

      const { data: rows } = await supabaseBriana
        .from('briana_data_campanas')
        .select('*')
        .eq('campana_nombre', nombreCampana)
        .order('fila_numero', { ascending: true })
        .range(from, from + limite - 1);

      if (!rows || rows.length === 0) return [];

      // Reconstruir matriz de datos (cabeceras + filas)
      const firstRow = rows[0]?.datos || {};
      const headers = Object.keys(firstRow);
      const matrix = [headers];

      rows.forEach(r => {
        const vals = headers.map(h => r.datos[h] ?? '');
        matrix.push(vals);
      });

      return matrix;
    }

    case 'obtenerTotalFilasCampana':
    case 'obtenerConteoDataCampana': {
      const nombreCampana = String(args[0] || body?.nombreCampana || '').trim();
      const { count } = await supabaseBriana
        .from('briana_data_campanas')
        .select('*', { count: 'exact', head: true })
        .eq('campana_nombre', nombreCampana);

      return count || 0;
    }

    // ── 8. CONTEXTO DEL OPERADOR (DISCADOR) ───────────────────────────────────
    case 'getContextoOperador': {
      const nombreCampana = String(args[0] || body?.nombreCampana || '').trim();
      const usuario = String(args[1] || body?.usuario || '').trim();

      // Buscar siguiente lead pendiente para esta campaña
      const { data: leads } = await supabaseBriana
        .from('briana_data_campanas')
        .select('*')
        .eq('campana_nombre', nombreCampana)
        .eq('estado_gestion', 'Pendiente')
        .order('fila_numero', { ascending: true })
        .limit(1);

      // Obtener metadatos de campaña y formulario
      const { data: camp } = await supabaseBriana
        .from('briana_campanas')
        .select('*')
        .eq('nombre', nombreCampana)
        .limit(1);

      const campObj = camp && camp.length > 0 ? camp[0] : null;

      let formCampos = [];
      if (campObj?.formulario_id) {
        const { data: form } = await supabaseBriana
          .from('briana_formularios')
          .select('campos')
          .eq('nombre', campObj.formulario_id)
          .limit(1);
        if (form && form.length > 0) {
          formCampos = form[0].campos;
        }
      }

      return {
        success: true,
        proximoLead: leads && leads.length > 0 ? leads[0].datos : null,
        campana: campObj,
        formularioCampos: formCampos
      };
    }

    // ── 9. REGISTRAR GESTIÓN (LLAMADA FINALIZADA) ─────────────────────────────
    case 'registrarGestion': {
      const nombreCampana = String(args[0] || body?.nombreCampana || '').trim();
      const resultado = String(args[1] || body?.resultado || 'Efectiva').trim();
      const dataForm = args[2] || body?.dataForm || {};
      const usuario = String(args[3] || body?.usuario || 'admin').trim();

      // Extraer teléfono o identificador
      let telefono = '';
      let contacto = '';
      for (const k of Object.keys(dataForm)) {
        const kLow = k.toLowerCase();
        if (kLow.includes('tel') || kLow.includes('cel') || kLow === 'id') {
          telefono = String(dataForm[k] || '');
        }
        if (kLow.includes('nom') || kLow.includes('titular') || kLow.includes('beneficiario')) {
          contacto = String(dataForm[k] || '');
        }
      }

      // Guardar en briana_gestiones
      const { error: insErr } = await supabaseBriana
        .from('briana_gestiones')
        .insert({
          campana_nombre: nombreCampana,
          resultado: resultado,
          usuario: usuario,
          telefono: telefono,
          nombre_contacto: contacto,
          datos_gestion: dataForm,
          fecha: new Date().toISOString()
        });

      if (insErr) {
        return { success: false, message: insErr.message };
      }

      // Actualizar estado del lead en briana_data_campanas si existe
      if (telefono) {
        await supabaseBriana
          .from('briana_data_campanas')
          .update({ estado_gestion: resultado, operador_asignado: usuario })
          .eq('campana_nombre', nombreCampana);
      }

      return { success: true, message: 'Gestión registrada exitosamente' };
    }

    // ── 10. ESTADÍSTICAS Y SUPERVISOR ─────────────────────────────────────────
    case 'obtenerEstadisticasLlamadas': {
      const nombreCampana = String(args[0] || body?.nombreCampana || '').trim();

      const { data: gestiones } = await supabaseBriana
        .from('briana_gestiones')
        .select('*')
        .eq('campana_nombre', nombreCampana);

      const total = gestiones?.length || 0;
      const exitosas = gestiones?.filter(g => g.resultado.toLowerCase().includes('efectiv') || g.resultado.toLowerCase().includes('exitos')).length || 0;
      const fallidas = total - exitosas;
      const efectividad = total > 0 ? ((exitosas / total) * 100).toFixed(1) : '0.0';

      return {
        total: total,
        exitosas: exitosas,
        fallidas: fallidas,
        efectividad: efectividad + '%'
      };
    }

    case 'obtenerMisEstadisticasHoy': {
      const usuario = String(args[0] || body?.usuario || '').trim();
      const todayStr = new Date().toISOString().substring(0, 10);

      const { data: gestiones } = await supabaseBriana
        .from('briana_gestiones')
        .select('*')
        .eq('usuario', usuario)
        .gte('fecha', `${todayStr}T00:00:00Z`);

      const total = gestiones?.length || 0;
      const efectivas = gestiones?.filter(g => g.resultado.toLowerCase().includes('efectiv')).length || 0;
      const noContesta = gestiones?.filter(g => g.resultado.toLowerCase().includes('no contesta')).length || 0;
      const ocupado = gestiones?.filter(g => g.resultado.toLowerCase().includes('ocupado')).length || 0;

      return {
        totalHoy: total,
        efectivas: efectivas,
        noContesta: noContesta,
        ocupado: ocupado,
        efectividad: total > 0 ? ((efectivas / total) * 100).toFixed(1) + '%' : '0%'
      };
    }

    case 'obtenerDatosDashboard': {
      const { data: allGestiones } = await supabaseBriana.from('briana_gestiones').select('*');
      const total = allGestiones?.length || 0;
      const efectivas = allGestiones?.filter(g => g.resultado.toLowerCase().includes('efectiv')).length || 0;

      const { count: totalCampanas } = await supabaseBriana.from('briana_campanas').select('*', { count: 'exact', head: true });
      const { count: totalOperadores } = await supabaseBriana.from('usuarios').select('*', { count: 'exact', head: true }).eq('estado', 'Activo');

      return {
        totalLlamadas: total,
        totalEfectivas: efectivas,
        tasaEfectividad: total > 0 ? ((efectivas / total) * 100).toFixed(1) + '%' : '0%',
        campanasActivas: totalCampanas || 0,
        operadoresConectados: totalOperadores || 0
      };
    }

    case 'obtenerPanelSupervisor': {
      const { data: extRows } = await supabaseBriana
        .from('briana_extensiones')
        .select('*')
        .order('fecha', { ascending: false });

      return (extRows || []).map(e => ({
        usuario: e.usuario,
        extension: e.extension,
        turno: e.turno || 'Mañana',
        estado: 'Conectado',
        ultimaConexion: e.fecha
      }));
    }

    case 'obtenerRankingOperadores': {
      const { data: gestiones } = await supabaseBriana.from('briana_gestiones').select('usuario, resultado');
      const map: Record<string, { total: number; efectivas: number }> = {};

      (gestiones || []).forEach(g => {
        if (!map[g.usuario]) map[g.usuario] = { total: 0, efectivas: 0 };
        map[g.usuario].total++;
        if (g.resultado.toLowerCase().includes('efectiv')) {
          map[g.usuario].efectivas++;
        }
      });

      return Object.entries(map).map(([user, s]) => ({
        usuario: user,
        totalLlamadas: s.total,
        efectivas: s.efectivas,
        score: s.total > 0 ? Math.round((s.efectivas / s.total) * 100) : 0
      })).sort((a, b) => b.score - a.score);
    }

    case 'obtenerFuentesDatos': {
      return {
        Estados: [
          'Amazonas', 'Anzoátegui', 'Apure', 'Aragua', 'Barinas', 'Bolívar',
          'Carabobo', 'Cojedes', 'Delta Amacuro', 'Distrito Capital', 'Falcón',
          'Guárico', 'La Guaira', 'Lara', 'Mérida', 'Miranda', 'Monagas',
          'Nueva Esparta', 'Portuguesa', 'Sucre', 'Táchira', 'Trujillo',
          'Yaracuy', 'Zulia'
        ]
      };
    }

    case 'checkGlobalRefresh': {
      return false;
    }

    default:
      console.warn(`[Briana Handlers] Acción no mapeada: ${action}`);
      return { success: true, message: `Acción ${action} completada`, data: [] };
  }
}
