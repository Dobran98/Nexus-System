'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { captureDeviceContext } from '@intranet/telemetry';

type EventType   = 'clock_in' | 'break_start' | 'break_end' | 'clock_out';
type VerifMethod = 'qr_scan' | 'biometric' | 'manual_supervisor';
type ClockState  = 'idle' | 'clocked_in' | 'on_break' | 'clocked_out';

interface AttendanceState {
  clockState: ClockState;
  attendanceId: string | null;
  clockInTime: Date | null;
  totalActiveSeconds: number;
}

export default function AttendancePage() {
  const [state, setState] = useState<AttendanceState>({
    clockState: 'idle',
    attendanceId: null,
    clockInTime: null,
    totalActiveSeconds: 0,
  });

  const [elapsed, setElapsed] = useState<number>(0);
  const [verifyMethod, setVerifyMethod] = useState<VerifMethod>('qr_scan');
  const [geolocation, setGeolocation] = useState<{ lat: number; lng: number } | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [scannerActive, setScannerActive] = useState(false);

  // 1. Cargar estado de asistencia al montar (para no perder el turno al refrescar)
  useEffect(() => {
    async function loadCurrentStatus() {
      try {
        const res = await fetch('/api/attendance/clock');
        if (res.ok) {
          const data = await res.json();
          if (data.record) {
            const lastEvent = data.last_event;
            const isCompleted = lastEvent === 'clock_out' || Boolean(data.record.clock_out_summary);
            const isOnBreak = lastEvent === 'break_start';
            const isClockedIn = (lastEvent === 'clock_in' || lastEvent === 'break_end') && !isCompleted;

            const createdAt = new Date(data.record.clock_in_summary || data.record.created_at);
            const now = new Date();
            const diffSeconds = Math.max(0, Math.floor((now.getTime() - createdAt.getTime()) / 1000));
            const activeSeconds = data.record.total_active_seconds || diffSeconds;

            let currentClockState: ClockState = 'idle';
            if (isCompleted) {
              currentClockState = 'clocked_out';
            } else if (isOnBreak) {
              currentClockState = 'on_break';
            } else if (isClockedIn) {
              currentClockState = 'clocked_in';
            }

            setState({
              clockState: currentClockState,
              attendanceId: data.record.id,
              clockInTime: createdAt,
              totalActiveSeconds: activeSeconds,
            });

            if (currentClockState === 'clocked_in') {
              setElapsed(diffSeconds);
            } else if (currentClockState === 'clocked_out') {
              setElapsed(activeSeconds);
            }
          }
        }
      } catch (err) {
        console.warn('Error al verificar turno previo:', err);
      } finally {
        setInitialLoading(false);
      }
    }

    loadCurrentStatus();
  }, []);

  // 2. Contador de tiempo activo en turno
  useEffect(() => {
    if (state.clockState !== 'clocked_in') return;
    const interval = setInterval(() => {
      setElapsed((s) => s + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [state.clockState]);

  // 3. Geolocalización
  const requestGeolocation = useCallback(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setGeolocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setMessage({ type: 'info', text: 'Geolocalización no disponible. Marcado sin coordenadas GPS.' })
    );
  }, []);

  // 4. Formateo de tiempo (HH:MM:SS)
  const formatTime = (seconds: number): string => {
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  // 5. Acción de marcación (Entrada / Pausa / Reanudar / Salida)
  const handleClockAction = async (eventType: EventType) => {
    setLoading(true);
    setMessage(null);
    requestGeolocation();

    const ctx = captureDeviceContext();

    try {
      const res = await fetch('/api/attendance/clock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_type: eventType,
          verification_method: verifyMethod,
          latitude: geolocation?.lat ?? null,
          longitude: geolocation?.lng ?? null,
          device_fingerprint: ctx.device_fingerprint,
          attendance_id: state.attendanceId,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Error al procesar el marcado');

      const nowTime = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

      if (eventType === 'clock_in') {
        setState({
          clockState: 'clocked_in',
          attendanceId: data.attendance_id,
          clockInTime: new Date(),
          totalActiveSeconds: 0,
        });
        setElapsed(0);
        setMessage({ type: 'success', text: `✓ ENTRADA registrada con éxito a las ${nowTime}` });
      } else if (eventType === 'break_start') {
        setState((prev) => ({ ...prev, clockState: 'on_break' }));
        setMessage({ type: 'info', text: `☕ DESCANSO iniciado a las ${nowTime}` });
      } else if (eventType === 'break_end') {
        setState((prev) => ({ ...prev, clockState: 'clocked_in' }));
        setMessage({ type: 'success', text: `▶ TURNO REANUDADO a las ${nowTime}` });
      } else if (eventType === 'clock_out') {
        setState((prev) => ({
          ...prev,
          clockState: 'clocked_out',
          totalActiveSeconds: elapsed,
        }));
        setMessage({ type: 'success', text: `🔴 SALIDA registrada con éxito a las ${nowTime}. Total trabajado: ${formatTime(elapsed)}` });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
      setScannerActive(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 flex flex-col items-center justify-center">
      <div className="w-full max-w-lg space-y-6">

        {/* Barra superior de navegación */}
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-white transition-colors py-1.5 px-3 rounded-lg bg-slate-900 border border-slate-800"
          >
            ← Volver al Panel
          </Link>
          <span className="text-xs font-mono text-slate-500">Módulo Asistencia v1.0</span>
        </div>

        {/* Tarjeta de Título */}
        <div className="text-center space-y-1">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 mb-2">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
            </svg>
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Registro de Asistencia</h1>
          <p className="text-slate-400 text-xs">Escaneo de Código QR & Marcación Oficial</p>
        </div>

        {/* Estado actual del turno */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Estado de Jornada</span>
            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
              state.clockState === 'clocked_in'  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' :
              state.clockState === 'on_break'    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' :
              state.clockState === 'clocked_out' ? 'bg-slate-700/40 text-slate-400 border border-slate-700' :
              'bg-blue-500/20 text-blue-400 border border-blue-500/40'
            }`}>
              {initialLoading                     ? 'Cargando...'     :
               state.clockState === 'idle'        ? 'Sin entrada'     :
               state.clockState === 'clocked_in'  ? '● En turno activo' :
               state.clockState === 'on_break'    ? '☕ En descanso'   :
               '✓ Turno finalizado'}
            </span>
          </div>

          {/* Cronómetro / Tiempo Transcurrido */}
          <div className="text-center py-4 bg-slate-950/60 rounded-2xl border border-slate-800/80">
            <div className="text-5xl font-mono font-extrabold text-emerald-400 tracking-wider">
              {formatTime(elapsed)}
            </div>
            <p className="text-slate-500 text-xs mt-2 font-medium">
              {state.clockState === 'clocked_in'  ? 'Tiempo activo registrado hoy' :
               state.clockState === 'on_break'    ? 'Pausa de descanso en curso' :
               state.clockState === 'clocked_out' ? 'Jornada concluida' :
               'Horas trabajadas hoy'}
            </p>
          </div>

          {/* Geolocalización */}
          {geolocation && (
            <div className="text-xs text-slate-500 text-center flex items-center justify-center gap-1">
              <span>📍 GPS:</span>
              <span className="font-mono text-slate-400">{geolocation.lat.toFixed(5)}, {geolocation.lng.toFixed(5)}</span>
            </div>
          )}
        </div>

        {/* Selector de Método de Verificación */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Método de Marcación</p>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'qr_scan', label: '📱 Escaneo QR' },
              { id: 'biometric', label: '🔐 Biometría' },
              { id: 'manual_supervisor', label: '👤 Supervisor' },
            ].map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setVerifyMethod(m.id as VerifMethod)}
                className={`py-2 px-3 rounded-xl text-xs font-semibold transition-all ${
                  verifyMethod === m.id
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40'
                    : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Botones de acción principales (ENTRADA / SALIDA / PAUSAS) */}
        <div className="space-y-3">
          {/* Botón de Entrada */}
          {state.clockState === 'idle' && (
            <button
              onClick={() => handleClockAction('clock_in')}
              disabled={loading || initialLoading}
              className="w-full py-4 px-6 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white font-bold text-base rounded-2xl shadow-xl shadow-emerald-950/50 transition-all flex items-center justify-center gap-3"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
              </svg>
              <span>{loading ? 'Validando...' : 'MARCAR ENTRADA (Clock-In)'}</span>
            </button>
          )}

          {/* Botones durante turno activo */}
          {state.clockState === 'clocked_in' && (
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleClockAction('break_start')}
                disabled={loading}
                className="py-3.5 px-4 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-semibold rounded-2xl text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-950/30"
              >
                ☕ Pausa / Descanso
              </button>

              <button
                onClick={() => handleClockAction('clock_out')}
                disabled={loading}
                className="py-3.5 px-4 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-semibold rounded-2xl text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-rose-950/30"
              >
                🔴 MARCAR SALIDA
              </button>
            </div>
          )}

          {/* Botón al reanudar de descanso */}
          {state.clockState === 'on_break' && (
            <button
              onClick={() => handleClockAction('break_end')}
              disabled={loading}
              className="w-full py-4 px-6 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-base rounded-2xl shadow-xl shadow-blue-950/50 transition-all flex items-center justify-center gap-3"
            >
              ▶ REANUDAR TURNO (Fin de descanso)
            </button>
          )}

          {/* Estado de salida completada */}
          {state.clockState === 'clocked_out' && (
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl text-center space-y-2">
              <p className="text-sm font-semibold text-slate-300">✓ Tu jornada de hoy ha sido completada</p>
              <button
                onClick={() => handleClockAction('clock_in')}
                disabled={loading}
                className="text-xs text-blue-400 hover:text-blue-300 underline font-medium"
              >
                ¿Necesitas iniciar un turno adicional? Marcar nueva entrada
              </button>
            </div>
          )}
        </div>

        {/* Mensaje de retroalimentación en pantalla */}
        {message && (
          <div className={`p-4 rounded-2xl text-sm border font-medium ${
            message.type === 'success' ? 'bg-emerald-950/50 border-emerald-800/80 text-emerald-300' :
            message.type === 'error'   ? 'bg-rose-950/50 border-rose-800/80 text-rose-300' :
            'bg-blue-950/50 border-blue-800/80 text-blue-300'
          }`}>
            {message.text}
          </div>
        )}

      </div>
    </main>
  );
}
