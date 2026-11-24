// =============================================================================
// packages/auth/src/server.ts
// Cliente de Supabase para Server Components y Route Handlers
// =============================================================================

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import type { Database } from '@intranet/database';

const DEFAULT_SUPABASE_URL = 'https://pzkqjdkphcwmblbyorbr.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB6a3FqZGtwaGN3bWJsYnlvcmJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM5NzE1NjEsImV4cCI6MjEwOTU0NzU2MX0.g2PTG7bzasuMj5Z_UoOrBmEDkLgUTTfT-pMtcs_EgoE';

export function createSupabaseServerClient() {
  const cookieStore = cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

  return createServerClient<Database>(
    url,
    key,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {}
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch {}
        },
      },
    }
  );
}

// Cliente con Service Role para operaciones admin (solo server-side)
export function createSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

  return createClient<Database>(
    url,
    key,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
