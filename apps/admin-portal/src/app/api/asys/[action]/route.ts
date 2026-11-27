import { NextRequest, NextResponse } from 'next/server';
import { handleAsysAction } from '@/lib/asys-handlers';
import { createSupabaseServerClient } from '@intranet/auth/server';
import { isFounderEmail } from '@/lib/rbac';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: { action: string } }
) {
  try {
    const action = params.action;
    const body = await req.json().catch(() => ({}));
    const args = Array.isArray(body) ? body : (body.args || []);

    // Identificar sesión activa y privilegios de SuperAdmin
    let isSuperAdmin = false;
    let requesterEmail = '';
    let authUser = null;

    try {
      const supabase = createSupabaseServerClient();
      const { data: authData } = await supabase.auth.getUser();
      authUser = authData?.user || null;
      requesterEmail = authUser?.email?.toLowerCase() || '';

      if (isFounderEmail(requesterEmail)) {
        isSuperAdmin = true;
      } else if (authUser) {
        const { data: rolesData } = await (supabase
          .from('user_roles') as any)
          .select('roles!inner(name)')
          .eq('user_id', authUser.id);
        const roleNames = (rolesData ?? []).map((r: any) => r.roles?.name as string).filter(Boolean);
        if (roleNames.includes('superadmin')) {
          isSuperAdmin = true;
        }
      }
    } catch {
      // Ignorar fallback si no hay cookies de sesión
    }

    const sessionContext = { isSuperAdmin, email: requesterEmail, user: authUser };
    const result = await handleAsysAction(action, args, body, sessionContext);
    return NextResponse.json(result);
  } catch (err: any) {
    console.error(`Error procesando acción /api/asys/${params?.action}:`, err);
    return NextResponse.json(
      { success: false, error: err.message || 'Error interno en el servidor' },
      { status: 500 }
    );
  }
}
