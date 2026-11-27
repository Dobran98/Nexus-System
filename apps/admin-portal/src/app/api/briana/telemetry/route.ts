import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/rbac';

export const dynamic = 'force-dynamic';

/**
 * POST /api/briana/telemetry
 * Endpoint consumido por la APK Android (BrianaInCallService + Room Outbox).
 * Sincroniza transiciones reales de Android Telecom API:
 * - DIALING / RINGING / ACTIVE / DISCONNECTED
 * - Si DISCONNECTED sin haber tocado ACTIVE: auto-registra llamada como No Efectiva
 *   e incrementa attempt_count sin requerir modal manual en PC.
 * - También procesa ack de call_commands.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      callUuid,
      deviceUid,
      commandId,
      contactId,
      campaignId,
      operatorId,
      sessionId,
      state, // 'DIALING' | 'RINGING' | 'ACTIVE' | 'DISCONNECTED'
      callChannel = 'sim', // 'sim' | 'whatsapp'
      isConnected = false,
      initiatedFrom = 'android_app',
      endedBy,
      dialingAt,
      ringingAt,
      activeAt,
      disconnectedAt,
      talkDurationSeconds = 0,
      telecomDisconnectCode,
      telecomDisconnectMsg,
    } = body;

    if (!callUuid || !state) {
      return NextResponse.json({ error: 'callUuid y state son obligatorios' }, { status: 400 });
    }

    const serviceSb = getServiceSupabase();

    // 1. Marcar comando como ejecutado si aplica
    if (commandId) {
      await serviceSb
        .from('call_commands')
        .update({ status: 'executed', acked_at: new Date().toISOString() })
        .eq('id', commandId);
    }

    // 2. Resolver sesión, operador, dispositivo y campaña si no vinieron explícitos
    let resolvedSessionId = sessionId;
    let resolvedOperatorId = operatorId;
    let resolvedCampaignId = campaignId;
    let resolvedDeviceId = null;

    if (deviceUid) {
      const { data: dev } = await serviceSb
        .from('devices')
        .select('id')
        .eq('device_uid', deviceUid)
        .maybeSingle();
      resolvedDeviceId = dev?.id || null;

      if (resolvedDeviceId && (!resolvedSessionId || !resolvedOperatorId || !resolvedCampaignId)) {
        const { data: sess } = await serviceSb
          .from('operator_sessions')
          .select('id, operator_id, campaign_id')
          .eq('device_id', resolvedDeviceId)
          .eq('is_active', true)
          .maybeSingle();
        if (sess) {
          resolvedSessionId = resolvedSessionId || sess.id;
          resolvedOperatorId = resolvedOperatorId || sess.operator_id;
          resolvedCampaignId = resolvedCampaignId || sess.campaign_id;
        }
      }
    }

    let contactAttemptCount = 0;
    let contactMaxAttempts = 5;
    if (contactId) {
      const { data: contactRow } = await serviceSb
        .from('contacts_queue')
        .select('attempt_count, max_attempts, campaign_id')
        .eq('id', contactId)
        .maybeSingle();
      if (contactRow) {
        contactAttemptCount = contactRow.attempt_count || 0;
        contactMaxAttempts = contactRow.max_attempts || 5;
        resolvedCampaignId = resolvedCampaignId || contactRow.campaign_id;
      }
    }

    if (!resolvedCampaignId) {
      const { data: cmdRow } = await serviceSb
        .from('call_commands')
        .select('payload')
        .eq('call_uuid', callUuid)
        .maybeSingle();
      resolvedCampaignId = cmdRow?.payload?.campaign_id || null;
    }

    const attemptNumber = contactAttemptCount + 1;
    const resolvedChannel = callChannel === 'whatsapp' ? 'whatsapp' : 'sim';

    const { data: existingLog } = await serviceSb
      .from('call_logs')
      .select('id, dialing_at, ringing_at, active_at')
      .eq('call_uuid', callUuid)
      .maybeSingle();

    // Sincronizar transiciones en vivo (DIALING / RINGING / ACTIVE) para Realtime y polling PC
    if (state !== 'DISCONNECTED') {
      const nowIso = new Date().toISOString();
      if (!existingLog && resolvedSessionId && contactId && resolvedCampaignId && resolvedOperatorId && resolvedDeviceId) {
        await serviceSb.from('call_logs').insert({
          call_uuid: callUuid,
          session_id: resolvedSessionId,
          contact_id: contactId,
          campaign_id: resolvedCampaignId,
          operator_id: resolvedOperatorId,
          device_id: resolvedDeviceId,
          attempt_number: attemptNumber,
          call_channel: resolvedChannel,
          initiated_from: initiatedFrom,
          is_connected: state === 'ACTIVE' || !!isConnected,
          dialing_at: dialingAt || nowIso,
          ringing_at: ringingAt || (state === 'RINGING' ? nowIso : null),
          active_at: activeAt || (state === 'ACTIVE' ? nowIso : null),
          talk_duration_seconds: 0,
        });
      } else if (existingLog) {
        await serviceSb
          .from('call_logs')
          .update({
            is_connected: state === 'ACTIVE' || !!isConnected ? true : undefined,
            ringing_at: existingLog.ringing_at || ringingAt || (state === 'RINGING' ? nowIso : undefined),
            active_at: existingLog.active_at || activeAt || (state === 'ACTIVE' ? nowIso : undefined),
          })
          .eq('id', existingLog.id);
      }
    }

    // Si es evento final DISCONNECTED, cerrar call_logs
    if (state === 'DISCONNECTED') {
      // Determinar outcome automático cuando nunca conectó (isConnected === false)
      let autoOutcome: string | null = null;
      if (!isConnected) {
        if (telecomDisconnectCode === 4) autoOutcome = 'ocupado'; // BUSY
        else if (telecomDisconnectCode === 6 || telecomDisconnectCode === 7) autoOutcome = 'rechazada';
        else if (endedBy === 'operator_pc' || endedBy === 'operator_phone') autoOutcome = 'cancelada_antes_de_conectar';
        else autoOutcome = 'sin_respuesta';
      }

      const logPayload: any = {
        call_uuid: callUuid,
        session_id: resolvedSessionId,
        contact_id: contactId,
        campaign_id: resolvedCampaignId,
        operator_id: resolvedOperatorId,
        device_id: resolvedDeviceId,
        attempt_number: attemptNumber,
        call_channel: resolvedChannel,
        initiated_from: initiatedFrom,
        ended_by: endedBy || 'network_or_no_answer',
        is_connected: !!isConnected,
        dialing_at: existingLog?.dialing_at || dialingAt || new Date().toISOString(),
        ringing_at: existingLog?.ringing_at || ringingAt || null,
        active_at: existingLog?.active_at || activeAt || null,
        disconnected_at: disconnectedAt || new Date().toISOString(),
        talk_duration_seconds: isConnected ? Math.max(0, Number(talkDurationSeconds) || 0) : 0,
        outcome: autoOutcome,
        is_effective: false,
        telecom_disconnect_code: telecomDisconnectCode ?? null,
        telecom_disconnect_msg: telecomDisconnectMsg ?? null,
      };

      if (!existingLog && resolvedSessionId && contactId && resolvedCampaignId && resolvedOperatorId && resolvedDeviceId) {
        const { error: insertErr } = await serviceSb.from('call_logs').insert(logPayload);
        if (insertErr) throw insertErr;
      } else if (existingLog) {
        await serviceSb
          .from('call_logs')
          .update({
            ended_by: logPayload.ended_by,
            is_connected: logPayload.is_connected,
            ringing_at: logPayload.ringing_at,
            active_at: logPayload.active_at,
            disconnected_at: logPayload.disconnected_at,
            talk_duration_seconds: logPayload.talk_duration_seconds,
            outcome: autoOutcome || undefined,
            telecom_disconnect_code: logPayload.telecom_disconnect_code,
            telecom_disconnect_msg: logPayload.telecom_disconnect_msg,
          })
          .eq('id', existingLog.id);
      }

      // Si NO conectó (STATE_ACTIVE = false), cerrar intento automáticamente y liberar cola
      if (!isConnected && contactId) {
        const newAttempts = contactAttemptCount + 1;
        const maxAtt = contactMaxAttempts;
        const nextStatus = newAttempts >= maxAtt ? 'exhausted' : 'pending';
        const nextRetry = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 min cooldown

        await serviceSb
          .from('contacts_queue')
          .update({
            attempt_count: newAttempts,
            status: nextStatus,
            assigned_operator_id: null,
            locked_until: null,
            last_attempt_at: new Date().toISOString(),
            next_retry_at: nextStatus === 'pending' ? nextRetry : null,
            last_outcome: autoOutcome,
          })
          .eq('id', contactId);
      }
    }

    return NextResponse.json({
      success: true,
      callUuid,
      state,
      requiresPostCallModal: state === 'DISCONNECTED' && !!isConnected,
    });
  } catch (error: any) {
    console.error('Error in POST /api/briana/telemetry:', error);
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 });
  }
}

/**
 * GET /api/briana/telemetry?callUuid=...
 * Permite consultar el estado actual de una llamada específica (respaldo de Realtime).
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const callUuid = searchParams.get('callUuid');
    if (!callUuid) {
      return NextResponse.json({ error: 'callUuid requerido' }, { status: 400 });
    }
    const serviceSb = getServiceSupabase();
    const { data: log } = await serviceSb
      .from('call_logs')
      .select('*')
      .eq('call_uuid', callUuid)
      .maybeSingle();

    return NextResponse.json({ success: true, callLog: log || null });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
