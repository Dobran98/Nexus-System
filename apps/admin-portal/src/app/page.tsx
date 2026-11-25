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
} from 'lucide-react';
import { SignOutButton } from '../components/SignOutButton';
import { NotificationCenter } from '../components/NotificationCenter';
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

  // Traer sub-rol de usuarios para distinguir coordinadores
  let legacyUser: any = null;
  try {
    const { data: legacyData } = await (supabase
      .from('usuarios') as any)
      .select('rol, sub_rol')
      .or(`email.eq.${user.email},usuario.ilike.%${user.email?.split('@')[0]}%`)
      .maybeSingle();
    legacyUser = legacyData;
  } catch {
    legacyUser = null;
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

          <div className="flex items-center space-x-4">
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
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800 uppercase tracking-wide">
                    ● Activo Ahora
                  </span>
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
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-950 text-sky-300 border border-sky-800 uppercase tracking-wide">
                    ● Activo Ahora
                  </span>
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
                href="/en-construccion?modulo=Reclasificación"
                className="group relative flex flex-col justify-between p-7 rounded-2xl bg-slate-900/60 border border-slate-800/80 hover:border-amber-500/40 hover:shadow-xl hover:shadow-amber-950/20 transition-all opacity-90 hover:opacity-100"
              >
                <div>
                  <div className="flex items-start justify-between mb-5">
                    <div className="h-14 w-14 rounded-2xl bg-amber-950/60 border border-amber-800/50 flex items-center justify-center text-amber-400 group-hover:scale-105 transition-all">
                      <Tags className="h-6 w-6" />
                    </div>
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-950/80 text-amber-300 border border-amber-800/60 uppercase tracking-wide">
                      🚧 En Construcción (Dev)
                    </span>
                  </div>

                  <div className="space-y-2">
                    <span className="text-xs font-mono font-medium uppercase tracking-wider text-amber-500">
                      Auditoría & Calidad Operativa
                    </span>
                    <h3 className="text-xl font-bold text-slate-300 tracking-tight group-hover:text-amber-200 transition-colors">
                      Reclasificación
                    </h3>
                    <p className="text-sm text-slate-400 leading-relaxed">
                      Revisión de tipificaciones, reclasificación de llamadas, auditoría de contactos y ajuste de incidencias registradas.
                    </p>
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-between text-xs font-medium text-amber-400/80 pt-4 border-t border-slate-800/60">
                  <span>Privado Desarrollador (Brando)</span>
                  <Construction className="h-4 w-4 text-amber-500" />
                </div>
              </Link>
            )}

            {/* 🚧 MÓDULO 8: GESTIÓN DE ELECCIONES (EXCLUSIVO PARA DESARROLLADOR BRANDO) */}
            {isBrando && (
              <Link
                href="/en-construccion?modulo=Gestión+de+Elecciones"
                className="group relative flex flex-col justify-between p-7 rounded-2xl bg-slate-900/60 border border-slate-800/80 hover:border-cyan-500/40 hover:shadow-xl hover:shadow-cyan-950/20 transition-all opacity-90 hover:opacity-100"
              >
                <div>
                  <div className="flex items-start justify-between mb-5">
                    <div className="h-14 w-14 rounded-2xl bg-cyan-950/60 border border-cyan-800/50 flex items-center justify-center text-cyan-400 group-hover:scale-105 transition-all">
                      <Vote className="h-6 w-6" />
                    </div>
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-950/80 text-amber-300 border border-amber-800/60 uppercase tracking-wide">
                      🚧 En Construcción (Dev)
                    </span>
                  </div>

                  <div className="space-y-2">
                    <span className="text-xs font-mono font-medium uppercase tracking-wider text-cyan-400">
                      Procesos Electorales & Movilización
                    </span>
                    <h3 className="text-xl font-bold text-slate-300 tracking-tight group-hover:text-cyan-200 transition-colors">
                      Gestión de Elecciones
                    </h3>
                    <p className="text-sm text-slate-400 leading-relaxed">
                      Monitoreo de centros electorales, registro de movilización popular, padrón y reporte de participación en tiempo real.
                    </p>
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-between text-xs font-medium text-cyan-400/80 pt-4 border-t border-slate-800/60">
                  <span>Privado Desarrollador (Brando)</span>
                  <Construction className="h-4 w-4 text-amber-500" />
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
