import fs from 'fs';
import path from 'path';

const FLAGS_FILE = path.join(process.cwd(), 'data', 'nexus_module_flags.json');

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
  try {
    if (!fs.existsSync(path.dirname(FLAGS_FILE))) {
      fs.mkdirSync(path.dirname(FLAGS_FILE), { recursive: true });
    }
    if (!fs.existsSync(FLAGS_FILE)) {
      fs.writeFileSync(FLAGS_FILE, JSON.stringify(DEFAULT_FLAGS, null, 2), 'utf-8');
      return DEFAULT_FLAGS;
    }
    const data = fs.readFileSync(FLAGS_FILE, 'utf-8');
    const parsed = JSON.parse(data);
    return { ...DEFAULT_FLAGS, ...parsed };
  } catch (err) {
    console.error('Error leyendo module flags:', err);
    return DEFAULT_FLAGS;
  }
}

export function saveModuleFlags(flags: Record<string, ModuleFlag>): boolean {
  try {
    if (!fs.existsSync(path.dirname(FLAGS_FILE))) {
      fs.mkdirSync(path.dirname(FLAGS_FILE), { recursive: true });
    }
    fs.writeFileSync(FLAGS_FILE, JSON.stringify(flags, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('Error guardando module flags:', err);
    return false;
  }
}
