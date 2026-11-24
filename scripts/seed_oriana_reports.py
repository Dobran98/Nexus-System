import psycopg2
import uuid
from datetime import datetime, timedelta

DB_URL = 'postgresql://postgres.pzkqjdkphcwmblbyorbr:yfcLIxzEWObS4Dio@aws-0-us-east-1.pooler.supabase.com:6543/postgres'
conn = psycopg2.connect(DB_URL)
cur = conn.cursor()

# 1. Obtener analistas y supervisor
cur.execute('''
    SELECT u.id, p.full_name 
    FROM auth.users u
    JOIN public.profiles p ON p.id = u.id
    JOIN public.user_roles ur ON ur.user_id = u.id
    JOIN public.roles r ON r.id = ur.role_id
    WHERE r.name = 'data_analyst'
    ORDER BY p.full_name;
''')
analysts = cur.fetchall()

cur.execute('''
    SELECT u.id 
    FROM auth.users u
    JOIN public.user_roles ur ON ur.user_id = u.id
    JOIN public.roles r ON r.id = ur.role_id
    WHERE r.name = 'supervisor'
    LIMIT 1;
''')
reviewer_id = cur.fetchone()[0]

print(f"Analistas encontrados: {len(analysts)}")

# Limpiar data previa si existiera
cur.execute("DELETE FROM public.oriana_metrics;")
cur.execute("DELETE FROM public.oriana_reports;")

seed_reports = [
    {
        'title': 'Validación Comunal Lote 01 — Iribarren Catedral',
        'batch': 'LOT-2026-V8-001-IRI',
        'total': 1250,
        'processed': 1250,
        'status': 'approved',
        'accuracy': 99.20,
        'discrepancies': 3,
        'time_mins': 95,
        'analyst_idx': 0,
        'days_ago': 3,
        'deadline_hours': 24,
        'notes': 'Revisado y validado sin inconsistencias materiales.'
    },
    {
        'title': 'Auditoría Territorial Lote 02 — Palavecino Cabudare',
        'batch': 'LOT-2026-V8-002-PAL',
        'total': 980,
        'processed': 980,
        'status': 'approved',
        'accuracy': 98.90,
        'discrepancies': 5,
        'time_mins': 80,
        'analyst_idx': 1,
        'days_ago': 2,
        'deadline_hours': 18,
        'notes': 'Lote procesado en tiempo óptimo.'
    },
    {
        'title': 'Control de Calidad Lote 03 — Torres Carora Centro',
        'batch': 'LOT-2026-V8-003-TOR',
        'total': 1500,
        'processed': 1420,
        'status': 'review_pending',
        'accuracy': 98.40,
        'discrepancies': 8,
        'time_mins': 120,
        'analyst_idx': 2,
        'days_ago': 1,
        'deadline_hours': 36,
        'notes': None
    },
    {
        'title': 'Cruce Telefónico Lote 04 — Jiménez Quíbor',
        'batch': 'LOT-2026-V8-004-JIM',
        'total': 850,
        'processed': 850,
        'status': 'approved',
        'accuracy': 99.60,
        'discrepancies': 1,
        'time_mins': 65,
        'analyst_idx': 3,
        'days_ago': 1,
        'deadline_hours': 12,
        'notes': 'Excelente correlación de datos.'
    },
    {
        'title': 'Validación Comunitaria Lote 05 — Morán El Tocuyo',
        'batch': 'LOT-2026-V8-005-MOR',
        'total': 1100,
        'processed': 950,
        'status': 'review_pending',
        'accuracy': 97.80,
        'discrepancies': 12,
        'time_mins': 110,
        'analyst_idx': 4,
        'days_ago': 0,
        'deadline_hours': 48,
        'notes': None
    },
    {
        'title': 'Auditoría de Ingesta Lote 06 — Crespo Duaca',
        'batch': 'LOT-2026-V8-006-CRE',
        'total': 620,
        'processed': 310,
        'status': 'draft',
        'accuracy': 98.50,
        'discrepancies': 2,
        'time_mins': 45,
        'analyst_idx': 5,
        'days_ago': 0,
        'deadline_hours': 72,
        'notes': None
    },
    {
        'title': 'Validación de Contactos Lote 07 — Andrés Eloy Blanco Sanare',
        'batch': 'LOT-2026-V8-007-AEB',
        'total': 740,
        'processed': 740,
        'status': 'approved',
        'accuracy': 99.40,
        'discrepancies': 2,
        'time_mins': 55,
        'analyst_idx': 6,
        'days_ago': 2,
        'deadline_hours': 20,
        'notes': 'Aprobado sin observaciones.'
    },
    {
        'title': 'Inspección de Muestra Lote 08 — Urdaneta Siquisique',
        'batch': 'LOT-2026-V8-008-URD',
        'total': 890,
        'processed': 800,
        'status': 'review_pending',
        'accuracy': 98.70,
        'discrepancies': 6,
        'time_mins': 90,
        'analyst_idx': 7,
        'days_ago': 0,
        'deadline_hours': 24,
        'notes': None
    },
    {
        'title': 'Análisis de Cobertura Lote 09 — Simón Planas Sarare',
        'batch': 'LOT-2026-V8-009-SMP',
        'total': 530,
        'processed': 530,
        'status': 'approved',
        'accuracy': 99.80,
        'discrepancies': 0,
        'time_mins': 40,
        'analyst_idx': 8,
        'days_ago': 1,
        'deadline_hours': 15,
        'notes': 'Cero discrepancias registradas.'
    }
]

now = datetime.utcnow()

for s in seed_reports:
    report_id = str(uuid.uuid4())
    analyst_id, analyst_name = analysts[s['analyst_idx'] % len(analysts)]
    created_at = now - timedelta(days=s['days_ago'], hours=2)
    deadline = created_at + timedelta(hours=s['deadline_hours'])
    reviewed_at = (created_at + timedelta(hours=2)) if s['status'] == 'approved' else None
    
    cur.execute('''
        INSERT INTO public.oriana_reports (
            id,
            analyst_id,
            report_title,
            batch_reference,
            total_records,
            processed_records,
            status,
            submission_deadline,
            reviewer_id,
            reviewer_notes,
            reviewed_at,
            created_at,
            updated_at
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s);
    ''', (
        report_id,
        analyst_id,
        s['title'],
        s['batch'],
        s['total'],
        s['processed'],
        s['status'],
        deadline,
        reviewer_id if s['status'] == 'approved' else None,
        s['notes'],
        reviewed_at,
        created_at,
        now
    ))

    # Insertar métrica asociada
    rec_per_hour = round((s['processed'] / s['time_mins']) * 60, 1)
    cur.execute('''
        INSERT INTO public.oriana_metrics (
            id,
            report_id,
            validation_accuracy,
            discrepancy_count,
            processing_time_minutes,
            records_per_hour,
            audit_notes,
            created_at
        ) VALUES (gen_random_uuid(), %s, %s, %s, %s, %s, %s, %s);
    ''', (
        report_id,
        s['accuracy'],
        s['discrepancies'],
        s['time_mins'],
        rec_per_hour,
        f"Auditoría automática: {rec_per_hour} registros/hora con {s['accuracy']}% precisión.",
        created_at
    ))

conn.commit()

# Verificar vista
cur.execute('SELECT count(*), avg(validation_accuracy) FROM public.v_oriana_reports_summary;')
cnt, avg_acc = cur.fetchone()
print(f"Carga exitosa: {cnt} reportes en v_oriana_reports_summary con precisión promedio de {avg_acc:.2f}%")

conn.close()
