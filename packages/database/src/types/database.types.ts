/**
 * Tipos autogenerados y contratos del SDK de base de datos Supabase
 * para el ecosistema NEXUS SYSTEM.
 * Sincronizado integralmente a partir de las migraciones SQL 0001 a 0005.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      // ─── 0001: Core y Seguridad ──────────────────────────────────────────
      roles: {
        Row: {
          id: string;
          name: 'superadmin' | 'module_admin' | 'supervisor' | 'multi_operator' | 'data_analyst' | 'auditor';
          description: string | null;
          privilege_level: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: 'superadmin' | 'module_admin' | 'supervisor' | 'multi_operator' | 'data_analyst' | 'auditor';
          description?: string | null;
          privilege_level?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: 'superadmin' | 'module_admin' | 'supervisor' | 'multi_operator' | 'data_analyst' | 'auditor';
          description?: string | null;
          privilege_level?: number;
          created_at?: string;
        };
      };
      profiles: {
        Row: {
          id: string;
          document_id: string;
          full_name: string;
          phone_number: string | null;
          address: string | null;
          is_active: boolean;
          last_profile_edit_at: string | null;
          profile_edit_count_week: number;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          document_id: string;
          full_name: string;
          phone_number?: string | null;
          address?: string | null;
          is_active?: boolean;
          last_profile_edit_at?: string | null;
          profile_edit_count_week?: number;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          document_id?: string;
          full_name?: string;
          phone_number?: string | null;
          address?: string | null;
          is_active?: boolean;
          last_profile_edit_at?: string | null;
          profile_edit_count_week?: number;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      user_roles: {
        Row: {
          id: string;
          user_id: string;
          role_id: string;
          assigned_by: string | null;
          assigned_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          role_id: string;
          assigned_by?: string | null;
          assigned_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          role_id?: string;
          assigned_by?: string | null;
          assigned_at?: string;
        };
      };
      audit_logs: {
        Row: {
          id: string;
          actor_id: string | null;
          action: 'INSERT' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'ROLE_ASSIGN' | 'ROLE_REVOKE' | 'BULK_UPLOAD' | 'EXPORT' | 'RLS_BYPASS';
          entity_name: string;
          entity_id: string;
          old_data: Json | null;
          new_data: Json | null;
          diff: Json | null;
          ip_address: string | null;
          user_agent: string | null;
          sha256_hash: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          actor_id?: string | null;
          action: 'INSERT' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'ROLE_ASSIGN' | 'ROLE_REVOKE' | 'BULK_UPLOAD' | 'EXPORT' | 'RLS_BYPASS';
          entity_name: string;
          entity_id: string;
          old_data?: Json | null;
          new_data?: Json | null;
          ip_address?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          actor_id?: string | null;
          action?: 'INSERT' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'ROLE_ASSIGN' | 'ROLE_REVOKE' | 'BULK_UPLOAD' | 'EXPORT' | 'RLS_BYPASS';
          entity_name?: string;
          entity_id?: string;
          old_data?: Json | null;
          new_data?: Json | null;
          ip_address?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
      };

      // ─── 0002: Asistencia y Telemetría ────────────────────────────────────
      attendance_records: {
        Row: {
          id: string;
          user_id: string;
          work_date: string;
          status: 'present' | 'late' | 'absent' | 'excused';
          total_active_seconds: number;
          clock_in_summary: string | null;
          clock_out_summary: string | null;
          break_total_seconds: number | null;
          supervisor_note: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          work_date: string;
          status: 'present' | 'late' | 'absent' | 'excused';
          total_active_seconds?: number;
          clock_in_summary?: string | null;
          clock_out_summary?: string | null;
          break_total_seconds?: number | null;
          supervisor_note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          work_date?: string;
          status?: 'present' | 'late' | 'absent' | 'excused';
          total_active_seconds?: number;
          clock_in_summary?: string | null;
          clock_out_summary?: string | null;
          break_total_seconds?: number | null;
          supervisor_note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      clock_events: {
        Row: {
          id: string;
          attendance_id: string;
          event_type: 'clock_in' | 'break_start' | 'break_end' | 'clock_out';
          event_timestamp: string;
          verification_method: 'qr_scan' | 'biometric' | 'manual_supervisor';
          latitude: number | null;
          longitude: number | null;
          device_fingerprint: string;
          metadata: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          attendance_id: string;
          event_type: 'clock_in' | 'break_start' | 'break_end' | 'clock_out';
          event_timestamp?: string;
          verification_method: 'qr_scan' | 'biometric' | 'manual_supervisor';
          latitude?: number | null;
          longitude?: number | null;
          device_fingerprint: string;
          metadata?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          attendance_id?: string;
          event_type?: 'clock_in' | 'break_start' | 'break_end' | 'clock_out';
          event_timestamp?: string;
          verification_method?: 'qr_scan' | 'biometric' | 'manual_supervisor';
          latitude?: number | null;
          longitude?: number | null;
          device_fingerprint?: string;
          metadata?: Json | null;
          created_at?: string;
        };
      };
      workflow_latency_logs: {
        Row: {
          id: string;
          user_id: string;
          attendance_id: string;
          clock_in_time: string;
          first_task_event_time: string | null;
          latency_seconds: number | null;
          task_module: 'calls' | 'oriana_analysis' | 'incidents';
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          attendance_id: string;
          clock_in_time: string;
          first_task_event_time?: string | null;
          task_module: 'calls' | 'oriana_analysis' | 'incidents';
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          attendance_id?: string;
          clock_in_time?: string;
          first_task_event_time?: string | null;
          task_module?: 'calls' | 'oriana_analysis' | 'incidents';
          created_at?: string;
        };
      };
      telemetry_daily_aggregates: {
        Row: {
          id: string;
          summary_date: string;
          task_module: 'calls' | 'oriana_analysis' | 'incidents';
          total_events: number;
          avg_latency_sec: number;
          min_latency_sec: number | null;
          max_latency_sec: number | null;
          p50_latency_sec: number | null;
          p95_latency_sec: number | null;
          total_operators: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          summary_date: string;
          task_module: 'calls' | 'oriana_analysis' | 'incidents';
          total_events?: number;
          avg_latency_sec?: number;
          min_latency_sec?: number | null;
          max_latency_sec?: number | null;
          p50_latency_sec?: number | null;
          p95_latency_sec?: number | null;
          total_operators?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          summary_date?: string;
          task_module?: 'calls' | 'oriana_analysis' | 'incidents';
          total_events?: number;
          avg_latency_sec?: number;
          min_latency_sec?: number | null;
          max_latency_sec?: number | null;
          p50_latency_sec?: number | null;
          p95_latency_sec?: number | null;
          total_operators?: number | null;
          created_at?: string;
        };
      };

      // ─── 0003: Telefonía Samsung e Incidencias ───────────────────────────
      corporate_devices: {
        Row: {
          id: string;
          assigned_user_id: string | null;
          imei: string;
          imei2: string | null;
          phone_number: string;
          model: string;
          android_version: string | null;
          knox_version: string | null;
          knox_enrollment_id: string | null;
          battery_health_pct: number | null;
          storage_free_gb: number | null;
          status: 'available' | 'assigned' | 'maintenance' | 'lost' | 'decommissioned';
          last_seen_at: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          assigned_user_id?: string | null;
          imei: string;
          imei2?: string | null;
          phone_number: string;
          model: string;
          android_version?: string | null;
          knox_version?: string | null;
          knox_enrollment_id?: string | null;
          battery_health_pct?: number | null;
          storage_free_gb?: number | null;
          status?: 'available' | 'assigned' | 'maintenance' | 'lost' | 'decommissioned';
          last_seen_at?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          assigned_user_id?: string | null;
          imei?: string;
          imei2?: string | null;
          phone_number?: string;
          model?: string;
          android_version?: string | null;
          knox_version?: string | null;
          knox_enrollment_id?: string | null;
          battery_health_pct?: number | null;
          storage_free_gb?: number | null;
          status?: 'available' | 'assigned' | 'maintenance' | 'lost' | 'decommissioned';
          last_seen_at?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      call_campaigns: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          status: 'draft' | 'active' | 'paused' | 'completed';
          daily_quota_per_operator: number;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          description?: string | null;
          status?: 'draft' | 'active' | 'paused' | 'completed';
          daily_quota_per_operator?: number;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          description?: string | null;
          status?: 'draft' | 'active' | 'paused' | 'completed';
          daily_quota_per_operator?: number;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      call_assignments: {
        Row: {
          id: string;
          campaign_id: string;
          operator_id: string;
          customer_phone: string;
          customer_name: string | null;
          priority: number;
          state: 'queued' | 'calling' | 'completed' | 'rescheduled';
          rescheduled_for: string | null;
          assigned_at: string;
        };
        Insert: {
          id?: string;
          campaign_id: string;
          operator_id: string;
          customer_phone: string;
          customer_name?: string | null;
          priority?: number;
          state?: 'queued' | 'calling' | 'completed' | 'rescheduled';
          rescheduled_for?: string | null;
          assigned_at?: string;
        };
        Update: {
          id?: string;
          campaign_id?: string;
          operator_id?: string;
          customer_phone?: string;
          customer_name?: string | null;
          priority?: number;
          state?: 'queued' | 'calling' | 'completed' | 'rescheduled';
          rescheduled_for?: string | null;
          assigned_at?: string;
        };
      };
      call_interactions: {
        Row: {
          id: string;
          assignment_id: string;
          operator_id: string;
          device_id: string;
          start_time: string;
          end_time: string;
          duration_seconds: number;
          result: 'answered_effective' | 'busy' | 'no_answer' | 'invalid_number' | 'rejected';
          idle_time_prior_call: number;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          assignment_id: string;
          operator_id: string;
          device_id: string;
          start_time: string;
          end_time: string;
          result: 'answered_effective' | 'busy' | 'no_answer' | 'invalid_number' | 'rejected';
          idle_time_prior_call?: number;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          assignment_id?: string;
          operator_id?: string;
          device_id?: string;
          start_time?: string;
          end_time?: string;
          result?: 'answered_effective' | 'busy' | 'no_answer' | 'invalid_number' | 'rejected';
          idle_time_prior_call?: number;
          notes?: string | null;
          created_at?: string;
        };
      };
      call_daily_aggregates: {
        Row: {
          id: string;
          summary_date: string;
          operator_id: string;
          campaign_id: string | null;
          total_calls: number;
          effective_calls: number;
          busy_calls: number;
          no_answer_calls: number;
          invalid_calls: number;
          rejected_calls: number;
          avg_duration_sec: number | null;
          avg_idle_time_prior_sec: number | null;
          daily_quota_met: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          summary_date: string;
          operator_id: string;
          campaign_id?: string | null;
          total_calls?: number;
          effective_calls?: number;
          busy_calls?: number;
          no_answer_calls?: number;
          invalid_calls?: number;
          rejected_calls?: number;
          avg_duration_sec?: number | null;
          avg_idle_time_prior_sec?: number | null;
          daily_quota_met?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          summary_date?: string;
          operator_id?: string;
          campaign_id?: string | null;
          total_calls?: number;
          effective_calls?: number;
          busy_calls?: number;
          no_answer_calls?: number;
          invalid_calls?: number;
          rejected_calls?: number;
          avg_duration_sec?: number | null;
          avg_idle_time_prior_sec?: number | null;
          daily_quota_met?: boolean;
          created_at?: string;
        };
      };
      incidents: {
        Row: {
          id: string;
          reporter_id: string;
          assigned_to: string | null;
          title: string;
          description: string;
          severity: 'low' | 'medium' | 'high' | 'critical';
          status: 'open' | 'investigating' | 'resolved' | 'closed';
          sla_due_date: string;
          resolution_notes: string | null;
          created_at: string;
          resolved_at: string | null;
          closed_at: string | null;
        };
        Insert: {
          id?: string;
          reporter_id: string;
          assigned_to?: string | null;
          title: string;
          description: string;
          severity: 'low' | 'medium' | 'high' | 'critical';
          status?: 'open' | 'investigating' | 'resolved' | 'closed';
          sla_due_date: string;
          resolution_notes?: string | null;
          created_at?: string;
          resolved_at?: string | null;
          closed_at?: string | null;
        };
        Update: {
          id?: string;
          reporter_id?: string;
          assigned_to?: string | null;
          title?: string;
          description?: string;
          severity?: 'low' | 'medium' | 'high' | 'critical';
          status?: 'open' | 'investigating' | 'resolved' | 'closed';
          sla_due_date?: string;
          resolution_notes?: string | null;
          created_at?: string;
          resolved_at?: string | null;
          closed_at?: string | null;
        };
      };

      // ─── 0004: Reportería Oriana ──────────────────────────────────────────
      oriana_reports: {
        Row: {
          id: string;
          analyst_id: string;
          report_title: string;
          batch_reference: string;
          total_records: number;
          processed_records: number;
          status: 'draft' | 'review_pending' | 'approved' | 'rejected';
          submission_deadline: string;
          reviewer_id: string | null;
          reviewer_notes: string | null;
          reviewed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          analyst_id: string;
          report_title: string;
          batch_reference: string;
          total_records: number;
          processed_records?: number;
          status?: 'draft' | 'review_pending' | 'approved' | 'rejected';
          submission_deadline: string;
          reviewer_id?: string | null;
          reviewer_notes?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          analyst_id?: string;
          report_title?: string;
          batch_reference?: string;
          total_records?: number;
          processed_records?: number;
          status?: 'draft' | 'review_pending' | 'approved' | 'rejected';
          submission_deadline?: string;
          reviewer_id?: string | null;
          reviewer_notes?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      oriana_metrics: {
        Row: {
          id: string;
          report_id: string;
          validation_accuracy: number;
          discrepancy_count: number;
          processing_time_minutes: number;
          records_per_hour: number | null;
          audit_notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          report_id: string;
          validation_accuracy: number;
          discrepancy_count?: number;
          processing_time_minutes: number;
          records_per_hour?: number | null;
          audit_notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          report_id?: string;
          validation_accuracy?: number;
          discrepancy_count?: number;
          processing_time_minutes?: number;
          records_per_hour?: number | null;
          audit_notes?: string | null;
          created_at?: string;
        };
      };
      data_analysis_submissions: {
        Row: {
          id: string;
          report_id: string;
          record_hash: string;
          input_data: Json;
          validation_state: 'valid' | 'discrepant' | 'ignored';
          analyst_note: string | null;
          validated_at: string;
        };
        Insert: {
          id?: string;
          report_id: string;
          record_hash: string;
          input_data: Json;
          validation_state: 'valid' | 'discrepant' | 'ignored';
          analyst_note?: string | null;
          validated_at?: string;
        };
        Update: {
          id?: string;
          report_id?: string;
          record_hash?: string;
          input_data?: Json;
          validation_state?: 'valid' | 'discrepant' | 'ignored';
          analyst_note?: string | null;
          validated_at?: string;
        };
      };
      registros: {
        Row: {
          id: number;
          id_operador: string | null;
          fecha_registro: string;
          fecha_reporte: string;
          usuario_operador: string;
          modo_trabajo: string;
          campana: string;
          llamadas_efectivas: number;
          llamadas_totales: number;
          incidencias_reportadas: number;
          estados_abarcados: string | null;
          municipios_detalles: string | null;
          admin_efectivas: number | null;
          admin_incidencias: number | null;
          variables: Json | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          id_operador?: string | null;
          fecha_registro?: string;
          fecha_reporte: string;
          usuario_operador: string;
          modo_trabajo: string;
          campana: string;
          llamadas_efectivas?: number;
          llamadas_totales?: number;
          incidencias_reportadas?: number;
          estados_abarcados?: string | null;
          municipios_detalles?: string | null;
          admin_efectivas?: number | null;
          admin_incidencias?: number | null;
          variables?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          id_operador?: string | null;
          fecha_registro?: string;
          fecha_reporte?: string;
          usuario_operador?: string;
          modo_trabajo?: string;
          campana?: string;
          llamadas_efectivas?: number;
          llamadas_totales?: number;
          incidencias_reportadas?: number;
          estados_abarcados?: string | null;
          municipios_detalles?: string | null;
          admin_efectivas?: number | null;
          admin_incidencias?: number | null;
          variables?: Json | null;
          created_at?: string;
        };
      };
      registros_daily_aggregates: {
        Row: {
          id: string;
          summary_date: string;
          usuario_operador: string;
          modo_trabajo: string;
          total_registros: number;
          total_llamadas_efectivas: number | null;
          total_llamadas_totales: number | null;
          total_incidencias: number | null;
          tasa_efectividad: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          summary_date: string;
          usuario_operador: string;
          modo_trabajo: string;
          total_registros?: number;
          total_llamadas_efectivas?: number | null;
          total_llamadas_totales?: number | null;
          total_incidencias?: number | null;
          tasa_efectividad?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          summary_date?: string;
          usuario_operador?: string;
          modo_trabajo?: string;
          total_registros?: number;
          total_llamadas_efectivas?: number | null;
          total_llamadas_totales?: number | null;
          total_incidencias?: number | null;
          tasa_efectividad?: number | null;
          created_at?: string;
        };
      };
      configuracion: {
        Row: {
          modo: string;
          campanas: string;
          detalle: Json | null;
          updated_at: string;
        };
        Insert: {
          modo: string;
          campanas: string;
          detalle?: Json | null;
          updated_at?: string;
        };
        Update: {
          modo?: string;
          campanas?: string;
          detalle?: Json | null;
          updated_at?: string;
        };
      };
      config_variables: {
        Row: {
          id: number;
          modo: string;
          variable: string;
          etiqueta: string | null;
          tipo: 'NUMERO' | 'TEXTO' | 'BOOLEANO' | 'LISTA' | null;
          obligatorio: boolean;
          depende_de: string | null;
          updated_at: string;
        };
        Insert: {
          id?: number;
          modo: string;
          variable: string;
          etiqueta?: string | null;
          tipo?: 'NUMERO' | 'TEXTO' | 'BOOLEANO' | 'LISTA' | null;
          obligatorio?: boolean;
          depende_de?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: number;
          modo?: string;
          variable?: string;
          etiqueta?: string | null;
          tipo?: 'NUMERO' | 'TEXTO' | 'BOOLEANO' | 'LISTA' | null;
          obligatorio?: boolean;
          depende_de?: string | null;
          updated_at?: string;
        };
      };
      config_destinatarios: {
        Row: {
          id: number;
          chat_id: string;
          frecuencia: 'DIARIO' | 'SEMANAL' | null;
          activo: boolean;
          updated_at: string;
        };
        Insert: {
          id?: number;
          chat_id: string;
          frecuencia?: 'DIARIO' | 'SEMANAL' | null;
          activo?: boolean;
          updated_at?: string;
        };
        Update: {
          id?: number;
          chat_id?: string;
          frecuencia?: 'DIARIO' | 'SEMANAL' | null;
          activo?: boolean;
          updated_at?: string;
        };
      };
      config_emojis: {
        Row: {
          id: number;
          tipo: 'MODO' | 'CAMPAÑA' | 'VARIABLE';
          nombre: string;
          emoji: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          tipo: 'MODO' | 'CAMPAÑA' | 'VARIABLE';
          nombre: string;
          emoji: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          tipo?: 'MODO' | 'CAMPAÑA' | 'VARIABLE';
          nombre?: string;
          emoji?: string;
          updated_at?: string;
        };
      };
      cola_telegram: {
        Row: {
          id_cola: string;
          fecha_encola: string;
          estado: 'PENDIENTE' | 'ENVIADO' | 'ERROR' | 'REINTENTO';
          intentos: number;
          payload: Json;
          error_detail: string | null;
          updated_at: string;
        };
        Insert: {
          id_cola?: string;
          fecha_encola?: string;
          estado?: 'PENDIENTE' | 'ENVIADO' | 'ERROR' | 'REINTENTO';
          intentos?: number;
          payload: Json;
          error_detail?: string | null;
          updated_at?: string;
        };
        Update: {
          id_cola?: string;
          fecha_encola?: string;
          estado?: 'PENDIENTE' | 'ENVIADO' | 'ERROR' | 'REINTENTO';
          intentos?: number;
          payload?: Json;
          error_detail?: string | null;
          updated_at?: string;
        };
      };
      logs_auditoria: {
        Row: {
          id: number;
          fecha_hora: string;
          usuario: string | null;
          accion: string | null;
          detalle: string | null;
          rol: string | null;
        };
        Insert: {
          id?: number;
          fecha_hora?: string;
          usuario?: string | null;
          accion?: string | null;
          detalle?: string | null;
          rol?: string | null;
        };
        Update: {
          id?: number;
          fecha_hora?: string;
          usuario?: string | null;
          accion?: string | null;
          detalle?: string | null;
          rol?: string | null;
        };
      };

      // ─── 0005: Scoring y Particionado ────────────────────────────────────
      dynamic_evaluation_rules: {
        Row: {
          id: string;
          role_type: 'calls' | 'oriana_analysis' | 'incidents' | 'attendance';
          metric_identifier: string;
          display_name: string;
          weight_percentage: number;
          benchmark_target: number;
          is_higher_better: boolean;
          unit: string | null;
          description: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          role_type: 'calls' | 'oriana_analysis' | 'incidents' | 'attendance';
          metric_identifier: string;
          display_name: string;
          weight_percentage: number;
          benchmark_target: number;
          is_higher_better?: boolean;
          unit?: string | null;
          description?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          role_type?: 'calls' | 'oriana_analysis' | 'incidents' | 'attendance';
          metric_identifier?: string;
          display_name?: string;
          weight_percentage?: number;
          benchmark_target?: number;
          is_higher_better?: boolean;
          unit?: string | null;
          description?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      daily_scores: {
        Row: {
          id: string;
          user_id: string;
          score_date: string;
          final_score: number;
          score_breakdown: Json;
          total_minutes: number;
          dominant_role: 'calls' | 'oriana_analysis' | 'incidents' | 'attendance' | null;
          is_hybrid_day: boolean;
          calculated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          score_date: string;
          final_score: number;
          score_breakdown?: Json;
          total_minutes?: number;
          dominant_role?: 'calls' | 'oriana_analysis' | 'incidents' | 'attendance' | null;
          is_hybrid_day?: boolean;
          calculated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          score_date?: string;
          final_score?: number;
          score_breakdown?: Json;
          total_minutes?: number;
          dominant_role?: 'calls' | 'oriana_analysis' | 'incidents' | 'attendance' | null;
          is_hybrid_day?: boolean;
          calculated_at?: string;
        };
      };
      workflow_latency_logs_partitioned: {
        Row: {
          id: string;
          user_id: string;
          attendance_id: string;
          clock_in_time: string;
          first_task_event_time: string | null;
          task_module: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          attendance_id: string;
          clock_in_time: string;
          first_task_event_time?: string | null;
          task_module: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          attendance_id?: string;
          clock_in_time?: string;
          first_task_event_time?: string | null;
          task_module?: string;
          created_at?: string;
        };
      };
    };

    Views: {
      v_daily_call_performance: {
        Row: {
          operator_id: string;
          operator_name: string;
          work_date: string;
          total_calls: number;
          effective_calls: number;
          busy_calls: number;
          no_answer_calls: number;
          effective_rate_pct: number;
          avg_duration_sec: number;
          avg_idle_sec: number;
          calls_with_excessive_idle: number;
        };
      };
      v_incidents_sla_status: {
        Row: {
          id: string;
          title: string;
          severity: 'low' | 'medium' | 'high' | 'critical';
          status: 'open' | 'investigating' | 'resolved' | 'closed';
          sla_due_date: string;
          sla_breached: boolean;
          reporter_name: string;
          assigned_to_name: string | null;
          sla_state: 'CUMPLIDO' | 'INCUMPLIDO' | 'EN_RIESGO' | 'EN_TIEMPO';
          seconds_until_sla: number;
          created_at: string;
          resolved_at: string | null;
        };
      };
      v_oriana_reports_summary: {
        Row: {
          id: string;
          report_title: string;
          batch_reference: string;
          status: string;
          analyst_name: string;
          total_records: number;
          processed_records: number;
          progress_pct: number;
          validation_accuracy: number | null;
          discrepancy_count: number | null;
          processing_time_minutes: number | null;
          submission_deadline: string;
          sla_status: string;
        };
      };
      v_analyst_daily_performance: {
        Row: {
          usuario_operador: string;
          work_date: string;
          modo_trabajo: string;
          total_registros: number;
          total_efectivas: number;
          total_llamadas: number;
          total_incidencias: number;
          tasa_efectividad_pct: number;
        };
      };
      v_weekly_operator_ranking: {
        Row: {
          user_id: string;
          operator_name: string;
          avg_score_week: number;
          total_minutes_week: number;
          days_scored: number;
          best_day_score: number;
          worst_day_score: number;
          green_days: number;
          red_days: number;
          ranking_position: number;
        };
      };
    };
  };
}
