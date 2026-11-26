'use client';

import React, { useState, useEffect } from 'react';
import {
  QrCode,
  X,
  Users,
  UserCheck,
  UserX,
  CalendarCheck,
  Clock,
  CheckCircle2,
  XCircle,
  RefreshCw,
  AlertTriangle,
  LogIn,
  LogOut
} from 'lucide-react';

interface AsysAdminBridgeModalProps {
  isOpen: boolean;
  onClose: () => void;
  usersList: Array<{ id: string; email: string; full_name: string; legacy_username: string; is_active: boolean }>;
}

export function AsysAdminBridgeModal({ isOpen, onClose, usersList }: AsysAdminBridgeModalProps) {
  const [activeTab, setActiveTab] = useState<'live' | 'manual' | 'permissions'>('live');
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<any>({ totalUsers: 0, todayChecks: 0, outsideRange: 0, openSessions: [] });
  const [absentees, setAbsentees] = useState<any[]>([]);
  const [permissions, setPermissions] = useState<any[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [manualSubmitting, setManualSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const callAsysApi = async (action: string, args: any[] = []) => {
    const res = await fetch(`/api/asys/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    });
    return await res.json();
  };

  const loadLiveMonitor = async () => {
    setLoading(true);
    try {
      const [statsRes, absRes, permRes] = await Promise.all([
        callAsysApi('getAdminDashboardStats', []),
        callAsysApi('getTodaysAbsentees', []),
        callAsysApi('getPermissionRequests', ['all', 'Todos'])
      ]);
      if (statsRes) setStats(statsRes);
      if (Array.isArray(absRes)) setAbsentees(absRes);
      if (Array.isArray(permRes)) setPermissions(permRes);
    } catch (err) {
      console.error('Error cargando monitor ASYS:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setFeedback(null);
      loadLiveMonitor();
    }
  }, [isOpen]);

  const handleManualClock = async (tipo: 'Entrada' | 'Salida') => {
    if (!selectedUserId) {
      setFeedback({ type: 'error', text: 'Seleccione un colaborador de la lista.' });
      return;
    }
    const targetUser = usersList.find(u => u.id === selectedUserId || u.legacy_username === selectedUserId);
    if (!targetUser) return;

    setManualSubmitting(true);
    setFeedback(null);
    try {
      const res = await callAsysApi('recordAttendance', [{
        userId: targetUser.legacy_username || targetUser.email.split('@')[0],
        nombreCompleto: targetUser.full_name,
        tipo,
        estado: 'Aprobado (Manual Intranet)',
        distancia: 0,
        lat: 0,
        lng: 0,
        isManual: true
      }]);

      if (res && res.success !== false) {
        setFeedback({ type: 'success', text: `Marcaje manual de ${tipo} registrado para ${targetUser.full_name}.` });
        loadLiveMonitor();
      } else {
        setFeedback({ type: 'error', text: res?.error || 'No se pudo registrar el marcaje.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Error de conexión' });
    } finally {
      setManualSubmitting(false);
    }
  };

  const handlePermissionAction = async (permId: string, status: 'Aprobado' | 'Rechazado') => {
    try {
      const res = await callAsysApi('updatePermissionStatus', [permId, status, 'Procesado desde Intranet Nexus']);
      if (res && res.success !== false) {
        setFeedback({ type: 'success', text: `Solicitud marcada como ${status}.` });
        loadLiveMonitor();
      } else {
        setFeedback({ type: 'error', text: res?.error || 'Error actualizando permiso' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message });
    }
  };

  if (!isOpen) return null;

  const pendingPerms = permissions.filter((p: any) => String(p.estado || '').toLowerCase() === 'pendiente');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-lg shadow-emerald-950/40">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                Control Administrativo ASYS (Migrado a Intranet)
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800">
                  Nativo Next.js
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Sesiones abiertas en sede, ausentes, marcaje manual y gestión rápida de permisos
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadLiveMonitor}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Actualizar datos en vivo"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-6 py-2.5 bg-slate-950/40 border-b border-slate-800/80 flex items-center gap-2 text-xs font-semibold shrink-0">
          <button
            onClick={() => { setActiveTab('live'); setFeedback(null); }}
            className={`px-3.5 py-1.5 rounded-xl transition-all flex items-center gap-2 ${
              activeTab === 'live' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>Monitor En Vivo ({stats.openSessions?.length || 0} Dentro)</span>
          </button>
          <button
            onClick={() => { setActiveTab('manual'); setFeedback(null); }}
            className={`px-3.5 py-1.5 rounded-xl transition-all flex items-center gap-2 ${
              activeTab === 'manual' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Marcaje Manual (Entrada / Salida)</span>
          </button>
          <button
            onClick={() => { setActiveTab('permissions'); setFeedback(null); }}
            className={`px-3.5 py-1.5 rounded-xl transition-all flex items-center gap-2 ${
              activeTab === 'permissions' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <CalendarCheck className="w-3.5 h-3.5" />
            <span>Permisos Pendientes ({pendingPerms.length})</span>
          </button>
        </div>

        {feedback && (
          <div className={`mx-6 mt-4 p-3 rounded-2xl flex items-center gap-3 text-xs shrink-0 ${
            feedback.type === 'success'
              ? 'bg-emerald-950/80 border border-emerald-800 text-emerald-300'
              : 'bg-rose-950/80 border border-rose-800 text-rose-300'
          }`}>
            {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
            <span>{feedback.text}</span>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {activeTab === 'live' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800">
                  <span className="text-[10px] font-mono uppercase text-slate-400">Personal Activo Hoy</span>
                  <div className="text-2xl font-black text-emerald-400 mt-1">{stats.openSessions?.length || 0}</div>
                  <span className="text-[11px] text-slate-500">Sesiones abiertas (Dentro)</span>
                </div>
                <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800">
                  <span className="text-[10px] font-mono uppercase text-slate-400">Marcajes Totales Hoy</span>
                  <div className="text-2xl font-black text-white mt-1">{stats.todayChecks || 0}</div>
                  <span className="text-[11px] text-slate-500">Entradas y salidas registradas</span>
                </div>
                <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800">
                  <span className="text-[10px] font-mono uppercase text-slate-400">Ausentes Hoy</span>
                  <div className="text-2xl font-black text-rose-400 mt-1">{absentees.length}</div>
                  <span className="text-[11px] text-slate-500">Sin marcaje de entrada</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-slate-950/50 border border-slate-800 space-y-3">
                  <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                    <UserCheck className="w-4 h-4" /> Sesiones Abiertas (Dentro Ahora)
                  </h4>
                  <div className="max-h-60 overflow-y-auto space-y-2">
                    {(!stats.openSessions || stats.openSessions.length === 0) ? (
                      <p className="text-xs text-slate-500 py-4 text-center">No hay sesiones abiertas en este momento.</p>
                    ) : (
                      stats.openSessions.map((s: any, idx: number) => (
                        <div key={idx} className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between text-xs">
                          <div>
                            <div className="font-bold text-slate-200">{s.nombre || s.name || s.id_usuario}</div>
                            <div className="text-[10px] text-slate-400 font-mono">Entrada: {s.hora || s.timestamp}</div>
                          </div>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800">
                            ● DENTRO
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950/50 border border-slate-800 space-y-3">
                  <h4 className="text-xs font-bold text-rose-400 uppercase tracking-wider flex items-center gap-2">
                    <UserX className="w-4 h-4" /> Ausentes Hoy
                  </h4>
                  <div className="max-h-60 overflow-y-auto space-y-2">
                    {absentees.length === 0 ? (
                      <p className="text-xs text-slate-500 py-4 text-center">Todo el personal ha registrado asistencia.</p>
                    ) : (
                      absentees.map((a: any, idx: number) => (
                        <div key={idx} className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between text-xs">
                          <div>
                            <div className="font-bold text-slate-200">{a.nombre || a.nombre_apellido || a.usuario}</div>
                            <div className="text-[10px] text-slate-400">{a.turno || 'Turno general'} · {a.rol || 'Personal'}</div>
                          </div>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-950 text-rose-300 border border-rose-800">
                            AUSENTE
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'manual' && (
            <div className="max-w-xl mx-auto p-6 rounded-3xl bg-slate-950/60 border border-slate-800 space-y-5">
              <div>
                <h4 className="text-sm font-bold text-white">Registro Manual de Asistencia</h4>
                <p className="text-xs text-slate-400 mt-1">
                  Registre la Entrada o Salida de un colaborador si presentó fallas con su cámara QR o dispositivo móvil.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Seleccionar Colaborador *
                </label>
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="">-- Seleccione un usuario activo --</option>
                  {usersList.filter(u => u.is_active).map(u => (
                    <option key={u.id} value={u.id}>
                      {u.full_name} (@{u.legacy_username || u.email.split('@')[0]})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  disabled={manualSubmitting}
                  onClick={() => handleManualClock('Entrada')}
                  className="py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Registrar Entrada Manual</span>
                </button>
                <button
                  type="button"
                  disabled={manualSubmitting}
                  onClick={() => handleManualClock('Salida')}
                  className="py-3 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Registrar Salida Manual</span>
                </button>
              </div>
            </div>
          )}

          {activeTab === 'permissions' && (
            <div className="space-y-3">
              {pendingPerms.length === 0 ? (
                <div className="p-10 text-center text-xs text-slate-500 bg-slate-950/40 rounded-2xl border border-slate-800">
                  No hay solicitudes de permiso pendientes por aprobar.
                </div>
              ) : (
                pendingPerms.map((p: any, idx: number) => (
                  <div key={p.id || idx} className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white">{p.nombre_usuario || p.usuario || 'Colaborador'}</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-800">
                          {p.tipo || 'Permiso'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">
                        Fechas: <strong className="text-slate-200">{p.fecha_inicio}</strong> al <strong className="text-slate-200">{p.fecha_fin}</strong>
                      </p>
                      {p.motivo && <p className="text-xs text-slate-300 italic">"{p.motivo}"</p>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handlePermissionAction(p.id, 'Aprobado')}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Aprobar
                      </button>
                      <button
                        onClick={() => handlePermissionAction(p.id, 'Rechazado')}
                        className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1"
                      >
                        <XCircle className="w-3.5 h-3.5" /> Rechazar
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
