import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@intranet/auth/server';
import { getServiceSupabase, getUserRbacContext } from '@/lib/rbac';

export const dynamic = 'force-dynamic';

/**
 * POST /api/briana/queue/import
 * Permite a Supervisores/Coordinadores/Admins cargar contactos a `contacts_queue`
 * (creando o asociando una campaña en `call_campaigns`).
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const rbac = await getUserRbacContext(supabase, authData.user);
    if (!rbac.isSupervisorOrAbove) {
      return NextResponse.json(
        { error: 'Acceso restringido: Se requieren privilegios de Supervisor o superior para cargar contactos.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { campaignTitle, campaignId, contacts } = body;

    if (!Array.isArray(contacts) || contacts.length === 0) {
      return NextResponse.json({ error: 'Debe proporcionar al menos un contacto válido.' }, { status: 400 });
    }

    const serviceSb = getServiceSupabase();

    // 1. Resolver o crear campaña
    let targetCampaignId = campaignId;
    if (!targetCampaignId) {
      const title = String(campaignTitle || `Campaña SIM ${new Date().toLocaleDateString('es-VE')}`).trim();
      const { data: existingCamp } = await serviceSb
        .from('call_campaigns')
        .select('id')
        .eq('status', 'active')
        .limit(1)
        .maybeSingle();

      if (existingCamp && !campaignTitle) {
        targetCampaignId = existingCamp.id;
      } else {
        const { data: createdCamp, error: campErr } = await serviceSb
          .from('call_campaigns')
          .insert({
            title,
            description: 'Campaña operativa Briana SIM',
            status: 'active',
            created_by: authData.user.id,
          })
          .select('id')
          .single();
        if (campErr) throw campErr;
        targetCampaignId = createdCamp.id;
      }
    }

    // 2. Normalizar y deduplicar contactos por teléfono en el lote
    const seenPhones = new Set<string>();
    const rowsToInsert: any[] = [];

    for (const c of contacts) {
      const rawPhone = String(c.phone_number || c.phone || '').replace(/[^\d+]/g, '').trim();
      const fullName = String(c.full_name || c.name || 'Ciudadano').trim();
      if (!rawPhone || rawPhone.length < 7 || seenPhones.has(rawPhone)) continue;
      seenPhones.add(rawPhone);

      rowsToInsert.push({
        campaign_id: targetCampaignId,
        full_name: fullName,
        phone_number: rawPhone,
        document_id: c.document_id ? String(c.document_id).trim() : null,
        priority: Number(c.priority) || 0,
        max_attempts: Number(c.max_attempts) || 5,
        status: 'pending',
      });
    }

    if (rowsToInsert.length === 0) {
      return NextResponse.json({ error: 'Ningún contacto tenía un número telefónico válido.' }, { status: 400 });
    }

    // Inserción por lotes de 500
    let insertedCount = 0;
    for (let i = 0; i < rowsToInsert.length; i += 500) {
      const chunk = rowsToInsert.slice(i, i + 500);
      const { error: insErr } = await serviceSb.from('contacts_queue').insert(chunk);
      if (insErr) throw insErr;
      insertedCount += chunk.length;
    }

    return NextResponse.json({
      success: true,
      campaignId: targetCampaignId,
      insertedCount,
      message: `${insertedCount} contactos cargados a la cola de marcado.`,
    });
  } catch (error: any) {
    console.error('Error in POST /api/briana/queue/import:', error);
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 });
  }
}
