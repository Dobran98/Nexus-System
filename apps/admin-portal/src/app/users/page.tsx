'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Users,
  UserPlus,
  Shield,
  KeyRound,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
  RotateCcw,
  AlertTriangle,
  ArrowLeft,
  RefreshCw,
  Mail,
  Phone,
  MapPin,
  Building,
  Lock,
  Sparkles,
  ChevronRight,
  Edit3,
  ShieldAlert,
  UserCheck,
  UserX,
  X,
  Award,
  Database,
  Trash2,
  Zap,
  BarChart2,
  Megaphone,
  Send
} from 'lucide-react';
import { NotificationCenter } from '@/components/NotificationCenter';

interface UserItem {
  id: string;
  email: string;
  full_name: string;
  document_id: string;
  phone_number: string;
  address: string;
  is_active: boolean;
  last_profile_edit_at: string | null;
  role_name: string;
  sub_rol: string;
  turno: string;
  institucion: string;
  legacy_username: string;
  extension?: string;
  areas_ids?: string[] | any;
  created_at: string;
  last_sign_in_at: string | null;
}

interface Stats {
  total: number;
  active: number;
  inactive: number;
  admins: number;
  supervisors: number;
  operators: number;
}

const ROLE_LABELS: Record<string, { label: string; badge: string }> = {
  superadmin: { label: 'SuperAdmin', badge: 'bg-purple-950/80 text-purple-300 border-purple-800/80' },
  module_admin: { label: 'Admin Módulo', badge: 'bg-blue-950/80 text-blue-300 border-blue-800/80' },
  supervisor: { label: 'Supervisor', badge: 'bg-amber-950/80 text-amber-300 border-amber-800/80' },
  multi_operator: { label: 'Operador', badge: 'bg-emerald-950/80 text-emerald-300 border-emerald-800/80' },
  data_analyst: { label: 'Analista Datos', badge: 'bg-cyan-950/80 text-cyan-300 border-cyan-800/80' },
  auditor: { label: 'Auditor', badge: 'bg-slate-800 text-slate-300 border-slate-700' },
};

const WORK_AREAS = [
  'Todas',
  'SALA DE CONFERENCIAS - P6',
  'SALA 2 - P5',
  'SALA 3 - P5',
  'SALA 4 - P5',
  'SALA VP'
];

