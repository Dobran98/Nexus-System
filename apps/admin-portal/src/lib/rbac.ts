import { createClient } from '@supabase/supabase-js';
import { getModuleFlags, ModuleFlag } from '@/lib/moduleFlags';

const DEFAULT_SUPABASE_URL = 'https://pzkqjdkphcwmblbyorbr.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB6a3FqZGtwaGN3bWJsYnlvcmJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM5NzE1NjEsImV4cCI6MjEwOTU0NzU2MX0.g2PTG7bzasuMj5Z_UoOrBmEDkLgUTTfT-pMtcs_EgoE';

const FOUNDER_USERNAMES = new Set(['brando', 'bralez', 'dobran', 'dobrando']);

export function isFounderEmail(email?: string | null): boolean {
  if (!email) return false;
  const clean = email.trim().toLowerCase();
  const localPart = clean.split('@')[0] || '';
  return FOUNDER_USERNAMES.has(localPart);
}

export const SUPERVISOR_AND_ABOVE_ROLES = [
  'fundador_dev',
  'superadmin',
  'admin',
  'module_admin',
  'coordinador_general',
  'coordinador',
  'supervisor',
];

export const ADMIN_AND_COORD_ROLES = [
  'fundador_dev',
  'superadmin',
  'admin',
  'module_admin',
  'coordinador_general',
  'coordinador',
];

export function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;
  return createClient(url, key, { auth: { persistSession: false } });
}

export interface UserRbacContext {
  userId: string;
  email: string;
  roleNames: string[];
  isFundadorDev: boolean;
  isSuperAdmin: boolean;
  isAdminOrCoord: boolean;
  isSupervisorOrAbove: boolean;
}

export async function getUserRbacContext(supabase: any, user: { id: string; email?: string | null }): Promise<UserRbacContext> {
  const email = (user.email || '').toLowerCase();

  let roleNames: string[] = [];
  try {
    const { data: rolesData } = await (supabase.from('user_roles') as any)
      .select('roles!inner(name)')
      .eq('user_id', user.id);
    roleNames = (rolesData ?? []).map((r: any) => r.roles?.name as string).filter(Boolean);
  } catch {
    roleNames = [];
  }

  const isFundadorDev = isFounderEmail(email) || roleNames.includes('fundador_dev');
  const isSuperAdmin = isFundadorDev || roleNames.includes('superadmin');
  const isAdminOrCoord = isSuperAdmin || roleNames.some((r) => ADMIN_AND_COORD_ROLES.includes(r));
  const isSupervisorOrAbove = isAdminOrCoord || roleNames.some((r) => SUPERVISOR_AND_ABOVE_ROLES.includes(r));

  return {
    userId: user.id,
    email,
    roleNames,
    isFundadorDev,
    isSuperAdmin,
    isAdminOrCoord,
    isSupervisorOrAbove,
  };
}

export function checkModuleAccess(
  moduleId: string,
  rbac: UserRbacContext
): { allowed: boolean; flag?: ModuleFlag } {
  const flags = getModuleFlags();
  const flag = flags[moduleId];
  if (!flag) return { allowed: true };

  // Fundador Dev y Superadmin siempre tienen acceso para probar módulos en modo 'testing' o 'maintenance'
  if (rbac.isFundadorDev || rbac.isSuperAdmin) {
    return { allowed: true, flag };
  }

  if (flag.status === 'testing' || flag.status === 'maintenance') {
    return { allowed: false, flag };
  }

  return { allowed: true, flag };
}
