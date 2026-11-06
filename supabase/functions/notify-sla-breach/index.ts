// Supabase Edge Function: notify-sla-breach
// Detecta incidencias que superaron su SLA y envía notificaciones por webhook.
// Invocar cada 15 minutos vía pg_cron.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface IncidentSlaRow {
  id: string;
  title: string;
  severity: string;
  sla_due_date: string;
  status: string;
  reporter_id: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const telegramToken  = Deno.env.get('TELEGRAM_BOT_TOKEN');
  const telegramChatId = Deno.env.get('TELEGRAM_ALERT_CHAT_ID');

  try {
    // Consultar incidencias vencidas no resueltas
    const { data: breached, error } = await supabase
      .from('incidents')
      .select('id, title, severity, sla_due_date, status, reporter_id')
      .in('status', ['open', 'investigating'])
      .lt('sla_due_date', new Date().toISOString()) as { data: IncidentSlaRow[] | null; error: any };

    if (error) throw error;

    if (!breached || breached.length === 0) {
      return new Response(
        JSON.stringify({ success: true, breached_count: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Enviar alerta por Telegram si está configurado
    if (telegramToken && telegramChatId) {
      const severityEmoji: Record<string, string> = {
        critical: '🚨', high: '🔴', medium: '🟡', low: '🟢',
      };

      const lines = breached.map(
        (inc) => `${severityEmoji[inc.severity] ?? '⚠️'} *${inc.title}*\n   Vencido: ${new Date(inc.sla_due_date).toLocaleString('es-VE')}`
      );

      const message = `*⚠️ ALERTA SLA — ${breached.length} incidencia(s) vencida(s)*\n\n${lines.join('\n\n')}`;

      await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id:    telegramChatId,
          text:       message,
          parse_mode: 'Markdown',
        }),
      });
    }

    return new Response(
      JSON.stringify({ success: true, breached_count: breached.length, incidents: breached.map((i) => i.id) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
