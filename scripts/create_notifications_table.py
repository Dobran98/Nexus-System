import psycopg2

conn = psycopg2.connect('postgresql://postgres.pzkqjdkphcwmblbyorbr:yfcLIxzEWObS4Dio@aws-0-us-east-1.pooler.supabase.com:6543/postgres')
cur = conn.cursor()

# 1. Crear tabla nexus_notificaciones
cur.execute("""
CREATE TABLE IF NOT EXISTS public.nexus_notificaciones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    user_email TEXT NOT NULL,
    titulo TEXT NOT NULL,
    descripcion TEXT NOT NULL,
    modulo TEXT NOT NULL CHECK (modulo IN ('briana', 'oriana', 'asys', 'sistema')),
    tipo TEXT NOT NULL CHECK (tipo IN ('tarea_pendiente', 'llamada_programada', 'reclasificacion', 'alerta_asistencia', 'aviso')),
    prioridad TEXT NOT NULL DEFAULT 'media' CHECK (prioridad IN ('baja', 'media', 'alta', 'urgente')),
    enlace TEXT,
    estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'completada', 'descartada')),
    completada_en TIMESTAMPTZ,
    notas_resolucion TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices de búsqueda rápida
CREATE INDEX IF NOT EXISTS idx_nexus_notif_user_email ON public.nexus_notificaciones(user_email);
CREATE INDEX IF NOT EXISTS idx_nexus_notif_estado ON public.nexus_notificaciones(estado);
CREATE INDEX IF NOT EXISTS idx_nexus_notif_modulo ON public.nexus_notificaciones(modulo);
""")

# 2. Sembrar notificaciones y tareas realistas para usuarios (especialmente brando@impress.com y personal activo)
cur.execute("""
    SELECT id, email FROM auth.users WHERE email IN ('brando@impress.com', 'bralez@impress.com', 'admin@empresa.com');
""")
admins = cur.fetchall()

sample_tasks = [
    {
        "titulo": "Llamada Programada: Contactar a Inversiones Los Andes",
        "descripcion": "El lead solicitó llamada de seguimiento sobre el plan corporativo de servicios. Número agendado: +58 414 1234567.",
        "modulo": "briana",
        "tipo": "llamada_programada",
        "prioridad": "alta",
        "enlace": "/llamadas"
    },
    {
        "titulo": "Reclasificación Pendiente: Lote Comunal Chacao",
        "descripcion": "Se detectó una discrepancia en el reporte del turno tarde. Se requiere reclasificar 12 registros de atención al cliente.",
        "modulo": "oriana",
        "tipo": "reclasificacion",
        "prioridad": "urgente",
        "enlace": "/oriana"
    },
    {
        "titulo": "Confirmación de Guardia de Fin de Semana",
        "descripcion": "Tiene asignada la guardia de supervisión técnica este sábado de 08:00 a 16:00. Verifique su disponibilidad en ASYS.",
        "modulo": "asys",
        "tipo": "alerta_asistencia",
        "prioridad": "media",
        "enlace": "/asistencia"
    },
    {
        "titulo": "Seguimiento de Incidencia: Terminal Samsung 11005",
        "descripcion": "Revisar sincronización del discador guiado reportado por el operador. Verificar cobertura de red celular.",
        "modulo": "briana",
        "tipo": "tarea_pendiente",
        "prioridad": "media",
        "enlace": "/llamadas"
    },
    {
        "titulo": "Auditoría de Calidad: Lote de Reportes Semanal",
        "descripcion": "Completar la validación y firma de auditoría porcentual para el cierre de operaciones en Oriana Command Center.",
        "modulo": "oriana",
        "tipo": "tarea_pendiente",
        "prioridad": "alta",
        "enlace": "/oriana"
    }
]

# Insertar para cada admin y también para usuarios generales
for a_id, a_email in admins:
    for t in sample_tasks:
        cur.execute("""
            INSERT INTO public.nexus_notificaciones (
                user_id, user_email, titulo, descripcion, modulo, tipo, prioridad, enlace, estado, created_at
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'pendiente', now())
            ON CONFLICT DO NOTHING;
        """, (a_id, a_email, t["titulo"], t["descripcion"], t["modulo"], t["tipo"], t["prioridad"], t["enlace"]))

# También crear una notificación global para cualquier usuario que ingrese
cur.execute("""
    INSERT INTO public.nexus_notificaciones (
        user_email, titulo, descripcion, modulo, tipo, prioridad, enlace, estado
    ) VALUES (
        'global@impress.com',
        'Bienvenido al Sistema de Tareas y Notificaciones Nexus',
        'Desde este centro de comando podrá revisar sus pendientes diarios, llamadas agendadas y reportar actividades cumplidas.',
        'sistema',
        'aviso',
        'media',
        '/',
        'pendiente'
    ) ON CONFLICT DO NOTHING;
""")

conn.commit()
print("Tabla public.nexus_notificaciones creada y sembrada con éxito!")
conn.close()
