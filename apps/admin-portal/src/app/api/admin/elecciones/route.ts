import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@intranet/auth/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'summary';
    const estadoParam = searchParams.get('estado');

    // 1. Resumen Nacional y Lista de Estados
    if (action === 'summary') {
      const { data: allRows, error: errAll } = await (supabase
        .from('elecciones_municipios')
        .select('*')
        .order('estado', { ascending: true })
        .order('municipio', { ascending: true }) as any);

      if (errAll) throw errAll;

      let totalCentros = 0;
      let totalCentrosActivos = 0;
      let totalMesas = 0;
      let totalMesasActivas = 0;
      let totalVotos = 0;
      let totalCondominios = 0;

      const estadosMap: Record<string, {
        estado: string;
        municipiosCount: number;
        centrosTotales: number;
        centrosActivos: number;
        mesasTotales: number;
        mesasActivas: number;
        votosTotales: number;
        condominios: number;
      }> = {};

      allRows?.forEach((row: any) => {
        const est = row.estado || 'DESCONOCIDO';
        totalCentros += row.centros_totales || 0;
        totalCentrosActivos += row.centros_activos_8am || 0;
        totalMesas += row.mesas_totales || 0;
        totalMesasActivas += row.mesas_activas || 0;

        const rowVotos = (row.h9 || 0) + (row.h10 || 0) + (row.h11 || 0) + (row.h12 || 0) + 
                         (row.h13 || 0) + (row.h14 || 0) + (row.h15 || 0) + (row.h16 || 0) + 
                         (row.h17 || 0) + (row.h20 || 0);
        totalVotos += rowVotos;
        totalCondominios += row.condominios_movilizados || 0;

        if (!estadosMap[est]) {
          estadosMap[est] = {
            estado: est,
            municipiosCount: 0,
            centrosTotales: 0,
            centrosActivos: 0,
            mesasTotales: 0,
            mesasActivas: 0,
            votosTotales: 0,
            condominios: 0,
          };
        }

        estadosMap[est].municipiosCount++;
        estadosMap[est].centrosTotales += row.centros_totales || 0;
        estadosMap[est].centrosActivos += row.centros_activos_8am || 0;
        estadosMap[est].mesasTotales += row.mesas_totales || 0;
        estadosMap[est].mesasActivas += row.mesas_activas || 0;
        estadosMap[est].votosTotales += rowVotos;
        estadosMap[est].condominios += row.condominios_movilizados || 0;
      });

      const estadosList = Object.values(estadosMap).map(e => ({
        ...e,
        eficaciaCentros: e.centrosTotales > 0 ? Math.round((e.centrosActivos / e.centrosTotales) * 100) : 0,
        eficaciaMesas: e.mesasTotales > 0 ? Math.round((e.mesasActivas / e.mesasTotales) * 100) : 0,
      }));

      // Si se filtró por estado específico, adjuntar sus municipios
      let municipiosDelEstado = null;
      if (estadoParam) {
        municipiosDelEstado = allRows?.filter((r: any) => r.estado?.toUpperCase() === estadoParam.toUpperCase()) || [];
      }

      return NextResponse.json({
        success: true,
        nacional: {
          totalMunicipios: allRows?.length || 0,
          totalCentros,
          totalCentrosActivos,
          eficaciaCentros: totalCentros > 0 ? Math.round((totalCentrosActivos / totalCentros) * 100) : 0,
          totalMesas,
          totalMesasActivas,
          eficaciaMesas: totalMesas > 0 ? Math.round((totalMesasActivas / totalMesas) * 100) : 0,
          totalVotos,
          totalCondominios,
        },
        estados: estadosList,
        municipios: municipiosDelEstado || (allRows?.slice(0, 30) || []),
      });
    }

    // 2. Consulta de Incidencias Electorales
    if (action === 'incidencias') {
      let q = supabase
        .from('elecciones_incidencias')
        .select('*')
        .order('created_at', { ascending: false });

      if (estadoParam) {
        q = q.eq('estado', estadoParam);
      }

      const { data: incs, error: incError } = await (q as any);
      if (incError) throw incError;

      return NextResponse.json({
        success: true,
        incidencias: incs || [],
      });
    }

    return NextResponse.json({ error: 'Acción no soportada' }, { status: 400 });
  } catch (err: any) {
    console.error('Elecciones GET error:', err);
    return NextResponse.json({ error: err.message || 'Error interno del servidor' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { action } = body;
    const userEmail = user.email || 'operador';

    // 1. Guardar actualización de un municipio
    if (action === 'save_municipio') {
      const {
        id,
        centros_activos_8am,
        mesas_activas,
        h9, h10, h11, h12, h13, h14, h15, h16, h17, h20,
        condominios_movilizados,
        votantes_condominios,
      } = body;

      if (!id) {
        return NextResponse.json({ error: 'ID de municipio requerido' }, { status: 400 });
      }

      const { data, error } = await ((supabase
        .from('elecciones_municipios') as any)
        .update({
          centros_activos_8am: parseInt(centros_activos_8am || 0, 10),
          mesas_activas: parseInt(mesas_activas || 0, 10),
          h9: parseInt(h9 || 0, 10),
          h10: parseInt(h10 || 0, 10),
          h11: parseInt(h11 || 0, 10),
          h12: parseInt(h12 || 0, 10),
          h13: parseInt(h13 || 0, 10),
          h14: parseInt(h14 || 0, 10),
          h15: parseInt(h15 || 0, 10),
          h16: parseInt(h16 || 0, 10),
          h17: parseInt(h17 || 0, 10),
          h20: parseInt(h20 || 0, 10),
          condominios_movilizados: parseInt(condominios_movilizados || 0, 10),
          votantes_condominios: parseInt(votantes_condominios || 0, 10),
          updated_at: new Date().toISOString(),
          updated_by: userEmail,
        })
        .eq('id', id)
        .select() as any);

      if (error) throw error;

      return NextResponse.json({
        success: true,
        record: data && data.length > 0 ? data[0] : null,
      });
    }

    // 2. Reportar incidencia electoral
    if (action === 'create_incidencia') {
      const { estado, municipio, centro_nombre, categoria, descripcion } = body;
      if (!estado || !municipio || !categoria || !descripcion) {
        return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 });
      }

      const { data, error } = await ((supabase
        .from('elecciones_incidencias') as any)
        .insert({
          estado: estado.toUpperCase(),
          municipio: municipio.toUpperCase(),
          centro_nombre: centro_nombre || null,
          categoria,
          descripcion,
          usuario_reportador: userEmail,
          status: 'Pendiente',
        })
        .select() as any);

      if (error) throw error;

      return NextResponse.json({
        success: true,
        incidencia: data && data.length > 0 ? data[0] : null,
      });
    }

    return NextResponse.json({ error: 'Acción no soportada' }, { status: 400 });
  } catch (err: any) {
    console.error('Elecciones POST error:', err);
    return NextResponse.json({ error: err.message || 'Error interno del servidor' }, { status: 500 });
  }
}
