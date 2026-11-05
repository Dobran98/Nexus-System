import React from 'react';
import { GuidedDialer } from '@/components/GuidedDialer';
import type { Database } from '@intranet/database';

export const metadata = {
  title: 'Discador Guiado — Nexus Calls & Incidents',
  description: 'Flujo de marcación y captura de interacciones en terminales celulares Samsung',
};

// Página Server Component en Next.js App Router
export default async function DialerPage() {
  // Mock o fetch del dispositivo asignado al operador en sesión
  const mockDevice: Database['public']['Tables']['corporate_devices']['Row'] = {
    id: 'b1a2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d',
    assigned_user_id: 'a0000000-0000-0000-0000-000000000001',
    imei: '358921104829104',
    imei2: null,
    phone_number: '+58 416-5550192',
    model: 'Samsung Galaxy A15 Enterprise',
    android_version: '14',
    knox_version: '3.9',
    knox_enrollment_id: 'KE-99201481',
    battery_health_pct: 94,
    storage_free_gb: 42.5,
    status: 'assigned',
    last_seen_at: new Date().toISOString(),
    notes: 'Terminal asignado para turno mañana',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const mockAssignment: Database['public']['Tables']['call_assignments']['Row'] = {
    id: 'f1e2d3c4-b5a6-4f5e-9d8c-7b6a5f4e3d2c',
    campaign_id: 'c1b2a3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d',
    operator_id: 'a0000000-0000-0000-0000-000000000001',
    customer_phone: '04141234567',
    customer_name: 'Comuna Socialista El Renacer - Vocero Principal',
    priority: 1,
    state: 'queued',
    rescheduled_for: null,
    assigned_at: new Date().toISOString(),
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8">
      <div className="max-w-4xl mx-auto mb-6">
        <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
          Consola de Telefonía Móvil Corporativa
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Ecosistema Desacoplado Nexus — Operación sin central PBX
        </p>
      </div>

      <GuidedDialer
        currentOperatorId="a0000000-0000-0000-0000-000000000001"
        assignedDevice={mockDevice}
        initialAssignment={mockAssignment}
      />
    </main>
  );
}
