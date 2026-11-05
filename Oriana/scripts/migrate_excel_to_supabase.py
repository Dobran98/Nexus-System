import zipfile
import xml.etree.ElementTree as ET
import glob
import os
import sys
import datetime
import json
import urllib.request
import urllib.error

def excel_serial_to_date(serial):
    try:
        val = float(serial)
        dt = datetime.datetime(1899, 12, 30) + datetime.timedelta(days=val)
        return dt.strftime("%Y-%m-%d")
    except Exception:
        return str(serial) if serial else None

def excel_serial_to_datetime(serial):
    try:
        val = float(serial)
        dt = datetime.datetime(1899, 12, 30) + datetime.timedelta(days=val)
        return dt.strftime("%Y-%m-%d %H:%M:%S")
    except Exception:
        return str(serial) if serial else None

def clean_sql_str(s):
    if s is None:
        return "NULL"
    s = str(s).replace("'", "''")
    return f"'{s}'"

def clean_sql_num(s, default="0"):
    if s is None or str(s).strip() == "":
        return default
    try:
        float(s)
        return str(s)
    except:
        return default

def main():
    files = glob.glob("*.xlsx")
    if not files:
        print("No se encontró ningún archivo .xlsx en la carpeta.")
        return

    excel_file = files[0]
    print(f"Leyendo base de datos Excel: {excel_file}...")

    with zipfile.ZipFile(excel_file, 'r') as z:
        # Cargar cadenas compartidas
        shared_strings = []
        if 'xl/sharedStrings.xml' in z.namelist():
            ss_xml = z.read('xl/sharedStrings.xml')
            ss_root = ET.fromstring(ss_xml)
            for si in ss_root.findall('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}si'):
                t = si.find('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t')
                if t is not None:
                    shared_strings.append(t.text or "")
                else:
                    text_parts = [r.find('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t').text for r in si.findall('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}r') if r.find('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t') is not None and r.find('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t').text]
                    shared_strings.append("".join(text_parts))

        # Cargar relaciones de hojas
        wb_rels = z.read('xl/_rels/workbook.xml.rels')
        rels_root = ET.fromstring(wb_rels)
        rel_map = {r.attrib['Id']: r.attrib['Target'] for r in rels_root.findall('{http://schemas.openxmlformats.org/package/2006/relationships}Relationship')}

        wb_xml = z.read('xl/workbook.xml')
        wb_root = ET.fromstring(wb_xml)
        ns = {'main': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
        sheets = {s.attrib.get('name'): 'xl/' + rel_map[s.attrib.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id')] for s in wb_root.findall('main:sheets/main:sheet', ns)}

        def get_sheet_rows(sheet_name):
            if sheet_name not in sheets:
                return []
            sheet_xml = z.read(sheets[sheet_name])
            sheet_root = ET.fromstring(sheet_xml)
            rows = sheet_root.findall('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}sheetData/{http://schemas.openxmlformats.org/spreadsheetml/2006/main}row')
            result = []
            for r in rows:
                row_dict = {}
                for c in r.findall('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}c'):
                    ref = c.attrib.get('r')
                    col = ''.join([ch for ch in ref if ch.isalpha()])
                    t_attr = c.attrib.get('t')
                    v = c.find('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}v')
                    val = v.text if v is not None else ""
                    if t_attr == 's' and val.isdigit():
                        idx = int(val)
                        val = shared_strings[idx] if idx < len(shared_strings) else val
                    row_dict[col] = val
                result.append(row_dict)
            return result

        os.makedirs("supabase", exist_ok=True)
        seed_path = "supabase/seed_data.sql"
        print(f"Generando script de volcado SQL en {seed_path}...")

        with open(seed_path, "w", encoding="utf-8") as out:
            out.write("-- ======================================================================\n")
            out.write("-- ORIANA - SEED DATA MIGRACIÓN DESDE EXCEL\n")
            out.write("-- ======================================================================\n\n")

            # 1. USUARIOS
            print("Procesando hoja Usuarios...")
            u_rows = get_sheet_rows('Usuarios')
            usuarios_data = []
            if len(u_rows) > 1:
                out.write("-- 1. USUARIOS\n")
                out.write("INSERT INTO usuarios (usuario, clave, nombre_apellido, rol, turno, id_user, cedula, backup_clave_original)\nVALUES\n")
                lines = []
                seen_users = set()
                for r in u_rows[1:]:
                    u = r.get('A', '').strip()
                    if not u or u.lower() in seen_users:
                        continue
                    seen_users.add(u.lower())
                    c = r.get('B', '').strip()
                    n = r.get('C', '').strip()
                    rol = r.get('D', 'Operador').strip() or 'Operador'
                    t = r.get('E', 'MAÑANA').strip() or 'MAÑANA'
                    id_u = r.get('F', '').strip()
                    ced = r.get('G', '').strip()
                    backup = r.get('G', '').strip() # en el excel la col G a veces tenia backup

                    lines.append(f"({clean_sql_str(u)}, {clean_sql_str(c)}, {clean_sql_str(n)}, {clean_sql_str(rol)}, {clean_sql_str(t)}, {clean_sql_str(id_u)}, {clean_sql_str(ced)}, {clean_sql_str(backup)})")
                    usuarios_data.append({
                        "usuario": u, "clave": c, "nombre_apellido": n,
                        "rol": rol, "turno": t, "id_user": id_u, "cedula": ced
                    })
                out.write(",\n".join(lines))
                out.write("\nON CONFLICT (usuario) DO UPDATE SET\n")
                out.write("  clave = EXCLUDED.clave, nombre_apellido = EXCLUDED.nombre_apellido, rol = EXCLUDED.rol, turno = EXCLUDED.turno, id_user = EXCLUDED.id_user, cedula = EXCLUDED.cedula;\n\n")

            # 2. REGLAS DE ACCESO
            print("Procesando hoja Reglas_Acceso...")
            r_rows = get_sheet_rows('Reglas_Acceso')
            if len(r_rows) > 1:
                out.write("-- 2. REGLAS_ACCESO\n")
                out.write("INSERT INTO reglas_acceso (perfil, modos_permitidos)\nVALUES\n")
                lines = []
                for r in r_rows[1:]:
                    perfil = r.get('A', '').strip()
                    modos = r.get('B', '').strip()
                    if perfil:
                        lines.append(f"({clean_sql_str(perfil)}, {clean_sql_str(modos)})")
                out.write(",\n".join(lines))
                out.write("\nON CONFLICT (perfil) DO UPDATE SET modos_permitidos = EXCLUDED.modos_permitidos;\n\n")

            # 3. AREAS DE TRABAJO
            print("Procesando hoja Areas_Trabajo...")
            a_rows = get_sheet_rows('Areas_Trabajo')
            if len(a_rows) > 1:
                out.write("-- 3. AREAS_TRABAJO\n")
                out.write("INSERT INTO areas_trabajo (id_area, nombre_area)\nVALUES\n")
                lines = []
                for r in a_rows[1:]:
                    id_a = r.get('A', '').strip()
                    nombre = r.get('B', '').strip()
                    if id_a and nombre:
                        lines.append(f"({clean_sql_str(id_a)}, {clean_sql_str(nombre)})")
                out.write(",\n".join(lines))
                out.write("\nON CONFLICT (id_area) DO UPDATE SET nombre_area = EXCLUDED.nombre_area;\n\n")

            # 4. CONFIGURACION
            print("Procesando hoja Configuracion...")
            c_rows = get_sheet_rows('Configuracion')
            if len(c_rows) > 1:
                out.write("-- 4. CONFIGURACION\n")
                out.write("INSERT INTO configuracion (modo, campanas)\nVALUES\n")
                lines = []
                for r in c_rows[1:]:
                    m = r.get('A', '').strip()
                    camps = r.get('B', '').strip()
                    if m:
                        lines.append(f"({clean_sql_str(m)}, {clean_sql_str(camps)})")
                out.write(",\n".join(lines))
                out.write("\nON CONFLICT (modo) DO UPDATE SET campanas = EXCLUDED.campanas;\n\n")

            # 5. BD_REGISTROS (En batches de 500 para evitar bloqueos)
            print("Procesando hoja BD_Registros (reportes)...")
            b_rows = get_sheet_rows('BD_Registros')
            if len(b_rows) > 1:
                out.write("-- 5. REGISTROS\n")
                batch_size = 500
                total_inserted = 0
                lines = []
                for i, r in enumerate(b_rows[1:]):
                    id_op = r.get('A', 'S/ID').strip() or 'S/ID'
                    f_reg = excel_serial_to_datetime(r.get('B'))
                    f_rep = excel_serial_to_date(r.get('C')) or datetime.date.today().strftime("%Y-%m-%d")
                    u_op = r.get('D', '').strip()
                    modo = r.get('E', '').strip()
                    camp = r.get('F', '').strip()
                    efec = clean_sql_num(r.get('G'), "0")
                    tot = clean_sql_num(r.get('H'), "0")
                    inc = clean_sql_num(r.get('I'), "0")
                    est = r.get('J', '').strip()
                    muni = r.get('K', '').strip()
                    adm_ef = clean_sql_num(r.get('L'), "NULL")
                    adm_inc = clean_sql_num(r.get('M'), "NULL")

                    if not u_op and not modo and not camp:
                        continue

                    f_reg_sql = f"'{f_reg}'::timestamptz" if f_reg else "NOW()"

                    lines.append(f"({clean_sql_str(id_op)}, {f_reg_sql}, {clean_sql_str(f_rep)}, {clean_sql_str(u_op)}, {clean_sql_str(modo)}, {clean_sql_str(camp)}, {efec}, {tot}, {inc}, {clean_sql_str(est)}, {clean_sql_str(muni)}, {adm_ef}, {adm_inc})")
                    total_inserted += 1

                    if len(lines) >= batch_size:
                        out.write("INSERT INTO registros (id_operador, fecha_registro, fecha_reporte, usuario_operador, modo_trabajo, campana, llamadas_efectivas, llamadas_totales, incidencias_reportadas, estados_abarcados, municipios_detalles, admin_efectivas, admin_incidencias)\nVALUES\n")
                        out.write(",\n".join(lines))
                        out.write(";\n\n")
                        lines = []

                if lines:
                    out.write("INSERT INTO registros (id_operador, fecha_registro, fecha_reporte, usuario_operador, modo_trabajo, campana, llamadas_efectivas, llamadas_totales, incidencias_reportadas, estados_abarcados, municipios_detalles, admin_efectivas, admin_incidencias)\nVALUES\n")
                    out.write(",\n".join(lines))
                    out.write(";\n\n")

            # 6. LOGS_AUDITORIA
            print("Procesando hoja LOGS_AUDITORIA...")
            l_rows = get_sheet_rows('LOGS_AUDITORIA')
            if len(l_rows) > 1:
                out.write("-- 6. LOGS_AUDITORIA\n")
                lines = []
                for r in l_rows[1:]:
                    f_h = excel_serial_to_datetime(r.get('A'))
                    u = r.get('B', '').strip()
                    acc = r.get('C', '').strip()
                    det = r.get('D', '').strip()
                    rol = r.get('E', '').strip()
                    f_h_sql = f"'{f_h}'::timestamptz" if f_h else "NOW()"
                    if u or acc:
                        lines.append(f"({f_h_sql}, {clean_sql_str(u)}, {clean_sql_str(acc)}, {clean_sql_str(det)}, {clean_sql_str(rol)})")
                if lines:
                    out.write("INSERT INTO logs_auditoria (fecha_hora, usuario, accion, detalle, rol)\nVALUES\n")
                    out.write(",\n".join(lines))
                    out.write(";\n\n")

        print("¡Archivo seed_data.sql generado con éxito!")

if __name__ == '__main__':
    main()

