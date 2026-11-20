import React from 'react';
import Link from 'next/link';
import {
  Shield,
  User,
  Database,
  CloudUpload,
  ArrowRight,
  Activity,
  Cpu,
  Server,
  Lock,
  Sparkles,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Zap,
  Users,
  LogOut,
} from 'lucide-react';
import { createSupabaseServerClient } from '@intranet/auth/server';
import { redirect } from 'next/navigation';

export default async function AdminHomePage() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  // Obtener perfil del usuario
  const { data: profile } = await (supabase
    .from('profiles') as any)
    .select('full_name, is_active')
    .eq('id', user.id)
    .single();

  // Obtener roles del usuario
  const { data: rolesData } = await (supabase
    .from('user_roles') as any)
    .select('roles!inner(name)')
    .eq('user_id', user.id);

  const roles = (rolesData ?? []).map((r: any) => r.roles?.name as string).filter(Boolean);
  const isSuperAdmin = roles.includes('superadmin');
  const isModuleAdmin = roles.includes('module_admin');

  const displayName = profile?.full_name ?? user.email?.split('@')[0] ?? 'Usuario';
  const roleLabel = roles.length > 0 ? roles.join(', ') : 'Operador';
  const initials = displayName
    .split(' ')
    .map((w: string) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'NX';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-blue-600/30 selection:text-blue-200">
      {/* ============================================================ */}
      {/* 1. TOPBAR / NAVBAR: "Nexus | Sala de Gobierno"               */}
      {/* ============================================================ */}
      <header className="sticky top-0 z-50 w-full border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Brand & Identity */}
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
                Sala de Gobierno
              </span>
            </div>
            <span className="hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-800/90 text-slate-300 border border-slate-700/60 ml-2">
              v1.0 Enterprise
            </span>
          </div>

          {/* Status and User Context */}
          <div className="flex items-center space-x-4">
            {/* Live Infrastructure Status */}
            <div className="hidden md:flex items-center space-x-2 px-3 py-1.5 rounded-full bg-slate-900/90 border border-slate-800 text-xs">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-slate-300 font-medium">Cluster Operativo</span>
              <span className="text-slate-600">·</span>
              <span className="text-slate-400 font-mono">18ms</span>
            </div>

            {/* User Session Pill */}
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

      {/* ============================================================ */}
      {/* 2. MAIN CONTENT AREA                                         */}
      {/* ============================================================ */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-10">
        
        {/* EXECUTIVE HERO SECTION */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-slate-900/90 to-slate-950 border border-slate-800/80 p-8 sm:p-10 shadow-2xl">
          {/* Ambient glow effect */}
          <div className="absolute top-0 right-1/4 -mt-12 h-64 w-64 rounded-full bg-blue-600/10 blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 right-10 -mb-12 h-64 w-64 rounded-full bg-indigo-600/10 blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="space-y-3 max-w-2xl">
              <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-blue-950/60 border border-blue-800/40 text-blue-400 text-xs font-medium">
                <Sparkles className="h-3.5 w-3.5" />
                <span>Panel Maestro de Gobernanza y Telemetría</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
                Consola Central de Control Ejecutivo
              </h1>
              <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
                Supervisión unificada de políticas de acceso RBAC, ingestión masiva de lotes de telefonía y auditoría de integridad institucional en tiempo real.
              </p>
            </div>

            {/* Quick System Badge Stack */}
            <div className="flex flex-wrap lg:flex-col gap-2.5 sm:gap-3 self-start lg:self-center shrink-0">
              <div className="flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-slate-900/80 border border-slate-800 text-xs">
                <Clock className="h-4 w-4 text-slate-400" />
                <span className="text-slate-300">Auditoría continua:</span>
                <span className="text-blue-400 font-mono font-medium">Activa</span>
              </div>
              <div className="flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-slate-900/80 border border-slate-800 text-xs">
                <Zap className="h-4 w-4 text-emerald-400" />
                <span className="text-slate-300">Vercel Edge Network:</span>
                <span className="text-emerald-400 font-medium">Producción Activa</span>
              </div>
            </div>
          </div>
        </div>

        {/* ============================================================ */}
        {/* 3. KPI METRIC CARDS (EXECUTIVE RIBBON)                        */}
        {/* ============================================================ */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800/80 backdrop-blur-sm hover:border-slate-700/80 transition-all duration-300">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium uppercase tracking-wider">Disponibilidad SLA</span>
              <Activity className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-white">99.98%</div>
            <p className="text-xs text-emerald-400 mt-1 flex items-center space-x-1">
              <span>●</span>
              <span>Todos los nodos nominales</span>
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800/80 backdrop-blur-sm hover:border-slate-700/80 transition-all duration-300">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium uppercase tracking-wider">Gobernanza RBAC</span>
              <Shield className="h-4 w-4 text-blue-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-white">Activa</div>
            <p className="text-xs text-slate-400 mt-1">
              Cooldown 7 días en forzamiento
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800/80 backdrop-blur-sm hover:border-slate-700/80 transition-all duration-300">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium uppercase tracking-wider">Base de Datos</span>
              <Database className="h-4 w-4 text-indigo-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-white">Supabase</div>
            <p className="text-xs text-slate-400 mt-1">
              Partición por campaña lista
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800/80 backdrop-blur-sm hover:border-slate-700/80 transition-all duration-300">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium uppercase tracking-wider">Lotes Ingeridos</span>
              <CloudUpload className="h-4 w-4 text-cyan-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-white">0 en Cola</div>
            <p className="text-xs text-cyan-400 mt-1">
              Pipeline listo para carga
            </p>
          </div>
        </section>

        {/* ============================================================ */}
        {/* 4. CORE OPERATIONAL MODULES GRID                             */}
        {/* ============================================================ */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">
                Módulos de Operación y Gobierno
              </h2>
              <p className="text-xs text-slate-400">
                Seleccione una unidad administrativa para ejecutar procedimientos de alta integridad
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            {/* MODULE 1: INGESTA MASIVA */}
            <Link
              href="/ingest"
              className="group relative flex flex-col justify-between p-7 sm:p-8 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 hover:-translate-y-1 hover:shadow-2xl hover:shadow-blue-950/40 transition-all duration-300 overflow-hidden"
            >
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-500/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

              <div>
                <div className="flex items-start justify-between mb-6">
                  <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-blue-950 to-slate-900 border border-blue-800/50 flex items-center justify-center text-blue-400 group-hover:scale-105 group-hover:border-blue-500/80 group-hover:text-blue-300 transition-all duration-300 shadow-md">
                    <div className="relative">
                      <Database className="h-6 w-6 text-blue-400" />
                      <CloudUpload className="h-4 w-4 text-cyan-300 absolute -top-1.5 -right-2" />
                    </div>
                  </div>
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-950/80 text-blue-300 border border-blue-800/60 uppercase tracking-wide">
                    Streaming Batch
                  </span>
                </div>

                <div className="space-y-2">
                  <span className="text-xs font-mono font-medium uppercase tracking-wider text-blue-400">
                    Procesamiento de Telefonía
                  </span>
                  <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight group-hover:text-blue-300 transition-colors">
                    Ingesta Masiva de Datos
                  </h3>
                  <p className="text-sm text-slate-400 leading-relaxed pt-1">
                    Procesamiento de lotes CSV/XLSX con validación sintáctica de prefijos telefónicos y detección heurística de duplicados hacia el cluster Supabase.
                  </p>
                </div>

                <div className="mt-6 pt-6 border-t border-slate-800/80 grid grid-cols-2 gap-3 text-xs text-slate-400">
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                    <span>Deduplicación Hash</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                    <span>Chunking en Streaming</span>
                  </div>
                </div>
              </div>

              <div className="mt-8 flex items-center justify-between text-sm font-semibold text-blue-400 group-hover:text-blue-300">
                <span>Abrir Consola de Ingesta</span>
                <span className="h-9 w-9 rounded-full bg-slate-800/80 border border-slate-700/80 flex items-center justify-center text-slate-300 group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-500 group-hover:translate-x-1 transition-all duration-300">
                  <ArrowRight className="h-4 w-4" />
                </span>
              </div>
            </Link>

            {/* MODULE 2: PERFIL & GOBERNANZA */}
            <Link
              href="/profile"
              className="group relative flex flex-col justify-between p-7 sm:p-8 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 hover:-translate-y-1 hover:shadow-2xl hover:shadow-indigo-950/40 transition-all duration-300 overflow-hidden"
            >
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

              <div>
                <div className="flex items-start justify-between mb-6">
                  <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-indigo-950 to-slate-900 border border-indigo-800/50 flex items-center justify-center text-indigo-400 group-hover:scale-105 group-hover:border-indigo-500/80 group-hover:text-indigo-300 transition-all duration-300 shadow-md">
                    <div className="relative">
                      <Shield className="h-6 w-6 text-indigo-400" />
                      <User className="h-4 w-4 text-indigo-200 absolute -top-1.5 -right-2" />
                    </div>
                  </div>
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-950/80 text-indigo-300 border border-indigo-800/60 uppercase tracking-wide">
                    Cooldown 7 Días
                  </span>
                </div>

                <div className="space-y-2">
                  <span className="text-xs font-mono font-medium uppercase tracking-wider text-indigo-400">
                    Seguridad de Identidad & RBAC
                  </span>
                  <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight group-hover:text-indigo-300 transition-colors">
                    Perfil y Gobernanza
                  </h3>
                  <p className="text-sm text-slate-400 leading-relaxed pt-1">
                    Visualización y edición restringida de identidad corporativa con cooldown forzado semanal, auditoría inmutable y control de políticas de integridad.
                  </p>
                </div>

                <div className="mt-6 pt-6 border-t border-slate-800/80 grid grid-cols-2 gap-3 text-xs text-slate-400">
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                    <span>Límite 1 Cambio / 7D</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                    <span>Trazabilidad Forense</span>
                  </div>
                </div>
              </div>

              <div className="mt-8 flex items-center justify-between text-sm font-semibold text-indigo-400 group-hover:text-indigo-300">
                <span>Gestionar Perfil</span>
                <span className="h-9 w-9 rounded-full bg-slate-800/80 border border-slate-700/80 flex items-center justify-center text-slate-300 group-hover:bg-indigo-600 group-hover:text-white group-hover:border-indigo-500 group-hover:translate-x-1 transition-all duration-300">
                  <ArrowRight className="h-4 w-4" />
                </span>
              </div>
            </Link>

            {/* MODULE 3: GESTIÓN DE USUARIOS (RBAC) */}
            {(isSuperAdmin || isModuleAdmin) && (
              <Link
                href="/admin/users"
                className="group relative flex flex-col justify-between p-7 sm:p-8 rounded-2xl bg-slate-900 border border-blue-900/50 hover:border-blue-700 hover:-translate-y-1 hover:shadow-2xl hover:shadow-blue-950/40 transition-all duration-300 overflow-hidden"
              >
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                <div>
                  <div className="flex items-start justify-between mb-6">
                    <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-cyan-950 to-slate-900 border border-cyan-800/50 flex items-center justify-center text-cyan-400 group-hover:scale-105 group-hover:border-cyan-500/80 group-hover:text-cyan-300 transition-all duration-300 shadow-md">
                      <Users className="h-6 w-6 text-cyan-400" />
                    </div>
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-cyan-950/80 text-cyan-300 border border-cyan-800/60 uppercase tracking-wide">
                      Superadmin
                    </span>
                  </div>

                  <div className="space-y-2">
                    <span className="text-xs font-mono font-medium uppercase tracking-wider text-cyan-400">
                      Administración de Cuentas
                    </span>
                    <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight group-hover:text-cyan-300 transition-colors">
                      Gestión de Usuarios
                    </h3>
                    <p className="text-sm text-slate-400 leading-relaxed pt-1">
                      CRUD de operadores y analistas, asignación de roles RBAC, activación/desactivación y auditoría de accesos.
                    </p>
                  </div>

                  <div className="mt-6 pt-6 border-t border-slate-800/80 grid grid-cols-2 gap-3 text-xs text-slate-400">
                    <div className="flex items-center space-x-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                      <span>Roles Granulares</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                      <span>Control de Estado</span>
                    </div>
                  </div>
                </div>

                <div className="mt-8 flex items-center justify-between text-sm font-semibold text-cyan-400 group-hover:text-cyan-300">
                  <span>Administrar Usuarios</span>
                  <span className="h-9 w-9 rounded-full bg-slate-800/80 border border-slate-700/80 flex items-center justify-center text-slate-300 group-hover:bg-cyan-600 group-hover:text-white group-hover:border-cyan-500 group-hover:translate-x-1 transition-all duration-300">
                    <ArrowRight className="h-4 w-4" />
                  </span>
                </div>
              </Link>
            )}
          </div>
        </section>

        {/* ============================================================ */}
        {/* 5. SECONDARY GOVERNANCE MODULES                              */}
        {/* ============================================================ */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">
              Servicios Conectados e Infraestructura
            </h2>
            <span className="text-xs font-mono text-slate-500">ESTADO EN TIEMPO REAL</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700/80 hover:-translate-y-1 hover:shadow-lg hover:shadow-slate-800/50 transition-all duration-300">
              <div className="h-10 w-10 rounded-xl bg-slate-800/80 border border-slate-700/80 flex items-center justify-center text-slate-300 mb-4">
                <Cpu className="h-5 w-5 text-blue-400" />
              </div>
              <h4 className="text-base font-semibold text-white">Telemetría de Campañas</h4>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                Monitoreo activo de colas de llamadas para operadoras Oriana y Briana con distribución equitativa.
              </p>
              <div className="mt-4 pt-4 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-400">
                <span>Motor Telefónico</span>
                <span className="text-emerald-400 font-medium">Sincronizado</span>
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700/80 hover:-translate-y-1 hover:shadow-lg hover:shadow-slate-800/50 transition-all duration-300">
              <div className="h-10 w-10 rounded-xl bg-slate-800/80 border border-slate-700/80 flex items-center justify-center text-slate-300 mb-4">
                <Lock className="h-5 w-5 text-indigo-400" />
              </div>
              <h4 className="text-base font-semibold text-white">Registro de Auditoría</h4>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                Bitácora de eventos criptográficamente sellada para inspección de cumplimiento legal y seguridad.
              </p>
              <div className="mt-4 pt-4 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-400">
                <span>Retención Forense</span>
                <span className="text-slate-300 font-mono">365 Días</span>
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700/80 hover:-translate-y-1 hover:shadow-lg hover:shadow-slate-800/50 transition-all duration-300">
              <div className="h-10 w-10 rounded-xl bg-slate-800/80 border border-slate-700/80 flex items-center justify-center text-slate-300 mb-4">
                <Server className="h-5 w-5 text-cyan-400" />
              </div>
              <h4 className="text-base font-semibold text-white">Esquema Particionado</h4>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                Tablas particionadas por campaña en PostgreSQL con indexación GiST para telefonía de alta concurrencia.
              </p>
              <div className="mt-4 pt-4 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-400">
                <span>Estado de Índices</span>
                <span className="text-emerald-400 font-medium">100% Óptimo</span>
              </div>
            </div>
          </div>
        </section>

      </main>

      {/* ============================================================ */}
      {/* 6. ENTERPRISE FOOTER                                         */}
      {/* ============================================================ */}
      <footer className="w-full border-t border-slate-800/80 bg-slate-950 py-6 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center space-x-2">
            <span className="font-semibold text-slate-400">Nexus Intranet Platform</span>
            <span>·</span>
            <span>Sala de Gobierno y Comando de Infraestructura</span>
          </div>
          <div className="flex items-center space-x-6">
            <span>Next.js 14 App Router</span>
            <span>Supabase Cloud</span>
            <span>Vercel Edge</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