export default function UsersManagementPage() {
  const router = useRouter();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, active: 0, inactive: 0, admins: 0, supervisors: 0, operators: 0 });
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [isCurrentUserSuperAdmin, setIsCurrentUserSuperAdmin] = useState(false);
  
  // Modales
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserItem | null>(null);
  const [passwordModalUser, setPasswordModalUser] = useState<UserItem | null>(null);
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Formulario de Creación
  const [createForm, setCreateForm] = useState({
    fullName: '',
    documentId: '',
    email: '',
    password: '',
    roleName: 'multi_operator',
    subRol: 'Operador/a',
    turno: 'Mañana',
    phoneNumber: '',
    address: '',
    institucion: '',
    extension: '',
    areas: ['Todas'],
  });

  // Estados Scoring Dinámico (Fase 11)
  const [isScoringOpen, setIsScoringOpen] = useState(false);
  const [scoringDate, setScoringDate] = useState('2026-11-23');
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [loadingScoring, setLoadingScoring] = useState(false);
  const [recalculating, setRecalculating] = useState(false);

  // Estados Ciclo de Vida & Purga 500MB (Fase 12)
  const [isLifecycleOpen, setIsLifecycleOpen] = useState(false);
  const [storageStats, setStorageStats] = useState<any>(null);
  const [loadingStorage, setLoadingStorage] = useState(false);
  const [purging, setPurging] = useState(false);
  const [purgeReport, setPurgeReport] = useState<any[] | null>(null);

  const fetchScoring = async (date: string) => {
    setLoadingScoring(true);
    try {
      const res = await fetch(`/api/admin/scoring?date=${date}`);
      const data = await res.json();
      if (data.success) {
        setLeaderboard(data.leaderboard || []);
      }
    } catch (e) {
      console.error('Error fetching scoring:', e);
    } finally {
      setLoadingScoring(false);
    }
  };

  const handleRecalculateScoring = async () => {
    setRecalculating(true);
    try {
      const res = await fetch('/api/admin/scoring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: scoringDate }),
      });
      const data = await res.json();
      if (data.success) {
        setFeedback({
          type: 'success',
          message: `Scoring Dinámico recalculado con éxito: ${data.result?.scores_calculated || 0} agentes evaluados.`
        });
        fetchScoring(scoringDate);
      }
    } catch (e: any) {
      setFeedback({ type: 'error', message: e.message || 'Error al recalcular scoring' });
    } finally {
      setRecalculating(false);
    }
  };

  const fetchStorageStats = async () => {
    setLoadingStorage(true);
    try {
      const res = await fetch('/api/admin/lifecycle');
      const data = await res.json();
      if (data.success) {
        setStorageStats(data.stats);
      }
    } catch (e) {
      console.error('Error fetching storage stats:', e);
    } finally {
      setLoadingStorage(false);
    }
  };

  const handleRunPurge = async (dryRun: boolean) => {
    setPurging(true);
    setPurgeReport(null);
    try {
      const res = await fetch('/api/admin/lifecycle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ retentionDays: 90, dryRun }),
      });
      const data = await res.json();
      if (data.success) {
        setPurgeReport(data.report || []);
        setFeedback({
          type: 'success',
          message: dryRun
            ? 'Simulación de purga ejecutada. Revisa el reporte en pantalla.'
            : 'Mantenimiento nocturno y purga de logs ejecutada satisfactoriamente.'
        });
        fetchStorageStats();
      }
    } catch (e: any) {
      setFeedback({ type: 'error', message: e.message || 'Error ejecutando ciclo de vida' });
    } finally {
      setPurging(false);
    }
  };

  // Formulario de Edición
  const [editForm, setEditForm] = useState({
    fullName: '',
    documentId: '',
    roleName: '',
    subRol: '',
    turno: 'Mañana',
    phoneNumber: '',
    address: '',
    institucion: '',
    isActive: true,
    resetCooldown: false,
    newPassword: '',
    extension: '',
    areas: ['Todas'],
  });

  // Estados para Emisión de Avisos / Broadcast
  const [isBroadcastOpen, setIsBroadcastOpen] = useState(false);
  const [broadcastForm, setBroadcastForm] = useState({
    titulo: '',
    descripcion: '',
    modulo: 'general',
    tipo: 'aviso',
    prioridad: 'media',
    target_type: 'global',
    target_email: '',
    target_role: 'multi_operator',
    popup: false,
    enlace: '/',
  });
  const [sendingBroadcast, setSendingBroadcast] = useState(false);

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastForm.titulo || !broadcastForm.descripcion) return;
    setSendingBroadcast(true);
    try {
      const res = await fetch('/api/notificaciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(broadcastForm),
      });
      const data = await res.json();
      if (data.success) {
        setFeedback({
          type: 'success',
          message: data.message || 'Aviso emitido y propagado en la plataforma.',
        });
        setIsBroadcastOpen(false);
        setBroadcastForm({
          titulo: '',
          descripcion: '',
          modulo: 'general',
          tipo: 'aviso',
          prioridad: 'media',
          target_type: 'global',
          target_email: '',
          target_role: 'multi_operator',
          popup: false,
          enlace: '/',
        });
      } else {
        throw new Error(data.error);
      }
    } catch (e: any) {
      setFeedback({ type: 'error', message: e.message || 'Error al emitir aviso' });
    } finally {
      setSendingBroadcast(false);
    }
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (roleFilter) params.append('role', roleFilter);
      if (statusFilter) params.append('status', statusFilter);

      const res = await fetch(`/api/admin/users?${params.toString()}`);
      if (res.status === 403 || res.status === 401) {
        setAuthorized(false);
        setLoading(false);
        return;
      }
      const data = await res.json();
      if (data.success) {
        setUsers(data.users || []);
        if (data.stats) setStats(data.stats);
        if (data.isSuperAdmin !== undefined) {
          setIsCurrentUserSuperAdmin(!!data.isSuperAdmin);
        }
      }
    } catch (err) {
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [roleFilter, statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchUsers();
  };

  // Abrir modal de edición
  const openEditModal = (u: UserItem) => {
    setEditUser(u);
    setEditForm({
      fullName: u.full_name || '',
      documentId: u.document_id || '',
      roleName: u.role_name || 'multi_operator',
      subRol: u.sub_rol || 'Operador/a',
      turno: u.turno || 'Mañana',
      phoneNumber: u.phone_number || '',
      address: u.address || '',
      institucion: u.institucion || '',
      isActive: u.is_active,
      resetCooldown: false,
      newPassword: '',
      extension: u.extension || '',
      areas: Array.isArray(u.areas_ids) ? u.areas_ids : ['Todas'],
    });
  };

  // Guardar nuevo usuario
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Error al registrar usuario');
      }

      setFeedback({ type: 'success', message: 'Usuario registrado y sincronizado en todos los módulos.' });
      setIsCreateOpen(false);
      setCreateForm({
        fullName: '',
        documentId: '',
        email: '',
        password: '',
        roleName: 'multi_operator',
        subRol: 'Operador/a',
        turno: 'Mañana',
        phoneNumber: '',
        address: '',
        institucion: '',
        extension: '',
        areas: ['Todas'],
      });
      fetchUsers();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setSaving(false);
    }
  };

  // Guardar edición de usuario
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUser) return;
    setSaving(true);
    setFeedback(null);

    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: editUser.id,
          ...editForm,
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Error al actualizar usuario');
      }

      setFeedback({ type: 'success', message: 'Datos de usuario actualizados correctamente.' });
      setEditUser(null);
      fetchUsers();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setSaving(false);
    }
  };

  // Cambio rápido de contraseña
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordModalUser) return;
    if (newPasswordInput.length < 6) {
      alert('La contraseña debe tener mínimo 6 caracteres');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: passwordModalUser.id,
          newPassword: newPasswordInput,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error);

      setFeedback({ type: 'success', message: `Contraseña actualizada para ${passwordModalUser.email}.` });
      setPasswordModalUser(null);
      setNewPasswordInput('');
    } catch (err: any) {
      alert(err.message || 'Error al resetear contraseña');
    } finally {
      setSaving(false);
    }
  };

  // Toggle rápido de estado (Activar / Suspender)
  const toggleUserStatus = async (u: UserItem) => {
    const action = u.is_active ? 'suspender' : 'activar';
    if (!confirm(`¿Desea ${action} el acceso de ${u.full_name} (${u.email})?`)) return;

    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: u.id,
          isActive: !u.is_active,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setFeedback({ type: 'success', message: `Estado de ${u.email} actualizado a ${!u.is_active ? 'Activo' : 'Suspendido'}.` });
        fetchUsers();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Liberar Cooldown de 7 días directamente
  const handleQuickReleaseCooldown = async (u: UserItem) => {
    if (!confirm(`¿Liberar la restricción de 7 días (cooldown) para que ${u.full_name} pueda volver a editar su perfil inmediatamente?`)) return;

    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: u.id,
          resetCooldown: true,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setFeedback({ type: 'success', message: `Cooldown de perfil liberado con éxito para ${u.full_name}.` });
        fetchUsers();
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (!authorized) {
    return (
      <main className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white text-center">
        <div className="h-20 w-20 rounded-3xl bg-rose-950/60 border border-rose-800/80 flex items-center justify-center text-rose-400 mb-6 shadow-2xl">
          <ShieldAlert className="w-10 h-10" />
        </div>
        <h1 className="text-3xl font-black font-mono tracking-tight mb-2">Acceso Restringido</h1>
        <p className="text-sm text-slate-400 max-w-md mb-6">
          Este módulo está reservado exclusivamente para Administradores de Plataforma y la Coordinación General de Nexus.
        </p>
        <Link
          href="/"
          className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 font-semibold text-xs tracking-wider uppercase transition-all shadow-lg shadow-blue-900/30"
        >
          Volver al Inicio
        </Link>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* ── BARRA SUPERIOR DE NAVEGACIÓN ── */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link
              href="/"
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 text-slate-300 text-xs font-medium transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Portal Nexus</span>
            </Link>
            <div className="h-5 w-px bg-slate-800" />
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <h1 className="text-sm font-bold tracking-tight text-white flex items-center gap-2">
                  Gestión Corporativa de Usuarios
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-800/60">
                    Gobierno RBAC
                  </span>
                </h1>
                <p className="text-[11px] text-slate-400">
                  Control centralizado de identidades, roles y credenciales
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2.5">
            <button
              onClick={() => {
                setIsScoringOpen(true);
                fetchScoring(scoringDate);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-950/40 hover:bg-amber-900/60 border border-amber-800/60 text-amber-300 font-bold text-xs transition-all cursor-pointer"
            >
              <Award className="w-4 h-4 text-amber-400" />
              <span>Scoring & FIT</span>
            </button>

            <button
              onClick={() => {
                setIsLifecycleOpen(true);
                fetchStorageStats();
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-purple-950/40 hover:bg-purple-900/60 border border-purple-800/60 text-purple-300 font-bold text-xs transition-all cursor-pointer"
            >
              <Database className="w-4 h-4 text-purple-400" />
              <span>Purga 500MB</span>
            </button>

            <button
              onClick={() => setIsBroadcastOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/60 text-rose-300 font-bold text-xs transition-all cursor-pointer"
            >
              <Megaphone className="w-4 h-4 text-rose-400" />
              <span>Emitir Aviso</span>
            </button>

            <NotificationCenter />
            <button
              onClick={() => setIsCreateOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-blue-900/30 transition-all cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>Nuevo Usuario</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── CUERPO PRINCIPAL ── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-1 space-y-6">
        
        {/* Notificaciones y Feedbacks */}
        {feedback && (
          <div className={`p-4 rounded-2xl border flex items-center justify-between text-xs animate-in fade-in ${
            feedback.type === 'success' 
              ? 'bg-emerald-950/60 border-emerald-800/80 text-emerald-300' 
              : 'bg-rose-950/60 border-rose-800/80 text-rose-300'
          }`}>
            <div className="flex items-center gap-2.5">
              {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> : <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />}
              <span>{feedback.message}</span>
            </div>
            <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ── TARJETAS DE MÉTRICAS (KPIS) ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Total Cuentas</span>
            <div className="text-2xl font-black font-mono text-white mt-1">{stats.total}</div>
            <span className="text-[10px] text-slate-500 mt-0.5 block">Registradas en Nexus</span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm">
            <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">Activas</span>
            <div className="text-2xl font-black font-mono text-emerald-300 mt-1">{stats.active}</div>
            <span className="text-[10px] text-slate-500 mt-0.5 block">Acceso concedido</span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm">
            <span className="text-[11px] font-semibold text-rose-400 uppercase tracking-wider">Suspendidas</span>
            <div className="text-2xl font-black font-mono text-rose-300 mt-1">{stats.inactive}</div>
            <span className="text-[10px] text-slate-500 mt-0.5 block">Acceso bloqueado</span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm">
            <span className="text-[11px] font-semibold text-purple-400 uppercase tracking-wider">Admins</span>
            <div className="text-2xl font-black font-mono text-purple-300 mt-1">{stats.admins}</div>
            <span className="text-[10px] text-slate-500 mt-0.5 block">{isCurrentUserSuperAdmin ? 'Superadmin & Admin' : 'Administradores'}</span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm">
            <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider">Supervisores</span>
            <div className="text-2xl font-black font-mono text-amber-300 mt-1">{stats.supervisors}</div>
            <span className="text-[10px] text-slate-500 mt-0.5 block">Gestión de salas</span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm">
            <span className="text-[11px] font-semibold text-cyan-400 uppercase tracking-wider">Operadores</span>
            <div className="text-2xl font-black font-mono text-cyan-300 mt-1">{stats.operators}</div>
            <span className="text-[10px] text-slate-500 mt-0.5 block">Telefonía y datos</span>
          </div>
        </div>

        {/* ── BARRA DE BÚSQUEDA Y FILTROS ── */}
        <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800/80 flex flex-col md:flex-row gap-3 items-center justify-between">
          <form onSubmit={handleSearchSubmit} className="relative w-full md:w-96">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por nombre, correo @impress, cédula..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
            />
          </form>

          <div className="flex items-center gap-2.5 w-full md:w-auto">
            {/* Filtro Rol */}
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-3 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Todos los Roles</option>
              {isCurrentUserSuperAdmin && <option value="superadmin">SuperAdmin</option>}
              <option value="module_admin">Admin Módulo</option>
              <option value="supervisor">Supervisor</option>
              <option value="multi_operator">Operador</option>
              <option value="data_analyst">Analista de Datos</option>
              <option value="auditor">Auditor</option>
            </select>

            {/* Filtro Estado */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Todos los Estados</option>
              <option value="active">Activos</option>
              <option value="inactive">Suspendidos</option>
            </select>

            <button
              onClick={fetchUsers}
              title="Recargar listado"
              className="p-2 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 text-slate-300 transition-all"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* ── TABLA DE USUARIOS ── */}
        <div className="rounded-2xl bg-slate-900/60 border border-slate-800/80 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/90 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3.5 px-4">Usuario / Identidad</th>
                  <th className="py-3.5 px-4">Rol & Cargo</th>
                  <th className="py-3.5 px-4">Extensión & Áreas</th>
                  <th className="py-3.5 px-4">Turno / Sede</th>
                  <th className="py-3.5 px-4">Estado</th>
                  <th className="py-3.5 px-4">Cooldown 7d</th>
                  <th className="py-3.5 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-500">
                      <div className="inline-flex items-center gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin text-blue-500" />
                        <span>Sincronizando identidades corporativas...</span>
                      </div>
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-500">
                      No se encontraron usuarios con los criterios especificados.
                    </td>
                  </tr>
                ) : (
                  users.map((u) => {
                    const roleInfo = ROLE_LABELS[u.role_name] || { label: u.role_name, badge: 'bg-slate-800 text-slate-300 border-slate-700' };
                    const hasCooldown = !!u.last_profile_edit_at;

                    return (
                      <tr key={u.id} className="hover:bg-slate-800/30 transition-colors">
                        {/* Identidad */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-600/30 to-indigo-600/30 border border-blue-500/30 flex items-center justify-center font-bold text-blue-300 font-mono text-xs uppercase shrink-0">
                              {u.full_name.substring(0, 2) || u.email.substring(0, 2)}
                            </div>
                            <div>
                              <div className="font-bold text-white text-sm flex items-center gap-2">
                                {u.full_name}
                                {u.email.includes('brando') && (
                                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-950 text-purple-300 border border-purple-800 font-mono">
                                    Founder
                                  </span>
                                )}
                              </div>
                              <div className="text-slate-400 text-xs flex items-center gap-1.5 mt-0.5">
                                <Mail className="w-3 h-3 text-slate-500" />
                                <span>{u.email}</span>
                                <span className="text-slate-600">|</span>
                                <span className="font-mono text-slate-400">{u.document_id}</span>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Rol y Cargo */}
                        <td className="py-3.5 px-4">
                          <div className="space-y-1">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border ${roleInfo.badge}`}>
                              {roleInfo.label}
                            </span>
                            <div className="text-[11px] text-slate-400 font-medium">
                              {u.sub_rol || 'Operador/a'}
                            </div>
                          </div>
                        </td>

                        {/* Extensión & Áreas */}
                        <td className="py-3.5 px-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-sky-400">
                              <Phone className="w-3 h-3 text-sky-500" />
                              <span>{u.extension ? `Ext. ${u.extension}` : 'Sin Ext.'}</span>
                            </div>
                            <div className="flex flex-wrap gap-1 max-w-[190px]">
                              {(Array.isArray(u.areas_ids) ? u.areas_ids : [u.areas_ids || 'Todas']).map((area: string, idx: number) => (
                                <span key={idx} className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 border border-slate-700 font-medium truncate max-w-[180px]">
                                  {area === 'Todas' ? '🌐 Todas las Salas' : area}
                                </span>
                              ))}
                            </div>
                          </div>
                        </td>

                        {/* Turno y Sede */}
                        <td className="py-3.5 px-4">
                          <div className="text-slate-300 font-medium">{u.turno || 'Mañana'}</div>
                          <div className="text-[10px] text-slate-500 truncate max-w-[150px]">
                            {u.institucion || 'Sede Central'}
                          </div>
                        </td>

                        {/* Estado */}
                        <td className="py-3.5 px-4">
                          {u.is_active ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-800/60">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                              Activo
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-rose-950/80 text-rose-400 border border-rose-800/60">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                              Suspendido
                            </span>
                          )}
                        </td>

                        {/* Cooldown 7d */}
                        <td className="py-3.5 px-4">
                          {hasCooldown ? (
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-950/60 text-amber-300 border border-amber-800/60">
                                🔒 7d Activo
                              </span>
                              <button
                                onClick={() => handleQuickReleaseCooldown(u)}
                                title="Liberar Cooldown de 7 días"
                                className="p-1 rounded bg-amber-900/30 hover:bg-amber-900/60 text-amber-400 transition-all"
                              >
                                <RotateCcw className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-500 font-mono">Libre</span>
                          )}
                        </td>

                        {/* Acciones */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              onClick={() => openEditModal(u)}
                              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[11px] font-medium transition-all"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => setPasswordModalUser(u)}
                              title="Resetear Contraseña"
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all"
                            >
                              <KeyRound className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => toggleUserStatus(u)}
                              title={u.is_active ? 'Suspender acceso' : 'Reactivar acceso'}
                              className={`p-1.5 rounded-lg border transition-all ${
                                u.is_active 
                                  ? 'bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 border-rose-800/50' 
                                  : 'bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-400 border-emerald-800/50'
                              }`}
                            >
                              {u.is_active ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      </main>

      {/* ── MODAL DE CREACIÓN DE NUEVO USUARIO ── */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-6 sm:p-8 space-y-6 relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="h-10 w-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white tracking-tight">Nuevo Usuario Corporativo</h2>
                  <p className="text-xs text-slate-400">Se registrará en Supabase Auth y sincronizará en todos los módulos</p>
                </div>
              </div>
              <button onClick={() => setIsCreateOpen(false)} className="text-slate-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">Nombre Completo *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Juan Pérez"
                    value={createForm.fullName}
                    onChange={(e) => setCreateForm({ ...createForm, fullName: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">Cédula / Documento *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. V-12345678"
                    value={createForm.documentId}
                    onChange={(e) => setCreateForm({ ...createForm, documentId: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">Correo @impress.com *</label>
                  <input
                    type="email"
                    required
                    placeholder="usuario@impress.com"
                    value={createForm.email}
                    onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">Contraseña Inicial *</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    placeholder="Mínimo 6 caracteres"
                    value={createForm.password}
                    onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">Rol de Plataforma *</label>
                  <select
                    value={createForm.roleName}
                    onChange={(e) => setCreateForm({ ...createForm, roleName: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="multi_operator">Operador Multifunción</option>
                    <option value="supervisor">Supervisor</option>
                    <option value="data_analyst">Analista de Datos</option>
                    <option value="module_admin">Administrador de Módulo</option>
                    {isCurrentUserSuperAdmin && <option value="superadmin">SuperAdmin</option>}
                    <option value="auditor">Auditor (Solo Lectura)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">Cargo / Sub-Rol</label>
                  <input
                    type="text"
                    placeholder="Ej. Coordinador General, Operador/a..."
                    value={createForm.subRol}
                    onChange={(e) => setCreateForm({ ...createForm, subRol: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">Turno</label>
                  <select
                    value={createForm.turno}
                    onChange={(e) => setCreateForm({ ...createForm, turno: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="Mañana">Mañana</option>
                    <option value="Tarde">Tarde</option>
                    <option value="Noche">Noche</option>
                    <option value="Mixto">Mixto</option>
                    <option value="COMPLETO">Completo</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">Teléfono</label>
                  <input
                    type="text"
                    placeholder="+58 412..."
                    value={createForm.phoneNumber}
                    onChange={(e) => setCreateForm({ ...createForm, phoneNumber: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">Extensión Telefónica (Briana)</label>
                  <input
                    type="text"
                    placeholder="Ej. 11001"
                    value={createForm.extension}
                    onChange={(e) => setCreateForm({ ...createForm, extension: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-sky-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">Institución / Dirección</label>
                <input
                  type="text"
                  placeholder="Ej. Sede Central Corporativa"
                  value={createForm.institucion}
                  onChange={(e) => setCreateForm({ ...createForm, institucion: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Áreas de Trabajo Asys & Oriana */}
              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                <span className="text-xs font-bold text-slate-200 block">
                  Áreas de Trabajo Autorizadas (Asys & Oriana)
                </span>
                <p className="text-[11px] text-slate-400">
                  Selecciona los espacios y salas donde este operador tiene autorización para marcar asistencia y operar.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                  {WORK_AREAS.map((area) => {
                    const isChecked = createForm.areas.includes(area);
                    return (
                      <label key={area} className="flex items-center gap-2 p-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 cursor-pointer text-xs">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (area === 'Todas') {
                              setCreateForm({
                                ...createForm,
                                areas: e.target.checked ? ['Todas'] : [],
                              });
                            } else {
                              const newAreas = isChecked
                                ? createForm.areas.filter((a) => a !== area && a !== 'Todas')
                                : [...createForm.areas.filter((a) => a !== 'Todas'), area];
                              setCreateForm({
                                ...createForm,
                                areas: newAreas.length === 0 ? ['Todas'] : newAreas,
                              });
                            }
                          }}
                          className="w-3.5 h-3.5 rounded text-blue-600 focus:ring-0 bg-slate-950 border-slate-700"
                        />
                        <span className={`text-[11px] truncate ${isChecked ? 'text-blue-300 font-semibold' : 'text-slate-400'}`}>
                          {area}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold shadow-lg shadow-blue-900/30"
                >
                  {saving ? 'Registrando...' : 'Registrar Usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL DE EDICIÓN DE USUARIO ── */}
      {editUser && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-6 sm:p-8 space-y-6 relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="h-10 w-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white tracking-tight">Editar Usuario</h2>
                  <p className="text-xs text-slate-400">{editUser.email}</p>
                </div>
              </div>
              <button onClick={() => setEditUser(null)} className="text-slate-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">Nombre Completo</label>
                  <input
                    type="text"
                    required
                    value={editForm.fullName}
                    onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">Cédula / Documento</label>
                  <input
                    type="text"
                    required
                    value={editForm.documentId}
                    onChange={(e) => setEditForm({ ...editForm, documentId: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">Rol de Plataforma</label>
                  <select
                    value={editForm.roleName}
                    onChange={(e) => setEditForm({ ...editForm, roleName: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="multi_operator">Operador Multifunción</option>
                    <option value="supervisor">Supervisor</option>
                    <option value="data_analyst">Analista de Datos</option>
                    <option value="module_admin">Administrador de Módulo</option>
                    {isCurrentUserSuperAdmin && <option value="superadmin">SuperAdmin</option>}
                    <option value="auditor">Auditor (Solo Lectura)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">Cargo / Sub-Rol</label>
                  <input
                    type="text"
                    value={editForm.subRol}
                    onChange={(e) => setEditForm({ ...editForm, subRol: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">Turno</label>
                  <select
                    value={editForm.turno}
                    onChange={(e) => setEditForm({ ...editForm, turno: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="Mañana">Mañana</option>
                    <option value="Tarde">Tarde</option>
                    <option value="Noche">Noche</option>
                    <option value="Mixto">Mixto</option>
                    <option value="COMPLETO">Completo</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">Teléfono</label>
                  <input
                    type="text"
                    value={editForm.phoneNumber}
                    onChange={(e) => setEditForm({ ...editForm, phoneNumber: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">Extensión Telefónica (Briana)</label>
                  <input
                    type="text"
                    placeholder="Ej. 11001"
                    value={editForm.extension}
                    onChange={(e) => setEditForm({ ...editForm, extension: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-sky-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">Institución / Sede</label>
                <input
                  type="text"
                  value={editForm.institucion}
                  onChange={(e) => setEditForm({ ...editForm, institucion: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Áreas de Trabajo Asys & Oriana */}
              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                <span className="text-xs font-bold text-slate-200 block">
                  Áreas de Trabajo Autorizadas (Asys & Oriana)
                </span>
                <p className="text-[11px] text-slate-400">
                  Selecciona los espacios y salas donde este operador tiene autorización para marcar asistencia y operar.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                  {WORK_AREAS.map((area) => {
                    const isChecked = editForm.areas.includes(area);
                    return (
                      <label key={area} className="flex items-center gap-2 p-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 cursor-pointer text-xs">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (area === 'Todas') {
                              setEditForm({
                                ...editForm,
                                areas: e.target.checked ? ['Todas'] : [],
                              });
                            } else {
                              const newAreas = isChecked
                                ? editForm.areas.filter((a) => a !== area && a !== 'Todas')
                                : [...editForm.areas.filter((a) => a !== 'Todas'), area];
                              setEditForm({
                                ...editForm,
                                areas: newAreas.length === 0 ? ['Todas'] : newAreas,
                              });
                            }
                          }}
                          className="w-3.5 h-3.5 rounded text-blue-600 focus:ring-0 bg-slate-950 border-slate-700"
                        />
                        <span className={`text-[11px] truncate ${isChecked ? 'text-blue-300 font-semibold' : 'text-slate-400'}`}>
                          {area}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Controles de Cooldown y Estado */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <span className="text-xs font-bold text-slate-200 block">Privilegios y Restricciones Especiales</span>
                
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editForm.resetCooldown}
                    onChange={(e) => setEditForm({ ...editForm, resetCooldown: e.target.checked })}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-0 bg-slate-900 border-slate-700"
                  />
                  <div>
                    <span className="text-xs font-semibold text-amber-300 block">Liberar Restricción de 7 Días (Cooldown)</span>
                    <span className="text-[11px] text-slate-400 block">Permite que el usuario modifique su perfil de inmediato sin esperar el temporizador.</span>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer pt-2 border-t border-slate-800/60">
                  <input
                    type="checkbox"
                    checked={editForm.isActive}
                    onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-0 bg-slate-900 border-slate-700"
                  />
                  <div>
                    <span className="text-xs font-semibold text-emerald-300 block">Usuario Activo con Acceso al Sistema</span>
                    <span className="text-[11px] text-slate-400 block">Desmarcar para suspender o bloquear inmediatamente el inicio de sesión.</span>
                  </div>
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditUser(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold shadow-lg shadow-blue-900/30"
                >
                  {saving ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL RÁPIDO DE CAMBIO DE CONTRASEÑA ── */}
      {passwordModalUser && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-amber-600/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Resetear Contraseña</h3>
                  <p className="text-[11px] text-slate-400">{passwordModalUser.email}</p>
                </div>
              </div>
              <button onClick={() => setPasswordModalUser(null)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Nueva Contraseña
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="Mínimo 6 caracteres"
                  value={newPasswordInput}
                  onChange={(e) => setNewPasswordInput(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setPasswordModalUser(null)}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-bold shadow-lg shadow-amber-900/30"
                >
                  {saving ? 'Actualizando...' : 'Actualizar Clave'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL SCORING DINÁMICO & FIT (FASE 11) ── */}
      {isScoringOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-5xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-6 sm:p-8 space-y-6 relative max-h-[90vh] overflow-y-auto">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-amber-600/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                  <Award className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                    Scoring Dinámico & Telemetría FIT
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-950/80 text-amber-300 border border-amber-800/60">
                      30% - 40% - 30%
                    </span>
                  </h2>
                  <p className="text-xs text-slate-400">
                    Puntualidad Asys (30%) + Telefonía & FIT Briana (40%) + Analítica Oriana (30%)
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <input
                  type="date"
                  value={scoringDate}
                  onChange={(e) => {
                    setScoringDate(e.target.value);
                    fetchScoring(e.target.value);
                  }}
                  className="px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono"
                />
                <button
                  onClick={handleRecalculateScoring}
                  disabled={recalculating}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-bold text-xs shadow-lg shadow-amber-900/30 transition-all cursor-pointer whitespace-nowrap"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${recalculating ? 'animate-spin' : ''}`} />
                  <span>{recalculating ? 'Calculando...' : 'Recalcular'}</span>
                </button>
                <button onClick={() => setIsScoringOpen(false)} className="text-slate-400 hover:text-white p-1">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Ranking / Leaderboard */}
            <div className="rounded-2xl bg-slate-950 border border-slate-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-900/80 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                      <th className="py-3 px-3 w-10 text-center">#</th>
                      <th className="py-3 px-4">Operador / Identidad</th>
                      <th className="py-3 px-4 text-center">Score Final</th>
                      <th className="py-3 px-4">Asys (30%)</th>
                      <th className="py-3 px-4">Briana & FIT (40%)</th>
                      <th className="py-3 px-4">Oriana (30%)</th>
                      <th className="py-3 px-3 text-center">Módulo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                    {loadingScoring ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-slate-500">
                          <div className="inline-flex items-center gap-2">
                            <RefreshCw className="w-4 h-4 animate-spin text-amber-500" />
                            <span>Calculando scoring dinámico y telemetría FIT...</span>
                          </div>
                        </td>
                      </tr>
                    ) : leaderboard.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-10 text-center text-slate-500">
                          No hay evaluaciones consolidadas para esta fecha. Pulsa "Recalcular" para generar el scoring.
                        </td>
                      </tr>
                    ) : (
                      leaderboard.map((item, idx) => {
                        const breakdown = item.score_breakdown || {};
                        const asys = breakdown.asys || {};
                        const briana = breakdown.briana || {};
                        const oriana = breakdown.oriana || {};
                        const fit = breakdown.fit_telemetry || {};

                        const score = Number(item.final_score);
                        const scoreBadge = score >= 90
                          ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                          : score >= 75
                          ? 'bg-blue-950 text-blue-300 border-blue-800'
                          : score >= 60
                          ? 'bg-amber-950 text-amber-300 border-amber-800'
                          : 'bg-rose-950 text-rose-300 border-rose-800';

                        return (
                          <tr key={item.id} className="hover:bg-slate-900/40 transition-colors">
                            <td className="py-3 px-3 text-center font-bold text-slate-500">
                              {idx + 1}
                            </td>
                            <td className="py-3 px-4 font-sans">
                              <div className="font-bold text-white text-xs">{item.full_name}</div>
                              <div className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5 font-mono">
                                <span>{item.email}</span>
                                <span className="text-slate-600">|</span>
                                <span className="text-sky-400">Ext. {item.extension}</span>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span className={`inline-flex items-center justify-center px-2.5 py-1 rounded-lg text-xs font-black border ${scoreBadge}`}>
                                {score.toFixed(1)} pts
                              </span>
                            </td>
                            {/* Asys */}
                            <td className="py-3 px-4">
                              <div className="text-slate-200 font-semibold">{asys.score || 0} pts</div>
                              <div className="text-[10px] text-slate-400">
                                {asys.retardo_min > 0 ? `Retardo: ${asys.retardo_min} min` : 'Puntual'}
                              </div>
                            </td>
                            {/* Briana & FIT */}
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-1.5">
                                <span className="text-slate-200 font-semibold">{briana.score || 0} pts</span>
                                {fit.fit_minutes !== null && fit.fit_minutes !== undefined && (
                                  <span className={`text-[9px] px-1.5 py-0.2 rounded border font-semibold ${
                                    fit.fit_minutes <= 15
                                      ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                                      : 'bg-amber-950 text-amber-300 border-amber-800'
                                  }`}>
                                    FIT: {fit.fit_minutes}m
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                {briana.effective_rate_pct || 0}% efect. ({briana.effective_calls || 0}/{briana.total_calls || 0})
                              </div>
                            </td>
                            {/* Oriana */}
                            <td className="py-3 px-4">
                              <div className="text-slate-200 font-semibold">{oriana.score || 0} pts</div>
                              <div className="text-[10px] text-slate-400">
                                {oriana.accuracy_pct || 0}% prec. ({oriana.records_count || 0} reg)
                              </div>
                            </td>
                            {/* Rol / Dominante */}
                            <td className="py-3 px-3 text-center">
                              <span className="text-[9px] px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-slate-300 uppercase">
                                {item.dominant_role === 'multi_operator' ? 'Híbrido' : item.dominant_role}
                              </span>
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
        </div>
      )}

      {/* ── MODAL CICLO DE VIDA & PURGA 500MB (FASE 12) ── */}
      {isLifecycleOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-6 sm:p-8 space-y-6 relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                    Ciclo de Vida & Purga Nocturna
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-950/80 text-purple-300 border border-purple-800/60">
                      Umbral 500 MB
                    </span>
                  </h2>
                  <p className="text-xs text-slate-400">
                    Mantenimiento predictivo del almacenamiento dentro de la cuota gratuita de Supabase
                  </p>
                </div>
              </div>
              <button onClick={() => setIsLifecycleOpen(false)} className="text-slate-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Medidor de Almacenamiento */}
            {storageStats && (
              <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Uso de Almacenamiento PostgreSQL
                  </span>
                  <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded-md border ${
                    storageStats.status === 'HEALTHY'
                      ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                      : storageStats.status === 'WARNING'
                      ? 'bg-amber-950 text-amber-400 border-amber-800'
                      : 'bg-rose-950 text-rose-400 border-rose-800'
                  }`}>
                    {storageStats.status} ({storageStats.usage_percentage}%)
                  </span>
                </div>

                {/* Barra de progreso */}
                <div className="w-full bg-slate-900 rounded-full h-3 overflow-hidden border border-slate-800">
                  <div
                    className={`h-full transition-all duration-500 ${
                      storageStats.usage_percentage < 70
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                        : storageStats.usage_percentage < 85
                        ? 'bg-gradient-to-r from-amber-500 to-yellow-400'
                        : 'bg-gradient-to-r from-rose-500 to-red-400'
                    }`}
                    style={{ width: `${Math.min(100, storageStats.usage_percentage)}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                  <span>Espacio ocupado: <strong className="text-white">{storageStats.database_size_pretty}</strong></span>
                  <span>Límite Free Tier: <strong className="text-white">{storageStats.quota_pretty}</strong></span>
                </div>
              </div>
            )}

            {/* Tablas Principales */}
            {storageStats?.largest_tables && (
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-300 block">
                  Tablas con Mayor Volumen de Almacenamiento
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {storageStats.largest_tables.slice(0, 6).map((t: any) => (
                    <div key={t.table_name} className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-mono font-bold text-white text-[11px]">{t.table_name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">~{t.approx_rows} registros</div>
                      </div>
                      <span className="font-mono text-purple-300 font-bold text-xs bg-purple-950/60 px-2 py-0.5 rounded border border-purple-800/40">
                        {t.total_size}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Reporte de Purga si se ejecutó */}
            {purgeReport && (
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                <span className="text-xs font-bold text-emerald-400 block">
                  Reporte de Ejecución de Ciclo de Vida:
                </span>
                <div className="space-y-1 text-[11px] font-mono text-slate-300">
                  {purgeReport.map((rep: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-slate-800/60">
                      <span className="text-slate-400">{rep.phase}</span>
                      <span className="text-white font-bold">
                        {rep.rows_aggregated > 0 && `+${rep.rows_aggregated} consolidadas `}
                        {rep.rows_deleted > 0 && `-${rep.rows_deleted} purgadas `}
                        ({rep.execution_time_ms} ms)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Botones de Acción */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-800">
              <span className="text-[11px] text-slate-400">
                La purga consolida agregados diarios en tablas históricas antes de eliminar filas individuales.
              </span>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  disabled={purging}
                  onClick={() => handleRunPurge(true)}
                  className="w-full sm:w-auto px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-all cursor-pointer"
                >
                  {purging ? 'Simulando...' : 'Simular (Dry-Run)'}
                </button>
                <button
                  type="button"
                  disabled={purging}
                  onClick={() => {
                    if (confirm('¿Confirmas la ejecución de la purga nocturna? Se consolidarán los agregados y se compactarán registros > 90 días para preservar el umbral de 500 MB.')) {
                      handleRunPurge(false);
                    }
                  }}
                  className="w-full sm:w-auto px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-bold shadow-lg shadow-purple-900/30 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{purging ? 'Procesando...' : 'Ejecutar Purga'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL DE EMISIÓN DE AVISOS / BROADCAST ── */}
      {isBroadcastOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-6 sm:p-8 space-y-5 relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-rose-600/20 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                  <Megaphone className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white tracking-tight">
                    Emitir Aviso o Notificación
                  </h2>
                  <p className="text-xs text-slate-400">
                    Propagar comunicados globales, alertas a salas o mensajes individuales
                  </p>
                </div>
              </div>
              <button onClick={() => setIsBroadcastOpen(false)} className="text-slate-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSendBroadcast} className="space-y-4">
              {/* Tipo de Destinatario */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Destinatario del Aviso
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setBroadcastForm({ ...broadcastForm, target_type: 'global' })}
                    className={`p-2.5 rounded-xl border text-xs font-semibold text-center transition-all ${
                      broadcastForm.target_type === 'global'
                        ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    🌐 Toda la Plataforma
                  </button>
                  <button
                    type="button"
                    onClick={() => setBroadcastForm({ ...broadcastForm, target_type: 'user' })}
                    className={`p-2.5 rounded-xl border text-xs font-semibold text-center transition-all ${
                      broadcastForm.target_type === 'user'
                        ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    👤 Usuario Específico
                  </button>
                  <button
                    type="button"
                    onClick={() => setBroadcastForm({ ...broadcastForm, target_type: 'role' })}
                    className={`p-2.5 rounded-xl border text-xs font-semibold text-center transition-all ${
                      broadcastForm.target_type === 'role'
                        ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    👥 Por Rol
                  </button>
                </div>
              </div>

              {/* Selector si es Usuario */}
              {broadcastForm.target_type === 'user' && (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Seleccionar Usuario
                  </label>
                  <select
                    value={broadcastForm.target_email}
                    onChange={(e) => setBroadcastForm({ ...broadcastForm, target_email: e.target.value })}
                    required
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-rose-500"
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
              {broadcastForm.target_type === 'role' && (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Seleccionar Rol
                  </label>
                  <select
                    value={broadcastForm.target_role}
                    onChange={(e) => setBroadcastForm({ ...broadcastForm, target_role: e.target.value })}
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
                    Módulo de Referencia
                  </label>
                  <select
                    value={broadcastForm.modulo}
                    onChange={(e) => setBroadcastForm({ ...broadcastForm, modulo: e.target.value })}
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
                    value={broadcastForm.prioridad}
                    onChange={(e) => setBroadcastForm({ ...broadcastForm, prioridad: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-rose-500"
                  >
                    <option value="baja">Baja (Informativo)</option>
                    <option value="media">Media (Notificación regular)</option>
                    <option value="alta">Alta (Toast destacado)</option>
                    <option value="urgente">🚨 Urgente (Interrupción en pantalla)</option>
                  </select>
                </div>
              </div>

              {/* Título */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Título del Aviso *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Cambio de sala para turno tarde / Nueva campaña asignada"
                  value={broadcastForm.titulo}
                  onChange={(e) => setBroadcastForm({ ...broadcastForm, titulo: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-rose-500"
                />
              </div>

              {/* Mensaje */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Mensaje Detallado *
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Escribe el contenido del comunicado aquí..."
                  value={broadcastForm.descripcion}
                  onChange={(e) => setBroadcastForm({ ...broadcastForm, descripcion: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-rose-500 resize-none"
                />
              </div>

              {/* Checkbox Popup Modal Inmediato */}
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={broadcastForm.popup}
                    onChange={(e) => setBroadcastForm({ ...broadcastForm, popup: e.target.checked })}
                    className="w-4 h-4 rounded text-rose-600 focus:ring-0 bg-slate-900 border-slate-700"
                  />
                  <div>
                    <span className="text-xs font-semibold text-white block">
                      Interrumpir pantalla con Popup Modal Inmediato
                    </span>
                    <span className="text-[11px] text-slate-400 block">
                      Aparecerá superpuesto en cualquier modal o vista que el usuario tenga abierta y requerirá confirmación de lectura.
                    </span>
                  </div>
                </label>
              </div>

              {/* Botones */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsBroadcastOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={sendingBroadcast}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white font-bold text-xs shadow-lg shadow-rose-900/30 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{sendingBroadcast ? 'Emitiendo...' : 'Emitir Comunicado'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
