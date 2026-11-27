import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@intranet/auth/server';
import { getServiceSupabase } from '@/lib/rbac';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';

/**
 * POST /api/briana/dial
 * Envía orden remota de marcado (DIAL) desde la PC del operador hacia su Samsung vinculado.
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const { contactId, phoneNumber, contactName, campaignId, channel = 'sim' } = await req.json();
    if (!phoneNumber) {
      return NextResponse.json({ error: 'Número telefónico requerido' }, { status: 400 });
    }
    const callChannel = channel === 'whatsapp' ? 'whatsapp' : 'sim';
    const commandType = callChannel === 'whatsapp' ? 'DIAL_WHATSAPP' : 'DIAL';

    const serviceSb = getServiceSupabase(supabase);

    // Verificar sesión activa
    const { data: session } = await serviceSb
      .from('operator_sessions')
      .select('*, device:devices(*)')
      .eq('operator_id', authData.user.id)
      .eq('is_active', true)
      .maybeSingle();

    if (!session || !session.device) {
      return NextResponse.json({ error: 'No tiene un Samsung vinculado en turno activo.' }, { status: 400 });
    }

    const callUuid = randomUUID();

    if (contactId) {
      await serviceSb
        .from('contacts_queue')
        .update({ status: 'in_call', assigned_operator_id: authData.user.id })
        .eq('id', contactId);
    }

    const { data: command, error: cmdErr } = await serviceSb
      .from('call_commands')
      .insert({
        session_id: session.id,
        device_id: session.device.id,
        contact_id: contactId || null,
        call_uuid: callUuid,
        command_type: commandType,
        payload: {
          phone_number: phoneNumber,
          contact_name: contactName || 'Contacto',
          campaign_id: campaignId || session.campaign_id,
          operator_id: authData.user.id,
          initiated_from: 'pc_web',
          call_channel: callChannel,
        },
        status: 'pending',
      })
      .select('*')
      .single();

    if (cmdErr) throw cmdErr;

    return NextResponse.json({
      success: true,
      callUuid,
      command,
      message: `Orden de marcado enviada a ${session.device.model}`,
    });
  } catch (error: any) {
    console.error('Error in POST /api/briana/dial:', error);
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 });
  }
}
