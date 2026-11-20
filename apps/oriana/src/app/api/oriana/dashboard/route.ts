import { NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@intranet/database';

type OrianaReport = Database['public']['Tables']['oriana_reports']['Row'];
type OrianaMetric = Database['public']['Tables']['oriana_metrics']['Row'];

// GET /api/oriana/dashboard
// Devuelve reportes y métricas agregadas del módulo Oriana
export async function GET(_request: Request) {
  const cookieStore = cookies();
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value; },
        set() {},
        remove() {},
      },
    }
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  // Obtener reportes — cast explícito para evitar inferencia incorrecta
  const { data: rawReports, error: reportsError } = await supabase
    .from('oriana_reports')
    .select('id, report_title, batch_reference, total_records, status, created_at, analyst_id')
    .order('created_at', { ascending: false })
    .limit(50)
    .returns<OrianaReport[]>();

  if (reportsError) {
    return NextResponse.json({ error: reportsError.message }, { status: 500 });
  }

  const allReports: OrianaReport[] = rawReports ?? [];

  const pendingCount = allReports.filter((r) => r.status === 'review_pending').length;
  const approvedCount = allReports.filter((r) => r.status === 'approved').length;

  // Precisión promedio desde oriana_metrics (campo: validation_accuracy)
  const { data: rawMetrics } = await supabase
    .from('oriana_metrics')
    .select('validation_accuracy')
    .returns<Pick<OrianaMetric, 'validation_accuracy'>[]>();

  const scores = (rawMetrics ?? [])
    .map((m) => m.validation_accuracy ?? 0)
    .filter((s) => s > 0);

  const avgAccuracy = scores.length > 0
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    : 0;

  return NextResponse.json({
    reports: allReports,
    pendingCount,
    approvedCount,
    avgAccuracy,
  });
}
