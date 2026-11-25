'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { 
  ArrowLeft, Vote, AlertTriangle, ShieldCheck, 
  Clock, RefreshCw, Save, CheckCircle2, Building, 
  MapPin, Check, Plus, Filter, Download
} from 'lucide-react';

interface MunicipioRow {
  id: string;
  estado: string;
  municipio: string;
  centros_totales: number;
  centros_activos_8am: number;
  mesas_totales: number;
  mesas_activas: number;
  h9: number;
  h10: number;
  h11: number;
  h12: number;
  h13: number;
  h14: number;
  h15: number;
  h16: number;
  h17: number;
  h20: number;
  condominios_movilizados: number;
  votantes_condominios: number;
}

interface EstadoSummary {
  estado: string;
  municipiosCount: number;
  centrosTotales: number;
  centrosActivos: number;
  mesasTotales: number;
  mesasActivas: number;
  votosTotales: number;
  condominios: number;
  eficaciaCentros: number;
  eficaciaMesas: number;
}

interface IncidenciaRow {
  id: string;
  estado: string;
  municipio: string;
  centro_nombre: string | null;
  categoria: string;
  descripcion: string;
  usuario_reportador: string;
  status: string;
  created_at: string;
}

const CATEGORIAS_INCIDENCIA = [
  'Máquina / Sistema CNE con falla',
  'Falta de fluido eléctrico en el centro',
  'Retraso en instalación de mesa',
  'Ausencia de miembros de mesa / testigos',
  'Conectividad / Telecomunicaciones caídas',
  'Orden Público / Alteración externa',
  'Logística / Transporte de electores',
  'Otra incidencia técnica',
];

