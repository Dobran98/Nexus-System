'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@intranet/auth/client';
import { ShieldCheck, ArrowRight, Lock, Mail, Sparkles, Building2 } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createSupabaseBrowserClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError('Credenciales no válidas. Verifique su correo institucional y contraseña.');
      setLoading(false);
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const redirectTo = params.get('redirectTo') || '/';
    window.location.href = redirectTo;
  };

  return (
    <main className="min-h-screen bg-slate-950 flex items-center justify-center p-4 sm:p-6 lg:p-8 relative overflow-hidden">
      {/* Luces y degradados decorativos de fondo */}
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Contenedor Dual-Pane con Foto de Portada */}
      <div className="w-full max-w-4xl bg-slate-900/90 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden backdrop-blur-xl grid grid-cols-1 lg:grid-cols-12 relative z-10">
        
        {/* ── PANEL IZQUIERDO: PORTADA ASYS CON BRANDING NEXUS ── */}
        <div className="hidden lg:flex lg:col-span-5 relative flex-col justify-between p-8 text-white overflow-hidden bg-slate-950">
          {/* Imagen de fondo portada de Asys */}
          <div 
            className="absolute inset-0 bg-cover bg-center transition-transform duration-700 hover:scale-105"
            style={{ backgroundImage: `url('https://i.imgur.com/iC9TjWF.png')` }}
          />
          {/* Overlay gradiente oscuro para contraste y legibilidad */}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/70 to-slate-900/40" />

          {/* Encabezado sobre la imagen */}
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900/80 border border-white/10 backdrop-blur-md text-xs font-semibold text-blue-300">
              <ShieldCheck className="w-4 h-4 text-blue-400" />
              <span>NEXUS INTRANET</span>
            </div>
          </div>

          {/* Texto inferior sobre la imagen */}
          <div className="relative z-10 space-y-3">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-medium">
              <Sparkles className="w-3 h-3 text-emerald-400" />
              <span>Ecosistema Operativo</span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-white leading-tight">
              Control de Presencia, Telefonía & Auditoría
            </h2>
            <p className="text-xs text-slate-300/90 leading-relaxed">
              Plataforma institucional integrada para gestión operativa, registro de turnos y control de calidad.
            </p>
          </div>
        </div>

        {/* ── PANEL DERECHO: FORMULARIO DE ACCESO NEXUS ── */}
        <div className="lg:col-span-7 p-8 sm:p-10 flex flex-col justify-center space-y-6">
          <div className="space-y-2">
            <div className="flex items-center space-x-2.5">
              <span className="text-2xl font-black tracking-tight text-white font-mono">
                NEXUS
              </span>
              <span className="text-slate-700">|</span>
              <span className="text-xs font-semibold tracking-wider text-slate-400 uppercase">
                Sala de Acceso
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
              Iniciar Sesión
            </h1>
            <p className="text-xs text-slate-400">
              Ingrese con su correo corporativo <span className="text-blue-400 font-medium">@impress.com</span> para sincronizar automáticamente todos los módulos.
            </p>
          </div>

          {error && (
            <div className="p-3.5 bg-rose-950/70 border border-rose-800/80 rounded-xl text-rose-300 text-xs flex items-center gap-2.5 animate-in fade-in">
              <div className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Correo Corporativo
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ejemplo@impress.com"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950/60 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Contraseña
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950/60 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 px-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white font-bold rounded-xl transition-all text-sm shadow-lg shadow-blue-900/30 flex items-center justify-center gap-2 group"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <span>Verificando Identidad...</span>
                </span>
              ) : (
                <>
                  <span>Ingresar a Nexus</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </>
              )}
            </button>
          </form>

          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
            <span>● Sesión Unificada Segura</span>
            <span>Nexus Intranet v2.0</span>
          </div>
        </div>

      </div>
    </main>
  );
}
