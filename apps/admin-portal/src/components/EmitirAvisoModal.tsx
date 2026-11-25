'use client';

import React, { useState, useEffect } from 'react';
import { Megaphone, X, Send, Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';

interface EmitirAvisoModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserEmail?: string;
}

export function EmitirAvisoModal({ isOpen, onClose, currentUserEmail }: EmitirAvisoModalProps) {
  const [users, setUsers] = useState<Array<{ id: string; email: string; full_name: string; role_name: string }>>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const [form, setForm] = useState({
    target_type: 'global' as 'global' | 'user' | 'role',
    target_email: '',
    target_role: 'multi_operator',
    modulo: 'general',
    prioridad: 'alta' as 'baja' | 'media' | 'alta' | 'urgente',
    popup: true,
    titulo: '',
    descripcion: '',
    enlace: '',
  });

  useEffect(() => {
    if (isOpen) {
      setFeedback(null);
      // Cargar lista de usuarios para el selector individual
      const loadUsers = async () => {
        try {
          setLoadingUsers(true);
          const res = await fetch('/api/admin/users');
          if (res.ok) {
            const data = await res.json();
            if (data.users) {
              setUsers(data.users.map((u: any) => ({
                id: u.id,
                email: u.email,
                full_name: u.full_name || u.email,
                role_name: u.role_name || 'Operador',
              })));
            }
          }
        } catch (e) {
          console.warn('Error loading users list:', e);
        } finally {
          setLoadingUsers(false);
        }
      };
      loadUsers();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.titulo.trim() || !form.descripcion.trim()) {
      setFeedback({ text: 'El título y la descripción son obligatorios.', type: 'error' });
      return;
    }

    setSending(true);
    setFeedback(null);

    try {
      const payload = {
        target_type: form.target_type,
        target_email: form.target_type === 'user' ? form.target_email : undefined,
        target_role: form.target_type === 'role' ? form.target_role : undefined,
        modulo: form.modulo,
        prioridad: form.prioridad,
        titulo: form.titulo.trim(),
        descripcion: form.descripcion.trim(),
        enlace: form.enlace.trim() || undefined,
        metadata: {
          popup: form.popup,
          emitted_by: currentUserEmail || 'admin',
          emitted_at: new Date().toISOString(),
        },
      };

      const res = await fetch('/api/notificaciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        setFeedback({
          text: `🎉 Aviso emitido exitosamente a ${form.target_type === 'global' ? 'toda la plataforma' : form.target_type === 'role' ? 'el rol seleccionado' : form.target_email}.`,
          type: 'success',
        });
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        setFeedback({ text: data.error || 'No se pudo emitir el aviso', type: 'error' });
      }
    } catch (err: any) {
      setFeedback({ text: err.message || 'Error de conexión', type: 'error' });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999999] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-6 sm:p-8 space-y-5 relative max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-rose-600/20 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
              <Megaphone className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                Emitir Aviso o Notificación Transversal
              </h2>
              <p className="text-xs text-slate-400">
                Aparece en pantalla sobre cualquier modal o vista que tenga el usuario
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {feedback && (
          <div className={`p-3 rounded-2xl text-xs font-bold border flex items-center gap-2 ${
            feedback.type === 'success' 
              ? 'bg-emerald-950 text-emerald-300 border-emerald-800' 
              : 'bg-rose-950 text-rose-300 border-rose-800'
          }`}>
            {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            <span>{feedback.text}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Tipo de Destinatario */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Destinatario del Aviso
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setForm({ ...form, target_type: 'global' })}
                className={`p-2.5 rounded-xl border text-xs font-semibold text-center transition-all ${
                  form.target_type === 'global'
                    ? 'bg-blue-600/20 border-blue-500 text-blue-300 font-bold'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                🌐 Global
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, target_type: 'user' })}
                className={`p-2.5 rounded-xl border text-xs font-semibold text-center transition-all ${
                  form.target_type === 'user'
                    ? 'bg-blue-600/20 border-blue-500 text-blue-300 font-bold'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                👤 Individual
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, target_type: 'role' })}
                className={`p-2.5 rounded-xl border text-xs font-semibold text-center transition-all ${
                  form.target_type === 'role'
                    ? 'bg-blue-600/20 border-blue-500 text-blue-300 font-bold'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                👥 Por Rol
              </button>
            </div>
          </div>

          {/* Selector si es Usuario */}
          {form.target_type === 'user' && (
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Seleccionar Usuario Específico
              </label>
              <select
                value={form.target_email}
                onChange={(e) => setForm({ ...form, target_email: e.target.value })}
                required
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-rose-500 font-mono"
              >
                <option value="">Selecciona un usuario...</option>
                {users.map((u) => (
                  <option key={u.id} value={u.email}>
                    {u.full_name} ({u.email}) - {u.role_name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Selector si es Rol */}
          {form.target_type === 'role' && (
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Seleccionar Rol Destinatario
              </label>
              <select
                value={form.target_role}
                onChange={(e) => setForm({ ...form, target_role: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-rose-500"
              >
                <option value="multi_operator">Operadores Multifunción</option>
                <option value="supervisor">Supervisores</option>
                <option value="data_analyst">Analistas de Datos</option>
                <option value="module_admin">Administradores de Módulo</option>
                <option value="auditor">Auditores</option>
              </select>
            </div>
          )}

          {/* Módulo y Prioridad */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Módulo Origen
              </label>
              <select
                value={form.modulo}
                onChange={(e) => setForm({ ...form, modulo: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-rose-500"
              >
                <option value="general">Plataforma General (Nexus)</option>
                <option value="briana">Telefonía (Briana)</option>
                <option value="oriana">Analítica (Oriana)</option>
                <option value="asys">Asistencia (Asys)</option>
                <option value="reclasificacion">Reclasificación</option>
                <option value="elecciones">Elecciones</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Nivel de Prioridad
              </label>
              <select
                value={form.prioridad}
                onChange={(e) => setForm({ ...form, prioridad: e.target.value as any })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-rose-500 font-bold"
              >
                <option value="alta" className="text-amber-400">Alta (Importante)</option>
                <option value="urgente" className="text-rose-400">Urgente (Interrumpe en Pantalla)</option>
                <option value="media" className="text-sky-400">Media (Estándar)</option>
                <option value="baja" className="text-slate-400">Baja (Informativo)</option>
              </select>
            </div>
          </div>

          {/* Título del Aviso */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Título del Comunicado *
            </label>
            <input
              type="text"
              required
              value={form.titulo}
              onChange={(e) => setForm({ ...form, titulo: e.target.value })}
              placeholder="Ej: Cambio de turno, reunión de sala o alerta técnica..."
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
            />
          </div>

          {/* Mensaje Detallado */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Mensaje o Instrucciones *
            </label>
            <textarea
              required
              rows={3}
              value={form.descripcion}
              onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
              placeholder="Escribe el cuerpo del mensaje que se desplegará al personal..."
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
            />
          </div>

          {/* Checkbox de Interrupción Flotante */}
          <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-950 border border-slate-800">
            <input
              type="checkbox"
              id="chkPopup"
              checked={form.popup}
              onChange={(e) => setForm({ ...form, popup: e.target.checked })}
              className="h-4 w-4 rounded bg-slate-900 border-slate-700 text-rose-500 focus:ring-rose-500"
            />
            <label htmlFor="chkPopup" className="text-xs text-slate-300 cursor-pointer">
              <strong>Desplegar como Alerta Flotante Inmediata</strong> (aparecerá encima de cualquier iframe o modal)
            </label>
          </div>

          <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-xl transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={sending}
              className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-lg shadow-rose-950/40 disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{sending ? 'Emitiendo Aviso...' : 'Emitir Aviso Transversal'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
