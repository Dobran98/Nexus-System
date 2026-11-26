import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@intranet/auth/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

const STORAGE_FILE = path.join(process.cwd(), 'data', 'nexus_encuestas.json');

interface Question {
  id: string;
  type: 'rating' | 'choice' | 'text';
  title: string;
  options?: string[];
  required: boolean;
}

interface UserResponse {
  user_email: string;
  user_name: string;
  user_role: string;
  submitted_at: string;
  answers: Record<string, any>;
}

interface Survey {
  id: string;
  title: string;
  description: string;
  category: string;
  target_audience: string;
  status: 'active' | 'closed';
  created_by_email: string;
  created_by_name: string;
  created_at: string;
  expires_at: string;
  questions: Question[];
  responses: UserResponse[];
}

// Encuestas iniciales corporativas de muestra
const DEFAULT_SURVEYS: Survey[] = [
  {
    id: 'encuesta-clima-2026',
    title: 'Evaluación de Clima Laboral & Puesto Operativo — Noviembre 2026',
    description: 'Sondeo institucional para medir las condiciones operativas, ergonomía y desempeño en la Estación de Trabajo.',
    category: 'Clima Laboral & Puesto',
    target_audience: 'all',
    status: 'active',
    created_by_email: 'admin@impress.com',
    created_by_name: 'Coordinación General Nexus',
    created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    expires_at: new Date(Date.now() + 86400000 * 14).toISOString(),
    questions: [
      {
        id: 'q1',
        type: 'rating',
        title: '¿Cómo califica la estabilidad y respuesta de las herramientas del sistema (Asys, Briana, Oriana)?',
        required: true,
      },
      {
        id: 'q2',
        type: 'choice',
        title: '¿Cuenta con el equipamiento necesario (auriculares, terminal, conectividad) para su jornada?',
        options: ['Totalmente satisfecho', 'Parcialmente satisfecho', 'Requiere mejora en hardware', 'Condiciones no aptas'],
        required: true,
      },
      {
        id: 'q3',
        type: 'rating',
        title: '¿Qué tan clara y efectiva es la comunicación con su Supervisor y Coordinador?',
        required: true,
      },
      {
        id: 'q4',
        type: 'text',
        title: 'Sugerencias para optimizar los turnos y el flujo de trabajo diario:',
        required: false,
      }
    ],
    responses: []
  },
  {
    id: 'encuesta-telefonia-2026',
    title: 'Sondeo Operativo: Discador Guiado & Contact Center Briana',
    description: 'Encuesta rápida dirigida a Analistas - Operadores sobre la cadencia y efectividad de las campañas sin PBX.',
    category: 'Telefonía & Discador',
    target_audience: 'analistas_supervisores',
    status: 'active',
    created_by_email: 'coordinacion@impress.com',
    created_by_name: 'Coordinador Operativo',
    created_at: new Date(Date.now() - 86400000 * 1).toISOString(),
    expires_at: new Date(Date.now() + 86400000 * 7).toISOString(),
    questions: [
      {
        id: 'q_briana_1',
        type: 'rating',
        title: 'Facilidad de tipificación de llamadas en la mesa de incidencias:',
        required: true,
      },
      {
        id: 'q_briana_2',
        type: 'choice',
        title: 'Frecuencia con la que experimenta números inválidos o sin respuesta en lotes:',
        options: ['Menos del 10%', 'Entre 10% y 30%', 'Más del 40% (Requiere filtrado)'],
        required: true,
      },
      {
        id: 'q_briana_3',
        type: 'text',
        title: '¿Qué nuevas funciones le gustaría ver en el discador móvil de Briana?',
        required: false,
      }
    ],
    responses: []
  }
];

function readSurveys(): Survey[] {
  try {
    if (!fs.existsSync(path.dirname(STORAGE_FILE))) {
      fs.mkdirSync(path.dirname(STORAGE_FILE), { recursive: true });
    }
    if (!fs.existsSync(STORAGE_FILE)) {
      fs.writeFileSync(STORAGE_FILE, JSON.stringify(DEFAULT_SURVEYS, null, 2), 'utf-8');
      return DEFAULT_SURVEYS;
    }
    const data = fs.readFileSync(STORAGE_FILE, 'utf-8');
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : DEFAULT_SURVEYS;
  } catch (err) {
    console.error('Error reading surveys file:', err);
    return DEFAULT_SURVEYS;
  }
}

