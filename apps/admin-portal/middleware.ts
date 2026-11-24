import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

const DEFAULT_SUPABASE_URL = 'https://pzkqjdkphcwmblbyorbr.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB6a3FqZGtwaGN3bWJsYnlvcmJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM5NzE1NjEsImV4cCI6MjEwOTU0NzU2MX0.g2PTG7bzasuMj5Z_UoOrBmEDkLgUTTfT-pMtcs_EgoE';

// Rutas y prefijos que no requieren autenticación estricta previa
const PUBLIC_PATHS = [
  '/login',
  '/_next',
  '/favicon.ico',
  '/api/auth',
  '/en-construccion',
  '/oriana',
  '/api/oriana',
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Excluir rutas públicas o estáticas directas
  if (
    PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/')) ||
    pathname.startsWith('/oriana') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // 2. Preparar respuesta con reenvío de headers
  let response = NextResponse.next({ request: { headers: request.headers } });

  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

    const supabase = createServerClient(
      url,
      key,
      {
        cookies: {
          get(name: string) { return request.cookies.get(name)?.value; },
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

    const { data: { user } } = await supabase.auth.getUser();

    // 3. Manejo de rutas protegidas sin sesión
    if (!user) {
      // Si es una llamada API, responder con 401 JSON (nunca redirigir con HTML)
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          { error: 'No autenticado', message: 'Se requiere inicio de sesión' },
          { status: 401 }
        );
      }

      // Si es navegación web de página, redirigir a /login
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirectTo', pathname);
      return NextResponse.redirect(loginUrl);
    }

    return response;
  } catch (err) {
    // Si falla el servidor de auth, responder con seguridad según el tipo de petición
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'Error de autenticación' },
        { status: 401 }
      );
    }

    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }
}

export const config = {
  matcher: [
    /*
     * Coincidir con todas las rutas excepto:
     * - _next/static (archivos estáticos de compilación)
     * - _next/image (optimización de imágenes)
     * - favicon.ico
     * - Archivos con extensiones de medios, estilos, scripts o fuentes
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|css|js|woff|woff2|ttf|eot)).*)',
  ],
};
