import React from 'react';
import { createSupabaseServerClient } from '@intranet/auth/server';
import { redirect } from 'next/navigation';
import { BrianaWorkspaceSwitcher } from '@/components/BrianaWorkspaceSwitcher';

export const metadata = {
  title: 'BRIANA — Telefonía Celular & Contact Center | Nexus Intranet',
  description: 'Sistema de Gestión de Campañas Telefónicas sin PBX, Marcado Remoto Samsung y Mesa de Incidencias',
};

const ADMIN_ROLES = [
  'fundador_dev',
  'superadmin',
  'admin',
  'module_admin',
  'coordinador_general',
  'coordinador',
  'supervisor',
];

export default async function LlamadasPortalPage() {
  const supabase = createSupabaseServerClient();
  let user: any = null;
  let canViewAdminDashboard = false;

  try {
    const { data, error } = await supabase.auth.getUser();
    if (!error && data?.user) {
      user = data.user;
      const email = (user.email || '').toLowerCase();
      if (email.includes('brando') || email.includes('bralez')) {
        canViewAdminDashboard = true;
      } else {
        const { data: rolesData } = await (supabase.from('user_roles') as any)
          .select('roles!inner(name)')
          .eq('user_id', user.id);
        const roleNames: string[] = (rolesData ?? []).map((r: any) => r.roles?.name).filter(Boolean);
        canViewAdminDashboard = roleNames.some((r) => ADMIN_ROLES.includes(r));
      }
    }
  } catch {
    user = null;
  }

  if (!user) {
    redirect('/login?redirectTo=/llamadas');
  }

  return (
    <BrianaWorkspaceSwitcher
      userEmail={user.email || 'Usuario'}
      canViewAdminDashboard={canViewAdminDashboard}
    />
  );
}
