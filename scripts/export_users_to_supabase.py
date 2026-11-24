import openpyxl
import psycopg2
import json
import uuid

EXCEL_FILE = 'SYSTEM ASIS V8 (1).xlsx'
DB_URL = 'postgresql://postgres.pzkqjdkphcwmblbyorbr:yfcLIxzEWObS4Dio@aws-0-us-east-1.pooler.supabase.com:6543/postgres'

ROLE_MAPPING = {
    'SuperAdmin': 'superadmin',
    'Coordinador General': 'supervisor',
    'Coordinador de Área': 'supervisor',
    'Informático/a': 'module_admin',
    'Analista': 'data_analyst',
    'Operador/a': 'multi_operator',
}

def clean_str(val):
    if val is None:
        return ''
    s = str(val).strip()
    return '' if s.upper() in ('N/A', 'NONE', 'NULL') else s

def main():
    print(f"Abriendo {EXCEL_FILE}...")
    wb = openpyxl.load_workbook(EXCEL_FILE, data_only=True)
    sheet = wb['Usuarios']
    rows = list(sheet.iter_rows(values_only=True))
    data = rows[1:]

    conn = psycopg2.connect(DB_URL)
    conn.autocommit = False
    cur = conn.cursor()

    # Obtener roles de Supabase
    cur.execute("SELECT id, name FROM public.roles;")
    db_roles = {name: rid for rid, name in cur.fetchall()}
    print(f"Roles disponibles en DB: {db_roles}")

    processed_users = []
    seen_emails = {}
    seen_cedulas = {}

    for r in data:
        if not r[0] or not r[1]:
            continue

        uid = str(r[0]).strip()
        nombre = str(r[1]).strip()
        email_raw = clean_str(r[2]).lower()
        password = str(r[3]).strip() if r[3] else 'Nexus2026*'
        rol_excel = str(r[4]).strip() if r[4] else 'Usuario'

        # Cédula
        ced_raw = r[5]
        cedula = ''
        if ced_raw is not None:
            try:
                cedula = str(int(float(ced_raw)))
            except:
                cedula = str(ced_raw).strip()
        
        # Validar longitud de cédula entre 4 y 20 caracteres (exigido por check constraint)
        if not cedula or len(cedula) < 4 or cedula in ('0', '0.0', 'N/A', 'NONE'):
            cedula = f"V-{uid}"
        cedula = cedula[:20]

        institucion = clean_str(r[6])

        # Teléfono
        tel_raw = r[7]
        telefono = None
        if tel_raw is not None:
            try:
                tel_digits = ''.join(c for c in str(tel_raw) if c.isdigit())
                if len(tel_digits) == 10 and not tel_digits.startswith('0'):
                    telefono = f"+58{tel_digits}"
                elif len(tel_digits) == 11 and tel_digits.startswith('0'):
                    telefono = f"+58{tel_digits[1:]}"
                elif len(tel_digits) >= 7:
                    telefono = f"+{tel_digits}"
                if telefono and not (7 <= len(telefono) <= 20):
                    telefono = None
            except:
                telefono = None

        direccion = clean_str(r[8]) or None
        turno = clean_str(r[9]) or 'Mixto'
        estado = clean_str(r[12]) if len(r) > 12 else 'Activo'
        is_active = (estado.lower() != 'inactivo')
        subrol = clean_str(r[14]) if len(r) > 14 else ('SuperAdmin' if rol_excel == 'Admin' else 'Operador/a')

        if not email_raw:
            email_raw = f"{uid.lower()}@nexus.corp"

        # Resolver duplicados de email
        email = email_raw
        if email in seen_emails:
            if uid == 'user144':
                email = 'jeisler.arrieche@impress.com'
            else:
                email = f"{uid.lower()}.{email}"
        seen_emails[email] = uid

        # Resolver duplicados de cédula si existieran
        if cedula in seen_cedulas:
            cedula = f"{cedula}-{uid}"[:20]
        seen_cedulas[cedula] = uid

        db_role_name = ROLE_MAPPING.get(subrol, 'multi_operator')
        role_id = db_roles.get(db_role_name, db_roles['multi_operator'])

        processed_users.append({
            'uid': uid,
            'nombre': nombre,
            'email': email,
            'password': password,
            'cedula': cedula,
            'institucion': institucion,
            'telefono': telefono,
            'direccion': direccion,
            'turno': turno,
            'is_active': is_active,
            'subrol': subrol,
            'db_role_name': db_role_name,
            'role_id': role_id
        })

    print(f"\nTotal de usuarios a insertar/actualizar: {len(processed_users)}")

    inserted_count = 0
    updated_count = 0

    for u in processed_users:
        cur.execute("SELECT id FROM auth.users WHERE email = %s;", (u['email'],))
        existing = cur.fetchone()

        user_meta = {
            'full_name': u['nombre'],
            'document_id': u['cedula'],
            'legacy_id': u['uid'],
            'subrol': u['subrol'],
            'turno': u['turno'],
            'institucion': u['institucion']
        }

        if existing:
            user_id = existing[0]
            cur.execute("""
                UPDATE auth.users
                SET encrypted_password = crypt(%s, gen_salt('bf')),
                    raw_user_meta_data = %s::jsonb,
                    updated_at = now()
                WHERE id = %s;
            """, (u['password'], json.dumps(user_meta), user_id))
            updated_count += 1
        else:
            user_id = str(uuid.uuid4())
            cur.execute("""
                INSERT INTO auth.users (
                    instance_id,
                    id,
                    aud,
                    role,
                    email,
                    encrypted_password,
                    email_confirmed_at,
                    confirmation_token,
                    recovery_token,
                    email_change_token_new,
                    email_change,
                    email_change_token_current,
                    phone_change,
                    phone_change_token,
                    reauthentication_token,
                    email_change_confirm_status,
                    is_sso_user,
                    is_anonymous,
                    raw_app_meta_data,
                    raw_user_meta_data,
                    is_super_admin,
                    created_at,
                    updated_at
                ) VALUES (
                    '00000000-0000-0000-0000-000000000000',
                    %s,
                    'authenticated',
                    'authenticated',
                    %s,
                    crypt(%s, gen_salt('bf')),
                    now(),
                    '',
                    '',
                    '',
                    '',
                    '',
                    '',
                    '',
                    '',
                    0,
                    false,
                    false,
                    '{"provider": "email", "providers": ["email"]}'::jsonb,
                    %s::jsonb,
                    %s,
                    now(),
                    now()
                );
            """, (
                user_id,
                u['email'],
                u['password'],
                json.dumps(user_meta),
                u['subrol'] == 'SuperAdmin'
            ))
            inserted_count += 1

        # 2. Insertar o actualizar profile
        cur.execute("""
            INSERT INTO public.profiles (
                id,
                document_id,
                full_name,
                phone_number,
                address,
                is_active,
                created_at,
                updated_at
            ) VALUES (
                %s, %s, %s, %s, %s, %s, now(), now()
            )
            ON CONFLICT (id) DO UPDATE
            SET document_id  = EXCLUDED.document_id,
                full_name    = EXCLUDED.full_name,
                phone_number = EXCLUDED.phone_number,
                address      = EXCLUDED.address,
                is_active    = EXCLUDED.is_active,
                updated_at   = now();
        """, (
            user_id,
            u['cedula'],
            u['nombre'],
            u['telefono'],
            u['direccion'],
            u['is_active']
        ))

        # 3. Asignar rol
        cur.execute("""
            INSERT INTO public.user_roles (user_id, role_id)
            VALUES (%s, %s)
            ON CONFLICT (user_id, role_id) DO NOTHING;
        """, (user_id, u['role_id']))

    conn.commit()
    conn.close()

    print(f"\n[OK] Migracion completada exitosamente!")
    print(f"- Nuevos insertados: {inserted_count}")
    print(f"- Actualizados: {updated_count}")

if __name__ == '__main__':
    main()
