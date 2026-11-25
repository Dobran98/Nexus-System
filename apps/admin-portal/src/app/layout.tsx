import type { Metadata } from 'next';
import './globals.css';
import { GlobalNotificationOverlay } from '@/components/GlobalNotificationOverlay';

export const metadata: Metadata = {
  title: 'Nexus | Sala de Gobierno — Portal de Administración',
  description: 'Plataforma ejecutiva de gobernanza RBAC, procesamiento de datos y telemetría empresarial Nexus',
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="dark scroll-smooth">
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased selection:bg-blue-600/30 selection:text-blue-200">
        <GlobalNotificationOverlay />
        {children}
      </body>
    </html>
  );
}
