import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@intranet/auth/server';
import { getServiceSupabase, getUserRbacContext } from '@/lib/rbac';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const isVercelCron = request.headers.get('x-vercel-cron') === '1';
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    const isCronAuthorized = cronSecret
      ? authHeader === `Bearer ${cronSecret}`
      : isVercelCron;

    // Invocación automatizada exclusivamente desde Vercel Cron o con CRON_SECRET válido
    if (isCronAuthorized && (isVercelCron || authHeader)) {
      const serviceSb = getServiceSupabase();
      const { data, error } = await (serviceSb.rpc as any)('archive_and_purge_lifecycle', {
        p_retention_days: 90,
        p_dry_run: false,
      });

      if (error) {
        console.error('Error executing automated cron purge:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        source: 'cron',
        message: 'Purga nocturna y consolidación ejecutada satisfactoriamente',
        report: data,
      });
    }

    // Consulta administrativa de estadísticas de almacenamiento (requiere Admin o superior)
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const rbac = await getUserRbacContext(supabase, user);
    if (!rbac.isAdminOrCoord) {
      return NextResponse.json({ error: 'Acceso restringido: Se requieren privilegios administrativos.' }, { status: 403 });
    }

    const { data, error } = await (supabase.rpc as any)('nexus_get_database_storage_stats');

    if (error) {
      console.error('Error fetching database storage stats:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      stats: data,
    });
  } catch (err: any) {
    console.error('Lifecycle GET error:', err);
    return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    const isCronAuthorized = cronSecret && authHeader === `Bearer ${cronSecret}`;

    if (!isCronAuthorized) {
      if (authError || !user) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
      }
      const rbac = await getUserRbacContext(supabase, user);
      if (!rbac.isSuperAdmin && !rbac.isFundadorDev) {
        return NextResponse.json({ error: 'Acceso restringido: Solo Superadmin o Fundador Dev puede ejecutar purgas de ciclo de vida.' }, { status: 403 });
      }
    }

    const body = await request.json().catch(() => ({}));
    const retentionDays = parseInt(body.retentionDays || '90', 10);
    const dryRun = body.dryRun === true;

    // Ejecutar función de ciclo de vida
    const { data, error } = await (supabase.rpc as any)('archive_and_purge_lifecycle', {
      p_retention_days: retentionDays,
      p_dry_run: dryRun,
    });

    if (error) {
      console.error('Error executing lifecycle purge:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      dryRun,
      retentionDays,
      report: data,
    });
  } catch (err: any) {
    console.error('Lifecycle POST error:', err);
    return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 });
  }
}
