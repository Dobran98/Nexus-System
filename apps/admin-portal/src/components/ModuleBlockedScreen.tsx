import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Lock, Wrench } from 'lucide-react';

interface ModuleBlockedScreenProps {
  moduleName: string;
  status: 'testing' | 'maintenance' | string;
  message?: string;
}

export function ModuleBlockedScreen({ moduleName, status, message }: ModuleBlockedScreenProps) {
  const isTesting = status === 'testing';

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex items-center justify-center p-6">
      <div className="max-w-md w-full p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl text-center space-y-5">
        <div
          className={`h-16 w-16 mx-auto rounded-2xl flex items-center justify-center border ${
            isTesting
              ? 'bg-amber-950/70 border-amber-700/60 text-amber-400'
              : 'bg-rose-950/70 border-rose-700/60 text-rose-400'
          }`}
        >
          {isTesting ? <Lock className="w-8 h-8" /> : <Wrench className="w-8 h-8" />}
        </div>

        <div className="space-y-2">
          <span
            className={`inline-flex items-center px-3 py-1 rounded-full text-[11px] font-mono font-bold uppercase border ${
              isTesting
                ? 'bg-amber-950/80 text-amber-300 border-amber-800'
                : 'bg-rose-950/80 text-rose-300 border-rose-800'
            }`}
          >
            {isTesting ? '● En Fase de Pruebas Internas' : '● Mantenimiento Programado'}
          </span>
          <h1 className="text-xl font-extrabold text-white tracking-tight">{moduleName}</h1>
          <p className="text-xs text-slate-400 leading-relaxed">
            {message ||
              (isTesting
                ? 'Este módulo se encuentra actualmente restringido al equipo de desarrollo para validaciones previas a su liberación pública.'
                : 'Este módulo se encuentra en mantenimiento temporal. Intente nuevamente en unos minutos.')}
          </p>
        </div>

        <Link
          href="/"
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Volver al Lobby Nexus</span>
        </Link>
      </div>
    </div>
  );
}
