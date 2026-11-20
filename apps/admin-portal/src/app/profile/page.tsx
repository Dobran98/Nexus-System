import React from 'react';
import { ProfileRestrictionPanel } from '@/components/ProfileRestrictionPanel';
import { createSupabaseServerClient } from '@intranet/auth/server';
import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Perfil y Gobernanza de Acceso — Nexus Admin Portal',
  description: 'Panel de perfil de usuario con control de cuota semanal de actualización',
};

export default async function ProfilePage() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error || !profile) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 flex items-center justify-center">
        <p className="text-slate-400">Perfil no encontrado. Contacta al administrador.</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8">
      <div className="max-w-3xl mx-auto mb-6">
        <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
          Gobernanza de Perfil y Auditoría
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Políticas de integridad de datos y restricción semanal de identidad
        </p>
      </div>

      <ProfileRestrictionPanel initialProfile={profile} />
    </main>
  );
}
