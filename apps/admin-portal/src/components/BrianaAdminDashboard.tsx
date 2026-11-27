'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createSupabaseBrowserClient } from '@intranet/auth/client';
import {
  BarChart3,
  Users,
  PhoneCall,
  CheckCircle2,
  XCircle,
  Clock,
  Smartphone,
  Battery,
  Wifi,
  CalendarClock,
  AlertOctagon,
  Search,
  RefreshCw,
  TrendingUp
} from 'lucide-react';

export function BrianaAdminDashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'traceability' | 'schedules'>('overview');
  const [filterType, setFilterType] = useState<'all' | 'effective' | 'failed'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const loadDashboard = useCallback(async () => {
    try {
      const res = await fetch('/api/briana/admin-dashboard');
      const json = await res.json();
      if (res.ok && json.success) {
        setData(json);
      }
    } catch (err) {
      console.error('Error cargando dashboard Briana:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  // Suscripción en tiempo real a eventos de la flota y llamadas
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel('briana-admin-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'call_logs' }, () => loadDashboard())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contacts_queue' }, () => loadDashboard())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'call_schedules' }, () => loadDashboard())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'devices' }, () => loadDashboard())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadDashboard]);

  const filteredLogs = useMemo(() => {
    const logs = data?.recentLogs || [];
    return logs.filter((l: any) => {
      if (filterType === 'effective' && !l.is_effective) return false;
      if (filterType === 'failed' && l.is_effective) return false;

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const cName = String(l.contact?.full_name || '').toLowerCase();
        const cPhone = String(l.contact?.phone_number || '').toLowerCase();
        const opName = String(l.operator?.full_name || '').toLowerCase();
        const devModel = String(l.device?.model || '').toLowerCase();
        if (!cName.includes(q) && !cPhone.includes(q) && !opName.includes(q) && !devModel.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [data, filterType, searchTerm]);

  if (loading && !data) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-950 text-slate-400 text-xs font-mono">
        <RefreshCw className="w-4 h-4 animate-spin mr-2 text-sky-400" />
        Cargando analítica en tiempo real de Briana...
      </div>
    );
  }

  const summary = data?.summary || {
    totalContactos: 0,
    totalLlamados: 0,
    pendientes: 0,
    efectivos: 0,
    fallidos: 0,
    reprogramados: 0,
    invalidos: 0,
    pctEfectividad: 0,
  };

  const persistence = data?.persistence || { intento_1: 0, intento_2: 0, intento_3: 0, intento_4_mas: 0 };
  const totalPers = Math.max(1, persistence.intento_1 + persistence.intento_2 + persistence.intento_3 + persistence.intento_4_mas);

  const formatDuration = (sec: number) => {
    const m = Math.floor((sec || 0) / 60);
    const s = (sec || 0) % 60;
    return `${m}m ${String(s).padStart(2, '0')}s`;
  };

  return (
    <div className="flex-1 w-full bg-slate-950 text-slate-100 overflow-y-auto p-4 sm:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Cabecera & Pestañas */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono uppercase tracking-wider text-sky-400 font-bold">
                ● Telemetría en Vivo (Supabase Realtime)
              </span>
            </div>
            <h2 className="text-xl font-black text-white tracking-tight mt-0.5">
              Dashboard Ejecutivo & Auditoría de Llamadas SIM
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex bg-slate-900 border border-slate-800 rounded-xl p-1 text-xs font-bold">
              <button
                onClick={() => setActiveTab('overview')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  activeTab === 'overview' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Resumen & Flota
              </button>
              <button
                onClick={() => setActiveTab('traceability')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  activeTab === 'traceability' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Trazabilidad ({data?.recentLogs?.length || 0})
              </button>
              <button
                onClick={() => setActiveTab('schedules')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  activeTab === 'schedules' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Reprogramados & Inválidos ({summary.reprogramados + summary.invalidos})
              </button>
            </div>

            <button
              onClick={loadDashboard}
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white"
              title="Actualizar manualmente"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* KPIs Globales */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
            <span className="text-[10px] font-mono uppercase text-slate-400">Total Data</span>
            <div className="text-2xl font-black text-white mt-1">{summary.totalContactos}</div>
          </div>
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
            <span className="text-[10px] font-mono uppercase text-slate-400">Total Llamados</span>
            <div className="text-2xl font-black text-sky-400 mt-1">{summary.totalLlamados}</div>
          </div>
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
            <span className="text-[10px] font-mono uppercase text-slate-400">Pendientes</span>
            <div className="text-2xl font-black text-amber-300 mt-1">{summary.pendientes}</div>
          </div>
          <div className="p-4 rounded-2xl bg-slate-900 border border-emerald-900/60">
            <span className="text-[10px] font-mono uppercase text-emerald-400">Efectivas</span>
            <div className="text-2xl font-black text-emerald-400 mt-1">{summary.efectivos}</div>
          </div>
          <div className="p-4 rounded-2xl bg-slate-900 border border-rose-900/60">
            <span className="text-[10px] font-mono uppercase text-rose-400">Fallidas / No Efec.</span>
            <div className="text-2xl font-black text-rose-400 mt-1">{summary.fallidos}</div>
          </div>
          <div className="p-4 rounded-2xl bg-slate-900 border border-sky-800/60">
            <span className="text-[10px] font-mono uppercase text-sky-300">% Efectividad</span>
            <div className="text-2xl font-black text-white mt-1">{summary.pctEfectividad}%</div>
          </div>
        </div>

        {/* TAB 1: RESUMEN, PERSISTENCIA & FLOTA SAMSUNG */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Análisis de Persistencia */}
            <div className="lg:col-span-5 p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  <span>Análisis de Persistencia (Efectivos por Intento)</span>
                </h3>
              </div>

              <div className="space-y-4">
                {[
                  { label: 'Al 1er intento', value: persistence.intento_1, color: 'from-emerald-500 to-teal-500' },
                  { label: 'Al 2do intento', value: persistence.intento_2, color: 'from-sky-500 to-blue-500' },
                  { label: 'Al 3er intento', value: persistence.intento_3, color: 'from-amber-500 to-orange-500' },
                  { label: 'Al 4to+ intento', value: persistence.intento_4_mas, color: 'from-purple-500 to-pink-500' },
                ].map((item) => {
                  const pct = Math.round((item.value / totalPers) * 100);
                  return (
                    <div key={item.label} className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="font-semibold text-slate-300">{item.label}</span>
                        <span className="font-mono text-slate-400">
                          {item.value} contactos ({pct}%)
                        </span>
                      </div>
                      <div className="w-full h-2.5 rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className={`h-full bg-gradient-to-r ${item.color} rounded-full transition-all duration-500`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Flota Samsung A57 / A37 en Vivo */}
            <div className="lg:col-span-7 p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-sky-400" />
                <span>Flota Samsung Corporativa ({data?.fleet?.length || 0} Terminales)</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-80 overflow-y-auto">
                {(data?.fleet || []).length === 0 ? (
                  <p className="text-xs text-slate-500 col-span-2 py-8 text-center">
                    No hay teléfonos Samsung registrados aún. Abre la APK en un dispositivo para registrar su PIN.
                  </p>
                ) : (
                  (data?.fleet || []).map((dev: any) => (
                    <div
                      key={dev.id}
                      className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 flex flex-col justify-between gap-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white">{dev.model}</span>
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                            dev.active_operator
                              ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                              : 'bg-slate-800 text-slate-400 border-slate-700'
                          }`}
                        >
                          {dev.pairing_pin}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {dev.active_operator ? (
                          <span className="text-emerald-300 font-semibold">● En turno: {dev.active_operator}</span>
                        ) : (
                          <span>Disponible para vinculación</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-[10px] font-mono text-slate-500 pt-1 border-t border-slate-800/60">
                        <span className="flex items-center gap-1">
                          <Battery className="w-3 h-3 text-emerald-400" /> {dev.battery_pct ?? '--'}%
                        </span>
                        <span className="flex items-center gap-1">
                          <Wifi className="w-3 h-3 text-sky-400" /> {dev.network_type || '--'}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: TRAZABILIDAD DETALLADA POR CONTACTO E INTENTO */}
        {activeTab === 'traceability' && (
          <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {(['all', 'effective', 'failed'] as const).map((ft) => (
                  <button
                    key={ft}
                    onClick={() => setFilterType(ft)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                      filterType === ft
                        ? 'bg-sky-600 text-white border-sky-500'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    {ft === 'all' ? 'Todos' : ft === 'effective' ? 'Efectivos' : 'Fallidos / No Efectivos'}
                  </button>
                ))}
              </div>

              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar contacto, teléfono, operador..."
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-mono text-[10px] uppercase">
                    <th className="py-3 px-3">Contacto</th>
                    <th className="py-3 px-3">Operador</th>
                    <th className="py-3 px-3">Samsung</th>
                    <th className="py-3 px-3">Intento</th>
                    <th className="py-3 px-3">Duración Real</th>
                    <th className="py-3 px-3">Resultado</th>
                    <th className="py-3 px-3">Origen / Corte</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-slate-500">
                        Sin registros de llamadas que coincidan con el filtro.
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.map((l: any) => (
                      <tr key={l.id} className="hover:bg-slate-800/30">
                        <td className="py-3 px-3">
                          <div className="font-bold text-white">{l.contact?.full_name || 'Contacto'}</div>
                          <div className="font-mono text-[11px] text-sky-400">{l.contact?.phone_number}</div>
                        </td>
                        <td className="py-3 px-3 text-slate-300">{l.operator?.full_name || 'Operador'}</td>
                        <td className="py-3 px-3">
                          <span className="font-mono text-[11px] text-slate-300">
                            {l.device?.model || 'Samsung'} ({l.device?.pairing_pin || '--'})
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono text-amber-300">#{l.attempt_number}</td>
                        <td className="py-3 px-3 font-mono text-slate-200">{formatDuration(l.talk_duration_seconds)}</td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              l.is_effective
                                ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                                : 'bg-rose-950 text-rose-300 border-rose-800'
                            }`}
                          >
                            {l.outcome || (l.is_connected ? 'Pendiente cierre' : 'sin_respuesta')}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono text-[10px] text-slate-400">
                          <div>Inicio: {l.initiated_from}</div>
                          <div>Corte: {l.ended_by || '--'}</div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: REPROGRAMADOS E INVÁLIDOS */}
        {activeTab === 'schedules' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Reprogramados */}
            <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
              <h3 className="text-sm font-bold text-sky-400 flex items-center gap-2">
                <CalendarClock className="w-4 h-4" />
                <span>Llamadas Reprogramadas ({(data?.schedules || []).length})</span>
              </h3>
              <div className="space-y-2.5 max-h-96 overflow-y-auto">
                {(data?.schedules || []).length === 0 ? (
                  <p className="text-xs text-slate-500 py-8 text-center">No hay llamadas reprogramadas pendientes.</p>
                ) : (
                  (data?.schedules || []).map((s: any) => (
                    <div key={s.id} className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white">{s.contact?.full_name}</span>
                        <span className="font-mono text-sky-400">{s.contact?.phone_number}</span>
                      </div>
                      <div className="text-[11px] text-amber-300 font-mono">
                        Agenda: {new Date(s.scheduled_for).toLocaleString('es-VE')}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Operador: {s.operator?.full_name || 'Cola'} {s.notes ? `· "${s.notes}"` : ''}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Números Inválidos / No pertenece al titular */}
            <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
              <h3 className="text-sm font-bold text-rose-400 flex items-center gap-2">
                <AlertOctagon className="w-4 h-4" />
                <span>Números Inválidos / No Titular ({(data?.invalidContacts || []).length})</span>
              </h3>
              <div className="space-y-2.5 max-h-96 overflow-y-auto">
                {(data?.invalidContacts || []).length === 0 ? (
                  <p className="text-xs text-slate-500 py-8 text-center">Sin números marcados como equivocados.</p>
                ) : (
                  (data?.invalidContacts || []).map((c: any) => (
                    <div key={c.id} className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 text-xs flex items-center justify-between">
                      <div>
                        <div className="font-bold text-white">{c.full_name}</div>
                        <div className="font-mono text-rose-300">{c.phone_number}</div>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-rose-950 text-rose-300 border border-rose-800">
                        {c.attempt_count} intento(s)
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
