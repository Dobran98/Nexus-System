import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Nexus | Llamadas e Incidencias',
  description: 'Discador guiado para terminales Samsung y gestión de SLAs Nexus',
};

export default function CallsLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="dark">
      <body className="min-h-screen bg-slate-950 text-slate-50 antialiased">{children}</body>
    </html>
  );
}

