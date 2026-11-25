'use client';

import React, { useState } from 'react';
import { Megaphone } from 'lucide-react';
import { EmitirAvisoModal } from '@/components/EmitirAvisoModal';

interface AdminHeaderActionsProps {
  canEmitAviso: boolean;
  currentUserEmail: string;
}

export function AdminHeaderActions({ canEmitAviso, currentUserEmail }: AdminHeaderActionsProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!canEmitAviso) return null;

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-950/60 hover:bg-rose-900/80 border border-rose-800/60 text-rose-300 font-bold text-xs transition-all cursor-pointer shadow-sm hover:shadow-rose-950/40"
        title="Emitir un aviso transversal a toda la plataforma o usuarios específicos"
      >
        <Megaphone className="w-3.5 h-3.5 text-rose-400" />
        <span className="hidden sm:inline">Emitir Aviso</span>
      </button>

      <EmitirAvisoModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        currentUserEmail={currentUserEmail}
      />
    </>
  );
}