export default function EleccionesPage() {
  const [activeTab, setActiveTab] = useState<'monitor' | 'incidencias'>('monitor');
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedEstado, setSelectedEstado] = useState<string>('ARAGUA');
  const [estados, setEstados] = useState<EstadoSummary[]>([]);
  const [municipios, setMunicipios] = useState<MunicipioRow[]>([]);
  const [nacional, setNacional] = useState<any>(null);
  const [incidencias, setIncidencias] = useState<IncidenciaRow[]>([]);
  
  // Edición de fila
  const [editedRows, setEditedRows] = useState<Record<string, Partial<MunicipioRow>>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Formulario nueva incidencia
  const [showIncModal, setShowIncModal] = useState<boolean>(false);
  const [newInc, setNewInc] = useState({
    municipio: '',
    centro: '',
    categoria: CATEGORIAS_INCIDENCIA[0],
    descripcion: '',
  });

  // 1. Cargar resumen nacional y lista de municipios del estado
  const fetchData = useCallback(async (estadoName: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/elecciones?action=summary&estado=${encodeURIComponent(estadoName)}`);
      const data = await res.json();
      if (data.success) {
        setNacional(data.nacional);
        setEstados(data.estados || []);
        setMunicipios(data.municipios || []);
        setEditedRows({});
      }
    } catch (err) {
      console.error('Error fetching elecciones data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // 2. Cargar incidencias
  const fetchIncidencias = useCallback(async (estadoName?: string) => {
    try {
      const url = estadoName 
        ? `/api/admin/elecciones?action=incidencias&estado=${encodeURIComponent(estadoName)}`
        : '/api/admin/elecciones?action=incidencias';
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setIncidencias(data.incidencias || []);
      }
    } catch (err) {
      console.error('Error fetching incidencias:', err);
    }
  }, []);

  useEffect(() => {
    fetchData(selectedEstado);
    fetchIncidencias(selectedEstado);
  }, [selectedEstado, fetchData, fetchIncidencias]);

  // Manejar cambio de input en una celda
  const handleCellChange = (id: string, field: keyof MunicipioRow, value: number) => {
    setEditedRows(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value,
      },
    }));
  };

  // Guardar fila individual
  const handleSaveRow = async (row: MunicipioRow) => {
    setSavingId(row.id);
    const changes = editedRows[row.id] || {};
    const payload = {
      action: 'save_municipio',
      id: row.id,
      centros_activos_8am: changes.centros_activos_8am !== undefined ? changes.centros_activos_8am : row.centros_activos_8am,
      mesas_activas: changes.mesas_activas !== undefined ? changes.mesas_activas : row.mesas_activas,
      h9: changes.h9 !== undefined ? changes.h9 : row.h9,
      h10: changes.h10 !== undefined ? changes.h10 : row.h10,
      h11: changes.h11 !== undefined ? changes.h11 : row.h11,
      h12: changes.h12 !== undefined ? changes.h12 : row.h12,
      h13: changes.h13 !== undefined ? changes.h13 : row.h13,
      h14: changes.h14 !== undefined ? changes.h14 : row.h14,
      h15: changes.h15 !== undefined ? changes.h15 : row.h15,
      h16: changes.h16 !== undefined ? changes.h16 : row.h16,
      h17: changes.h17 !== undefined ? changes.h17 : row.h17,
      h20: changes.h20 !== undefined ? changes.h20 : row.h20,
      condominios_movilizados: changes.condominios_movilizados !== undefined ? changes.condominios_movilizados : row.condominios_movilizados,
      votantes_condominios: changes.votantes_condominios !== undefined ? changes.votantes_condominios : row.votantes_condominios,
    };

    try {
      const res = await fetch('/api/admin/elecciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        setFeedbackMsg({ text: `✓ Municipio ${row.municipio} guardado.`, type: 'success' });
        // Limpiar cambios editados para esta fila
        setEditedRows(prev => {
          const next = { ...prev };
          delete next[row.id];
          return next;
        });
        // Actualizar fila en estado local
        setMunicipios(prev => prev.map(m => m.id === row.id ? { ...m, ...changes } : m));
      } else {
        setFeedbackMsg({ text: data.error || 'Error al guardar fila', type: 'error' });
      }
    } catch (err: any) {
      setFeedbackMsg({ text: err.message || 'Error de conexión', type: 'error' });
    } finally {
      setSavingId(null);
      setTimeout(() => setFeedbackMsg(null), 3000);
    }
  };

  // Guardar todos los cambios pendientes del estado
  const handleSaveAll = async () => {
    const keys = Object.keys(editedRows);
    if (keys.length === 0) {
      alert('No hay cambios pendientes por guardar.');
      return;
    }

    setSavingId('ALL');
    let successCount = 0;

    for (const id of keys) {
      const row = municipios.find(m => m.id === id);
      if (!row) continue;
      const changes = editedRows[id] || {};
      const payload = {
        action: 'save_municipio',
        id: row.id,
        centros_activos_8am: changes.centros_activos_8am !== undefined ? changes.centros_activos_8am : row.centros_activos_8am,
        mesas_activas: changes.mesas_activas !== undefined ? changes.mesas_activas : row.mesas_activas,
        h9: changes.h9 !== undefined ? changes.h9 : row.h9,
        h10: changes.h10 !== undefined ? changes.h10 : row.h10,
        h11: changes.h11 !== undefined ? changes.h11 : row.h11,
        h12: changes.h12 !== undefined ? changes.h12 : row.h12,
        h13: changes.h13 !== undefined ? changes.h13 : row.h13,
        h14: changes.h14 !== undefined ? changes.h14 : row.h14,
        h15: changes.h15 !== undefined ? changes.h15 : row.h15,
        h16: changes.h16 !== undefined ? changes.h16 : row.h16,
        h17: changes.h17 !== undefined ? changes.h17 : row.h17,
        h20: changes.h20 !== undefined ? changes.h20 : row.h20,
        condominios_movilizados: changes.condominios_movilizados !== undefined ? changes.condominios_movilizados : row.condominios_movilizados,
        votantes_condominios: changes.votantes_condominios !== undefined ? changes.votantes_condominios : row.votantes_condominios,
      };

      try {
        await fetch('/api/admin/elecciones', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        successCount++;
      } catch (e) {
        console.error('Error saving row batch:', e);
      }
    }

    setSavingId(null);
    setEditedRows({});
    setFeedbackMsg({ text: `🎉 ${successCount} municipios guardados con éxito en Supabase.`, type: 'success' });
    fetchData(selectedEstado);
    setTimeout(() => setFeedbackMsg(null), 3500);
  };

  // Crear reporte de incidencia
  const handleCreateIncidencia = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInc.municipio || !newInc.descripcion) {
      alert('Municipio y descripción son obligatorios.');
      return;
    }

    try {
      const res = await fetch('/api/admin/elecciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_incidencia',
          estado: selectedEstado,
          municipio: newInc.municipio,
          centro_nombre: newInc.centro,
          categoria: newInc.categoria,
          descripcion: newInc.descripcion,
        }),
      });
      const data = await res.json();
      if (data.success) {
        alert('Incidencia electoral registrada exitosamente.');
        setShowIncModal(false);
        setNewInc({ municipio: '', centro: '', categoria: CATEGORIAS_INCIDENCIA[0], descripcion: '' });
        fetchIncidencias(selectedEstado);
      } else {
        alert(data.error || 'Error al reportar');
      }
    } catch (err: any) {
      alert(err.message || 'Error de conexión');
    }
  };

  // Calcular totales del estado actual
  const currentEstadoSummary = estados.find(e => e.estado === selectedEstado);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* HEADER DE SALA NACIONAL */}
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
              <span className="h-2.5 w-2.5 rounded-full bg-cyan-400 animate-pulse" />
              <h1 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                Sala Nacional Electoral | Command Center
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800/60 font-bold">
                  MODAL BRANDO DEV
                </span>
              </h1>
            </div>
            <p className="text-xs text-slate-400">
              Monitoreo y reporte por franjas horarias • Conexión directa Supabase
            </p>
          </div>
        </div>

        {/* PESTAÑAS Y ACCIONES */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-slate-950 p-1.5 rounded-2xl border border-slate-800 text-xs font-semibold">
            <button
              onClick={() => setActiveTab('monitor')}
              className={`px-4 py-2 rounded-xl flex items-center gap-2 transition-all ${
                activeTab === 'monitor'
                  ? 'bg-cyan-500 text-slate-950 font-black shadow-lg shadow-cyan-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Vote className="w-4 h-4" />
              Monitor Estadal
            </button>
            <button
              onClick={() => setActiveTab('incidencias')}
              className={`px-4 py-2 rounded-xl flex items-center gap-2 transition-all ${
                activeTab === 'incidencias'
                  ? 'bg-cyan-500 text-slate-950 font-black shadow-lg shadow-cyan-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
              Incidencias ({incidencias.length})
            </button>
          </div>

          <button
            onClick={() => fetchData(selectedEstado)}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all"
            title="Refrescar datos"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* FEEDBACK TOAST */}
      {feedbackMsg && (
        <div className={`fixed top-20 right-6 z-50 px-4 py-3 rounded-2xl border text-xs font-bold shadow-2xl flex items-center gap-2 animate-bounce ${
          feedbackMsg.type === 'success' 
            ? 'bg-emerald-950 text-emerald-300 border-emerald-800' 
            : 'bg-rose-950 text-rose-300 border-rose-800'
        }`}>
          {feedbackMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          <span>{feedbackMsg.text}</span>
        </div>
      )}

      {/* CONTENIDO PRINCIPAL */}
      <main className="flex-1 p-4 md:p-6 max-w-[1600px] mx-auto w-full space-y-6">
        {/* KPI TICKER NACIONAL */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
            <span className="text-[10px] uppercase font-mono text-slate-400 block font-bold">Total Centros Nac.</span>
            <span className="text-xl font-black text-white block mt-1">
              {nacional?.totalCentros?.toLocaleString() || '14,231'}
            </span>
            <span className="text-[10px] text-slate-500">335 Municipios</span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
            <span className="text-[10px] uppercase font-mono text-blue-400 block font-bold">Centros Activos 8AM</span>
            <span className="text-xl font-black text-blue-300 block mt-1">
              {nacional?.totalCentrosActivos?.toLocaleString() || '0'}
            </span>
            <span className="text-[10px] text-blue-500 font-mono">{nacional?.eficaciaCentros || 0}% Eficacia</span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
            <span className="text-[10px] uppercase font-mono text-rose-400 block font-bold">Total Mesas Nac.</span>
            <span className="text-xl font-black text-rose-300 block mt-1">
              {nacional?.totalMesas?.toLocaleString() || '30,026'}
            </span>
            <span className="text-[10px] text-slate-500">Padrón Electoral</span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
            <span className="text-[10px] uppercase font-mono text-emerald-400 block font-bold">Mesas Instaladas</span>
            <span className="text-xl font-black text-emerald-300 block mt-1">
              {nacional?.totalMesasActivas?.toLocaleString() || '0'}
            </span>
            <span className="text-[10px] text-emerald-500 font-mono">{nacional?.eficaciaMesas || 0}% Eficacia</span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
            <span className="text-[10px] uppercase font-mono text-cyan-400 block font-bold">Votos Reportados</span>
            <span className="text-xl font-black text-cyan-300 block mt-1">
              {nacional?.totalVotos?.toLocaleString() || '0'}
            </span>
            <span className="text-[10px] text-slate-500">Acumulado 9 franjas</span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
            <span className="text-[10px] uppercase font-mono text-amber-400 block font-bold">Condominios</span>
            <span className="text-xl font-black text-amber-300 block mt-1">
              {nacional?.totalCondominios?.toLocaleString() || '0'}
            </span>
            <span className="text-[10px] text-slate-500">Movilizados a votar</span>
          </div>
        </div>

        {activeTab === 'monitor' ? (
          /* ==============================================================
             VISTA 1: MONITOR ESTADAL & CARGA DE HORAS
             ============================================================== */
          <div className="space-y-4">
            {/* SELECTOR DE ESTADO & BOTÓN GUARDAR TODO */}
            <div className="bg-slate-900/70 rounded-2xl border border-slate-800 p-4 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs font-bold text-white uppercase font-mono">Seleccionar Estado:</span>
                </div>
                <select
                  value={selectedEstado}
                  onChange={(e) => setSelectedEstado(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-xs font-bold text-cyan-300 focus:outline-none focus:border-cyan-400 font-mono"
                >
                  {estados.map(est => (
                    <option key={est.estado} value={est.estado} className="bg-slate-900 text-white">
                      {est.estado} ({est.municipiosCount} Mpios)
                    </option>
                  ))}
                </select>

                {currentEstadoSummary && (
                  <div className="flex items-center gap-3 text-xs font-mono text-slate-400 bg-slate-950/80 px-3 py-1.5 rounded-xl border border-slate-800">
                    <span>Centros: <strong className="text-white">{currentEstadoSummary.centrosActivos}/{currentEstadoSummary.centrosTotales}</strong> ({currentEstadoSummary.eficaciaCentros}%)</span>
                    <span>•</span>
                    <span>Mesas: <strong className="text-white">{currentEstadoSummary.mesasActivas}/{currentEstadoSummary.mesasTotales}</strong> ({currentEstadoSummary.eficaciaMesas}%)</span>
                  </div>
                )}
              </div>

              {/* Acciones */}
              <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                {Object.keys(editedRows).length > 0 && (
                  <span className="text-xs font-mono text-amber-400 animate-pulse font-bold">
                    ● {Object.keys(editedRows).length} municipios modificados
                  </span>
                )}
                <button
                  disabled={savingId === 'ALL'}
                  onClick={handleSaveAll}
                  className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs transition-all flex items-center gap-2 shadow-lg shadow-cyan-500/20 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{savingId === 'ALL' ? 'Guardando...' : 'Guardar Todo el Estado'}</span>
                </button>
              </div>
            </div>

            {/* TABLA DE CARGA ELECTORAL */}
            <div className="bg-slate-900/60 rounded-3xl border border-slate-800 overflow-hidden shadow-2xl">
              <div className="overflow-x-auto max-h-[68vh]">
                <table className="w-full text-left border-collapse min-w-[1400px] text-xs">
                  {/* Encabezados Agrupados */}
                  <thead>
                    <tr className="border-b border-slate-800 text-[10px] font-mono uppercase bg-slate-950 text-slate-400">
                      <th rowSpan={2} className="p-3 sticky left-0 bg-slate-950 z-20 border-r border-slate-800 w-48">
                        Municipio
                      </th>
                      <th colSpan={3} className="p-2 text-center bg-blue-950/40 text-blue-300 border-r border-slate-800 font-bold">
                        Centros Electorales 8:00 AM
                      </th>
                      <th colSpan={3} className="p-2 text-center bg-rose-950/40 text-rose-300 border-r border-slate-800 font-bold">
                        Mesas de Votación
                      </th>
                      <th colSpan={10} className="p-2 text-center bg-slate-900 text-cyan-300 border-r border-slate-800 font-bold">
                        Votos por Franjas Horarias
                      </th>
                      <th colSpan={2} className="p-2 text-center bg-amber-950/40 text-amber-300 border-r border-slate-800 font-bold">
                        Condominios
                      </th>
                      <th rowSpan={2} className="p-3 text-center w-24">Acción</th>
                    </tr>
                    <tr className="border-b border-slate-800 text-[10px] font-mono uppercase bg-slate-950/90 text-slate-400">
                      {/* Centros */}
                      <th className="p-2 text-center border-r border-slate-800/60 w-16">Total</th>
                      <th className="p-2 text-center border-r border-slate-800/60 w-16 text-blue-300">Activos</th>
                      <th className="p-2 text-center border-r border-slate-800/60 w-16">% Efic.</th>
                      {/* Mesas */}
                      <th className="p-2 text-center border-r border-slate-800/60 w-16">Total</th>
                      <th className="p-2 text-center border-r border-slate-800/60 w-16 text-rose-300">Activas</th>
                      <th className="p-2 text-center border-r border-slate-800/60 w-16">% Efic.</th>
                      {/* Horas */}
                      <th className="p-2 text-center border-r border-slate-800/60 w-16">9:00A</th>
                      <th className="p-2 text-center border-r border-slate-800/60 w-16">10:00A</th>
                      <th className="p-2 text-center border-r border-slate-800/60 w-16">11:00A</th>
                      <th className="p-2 text-center border-r border-slate-800/60 w-16">12:00M</th>
                      <th className="p-2 text-center border-r border-slate-800/60 w-16">1:00P</th>
                      <th className="p-2 text-center border-r border-slate-800/60 w-16">2:00P</th>
                      <th className="p-2 text-center border-r border-slate-800/60 w-16">3:00P</th>
                      <th className="p-2 text-center border-r border-slate-800/60 w-16">4:00P</th>
                      <th className="p-2 text-center border-r border-slate-800/60 w-16">5:00P</th>
                      <th className="p-2 text-center border-r border-slate-800/60 w-16">6-8P</th>
                      {/* Condominios */}
                      <th className="p-2 text-center border-r border-slate-800/60 w-20">Movilizados</th>
                      <th className="p-2 text-center border-r border-slate-800/60 w-20">Votantes</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {loading ? (
                      <tr>
                        <td colSpan={20} className="p-12 text-center text-slate-500">
                          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-cyan-400" />
                          <span>Cargando municipios de {selectedEstado}...</span>
                        </td>
                      </tr>
                    ) : municipios.length === 0 ? (
                      <tr>
                        <td colSpan={20} className="p-12 text-center text-slate-500">
                          No se encontraron municipios para este estado.
                        </td>
                      </tr>
                    ) : (
                      municipios.map((row) => {
                        const edits = editedRows[row.id] || {};
                        const centrosActivos = edits.centros_activos_8am !== undefined ? edits.centros_activos_8am : row.centros_activos_8am;
                        const mesasActivas = edits.mesas_activas !== undefined ? edits.mesas_activas : row.mesas_activas;
                        const eficCentros = row.centros_totales > 0 ? Math.round((centrosActivos / row.centros_totales) * 100) : 0;
                        const eficMesas = row.mesas_totales > 0 ? Math.round((mesasActivas / row.mesas_totales) * 100) : 0;
                        const isEdited = !!editedRows[row.id];

                        return (
                          <tr key={row.id} className={`hover:bg-slate-800/30 transition-colors ${isEdited ? 'bg-cyan-950/20' : ''}`}>
                            {/* Municipio */}
                            <td className="p-2.5 font-bold text-white sticky left-0 bg-slate-900 border-r border-slate-800">
                              <span className="truncate block font-sans text-xs">{row.municipio}</span>
                            </td>

                            {/* Centros Totales & Activos */}
                            <td className="p-2 text-center text-slate-400 border-r border-slate-800/60">{row.centros_totales}</td>
                            <td className="p-1 border-r border-slate-800/60">
                              <input
                                type="number"
                                min="0"
                                max={row.centros_totales}
                                value={centrosActivos}
                                onChange={(e) => handleCellChange(row.id, 'centros_activos_8am', parseInt(e.target.value || '0', 10))}
                                className="w-16 bg-slate-950 border border-slate-800 rounded px-1.5 py-1 text-center text-blue-300 font-bold focus:border-blue-400 focus:outline-none"
                              />
                            </td>
                            <td className={`p-2 text-center font-bold border-r border-slate-800/60 ${eficCentros >= 90 ? 'text-emerald-400' : 'text-amber-400'}`}>
                              {eficCentros}%
                            </td>

                            {/* Mesas Totales & Activas */}
                            <td className="p-2 text-center text-slate-400 border-r border-slate-800/60">{row.mesas_totales}</td>
                            <td className="p-1 border-r border-slate-800/60">
                              <input
                                type="number"
                                min="0"
                                max={row.mesas_totales}
                                value={mesasActivas}
                                onChange={(e) => handleCellChange(row.id, 'mesas_activas', parseInt(e.target.value || '0', 10))}
                                className="w-16 bg-slate-950 border border-slate-800 rounded px-1.5 py-1 text-center text-rose-300 font-bold focus:border-rose-400 focus:outline-none"
                              />
                            </td>
                            <td className={`p-2 text-center font-bold border-r border-slate-800/60 ${eficMesas >= 90 ? 'text-emerald-400' : 'text-amber-400'}`}>
                              {eficMesas}%
                            </td>

                            {/* Franjas Horarias (9A a 6-8P) */}
                            {(['h9', 'h10', 'h11', 'h12', 'h13', 'h14', 'h15', 'h16', 'h17', 'h20'] as Array<keyof MunicipioRow>).map((hourKey) => {
                              const val = edits[hourKey] !== undefined ? edits[hourKey] : row[hourKey];
                              return (
                                <td key={hourKey} className="p-1 border-r border-slate-800/60">
                                  <input
                                    type="number"
                                    min="0"
                                    value={val as number}
                                    onChange={(e) => handleCellChange(row.id, hourKey, parseInt(e.target.value || '0', 10))}
                                    className="w-16 bg-slate-950 border border-slate-800 rounded px-1 py-1 text-center text-slate-200 focus:border-cyan-400 focus:outline-none"
                                  />
                                </td>
                              );
                            })}

                            {/* Condominios */}
                            <td className="p-1 border-r border-slate-800/60">
                              <input
                                type="number"
                                min="0"
                                value={edits.condominios_movilizados !== undefined ? edits.condominios_movilizados : row.condominios_movilizados}
                                onChange={(e) => handleCellChange(row.id, 'condominios_movilizados', parseInt(e.target.value || '0', 10))}
                                className="w-18 bg-slate-950 border border-slate-800 rounded px-1 py-1 text-center text-amber-300 focus:border-amber-400 focus:outline-none"
                              />
                            </td>
                            <td className="p-1 border-r border-slate-800/60">
                              <input
                                type="number"
                                min="0"
                                value={edits.votantes_condominios !== undefined ? edits.votantes_condominios : row.votantes_condominios}
                                onChange={(e) => handleCellChange(row.id, 'votantes_condominios', parseInt(e.target.value || '0', 10))}
                                className="w-18 bg-slate-950 border border-slate-800 rounded px-1 py-1 text-center text-amber-300 focus:border-amber-400 focus:outline-none"
                              />
                            </td>

                            {/* Guardar individual */}
                            <td className="p-2 text-center">
                              <button
                                disabled={savingId === row.id}
                                onClick={() => handleSaveRow(row)}
                                className={`p-1.5 rounded-lg border text-xs transition-all ${
                                  isEdited
                                    ? 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 border-cyan-400 font-bold shadow-md'
                                    : 'bg-slate-800 hover:bg-slate-700 text-slate-400 border-slate-700'
                                }`}
                                title="Guardar Fila"
                              >
                                {savingId === row.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          /* ==============================================================
             VISTA 2: CENTRO DE INCIDENCIAS ELECTORALES
             ============================================================== */
          <div className="space-y-6">
            <div className="flex items-center justify-between bg-slate-900/70 p-4 rounded-2xl border border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                  Centro de Incidencias & Alertas en Centros Electorales
                </h3>
                <p className="text-xs text-slate-400">
                  Reportes de contingencia, fallas de máquinas y logística en tiempo real
                </p>
              </div>

              <button
                onClick={() => setShowIncModal(true)}
                className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition-all flex items-center gap-2 shadow-lg shadow-rose-950/40"
              >
                <Plus className="w-4 h-4" />
                <span>Emitir Reporte de Incidencia</span>
              </button>
            </div>

            {/* TABLA DE INCIDENCIAS */}
            <div className="bg-slate-900/60 rounded-3xl border border-slate-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-[10px] font-mono text-slate-400 uppercase bg-slate-950/60">
                      <th className="p-3.5">Fecha / Hora</th>
                      <th className="p-3.5">Estado / Municipio</th>
                      <th className="p-3.5">Centro Electoral</th>
                      <th className="p-3.5">Categoría de Falla</th>
                      <th className="p-3.5">Descripción Detallada</th>
                      <th className="p-3.5 text-center">Estatus</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-sans">
                    {incidencias.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-12 text-center text-slate-500 font-mono">
                          No hay incidencias reportadas activas en este estado.
                        </td>
                      </tr>
                    ) : (
                      incidencias.map((inc) => (
                        <tr key={inc.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="p-3.5 font-mono text-[11px] text-slate-400">
                            {new Date(inc.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="p-3.5 font-bold text-white">
                            {inc.estado} • {inc.municipio}
                          </td>
                          <td className="p-3.5 text-slate-300 font-medium">
                            {inc.centro_nombre || 'Centro no especificado'}
                          </td>
                          <td className="p-3.5">
                            <span className="px-2 py-1 rounded-lg bg-rose-950/60 text-rose-300 border border-rose-800/40 text-[11px] font-semibold">
                              {inc.categoria}
                            </span>
                          </td>
                          <td className="p-3.5 text-slate-300 max-w-md">
                            {inc.descripcion}
                          </td>
                          <td className="p-3.5 text-center">
                            <span className="px-2.5 py-1 rounded-full bg-amber-950 text-amber-300 border border-amber-800 font-mono text-[10px] font-bold">
                              {inc.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* MODAL CREAR INCIDENCIA */}
      {showIncModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                Registrar Incidencia Electoral
              </h3>
              <button
                onClick={() => setShowIncModal(false)}
                className="text-slate-400 hover:text-white text-xs font-mono"
              >
                ✕ Cerrar
              </button>
            </div>

            <form onSubmit={handleCreateIncidencia} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 font-mono block mb-1">Estado Seleccionado</label>
                <input
                  type="text"
                  disabled
                  value={selectedEstado}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-cyan-300 font-bold font-mono"
                />
              </div>

              <div>
                <label className="text-slate-400 font-mono block mb-1">Municipio *</label>
                <select
                  required
                  value={newInc.municipio}
                  onChange={(e) => setNewInc(prev => ({ ...prev, municipio: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono"
                >
                  <option value="">-- Seleccionar Municipio --</option>
                  {municipios.map(m => (
                    <option key={m.id} value={m.municipio}>{m.municipio}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-400 font-mono block mb-1">Nombre del Centro Electoral (Opcional)</label>
                <input
                  type="text"
                  value={newInc.centro}
                  onChange={(e) => setNewInc(prev => ({ ...prev, centro: e.target.value }))}
                  placeholder="ej: U.E. Nacional Simón Bolívar"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="text-slate-400 font-mono block mb-1">Categoría del Evento *</label>
                <select
                  value={newInc.categoria}
                  onChange={(e) => setNewInc(prev => ({ ...prev, categoria: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                >
                  {CATEGORIAS_INCIDENCIA.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-400 font-mono block mb-1">Descripción de la Contingencia *</label>
                <textarea
                  required
                  rows={3}
                  value={newInc.descripcion}
                  onChange={(e) => setNewInc(prev => ({ ...prev, descripcion: e.target.value }))}
                  placeholder="Detalla lo acontecido y las acciones requeridas..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowIncModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black"
                >
                  Registrar Alerta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
