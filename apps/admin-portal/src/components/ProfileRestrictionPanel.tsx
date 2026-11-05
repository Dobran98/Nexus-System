'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { Database } from '@intranet/database';
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Input,
  Badge,
  Alert,
  AlertTitle,
  AlertDescription,
} from '@intranet/ui';

// Tipos derivados de database.types.ts
type Profile = Database['public']['Tables']['profiles']['Row'];
type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];

interface ProfileRestrictionPanelProps {
  initialProfile: Profile;
  onProfileUpdated?: (updated: Profile) => void;
}

export const ProfileRestrictionPanel: React.FC<ProfileRestrictionPanelProps> = ({
  initialProfile,
  onProfileUpdated,
}) => {
  const [profile, setProfile] = useState<Profile>(initialProfile);
  
  // Campos editables controlados
  const [phoneNumber, setPhoneNumber] = useState<string>(initialProfile.phone_number || '');
  const [address, setAddress] = useState<string>(initialProfile.address || '');

  // Estados de interfaz y feedback
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // ─────────────────────────────────────────────────────────────
  // REGLA DE NEGOCIO: 1 EDICIÓN CADA 7 DÍAS NATURALES
  // ─────────────────────────────────────────────────────────────
  const unlockDate = useMemo(() => {
    if (!profile.last_profile_edit_at) return null;
    const lastDate = new Date(profile.last_profile_edit_at);
    // 7 días = 7 * 24 * 60 * 60 * 1000 ms
    return new Date(lastDate.getTime() + 7 * 24 * 60 * 60 * 1000);
  }, [profile.last_profile_edit_at]);

  // Cálculo de tiempo restante en vivo
  const [timeLeft, setTimeLeft] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    isLocked: boolean;
  }>({ days: 0, hours: 0, minutes: 0, seconds: 0, isLocked: false });

  const calculateTimeRemaining = useCallback(() => {
    if (!unlockDate) {
      return { days: 0, hours: 0, minutes: 0, seconds: 0, isLocked: false };
    }

    const now = new Date().getTime();
    const target = unlockDate.getTime();
    const diff = target - now;

    if (diff <= 0) {
      return { days: 0, hours: 0, minutes: 0, seconds: 0, isLocked: false };
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    return { days, hours, minutes, seconds, isLocked: true };
  }, [unlockDate]);

  useEffect(() => {
    setTimeLeft(calculateTimeRemaining());

    const timer = setInterval(() => {
      const remaining = calculateTimeRemaining();
      setTimeLeft(remaining);
      if (!remaining.isLocked) {
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [calculateTimeRemaining]);

  // Validación de inputs client-side
  const validateForm = (): boolean => {
    setErrorMessage(null);

    // Validación de Teléfono (E.164 o local)
    const phoneRegex = /^\+?[0-9\s\-()\.]{7,20}$/;
    if (phoneNumber && !phoneRegex.test(phoneNumber.trim())) {
      setErrorMessage('Formato telefónico inválido. Ejemplos válidos: +58 412 1234567 o 0414-1234567');
      return false;
    }

    if (address && address.trim().length > 500) {
      setErrorMessage('La dirección residencial no puede superar los 500 caracteres.');
      return false;
    }

    return true;
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (timeLeft.isLocked) {
      setErrorMessage('La edición se encuentra temporalmente bloqueada por la política semanal.');
      return;
    }

    if (!validateForm()) return;

    setIsSubmitting(true);
    setSuccessMessage(null);

    try {
      const updatePayload: ProfileUpdate = {
        phone_number: phoneNumber.trim() || null,
        address: address.trim() || null,
      };

      const res = await fetch(`/api/profile/${profile.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatePayload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Fallo al actualizar el perfil.');
      }

      const updatedRecord: Profile = await res.json();
      setProfile(updatedRecord);
      setSuccessMessage('Datos personales actualizados correctamente. La próxima edición quedará habilitada en 7 días.');

      if (onProfileUpdated) {
        onProfileUpdated(updatedRecord);
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Error inesperado al procesar la actualización.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6">
      {/* BANNER DE BLOQUEO POR REGLA DE 7 DÍAS */}
      {timeLeft.isLocked && (
        <Alert variant="warning" className="border-amber-600/40 bg-amber-950/30">
          <div className="w-full">
            <div className="flex items-center gap-2 mb-1">
              <svg className="w-5 h-5 text-amber-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <AlertTitle className="text-amber-200">
                Política de Seguridad y Nómina: Edición Restringida
              </AlertTitle>
            </div>
            <AlertDescription className="text-amber-300/90 text-xs sm:text-sm">
              Por normativa institucional, solo se permite una modificación de datos de contacto cada 7 días naturales.
              Su última modificación fue registrada el{' '}
              <strong className="text-white">
                {profile.last_profile_edit_at ? new Date(profile.last_profile_edit_at).toLocaleString() : 'N/A'}
              </strong>.
            </AlertDescription>

            {/* CONTADOR REGRESIVO VISUAL */}
            <div className="mt-4 pt-3 border-t border-amber-900/50 flex flex-wrap items-center gap-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">
                Tiempo restante para próxima edición:
              </span>
              <div className="flex items-center gap-2 font-mono font-bold text-white text-sm">
                <span className="bg-slate-900 px-2.5 py-1 rounded-lg border border-amber-800/60 text-amber-300">
                  {timeLeft.days}d
                </span>
                <span>:</span>
                <span className="bg-slate-900 px-2.5 py-1 rounded-lg border border-amber-800/60 text-amber-300">
                  {String(timeLeft.hours).padStart(2, '0')}h
                </span>
                <span>:</span>
                <span className="bg-slate-900 px-2.5 py-1 rounded-lg border border-amber-800/60 text-amber-300">
                  {String(timeLeft.minutes).padStart(2, '0')}m
                </span>
                <span>:</span>
                <span className="bg-slate-900 px-2.5 py-1 rounded-lg border border-amber-800/60 text-amber-300">
                  {String(timeLeft.seconds).padStart(2, '0')}s
                </span>
              </div>
            </div>
          </div>
        </Alert>
      )}

      {/* FEEDBACK */}
      {errorMessage && (
        <Alert variant="danger">
          <AlertTitle>Error de Validación</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

      {successMessage && (
        <Alert variant="success">
          <AlertTitle>Operación Exitosa</AlertTitle>
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      )}

      {/* TARJETA DE PERFIL */}
      <Card>
        <form onSubmit={handleSaveProfile}>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle>Expediente y Perfil del Colaborador</CardTitle>
                <CardDescription>
                  Datos de identidad protegidos por auditoría inmutable.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={profile.is_active ? 'success' : 'danger'}>
                  {profile.is_active ? 'Activo' : 'Inactivo'}
                </Badge>
                {timeLeft.isLocked ? (
                  <Badge variant="warning">Bloqueado (7 días)</Badge>
                ) : (
                  <Badge variant="info">Edición Habilitada</Badge>
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* SECCIÓN 1: DATOS INMUTABLES (SOLO LECTURA) */}
            <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800 space-y-4">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block">
                Campos Institucionales Protegidos (Inmutables)
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  id="document_id"
                  label="Documento de Identidad / Cédula"
                  value={profile.document_id}
                  disabled
                  className="bg-slate-900/60 cursor-not-allowed opacity-60 font-mono"
                />

                <Input
                  id="full_name"
                  label="Nombre Legal Completo"
                  value={profile.full_name}
                  disabled
                  className="bg-slate-900/60 cursor-not-allowed opacity-60 font-medium"
                />
              </div>
              <p className="text-[11px] text-slate-500 italic">
                * Para rectificación de nombres o documento de identidad, debe solicitar apertura de ticket formal a Recursos Humanos.
              </p>
            </div>

            {/* SECCIÓN 2: CAMPOS DE FRECUENCIA LIMITADA (1 VEZ CADA 7 DÍAS) */}
            <div className="space-y-4">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-widest block">
                Información de Contacto Personal
              </span>

              <div className="space-y-4">
                <Input
                  id="phone_number"
                  label="Teléfono Móvil Personal"
                  placeholder="+58 412 1234567"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  disabled={timeLeft.isLocked || isSubmitting}
                />

                <div className="w-full space-y-1.5">
                  <label htmlFor="address" className="block text-xs font-medium text-slate-300 tracking-wide uppercase">
                    Dirección Domiciliaria
                  </label>
                  <textarea
                    id="address"
                    rows={3}
                    maxLength={500}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    disabled={timeLeft.isLocked || isSubmitting}
                    placeholder="Sector, calle, número de casa/apartamento, parroquia y estado..."
                    className="w-full px-4 py-2.5 bg-slate-800/90 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all disabled:opacity-50 disabled:bg-slate-900 disabled:cursor-not-allowed resize-none"
                  />
                  <div className="flex justify-between text-[11px] text-slate-500">
                    <span>Máximo 500 caracteres.</span>
                    <span>{address.length} / 500</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>

          <CardFooter>
            <div className="flex flex-wrap items-center justify-between w-full gap-4">
              <span className="text-xs text-slate-500">
                Historial: {profile.profile_edit_count_week} ediciones acumuladas
              </span>

              <Button
                type="submit"
                variant="primary"
                disabled={timeLeft.isLocked || isSubmitting}
                isLoading={isSubmitting}
              >
                {timeLeft.isLocked ? 'Edición Bloqueada (7 días)' : 'Guardar Actualización'}
              </Button>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};

