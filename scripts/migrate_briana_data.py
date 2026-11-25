import openpyxl
import psycopg2
from psycopg2.extras import execute_values
from datetime import datetime, date
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
    print("Iniciando migración y sembrado de Briana...")
    conn = psycopg2.connect(DB_URL)
    conn.autocommit = False
    cur = conn.cursor()

    wb = openpyxl.load_workbook(EXCEL_FILE, data_only=True)

    # 1. Migrar Extensiones de IssabellBriana
    print("--- 1. Migrando Extensiones de IssabellBriana ---")
    cur.execute("TRUNCATE TABLE public.briana_extensiones RESTART IDENTITY CASCADE;")
    sheet_ext = wb['IssabellBriana']
    ext_rows = list(sheet_ext.iter_rows(values_only=True))[1:]
    ext_data = []
    seen_users = set()
    for r in ext_rows:
        u = clean_val(r[0])
        ext = clean_val(r[1])
        if not u or not ext:
            continue
        ts = clean_date(r[2]) or datetime.now()
        turno = clean_val(r[3]) or 'Mañana'
        ext_str = str(int(float(ext))) if isinstance(ext, (int, float)) else str(ext).strip()
        ext_data.append((str(u).strip(), ext_str, turno, ts))

    if ext_data:
        execute_values(cur, """
        INSERT INTO public.briana_extensiones (usuario, extension, turno, fecha)
        VALUES %s
        """, ext_data)
    print(f"✓ {len(ext_data)} Extensiones migradas a briana_extensiones.")

    # 2. Sembrar Formularios Dinámicos
    print("--- 2. Sembrando Formularios Predeterminados ---")
    cur.execute("TRUNCATE TABLE public.briana_formularios RESTART IDENTITY CASCADE;")
    
    formularios = [
        {
            "nombre": "Tipificación Estándar",
            "campos": [
                {"label": "Teléfono Contactado", "tipo": "telefono", "requerido": True},
                {"label": "Nombre del Contacto", "tipo": "texto", "requerido": True},
                {"label": "Cédula", "tipo": "texto", "requerido": False},
                {"label": "Estado / Región", "tipo": "select", "opciones": "Distrito Capital,Miranda,La Guaira,Aragua,Carabobo,Zulia,Lara,Anzoátegui,Bolívar", "requerido": True},
                {"label": "Estado de la Llamada", "tipo": "select", "opciones": "Efectiva,No Contesta,Ocupado,Número Inválido,Rechazado,Volver a Llamar", "requerido": True},
                {"label": "Observaciones", "tipo": "textarea", "requerido": False}
            ]
        },
        {
            "nombre": "Encuesta Hábitat y Vivienda",
            "campos": [
                {"label": "Teléfono Contactado", "tipo": "telefono", "requerido": True},
                {"label": "Nombre del Beneficiario", "tipo": "texto", "requerido": True},
                {"label": "Cédula", "tipo": "texto", "requerido": True},
                {"label": "Comunidad / Sector", "tipo": "texto", "requerido": True},
                {"label": "Tipo de Solicitud", "tipo": "select", "opciones": "Rehabilitación,Nueva Vivienda,Adjudicación,Titularidad,Servicios Básicos", "requerido": True},
                {"label": "Nivel de Prioridad", "tipo": "select", "opciones": "Alta,Media,Baja", "requerido": True},
                {"label": "Observaciones de la Gestión", "tipo": "textarea", "requerido": False}
            ]
        },
        {
            "nombre": "Reporte de Incidencia Técnica",
            "campos": [
                {"label": "Terminal Samsung / IMEI", "tipo": "texto", "requerido": True},
                {"label": "Operador Reportante", "tipo": "texto", "requerido": True},
                {"label": "Tipo de Incidencia", "tipo": "select", "opciones": "Sin Señal Móvil,Falla de Audio,Batería / Carga,Llamadas Bloqueadas,Pantalla / Touch", "requerido": True},
                {"label": "Severidad", "tipo": "select", "opciones": "Crítica (1h),Alta (4h),Media (24h),Baja (72h)", "requerido": True},
                {"label": "Detalle del Incidente", "tipo": "textarea", "requerido": True}
            ]
        }
    ]

    for f in formularios:
        cur.execute("""
        INSERT INTO public.briana_formularios (nombre, campos)
        VALUES (%s, %s)
        ON CONFLICT (nombre) DO UPDATE SET campos = EXCLUDED.campos;
        """, (f["nombre"], json.dumps(f["campos"])))
    print("✓ Formularios creados exitosamente.")

    # 3. Sembrar Campañas de Llamadas
    print("--- 3. Sembrando Campañas de Llamadas ---")
    cur.execute("TRUNCATE TABLE public.briana_campanas RESTART IDENTITY CASCADE;")

    campanas = [
        (
            "Campaña Verificación Comunal MINVH",
            date.today(),
            date(2026, 12, 31),
            "Activa",
            "Validación y confirmación telefónica de voceros comunales de hábitat y vivienda.",
            ["admin", "dvicente", "yindriago", "sreveron", "jmadrid", "brando", "diego"],
            "Buenos días/tardes, le saluda la Dirección General del MINVH para validar sus datos comunales...",
            "Tipificación Estándar",
            "Saliente",
            85,
            24,
            "Issabel",
            "Telefono,Nombre,Cedula,Estado,Sector"
        ),
        (
            "Atención 0-800 Hábitat y Vivienda",
            date.today(),
            date(2026, 12, 31),
            "Activa",
            "Línea de atención telefónica receptiva para reclamos e incidencias habitacionales.",
            ["admin", "dvicente", "yindriago", "sreveron", "jmadrid", "brando", "diego"],
            "Gracias por comunicarse con la línea 0-800 Hábitat y Vivienda. ¿En qué le podemos servir?",
            "Encuesta Hábitat y Vivienda",
            "Entrante",
            90,
            12,
            "Issabel",
            "Telefono,Nombre,Cedula,TipoSolicitud,Sector"
        ),
        (
            "Seguimiento y Control Operativo",
            date.today(),
            date(2026, 12, 31),
            "Activa",
            "Campañas especiales de reactivación y seguimiento de compromisos asumidos.",
            ["admin", "dvicente", "yindriago", "sreveron", "jmadrid"],
            "Estimado ciudadano, le contactamos para hacer seguimiento a su solicitud técnica...",
            "Tipificación Estándar",
            "Saliente",
            80,
            48,
            "Manual",
            "Telefono,Nombre,Cedula,Observaciones"
        )
    ]

    for c in campanas:
        cur.execute("""
        INSERT INTO public.briana_campanas (
            nombre, fecha, fecha_fin, estatus, descripcion, usuarios, dialogo, formulario_id, tipo_campana, meta, sla, tipo_asignacion, columnas_visibles
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (nombre) DO UPDATE SET
            estatus = EXCLUDED.estatus,
            usuarios = EXCLUDED.usuarios,
            meta = EXCLUDED.meta,
            sla = EXCLUDED.sla;
        """, c)
    print("✓ Campañas de llamadas sembradas exitosamente.")

    # 4. Sembrar Leads de Prueba en briana_data_campanas
    print("--- 4. Sembrando Leads de Campaña ---")
    cur.execute("TRUNCATE TABLE public.briana_data_campanas RESTART IDENTITY CASCADE;")
    
    leads = [
        ("Campaña Verificación Comunal MINVH", 1, {"Telefono": "04141234567", "Nombre": "Carlos Mendoza", "Cedula": "18456123", "Estado": "Distrito Capital", "Sector": "Catia"}, "Pendiente"),
        ("Campaña Verificación Comunal MINVH", 2, {"Telefono": "04169876543", "Nombre": "María Josefina Peña", "Cedula": "15789456", "Estado": "Miranda", "Sector": "Petare"}, "Pendiente"),
        ("Campaña Verificación Comunal MINVH", 3, {"Telefono": "04245558899", "Nombre": "Pedro Antonio Rivas", "Cedula": "12365478", "Estado": "La Guaira", "Sector": "Maiquetía"}, "Pendiente"),
        ("Campaña Verificación Comunal MINVH", 4, {"Telefono": "04123334455", "Nombre": "Ana Belén Morales", "Cedula": "20147852", "Estado": "Aragua", "Sector": "Maracay"}, "Pendiente"),
        ("Campaña Verificación Comunal MINVH", 5, {"Telefono": "04161112233", "Nombre": "José Gregorio Silva", "Cedula": "14258963", "Estado": "Carabobo", "Sector": "Valencia"}, "Pendiente"),
        ("Campaña Verificación Comunal MINVH", 6, {"Telefono": "04249998877", "Nombre": "Luisa Fernanda Gómez", "Cedula": "19365214", "Estado": "Zulia", "Sector": "Maracaibo"}, "Pendiente"),
        ("Campaña Verificación Comunal MINVH", 7, {"Telefono": "04127776655", "Nombre": "Ramón Eduardo Díaz", "Cedula": "16547896", "Estado": "Lara", "Sector": "Barquisimeto"}, "Pendiente"),
        ("Campaña Verificación Comunal MINVH", 8, {"Telefono": "04148889900", "Nombre": "Yolanda Coromoto Torres", "Cedula": "11258963", "Estado": "Anzoátegui", "Sector": "Barcelona"}, "Pendiente")
    ]

    for l in leads:
        cur.execute("""
        INSERT INTO public.briana_data_campanas (campana_nombre, fila_numero, datos, estado_gestion)
        VALUES (%s, %s, %s, %s);
        """, (l[0], l[1], json.dumps(l[2]), l[3]))
    print(f"✓ {len(leads)} Leads sembrados para marcación inmediata.")

    # 5. Sembrar Gestiones de Ejemplo
    print("--- 5. Sembrando Gestiones Previas de Ejemplo ---")
    cur.execute("TRUNCATE TABLE public.briana_gestiones RESTART IDENTITY CASCADE;")
    gestiones = [
        ("Campaña Verificación Comunal MINVH", "Efectiva", "admin", "04141234567", "Carlos Mendoza", json.dumps({"Estado de la Llamada": "Efectiva", "Observaciones": "Datos verificados correctamente"}), 145, "11001"),
        ("Campaña Verificación Comunal MINVH", "Efectiva", "dvicente", "04169876543", "María Josefina Peña", json.dumps({"Estado de la Llamada": "Efectiva", "Observaciones": "Comunidad organizada con comité activo"}), 190, "11003"),
        ("Campaña Verificación Comunal MINVH", "No Contesta", "yindriago", "04245558899", "Pedro Antonio Rivas", json.dumps({"Estado de la Llamada": "No Contesta", "Observaciones": "Sin repique"}), 25, "11008")
    ]
    for g in gestiones:
        cur.execute("""
        INSERT INTO public.briana_gestiones (campana_nombre, resultado, usuario, telefono, nombre_contacto, datos_gestion, duracion_segundos, extension)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s);
        """, g)
    print("✓ Gestiones sembradas exitosamente.")

    conn.commit()
    conn.close()
    print("🎉 Migración y preparación de datos para Briana completada con éxito!")

if __name__ == '__main__':
    main()
