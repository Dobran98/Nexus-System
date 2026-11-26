'use client';

import React, { useState, useEffect } from 'react';
import { ClipboardList } from 'lucide-react';
import { EncuestasModal } from '@/components/EncuestasModal';

interface EncuestasHeaderButtonProps {
  canManage: boolean;
  currentUserEmail: string;
}

export function EncuestasHeaderButton({ canManage, currentUserEmail }: EncuestasHeaderButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState<number>(0);

  useEffect(() => {
    const fetchPending = async () => {
      try {
        const res = await fetch('/api/encuestas');
        if (res.ok) {
          const data = await res.json();
          if (data.pending_count !== undefined) {
            setPendingCount(data.pending_count);
          }
        }
      } catch (err) {
        // silencioso
      }
    };

    fetchPending();
    const interval = setInterval(fetchPending, 45000);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-950/60 hover:bg-cyan-900/80 border border-cyan-800/60 text-cyan-300 font-bold text-xs transition-all cursor-pointer shadow-sm hover:shadow-cyan-950/40"
        title="Sondeos y Encuestas Operativas de Nexus"
      >
        <ClipboardList className="w-3.5 h-3.5 text-cyan-400" />
        <span className="hidden sm:inline">Encuestas</span>
        
        {pendingCount > 0 && (
          <span className="inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full bg-cyan-500 text-slate-950 text-[10px] font-black animate-pulse">
            {pendingCount}
          </span>
        )}
      </button>

      <EncuestasModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        currentUserEmail={currentUserEmail}
        canManage={canManage}
      />
    </>
  );
}
