import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@intranet/auth/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date') || new Date().toISOString().split('T')[0];
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    // Invocar RPC de Leaderboard diario
    const { data, error } = await (supabase.rpc as any)('nexus_get_daily_leaderboard', {
      p_date: dateParam,
      p_limit: limit,
    });

    if (error) {
      console.error('Error fetching scoring leaderboard:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      date: dateParam,
      leaderboard: data || [],
    });
  } catch (err: any) {
    console.error('Scoring GET error:', err);
    return NextResponse.json({ error: err.message || 'Error interno del servidor' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const dateParam = body.date || new Date().toISOString().split('T')[0];

    // Invocar cálculo de scoring
    const { data, error } = await (supabase.rpc as any)('nexus_calculate_daily_scores', {
      p_date: dateParam,
    });

    if (error) {
      console.error('Error calculating daily scores:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      result: data,
    });
  } catch (err: any) {
    console.error('Scoring POST error:', err);
    return NextResponse.json({ error: err.message || 'Error interno del servidor' }, { status: 500 });
  }
}
