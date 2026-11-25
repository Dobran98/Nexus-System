import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import Papa from 'papaparse';

// Pega aquí tus credenciales de Supabase
const supabaseUrl = 'https://iryehwoptqfkmialseyw.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlyeWVod29wdHFma21pYWxzZXl3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MTQwMjI5MCwiZXhwIjoyMTA2OTc4MjkwfQ.Oi5_fGcokDfdETJ97JZBc5M6ZoDQmToDkqpArI7cFe8';
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
