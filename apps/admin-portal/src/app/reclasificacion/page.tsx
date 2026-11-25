'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { 
  ArrowLeft, CheckCircle2, AlertCircle, Clock, Check, 
  RotateCcw, ChevronRight, ChevronLeft, User, Building2, 
  Phone, Hash, ShieldCheck, Sparkles, Filter, 
  BarChart3, RefreshCw, Send, Users, Layers, Award
} from 'lucide-react';

interface ReclasificacionRecord {
  id: number;
  lote_id: string;
  n_fila: number;
  modo: string;
  estado_geo: string;
  municipio: string;
  parroquia: string;
  correlativo: string;
  status_original: string;
  nuevo_status: string | null;
  codigo_situr: string | null;
  codigo_cne: string | null;
  nombre_obpp: string | null;
  responsable_nombre: string | null;
  cedula: string | null;
  telefono: string | null;
  codigo_incidencia: string | null;
  descripcion_detallada: string | null;
  institucion_responsable: string | null;
  tipo_accion: string | null;
  categoria: string | null;
  subcategoria: string | null;
  rama_area: string | null;
  nueva_rama_area: string | null;
  asignado_a_usuario: string | null;
  clasificado_por: string | null;
  observaciones: string | null;
  estado_revision: 'pendiente' | 'verificado' | 'corregido' | 'descartado' | 'duda';
}

interface SummaryData {
  lotes: any[];
  totals: {
    total: number;
    verificados: number;
    pendientes: number;
    pctGlobal: number;
  };
  leaderboard: Array<{
    operator: string;
    total: number;
    verificado: number;
    pendiente: number;
    pct: number;
  }>;
}

const RAMAS_AREAS_VALIDAS = [
  'Agua',
  'Electricidad',
  'Vialidad, Asfaltado y Puentes',
  'Salud',
  'Educación',
  'Gas Comunal',
  'Telecomunicaciones',
  'Seguridad Ciudadana',
  'Vivienda y Hábitat',
  'Desechos Sólidos / Aseo',
  'Social / Atención al Ciudadano',
  'Transporte público',
  'Alimentación / CLAP',
  'Otra Rama / General',
];

const STATUS_OPCIONES = [
  { value: 'Solucionado', label: 'Solucionado', color: 'emerald' },
  { value: 'En Proceso', label: 'En Proceso', color: 'blue' },
  { value: 'Pendiente', label: 'Pendiente', color: 'amber' },
  { value: 'No Aplica', label: 'No Aplica / Desestimado', color: 'slate' },
  { value: 'Duplicado', label: 'Duplicado', color: 'rose' },
];

const SNIPPETS_OBSERVACION = [
  'Se verificó contacto con el ciudadano afectado.',
  'Institución competente atendió y solventó la solicitud.',
  'Se corrige rama y tipificación por discrepancia técnica.',
  'Número telefónico apagado o no responde tras varios intentos.',
  'Caso derivado a inspección técnica en terreno.',
];

