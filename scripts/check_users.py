import psycopg2

conn = psycopg2.connect('postgresql://postgres.pzkqjdkphcwmblbyorbr:yfcLIxzEWObS4Dio@aws-0-us-east-1.pooler.supabase.com:6543/postgres')
cur = conn.cursor()

cur.execute("SELECT usuario, nombre_apellido, rol, sub_rol, cedula, id_user FROM usuarios ORDER BY nombre_apellido;")
usuarios = cur.fetchall()

print(f"TOTAL USUARIOS EN TABLA 'usuarios': {len(usuarios)}")
for u in usuarios[:30]:
    print(" ", u)

print("\n--- RESTO ---")
for u in usuarios[30:]:
    print(" ", u)

conn.close()
