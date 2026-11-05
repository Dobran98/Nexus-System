# ORIANA Command Center — v2.0 (Vercel + Supabase)

Sistema integral de gestión operativa, auditoría y control de actividades de operadores y analistas, migrado de Google Apps Script a una arquitectura desacoplada moderna de alto rendimiento:

- **Frontend:** SPA moderna en HTML5 / CSS3 (Design System Stitch) y JavaScript modular alojada en la CDN global de **Vercel** (`/public`).
- **Backend:** Funciones Serverless en Node.js alojadas en **Vercel Functions** (`/api`).
- **Base de Datos:** PostgreSQL administrado en **Supabase**, con soporte de concurrencia masiva, índices optimizados, columnas `JSONB` y consultas sin límite de filas.
- **Automatización & Notificaciones:** Bots de Telegram con colas de reintento, emojis configurables, desglose jerárquico de variables y tareas programadas automáticas con **Vercel Cron**.
- **Control de Versiones y CI/CD:** Repositorio oficial en **GitHub** (`Dobran98/Oriana`) con despliegue continuo automático en cada commit.

> [!TIP]
> Para consultar el manual técnico, diagramas de flujo y detalle exhaustivo de cada módulo, revisa el archivo maestro:  
> 📘 **[`DOCUMENTACION_MAESTRA_ORIANA.md`](./DOCUMENTACION_MAESTRA_ORIANA.md)**

---

## 📁 Estructura del Proyecto

```text
├── api/                             # Serverless API (Vercel Functions)
│   ├── cron/
│   │   └── telegram-queue.js        # Cron job cada 1 min para procesar cola de Telegram
│   ├── lib/
│   │   ├── supabase.js              # Cliente Supabase + helper fetchAllRows (antirrecorte)
│   │   └── telegram.js              # Motor de notificaciones, jerarquía de variables y emojis
│   ├── validarUsuario.js            # Login con hash criptográfico SHA-256
│   ├── guardarRegistro.js           # Inserción con variables JSONB y alertas a Telegram
│   ├── obtenerDatosDashboard.js     # Métricas y variables acumuladas en tiempo real
│   ├── obtenerRegistrosAdmin.js     # Paginación y filtros avanzados para administradores
│   ├── guardarValidacionAdmin.js    # Validación individual de registros con auditoría
│   ├── guardarValidacionMasiva.js   # Validación masiva de registros con auditoría
│   ├── obtenerTodasVariables.js / guardarVariablesModo.js # Variables dinámicas
│   ├── obtenerEmojis.js / guardarEmojis.js               # Repositorio de emojis
│   ├── obtenerIndicadores.js / guardarIndicadores.js     # Indicadores macro
│   ├── obtenerDestinatarios.js / guardarDestinatarios.js # Reportes programados
│   ├── obtenerAreas.js / guardarAreas.js                 # Áreas de trabajo
│   ├── obtenerReglasAcceso.js / guardarReglasAcceso.js   # Reglas de acceso por perfil
│   ├── obtenerConfiguracionVinculada.js / guardarNuevaConfiguracion.js # Modos/Campañas
│   ├── obtenerListaUsuarios.js      # Listado de operadores para selectores
│   ├── generarReporteXLSX.js        # Exportación Excel con variables dinámicas y fórmulas
│   └── generarReporteWord.js        # Exportación Word con minutas y resúmenes estructurados
├── public/                          # Frontend Estático
│   ├── css/
│   │   └── style.css                # Hoja de estilos del Design System v2
│   ├── js/
│   │   └── app.js                   # Lógica cliente con Proxy HTTP REST automático
│   └── index.html                   # Interfaz de usuario limpia y desacoplada
├── supabase/
│   ├── schema.sql                   # Definición de tablas, índices y extensiones DDL
│   ├── seed_data.sql                # Data histórica completa extraída de Excel
│   ├── 1_usuarios_y_config.sql      # Parte 1: Usuarios, Áreas, Reglas, Configuración y Logs
│   ├── 2_registros_parte1.sql       # Parte 2: Bloque 1 de registros históricos
│   ├── 3_registros_parte2.sql       # Parte 3: Bloque 2 de registros históricos
│   └── 4_registros_parte3.sql       # Parte 4: Bloque 3 de registros históricos
├── scripts/
│   └── migrate_excel_to_supabase.py # Script de extracción y migración desde Excel
├── package.json                     # Dependencias del proyecto
├── vercel.json                      # Configuración de URLs y Vercel Crons
├── .env.example                     # Plantilla de variables de entorno
└── .gitignore                       # Filtro de archivos protegidos
```

---

## 🚀 Guía de Puesta en Marcha

### 1. Inicialización de la Base de Datos en Supabase

1. Abre tu proyecto en [Supabase Dashboard](https://supabase.com/dashboard).
2. Ve a la pestaña **SQL Editor**.
3. Abre y ejecuta [`supabase/schema.sql`](./supabase/schema.sql) para crear las tablas e índices.
4. Para poblar los datos históricos del Excel sin superar el límite de tamaño del editor web, ejecuta en orden:
   - `supabase/1_usuarios_y_config.sql`
   - `supabase/2_registros_parte1.sql`
   - `supabase/3_registros_parte2.sql`
   - `supabase/4_registros_parte3.sql`
5. *(Opcional)* En **Project Settings $\to$ API $\to$ PostgREST configuration**, amplía el valor de **Max Rows** a `10000` o `50000`.

---

### 2. Conectar y Desplegar en Vercel

1. Ingresa a [Vercel Dashboard](https://vercel.com/new).
2. Selecciona **Import Git Repository** y elige **`Dobran98/Oriana`**.
3. En la sección **Environment Variables**, agrega:
   - `SUPABASE_URL`: URL de tu proyecto Supabase.
   - `SUPABASE_SERVICE_ROLE_KEY`: Clave secreta `service_role`.
   - `SUPABASE_ANON_KEY`: Clave pública `anon`.
   - `TELEGRAM_BOT_TOKEN`: Token del bot de Telegram.
   - `CHAT_ID_TELEGRAM`: ID del canal o grupo de Telegram.
   - `CRON_SECRET`: Clave aleatoria para autorizar las invocaciones de Vercel Cron.
4. Haz clic en **Deploy**. Cada commit que se empuje a la rama `main` en GitHub se desplegará de forma 100% automática.
