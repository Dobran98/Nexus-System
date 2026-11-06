// =============================================================================
// @intranet/telemetry — SDK para cálculo de latencia de flujo y auditoría
// Nexus System · packages/telemetry
// =============================================================================

import type { Database } from '@intranet/database';

// ─── Tipos ───────────────────────────────────────────────────────────────────

export type TaskModule = 'calls' | 'oriana_analysis' | 'incidents';

export interface LatencyEvent {
  userId: string;
  attendanceId: string;
  clockInTime: Date;
  firstTaskEventTime: Date;
  taskModule: TaskModule;
}

export interface WorkflowLatencyLog {
  user_id: string;
  attendance_id: string;
  clock_in_time: string;        // ISO 8601
  first_task_event_time: string; // ISO 8601
  task_module: TaskModule;
}

export interface DeviceContextMetadata {
  ip_address?: string;
  user_agent?: string;
  device_fingerprint: string;
  latitude?: number;
  longitude?: number;
  timestamp_micros: number;     // microsegundos desde epoch
}

export interface AuditPayload {
  actor_id: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  entity_name: string;
  entity_id: string;
  old_data?: Record<string, unknown>;
  new_data?: Record<string, unknown>;
  ip_address?: string;
  user_agent?: string;
}

// ─── Captura de contexto del dispositivo ─────────────────────────────────────

/**
 * Captura metadata contextual del dispositivo con precisión de microsegundos.
 * Compatible con Samsung Galaxy (Samsung Browser / Chrome Mobile).
 */
export function captureDeviceContext(
  request?: Request
): DeviceContextMetadata {
  const timestampMicros = Math.round(performance.now() * 1000) + Date.now() * 1000;

  const userAgent =
    typeof navigator !== 'undefined' ? navigator.userAgent : request?.headers?.get('user-agent') ?? 'unknown';

  // Fingerprint determinístico basado en UA + timestamp (sin PII adicional)
  const fingerprintRaw = `${userAgent}:${timestampMicros}`;
  const fingerprint = btoa(fingerprintRaw).slice(0, 32);

  return {
    user_agent: userAgent,
    device_fingerprint: fingerprint,
    timestamp_micros: timestampMicros,
  };
}

// ─── Cálculo de latencia ─────────────────────────────────────────────────────

/**
 * Calcula la latencia operativa en segundos entre el clock_in y la primera
 * tarea registrada. Nunca puede ser negativa.
 */
export function calculateLatencySeconds(
  clockInTime: Date,
  firstTaskEventTime: Date
): number {
  const diffMs = firstTaskEventTime.getTime() - clockInTime.getTime();
  return Math.max(0, Math.round(diffMs / 1000));
}

/**
 * Convierte un LatencyEvent al formato de fila para workflow_latency_logs.
 */
export function latencyEventToRow(event: LatencyEvent): WorkflowLatencyLog {
  return {
    user_id: event.userId,
    attendance_id: event.attendanceId,
    clock_in_time: event.clockInTime.toISOString(),
    first_task_event_time: event.firstTaskEventTime.toISOString(),
    task_module: event.taskModule,
  };
}

// ─── Registro de telemetría en Supabase ──────────────────────────────────────

/**
 * Registra un evento de latencia operativa.
 * @param supabase - Cliente Supabase con sesión activa
 * @param event    - Datos del evento de latencia
 */
export async function recordLatencyEvent(
  supabase: ReturnType<typeof import('@supabase/supabase-js').createClient<Database>>,
  event: LatencyEvent
): Promise<{ success: boolean; error?: string }> {
  const row = latencyEventToRow(event);

  const { error } = await supabase
    .from('workflow_latency_logs')
    .insert(row);

  if (error) {
    console.error('[Telemetry] Error al registrar latencia:', error.message);
    return { success: false, error: error.message };
  }

  return { success: true };
}

// ─── Cálculo de idle time entre llamadas ─────────────────────────────────────

/**
 * Calcula el tiempo muerto (idle) entre el fin de una llamada y el inicio
 * de la siguiente, en segundos.
 * Retorna null si no hay llamada previa.
 */
export function calculateIdleTimeBetweenCalls(
  previousCallEndTime: Date | null,
  nextCallStartTime: Date
): number | null {
  if (!previousCallEndTime) return null;
  const diffMs = nextCallStartTime.getTime() - previousCallEndTime.getTime();
  return Math.max(0, Math.round(diffMs / 1000));
}

// ─── Helpers de auditoría ────────────────────────────────────────────────────

/**
 * Registra una entrada de auditoría inmutable.
 * Los triggers de base de datos son la fuente primaria;
 * esta función es para auditoría explícita desde la capa de aplicación.
 */
export async function recordAuditEntry(
  supabase: ReturnType<typeof import('@supabase/supabase-js').createClient<Database>>,
  payload: AuditPayload
): Promise<{ success: boolean; error?: string }> {
  const { error } = await (supabase as any)
    .from('audit_logs')
    .insert({
      actor_id:    payload.actor_id,
      action:      payload.action,
      entity_name: payload.entity_name,
      entity_id:   payload.entity_id,
      old_data:    payload.old_data ?? null,
      new_data:    payload.new_data ?? null,
      ip_address:  payload.ip_address ?? null,
      user_agent:  payload.user_agent ?? null,
    });

  if (error) {
    console.error('[Telemetry] Error al registrar auditoría:', error.message);
    return { success: false, error: error.message };
  }

  return { success: true };
}

// ─── Formateo de duración ────────────────────────────────────────────────────

/**
 * Formatea segundos en string legible HH:MM:SS.
 */
export function formatDuration(totalSeconds: number): string {
  const hours   = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds]
    .map((v) => String(v).padStart(2, '0'))
    .join(':');
}

/**
 * Evalúa si el idle time supera el benchmark de 45 segundos.
 */
export function isIdleTimeExcessive(idleSeconds: number, benchmarkSeconds = 45): boolean {
  return idleSeconds > benchmarkSeconds;
}
