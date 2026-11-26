'use client';

import React, { useState, useEffect } from 'react';
import {
  Sliders,
  X,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Globe,
  Wrench,
  Sparkles,
  RefreshCw,
  Info
} from 'lucide-react';

interface ModuleFlag {
  id: string;
  name: string;
  category: string;
  route: string;
  status: 'public' | 'testing' | 'maintenance';
  minRole: string;
  maintenance_message?: string;
  updated_by?: string;
  updated_at?: string;
}

interface ModuleGovernanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  isFundadorDev: boolean;
}

export function ModuleGovernanceModal({ isOpen, onClose, isFundadorDev }: ModuleGovernanceModalProps) {
  const [flags, setFlags] = useState<Record<string, ModuleFlag>>({});
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const fetchFlags = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/module-flags');
      const data = await res.json();
      if (data.flags) {
        setFlags(data.flags);
      }
    } catch (err) {
      console.error('Error fetching module flags:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setFeedback(null);
      fetchFlags();
    }
  }, [isOpen]);

  const handleUpdateStatus = async (moduleId: string, newStatus: 'public' | 'testing' | 'maintenance') => {
    try {
      setSavingId(moduleId);
      setFeedback(null);

      const res = await fetch('/api/admin/module-flags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          moduleId,
          status: newStatus
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setFeedback({ text: data.message, type: 'success' });
        setFlags(prev => ({
          ...prev,
          [moduleId]: {
            ...prev[moduleId],
            status: newStatus,
            updated_at: new Date().toISOString()
          }
        }));
      } else {
        setFeedback({ text: data.error || 'Error al actualizar', type: 'error' });
      }
    } catch (err: any) {
      setFeedback({ text: err.message || 'Error de red', type: 'error' });
    } finally {
      setSavingId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl max-h-[90vh] bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        
        {/* Cabecera del Modal */}
        <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-amber-500 via-rose-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-amber-950/40">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                Gobernanza de Módulos & Feature Flags
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-950/80 text-amber-300 border border-amber-800/80 font-black">
                  {isFundadorDev ? 'Consola Fundador Dev' : 'Superadmin'}
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Control de visibilidad y acceso público vs modo pruebas para cada módulo del sistema
              </p>
            </div>
          </div>
          
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div className={`mx-6 mt-4 p-3 rounded-2xl flex items-center gap-3 text-xs shrink-0 ${
            feedback.type === 'success' 
              ? 'bg-emerald-950/80 border border-emerald-800/80 text-emerald-300' 
              : 'bg-rose-950/80 border border-rose-800/80 text-rose-300'
          }`}>
            {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />}
            <span className="font-medium">{feedback.text}</span>
          </div>
        )}

        {/* Guía Rápida */}
        <div className="px-6 pt-4 shrink-0">
          <div className="p-3.5 rounded-2xl bg-slate-950/40 border border-slate-800 flex items-start gap-3 text-xs text-slate-300">
            <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p>
                <strong>¿Cómo funciona el despliegue de módulos?</strong>
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] text-slate-400 pt-1">
                <span className="flex items-center gap-1.5"><Globe className="w-3.5 h-3.5 text-emerald-400" /> <strong>Público:</strong> Visible y accesible para personal con el rol requerido.</span>
                <span className="flex items-center gap-1.5"><Lock className="w-3.5 h-3.5 text-amber-400" /> <strong>Solo Pruebas:</strong> Solo tú (Fundador Dev / Superadmin) puedes ingresar.</span>
                <span className="flex items-center gap-1.5"><Wrench className="w-3.5 h-3.5 text-rose-400" /> <strong>Mantenimiento:</strong> Bloqueado temporalmente con pantalla explicativa.</span>
              </div>
            </div>
          </div>
        </div>

        {/* Listado de Módulos */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {loading ? (
            <div className="p-12 text-center text-slate-500 flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-blue-400" />
              <span>Cargando matriz de módulos...</span>
            </div>
          ) : (
            Object.values(flags).map((mod) => {
              const isSaving = savingId === mod.id;

              return (
                <div
                  key={mod.id}
                  className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-slate-700 transition-all"
                >
                  <div className="space-y-1 max-w-md">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white">{mod.name}</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                        {mod.category}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">
                      Ruta: <code className="text-cyan-400">{mod.route}</code> · Rol Mínimo: <span className="font-mono text-slate-300">{mod.minRole}</span>
                    </p>
                    {mod.maintenance_message && mod.status !== 'public' && (
                      <p className="text-[11px] text-amber-300/80 italic pt-0.5">
                        Mensaje usuarios: "{mod.maintenance_message}"
                      </p>
                    )}
                  </div>

                  {/* Selector de Estado */}
                  <div className="flex items-center gap-1.5 shrink-0 bg-slate-900 p-1.5 rounded-xl border border-slate-800">
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => handleUpdateStatus(mod.id, 'public')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                        mod.status === 'public'
                          ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/50'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800'
                      }`}
                    >
                      <Globe className="w-3.5 h-3.5" />
                      <span>Público</span>
                    </button>

                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => handleUpdateStatus(mod.id, 'testing')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                        mod.status === 'testing'
                          ? 'bg-amber-600 text-white shadow-md shadow-amber-950/50'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800'
                      }`}
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>Solo Pruebas</span>
                    </button>

                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => handleUpdateStatus(mod.id, 'maintenance')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                        mod.status === 'maintenance'
                          ? 'bg-rose-600 text-white shadow-md shadow-rose-950/50'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800'
                      }`}
                    >
                      <Wrench className="w-3.5 h-3.5" />
                      <span>Mantenimiento</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <span>Los cambios se aplican en caliente sin reiniciar el servidor.</span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold transition-colors"
          >
            Listo
          </button>
        </div>

      </div>
    </div>
  );
}
