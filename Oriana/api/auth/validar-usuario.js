const crypto = require('crypto');
const { supabase } = require('../../lib/supabase');

function hashSHA256(texto) {
  return crypto.createHash('sha256').update(String(texto)).digest('hex');
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Método no permitido' });
  }

  const { u, c } = req.body || {};
  if (!u || !c) {
    return res.status(400).json({ success: false, message: 'Usuario y contraseña requeridos' });
  }

  try {
    const uIn = String(u).trim().toLowerCase();
    const cIn = String(c).trim();
    const cInHash = hashSHA256(cIn);

    const { data: usuario, error } = await supabase
      .from('usuarios')
      .select('*')
      .ilike('usuario', uIn)
      .eq('activo', true)
      .single();

    if (error || !usuario) {
      return res.status(200).json({ success: false, message: 'Credenciales incorrectas o usuario inactivo.' });
    }

    const coincide = (usuario.clave_hash === cInHash) || (usuario.clave_hash === cIn);
    if (!coincide) {
      return res.status(200).json({ success: false, message: 'Credenciales incorrectas.' });
    }

    return res.status(200).json({
      success: true,
      nombre: usuario.nombre || usuario.usuario,
      rol: usuario.rol || 'Operador',
      turno: (usuario.turno || 'MAÑANA').toUpperCase(),
      idFisico: usuario.id_fisico || ''
    });
  } catch (err) {
    console.error('Error en validar-usuario:', err);
    return res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};
