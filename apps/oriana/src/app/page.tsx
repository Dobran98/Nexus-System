'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
// Iconos SVG en línea (para compatibilidad total sin dependencias externas)
function LineChartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" />
    </svg>
  );
}

function FileTextIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function AlertTriangleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
    </svg>
  );
}

function RefreshCwIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );
}

function SparklesIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
  );
}

function ShieldCheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

interface OrianaReport {
  id: string;
  report_title: string;
  batch_reference: string;
  status: 'draft' | 'review_pending' | 'approved' | 'rejected';
  analyst_name: string;
  total_records: number;
  processed_records: number;
  progress_pct: number;
  validation_accuracy: number | string;
  discrepancy_count: number;
  processing_time_minutes: number;
  submission_deadline: string;
  deadline_state: 'CUMPLIDO' | 'VENCIDO' | 'EN_RIESGO' | 'EN_TIEMPO';
  created_at: string;
  reviewed_at: string | null;
}

interface DashboardMetrics {
  totalReports: number;
  approvedCount: number;
  pendingCount: number;
  draftCount: number;
  rejectedCount: number;
  totalRecords: number;
  totalProcessed: number;
  totalDiscrepancies: number;
  avgAccuracy: string;
}

export default function OrianaDashboardStandalonePage() {
  const [reports, setReports] = useState<OrianaReport[]>([]);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Formulario nuevo reporte
  const [newTitle, setNewTitle] = useState('');
  const [newBatch, setNewBatch] = useState('');
  const [newTotal, setNewTotal] = useState('1000');
  const [newProcessed, setNewProcessed] = useState('1000');
  const [newDiscrepancies, setNewDiscrepancies] = useState('2');
  const [newTimeMins, setNewTimeMins] = useState('60');
  const [newDeadlineHours, setNewDeadlineHours] = useState('24');

  // Cargar datos del dashboard
  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/oriana/dashboard');
      if (res.ok) {
        const data = await res.json();
        setReports(data.reports || []);
        setMetrics(data.metrics || null);
      }
    } catch (err) {
      console.error('Error cargando Oriana dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const showToast = (text: string, type: 'success' | 'error') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Filtrado de reportes
  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      const matchesStatus = filterStatus === 'all' || r.status === filterStatus;
      const matchesSearch =
        searchTerm === '' ||
        r.report_title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.batch_reference.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.analyst_name && r.analyst_name.toLowerCase().includes(searchTerm.toLowerCase()));
      return matchesStatus && matchesSearch;
    });
  }, [reports, filterStatus, searchTerm]);

  // Manejador de Aprobación / Rechazo
  const handleUpdateStatus = async (id: string, newStatus: 'approved' | 'rejected') => {
    setActionLoading(id);
    try {
      const res = await fetch('/api/oriana/dashboard', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          status: newStatus,
          reviewer_notes: newStatus === 'approved' ? 'Validado y aprobado por supervisor en el panel.' : 'Devuelto a corrección.',
        }),
      });

      if (!res.ok) throw new Error('Error al actualizar reporte');

      showToast(`Reporte ${newStatus === 'approved' ? 'Aprobado' : 'Rechazado'} exitosamente`, 'success');
      fetchDashboardData();
    } catch (err: any) {
      showToast(err.message || 'Error en la operación', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // Crear nuevo reporte
  const handleCreateReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle || !newBatch) return;

    setActionLoading('creating');
    try {
      const totalNum = parseInt(newTotal, 10) || 100;
      const procNum = parseInt(newProcessed, 10) || totalNum;
      const discNum = parseInt(newDiscrepancies, 10) || 0;
      const calcAccuracy = Math.max(0, Math.min(100, 100 - (discNum / totalNum) * 100)).toFixed(2);

      const deadline = new Date();
      deadline.setHours(deadline.getHours() + parseInt(newDeadlineHours, 10));

      const res = await fetch('/api/oriana/dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          report_title: newTitle,
          batch_reference: newBatch,
          total_records: totalNum,
          processed_records: procNum,
          discrepancy_count: discNum,
          processing_time_minutes: parseInt(newTimeMins, 10) || 60,
          validation_accuracy: calcAccuracy,
          submission_deadline: deadline.toISOString(),
        }),
      });

      if (!res.ok) throw new Error('Error al crear el reporte');

      showToast('Reporte analítico creado con éxito', 'success');
      setShowCreateModal(false);
      setNewTitle('');
      setNewBatch('');
      fetchDashboardData();
    } catch (err: any) {
      showToast(err.message || 'Error al crear', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* ── 1. NAVBAR DE ORIANA ────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 w-full border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <a
              href="/"
              className="inline-flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-white transition-colors py-1.5 px-3 rounded-lg bg-slate-900 border border-slate-800"
            >
              ← Volver al Panel
            </a>
            <span className="text-slate-700">|</span>
            <div className="flex items-center space-x-2">
              <div className="h-8 w-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                <LineChartIcon className="h-4 w-4" />
              </div>
              <span className="text-base font-bold text-white tracking-tight">
                Módulo Oriana
              </span>
              <span className="text-xs text-slate-400 hidden sm:inline">
                Auditoría y Control Analítico
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => fetchDashboardData()}
              title="Refrescar datos"
              className="p-2 text-slate-400 hover:text-slate-200 bg-slate-900 border border-slate-800 rounded-lg transition-colors"
            >
              <RefreshCwIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-blue-950/50 transition-all hover:scale-105"
            >
              <PlusIcon className="h-4 w-4" />
              <span>Nuevo Reporte</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── 2. CONTENIDO PRINCIPAL ─────────────────────────────────────── */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

        {/* Banner de Bienvenida y Estado SLA */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-slate-900/90 to-blue-950/40 border border-slate-800/80 p-6 sm:p-8 shadow-xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-950/80 text-blue-300 border border-blue-800/60">
                <SparklesIcon className="h-3 w-3" />
                <span>Command Center Operativo</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Centro de Auditoría Analítica de Datos
              </h1>
              <p className="text-xs sm:text-sm text-slate-400">
                Monitoreo continuo de consistencia territorial, precisión porcentual de lotes y cumplimiento de SLAs.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Objetivo SLA</p>
                <p className="text-sm font-bold text-emerald-400">≥ 98.5% Calidad</p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-emerald-950/80 border border-emerald-800/60 flex items-center justify-center text-emerald-400">
                <ShieldCheckIcon className="h-5 w-5" />
              </div>
            </div>
          </div>
        </div>

        {/* ── 3. KPI CARDS RESUMEN ───────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">

          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm space-y-2">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Reportes Totales</span>
              <FileTextIcon className="h-4 w-4 text-blue-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-white">
              {metrics?.totalReports ?? 0}
            </div>
            <p className="text-[11px] text-slate-500">
              {metrics?.totalProcessed.toLocaleString() ?? 0} registros validados
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm space-y-2">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Precisión Prom.</span>
              <LineChartIcon className="h-4 w-4 text-purple-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-purple-400">
              {metrics?.avgAccuracy ?? '0.00'}%
            </div>
            <p className="text-[11px] text-emerald-400 font-medium">
              ● Dentro del SLA objetivo
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm space-y-2">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-semibold uppercase tracking-wider">En Revisión</span>
              <ClockIcon className="h-4 w-4 text-amber-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-amber-400">
              {metrics?.pendingCount ?? 0}
            </div>
            <p className="text-[11px] text-slate-500">
              Requieren visto bueno
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm space-y-2">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Aprobados</span>
              <CheckCircleIcon className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-emerald-400">
              {metrics?.approvedCount ?? 0}
            </div>
            <p className="text-[11px] text-slate-500">
              Certificados con hash
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm space-y-2 col-span-2 lg:col-span-1">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Discrepancias</span>
              <AlertTriangleIcon className="h-4 w-4 text-rose-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-rose-400">
              {metrics?.totalDiscrepancies ?? 0}
            </div>
            <p className="text-[11px] text-slate-500">
              Anomalías registradas
            </p>
          </div>

        </div>

        {/* ── 4. TABLA DE REPORTES Y CONTROLES ───────────────────────── */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl space-y-4 p-5 sm:p-6">

          {/* Controles de Filtros y Búsqueda */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">

            {/* Pestañas de estado */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-950/70 border border-slate-800 rounded-xl w-full md:w-auto overflow-x-auto">
              {[
                { id: 'all', label: 'Todos' },
                { id: 'review_pending', label: 'En Revisión' },
                { id: 'approved', label: 'Aprobados' },
                { id: 'draft', label: 'Borradores' },
                { id: 'rejected', label: 'Rechazados' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setFilterStatus(tab.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filterStatus === tab.id
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                    }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Input de búsqueda */}
            <div className="relative w-full md:w-72">
              <SearchIcon className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
              <input
                type="text"
                placeholder="Buscar lote, título o analista..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              />
            </div>
          </div>

          {/* Tabla de Resultados */}
          <div className="overflow-x-auto rounded-2xl border border-slate-800/80">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Lote & Título</th>
                  <th className="py-3 px-4">Analista</th>
                  <th className="py-3 px-4">Progreso</th>
                  <th className="py-3 px-4">Precisión</th>
                  <th className="py-3 px-4">Discrepancias</th>
                  <th className="py-3 px-4">Plazo SLA</th>
                  <th className="py-3 px-4">Estado</th>
                  <th className="py-3 px-4 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredReports.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-500">
                      No se encontraron reportes con los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  filteredReports.map((rep) => {
                    const accNum = typeof rep.validation_accuracy === 'number'
                      ? rep.validation_accuracy
                      : parseFloat(rep.validation_accuracy || '0');

                    return (
                      <tr key={rep.id} className="hover:bg-slate-800/30 transition-colors">

                        {/* Lote & Título */}
                        <td className="py-3.5 px-4">
                          <p className="font-bold text-white text-sm">{rep.report_title}</p>
                          <p className="text-[11px] font-mono text-blue-400 mt-0.5">{rep.batch_reference}</p>
                        </td>

                        {/* Analista */}
                        <td className="py-3.5 px-4 font-medium text-slate-300">
                          {rep.analyst_name || 'Sin asignar'}
                        </td>

                        {/* Progreso */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-slate-200">{rep.progress_pct}%</span>
                          </div>
                          <div className="w-24 bg-slate-800 rounded-full h-1.5 mt-1 overflow-hidden">
                            <div
                              className="bg-blue-500 h-1.5 rounded-full"
                              style={{ width: `${Math.min(100, rep.progress_pct)}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-slate-500">
                            {rep.processed_records} / {rep.total_records}
                          </span>
                        </td>

                        {/* Precisión */}
                        <td className="py-3.5 px-4">
                          <span className={`font-mono font-bold ${accNum >= 98.5 ? 'text-emerald-400' : 'text-amber-400'
                            }`}>
                            {accNum.toFixed(2)}%
                          </span>
                        </td>

                        {/* Discrepancias */}
                        <td className="py-3.5 px-4 font-mono">
                          {rep.discrepancy_count > 0 ? (
                            <span className="text-rose-400 font-semibold">{rep.discrepancy_count} err</span>
                          ) : (
                            <span className="text-emerald-400">0</span>
                          )}
                        </td>

                        {/* Plazo SLA */}
                        <td className="py-3.5 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${rep.deadline_state === 'CUMPLIDO' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' :
                            rep.deadline_state === 'EN_TIEMPO' ? 'bg-blue-950 text-blue-400 border border-blue-800' :
                              rep.deadline_state === 'EN_RIESGO' ? 'bg-amber-950 text-amber-400 border border-amber-800' :
                                'bg-rose-950 text-rose-400 border border-rose-800'
                            }`}>
                            {rep.deadline_state}
                          </span>
                        </td>

                        {/* Estado */}
                        <td className="py-3.5 px-4">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${rep.status === 'approved' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' :
                            rep.status === 'review_pending' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' :
                              rep.status === 'rejected' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40' :
                                'bg-slate-700/40 text-slate-400 border border-slate-700'
                            }`}>
                            {rep.status === 'approved' ? '● Aprobado' :
                              rep.status === 'review_pending' ? '⏳ En Revisión' :
                                rep.status === 'rejected' ? '✖ Rechazado' :
                                  'Borrador'}
                          </span>
                        </td>

                        {/* Acciones */}
                        <td className="py-3.5 px-4 text-right">
                          {rep.status === 'review_pending' && (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleUpdateStatus(rep.id, 'approved')}
                                disabled={actionLoading === rep.id}
                                title="Aprobar Reporte"
                                className="p-1.5 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white rounded-lg transition-colors border border-emerald-500/30"
                              >
                                <CheckIcon className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => handleUpdateStatus(rep.id, 'rejected')}
                                disabled={actionLoading === rep.id}
                                title="Rechazar Reporte"
                                className="p-1.5 bg-rose-600/20 hover:bg-rose-600 text-rose-400 hover:text-white rounded-lg transition-colors border border-rose-500/30"
                              >
                                <XIcon className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}
                          {rep.status === 'approved' && (
                            <span className="text-[11px] text-slate-500 font-medium">✓ Certificado</span>
                          )}
                        </td>

                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

        </div>

      </main>

      {/* ── 5. MODAL DE CREACIÓN DE REPORTE ────────────────────────────── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-lg w-full space-y-5 shadow-2xl">

            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-white tracking-tight">Crear Nuevo Reporte Oriana</h3>
                <p className="text-xs text-slate-400">Ingreso estructurado de auditoría de lote analítico</p>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateReport} className="space-y-4">

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Título del Reporte
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Validación Comunal Lote 10 — Cabudare Este"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Código de Lote
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="LOT-2026-V8-010"
                    value={newBatch}
                    onChange={(e) => setNewBatch(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Plazo de Entrega (Horas)
                  </label>
                  <select
                    value={newDeadlineHours}
                    onChange={(e) => setNewDeadlineHours(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="12">12 Horas</option>
                    <option value="24">24 Horas</option>
                    <option value="48">48 Horas</option>
                    <option value="72">72 Horas</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Total Registros
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={newTotal}
                    onChange={(e) => setNewTotal(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Procesados
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={newProcessed}
                    onChange={(e) => setNewProcessed(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Discrepancias
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={newDiscrepancies}
                    onChange={(e) => setNewDiscrepancies(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Tiempo de Auditoría (Minutos)
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={newTimeMins}
                  onChange={(e) => setNewTimeMins(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actionLoading === 'creating'}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-blue-900/40 transition-colors flex items-center gap-2"
                >
                  {actionLoading === 'creating' ? 'Guardando...' : 'Crear y Enviar a Revisión'}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* ── 6. TOAST NOTIFICACIÓN ────────────────────────────────────────── */}
      {toastMessage && (
        <div className={`fixed bottom-6 right-6 z-50 p-4 rounded-2xl text-xs font-bold border shadow-2xl flex items-center gap-2 animate-in slide-in-from-bottom ${toastMessage.type === 'success'
          ? 'bg-emerald-950 border-emerald-700 text-emerald-300'
          : 'bg-rose-950 border-rose-700 text-rose-300'
          }`}>
          {toastMessage.type === 'success' ? <CheckIcon className="h-4 w-4" /> : <AlertTriangleIcon className="h-4 w-4" />}
          <span>{toastMessage.text}</span>
        </div>
      )}

    </div>
  );
}
