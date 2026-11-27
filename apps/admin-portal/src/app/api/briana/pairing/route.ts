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

    // 1. REGISTRO / HEARTBEAT DESDE APK ANDROID
    if (action === 'register_device') {
      const { deviceUid, model, simPhoneNumber, carrierName, batteryPct, networkType, appVersion, isDefaultDialer } = body;
      if (!deviceUid || !model) {
        return NextResponse.json({ error: 'deviceUid y model son obligatorios' }, { status: 400 });
      }

      const { data: existing } = await serviceSb
        .from('devices')
        .select('*')
        .eq('device_uid', deviceUid)
        .maybeSingle();

      const now = new Date();
      const expiresAt = new Date(now.getTime() + 12 * 3600 * 1000).toISOString();
      const pin = existing?.pairing_pin && new Date(existing.pin_expires_at) > now
        ? existing.pairing_pin
        : generatePairingPin();

      let deviceRecord: any = null;
      if (existing) {
        const { data: updated, error } = await serviceSb
          .from('devices')
          .update({
            model,
            sim_phone_number: simPhoneNumber ?? existing.sim_phone_number,
            carrier_name: carrierName ?? existing.carrier_name,
            pairing_pin: pin,
            pin_expires_at: expiresAt,
            battery_pct: batteryPct ?? existing.battery_pct,
            network_type: networkType ?? existing.network_type,
            app_version: appVersion ?? existing.app_version,
            is_default_dialer: isDefaultDialer ?? existing.is_default_dialer,
            last_heartbeat_at: now.toISOString(),
          })
          .eq('id', existing.id)
          .select('*')
          .single();
        if (error) throw error;
        deviceRecord = updated;
      } else {
        const { data: inserted, error } = await serviceSb
          .from('devices')
          .insert({
            device_uid: deviceUid,
            model,
            sim_phone_number: simPhoneNumber || null,
            carrier_name: carrierName || null,
            pairing_pin: pin,
            pin_expires_at: expiresAt,
            status: 'available',
            battery_pct: batteryPct ?? 100,
            network_type: networkType || 'WIFI',
            app_version: appVersion || '1.0.0',
            is_default_dialer: !!isDefaultDialer,
            last_heartbeat_at: now.toISOString(),
          })
          .select('*')
          .single();
        if (error) throw error;
        deviceRecord = inserted;
      }

      // Verificar si tiene sesión activa vinculada
      const { data: activeSession } = await serviceSb
        .from('operator_sessions')
        .select('id, operator_id, campaign_id, started_at, profiles:operator_id(full_name)')
        .eq('device_id', deviceRecord.id)
        .eq('is_active', true)
        .maybeSingle();

      // Entregar comandos pendientes y marcarlos como 'acked' atómicamente para evitar bucles
      const { data: pendingCommands } = await serviceSb
        .from('call_commands')
        .select('*')
        .eq('device_id', deviceRecord.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: true });

      if (pendingCommands && pendingCommands.length > 0) {
        const cmdIds = pendingCommands.map((c: any) => c.id);
        await serviceSb
          .from('call_commands')
          .update({ status: 'acked', acked_at: now.toISOString() })
          .in('id', cmdIds);
      }

      return NextResponse.json({
        success: true,
        device: deviceRecord,
        activeSession: activeSession || null,
        pendingCommands: pendingCommands || [],
      });
    }

    // 2. VINCULAR SESIÓN DESDE PC WEB CON PIN
    if (action === 'pair_session') {
      const supabase = createSupabaseServerClient();
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData?.user) {
        return NextResponse.json({ error: 'No autenticado en Nexus' }, { status: 401 });
      }

      const { pairingPin, campaignId } = body;
      const cleanPin = String(pairingPin || '').trim().toUpperCase();
      if (!cleanPin) {
        return NextResponse.json({ error: 'Ingrese el código de vinculación del teléfono (ej. BRN-4829)' }, { status: 400 });
      }

      const { data: device } = await serviceSb
        .from('devices')
        .select('*')
        .eq('pairing_pin', cleanPin)
        .maybeSingle();

      if (!device) {
        return NextResponse.json({ error: `No se encontró ningún Samsung activo con el código ${cleanPin}` }, { status: 404 });
      }

      if (new Date(device.pin_expires_at) < new Date()) {
        return NextResponse.json({ error: 'El código de vinculación expiró. Presione Actualizar en la APK del teléfono.' }, { status: 400 });
      }

      // Cerrar cualquier sesión previa abierta de este operador o este dispositivo
      await serviceSb
        .from('operator_sessions')
        .update({ is_active: false, ended_at: new Date().toISOString(), ended_reason: 'repaired_new_session' })
        .or(`operator_id.eq.${authData.user.id},device_id.eq.${device.id}`)
        .eq('is_active', true);

      const { data: newSession, error: sessError } = await serviceSb
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

      await serviceSb
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

      let targetSessionId = sessionId;
      let targetDeviceId = deviceId;

      if (!targetSessionId) {
        const supabase = createSupabaseServerClient();
        const { data: authData } = await supabase.auth.getUser();
        if (authData?.user) {
          const { data: sess } = await serviceSb
            .from('operator_sessions')
            .select('id, device_id')
            .eq('operator_id', authData.user.id)
            .eq('is_active', true)
            .maybeSingle();
          targetSessionId = sess?.id;
          targetDeviceId = sess?.device_id;
        }
      }

      if (targetSessionId) {
        const { data: closedSess } = await serviceSb
          .from('operator_sessions')
          .update({ is_active: false, ended_at: new Date().toISOString(), ended_reason: reason })
          .eq('id', targetSessionId)
          .select('operator_id')
          .maybeSingle();

        // Liberar contactos bloqueados por ese operador al cerrar turno
        if (closedSess?.operator_id) {
          await serviceSb
            .from('contacts_queue')
            .update({ status: 'pending', assigned_operator_id: null, locked_until: null })
            .eq('assigned_operator_id', closedSess.operator_id)
            .in('status', ['assigned', 'in_call']);
        }
      }

      if (targetDeviceId) {
        await serviceSb
          .from('devices')
          .update({ status: 'available' })
          .eq('id', targetDeviceId);
      }

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

    const serviceSb = getServiceSupabase();
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

