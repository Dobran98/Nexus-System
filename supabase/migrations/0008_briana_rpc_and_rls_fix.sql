-- ============================================================================
-- MIGRACIÓN: 0008_briana_rpc_and_rls_fix.sql
-- Proyecto: NEXUS SYSTEM — Briana Remote Dialer RLS & RPCs SECURITY DEFINER
-- Descripción: Permite operar register_device / telemetry desde la APK Android
--              y endpoints autenticados PC web de forma segura incluso cuando
--              Vercel utiliza solo NEXT_PUBLIC_SUPABASE_ANON_KEY + cookie SSR.
-- Idempotente: Sí
-- ============================================================================

-- 1. Políticas RLS completas para usuarios autenticados en web (fallback sin service_role)
DROP POLICY IF EXISTS "campaigns_select_auth" ON public.call_campaigns;
CREATE POLICY "campaigns_select_auth" ON public.call_campaigns
    FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "campaigns_admin_write" ON public.call_campaigns;
CREATE POLICY "campaigns_admin_write" ON public.call_campaigns
    FOR ALL USING (public.fn_is_briana_supervisor_or_admin())
    WITH CHECK (public.fn_is_briana_supervisor_or_admin());

DROP POLICY IF EXISTS "devices_update_auth" ON public.devices;
CREATE POLICY "devices_update_auth" ON public.devices
    FOR UPDATE USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "queue_select_assigned_or_admin" ON public.contacts_queue;
CREATE POLICY "queue_select_assigned_or_admin" ON public.contacts_queue
    FOR SELECT USING (
        assigned_operator_id = auth.uid()
        OR (status = 'pending' AND auth.uid() IS NOT NULL)
        OR public.fn_is_briana_supervisor_or_admin()
    );

DROP POLICY IF EXISTS "queue_update_assigned_or_admin" ON public.contacts_queue;
CREATE POLICY "queue_update_assigned_or_admin" ON public.contacts_queue
    FOR UPDATE USING (
        assigned_operator_id = auth.uid()
        OR (status = 'pending' AND auth.uid() IS NOT NULL)
        OR public.fn_is_briana_supervisor_or_admin()
    );

DROP POLICY IF EXISTS "queue_insert_admin" ON public.contacts_queue;
CREATE POLICY "queue_insert_admin" ON public.contacts_queue
    FOR INSERT WITH CHECK (public.fn_is_briana_supervisor_or_admin());

DROP POLICY IF EXISTS "call_logs_update_own_or_admin" ON public.call_logs;
CREATE POLICY "call_logs_update_own_or_admin" ON public.call_logs
    FOR UPDATE USING (operator_id = auth.uid() OR public.fn_is_briana_supervisor_or_admin());

-- 2. RPC SECURITY DEFINER: Registro y Heartbeat del Samsung (consumido por APK)
CREATE OR REPLACE FUNCTION public.briana_register_device(
    p_device_uid TEXT,
    p_model TEXT,
    p_sim_phone_number TEXT DEFAULT NULL,
    p_carrier_name TEXT DEFAULT NULL,
    p_battery_pct INT DEFAULT 100,
    p_network_type TEXT DEFAULT 'WIFI',
    p_app_version TEXT DEFAULT '1.0.0',
    p_is_default_dialer BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_device public.devices%ROWTYPE;
    v_pin TEXT;
    v_now TIMESTAMPTZ := timezone('utc', now());
    v_expires TIMESTAMPTZ := timezone('utc', now()) + INTERVAL '12 hours';
    v_session JSONB;
    v_commands JSONB;
    v_cmd_ids UUID[];
BEGIN
    SELECT * INTO v_device FROM public.devices WHERE device_uid = p_device_uid LIMIT 1;

    IF v_device.id IS NOT NULL AND v_device.pairing_pin IS NOT NULL AND v_device.pin_expires_at > v_now THEN
        v_pin := v_device.pairing_pin;
    ELSE
        v_pin := 'BRN-' || (1000 + floor(random() * 9000))::INT::TEXT;
    END IF;

    IF v_device.id IS NOT NULL THEN
        UPDATE public.devices
        SET model = p_model,
            sim_phone_number = COALESCE(p_sim_phone_number, sim_phone_number),
            carrier_name = COALESCE(p_carrier_name, carrier_name),
            pairing_pin = v_pin,
            pin_expires_at = v_expires,
            battery_pct = COALESCE(p_battery_pct, battery_pct),
            network_type = COALESCE(p_network_type, network_type),
            app_version = COALESCE(p_app_version, app_version),
            is_default_dialer = COALESCE(p_is_default_dialer, is_default_dialer),
            last_heartbeat_at = v_now
        WHERE id = v_device.id
        RETURNING * INTO v_device;
    ELSE
        INSERT INTO public.devices (
            device_uid, model, sim_phone_number, carrier_name,
            pairing_pin, pin_expires_at, status, battery_pct,
            network_type, app_version, is_default_dialer, last_heartbeat_at
        )
        VALUES (
            p_device_uid, p_model, NULLIF(p_sim_phone_number, ''), NULLIF(p_carrier_name, ''),
            v_pin, v_expires, 'available', COALESCE(p_battery_pct, 100),
            COALESCE(p_network_type, 'WIFI'), COALESCE(p_app_version, '1.0.0'),
            COALESCE(p_is_default_dialer, false), v_now
        )
        RETURNING * INTO v_device;
    END IF;

    SELECT jsonb_build_object(
        'id', s.id,
        'operator_id', s.operator_id,
        'campaign_id', s.campaign_id,
        'started_at', s.started_at,
        'profiles', jsonb_build_object('full_name', COALESCE(p.full_name, 'Operador'))
    )
    INTO v_session
    FROM public.operator_sessions s
    LEFT JOIN public.profiles p ON p.id = s.operator_id
    WHERE s.device_id = v_device.id AND s.is_active = true
    LIMIT 1;

    SELECT COALESCE(jsonb_agg(to_jsonb(c) ORDER BY c.created_at ASC), '[]'::jsonb),
           ARRAY_AGG(c.id)
    INTO v_commands, v_cmd_ids
    FROM public.call_commands c
    WHERE c.device_id = v_device.id AND c.status = 'pending';

    IF v_cmd_ids IS NOT NULL AND array_length(v_cmd_ids, 1) > 0 THEN
        UPDATE public.call_commands
        SET status = 'acked', acked_at = v_now
        WHERE id = ANY(v_cmd_ids);
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'device', to_jsonb(v_device),
        'activeSession', v_session,
        'pendingCommands', COALESCE(v_commands, '[]'::jsonb)
    );
