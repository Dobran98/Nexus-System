# 📖 Manual Completo de Migración: Netlify + Supabase

Este manual detalla los pasos técnicos para llevar el **Sistema de Votación y Monitoreo de la Sala Nacional** desde Google Apps Script a una infraestructura verdaderamente escalable (soporta +5,500 usuarios) usando **Netlify** (Hosting + Funciones Serverless) y **Supabase** (PostgreSQL en tiempo real).

---

## 🚀 PASO 1: Creación y Configuración del Proyecto Frontend

Vamos a modernizar el frontend usando **Vite** con **React** y **Tailwind CSS**. Esto sacará a la aplicación de la "cápsula" de `HtmlService` de Google.

### 1. Inicializar el Proyecto Localmente

Abre tu terminal (PowerShell o VS Code Terminal) en tu computadora y ejecuta:

```bash
# 1. Crear el proyecto React con Vite (es rapidísimo)
npx create-vite@latest sala-nacional-app --template react

# 2. Entrar a la carpeta
cd sala-nacional-app

# 3. Instalar dependencias base
npm install

# 4. Instalar Tailwind CSS y configurar
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p

# 5. Instalar librerías adicionales que usaremos
npm install @supabase/supabase-js react-router-dom chart.js react-chartjs-2 sweetalert2 lucide-react xlsx
```

### 2. Configurar Tailwind (`tailwind.config.js`)
Reemplaza el archivo generado con este para mantener nuestra estética "Glassmorphism":

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#4cd7f6",
        secondary: "#4edea3",
        tertiary: "#ffeb3b",
        error: "#ff5252",
        warning: "#ffd740",
        surface: {
          container: {
            lowest: "rgba(10, 15, 30, 0.4)",
            low: "rgba(15, 25, 45, 0.5)",
            DEFAULT: "rgba(20, 35, 60, 0.6)",
            high: "rgba(30, 50, 80, 0.7)",
            highest: "rgba(40, 65, 100, 0.8)"
          }
        }
      }
    },
  },
  plugins: [],
}
```

### 3. Subir a Netlify
1. Crea un repositorio en **GitHub** y sube esta carpeta (`sala-nacional-app`).
2. Ve a [Netlify.com](https://www.netlify.com/), inicia sesión con GitHub.
3. Haz clic en **"Add new site"** -> **"Import an existing project"**.
4. Selecciona tu repositorio. Netlify detectará automáticamente que es Vite (`npm run build`, dir: `dist`).
5. Haz clic en **Deploy**. ¡Tu frontend ya está en la web global!

---

## 🗄️ PASO 2: Configuración de la Base de Datos Real (Supabase)

Supabase es una alternativa a Firebase basada en PostgreSQL. Es perfecta porque nos da una API REST instantánea y eventos en tiempo real (WebSockets).

### 1. Crear el Proyecto
1. Ve a [Supabase.com](https://supabase.com/) y crea una cuenta.
2. Haz clic en **"New Project"**, ponle nombre (Ej: `Elecciones Sala Nacional`), crea una contraseña fuerte para la BD y elige la región más cercana (ej: `US East`).

### 2. Crear las Tablas (SQL)
En el panel de Supabase, ve al menú **"SQL Editor"** (ícono de terminal) y ejecuta este bloque completo para crear el esquema idéntico a tus hojas de cálculo:

```sql
-- 1. Tabla de Usuarios
CREATE TABLE usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  rol TEXT NOT NULL,
  estado_asignado TEXT,
  activo BOOLEAN DEFAULT true
);

-- 2. Tabla de Condominios (Nuevo Módulo)
CREATE TABLE condominios (
  id SERIAL PRIMARY KEY,
  estado TEXT NOT NULL,
  municipio TEXT NOT NULL,
  parroquia TEXT,
  condominio TEXT NOT NULL,
  responsable TEXT,
  telefono TEXT,
  total_reg INT DEFAULT 0,
  h9 INT DEFAULT 0, h10 INT DEFAULT 0, h11 INT DEFAULT 0,
  h12 INT DEFAULT 0, h13 INT DEFAULT 0, h14 INT DEFAULT 0,
  h15 INT DEFAULT 0, h16 INT DEFAULT 0, h17 INT DEFAULT 0, h20 INT DEFAULT 0,
  UNIQUE(estado, municipio, condominio)
);

-- 3. Tabla Electoral Principal
CREATE TABLE data_electoral (
  id SERIAL PRIMARY KEY,
  estado TEXT NOT NULL,
  municipio TEXT NOT NULL,
  c_totales INT DEFAULT 0,
  c_activos INT DEFAULT 0,
  m_totales INT DEFAULT 0,
  m_activas INT DEFAULT 0,
  h9 INT DEFAULT 0, h11 INT DEFAULT 0, h12 INT DEFAULT 0,
  h13 INT DEFAULT 0, h14 INT DEFAULT 0, h15 INT DEFAULT 0,
  h16 INT DEFAULT 0, h17 INT DEFAULT 0, h20 INT DEFAULT 0,
  UNIQUE(estado, municipio)
);

