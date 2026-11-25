import psycopg2

DB_URL = 'postgresql://postgres.pzkqjdkphcwmblbyorbr:yfcLIxzEWObS4Dio@aws-0-us-east-1.pooler.supabase.com:6543/postgres'

DDL = """
-- 1. Tabla asistencias
CREATE TABLE IF NOT EXISTS public.asistencias (
    id BIGSERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    id_usuario TEXT NOT NULL,
    nombre_completo TEXT,
    turno TEXT,
    institucion TEXT,
    tipo TEXT,
    latitud NUMERIC,
    longitud NUMERIC,
    estado TEXT DEFAULT 'Correcto',
    distancia NUMERIC,
    dispositivo_id TEXT,
    dispositivo_info TEXT,
    notas TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);
CREATE INDEX IF NOT EXISTS idx_asistencias_usuario ON public.asistencias(id_usuario, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_asistencias_timestamp ON public.asistencias(timestamp DESC);

-- 2. Tabla guardias
CREATE TABLE IF NOT EXISTS public.guardias (
    id BIGSERIAL PRIMARY KEY,
    fecha DATE NOT NULL,
    turno_guardia TEXT,
    descripcion TEXT,
    categoria TEXT,
    user_id TEXT,
    nombre_usuario TEXT,
    horas_estimadas INT DEFAULT 12,
    estado TEXT DEFAULT 'Programada',
    notas TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);
CREATE INDEX IF NOT EXISTS idx_guardias_fecha ON public.guardias(fecha DESC);

-- 3. Tabla permisos
CREATE TABLE IF NOT EXISTS public.permisos (
    id BIGSERIAL PRIMARY KEY,
    permiso_id TEXT UNIQUE,
    user_id TEXT NOT NULL,
    nombre_usuario TEXT,
    fecha_inicio TIMESTAMPTZ,
    fecha_fin TIMESTAMPTZ,
    tipo_permiso TEXT,
    estado TEXT DEFAULT 'Pendiente',
    comentarios TEXT,
    creado_por TEXT,
    aprobado_por TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);
CREATE INDEX IF NOT EXISTS idx_permisos_user ON public.permisos(user_id, fecha_inicio DESC);

-- 4. Tabla suplencias
CREATE TABLE IF NOT EXISTS public.suplencias (
    id BIGSERIAL PRIMARY KEY,
    suplencia_id TEXT UNIQUE,
    titular_id TEXT NOT NULL,
    nombre_titular TEXT,
    suplente_id TEXT NOT NULL,
    nombre_suplente TEXT,
    desde DATE,
    hasta DATE,
    turno_titular TEXT,
    estado TEXT DEFAULT 'Pendiente',
    motivo TEXT,
    creado_por TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- 5. Tabla cross_turnos
CREATE TABLE IF NOT EXISTS public.cross_turnos (
    id BIGSERIAL PRIMARY KEY,
    cross_id TEXT UNIQUE,
    fecha DATE,
    usuario_1_id TEXT NOT NULL,
    usuario_2_id TEXT NOT NULL,
    estado TEXT DEFAULT 'Pendiente',
    solicitante TEXT,
    fecha_registro TIMESTAMPTZ DEFAULT timezone('utc', now()),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- 6. Tabla amonestaciones
CREATE TABLE IF NOT EXISTS public.amonestaciones (
    id BIGSERIAL PRIMARY KEY,
    amonestacion_id TEXT UNIQUE,
    usuario_target_id TEXT NOT NULL,
    usuario_target_nombre TEXT,
    tipo_id TEXT,
    tipo_nombre TEXT,
    descripcion TEXT,
    creado_por TEXT,
    creado_por_nombre TEXT,
    estado TEXT DEFAULT 'Activa',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- 7. Tabla tipos_amonestacion
CREATE TABLE IF NOT EXISTS public.tipos_amonestacion (
    id BIGSERIAL PRIMARY KEY,
    tipo_id TEXT UNIQUE,
    nombre TEXT NOT NULL,
    descripcion TEXT,
    gravedad TEXT,
    auto_activar BOOLEAN DEFAULT FALSE,
    condicion_auto TEXT,
    estado TEXT DEFAULT 'Activo',
    creado_por TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- 8. Tabla config_horarios
CREATE TABLE IF NOT EXISTS public.config_horarios (
    id BIGSERIAL PRIMARY KEY,
    clave TEXT UNIQUE NOT NULL,
    valor TEXT,
    descripcion TEXT,
    ultima_actualizacion TIMESTAMPTZ DEFAULT timezone('utc', now())
);

-- 9. Tabla solicitudes_manuales
CREATE TABLE IF NOT EXISTS public.solicitudes_manuales (
    id BIGSERIAL PRIMARY KEY,
    solicitud_id TEXT UNIQUE,
    usuario_id TEXT NOT NULL,
    nombre_usuario TEXT,
    turno TEXT,
    institucion TEXT,
    tipo TEXT,
    fecha_solicitud TIMESTAMPTZ DEFAULT timezone('utc', now()),
    estado TEXT DEFAULT 'Pendiente',
    admin_resolutor TEXT,
    motivo TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- 10. Tabla permisos_roles
CREATE TABLE IF NOT EXISTS public.permisos_roles (
    id BIGSERIAL PRIMARY KEY,
    regla_id TEXT UNIQUE,
    sub_rol TEXT NOT NULL,
    modulo TEXT NOT NULL,
    accion TEXT NOT NULL,
    permitido BOOLEAN DEFAULT TRUE,
    creado_por TEXT,
    fecha_creacion TIMESTAMPTZ DEFAULT timezone('utc', now()),
    descripcion TEXT
);

-- 11. Columnas adicionales para usuarios
ALTER TABLE public.usuarios 
  ADD COLUMN IF NOT EXISTS user_id TEXT,
  ADD COLUMN IF NOT EXISTS nombre TEXT,
  ADD COLUMN IF NOT EXISTS primer_nombre TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS password_hash TEXT,
  ADD COLUMN IF NOT EXISTS sub_rol TEXT DEFAULT 'Operador/a',
  ADD COLUMN IF NOT EXISTS institucion TEXT DEFAULT 'Sede Central',
  ADD COLUMN IF NOT EXISTS nacimiento TEXT,
  ADD COLUMN IF NOT EXISTS estado TEXT DEFAULT 'Activo',
  ADD COLUMN IF NOT EXISTS foto_url TEXT,
  ADD COLUMN IF NOT EXISTS telefono TEXT,
  ADD COLUMN IF NOT EXISTS direccion TEXT,
  ADD COLUMN IF NOT EXISTS fecha_inclusion TIMESTAMPTZ DEFAULT timezone('utc', now()),
  ADD COLUMN IF NOT EXISTS areas_ids JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS dispositivo_vinculado_id TEXT,
  ADD COLUMN IF NOT EXISTS dispositivo_info TEXT,
  ADD COLUMN IF NOT EXISTS dispositivo_fecha_vinculacion TIMESTAMPTZ;
"""

def main():
    print("Conectando a Supabase PostgreSQL...")
    conn = psycopg2.connect(DB_URL)
    conn.autocommit = True
    cur = conn.cursor()
    print("Ejecutando DDL para tablas de Asys...")
    cur.execute(DDL)
    print("✓ Tablas y columnas creadas exitosamente.")
    conn.close()

if __name__ == '__main__':
    main()
