import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@intranet/auth/server';
import { isFounderEmail } from '@/lib/rbac';

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
    const isFundadorDev = isFounderEmail(email) || roleNames.includes('fundador_dev');
    let isSuperAdmin = roleNames.includes('superadmin') || isFundadorDev;
    const isModuleAdmin = roleNames.includes('admin') || roleNames.includes('module_admin') || isSuperAdmin;
    const isCoordinadorGeneral = roleNames.includes('coordinador_general') || isModuleAdmin;
    const isCoordinador = roleNames.includes('coordinador') || isCoordinadorGeneral;
    const isSupervisor = roleNames.includes('supervisor') || isCoordinador;
    const isAnalistaOperador = roleNames.includes('analista_operador') || roleNames.includes('multi_operator') || roleNames.includes('operator');

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

    // 4. Mapear datos consolidados de identidad con la jerarquía oficial
    const username = legacyUser?.usuario || email.split('@')[0];
    const fullName = profile?.full_name || legacyUser?.nombre_apellido || email.split('@')[0];
    
    // Jerarquía oficial (del más bajo al más alto):
    // 1. Analista - Operador | 2. Supervisor | 3. Coordinador | 4. Coordinador General - Admin | 5. Superadmin | 6. Fundador Dev
    let resolvedRole = legacyUser?.rol || 'Analista - Operador';
    let resolvedSubRol = legacyUser?.sub_rol || 'Analista - Operador';

    if (isFundadorDev) {
      resolvedRole = 'Fundador Dev';
      resolvedSubRol = 'Superadmin - Fundador Dev';
      if (!roleNames.includes('fundador_dev')) roleNames.unshift('fundador_dev');
      if (!roleNames.includes('superadmin')) roleNames.unshift('superadmin');
    } else if (isSuperAdmin) {
      resolvedRole = 'Superadmin';
      resolvedSubRol = 'Superadmin';
      if (!roleNames.includes('superadmin')) roleNames.unshift('superadmin');
    } else if (isModuleAdmin) {
      resolvedRole = 'Admin';
      resolvedSubRol = 'Coordinador General - Admin';
    } else if (isCoordinadorGeneral) {
      resolvedRole = 'Coordinador General';
      resolvedSubRol = 'Coordinador General';
    } else if (isCoordinador) {
      resolvedRole = 'Coordinador';
      resolvedSubRol = 'Coordinador de Área';
    } else if (isSupervisor) {
      resolvedRole = 'Supervisor';
      resolvedSubRol = 'Supervisor de Sala';
    } else {
      resolvedRole = 'Analista - Operador';
      resolvedSubRol = 'Analista - Operador';
    }

    // Áreas de trabajo permitidas
    let areas: string[] = ['Todas'];
    if (legacyUser?.areas_ids && Array.isArray(legacyUser.areas_ids) && legacyUser.areas_ids.length > 0) {
      areas = legacyUser.areas_ids;
    }

    // Extensión real asignada o dispositivo Samsung activo (fallback determinista)
    let extension = legacyUser?.dispositivo_vinculado_id || '';
    if (!extension) {
      try {
        const { data: extRow } = await (supabase
          .from('briana_extensiones') as any)
          .select('extension')
          .eq('usuario', username)
          .order('fecha', { ascending: false })
          .limit(1)
          .maybeSingle();
        extension = extRow?.extension || '';
      } catch {
        extension = '';
      }
    }
    if (!extension) {
      extension = '110' + (String(Math.abs(hashString(email)) % 90 + 10).padStart(2, '0'));
    }

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
        isAdmin: isSuperAdmin || isModuleAdmin || resolvedRole.toLowerCase() === 'admin',
        isSuperAdmin: isSuperAdmin,
        isFundadorDev: isFundadorDev,
        isCoordinadorGeneral: isCoordinadorGeneral,
        isCoordinador: isCoordinador,
        isSupervisor: isSupervisor,
        isAnalistaOperador: isAnalistaOperador,
        roleRank: isFundadorDev ? 60 : (isSuperAdmin ? 50 : (isModuleAdmin || isCoordinadorGeneral ? 40 : (isCoordinador ? 30 : (isSupervisor ? 20 : 10)))),
        areas: areas,
        turno: legacyUser?.turno || 'General',
        extension: extension,
        fotoUrl: legacyUser?.foto_url || '',
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