export default function ReclasificacionPage() {
  const [activeTab, setActiveTab] = useState<'triage' | 'admin'>('triage');
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [records, setRecords] = useState<ReclasificacionRecord[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Formulario de edición para el caso activo
  const [selectedStatus, setSelectedStatus] = useState<string>('Solucionado');
  const [selectedRama, setSelectedRama] = useState<string>('');
  const [observaciones, setObservaciones] = useState<string>('');

  // Repartición admin
  const [repartirOps, setRepartirOps] = useState<string>('marisela,valeska,daniela,diego,brando');
  const [repartiendo, setRepartiendo] = useState<boolean>(false);

  // 1. Cargar cola de triage
  const fetchQueue = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/reclasificacion?action=my_queue');
      const data = await res.json();
      if (data.success && data.records) {
        setRecords(data.records);
        setCurrentIndex(0);
        if (data.records.length > 0) {
          const first = data.records[0];
          setSelectedStatus(first.nuevo_status || first.status_original || 'Solucionado');
          setSelectedRama(first.nueva_rama_area || first.rama_area || 'Agua');
          setObservaciones(first.observaciones || '');
        }
      }
    } catch (err) {
      console.error('Error fetching queue:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // 2. Cargar resumen admin
  const fetchSummary = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/reclasificacion?action=summary');
      const data = await res.json();
      if (data.success) {
        setSummary(data);
      }
    } catch (err) {
      console.error('Error fetching summary:', err);
    }
  }, []);

  useEffect(() => {
    fetchQueue();
    fetchSummary();
  }, [fetchQueue, fetchSummary]);

  // Actualizar formulario al cambiar de índice
  const currentRecord = records[currentIndex];

  useEffect(() => {
    if (currentRecord) {
      setSelectedStatus(currentRecord.nuevo_status || currentRecord.status_original || 'Solucionado');
      setSelectedRama(currentRecord.nueva_rama_area || currentRecord.rama_area || 'Agua');
      setObservaciones(currentRecord.observaciones || '');
    }
  }, [currentIndex, currentRecord]);

  // Guardar y avanzar
  const handleSaveAndNext = async (markStatus: 'verificado' | 'descartado' = 'verificado') => {
    if (!currentRecord) return;
    setSaving(true);
    setFeedbackMsg(null);

    try {
      const payload = {
        id: currentRecord.id,
        nuevo_status: selectedStatus,
        nueva_rama_area: selectedRama,
        observaciones: observaciones.trim(),
        estado_revision: markStatus,
      };

      const res = await fetch('/api/admin/reclasificacion', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        setFeedbackMsg({ text: `✅ Caso #${currentRecord.id} guardado correctamente.`, type: 'success' });

        // Actualizar registro en memoria
        const updated = [...records];
        updated[currentIndex] = {
          ...updated[currentIndex],
          nuevo_status: selectedStatus,
          nueva_rama_area: selectedRama,
          observaciones,
          estado_revision: markStatus,
        };
        setRecords(updated);

        // Avanzar al siguiente si existe
        if (currentIndex < records.length - 1) {
          setCurrentIndex(prev => prev + 1);
        } else {
          setFeedbackMsg({ text: '🎉 ¡Has completado todos los casos asignados en esta cola!', type: 'success' });
          fetchSummary();
        }
      } else {
        setFeedbackMsg({ text: data.error || 'Error al guardar caso', type: 'error' });
      }
    } catch (err: any) {
      setFeedbackMsg({ text: err.message || 'Error de conexión', type: 'error' });
    } finally {
      setSaving(false);
      setTimeout(() => setFeedbackMsg(null), 3500);
    }
  };

  // Atajos de teclado (Ctrl + Enter = Guardar)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSaveAndNext('verificado');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentRecord, selectedStatus, selectedRama, observaciones]);

  // Ejecutar repartición equitativa
  const handleRepartir = async () => {
    if (!summary?.lotes || summary.lotes.length === 0) return;
    const loteId = summary.lotes[0].id;
    const opsList = repartirOps.split(',').map(s => s.trim()).filter(Boolean);
    if (opsList.length === 0) return;

    setRepartiendo(true);
    try {
      const res = await fetch('/api/admin/reclasificacion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'repartir',
          lote_id: loteId,
          operators: opsList,
        }),
      });
      const data = await res.json();
      if (data.success) {
        alert(`Repartición exitosa: ${data.result?.records_assigned || 0} casos asignados entre ${opsList.length} operadores.`);
        fetchQueue();
        fetchSummary();
      } else {
        alert(`Error: ${data.error || 'No se pudo repartir'}`);
      }
    } catch (err: any) {
      alert(`Error de conexión: ${err.message}`);
    } finally {
      setRepartiendo(false);
    }
  };

  const completedInBatch = records.filter(r => r.estado_revision === 'verificado').length;
  const progressPct = records.length > 0 ? Math.round((completedInBatch / records.length) * 100) : 0;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* HEADER DE CONTROL */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-xl border-b border-slate-800 px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all flex items-center gap-2 text-xs font-semibold"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Lobby Nexus</span>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
              <h1 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                Reclasificación & Triage de Incidencias
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-950/80 text-amber-300 border border-amber-800/60 font-bold">
                  MODAL BRANDO DEV
                </span>
              </h1>
            </div>
            <p className="text-xs text-slate-400">
              Revisión ágil sin bloqueo de Excel • Asignación atómica de casos
            </p>
          </div>
        </div>

        {/* PESTAÑAS DE VISTA */}
        <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-2xl border border-slate-800 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('triage')}
            className={`px-4 py-2 rounded-xl flex items-center gap-2 transition-all ${
              activeTab === 'triage'
                ? 'bg-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            Mi Cola de Triage ({records.length})
          </button>
          <button
            onClick={() => { setActiveTab('admin'); fetchSummary(); }}
            className={`px-4 py-2 rounded-xl flex items-center gap-2 transition-all ${
              activeTab === 'admin'
                ? 'bg-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            Control & Distribución
          </button>
        </div>
      </header>

      {/* FEEDBACK NOTIFICATION */}
      {feedbackMsg && (
        <div className={`fixed top-20 right-6 z-50 px-4 py-3 rounded-2xl border text-xs font-bold shadow-2xl flex items-center gap-2 transition-all animate-bounce ${
          feedbackMsg.type === 'success' 
            ? 'bg-emerald-950 text-emerald-300 border-emerald-800' 
            : 'bg-rose-950 text-rose-300 border-rose-800'
        }`}>
          {feedbackMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          <span>{feedbackMsg.text}</span>
        </div>
      )}

      {/* MAIN CONTAINER */}
      <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full">
        {activeTab === 'triage' ? (
          /* ==============================================================
             VISTA 1: COLA DE TRIAGE RÁPIDO (CARD BY CARD)
             ============================================================== */
          <div className="space-y-6">
            {/* BARRA DE PROGRESO */}
            <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <div className="h-10 w-10 rounded-xl bg-amber-950/80 border border-amber-800/60 flex items-center justify-center text-amber-400 font-bold text-sm">
                  {records.length > 0 ? currentIndex + 1 : 0}
                </div>
                <div>
                  <span className="text-xs font-mono text-slate-400 block">
                    Caso Activo de tu Cola: <strong className="text-white">{currentIndex + 1} de {records.length}</strong>
                  </span>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-emerald-400 font-semibold">{completedInBatch} completados</span>
                    <span className="text-slate-600">•</span>
                    <span className="text-xs text-amber-400 font-semibold">{records.length - completedInBatch} restantes</span>
                  </div>
                </div>
              </div>

              {/* Progress visual bar */}
              <div className="w-full sm:w-64 space-y-1.5">
                <div className="flex justify-between text-[11px] font-mono text-slate-400">
                  <span>Avance del Lote</span>
                  <span className="text-amber-400 font-bold">{progressPct}%</span>
                </div>
                <div className="w-full bg-slate-950 rounded-full h-2.5 overflow-hidden border border-slate-800">
                  <div 
                    className="bg-gradient-to-r from-amber-500 to-emerald-400 h-full rounded-full transition-all duration-300"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>

              {/* Controles de Navegación */}
              <div className="flex items-center gap-1.5">
                <button
                  disabled={currentIndex === 0}
                  onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 disabled:hover:bg-slate-800 transition-all"
                  title="Caso Anterior"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  disabled={currentIndex >= records.length - 1}
                  onClick={() => setCurrentIndex(prev => Math.min(records.length - 1, prev + 1))}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 disabled:hover:bg-slate-800 transition-all"
                  title="Siguiente Caso"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  onClick={fetchQueue}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all ml-2"
                  title="Recargar Cola"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {loading ? (
              <div className="py-24 text-center space-y-4">
                <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-sm font-mono text-slate-400">Cargando lote de incidencias para triage...</p>
              </div>
            ) : !currentRecord ? (
              <div className="py-24 text-center bg-slate-900/40 rounded-3xl border border-slate-800 p-8 space-y-4">
                <CheckCircle2 className="w-16 h-16 text-emerald-400 mx-auto" />
                <h3 className="text-lg font-bold text-white">¡No hay casos pendientes asignados!</h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Has completado todos los registros asignados o aún no se han distribuido casos a tu usuario.
                  Puedes repartir el lote desde la pestaña de control.
                </p>
                <button
                  onClick={() => setActiveTab('admin')}
                  className="px-5 py-2.5 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs"
                >
                  Ir al Tablero de Distribución
                </button>
              </div>
            ) : (
              /* THE TRIAGE CARD */
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* COLUMNA IZQUIERDA: DETALLE DEL REPORTE ORIGINAL (7 COLS) */}
                <div className="lg:col-span-7 bg-slate-900/60 rounded-3xl border border-slate-800 p-6 space-y-5">
                  {/* Badges de cabecera */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2.5 py-1 rounded-lg bg-blue-950/80 text-blue-400 border border-blue-800/60 font-mono text-xs font-bold">
                        {currentRecord.estado_geo || 'EDO'}
                      </span>
                      <span className="px-2.5 py-1 rounded-lg bg-indigo-950/80 text-indigo-300 border border-indigo-800/60 font-mono text-xs">
                        {currentRecord.municipio} • {currentRecord.parroquia}
                      </span>
                      <span className="px-2.5 py-1 rounded-lg bg-slate-950 text-slate-400 border border-slate-800 font-mono text-xs">
                        Correlativo: {currentRecord.correlativo || 'S/C'}
                      </span>
                    </div>
                    <span className={`px-2.5 py-1 rounded-lg font-mono text-xs font-bold border ${
                      currentRecord.estado_revision === 'verificado'
                        ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                        : 'bg-amber-950 text-amber-300 border-amber-800'
                    }`}>
                      {currentRecord.estado_revision === 'verificado' ? '✓ REVISADO' : '● PENDIENTE'}
                    </span>
                  </div>

                  {/* Datos del Ciudadano y Comunidad */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-950/80 rounded-2xl p-4 border border-slate-800/80 text-xs">
                    <div className="space-y-1">
                      <span className="text-[10px] uppercase font-mono text-slate-500 font-bold block">Ciudadano / Afectado</span>
                      <p className="font-semibold text-white flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-amber-400" />
                        {currentRecord.responsable_nombre || 'No especificado'}
                      </p>
                      <p className="text-slate-400 font-mono">
                        C.I. {currentRecord.cedula || 'N/A'} • Tlf: {currentRecord.telefono || 'Sin teléfono'}
                      </p>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] uppercase font-mono text-slate-500 font-bold block">Comuna / OBPP</span>
                      <p className="font-semibold text-white flex items-center gap-1.5 truncate">
                        <Building2 className="w-3.5 h-3.5 text-indigo-400" />
                        {currentRecord.nombre_obpp || 'No especificada'}
                      </p>
                      <p className="text-slate-400 font-mono truncate">
                        SITUR: {currentRecord.codigo_situr || 'N/A'}
                      </p>
                    </div>
                  </div>

                  {/* Descripción del Problema */}
                  <div className="space-y-2">
                    <span className="text-[10px] uppercase font-mono text-slate-400 font-bold block">
                      Descripción Detallada del Problema
                    </span>
                    <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-slate-300 leading-relaxed font-sans whitespace-pre-wrap max-h-56 overflow-y-auto selection:bg-amber-500/30 selection:text-amber-200">
                      {currentRecord.descripcion_detallada || 'Sin descripción en el reporte original.'}
                    </div>
                  </div>

                  {/* Metadata de Origen */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] font-mono text-slate-400">
                    <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/60">
                      <span className="text-[9px] uppercase text-slate-500 block">Institución Asignada</span>
                      <span className="text-slate-300 font-semibold truncate block mt-0.5">
                        {currentRecord.institucion_responsable || 'N/A'}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/60">
                      <span className="text-[9px] uppercase text-slate-500 block">Rama Original</span>
                      <span className="text-amber-300 font-semibold truncate block mt-0.5">
                        {currentRecord.rama_area || 'Sin área'}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/60">
                      <span className="text-[9px] uppercase text-slate-500 block">Status Origen</span>
                      <span className="text-sky-300 font-semibold truncate block mt-0.5">
                        {currentRecord.status_original || 'Pendiente'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* COLUMNA DERECHA: FORMULARIO DE RECLASIFICACIÓN Y DECISIÓN (5 COLS) */}
                <div className="lg:col-span-5 bg-slate-900/80 rounded-3xl border border-slate-800 p-6 flex flex-col justify-between space-y-6 shadow-2xl">
                  <div className="space-y-5">
                    <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-amber-400" />
                        Ajuste de Tipificación & Triage
                      </h3>
                      <span className="text-[10px] font-mono text-slate-500">ID #{currentRecord.id}</span>
                    </div>

                    {/* 1. Nuevo Estatus */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-300 block">1. Estatus Verificado:</label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {STATUS_OPCIONES.map(st => (
                          <button
                            key={st.value}
                            type="button"
                            onClick={() => setSelectedStatus(st.value)}
                            className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all text-center ${
                              selectedStatus === st.value
                                ? 'bg-amber-500 text-slate-950 border-amber-400 font-black shadow-md'
                                : 'bg-slate-950/80 text-slate-300 border-slate-800 hover:border-slate-700'
                            }`}
                          >
                            {st.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 2. Nueva Rama / Área */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-300 block">2. Rama / Área Correcta:</label>
                      <select
                        value={selectedRama}
                        onChange={(e) => setSelectedRama(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-400 transition-all font-mono"
                      >
                        {RAMAS_AREAS_VALIDAS.map(rama => (
                          <option key={rama} value={rama} className="bg-slate-900 text-white">
                            {rama}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* 3. Observaciones / Justificación */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-300">3. Observaciones del Triage:</label>
                        <span className="text-[10px] text-slate-500 font-mono">Plantillas rápidas abajo</span>
                      </div>
                      <textarea
                        rows={3}
                        value={observaciones}
                        onChange={(e) => setObservaciones(e.target.value)}
                        placeholder="Escribe la justificación del cambio o comentarios de contacto..."
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-400 transition-all font-sans"
                      />

                      {/* Snippets rápidos */}
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {SNIPPETS_OBSERVACION.map((snip, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setObservaciones(prev => prev ? `${prev} ${snip}` : snip)}
                            className="px-2 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-amber-200 text-[10px] transition-all truncate max-w-full"
                          >
                            + {snip}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* BOTONES DE ACCIÓN INFERIORES */}
                  <div className="pt-4 border-t border-slate-800 space-y-2">
                    <button
                      disabled={saving}
                      onClick={() => handleSaveAndNext('verificado')}
                      className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-amber-950/40 flex items-center justify-center gap-2 transition-all active:scale-[0.99] disabled:opacity-50"
                    >
                      {saving ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Guardando...</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4 stroke-[3]" />
                          <span>Guardar y Siguiente (Ctrl + Enter)</span>
                        </>
                      )}
                    </button>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => handleSaveAndNext('descartado')}
                        className="py-2.5 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/40 text-[11px] font-bold transition-all text-center"
                      >
                        Descartar / Duplicado
                      </button>
                      <button
                        type="button"
                        onClick={() => setCurrentIndex(prev => Math.min(records.length - 1, prev + 1))}
                        className="py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold transition-all text-center"
                      >
                        Saltar por Ahora ⏭️
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* ==============================================================
             VISTA 2: TABLERO DE CONTROL & GESTIÓN DE LOTES
             ============================================================== */
          <div className="space-y-8">
            {/* KPI CARDS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-xs font-mono uppercase text-slate-400">Total Casos en Lotes</span>
                  <div className="text-2xl font-black text-white mt-1">
                    {summary?.totals.total.toLocaleString() || '0'}
                  </div>
                  <span className="text-[10px] text-slate-500">Cargados en Supabase</span>
                </div>
                <div className="h-12 w-12 rounded-xl bg-indigo-950 border border-indigo-800/60 flex items-center justify-center text-indigo-400">
                  <Layers className="w-6 h-6" />
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-xs font-mono uppercase text-emerald-400">Reclasificados / Verificados</span>
                  <div className="text-2xl font-black text-emerald-300 mt-1">
                    {summary?.totals.verificados.toLocaleString() || '0'}
                  </div>
                  <span className="text-[10px] text-slate-500">Casos auditados</span>
                </div>
                <div className="h-12 w-12 rounded-xl bg-emerald-950 border border-emerald-800/60 flex items-center justify-center text-emerald-400">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-xs font-mono uppercase text-amber-400">Pendientes por Revisar</span>
                  <div className="text-2xl font-black text-amber-300 mt-1">
                    {summary?.totals.pendientes.toLocaleString() || '0'}
                  </div>
                  <span className="text-[10px] text-slate-500">En colas de operadores</span>
                </div>
                <div className="h-12 w-12 rounded-xl bg-amber-950 border border-amber-800/60 flex items-center justify-center text-amber-400">
                  <Clock className="w-6 h-6" />
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-xs font-mono uppercase text-sky-400">Eficacia Global</span>
                  <div className="text-2xl font-black text-sky-300 mt-1">
                    {summary?.totals.pctGlobal || 0}%
                  </div>
                  <span className="text-[10px] text-slate-500">Porcentaje de completitud</span>
                </div>
                <div className="h-12 w-12 rounded-xl bg-sky-950 border border-sky-800/60 flex items-center justify-center text-sky-400">
                  <Award className="w-6 h-6" />
                </div>
              </div>
            </div>

            {/* HERRAMIENTA DE REPARTICIÓN AUTOMÁTICA */}
            <div className="p-6 rounded-3xl bg-slate-900/70 border border-slate-800 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Users className="w-4 h-4 text-amber-400" />
                    Repartición Equitativa de Lote entre Operadores
                  </h3>
                  <p className="text-xs text-slate-400">
                    Divide automáticamente los casos pendientes del lote activo en partes iguales entre los operadores indicados.
                  </p>
                </div>
                <button
                  disabled={repartiendo}
                  onClick={handleRepartir}
                  className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  <span>{repartiendo ? 'Repartiendo...' : 'Ejecutar Repartición Atómica'}</span>
                </button>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 block">
                  Lista de Operadores (separados por coma):
                </label>
                <input
                  type="text"
                  value={repartirOps}
                  onChange={(e) => setRepartirOps(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white font-mono focus:border-amber-400 focus:outline-none"
                  placeholder="ej: marisela, valeska, daniela, diego, brando"
                />
                <span className="text-[10px] text-slate-500 font-mono block">
                  Los registros se asignan atómicamente con la función PL/pgSQL <code className="text-amber-400">nexus_repartir_reclasificacion</code> para evitar colisiones.
                </span>
              </div>
            </div>

            {/* TABLA DE LEADERBOARD POR OPERADOR */}
            <div className="bg-slate-900/70 rounded-3xl border border-slate-800 overflow-hidden space-y-0">
              <div className="p-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
                <h4 className="text-xs font-bold text-white uppercase font-mono tracking-wider flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-emerald-400" />
                  Progreso por Operador / Reclasificador
                </h4>
                <button
                  onClick={fetchSummary}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all text-xs flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Actualizar</span>
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-[10px] font-mono text-slate-400 uppercase bg-slate-950/60">
                      <th className="p-3.5">Operador / Asignado</th>
                      <th className="p-3.5 text-center">Total Asignados</th>
                      <th className="p-3.5 text-center text-emerald-400">Revisados</th>
                      <th className="p-3.5 text-center text-amber-400">Pendientes</th>
                      <th className="p-3.5 text-right">Porcentaje Avance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {summary?.leaderboard && summary.leaderboard.length > 0 ? (
                      summary.leaderboard.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                          <td className="p-3.5 font-bold text-white flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-amber-400" />
                            {row.operator}
                          </td>
                          <td className="p-3.5 text-center font-mono text-slate-300">{row.total}</td>
                          <td className="p-3.5 text-center font-mono text-emerald-400 font-bold">{row.verificado}</td>
                          <td className="p-3.5 text-center font-mono text-amber-400">{row.pendiente}</td>
                          <td className="p-3.5 text-right font-mono">
                            <div className="flex items-center justify-end gap-2">
                              <span className="font-bold text-white">{row.pct}%</span>
                              <div className="w-20 bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                                <div 
                                  className="bg-emerald-400 h-full rounded-full" 
                                  style={{ width: `${row.pct}%` }}
                                />
                              </div>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="p-6 text-center text-slate-500 font-mono">
                          No hay datos de distribución cargados aún.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
