'use client';

import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  X,
  HelpCircle,
  CheckCircle2,
  Lightbulb,
  QrCode,
  PhoneCall,
  LineChart,
  Tags,
  Vote,
  Compass,
  ClipboardList,
  ShieldCheck
} from 'lucide-react';

export interface ManualContent {
  moduleId: string;
  moduleName: string;
  badge: string;
  icon: any;
  overview: string;
  operatorSteps: string[];
  supervisorGuidelines: string[];
  faq: Array<{ q: string; a: string }>;
  bestPractices: string[];
}

export const MODULE_MANUALS: Record<string, ManualContent> = {
  asys: {
    moduleId: 'asys',
    moduleName: 'ASYS — Asistencia, Guardias & Seguridad',
    badge: 'Módulo 1 · Presencia',
    icon: QrCode,
    overview: 'Sistema institucional para el registro seguro de entrada y salida mediante escaneo de Código QR maestro y geolocalización GPS obligatoria, sincronizado con el indicador ● DENTRO / ● FUERA en el Lobby y el Monitor Puente Administrativo.',
    operatorSteps: [
      'Al llegar a la sede, abra /asistencia o pulse "Marcar Ahora" desde su Estación de Trabajo.',
      'Active el GPS de su celular y otorgue permisos de cámara y ubicación al navegador.',
      'Apunte la cámara hacia el Código QR Maestro ubicado en sala.',
      'Confirme el registro de Entrada: su tarjeta en el Lobby pasará automáticamente a estado ● DENTRO.',
      'Al finalizar su turno, repita el escaneo para registrar la Salida y cambiar a estado ● FUERA.'
    ],
    supervisorGuidelines: [
      'Usar el botón "Monitor ASYS" en /users (Puente Administrativo Intranet) para ver sesiones abiertas y ausentes sin salir de Nexus.',
      'Registrar marcajes manuales justificados desde el Monitor ASYS ante fallas de GPS o extravío de celular.',
      'Aprobar o rechazar solicitudes de permisos, guardias especiales y suplencias.'
    ],
    faq: [
      { q: '¿Qué hacer si el navegador indica "Fuera de Rango Geográfico"?', a: 'Conéctese al WiFi institucional o acérquese brevemente a una ventana para que el GPS calibre con precisión menor a 50 metros del centro de la sede.' },
      { q: '¿Se puede marcar entrada desde casa si tengo turno remoto?', a: 'Solo si Coordinación o Administración habilitó la excepción correspondiente o registra asistencia supervisada.' }
    ],
    bestPractices: [
      'No comparta fotos del Código QR Maestro; el sistema audita coordenadas GPS y distancia en metros.',
      'Si olvida marcar su salida, notifique de inmediato a su Supervisor para cierre manual auditado.'
    ]
  },
  briana: {
    moduleId: 'briana',
    moduleName: 'BRIANA — Marcado Remoto SIM, WhatsApp & Contact Center',
    badge: 'Módulo 2 · Telefonía Celular',
    icon: PhoneCall,
    overview: 'Centro de llamadas sin PBX conectado en tiempo real vía Supabase Realtime con la flota de teléfonos Samsung Galaxy A57 / A37 (APK BrianaDialer). Soporta marcado remoto por línea celular física (SIM) y monitoreo de llamadas por WhatsApp, con detección de conexión real, medición exacta en segundos y tipificación obligatoria.',
    operatorSteps: [
      'En el Samsung asignado al turno, abra la app BrianaDialer, active el "Modo Turno Operador" (conceda rol de marcador predeterminado y permiso de Monitor WhatsApp en Notificaciones) y anote el código único (ej. BRN-4829).',
      'En su PC entre a /llamadas ("Marcador SIM"), ingrese el código BRN-XXXX y pulse "Vincular y Comenzar Turno".',
      'El sistema asignará automáticamente el siguiente contacto disponible de la cola (incluyendo reprogramados vencidos).',
      'Pulse "Llamar por SIM (Samsung)" para marcar automáticamente vía línea celular, o "Llamar por WhatsApp" para abrir el chat en WhatsApp y pulsar el ícono de llamada.',
      'Si la llamada NO conecta (sin respuesta, ocupado o rechazada), el sistema la cierra automáticamente como No Efectiva y avanza al siguiente contacto. Si SÍ conecta (STATE ACTIVE), al colgar se abre el Modal Obligatorio de Cierre para clasificar: 1) Efectiva, 2) No Efectiva / Buzón / Cortada, 3) Reprogramar (fecha/hora exacta) o 4) Número Equivocado.',
      'Al terminar su jornada, pulse "Cerrar Turno y Liberar Teléfono" en PC y desactive el Modo Turno en la APK para que el Samsung quede libre.'
    ],
    supervisorGuidelines: [
      'Desde la pestaña "Dashboard Admin" en /llamadas, supervise métricas globales en vivo, porcentaje de efectividad y estado de batería/red de la flota Samsung.',
      'Use "Cargar Contactos" para importar bases nuevas directamente a contacts_queue con deduplicación automática.',
      'Audite el Análisis de Persistencia (efectivos al 1er, 2do, 3er o 4to+ intento), llamadas reprogramadas y números marcados como inválidos.'
    ],
    faq: [
      { q: '¿Qué diferencia hay entre Llamar por SIM y Llamar por WhatsApp?', a: 'En SIM la APK ejecuta TelecomManager.placeCall() y Call.disconnect() automáticamente al pulsar Colgar en PC. En WhatsApp, Android abre el chat listo para tocar el botón de llamada y el NotificationListenerService detecta timbre, conexión y colgado para disparar el modal en PC; por restricción de WhatsApp, el corte se toca en la pantalla del teléfono.' },
      { q: '¿Los buzones de voz inflan mis llamadas efectivas?', a: 'No. Aunque el buzón active audio (STATE ACTIVE), en el modal obligatorio debe clasificarlo en la opción 2 ("Buzón de Voz") para descontarlo de las efectivas y devolver el número a cola.' },
      { q: '¿Cómo accedo al módulo anterior de extensiones 110XX?', a: 'En la barra superior de /llamadas sigue disponible la pestaña "Briana Clásico" para compatibilidad histórica.' }
    ],
    bestPractices: [
      'Al concluir su turno nunca deje el Samsung vinculado; libérelo para que otro operador pueda rotarlo al día siguiente.',
      'Conceda una sola vez el permiso de Monitor WhatsApp y desactive la optimización de batería para BrianaDialer en Samsung OneUI.'
    ]
  },
  oriana: {
    moduleId: 'oriana',
    moduleName: 'ORIANA — Command Center & Reportes Operativos',
    badge: 'Módulo 3 · Analítica',
    icon: LineChart,
    overview: 'Centro de mando para la rendición de gestión diaria, consolidación de incidencias territoriales y validación de actividades realizadas por el equipo.',
    operatorSteps: [
      'Al finalizar su turno, ingrese a Oriana desde el menú principal de Nexus.',
      'Seleccione el área de trabajo en la que prestó servicio hoy (ej. SALA DE CONFERENCIAS - P6).',
      'Indique la cantidad de llamadas efectivas realizadas y los casos comunitarios atendidos.',
      'Si trabajó jornada extendida, marque la casilla "Trabajé todo el día".',
      'Presione "Enviar Reporte Diario" y confirme el mensaje de recepción satisfactoria.'
    ],
    supervisorGuidelines: [
      'Cruzar los datos reportados en Oriana con los registros automáticos del discador Briana.',
      'Detectar anomalías en el volumen de llamadas reportadas y emitir solicitudes de aclaratoria.',
      'Generar los informes ejecutivos diarios para la Coordinación General.'
    ],
    faq: [
      { q: '¿Puedo enviar más de un reporte el mismo día?', a: 'No. El sistema solo admite un reporte diario por operador para garantizar la integridad de la auditoría.' },
      { q: '¿Qué pasa si me equivoqué en un número al enviar?', a: 'Contacte a su Supervisor de sala antes del cierre nocturno para que habilite la edición supervisada.' }
    ],
    bestPractices: [
      'Envíe su reporte 10 minutos antes de marcar la salida en Asys.',
      'Verifique que los números coincidan con las planillas físicas o digitales de su turno.'
    ]
  },
  reclasificacion: {
    moduleId: 'reclasificacion',
    moduleName: 'Reclasificación & Triage de Incidencias',
    badge: 'Módulo 4 · Calidad',
    icon: Tags,
    overview: 'Herramienta de auditoría continua sin bloqueo de archivos Excel. Permite reclasificar requerimientos ciudadanos mal tipificados y despachar carga comunal de forma equitativa.',
    operatorSteps: [
      'Ingrese a la cola de triages asignados para su área.',
      'Abra el caso ciudadano y lea la descripción original del operador telefónico.',
      'Si la categoría es incorrecta (ej. tipificado como Alumbrado cuando era Avería de Agua), seleccione la categoría exacta.',
      'Asigne la prioridad de atención (Urgente, Alta, Normal) y guarde el caso.'
    ],
    supervisorGuidelines: [
      'Revisar las estadísticas de reincidencia por operador para planificar capacitaciones.',
      'Exportar la base de datos saneada para el despacho a los entes competentes.'
    ],
    faq: [
      { q: '¿Quién puede modificar un caso ya reclasificado?', a: 'Solo los auditores autorizados y el equipo de Coordinación General.' }
    ],
    bestPractices: [
      'Consulte la tabla de competencias sectoriales ante dudas limítrofes entre servicios públicos.'
    ]
  },
  jade: {
    moduleId: 'jade',
    moduleName: 'JADE — Control, Planificación & Rendición',
    badge: 'Módulo 5 · Misiones',
    icon: Compass,
    overview: 'Suite integral para la planificación y rendición de actividades territoriales, seguimiento de misiones de calle, módulos educativos (Classroom) y monitor nacional.',
    operatorSteps: [
      'Acceda al módulo JADE y seleccione su área de asignación territorial.',
      'En "Mis Actividades", registre las visitas, reuniones comunales o inspecciones realizadas.',
      'Cargue las evidencias fotográficas y la cantidad de beneficiarios participantes.',
      'Envíe a validación por parte del analista de rendición de cuentas.'
    ],
    supervisorGuidelines: [
      'Validar el cumplimiento de metas territoriales desde el tablero de "Monitor General".',
      'Aprobar las rendiciones pendientes y verificar la veracidad de los soportes cargados.'
    ],
    faq: [
      { q: '¿Se requiere conexión continua a internet?', a: 'Para enviar evidencias sí, pero puede redactar las notas en borrador sin cerrar el navegador.' }
    ],
    bestPractices: [
      'Suba fotografías claras donde se evidencie la asamblea o actividad comunal.'
    ]
  },
  elecciones: {
    moduleId: 'elecciones',
    moduleName: 'Sala Nacional Electoral',
    badge: 'Módulo 6 · Electoral',
    icon: Vote,
    overview: 'Tablero estratégico de movilización electoral con monitoreo en 335 municipios por franjas horarias (9:00 AM a 8:00 PM).',
    operatorSteps: [
      'Reciba las llamadas de los testigos de mesa y coordinadores de centro de votación.',
      'Ingrese al municipio y parroquia correspondiente.',
      'Registre el corte de votantes movilizados en la franja horaria activa (ej. Franja 12:00 PM - 2:00 PM).',
      'Confirme la apertura de mesas y reporte cualquier incidencia o retraso técnico.'
    ],
    supervisorGuidelines: [
      'Monitorear la curva de movilización horaria y alertar sobre centros rezagados.',
      'Supervisar el mapa interactivo y la proyección de participación nacional.'
    ],
    faq: [
      { q: '¿Qué hacer si un centro cambia de mesa a última hora?', a: 'Notifique a la mesa técnica de sala para actualizar el padrón municipal en el sistema.' }
    ],
    bestPractices: [
      'Mantenga los reportes estrictamente dentro de la ventana de tiempo de cada franja horaria.'
    ]
  },
  encuestas: {
    moduleId: 'encuestas',
    moduleName: 'Sondeos & Encuestas Operativas (Nexus Surveys)',
    badge: 'Gobernanza & Clima',
    icon: ClipboardList,
    overview: 'Canal de evaluación bidireccional entre la directiva y los operadores para el diagnóstico de condiciones de trabajo, ergonomía y retroalimentación técnica.',
    operatorSteps: [
      'Revise el botón "Encuestas" en el menú superior cuando aparezca el badge numérico.',
      'Lea cada pregunta con calma y seleccione su nivel de satisfacción (1 a 5 estrellas), opción múltiple o comentario.',
      'Envíe la encuesta; puede actualizar su respuesta mientras el sondeo esté activo.'
    ],
    supervisorGuidelines: [
      'Los roles Coordinador, Coordinador General, Admin y Superadmin pueden crear encuestas desde la pestaña "Crear Encuesta" y consultar métricas en "Resultados & Analítica".',
      'Diseñar encuestas breves (máximo 4 preguntas) para no restar tiempo a la gestión telefónica.'
    ],
    faq: [
      { q: '¿Son obligatorias las encuestas?', a: 'Sí, forman parte del proceso de evaluación de calidad institucional.' }
    ],
    bestPractices: [
      'Responda con total franqueza para que la directiva pueda tomar decisiones que le beneficien.'
    ]
  },
  gobernanza: {
    moduleId: 'gobernanza',
    moduleName: 'Gobernanza, Personal (/users), Fotos & Modales Admin',
    badge: 'Administración RBAC',
    icon: ShieldCheck,
    overview: 'Suite ejecutiva para administrar credenciales @impress.com, fotografías corporativas, jerarquía RBAC (6 niveles), notificaciones emergentes, Monitor Puente ASYS, Feature Flags y ciclo de vida de datos.',
    operatorSteps: [
      'En "Mi Perfil" (/profile) revise sus datos y utilice su cuota semanal de actualización (cada edición activa un cooldown de 7 días).',
      'Si necesita corrección urgente antes de los 7 días o actualización de foto corporativa, solicítela a su Administrador.'
    ],
    supervisorGuidelines: [
      'En Gestión de Personal (/users): cree o edite usuarios, cargue su fotografía corporativa (foto_url), reasigne áreas/turnos, congele accesos o libere el cooldown de 7 días.',
      'Use "Emitir Aviso" en el Navbar para enviar comunicados Globales, Por Rol o Individuales; marque "Desplegar como Alerta Flotante" para mostrar un modal prioritario encima de cualquier módulo.',
      'Superadmin y Fundador Dev disponen del botón "Módulos" (Feature Flags en vivo: Público / Solo Pruebas Dev / Mantenimiento) y del mantenimiento Lifecycle (purga de logs > 90 días).'
    ],
    faq: [
      { q: '¿Por qué un Admin no ve a los usuarios Superadmin o Fundador Dev en /users?', a: 'Por política de Gobierno Sigiloso (Stealth Governance), las cuentas Superadmin y Fundador Dev permanecen ocultas para los rangos 1 a 4.' }
    ],
    bestPractices: [
      'Asigne fotografías corporativas actualizadas en /users para dar identidad visual en el Lobby, Asys y directorios.'
    ]
  }
};

