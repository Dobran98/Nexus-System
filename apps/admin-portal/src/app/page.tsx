import Link from 'next/link';

export default function AdminHomePage() {
  return (
    <main className="min-h-screen bg-slate-950 p-8 flex items-center justify-center">
      <div className="max-w-4xl w-full space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-100">Panel Maestro Nexus</h1>
          <p className="mt-2 text-slate-400">Gobernanza RBAC, auditoría y administración de campañas</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Link
            href="/profile"
            className="p-6 bg-slate-900 border border-slate-800 rounded-xl hover:border-slate-700 transition"
          >
            <h2 className="text-xl font-semibold text-slate-200">Perfil de Usuario &rarr;</h2>
            <p className="mt-2 text-sm text-slate-400">
              Visualización y edición restringida con cooldown de 7 días.
            </p>
          </Link>

          <Link
            href="/ingest"
            className="p-6 bg-slate-900 border border-slate-800 rounded-xl hover:border-slate-700 transition"
          >
            <h2 className="text-xl font-semibold text-slate-200">Ingesta Masiva de Datos &rarr;</h2>
            <p className="mt-2 text-sm text-slate-400">
              Procesamiento de lotes CSV/XLSX con detección de duplicados hacia Supabase.
            </p>
          </Link>
        </div>
      </div>
    </main>
  );
}

