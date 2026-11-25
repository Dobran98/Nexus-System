'use client';

import React, { useState, useEffect } from 'react';
import {
  Bell,
  AlertTriangle,
  Info,
  CheckCircle2,
  X,
  ExternalLink,
  Volume2,
  Sparkles,
  ShieldAlert,
} from 'lucide-react';
import Link from 'next/link';

export function GlobalNotificationOverlay() {
  const [activeUrgentModal, setActiveUrgentModal] = useState<any | null>(null);
  const [toastAlert, setToastAlert] = useState<any | null>(null);
  const [lastSeenId, setLastSeenId] = useState<string | null>(null);

  const checkNotifications = async () => {
    try {
      const res = await fetch('/api/notificaciones');
      if (!res.ok) return;

      const data = await res.json();
      if (!data.success || !Array.isArray(data.notificaciones)) return;

      const pendientes = data.notificaciones.filter((n: any) => n.estado === 'pendiente');

      // 1. Detectar avisos urgentes o con popup inmediato que aún no han sido confirmados por este usuario
      const urgent = pendientes.find(
        (n: any) =>
          (n.prioridad === 'urgente' || n.metadata?.popup === true) &&
          typeof window !== 'undefined' &&
          !localStorage.getItem(`nexus_ack_${n.id}`)
      );

      if (urgent) {
        // Si no está ya abierto en pantalla
        if (!activeUrgentModal || activeUrgentModal.id !== urgent.id) {
          setActiveUrgentModal(urgent);
        }
      } else {
        setActiveUrgentModal(null);
      }

      // 2. Detectar notificaciones nuevas para mostrar Toast flotante
      if (pendientes.length > 0) {
        const newest = pendientes[0];
        const storedLastId = sessionStorage.getItem('nexus_last_notif_seen');

        if (newest.id !== storedLastId && (!urgent || urgent.id !== newest.id)) {
          setToastAlert(newest);
          sessionStorage.setItem('nexus_last_notif_seen', newest.id);
          // Ocultar toast a los 8 segundos
          setTimeout(() => setToastAlert(null), 8000);
        }
      }
    } catch (e) {
      // Silenciar errores de sondeo en background
    }
  };

  useEffect(() => {
    checkNotifications();
    const interval = setInterval(checkNotifications, 15000); // Polling cada 15s
    return () => clearInterval(interval);
  }, []);

  const handleConfirmUrgent = async () => {
    if (!activeUrgentModal) return;
    try {
      // Registrar acknowledgment localmente para no repetir popups en avisos globales
      if (typeof window !== 'undefined') {
        localStorage.setItem(`nexus_ack_${activeUrgentModal.id}`, 'true');
      }

      // Si no es un aviso global compartido, actualizar estatus en BD
      if (activeUrgentModal.user_email !== 'global@impress.com') {
        await fetch('/api/notificaciones', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: activeUrgentModal.id,
            estado: 'completada',
            notas_resolucion: 'Aviso urgente confirmado y leído por el usuario en pantalla.',
          }),
        });
      }
      setActiveUrgentModal(null);
      checkNotifications();
    } catch (e) {
      console.error('Error confirming urgent notice:', e);
      setActiveUrgentModal(null);
    }
  };

  return (
    <>
      {/* ── 1. MODAL DE AVISO URGENTE (INTERRUPCIÓN TOTAL EN CUALQUIER VISTA) ── */}
      {activeUrgentModal && (
        <div className="fixed inset-0 z-[99999] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="w-full max-w-lg bg-slate-900 border-2 border-amber-500/80 rounded-3xl shadow-2xl p-6 sm:p-8 space-y-6 relative ring-4 ring-amber-500/20">
            {/* Header del Aviso */}
            <div className="flex items-center gap-3.5 border-b border-slate-800 pb-4">
              <div className="h-12 w-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0 animate-pulse">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-800">
                  {activeUrgentModal.metadata?.broadcast ? '📢 Comunicado Global' : '🚨 Aviso Prioritario'}
                </span>
                <h3 className="text-lg font-black text-white tracking-tight mt-1">
                  {activeUrgentModal.titulo}
                </h3>
              </div>
            </div>

            {/* Contenido */}
            <div className="space-y-3">
              <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-line bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80">
                {activeUrgentModal.descripcion}
              </p>

              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 font-mono">
                <span>Módulo: <strong className="text-slate-200 uppercase">{activeUrgentModal.modulo}</strong></span>
                {activeUrgentModal.metadata?.author_email && (
                  <span>Emitido por: {activeUrgentModal.metadata.author_email}</span>
                )}
              </div>
            </div>

            {/* Acciones */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
              {activeUrgentModal.enlace && activeUrgentModal.enlace !== '/' && (
                <Link
                  href={activeUrgentModal.enlace}
                  onClick={() => setActiveUrgentModal(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5"
                >
                  <span>Ir al recurso</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              )}
              <button
                type="button"
                onClick={handleConfirmUrgent}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-slate-950 font-black text-xs shadow-lg shadow-amber-900/40 transition-all cursor-pointer"
              >
                Entendido / Confirmar Lectura
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 2. TOAST FLOTANTE PARA NOTIFICACIONES NUEVAS ── */}
      {toastAlert && !activeUrgentModal && (
        <div className="fixed top-20 right-4 z-[99990] max-w-sm w-full bg-slate-900/95 border border-blue-500/40 backdrop-blur-md rounded-2xl shadow-2xl p-4 flex items-start gap-3 animate-in slide-in-from-top-4 duration-300">
          <div className="h-9 w-9 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0 mt-0.5">
            <Bell className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[10px] font-mono uppercase text-blue-400 font-bold">
                {toastAlert.modulo}
              </span>
              <button
                onClick={() => setToastAlert(null)}
                className="text-slate-400 hover:text-white p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <h4 className="text-xs font-bold text-white truncate">{toastAlert.titulo}</h4>
            <p className="text-[11px] text-slate-300 line-clamp-2 mt-0.5">{toastAlert.descripcion}</p>
          </div>
        </div>
      )}
    </>
  );
}
