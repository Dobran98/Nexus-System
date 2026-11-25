import os
import psycopg2
from psycopg2.extras import execute_values
import pandas as pd
import openpyxl

DATABASE_URL = "postgresql://postgres.pzkqjdkphcwmblbyorbr:yfcLIxzEWObS4Dio@aws-0-us-east-1.pooler.supabase.com:6543/postgres"

def setup_elecciones_schema(cursor):
    print("Configurando tablas de Elecciones...")
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS public.elecciones_municipios (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        estado TEXT NOT NULL,
        municipio TEXT NOT NULL,
        centros_totales INT DEFAULT 0,
        centros_activos_8am INT DEFAULT 0,
        mesas_totales INT DEFAULT 0,
        mesas_activas INT DEFAULT 0,
        h9 INT DEFAULT 0,
        h10 INT DEFAULT 0,
        h11 INT DEFAULT 0,
        h12 INT DEFAULT 0,
        h13 INT DEFAULT 0,
        h14 INT DEFAULT 0,
        h15 INT DEFAULT 0,
        h16 INT DEFAULT 0,
        h17 INT DEFAULT 0,
        h20 INT DEFAULT 0,
        condominios_movilizados INT DEFAULT 0,
        votantes_condominios INT DEFAULT 0,
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        updated_by TEXT,
        CONSTRAINT uq_estado_municipio UNIQUE (estado, municipio)
    );

    CREATE TABLE IF NOT EXISTS public.elecciones_incidencias (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        estado TEXT NOT NULL,
        municipio TEXT NOT NULL,
        centro_nombre TEXT,
        categoria TEXT NOT NULL,
        descripcion TEXT NOT NULL,
        usuario_reportador TEXT,
        status TEXT DEFAULT 'Pendiente',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        resolved_at TIMESTAMPTZ,
        solucion_notas TEXT
    );

    CREATE TABLE IF NOT EXISTS public.elecciones_config (
        key TEXT PRIMARY KEY,
        value JSONB NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    """)
    print("Tablas de elecciones creadas exitosamente.")

def seed_elecciones_from_csv(cursor):
    csv_path = r"ELECCIONES\migrador-datos\otro.csv"
    if not os.path.exists(csv_path):
        print(f"No se encontró {csv_path}")
        return

    df = pd.read_csv(csv_path)
    print(f"Cargando {len(df)} municipios desde {csv_path}...")

    # Verificar si ya existen registros
    cursor.execute("SELECT COUNT(*) FROM public.elecciones_municipios;")
    count = cursor.fetchone()[0]
    if count >= 335:
        print(f"Ya existen {count} registros en elecciones_municipios. Se mantiene la data.")
        return

    insert_rows = []
    for _, row in df.iterrows():
        estado = str(row['ESTADO']).strip().upper() if pd.notna(row['ESTADO']) else ''
        municipio = str(row['MUNICIPIOS']).strip().upper() if pd.notna(row['MUNICIPIOS']) else ''
        if not estado or not municipio:
            continue

        centros_totales = int(row['CANTIDAD DE CENTROS TOTALES']) if pd.notna(row['CANTIDAD DE CENTROS TOTALES']) and str(row['CANTIDAD DE CENTROS TOTALES']).isdigit() else 0
        centros_activos = int(row['CENTROS ELECTORALES ACTIVOS 8:00 AM']) if pd.notna(row['CENTROS ELECTORALES ACTIVOS 8:00 AM']) and str(row['CENTROS ELECTORALES ACTIVOS 8:00 AM']).isdigit() else 0
        mesas_totales = int(row['MESAS TOTALES']) if pd.notna(row['MESAS TOTALES']) and str(row['MESAS TOTALES']).isdigit() else 0
        mesas_activas = int(row['MESAS ACTIVAS']) if pd.notna(row['MESAS ACTIVAS']) and str(row['MESAS ACTIVAS']).isdigit() else 0

        insert_rows.append((
            estado, municipio, centros_totales, centros_activos, mesas_totales, mesas_activas
        ))

    query = """
    INSERT INTO public.elecciones_municipios 
    (estado, municipio, centros_totales, centros_activos_8am, mesas_totales, mesas_activas)
    VALUES %s
    ON CONFLICT (estado, municipio) DO UPDATE SET
        centros_totales = EXCLUDED.centros_totales,
        mesas_totales = EXCLUDED.mesas_totales;
    """
    execute_values(cursor, query, insert_rows)
    print(f"Insertados/Actualizados {len(insert_rows)} municipios electorales.")

def seed_initial_reclasificacion_lote(cursor):
    cursor.execute("SELECT id, total_registros FROM public.reclasificacion_lotes LIMIT 1;")
    existing = cursor.fetchone()
    if existing:
        print(f"Ya existe lote de reclasificación (ID: {existing[0]}, Registros: {existing[1]}).")
        return

    excel_path = r"Reclasificación\DATA GENERAL - INCIDENCIAS 18_11_26.xlsx"
    if not os.path.exists(excel_path):
        print("No se encontró archivo Excel de reclasificación.")
        return

    print("Leyendo muestra inicial de incidencias para Reclasificación desde Excel...")
    wb = openpyxl.load_workbook(excel_path, read_only=True)
    sheet = wb['GENERAL PARA REPARTIR ']

    cursor.execute("""
    INSERT INTO public.reclasificacion_lotes (nombre_lote, descripcion, archivo_origen, total_registros)
    VALUES ('Lote 18-Nov Incidencias Generales', 'Carga inicial del consolidado nacional de incidencias para triage', 'DATA GENERAL - INCIDENCIAS 18_11_26.xlsx', 0)
    RETURNING id;
    """)
    lote_id = cursor.fetchone()[0]

    records = []
    for i, row in enumerate(sheet.iter_rows(values_only=True)):
        if i >= 300: # Cargar primeros 300 casos
            break
        # Estructura del Excel:
        # 0: LISTADO, 1: N, 2: MODO, 3: ESTADO, 4: MUNICIPIO, 5: PARROQUIA, 6: CORRELATIVO, 7: STATUS,
        # 8: CODIGOSITUR, 9: CODIGOCNE, 10: NOMBREOBPP, 11: NOMBRE Y APELLIDO, 14: CEDULA, 15: TELEFONO,
        # 16: CODIGO_INCIDENCIA, 17: DESCRIPCION_DETALLADA, 18: INSTITUCION_RESPONSABLE, 20: TIPO_ACCION,
        # 21: CATEGORIA, 22: SUBCATEGORIA, 24: FECHA_EVENTO, 26: RAMA_AREA
        n_fila = row[1] if len(row) > 1 and row[1] is not None and isinstance(row[1], (int, float)) else i
        modo = str(row[2]) if len(row) > 2 and row[2] else 'incidencias'
        estado_geo = str(row[3]) if len(row) > 3 and row[3] else 'DESCONOCIDO'
        municipio = str(row[4]) if len(row) > 4 and row[4] else ''
        parroquia = str(row[5]) if len(row) > 5 and row[5] else ''
        correlativo = str(row[6]) if len(row) > 6 and row[6] else ''
        status = str(row[7]) if len(row) > 7 and row[7] else 'Pendiente'
        codigositur = str(row[8]) if len(row) > 8 and row[8] else ''
        codigocne = str(row[9]) if len(row) > 9 and row[9] else ''
        obpp = str(row[10]) if len(row) > 10 and row[10] else ''
        persona = str(row[11]) if len(row) > 11 and row[11] else ''
        cedula = str(row[14]) if len(row) > 14 and row[14] else ''
        telefono = str(row[15]) if len(row) > 15 and row[15] else ''
        codigo_inc = str(row[16]) if len(row) > 16 and row[16] else ''
        desc = str(row[17]) if len(row) > 17 and row[17] else ''
        institucion = str(row[18]) if len(row) > 18 and row[18] else ''
        tipo_accion = str(row[20]) if len(row) > 20 and row[20] else ''
        categoria = str(row[21]) if len(row) > 21 and row[21] else ''
        subcategoria = str(row[22]) if len(row) > 22 and row[22] else ''
        rama_area = str(row[26]) if len(row) > 26 and row[26] else ''

        records.append((
            lote_id, n_fila, modo, estado_geo, municipio, parroquia, correlativo, status,
            codigositur, codigocne, obpp, persona, cedula, telefono, codigo_inc,
            desc, institucion, tipo_accion, categoria, subcategoria, rama_area
        ))

    wb.close()

    insert_query = """
    INSERT INTO public.reclasificacion_registros (
        lote_id, n_fila, modo, estado_geo, municipio, parroquia, correlativo, status_original,
        codigo_situr, codigo_cne, nombre_obpp, responsable_nombre, cedula, telefono, codigo_incidencia,
        descripcion_detallada, institucion_responsable, tipo_accion, categoria, subcategoria,
        rama_area
    ) VALUES %s;
    """
    execute_values(cursor, insert_query, records)

    cursor.execute("""
    UPDATE public.reclasificacion_lotes 
    SET total_registros = %s 
    WHERE id = %s;
    """, (len(records), lote_id))

    print(f"Cargado lote {lote_id} con {len(records)} registros iniciales.")

def main():
    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = False
    cur = conn.cursor()
    try:
        setup_elecciones_schema(cur)
        seed_elecciones_from_csv(cur)
        seed_initial_reclasificacion_lote(cur)
        conn.commit()
        print("Migración y seeding completados con éxito.")
    except Exception as e:
        conn.rollback()
        print("Error en migración:", e)
        raise e
    finally:
        cur.close()
        conn.close()

if __name__ == '__main__':
    main()
