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