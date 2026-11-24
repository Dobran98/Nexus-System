import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@intranet/auth/server';

// GET /api/attendance/clock
// Devuelve el estado actual de asistencia del usuario para hoy
export async function GET() {
  try {
    const supabase = createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const today = new Date().toISOString().split('T')[0];

    const { data: record } = await (supabase
      .from('attendance_records') as any)
      .select('*')
      .eq('user_id', user.id)
      .eq('work_date', today)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    return NextResponse.json({
      record: record ?? null,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/attendance/clock
// Registra eventos de asistencia: clock_in, break_start, break_end, clock_out
export async function POST(request: Request) {
  try {
    const supabase = createSupabaseServerClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const body = await request.json() as {
      event_type: string;
      verification_method?: string;
      latitude?: number | null;
      longitude?: number | null;
      device_fingerprint?: string;
      attendance_id?: string;
    };

    const {
      event_type,
      verification_method = 'qr_scan',
      latitude = null,
      longitude = null,
      device_fingerprint = 'unknown',
      attendance_id,
    } = body;

    const now = new Date().toISOString();

    // ── CLOCK IN: crear attendance_record del día ──────────────────────────────
    if (event_type === 'clock_in') {
      const today = now.split('T')[0]; // 'YYYY-MM-DD'

      const { data: attendance, error: attError } = await (supabase
        .from('attendance_records') as any)
        .insert({
          user_id:   user.id,
          work_date: today,
          status:    'active',
        })
        .select('id')
        .single();

      if (attError || !attendance) {
        return NextResponse.json(
          { error: attError?.message ?? 'Error al crear registro' },
          { status: 500 }
        );
      }

      const { error: eventError } = await (supabase
        .from('clock_events') as any)
        .insert({
          attendance_id:       attendance.id,
          event_type,
          verification_method,
          device_fingerprint,
          latitude,
          longitude,
          event_timestamp:     now,
        });

      if (eventError) {
        return NextResponse.json({ error: eventError.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, attendance_id: attendance.id });
    }

    // ── OTROS EVENTOS (break_start, break_end, clock_out) ─────────────────────
    if (!attendance_id) {
      return NextResponse.json({ error: 'attendance_id requerido' }, { status: 400 });
    }

    const { error: eventError } = await (supabase
      .from('clock_events') as any)
      .insert({
        attendance_id,
        event_type,
        verification_method,
        device_fingerprint,
        latitude,
        longitude,
        event_timestamp: now,
      });

    if (eventError) {
      return NextResponse.json({ error: eventError.message }, { status: 500 });
    }

    // clock_out → marcar registro como completado
    if (event_type === 'clock_out') {
      await (supabase
        .from('attendance_records') as any)
        .update({ status: 'completed' })
        .eq('id', attendance_id);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
