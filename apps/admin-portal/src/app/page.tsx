import React from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  QrCode,
  ArrowRight,
  Sparkles,
  Zap,
  LogOut,
  Clock,
  Construction,
  PhoneCall,
  FileSpreadsheet,
  Users,
  LineChart,
  UserCheck,
} from 'lucide-react';
import { createSupabaseServerClient } from '@intranet/auth/server';
import { redirect } from 'next/navigation';

export default async function AdminHomePage() {
  let user: any = null;
  let profile: any = null;
  let roles: string[] = [];

  try {
    const supabase = createSupabaseServerClient();
    const { data } = await supabase.auth.getUser();
    user = data.user;

    if (!user) {
      redirect('/login');
    }

    // Obtener perfil del usuario
    const { data: profileData } = await (supabase
      .from('profiles') as any)
      .select('full_name, is_active')
      .eq('id', user.id)
      .single();
    profile = profileData;

    // Obtener roles del usuario
    const { data: rolesData } = await (supabase
      .from('user_roles') as any)
      .select('roles!inner(name)')
      .eq('user_id', user.id);

    roles = (rolesData ?? []).map((r: any) => r.roles?.name as string).filter(Boolean);
  } catch (err: any) {
    if (err?.digest?.startsWith('NEXT_REDIRECT')) throw err;
    // Fallback seguro si no hay sesión
    redirect('/login');
  }

  const displayName = profile?.full_name ?? user?.email?.split('@')[0] ?? 'Operador';
  const roleLabel = roles.length > 0 ? roles.join(', ') : 'Operador / Personal';
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
            <div className="flex items-center space-x-3 pl-2 border-l border-slate-800">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-semibold text-slate-200">{displayName}</p>
                <p className="text-[11px] text-slate-400">{roleLabel}</p>
              </div>
              <div className="h-9 w-9 rounded-full bg-gradient-to-br from-slate-700 to-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-slate-200 shadow-sm">
                {initials}
              </div>
              <form action="/api/auth/signout" method="POST">
                <button
                  type="submit"
                  title="Cerrar Sesión"
                  className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-900 rounded-lg transition-colors border border-transparent hover:border-slate-800"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </form>
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
                Escaneo y registro de turnos de entrada y salida con validación de identidad y geolocalización. El resto de módulos se activarán progresivamente.
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

        {/* ── 3. SECCIÓN: MÓDULO ACTIVO DESTACADO ───────────────────── */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">
                Módulos de Trabajo
              </h2>
              <p className="text-xs text-slate-400">
                Acceda al escáner de asistencia habilitado o revise los módulos en desarrollo
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
                    Control de Turno
                  </span>
                  <h3 className="text-xl font-bold text-white tracking-tight group-hover:text-emerald-300 transition-colors">
                    Escaneo de Asistencia
                  </h3>
                  <p className="text-sm text-slate-400 leading-relaxed">
                    Marcado de entrada (Clock-In), descansos y salida (Clock-Out) con registro de hora oficial y geolocalización en Supabase.
                  </p>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-between text-sm font-semibold text-emerald-400 group-hover:text-emerald-300 pt-4 border-t border-slate-800">
                <span>Ingresar al Escáner</span>
                <span className="h-8 w-8 rounded-full bg-emerald-950 border border-emerald-800 flex items-center justify-center text-emerald-300 group-hover:bg-emerald-600 group-hover:text-white transition-all">
                  <ArrowRight className="h-4 w-4" />
                </span>
              </div>
            </Link>

            {/* 🚧 MÓDULO 2: INGESTA MASIVA (EN CONSTRUCCIÓN) */}
            <Link
              href="/en-construccion?modulo=Ingesta+Masiva"
              className="group relative flex flex-col justify-between p-7 rounded-2xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700/80 transition-all opacity-85 hover:opacity-100"
            >
              <div>
                <div className="flex items-start justify-between mb-5">
                  <div className="h-14 w-14 rounded-2xl bg-slate-800/70 border border-slate-700/60 flex items-center justify-center text-slate-400">
                    <FileSpreadsheet className="h-6 w-6" />
                  </div>
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-950/80 text-amber-300 border border-amber-800/60 uppercase tracking-wide">
                    🚧 En Construcción
                  </span>
                </div>

                <div className="space-y-2">
                  <span className="text-xs font-mono font-medium uppercase tracking-wider text-slate-500">
                    Telefonía
                  </span>
                  <h3 className="text-xl font-bold text-slate-300 tracking-tight">
                    Ingesta Masiva de Datos
                  </h3>
                  <p className="text-sm text-slate-500 leading-relaxed">
                    Carga por lotes CSV/XLSX con detección heurística de duplicados. Se activará en la Fase 2.
                  </p>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-between text-xs font-medium text-slate-500 pt-4 border-t border-slate-800/60">
                <span>Próximamente disponible</span>
                <Construction className="h-4 w-4 text-amber-500" />
              </div>
            </Link>

            {/* 🚧 MÓDULO 3: LLAMADAS / MARCADOR (EN CONSTRUCCIÓN) */}
            <Link
              href="/en-construccion?modulo=Telefonía+y+Llamadas"
              className="group relative flex flex-col justify-between p-7 rounded-2xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700/80 transition-all opacity-85 hover:opacity-100"
            >
              <div>
                <div className="flex items-start justify-between mb-5">
                  <div className="h-14 w-14 rounded-2xl bg-slate-800/70 border border-slate-700/60 flex items-center justify-center text-slate-400">
                    <PhoneCall className="h-6 w-6" />
                  </div>
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-950/80 text-amber-300 border border-amber-800/60 uppercase tracking-wide">
                    🚧 En Construcción
                  </span>
                </div>

                <div className="space-y-2">
                  <span className="text-xs font-mono font-medium uppercase tracking-wider text-slate-500">
                    Operaciones
                  </span>
                  <h3 className="text-xl font-bold text-slate-300 tracking-tight">
                    Marcador e Incidentes
                  </h3>
                  <p className="text-sm text-slate-500 leading-relaxed">
                    Marcación guiada de colas, tipificación y registro telefónico de incidentes.
                  </p>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-between text-xs font-medium text-slate-500 pt-4 border-t border-slate-800/60">
                <span>Próximamente disponible</span>
                <Construction className="h-4 w-4 text-amber-500" />
              </div>
            </Link>

            {/* 🚧 MÓDULO 4: ORIANA ANALYTICS (EN CONSTRUCCIÓN) */}
            <Link
              href="/en-construccion?modulo=Oriana+Analytics"
              className="group relative flex flex-col justify-between p-7 rounded-2xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700/80 transition-all opacity-85 hover:opacity-100"
            >
              <div>
                <div className="flex items-start justify-between mb-5">
                  <div className="h-14 w-14 rounded-2xl bg-slate-800/70 border border-slate-700/60 flex items-center justify-center text-slate-400">
                    <LineChart className="h-6 w-6" />
                  </div>
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-950/80 text-amber-300 border border-amber-800/60 uppercase tracking-wide">
                    🚧 En Construcción
                  </span>
                </div>

                <div className="space-y-2">
                  <span className="text-xs font-mono font-medium uppercase tracking-wider text-slate-500">
                    Auditoría
                  </span>
                  <h3 className="text-xl font-bold text-slate-300 tracking-tight">
                    Módulo Oriana
                  </h3>
                  <p className="text-sm text-slate-500 leading-relaxed">
                    Evaluación analítica y validación de calidad operativa de agentes y llamadas.
                  </p>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-between text-xs font-medium text-slate-500 pt-4 border-t border-slate-800/60">
                <span>Próximamente disponible</span>
                <Construction className="h-4 w-4 text-amber-500" />
              </div>
            </Link>

            {/* 🚧 MÓDULO 5: GESTIÓN DE USUARIOS (EN CONSTRUCCIÓN) */}
            <Link
              href="/en-construccion?modulo=Gestión+de+Usuarios"
              className="group relative flex flex-col justify-between p-7 rounded-2xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700/80 transition-all opacity-85 hover:opacity-100"
            >
              <div>
                <div className="flex items-start justify-between mb-5">
                  <div className="h-14 w-14 rounded-2xl bg-slate-800/70 border border-slate-700/60 flex items-center justify-center text-slate-400">
                    <Users className="h-6 w-6" />
                  </div>
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-950/80 text-amber-300 border border-amber-800/60 uppercase tracking-wide">
                    🚧 En Construcción
                  </span>
                </div>

                <div className="space-y-2">
                  <span className="text-xs font-mono font-medium uppercase tracking-wider text-slate-500">
                    Gobierno RBAC
                  </span>
                  <h3 className="text-xl font-bold text-slate-300 tracking-tight">
                    Gestión de Usuarios
                  </h3>
                  <p className="text-sm text-slate-500 leading-relaxed">
                    Creación, edición y asignación de roles para el personal corporativo.
                  </p>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-between text-xs font-medium text-slate-500 pt-4 border-t border-slate-800/60">
                <span>Próximamente disponible</span>
                <Construction className="h-4 w-4 text-amber-500" />
              </div>
            </Link>

            {/* 🚧 MÓDULO 6: PERFIL Y RESTRICCIONES (EN CONSTRUCCIÓN) */}
            <Link
              href="/en-construccion?modulo=Perfil+de+Usuario"
              className="group relative flex flex-col justify-between p-7 rounded-2xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700/80 transition-all opacity-85 hover:opacity-100"
            >
              <div>
                <div className="flex items-start justify-between mb-5">
                  <div className="h-14 w-14 rounded-2xl bg-slate-800/70 border border-slate-700/60 flex items-center justify-center text-slate-400">
                    <UserCheck className="h-6 w-6" />
                  </div>
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-950/80 text-amber-300 border border-amber-800/60 uppercase tracking-wide">
                    🚧 En Construcción
                  </span>
                </div>

                <div className="space-y-2">
                  <span className="text-xs font-mono font-medium uppercase tracking-wider text-slate-500">
                    Identidad
                  </span>
                  <h3 className="text-xl font-bold text-slate-300 tracking-tight">
                    Perfil y Cooldown
                  </h3>
                  <p className="text-sm text-slate-500 leading-relaxed">
                    Edición de datos personales con restricción forzada de 7 días.
                  </p>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-between text-xs font-medium text-slate-500 pt-4 border-t border-slate-800/60">
                <span>Próximamente disponible</span>
                <Construction className="h-4 w-4 text-amber-500" />
              </div>
            </Link>

          </div>
        </section>
      </main>

      {/* ── 4. FOOTER ────────────────────────────────────────────── */}
      <footer className="w-full border-t border-slate-800/80 bg-slate-950 py-6 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center space-x-2">
            <span className="font-semibold text-slate-400">Nexus Intranet Platform</span>
            <span>·</span>
            <span>Fase 1: Módulo de Asistencia</span>
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
