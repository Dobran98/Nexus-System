import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/rbac';

export const dynamic = 'force-dynamic';

/**
 * POST /api/briana/telemetry
 * Endpoint consumido por la APK Android (BrianaInCallService + BrianaWhatsAppMonitorService + Room Outbox).
 * Ejecuta la RPC SECURITY DEFINER `briana_record_telemetry` para soportar llamadas SIM y WhatsApp
 * tanto en modo service_role como con anon key desde la flota Samsung.
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
    const { data, error } = await serviceSb.rpc('briana_record_telemetry', {
      p_call_uuid: callUuid,
      p_device_uid: deviceUid || null,
      p_command_id: commandId || null,
      p_contact_id: contactId || null,
      p_campaign_id: campaignId || null,
      p_operator_id: operatorId || null,
      p_session_id: sessionId || null,
      p_state: state,
      p_call_channel: callChannel === 'whatsapp' ? 'whatsapp' : 'sim',
      p_is_connected: !!isConnected,
      p_initiated_from: initiatedFrom === 'pc_web' ? 'pc_web' : 'android_app',
      p_ended_by: endedBy || null,
      p_dialing_at: dialingAt || null,
      p_ringing_at: ringingAt || null,
      p_active_at: activeAt || null,
      p_disconnected_at: disconnectedAt || null,
      p_talk_duration_seconds: Math.max(0, Number(talkDurationSeconds) || 0),
      p_telecom_disconnect_code: telecomDisconnectCode ?? null,
      p_telecom_disconnect_msg: telecomDisconnectMsg ?? null,
    });

    if (error) throw error;
    return NextResponse.json(data);
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
    const { data: log, error } = await serviceSb.rpc('briana_get_call_log', {
      p_call_uuid: callUuid,
    });
    if (error) throw error;

    return NextResponse.json({ success: true, callLog: log || null });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
