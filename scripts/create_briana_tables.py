import psycopg2

DB_URL = 'postgresql://postgres.pzkqjdkphcwmblbyorbr:yfcLIxzEWObS4Dio@aws-0-us-east-1.pooler.supabase.com:6543/postgres'

DDL = """
-- 1. Tabla briana_campanas
CREATE TABLE IF NOT EXISTS public.briana_campanas (
    id BIGSERIAL PRIMARY KEY,
    nombre TEXT UNIQUE NOT NULL,
    fecha DATE DEFAULT CURRENT_DATE,
    fecha_fin DATE,
    estatus TEXT DEFAULT 'Activa',
    descripcion TEXT,
    usuarios TEXT[] DEFAULT '{}',
    dialogo TEXT,
    formulario_id TEXT,
    reporte_id TEXT,
    tipo_asignacion TEXT DEFAULT 'Issabel',
    distribucion TEXT DEFAULT '',
    tipo_campana TEXT DEFAULT 'Saliente',
    columnas_visibles TEXT DEFAULT '',
    meta NUMERIC DEFAULT 85,
    sla NUMERIC DEFAULT 24,
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);
CREATE INDEX IF NOT EXISTS idx_briana_campanas_nombre ON public.briana_campanas(nombre);

-- 2. Tabla briana_formularios
CREATE TABLE IF NOT EXISTS public.briana_formularios (
    id BIGSERIAL PRIMARY KEY,
    nombre TEXT UNIQUE NOT NULL,
    campos JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

-- 3. Tabla briana_data_campanas (Leads / Bases de Datos cargadas)
CREATE TABLE IF NOT EXISTS public.briana_data_campanas (
    id BIGSERIAL PRIMARY KEY,
    campana_nombre TEXT NOT NULL,
    fila_numero INT NOT NULL,
    datos JSONB NOT NULL,
    estado_gestion TEXT DEFAULT 'Pendiente',
    operador_asignado TEXT,
    intentos INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);
CREATE INDEX IF NOT EXISTS idx_briana_data_campana ON public.briana_data_campanas(campana_nombre, fila_numero);

-- 4. Tabla briana_gestiones (Llamadas realizadas y tipificaciones)
CREATE TABLE IF NOT EXISTS public.briana_gestiones (
    id BIGSERIAL PRIMARY KEY,
    campana_nombre TEXT NOT NULL,
    resultado TEXT NOT NULL,
    usuario TEXT NOT NULL,
    telefono TEXT,
    nombre_contacto TEXT,
    datos_gestion JSONB DEFAULT '{}'::jsonb,
    duracion_segundos INT DEFAULT 0,
    extension TEXT,
    fecha TIMESTAMPTZ DEFAULT timezone('utc', now()),
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);
CREATE INDEX IF NOT EXISTS idx_briana_gestiones_campana ON public.briana_gestiones(campana_nombre, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_briana_gestiones_usuario ON public.briana_gestiones(usuario, fecha DESC);

-- 5. Tabla briana_extensiones (Extensiones 110xx asignadas)
CREATE TABLE IF NOT EXISTS public.briana_extensiones (
    id BIGSERIAL PRIMARY KEY,
    usuario TEXT NOT NULL,
    extension TEXT NOT NULL,
    turno TEXT,
    fecha TIMESTAMPTZ DEFAULT timezone('utc', now())
);
CREATE INDEX IF NOT EXISTS idx_briana_ext_usuario ON public.briana_extensiones(usuario, fecha DESC);

-- 6. Tabla briana_incidencias
CREATE TABLE IF NOT EXISTS public.briana_incidencias (
    id BIGSERIAL PRIMARY KEY,
    incidencia_id TEXT UNIQUE,
    campana_nombre TEXT,
    operador TEXT NOT NULL,
    titulo TEXT NOT NULL,
    descripcion TEXT,
    severidad TEXT DEFAULT 'media',
    estado TEXT DEFAULT 'abierta',
    sla_due_date TIMESTAMPTZ,
    sla_breached BOOLEAN DEFAULT FALSE,
    resolucion_notas TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);
CREATE INDEX IF NOT EXISTS idx_briana_incidencias_op ON public.briana_incidencias(operador, created_at DESC);
"""

def main():
    print("Conectando a Supabase PostgreSQL...")
    conn = psycopg2.connect(DB_URL)
    conn.autocommit = True
    cur = conn.cursor()
    print("Ejecutando DDL para tablas de Briana...")
    cur.execute(DDL)
    print("✓ Tablas de Briana creadas exitosamente.")
    conn.close()

if __name__ == '__main__':
    main()
