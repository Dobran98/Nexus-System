-- ======================================================================
-- ORIANA COMMAND CENTER v2 - SUPABASE POSTGRESQL SCHEMA
-- ======================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. TABLA: usuarios
CREATE TABLE IF NOT EXISTS usuarios (
    usuario TEXT PRIMARY KEY,
    clave TEXT NOT NULL,
    nombre_apellido TEXT,
    rol TEXT DEFAULT 'Operador',
    turno TEXT DEFAULT 'MAÑANA',
    id_user TEXT,
    cedula TEXT,
    backup_clave_original TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. TABLA: reglas_acceso
CREATE TABLE IF NOT EXISTS reglas_acceso (
    id SERIAL PRIMARY KEY,
    perfil TEXT UNIQUE NOT NULL,
    modos_permitidos TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TABLA: areas_trabajo
CREATE TABLE IF NOT EXISTS areas_trabajo (
    id_area TEXT PRIMARY KEY,
    nombre_area TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. TABLA: configuracion (modos y campañas vinculadas)
CREATE TABLE IF NOT EXISTS configuracion (
    modo TEXT PRIMARY KEY,
    campanas TEXT NOT NULL,
    detalle JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. TABLA: config_variables (Variables dinámicas de evaluación por modo)
CREATE TABLE IF NOT EXISTS config_variables (
    id SERIAL PRIMARY KEY,
    modo TEXT NOT NULL,
    variable TEXT NOT NULL,
    etiqueta TEXT,
    tipo TEXT DEFAULT 'NUMERO',
    obligatorio BOOLEAN DEFAULT false,
    depende_de TEXT DEFAULT '',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_config_vars_modo ON config_variables (modo);

-- 6. TABLA: config_emojis (Repositorio de emojis para Telegram)
CREATE TABLE IF NOT EXISTS config_emojis (
    id SERIAL PRIMARY KEY,
    tipo TEXT NOT NULL, -- 'MODO', 'CAMPAÑA', 'VARIABLE'
    nombre TEXT NOT NULL,
    emoji TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tipo, nombre)
);

-- 7. TABLA: config_destinatarios (Destinatarios de reportes programados)
CREATE TABLE IF NOT EXISTS config_destinatarios (
    id SERIAL PRIMARY KEY,
    chat_id TEXT NOT NULL UNIQUE,
    frecuencia TEXT DEFAULT 'DIARIO', -- 'DIARIO', 'SEMANAL'
    activo BOOLEAN DEFAULT true,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. TABLA: config_indicadores (Indicadores macro que agrupan modos)
CREATE TABLE IF NOT EXISTS config_indicadores (
    id SERIAL PRIMARY KEY,
    indicador TEXT NOT NULL,
    modo TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. TABLA: registros (Base principal de reportes)
CREATE TABLE IF NOT EXISTS registros (
    id BIGSERIAL PRIMARY KEY,
    id_operador TEXT DEFAULT 'S/ID',
    fecha_registro TIMESTAMPTZ DEFAULT NOW(),
    fecha_reporte TEXT NOT NULL, -- formato YYYY-MM-DD
    usuario_operador TEXT NOT NULL,
    modo_trabajo TEXT NOT NULL,
    campana TEXT NOT NULL,
    llamadas_efectivas NUMERIC DEFAULT 0,
    llamadas_totales NUMERIC DEFAULT 0,
    incidencias_reportadas NUMERIC DEFAULT 0,
    estados_abarcados TEXT DEFAULT '',
    municipios_detalles TEXT DEFAULT '',
    admin_efectivas NUMERIC,
    admin_incidencias NUMERIC,
    variables JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_registros_fecha_reporte ON registros (fecha_reporte);
CREATE INDEX IF NOT EXISTS idx_registros_usuario ON registros (usuario_operador);
CREATE INDEX IF NOT EXISTS idx_registros_modo ON registros (modo_trabajo);
CREATE INDEX IF NOT EXISTS idx_registros_fecha_reg ON registros (fecha_registro DESC);

-- 10. TABLA: registros_act_especial
CREATE TABLE IF NOT EXISTS registros_act_especial (
    id BIGSERIAL PRIMARY KEY,
    id_operador TEXT,
    fecha_registro TIMESTAMPTZ DEFAULT NOW(),
    fecha_reporte TEXT,
    usuario_operador TEXT,
    modo_trabajo TEXT,
    campana TEXT,
    detallado TEXT,
    efectividad TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. TABLA: cola_telegram (Manejo de mensajes y reintentos)
CREATE TABLE IF NOT EXISTS cola_telegram (
    id_cola UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fecha_encola TIMESTAMPTZ DEFAULT NOW(),
    estado TEXT DEFAULT 'PENDIENTE',
    intentos INTEGER DEFAULT 0,
    payload JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cola_telegram_estado ON cola_telegram (estado) WHERE estado != 'ENVIADO';

-- 12. TABLA: logs_auditoria
CREATE TABLE IF NOT EXISTS logs_auditoria (
    id BIGSERIAL PRIMARY KEY,
    fecha_hora TIMESTAMPTZ DEFAULT NOW(),
    usuario TEXT,
    accion TEXT,
    detalle TEXT,
    rol TEXT
);

CREATE INDEX IF NOT EXISTS idx_logs_fecha ON logs_auditoria (fecha_hora DESC);
