import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@intranet/auth/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'my_queue';

    // 1. Resumen ejecutivo y progreso de operadores
    if (action === 'summary') {
      const { data: lotes, error: lotesError } = await (supabase
        .from('reclasificacion_lotes')
        .select('*')
        .order('created_at', { ascending: false }) as any);

      if (lotesError) throw lotesError;

      // Obtener estadísticas agrupadas por operador
      const { data: opStats, error: opError } = await (supabase
        .from('reclasificacion_registros')
        .select('asignado_a_usuario, estado_revision') as any);

      const operatorMap: Record<string, { total: number; verificado: number; pendiente: number }> = {};
      let totalGlobal = 0;
      let totalVerificados = 0;
      let totalPendientes = 0;

      if (opStats) {
        opStats.forEach((row: any) => {
          totalGlobal++;
          if (row.estado_revision === 'verificado') totalVerificados++;
          else totalPendientes++;

          const op = row.asignado_a_usuario || 'Sin Asignar';
          if (!operatorMap[op]) {
            operatorMap[op] = { total: 0, verificado: 0, pendiente: 0 };
          }
          operatorMap[op].total++;
          if (row.estado_revision === 'verificado') operatorMap[op].verificado++;
          else operatorMap[op].pendiente++;
        });
      }

      const operatorLeaderboard = Object.entries(operatorMap).map(([operator, stats]) => ({
        operator,
        total: stats.total,
        verificado: stats.verificado,
        pendiente: stats.pendiente,
        pct: stats.total > 0 ? Math.round((stats.verificado / stats.total) * 100) : 0,
      })).sort((a, b) => b.verificado - a.verificado);

      return NextResponse.json({
        success: true,
        lotes: lotes || [],
        totals: {
          total: totalGlobal,
          verificados: totalVerificados,
          pendientes: totalPendientes,
          pctGlobal: totalGlobal > 0 ? Math.round((totalVerificados / totalGlobal) * 100) : 0,
        },
        leaderboard: operatorLeaderboard,
      });
    }

    // 2. Mi cola de trabajo (casos asignados a mí o disponibles)
    if (action === 'my_queue') {
      const userIdentifier = user.email || 'operador';
      const userName = user.user_metadata?.full_name || user.email?.split('@')[0] || '';
      const loteId = searchParams.get('lote_id');

      let query = supabase
        .from('reclasificacion_registros')
        .select('*');

      if (loteId) {
        query = query.eq('lote_id', loteId);
      }

      // Buscar registros asignados al usuario o sin asignar si es admin/desarrollador
      const isBrando = user.email?.toLowerCase().includes('dobran') || user.email?.toLowerCase().includes('brando');
      
      if (!isBrando) {
        query = query.or(`asignado_a_usuario.eq.${userIdentifier},asignado_a_usuario.eq.${userName}`);
      }

      // Ordenar: primero los pendientes
      query = query.order('estado_revision', { ascending: false }).order('id', { ascending: true }).limit(50);

      const { data: records, error: recError } = await (query as any);

      if (recError) throw recError;

      // Si no tiene registros asignados y hay un lote disponible, traer un pool de prueba
      let finalRecords = records || [];
      if (finalRecords.length === 0 && isBrando) {
        const { data: unassigned } = await (supabase
          .from('reclasificacion_registros')
          .select('*')
          .is('asignado_a_usuario', null)
          .order('id', { ascending: true })
          .limit(30) as any);
        finalRecords = unassigned || [];
      }

      return NextResponse.json({
        success: true,
        records: finalRecords,
        count: finalRecords.length,
      });
    }

    // 3. Consulta general paginada con filtros
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '25', 10);
    const offset = (page - 1) * limit;

    let allQuery = supabase
      .from('reclasificacion_registros')
      .select('*', { count: 'exact' });

    const filterLote = searchParams.get('lote_id');
    const filterEstado = searchParams.get('estado');
    const filterRevision = searchParams.get('revision');

    if (filterLote) allQuery = allQuery.eq('lote_id', filterLote);
    if (filterEstado) allQuery = allQuery.eq('estado_geo', filterEstado);
    if (filterRevision) allQuery = allQuery.eq('estado_revision', filterRevision);

    allQuery = allQuery.range(offset, offset + limit - 1).order('id', { ascending: true });

    const { data: listData, count: totalCount, error: listError } = await (allQuery as any);
    if (listError) throw listError;

    return NextResponse.json({
      success: true,
      data: listData || [],
      pagination: {
        page,
        limit,
        total: totalCount || 0,
        pages: totalCount ? Math.ceil(totalCount / limit) : 1,
      },
    });

  } catch (err: any) {
    console.error('Reclasificacion GET error:', err);
    return NextResponse.json({ error: err.message || 'Error interno del servidor' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { action } = body;

    // Repartir automáticamente registros de un lote entre una lista de operadores
    if (action === 'repartir') {
      const { lote_id, operators } = body;
      if (!lote_id || !operators || !Array.isArray(operators) || operators.length === 0) {
        return NextResponse.json({ error: 'lote_id y lista de operators son requeridos' }, { status: 400 });
      }

      const { data, error } = await (supabase.rpc as any)('nexus_repartir_reclasificacion', {
        p_lote_id: lote_id,
        p_operators: operators,
      });

      if (error) {
        console.error('Error invoking nexus_repartir_reclasificacion:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        result: data,
      });
    }

    // Auto-asignarse un bloque de casos pendientes para trabajar
    if (action === 'self_assign') {
      const { lote_id, count = 25 } = body;
      const targetUser = user.email || 'operador';

      // Actualizar primeros N casos sin asignar
      const { data: unassigned, error: findError } = await (supabase
        .from('reclasificacion_registros')
        .select('id')
        .eq('lote_id', lote_id)
        .is('asignado_a_usuario', null)
        .limit(count) as any);

      if (findError) throw findError;
      if (!unassigned || unassigned.length === 0) {
        return NextResponse.json({ success: false, message: 'No hay más casos disponibles en este lote' });
      }

      const ids = unassigned.map((r: any) => r.id);
      const { error: updateError } = await ((supabase
        .from('reclasificacion_registros') as any)
        .update({
          asignado_a_usuario: targetUser,
          asignado_en: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .in('id', ids));

      if (updateError) throw updateError;

      return NextResponse.json({
        success: true,
        assigned_count: ids.length,
        user: targetUser,
      });
    }

    return NextResponse.json({ error: 'Acción no soportada' }, { status: 400 });
  } catch (err: any) {
    console.error('Reclasificacion POST error:', err);
    return NextResponse.json({ error: err.message || 'Error interno del servidor' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { id, nuevo_status, nueva_rama_area, categoria, subcategoria, observaciones, estado_revision = 'verificado' } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID de registro es requerido' }, { status: 400 });
    }

    const userEmail = user.email || 'operador';

    const { data, error } = await ((supabase
      .from('reclasificacion_registros') as any)
      .update({
        nuevo_status,
        nueva_rama_area,
        categoria: categoria !== undefined ? categoria : undefined,
        subcategoria: subcategoria !== undefined ? subcategoria : undefined,
        observaciones,
        estado_revision,
        clasificado_por: userEmail,
        clasificado_en: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select());

    if (error) {
      console.error('Error updating reclasificacion record:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Actualizar contador del lote
    if (data && data.length > 0 && data[0].lote_id) {
      const loteId = data[0].lote_id;
      // Contar verificados del lote
      const { count } = await (supabase
        .from('reclasificacion_registros')
        .select('*', { count: 'exact', head: true })
        .eq('lote_id', loteId)
        .eq('estado_revision', 'verificado') as any);

      if (count !== null) {
        await ((supabase
          .from('reclasificacion_lotes') as any)
          .update({ total_reclasificados: count, updated_at: new Date().toISOString() })
          .eq('id', loteId));
      }
    }

    return NextResponse.json({
      success: true,
      record: data && data.length > 0 ? data[0] : null,
    });
  } catch (err: any) {
    console.error('Reclasificacion PATCH error:', err);
    return NextResponse.json({ error: err.message || 'Error interno del servidor' }, { status: 500 });
  }
}
