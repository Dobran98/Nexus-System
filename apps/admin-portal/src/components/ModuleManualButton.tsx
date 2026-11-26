'use client';

import React, { useState } from 'react';
import { BookOpen } from 'lucide-react';
import { ModuleManualModal } from '@/components/ModuleManualModal';

interface ModuleManualButtonProps {
  initialModuleId?: string;
}

export function ModuleManualButton({ initialModuleId = 'asys' }: ModuleManualButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-slate-300 font-bold text-xs transition-all cursor-pointer shadow-sm hover:text-white"
        title="Consultar Manuales Operativos de los Módulos"
      >
        <BookOpen className="w-3.5 h-3.5 text-blue-400" />
        <span className="hidden sm:inline">Manuales</span>
      </button>

      <ModuleManualModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        initialModuleId={initialModuleId}
      />
    </>
  );
}
