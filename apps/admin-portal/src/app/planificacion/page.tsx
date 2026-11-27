import React from 'react';
import Link from 'next/link';
import { ArrowLeft, ExternalLink, Compass, ShieldCheck, Database, FileSpreadsheet, Sparkles } from 'lucide-react';
import { createSupabaseServerClient } from '@intranet/auth/server';
import { redirect } from 'next/navigation';
import { getUserRbacContext, checkModuleAccess } from '@/lib/rbac';
import { ModuleBlockedScreen } from '@/components/ModuleBlockedScreen';

export const metadata = {
  title: 'JADE — Control, Planificación & Rendición | Nexus Intranet',
  description: 'Sistema Integral de Planificación de Actividades, Misiones Territoriales y Rendición de Cuentas (JADE)',
};

export default async function PlanificacionPortalPage() {
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
    redirect('/login?redirectTo=/planificacion');
  }

  const rbac = await getUserRbacContext(supabase, user);
  const access = checkModuleAccess('jade', rbac);
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
            <span className="text-xs font-bold tracking-wider text-emerald-400 font-mono flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5" />
              JADE PLANIFICACIÓN & MISIONES
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-950 text-emerald-400 border border-emerald-800/60">
              ● SSO Activo ({userEmail})
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-3 text-xs text-slate-400">
          <a
            href="https://script.google.com/u/0/home/projects/1d8B9XsTjCS3RK5qQVZaZ7sFN2ML0GNRWlATI-J3H1YrnOdXN8BmFBR0Q/edit"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold text-emerald-300 bg-emerald-950/80 border border-emerald-800/80 hover:bg-emerald-900/60 transition-all shadow-sm"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Editor GAS JADE</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </header>

      {/* JADE Main Workspace & Information */}
      <main className="flex-1 w-full h-full relative overflow-y-auto p-6 flex flex-col items-center justify-center">
        <div className="max-w-2xl w-full p-8 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-2xl space-y-6 text-center">
          <div className="h-16 w-16 mx-auto rounded-3xl bg-gradient-to-tr from-emerald-600 via-teal-600 to-cyan-500 flex items-center justify-center text-white shadow-xl shadow-emerald-900/40">
            <Compass className="h-8 w-8" />
          </div>

          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-800 text-emerald-400 text-xs font-mono font-bold">
              ● 22 ARCHIVOS FUENTE CLONADOS EN LOCAL
            </div>
            <h2 className="text-2xl font-black text-white tracking-tight">
              JADE — Sistema de Control y Planificación
            </h2>
            <p className="text-sm text-slate-400 max-w-lg mx-auto">
              Módulo de Misiones Territoriales, Classroom, Rendición de Cuentas, Actividades Comunales y Monitor General.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left pt-2">
            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-white">
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                <span>Base de Datos Excel</span>
              </div>
              <p className="text-[11px] text-slate-400">
                16 hojas de cálculo enlazadas: Actividades, Chats, Misiones, MisionesProgreso, Desglose Municipal y Auditoría.
              </p>
              <span className="text-[10px] font-mono text-emerald-400 block pt-1">
                JADE_BD_Sistema_Planificacion.xlsx
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-white">
                <Database className="w-4 h-4 text-teal-400" />
                <span>Google Apps Script</span>
              </div>
              <p className="text-[11px] text-slate-400">
                ID del Script: <code>1d8B9XsTjCS3RK5...</code> clonado con clasp en <code>JADE/gas_src/</code>.
              </p>
              <span className="text-[10px] font-mono text-teal-400 block pt-1">
                Sincronización Clasp Activa
              </span>
            </div>
          </div>

          <div className="pt-4 flex flex-wrap items-center justify-center gap-3">
            <a
              href="https://script.google.com/u/0/home/projects/1d8B9XsTjCS3RK5qQVZaZ7sFN2ML0GNRWlATI-J3H1YrnOdXN8BmFBR0Q/edit"
              target="_blank"
              rel="noopener noreferrer"
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-900/30 flex items-center gap-2 transition-all"
            >
              <span>Abrir Sistema JADE en Google Apps Script</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>

            <Link
              href="/"
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-all"
            >
              Volver al Lobby Nexus
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