function writeSurveys(surveys: Survey[]): boolean {
  try {
    if (!fs.existsSync(path.dirname(STORAGE_FILE))) {
      fs.mkdirSync(path.dirname(STORAGE_FILE), { recursive: true });
    }
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(surveys, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('Error writing surveys file:', err);
    return false;
  }
}

// ── GET: LISTAR ENCUESTAS Y RESULTADOS SEGÚN ROL ─────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError || !authData?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const email = authData.user.email || '';
    const { data: rolesData } = await (supabase.from('user_roles') as any)
      .select('roles!inner(name)')
      .eq('user_id', authData.user.id);
    const roleNames: string[] = (rolesData ?? []).map((r: any) => r.roles?.name as string).filter(Boolean);

    const isFundadorDev = email.toLowerCase().includes('brando') || email.toLowerCase().includes('bralez') || roleNames.includes('fundador_dev');
    const isSuperAdmin = roleNames.includes('superadmin') || isFundadorDev;
    const isModuleAdmin = roleNames.includes('admin') || roleNames.includes('module_admin') || isSuperAdmin;
    const isCoordinadorGeneral = roleNames.includes('coordinador_general') || isModuleAdmin;
    const isCoordinador = roleNames.includes('coordinador') || isCoordinadorGeneral;
    const canManageSurveys = isCoordinador;

    const allSurveys = readSurveys();

    // Enriquecer datos con estado de respuesta del usuario actual
    const surveysWithUserStatus = allSurveys.map(s => {
      const userRes = s.responses.find(r => r.user_email.toLowerCase() === email.toLowerCase());
      const hasResponded = !!userRes;

      // Cálculo de métricas básicas
      const totalResponses = s.responses.length;
      let avgRatings: Record<string, number> = {};
      let choiceBreakdown: Record<string, Record<string, number>> = {};

      if (canManageSurveys) {
        s.questions.forEach(q => {
          if (q.type === 'rating') {
            const values = s.responses.map(r => Number(r.answers[q.id])).filter(v => !isNaN(v) && v > 0);
            if (values.length > 0) {
              const avg = values.reduce((a, b) => a + b, 0) / values.length;
              avgRatings[q.id] = Number(avg.toFixed(1));
            }
          } else if (q.type === 'choice' && q.options) {
            choiceBreakdown[q.id] = {};
            q.options.forEach(opt => { choiceBreakdown[q.id][opt] = 0; });
            s.responses.forEach(r => {
              const ans = r.answers[q.id];
              if (ans && choiceBreakdown[q.id][ans] !== undefined) {
                choiceBreakdown[q.id][ans]++;
              }
            });
          }
        });
      }

      return {
        id: s.id,
        title: s.title,
        description: s.description,
        category: s.category,
        target_audience: s.target_audience,
        status: s.status,
        created_by_name: s.created_by_name,
        created_at: s.created_at,
        expires_at: s.expires_at,
        questions: s.questions,
        total_responses: totalResponses,
        has_responded: hasResponded,
        user_response: userRes || null,
        // Datos analíticos para directores
        analytics: canManageSurveys ? {
          total_responses: totalResponses,
          avg_ratings: avgRatings,
          choice_breakdown: choiceBreakdown,
          recent_feedback: s.responses
            .flatMap(r => 
              s.questions
                .filter(q => q.type === 'text' && r.answers[q.id])
                .map(q => ({
                  author: r.user_role === 'Analista - Operador' ? 'Analista - Operador' : r.user_name,
                  role: r.user_role,
                  question: q.title,
                  comment: r.answers[q.id],
                  date: r.submitted_at
                }))
            )
            .slice(-10)
        } : null
      };
    });

    return NextResponse.json({
      success: true,
      surveys: surveysWithUserStatus,
      can_manage: canManageSurveys,
      pending_count: surveysWithUserStatus.filter(s => s.status === 'active' && !s.has_responded).length
    });
  } catch (error: any) {
    console.error('Error fetching surveys:', error);
    return NextResponse.json({ error: error.message || 'Error al obtener encuestas' }, { status: 500 });
  }
}

