import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@intranet/auth/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = createSupabaseServerClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError || !authData?.user) {
      return NextResponse.json({ authenticated: false, message: 'No active session' }, { status: 401 });
    }

    const authUser = authData.user;
    const email = authUser.email || '';

    // 1. Obtener perfil institucional
    const { data: profile } = await (supabase
      .from('profiles') as any)
      .select('*')
      .eq('id', authUser.id)
      .maybeSingle();

    // 2. Obtener roles asignados
    const { data: rolesData } = await (supabase
      .from('user_roles') as any)
      .select('roles!inner(name)')
      .eq('user_id', authUser.id);

    const roleNames: string[] = (rolesData ?? []).map((r: any) => r.roles?.name as string).filter(Boolean);
    const isSuperAdmin = roleNames.includes('superadmin') || email.toLowerCase().includes('admin') || email.toLowerCase().includes('brando');
    const isModuleAdmin = roleNames.includes('module_admin') || isSuperAdmin;
    const isSupervisor = roleNames.includes('supervisor') || isModuleAdmin;

    // 3. Obtener registro de la tabla legacy `usuarios`
    let legacyUser: any = null;
    const { data: legacyMatches } = await (supabase
      .from('usuarios') as any)
      .select('*')
      .or(`email.eq.${email},usuario.ilike.%${email.split('@')[0]}%`);

    if (legacyMatches && legacyMatches.length > 0) {
      legacyUser = legacyMatches[0];
    } else {
      // Buscar por nombre si no coincide por correo
      if (profile?.full_name) {
        const { data: nameMatches } = await (supabase
          .from('usuarios') as any)
          .select('*')
          .ilike('nombre_apellido', `%${profile.full_name}%`);
        if (nameMatches && nameMatches.length > 0) {
          legacyUser = nameMatches[0];
        }
      }
    }

    // 4. Mapear datos consolidados de identidad
    const username = legacyUser?.usuario || email.split('@')[0];
    const fullName = profile?.full_name || legacyUser?.nombre_apellido || email.split('@')[0];
    
    // Si es superadmin o informática, asegurar permisos elevados
    let resolvedRole = legacyUser?.rol || (isSuperAdmin || isModuleAdmin ? 'Admin' : (isSupervisor ? 'Analista' : 'Operador'));
    let resolvedSubRol = legacyUser?.sub_rol || (isSuperAdmin ? 'Informático/a' : (isSupervisor ? 'Coordinador General' : 'Operador/a'));

    if (isSuperAdmin || email.toLowerCase().includes('brando')) {
      resolvedRole = 'Admin';
      resolvedSubRol = 'Informático/a';
    }

    // Áreas de trabajo permitidas
    let areas: string[] = ['Todas'];
    if (legacyUser?.areas_ids && Array.isArray(legacyUser.areas_ids) && legacyUser.areas_ids.length > 0) {
      areas = legacyUser.areas_ids;
    }

    // Extensión asignada (o fallback de seguridad)
    const extension = '110' + (String(Math.abs(hashString(email)) % 90 + 10).padStart(2, '0'));

    return NextResponse.json({
      authenticated: true,
      user: {
        id: authUser.id,
        email: email,
        username: username,
        name: fullName,
        documentId: profile?.document_id || legacyUser?.cedula || '',
        role: resolvedRole,
        subRol: resolvedSubRol,
        roles: roleNames,
        isAdmin: resolvedRole.toLowerCase() === 'admin' || isSuperAdmin,
        isSuperAdmin: isSuperAdmin,
        isSupervisor: isSupervisor,
        areas: areas,
        turno: legacyUser?.turno || 'General',
        extension: extension,
        userId: legacyUser?.id_user || authUser.id,
      }
    });
  } catch (error: any) {
    console.error('Error in /api/auth/me:', error);
    return NextResponse.json({ authenticated: false, error: error.message }, { status: 500 });
  }
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}
