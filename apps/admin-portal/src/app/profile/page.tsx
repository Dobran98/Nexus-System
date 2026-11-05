import React from 'react';
import { ProfileRestrictionPanel } from '@/components/ProfileRestrictionPanel';
import type { Database } from '@intranet/database';

export const metadata = {
  title: 'Perfil y Gobernanza de Acceso — Nexus Admin Portal',
  description: 'Panel de perfil de usuario con control de cuota semanal de actualización',
};

// Página Server Component en Next.js App Router
export default async function ProfilePage() {
  // Mock o fetch del perfil de usuario autenticado
  const mockProfile: Database['public']['Tables']['profiles']['Row'] = {
    id: 'a0000000-0000-0000-0000-000000000001',
    document_id: 'V-26910482',
    full_name: 'Norly Ariza',
    phone_number: '+58 414 1234567',
    address: 'Urb. Montalbán II, Edif. Los Samanes, Piso 4, Apto 42, Caracas',
    is_active: true,
    // Simula una edición ocurrida hace 3 días (faltan 4 días de bloqueo)
    last_profile_edit_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    profile_edit_count_week: 1,
    created_at: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8">
      <div className="max-w-3xl mx-auto mb-6">
        <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
          Gobernanza de Perfil y Auditoría
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Políticas de integridad de datos y restricción semanal de identidad
        </p>
      </div>

      <ProfileRestrictionPanel initialProfile={mockProfile} />
    </main>
  );
}
