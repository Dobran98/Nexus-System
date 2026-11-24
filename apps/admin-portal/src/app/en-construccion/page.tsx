import React from 'react';
import Link from 'next/link';
import { Construction, ArrowLeft, QrCode } from 'lucide-react';

export default function EnConstruccionPage({
  searchParams,
}: {
  searchParams?: { modulo?: string };
}) {
  const moduloName = searchParams?.modulo || 'Este módulo';

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-6 bg-slate-900/90 border border-slate-800 rounded-3xl p-8 shadow-2xl">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
          <Construction className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase tracking-wide">
            Fase de Despliegue
          </span>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            {moduloName} en Construcción
          </h1>
          <p className="text-sm text-slate-400 leading-relaxed">
            Estamos implementando el sistema paso a paso. Actualmente estamos enfocados en la activación del escaneo y registro de asistencia.
          </p>
        </div>

        <div className="pt-4 flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Panel Principal
          </Link>

          <Link
            href="/asistencia"
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors shadow-lg shadow-blue-900/30"
          >
            <QrCode className="w-4 h-4" />
            Ir a Asistencia
          </Link>
        </div>
      </div>
    </main>
  );
}
