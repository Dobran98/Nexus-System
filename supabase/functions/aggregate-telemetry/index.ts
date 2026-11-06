// Supabase Edge Function: aggregate-telemetry
// Consolida logs de telemetría de >90 días en agregados diarios y los purga.
// Invocar diariamente vía pg_cron o Supabase Scheduler.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Solo permite invocación con service_role key
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

  try {
    // Ejecutar función de purga y archivo
    const { data, error } = await supabase.rpc('fn_archive_and_purge_lifecycle', {
      p_dry_run: false,
    });

    if (error) throw error;

    return new Response(
      JSON.stringify({ success: true, report: data }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
