import React from 'react';
import Link from 'next/link';
import { ArrowLeft, ExternalLink, PhoneCall } from 'lucide-react';
import { createSupabaseServerClient } from '@intranet/auth/server';

export const metadata = {
  title: 'BRIANA — Telefonía Celular & Contact Center | Nexus Intranet',
  description: 'Sistema de Gestión de Campañas Telefónicas sin PBX, Discador Guiado y Mesa de Incidencias',
};

export default async function LlamadasPortalPage() {
  let user: any = null;
  try {
    const supabase = createSupabaseServerClient();
    const { data } = await supabase.auth.getUser();
    user = data?.user;
  } catch (e) {
    // Sesión opcional
  }

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
            <span className="text-xs font-bold tracking-wider text-sky-400 font-mono flex items-center gap-1.5">
              <PhoneCall className="w-3.5 h-3.5" />
              BRIANA CONTACT CENTER
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-sky-950 text-sky-400 border border-sky-800/60">
              ● Operativo
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-3 text-xs text-slate-400">
          <a
            href="/briana/index.html"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:inline-flex items-center gap-1 text-slate-400 hover:text-sky-300 transition-colors"
          >
            <span>Abrir en ventana completa</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </header>

      {/* Briana Core SPA Frame */}
      <main className="flex-1 w-full h-full relative">
        <iframe
          src="/briana/index.html"
          title="BRIANA Sistema de Telefonía Celular y Contact Center"
          className="w-full h-full border-0 absolute inset-0 bg-[#f8fafc]"
          allow="microphone; camera; clipboard-write"
        />
      </main>
    </div>
  );
}
