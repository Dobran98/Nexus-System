import React from 'react';
import Link from 'next/link';
import { ArrowLeft, UserCheck, ShieldCheck, QrCode } from 'lucide-react';
import { ProfileRestrictionPanel } from '@/components/ProfileRestrictionPanel';
import { NotificationCenter } from '@/components/NotificationCenter';
import { createSupabaseServerClient } from '@intranet/auth/server';
import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Perfil y Gobernanza de Acceso — Nexus Admin Portal',
  description: 'Panel de perfil de usuario con control de cuota semanal de actualización (Cooldown de 7 días)',
};

export default async function ProfilePage() {
  const supabase = createSupabaseServerClient();
  let user: any = null;

  try {
    const { data, error } = await supabase.auth.getUser();
    if (!error && data?.user) {
      user = data.user;
    }
  } catch {
    user = null;
  }

  if (!user) redirect('/login?redirectTo=/profile');

  // Consulta resiliente con maybeSingle
  let { data: profile } = await (supabase
    .from('profiles') as any)
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  // Si no tiene perfil, autoprovisionar uno básico para evitar pantallas en blanco
  if (!profile) {
    const fallbackProfile = {
      id: user.id,
      full_name: user.email?.split('@')[0] || 'Usuario Nexus',
      document_id: 'V-NEXUS00',
      is_active: true,
      phone_number: '',
      address: '',
    };
    try {
      const { data: created } = await (supabase
        .from('profiles') as any)
        .insert(fallbackProfile)
        .select()
        .single();
      if (created) profile = created;
    } catch {
      profile = fallbackProfile;
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-blue-600/30 selection:text-blue-200">
      {/* ── 1. NAVBAR DE INTEGRACIÓN ─────────────────────────────── */}
      <header className="sticky top-0 z-50 w-full border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-300 bg-slate-900 border border-slate-700/80 hover:bg-slate-800 hover:text-white transition-all shadow-sm"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Panel Maestro</span>
            </Link>
            <span className="text-slate-700">|</span>
            <div className="flex items-center space-x-2">
              <span className="text-sm font-bold tracking-tight text-white font-mono flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-teal-400" />
                PERFIL & COOLDOWN
              </span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-teal-950 text-teal-300 border border-teal-800/60">
                ● Activo
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-3 text-xs text-slate-400">
            <Link
              href="/asistencia"
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold text-emerald-300 bg-emerald-950/80 border border-emerald-800/80 hover:bg-emerald-900/60 transition-all shadow-sm"
            >
              <QrCode className="w-3.5 h-3.5 text-emerald-400" />
              <span>Módulo Asys</span>
            </Link>
            <NotificationCenter />
            <span className="hidden sm:inline-block font-mono text-[11px] text-slate-500">
              {user.email}
            </span>
          </div>
        </div>
      </header>

      {/* ── 2. CONTENIDO PRINCIPAL ───────────────────────────────── */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-8">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-950/60 border border-teal-800/40 text-teal-400 text-xs font-semibold">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Gobernanza de Identidad & Integridad</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">
            Perfil Personal & Cuota Semanal
          </h1>
          <p className="text-slate-400 text-sm leading-relaxed max-w-2xl">
            Revise sus datos institucionales inmutables y actualice su información de contacto (teléfono y dirección). Por política de seguridad institucional, cada modificación activa un bloqueo estricto de 7 días.
          </p>
        </div>

        {/* Panel Reactivo con Temporizador en Vivo */}
        <ProfileRestrictionPanel initialProfile={profile} />
      </main>
    </div>
  );
}
