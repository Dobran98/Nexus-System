import React from 'react';
import { GuidedDialer } from '@/components/GuidedDialer';
import { createSupabaseServerClient } from '@intranet/auth/server';
import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Discador Guiado — Nexus Calls & Incidents',
  description: 'Flujo de marcación y captura de interacciones en terminales celulares Samsung',
};

export default async function DialerPage() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  // Obtener el dispositivo asignado al operador actual
  const { data: device } = await supabase
    .from('corporate_devices')
    .select('*')
    .eq('assigned_user_id', user.id)
    .eq('status', 'assigned')
    .single();

  // Obtener la próxima asignación en cola para este operador
  const { data: assignment } = await supabase
    .from('call_assignments')
    .select('*')
    .eq('operator_id', user.id)
    .eq('state', 'queued')
    .order('priority', { ascending: true })
    .limit(1)
    .single();

  if (!device) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 flex items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-slate-300 font-medium">No tienes un dispositivo asignado.</p>
          <p className="text-slate-500 text-sm">Contacta a tu supervisor para que te asigne un terminal Samsung.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8">
      <div className="max-w-4xl mx-auto mb-6">
        <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
          Consola de Telefonía Móvil Corporativa
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Ecosistema Desacoplado Nexus — Operación sin central PBX
        </p>
      </div>

      <GuidedDialer
        currentOperatorId={user.id}
        assignedDevice={device}
        initialAssignment={assignment ?? null}
      />
    </main>
  );
}