END;
$$;

-- 3. RPC SECURITY DEFINER: Telemetría en vivo desde APK Android (SIM y WhatsApp)
CREATE OR REPLACE FUNCTION public.briana_record_telemetry(
    p_call_uuid UUID,
    p_device_uid TEXT DEFAULT NULL,
    p_command_id UUID DEFAULT NULL,
    p_contact_id UUID DEFAULT NULL,
    p_campaign_id UUID DEFAULT NULL,
    p_operator_id UUID DEFAULT NULL,
    p_session_id UUID DEFAULT NULL,
    p_state TEXT DEFAULT 'DIALING',
    p_call_channel TEXT DEFAULT 'sim',
    p_is_connected BOOLEAN DEFAULT false,
    p_initiated_from TEXT DEFAULT 'android_app',
    p_ended_by TEXT DEFAULT NULL,
    p_dialing_at TIMESTAMPTZ DEFAULT NULL,
    p_ringing_at TIMESTAMPTZ DEFAULT NULL,
    p_active_at TIMESTAMPTZ DEFAULT NULL,
    p_disconnected_at TIMESTAMPTZ DEFAULT NULL,
    p_talk_duration_seconds INT DEFAULT 0,
    p_telecom_disconnect_code INT DEFAULT NULL,
    p_telecom_disconnect_msg TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_now TIMESTAMPTZ := timezone('utc', now());
    v_device_id UUID;
    v_session_id UUID := p_session_id;
    v_operator_id UUID := p_operator_id;
    v_campaign_id UUID := p_campaign_id;
    v_attempt_count INT := 0;
    v_max_attempts INT := 5;
    v_attempt_number INT := 1;
    v_existing public.call_logs%ROWTYPE;
    v_channel TEXT := CASE WHEN p_call_channel = 'whatsapp' THEN 'whatsapp' ELSE 'sim' END;
    v_init_from public.briana_initiated_from := CASE WHEN p_initiated_from = 'pc_web' THEN 'pc_web'::public.briana_initiated_from ELSE 'android_app'::public.briana_initiated_from END;
    v_ended public.briana_ended_by;
    v_outcome public.briana_call_outcome := NULL;
    v_next_status public.briana_queue_status;
BEGIN
    IF p_command_id IS NOT NULL THEN
        UPDATE public.call_commands
        SET status = 'executed', acked_at = COALESCE(acked_at, v_now)
        WHERE id = p_command_id;
    END IF;

    IF p_device_uid IS NOT NULL THEN
        SELECT id INTO v_device_id FROM public.devices WHERE device_uid = p_device_uid LIMIT 1;
        IF v_device_id IS NOT NULL AND (v_session_id IS NULL OR v_operator_id IS NULL OR v_campaign_id IS NULL) THEN
            SELECT id, operator_id, campaign_id
            INTO v_session_id, v_operator_id, v_campaign_id
            FROM public.operator_sessions
            WHERE device_id = v_device_id AND is_active = true
            LIMIT 1;
        END IF;
    END IF;

    IF p_contact_id IS NOT NULL THEN
        SELECT COALESCE(attempt_count, 0), COALESCE(max_attempts, 5), COALESCE(v_campaign_id, campaign_id)
        INTO v_attempt_count, v_max_attempts, v_campaign_id
        FROM public.contacts_queue
        WHERE id = p_contact_id;
    END IF;

    IF v_campaign_id IS NULL THEN
        SELECT (payload->>'campaign_id')::UUID INTO v_campaign_id
        FROM public.call_commands
        WHERE call_uuid = p_call_uuid AND payload ? 'campaign_id' AND NULLIF(payload->>'campaign_id', '') IS NOT NULL
        LIMIT 1;
    END IF;

    v_attempt_number := GREATEST(1, COALESCE(v_attempt_count, 0) + 1);

    SELECT * INTO v_existing FROM public.call_logs WHERE call_uuid = p_call_uuid LIMIT 1;

    IF p_state <> 'DISCONNECTED' THEN
        IF v_existing.id IS NULL AND v_session_id IS NOT NULL AND p_contact_id IS NOT NULL AND v_campaign_id IS NOT NULL AND v_operator_id IS NOT NULL AND v_device_id IS NOT NULL THEN
            INSERT INTO public.call_logs (
                call_uuid, session_id, contact_id, campaign_id, operator_id, device_id,
                attempt_number, call_channel, initiated_from, is_connected,
                dialing_at, ringing_at, active_at, talk_duration_seconds
            ) VALUES (
                p_call_uuid, v_session_id, p_contact_id, v_campaign_id, v_operator_id, v_device_id,
                v_attempt_number, v_channel, v_init_from, (p_state = 'ACTIVE' OR p_is_connected),
                COALESCE(p_dialing_at, v_now),
                COALESCE(p_ringing_at, CASE WHEN p_state = 'RINGING' THEN v_now ELSE NULL END),
                COALESCE(p_active_at, CASE WHEN p_state = 'ACTIVE' THEN v_now ELSE NULL END),
                0
            );
        ELSIF v_existing.id IS NOT NULL THEN
            UPDATE public.call_logs
            SET is_connected = CASE WHEN (p_state = 'ACTIVE' OR p_is_connected) THEN true ELSE is_connected END,
                ringing_at = COALESCE(ringing_at, p_ringing_at, CASE WHEN p_state = 'RINGING' THEN v_now ELSE NULL END),
                active_at = COALESCE(active_at, p_active_at, CASE WHEN p_state = 'ACTIVE' THEN v_now ELSE NULL END)
            WHERE id = v_existing.id;
        END IF;
    ELSE
        v_ended := CASE
            WHEN p_ended_by = 'operator_pc' THEN 'operator_pc'::public.briana_ended_by
            WHEN p_ended_by = 'operator_phone' THEN 'operator_phone'::public.briana_ended_by
            WHEN p_ended_by = 'remote_party' THEN 'remote_party'::public.briana_ended_by
            ELSE 'network_or_no_answer'::public.briana_ended_by
        END;

        IF NOT COALESCE(p_is_connected, false) THEN
            v_outcome := CASE
                WHEN p_telecom_disconnect_code = 4 THEN 'ocupado'::public.briana_call_outcome
                WHEN p_telecom_disconnect_code IN (6, 7) THEN 'rechazada'::public.briana_call_outcome
                WHEN p_ended_by IN ('operator_pc', 'operator_phone') THEN 'cancelada_antes_de_conectar'::public.briana_call_outcome
                ELSE 'sin_respuesta'::public.briana_call_outcome
            END;
        END IF;

        IF v_existing.id IS NULL AND v_session_id IS NOT NULL AND p_contact_id IS NOT NULL AND v_campaign_id IS NOT NULL AND v_operator_id IS NOT NULL AND v_device_id IS NOT NULL THEN
            INSERT INTO public.call_logs (
                call_uuid, session_id, contact_id, campaign_id, operator_id, device_id,
                attempt_number, call_channel, initiated_from, ended_by, is_connected,
                dialing_at, ringing_at, active_at, disconnected_at, talk_duration_seconds,
                outcome, is_effective, telecom_disconnect_code, telecom_disconnect_msg
            ) VALUES (
                p_call_uuid, v_session_id, p_contact_id, v_campaign_id, v_operator_id, v_device_id,
                v_attempt_number, v_channel, v_init_from, v_ended, COALESCE(p_is_connected, false),
                COALESCE(p_dialing_at, v_now), p_ringing_at, p_active_at, COALESCE(p_disconnected_at, v_now),
                CASE WHEN p_is_connected THEN GREATEST(0, COALESCE(p_talk_duration_seconds, 0)) ELSE 0 END,
                v_outcome, false, p_telecom_disconnect_code, p_telecom_disconnect_msg
            );
        ELSIF v_existing.id IS NOT NULL THEN
            UPDATE public.call_logs
            SET ended_by = v_ended,
                is_connected = COALESCE(p_is_connected, false),
                ringing_at = COALESCE(ringing_at, p_ringing_at),
                active_at = COALESCE(active_at, p_active_at),
                disconnected_at = COALESCE(p_disconnected_at, v_now),
                talk_duration_seconds = CASE WHEN p_is_connected THEN GREATEST(0, COALESCE(p_talk_duration_seconds, 0)) ELSE 0 END,
                outcome = COALESCE(v_outcome, outcome),
                telecom_disconnect_code = p_telecom_disconnect_code,
                telecom_disconnect_msg = p_telecom_disconnect_msg
            WHERE id = v_existing.id;
        END IF;

        IF NOT COALESCE(p_is_connected, false) AND p_contact_id IS NOT NULL THEN
            v_next_status := CASE WHEN (v_attempt_count + 1) >= v_max_attempts THEN 'exhausted'::public.briana_queue_status ELSE 'pending'::public.briana_queue_status END;
            UPDATE public.contacts_queue
            SET attempt_count = v_attempt_count + 1,
                status = v_next_status,
                assigned_operator_id = NULL,
                locked_until = NULL,
                last_attempt_at = v_now,
                next_retry_at = CASE WHEN v_next_status = 'pending' THEN v_now + INTERVAL '30 minutes' ELSE NULL END,
                last_outcome = v_outcome
            WHERE id = p_contact_id;
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'callUuid', p_call_uuid,
        'state', p_state,
        'requiresPostCallModal', (p_state = 'DISCONNECTED' AND COALESCE(p_is_connected, false))
    );