-- 4. Activar Tiempo Real (WebSockets)
alter publication supabase_realtime add table condominios;
alter publication supabase_realtime add table data_electoral;
```

### 3. Obtener tus Credenciales
En Supabase, ve a **Project Settings -> API**. Copia la **URL** del proyecto y la **anon public key**. Las necesitarás para conectar el frontend.

---

## 🔌 PASO 3: Netlify Functions (Unir Todo)

En lugar de tener el backend en `Main.js` o `Admin.js` en Google, Netlify permite tener "Functions" (pequeños scripts en Node.js que corren en la nube y actúan como tu API privada de alta velocidad).

### 1. Crear carpeta de Funciones
En la raíz de tu proyecto React, crea una carpeta llamada `netlify/functions/`.

### 2. Ejemplo de Función de Autenticación (`netlify/functions/login.js`)
Este archivo reemplaza a `Auth.js`. Conectará con Supabase para validar al usuario.

```javascript
// /netlify/functions/login.js
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  const { username, password } = JSON.parse(event.body);
  const hashInput = crypto.createHash('sha256').update(password).digest('hex');

  // Buscar en Supabase
  const { data: user, error } = await supabase
    .from('usuarios')
    .select('*')
    .eq('username', username)
    .single();

  if (error || !user) return { statusCode: 401, body: JSON.stringify({ error: 'Usuario no encontrado' }) };

  if (user.password_hash === hashInput) {
    // Generar un token simulado o usar Supabase Auth JWT real
    const token = crypto.randomUUID();
    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, token, user })
    };
  } else {
    return { statusCode: 401, body: JSON.stringify({ error: 'Credenciales inválidas' }) };
  }
};
```

### 3. ¿Cómo conecta el Frontend?
En tu React, en lugar de llamar a `google.script.run`, harás fetch a estas funciones:

```javascript
// Frontend React (Login)
const response = await fetch('/.netlify/functions/login', {
  method: 'POST',
  body: JSON.stringify({ username, password })
});
const result = await response.json();
if (result.success) {
  localStorage.setItem('token', result.token);
  // Redirigir al dashboard
}
```

---

## 📦 PASO 4: Scripts de Migración de Datos (Google Sheets -> Supabase)

Para no perder los datos de las hojas de cálculo, crearemos un pequeño script en NodeJS que puedes correr en tu computadora para "inyectar" toda la data desde Sheets hacia PostgreSQL (Supabase) automáticamente.

### 1. Preparación
Crea una carpeta nueva en tu escritorio, digamos `migrador-datos`.
Abre terminal allí y ejecuta:
```bash
npm init -y
npm install @supabase/supabase-js papaparse
```

### 2. Exportar Sheets a CSV
La forma más segura (sin lidiar con APIs complejas de Google Auth) es descargar manualmente tus hojas actuales (ej: `DB_USUARIOS`, `DB_CONDOMINIOS`) como archivos `.csv` y ponerlos en la carpeta `migrador-datos`.

### 3. Script Inyector (`migrador.js`)
Crea este archivo en la carpeta y ejecútalo con `node migrador.js`.

```javascript
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import Papa from 'papaparse';

// Pega aquí tus credenciales de Supabase
const supabaseUrl = 'https://TU-PROYECTO.supabase.co';
const supabaseKey = 'TU-ANON-KEY-AQUI';
const supabase = createClient(supabaseUrl, supabaseKey);

async function migrarUsuarios() {
  console.log("Iniciando migración de Usuarios...");
  
  // Leemos el CSV descargado
  const csvText = fs.readFileSync('DB_USUARIOS.csv', 'utf8');
  const { data } = Papa.parse(csvText, { header: true, skipEmptyLines: true });

  for (const fila of data) {
    // Si la contraseña no está en SHA-256, asegúrate de migrarla antes o hacerlo en este script
    const passwordHash = fila['Contraseña'] || 'defaultHash';
    
    const { error } = await supabase.from('usuarios').insert({
      username: fila['Usuario'],
      password_hash: passwordHash,
      rol: fila['Rol'],
      estado_asignado: fila['Estado']
    });

    if (error) console.error(`Error migrando a ${fila['Usuario']}:`, error.message);
    else console.log(`✅ Migrado: ${fila['Usuario']}`);
  }
  console.log("Migración completada.");
}

// Ejecutar
migrarUsuarios();
```

> 💡 **Nota:** Harás un script similar cambiando el nombre del archivo `.csv` y la tabla (`condominios`, `data_electoral`) para subir todas las bases de datos en minutos, conservando exactamente la misma estructura.

---

### Resumen para iniciar de inmediato
Como me indicaste que **trabajaremos fuerte estos 3 días**, el sistema actual (Google Apps Script) **ya está parcheado y asegurado con las mejoras de las Fases 1, 2 y 3** (Contraseñas Hashing, Caché de Memoria y el nuevo Tab de Condominios con la hora 10:00 AM).

Puedes usar el sistema Apps Script tal cual está durante las próximas 48 horas con absoluta confianza de que soporta más carga que antes gracias al `CacheService` y la lectura en bloque que acabo de programarle en `Admin.js`. 

Este manual es la "fase preparatoria" para cuando cerremos la jornada del viernes y hagamos el salto definitivo a la arquitectura React/Supabase/Netlify.
