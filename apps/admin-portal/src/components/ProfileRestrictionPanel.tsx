'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Lock,
  User,
  Clock,
  Shield,
  Phone,
  MapPin,
  AlertTriangle,
  CheckCircle2,
  Save,
  FileText,
  Info,
  Calendar,
} from 'lucide-react';
import { type Database, getSupabaseBrowserClient } from '@intranet/database';

// Tipos derivados del esquema oficial de Supabase
export type ProfileRow = Database['public']['Tables']['profiles']['Row'];
export type ProfileUpdatePayload = Database['public']['Tables']['profiles']['Update'];

interface ProfileRestrictionPanelProps {
  initialProfile: ProfileRow;
  onProfileUpdated?: (updated: ProfileRow) => void;
}

interface CooldownCalculation {
  isLocked: boolean;
  totalDaysRemaining: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

const COOLDOWN_DAYS_LIMIT = 7;

export const ProfileRestrictionPanel: React.FC<ProfileRestrictionPanelProps> = ({
  initialProfile,
  onProfileUpdated,
}) => {
  // Estado local del perfil sincronizado con Supabase
  const [profile, setProfile] = useState<ProfileRow>(initialProfile);

  // Estados de formulario para campos editables permitidos
  const [phoneNumber, setPhoneNumber] = useState<string>(initialProfile.phone_number || '');
  const [address, setAddress] = useState<string>(initialProfile.address || '');

  // Estados de proceso y feedback
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. REGLA DE COOLDOWN DE 7 DÍAS (last_profile_edit_at)
  // ─────────────────────────────────────────────────────────────────────────────
  const calculateCooldown = useCallback((): CooldownCalculation => {
    if (!profile.last_profile_edit_at) {
      return {
        isLocked: false,
        totalDaysRemaining: 0,
        days: 0,
        hours: 0,
        minutes: 0,
        seconds: 0,
      };
    }

    const lastEditTimestamp = new Date(profile.last_profile_edit_at).getTime();
    if (isNaN(lastEditTimestamp)) {
      return {
        isLocked: false,
        totalDaysRemaining: 0,
        days: 0,
        hours: 0,
        minutes: 0,
        seconds: 0,
      };
    }

    const cooldownDurationMs = COOLDOWN_DAYS_LIMIT * 24 * 60 * 60 * 1000;
    const unlockTimestamp = lastEditTimestamp + cooldownDurationMs;
    const now = Date.now();
    const diffMs = unlockTimestamp - now;

    if (diffMs <= 0) {
      return {
        isLocked: false,
        totalDaysRemaining: 0,
        days: 0,
        hours: 0,
        minutes: 0,
        seconds: 0,
      };
    }

    const totalDaysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);

    return {
      isLocked: true,
      totalDaysRemaining,
      days,
      hours,
      minutes,
      seconds,
    };
  }, [profile.last_profile_edit_at]);

  const [cooldown, setCooldown] = useState<CooldownCalculation>(calculateCooldown);

