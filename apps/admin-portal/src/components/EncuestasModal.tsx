'use client';

import React, { useState, useEffect } from 'react';
import {
  ClipboardList,
  X,
  Plus,
  CheckCircle2,
  AlertCircle,
  Star,
  BarChart3,
  Users,
  Send,
  Calendar,
  Lock,
  Unlock,
  Sparkles,
  ChevronRight,
  MessageSquare,
  HelpCircle,
  Trash2
} from 'lucide-react';

interface EncuestasModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserEmail?: string;
  canManage?: boolean;
}

export function EncuestasModal({ isOpen, onClose, currentUserEmail, canManage = false }: EncuestasModalProps) {
  const [activeTab, setActiveTab] = useState<'available' | 'results' | 'create'>('available');
  const [surveys, setSurveys] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedSurvey, setSelectedSurvey] = useState<any | null>(null);
  const [answersState, setAnswersState] = useState<Record<string, any>>({});
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Formulario de Creación de Encuesta
  const [createForm, setCreateForm] = useState({
    title: '',
    description: '',
    category: 'Clima Laboral & Puesto',
    expires_days: 7,
    target_audience: 'all',
    questions: [
      { id: 'q_1', type: 'rating', title: '¿Cómo evalúa el soporte y acompañamiento en su estación de trabajo?', required: true },
      { id: 'q_2', type: 'choice', title: '¿Las herramientas digitales responden sin demoras?', options: ['Excelente', 'Aceptable', 'Con lentitud ocasional', 'Requiere optimización'], required: true },
      { id: 'q_3', type: 'text', title: 'Comentarios adicionales o propuestas de mejora:', required: false }
    ]
  });

  const loadSurveys = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/encuestas');
      const data = await res.json();
      if (data.success && data.surveys) {
        setSurveys(data.surveys);
        if (!selectedSurvey && data.surveys.length > 0) {
          setSelectedSurvey(data.surveys[0]);
        } else if (selectedSurvey) {
          const updated = data.surveys.find((s: any) => s.id === selectedSurvey.id);
          if (updated) setSelectedSurvey(updated);
        }
      }
    } catch (err) {
      console.error('Error cargando encuestas:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setFeedback(null);
      loadSurveys();
    }
  }, [isOpen]);

  // Manejar respuesta de una encuesta
  const handleSubmitResponse = async (surveyId: string) => {
    try {
      setSubmitting(true);
      setFeedback(null);

      const res = await fetch('/api/encuestas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'submit_response',
          survey_id: surveyId,
          answers: answersState
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setFeedback({ text: data.message || 'Evaluación registrada con éxito', type: 'success' });
        loadSurveys();
      } else {
        setFeedback({ text: data.error || 'Error al guardar respuesta', type: 'error' });
      }
    } catch (err: any) {
      setFeedback({ text: err.message || 'Error de conexión', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  // Manejar creación de nueva encuesta
  const handleCreateSurvey = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setFeedback(null);

      const res = await fetch('/api/encuestas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_survey',
          ...createForm
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setFeedback({ text: 'Encuesta creada y publicada exitosamente', type: 'success' });
        setActiveTab('available');
        loadSurveys();
      } else {
        setFeedback({ text: data.error || 'Error creando encuesta', type: 'error' });
      }
    } catch (err: any) {
      setFeedback({ text: err.message || 'Error al crear', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  // Alternar estado activa / cerrada
  const handleToggleStatus = async (surveyId: string) => {
    try {
      const res = await fetch('/api/encuestas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle_status', survey_id: surveyId })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        loadSurveys();
      }
    } catch (err) {
      console.error('Error toggling status:', err);
    }
  };

  // Añadir pregunta en el constructor
  const addQuestion = (type: 'rating' | 'choice' | 'text') => {
    const nextIdx = createForm.questions.length + 1;
    let newQ: any = {
      id: `q_${Date.now()}`,
      type: type,
      title: type === 'rating' ? `Pregunta de Escala ${nextIdx}` : (type === 'choice' ? `Pregunta de Selección ${nextIdx}` : `Pregunta Abierta ${nextIdx}`),
      required: true
    };
    if (type === 'choice') {
      newQ.options = ['Opción A', 'Opción B', 'Opción C'];
    }
    setCreateForm({ ...createForm, questions: [...createForm.questions, newQ] });
  };

  const removeQuestion = (idx: number) => {
    const updated = createForm.questions.filter((_, i) => i !== idx);
    setCreateForm({ ...createForm, questions: updated });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        
        {/* Cabecera del Modal */}
        <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-cyan-900/30">
              <ClipboardList className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                Sondeos & Encuestas Operativas
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800/80">
                  Nexus Surveys
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Canal de evaluación continua para optimización del puesto y clima laboral
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

        {/* Barra de Navegación de Pestañas */}
        <div className="px-6 py-2.5 bg-slate-950/40 border-b border-slate-800/80 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-2 text-xs font-semibold">
            <button
              onClick={() => { setActiveTab('available'); setFeedback(null); }}
              className={`px-3.5 py-1.5 rounded-xl transition-all flex items-center gap-2 ${
                activeTab === 'available'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-900/30 font-bold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <ClipboardList className="w-3.5 h-3.5" />
              <span>Encuestas Disponibles ({surveys.filter(s => s.status === 'active').length})</span>
            </button>

            {canManage && (
              <>
                <button
                  onClick={() => { setActiveTab('results'); setFeedback(null); }}
                  className={`px-3.5 py-1.5 rounded-xl transition-all flex items-center gap-2 ${
                    activeTab === 'results'
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-900/30 font-bold'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  <span>Resultados & Analítica</span>
                </button>

                <button
                  onClick={() => { setActiveTab('create'); setFeedback(null); }}
                  className={`px-3.5 py-1.5 rounded-xl transition-all flex items-center gap-2 ${
                    activeTab === 'create'
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md font-bold'
                      : 'text-slate-400 hover:text-emerald-300 hover:bg-slate-800/60'
                  }`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Crear Nueva Encuesta</span>
                </button>
              </>
            )}
          </div>

          <div className="text-[11px] font-mono text-slate-500 hidden sm:block">
            {surveys.filter(s => s.status === 'active' && !s.has_responded).length} pendiente(s) por responder
          </div>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div className={`mx-6 mt-4 p-3 rounded-2xl flex items-center gap-3 text-xs shrink-0 ${
            feedback.type === 'success' 
              ? 'bg-emerald-950/80 border border-emerald-800/80 text-emerald-300' 
              : 'bg-rose-950/80 border border-rose-800/80 text-rose-300'
          }`}>
            {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" /> : <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />}
            <span className="font-medium">{feedback.text}</span>
          </div>
        )}

        {/* Cuerpo del Modal con Scroll */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* ══════════ PESTAÑA 1: ENCUESTAS DISPONIBLES / RESPONDER ══════════ */}
          {activeTab === 'available' && (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              
              {/* Lista lateral de encuestas */}
              <div className="md:col-span-5 space-y-3">
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Listado de Sondeos Activos
                </div>
                
                {surveys.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 bg-slate-950/40 rounded-2xl border border-slate-800">
                    No hay encuestas activas en este momento.
                  </div>
                ) : (
                  surveys.map((s) => {
                    const isSelected = selectedSurvey?.id === s.id;
                    return (
                      <div
                        key={s.id}
                        onClick={() => { setSelectedSurvey(s); setFeedback(null); }}
                        className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-blue-950/40 border-blue-600/80 shadow-lg shadow-blue-950/50'
                            : 'bg-slate-950/40 border-slate-800 hover:border-slate-700 hover:bg-slate-800/30'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                            {s.category}
                          </span>
                          <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                            s.has_responded
                              ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800/80'
                              : 'bg-amber-950/80 text-amber-300 border-amber-800/80 animate-pulse'
                          }`}>
                            {s.has_responded ? '● RESPONDIDA' : '● PENDIENTE'}
                          </span>
                        </div>
                        
                        <h4 className="text-sm font-bold text-white line-clamp-2">{s.title}</h4>
                        <p className="text-xs text-slate-400 line-clamp-2 mt-1">{s.description}</p>
                        
                        <div className="flex items-center justify-between text-[11px] text-slate-500 mt-3 pt-2 border-t border-slate-800/60">
                          <span>{s.questions.length} preguntas</span>
                          <span>{s.total_responses} respuestas</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Formulario de Respuesta / Detalle */}
              <div className="md:col-span-7">
                {selectedSurvey ? (
                  <div className="p-6 rounded-3xl bg-slate-950/60 border border-slate-800 space-y-6">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold text-cyan-400 font-mono uppercase tracking-wider">
                          {selectedSurvey.category}
                        </span>
                        <span className="text-slate-600">·</span>
                        <span className="text-xs text-slate-500">Por {selectedSurvey.created_by_name}</span>
                      </div>
                      <h3 className="text-lg font-extrabold text-white">{selectedSurvey.title}</h3>
                      <p className="text-xs text-slate-400 mt-1">{selectedSurvey.description}</p>
                    </div>

                    {selectedSurvey.has_responded && (
                      <div className="p-3.5 rounded-2xl bg-emerald-950/50 border border-emerald-800/60 flex items-center gap-3 text-xs text-emerald-300">
                        <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                        <div>
                          <strong>Ya has completado esta encuesta.</strong> Puedes modificar tus respuestas si lo consideras necesario.
                        </div>
                      </div>
                    )}

                    {/* Preguntas */}
                    <div className="space-y-5 pt-2">
                      {selectedSurvey.questions.map((q: any, qIdx: number) => {
                        const currentVal = answersState[q.id] ?? (selectedSurvey.user_response?.answers?.[q.id] || '');

                        return (
                          <div key={q.id} className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-3">
                            <label className="block text-xs font-bold text-slate-200">
                              <span className="text-cyan-400 font-mono mr-2">{qIdx + 1}.</span>
                              {q.title}
                              {q.required && <span className="text-rose-400 ml-1">*</span>}
                            </label>

                            {/* TIPO: RATING (1 A 5 ESTRELLAS) */}
                            {q.type === 'rating' && (
                              <div className="flex items-center gap-2 pt-1">
                                {[1, 2, 3, 4, 5].map((starVal) => {
                                  const isSelected = Number(currentVal) === starVal;
                                  return (
                                    <button
                                      key={starVal}
                                      type="button"
                                      onClick={() => setAnswersState({ ...answersState, [q.id]: starVal })}
                                      className={`h-10 w-11 rounded-xl flex flex-col items-center justify-center font-bold text-xs transition-all ${
                                        isSelected
                                          ? 'bg-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/30 scale-105'
                                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                                      }`}
                                    >
                                      <Star className={`w-3.5 h-3.5 ${isSelected ? 'fill-slate-950' : 'text-slate-400'}`} />
                                      <span className="text-[10px] mt-0.5">{starVal}</span>
                                    </button>
                                  );
                                })}
                                <span className="text-[11px] text-slate-500 ml-2">
                                  {currentVal ? `Puntaje: ${currentVal}/5` : 'Seleccione de 1 a 5'}
                                </span>
                              </div>
                            )}

                            {/* TIPO: SELECCIÓN MÚLTIPLE */}
                            {q.type === 'choice' && (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                                {(q.options || []).map((opt: string) => {
                                  const isSelected = currentVal === opt;
                                  return (
                                    <button
                                      key={opt}
                                      type="button"
                                      onClick={() => setAnswersState({ ...answersState, [q.id]: opt })}
                                      className={`p-3 rounded-xl text-left text-xs transition-all border ${
                                        isSelected
                                          ? 'bg-blue-600/20 border-blue-500 text-white font-bold shadow-md'
                                          : 'bg-slate-950/40 border-slate-800 text-slate-300 hover:bg-slate-800/40'
                                      }`}
                                    >
                                      <div className="flex items-center justify-between">
                                        <span>{opt}</span>
                                        {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />}
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            )}

                            {/* TIPO: TEXTO ABIERTO */}
                            {q.type === 'text' && (
                              <textarea
                                rows={3}
                                value={currentVal}
                                onChange={(e) => setAnswersState({ ...answersState, [q.id]: e.target.value })}
                                placeholder="Escriba aquí su retroalimentación, ideas o sugerencias..."
                                className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <div className="pt-2 flex items-center justify-end">
                      <button
                        type="button"
                        onClick={() => handleSubmitResponse(selectedSurvey.id)}
                        disabled={submitting || selectedSurvey.status !== 'active'}
                        className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-bold text-xs shadow-lg shadow-blue-900/30 flex items-center gap-2 transition-all disabled:opacity-50"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>{submitting ? 'Enviando...' : (selectedSurvey.has_responded ? 'Actualizar mi Respuesta' : 'Registrar mi Evaluación')}</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-12 text-center text-slate-500 bg-slate-950/40 rounded-3xl border border-slate-800">
                    Seleccione una encuesta del panel lateral para responderla.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══════════ PESTAÑA 2: RESULTADOS & ANALÍTICA (ADMINS / COORD) ══════════ */}
          {activeTab === 'results' && canManage && (
            <div className="space-y-6">
              {/* Selector de Encuesta para ver resultados */}
              <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-slate-950/60 border border-slate-800">
                <div className="flex items-center gap-3">
                  <BarChart3 className="w-5 h-5 text-blue-400" />
                  <span className="text-xs font-bold text-white">Visualizar Resultados de:</span>
                  <select
                    value={selectedSurvey?.id || ''}
                    onChange={(e) => {
                      const found = surveys.find(s => s.id === e.target.value);
                      if (found) setSelectedSurvey(found);
                    }}
                    className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    {surveys.map(s => (
                      <option key={s.id} value={s.id}>{s.title} ({s.total_responses} respuestas)</option>
                    ))}
                  </select>
                </div>

                {selectedSurvey && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleStatus(selectedSurvey.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all ${
                        selectedSurvey.status === 'active'
                          ? 'bg-rose-950/40 border-rose-800 text-rose-300 hover:bg-rose-900/40'
                          : 'bg-emerald-950/40 border-emerald-800 text-emerald-300 hover:bg-emerald-900/40'
                      }`}
                    >
                      {selectedSurvey.status === 'active' ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                      <span>{selectedSurvey.status === 'active' ? 'Cerrar Encuesta' : 'Reactivar Encuesta'}</span>
                    </button>
                  </div>
                )}
              </div>

              {selectedSurvey ? (
                <div className="space-y-6">
                  {/* Tarjetas de Resumen Numérico */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800">
                      <span className="text-[10px] font-mono uppercase text-slate-400">Total de Respuestas</span>
                      <div className="text-2xl font-black text-white mt-1">{selectedSurvey.total_responses}</div>
                      <span className="text-[11px] text-emerald-400 font-medium">Personal verificado</span>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800">
                      <span className="text-[10px] font-mono uppercase text-slate-400">Estado del Sondeo</span>
                      <div className="text-2xl font-black text-white mt-1 flex items-center gap-2">
                        <span className={`inline-block w-3 h-3 rounded-full ${selectedSurvey.status === 'active' ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                        {selectedSurvey.status === 'active' ? 'Abierta' : 'Concluida'}
                      </div>
                      <span className="text-[11px] text-slate-400">Expira: {new Date(selectedSurvey.expires_at).toLocaleDateString()}</span>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800">
                      <span className="text-[10px] font-mono uppercase text-slate-400">Audiencia Objetivo</span>
                      <div className="text-lg font-bold text-cyan-300 mt-1">Analistas & Supervisores</div>
                      <span className="text-[11px] text-slate-400">Puestos generales de sala</span>
                    </div>
                  </div>

                  {/* Detalle por Pregunta */}
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                      Desglose Estadístico por Pregunta
                    </h4>

                    {selectedSurvey.questions.map((q: any, idx: number) => {
                      const avg = selectedSurvey.analytics?.avg_ratings?.[q.id];
                      const breakdown = selectedSurvey.analytics?.choice_breakdown?.[q.id];

                      return (
                        <div key={q.id} className="p-4 rounded-2xl bg-slate-950/40 border border-slate-800 space-y-3">
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-xs font-bold text-white">
                              <span className="text-blue-400 font-mono mr-2">{idx + 1}.</span>
                              {q.title}
                            </span>
                            {avg !== undefined && (
                              <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-xl bg-amber-950/80 text-amber-300 border border-amber-800/80 flex items-center gap-1 shrink-0">
                                <Star className="w-3.5 h-3.5 fill-amber-300 text-amber-300" />
                                {avg} / 5.0
                              </span>
                            )}
                          </div>

                          {/* Barras de porcentaje para Opción Múltiple */}
                          {breakdown && (
                            <div className="space-y-2 pt-1">
                              {Object.entries(breakdown).map(([opt, count]: [string, any]) => {
                                const total = selectedSurvey.total_responses || 1;
                                const pct = Math.round((count / total) * 100);
                                return (
                                  <div key={opt} className="space-y-1">
                                    <div className="flex justify-between text-xs text-slate-300">
                                      <span>{opt}</span>
                                      <span className="font-mono text-slate-400">{count} ({pct}%)</span>
                                    </div>
                                    <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                                      <div
                                        className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full transition-all duration-500"
                                        style={{ width: `${pct}%` }}
                                      />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Comentarios y Sugerencias de Texto Abierto */}
                  {selectedSurvey.analytics?.recent_feedback && selectedSurvey.analytics.recent_feedback.length > 0 && (
                    <div className="space-y-3 pt-2">
                      <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                        <MessageSquare className="w-4 h-4 text-cyan-400" />
                        Retroalimentación Cualitativa del Personal
                      </h4>

                      <div className="space-y-2.5">
                        {selectedSurvey.analytics.recent_feedback.map((fb: any, fbIdx: number) => (
                          <div key={fbIdx} className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 text-xs">
                            <div className="flex items-center justify-between text-slate-400 text-[11px] mb-1">
                              <span className="font-semibold text-slate-300">{fb.author} ({fb.role})</span>
                              <span className="font-mono">{new Date(fb.date).toLocaleDateString()}</span>
                            </div>
                            <p className="text-slate-200 italic">"{fb.comment}"</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-8 text-center text-slate-500 bg-slate-950/40 rounded-2xl border border-slate-800">
                  No hay encuestas seleccionadas.
                </div>
              )}
            </div>
          )}

          {/* ══════════ PESTAÑA 3: CREAR NUEVA ENCUESTA (ADMINS / COORD) ══════════ */}
          {activeTab === 'create' && canManage && (
            <form onSubmit={handleCreateSurvey} className="max-w-2xl mx-auto space-y-5">
              <div className="p-4 rounded-2xl bg-cyan-950/30 border border-cyan-800/60 flex items-center gap-3 text-xs text-cyan-300">
                <Sparkles className="w-5 h-5 text-cyan-400 shrink-0" />
                <span>
                  Las encuestas creadas se emitirán con notificación institucional dirigida al personal general (Analistas y Supervisores).
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Título de la Encuesta *
                </label>
                <input
                  type="text"
                  required
                  value={createForm.title}
                  onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                  placeholder="Ej. Sondeo de Satisfacción con Terminales Telefónicos — Turno Tarde"
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Categoría
                  </label>
                  <select
                    value={createForm.category}
                    onChange={(e) => setCreateForm({ ...createForm, category: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  >
                    <option value="Clima Laboral & Puesto">Clima Laboral & Puesto</option>
                    <option value="Telefonía & Discador">Telefonía & Discador Briana</option>
                    <option value="Asistencia & Seguridad">Asistencia & Seguridad Asys</option>
                    <option value="Gestión & Analítica">Gestión & Analítica Oriana</option>
                    <option value="Capacitación & Rendición">Capacitación & JADE Planificación</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Días de Vigencia
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={createForm.expires_days}
                    onChange={(e) => setCreateForm({ ...createForm, expires_days: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Descripción / Instrucciones
                </label>
                <textarea
                  rows={2}
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  placeholder="Explique el objetivo del sondeo o las instrucciones para los colaboradores..."
                  className="w-full p-3 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
              </div>

              {/* Lista de preguntas del constructor */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Preguntas del Sondeo ({createForm.questions.length})
                  </label>
                  <div className="flex items-center gap-1.5 text-xs">
                    <button
                      type="button"
                      onClick={() => addQuestion('rating')}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 font-semibold flex items-center gap-1"
                    >
                      <Star className="w-3 h-3" /> + Escala (1-5)
                    </button>
                    <button
                      type="button"
                      onClick={() => addQuestion('choice')}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-blue-300 font-semibold flex items-center gap-1"
                    >
                      <ClipboardList className="w-3 h-3" /> + Opciones
                    </button>
                    <button
                      type="button"
                      onClick={() => addQuestion('text')}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-300 font-semibold flex items-center gap-1"
                    >
                      <MessageSquare className="w-3 h-3" /> + Abierta
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  {createForm.questions.map((q, idx) => (
                    <div key={q.id || idx} className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-mono text-cyan-400 font-bold">
                          #{idx + 1} [{q.type === 'rating' ? 'Escala 1-5' : (q.type === 'choice' ? 'Selección Múltiple' : 'Texto Libre')}]
                        </span>
                        {createForm.questions.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeQuestion(idx)}
                            className="p-1 text-slate-500 hover:text-rose-400 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      <input
                        type="text"
                        required
                        value={q.title}
                        onChange={(e) => {
                          const updated = [...createForm.questions];
                          updated[idx].title = e.target.value;
                          setCreateForm({ ...createForm, questions: updated });
                        }}
                        placeholder="Redacte la pregunta..."
                        className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                      />

                      {q.type === 'choice' && (
                        <div className="space-y-1.5 pl-2 pt-1">
                          <span className="text-[10px] text-slate-400 font-mono">Opciones separadas por coma:</span>
                          <input
                            type="text"
                            value={(q.options || []).join(', ')}
                            onChange={(e) => {
                              const updated = [...createForm.questions];
                              updated[idx].options = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                              setCreateForm({ ...createForm, questions: updated });
                            }}
                            className="w-full px-3 py-1 bg-slate-900 border border-slate-700 rounded-lg text-[11px] text-slate-300"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setActiveTab('available')}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-md disabled:opacity-50"
                >
                  {submitting ? 'Publicando...' : 'Publicar Encuesta para el Personal'}
                </button>
              </div>
            </form>
          )}

        </div>
      </div>
    </div>
  );
}
