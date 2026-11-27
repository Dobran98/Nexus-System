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
 * POST /api/briana/disposition
 * Cierre obligatorio en el panel web de Briana cuando la llamada conectó (is_connected = true).
 * Opciones:
 * 1. efectiva -> cierra el contacto como completed_effective
 * 2. buzon_de_voz | cortada_no_efectiva -> incrementa attempt_count y reencola
 * 3. reprogramada -> guarda en call_schedules con fecha/hora exacta y marca status = rescheduled
 * 4. numero_equivocado -> marca status = invalid_number para sacarlo de reintentos
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const { callUuid, contactId, outcome, notes, scheduledFor } = await req.json();
    if (!callUuid || !contactId || !outcome) {
      return NextResponse.json({ error: 'callUuid, contactId y outcome son obligatorios' }, { status: 400 });
    }

    const validOutcomes = ['efectiva', 'buzon_de_voz', 'cortada_no_efectiva', 'reprogramada', 'numero_equivocado'];
    if (!validOutcomes.includes(outcome)) {
      return NextResponse.json({ error: 'Tipificación no válida' }, { status: 400 });
    }

    if (outcome === 'reprogramada' && !scheduledFor) {
      return NextResponse.json({ error: 'Debe indicar fecha y hora exacta para reprogramar la llamada' }, { status: 400 });
    }

    const serviceSb = getServiceSupabase();
    const isEffective = outcome === 'efectiva';

    // 1. Actualizar call_logs
    const { data: callLog, error: logErr } = await serviceSb
      .from('call_logs')
      .update({
        outcome,
        is_effective: isEffective,
        operator_notes: notes || null,
      })
      .eq('call_uuid', callUuid)
      .select('*')
      .maybeSingle();

    if (logErr) throw logErr;

    // 2. Actualizar contacts_queue según tipificación
    const { data: contact } = await serviceSb
      .from('contacts_queue')
      .select('attempt_count, max_attempts, campaign_id')
      .eq('id', contactId)
      .single();

    const newAttempts = (contact?.attempt_count || 0) + 1;
    const maxAttempts = contact?.max_attempts || 5;

    let newStatus = 'pending';
    let nextRetryAt: string | null = null;
    let keepAssignedTo: string | null = null;

    if (outcome === 'efectiva') {
      newStatus = 'completed_effective';
    } else if (outcome === 'numero_equivocado') {
      newStatus = 'invalid_number';
    } else if (outcome === 'reprogramada') {
      newStatus = 'rescheduled';
      nextRetryAt = new Date(scheduledFor).toISOString();
      keepAssignedTo = authData.user.id;
    } else {
      // buzon_de_voz o cortada_no_efectiva
      newStatus = newAttempts >= maxAttempts ? 'exhausted' : 'pending';
      if (newStatus === 'pending') {
        nextRetryAt = new Date(Date.now() + 20 * 60 * 1000).toISOString();
      }
    }

    await serviceSb
      .from('contacts_queue')
      .update({
        attempt_count: newAttempts,
        status: newStatus,
        assigned_operator_id: keepAssignedTo,
        locked_until: null,
        last_attempt_at: new Date().toISOString(),
        next_retry_at: nextRetryAt,
        last_outcome: outcome,
      })
      .eq('id', contactId);

    // 3. Registrar en call_schedules si es reprogramada
    if (outcome === 'reprogramada') {
      await serviceSb.from('call_schedules').insert({
        contact_id: contactId,
        campaign_id: contact?.campaign_id || callLog?.campaign_id,
        operator_id: authData.user.id,
        source_call_log_id: callLog?.id || null,
        scheduled_for: new Date(scheduledFor).toISOString(),
        notes: notes || null,
        status: 'pending',
      });
    }

    return NextResponse.json({
      success: true,
      outcome,
      newStatus,
      attemptCount: newAttempts,
    });
  } catch (error: any) {
    console.error('Error in POST /api/briana/disposition:', error);
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 });
  }
}
