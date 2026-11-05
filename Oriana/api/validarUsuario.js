const crypto = require('crypto');
const { supabase } = require('./lib/supabase');

function hashSHA256(texto) {
  return crypto.createHash('sha256').update(String(texto).trim()).digest('hex');
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Método no permitido' });
  }

  const args = req.body?.args || [];
  const u = args[0] !== undefined ? args[0] : (req.body?.u || req.body?.usuario);
  const c = args[1] !== undefined ? args[1] : (req.body?.c || req.body?.clave);

  if (!u || !c) {
    return res.status(400).json({ success: false, message: 'Usuario y contraseña requeridos' });
  }

  try {
    if (!supabase) {
      throw new Error('Base de datos no inicializada');
    }

    const uIn = String(u).trim();
    const cIn = String(c).trim();
    const cInHash = hashSHA256(cIn);

    // Buscar usuario por nombre (case-insensitive)
    const { data, error } = await supabase
      .from('usuarios')
      .select('*')
      .ilike('usuario', uIn)
      .limit(1);

    if (error) throw error;

    if (!data || data.length === 0) {
      return res.status(200).json({ success: false, message: 'Credenciales incorrectas.' });
    }

    const row = data[0];
    const claveAlmacenada = String(row.clave || '').trim();
    const coincide = (claveAlmacenada === cInHash) || (claveAlmacenada === cIn);

    if (!coincide) {
      return res.status(200).json({ success: false, message: 'Credenciales incorrectas.' });
    }

    const finalTurno = (row.turno && String(row.turno).trim() !== '')
      ? String(row.turno).trim().toUpperCase()
      : 'MAÑANA';

    return res.status(200).json({
      success: true,
      nombre: row.nombre_apellido || row.usuario,
      rol: String(row.rol || 'Operador').trim(),
      turno: finalTurno,
      idFisico: String(row.id_user || '').trim()
    });
  } catch (err) {
    console.error('Error en validarUsuario:', err);
    return res.status(500).json({ success: false, message: 'Error: ' + err.message });
  }
};

