import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@intranet/auth/server';
import { getModuleFlags, saveModuleFlags } from '@/lib/moduleFlags';
import { getUserRbacContext } from '@/lib/rbac';

export const dynamic = 'force-dynamic';

// ── GET: CONSULTAR ESTADO DE MÓDULOS ─────────────────────────────────────────
export async function GET() {
  try {
    const supabase = createSupabaseServerClient();
    const { data: authData } = await supabase.auth.getUser();

    let isFundadorDev = false;
    let isSuperAdmin = false;

    if (authData?.user) {
      const rbac = await getUserRbacContext(supabase, authData.user);
      isFundadorDev = rbac.isFundadorDev;
      isSuperAdmin = rbac.isSuperAdmin;
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

    const rbac = await getUserRbacContext(supabase, authData.user);
    if (!rbac.isSuperAdmin && !rbac.isFundadorDev) {
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
      updated_by: rbac.isFundadorDev ? 'Fundador Dev' : rbac.email,
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
