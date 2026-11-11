import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types/database.types';

export * from './types/database.types';

/**
 * Cliente Supabase tipado con el esquema de la intranet Nexus.
 * Permite realizar operaciones CRUD type-safe sobre public.profiles y demás tablas.
 */
let cachedClient: SupabaseClient<Database> | null = null;

export function getSupabaseBrowserClient(): SupabaseClient<Database> {
  if (cachedClient) return cachedClient;

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mock-supabase.nexus.internal';
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'mock-anon-key';

  cachedClient = createClient<Database>(supabaseUrl, supabaseAnonKey);
  return cachedClient;
}

export { createClient };
export type { SupabaseClient };
