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
  X
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

export default function UsersManagementPage() {
  const router = useRouter();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, active: 0, inactive: 0, admins: 0, supervisors: 0, operators: 0 });
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  
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
  });

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
  });

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

          <div className="flex items-center space-x-3">
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
            <span className="text-[10px] text-slate-500 mt-0.5 block">Superadmin & Admin</span>
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
              <option value="superadmin">SuperAdmin</option>
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
                  <th className="py-3.5 px-4">Turno / Sede</th>
                  <th className="py-3.5 px-4">Estado</th>
                  <th className="py-3.5 px-4">Cooldown 7d</th>
                  <th className="py-3.5 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-500">
                      <div className="inline-flex items-center gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin text-blue-500" />
                        <span>Sincronizando identidades corporativas...</span>
                      </div>
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-500">
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
                    <option value="superadmin">SuperAdmin</option>
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
                    <option value="superadmin">SuperAdmin</option>
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

    </div>
  );
}
