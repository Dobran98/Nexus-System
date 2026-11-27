'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createSupabaseBrowserClient } from '@intranet/auth/client';
import {
  PhoneCall,
  PhoneOff,
  Smartphone,
  Battery,
  Wifi,
  UserCheck,
  Clock,
  CheckCircle2,
  XCircle,
  CalendarClock,
  AlertOctagon,
  Voicemail,
  RefreshCw,
  Power,
  Link2,
  User,
  MessageCircle
} from 'lucide-react';

interface DeviceInfo {
  id: string;
  device_uid: string;
  model: string;
  pairing_pin: string;
  battery_pct: number | null;
  network_type: string | null;
  status: string;
  is_default_dialer: boolean;
}

interface ActiveSession {
  id: string;
  operator_id: string;
  device_id: string;
  campaign_id: string | null;
  pairing_pin_used: string;
  device: DeviceInfo;
}

interface ContactQueueItem {
  id: string;
  campaign_id: string;
  full_name: string;
  phone_number: string;
  document_id: string | null;
  attempt_count: number;
  max_attempts: number;
  last_outcome: string | null;
  status: string;
  metadata?: Record<string, any>;
}

type LiveCallPhase = 'IDLE' | 'DIALING' | 'RINGING' | 'ACTIVE' | 'DISCONNECTED';

