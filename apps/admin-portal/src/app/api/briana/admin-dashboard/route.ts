import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@intranet/auth/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

const ADMIN_ROLES = [
  'fundador_dev',
  'superadmin',
  'admin',
  'module_admin',
  'coordinador_general',
  'coordinador',
  'supervisor',
];

/**
 * GET /api/briana/admin-dashboard?campaignId=...
 * Métricas globales en vivo, persistencia por intentos, trazabilidad detallada,
 * reprogramados, números inválidos y estado de la flota Samsung.
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const email = (authData.user.email || '').toLowerCase();
    const isFounder = email.includes('brando') || email.includes('bralez');

    const { data: rolesData } = await (supabase.from('user_roles') as any)
      .select('roles!inner(name)')
      .eq('user_id', authData.user.id);
    const roleNames: string[] = (rolesData ?? []).map((r: any) => r.roles?.name).filter(Boolean);

    const hasAccess = isFounder || roleNames.some((r) => ADMIN_ROLES.includes(r));
    if (!hasAccess) {
      return NextResponse.json({ error: 'Acceso restringido a Supervisores, Coordinadores y Administradores.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const campaignId = searchParams.get('campaignId');
    const serviceSb = getServiceSupabase();

    // 1. Consultar cola de contactos
    let queueQuery = serviceSb.from('contacts_queue').select('*');
    if (campaignId) queueQuery = queueQuery.eq('campaign_id', campaignId);
    const { data: queueRows } = await queueQuery;
    const contacts = queueRows || [];

    const totalContactos = contacts.length;
    const totalLlamados = contacts.filter((c: any) => (c.attempt_count || 0) > 0).length;
    const pendientes = contacts.filter((c: any) => ['pending', 'assigned', 'rescheduled'].includes(c.status)).length;
    const efectivos = contacts.filter((c: any) => c.status === 'completed_effective').length;
    const invalidos = contacts.filter((c: any) => c.status === 'invalid_number').length;
    const reprogramados = contacts.filter((c: any) => c.status === 'rescheduled').length;
    const fallidos = contacts.filter(
      (c: any) => (c.attempt_count || 0) > 0 && c.status !== 'completed_effective' && c.status !== 'rescheduled'
    ).length;
    const pctEfectividad = totalLlamados > 0 ? Number(((efectivos / totalLlamados) * 100).toFixed(2)) : 0;

    // 2. Consultar logs de llamadas con trazabilidad
    let logsQuery = serviceSb
      .from('call_logs')
      .select(`
        *,
        contact:contact_id(full_name, phone_number, document_id, attempt_count, status),
        operator:operator_id(full_name),
        device:device_id(model, pairing_pin)
      `)
      .order('created_at', { ascending: false })
      .limit(200);
    if (campaignId) logsQuery = logsQuery.eq('campaign_id', campaignId);
    const { data: logsRows } = await logsQuery;
    const logs = logsRows || [];

    // 3. Análisis de persistencia (efectivos tras 1er, 2do, 3er, 4to+ intento)
    let effLogsQuery = serviceSb
      .from('call_logs')
      .select('attempt_number')
      .eq('is_effective', true);
    if (campaignId) effLogsQuery = effLogsQuery.eq('campaign_id', campaignId);
    const { data: effLogs } = await effLogsQuery;

    const persistence = {
      intento_1: 0,
      intento_2: 0,
      intento_3: 0,
      intento_4_mas: 0,
    };
    for (const row of effLogs || []) {
      const n = Number(row.attempt_number || 1);
      if (n === 1) persistence.intento_1++;
      else if (n === 2) persistence.intento_2++;
      else if (n === 3) persistence.intento_3++;
      else persistence.intento_4_mas++;
    }

    // 4. Reprogramados pendientes
    let schedQuery = serviceSb
      .from('call_schedules')
      .select(`
        *,
        contact:contact_id(full_name, phone_number, attempt_count),
        operator:operator_id(full_name)
      `)
      .eq('status', 'pending')
      .order('scheduled_for', { ascending: true })
      .limit(100);
    if (campaignId) schedQuery = schedQuery.eq('campaign_id', campaignId);
    const { data: schedules } = await schedQuery;

    // 5. Contactos inválidos / No pertenece al titular
    const invalidContacts = contacts
      .filter((c: any) => c.status === 'invalid_number')
      .slice(0, 100);

    // 6. Flota Samsung + Sesiones activas
    const { data: devices } = await serviceSb
      .from('devices')
      .select('*')
      .order('last_heartbeat_at', { ascending: false });

    const { data: activeSessions } = await serviceSb
      .from('operator_sessions')
      .select('id, device_id, operator_id, started_at, profiles:operator_id(full_name)')
      .eq('is_active', true);

    const sessionByDevice = new Map<string, any>();
    for (const s of activeSessions || []) {
      sessionByDevice.set(s.device_id, s);
    }

    const fleet = (devices || []).map((d: any) => {
      const sess = sessionByDevice.get(d.id);
      return {
        ...d,
        active_operator: sess?.profiles?.full_name || null,
        session_started_at: sess?.started_at || null,
      };
    });

    return NextResponse.json({
      success: true,
      summary: {
        totalContactos,
        totalLlamados,
        pendientes,
        efectivos,
        fallidos,
        reprogramados,
        invalidos,
        pctEfectividad,
      },
      persistence,
      fleet,
      recentLogs: logs,
      schedules: schedules || [],
      invalidContacts,
    });
  } catch (error: any) {
    console.error('Error in GET /api/briana/admin-dashboard:', error);
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 });
  }
}
