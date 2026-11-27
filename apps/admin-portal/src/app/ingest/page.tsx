import React from 'react';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@intranet/auth/server';
import { BulkDataIngestor } from '@/components/BulkDataIngestor';
import { getUserRbacContext, checkModuleAccess } from '@/lib/rbac';
import { ModuleBlockedScreen } from '@/components/ModuleBlockedScreen';

export const metadata = {
  title: 'Ingesta Masiva de Campañas — Nexus Admin Portal',
  description: 'Módulo de carga y particionamiento de bases de datos de telefonía y contactos',
};

export default async function IngestPage() {
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
    redirect('/login?redirectTo=/ingest');
  }

  const rbac = await getUserRbacContext(supabase, user);
  if (!rbac.isSuperAdmin && !rbac.isFundadorDev) {
    redirect('/unauthorized');
  }

  const access = checkModuleAccess('ingest', rbac);
  if (!access.allowed && access.flag) {
    return (
      <ModuleBlockedScreen
        moduleName={access.flag.name}
        status={access.flag.status}
        message={access.flag.maintenance_message}
      />
    );
  }

  const defaultCampaignId = 'c1b2a3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d';

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8">
      <div className="max-w-5xl mx-auto mb-6">
        <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
          Procesador de Ingesta Masiva y Deduplicación
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Carga por lotes (streaming chunking) con validación sintáctica de prefijos y detección de duplicados
        </p>
      </div>

      <BulkDataIngestor
        campaignId={defaultCampaignId}
        operatorId={user.id}
      />
    </main>
  );
}
