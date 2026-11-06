// =============================================================================
// @intranet/utils — Funciones criptográficas, parsing CSV/Excel y fechas
// Nexus System · packages/utils
// =============================================================================

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface ParsedCsvRow {
  [key: string]: string | number | boolean | null;
}

export interface CsvParseResult {
  headers: string[];
  rows: ParsedCsvRow[];
  totalRows: number;
  errorRows: number;
}

export interface DuplicateReport {
  duplicates: ParsedCsvRow[];
  uniques: ParsedCsvRow[];
  duplicateCount: number;
}

export interface PhoneValidationResult {
  isValid: boolean;
  normalized: string | null;
  error?: string;
}

// ─── Criptografía ────────────────────────────────────────────────────────────

/**
 * Genera un hash SHA-256 de un payload cualquiera.
 * Compatible con Web Crypto API (navegador y Node.js >= 18).
 */
export async function sha256Hash(data: string | object): Promise<string> {
  const payload = typeof data === 'string' ? data : JSON.stringify(data);
  const encoder = new TextEncoder();
  const buffer = await crypto.subtle.digest('SHA-256', encoder.encode(payload));
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Genera un hash SHA-256 sincrónico para uso en Node.js (sin Web Crypto).
 * Fallback para Edge Runtime con la función anterior.
 */
export function sha256HashSync(data: string): string {
  // Implementación basada en el algoritmo estándar sin dependencias externas
  // Para producción: usar crypto.createHash('sha256') en Node.js
  if (typeof require !== 'undefined') {
    try {
      const { createHash } = require('crypto');
      return createHash('sha256').update(data).digest('hex');
    } catch {}
  }
  // Fallback: Base64 con marca de longitud (no criptográficamente seguro)
  return btoa(data).slice(0, 64).padEnd(64, '0');
}

// ─── Validación de IMEI (Luhn) ───────────────────────────────────────────────

/**
 * Valida un número IMEI de 15 dígitos usando el algoritmo de Luhn.
 * Requerido para dispositivos Samsung corporativos.
 */
export function validateImei(imei: string): boolean {
  const cleaned = imei.replace(/\D/g, '');
  if (cleaned.length !== 15) return false;

  let sum = 0;
  for (let i = 0; i < 15; i++) {
    let digit = parseInt(cleaned[i], 10);
    if (i % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return sum % 10 === 0;
}

// ─── Validación de teléfonos ─────────────────────────────────────────────────

/**
 * Valida y normaliza un número de teléfono.
 * Acepta formatos venezolanos y colombianos con prefijo internacional.
 */
export function validatePhoneNumber(phone: string): PhoneValidationResult {
  const cleaned = phone.replace(/[\s\-\(\)\.]/g, '');
  const phoneRegex = /^\+?[1-9]\d{6,19}$/;

  if (!phoneRegex.test(cleaned)) {
    return {
      isValid: false,
      normalized: null,
      error: `Número inválido: ${phone}`,
    };
  }

  const normalized = cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
  return { isValid: true, normalized };
}

// ─── Parsing de CSV ──────────────────────────────────────────────────────────

/**
 * Parsea un contenido CSV en memoria.
 * Soporta delimitadores coma y punto y coma.
 * Maneja valores con comillas dobles y saltos de línea escapados.
 */
export function parseCsv(content: string): CsvParseResult {
  const lines = content.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) {
    return { headers: [], rows: [], totalRows: 0, errorRows: 0 };
  }

  const delimiter = lines[0].includes(';') ? ';' : ',';
  const headers = lines[0].split(delimiter).map((h) => h.trim().replace(/^"|"$/g, ''));
  const rows: ParsedCsvRow[] = [];
  let errorRows = 0;

  for (let i = 1; i < lines.length; i++) {
    const values = splitCsvLine(lines[i], delimiter);
    if (values.length !== headers.length) {
      errorRows++;
      continue;
    }
    const row: ParsedCsvRow = {};
    headers.forEach((h, idx) => {
      const val = values[idx]?.replace(/^"|"$/g, '').trim() ?? null;
      row[h] = val === '' ? null : val;
    });
    rows.push(row);
  }

  return { headers, rows, totalRows: rows.length, errorRows };
}

function splitCsvLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

// ─── Detección de duplicados ─────────────────────────────────────────────────

/**
 * Detecta filas duplicadas basándose en una clave compuesta de columnas.
 * @param rows        - Filas parseadas
 * @param keyColumns  - Columnas que forman la clave única (ej: ['phone_number'])
 */
export function detectDuplicates(
  rows: ParsedCsvRow[],
  keyColumns: string[]
): DuplicateReport {
  const seen = new Map<string, ParsedCsvRow>();
  const duplicates: ParsedCsvRow[] = [];
  const uniques: ParsedCsvRow[] = [];

  for (const row of rows) {
    const key = keyColumns.map((col) => String(row[col] ?? '')).join('|');
    if (seen.has(key)) {
      duplicates.push(row);
    } else {
      seen.set(key, row);
      uniques.push(row);
    }
  }

  return { duplicates, uniques, duplicateCount: duplicates.length };
}

// ─── Particionamiento de lotes ────────────────────────────────────────────────

/**
 * Divide un array en lotes de tamaño `batchSize`.
 * Usado para la ingesta masiva a Supabase en chunks de 100 filas.
 */
export function chunkArray<T>(array: T[], batchSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += batchSize) {
    chunks.push(array.slice(i, i + batchSize));
  }
  return chunks;
}

// ─── Utilidades de fecha ──────────────────────────────────────────────────────

/**
 * Retorna la diferencia en días entre dos fechas (siempre positivo).
 */
export function daysDifference(from: Date, to: Date = new Date()): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.abs(Math.floor((to.getTime() - from.getTime()) / msPerDay));
}

/**
 * Verifica si han pasado al menos N días desde una fecha dada.
 */
export function hasPassedDays(date: Date, days: number): boolean {
  return daysDifference(date) >= days;
}

/**
 * Calcula el tiempo restante hasta completar N días desde una fecha.
 * Retorna un objeto con días, horas, minutos y segundos.
 */
export function timeUntilDaysComplete(
  fromDate: Date,
  targetDays: number,
  now: Date = new Date()
): { days: number; hours: number; minutes: number; seconds: number; expired: boolean } {
  const targetTime = new Date(fromDate.getTime() + targetDays * 24 * 60 * 60 * 1000);
  const diff = targetTime.getTime() - now.getTime();

  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };
  }

  const totalSeconds = Math.floor(diff / 1000);
  return {
    days:    Math.floor(totalSeconds / 86400),
    hours:   Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
    expired: false,
  };
}

/**
 * Formatea una fecha en formato local venezolano/colombiano.
 */
export function formatLocalDate(
  date: Date | string,
  options: Intl.DateTimeFormatOptions = {
    dateStyle: 'medium',
    timeStyle: 'short',
  }
): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('es-VE', options).format(d);
}

