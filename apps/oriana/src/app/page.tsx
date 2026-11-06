'use client';

import { useState, useEffect } from 'react';
import type { Database } from '@intranet/database';

type OrianaReport  = Database['public']['Tables']['oriana_reports']['Row'];
type OrianaMetrics = Database['public']['Tables']['oriana_metrics']['Row'];

interface DashboardData {
  reports: OrianaReport[];
  pendingCount: number;
  approvedCount: number;
  avgAccuracy: number;
}

export default function OrianaPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/oriana/dashboard')
      .then((r) => r.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 p-6">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-50">Módulo Oriana</h1>
            <p className="text-slate-400 text-sm">Análisis de datos y reportes ejecutivos</p>
          </div>
          <a
            href="/oriana/submit"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors"
          >
            + Nuevo Reporte
          </a>
        </div>

        {/* Métricas resumen */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Reportes Totales', value: data?.reports.length ?? 0,  color: 'text-blue-400'    },
            { label: 'Pendientes',       value: data?.pendingCount ?? 0,     color: 'text-amber-400'   },
            { label: 'Aprobados',        value: data?.approvedCount ?? 0,    color: 'text-emerald-400' },
            { label: 'Precisión Prom.', value: `${data?.avgAccuracy ?? 0}%`, color: 'text-purple-400'  },
          ].map((m) => (
            <div key={m.label} className="bg-slate-900 rounded-xl p-4 border border-slate-800">
              <p className="text-slate-400 text-xs mb-1">{m.label}</p>
              <p className={`text-2xl font-bold ${m.color}`}>{m.value}</p>
            </div>
          ))}
        </div>

        {/* Lista de reportes */}
        <div className="bg-slate-900 rounded-xl border border-slate-800">
          <div className="p-4 border-b border-slate-800">
            <h2 className="text-slate-200 font-semibold">Reportes Recientes</h2>
          </div>
          <div className="divide-y divide-slate-800">
            {data?.reports.length === 0 && (
              <p className="p-6 text-slate-500 text-center text-sm">No hay reportes disponibles.</p>
            )}
            {data?.reports.map((report) => (
              <div key={report.id} className="p-4 flex items-center justify-between hover:bg-slate-800/50 transition-colors">
                <div>
                  <p className="text-slate-200 font-medium text-sm">{report.report_title}</p>
                  <p className="text-slate-500 text-xs mt-0.5">
                    Lote: {report.batch_reference} · {report.total_records} registros
                  </p>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  report.status === 'approved'       ? 'bg-emerald-500/20 text-emerald-400' :
                  report.status === 'review_pending' ? 'bg-amber-500/20 text-amber-400'    :
                  report.status === 'rejected'       ? 'bg-red-500/20 text-red-400'        :
                  'bg-slate-500/20 text-slate-400'
                }`}>
                  {report.status === 'approved'       ? 'Aprobado'          :
                   report.status === 'review_pending' ? 'En Revisión'       :
                   report.status === 'rejected'       ? 'Rechazado'         :
                   'Borrador'}
                </span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </main>
  );
}

