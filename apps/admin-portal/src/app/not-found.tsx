import React from 'react';
import Link from 'next/link';
import { ShieldAlert, ArrowLeft, Home, RefreshCw } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 selection:bg-blue-600/30">
      <div className="w-full max-w-md text-center space-y-6">
        {/* Icono de advertencia */}
        <div className="mx-auto w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shadow-lg shadow-amber-950/30">
          <ShieldAlert className="w-8 h-8" />
        </div>

        {/* Mensaje de ruta */}
        <div className="space-y-2">
          <span className="text-xs font-mono font-semibold uppercase tracking-wider text-amber-400 bg-amber-950/60 px-3 py-1 rounded-full border border-amber-800/40">
            Código 404 — Ruta No Localizada
          </span>
          <h1 className="text-3xl font-extrabold text-white tracking-tight mt-3">
            Página No Encontrada
          </h1>
          <p className="text-sm text-slate-400 leading-relaxed">
            La dirección solicitada no existe o ha sido reubicada dentro del sistema Nexus.
          </p>
        </div>

        {/* Acciones de recuperación */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Link
            href="/"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm shadow-lg shadow-blue-950/50 transition-all"
          >
            <Home className="w-4 h-4" />
            <span>Panel Maestro</span>
          </Link>

          <Link
            href="/asistencia"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-850 text-slate-300 hover:text-white font-medium text-sm transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Asistencia</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
