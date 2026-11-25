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
      tipo = 'tarea_pendiente',
      prioridad = 'media',
      enlace = '/',
      target_email,
    } = body;

    if (!titulo || !descripcion) {
      return NextResponse.json({ error: 'Título y descripción requeridos' }, { status: 400 });
    }

    const targetUserEmail = target_email || authData.user.email;

    const { data, error } = await (supabase
      .from('nexus_notificaciones') as any)
      .insert({
        user_id: target_email ? null : authData.user.id,
        user_email: targetUserEmail,
        titulo,
        descripcion,
        modulo,
        tipo,
        prioridad,
        enlace,
        estado: 'pendiente',
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      notificacion: data,
    });
  } catch (error: any) {
    console.error('API /api/notificaciones POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
