'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { Database } from '@intranet/database';
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Badge,
  Alert,
  AlertTitle,
  AlertDescription,
} from '@intranet/ui';

// Tipos estrictos derivados directamente de database.types.ts
type CallAssignment = Database['public']['Tables']['call_assignments']['Row'];
type CorporateDevice = Database['public']['Tables']['corporate_devices']['Row'];
type CallInteractionResult = Database['public']['Tables']['call_interactions']['Row']['result'];

interface GuidedDialerProps {
  currentOperatorId: string;
  assignedDevice: CorporateDevice;
  initialAssignment?: CallAssignment | null;
  onCallLogged?: (interactionId: string) => void;
}

export const GuidedDialer: React.FC<GuidedDialerProps> = ({
  currentOperatorId,
  assignedDevice,
  initialAssignment = null,
  onCallLogged,
}) => {
  // Estado de la Asignación
  const [assignment, setAssignment] = useState<CallAssignment | null>(initialAssignment);
  const [loadingAssignment, setLoadingAssignment] = useState<boolean>(!initialAssignment);

  // Estados del Cronómetro y Telefonía
  const [dialerState, setDialerState] = useState<'idle' | 'calling' | 'logging' | 'submitting'>('idle');
  const [callStartTime, setCallStartTime] = useState<string | null>(null);
  const [callEndTime, setCallEndTime] = useState<string | null>(null);
  const [callDurationSeconds, setCallDurationSeconds] = useState<number>(0);
  
  // Temporizador de Latencia en Espera (Idle Time entre gestiones)
  const [idleSeconds, setIdleSeconds] = useState<number>(0);
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const callTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Formulario de Registro Manual de Interacción
  const [selectedResult, setSelectedResult] = useState<CallInteractionResult | ''>('');
  const [callNotes, setCallNotes] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Resultados disponibles validados por el tipo de Supabase
  const resultOptions: { value: CallInteractionResult; label: string; badge: 'success' | 'warning' | 'danger' | 'info' }[] = [
    { value: 'answered_effective', label: 'Contacto Efectivo', badge: 'success' },
    { value: 'busy', label: 'Ocupado / Línea Tomada', badge: 'warning' },
    { value: 'no_answer', label: 'No Contesta', badge: 'info' },
    { value: 'rejected', label: 'Llamada Rechazada', badge: 'danger' },
    { value: 'invalid_number', label: 'Número Inválido / Fuera de Servicio', badge: 'danger' },
  ];

  // Iniciar temporizador de espera al estar en 'idle'
  useEffect(() => {
    if (dialerState === 'idle') {
      idleTimerRef.current = setInterval(() => {
        setIdleSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (idleTimerRef.current) clearInterval(idleTimerRef.current);
    }

    return () => {
      if (idleTimerRef.current) clearInterval(idleTimerRef.current);
    };
  }, [dialerState]);

  // Manejo del contador de llamada en curso
  useEffect(() => {
    if (dialerState === 'calling') {
      callTimerRef.current = setInterval(() => {
        setCallDurationSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (callTimerRef.current) clearInterval(callTimerRef.current);
    }

    return () => {
      if (callTimerRef.current) clearInterval(callTimerRef.current);
    };
  }, [dialerState]);

  // Formato mm:ss
  const formatTimer = (totalSeconds: number): string => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  // Iniciar llamada manual desde terminal Samsung
  const handleStartCall = useCallback(() => {
    if (!assignment) {
      setErrorMessage('No hay ninguna asignación activa en cola.');
      return;
    }
    setErrorMessage(null);
    setSuccessNotice(null);
    setCallDurationSeconds(0);
    setCallStartTime(new Date().toISOString());
    setDialerState('calling');
  }, [assignment]);

  // Finalizar llamada manual
  const handleEndCall = useCallback(() => {
    const nowIso = new Date().toISOString();
    setCallEndTime(nowIso);
    setDialerState('logging');
  }, []);

  // Enviar interacción a la base de datos
  const handleSubmitInteraction = async () => {
    if (!selectedResult) {
      setErrorMessage('Debe seleccionar el resultado cualitativo de la llamada.');
      return;
    }
    if (!assignment || !callStartTime || !callEndTime) {
      setErrorMessage('Estado de llamada inconsistente.');
      return;
    }

    setDialerState('submitting');
    setErrorMessage(null);

    try {
      const payload: Database['public']['Tables']['call_interactions']['Insert'] = {
        assignment_id: assignment.id,
        operator_id: currentOperatorId,
        device_id: assignedDevice.id,
        start_time: callStartTime,
        end_time: callEndTime,
        result: selectedResult,
        idle_time_prior_call: idleSeconds,
        notes: callNotes.trim() ? callNotes.trim() : null,
      };

      const res = await fetch('/api/calls/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Error al persistir la llamada');
      }

      const data = await res.json();
      setSuccessNotice(`Llamada registrada con éxito (${formatTimer(callDurationSeconds)} de conversación).`);
      
      // Reiniciar para la siguiente asignación
      setDialerState('idle');
      setIdleSeconds(0);
      setSelectedResult('');
      setCallNotes('');
      setCallStartTime(null);
      setCallEndTime(null);

      if (data.nextAssignment) {
        setAssignment(data.nextAssignment);
      } else {
        setAssignment(null);
      }

      if (onCallLogged && data.interactionId) {
        onCallLogged(data.interactionId);
      }
    } catch (err: unknown) {
      setDialerState('logging');
      setErrorMessage(err instanceof Error ? err.message : 'Error desconocido al registrar llamada.');
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* HEADER DE TELEMETRÍA DE HARDWARE SAMSUNG */}
      <Card className="border-blue-900/50 bg-gradient-to-r from-slate-900 via-slate-900 to-blue-950/40">
        <CardContent className="p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600/20 border border-blue-500/30 rounded-xl text-blue-400">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-base">{assignedDevice.model}</span>
                <Badge variant={assignedDevice.status === 'assigned' ? 'success' : 'default'}>
                  {assignedDevice.status}
                </Badge>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Línea: {assignedDevice.phone_number} | IMEI: {assignedDevice.imei}
              </p>
            </div>
          </div>

          {/* TEMPORIZADOR DE LATENCIA EN ESPERA (IDLE TIME) */}
          <div className="flex items-center gap-4 bg-slate-950/60 px-4 py-2 rounded-xl border border-slate-800">
            <div>
              <span className="text-[10px] font-semibold tracking-wider uppercase text-slate-400 block">
                Tiempo de Espera
              </span>
              <span className={`text-xl font-mono font-bold ${idleSeconds > 45 ? 'text-amber-400 animate-pulse' : 'text-slate-200'}`}>
                {formatTimer(idleSeconds)}
              </span>
            </div>
            {idleSeconds > 45 && (
              <Badge variant="warning" className="text-[10px]">
                Excede Meta (45s)
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* FEEDBACK Y ALERTAS */}
      {errorMessage && (
        <Alert variant="danger">
          <AlertTitle>Fallo Operacional</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

      {successNotice && (
        <Alert variant="success">
          <AlertTitle>Registro Exitoso</AlertTitle>
          <AlertDescription>{successNotice}</AlertDescription>
        </Alert>
      )}

      {/* TARJETA PRINCIPAL DEL DISCADOR */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Asignación de Campaña Activa</CardTitle>
              <CardDescription>
                Marcación manual obligatoria desde el terminal Samsung asignado.
              </CardDescription>
            </div>
            {assignment && (
              <Badge variant="info">Prioridad: {assignment.priority}</Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {assignment ? (
            <div className="bg-slate-950/80 p-6 rounded-2xl border border-slate-800 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <span className="text-xs text-slate-400 uppercase tracking-widest font-semibold block mb-1">
                    Número de Destino
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="text-3xl sm:text-4xl font-mono font-extrabold text-white tracking-widest select-all">
                      {assignment.customer_phone}
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-xs text-slate-400 uppercase tracking-wider block">Contacto / Titular</span>
                  <span className="text-base font-semibold text-slate-200">
                    {assignment.customer_name || 'Sin nombre registrado'}
                  </span>
                </div>
              </div>

              {/* TIMER DE CONVERSACIÓN ACTIVA */}
              {(dialerState === 'calling' || dialerState === 'logging') && (
                <div className="pt-4 border-t border-slate-800 flex items-center justify-between bg-blue-950/20 px-4 py-3 rounded-xl border-dashed border-blue-800/40">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                    </span>
                    <span className="text-xs uppercase font-bold tracking-wider text-slate-300">
                      Duración de Llamada
                    </span>
                  </div>
                  <span className="text-2xl font-mono font-black text-emerald-400 tracking-wider">
                    {formatTimer(callDurationSeconds)}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12 bg-slate-950/40 rounded-2xl border border-dashed border-slate-800">
              <p className="text-slate-400 font-medium">No hay llamadas asignadas en este momento.</p>
              <p className="text-xs text-slate-500 mt-1">El supervisor cargará nuevos lotes de contactos a la campaña.</p>
            </div>
          )}

          {/* FORMULARIO DE CIERRE Y RESULTADO DE INTERACCIÓN */}
          {dialerState === 'logging' && (
            <div className="space-y-4 pt-4 border-t border-slate-800 animate-in fade-in duration-200">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                Seleccione el Resultado de la Interacción *
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {resultOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setSelectedResult(opt.value)}
                    className={`p-3.5 rounded-xl border text-left text-sm font-medium transition-all ${
                      selectedResult === opt.value
                        ? 'bg-blue-600/30 border-blue-500 text-white shadow-md shadow-blue-950'
                        : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-800 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>{opt.label}</span>
                      {selectedResult === opt.value && (
                        <span className="w-2 h-2 rounded-full bg-blue-400" />
                      )}
                    </div>
                  </button>
                ))}
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                  Notas de Gestión (Máx 1000 caracteres)
                </label>
                <textarea
                  rows={3}
                  value={callNotes}
                  maxLength={1000}
                  onChange={(e) => setCallNotes(e.target.value)}
                  placeholder="Detalles de la conversación, acuerdos o motivo de reprogramación..."
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all resize-none"
                />
              </div>
            </div>
          )}
        </CardContent>

        {/* ACCIONES DE INTERFAZ */}
        <CardFooter>
          {dialerState === 'idle' && (
            <Button
              variant="success"
              size="lg"
              className="w-full sm:w-auto"
              disabled={!assignment}
              onClick={handleStartCall}
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              Iniciar Marcación Manual
            </Button>
          )}

          {dialerState === 'calling' && (
            <Button
              variant="danger"
              size="lg"
              className="w-full sm:w-auto"
              onClick={handleEndCall}
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z" />
              </svg>
              Finalizar Llamada
            </Button>
          )}

          {dialerState === 'logging' && (
            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              <Button
                variant="ghost"
                onClick={() => setDialerState('idle')}
              >
                Descartar Registro
              </Button>
              <Button
                variant="primary"
                onClick={handleSubmitInteraction}
                disabled={!selectedResult}
              >
                Guardar Gestión y Siguiente
              </Button>
            </div>
          )}

          {dialerState === 'submitting' && (
            <Button variant="primary" isLoading disabled className="w-full sm:w-auto">
              Guardando en Supabase...
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
};

