import openpyxl
import psycopg2
from psycopg2.extras import execute_values
from datetime import datetime, date, time
import json

EXCEL_FILE = 'SYSTEM ASIS V8 (1).xlsx'
DB_URL = 'postgresql://postgres.pzkqjdkphcwmblbyorbr:yfcLIxzEWObS4Dio@aws-0-us-east-1.pooler.supabase.com:6543/postgres'

def clean_val(v):
    if v is None:
        return None
    if isinstance(v, str):
        s = v.strip()
        return None if s.upper() in ('N/A', 'NONE', 'NULL', '') else s
    return v

def clean_date(v):
    if v is None:
        return None
    if isinstance(v, (datetime, date)):
        return v
    try:
        return datetime.fromisoformat(str(v).strip())
    except:
        return None

def main():
    print("Iniciando migración de datos de Asys a Supabase...")
    conn = psycopg2.connect(DB_URL)
    conn.autocommit = False
    cur = conn.cursor()

    wb = openpyxl.load_workbook(EXCEL_FILE, data_only=True)

    # 1. Migrar Asistencias
    print("--- 1. Migrando Asistencias ---")
    cur.execute("TRUNCATE TABLE public.asistencias RESTART IDENTITY CASCADE;")
    sheet_asis = wb['Asistencias']
    asis_rows = list(sheet_asis.iter_rows(values_only=True))[1:]
    asis_data = []
    for r in asis_rows:
        ts = clean_date(r[0])
        uid = clean_val(r[1])
        if not ts or not uid:
            continue
        nombre = clean_val(r[2])
        turno = clean_val(r[3])
        institucion = clean_val(r[4])
        tipo = clean_val(r[5])
        lat = r[6] if isinstance(r[6], (int, float)) else None
        lng = r[7] if isinstance(r[7], (int, float)) else None
        estado = clean_val(r[8]) or 'Correcto'
        dist = r[9] if isinstance(r[9], (int, float)) else None
        asis_data.append((ts, uid, nombre, turno, institucion, tipo, lat, lng, estado, dist))

    print(f"Total registros válidos de asistencia: {len(asis_data)}. Insertando por lotes de 2000...")
    insert_query = """
    INSERT INTO public.asistencias (timestamp, id_usuario, nombre_completo, turno, institucion, tipo, latitud, longitud, estado, distancia)
    VALUES %s
    """
    for i in range(0, len(asis_data), 2000):
        chunk = asis_data[i:i+2000]
        execute_values(cur, insert_query, chunk)
    print("✓ Asistencias migradas exitosamente.")

    # 2. Migrar Guardias
    print("--- 2. Migrando Guardias ---")
    cur.execute("TRUNCATE TABLE public.guardias RESTART IDENTITY CASCADE;")
    sheet_guardias = wb['Guardias']
    g_rows = list(sheet_guardias.iter_rows(values_only=True))[1:]
    g_data = []
    for r in g_rows:
        f = clean_date(r[0])
        if not f:
            continue
        f_date = f.date() if isinstance(f, datetime) else f
        turno = clean_val(r[1])
        desc = clean_val(r[2])
        cat = clean_val(r[4])
        g_data.append((f_date, turno, desc, cat, 'Programada', 12))
    if g_data:
        execute_values(cur, """
        INSERT INTO public.guardias (fecha, turno_guardia, descripcion, categoria, estado, horas_estimadas)
        VALUES %s
        """, g_data)
    print(f"✓ {len(g_data)} Guardias migradas.")

    # 3. Migrar Permisos
    print("--- 3. Migrando Permisos ---")
    cur.execute("TRUNCATE TABLE public.permisos RESTART IDENTITY CASCADE;")
    sheet_permisos = wb['Permisos']
    p_rows = list(sheet_permisos.iter_rows(values_only=True))[1:]
    p_data = []
    for r in p_rows:
        pid = str(clean_val(r[0])) if r[0] else None
        uid = clean_val(r[1])
        if not uid:
            continue
        nombre = clean_val(r[2])
        fi = clean_date(r[3])
        ff = clean_date(r[4])
        tipo = clean_val(r[5])
        estado = clean_val(r[6]) or 'Aprobado'
        coments = clean_val(r[7])
        p_data.append((pid, uid, nombre, fi, ff, tipo, estado, coments))
    if p_data:
        execute_values(cur, """
        INSERT INTO public.permisos (permiso_id, user_id, nombre_usuario, fecha_inicio, fecha_fin, tipo_permiso, estado, comentarios)
        VALUES %s
        ON CONFLICT (permiso_id) DO NOTHING
        """, p_data)
    print(f"✓ {len(p_data)} Permisos migrados.")

    # 4. Migrar Suplencias
    print("--- 4. Migrando Suplencias ---")
    cur.execute("TRUNCATE TABLE public.suplencias RESTART IDENTITY CASCADE;")
    sheet_supl = wb['Suplencias']
    s_rows = list(sheet_supl.iter_rows(values_only=True))[1:]
    s_data = []
    for r in s_rows:
        sid = str(clean_val(r[0])) if r[0] else None
        tid = clean_val(r[1])
        tnombre = clean_val(r[2])
        supl_id = clean_val(r[3])
        supl_nombre = clean_val(r[4])
        if not tid or not supl_id:
            continue
        desde = clean_date(r[5])
        hasta = clean_date(r[6])
        desde_d = desde.date() if isinstance(desde, datetime) else desde
        hasta_d = hasta.date() if isinstance(hasta, datetime) else hasta
        turno_t = clean_val(r[7])
        estado = clean_val(r[8]) or 'Aprobada'
        motivo = clean_val(r[9])
        s_data.append((sid, tid, tnombre, supl_id, supl_nombre, desde_d, hasta_d, turno_t, estado, motivo))
    if s_data:
        execute_values(cur, """
        INSERT INTO public.suplencias (suplencia_id, titular_id, nombre_titular, suplente_id, nombre_suplente, desde, hasta, turno_titular, estado, motivo)
        VALUES %s
        ON CONFLICT (suplencia_id) DO NOTHING
        """, s_data)
    print(f"✓ {len(s_data)} Suplencias migradas.")

    # 5. Migrar CrossTurnos
    print("--- 5. Migrando CrossTurnos ---")
    cur.execute("TRUNCATE TABLE public.cross_turnos RESTART IDENTITY CASCADE;")
    sheet_cross = wb['CrossTurnos']
    cr_rows = list(sheet_cross.iter_rows(values_only=True))[1:]
    cr_data = []
    for r in cr_rows:
        cid = clean_val(r[0])
        f = clean_date(r[1])
        f_date = f.date() if isinstance(f, datetime) else f
        u1 = clean_val(r[2])
        u2 = clean_val(r[3])
        if not u1 or not u2:
            continue
        estado = clean_val(r[4]) or 'Aprobada'
        solic = clean_val(r[5])
        cr_data.append((cid, f_date, u1, u2, estado, solic))
    if cr_data:
        execute_values(cur, """
        INSERT INTO public.cross_turnos (cross_id, fecha, usuario_1_id, usuario_2_id, estado, solicitante)
        VALUES %s
        ON CONFLICT (cross_id) DO NOTHING
        """, cr_data)
    print(f"✓ {len(cr_data)} CrossTurnos migrados.")

    # 6. Migrar Amonestaciones y Tipos
    print("--- 6. Migrando Amonestaciones y Tipos ---")
    cur.execute("TRUNCATE TABLE public.tipos_amonestacion RESTART IDENTITY CASCADE;")
    sheet_tam = wb['TiposAmonestacion']
    tam_rows = list(sheet_tam.iter_rows(values_only=True))[1:]
    tam_data = []
    for r in tam_rows:
        tid = clean_val(r[0])
        nom = clean_val(r[1])
        if not tid or not nom:
            continue
        desc = clean_val(r[2])
        grav = clean_val(r[3])
        auto = bool(r[4])
        cond = clean_val(r[5])
        est = clean_val(r[6]) or 'Activo'
        cp = clean_val(r[7])
        tam_data.append((tid, nom, desc, grav, auto, cond, est, cp))
    if tam_data:
        execute_values(cur, """
        INSERT INTO public.tipos_amonestacion (tipo_id, nombre, descripcion, gravedad, auto_activar, condicion_auto, estado, creado_por)
        VALUES %s
        ON CONFLICT (tipo_id) DO NOTHING
        """, tam_data)

    cur.execute("TRUNCATE TABLE public.amonestaciones RESTART IDENTITY CASCADE;")
    sheet_am = wb['Amonestaciones']
    am_rows = list(sheet_am.iter_rows(values_only=True))[1:]
    am_data = []
    for r in am_rows:
        aid = clean_val(r[0])
        uid = clean_val(r[1])
        if not aid or not uid:
            continue
        unom = clean_val(r[2])
        tid = clean_val(r[3])
        tnom = clean_val(r[4])
        desc = clean_val(r[5])
        cp = clean_val(r[6])
        cpnom = clean_val(r[7])
        est = clean_val(r[9]) or 'Activa'
        am_data.append((aid, uid, unom, tid, tnom, desc, cp, cpnom, est))
    if am_data:
        execute_values(cur, """
        INSERT INTO public.amonestaciones (amonestacion_id, usuario_target_id, usuario_target_nombre, tipo_id, tipo_nombre, descripcion, creado_por, creado_por_nombre, estado)
        VALUES %s
        ON CONFLICT (amonestacion_id) DO NOTHING
        """, am_data)
    print(f"✓ {len(am_data)} Amonestaciones migradas.")

    # 7. Migrar ConfigHorarios
    print("--- 7. Migrando ConfigHorarios ---")
    cur.execute("TRUNCATE TABLE public.config_horarios RESTART IDENTITY CASCADE;")
    sheet_cfg = wb['ConfigHorarios']
    cfg_rows = list(sheet_cfg.iter_rows(values_only=True))[1:]
    cfg_data = []
    for r in cfg_rows:
        k = clean_val(r[0])
        if not k:
            continue
        v = str(r[1]) if r[1] is not None else ''
        desc = clean_val(r[2])
        cfg_data.append((k, v, desc))
    if cfg_data:
        execute_values(cur, """
        INSERT INTO public.config_horarios (clave, valor, descripcion)
        VALUES %s
        ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor, descripcion = EXCLUDED.descripcion
        """, cfg_data)
    print(f"✓ {len(cfg_data)} ConfigHorarios migrados.")

    # 8. Migrar SolicitudesManuales
    print("--- 8. Migrando SolicitudesManuales ---")
    cur.execute("TRUNCATE TABLE public.solicitudes_manuales RESTART IDENTITY CASCADE;")
    sheet_mreq = wb['SolicitudesManuales']
    mreq_rows = list(sheet_mreq.iter_rows(values_only=True))[1:]
    mreq_data = []
    for r in mreq_rows:
        mid = clean_val(r[0])
        uid = clean_val(r[1])
        if not mid or not uid:
            continue
        unom = clean_val(r[2])
        turno = clean_val(r[3])
        inst = clean_val(r[4])
        tipo = clean_val(r[5])
        fs = clean_date(r[6])
        est = clean_val(r[7]) or 'Pendiente'
        res = clean_val(r[8])
        motivo = clean_val(r[10])
        mreq_data.append((mid, uid, unom, turno, inst, tipo, fs, est, res, motivo))
    if mreq_data:
        execute_values(cur, """
        INSERT INTO public.solicitudes_manuales (solicitud_id, usuario_id, nombre_usuario, turno, institucion, tipo, fecha_solicitud, estado, admin_resolutor, motivo)
        VALUES %s
        ON CONFLICT (solicitud_id) DO NOTHING
        """, mreq_data)
    print(f"✓ {len(mreq_data)} SolicitudesManuales migradas.")

    # 9. Actualizar usuarios con datos completos de Asys
    print("--- 9. Sincronizando Usuarios de Asys ---")
    sheet_users = wb['Usuarios']
    u_rows = list(sheet_users.iter_rows(values_only=True))[1:]
    for r in u_rows:
        raw_uid = clean_val(r[0])
        if not raw_uid:
            continue
        uid = str(int(raw_uid)) if isinstance(raw_uid, (int, float)) else str(raw_uid).strip()
        nombre = clean_val(r[1]) or ''
        inst = clean_val(r[6]) or 'Sede Central'
        tel = str(clean_val(r[7])) if clean_val(r[7]) else ''
        estado = clean_val(r[9]) or 'Activo'
        subrol = clean_val(r[14]) or 'Operador/a'
        
        # Extraer primer nombre en minúsculas
        primer_nombre = nombre.split()[0].lower() if nombre else ''

        cur.execute("""
        UPDATE public.usuarios
        SET user_id = %s,
            nombre = %s,
            primer_nombre = %s,
            sub_rol = %s,
            institucion = %s,
            telefono = %s,
            estado = %s
        WHERE id_user = %s OR usuario = %s;
        """, (uid, nombre, primer_nombre, subrol, inst, tel, estado, uid, uid))

    conn.commit()
    conn.close()
    print("🎉 Migración completa de Asys a Supabase terminada con éxito!")

if __name__ == '__main__':
    main()
