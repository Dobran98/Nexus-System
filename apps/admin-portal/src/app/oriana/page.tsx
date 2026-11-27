import React from 'react';
import Link from 'next/link';
import { ArrowLeft, ExternalLink, LineChart } from 'lucide-react';
import { createSupabaseServerClient } from '@intranet/auth/server';
import { redirect } from 'next/navigation';
import { getUserRbacContext, checkModuleAccess } from '@/lib/rbac';
import { ModuleBlockedScreen } from '@/components/ModuleBlockedScreen';
import { ModuleManualButton } from '@/components/ModuleManualButton';

export const metadata = {
  title: 'ORIANA — Command Center | Nexus Intranet',
  description: 'Sistema de Gestión Operativa, Reportes y Auditoría Oriana',
};

export default async function OrianaPortalPage() {
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
    redirect('/login?redirectTo=/oriana');
  }

  const rbac = await getUserRbacContext(supabase, user);
  const access = checkModuleAccess('oriana', rbac);
  if (!access.allowed && access.flag) {
    return (
      <ModuleBlockedScreen
        moduleName={access.flag.name}
        status={access.flag.status}
        message={access.flag.maintenance_message}
      />
    );
  }

  const userEmail = user.email || 'Usuario';

  return (
    <div className="relative w-full h-screen bg-slate-950 flex flex-col overflow-hidden">
      {/* Barra superior de integración Nexus */}
      <header className="h-12 w-full bg-slate-950/90 border-b border-slate-800/80 backdrop-blur-md px-4 flex items-center justify-between z-50 shrink-0">
        <div className="flex items-center space-x-3">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-300 bg-slate-900 border border-slate-700/80 hover:bg-slate-800 hover:text-white transition-all shadow-sm"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Panel Maestro Nexus</span>
          </Link>
          <span className="text-slate-700">|</span>
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold tracking-wider text-blue-400 font-mono flex items-center gap-1.5">
              <LineChart className="w-3.5 h-3.5" />
              ORIANA COMMAND CENTER
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-indigo-950 text-indigo-300 border border-indigo-800/60">
              ● SSO Activo ({userEmail})
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-3 text-xs text-slate-400">
          <ModuleManualButton initialModuleId="oriana" />
          <a
            href="/oriana/index.html"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:inline-flex items-center gap-1 text-slate-400 hover:text-blue-300 transition-colors"
          >
            <span>Abrir en ventana completa</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </header>

      {/* Oriana Core SPA Frame */}
      <main className="flex-1 w-full h-full relative">
        <iframe
          src="/oriana/index.html"
          title="ORIANA Sistema de Gestión Operativa"
          className="w-full h-full border-0 absolute inset-0 bg-[#060a12]"
          allow="geolocation; microphone; camera"
        />
      </main>
    </div>
  );
}
