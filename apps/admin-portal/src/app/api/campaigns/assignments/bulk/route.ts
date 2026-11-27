import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@intranet/database';
import { getUserRbacContext } from '@/lib/rbac';

// POST /api/campaigns/assignments/bulk
// Inserta un batch de call_assignments en Supabase
export async function POST(request: Request) {
  const cookieStore = cookies();
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value; },
        set() {},
        remove() {},
      },
    }
  );

  // Verificar autenticación y permisos RBAC (Supervisor o superior)
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const rbac = await getUserRbacContext(supabase, user);
  if (!rbac.isSupervisorOrAbove) {
    return NextResponse.json(
      { error: 'Acceso restringido: Se requieren privilegios de Supervisor o superior para cargas masivas.' },
      { status: 403 }
    );
  }

  let body: { assignments: any[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 });
  }

  const { assignments } = body;
  if (!assignments || assignments.length === 0) {
    return NextResponse.json({ error: 'Sin registros para insertar' }, { status: 400 });
  }

  const { error, count } = await (supabase
    .from('call_assignments') as any)
    .insert(assignments);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, inserted: count ?? assignments.length });
}
