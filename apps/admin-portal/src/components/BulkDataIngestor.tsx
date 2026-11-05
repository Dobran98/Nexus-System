'use client';

import React, { useState, useRef, useCallback } from 'react';
import type { Database } from '@intranet/database';
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Badge,
  Progress,
  Alert,
  AlertTitle,
  AlertDescription,
} from '@intranet/ui';

// Tipos derivados del esquema Supabase
type CallAssignmentInsert = Database['public']['Tables']['call_assignments']['Insert'];

export interface IngestRowItem {
  id_temp: string;
  customer_phone: string;
  customer_name: string;
  priority: number;
  is_duplicate: boolean;
  duplicate_reason?: string;
  validation_error?: string;
}

interface BulkDataIngestorProps {
  campaignId: string;
  operatorId: string;
  onUploadComplete?: (stats: { total: number; inserted: number; duplicates: number }) => void;
}

export const BulkDataIngestor: React.FC<BulkDataIngestorProps> = ({
  campaignId,
  operatorId,
  onUploadComplete,
}) => {
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [previewRows, setPreviewRows] = useState<IngestRowItem[]>([]);
  
  // Métricas de Deduplicación y Validación
  const [duplicateCount, setDuplicateCount] = useState<number>(0);
  const [invalidCount, setInvalidCount] = useState<number>(0);

  // Estados de Transmisión hacia Supabase
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadStatusText, setUploadStatusText] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successReport, setSuccessReport] = useState<{ total: number; inserted: number; duplicates: number } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Normalizador de números telefónicos (detección de patrones locales venezolanos / internacionales)
  const normalizePhone = (raw: string): string => {
    let cleaned = raw.replace(/[^\d+]/g, '').trim();
    if (cleaned.startsWith('0')) {
      cleaned = '+58' + cleaned.slice(1);
    }
    return cleaned;
  };

  // Parser CSV nativo en cliente sin dependencias externas
  const parseCSVContent = (text: string): IngestRowItem[] => {
    const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/["']/g, ''));
    const phoneIdx = headers.findIndex((h) => h.includes('tel') || h.includes('cel') || h.includes('phone') || h.includes('numero'));
    const nameIdx = headers.findIndex((h) => h.includes('nombre') || h.includes('name') || h.includes('cliente') || h.includes('vocero'));
    const prioIdx = headers.findIndex((h) => h.includes('prio') || h.includes('orden'));

    const seenPhones = new Set<string>();
    const rows: IngestRowItem[] = [];
    let dups = 0;
    let invalids = 0;

    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',').map((p) => p.trim().replace(/^["']|["']$/g, ''));
      if (parts.length === 0 || parts.every((p) => p === '')) continue;

      const rawPhone = phoneIdx !== -1 && parts[phoneIdx] ? parts[phoneIdx] : parts[0] || '';
      const rawName = nameIdx !== -1 && parts[nameIdx] ? parts[nameIdx] : parts[1] || 'Sin Nombre';
      const rawPrio = prioIdx !== -1 && parts[prioIdx] ? parseInt(parts[prioIdx], 10) : 1;

      const normalized = normalizePhone(rawPhone);
      let isDup = false;
      let dupReason: string | undefined = undefined;
      let validationErr: string | undefined = undefined;

      // Validación de longitud y formato
      if (!normalized || normalized.length < 7 || normalized.length > 20) {
        validationErr = 'Longitud de teléfono inválida';
        invalids++;
      } else if (seenPhones.has(normalized)) {
        isDup = true;
        dupReason = 'Número telefónico duplicado dentro del archivo';
        dups++;
      } else {
        seenPhones.add(normalized);
      }

      rows.push({
        id_temp: `row-${i}`,
        customer_phone: normalized || rawPhone,
        customer_name: rawName,
        priority: isNaN(rawPrio) || rawPrio < 1 ? 1 : Math.min(10, rawPrio),
        is_duplicate: isDup,
        duplicate_reason: dupReason,
        validation_error: validationErr,
      });
    }

    setDuplicateCount(dups);
    setInvalidCount(invalids);
    return rows;
  };

  // Procesar archivo seleccionado
  const handleProcessFile = async (file: File) => {
    setSelectedFile(file);
    setErrorMessage(null);
    setSuccessReport(null);
    setUploadProgress(0);
    setIsParsing(true);

    try {
      const extension = file.name.split('.').pop()?.toLowerCase();
      if (extension !== 'csv' && extension !== 'xlsx' && extension !== 'txt') {
        throw new Error('Formato no soportado. Cargue un archivo delimitado .csv o texto plano.');
      }

      const text = await file.text();
      const parsed = parseCSVContent(text);
      
      if (parsed.length === 0) {
        throw new Error('No se detectaron registros válidos en la estructura del archivo.');
      }

      setPreviewRows(parsed);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Error al parsear el archivo.');
      setPreviewRows([]);
    } finally {
      setIsParsing(false);
    }
  };

  // Eventos de Drag & Drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleProcessFile(e.dataTransfer.files[0]);
    }
  };

  // Ejecución de Ingesta Masiva por Lotes (Chunking para permanecer en cuota)
  const handleStartIngest = async () => {
    const validRows = previewRows.filter((r) => !r.is_duplicate && !r.validation_error);
    if (validRows.length === 0) {
      setErrorMessage('No hay registros válidos para cargar. Todos los registros son duplicados o contienen errores.');
      return;
    }

    setIsUploading(true);
    setErrorMessage(null);
    setUploadProgress(0);

    const BATCH_SIZE = 100;
    const totalBatches = Math.ceil(validRows.length / BATCH_SIZE);
    let successfullyUploaded = 0;

    try {
      for (let i = 0; i < totalBatches; i++) {
        const chunk = validRows.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
        
        // Transformar al contrato de inserción de Supabase
        const payload: CallAssignmentInsert[] = chunk.map((c) => ({
          campaign_id: campaignId,
          operator_id: operatorId,
          customer_phone: c.customer_phone,
          customer_name: c.customer_name,
          priority: c.priority,
          state: 'queued',
        }));

        setUploadStatusText(`Procesando lote ${i + 1} de ${totalBatches} (${chunk.length} registros)...`);

        const response = await fetch('/api/campaigns/assignments/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ assignments: payload }),
        });

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error || `Error en el lote ${i + 1}`);
        }

        successfullyUploaded += chunk.length;
        const progressPct = Math.round(((i + 1) / totalBatches) * 100);
        setUploadProgress(progressPct);
      }

      const report = {
        total: previewRows.length,
        inserted: successfullyUploaded,
        duplicates: duplicateCount,
      };

      setSuccessReport(report);
      setUploadStatusText('Ingesta masiva finalizada con éxito.');
      setPreviewRows([]);
      setSelectedFile(null);

      if (onUploadComplete) {
        onUploadComplete(report);
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Error durante la transmisión masiva.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      {/* TARJETA DE CARGA DRAG & DROP */}
      <Card>
        <CardHeader>
          <CardTitle>Ingestor Masivo de Leads y Asignaciones</CardTitle>
          <CardDescription>
            Importación streaming en lotes para campañas telefónicas con deduplicación automática.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* ZONA DRAG & DROP */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
              isDragging
                ? 'border-blue-500 bg-blue-950/20 scale-[0.99]'
                : 'border-slate-700 bg-slate-950/40 hover:border-slate-500 hover:bg-slate-900/60'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              accept=".csv, .txt"
              onChange={(e) => e.target.files?.[0] && handleProcessFile(e.target.files[0])}
              className="hidden"
            />

            <div className="flex flex-col items-center justify-center space-y-3">
              <div className="p-4 bg-slate-800 rounded-2xl border border-slate-700 text-blue-400">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>

              <div>
                <p className="text-base font-semibold text-white">
                  {selectedFile ? selectedFile.name : 'Arrastre su archivo .csv aquí o haga clic para examinar'}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Soporta archivos de hasta 50,000 registros. Cabeceras sugeridas: Telefono, Nombre, Prioridad.
                </p>
              </div>
            </div>
          </div>

          {/* BARRA DE PROGRESO DE CARGA */}
          {isUploading && (
            <div className="space-y-2 p-4 bg-slate-950/80 rounded-xl border border-slate-800 animate-in fade-in">
              <div className="flex justify-between items-center text-xs font-semibold">
                <span className="text-blue-400 font-mono">{uploadStatusText}</span>
                <span className="text-white font-mono">{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} color="blue" />
            </div>
          )}

          {/* MENSAJES Y ALERTAS */}
          {errorMessage && (
            <Alert variant="danger">
              <AlertTitle>Error en Ingesta</AlertTitle>
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}

          {successReport && (
            <Alert variant="success">
              <AlertTitle>Procesamiento Concluido</AlertTitle>
              <AlertDescription>
                Se registraron <strong className="text-white">{successReport.inserted}</strong> asignaciones válidas en Supabase.
                Se omitieron <strong className="text-white">{successReport.duplicates}</strong> duplicados identificados.
              </AlertDescription>
            </Alert>
          )}

          {/* PREVISUALIZACIÓN Y MÉTRICAS DE DEDUPLICACIÓN */}
          {previewRows.length > 0 && (
            <div className="space-y-4 pt-2">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white uppercase tracking-wider">
                    Registros Detectados:
                  </span>
                  <Badge variant="info">{previewRows.length} Totales</Badge>
                  {duplicateCount > 0 && (
                    <Badge variant="warning">{duplicateCount} Duplicados Omitidos</Badge>
                  )}
                  {invalidCount > 0 && (
                    <Badge variant="danger">{invalidCount} Inválidos</Badge>
                  )}
                </div>

                <span className="text-xs text-slate-400">
                  Previsualizando primeros 100 registros
                </span>
              </div>

              {/* TABLA DE PREVISUALIZACIÓN */}
              <div className="border border-slate-800 rounded-xl overflow-hidden max-h-80 overflow-y-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-800/90 text-slate-400 sticky top-0 uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="p-3">Estado</th>
                      <th className="p-3">Teléfono Normalizado</th>
                      <th className="p-3">Nombre del Contacto</th>
                      <th className="p-3 text-center">Prioridad</th>
                      <th className="p-3">Observaciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 bg-slate-950/40">
                    {previewRows.slice(0, 100).map((row) => (
                      <tr
                        key={row.id_temp}
                        className={
                          row.is_duplicate
                            ? 'bg-amber-950/20 text-amber-200'
                            : row.validation_error
                            ? 'bg-rose-950/20 text-rose-200'
                            : 'hover:bg-slate-800/40'
                        }
                      >
                        <td className="p-3 whitespace-nowrap">
                          {row.is_duplicate ? (
                            <Badge variant="warning">Duplicado</Badge>
                          ) : row.validation_error ? (
                            <Badge variant="danger">Inválido</Badge>
                          ) : (
                            <Badge variant="success">Válido</Badge>
                          )}
                        </td>
                        <td className="p-3 font-mono font-semibold">{row.customer_phone}</td>
                        <td className="p-3">{row.customer_name}</td>
                        <td className="p-3 text-center font-mono">{row.priority}</td>
                        <td className="p-3 text-slate-400 text-[11px]">
                          {row.duplicate_reason || row.validation_error || 'Listo para inserción'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>

        <CardFooter>
          <div className="flex items-center justify-between w-full">
            <Button
              variant="ghost"
              onClick={() => {
                setPreviewRows([]);
                setSelectedFile(null);
                setSuccessReport(null);
              }}
              disabled={isUploading || previewRows.length === 0}
            >
              Limpiar Selección
            </Button>

            <Button
              variant="primary"
              onClick={handleStartIngest}
              isLoading={isUploading}
              disabled={isUploading || previewRows.length === 0 || previewRows.every((r) => r.is_duplicate || r.validation_error)}
            >
              Iniciar Carga a Supabase ({previewRows.filter((r) => !r.is_duplicate && !r.validation_error).length} Válidos)
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
};
