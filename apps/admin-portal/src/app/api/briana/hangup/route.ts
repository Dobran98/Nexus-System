import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@intranet/auth/server';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * POST /api/briana/hangup
 * Envía orden remota de corte (HANGUP) desde la PC hacia el Samsung vinculado.
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const { callUuid, contactId } = await req.json();
    const serviceSb = getServiceSupabase();

    const { data: session } = await serviceSb
      .from('operator_sessions')
      .select('id, device_id')
      .eq('operator_id', authData.user.id)
      .eq('is_active', true)
      .maybeSingle();

    if (!session) {
      return NextResponse.json({ error: 'No hay sesión activa.' }, { status: 400 });
    }

    const { data: command, error: cmdErr } = await serviceSb
      .from('call_commands')
      .insert({
        session_id: session.id,
        device_id: session.device_id,
        contact_id: contactId || null,
        call_uuid: callUuid || randomUUID(),
        command_type: 'HANGUP',
        payload: { ended_by: 'operator_pc' },
        status: 'pending',
      })
      .select('*')
      .single();

    if (cmdErr) throw cmdErr;

    return NextResponse.json({ success: true, command });
  } catch (error: any) {
    console.error('Error in POST /api/briana/hangup:', error);
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 });
  }
}
