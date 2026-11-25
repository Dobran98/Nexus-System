import psycopg2

conn = psycopg2.connect('postgresql://postgres.pzkqjdkphcwmblbyorbr:yfcLIxzEWObS4Dio@aws-0-us-east-1.pooler.supabase.com:6543/postgres')
cur = conn.cursor()

# 1. Obtener ID del rol superadmin
cur.execute("SELECT id FROM roles WHERE name = 'superadmin';")
superadmin_role_id = cur.fetchone()[0]

# 2. Verificar si brando@impress.com existe en auth.users
cur.execute("SELECT id, email FROM auth.users WHERE email = 'brando@impress.com';")
row = cur.fetchone()

if row:
    user_id = row[0]
    print(f"Usuario brando@impress.com existe con ID: {user_id}")
    # Actualizar contraseña conocida para Brando
    cur.execute("""
        UPDATE auth.users 
        SET encrypted_password = crypt('BrandoRoot2026*', gen_salt('bf')),
            updated_at = now()
        WHERE id = %s;
    """, (user_id,))
else:
    print("Creando usuario brando@impress.com...")
    cur.execute("""
        INSERT INTO auth.users (
            instance_id, id, aud, role, email, encrypted_password, 
            email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
        ) VALUES (
            '00000000-0000-0000-0000-000000000000',
            gen_random_uuid(),
            'authenticated',
            'authenticated',
            'brando@impress.com',
            crypt('BrandoRoot2026*', gen_salt('bf')),
            now(),
            '{"provider":"email","providers":["email"]}',
            '{"full_name":"Brando González","is_founder":true}',
            now(),
            now()
        ) RETURNING id;
    """)
    user_id = cur.fetchone()[0]
    print(f"Creado con ID: {user_id}")

# 3. Asignar perfil en profiles
cur.execute("""
    INSERT INTO profiles (id, full_name, document_id, is_active, phone_number, address)
    VALUES (%s, 'Brando González', 'V-BRANDO01', true, '+58 412 0000000', 'Sede Central Corporativa')
    ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        document_id = EXCLUDED.document_id,
        is_active = true;
""", (user_id,))

# 4. Asignar rol superadmin en user_roles
cur.execute("""
    INSERT INTO user_roles (user_id, role_id)
    VALUES (%s, %s)
    ON CONFLICT (user_id, role_id) DO NOTHING;
""", (user_id, superadmin_role_id))

# 5. En tabla usuarios (legacy) asegurar registro único para Brando
cur.execute("""
    UPDATE usuarios 
    SET email = 'brando@impress.com', 
        rol = 'Superadmin', 
        sub_rol = 'Coordinador General',
        nombre_apellido = 'Brando González'
    WHERE usuario ILIKE '%brando%';
""")

conn.commit()
print("Superadmin Brando configurado con éxito!")
conn.close()
