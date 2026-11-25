import psycopg2

conn = psycopg2.connect('postgresql://postgres.pzkqjdkphcwmblbyorbr:yfcLIxzEWObS4Dio@aws-0-us-east-1.pooler.supabase.com:6543/postgres')
cur = conn.cursor()

# 1. Actualizar nexus_admin_get_users para incluir extension y areas_ids
cur.execute("""
CREATE OR REPLACE FUNCTION public.nexus_admin_get_users(
    p_search TEXT DEFAULT '',
    p_role TEXT DEFAULT '',
    p_status TEXT DEFAULT ''
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn$
DECLARE
    v_result JSONB;
BEGIN
    SELECT jsonb_agg(u_row) INTO v_result
    FROM (
        SELECT 
            u.id,
            u.email,
            COALESCE(p.full_name, split_part(u.email, '@', 1)) as full_name,
            COALESCE(p.document_id, 'V-' || SUBSTRING(REPLACE(u.id::text, '-', '') FROM 1 FOR 8)) as document_id,
            COALESCE(p.phone_number, leg.telefono, '') as phone_number,
            COALESCE(p.address, leg.direccion, '') as address,
            COALESCE(p.is_active, true) as is_active,
            p.last_profile_edit_at,
            COALESCE(r.name, 'multi_operator') as role_name,
            COALESCE(leg.sub_rol, 'Operador/a') as sub_rol,
            COALESCE(leg.turno, 'Mañana') as turno,
            COALESCE(leg.institucion, '') as institucion,
            COALESCE(leg.usuario, split_part(u.email, '@', 1)) as legacy_username,
            COALESCE(ext.extension, leg.dispositivo_vinculado_id, '110' || LPAD((ABS(hashtext(u.email)) % 90 + 10)::text, 2, '0')) as extension,
            COALESCE(leg.areas_ids, '[\"Todas\"]'::jsonb) as areas_ids,
            u.created_at,
            u.last_sign_in_at
        FROM auth.users u
        LEFT JOIN public.profiles p ON u.id = p.id
        LEFT JOIN (
            SELECT DISTINCT ON (user_id) user_id, role_id 
            FROM public.user_roles
        ) ur ON u.id = ur.user_id
        LEFT JOIN public.roles r ON ur.role_id = r.id
        LEFT JOIN (
            SELECT DISTINCT ON (email) * 
            FROM public.usuarios 
            WHERE email IS NOT NULL AND email <> ''
        ) leg ON leg.email = u.email
        LEFT JOIN (
            SELECT DISTINCT ON (usuario) usuario, extension 
            FROM public.briana_extensiones 
            ORDER BY usuario, id DESC
        ) ext ON ext.usuario = COALESCE(leg.usuario, split_part(u.email, '@', 1))
        WHERE 
            (p_search = '' OR 
             u.email ILIKE '%' || p_search || '%' OR 
             p.full_name ILIKE '%' || p_search || '%' OR 
             p.document_id ILIKE '%' || p_search || '%' OR
             leg.usuario ILIKE '%' || p_search || '%' OR
             ext.extension ILIKE '%' || p_search || '%')
            AND (p_role = '' OR r.name = p_role OR (p_role = 'multi_operator' AND r.name IS NULL))
            AND (p_status = '' OR (p_status = 'active' AND COALESCE(p.is_active, true) = true) OR (p_status = 'inactive' AND COALESCE(p.is_active, true) = false))
        ORDER BY u.created_at DESC
    ) u_row;

    RETURN COALESCE(v_result, '[]'::jsonb);
END;
$fn$;
""")

