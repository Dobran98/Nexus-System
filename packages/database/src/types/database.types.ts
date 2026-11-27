export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "attendance_records": {
                  Row: {
                    "break_total_seconds": number | null,"clock_in_summary": string | null,"clock_out_summary": string | null,"created_at": string,"id": string,"status": string,"supervisor_note": string | null,"total_active_seconds": number,"updated_at": string,"user_id": string,"work_date": string
                  }
                  ComputedFields: never
                  Insert: {
                    "break_total_seconds"?: number | null,"clock_in_summary"?: string | null,"clock_out_summary"?: string | null,"created_at"?: string,"id"?: string,"status": string,"supervisor_note"?: string | null,"total_active_seconds"?: number,"updated_at"?: string,"user_id": string,"work_date": string
                  }
                  Update: {
                    "break_total_seconds"?: number | null,"clock_in_summary"?: string | null,"clock_out_summary"?: string | null,"created_at"?: string,"id"?: string,"status"?: string,"supervisor_note"?: string | null,"total_active_seconds"?: number,"updated_at"?: string,"user_id"?: string,"work_date"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "attendance_records_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"audit_logs": {
                  Row: {
                    "action": string,"actor_id": string | null,"content_hash": string,"created_at": string,"entity_id": string,"entity_name": string,"id": string,"ip_address": unknown,"new_data": Json | null,"old_data": Json | null,"user_agent": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"content_hash"?: never,"created_at"?: string,"entity_id": string,"entity_name": string,"id"?: string,"ip_address"?: unknown,"new_data"?: Json | null,"old_data"?: Json | null,"user_agent"?: string | null
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"content_hash"?: never,"created_at"?: string,"entity_id"?: string,"entity_name"?: string,"id"?: string,"ip_address"?: unknown,"new_data"?: Json | null,"old_data"?: Json | null,"user_agent"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "audit_logs_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"call_assignments": {
                  Row: {
                    "assigned_at": string,"campaign_id": string,"customer_name": string | null,"customer_phone": string,"id": string,"operator_id": string,"priority": number,"rescheduled_for": string | null,"state": string
                  }
                  ComputedFields: never
                  Insert: {
                    "assigned_at"?: string,"campaign_id": string,"customer_name"?: string | null,"customer_phone": string,"id"?: string,"operator_id": string,"priority"?: number,"rescheduled_for"?: string | null,"state"?: string
                  }
                  Update: {
                    "assigned_at"?: string,"campaign_id"?: string,"customer_name"?: string | null,"customer_phone"?: string,"id"?: string,"operator_id"?: string,"priority"?: number,"rescheduled_for"?: string | null,"state"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "call_assignments_campaign_id_fkey"
      columns: ["campaign_id"]
isOneToOne: false
      referencedRelation: "call_campaigns"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "call_assignments_operator_id_fkey"
      columns: ["operator_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"call_campaigns": {
                  Row: {
                    "created_at": string,"created_by": string | null,"daily_quota_per_operator": number,"description": string | null,"id": string,"status": string,"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"daily_quota_per_operator"?: number,"description"?: string | null,"id"?: string,"status"?: string,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"daily_quota_per_operator"?: number,"description"?: string | null,"id"?: string,"status"?: string,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "call_campaigns_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"call_daily_aggregates": {
                  Row: {
                    "avg_duration_sec": number | null,"avg_idle_time_prior_sec": number | null,"busy_calls": number,"campaign_id": string | null,"created_at": string,"daily_quota_met": boolean | null,"effective_calls": number,"id": string,"invalid_calls": number,"no_answer_calls": number,"operator_id": string,"rejected_calls": number,"summary_date": string,"total_calls": number
                  }
                  ComputedFields: never
                  Insert: {
                    "avg_duration_sec"?: number | null,"avg_idle_time_prior_sec"?: number | null,"busy_calls"?: number,"campaign_id"?: string | null,"created_at"?: string,"daily_quota_met"?: boolean | null,"effective_calls"?: number,"id"?: string,"invalid_calls"?: number,"no_answer_calls"?: number,"operator_id": string,"rejected_calls"?: number,"summary_date": string,"total_calls"?: number
                  }
                  Update: {
                    "avg_duration_sec"?: number | null,"avg_idle_time_prior_sec"?: number | null,"busy_calls"?: number,"campaign_id"?: string | null,"created_at"?: string,"daily_quota_met"?: boolean | null,"effective_calls"?: number,"id"?: string,"invalid_calls"?: number,"no_answer_calls"?: number,"operator_id"?: string,"rejected_calls"?: number,"summary_date"?: string,"total_calls"?: number
                  }
                  Relationships: [
                    
                  ]
                },"call_interactions": {
                  Row: {
                    "assignment_id": string,"created_at": string,"device_id": string,"duration_seconds": number | null,"end_time": string,"id": string,"idle_time_prior_call": number,"notes": string | null,"operator_id": string,"result": string,"start_time": string
                  }
                  ComputedFields: never
                  Insert: {
                    "assignment_id": string,"created_at"?: string,"device_id": string,"duration_seconds"?: never,"end_time": string,"id"?: string,"idle_time_prior_call"?: number,"notes"?: string | null,"operator_id": string,"result": string,"start_time": string
                  }
                  Update: {
                    "assignment_id"?: string,"created_at"?: string,"device_id"?: string,"duration_seconds"?: never,"end_time"?: string,"id"?: string,"idle_time_prior_call"?: number,"notes"?: string | null,"operator_id"?: string,"result"?: string,"start_time"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "call_interactions_assignment_id_fkey"
      columns: ["assignment_id"]
isOneToOne: false
      referencedRelation: "call_assignments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "call_interactions_device_id_fkey"
      columns: ["device_id"]
isOneToOne: false
      referencedRelation: "corporate_devices"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "call_interactions_operator_id_fkey"
      columns: ["operator_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"clock_events": {
                  Row: {
                    "attendance_id": string,"created_at": string,"device_fingerprint": string,"event_timestamp": string,"event_type": string,"id": string,"latitude": number | null,"longitude": number | null,"metadata": Json | null,"verification_method": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attendance_id": string,"created_at"?: string,"device_fingerprint": string,"event_timestamp"?: string,"event_type": string,"id"?: string,"latitude"?: number | null,"longitude"?: number | null,"metadata"?: Json | null,"verification_method": string
                  }
                  Update: {
                    "attendance_id"?: string,"created_at"?: string,"device_fingerprint"?: string,"event_timestamp"?: string,"event_type"?: string,"id"?: string,"latitude"?: number | null,"longitude"?: number | null,"metadata"?: Json | null,"verification_method"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "clock_events_attendance_id_fkey"
      columns: ["attendance_id"]
isOneToOne: false
      referencedRelation: "attendance_records"
      referencedColumns: ["id"]
    }
                  ]
                },"cola_telegram": {
                  Row: {
                    "error_detail": string | null,"estado": string,"fecha_encola": string | null,"id_cola": string,"intentos": number | null,"payload": NonNullable<Json>,"updated_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "error_detail"?: string | null,"estado"?: string,"fecha_encola"?: string | null,"id_cola"?: string,"intentos"?: number | null,"payload": NonNullable<Json>,"updated_at"?: string | null
                  }
                  Update: {
                    "error_detail"?: string | null,"estado"?: string,"fecha_encola"?: string | null,"id_cola"?: string,"intentos"?: number | null,"payload"?: NonNullable<Json>,"updated_at"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"config_destinatarios": {
                  Row: {
                    "activo": boolean | null,"chat_id": string,"frecuencia": string | null,"id": number,"updated_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "activo"?: boolean | null,"chat_id": string,"frecuencia"?: string | null,"id"?: number,"updated_at"?: string | null
                  }
                  Update: {
                    "activo"?: boolean | null,"chat_id"?: string,"frecuencia"?: string | null,"id"?: number,"updated_at"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"config_emojis": {
                  Row: {
                    "emoji": string,"id": number,"nombre": string,"tipo": string,"updated_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "emoji": string,"id"?: number,"nombre": string,"tipo": string,"updated_at"?: string | null
                  }
                  Update: {
                    "emoji"?: string,"id"?: number,"nombre"?: string,"tipo"?: string,"updated_at"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"config_variables": {
                  Row: {
                    "depende_de": string | null,"etiqueta": string | null,"id": number,"modo": string,"obligatorio": boolean | null,"tipo": string | null,"updated_at": string | null,"variable": string
                  }
                  ComputedFields: never
                  Insert: {
                    "depende_de"?: string | null,"etiqueta"?: string | null,"id"?: number,"modo": string,"obligatorio"?: boolean | null,"tipo"?: string | null,"updated_at"?: string | null,"variable": string
                  }
                  Update: {
                    "depende_de"?: string | null,"etiqueta"?: string | null,"id"?: number,"modo"?: string,"obligatorio"?: boolean | null,"tipo"?: string | null,"updated_at"?: string | null,"variable"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "config_variables_modo_fkey"
      columns: ["modo"]
isOneToOne: false
      referencedRelation: "configuracion"
      referencedColumns: ["modo"]
    }
                  ]
                },"configuracion": {
                  Row: {
                    "campanas": string,"detalle": Json | null,"modo": string,"updated_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "campanas": string,"detalle"?: Json | null,"modo": string,"updated_at"?: string | null
                  }
                  Update: {
                    "campanas"?: string,"detalle"?: Json | null,"modo"?: string,"updated_at"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"corporate_devices": {
                  Row: {
                    "android_version": string | null,"assigned_user_id": string | null,"battery_health_pct": number | null,"created_at": string,"id": string,"imei": string,"imei2": string | null,"knox_enrollment_id": string | null,"knox_version": string | null,"last_seen_at": string | null,"model": string,"notes": string | null,"phone_number": string,"status": string,"storage_free_gb": number | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "android_version"?: string | null,"assigned_user_id"?: string | null,"battery_health_pct"?: number | null,"created_at"?: string,"id"?: string,"imei": string,"imei2"?: string | null,"knox_enrollment_id"?: string | null,"knox_version"?: string | null,"last_seen_at"?: string | null,"model": string,"notes"?: string | null,"phone_number": string,"status"?: string,"storage_free_gb"?: number | null,"updated_at"?: string
                  }
                  Update: {
                    "android_version"?: string | null,"assigned_user_id"?: string | null,"battery_health_pct"?: number | null,"created_at"?: string,"id"?: string,"imei"?: string,"imei2"?: string | null,"knox_enrollment_id"?: string | null,"knox_version"?: string | null,"last_seen_at"?: string | null,"model"?: string,"notes"?: string | null,"phone_number"?: string,"status"?: string,"storage_free_gb"?: number | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "corporate_devices_assigned_user_id_fkey"
      columns: ["assigned_user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"daily_scores": {
                  Row: {
                    "calculated_at": string,"dominant_role": string | null,"final_score": number,"id": string,"is_hybrid_day": boolean,"score_breakdown": NonNullable<Json>,"score_date": string,"total_minutes": number,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "calculated_at"?: string,"dominant_role"?: string | null,"final_score": number,"id"?: string,"is_hybrid_day"?: boolean,"score_breakdown"?: NonNullable<Json>,"score_date": string,"total_minutes"?: number,"user_id": string
                  }
                  Update: {
                    "calculated_at"?: string,"dominant_role"?: string | null,"final_score"?: number,"id"?: string,"is_hybrid_day"?: boolean,"score_breakdown"?: NonNullable<Json>,"score_date"?: string,"total_minutes"?: number,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "daily_scores_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"data_analysis_submissions": {
                  Row: {
                    "analyst_note": string | null,"id": string,"input_data": NonNullable<Json>,"record_hash": string,"report_id": string,"validated_at": string,"validation_state": string
                  }
                  ComputedFields: never
                  Insert: {
                    "analyst_note"?: string | null,"id"?: string,"input_data": NonNullable<Json>,"record_hash": string,"report_id": string,"validated_at"?: string,"validation_state": string
                  }
                  Update: {
                    "analyst_note"?: string | null,"id"?: string,"input_data"?: NonNullable<Json>,"record_hash"?: string,"report_id"?: string,"validated_at"?: string,"validation_state"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "data_analysis_submissions_report_id_fkey"
      columns: ["report_id"]
isOneToOne: false
      referencedRelation: "oriana_reports"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "data_analysis_submissions_report_id_fkey"
      columns: ["report_id"]
isOneToOne: false
      referencedRelation: "v_oriana_reports_summary"
      referencedColumns: ["id"]
    }
                  ]
                },"dynamic_evaluation_rules": {
                  Row: {
                    "benchmark_target": number,"created_at": string,"description": string | null,"display_name": string,"id": string,"is_active": boolean,"is_higher_better": boolean,"metric_identifier": string,"role_type": string,"unit": string | null,"updated_at": string,"weight_percentage": number
                  }
                  ComputedFields: never
                  Insert: {
                    "benchmark_target": number,"created_at"?: string,"description"?: string | null,"display_name": string,"id"?: string,"is_active"?: boolean,"is_higher_better"?: boolean,"metric_identifier": string,"role_type": string,"unit"?: string | null,"updated_at"?: string,"weight_percentage": number
                  }
                  Update: {
                    "benchmark_target"?: number,"created_at"?: string,"description"?: string | null,"display_name"?: string,"id"?: string,"is_active"?: boolean,"is_higher_better"?: boolean,"metric_identifier"?: string,"role_type"?: string,"unit"?: string | null,"updated_at"?: string,"weight_percentage"?: number
                  }
                  Relationships: [
                    
                  ]
                },"incidents": {
                  Row: {
                    "assigned_to": string | null,"closed_at": string | null,"created_at": string,"description": string,"id": string,"reporter_id": string,"resolution_notes": string | null,"resolved_at": string | null,"severity": string,"sla_breached": boolean,"sla_due_date": string,"status": string,"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "assigned_to"?: string | null,"closed_at"?: string | null,"created_at"?: string,"description": string,"id"?: string,"reporter_id": string,"resolution_notes"?: string | null,"resolved_at"?: string | null,"severity": string,"sla_breached"?: boolean,"sla_due_date": string,"status"?: string,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "assigned_to"?: string | null,"closed_at"?: string | null,"created_at"?: string,"description"?: string,"id"?: string,"reporter_id"?: string,"resolution_notes"?: string | null,"resolved_at"?: string | null,"severity"?: string,"sla_breached"?: boolean,"sla_due_date"?: string,"status"?: string,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "incidents_assigned_to_fkey"
      columns: ["assigned_to"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "incidents_reporter_id_fkey"
      columns: ["reporter_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"logs_auditoria": {
                  Row: {
                    "accion": string | null,"detalle": string | null,"fecha_hora": string | null,"id": number,"rol": string | null,"usuario": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "accion"?: string | null,"detalle"?: string | null,"fecha_hora"?: string | null,"id"?: number,"rol"?: string | null,"usuario"?: string | null
                  }
                  Update: {
                    "accion"?: string | null,"detalle"?: string | null,"fecha_hora"?: string | null,"id"?: number,"rol"?: string | null,"usuario"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"oriana_metrics": {
                  Row: {
                    "audit_notes": string | null,"created_at": string,"discrepancy_count": number,"id": string,"processing_time_minutes": number,"records_per_hour": number | null,"report_id": string,"validation_accuracy": number
                  }
                  ComputedFields: never
                  Insert: {
                    "audit_notes"?: string | null,"created_at"?: string,"discrepancy_count"?: number,"id"?: string,"processing_time_minutes": number,"records_per_hour"?: number | null,"report_id": string,"validation_accuracy": number
                  }
                  Update: {
                    "audit_notes"?: string | null,"created_at"?: string,"discrepancy_count"?: number,"id"?: string,"processing_time_minutes"?: number,"records_per_hour"?: number | null,"report_id"?: string,"validation_accuracy"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "oriana_metrics_report_id_fkey"
      columns: ["report_id"]
isOneToOne: true
      referencedRelation: "oriana_reports"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "oriana_metrics_report_id_fkey"
      columns: ["report_id"]
isOneToOne: true
      referencedRelation: "v_oriana_reports_summary"
      referencedColumns: ["id"]
    }
                  ]
                },"oriana_reports": {
                  Row: {
                    "analyst_id": string,"batch_reference": string,"created_at": string,"id": string,"processed_records": number,"report_title": string,"reviewed_at": string | null,"reviewer_id": string | null,"reviewer_notes": string | null,"status": string,"submission_deadline": string,"total_records": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "analyst_id": string,"batch_reference": string,"created_at"?: string,"id"?: string,"processed_records"?: number,"report_title": string,"reviewed_at"?: string | null,"reviewer_id"?: string | null,"reviewer_notes"?: string | null,"status"?: string,"submission_deadline": string,"total_records": number,"updated_at"?: string
                  }
                  Update: {
                    "analyst_id"?: string,"batch_reference"?: string,"created_at"?: string,"id"?: string,"processed_records"?: number,"report_title"?: string,"reviewed_at"?: string | null,"reviewer_id"?: string | null,"reviewer_notes"?: string | null,"status"?: string,"submission_deadline"?: string,"total_records"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "oriana_reports_analyst_id_fkey"
      columns: ["analyst_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "oriana_reports_reviewer_id_fkey"
      columns: ["reviewer_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "address": string | null,"created_at": string,"document_id": string,"full_name": string,"id": string,"is_active": boolean,"last_profile_edit_at": string | null,"phone_number": string | null,"profile_edit_count_week": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "address"?: string | null,"created_at"?: string,"document_id": string,"full_name": string,"id": string,"is_active"?: boolean,"last_profile_edit_at"?: string | null,"phone_number"?: string | null,"profile_edit_count_week"?: number,"updated_at"?: string
                  }
                  Update: {
                    "address"?: string | null,"created_at"?: string,"document_id"?: string,"full_name"?: string,"id"?: string,"is_active"?: boolean,"last_profile_edit_at"?: string | null,"phone_number"?: string | null,"profile_edit_count_week"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"registros": {
                  Row: {
                    "admin_efectivas": number | null,"admin_incidencias": number | null,"campana": string,"created_at": string | null,"estados_abarcados": string | null,"fecha_registro": string | null,"fecha_reporte": string,"id": number,"id_operador": string | null,"incidencias_reportadas": number | null,"llamadas_efectivas": number | null,"llamadas_totales": number | null,"modo_trabajo": string,"municipios_detalles": string | null,"usuario_operador": string,"variables": Json | null
                  }
                  ComputedFields: never
                  Insert: {
                    "admin_efectivas"?: number | null,"admin_incidencias"?: number | null,"campana": string,"created_at"?: string | null,"estados_abarcados"?: string | null,"fecha_registro"?: string | null,"fecha_reporte": string,"id"?: number,"id_operador"?: string | null,"incidencias_reportadas"?: number | null,"llamadas_efectivas"?: number | null,"llamadas_totales"?: number | null,"modo_trabajo": string,"municipios_detalles"?: string | null,"usuario_operador": string,"variables"?: Json | null
                  }
                  Update: {
                    "admin_efectivas"?: number | null,"admin_incidencias"?: number | null,"campana"?: string,"created_at"?: string | null,"estados_abarcados"?: string | null,"fecha_registro"?: string | null,"fecha_reporte"?: string,"id"?: number,"id_operador"?: string | null,"incidencias_reportadas"?: number | null,"llamadas_efectivas"?: number | null,"llamadas_totales"?: number | null,"modo_trabajo"?: string,"municipios_detalles"?: string | null,"usuario_operador"?: string,"variables"?: Json | null
                  }
                  Relationships: [
                    
                  ]
                },"registros_daily_aggregates": {
                  Row: {
                    "created_at": string,"id": string,"modo_trabajo": string,"summary_date": string,"tasa_efectividad": number | null,"total_incidencias": number | null,"total_llamadas_efectivas": number | null,"total_llamadas_totales": number | null,"total_registros": number,"usuario_operador": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"modo_trabajo": string,"summary_date": string,"tasa_efectividad"?: number | null,"total_incidencias"?: number | null,"total_llamadas_efectivas"?: number | null,"total_llamadas_totales"?: number | null,"total_registros"?: number,"usuario_operador": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"modo_trabajo"?: string,"summary_date"?: string,"tasa_efectividad"?: number | null,"total_incidencias"?: number | null,"total_llamadas_efectivas"?: number | null,"total_llamadas_totales"?: number | null,"total_registros"?: number,"usuario_operador"?: string
                  }
                  Relationships: [
                    
                  ]
                },"roles": {
                  Row: {
                    "created_at": string,"description": string | null,"id": string,"name": string,"privilege_level": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"description"?: string | null,"id"?: string,"name": string,"privilege_level"?: number
                  }
                  Update: {
                    "created_at"?: string,"description"?: string | null,"id"?: string,"name"?: string,"privilege_level"?: number
                  }
                  Relationships: [
                    
                  ]
                },"telemetry_daily_aggregates": {
                  Row: {
                    "avg_latency_sec": number,"created_at": string,"id": string,"max_latency_sec": number | null,"min_latency_sec": number | null,"p50_latency_sec": number | null,"p95_latency_sec": number | null,"summary_date": string,"task_module": string,"total_events": number,"total_operators": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "avg_latency_sec"?: number,"created_at"?: string,"id"?: string,"max_latency_sec"?: number | null,"min_latency_sec"?: number | null,"p50_latency_sec"?: number | null,"p95_latency_sec"?: number | null,"summary_date": string,"task_module": string,"total_events"?: number,"total_operators"?: number | null
                  }
                  Update: {
                    "avg_latency_sec"?: number,"created_at"?: string,"id"?: string,"max_latency_sec"?: number | null,"min_latency_sec"?: number | null,"p50_latency_sec"?: number | null,"p95_latency_sec"?: number | null,"summary_date"?: string,"task_module"?: string,"total_events"?: number,"total_operators"?: number | null
                  }
                  Relationships: [
                    
                  ]
                },"user_roles": {
                  Row: {
                    "assigned_at": string,"assigned_by": string | null,"id": string,"role_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "assigned_at"?: string,"assigned_by"?: string | null,"id"?: string,"role_id": string,"user_id": string
                  }
                  Update: {
                    "assigned_at"?: string,"assigned_by"?: string | null,"id"?: string,"role_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "user_roles_assigned_by_fkey"
      columns: ["assigned_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "user_roles_role_id_fkey"
      columns: ["role_id"]
isOneToOne: false
      referencedRelation: "roles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "user_roles_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"workflow_latency_logs": {
                  Row: {
                    "attendance_id": string,"clock_in_time": string,"created_at": string,"first_task_event_time": string | null,"id": string,"latency_seconds": number | null,"task_module": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attendance_id": string,"clock_in_time": string,"created_at"?: string,"first_task_event_time"?: string | null,"id"?: string,"latency_seconds"?: never,"task_module": string,"user_id": string
                  }
                  Update: {
                    "attendance_id"?: string,"clock_in_time"?: string,"created_at"?: string,"first_task_event_time"?: string | null,"id"?: string,"latency_seconds"?: never,"task_module"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "workflow_latency_logs_attendance_id_fkey"
      columns: ["attendance_id"]
isOneToOne: false
      referencedRelation: "attendance_records"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "workflow_latency_logs_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"workflow_latency_logs_2026_11": {
                  Row: {
                    "attendance_id": string,"clock_in_time": string,"created_at": string,"first_task_event_time": string | null,"id": string,"latency_seconds": number | null,"task_module": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attendance_id": string,"clock_in_time": string,"created_at"?: string,"first_task_event_time"?: string | null,"id"?: string,"latency_seconds"?: never,"task_module": string,"user_id": string
                  }
                  Update: {
                    "attendance_id"?: string,"clock_in_time"?: string,"created_at"?: string,"first_task_event_time"?: string | null,"id"?: string,"latency_seconds"?: never,"task_module"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"workflow_latency_logs_2026_12": {
                  Row: {
                    "attendance_id": string,"clock_in_time": string,"created_at": string,"first_task_event_time": string | null,"id": string,"latency_seconds": number | null,"task_module": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attendance_id": string,"clock_in_time": string,"created_at"?: string,"first_task_event_time"?: string | null,"id"?: string,"latency_seconds"?: never,"task_module": string,"user_id": string
                  }
                  Update: {
                    "attendance_id"?: string,"clock_in_time"?: string,"created_at"?: string,"first_task_event_time"?: string | null,"id"?: string,"latency_seconds"?: never,"task_module"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"workflow_latency_logs_2027_01": {
                  Row: {
                    "attendance_id": string,"clock_in_time": string,"created_at": string,"first_task_event_time": string | null,"id": string,"latency_seconds": number | null,"task_module": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attendance_id": string,"clock_in_time": string,"created_at"?: string,"first_task_event_time"?: string | null,"id"?: string,"latency_seconds"?: never,"task_module": string,"user_id": string
                  }
                  Update: {
                    "attendance_id"?: string,"clock_in_time"?: string,"created_at"?: string,"first_task_event_time"?: string | null,"id"?: string,"latency_seconds"?: never,"task_module"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"workflow_latency_logs_partitioned": {
                  Row: {
                    "attendance_id": string,"clock_in_time": string,"created_at": string,"first_task_event_time": string | null,"id": string,"latency_seconds": number | null,"task_module": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attendance_id": string,"clock_in_time": string,"created_at"?: string,"first_task_event_time"?: string | null,"id"?: string,"latency_seconds"?: never,"task_module": string,"user_id": string
                  }
                  Update: {
                    "attendance_id"?: string,"clock_in_time"?: string,"created_at"?: string,"first_task_event_time"?: string | null,"id"?: string,"latency_seconds"?: never,"task_module"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            "v_analyst_daily_performance": {
                  Row: {
                    "modo_trabajo": string,"tasa_efectividad_pct": number | null,"total_efectivas": number | null,"total_incidencias": number | null,"total_llamadas": number | null,"total_registros": number | null,"usuario_operador": string,"work_date": string
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                },"v_daily_call_performance": {
                  Row: {
                    "avg_duration_sec": number | null,"avg_idle_sec": number | null,"busy_calls": number | null,"calls_with_excessive_idle": number | null,"effective_calls": number | null,"effective_rate_pct": number | null,"no_answer_calls": number | null,"operator_id": string,"operator_name": string,"total_calls": number | null,"work_date": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "call_interactions_operator_id_fkey"
      columns: ["operator_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"v_incidents_sla_status": {
                  Row: {
                    "assigned_to_name": string | null,"created_at": string,"id": string,"reporter_name": string,"resolved_at": string | null,"seconds_until_sla": number | null,"severity": string,"sla_breached": boolean,"sla_due_date": string,"sla_state": string | null,"status": string,"title": string
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                },"v_oriana_reports_summary": {
                  Row: {
                    "analyst_name": string,"batch_reference": string,"created_at": string,"deadline_state": string | null,"discrepancy_count": number | null,"id": string,"processed_records": number,"processing_time_minutes": number | null,"progress_pct": number | null,"report_title": string,"reviewed_at": string | null,"status": string,"submission_deadline": string,"total_records": number,"validation_accuracy": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                },"v_weekly_operator_ranking": {
                  Row: {
                    "avg_score_week": number | null,"best_day_score": number | null,"days_scored": number | null,"green_days": number | null,"operator_name": string,"ranking_position": number | null,"red_days": number | null,"total_minutes_week": number | null,"user_id": string,"worst_day_score": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "daily_scores_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            "current_user_has_any_role":
{ Args: { "required_roles": (string)[] }; Returns: boolean
                           },
"current_user_has_role":
{ Args: { "required_role": string }; Returns: boolean
                           },
"current_user_privilege_level":
{ Args: Record<string, never>; Returns: number
                           },
"fn_archive_and_purge_lifecycle":
{ Args: { "p_dry_run"?: boolean,"p_retention_days"?: number }; Returns: Database["public"]['CompositeTypes']["purge_execution_report"][]
                          SetofOptions: {
        from: "*"
        to: "purge_execution_report"
        isOneToOne: false
        isSetofReturn: true
      } },
"fn_calculate_daily_score":
{ Args: { "p_score_date": string,"p_user_id": string }; Returns: {
              "dominant_role": string,"final_score": number,"is_hybrid_day": boolean,"score_breakdown": Json,"total_minutes": number
            }[]
                           },
"fn_calculate_sla_due_date":
{ Args: { "p_severity": string }; Returns: string
                           },
"fn_create_monthly_partition":
{ Args: { "p_month": number,"p_parent_table": string,"p_year": number }; Returns: undefined
                           },
"fn_get_storage_usage_report":
{ Args: Record<string, never>; Returns: {
              "newest_record": string,"oldest_record": string,"row_count": number,"size_mb": number,"table_name": string
            }[]
                           },
"fn_materialize_daily_score":
{ Args: { "p_score_date": string,"p_user_id": string }; Returns: undefined
                           },
"is_own_record":
{ Args: { "record_user_id": string }; Returns: boolean
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            "purge_execution_report": {
                        "phase": string | null,"rows_aggregated": number | null,"rows_deleted": number | null,"partitions_dropped": number | null,"execution_time_ms": number | null,"error_detail": string | null
                      }
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            
          }
        }
} as const
