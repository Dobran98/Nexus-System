'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  Zap, CheckCircle2, AlertTriangle, Phone, 
  MapPin, Clock, ArrowRight, X, Laptop, ShieldCheck,
  Building, ExternalLink, UserCheck
} from 'lucide-react';

interface WorkstationQuickActionsProps {
  todayAttendance: any;
  attendanceState?: {
    isDentro: boolean;
    hasEntrada: boolean;
    hasSalida: boolean;
    lastTipo: string | null;
    lastTime: string | null;
    statusBadgeText: string;
    statusBadgeClass: string;
  };
  currentUsername?: string;
  userExtension?: string;
  userArea: string;
  turno: string;
  brianaTasksCount: number;
  reclasifTasksCount: number;
  isBrando: boolean;
}

export function WorkstationQuickActions({
  todayAttendance,
  attendanceState,
  currentUsername,
  userExtension,
  userArea,
  turno,
  brianaTasksCount,
  reclasifTasksCount,
  isBrando,
}: WorkstationQuickActionsProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="px-4 py-2 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-black text-xs transition-all shadow-lg shadow-blue-950/40 flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98]"
      >
        <Zap className="w-4 h-4 fill-white" />
        <span>Iniciar Estación de Trabajo</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[9999999] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-6 sm:p-8 space-y-6 relative max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 p-0.5 shadow-lg shadow-blue-900/30 flex items-center justify-center">
                  <div className="h-full w-full bg-slate-950 rounded-[14px] flex items-center justify-center text-blue-400">
                    <Laptop className="w-6 h-6" />
                  </div>
                </div>
                <div>
                  <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                    Despacho de Estación de Trabajo
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-950 text-blue-300 border border-blue-800/60 font-bold">
                      HOY
                    </span>
                  </h2>
                  <p className="text-xs text-slate-400">
                    Flujo guiado para iniciar tu jornada operativa sin contratiempos
                  </p>
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Puesto Técnico */}
            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
              <div className="flex items-center gap-2 text-blue-300">
                <UserCheck className="w-4 h-4 text-blue-400" />
                <span className="font-bold">@{currentUsername || 'operador'}</span>
              </div>
              <div className="flex items-center gap-2 text-sky-300">
                <Phone className="w-4 h-4 text-sky-400" />
                <span>{userExtension ? `Ext: ${userExtension}` : 'Sin PBX'}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-300">
                <MapPin className="w-4 h-4 text-indigo-400" />
                <span>{userArea}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-400">
                <Clock className="w-4 h-4 text-slate-500" />
                <span>Turno {turno}</span>
              </div>
            </div>

            {/* Pasos de Trabajo */}
            <div className="space-y-3">
              {/* PASO 1: ASYS */}
              <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                    attendanceState?.isDentro 
                      ? 'bg-emerald-950 text-emerald-400' 
                      : (attendanceState?.hasSalida ? 'bg-slate-800 text-slate-400' : 'bg-amber-950 text-amber-400')
                  }`}>
                    {attendanceState?.isDentro ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white">1. Asistencia en Asys</span>
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                        attendanceState?.isDentro
                          ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800 font-bold'
                          : (attendanceState?.hasSalida 
                              ? 'bg-slate-800 text-slate-300 border-slate-700' 
                              : 'bg-amber-950/80 text-amber-300 border-amber-800 animate-pulse')
                      }`}>
                        {attendanceState?.isDentro
                          ? `🟢 DENTRO (${attendanceState.lastTime})`
                          : (attendanceState?.hasSalida 
                              ? `🔴 Salida Marcada (${attendanceState.lastTime})` 
                              : '⚠️ Pendiente')}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {attendanceState?.isDentro
                        ? `Tu entrada fue registrada a las ${attendanceState.lastTime}. Estás activo en sede.`
                        : (attendanceState?.hasSalida
                            ? `Jornada finalizada a las ${attendanceState.lastTime}. Salida registrada.`
                            : 'Debes ponchar entrada escaneando tu QR en Asys antes de atender carga.')}
                    </p>
                  </div>
                </div>

                <Link
                  href="/asistencia"
                  onClick={() => setIsOpen(false)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
                    attendanceState?.isDentro
                      ? 'bg-rose-950/60 text-rose-300 border border-rose-800/60 hover:bg-rose-900/60'
                      : (attendanceState?.hasSalida 
                          ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' 
                          : 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-black shadow-md')
                  }`}
                >
                  {attendanceState?.isDentro ? 'Marcar Salida' : (attendanceState?.hasSalida ? 'Ver Registro' : 'Ponchar Ahora')}
                </Link>
              </div>

              {/* PASO 2: BRIANA */}
              <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                    brianaTasksCount > 0 ? 'bg-sky-950 text-sky-400' : 'bg-slate-800 text-slate-400'
                  }`}>
                    <Phone className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white">2. Telefonía Briana</span>
                      {brianaTasksCount > 0 && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-sky-950 text-sky-300 border border-sky-800 font-bold animate-pulse">
                          🔥 {brianaTasksCount} llamadas
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {brianaTasksCount > 0 
                        ? `Tienes ${brianaTasksCount} llamadas programadas asignadas para hoy.` 
                        : 'Cola telefónica lista para recibir o emitir llamadas.'}
                    </p>
                  </div>
                </div>

                <Link
                  href="/briana"
                  onClick={() => setIsOpen(false)}
                  className="px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs transition-all shrink-0 flex items-center gap-1.5 shadow-md shadow-sky-950/40"
                >
                  <span>Abrir Briana</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              {/* PASO 3: RECLASIFICACIÓN */}
              <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-xl bg-amber-950 text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white">3. Reclasificación & Triage</span>
                      {reclasifTasksCount > 0 && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-800 font-bold">
                          📋 {reclasifTasksCount} casos
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Auditoría ágil de tipificaciones, estatus e incidencias comunitarias.
                    </p>
                  </div>
                </div>

                <Link
                  href={isBrando ? '/reclasificacion' : '#'}
                  onClick={() => setIsOpen(false)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                    isBrando
                      ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-black shadow-md shadow-amber-950/40'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  <span>{isBrando ? 'Abrir Triage' : 'En cola'}</span>
                  {isBrando && <ArrowRight className="w-3.5 h-3.5" />}
                </Link>
              </div>

              {/* PASO 4: ORIANA */}
              <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-xl bg-purple-950 text-purple-400 flex items-center justify-center shrink-0 mt-0.5">
                    <Building className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white">4. Oriana Analítica</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Carga de reportes, métricas y balance de gestión de tu sala.
                    </p>
                  </div>
                </div>

                <Link
                  href="/oriana"
                  onClick={() => setIsOpen(false)}
                  className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition-all shrink-0 flex items-center gap-1.5 shadow-md shadow-purple-950/40"
                >
                  <span>Abrir Oriana</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            {/* Footer */}
            <div className="pt-2 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setIsOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Cerrar Despacho
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
