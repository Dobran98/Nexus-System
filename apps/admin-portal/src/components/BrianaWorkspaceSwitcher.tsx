'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ExternalLink, PhoneCall, Smartphone, Globe, BarChart3 } from 'lucide-react';
import { BrianaRemoteDialerPanel } from '@/components/BrianaRemoteDialerPanel';
import { BrianaAdminDashboard } from '@/components/BrianaAdminDashboard';

interface BrianaWorkspaceSwitcherProps {
  userEmail: string;
  canViewAdminDashboard?: boolean;
}

export function BrianaWorkspaceSwitcher({ userEmail, canViewAdminDashboard = false }: BrianaWorkspaceSwitcherProps) {
  const [mode, setMode] = useState<'remote_sim' | 'admin_dashboard' | 'classic_spa'>('remote_sim');

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
            <span className="hidden lg:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-sky-950 text-sky-300 border border-sky-800/60">
              ● SSO Activo ({userEmail})
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-2 text-xs">
          {/* Selector de Modo */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-0.5">
            <button
              onClick={() => setMode('remote_sim')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                mode === 'remote_sim'
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Marcador SIM</span>
            </button>

            {canViewAdminDashboard && (
              <button
                onClick={() => setMode('admin_dashboard')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  mode === 'admin_dashboard'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Dashboard Admin</span>
              </button>
            )}

            <button
              onClick={() => setMode('classic_spa')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                mode === 'classic_spa'
                  ? 'bg-slate-700 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Briana Clásico</span>
            </button>
          </div>

          <a
            href="/briana/index.html"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden xl:inline-flex items-center gap-1 text-slate-400 hover:text-sky-300 transition-colors pl-2"
          >
            <span>Ventana completa</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </header>

      {/* Área de Trabajo */}
      {mode === 'remote_sim' ? (
        <BrianaRemoteDialerPanel />
      ) : mode === 'admin_dashboard' && canViewAdminDashboard ? (
        <BrianaAdminDashboard />
      ) : (
        <main className="flex-1 w-full h-full relative bg-slate-950">
          <iframe
            src="/briana/index.html"
            title="BRIANA Sistema de Telefonía Celular y Contact Center"
            className="w-full h-full border-0 absolute inset-0 bg-slate-950"
            allow="microphone; camera; clipboard-write"
          />
        </main>
      )}
    </div>
  );
}
