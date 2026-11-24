import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@intranet/auth/server';

// GET /api/oriana/dashboard
// Devuelve métricas agregadas y listado de reportes analíticos desde v_oriana_reports_summary
export async function GET() {
  try {
    const supabase = createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    // 1. Obtener listado de reportes desde la vista oficial
    const { data: reports, error: reportsError } = await (supabase
      .from('v_oriana_reports_summary') as any)
      .select('*')
      .order('created_at', { ascending: false });

    if (reportsError) {
      return NextResponse.json({ error: reportsError.message }, { status: 500 });
    }

    const reportList = reports ?? [];

    // 2. Calcular agregados
    const totalReports = reportList.length;
    const approvedCount = reportList.filter((r: any) => r.status === 'approved').length;
    const pendingCount = reportList.filter((r: any) => r.status === 'review_pending').length;
    const draftCount = reportList.filter((r: any) => r.status === 'draft').length;
    const rejectedCount = reportList.filter((r: any) => r.status === 'rejected').length;

    const totalRecords = reportList.reduce((acc: number, r: any) => acc + (r.total_records || 0), 0);
    const totalProcessed = reportList.reduce((acc: number, r: any) => acc + (r.processed_records || 0), 0);
    const totalDiscrepancies = reportList.reduce((acc: number, r: any) => acc + (r.discrepancy_count || 0), 0);

    const accuracies = reportList
      .map((r: any) => parseFloat(r.validation_accuracy))
      .filter((a: number) => !isNaN(a) && a > 0);

    const avgAccuracy = accuracies.length > 0
      ? (accuracies.reduce((a: number, b: number) => a + b, 0) / accuracies.length).toFixed(2)
      : '0.00';

    return NextResponse.json({
      reports: reportList,
      metrics: {
        totalReports,
        approvedCount,
        pendingCount,
        draftCount,
        rejectedCount,
        totalRecords,
        totalProcessed,
        totalDiscrepancies,
        avgAccuracy,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/oriana/dashboard
// Crea un nuevo reporte en oriana_reports y su correspondiente métrica en oriana_metrics
export async function POST(request: Request) {
  try {
    const supabase = createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const body = await request.json();
    const {
      report_title,
      batch_reference,
      total_records,
      processed_records,
      submission_deadline,
      validation_accuracy,
      discrepancy_count = 0,
      processing_time_minutes = 60,
      audit_notes,
    } = body;

    if (!report_title || !batch_reference || !total_records || !submission_deadline) {
      return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 });
    }

    // 1. Insertar en oriana_reports
    const { data: newReport, error: repError } = await (supabase
      .from('oriana_reports') as any)
      .insert({
        analyst_id:          user.id,
        report_title,
        batch_reference,
        total_records:       parseInt(total_records, 10),
        processed_records:   parseInt(processed_records || total_records, 10),
        status:              'review_pending',
        submission_deadline,
      })
      .select('id')
      .single();

    if (repError || !newReport) {
      return NextResponse.json({ error: repError?.message ?? 'Error al crear reporte' }, { status: 500 });
    }

    // 2. Insertar métricas en oriana_metrics
    const timeMins = parseInt(processing_time_minutes, 10) || 60;
    const procRecs = parseInt(processed_records || total_records, 10);
    const recPerHour = parseFloat(((procRecs / timeMins) * 60).toFixed(1));

    const { error: metError } = await (supabase
      .from('oriana_metrics') as any)
      .insert({
        report_id:               newReport.id,
        validation_accuracy:     parseFloat(validation_accuracy || '99.00'),
        discrepancy_count:       parseInt(discrepancy_count, 10) || 0,
        processing_time_minutes: timeMins,
        records_per_hour:        recPerHour,
        audit_notes:             audit_notes || `Ingesta analítica registrada por operador (${recPerHour} rec/h).`,
      });

    if (metError) {
      console.warn('Error al insertar métricas asociadas:', metError.message);
    }

    return NextResponse.json({ success: true, id: newReport.id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH /api/oriana/dashboard
// Actualiza el estado de un reporte (Aprobar / Rechazar) con notas del supervisor
export async function PATCH(request: Request) {
  try {
    const supabase = createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const body = await request.json();
    const { id, status, reviewer_notes } = body;

    if (!id || !['approved', 'rejected', 'review_pending'].includes(status)) {
      return NextResponse.json({ error: 'ID o estado inválido' }, { status: 400 });
    }

    const { error: updError } = await (supabase
      .from('oriana_reports') as any)
      .update({
        status,
        reviewer_id:    user.id,
        reviewer_notes: reviewer_notes ?? null,
        reviewed_at:    new Date().toISOString(),
        updated_at:     new Date().toISOString(),
      })
      .eq('id', id);

    if (updError) {
      return NextResponse.json({ error: updError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
