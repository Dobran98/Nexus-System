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

    // Buscar registro de hoy
    const { data: record } = await (supabase
      .from('attendance_records') as any)
      .select('id, user_id, work_date, status, total_active_seconds, clock_in_summary, clock_out_summary, created_at')
      .eq('user_id', user.id)
      .eq('work_date', today)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let lastEvent: string | null = null;
    if (record?.id) {
      const { data: eventData } = await (supabase
        .from('clock_events') as any)
        .select('event_type, event_timestamp')
        .eq('attendance_id', record.id)
        .order('event_timestamp', { ascending: false })
        .limit(1)
        .maybeSingle();
      lastEvent = eventData?.event_type ?? null;
    }

    return NextResponse.json({
      record: record ?? null,
      last_event: lastEvent,
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
    } = body;

    // device_fingerprint constraint: CHECK (length between 16 and 128)
    let device_fingerprint = body.device_fingerprint;
    if (!device_fingerprint || device_fingerprint.length < 16) {
      device_fingerprint = 'nexus-device-fingerprint-v1-official';
    }
    device_fingerprint = device_fingerprint.slice(0, 128);

    const now = new Date().toISOString();
    const today = now.split('T')[0]; // 'YYYY-MM-DD'

    let targetAttendanceId = body.attendance_id;

    // ── CLOCK IN: buscar o crear attendance_record del día ──────────────────────
    if (event_type === 'clock_in') {
      // Verificar si ya existe registro hoy
      const { data: existingRecord } = await (supabase
        .from('attendance_records') as any)
        .select('id')
        .eq('user_id', user.id)
        .eq('work_date', today)
        .maybeSingle();

      if (existingRecord?.id) {
        targetAttendanceId = existingRecord.id;
      } else {
        // Status debe ser uno de: 'present', 'late', 'absent', 'excused'
        const { data: newRecord, error: attError } = await (supabase
          .from('attendance_records') as any)
          .insert({
            user_id:          user.id,
            work_date:        today,
            status:           'present',
            clock_in_summary: now,
          })
          .select('id')
          .single();

        if (attError || !newRecord) {
          return NextResponse.json(
            { error: attError?.message ?? 'Error al crear registro de asistencia' },
            { status: 500 }
          );
        }
        targetAttendanceId = newRecord.id;
      }

      // Registrar evento de clock_in
      const { error: eventError } = await (supabase
        .from('clock_events') as any)
        .insert({
          attendance_id:       targetAttendanceId,
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

      return NextResponse.json({ success: true, attendance_id: targetAttendanceId });
    }

    // ── OTROS EVENTOS (break_start, break_end, clock_out) ─────────────────────
    if (!targetAttendanceId) {
      // Intentar recuperarlo de la base de datos para la jornada de hoy
      const { data: existingRecord } = await (supabase
        .from('attendance_records') as any)
        .select('id')
        .eq('user_id', user.id)
        .eq('work_date', today)
        .maybeSingle();

      if (!existingRecord?.id) {
        return NextResponse.json({ error: 'No se encontró un registro de jornada activo para hoy' }, { status: 400 });
      }
      targetAttendanceId = existingRecord.id;
    }

    const { error: eventError } = await (supabase
      .from('clock_events') as any)
      .insert({
        attendance_id:       targetAttendanceId,
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

    // Nota: El trigger fn_recalculate_active_seconds() en PostgreSQL actualiza
    // automáticamente total_active_seconds y clock_out_summary de forma segura.

    return NextResponse.json({ success: true, attendance_id: targetAttendanceId });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