# 2. Actualizar nexus_admin_create_user para incluir extension y areas_ids
cur.execute("""
CREATE OR REPLACE FUNCTION public.nexus_admin_create_user(
    p_email TEXT,
    p_password TEXT,
    p_full_name TEXT,
    p_document_id TEXT,
    p_role_name TEXT,
    p_sub_rol TEXT,
    p_turno TEXT DEFAULT 'Mañana',
    p_phone TEXT DEFAULT '',
    p_address TEXT DEFAULT '',
    p_institucion TEXT DEFAULT '',
    p_extension TEXT DEFAULT '',
    p_areas JSONB DEFAULT '[\"Todas\"]'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn$
DECLARE
    v_new_id UUID := gen_random_uuid();
    v_role_id UUID;
    v_clean_email TEXT := LOWER(TRIM(p_email));
    v_username TEXT := split_part(v_clean_email, '@', 1);
    v_ext TEXT := COALESCE(NULLIF(TRIM(p_extension), ''), '110' || LPAD((ABS(hashtext(v_clean_email)) % 90 + 10)::text, 2, '0'));
BEGIN
    IF EXISTS (SELECT 1 FROM auth.users WHERE LOWER(email) = v_clean_email) THEN
        RETURN jsonb_build_object('success', false, 'error', 'El correo ya se encuentra registrado');
    END IF;

    SELECT id INTO v_role_id FROM public.roles WHERE name = p_role_name LIMIT 1;
    IF v_role_id IS NULL THEN
        SELECT id INTO v_role_id FROM public.roles WHERE name = 'multi_operator' LIMIT 1;
    END IF;

    -- auth.users
    INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at, confirmed_at,
        confirmation_token, recovery_token, email_change_token_new, email_change, email_change_token_current,
        phone_change, phone_change_token, reauthentication_token,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) VALUES (
        '00000000-0000-0000-0000-000000000000',
        v_new_id,
        'authenticated',
        'authenticated',
        v_clean_email,
        crypt(p_password, gen_salt('bf')),
        now(),
        now(),
        '', '', '', '', '',
        '', '', '',
        jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
        jsonb_build_object('full_name', p_full_name, 'document_id', p_document_id),
        now(),
        now()
    );

    -- profiles
    INSERT INTO public.profiles (id, full_name, document_id, phone_number, address, is_active, created_at, updated_at)
    VALUES (v_new_id, p_full_name, p_document_id, p_phone, p_address, true, now(), now())
    ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        document_id = EXCLUDED.document_id,
        phone_number = EXCLUDED.phone_number,
        address = EXCLUDED.address,
        is_active = true,
        updated_at = now();

    -- user_roles
    INSERT INTO public.user_roles (user_id, role_id)
    VALUES (v_new_id, v_role_id)
    ON CONFLICT (user_id, role_id) DO NOTHING;

    -- usuarios (legacy Asys / Briana / Oriana)
    INSERT INTO public.usuarios (
        usuario, clave, nombre_apellido, rol, sub_rol, turno, cedula, email,
        institucion, telefono, direccion, user_id, id_user,
        dispositivo_vinculado_id, areas_ids, created_at, updated_at
    ) VALUES (
        v_username,
        p_password,
        p_full_name,
        CASE 
            WHEN p_role_name IN ('superadmin', 'module_admin') THEN 'Admin'
            WHEN p_role_name = 'supervisor' THEN 'Supervisor'
            WHEN p_role_name = 'data_analyst' THEN 'Analista'
            ELSE 'Operador'
        END,
        COALESCE(NULLIF(p_sub_rol, ''), 'Operador/a'),
        COALESCE(NULLIF(p_turno, ''), 'Mañana'),
        p_document_id,
        v_clean_email,
        p_institucion,
        p_phone,
        p_address,
        v_new_id::text,
        'usr_' || SUBSTRING(REPLACE(v_new_id::text, '-', '') FROM 1 FOR 8),
        v_ext,
        p_areas,
        now(),
        now()
    )
    ON CONFLICT (usuario) DO UPDATE SET
        email = EXCLUDED.email,
        nombre_apellido = EXCLUDED.nombre_apellido,
        cedula = EXCLUDED.cedula,
        sub_rol = EXCLUDED.sub_rol,
        turno = EXCLUDED.turno,
        institucion = EXCLUDED.institucion,
        telefono = EXCLUDED.telefono,
        direccion = EXCLUDED.direccion,
        dispositivo_vinculado_id = v_ext,
        areas_ids = p_areas,
        updated_at = now();

    -- briana_extensiones
    INSERT INTO public.briana_extensiones (usuario, extension, turno, fecha)
    VALUES (v_username, v_ext, COALESCE(NULLIF(p_turno, ''), 'Mañana'), now());

    RETURN jsonb_build_object('success', true, 'user_id', v_new_id, 'extension', v_ext, 'message', 'Usuario corporativo registrado exitosamente con extensión y áreas asignadas');
END;
$fn$;
""")