  // Efecto de temporizador en vivo para cuenta regresiva exacta
  useEffect(() => {
    setCooldown(calculateCooldown());

    const interval = setInterval(() => {
      const updated = calculateCooldown();
      setCooldown(updated);
      if (!updated.isLocked) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [calculateCooldown]);

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. DETECCIÓN DE CAMBIOS Y VALIDACIÓN CLIENT-SIDE
  // ─────────────────────────────────────────────────────────────────────────────
  const originalPhone = useMemo(() => (profile.phone_number || '').trim(), [profile.phone_number]);
  const originalAddress = useMemo(() => (profile.address || '').trim(), [profile.address]);

  const hasPhoneChanged = phoneNumber.trim() !== originalPhone;
  const hasAddressChanged = address.trim() !== originalAddress;
  const hasChanges = hasPhoneChanged || hasAddressChanged;

  // Validación de sintaxis telefónica (E.164 o numeración nacional)
  const isPhoneValid = useMemo(() => {
    const val = phoneNumber.trim();
    if (!val) return true; // campo opcional/permitido vacío
    const phoneRegex = /^\+?[0-9\s\-()\.]{7,20}$/;
    return phoneRegex.test(val);
  }, [phoneNumber]);

  const isAddressValid = address.trim().length <= 500;

  // Habilitar botón Guardar Cambios solo si hay modificaciones válidas y cooldown inactivo
  const canSubmit = !cooldown.isLocked && hasChanges && isPhoneValid && isAddressValid && !isSubmitting;

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. MUTACIÓN HACIA SUPABASE (public.profiles)
  // ─────────────────────────────────────────────────────────────────────────────
  const handleSaveChanges = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!canSubmit) {
      if (cooldown.isLocked) {
        setErrorMessage(`La edición está restringida por la política semanal de gobernanza.`);
      } else if (!hasChanges) {
        setErrorMessage('No se han detectado modificaciones en los campos permitidos.');
      } else if (!isPhoneValid) {
        setErrorMessage('Formato telefónico inválido. Ejemplo: +58 412 1234567 o 0414-1234567');
      }
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const supabase = getSupabaseBrowserClient();
      const nowIso = new Date().toISOString();

      const updatePayload: ProfileUpdatePayload = {
        phone_number: phoneNumber.trim() || null,
        address: address.trim() || null,
        last_profile_edit_at: nowIso,
        profile_edit_count_week: (profile.profile_edit_count_week || 0) + 1,
        updated_at: nowIso,
      };

      const { data, error } = await supabase
        .from('profiles')
        .update(updatePayload)
        .eq('id', profile.id)
        .select()
        .single();

      if (error) {
        throw new Error(error.message || 'Error al persistir la actualización en Supabase.');
      }

      if (data) {
        setProfile(data);
        setPhoneNumber(data.phone_number || '');
        setAddress(data.address || '');
        setSuccessMessage(
          'Perfil actualizado con éxito en Supabase. Se ha activado la política de cooldown de 7 días.'
        );
        onProfileUpdated?.(data);
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'Ocurrió un error inesperado al actualizar el perfil en la base de datos.';
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* ───────────────────────────────────────────────────────────────────── */}
      {/* ALERTA DE COOLDOWN (Tonos de advertencia oscuros: yellow-700 / 900)  */}
      {/* ───────────────────────────────────────────────────────────────────── */}
      {cooldown.isLocked ? (
        <div className="rounded-2xl border border-yellow-700/50 bg-yellow-950/20 p-5 sm:p-6 backdrop-blur-sm shadow-xl shadow-yellow-950/10">
          <div className="flex items-start space-x-3.5">
            <div className="h-10 w-10 rounded-xl bg-yellow-900/40 border border-yellow-700/60 flex items-center justify-center shrink-0 text-yellow-400">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="flex-1 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-sm sm:text-base font-bold text-yellow-200 tracking-tight flex items-center gap-2">
                  <span>Edición de Perfil Bloqueada por Cooldown Semanal</span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-yellow-900/60 text-yellow-300 border border-yellow-700/50">
                    Faltan {cooldown.totalDaysRemaining} {cooldown.totalDaysRemaining === 1 ? 'día' : 'días'}
                  </span>
                </h4>
              </div>

              <p className="text-xs sm:text-sm text-yellow-300/80 leading-relaxed">
                Por política de integridad institucional y seguridad de datos, solo se autoriza una
                modificación de contacto cada 7 días continuos. Su última modificación fue registrada el{' '}
                <strong className="text-yellow-100 font-medium">
                  {profile.last_profile_edit_at
                    ? new Date(profile.last_profile_edit_at).toLocaleString('es-ES', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : 'N/A'}
                </strong>
                .
              </p>

              {/* Temporizador Regresivo Digital */}
              <div className="pt-3 border-t border-yellow-800/40 flex flex-wrap items-center gap-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-yellow-400 flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  Tiempo restante para desbloqueo:
                </span>
                <div className="flex items-center space-x-2 font-mono text-xs sm:text-sm font-bold">
                  <div className="px-2.5 py-1 rounded-lg bg-slate-950/90 border border-yellow-700/60 text-yellow-300 shadow-inner">
                    {cooldown.days}d
                  </div>
                  <span className="text-yellow-600">:</span>
                  <div className="px-2.5 py-1 rounded-lg bg-slate-950/90 border border-yellow-700/60 text-yellow-300 shadow-inner">
                    {String(cooldown.hours).padStart(2, '0')}h
                  </div>
                  <span className="text-yellow-600">:</span>
                  <div className="px-2.5 py-1 rounded-lg bg-slate-950/90 border border-yellow-700/60 text-yellow-300 shadow-inner">
                    {String(cooldown.minutes).padStart(2, '0')}m
                  </div>
                  <span className="text-yellow-600">:</span>
                  <div className="px-2.5 py-1 rounded-lg bg-slate-950/90 border border-yellow-700/60 text-yellow-300 shadow-inner">
                    {String(cooldown.seconds).padStart(2, '0')}s
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-emerald-800/50 bg-emerald-950/20 p-4 sm:p-5 backdrop-blur-sm shadow-lg shadow-emerald-950/10 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-9 w-9 rounded-xl bg-emerald-900/40 border border-emerald-700/50 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-emerald-200">Ventana de Edición Habilitada</p>
              <p className="text-xs text-emerald-400/80">
                Puede actualizar su teléfono móvil y dirección domiciliaria. Al guardar, iniciará un nuevo ciclo de 7 días.
              </p>
            </div>
          </div>
          <span className="hidden sm:inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-950 text-emerald-300 border border-emerald-700/60">
            Cooldown Inactivo
          </span>
        </div>
      )}

      {/* FEEDBACK DE ERROR */}
      {errorMessage && (
        <div className="rounded-xl border border-rose-800/60 bg-rose-950/30 p-4 text-xs sm:text-sm text-rose-300 flex items-center space-x-3">
          <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0" />
          <p className="flex-1">{errorMessage}</p>
        </div>
      )}

      {/* FEEDBACK DE ÉXITO */}
      {successMessage && (
        <div className="rounded-xl border border-emerald-800/60 bg-emerald-950/30 p-4 text-xs sm:text-sm text-emerald-300 flex items-center space-x-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
          <p className="flex-1">{successMessage}</p>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────── */}
      {/* TARJETA PRINCIPAL DEL FORMULARIO DE PERFIL                           */}
      {/* ───────────────────────────────────────────────────────────────────── */}
      <div className="relative rounded-2xl bg-slate-900/90 border border-slate-800 p-6 sm:p-8 backdrop-blur-sm shadow-2xl space-y-8 overflow-hidden">
        {/* Hairline decorativa superior */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent" />

        {/* Encabezado del Formulario */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-800">
          <div className="flex items-center space-x-3.5">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-indigo-950 to-slate-900 border border-indigo-800/60 flex items-center justify-center text-indigo-400 shadow-md">
              <Shield className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight flex items-center gap-2">
                <span>Expediente de Identidad y Contacto</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Gobernanza de atributos personales sincronizada con Supabase Database
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <span
              className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${
                profile.is_active
                  ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/60'
                  : 'bg-rose-950/60 text-rose-400 border-rose-800/60'
              }`}
            >
              ● {profile.is_active ? 'Usuario Activo' : 'Inactivo'}
            </span>
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-mono font-medium bg-slate-800 text-slate-300 border border-slate-700/60">
              ID: {profile.id.slice(0, 8)}...
            </span>
          </div>
        </div>

        <form onSubmit={handleSaveChanges} className="space-y-8">
          {/* ================================================================= */}
          {/* SECCIÓN 1: CAMPOS PROTEGIDOS E INMUTABLES (NUNCA EDITABLES)       */}
          {/* ================================================================= */}
          <div className="p-5 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                <Lock className="h-3.5 w-3.5 text-slate-400" />
                <span>Atributos Institucionales Inmutables</span>
              </div>
              <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1">
                <Info className="h-3 w-3" />
                Protegido por políticas RBAC
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {/* CAMPO 1: NOMBRE LEGAL COMPLETO (PERMANENTEMENTE BLOQUEADO) */}
              <div className="space-y-1.5">
                <label
                  htmlFor="full_name"
                  className="block text-xs font-medium uppercase tracking-wider text-slate-400"
                >
                  Nombre Completo
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <User className="h-4 w-4" />
                  </div>
                  <input
                    id="full_name"
                    type="text"
                    value={profile.full_name}
                    disabled
                    readOnly
                    className="w-full pl-10 pr-10 py-2.5 bg-slate-900/60 border border-slate-800 rounded-xl text-slate-300 font-medium text-sm focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed select-none"
                  />
                  <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="h-4 w-4" />
                  </div>
                </div>
              </div>

              {/* CAMPO 2: DOCUMENTO DE IDENTIDAD (PERMANENTEMENTE BLOQUEADO) */}
              <div className="space-y-1.5">
                <label
                  htmlFor="document_id"
                  className="block text-xs font-medium uppercase tracking-wider text-slate-400"
                >
                  Documento de Identidad / Cédula
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <FileText className="h-4 w-4" />
                  </div>
                  <input
                    id="document_id"
                    type="text"
                    value={profile.document_id}
                    disabled
                    readOnly
                    className="w-full pl-10 pr-10 py-2.5 bg-slate-900/60 border border-slate-800 rounded-xl text-slate-300 font-mono text-sm focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed select-none"
                  />
                  <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="h-4 w-4" />
                  </div>
                </div>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed italic">
              * El nombre legal y documento de identidad forman parte del expediente inmutable de auditoría. Para rectificaciones,
              debe emitir un ticket de gobernanza directamente a Recursos Humanos.
            </p>
          </div>

          {/* ================================================================= */}
          {/* SECCIÓN 2: CAMPOS EDITABLES CON COOLDOWN (TELÉFONO & DIRECCIÓN)    */}
          {/* ================================================================= */}
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-slate-300">
                <Phone className="h-3.5 w-3.5 text-blue-400" />
                <span>Datos de Contacto Personal (Sujetos a Cooldown)</span>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">
                {cooldown.isLocked ? 'ESTADO: DESHABILITADO' : 'ESTADO: HABILITADO'}
              </span>
            </div>

            <div className="space-y-5">
              {/* CAMPO 3: TELÉFONO PERSONAL */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="phone_number"
                    className="block text-xs font-medium uppercase tracking-wider text-slate-300"
                  >
                    Teléfono Móvil
                  </label>
                  {cooldown.isLocked && (
                    <span className="text-[11px] text-yellow-500 font-medium flex items-center gap-1">
                      <Lock className="h-3 w-3" /> Bloqueado temporalmente
                    </span>
                  )}
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Phone className="h-4 w-4" />
                  </div>
                  <input
                    id="phone_number"
                    type="text"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    disabled={cooldown.isLocked || isSubmitting}
                    placeholder="+58 412 1234567"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-900/60 font-mono"
                  />
                </div>
                {!isPhoneValid && (
                  <p className="text-[11px] text-rose-400">
                    Por favor ingrese un número de teléfono válido (ejemplo: +58 414 1234567).
                  </p>
                )}
              </div>

              {/* CAMPO 4: DIRECCIÓN DOMICILIARIA */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="address"
                    className="block text-xs font-medium uppercase tracking-wider text-slate-300"
                  >
                    Dirección Domiciliaria
                  </label>
                  <span className="text-[11px] text-slate-400">
                    {address.length} / 500 caracteres
                  </span>
                </div>
                <div className="relative">
                  <div className="absolute top-3 left-3.5 pointer-events-none text-slate-400">
                    <MapPin className="h-4 w-4" />
                  </div>
                  <textarea
                    id="address"
                    rows={3}
                    maxLength={500}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    disabled={cooldown.isLocked || isSubmitting}
                    placeholder="Urb., calle, edificio o casa, parroquia, municipio y ciudad de residencia..."
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-900/60 resize-none leading-relaxed"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ================================================================= */}
          {/* SECCIÓN 3: METADATOS DE AUDITORÍA Y ACCIONES                     */}
          {/* ================================================================= */}
          <div className="pt-6 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="text-xs text-slate-400 space-y-1">
              <div className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                <span>
                  Ediciones acumuladas en el período:
                  <strong className="text-slate-300 font-mono ml-1">
                    {profile.profile_edit_count_week ?? 0}
                  </strong>
                </span>
              </div>
              <div className="text-[11px] text-slate-400">
                Última actualización:{' '}
                {profile.updated_at
                  ? new Date(profile.updated_at).toLocaleString('es-ES', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : 'Sin registros'}
              </div>
            </div>

            {/* BOTÓN GUARDAR CAMBIOS */}
            <button
              type="submit"
              disabled={!canSubmit}
              className="inline-flex items-center justify-center space-x-2 px-6 py-2.5 rounded-xl font-medium text-sm text-white bg-blue-600 hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900 shadow-lg shadow-blue-900/30 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-blue-600"
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <span>Sincronizando con Supabase...</span>
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  <span>
                    {cooldown.isLocked
                      ? 'Edición Bloqueada (Cooldown Activo)'
                      : hasChanges
                      ? 'Guardar Cambios'
                      : 'Sin Modificaciones'}
                  </span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
