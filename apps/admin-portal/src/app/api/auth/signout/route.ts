import { NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@intranet/database';

const DEFAULT_SUPABASE_URL = 'https://pzkqjdkphcwmblbyorbr.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB6a3FqZGtwaGN3bWJsYnlvcmJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM5NzE1NjEsImV4cCI6MjEwOTU0NzU2MX0.g2PTG7bzasuMj5Z_UoOrBmEDkLgUTTfT-pMtcs_EgoE';

async function performSignOut(request: Request) {
  const cookieStore = cookies();
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || 'nexus-system-three.vercel.app';
  const proto = request.headers.get('x-forwarded-proto') || 'https';
  const loginUrl = new URL('/login', `${proto}://${host}`);

  // HTTP 303 (See Other) garantiza que las solicitudes POST sean redirigidas con método GET a /login
  const response = NextResponse.redirect(loginUrl, 303);

  try {
    const supabase = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY,
      {
        cookies: {
          get(name: string) { return cookieStore.get(name)?.value; },
          set(name: string, value: string, options: CookieOptions) {
            response.cookies.set({ name, value, ...options });
          },
          remove(name: string, options: CookieOptions) {
            response.cookies.set({ name, value: '', ...options });
          },
        },
      }
    );

    await supabase.auth.signOut();
  } catch (e) {
    console.warn('Error signing out:', e);
  }

  return response;
}

export async function POST(request: Request) {
  return performSignOut(request);
}

export async function GET(request: Request) {
  return performSignOut(request);
}
