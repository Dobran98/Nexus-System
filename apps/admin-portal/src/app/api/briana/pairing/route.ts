import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@intranet/auth/server';
import { getServiceSupabase } from '@/lib/rbac';

export const dynamic = 'force-dynamic';

function generatePairingPin(): string {
  const digits = Math.floor(1000 + Math.random() * 9000);
  return `BRN-${digits}`;
}

/**
 * POST /api/briana/pairing
 * Acciones:
 * - register_device (desde APK): registra o actualiza Samsung A57/A37, genera/renueva PIN BRN-XXXX y devuelve comandos pendientes.
 * - pair_session (desde PC): operador autenticado ingresa el PIN BRN-XXXX y vincula su sesión activa.
 * - unpair_session (desde PC o APK): cierra el turno y libera el dispositivo.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;
    const serviceSb = getServiceSupabase();

    // 1. REGISTRO / HEARTBEAT DESDE APK ANDROID (vía RPC SECURITY DEFINER)
    if (action === 'register_device') {
      const { deviceUid, model, simPhoneNumber, carrierName, batteryPct, networkType, appVersion, isDefaultDialer } = body;
      if (!deviceUid || !model) {
        return NextResponse.json({ error: 'deviceUid y model son obligatorios' }, { status: 400 });
      }

      const { data: rpcRes, error: rpcErr } = await serviceSb.rpc('briana_register_device', {
        p_device_uid: deviceUid,
        p_model: model,
        p_sim_phone_number: simPhoneNumber || null,
        p_carrier_name: carrierName || null,
        p_battery_pct: batteryPct ?? 100,
        p_network_type: networkType || 'WIFI',
        p_app_version: appVersion || '1.0.0',
        p_is_default_dialer: !!isDefaultDialer,
      });

      if (rpcErr) throw rpcErr;

      return NextResponse.json(rpcRes);
    }

    // 2. VINCULAR SESIÓN DESDE PC WEB CON PIN
    if (action === 'pair_session') {
      const supabase = createSupabaseServerClient();
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData?.user) {
        return NextResponse.json({ error: 'No autenticado en Nexus' }, { status: 401 });
      }
      const db = getServiceSupabase(supabase);

      const { pairingPin, campaignId } = body;
      const cleanPin = String(pairingPin || '').trim().toUpperCase();
      if (!cleanPin) {
        return NextResponse.json({ error: 'Ingrese el código de vinculación del teléfono (ej. BRN-4829)' }, { status: 400 });
      }

      const { data: device } = await db
        .from('devices')
        .select('*')
        .eq('pairing_pin', cleanPin)
        .maybeSingle();

      if (!device) {
        return NextResponse.json({ error: `No se encontró ningún Samsung activo con el código ${cleanPin}` }, { status: 404 });
      }

      if (new Date(device.pin_expires_at) < new Date()) {
        return NextResponse.json({ error: 'El código de vinculación expiró. Presione Reintentar en la APK del teléfono.' }, { status: 400 });
      }

      // Cerrar cualquier sesión previa abierta de este operador o este dispositivo
      await db
        .from('operator_sessions')
        .update({ is_active: false, ended_at: new Date().toISOString(), ended_reason: 'repaired_new_session' })
        .or(`operator_id.eq.${authData.user.id},device_id.eq.${device.id}`)
        .eq('is_active', true);

      const { data: newSession, error: sessError } = await db
        .from('operator_sessions')
        .insert({
          operator_id: authData.user.id,
          device_id: device.id,
          campaign_id: campaignId || null,
          pairing_pin_used: cleanPin,
          is_active: true,
        })
        .select('*')
        .single();

      if (sessError) throw sessError;

      await db
        .from('devices')
        .update({ status: 'in_shift' })
        .eq('id', device.id);

      return NextResponse.json({
        success: true,
        session: newSession,
        device,
        message: `Vinculado con ${device.model} (${cleanPin})`,
      });
    }

    // 3. DESVINCULAR / CERRAR TURNO
    if (action === 'unpair_session') {
      const { sessionId, deviceId, reason = 'operator_ended_shift' } = body;
      let operatorId: string | null = null;
      try {
        const supabase = createSupabaseServerClient();
        const { data: authData } = await supabase.auth.getUser();
        operatorId = authData?.user?.id || null;
      } catch {
        operatorId = null;
      }

      const { error: unpairErr } = await serviceSb.rpc('briana_unpair_session', {
        p_session_id: sessionId || null,
        p_device_id: deviceId || null,
        p_operator_id: operatorId,
        p_reason: reason,
      });
      if (unpairErr) throw unpairErr;

      return NextResponse.json({ success: true, message: 'Turno cerrado y dispositivo liberado.' });
    }

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
  } catch (error: any) {
    console.error('Error in POST /api/briana/pairing:', error);
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 });
  }
}

/**
 * GET /api/briana/pairing
 * Devuelve la sesión activa del operador autenticado junto con el estado de su Samsung vinculado.
 */
export async function GET() {
  try {
    const supabase = createSupabaseServerClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const serviceSb = getServiceSupabase(supabase);
    const { data: session } = await serviceSb
      .from('operator_sessions')
      .select('*, device:devices(*)')
      .eq('operator_id', authData.user.id)
      .eq('is_active', true)
      .maybeSingle();

    return NextResponse.json({ success: true, session: session || null });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

