'use client';

import React, { useState } from 'react';
import { LogOut } from 'lucide-react';
import { createSupabaseBrowserClient } from '@intranet/auth/client';

export function SignOutButton() {
  const [loading, setLoading] = useState(false);

  const handleSignOut = async () => {
    if (loading) return;
    setLoading(true);
    try {
      // 1. Limpieza exhaustiva de memorias locales y de sesión de todos los módulos
      try {
        sessionStorage.clear();
        localStorage.clear();
      } catch (storageErr) {
        console.warn('Advertencia limpiando almacenamiento:', storageErr);
      }

      // 2. Cerrar sesión en Supabase Auth
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.signOut();
    } catch (e) {
      console.warn('Error en signOut:', e);
    } finally {
      // 3. Purgar cookies del servidor y redirigir a /login
      window.location.href = '/api/auth/signout';
    }
  };

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={loading}
      title="Cerrar Sesión"
      className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-900 rounded-lg transition-colors border border-transparent hover:border-slate-800 disabled:opacity-50 cursor-pointer"
    >
      <LogOut className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
    </button>
  );
}
