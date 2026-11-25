import psycopg2

conn = psycopg2.connect('postgresql://postgres.pzkqjdkphcwmblbyorbr:yfcLIxzEWObS4Dio@aws-0-us-east-1.pooler.supabase.com:6543/postgres')
cur = conn.cursor()

print("==> Instalando esquema para el Módulo de Reclasificación en Supabase...")

sql_reclasificacion = """
-- 1. Tabla de Lotes de Reclasificación
CREATE TABLE IF NOT EXISTS public.reclasificacion_lotes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre_lote TEXT NOT NULL,
    descripcion TEXT,
    archivo_origen TEXT,
    total_registros INT NOT NULL DEFAULT 0,
    total_reclasificados INT NOT NULL DEFAULT 0,
    estado TEXT NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'en_proceso', 'completado', 'archivado')),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_reclasif_lotes_estado ON public.reclasificacion_lotes(estado);

-- 2. Tabla de Registros a Reclasificar
CREATE TABLE IF NOT EXISTS public.reclasificacion_registros (
    id BIGSERIAL PRIMARY KEY,
    lote_id UUID REFERENCES public.reclasificacion_lotes(id) ON DELETE CASCADE,
    n_fila NUMERIC,
    modo TEXT DEFAULT 'incidencias',
    estado_geo TEXT NOT NULL,
    municipio TEXT,
    parroquia TEXT,
    correlativo TEXT,
    status_original TEXT,
    nuevo_status TEXT,
    codigo_situr TEXT,
    codigo_cne TEXT,
    nombre_obpp TEXT,
    responsable_nombre TEXT,
    cedula TEXT,
    telefono TEXT,
    codigo_incidencia TEXT,
    descripcion_detallada TEXT,
    institucion_responsable TEXT,
    tipo_accion TEXT,
    categoria TEXT,
    subcategoria TEXT,
    rama_area TEXT,
    nueva_rama_area TEXT,
    asignado_a_usuario TEXT, -- Username o email del operador asignado
    asignado_en TIMESTAMPTZ,
    clasificado_por TEXT,
    clasificado_en TIMESTAMPTZ,
    observaciones TEXT,
    estado_revision TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado_revision IN ('pendiente', 'verificado', 'corregido', 'descartado', 'duda')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_reclasif_operador ON public.reclasificacion_registros(asignado_a_usuario, estado_revision);
CREATE INDEX IF NOT EXISTS idx_reclasif_lote ON public.reclasificacion_registros(lote_id);
CREATE INDEX IF NOT EXISTS idx_reclasif_estado_geo ON public.reclasificacion_registros(estado_geo, municipio);

-- 3. Función para Repartir Carga entre Operadores Automáticamente
CREATE OR REPLACE FUNCTION public.nexus_repartir_reclasificacion(
    p_lote_id UUID,
    p_operators TEXT[] -- Array de usernames de operadores
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_total_unassigned INT;
    v_num_ops INT;
    v_batch_size INT;
    v_op TEXT;
    v_i INT := 0;
    v_updated_total INT := 0;
BEGIN
    v_num_ops := array_length(p_operators, 1);
    IF v_num_ops IS NULL OR v_num_ops = 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'No se proporcionaron operadores');
    END IF;

    SELECT COUNT(*) INTO v_total_unassigned
    FROM public.reclasificacion_registros
    WHERE lote_id = p_lote_id
    AND (asignado_a_usuario IS NULL OR asignado_a_usuario = '');

    IF v_total_unassigned = 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'No hay registros pendientes por asignar');
    END IF;

    v_batch_size := CEIL(v_total_unassigned::NUMERIC / v_num_ops::NUMERIC);

    FOREACH v_op IN ARRAY p_operators LOOP
        UPDATE public.reclasificacion_registros
        SET asignado_a_usuario = v_op,
            asignado_en = timezone('utc', now()),
            updated_at = timezone('utc', now())
        WHERE id IN (
            SELECT id FROM public.reclasificacion_registros
            WHERE lote_id = p_lote_id
            AND (asignado_a_usuario IS NULL OR asignado_a_usuario = '')
            LIMIT v_batch_size
        );
        GET DIAGNOSTICS v_i = ROW_COUNT;
        v_updated_total := v_updated_total + v_i;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'lote_id', p_lote_id,
        'operators_count', v_num_ops,
        'records_assigned', v_updated_total
    );
END;
$$;
"""

cur.execute(sql_reclasificacion)
conn.commit()
print("==> Esquema de Reclasificación instalado exitosamente en PostgreSQL.")

conn.close()
