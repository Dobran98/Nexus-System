'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Bell,
  CheckCircle2,
  PhoneCall,
  LineChart,
  Clock,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  X,
  RefreshCw,
  Sparkles,
  CheckCheck,
} from 'lucide-react';
import Link from 'next/link';

export interface NexusNotificacion {
  id: string;
  user_email: string;
  titulo: string;
  descripcion: string;
  modulo: 'briana' | 'oriana' | 'asys' | 'sistema';
  tipo: 'tarea_pendiente' | 'llamada_programada' | 'reclasificacion' | 'alerta_asistencia' | 'aviso';
  prioridad: 'baja' | 'media' | 'alta' | 'urgente';
  enlace?: string;
  estado: 'pendiente' | 'completada' | 'descartada';
  completada_en?: string;
  notas_resolucion?: string;
  created_at: string;
}

export function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'pendientes' | 'completadas' | 'todas'>('pendientes');
  const [selectedModulo, setSelectedModulo] = useState<string>('todos');
  const [notificaciones, setNotificaciones] = useState<NexusNotificacion[]>([]);
  const [loading, setLoading] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolvingNote, setResolvingNote] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // Cargar notificaciones desde la API
  const fetchNotificaciones = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/notificaciones');
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.notificaciones)) {
          setNotificaciones(data.notificaciones);
        }
      }
    } catch (e) {
      console.warn('Error fetching notifications:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotificaciones();
    // Refresco periódico cada 45 segundos
    const interval = setInterval(fetchNotificaciones, 45000);
    return () => clearInterval(interval);
  }, []);

  // Cerrar al hacer clic fuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const pendientes = notificaciones.filter((n) => n.estado === 'pendiente');
  const completadas = notificaciones.filter((n) => n.estado === 'completada');

  // Filtrado según pestaña y módulo
  const filteredList = notificaciones.filter((item) => {
    if (activeTab === 'pendientes' && item.estado !== 'pendiente') return false;
    if (activeTab === 'completadas' && item.estado !== 'completada') return false;
    if (selectedModulo !== 'todos' && item.modulo !== selectedModulo) return false;
    return true;
  });

  // Reportar actividad como cumplida
  const handleCompleteTask = async (id: string) => {
    try {
      setSubmittingAction(true);
      const res = await fetch('/api/notificaciones', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          estado: 'completada',
          notas_resolucion: resolvingNote.trim() || 'Actividad reportada como cumplida por el usuario.',
        }),
      });

      if (res.ok) {
        setSuccessToast('¡Actividad reportada como cumplida exitosamente!');
        setResolvingId(null);
        setResolvingNote('');
        await fetchNotificaciones();
        setTimeout(() => setSuccessToast(null), 3500);
      }
    } catch (e) {
      console.error('Error completing notification:', e);
    } finally {
      setSubmittingAction(false);
    }
  };

  // Renderizador de iconos por módulo
  const getModuleBadge = (modulo: string) => {
    switch (modulo) {
      case 'briana':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-950/80 text-sky-400 border border-sky-800/60">
            <PhoneCall className="w-2.5 h-2.5" />
            <span>Briana</span>
          </span>
        );
      case 'oriana':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-950/80 text-indigo-400 border border-indigo-800/60">
            <LineChart className="w-2.5 h-2.5" />
            <span>Oriana</span>
          </span>
        );
      case 'asys':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-800/60">
            <Clock className="w-2.5 h-2.5" />
            <span>ASYS</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
            <ShieldCheck className="w-2.5 h-2.5" />
            <span>Nexus</span>
          </span>
        );
    }
  };

  // Renderizador de prioridad
  const getPriorityBadge = (prioridad: string) => {
    switch (prioridad) {
      case 'urgente':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-950/90 text-rose-300 border border-rose-800 uppercase tracking-wider animate-pulse">
            <AlertTriangle className="w-2.5 h-2.5 text-rose-400" />
            Urgente
          </span>
        );
      case 'alta':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950/80 text-amber-300 border border-amber-800 uppercase tracking-wider">
            Alta
          </span>
        );
      case 'media':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
            Media
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-slate-900 text-slate-500">
            Baja
          </span>
        );
    }
  };

  return (
    <div className="relative inline-block text-left" ref={containerRef}>
      {/* Botón de Campana con Badge */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-xl bg-slate-900 border border-slate-700/80 hover:bg-slate-800 text-slate-300 hover:text-white transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
        title="Centro de Notificaciones y Tareas"
      >
        <Bell className="w-4 h-4" />
        {pendientes.length > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-rose-600 text-[10px] font-black text-white shadow-md shadow-rose-950 animate-pulse">
            {pendientes.length > 9 ? '9+' : pendientes.length}
          </span>
        )}
      </button>

      {/* Popover / Drawer Desplegable */}
      {isOpen && (
        <div className="absolute right-0 mt-3 w-80 sm:w-96 md:w-[420px] rounded-2xl bg-slate-900/95 border border-slate-700/80 shadow-2xl backdrop-blur-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          
          {/* Encabezado */}
          <div className="p-4 border-b border-slate-800 bg-slate-950/50 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="h-7 w-7 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-white font-mono">
                  Centro de Notificaciones
                </h3>
                <p className="text-[10px] text-slate-400">
                  {pendientes.length} tareas pendientes de atención
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-1">
              <button
                type="button"
                onClick={fetchNotificaciones}
                disabled={loading}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                title="Actualizar"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Toast de confirmación de actividad cumplida */}
          {successToast && (
            <div className="p-2.5 bg-emerald-950 border-b border-emerald-800 text-emerald-300 text-xs flex items-center gap-2 animate-in slide-in-from-top">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{successToast}</span>
            </div>
          )}

          {/* Pestañas de Estado */}
          <div className="flex border-b border-slate-800 bg-slate-950/30 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setActiveTab('pendientes')}
              className={`flex-1 py-2.5 text-center border-b-2 transition-colors ${
                activeTab === 'pendientes'
                  ? 'border-blue-500 text-blue-400 bg-blue-500/5'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Pendientes ({pendientes.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('completadas')}
              className={`flex-1 py-2.5 text-center border-b-2 transition-colors ${
                activeTab === 'completadas'
                  ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Completadas ({completadas.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('todas')}
              className={`flex-1 py-2.5 text-center border-b-2 transition-colors ${
                activeTab === 'todas'
                  ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Todas ({notificaciones.length})
            </button>
          </div>

          {/* Filtro por Módulo */}
          <div className="p-2 border-b border-slate-800/60 bg-slate-900/60 flex items-center gap-1.5 overflow-x-auto text-[11px]">
            {['todos', 'briana', 'oriana', 'asys', 'sistema'].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setSelectedModulo(m)}
                className={`px-2.5 py-1 rounded-lg uppercase tracking-wider font-semibold transition-all shrink-0 ${
                  selectedModulo === m
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-750'
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          {/* Lista de Tareas y Notificaciones */}
          <div className="max-h-96 overflow-y-auto p-3 space-y-3 divide-y divide-slate-800/40">
            {filteredList.length === 0 ? (
              <div className="py-10 text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 text-slate-600 mx-auto" />
                <p className="text-xs text-slate-400 font-medium">
                  No hay notificaciones ni tareas pendientes en esta categoría.
                </p>
                <p className="text-[10px] text-slate-600">
                  Todas sus actividades operativas se encuentran al día.
                </p>
              </div>
            ) : (
              filteredList.map((item) => (
                <div
                  key={item.id}
                  className={`pt-3 first:pt-0 p-3 rounded-xl transition-all ${
                    item.estado === 'completada'
                      ? 'bg-slate-950/30 opacity-75'
                      : 'bg-slate-950/70 border border-slate-800/80 hover:border-slate-700 shadow-md'
                  }`}
                >
                  {/* Fila superior: Módulo + Prioridad + Estado */}
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-1.5">
                      {getModuleBadge(item.modulo)}
                      {getPriorityBadge(item.prioridad)}
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {new Date(item.created_at).toLocaleDateString('es-ES', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  {/* Título y Descripción */}
                  <h4 className="text-xs font-bold text-white tracking-tight mb-1">
                    {item.titulo}
                  </h4>
                  <p className="text-[11px] text-slate-400 leading-relaxed mb-3">
                    {item.descripcion}
                  </p>

                  {/* Estado si está completada */}
                  {item.estado === 'completada' ? (
                    <div className="mt-2 p-2 rounded-lg bg-emerald-950/40 border border-emerald-800/50 text-[11px] text-emerald-300 space-y-1">
                      <div className="flex items-center gap-1.5 font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>Actividad Cumplida</span>
                        {item.completada_en && (
                          <span className="text-[10px] text-emerald-500/80 font-normal ml-auto">
                            {new Date(item.completada_en).toLocaleDateString('es-ES', {
                              day: '2-digit',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        )}
                      </div>
                      {item.notas_resolucion && (
                        <p className="text-[10px] text-slate-300 italic pl-5">
                          "{item.notas_resolucion}"
                        </p>
                      )}
                    </div>
                  ) : (
                    /* Botones de Acción para Tarea Pendiente */
                    <div className="space-y-2 pt-1 border-t border-slate-800/60">
                      {resolvingId === item.id ? (
                        /* Formulario interactivo para reportar actividad cumplida */
                        <div className="p-2.5 rounded-lg bg-slate-900 border border-blue-500/40 space-y-2 animate-in fade-in">
                          <label className="block text-[10px] font-semibold text-slate-300 uppercase tracking-wider">
                            Nota de Resolución (Opcional):
                          </label>
                          <input
                            type="text"
                            value={resolvingNote}
                            onChange={(e) => setResolvingNote(e.target.value)}
                            placeholder="Ej. Llamada realizada con éxito / Lote reclasificado"
                            className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-md text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                          <div className="flex items-center justify-end gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => {
                                setResolvingId(null);
                                setResolvingNote('');
                              }}
                              className="px-2.5 py-1 rounded text-[11px] text-slate-400 hover:text-white"
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              disabled={submittingAction}
                              onClick={() => handleCompleteTask(item.id)}
                              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold rounded text-[11px] shadow flex items-center gap-1"
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Confirmar Cumplimiento</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* Botones estándar: Reportar actividad y Navegar */
                        <div className="flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setResolvingId(item.id);
                              setResolvingNote('');
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 hover:bg-emerald-600 hover:text-white transition-all text-[11px] font-semibold shadow-sm group"
                          >
                            <CheckCheck className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                            <span>Reportar Actividad Cumplida</span>
                          </button>

                          {item.enlace && (
                            <Link
                              href={item.enlace}
                              onClick={() => setIsOpen(false)}
                              className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 hover:text-blue-400 transition-colors"
                            >
                              <span>Ir a la Tarea</span>
                              <ArrowRight className="w-3 h-3" />
                            </Link>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Pie del componente */}
          <div className="p-3 border-t border-slate-800 bg-slate-950/70 text-[10px] text-slate-500 flex items-center justify-between">
            <span>● Trazabilidad Operativa Nexus</span>
            <span>Actualizado en vivo</span>
          </div>

        </div>
      )}
    </div>
  );
}
