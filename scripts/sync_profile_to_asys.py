import psycopg2

conn = psycopg2.connect('postgresql://postgres.pzkqjdkphcwmblbyorbr:yfcLIxzEWObS4Dio@aws-0-us-east-1.pooler.supabase.com:6543/postgres')
cur = conn.cursor()

# 1. Crear función trigger para sincronizar profiles -> usuarios (Asys)
cur.execute("""
CREATE OR REPLACE FUNCTION public.fn_sync_profile_to_asys()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $trig$
DECLARE
    v_email TEXT;
BEGIN
    -- Obtener email de auth.users si está disponible
    SELECT email INTO v_email FROM auth.users WHERE id = NEW.id;

    -- Actualizar tabla usuarios (Asys)
    UPDATE public.usuarios
    SET 
        nombre_apellido = COALESCE(NULLIF(NEW.full_name, ''), nombre_apellido),
        cedula = COALESCE(NULLIF(NEW.document_id, ''), cedula),
        telefono = COALESCE(NEW.phone_number, telefono),
        direccion = COALESCE(NEW.address, direccion),
        updated_at = now()
    WHERE user_id = NEW.id::text 
       OR (v_email IS NOT NULL AND email = v_email);

    RETURN NEW;
END;
$trig$;
""")

# 2. Crear trigger AFTER UPDATE ON profiles
cur.execute("""
DROP TRIGGER IF EXISTS tr_sync_profile_to_asys ON public.profiles;
CREATE TRIGGER tr_sync_profile_to_asys
AFTER UPDATE OF full_name, document_id, phone_number, address ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.fn_sync_profile_to_asys();
""")

conn.commit()
print("Trigger tr_sync_profile_to_asys instalado con éxito!")

# 3. Probar actualización
cur.execute("""
    UPDATE public.profiles 
    SET phone_number = '+58 412 1112233'
    WHERE full_name ILIKE '%brando%';
""")
conn.commit()

cur.execute("""
    SELECT usuario, nombre_apellido, telefono, direccion 
    FROM public.usuarios 
    WHERE usuario ILIKE '%brando%';
""")
print("Verificación en usuarios (Asys):", cur.fetchone())

conn.close()
