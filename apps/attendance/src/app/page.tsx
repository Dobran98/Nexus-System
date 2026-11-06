'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Database } from '@intranet/database';
import { captureDeviceContext } from '@intranet/telemetry';

// ─── Tipos ───────────────────────────────────────────────────────────────────

type AttendanceRecord = Database['public']['Tables']['attendance_records']['Row'];
type ClockEvent       = Database['public']['Tables']['clock_events']['Row'];

type EventType    = 'clock_in' | 'break_start' | 'break_end' | 'clock_out';
type VerifMethod  = 'qr_scan' | 'biometric' | 'manual_supervisor';

type ClockState = 'idle' | 'clocked_in' | 'on_break' | 'clocked_out';

interface AttendanceState {
  clockState: ClockState;
  attendanceId: string | null;
  clockInTime: Date | null;
  totalActiveSeconds: number;
}

interface QrScanPayload {
  userId: string;
  eventType: EventType;
  timestamp: string;
  checksum: string;
}

// ─── Componente principal ─────────────────────────────────────────────────────

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
  const [scanning, setScanning] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  // Contador de tiempo activo
  useEffect(() => {
    if (state.clockState !== 'clocked_in') return;
    const interval = setInterval(() => {
      setElapsed((s) => s + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [state.clockState]);

  // Obtener geolocalización
  const requestGeolocation = useCallback(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setGeolocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setMessage({ type: 'info', text: 'Geolocalización no disponible. Se registrará sin coordenadas.' })
    );
  }, []);

  // Formateo de tiempo
  const formatTime = (seconds: number): string => {
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  // Acción de marcación
  const handleClockAction = async (eventType: EventType) => {
    setLoading(true);
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
      if (!res.ok) throw new Error(data.error ?? 'Error desconocido');

      const newState: Partial<AttendanceState> = {};
      if (eventType === 'clock_in') {
        newState.clockState    = 'clocked_in';
        newState.attendanceId  = data.attendance_id;
        newState.clockInTime   = new Date();
        setElapsed(0);
      } else if (eventType === 'break_start') {
        newState.clockState = 'on_break';
      } else if (eventType === 'break_end') {
        newState.clockState = 'clocked_in';
      } else if (eventType === 'clock_out') {
        newState.clockState            = 'clocked_out';
        newState.totalActiveSeconds    = elapsed;
      }

      setState((prev) => ({ ...prev, ...newState }));
      setMessage({ type: 'success', text: `✓ ${eventType.replace('_', ' ')} registrado correctamente` });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-slate-950 p-6 flex items-center justify-center">
      <div className="w-full max-w-md space-y-6">

        {/* Header */}
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-50">Control de Asistencia</h1>
          <p className="text-slate-400 text-sm mt-1">Nexus System · Módulo Biométrico/QR</p>
        </div>

        {/* Estado actual */}
        <div className="bg-slate-900 rounded-xl p-6 border border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <span className="text-slate-400 text-sm">Estado</span>
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
              state.clockState === 'clocked_in'  ? 'bg-emerald-500/20 text-emerald-400' :
              state.clockState === 'on_break'    ? 'bg-amber-500/20 text-amber-400' :
              state.clockState === 'clocked_out' ? 'bg-slate-500/20 text-slate-400' :
              'bg-blue-500/20 text-blue-400'
            }`}>
              {state.clockState === 'idle'        ? 'Sin registrar'  :
               state.clockState === 'clocked_in'  ? 'En turno'       :
               state.clockState === 'on_break'    ? 'En descanso'    :
               'Turno finalizado'}
            </span>
          </div>

          {/* Contador */}
          {state.clockState === 'clocked_in' && (
            <div className="text-center py-4">
              <div className="text-5xl font-mono font-bold text-emerald-400">
                {formatTime(elapsed)}
              </div>
              <p className="text-slate-500 text-xs mt-2">Tiempo activo en turno</p>
            </div>
          )}

          {/* Coordenadas */}
          {geolocation && (
            <div className="mt-3 text-xs text-slate-500 text-center">
              📍 {geolocation.lat.toFixed(6)}, {geolocation.lng.toFixed(6)}
            </div>
          )}
        </div>

        {/* Método de verificación */}
        <div className="bg-slate-900 rounded-xl p-4 border border-slate-800">
          <p className="text-slate-400 text-xs mb-3">Método de verificación</p>
          <div className="flex gap-2">
            {(['qr_scan', 'biometric', 'manual_supervisor'] as VerifMethod[]).map((m) => (
              <button
                key={m}
                onClick={() => setVerifyMethod(m)}
                className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${
                  verifyMethod === m
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
              >
                {m === 'qr_scan'            ? '📱 QR'       :
                 m === 'biometric'          ? '🔐 Biométrico' :
                 '👤 Supervisor'}
              </button>
            ))}
          </div>
        </div>

        {/* Botones de acción */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => handleClockAction('clock_in')}
            disabled={loading || state.clockState !== 'idle'}
            className="col-span-2 py-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold rounded-xl transition-colors"
          >
            {loading ? 'Registrando...' : '⏱ Iniciar Turno'}
          </button>

          <button
            onClick={() => handleClockAction('break_start')}
            disabled={loading || state.clockState !== 'clocked_in'}
            className="py-3 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-medium rounded-xl transition-colors text-sm"
          >
            ☕ Iniciar Descanso
          </button>

          <button
            onClick={() => handleClockAction('break_end')}
            disabled={loading || state.clockState !== 'on_break'}
            className="py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-medium rounded-xl transition-colors text-sm"
          >
            ▶ Reanudar
          </button>

          <button
            onClick={() => handleClockAction('clock_out')}
            disabled={loading || !['clocked_in', 'on_break'].includes(state.clockState)}
            className="col-span-2 py-4 bg-red-600 hover:bg-red-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold rounded-xl transition-colors"
          >
            🔴 Finalizar Turno
          </button>
        </div>

        {/* Mensaje de estado */}
        {message && (
          <div className={`rounded-xl p-4 text-sm ${
            message.type === 'success' ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400' :
            message.type === 'error'   ? 'bg-red-500/10 border border-red-500/30 text-red-400' :
            'bg-blue-500/10 border border-blue-500/30 text-blue-400'
          }`}>
            {message.text}
          </div>
        )}

      </div>
    </main>
  );
}

