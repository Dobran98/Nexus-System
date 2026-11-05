/**
 * Tipos autogenerados y contratos del SDK de base de datos Supabase
 * para el ecosistema NEXUS SYSTEM.
 * Generado a partir de las migraciones SQL 0001 a 0005.
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
          ip_address: string | null;
          user_agent: string | null;
          content_hash: string;
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
          sla_breached: boolean;
          resolution_notes: string | null;
          created_at: string;
          updated_at: string;
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
          sla_due_date?: string;
          sla_breached?: boolean;
          resolution_notes?: string | null;
          created_at?: string;
          updated_at?: string;
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
          sla_breached?: boolean;
          resolution_notes?: string | null;
          created_at?: string;
          updated_at?: string;
          resolved_at?: string | null;
          closed_at?: string | null;
        };
      };
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
    };
  };
}

