'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@intranet/auth/client';
import { ShieldCheck, ArrowRight, Lock, Mail, Building2 } from 'lucide-react';

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
    <main className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8 relative overflow-hidden">
      {/* Luces y degradados ambientales de fondo */}
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Contenedor Exterior */}
      <div className="w-full max-w-5xl relative z-10 flex flex-col items-center">
        
        {/* ── BRANDING SUPERIOR: NOMBRE NEXUS CON TIPOGRAFÍA REFINADA ── */}
        <div className="text-center mb-8 space-y-2">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-slate-900/80 border border-slate-700/60 shadow-inner backdrop-blur-md">
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
            <span className="text-[11px] font-bold uppercase tracking-[0.25em] text-slate-300">
              Plataforma Institucional Centralizada
            </span>
          </div>
          <h1 className="text-5xl sm:text-6xl font-black tracking-[0.2em] text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-sky-200 to-indigo-400 font-mono drop-shadow-xl select-none">
            NEXUS
          </h1>
          <p className="text-xs uppercase tracking-[0.2em] font-medium text-slate-400">
            Ecosistema de Operaciones & Asistencia
          </p>
        </div>

        {/* ── MODAL DUAL-PANE: PORTADA LIMPIA + FORMULARIO LOGIN ── */}
        <div className="w-full bg-slate-900/90 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden backdrop-blur-xl grid grid-cols-1 lg:grid-cols-12 min-h-[500px]">
          
          {/* ── PANEL IZQUIERDO: PORTADA ASYS LIMPIA Y COMPLETA ── */}
          <div className="hidden lg:block lg:col-span-6 relative overflow-hidden bg-slate-950 border-r border-slate-800/80">
            {/* Imagen portada completa sin textos superpuestos ni overlays pesados */}
            <div 
              className="absolute inset-0 bg-cover bg-center transition-transform duration-700 hover:scale-105"
              style={{ backgroundImage: `url('https://i.imgur.com/iC9TjWF.png')` }}
            />
            {/* Sutil viñeta lateral para integración armónica con el panel derecho */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-slate-950/20 pointer-events-none" />
          </div>

          {/* ── PANEL DERECHO: FORMULARIO DE ACCESO NEXUS ── */}
          <div className="lg:col-span-6 p-8 sm:p-10 flex flex-col justify-center space-y-6 bg-slate-900/70">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 text-xs font-semibold tracking-wider text-blue-400 uppercase">
                <Building2 className="w-4 h-4 text-blue-400" />
                <span>Autenticación Única (SSO)</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Iniciar Sesión
              </h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                Ingrese con su correo corporativo <span className="text-blue-400 font-semibold">@impress.com</span> para sincronizar automáticamente todos los módulos de la intranet.
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
                className="w-full mt-2 py-3 px-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white font-bold rounded-xl transition-all text-sm shadow-lg shadow-blue-900/30 flex items-center justify-center gap-2 group cursor-pointer"
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
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                Sesión Unificada Segura
              </span>
              <span>Nexus Intranet v2.0</span>
            </div>
          </div>

        </div>

      </div>
    </main>
  );
}
