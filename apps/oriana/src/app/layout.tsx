import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Nexus | Oriana — Análisis y Reportería',
  description: 'Módulo de análisis de datos y reportes ejecutivos Oriana para Nexus Intranet',
};

export default function OrianaLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="dark">
      <body className="min-h-screen bg-slate-950 text-slate-50 antialiased">{children}</body>
    </html>
  );
}

