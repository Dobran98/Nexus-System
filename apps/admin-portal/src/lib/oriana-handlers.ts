import crypto from 'crypto';
import { supabaseOriana, fetchAllRows } from './oriana-db';
import {
  enviarTelegramDirecto,
  encolarMensajeTelegram,
  construirMensajeTelegram,
  escapeHtml
} from './oriana-telegram';

function hashSHA256(texto: string): string {
  return crypto.createHash('sha256').update(String(texto).trim()).digest('hex');
}

function formatDateDDMMYYYY(dateStr: string): string {
  if (!dateStr) return '';
  const parts = String(dateStr).substring(0, 10).split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

export async function handleOrianaAction(action: string, args: any[] = [], body: any = {}): Promise<any> {
  if (!supabaseOriana) throw new Error('Base de datos Supabase no disponible');

  switch (action) {
    // ── 1. VALIDAR USUARIO ───────────────────────────────────────────────────
    case 'validarUsuario': {
      const u = args[0] !== undefined ? args[0] : (body?.u || body?.usuario);
      const c = args[1] !== undefined ? args[1] : (body?.c || body?.clave);

      if (!u || !c) {
        return { success: false, message: 'Usuario y contraseña requeridos' };
      }

      const uIn = String(u).trim();
      const cIn = String(c).trim();
      const cInHash = hashSHA256(cIn);

      const { data, error } = await supabaseOriana
        .from('usuarios')
        .select('*')
        .ilike('usuario', uIn)
        .limit(1);

      if (error) throw error;
      if (!data || data.length === 0) {
        return { success: false, message: 'Credenciales incorrectas.' };
      }

      const row = data[0];
      const claveAlmacenada = String(row.clave || '').trim();
      const coincide = (claveAlmacenada === cInHash) || (claveAlmacenada === cIn);

      if (!coincide) {
        return { success: false, message: 'Credenciales incorrectas.' };
      }

      const finalTurno = (row.turno && String(row.turno).trim() !== '')
        ? String(row.turno).trim().toUpperCase()
        : 'MAÑANA';

      return {
        success: true,
        nombre: row.nombre_apellido || row.usuario,
        rol: String(row.rol || 'Operador').trim(),
        turno: finalTurno,
        idFisico: String(row.id_user || '').trim()
      };
    }

    // ── 2. OBTENER ÁREAS ─────────────────────────────────────────────────────
    case 'obtenerAreas': {
      const { data, error } = await supabaseOriana
        .from('areas_trabajo')
        .select('id_area, nombre_area')
        .order('id_area', { ascending: true });

      if (error) throw error;
      return (data || []).map((r: any) => ({
        id: r.id_area,
        nombre: r.nombre_area
      }));
    }

    // ── 3. OBTENER REGLAS DE ACCESO ──────────────────────────────────────────
    case 'obtenerReglasAcceso': {
      const { data, error } = await supabaseOriana
        .from('reglas_acceso')
        .select('perfil, modos_permitidos');

      if (error) throw error;

      const rules: Record<string, string[]> = {
        ADMIN: ['*'],
        ANALISTA: [],
        OPERADOR: []
      };

      (data || []).forEach((r: any) => {
        const perfil = String(r.perfil || '').toUpperCase().trim();
        const modosStr = String(r.modos_permitidos || '').trim();
        if (perfil) {
          rules[perfil] = (modosStr === '*') ? ['*'] : modosStr.split(',').map((m: string) => m.trim()).filter(Boolean);
        }
      });

      return {
        rules,
        superRules: {
          analistasTodos: true,
          todosModos: false
        }
      };
    }

    // ── 4. OBTENER CONFIGURACIÓN VINCULADA ────────────────────────────────────
    case 'obtenerConfiguracionVinculada': {
      const { data, error } = await supabaseOriana
        .from('configuracion')
        .select('*');

      if (error) throw error;

      const config: Record<string, any> = {};
      (data || []).forEach((r: any) => {
        const modo = String(r.modo || '').trim();
        if (modo) {
          const campStr = r.campanas ? String(r.campanas).trim() : '';
          const campArray = campStr ? campStr.split(',').map((c: string) => c.trim()).filter(Boolean) : [];
          config[modo] = campArray;
        }
      });

      return config;
    }

    // ── 5. OBTENER TODAS LAS VARIABLES ───────────────────────────────────────
    case 'obtenerTodasVariables': {
      const data = await fetchAllRows(() =>
        supabaseOriana.from('config_variables').select('*').order('id', { ascending: true })
      );

      const result: Record<string, any[]> = {};
      (data || []).forEach((r: any) => {
        const modo = String(r.modo || '').trim();
        const variable = String(r.variable || '').trim();
        if (!modo || !variable) return;

        if (!result[modo]) result[modo] = [];
        result[modo].push({
          variable,
          etiqueta: String(r.etiqueta || variable).trim() || variable,
          tipo: String(r.tipo || 'NUMERO').trim().toUpperCase(),
          obligatorio: !!r.obligatorio,
          padre: String(r.depende_de || '').trim()
        });
      });

      return result;
    }

    // ── 6. OBTENER EMOJIS ────────────────────────────────────────────────────
    case 'obtenerEmojis': {
      const data = await fetchAllRows(() => supabaseOriana.from('config_emojis').select('*'));
      const result = { modos: {} as Record<string, string>, campanas: {} as Record<string, string>, variables: {} as Record<string, string> };

      (data || []).forEach((r: any) => {
        const tipo = String(r.tipo || '').trim().toUpperCase();
        const nombre = String(r.nombre || '').trim();
        const emoji = String(r.emoji || '').trim();
        if (!nombre || !emoji) return;

        if (tipo === 'MODO') result.modos[nombre] = emoji;
        else if (tipo === 'CAMPAÑA' || tipo === 'CAMPANA') result.campanas[nombre] = emoji;
        else if (tipo === 'VARIABLE') result.variables[nombre] = emoji;
      });

      return result;
    }

    // ── 7. OBTENER INDICADORES ───────────────────────────────────────────────
    case 'obtenerIndicadores': {
      const data = await fetchAllRows(() => supabaseOriana.from('config_indicadores').select('*'));
      return (data || []).map((r: any) => ({
        indicador: String(r.indicador || '').trim(),
        modo: String(r.modo || '').trim()
      })).filter((r: any) => r.indicador && r.modo);
    }

    // ── 8. OBTENER DESTINATARIOS ─────────────────────────────────────────────
    case 'obtenerDestinatarios': {
      const data = await fetchAllRows(() => supabaseOriana.from('config_destinatarios').select('*'));
      return (data || []).map((r: any) => ({
        chatId: String(r.chat_id || '').trim(),
        frecuencia: String(r.frecuencia || 'DIARIO').trim().toUpperCase(),
        activo: r.activo !== false
      })).filter((r: any) => r.chatId);
    }

    // ── 9. OBTENER LISTA USUARIOS ────────────────────────────────────────────
    case 'obtenerListaUsuarios': {
      const { data, error } = await supabaseOriana
        .from('usuarios')
        .select('usuario, nombre_apellido')
        .order('nombre_apellido', { ascending: true });

      if (error) throw error;
      return (data || []).map((r: any) => ({
        usuario: r.usuario,
        nombre: r.nombre_apellido || r.usuario
      }));
    }

    // ── 10. GUARDAR REGISTRO ─────────────────────────────────────────────────
    case 'guardarRegistro': {
      const pkg = args[0] || body?.pkg;
      if (!pkg || !Array.isArray(pkg.registros) || pkg.registros.length === 0) {
        return { success: false, message: 'Paquete de registros inválido o vacío.' };
      }

      const regs = pkg.registros;
      const isAnalista = String(pkg.rol || '').toUpperCase().includes('ANALISTA');

      // Verificación de duplicados para operadores
      if (!isAnalista) {
        for (const d of regs) {
          const uOp = String(d.usuario || '').trim();
          const fRep = String(d.fechaReporte || '').trim();
          const cCamp = String(d.campana || '').trim();

          const { data: dups } = await supabaseOriana
            .from('registros')
            .select('id')
            .ilike('usuario_operador', uOp)
            .eq('fecha_reporte', fRep)
            .ilike('campana', cCamp)
            .limit(1);

          if (dups && dups.length > 0) {
            return {
              success: false,
              message: `⛔ Ya existe reporte de "${cCamp}" para el día ${fRep}.`
            };
          }
        }
      }

      // Preparar filas
      const nowIso = new Date().toISOString();
      const rowsToInsert = regs.map((d: any) => {
        let ef = d.efectivas;
        let kVal = d.municipios;
        const mUp = String(d.modo || '').toUpperCase();
        const esCustom = (d.variables && typeof d.variables === 'object' && Object.keys(d.variables).length > 0);

        if (mUp.includes('ESPECIAL') || mUp.includes('ESEQUIBO') ||
            mUp.includes('ANALISTA') || mUp.includes('CUALITATIV') || esCustom) {
          ef = d.efectivas;
          kVal = d.detalle;
        }

        const efVal = (ef !== undefined && ef !== '') ? parseInt(ef) || 0 : 0;

        return {
          id_operador: String(d.idOperador || 'S/ID'),
          fecha_registro: nowIso,
          fecha_reporte: String(d.fechaReporte || ''),
          usuario_operador: String(d.usuario || '').toUpperCase().trim(),
          modo_trabajo: String(d.modo || '').trim(),
          campana: String(d.campana || '').trim(),
          llamadas_efectivas: efVal,
          llamadas_totales: parseInt(d.totales) || 0,
          incidencias_reportadas: parseInt(d.incidencias) || 0,
          estados_abarcados: String(d.estados || ''),
          municipios_detalles: kVal ? String(kVal) : '',
          variables: (d.variables && typeof d.variables === 'object') ? d.variables : {}
        };
      });

      const { error: insertErr } = await supabaseOriana.from('registros').insert(rowsToInsert);
      if (insertErr) throw insertErr;

      // Notificar a Telegram
      try {
        const uFirst = regs[0].usuario;
        const { data: uData } = await supabaseOriana
          .from('usuarios')
          .select('*')
          .ilike('usuario', String(uFirst).trim())
          .limit(1);

        const userInfo = uData && uData.length > 0 ? {
          nombre: uData[0].nombre_apellido || uData[0].usuario,
          rol: uData[0].rol,
          turno: uData[0].turno
        } : {
          nombre: uFirst,
          rol: pkg.rol || 'Operador',
          turno: pkg.turnoUsuario || 'MAÑANA'
        };

        const [emojis, varDefsRaw, indicadoresRaw] = await Promise.all([
          handleOrianaAction('obtenerEmojis'),
          handleOrianaAction('obtenerTodasVariables'),
          handleOrianaAction('obtenerIndicadores')
        ]);

        const telegramMsg = construirMensajeTelegram(
          regs,
          !!pkg.todoElDia,
          pkg.turnoUsuario || 'MAÑANA',
          userInfo,
          {},
          emojis,
          varDefsRaw,
          indicadoresRaw
        );

        const telegramOk = await enviarTelegramDirecto(telegramMsg);
        if (!telegramOk) {
          await encolarMensajeTelegram({
            mensaje: telegramMsg,
            registros: rowsToInsert
          });
        }
      } catch (tgErr) {
        console.warn('Advertencia en notificación Telegram:', tgErr);
      }

      return {
        success: true,
        message: '✅ Reporte guardado y procesado exitosamente.'
      };
    }

    // ── 11. OBTENER DATOS DASHBOARD ──────────────────────────────────────────
    case 'obtenerDatosDashboard': {
      const f1 = args[0] || body?.f1;
      const f2 = args[1] || body?.f2;
      const usuario = args[2] || body?.usuario || 'TODOS';

      if (!f1 || !f2) {
        return { success: false, message: 'Rango de fechas requerido' };
      }

      const varDefs = await fetchAllRows(() => supabaseOriana.from('config_variables').select('variable, etiqueta'));
      const labelMap: Record<string, string> = {};
      (varDefs || []).forEach((v: any) => {
        labelMap[v.variable] = v.etiqueta || v.variable;
      });

      const data = await fetchAllRows(() => {
        let q = supabaseOriana
          .from('registros')
          .select('modo_trabajo, usuario_operador, llamadas_efectivas, llamadas_totales, variables, fecha_reporte')
          .gte('fecha_reporte', f1)
          .lte('fecha_reporte', f2);

        if (usuario !== 'TODOS' && usuario) {
          q = q.ilike('usuario_operador', usuario.trim());
        }
        return q;
      });

      const map: Record<string, { efectivas: number; totales: number }> = {};
      const mapVars: Record<string, number> = {};
      let totalEfec = 0;
      let totalTot = 0;

      (data || []).forEach((r: any) => {
        const modo = String(r.modo_trabajo || '').trim().toUpperCase();
        const efec = parseInt(r.llamadas_efectivas) || 0;
        const tot = parseInt(r.llamadas_totales) || 0;

        if (!map[modo]) map[modo] = { efectivas: 0, totales: 0 };
        map[modo].efectivas += efec;
        map[modo].totales += tot;
        totalEfec += efec;
        totalTot += tot;

        const vars = (r.variables && typeof r.variables === 'object') ? r.variables : {};
        Object.keys(vars).forEach(k => {
          const num = parseFloat(vars[k]);
          if (!isNaN(num)) {
            mapVars[k] = (mapVars[k] || 0) + num;
          }
        });
      });

      const arr = Object.keys(map)
        .map(k => ({ modo: k, efectivas: map[k].efectivas, totales: map[k].totales }))
        .sort((a, b) => b.efectivas - a.efectivas);

      const variablesTotales = Object.keys(mapVars)
        .map(k => ({ variable: k, etiqueta: labelMap[k] || k, total: mapVars[k] }))
        .sort((a, b) => b.total - a.total);

      return { datos: arr, totalEfec, totalTot, variablesTotales };
    }

    // ── 12. OBTENER REGISTROS ADMIN ──────────────────────────────────────────
    case 'obtenerRegistrosAdmin': {
      const p = parseInt(args[0]) || 1;
      const c = parseInt(args[1]) || 20;
      const t1 = args[2] ? String(args[2]).toLowerCase().trim() : '';
      const t2 = args[3] ? String(args[3]).toLowerCase().trim() : '';
      const fd = args[4] ? String(args[4]).trim() : '';
      const arrModos = Array.isArray(args[5]) ? args[5].map((m: any) => String(m).toUpperCase().trim()) : [];
      const arrOps = Array.isArray(args[6]) ? args[6].map((o: any) => String(o).toUpperCase().trim()) : [];
      const tipoTabla = args[7] || '';
      const arrTurnos = Array.isArray(args[8]) ? args[8].map((t: any) => String(t).toUpperCase().trim()) : [];

      const uData = await fetchAllRows(() => supabaseOriana.from('usuarios').select('usuario, turno'));
      const dictTurnos: Record<string, string> = {};
      (uData || []).forEach((u: any) => {
        dictTurnos[String(u.usuario).toLowerCase().trim()] = String(u.turno || 'MAÑANA').toUpperCase().trim();
      });

      const data = await fetchAllRows(() => {
        let query = supabaseOriana.from('registros').select('*');
        if (fd) query = query.eq('fecha_reporte', fd);
        if (arrModos.length > 0) query = query.in('modo_trabajo', arrModos);
        if (arrOps.length > 0) query = query.in('usuario_operador', arrOps);
        return query.order('id', { ascending: false });
      });

      const filtered = (data || []).filter((r: any) => {
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

      const datos = slice.map((r: any) => {
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
          totales: r.llamadas_totales,
          incidencias: r.incidencias_reportadas,
          estados: r.estados_abarcados,
          municipios: r.municipios_detalles,
          adminEf: r.admin_efectivas,
          adminInc: r.admin_incidencias,
          variables: r.variables
        };
      });

      return {
        datos,
        total,
        pags,
        p: curP
      };
    }

    // ── 13. GUARDAR VALIDACIÓN ADMIN ─────────────────────────────────────────
    case 'guardarValidacionAdmin': {
      const rowId = args[0] || body?.rowId;
      const ef = args[1] !== undefined ? args[1] : body?.ef;
      const inc = args[2] !== undefined ? args[2] : body?.inc;
      const user = args[3] || body?.user || 'Admin';
      const rol = args[4] || body?.rol || '';

      if (!rowId) return { success: false, message: 'Fila inválida' };

      const efVal = (ef !== '' && ef !== null && ef !== undefined) ? Number(ef) : null;
      const incVal = (inc !== '' && inc !== null && inc !== undefined) ? Number(inc) : null;

      const { error: updErr } = await supabaseOriana
        .from('registros')
        .update({
          admin_efectivas: efVal,
          admin_incidencias: incVal
        })
        .eq('id', rowId);

      if (updErr) throw updErr;

      await supabaseOriana.from('logs_auditoria').insert({
        usuario: user,
        accion: 'VALIDACIÓN INDIVIDUAL',
        detalle: `Fila ID ${rowId}: Efec=${ef}, Inc=${inc}`,
        rol: rol || ''
      });

      return { success: true };
    }

    // ── 14. GUARDAR VALIDACIÓN MASIVA ────────────────────────────────────────
    case 'guardarValidacionMasiva': {
      const lista = args[0] || body?.lista || [];
      const user = args[1] || body?.user || 'Admin';
      const rol = args[2] || body?.rol || '';

      let actualizados = 0;
      for (const item of lista) {
        if (item.rowId) {
          const efVal = (item.efectivas !== '' && item.efectivas !== null && item.efectivas !== undefined) ? Number(item.efectivas) : null;
          const incVal = (item.incidencias !== '' && item.incidencias !== null && item.incidencias !== undefined) ? Number(item.incidencias) : null;

          const { error } = await supabaseOriana
            .from('registros')
            .update({
              admin_efectivas: efVal,
              admin_incidencias: incVal
            })
            .eq('id', item.rowId);

          if (!error) actualizados++;
        }
      }

      await supabaseOriana.from('logs_auditoria').insert({
        usuario: user,
        accion: 'VALIDACIÓN MASIVA',
        detalle: `${actualizados} filas actualizadas`,
        rol: rol || ''
      });

      return { success: true, actualizados };
    }

    // ── 15. GUARDAR NUEVA CONFIGURACIÓN ──────────────────────────────────────
    case 'guardarNuevaConfiguracion': {
      const modo = args[0] || body?.modo;
      const payload = args[1] !== undefined ? args[1] : body?.payload;

      if (!modo) return { success: false, message: 'Modo requerido' };

      let campanasStr = '';
      if (typeof payload === 'string') {
        campanasStr = payload;
      } else if (payload && typeof payload === 'object') {
        const camps = Array.isArray(payload.campanas) ? payload.campanas : [];
        campanasStr = camps.join(', ');
      }

      const { error } = await supabaseOriana.from('configuracion').upsert({
        modo: String(modo).trim(),
        campanas: campanasStr,
        updated_at: new Date().toISOString()
      }, { onConflict: 'modo' });

      if (error) throw error;
      return { success: true, message: 'Configuración guardada exitosamente.' };
    }

    // ── 16. GUARDAR VARIABLES MODO ───────────────────────────────────────────
    case 'guardarVariablesModo': {
      const modo = args[0] || body?.modo;
      const lista = args[1] || body?.lista || [];

      if (!modo) return { success: false, message: 'Modo requerido' };
      const mBusca = String(modo).trim();

      await supabaseOriana.from('config_variables').delete().eq('modo', mBusca);

      if (Array.isArray(lista) && lista.length > 0) {
        const rows = lista.map((v: any) => {
          const variable = String(v.variable || '').trim();
          return {
            modo: mBusca,
            variable,
            etiqueta: String(v.etiqueta || '').trim() || variable,
            tipo: String(v.tipo || '').toUpperCase() === 'TEXTO' ? 'TEXTO' : 'NUMERO',
            obligatorio: v.obligatorio === true || String(v.obligatorio).toUpperCase() === 'SI',
            depende_de: String(v.padre || '').trim()
          };
        }).filter((r: any) => r.variable);

        if (rows.length > 0) {
          const { error: insErr } = await supabaseOriana.from('config_variables').insert(rows);
          if (insErr) throw insErr;
        }
      }

      return { success: true, message: 'Variables de evaluación guardadas correctamente.' };
    }

    // ── 17. GUARDAR ÁREAS ────────────────────────────────────────────────────
    case 'guardarAreas': {
      const lista = args[0] || body?.areas || [];
      await supabaseOriana.from('areas_trabajo').delete().neq('id_area', 'dummy_never_match');

      if (Array.isArray(lista) && lista.length > 0) {
        const rows = lista.map((a: any, idx: number) => ({
          id_area: String(a.id || idx + 1),
          nombre_area: String(a.nombre || '').trim()
        })).filter((r: any) => r.nombre_area);

        if (rows.length > 0) {
          const { error } = await supabaseOriana.from('areas_trabajo').insert(rows);
          if (error) throw error;
        }
      }

      return { success: true, message: 'Áreas guardadas correctamente.' };
    }

    // ── 18. GUARDAR REGLAS DE ACCESO ─────────────────────────────────────────
    case 'guardarReglasAcceso': {
      const rulesData = args[0] || body?.rules || {};
      const rows = Object.keys(rulesData).map(perfil => {
        const list = rulesData[perfil];
        const val = (Array.isArray(list) && list.length === 1 && list[0] === '*') ? '*' : (Array.isArray(list) ? list.join(',') : String(list));
        return {
          perfil: perfil.toUpperCase().trim(),
          modos_permitidos: val
        };
      });

      for (const row of rows) {
        await supabaseOriana.from('reglas_acceso').upsert(row, { onConflict: 'perfil' });
      }

      return { success: true, message: 'Reglas de acceso guardadas correctamente.' };
    }

    // ── 19. GUARDAR EMOJIS ───────────────────────────────────────────────────
    case 'guardarEmojis': {
      const lista = args[0] || body?.lista || [];
      await supabaseOriana.from('config_emojis').delete().neq('id', 0);

      if (Array.isArray(lista) && lista.length > 0) {
        const rows = lista.map((e: any) => ({
          tipo: String(e.tipo || '').trim().toUpperCase(),
          nombre: String(e.nombre || '').trim(),
          emoji: String(e.emoji || '').trim()
        })).filter((r: any) => r.nombre && r.emoji);

        if (rows.length > 0) {
          const { error } = await supabaseOriana.from('config_emojis').insert(rows);
          if (error) throw error;
        }
      }

      return { success: true, message: 'Repositorio de emojis guardado correctamente.' };
    }

    // ── 20. GUARDAR INDICADORES ──────────────────────────────────────────────
    case 'guardarIndicadores': {
      const lista = args[0] || body?.lista || [];
      await supabaseOriana.from('config_indicadores').delete().neq('id', 0);

      if (Array.isArray(lista) && lista.length > 0) {
        const rows = lista.map((i: any) => ({
          indicador: String(i.indicador || '').trim(),
          modo: String(i.modo || '').trim().toUpperCase()
        })).filter((r: any) => r.indicador && r.modo);

        if (rows.length > 0) {
          const { error } = await supabaseOriana.from('config_indicadores').insert(rows);
          if (error) throw error;
        }
      }

      return { success: true, message: 'Indicadores macro guardados correctamente.' };
    }

    // ── 21. GUARDAR DESTINATARIOS ────────────────────────────────────────────
    case 'guardarDestinatarios': {
      const lista = args[0] || body?.lista || [];
      await supabaseOriana.from('config_destinatarios').delete().neq('id', 0);

      if (Array.isArray(lista) && lista.length > 0) {
        const rows = lista.map((d: any) => ({
          chat_id: String(d.chatId || '').trim(),
          frecuencia: String(d.frecuencia || 'DIARIO').trim().toUpperCase() === 'SEMANAL' ? 'SEMANAL' : 'DIARIO',
          activo: d.activo !== false
        })).filter((r: any) => r.chat_id);

        if (rows.length > 0) {
          const { error } = await supabaseOriana.from('config_destinatarios').insert(rows);
          if (error) throw error;
        }
      }

      return { success: true, message: 'Destinatarios guardados correctamente.' };
    }

    // ── 22. GENERAR REPORTE XLSX (CSV / BASE64) ──────────────────────────────
    case 'generarReporteXLSX': {
      const f1 = args[0] || body?.f1;
      const f2 = args[1] || body?.f2;
      const fm = args[2] || body?.fm || 'TODOS';

      const data = await fetchAllRows(() => {
        let q = supabaseOriana.from('registros').select('*');
        if (f1) q = q.gte('fecha_reporte', f1);
        if (f2) q = q.lte('fecha_reporte', f2);
        if (fm !== 'TODOS' && fm) q = q.eq('modo_trabajo', fm);
        return q.order('fecha_reporte', { ascending: true });
      });

      // Crear CSV en base64
      const headers = ['ID', 'Fecha Reporte', 'Usuario', 'Modo', 'Campaña', 'Llamadas Efectivas', 'Llamadas Totales', 'Incidencias', 'Estados', 'Municipios', 'Val. Efec Admin', 'Val. Inc Admin'];
      const rows = [headers.join(',')];

      data.forEach((r: any) => {
        const row = [
          r.id,
          `"${r.fecha_reporte || ''}"`,
          `"${(r.usuario_operador || '').replace(/"/g, '""')}"`,
          `"${(r.modo_trabajo || '').replace(/"/g, '""')}"`,
          `"${(r.campana || '').replace(/"/g, '""')}"`,
          r.llamadas_efectivas || 0,
          r.llamadas_totales || 0,
          r.incidencias_reportadas || 0,
          `"${(r.estados_abarcados || '').replace(/"/g, '""')}"`,
          `"${(r.municipios_detalles || '').replace(/"/g, '""')}"`,
          r.admin_efectivas ?? '',
          r.admin_incidencias ?? ''
        ];
        rows.push(row.join(','));
      });

      const csvContent = '\uFEFF' + rows.join('\r\n');
      const base64 = Buffer.from(csvContent, 'utf-8').toString('base64');
      const filename = `Reporte_Oriana_${f1 || 'inicio'}_${f2 || 'fin'}.csv`;

      return { success: true, base64, filename };
    }

    default:
      return { success: false, message: `Acción '${action}' no reconocida en Oriana API.` };
  }
}
