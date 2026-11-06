// Supabase Edge Function: materialize-daily-scores
// Calcula y persiste los scores diarios de rendimiento de todos los operadores.
// Invocar al cierre de jornada (ej. 23:55 diariamente vía pg_cron).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.includes('Bearer')) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const body = await req.json().catch(() => ({}));
  const targetDate: string = body.target_date ?? new Date().toISOString().split('T')[0];

  try {
    // Obtener todos los operadores activos
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id')
      .eq('is_active', true);

    if (profilesError) throw profilesError;

    const results: Array<{ user_id: string; success: boolean; error?: string }> = [];

    for (const profile of profiles ?? []) {
      const { error } = await supabase.rpc('fn_materialize_daily_score', {
        p_user_id:    profile.id,
        p_score_date: targetDate,
      });

      results.push({
        user_id: profile.id,
        success: !error,
        error: error?.message,
      });
    }

    const successful = results.filter((r) => r.success).length;
    const failed     = results.filter((r) => !r.success).length;

    return new Response(
      JSON.stringify({
        success: true,
        date: targetDate,
        processed: profiles?.length ?? 0,
        successful,
        failed,
        details: results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

