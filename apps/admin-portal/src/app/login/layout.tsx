import type { Metadata } from 'next';
import '../globals.css';

export const metadata: Metadata = {
  title: 'Nexus | Acceso',
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="dark">
      <body className="min-h-screen bg-slate-950 antialiased">{children}</body>
    </html>
  );
}

