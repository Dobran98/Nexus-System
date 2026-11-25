import psycopg2
import re

conn = psycopg2.connect('postgresql://postgres.pzkqjdkphcwmblbyorbr:yfcLIxzEWObS4Dio@aws-0-us-east-1.pooler.supabase.com:6543/postgres')
cur = conn.cursor()

# Mapeos directos identificados
manual_mappings = {
    'norly': 'norly@impress.com',
    'elvis': 'elvjia@impress.com',
    'zdavila': 'zulila@impress.com',
    'emily': 'emires@impress.com',
    'mariag': 'valentinagzam@impress.com',
    'cristian': 'cristian@impress.com',
    'samuel': 'samuel.sacol2010@gmail.com',
    'reimarys': 'rmachado@impress.com',
    'kevinn': 'kevpez@impress.com',
    'Brando': 'brando@impress.com', # Y también bralez@impress.com
    'jmadrid': 'jhesus434@gmail.com',
    'santiago': 'santiagosanoja1509@gmail.com',
    'admin': 'admin@empresa.com'
}

# 1. Asignar los mapeos automáticos y manuales
cur.execute("""
    SELECT u.id, u.email, p.full_name, p.document_id
    FROM auth.users u
    LEFT JOIN profiles p ON u.id = p.id
""")
auth_users = cur.fetchall()

cur.execute("SELECT usuario, nombre_apellido, cedula FROM usuarios;")
usuarios = cur.fetchall()

def clean_name(n):
    if not n: return ""
    return re.sub(r'[^a-zA-Z0-9]', '', n.lower())

for u in usuarios:
    u_user, u_nombre, u_ced = u
    email_to_set = manual_mappings.get(u_user)
    
    if not email_to_set:
        c_u_nombre = clean_name(u_nombre)
        for au in auth_users:
            au_id, au_email, au_name, au_doc = au
            c_au_name = clean_name(au_name)
            if (c_u_nombre and (c_u_nombre in c_au_name or c_au_name in c_u_nombre)):
                email_to_set = au_email
                break
    
    if email_to_set:
        cur.execute("UPDATE usuarios SET email = %s WHERE usuario = %s;", (email_to_set, u_user))
        print(f"Updated {u_user} ({u_nombre}) -> {email_to_set}")

# Asegurar que bralez@impress.com también mapee a Brando si Brando usa bralez
cur.execute("UPDATE usuarios SET sub_rol = 'Informático/a', rol = 'Admin' WHERE usuario ILIKE '%brando%';")

# Actualizar el rol de Brando en user_roles a superadmin
cur.execute("SELECT id FROM roles WHERE name = 'superadmin';")
superadmin_role_id = cur.fetchone()[0]

cur.execute("SELECT id FROM auth.users WHERE email IN ('bralez@impress.com', 'brando@impress.com');")
brando_auth_ids = cur.fetchall()
for b_id in brando_auth_ids:
    cur.execute("INSERT INTO user_roles (user_id, role_id) VALUES (%s, %s) ON CONFLICT (user_id, role_id) DO NOTHING;", (b_id[0], superadmin_role_id))
    print(f"Brando auth {b_id[0]} assigned superadmin role")

# Si brando@impress.com no existe en auth.users, clonar o crear
cur.execute("SELECT id FROM auth.users WHERE email = 'brando@impress.com';")
if not cur.fetchone():
    print("Creating auth user for brando@impress.com...")
    # Crear auth user para brando@impress.com en auth.users
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
            crypt('admin2026*', gen_salt('bf')),
            now(),
            '{"provider":"email","providers":["email"]}',
            '{"full_name":"Brando González"}',
            now(),
            now()
        ) RETURNING id;
    """)
    new_b_id = cur.fetchone()[0]
    
    cur.execute("""
        INSERT INTO profiles (id, full_name, document_id, is_active)
        VALUES (%s, 'Brando González', 'V-BRANDO01', true)
        ON CONFLICT (id) DO NOTHING;
    """, (new_b_id,))
    
    cur.execute("""
        INSERT INTO user_roles (user_id, role_id)
        VALUES (%s, %s)
        ON CONFLICT (user_id, role_id) DO NOTHING;
    """, (new_b_id, superadmin_role_id))
    print(f"brando@impress.com created with ID {new_b_id} and superadmin role!")

conn.commit()
print("Commit successful!")
conn.close()
