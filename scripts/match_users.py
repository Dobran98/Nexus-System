import psycopg2
import re

conn = psycopg2.connect('postgresql://postgres.pzkqjdkphcwmblbyorbr:yfcLIxzEWObS4Dio@aws-0-us-east-1.pooler.supabase.com:6543/postgres')
cur = conn.cursor()

# 1. Traer auth.users y profiles
cur.execute("""
    SELECT u.id, u.email, p.full_name, p.document_id, r.name as role_name
    FROM auth.users u
    LEFT JOIN profiles p ON u.id = p.id
    LEFT JOIN user_roles ur ON u.id = ur.user_id
    LEFT JOIN roles r ON ur.role_id = r.id
""")
auth_profiles = cur.fetchall()

# 2. Traer usuarios
cur.execute("SELECT usuario, nombre_apellido, rol, sub_rol, cedula, id_user, email FROM usuarios;")
usuarios = cur.fetchall()

print(f"Total auth users: {len(auth_profiles)}")
print(f"Total usuarios en legacy: {len(usuarios)}")

# Función para normalizar nombres
def clean_name(n):
    if not n: return ""
    return re.sub(r'[^a-zA-Z0-9]', '', n.lower())

matches = 0
for u in usuarios:
    u_user, u_nombre, u_rol, u_subrol, u_ced, u_id, u_email = u
    c_u_nombre = clean_name(u_nombre)
    matched_auth = None
    
    # Buscar por documento/cedula
    if u_ced:
        ced_clean = re.sub(r'[^0-9]', '', str(u_ced))
        if len(ced_clean) > 4:
            for ap in auth_profiles:
                ap_id, ap_email, ap_name, ap_doc, ap_role = ap
                if ap_doc and re.sub(r'[^0-9]', '', str(ap_doc)) == ced_clean:
                    matched_auth = ap
                    break
    
    # Si no, buscar por nombre aproximado
    if not matched_auth and c_u_nombre:
        for ap in auth_profiles:
            ap_id, ap_email, ap_name, ap_doc, ap_role = ap
            c_ap_name = clean_name(ap_name)
            if c_u_nombre in c_ap_name or c_ap_name in c_u_nombre:
                matched_auth = ap
                break
                
    if matched_auth:
        matches += 1
        print(f"MATCH: {u_nombre} ({u_user}) <---> {matched_auth[1]} ({matched_auth[2]}) [Rol: {matched_auth[4]}]")
    else:
        print(f"NO MATCH: {u_nombre} ({u_user}, ced: {u_ced})")

print(f"\nTotal matches: {matches} / {len(usuarios)}")
conn.close()
