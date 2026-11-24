import psycopg2

DB_URL = 'postgresql://postgres.pzkqjdkphcwmblbyorbr:yfcLIxzEWObS4Dio@aws-0-us-east-1.pooler.supabase.com:6543/postgres'
conn = psycopg2.connect(DB_URL)
cur = conn.cursor()

sql = '''
CREATE OR REPLACE FUNCTION public.fn_create_profile_on_signup()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $$
DECLARE
    v_doc TEXT;
    v_name TEXT;
BEGIN
    v_doc := COALESCE(NEW.raw_user_meta_data ->> 'document_id', 'V-' || SUBSTRING(REPLACE(NEW.id::TEXT, '-', '') FROM 1 FOR 8));
    v_name := COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email);

    IF LENGTH(v_doc) < 4 THEN
        v_doc := 'V-' || v_doc;
    END IF;
    v_doc := SUBSTRING(v_doc FROM 1 FOR 20);

    INSERT INTO public.profiles (id, document_id, full_name)
    VALUES (NEW.id, v_doc, v_name)
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;
'''

cur.execute(sql)
conn.commit()
print('fn_create_profile_on_signup updated successfully!')
conn.close()
