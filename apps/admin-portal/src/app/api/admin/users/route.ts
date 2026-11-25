import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@intranet/auth/server';

export const dynamic = 'force-dynamic';

// Helper para verificar si el usuario tiene privilegios de gestión
async function verifyAdminAuthorization(supabase: any, user: any) {
  const email = user.email || '';

  // 1. Roles en user_roles
  const { data: rolesData } = await (supabase
    .from('user_roles') as any)
    .select('roles!inner(name)')
    .eq('user_id', user.id);

  const roleNames: string[] = (rolesData ?? []).map((r: any) => r.roles?.name as string).filter(Boolean);
  const isSuperAdmin = roleNames.includes('superadmin') || email.toLowerCase().includes('brando');
  const isModuleAdmin = roleNames.includes('module_admin');

  // 2. Traer sub-rol de usuarios legacy para distinguir coordinadores
  const { data: legacyMatches } = await (supabase
    .from('usuarios') as any)
    .select('sub_rol, rol')
    .or(`email.eq.${email},usuario.ilike.%${email.split('@')[0]}%`);

  const subRol = legacyMatches?.[0]?.sub_rol || '';
  const rol = legacyMatches?.[0]?.rol || '';
  const isCoordinadorGeneral = subRol.toLowerCase().includes('coordinador general') || 
                               rol.toLowerCase() === 'superadmin' || 
                               rol.toLowerCase() === 'admin';

  return isSuperAdmin || isModuleAdmin || isCoordinadorGeneral;
}

