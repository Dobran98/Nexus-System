import Link from 'next/link';

export default function CallsHomePage() {
  return (
    <main className="min-h-screen bg-slate-950 p-8 flex items-center justify-center">
      <div className="max-w-4xl w-full space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-100">Llamadas e Incidencias Nexus</h1>
          <p className="mt-2 text-slate-400">Operaciones telefónicas corporativas Samsung y control de incidentes</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Link
            href="/dialer"
            className="p-6 bg-slate-900 border border-slate-800 rounded-xl hover:border-slate-700 transition"
          >
            <h2 className="text-xl font-semibold text-slate-200">Discador Guiado &rarr;</h2>
            <p className="mt-2 text-sm text-slate-400">
              Gestión secuencial de llamadas para terminal Samsung sin PBX y registro de latencia.
            </p>
          </Link>
        </div>
      </div>
    </main>
  );
}

