import psycopg2

conn = psycopg2.connect('postgresql://postgres.pzkqjdkphcwmblbyorbr:yfcLIxzEWObS4Dio@aws-0-us-east-1.pooler.supabase.com:6543/postgres')
cur = conn.cursor()

cur.execute("SELECT trigger_name, event_manipulation FROM information_schema.triggers WHERE event_object_table = 'profiles';")
print("Triggers en profiles:", cur.fetchall())

# Crear función y trigger estricto para cooldown de 7 días si no existe
cur.execute("""
CREATE OR REPLACE FUNCTION check_profile_cooldown_enforce()
RETURNS TRIGGER AS $$
BEGIN
    -- Permitir si last_profile_edit_at es NULL (primera edición)
    IF OLD.last_profile_edit_at IS NOT NULL THEN
        -- Si intentan cambiar teléfono o dirección antes de 7 días
        IF (OLD.phone_number IS DISTINCT FROM NEW.phone_number OR OLD.address IS DISTINCT FROM NEW.address) THEN
            IF (OLD.last_profile_edit_at + INTERVAL '7 days') > NOW() THEN
                RAISE EXCEPTION 'Restricción de Gobernanza: Debe transcurrir un período mínimo de 7 días continuos entre modificaciones de perfil personal.';
            END IF;
        END IF;
    END IF;
    
    -- Si hubo cambio en teléfono o dirección, actualizar last_profile_edit_at
    IF (OLD.phone_number IS DISTINCT FROM NEW.phone_number OR OLD.address IS DISTINCT FROM NEW.address) THEN
        NEW.last_profile_edit_at = NOW();
        NEW.profile_edit_count_week = COALESCE(OLD.profile_edit_count_week, 0) + 1;
    END IF;
    
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_profile_cooldown ON profiles;
CREATE TRIGGER trigger_profile_cooldown
BEFORE UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION check_profile_cooldown_enforce();
""")

conn.commit()
print("Trigger PostgreSQL 'trigger_profile_cooldown' verificado y activado exitosamente!")
conn.close()
