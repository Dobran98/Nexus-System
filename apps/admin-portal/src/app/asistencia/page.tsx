import React from 'react';
import Link from 'next/link';
import { ArrowLeft, ExternalLink, QrCode, UserCheck } from 'lucide-react';
import { createSupabaseServerClient } from '@intranet/auth/server';
import { redirect } from 'next/navigation';

export const metadata = {
  title: 'ASYS — Control y Registro de Asistencia | Nexus Intranet',
  description: 'Sistema Integral de Asistencia, Seguridad Institucional y Guardias (ASIS / ASYS)',
};

export default async function AsistenciaPortalPage() {
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
    redirect('/login?redirectTo=/asistencia');
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
              <QrCode className="w-3.5 h-3.5" />
              ASYS ASISTENCIA & SEGURIDAD
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-950 text-emerald-400 border border-emerald-800/60">
              ● SSO Activo ({userEmail})
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-3 text-xs text-slate-400">
          <Link
            href="/profile"
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold text-teal-300 bg-teal-950/80 border border-teal-800/80 hover:bg-teal-900/60 transition-all shadow-sm"
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>Mi Perfil & Cooldown (7d)</span>
          </Link>
          <a
            href="/asys/index.html"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:inline-flex items-center gap-1 text-slate-400 hover:text-emerald-300 transition-colors"
          >
            <span>Ventana completa</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </header>

      {/* Asys Core SPA Frame */}
      <main className="flex-1 w-full h-full relative">
        <iframe
          src="/asys/index.html"
          title="ASYS Sistema de Control de Asistencia y Seguridad Institucional"
          className="w-full h-full border-0 absolute inset-0 bg-[#f8f9fc]"
          allow="geolocation; camera"
        />
      </main>
    </div>
  );
}
