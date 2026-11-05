module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Método no permitido' });
  }

  return res.status(200).json({
    success: true,
    message: 'Triggers de reportes programados configurados activamente en Vercel Cron.'
  });
};

