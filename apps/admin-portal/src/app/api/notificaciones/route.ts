import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@intranet/auth/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError || !authData?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const email = authData.user.email || '';
    const userId = authData.user.id;

    // Obtener notificaciones directas y globales
    const { data, error } = await (supabase
      .from('nexus_notificaciones') as any)
      .select('*')
      .or(`user_email.eq.${email},user_id.eq.${userId},user_email.eq.global@impress.com`)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching notifications:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const notificaciones = data || [];
    const pendientes = notificaciones.filter((n: any) => n.estado === 'pendiente');
    const completadas = notificaciones.filter((n: any) => n.estado === 'completada');

    return NextResponse.json({
      success: true,
      total: notificaciones.length,
      pendientesCount: pendientes.length,
      completadasCount: completadas.length,
      notificaciones,
    });
  } catch (error: any) {
    console.error('API /api/notificaciones GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError || !authData?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await req.json();
    const { id, estado = 'completada', notas_resolucion = '' } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID de notificación requerido' }, { status: 400 });
    }

    const nowIso = new Date().toISOString();
    const updatePayload: any = {
      estado,
      updated_at: nowIso,
    };

    if (estado === 'completada') {
      updatePayload.completada_en = nowIso;
      updatePayload.notas_resolucion = notas_resolucion;
    }

    const { data, error } = await (supabase
      .from('nexus_notificaciones') as any)
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      notificacion: data,
      message: 'Actividad reportada como cumplida exitosamente',
    });
  } catch (error: any) {
    console.error('API /api/notificaciones PATCH error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError || !authData?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await req.json();
    const {
      titulo,
      descripcion,
      modulo = 'sistema',
      tipo = 'aviso',
      prioridad = 'media',
      enlace = '/',
      target_type = 'user', // 'global' | 'user' | 'role'
      target_email,
      target_user_id,
      target_role,
      popup = false,
    } = body;

    if (!titulo || !descripcion) {
      return NextResponse.json({ error: 'Título y descripción requeridos' }, { status: 400 });
    }

    const metadata = {
      popup: !!popup,
      broadcast: target_type === 'global',
      target_type,
      author_email: authData.user.email,
      created_by_user_id: authData.user.id,
    };

    // 1. Envío Global a toda la plataforma
    if (target_type === 'global') {
      const { data, error } = await (supabase
        .from('nexus_notificaciones') as any)
        .insert({
          user_id: null,
          user_email: 'global@impress.com',
          titulo,
          descripcion,
          modulo,
          tipo: tipo || 'aviso_global',
          prioridad,
          enlace,
          estado: 'pendiente',
          metadata,
        })
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        broadcast: true,
        notificacion: data,
        message: 'Aviso global emitido a todos los usuarios de la plataforma.',
      });
    }

    // 2. Envío por Rol Específico
    if (target_type === 'role' && target_role) {
      const { data: roleUsers, error: roleError } = await (supabase
        .from('user_roles') as any)
        .select('user_id, roles!inner(name), auth_users:user_id(email)')
        .eq('roles.name', target_role);

      if (roleError) {
        return NextResponse.json({ error: roleError.message }, { status: 500 });
      }

      const notificationsToInsert = (roleUsers || []).map((ru: any) => ({
        user_id: ru.user_id,
        user_email: ru.auth_users?.email || '',
        titulo,
        descripcion,
        modulo,
        tipo,
        prioridad,
        enlace,
        estado: 'pendiente',
        metadata,
      }));

      if (notificationsToInsert.length > 0) {
        await (supabase.from('nexus_notificaciones') as any).insert(notificationsToInsert);
      }

      return NextResponse.json({
        success: true,
        count: notificationsToInsert.length,
        message: `Aviso segmentado enviado a ${notificationsToInsert.length} usuarios con rol ${target_role}.`,
      });
    }

    // 3. Envío Individual a Usuario Específico
    const targetUserEmail = target_email || authData.user.email;
    const targetUserId = target_user_id || (target_email ? null : authData.user.id);

    const { data, error } = await (supabase
      .from('nexus_notificaciones') as any)
      .insert({
        user_id: targetUserId,
        user_email: targetUserEmail,
        titulo,
        descripcion,
        modulo,
        tipo,
        prioridad,
        enlace,
        estado: 'pendiente',
        metadata,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      notificacion: data,
      message: `Aviso enviado directamente a ${targetUserEmail}.`,
    });
  } catch (error: any) {
    console.error('API /api/notificaciones POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
