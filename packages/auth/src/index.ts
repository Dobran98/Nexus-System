// =============================================================================
// @intranet/auth — Middlewares de sesión, validadores RBAC y cookies
// Nexus System · packages/auth
// =============================================================================

// NOTA: NO re-exportar server.ts aquí — contiene 'next/headers' que no es
// compatible con contextos 'use client'. Importar directamente:
//   import { createSupabaseBrowserClient } from '@intranet/auth/client'
//   import { createSupabaseServerClient } from '@intranet/auth/server'

export { createSupabaseBrowserClient } from './client';

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';
import type { Database } from '@intranet/database';

// ─── Tipos ──────────────────────────────────────────────────────────────────

export type UserRole =
  | 'superadmin'
  | 'module_admin'
  | 'supervisor'
  | 'multi_operator'
  | 'data_analyst'
  | 'auditor';

export interface AuthSession {
  userId: string;
  email: string | undefined;
  roles: UserRole[];
  profileId: string;
  isActive: boolean;
}

export type RbacResult =
  | { authorized: true; session: AuthSession }
  | { authorized: false; reason: string };

// ─── Configuración de cliente Supabase para SSR ──────────────────────────────

export function createSupabaseMiddlewareClient(
  request: NextRequest,
  response: NextResponse
) {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options });
          response.cookies.set({ name, value: '', ...options });
        },
      },
    }
  );
}

// ─── Middleware de Autenticación Principal ───────────────────────────────────

/**
 * Middleware RBAC para rutas de Next.js.
 * Valida la sesión JWT de Supabase y verifica que el usuario
 * posea al menos uno de los roles requeridos.
 */
export async function withRbacGuard(
  request: NextRequest,
  requiredRoles: UserRole[] = []
): Promise<RbacResult> {
  const response = NextResponse.next();
  const supabase = createSupabaseMiddlewareClient(request, response);

  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { authorized: false, reason: 'No autenticado' };
  }

  // Obtener roles del usuario vía RPC segura
  const { data: rolesData, error: rolesError } = await supabase
    .from('user_roles')
    .select('roles!inner(name)')
    .eq('user_id', user.id);

  if (rolesError) {
    return { authorized: false, reason: 'Error al verificar roles' };
  }

  const userRoles = (rolesData ?? []).map(
    (r: any) => r.roles.name as UserRole
  );

  // Verificar perfil activo
  const { data: profile } = (await (supabase
    .from('profiles') as any)
    .select('id, is_active')
    .eq('id', user.id)
    .single()) as { data: { id: string; is_active: boolean } | null };

  if (!profile?.is_active) {
    return { authorized: false, reason: 'Cuenta desactivada' };
  }

  // Validar roles requeridos (vacío = solo autenticación)
  if (requiredRoles.length > 0) {
    const hasRole = requiredRoles.some((r) => userRoles.includes(r));
    if (!hasRole) {
      return {
        authorized: false,
        reason: `Rol insuficiente. Requerido: ${requiredRoles.join(' | ')}`,
      };
    }
  }

  return {
    authorized: true,
    session: {
      userId: user.id,
      email: user.email,
      roles: userRoles,
      profileId: profile.id,
      isActive: profile.is_active,
    },
  };
}

// ─── Helpers de verificación de rol ─────────────────────────────────────────

export function hasRole(session: AuthSession, role: UserRole): boolean {
  return session.roles.includes(role);
}

export function hasAnyRole(session: AuthSession, roles: UserRole[]): boolean {
  return roles.some((r) => session.roles.includes(r));
}

export function isSuperAdmin(session: AuthSession): boolean {
  return session.roles.includes('superadmin');
}

export function canManageCampaigns(session: AuthSession): boolean {
  return hasAnyRole(session, ['superadmin', 'module_admin']);
}

export function canApproveProfileEdits(session: AuthSession): boolean {
  return hasAnyRole(session, ['superadmin', 'supervisor']);
}

export function canViewAuditLogs(session: AuthSession): boolean {
  return hasAnyRole(session, ['superadmin', 'auditor']);
}

export function canBulkIngest(session: AuthSession): boolean {
  return hasAnyRole(session, ['superadmin', 'module_admin', 'data_analyst']);
}

// ─── Middleware de Next.js ───────────────────────────────────────────────────

/**
 * Configuración de rutas protegidas por rol.
 * Usar en middleware.ts de cada app Next.js.
 */
export const PROTECTED_ROUTES: Record<string, UserRole[]> = {
  '/admin/users':     ['superadmin'],
  '/admin/devices':   ['superadmin', 'module_admin'],
  '/admin/campaigns': ['superadmin', 'module_admin'],
  '/admin/ingest':    ['superadmin', 'module_admin', 'data_analyst'],
  '/admin/audit':     ['superadmin', 'auditor'],
  '/llamadas/dialer': ['superadmin', 'module_admin', 'multi_operator'],
  '/oriana/submit':   ['superadmin', 'data_analyst', 'multi_operator'],
  '/asistencia':      ['superadmin', 'supervisor', 'multi_operator'],
};

