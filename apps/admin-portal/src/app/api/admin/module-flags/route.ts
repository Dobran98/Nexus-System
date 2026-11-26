import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@intranet/auth/server';
import { getModuleFlags, saveModuleFlags } from '@/lib/moduleFlags';

export const dynamic = 'force-dynamic';

// ── GET: CONSULTAR ESTADO DE MÓDULOS ─────────────────────────────────────────
export async function GET() {
  try {
    const supabase = createSupabaseServerClient();
    const { data: authData } = await supabase.auth.getUser();

    let isFundadorDev = false;
    let isSuperAdmin = false;

    if (authData?.user) {
      const email = authData.user.email || '';
      const { data: rolesData } = await (supabase.from('user_roles') as any)
        .select('roles!inner(name)')
        .eq('user_id', authData.user.id);
      const roleNames: string[] = (rolesData ?? []).map((r: any) => r.roles?.name as string).filter(Boolean);

      isFundadorDev = email.toLowerCase().includes('brando') || email.toLowerCase().includes('bralez') || roleNames.includes('fundador_dev');
      isSuperAdmin = roleNames.includes('superadmin') || isFundadorDev;
    }

    const flags = getModuleFlags();

    return NextResponse.json({
      success: true,
      flags,
      can_edit: isFundadorDev || isSuperAdmin,
      is_fundador_dev: isFundadorDev
    });
  } catch (error: any) {
    console.error('Error en GET /api/admin/module-flags:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ── POST: ALTERNAR ESTADO DE UN MÓDULO (Solo Fundador Dev / Superadmin) ───────
export async function POST(req: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError || !authData?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const email = authData.user.email || '';
    const { data: rolesData } = await (supabase.from('user_roles') as any)
      .select('roles!inner(name)')
      .eq('user_id', authData.user.id);
    const roleNames: string[] = (rolesData ?? []).map((r: any) => r.roles?.name as string).filter(Boolean);

    const isFundadorDev = email.toLowerCase().includes('brando') || email.toLowerCase().includes('bralez') || roleNames.includes('fundador_dev');
    const isSuperAdmin = roleNames.includes('superadmin') || isFundadorDev;

    if (!isSuperAdmin && !isFundadorDev) {
      return NextResponse.json({ error: 'Acceso restringido: Solo el Fundador Dev o Superadmin puede modificar la visibilidad de módulos.' }, { status: 403 });
    }

    const body = await req.json();
    const { moduleId, status, message } = body;

    if (!moduleId || !['public', 'testing', 'maintenance'].includes(status)) {
      return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 });
    }

    const currentFlags = getModuleFlags();
    if (!currentFlags[moduleId]) {
      return NextResponse.json({ error: 'Módulo no encontrado' }, { status: 404 });
    }

    currentFlags[moduleId] = {
      ...currentFlags[moduleId],
      status: status,
      maintenance_message: message || currentFlags[moduleId].maintenance_message,
      updated_by: isFundadorDev ? 'Fundador Dev' : email,
      updated_at: new Date().toISOString()
    };

    saveModuleFlags(currentFlags);

    return NextResponse.json({
      success: true,
      message: `El módulo "${currentFlags[moduleId].name}" ahora está en modo [${status.toUpperCase()}].`,
      module: currentFlags[moduleId]
    });
  } catch (error: any) {
    console.error('Error en POST /api/admin/module-flags:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
