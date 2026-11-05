import React from 'react';
import { BulkDataIngestor } from '@/components/BulkDataIngestor';

export const metadata = {
  title: 'Ingesta Masiva de Campañas — Nexus Admin Portal',
  description: 'Módulo de carga y particionamiento de bases de datos de telefonía y contactos',
};

// Página Server Component en Next.js App Router
export default async function IngestPage() {
  // IDs de campaña y operador por defecto para la sesión de carga
  const defaultCampaignId = 'c1b2a3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d';
  const defaultOperatorId = 'a0000000-0000-0000-0000-000000000001';

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8">
      <div className="max-w-5xl mx-auto mb-6">
        <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
          Procesador de Ingesta Masiva y Deduplicación
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Carga por lotes (streaming chunking) con validación sintáctica de prefijos y detección de duplicados
        </p>
      </div>

      <BulkDataIngestor
        campaignId={defaultCampaignId}
        operatorId={defaultOperatorId}
      />
    </main>
  );
}