export function BrianaRemoteDialerPanel() {
  // Vinculación de dispositivo
  const [loadingSession, setLoadingSession] = useState(true);
  const [session, setSession] = useState<ActiveSession | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [pairingLoading, setPairingLoading] = useState(false);

  // Cola de contactos
  const [contact, setContact] = useState<ContactQueueItem | null>(null);
  const [loadingContact, setLoadingContact] = useState(false);

  // Estado de llamada en tiempo real
  const [callPhase, setCallPhase] = useState<LiveCallPhase>('IDLE');
  const [activeCallUuid, setActiveCallUuid] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [talkSeconds, setTalkSeconds] = useState(0);
  const [initiatedFrom, setInitiatedFrom] = useState<string>('pc_web');
  const [callChannel, setCallChannel] = useState<'sim' | 'whatsapp'>('sim');
  const [endedBy, setEndedBy] = useState<string | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Modal obligatorio post-llamada (solo cuando isConnected === true)
  const [showDispositionModal, setShowDispositionModal] = useState(false);
  const [dispositionOutcome, setDispositionOutcome] = useState<string>('efectiva');
  const [dispositionSubOption, setDispositionSubOption] = useState<'buzon_de_voz' | 'cortada_no_efectiva'>('buzon_de_voz');
  const [dispositionNotes, setDispositionNotes] = useState('');
  const [scheduledFor, setScheduledFor] = useState('');
  const [submittingDisposition, setSubmittingDisposition] = useState(false);

  // Feedback / Toast
  const [notice, setNotice] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const loadActiveSession = useCallback(async () => {
    setLoadingSession(true);
    try {
      const res = await fetch('/api/briana/pairing');
      const data = await res.json();
      if (res.ok && data.session) {
        setSession(data.session);
      } else {
        setSession(null);
      }
    } catch {
      setSession(null);
    } finally {
      setLoadingSession(false);
    }
  }, []);

  const fetchNextContact = useCallback(async () => {
    setLoadingContact(true);
    try {
      const res = await fetch('/api/briana/queue');
      const data = await res.json();
      if (res.ok) {
        setContact(data.contact || null);
      }
    } catch (err) {
      console.error('Error cargando cola Briana:', err);
    } finally {
      setLoadingContact(false);
    }
  }, []);

  useEffect(() => {
    loadActiveSession();
  }, [loadActiveSession]);

  useEffect(() => {
    if (session && !contact && !showDispositionModal) {
      fetchNextContact();
    }
  }, [session, contact, showDispositionModal, fetchNextContact]);

  // Cronómetro de conversación real cuando entra en ACTIVE
  useEffect(() => {
    if (callPhase === 'ACTIVE') {
      timerRef.current = setInterval(() => {
        setTalkSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [callPhase]);

  // Suscripción Supabase Realtime a call_logs de la sesión activa
  useEffect(() => {
    if (!session) return;
    const supabase = createSupabaseBrowserClient();

    const channel = supabase
      .channel(`briana-session-${session.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'call_logs',
          filter: `session_id=eq.${session.id}`,
        },
        (payload: any) => {
          const row = payload.new;
          if (!row) return;

          setActiveCallUuid(row.call_uuid);
          setInitiatedFrom(row.initiated_from || 'android_app');

          if (row.disconnected_at) {
            setCallPhase('DISCONNECTED');
            setEndedBy(row.ended_by || null);
            const connected = !!row.is_connected;
            setIsConnected(connected);
            if (typeof row.talk_duration_seconds === 'number') {
              setTalkSeconds(row.talk_duration_seconds);
            }

            if (connected) {
              // Conectó -> abrir Modal Obligatorio de Cierre
              setShowDispositionModal(true);
            } else {
              // Nunca conectó -> auto-registrada como No Efectiva -> avanzar cola
              setNotice({
                type: 'info',
                text: `Llamada no conectada (${row.outcome || 'sin_respuesta'}). Registrada automáticamente. Cargando siguiente contacto...`,
              });
              setCallPhase('IDLE');
              setActiveCallUuid(null);
              setContact(null);
              fetchNextContact();
            }
          } else if (row.active_at) {
            setIsConnected(true);
            setCallPhase('ACTIVE');
          } else if (row.ringing_at) {
            setCallPhase('RINGING');
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session, fetchNextContact]);

  // Respaldo de polling ligero mientras hay una llamada activa por si Realtime tarda
  useEffect(() => {
    if (!activeCallUuid || !['DIALING', 'RINGING', 'ACTIVE'].includes(callPhase)) return;

    const poll = setInterval(async () => {
      try {
        const res = await fetch(`/api/briana/telemetry?callUuid=${activeCallUuid}`);
        const data = await res.json();
        const row = data.callLog;
        if (!row) return;

        if (row.disconnected_at) {
          setCallPhase('DISCONNECTED');
          setEndedBy(row.ended_by || null);
          const connected = !!row.is_connected;
          setIsConnected(connected);
          setTalkSeconds(row.talk_duration_seconds || 0);
          if (connected) {
            setShowDispositionModal(true);
          } else {
            setNotice({
              type: 'info',
              text: `Llamada no conectada (${row.outcome || 'sin_respuesta'}). Avance automático de cola.`,
            });
            setCallPhase('IDLE');
            setActiveCallUuid(null);
            setContact(null);
            fetchNextContact();
          }
        } else if (row.active_at && callPhase !== 'ACTIVE') {
          setIsConnected(true);
          setCallPhase('ACTIVE');
        }
      } catch {
        // ignorar fallo transitorio
      }
    }, 2000);

    return () => clearInterval(poll);
  }, [activeCallUuid, callPhase, fetchNextContact]);

  // Acciones de Vinculación
  const handlePairDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    setPairingLoading(true);
    setNotice(null);
    try {
      const res = await fetch('/api/briana/pairing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'pair_session', pairingPin: pinInput }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setNotice({ type: 'error', text: data.error || 'No se pudo vincular el Samsung' });
      } else {
        setNotice({ type: 'success', text: data.message });
        setPinInput('');
        await loadActiveSession();
      }
    } catch (err: any) {
      setNotice({ type: 'error', text: err.message });
    } finally {
      setPairingLoading(false);
    }
  };

  const handleEndShift = async () => {
    if (!session) return;
    try {
      await fetch('/api/briana/pairing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'unpair_session',
          sessionId: session.id,
          deviceId: session.device_id,
        }),
      });
      setSession(null);
      setContact(null);
      setCallPhase('IDLE');
      setNotice({ type: 'info', text: 'Turno finalizado. El Samsung ha sido liberado.' });
    } catch (err: any) {
      setNotice({ type: 'error', text: err.message });
    }
  };

  // Control Bidireccional PC -> Samsung (SIM o WhatsApp)
  const handleDialFromPc = async (channel: 'sim' | 'whatsapp' = 'sim') => {
    if (!contact || !session) return;
    setNotice(null);
    setTalkSeconds(0);
    setIsConnected(false);
    setEndedBy(null);
    setCallChannel(channel);
    setInitiatedFrom('pc_web');
    setCallPhase('DIALING');

    try {
      const res = await fetch('/api/briana/dial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactId: contact.id,
          phoneNumber: contact.phone_number,
          contactName: contact.full_name,
          campaignId: contact.campaign_id,
          channel,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setCallPhase('IDLE');
        setNotice({ type: 'error', text: data.error || 'Error enviando orden de marcado' });
      } else {
        setActiveCallUuid(data.callUuid);
      }
    } catch (err: any) {
      setCallPhase('IDLE');
      setNotice({ type: 'error', text: err.message });
    }
  };

  const handleHangupFromPc = async () => {
    if (!activeCallUuid) return;
    if (callChannel === 'whatsapp' && callPhase === 'DIALING') {
      // Si WhatsApp aún no detectó notificación activa y el operador cancela antes de llamar,
      // restablecemos el estado en PC para que pueda volver a intentar o cambiar de canal.
      setCallPhase('IDLE');
      setActiveCallUuid(null);
      setNotice({ type: 'info', text: 'Espera de llamada WhatsApp cancelada. Puedes volver a marcar.' });
      return;
    }
    try {
      await fetch('/api/briana/hangup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callUuid: activeCallUuid,
          contactId: contact?.id,
        }),
      });
    } catch (err: any) {
      setNotice({ type: 'error', text: err.message });
    }
  };

  // Enviar tipificación obligatoria post-llamada
  const handleSubmitDisposition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCallUuid || !contact) return;

    const finalOutcome =
      dispositionOutcome === 'no_efectiva_group' ? dispositionSubOption : dispositionOutcome;

    if (finalOutcome === 'reprogramada' && !scheduledFor) {
      setNotice({ type: 'error', text: 'Seleccione fecha y hora exacta para reprogramar la llamada.' });
      return;
    }

    setSubmittingDisposition(true);
    try {
      const res = await fetch('/api/briana/disposition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callUuid: activeCallUuid,
          contactId: contact.id,
          outcome: finalOutcome,
          notes: dispositionNotes,
          scheduledFor: finalOutcome === 'reprogramada' ? scheduledFor : null,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setNotice({ type: 'error', text: data.error || 'Error guardando tipificación' });
      } else {
        setShowDispositionModal(false);
        setDispositionNotes('');
        setScheduledFor('');
        setDispositionOutcome('efectiva');
        setCallPhase('IDLE');
        setActiveCallUuid(null);
        setTalkSeconds(0);
        setContact(null);
        setNotice({ type: 'success', text: `Gestión guardada (${finalOutcome}). Cargando siguiente contacto...` });
        await fetchNextContact();
      }
    } catch (err: any) {
      setNotice({ type: 'error', text: err.message });
    } finally {
      setSubmittingDisposition(false);
    }
  };

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  if (loadingSession) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-950 text-slate-400 text-xs font-mono">
        <RefreshCw className="w-4 h-4 animate-spin mr-2 text-sky-400" />
        Verificando vinculación con terminal Samsung...
      </div>
    );
  }

  return (
    <div className="flex-1 w-full bg-slate-950 text-slate-100 overflow-y-auto p-4 sm:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {notice && (
          <div
            className={`p-3.5 rounded-2xl border text-xs font-medium flex items-center justify-between ${
              notice.type === 'success'
                ? 'bg-emerald-950/80 border-emerald-800 text-emerald-300'
                : notice.type === 'error'
                ? 'bg-rose-950/80 border-rose-800 text-rose-300'
                : 'bg-sky-950/80 border-sky-800 text-sky-300'
            }`}
          >
            <span>{notice.text}</span>
            <button onClick={() => setNotice(null)} className="text-slate-400 hover:text-white ml-4">
              ✕
            </button>
          </div>
        )}

        {/* ESTADO 1: SIN TELÉFONO VINCULADO -> INGRESAR PIN BRN-XXXX */}
        {!session ? (
          <div className="max-w-md mx-auto mt-8 p-7 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl space-y-5">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-sky-950 border border-sky-800 flex items-center justify-center text-sky-400">
                <Smartphone className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Vincular Teléfono Samsung (SIM)</h2>
                <p className="text-xs text-slate-400">
                  Abre la app Briana Dialer en tu Samsung A57/A37 e ingresa el código en pantalla.
                </p>
              </div>
            </div>

            <form onSubmit={handlePairDevice} className="space-y-4">
              <div>
                <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1.5">
                  Código de Vinculación (ej. BRN-4829)
                </label>
                <input
                  type="text"
                  required
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value.toUpperCase())}
                  placeholder="BRN-4829"
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-2xl text-center font-mono text-xl font-black tracking-widest text-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <button
                type="submit"
                disabled={pairingLoading}
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-sky-950/50 transition-all disabled:opacity-50"
              >
                <Link2 className="w-4 h-4" />
                <span>{pairingLoading ? 'Vinculando...' : 'Vincular y Comenzar Turno'}</span>
              </button>
            </form>
          </div>
        ) : (
          /* ESTADO 2: SESIÓN ACTIVA CON SAMSUNG VINCULADO */
          <div className="space-y-6">
            {/* Barra de Telemetría del Samsung Vinculado */}
            <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-emerald-950 border border-emerald-800 flex items-center justify-center text-emerald-400">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white flex items-center gap-2">
                    <span>{session.device?.model || 'Samsung Corporativo'}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-950 text-emerald-400 border border-emerald-800">
                      ● {session.pairing_pin_used}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-slate-400 font-mono mt-0.5">
                    <span className="flex items-center gap-1">
                      <Battery className="w-3.5 h-3.5 text-emerald-400" /> {session.device?.battery_pct ?? 100}%
                    </span>
                    <span className="flex items-center gap-1">
                      <Wifi className="w-3.5 h-3.5 text-sky-400" /> {session.device?.network_type || 'WIFI'}
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={handleEndShift}
                disabled={callPhase !== 'IDLE'}
                className="px-3.5 py-2 rounded-xl bg-rose-950/60 hover:bg-rose-900/80 border border-rose-800/60 text-rose-300 text-xs font-bold flex items-center gap-1.5 transition-all disabled:opacity-40"
              >
                <Power className="w-3.5 h-3.5" />
                <span>Cerrar Turno y Liberar Teléfono</span>
              </button>
            </div>

            {/* Tarjeta Principal de Contacto + Marcador Bidireccional */}
            <div className="p-6 sm:p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl space-y-6">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <span className="text-[11px] font-mono uppercase tracking-wider text-sky-400 font-bold">
                    Cola Automática de Campaña
                  </span>
                  <h3 className="text-lg font-extrabold text-white mt-0.5">
                    Estación de Marcado Remoto (SIM Física)
                  </h3>
                </div>
                <button
                  onClick={fetchNextContact}
                  disabled={loadingContact || callPhase !== 'IDLE'}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 flex items-center gap-1.5 disabled:opacity-40"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingContact ? 'animate-spin' : ''}`} />
                  <span>Actualizar Cola</span>
                </button>
              </div>

              {!contact ? (
                <div className="py-12 text-center text-slate-400 text-sm">
                  No hay contactos pendientes asignables en este momento.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                  {/* Datos del Contacto */}
                  <div className="md:col-span-7 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-sky-400">
                        <User className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="text-xl font-black text-white">{contact.full_name}</h4>
                        <p className="text-base font-mono font-bold text-sky-400">{contact.phone_number}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-2 text-xs font-mono">
                      {contact.document_id && (
                        <span className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-300">
                          CI: {contact.document_id}
                        </span>
                      )}
                      <span className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-amber-300">
                        Intento #{contact.attempt_count + 1} de {contact.max_attempts}
                      </span>
                      {contact.last_outcome && (
                        <span className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-400">
                          Último: {contact.last_outcome}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Controles de Llamada en Vivo */}
                  <div className="md:col-span-5 p-5 rounded-2xl bg-slate-950/70 border border-slate-800 flex flex-col items-center space-y-4">
                    <div className="text-center">
                      <span
                        className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-mono font-bold border ${
                          callPhase === 'ACTIVE'
                            ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                            : callPhase === 'DIALING' || callPhase === 'RINGING'
                            ? 'bg-amber-950 text-amber-300 border-amber-800 animate-pulse'
                            : 'bg-slate-900 text-slate-400 border-slate-800'
                        }`}
                      >
                        {callPhase === 'IDLE' && '● LISTO PARA MARCAR'}
                        {callPhase === 'DIALING' && `● ENVIANDO A ${callChannel === 'whatsapp' ? 'WHATSAPP' : 'SAMSUNG'}...`}
                        {callPhase === 'RINGING' && `● TIMBRANDO EN ${callChannel === 'whatsapp' ? 'WHATSAPP' : 'SIM'}...`}
                        {callPhase === 'ACTIVE' && `● CONECTADA (${formatTimer(talkSeconds)})`}
                        {callPhase === 'DISCONNECTED' && '● LLAMADA FINALIZADA'}
                      </span>
                    </div>

                    {callPhase === 'IDLE' ? (
                      <div className="w-full space-y-2.5">
                        <button
                          onClick={() => handleDialFromPc('sim')}
                          className="w-full py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/50 transition-all cursor-pointer"
                        >
                          <PhoneCall className="w-4 h-4" />
                          <span>Llamar por SIM (Samsung)</span>
                        </button>
                        <button
                          onClick={() => handleDialFromPc('whatsapp')}
                          className="w-full py-2.5 rounded-2xl bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 border border-green-500/40 shadow-md transition-all cursor-pointer"
                        >
                          <MessageCircle className="w-4 h-4" />
                          <span>Llamar por WhatsApp</span>
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={handleHangupFromPc}
                        disabled={callPhase === 'DISCONNECTED'}
                        className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-rose-950/50 transition-all cursor-pointer disabled:opacity-50"
                      >
                        <PhoneOff className="w-5 h-5" />
                        <span>
                          {callChannel === 'whatsapp'
                            ? (callPhase === 'DIALING' ? 'Cancelar Espera WhatsApp' : 'Finalizar en Teléfono (WhatsApp)')
                            : 'Colgar Llamada'}
                        </span>
                      </button>
                    )}

                    <p className="text-[11px] text-slate-500 text-center">
                      Origen: <span className="font-mono text-slate-300">{initiatedFrom}</span>
                      {endedBy ? ` · Corte: ${endedBy}` : ''}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* MODAL OBLIGATORIO POST-LLAMADA (SOLO SI CONECTÓ EN STATE_ACTIVE) */}
      {showDispositionModal && contact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-white">Cierre Obligatorio de Llamada</h3>
                <p className="text-xs text-emerald-400 font-mono mt-0.5">
                  Conectada · Duración real: {formatTimer(talkSeconds)} ({talkSeconds}s)
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-mono bg-slate-800 text-slate-300 border border-slate-700">
                {contact.phone_number}
              </span>
            </div>

            <form onSubmit={handleSubmitDisposition} className="p-6 space-y-4">
              <div className="grid grid-cols-1 gap-2.5">
                <label
                  onClick={() => setDispositionOutcome('efectiva')}
                  className={`p-3.5 rounded-2xl border cursor-pointer flex items-center gap-3 transition-all ${
                    dispositionOutcome === 'efectiva'
                      ? 'bg-emerald-950/60 border-emerald-500 text-white'
                      : 'bg-slate-950/50 border-slate-800 text-slate-300'
                  }`}
                >
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  <div>
                    <div className="text-xs font-bold">1. Efectiva (Contacto exitoso con el titular)</div>
                    <div className="text-[11px] text-slate-400">Cierra el caso como completado exitosamente.</div>
                  </div>
                </label>

                <label
                  onClick={() => setDispositionOutcome('no_efectiva_group')}
                  className={`p-3.5 rounded-2xl border cursor-pointer flex items-center gap-3 transition-all ${
                    dispositionOutcome === 'no_efectiva_group'
                      ? 'bg-amber-950/60 border-amber-500 text-white'
                      : 'bg-slate-950/50 border-slate-800 text-slate-300'
                  }`}
                >
                  <Voicemail className="w-5 h-5 text-amber-400 shrink-0" />
                  <div className="flex-1">
                    <div className="text-xs font-bold">2. No efectiva / Buzón de voz / Cortada</div>
                    <div className="text-[11px] text-slate-400">No infla llamadas efectivas; suma intento y vuelve a cola.</div>
                    {dispositionOutcome === 'no_efectiva_group' && (
                      <div className="flex gap-2 mt-2">
                        <button
                          type="button"
                          onClick={() => setDispositionSubOption('buzon_de_voz')}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border ${
                            dispositionSubOption === 'buzon_de_voz'
                              ? 'bg-amber-500 text-slate-950 border-amber-400'
                              : 'bg-slate-900 text-slate-300 border-slate-700'
                          }`}
                        >
                          Buzón de Voz
                        </button>
                        <button
                          type="button"
                          onClick={() => setDispositionSubOption('cortada_no_efectiva')}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border ${
                            dispositionSubOption === 'cortada_no_efectiva'
                              ? 'bg-amber-500 text-slate-950 border-amber-400'
                              : 'bg-slate-900 text-slate-300 border-slate-700'
                          }`}
                        >
                          Cortada / Incompleta
                        </button>
                      </div>
                    )}
                  </div>
                </label>

                <label
                  onClick={() => setDispositionOutcome('reprogramada')}
                  className={`p-3.5 rounded-2xl border cursor-pointer flex items-center gap-3 transition-all ${
                    dispositionOutcome === 'reprogramada'
                      ? 'bg-sky-950/60 border-sky-500 text-white'
                      : 'bg-slate-950/50 border-slate-800 text-slate-300'
                  }`}
                >
                  <CalendarClock className="w-5 h-5 text-sky-400 shrink-0" />
                  <div className="flex-1">
                    <div className="text-xs font-bold">3. Reprogramar llamada</div>
                    <div className="text-[11px] text-slate-400">Agenda fecha y hora exacta para volver a contactar.</div>
                    {dispositionOutcome === 'reprogramada' && (
                      <input
                        type="datetime-local"
                        required
                        value={scheduledFor}
                        onChange={(e) => setScheduledFor(e.target.value)}
                        className="mt-2 w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                      />
                    )}
                  </div>
                </label>

                <label
                  onClick={() => setDispositionOutcome('numero_equivocado')}
                  className={`p-3.5 rounded-2xl border cursor-pointer flex items-center gap-3 transition-all ${
                    dispositionOutcome === 'numero_equivocado'
                      ? 'bg-rose-950/60 border-rose-500 text-white'
                      : 'bg-slate-950/50 border-slate-800 text-slate-300'
                  }`}
                >
                  <AlertOctagon className="w-5 h-5 text-rose-400 shrink-0" />
                  <div>
                    <div className="text-xs font-bold">4. Número equivocado / No pertenece al titular</div>
                    <div className="text-[11px] text-slate-400">Marca como inválido y lo excluye de reintentos.</div>
                  </div>
                </label>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">
                  Notas de la llamada (opcional)
                </label>
                <textarea
                  rows={2}
                  value={dispositionNotes}
                  onChange={(e) => setDispositionNotes(e.target.value)}
                  placeholder="Observaciones relevantes del contacto..."
                  className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>

              <button
                type="submit"
                disabled={submittingDisposition}
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-blue-600 to-sky-600 hover:from-blue-500 hover:to-sky-500 text-white font-extrabold text-xs shadow-lg disabled:opacity-50"
              >
                {submittingDisposition ? 'Guardando y avanzando...' : 'Guardar Tipificación y Siguiente Contacto →'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