// ── POST: CREAR ENCUESTA, RESPONDER O CAMBIAR ESTADO ────────────────────────
export async function POST(req: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError || !authData?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const email = authData.user.email || '';
    const { data: profile } = await (supabase.from('profiles') as any)
      .select('full_name')
      .eq('id', authData.user.id)
      .maybeSingle();
    const userName = profile?.full_name || email.split('@')[0];

    const { data: rolesData } = await (supabase.from('user_roles') as any)
      .select('roles!inner(name)')
      .eq('user_id', authData.user.id);
    const roleNames: string[] = (rolesData ?? []).map((r: any) => r.roles?.name as string).filter(Boolean);

    const isFundadorDev = email.toLowerCase().includes('brando') || email.toLowerCase().includes('bralez') || roleNames.includes('fundador_dev');
    const isSuperAdmin = roleNames.includes('superadmin') || isFundadorDev;
    const isModuleAdmin = roleNames.includes('admin') || roleNames.includes('module_admin') || isSuperAdmin;
    const isCoordinadorGeneral = roleNames.includes('coordinador_general') || isModuleAdmin;
    const isCoordinador = roleNames.includes('coordinador') || isCoordinadorGeneral;
    const canManageSurveys = isCoordinador;

    const userRole = isFundadorDev 
      ? 'Fundador Dev' 
      : (isSuperAdmin 
          ? 'Superadmin' 
          : (isModuleAdmin 
              ? 'Admin' 
              : (isCoordinadorGeneral 
                  ? 'Coordinador General' 
                  : (isCoordinador ? 'Coordinador' : (roleNames.includes('supervisor') ? 'Supervisor' : 'Analista - Operador')))));

    const body = await req.json();
    const { action } = body;

    const surveys = readSurveys();

    // 1. ACCIÓN: RESPONDER ENCUESTA
    if (action === 'submit_response') {
      const { survey_id, answers } = body;
      if (!survey_id || !answers) {
        return NextResponse.json({ error: 'Faltan parámetros requeridos para responder' }, { status: 400 });
      }

      const survey = surveys.find(s => s.id === survey_id);
      if (!survey) {
        return NextResponse.json({ error: 'Encuesta no encontrada' }, { status: 404 });
      }
      if (survey.status !== 'active') {
        return NextResponse.json({ error: 'Esta encuesta ya no se encuentra activa' }, { status: 400 });
      }

      // Validar si ya respondió
      const existingIdx = survey.responses.findIndex(r => r.user_email.toLowerCase() === email.toLowerCase());
      const responsePayload: UserResponse = {
        user_email: email,
        user_name: userName,
        user_role: userRole,
        submitted_at: new Date().toISOString(),
        answers: answers
      };

      if (existingIdx >= 0) {
        survey.responses[existingIdx] = responsePayload;
      } else {
        survey.responses.push(responsePayload);
      }

      writeSurveys(surveys);

      // Emisión de notificación de confirmación
      try {
        await (supabase.from('nexus_notificaciones') as any).insert({
          user_email: email,
          titulo: 'Encuesta Registrada',
          mensaje: `Hemos recibido tu evaluación para "${survey.title}". ¡Gracias por tu participación!`,
          tipo: 'sistema',
          prioridad: 'baja',
          leida: false,
        });
      } catch (notifErr) {
        console.warn('Advertencia emitiendo notificación de encuesta:', notifErr);
      }

      return NextResponse.json({
        success: true,
        message: 'Tu respuesta ha sido registrada exitosamente. ¡Muchas gracias por tu retroalimentación!'
      });
    }

    // 2. ACCIÓN: CREAR NUEVA ENCUESTA (Solo Coordinadores y Admins)
    if (action === 'create_survey') {
      if (!canManageSurveys) {
        return NextResponse.json({ error: 'Se requieren privilegios de Coordinador, Admin o Superadmin para crear encuestas.' }, { status: 403 });
      }

      const { title, description, category, questions, expires_days = 7, target_audience = 'all' } = body;
      if (!title || !questions || !Array.isArray(questions) || questions.length === 0) {
        return NextResponse.json({ error: 'Título y al menos una pregunta son obligatorios' }, { status: 400 });
      }

      const newSurvey: Survey = {
        id: 'survey-' + Date.now(),
        title: title.trim(),
        description: (description || '').trim(),
        category: category || 'General',
        target_audience: target_audience,
        status: 'active',
        created_by_email: email,
        created_by_name: `${userName} (${userRole})`,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 86400000 * Number(expires_days)).toISOString(),
        questions: questions.map((q: any, idx: number) => ({
          id: q.id || `q_${idx + 1}`,
          type: q.type || 'rating',
          title: q.title || `Pregunta ${idx + 1}`,
          options: q.options || [],
          required: q.required ?? true
        })),
        responses: []
      };

      surveys.unshift(newSurvey);
      writeSurveys(surveys);

      // Notificación global a los operadores/supervisores
      try {
        await (supabase.from('nexus_notificaciones') as any).insert({
          user_email: 'todos@impress.com',
          titulo: `Nueva Encuesta: ${newSurvey.title}`,
          mensaje: `Se ha publicado un nuevo sondeo institucional por ${userName}. Tu opinión es fundamental para mejorar los puestos operativos.`,
          tipo: 'aviso',
          prioridad: 'media',
          leida: false,
        });
      } catch (notifErr) {
        console.warn('Advertencia emitiendo notificación general:', notifErr);
      }

      return NextResponse.json({
        success: true,
        message: 'Encuesta creada y publicada exitosamente para el personal.',
        survey: newSurvey
      });
    }

    // 3. ACCIÓN: TOGGLE STATUS (Cerrar / Reactivar encuesta)
    if (action === 'toggle_status') {
      if (!canManageSurveys) {
        return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
      }
      const { survey_id } = body;
      const survey = surveys.find(s => s.id === survey_id);
      if (!survey) {
        return NextResponse.json({ error: 'Encuesta no encontrada' }, { status: 404 });
      }
      survey.status = survey.status === 'active' ? 'closed' : 'active';
      writeSurveys(surveys);

      return NextResponse.json({
        success: true,
        message: `La encuesta ahora se encuentra ${survey.status === 'active' ? 'Activa' : 'Cerrada'}.`,
        status: survey.status
      });
    }

    return NextResponse.json({ error: 'Acción no reconocida' }, { status: 400 });
  } catch (error: any) {
    console.error('Error in POST /api/encuestas:', error);
    return NextResponse.json({ error: error.message || 'Error en servidor' }, { status: 500 });
  }
}
