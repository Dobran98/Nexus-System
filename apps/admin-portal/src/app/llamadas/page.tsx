import React from 'react';
import { createSupabaseServerClient } from '@intranet/auth/server';
import { redirect } from 'next/navigation';
import { BrianaWorkspaceSwitcher } from '@/components/BrianaWorkspaceSwitcher';

export const metadata = {
  title: 'BRIANA — Telefonía Celular & Contact Center | Nexus Intranet',
  description: 'Sistema de Gestión de Campañas Telefónicas sin PBX, Marcado Remoto Samsung y Mesa de Incidencias',
};

export default async function LlamadasPortalPage() {
  const supabase = createSupabaseServerClient();
  let user: any = null;

  try {
    const { data, error } = await supabase.auth.getUser();
    if (!error && data?.user) {
      user = data.user;
    }
  } catch {
    user = null;
  }

  if (!user) {
    redirect('/login?redirectTo=/llamadas');
  }

  return <BrianaWorkspaceSwitcher userEmail={user.email || 'Usuario'} />;
}
