'use client';

import React, { useState } from 'react';
import { Sliders } from 'lucide-react';
import { ModuleGovernanceModal } from '@/components/ModuleGovernanceModal';

interface ModuleGovernanceButtonProps {
  isSuperAdmin: boolean;
  isFundadorDev: boolean;
}

export function ModuleGovernanceButton({ isSuperAdmin, isFundadorDev }: ModuleGovernanceButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!isSuperAdmin && !isFundadorDev) return null;

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-950/60 hover:bg-amber-900/80 border border-amber-800/60 text-amber-300 font-bold text-xs transition-all cursor-pointer shadow-sm hover:shadow-amber-950/40"
        title="Gobernanza de Módulos (Activar / Modo Pruebas / Mantenimiento)"
      >
        <Sliders className="w-3.5 h-3.5 text-amber-400" />
        <span className="hidden sm:inline">Módulos</span>
      </button>

      <ModuleGovernanceModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        isFundadorDev={isFundadorDev}
      />
    </>
  );
}