# 3. Actualizar nexus_admin_update_user para incluir extension y areas_ids
cur.execute("""
CREATE OR REPLACE FUNCTION public.nexus_admin_update_user(
    p_user_id UUID,
    p_full_name TEXT,
    p_document_id TEXT,
    p_role_name TEXT,
    p_sub_rol TEXT,
    p_turno TEXT DEFAULT 'Mañana',
    p_phone TEXT DEFAULT '',
    p_address TEXT DEFAULT '',
    p_institucion TEXT DEFAULT '',
    p_is_active BOOLEAN DEFAULT true,
    p_new_password TEXT DEFAULT NULL,
    p_reset_cooldown BOOLEAN DEFAULT false,
    p_extension TEXT DEFAULT NULL,
    p_areas JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn$
DECLARE
    v_role_id UUID;
    v_user_email TEXT;
    v_username TEXT;
BEGIN
    SELECT email INTO v_user_email FROM auth.users WHERE id = p_user_id;
    IF v_user_email IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Usuario no encontrado');
    END IF;
    v_username := split_part(v_user_email, '@', 1);

    -- 1. Actualizar profiles
    UPDATE public.profiles
    SET 
        full_name = COALESCE(NULLIF(p_full_name, ''), full_name),
        document_id = COALESCE(NULLIF(p_document_id, ''), document_id),
        phone_number = p_phone,
        address = p_address,
        is_active = p_is_active,
        last_profile_edit_at = CASE WHEN p_reset_cooldown THEN NULL ELSE last_profile_edit_at END,
        profile_edit_count_week = CASE WHEN p_reset_cooldown THEN 0 ELSE profile_edit_count_week END,
        updated_at = now()
    WHERE id = p_user_id;

    -- 2. Nueva contraseña en auth.users si aplica
    IF p_new_password IS NOT NULL AND LENGTH(TRIM(p_new_password)) >= 6 THEN
        UPDATE auth.users
        SET encrypted_password = crypt(p_new_password, gen_salt('bf')),
            updated_at = now()
        WHERE id = p_user_id;

        UPDATE public.usuarios
        SET clave = p_new_password,
            updated_at = now()
        WHERE email = v_user_email OR user_id = p_user_id::text;
    END IF;

    -- 3. Actualizar rol en user_roles
    IF p_role_name IS NOT NULL AND p_role_name <> '' THEN
        SELECT id INTO v_role_id FROM public.roles WHERE name = p_role_name LIMIT 1;
        IF v_role_id IS NOT NULL THEN
            DELETE FROM public.user_roles WHERE user_id = p_user_id;
            INSERT INTO public.user_roles (user_id, role_id) VALUES (p_user_id, v_role_id);
        END IF;
    END IF;

    -- 4. Actualizar tabla usuarios (legacy)
    UPDATE public.usuarios
    SET 
        nombre_apellido = COALESCE(NULLIF(p_full_name, ''), nombre_apellido),
        cedula = COALESCE(NULLIF(p_document_id, ''), cedula),
        rol = CASE 
            WHEN p_role_name IN ('superadmin', 'module_admin') THEN 'Admin'
            WHEN p_role_name = 'supervisor' THEN 'Supervisor'
            WHEN p_role_name = 'data_analyst' THEN 'Analista'
            ELSE 'Operador'
        END,
        sub_rol = COALESCE(NULLIF(p_sub_rol, ''), sub_rol),
        turno = COALESCE(NULLIF(p_turno, ''), turno),
        telefono = p_phone,
        direccion = p_address,
        institucion = p_institucion,
        dispositivo_vinculado_id = COALESCE(NULLIF(p_extension, ''), dispositivo_vinculado_id),
        areas_ids = COALESCE(p_areas, areas_ids),
        updated_at = now()
    WHERE email = v_user_email OR user_id = p_user_id::text;

    -- 5. Actualizar extensión en briana_extensiones si se especificó
    IF p_extension IS NOT NULL AND p_extension <> '' THEN
        INSERT INTO public.briana_extensiones (usuario, extension, turno, fecha)
        VALUES (v_username, p_extension, COALESCE(NULLIF(p_turno, ''), 'Mañana'), now());
    END IF;

    RETURN jsonb_build_object('success', true, 'message', 'Usuario actualizado con éxito');
END;
$fn$;
""")

# Permisos
cur.execute("""
    GRANT EXECUTE ON FUNCTION public.nexus_admin_get_users(TEXT, TEXT, TEXT) TO authenticated, anon, service_role;
    GRANT EXECUTE ON FUNCTION public.nexus_admin_create_user(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) TO authenticated, anon, service_role;
    GRANT EXECUTE ON FUNCTION public.nexus_admin_update_user(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT, BOOLEAN, TEXT, JSONB) TO authenticated, anon, service_role;
""")

conn.commit()
print("RPCs actualizadas con soporte para extensiones Briana y areas Asys/Oriana!")
conn.close()
