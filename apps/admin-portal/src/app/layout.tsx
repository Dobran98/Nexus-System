import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Nexus | Portal de Administración',
  description: 'Panel maestro de administración, RBAC y analítica global Nexus',
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="dark">
      <body className="min-h-screen bg-slate-950 text-slate-50 antialiased">{children}</body>
    </html>
  );
}

