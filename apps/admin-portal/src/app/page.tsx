import React from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  QrCode,
  ArrowRight,
  Sparkles,
  PhoneCall,
  FileSpreadsheet,
  Users,
  LineChart,
  UserCheck,
  Construction,
  Tags,
  Vote,
  Laptop,
  Phone,
  MapPin,
  Clock,
} from 'lucide-react';
import { SignOutButton } from '../components/SignOutButton';
import { NotificationCenter } from '../components/NotificationCenter';
import { AdminHeaderActions } from '@/components/AdminHeaderActions';
import { WorkstationQuickActions } from '@/components/WorkstationQuickActions';
import { createSupabaseServerClient } from '@intranet/auth/server';
import { redirect } from 'next/navigation';

export default async function AdminHomePage() {
  const supabase = createSupabaseServerClient();
  let user: any = null;
  let profile: any = null;
  let roles: string[] = [];

  try {
    const { data, error } = await supabase.auth.getUser();
    if (!error && data?.user) {
      user = data.user;
    }
  } catch {
    user = null;
  }

  if (!user) {
    redirect('/login');
  }

  try {
    const { data: profileData } = await (supabase
      .from('profiles') as any)
      .select('full_name, is_active')
      .eq('id', user.id)
      .maybeSingle();
    profile = profileData;
  } catch {
    profile = null;
  }

  try {
    const { data: rolesData } = await (supabase
      .from('user_roles') as any)
      .select('roles!inner(name)')
      .eq('user_id', user.id);

    roles = (rolesData ?? []).map((r: any) => r.roles?.name as string).filter(Boolean);
  } catch {
    roles = [];
  }

  // Traer sub-rol y configuración de usuarios para distinguir coordinadores y salas
  let legacyUser: any = null;
  try {
    const { data: legacyData } = await (supabase
      .from('usuarios') as any)
      .select('usuario, rol, sub_rol, cedula, turno, areas_ids, dispositivo_vinculado_id')
      .or(`email.eq.${user.email},usuario.ilike.%${user.email?.split('@')[0]}%`)
      .maybeSingle();
    legacyUser = legacyData;
  } catch {
    legacyUser = null;
  }

  // 1. Obtener extensión telefónica (Briana)
  let userExtension = '';
  try {
    const { data: extData } = await (supabase
      .from('briana_extensiones') as any)
      .select('extension')
      .eq('usuario', legacyUser?.usuario || user.email?.split('@')[0])
      .maybeSingle();
    userExtension = extData?.extension || legacyUser?.dispositivo_vinculado_id || '';
  } catch {
    userExtension = '';
  }

  // 2. Obtener Asistencia de Hoy (Asys)
  const todayDateStr = new Date().toISOString().split('T')[0];
  let todayAttendance: any = null;
  try {
    const { data: attList } = await (supabase
      .from('asistencias') as any)
      .select('timestamp, tipo, estado')
      .gte('timestamp', `${todayDateStr}T00:00:00Z`)
      .or(`id_usuario.eq.${legacyUser?.usuario || user.email?.split('@')[0]},nombre_completo.ilike.%${profile?.full_name || ''}%`)
      .order('timestamp', { ascending: true })
      .limit(1);
    if (attList && attList.length > 0) {
      todayAttendance = attList[0];
    }
  } catch {
    todayAttendance = null;
  }

  // 3. Obtener áreas autorizadas
  const userAreas: string[] = Array.isArray(legacyUser?.areas_ids)
    ? legacyUser.areas_ids
    : (legacyUser?.areas_ids ? [legacyUser.areas_ids] : ['SALA DE CONFERENCIAS - P6']);

  // 4. Conteo de tareas asignadas en Briana
  let brianaTasksCount = 0;
  try {
    const { count } = await (supabase
      .from('call_assignments') as any)
      .select('id', { count: 'exact', head: true })
      .eq('operator_id', user.id);
    brianaTasksCount = count || 0;
  } catch {
    brianaTasksCount = 0;
  }

  // 5. Conteo de tareas asignadas en Reclasificación
  let reclasifTasksCount = 0;
  try {
    const userEmailExact = user?.email || '';
    const legacyUsername = legacyUser?.usuario || '';
    const { count } = await (supabase
      .from('reclasificacion_registros') as any)
      .select('id', { count: 'exact', head: true })
      .or(`asignado_a_usuario.eq.${userEmailExact},asignado_a_usuario.eq.${legacyUsername}`)
      .eq('estado_revision', 'pendiente');
    reclasifTasksCount = count || 0;
  } catch {
    reclasifTasksCount = 0;
  }

  // Lógica de Permisos Especiales y Visibilidad
  const userEmail = (user?.email || '').toLowerCase();
  const isBrando = userEmail.includes('brando') || userEmail === 'bralez@impress.com';
  const isSuperAdmin = roles.includes('superadmin') || isBrando;
  const isModuleAdmin = roles.includes('module_admin') || isSuperAdmin;
  const isCoordinadorGeneral = legacyUser?.sub_rol?.toLowerCase().includes('coordinador general') || isSuperAdmin;

  // Gestión de Usuarios: SOLO visible para Admin, Superadmin y Coordinador General
  // (Oculta para operadores, analistas, RRHH e informática general)
  const canManageUsers = isSuperAdmin || isModuleAdmin || isCoordinadorGeneral;

  const displayName = profile?.full_name ?? user?.email?.split('@')[0] ?? 'Operador';
  const roleLabel = isBrando
    ? 'Superadmin Fundador'
    : (roles.length > 0 ? roles.join(', ') : 'Operador / Personal');
  const initials = displayName
    .split(' ')
    .map((w: string) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'NX';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-blue-600/30 selection:text-blue-200">
      {/* ── 1. NAVBAR ────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 w-full border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-500 p-0.5 shadow-lg shadow-blue-900/30 ring-1 ring-white/10 flex items-center justify-center">
              <div className="h-full w-full bg-slate-950/80 rounded-[10px] flex items-center justify-center">
                <ShieldCheck className="h-5 w-5 text-blue-400" />
              </div>
            </div>
            <div className="flex items-center space-x-2.5">
              <span className="text-xl font-bold tracking-tight text-white font-mono">
                NEXUS
              </span>
              <span className="text-slate-700">|</span>
              <span className="text-sm font-semibold tracking-wide text-slate-300 uppercase">
                Intranet Corporativa
              </span>
            </div>
            <span className="hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 ml-2">
              ● Sistema Conectado
            </span>
          </div>

          <div className="flex items-center space-x-3">
            {/* 📢 Botón Rápido de Aviso para Administradores / Superadmin */}
            <AdminHeaderActions canEmitAviso={isSuperAdmin} currentUserEmail={user?.email || ''} />

            {/* 🔔 Centro de Notificaciones y Tareas */}
            <NotificationCenter />

            <div className="flex items-center space-x-3 pl-2 border-l border-slate-800">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-semibold text-slate-200">{displayName}</p>
                <p className="text-[11px] text-slate-400">{roleLabel}</p>
              </div>
              <div className="h-9 w-9 rounded-full bg-gradient-to-br from-slate-700 to-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-slate-200 shadow-sm">
                {initials}
              </div>
              <SignOutButton />
            </div>
          </div>
        </div>
      </header>

      {/* ── 2. HERO PRINCIPAL ─────────────────────────────────────── */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-10">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-slate-900/90 to-slate-950 border border-slate-800/80 p-8 sm:p-10 shadow-2xl">
          <div className="absolute top-0 right-1/4 -mt-12 h-64 w-64 rounded-full bg-blue-600/10 blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 right-10 -mb-12 h-64 w-64 rounded-full bg-emerald-600/10 blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="space-y-3 max-w-2xl">
              <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-950/60 border border-emerald-800/40 text-emerald-400 text-xs font-medium">
                <Sparkles className="h-3.5 w-3.5" />
                <span>Módulo Operativo Activo — Fase 1</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
                Control y Registro de Asistencia
              </h1>
              <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
                Escaneo y registro de turnos de entrada y salida con validación de identidad y geolocalización. El resto de módulos se activan progresivamente.
              </p>
            </div>

            <div className="shrink-0">
              <Link
                href="/asistencia"
                className="inline-flex items-center gap-3 px-6 py-4 rounded-2xl bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-500 hover:to-emerald-500 text-white font-bold text-base shadow-xl shadow-blue-950/50 transition-all hover:scale-105"
              >
                <QrCode className="w-5 h-5" />
                <span>Abrir Marcado de Asistencia</span>
                <ArrowRight className="w-4 h-4 ml-1" />
              </Link>
            </div>
          </div>
        </div>

        {/* ── 2.5 SECCIÓN: ESTACIÓN DE TRABAJO & PUESTO ASIGNADO ── */}
        <section className="p-6 sm:p-7 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-2xl relative overflow-hidden space-y-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
            <div className="flex items-center gap-3.5">
              <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 p-0.5 shadow-lg shadow-blue-900/30 flex items-center justify-center">
                <div className="h-full w-full bg-slate-950 rounded-[14px] flex items-center justify-center text-blue-400">
                  <Laptop className="w-6 h-6" />
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-white tracking-tight">
                    Mi Estación de Trabajo & Puesto Operativo
                  </h2>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border font-semibold ${
                    todayAttendance 
                      ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800/60'
                      : 'bg-amber-950/80 text-amber-300 border-amber-800/60 animate-pulse'
                  }`}>
                    {todayAttendance ? '● PUESTO EN SERVICIO' : '● EN ESPERA DE MARCADO'}
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Verificación de identidad, terminal telefónico y despacho de carga diaria
                </p>
              </div>
            </div>

            {/* Datos Técnicos de la Estación y Botón Iniciar Estación */}
            <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
              <WorkstationQuickActions
                todayAttendance={todayAttendance}
                userExtension={userExtension}
                userArea={userAreas[0] || 'Sede Central'}
                turno={legacyUser?.turno || 'Mañana'}
                brianaTasksCount={brianaTasksCount}
                reclasifTasksCount={reclasifTasksCount}
                isBrando={isBrando}
              />
              <span className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-sky-300 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-sky-400" />
                <span>{userExtension ? `Ext: ${userExtension}` : 'Sin PBX'}</span>
              </span>
              <span className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-indigo-400" />
                <span>{userAreas[0] || 'Sede Central'}</span>
              </span>
            </div>
          </div>

          {/* Despacho del Día ("¿Qué me toca hoy?") */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* 1. Asys Check-in */}
            <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block">1. Asistencia Asys</span>
                <span className={`text-xs font-semibold block mt-0.5 ${todayAttendance ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {todayAttendance ? 'Marcada con Éxito' : 'Pendiente de Marcado'}
                </span>
                <span className="text-[10px] text-slate-500 block">
                  {todayAttendance ? 'Entrada registrada' : 'Escanea tu QR en Asys'}
                </span>
              </div>
              <Link
                href="/asistencia"
                className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all ${
                  todayAttendance 
                    ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800/40 hover:bg-emerald-900/60'
                    : 'bg-amber-600 hover:bg-amber-500 text-slate-950 font-black shadow-md'
                }`}
              >
                {todayAttendance ? 'Ver Turno' : 'Marcar Ahora'}
              </Link>
            </div>

            {/* 2. Telefonía Briana */}
            <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono uppercase text-sky-400 font-bold block">2. Telefonía Briana</span>
                <span className="text-xs font-semibold text-white block mt-0.5">
                  {brianaTasksCount > 0 ? `${brianaTasksCount} llamadas asignadas` : 'Terminal Listo'}
                </span>
                <span className="text-[10px] text-slate-500 block">
                  {userExtension ? `Ext. ${userExtension} conectada` : 'Sin PBX'}
                </span>
              </div>
              <Link
                href="/llamadas"
                className="px-3 py-1.5 rounded-xl bg-sky-950/60 text-sky-300 border border-sky-800/60 hover:bg-sky-900/60 text-xs font-semibold transition-all"
              >
                Abrir Discador
              </Link>
            </div>

            {/* 3. Oriana Auditoría */}
            <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono uppercase text-indigo-400 font-bold block">3. Analítica Oriana</span>
                <span className="text-xs font-semibold text-white block mt-0.5">
                  Validación Habilitada
                </span>
                <span className="text-[10px] text-slate-500 block">
                  Carga comunal disponible
                </span>
              </div>
              <Link
                href="/oriana"
                className="px-3 py-1.5 rounded-xl bg-indigo-950/60 text-indigo-300 border border-indigo-800/60 hover:bg-indigo-900/60 text-xs font-semibold transition-all"
              >
                Ver Lotes
              </Link>
            </div>

            {/* 4. Reclasificación & Especiales */}
            <div className={`p-3.5 rounded-2xl bg-slate-950/60 border flex items-center justify-between transition-all ${
              reclasifTasksCount > 0 ? 'border-amber-500/60 shadow-lg shadow-amber-950/30' : 'border-slate-800/80'
            }`}>
              <div>
                <span className="text-[10px] font-mono uppercase text-amber-400 font-bold block">4. Reclasificación</span>
                <span className="text-xs font-semibold text-white block mt-0.5">
                  {reclasifTasksCount > 0 ? `${reclasifTasksCount} casos asignados` : (isBrando ? 'Dev Activo' : 'En cola')}
                </span>
                <span className="text-[10px] text-slate-500 block">
                  Triage de incidencias
                </span>
              </div>
              <Link
                href={isBrando ? '/reclasificacion' : '#'}
                className="px-3 py-1.5 rounded-xl bg-amber-950/60 text-amber-300 border border-amber-800/60 hover:bg-amber-900/60 text-xs font-semibold transition-all"
              >
                {isBrando ? 'Abrir Triage' : 'En cola'}
              </Link>
            </div>
          </div>
        </section>

        {/* ── 3. SECCIÓN: MÓDULOS DE TRABAJO ────────────────────────── */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">
                Módulos de Trabajo
              </h2>
              <p className="text-xs text-slate-400">
                Seleccione el módulo operativo correspondiente a sus funciones autorizadas
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

            {/* 🟢 MÓDULO 1: ASISTENCIA (ACTIVO) */}
            <Link
              href="/asistencia"
              className="group relative flex flex-col justify-between p-7 rounded-2xl bg-slate-900 border-2 border-emerald-500/60 hover:border-emerald-400 hover:-translate-y-1 hover:shadow-2xl hover:shadow-emerald-950/40 transition-all duration-300"
            >
              <div>
                <div className="flex items-start justify-between mb-5">
                  <div className="h-14 w-14 rounded-2xl bg-emerald-950/80 border border-emerald-800/50 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-all shadow-md">
                    <QrCode className="h-7 w-7" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800 uppercase tracking-wide">
                      ● Activo Ahora
                    </span>
                    {!todayAttendance && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-950/90 text-amber-300 border border-amber-800 animate-pulse font-mono">
                        ⚠️ Entrada Pendiente
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-xs font-mono font-medium uppercase tracking-wider text-emerald-400">
                    Control de Presencia & Turno
                  </span>
                  <h3 className="text-xl font-bold text-white tracking-tight group-hover:text-emerald-300 transition-colors">
                    Módulo Asys
                  </h3>
                  <p className="text-sm text-slate-400 leading-relaxed">
                    Marcado de entrada (Clock-In), descansos y salida (Clock-Out) con registro de hora oficial y geolocalización, sincronizado con su ficha de personal.
                  </p>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-between text-sm font-semibold text-emerald-400 group-hover:text-emerald-300 pt-4 border-t border-slate-800">
                <span>Ingresar a Asys</span>
                <span className="h-8 w-8 rounded-full bg-emerald-950 border border-emerald-800 flex items-center justify-center text-emerald-300 group-hover:bg-emerald-600 group-hover:text-white transition-all">
                  <ArrowRight className="h-4 w-4" />
                </span>
              </div>
            </Link>

            {/* 🟢 MÓDULO 2: LLAMADAS Y BRIANA (ACTIVO) */}
            <Link
              href="/llamadas"
              className="group relative flex flex-col justify-between p-7 rounded-2xl bg-slate-900 border-2 border-sky-500/60 hover:border-sky-400 hover:-translate-y-1 hover:shadow-2xl hover:shadow-sky-950/40 transition-all duration-300"
            >
              <div>
                <div className="flex items-start justify-between mb-5">
                  <div className="h-14 w-14 rounded-2xl bg-sky-950/80 border border-sky-800/50 flex items-center justify-center text-sky-400 group-hover:scale-105 transition-all shadow-md">
                    <PhoneCall className="h-7 w-7" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-950 text-sky-300 border border-sky-800 uppercase tracking-wide">
                      ● Activo Ahora
                    </span>
                    {brianaTasksCount > 0 && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-950/90 text-amber-300 border border-amber-800 animate-pulse font-mono">
                        🔥 {brianaTasksCount} Asignadas
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-xs font-mono font-medium uppercase tracking-wider text-sky-400">
                    Operaciones Telefónicas
                  </span>
                  <h3 className="text-xl font-bold text-white tracking-tight group-hover:text-sky-300 transition-colors">
                    Módulo Briana
                  </h3>
                  <p className="text-sm text-slate-400 leading-relaxed">
                    Gestión de campañas telefónicas sin PBX, discador guiado para terminales Samsung, tipificación e incidencias.
                  </p>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-between text-sm font-semibold text-sky-400 group-hover:text-sky-300 pt-4 border-t border-slate-800">
                <span>Ingresar al Contact Center</span>
                <span className="h-8 w-8 rounded-full bg-sky-950 border border-sky-800 flex items-center justify-center text-sky-300 group-hover:bg-sky-600 group-hover:text-white transition-all">
                  <ArrowRight className="h-4 w-4" />
                </span>
              </div>
            </Link>

            {/* 🟢 MÓDULO 3: ORIANA ANALYTICS (ACTIVO) */}
            <Link
              href="/oriana"
              className="group relative flex flex-col justify-between p-7 rounded-2xl bg-slate-900 border-2 border-indigo-500/60 hover:border-indigo-400 hover:-translate-y-1 hover:shadow-2xl hover:shadow-indigo-950/40 transition-all duration-300"
            >
              <div>
                <div className="flex items-start justify-between mb-5">
                  <div className="h-14 w-14 rounded-2xl bg-indigo-950/80 border border-indigo-800/50 flex items-center justify-center text-indigo-400 group-hover:scale-105 transition-all shadow-md">
                    <LineChart className="h-7 w-7" />
                  </div>
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-950 text-indigo-300 border border-indigo-800 uppercase tracking-wide">
                    ● Activo Ahora
                  </span>
                </div>

                <div className="space-y-2">
                  <span className="text-xs font-mono font-medium uppercase tracking-wider text-indigo-400">
                    Auditoría & Calidad
                  </span>
                  <h3 className="text-xl font-bold text-white tracking-tight group-hover:text-indigo-300 transition-colors">
                    Módulo Oriana
                  </h3>
                  <p className="text-sm text-slate-400 leading-relaxed">
                    Evaluación analítica, validación de lotes comunales, precisión porcentual y control de calidad operativa.
                  </p>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-between text-sm font-semibold text-indigo-400 group-hover:text-indigo-300 pt-4 border-t border-slate-800">
                <span>Ingresar al Command Center</span>
                <span className="h-8 w-8 rounded-full bg-indigo-950 border border-indigo-800 flex items-center justify-center text-indigo-300 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                  <ArrowRight className="h-4 w-4" />
                </span>
              </div>
            </Link>

            {/* 🟢 MÓDULO 4: PERFIL Y COOLDOWN (ENLAZADO A ASYS) */}
            <Link
              href="/profile"
              className="group relative flex flex-col justify-between p-7 rounded-2xl bg-slate-900 border-2 border-teal-500/60 hover:border-teal-400 hover:-translate-y-1 hover:shadow-2xl hover:shadow-teal-950/40 transition-all duration-300"
            >
              <div>
                <div className="flex items-start justify-between mb-5">
                  <div className="h-14 w-14 rounded-2xl bg-teal-950/80 border border-teal-800/50 flex items-center justify-center text-teal-400 group-hover:scale-105 transition-all shadow-md">
                    <UserCheck className="h-7 w-7" />
                  </div>
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-teal-950 text-teal-300 border border-teal-800 uppercase tracking-wide">
                    ● Enlazado a Asys
                  </span>
                </div>

                <div className="space-y-2">
                  <span className="text-xs font-mono font-medium uppercase tracking-wider text-teal-400">
                    Asys · Ficha de Identidad & Contacto
                  </span>
                  <h3 className="text-xl font-bold text-white tracking-tight group-hover:text-teal-300 transition-colors">
                    Perfil y Cooldown (7 Días)
                  </h3>
                  <p className="text-sm text-slate-400 leading-relaxed">
                    Edición de datos personales (teléfono y dirección) sincronizados con su ficha de Asys, con política de bloqueo semanal de 7 días.
                  </p>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-between text-sm font-semibold text-teal-400 group-hover:text-teal-300 pt-4 border-t border-slate-800">
                <span>Gestionar Perfil Asys</span>
                <span className="h-8 w-8 rounded-full bg-teal-950 border border-teal-800 flex items-center justify-center text-teal-300 group-hover:bg-teal-600 group-hover:text-white transition-all">
                  <ArrowRight className="h-4 w-4" />
                </span>
              </div>
            </Link>

            {/* 🔒 MÓDULO 5: INGESTA MASIVA (EXCLUSIVO PARA SUPERADMIN BRANDO) */}
            {isBrando && (
              <Link
                href="/ingest"
                className="group relative flex flex-col justify-between p-7 rounded-2xl bg-slate-900 border-2 border-purple-500/60 hover:border-purple-400 hover:-translate-y-1 hover:shadow-2xl hover:shadow-purple-950/40 transition-all duration-300"
              >
                <div>
                  <div className="flex items-start justify-between mb-5">
                    <div className="h-14 w-14 rounded-2xl bg-purple-950/80 border border-purple-800/50 flex items-center justify-center text-purple-400 group-hover:scale-105 transition-all shadow-md">
                      <FileSpreadsheet className="h-7 w-7" />
                    </div>
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-950 text-purple-300 border border-purple-800 uppercase tracking-wide">
                      ● Superadmin Brando
                    </span>
                  </div>

                  <div className="space-y-2">
                    <span className="text-xs font-mono font-medium uppercase tracking-wider text-purple-400">
                      Consola de Experimentación
                    </span>
                    <h3 className="text-xl font-bold text-white tracking-tight group-hover:text-purple-300 transition-colors">
                      Ingesta Masiva de Datos
                    </h3>
                    <p className="text-sm text-slate-400 leading-relaxed">
                      Carga de lotes CSV/XLSX, deduplicación y asignación de contactos. Módulo reservado para pruebas superadmin.
                    </p>
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-between text-sm font-semibold text-purple-400 group-hover:text-purple-300 pt-4 border-t border-slate-800">
                  <span>Abrir Ingesta de Pruebas</span>
                  <span className="h-8 w-8 rounded-full bg-purple-950 border border-purple-800 flex items-center justify-center text-purple-300 group-hover:bg-purple-600 group-hover:text-white transition-all">
                    <ArrowRight className="h-4 w-4" />
                  </span>
                </div>
              </Link>
            )}

            {/* 🛡️ MÓDULO 6: GESTIÓN DE USUARIOS (SOLO ADMIN, SUPERADMIN Y COORD. GENERAL) */}
            {canManageUsers && (
              <Link
                href="/users"
                className="group relative flex flex-col justify-between p-7 rounded-2xl bg-slate-900/90 border border-slate-800/80 hover:border-blue-500/50 hover:shadow-xl hover:shadow-blue-950/20 transition-all"
              >
                <div>
                  <div className="flex items-start justify-between mb-5">
                    <div className="h-14 w-14 rounded-2xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400 group-hover:scale-105 group-hover:bg-blue-600/20 transition-all">
                      <Users className="h-6 w-6" />
                    </div>
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 uppercase tracking-wide">
                      ● ACTIVO AHORA
                    </span>
                  </div>

                  <div className="space-y-2">
                    <span className="text-xs font-mono font-medium uppercase tracking-wider text-blue-400">
                      Gobierno RBAC (Admin & Coordinación)
                    </span>
                    <h3 className="text-xl font-bold text-white tracking-tight group-hover:text-blue-200 transition-colors">
                      Gestión de Usuarios
                    </h3>
                    <p className="text-sm text-slate-400 leading-relaxed">
                      Creación, edición y asignación de roles para el personal corporativo. Sincronización automática de credenciales y liberación de cooldowns.
                    </p>
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-between text-xs font-semibold text-blue-400 pt-4 border-t border-slate-800/60">
                  <span>Administrar Personal & Credenciales</span>
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            )}

            {/* 🚧 MÓDULO 7: RECLASIFICACIÓN (EXCLUSIVO PARA DESARROLLADOR BRANDO) */}
            {isBrando && (
              <Link
                href="/reclasificacion"
                className="group relative flex flex-col justify-between p-7 rounded-2xl bg-slate-900 border-2 border-amber-500/60 hover:border-amber-400 hover:-translate-y-1 hover:shadow-2xl hover:shadow-amber-950/40 transition-all duration-300"
              >
                <div>
                  <div className="flex items-start justify-between mb-5">
                    <div className="h-14 w-14 rounded-2xl bg-amber-950/80 border border-amber-800/50 flex items-center justify-center text-amber-400 group-hover:scale-105 transition-all shadow-md">
                      <Tags className="h-7 w-7" />
                    </div>
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-950/80 text-amber-300 border border-amber-800/60 uppercase tracking-wide">
                      ● Activo en Nexus (Brando Dev)
                    </span>
                  </div>

                  <div className="space-y-2">
                    <span className="text-xs font-mono font-medium uppercase tracking-wider text-amber-500">
                      Auditoría & Calidad Operativa
                    </span>
                    <h3 className="text-xl font-bold text-white tracking-tight group-hover:text-amber-200 transition-colors">
                      Reclasificación & Triage
                    </h3>
                    <p className="text-sm text-slate-400 leading-relaxed">
                      Revisión ágil sin bloqueo de Excel, triage de llamadas comunitarias y distribución equitativa de carga de trabajo.
                    </p>
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-between text-xs font-semibold text-amber-400 pt-4 border-t border-slate-800/60">
                  <span>Abrir Cola de Triage & Distribución</span>
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            )}

            {/* 🚧 MÓDULO 8: GESTIÓN DE ELECCIONES (EXCLUSIVO PARA DESARROLLADOR BRANDO) */}
            {isBrando && (
              <Link
                href="/elecciones"
                className="group relative flex flex-col justify-between p-7 rounded-2xl bg-slate-900 border-2 border-cyan-500/60 hover:border-cyan-400 hover:-translate-y-1 hover:shadow-2xl hover:shadow-cyan-950/40 transition-all duration-300"
              >
                <div>
                  <div className="flex items-start justify-between mb-5">
                    <div className="h-14 w-14 rounded-2xl bg-cyan-950/80 border border-cyan-800/50 flex items-center justify-center text-cyan-400 group-hover:scale-105 transition-all shadow-md">
                      <Vote className="h-7 w-7" />
                    </div>
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-cyan-950/80 text-cyan-300 border border-cyan-800/60 uppercase tracking-wide">
                      ● Activo en Nexus (Brando Dev)
                    </span>
                  </div>

                  <div className="space-y-2">
                    <span className="text-xs font-mono font-medium uppercase tracking-wider text-cyan-400">
                      Procesos Electorales & Movilización
                    </span>
                    <h3 className="text-xl font-bold text-white tracking-tight group-hover:text-cyan-200 transition-colors">
                      Sala Nacional Electoral
                    </h3>
                    <p className="text-sm text-slate-400 leading-relaxed">
                      Monitoreo de 335 municipios, corte por franjas horarias (9AM a 8PM), efectividad de mesas y movilización de condominios.
                    </p>
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-between text-xs font-semibold text-cyan-400 pt-4 border-t border-slate-800/60">
                  <span>Ingresar a la Sala Nacional</span>
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            )}

          </div>
        </section>
      </main>

      {/* ── 4. FOOTER ────────────────────────────────────────────── */}
      <footer className="w-full border-t border-slate-800/80 bg-slate-950 py-6 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center space-x-2">
            <span className="font-semibold text-slate-400">Nexus Intranet Platform</span>
            <span>·</span>
            <span>Gobernanza & Operaciones</span>
          </div>
          <div className="flex items-center space-x-6">
            <span>Next.js 14</span>
            <span>Supabase Auth</span>
            <span>Vercel Multi-Service</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
