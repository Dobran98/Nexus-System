import React from 'react';
import { createSupabaseServerClient } from '@intranet/auth/server';
import { redirect } from 'next/navigation';
import { BrianaWorkspaceSwitcher } from '@/components/BrianaWorkspaceSwitcher';
import { getUserRbacContext, checkModuleAccess } from '@/lib/rbac';
import { ModuleBlockedScreen } from '@/components/ModuleBlockedScreen';

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

  const rbac = await getUserRbacContext(supabase, user);
  const access = checkModuleAccess('briana', rbac);
  if (!access.allowed && access.flag) {
    return (
      <ModuleBlockedScreen
        moduleName={access.flag.name}
        status={access.flag.status}
        message={access.flag.maintenance_message}
      />
    );
  }

  return (
    <BrianaWorkspaceSwitcher
      userEmail={user.email || 'Usuario'}
      canViewAdminDashboard={rbac.isSupervisorOrAbove}
    />
  );
}