// ── GET: LISTADO DE USUARIOS CON FILTROS ──────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError || !authData?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const authorized = await verifyAdminAuthorization(supabase, authData.user);
    if (!authorized) {
      return NextResponse.json({ error: 'Acceso restringido: Se requieren privilegios de Administrador o Coordinador General' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const role = searchParams.get('role') || '';
    const status = searchParams.get('status') || '';

    const { data: users, error: rpcError } = await (supabase.rpc as any)('nexus_admin_get_users', {
      p_search: search,
      p_role: role,
      p_status: status
    });

    if (rpcError) {
      console.error('Error in nexus_admin_get_users RPC:', rpcError);
      return NextResponse.json({ error: rpcError.message }, { status: 500 });
    }

    const userList = Array.isArray(users) ? users : [];

    // Calcular estadísticas de resumen
    const stats = {
      total: userList.length,
      active: userList.filter((u: any) => u.is_active).length,
      inactive: userList.filter((u: any) => !u.is_active).length,
      admins: userList.filter((u: any) => ['superadmin', 'module_admin'].includes(u.role_name)).length,
      supervisors: userList.filter((u: any) => u.role_name === 'supervisor').length,
      operators: userList.filter((u: any) => ['multi_operator', 'data_analyst', 'auditor'].includes(u.role_name)).length,
    };

    return NextResponse.json({
      success: true,
      users: userList,
      stats,
    });
  } catch (err: any) {
    console.error('GET /api/admin/users error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ── POST: CREAR NUEVO USUARIO ────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError || !authData?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const authorized = await verifyAdminAuthorization(supabase, authData.user);
    if (!authorized) {
      return NextResponse.json({ error: 'Acceso restringido: Se requieren privilegios de Administrador o Coordinador General' }, { status: 403 });
    }

    const body = await req.json();
    const {
      email,
      password,
      fullName,
      documentId,
      roleName = 'multi_operator',
      subRol = 'Operador/a',
      turno = 'Mañana',
      phoneNumber = '',
      address = '',
      institucion = '',
      extension = '',
      areas = ['Todas'],
    } = body;

    if (!email || !password || !fullName || !documentId) {
      return NextResponse.json({ error: 'Todos los campos obligatorios deben completarse' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail.endsWith('@impress.com')) {
      return NextResponse.json({ error: 'El correo debe pertenecer al dominio institucional (@impress.com)' }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'La contraseña debe contener al menos 6 caracteres' }, { status: 400 });
    }

    const { data: result, error: rpcError } = await (supabase.rpc as any)('nexus_admin_create_user', {
      p_email: cleanEmail,
      p_password: password,
      p_full_name: fullName.trim(),
      p_document_id: documentId.trim(),
      p_role_name: roleName,
      p_sub_rol: subRol.trim(),
      p_turno: turno,
      p_phone: phoneNumber.trim(),
      p_address: address.trim(),
      p_institucion: institucion.trim(),
      p_extension: extension ? extension.trim() : '',
      p_areas: Array.isArray(areas) ? areas : ['Todas'],
    });

    if (rpcError) {
      console.error('Error in nexus_admin_create_user RPC:', rpcError);
      return NextResponse.json({ error: rpcError.message }, { status: 500 });
    }

    if (!result?.success) {
      return NextResponse.json({ error: result?.error || 'No se pudo crear el usuario' }, { status: 400 });
    }

    // Emisión automática de notificación de bienvenida al nuevo colaborador
    try {
      await (supabase.from('nexus_notificaciones') as any).insert({
        user_email: cleanEmail,
        titulo: 'Bienvenido/a al Ecosistema Nexus',
        mensaje: `Tu cuenta corporativa ha sido habilitada con el rol ${roleName} (${subRol}) en el turno ${turno}. Extensión asignada: ${result.extension || 'Configurada'}.`,
        tipo: 'sistema',
        prioridad: 'alta',
        leida: false,
      });
    } catch (notifErr) {
      console.warn('Advertencia emitiendo notificación inicial:', notifErr);
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      userId: result.user_id,
      extension: result.extension,
    });
  } catch (err: any) {
    console.error('POST /api/admin/users error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ── PATCH: EDITAR USUARIO / CAMBIAR ROL / RESETEAR CLAVE / LIBERAR COOLDOWN ──
export async function PATCH(req: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError || !authData?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const authorized = await verifyAdminAuthorization(supabase, authData.user);
    if (!authorized) {
      return NextResponse.json({ error: 'Acceso restringido: Se requieren privilegios de Administrador o Coordinador General' }, { status: 403 });
    }

    const body = await req.json();
    const {
      userId,
      fullName,
      documentId,
      roleName,
      subRol,
      turno,
      phoneNumber,
      address,
      institucion,
      isActive = true,
      newPassword = null,
      resetCooldown = false,
      extension = null,
      areas = null,
    } = body;

    if (!userId) {
      return NextResponse.json({ error: 'Identificador de usuario (userId) requerido' }, { status: 400 });
    }

    const { data: result, error: rpcError } = await (supabase.rpc as any)('nexus_admin_update_user', {
      p_user_id: userId,
      p_full_name: fullName ? fullName.trim() : null,
      p_document_id: documentId ? documentId.trim() : null,
      p_role_name: roleName || '',
      p_sub_rol: subRol ? subRol.trim() : '',
      p_turno: turno || 'Mañana',
      p_phone: phoneNumber ? phoneNumber.trim() : '',
      p_address: address ? address.trim() : '',
      p_institucion: institucion ? institucion.trim() : '',
      p_is_active: isActive,
      p_new_password: newPassword && newPassword.trim().length >= 6 ? newPassword.trim() : null,
      p_reset_cooldown: !!resetCooldown,
      p_extension: extension ? extension.trim() : null,
      p_areas: areas ? areas : null,
    });

    if (rpcError) {
      console.error('Error in nexus_admin_update_user RPC:', rpcError);
      return NextResponse.json({ error: rpcError.message }, { status: 500 });
    }

    if (!result?.success) {
      return NextResponse.json({ error: result?.error || 'No se pudo actualizar el usuario' }, { status: 400 });
    }

    // Emisión automática de notificación de actualización
    try {
      const { data: targetUser } = await (supabase.from('profiles') as any).select('full_name, id').eq('id', userId).single();
      const { data: authTarget } = await (supabase.from('auth.users') as any).select('email').eq('id', userId).single();
      const targetEmail = authTarget?.email;

      if (targetEmail) {
        let msg = 'Tu perfil corporativo ha sido actualizado por la Administración.';
        if (newPassword) msg = 'Tu contraseña ha sido restablecida exitosamente por un Administrador de Nexus.';
        if (resetCooldown) msg = 'Tu restricción semanal de 7 días (cooldown) ha sido liberada por la Administración.';

        await (supabase.from('nexus_notificaciones') as any).insert({
          user_email: targetEmail,
          titulo: newPassword ? 'Actualización de Seguridad' : 'Actualización de Perfil',
          mensaje: msg,
          tipo: 'sistema',
          prioridad: 'alta',
          leida: false,
        });
      }
    } catch (e) {
      // Ignorar fallback silencioso
    }

    return NextResponse.json({
      success: true,
      message: result.message,
    });
  } catch (err: any) {
    console.error('PATCH /api/admin/users error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
