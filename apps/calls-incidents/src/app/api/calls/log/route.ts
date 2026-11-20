import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@intranet/database';

// POST /api/calls/log
// Persiste una call_interaction y devuelve la siguiente asignación en cola
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

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const body: any = await request.json();

  const { data: interaction, error: insertError } = await (supabase
    .from('call_interactions') as any)
    .insert([body])
    .select('id')
    .single();

  if (insertError || !interaction) {
    return NextResponse.json({ error: insertError?.message ?? 'Error al insertar' }, { status: 500 });
  }

  // Marcar la asignación actual como completada
  if (body.assignment_id) {
    await (supabase
      .from('call_assignments') as any)
      .update({ state: 'completed' })
      .eq('id', body.assignment_id);
  }

  // Buscar la siguiente asignación en cola para el operador
  const { data: nextAssignment } = await (supabase
    .from('call_assignments') as any)
    .select('*')
    .eq('operator_id', user.id)
    .eq('state', 'queued')
    .order('priority', { ascending: true })
    .limit(1)
    .single();

  return NextResponse.json({
    success: true,
    interactionId: interaction?.id,
    nextAssignment: nextAssignment ?? null,
  });
}