END;
$$;

-- 4. RPC SECURITY DEFINER: Consulta de estado de llamada (respaldo de Realtime)
CREATE OR REPLACE FUNCTION public.briana_get_call_log(p_call_uuid UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT to_jsonb(c) FROM public.call_logs c WHERE c.call_uuid = p_call_uuid LIMIT 1;
$$;

-- 5. RPC SECURITY DEFINER: Liberar sesión desde APK o PC
CREATE OR REPLACE FUNCTION public.briana_unpair_session(
    p_session_id UUID DEFAULT NULL,
    p_device_id UUID DEFAULT NULL,
    p_operator_id UUID DEFAULT NULL,
    p_reason TEXT DEFAULT 'operator_ended_shift'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_sess RECORD;
BEGIN
    IF p_session_id IS NOT NULL THEN
        SELECT id, device_id, operator_id INTO v_sess FROM public.operator_sessions WHERE id = p_session_id LIMIT 1;
    ELSIF p_operator_id IS NOT NULL THEN
        SELECT id, device_id, operator_id INTO v_sess FROM public.operator_sessions WHERE operator_id = p_operator_id AND is_active = true LIMIT 1;
    ELSIF p_device_id IS NOT NULL THEN
        SELECT id, device_id, operator_id INTO v_sess FROM public.operator_sessions WHERE device_id = p_device_id AND is_active = true LIMIT 1;
    END IF;

    IF v_sess.id IS NOT NULL THEN
        UPDATE public.operator_sessions
        SET is_active = false, ended_at = timezone('utc', now()), ended_reason = p_reason
        WHERE id = v_sess.id;

        UPDATE public.contacts_queue
        SET status = 'pending', assigned_operator_id = NULL, locked_until = NULL
        WHERE assigned_operator_id = v_sess.operator_id AND status IN ('assigned', 'in_call');

        UPDATE public.devices SET status = 'available' WHERE id = v_sess.device_id;
    ELSIF p_device_id IS NOT NULL THEN
        UPDATE public.devices SET status = 'available' WHERE id = p_device_id;
    END IF;

    RETURN jsonb_build_object('success', true);
END;
$$;

-- Permisos de ejecución explícitos para anon / authenticated
GRANT EXECUTE ON FUNCTION public.briana_register_device(TEXT, TEXT, TEXT, TEXT, INT, TEXT, TEXT, BOOLEAN) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.briana_record_telemetry(UUID, TEXT, UUID, UUID, UUID, UUID, UUID, TEXT, TEXT, BOOLEAN, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, INT, INT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.briana_get_call_log(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.briana_unpair_session(UUID, UUID, UUID, TEXT) TO anon, authenticated;
