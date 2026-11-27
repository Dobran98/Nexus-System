import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@intranet/auth/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * GET /api/briana/queue?campaignId=...
 * Asigna y devuelve automáticamente el siguiente contacto disponible para el operador:
 * 1. Primero revisa si ya tiene uno asignado actualmente ('assigned' o 'in_call').
 * 2. Luego revisa si tiene algún reprogramado ('rescheduled') cuya hora ya venció.
 * 3. Finalmente toma el siguiente 'pending' libre (por prioridad y next_retry_at) y lo bloquea para este operador.
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const campaignId = searchParams.get('campaignId');
    const serviceSb = getServiceSupabase();
    const nowIso = new Date().toISOString();

    // 1. ¿Ya tiene un contacto asignado activo?
    let currentQuery = serviceSb
      .from('contacts_queue')
      .select('*')
      .eq('assigned_operator_id', authData.user.id)
      .in('status', ['assigned', 'in_call'])
      .limit(1);
    if (campaignId) currentQuery = currentQuery.eq('campaign_id', campaignId);

    const { data: currentAssigned } = await currentQuery;
    if (currentAssigned && currentAssigned.length > 0) {
      return NextResponse.json({ success: true, contact: currentAssigned[0] });
    }

    // 2. ¿Tiene algún reprogramado vencido?
    let dueQuery = serviceSb
      .from('contacts_queue')
      .select('*')
      .eq('assigned_operator_id', authData.user.id)
      .eq('status', 'rescheduled')
      .lte('next_retry_at', nowIso)
      .order('next_retry_at', { ascending: true })
      .limit(1);
    if (campaignId) dueQuery = dueQuery.eq('campaign_id', campaignId);

    const { data: dueRescheduled } = await dueQuery;
    if (dueRescheduled && dueRescheduled.length > 0) {
      const target = dueRescheduled[0];
      const { data: locked } = await serviceSb
        .from('contacts_queue')
        .update({
          status: 'assigned',
          locked_until: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        })
        .eq('id', target.id)
        .select('*')
        .single();
      return NextResponse.json({ success: true, contact: locked || target });
    }

    // 3. Tomar siguiente contacto pendiente disponible
    let nextQuery = serviceSb
      .from('contacts_queue')
      .select('*')
      .eq('status', 'pending')
      .or(`next_retry_at.is.null,next_retry_at.lte.${nowIso}`)
      .order('priority', { ascending: false })
      .order('attempt_count', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(1);
    if (campaignId) nextQuery = nextQuery.eq('campaign_id', campaignId);

    const { data: candidates } = await nextQuery;
    if (!candidates || candidates.length === 0) {
      return NextResponse.json({ success: true, contact: null, message: 'No hay contactos disponibles en cola.' });
    }

    const candidate = candidates[0];
    const { data: claimed } = await serviceSb
      .from('contacts_queue')
      .update({
        status: 'assigned',
        assigned_operator_id: authData.user.id,
        locked_until: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      })
      .eq('id', candidate.id)
      .eq('status', 'pending')
      .select('*')
      .maybeSingle();

    return NextResponse.json({ success: true, contact: claimed || null });
  } catch (error: any) {
    console.error('Error in GET /api/briana/queue:', error);
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 });
  }
}
