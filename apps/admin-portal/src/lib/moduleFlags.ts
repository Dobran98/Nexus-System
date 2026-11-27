import fs from 'fs';
import os from 'os';
import path from 'path';

const PRIMARY_FLAGS_FILE = path.join(process.cwd(), 'data', 'nexus_module_flags.json');
const TMP_FLAGS_FILE = path.join(os.tmpdir(), 'nexus_module_flags.json');

let memoryFlagsCache: Record<string, ModuleFlag> | null = null;

export interface ModuleFlag {
  id: string;
  name: string;
  category: string;
  route: string;
  status: 'public' | 'testing' | 'maintenance';
  minRole: 'analista_operador' | 'supervisor' | 'coordinador' | 'admin' | 'superadmin' | 'fundador_dev';
  maintenance_message?: string;
  updated_by?: string;
  updated_at?: string;
}

export const DEFAULT_FLAGS: Record<string, ModuleFlag> = {
  asys: {
    id: 'asys',
    name: 'ASYS — Asistencia & Guardias',
    category: 'Asistencia & RRHH',
    route: '/asistencia',
    status: 'public',
    minRole: 'analista_operador',
    maintenance_message: 'Módulo de Asistencia en sincronización programada.'
  },
  briana: {
    id: 'briana',
    name: 'BRIANA — Telefonía Celular',
    category: 'Contact Center',
    route: '/llamadas',
    status: 'public',
    minRole: 'analista_operador',
    maintenance_message: 'Actualización en curso del discador guiado.'
  },
  oriana: {
    id: 'oriana',
    name: 'ORIANA — Command Center',
    category: 'Gestión & Reportes',
    route: '/oriana',
    status: 'public',
    minRole: 'analista_operador',
    maintenance_message: 'Optimizando el motor de reportes comunales.'
  },
  reclasificacion: {
    id: 'reclasificacion',
    name: 'Reclasificación & Triage',
    category: 'Auditoría de Calidad',
    route: '/reclasificacion',
    status: 'testing',
    minRole: 'fundador_dev',
    maintenance_message: 'Módulo en fase de desarrollo activo y validación de matriz de incidencias.'
  },
  elecciones: {
    id: 'elecciones',
    name: 'Sala Nacional Electoral',
    category: 'Procesos Electorales',
    route: '/elecciones',
    status: 'testing',
    minRole: 'fundador_dev',
    maintenance_message: 'Sala en calibración de franjas horarias y padrón electoral.'
  },
  jade: {
    id: 'jade',
    name: 'JADE — Control & Planificación',
    category: 'Misiones & Rendición',
    route: '/planificacion',
    status: 'testing',
    minRole: 'fundador_dev',
    maintenance_message: 'Integrando código fuente de Google Apps Script con la suite Nexus.'
  },
  ingest: {
    id: 'ingest',
    name: 'Ingesta Masiva de Datos',
    category: 'Infraestructura',
    route: '/ingest',
    status: 'testing',
    minRole: 'fundador_dev',
    maintenance_message: 'Herramienta reservada para carga masiva de lotes por el desarrollador.'
  },
  encuestas: {
    id: 'encuestas',
    name: 'Sondeos & Encuestas Operativas',
    category: 'Clima & Evaluación',
    route: '/#encuestas',
    status: 'public',
    minRole: 'analista_operador',
    maintenance_message: 'Módulo de sondeos en mantenimiento temporal.'
  }
};

export function getModuleFlags(): Record<string, ModuleFlag> {
  if (memoryFlagsCache) return { ...DEFAULT_FLAGS, ...memoryFlagsCache };

  for (const candidate of [TMP_FLAGS_FILE, PRIMARY_FLAGS_FILE]) {
    try {
      if (fs.existsSync(candidate)) {
        const data = fs.readFileSync(candidate, 'utf-8');
        const parsed = JSON.parse(data);
        const resolved: Record<string, ModuleFlag> = { ...DEFAULT_FLAGS, ...parsed };
        memoryFlagsCache = resolved;
        return resolved;
      }
    } catch {
      // probar siguiente ruta
    }
  }

  try {
    fs.mkdirSync(path.dirname(PRIMARY_FLAGS_FILE), { recursive: true });
    fs.writeFileSync(PRIMARY_FLAGS_FILE, JSON.stringify(DEFAULT_FLAGS, null, 2), 'utf-8');
  } catch {
    try {
      fs.writeFileSync(TMP_FLAGS_FILE, JSON.stringify(DEFAULT_FLAGS, null, 2), 'utf-8');
    } catch {
      // fallback silencioso en memoria
    }
  }
  const initialFlags: Record<string, ModuleFlag> = { ...DEFAULT_FLAGS };
  memoryFlagsCache = initialFlags;
  return initialFlags;
}

export function saveModuleFlags(flags: Record<string, ModuleFlag>): boolean {
  memoryFlagsCache = { ...DEFAULT_FLAGS, ...flags };
  for (const candidate of [PRIMARY_FLAGS_FILE, TMP_FLAGS_FILE]) {
    try {
      fs.mkdirSync(path.dirname(candidate), { recursive: true });
      fs.writeFileSync(candidate, JSON.stringify(memoryFlagsCache, null, 2), 'utf-8');
      return true;
    } catch {
      // en Vercel process.cwd() es solo lectura; usar os.tmpdir()
    }
  }
  return true;
}