interface ModuleManualModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialModuleId?: string;
}

export function ModuleManualModal({ isOpen, onClose, initialModuleId = 'asys' }: ModuleManualModalProps) {
  const [selectedModuleId, setSelectedModuleId] = useState<string>(initialModuleId);
  const [activeTab, setActiveTab] = useState<'operator' | 'supervisor' | 'faq' | 'bestPractices'>('operator');

  useEffect(() => {
    if (isOpen && initialModuleId) {
      setSelectedModuleId(initialModuleId);
      setActiveTab('operator');
    }
  }, [isOpen, initialModuleId]);

  if (!isOpen) return null;

  const currentManual = MODULE_MANUALS[selectedModuleId] || MODULE_MANUALS.asys;
  const IconComponent = currentManual.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        
        {/* Cabecera */}
        <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-500 flex items-center justify-center text-white shadow-lg shadow-blue-950/40">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                Manual de Operación & Protocolos
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-950 text-blue-300 border border-blue-800/80">
                  Nexus Docs
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Guías de uso rápido, paso a paso, preguntas frecuentes y directrices de supervisión
              </p>
            </div>
          </div>
          
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Selector Horizontal de Módulo */}
        <div className="px-6 py-2.5 bg-slate-950/40 border-b border-slate-800/80 flex items-center gap-2 overflow-x-auto shrink-0 no-scrollbar">
          {Object.values(MODULE_MANUALS).map((m) => {
            const isSelected = selectedModuleId === m.moduleId;
            const ModIcon = m.icon;

            return (
              <button
                key={m.moduleId}
                type="button"
                onClick={() => { setSelectedModuleId(m.moduleId); setActiveTab('operator'); }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-900/30'
                    : 'bg-slate-950/60 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800/80'
                }`}
              >
                <ModIcon className="w-3.5 h-3.5" />
                <span>{m.moduleName.split('—')[0].trim()}</span>
              </button>
            );
          })}
        </div>

        {/* Resumen del Módulo Seleccionado */}
        <div className="p-6 bg-slate-950/20 border-b border-slate-800/60 shrink-0 flex items-start gap-4">
          <div className="h-12 w-12 rounded-2xl bg-blue-950/80 border border-blue-800/60 flex items-center justify-center text-blue-400 shrink-0">
            <IconComponent className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h4 className="text-base font-extrabold text-white">{currentManual.moduleName}</h4>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                {currentManual.badge}
              </span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed max-w-3xl">
              {currentManual.overview}
            </p>
          </div>
        </div>

        {/* Pestañas Internas del Manual */}
        <div className="px-6 py-2 bg-slate-950/40 border-b border-slate-800/80 flex items-center gap-2 text-xs font-semibold shrink-0">
          <button
            onClick={() => setActiveTab('operator')}
            className={`px-3 py-1.5 rounded-xl transition-all ${
              activeTab === 'operator' ? 'bg-slate-800 text-white font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            1. Guía Paso a Paso (Operadores)
          </button>
          <button
            onClick={() => setActiveTab('supervisor')}
            className={`px-3 py-1.5 rounded-xl transition-all ${
              activeTab === 'supervisor' ? 'bg-slate-800 text-white font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            2. Directrices de Supervisión
          </button>
          <button
            onClick={() => setActiveTab('faq')}
            className={`px-3 py-1.5 rounded-xl transition-all ${
              activeTab === 'faq' ? 'bg-slate-800 text-white font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            3. Preguntas Frecuentes
          </button>
          <button
            onClick={() => setActiveTab('bestPractices')}
            className={`px-3 py-1.5 rounded-xl transition-all ${
              activeTab === 'bestPractices' ? 'bg-slate-800 text-white font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            4. Buenas Prácticas
          </button>
        </div>

        {/* Contenido con Scroll */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          
          {/* TAB 1: OPERADOR */}
          {activeTab === 'operator' && (
            <div className="space-y-3">
              <h5 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                Procedimiento Operativo Paso a Paso
              </h5>
              <div className="space-y-2.5">
                {currentManual.operatorSteps.map((step, idx) => (
                  <div key={idx} className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-start gap-3 text-xs">
                    <span className="h-6 w-6 rounded-lg bg-blue-600/20 border border-blue-500/40 text-blue-400 font-mono font-bold flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <span className="text-slate-200 mt-0.5 leading-relaxed">{step}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: SUPERVISOR */}
          {activeTab === 'supervisor' && (
            <div className="space-y-3">
              <h5 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                Responsabilidades y Monitoreo del Supervisor
              </h5>
              <div className="space-y-2.5">
                {currentManual.supervisorGuidelines.map((guideline, idx) => (
                  <div key={idx} className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-start gap-3 text-xs">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span className="text-slate-200 leading-relaxed">{guideline}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: FAQ */}
          {activeTab === 'faq' && (
            <div className="space-y-3">
              <h5 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                Resolución de Dudas Frecuentes
              </h5>
              <div className="space-y-3">
                {currentManual.faq.map((item, idx) => (
                  <div key={idx} className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-1.5">
                    <div className="flex items-center gap-2 text-xs font-bold text-cyan-300">
                      <HelpCircle className="w-4 h-4 text-cyan-400 shrink-0" />
                      <span>{item.q}</span>
                    </div>
                    <p className="text-xs text-slate-300 pl-6 leading-relaxed">
                      {item.a}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: BUENAS PRÁCTICAS */}
          {activeTab === 'bestPractices' && (
            <div className="space-y-3">
              <h5 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                Recomendaciones para el Máximo Rendimiento
              </h5>
              <div className="space-y-2.5">
                {currentManual.bestPractices.map((bp, idx) => (
                  <div key={idx} className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-start gap-3 text-xs">
                    <Lightbulb className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <span className="text-slate-200 leading-relaxed">{bp}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <span>Manuales actualizados a la versión institucional Nexus 2026.</span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold transition-colors"
          >
            Cerrar Manual
          </button>
        </div>

      </div>
    </div>
  );
}
