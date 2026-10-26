// backend/routes/session.js
// POST /api/logout      — cierra la sesión actual
// POST /api/logout-all  — cierra todas las sesiones de la persona
// verificarToken aplicado en server.js

const express = require('express');
const router = express.Router();
const { revokeToken, revokeUserSessions } = require('../utils/sessions');

router.post('/logout', async (req, res) => {
  try {
    await revokeToken(req.user);
    res.json({ message: 'Sesión cerrada.' });
  } catch (error) {
    console.error('❌ Error cerrando sesión:', error.message);
    res.status(500).json({ error: 'No se pudo cerrar la sesión.' });
  }
});

router.post('/logout-all', async (req, res) => {
  try {
    await revokeUserSessions(req.user.id);
    res.json({ message: 'Todas las sesiones cerradas.' });
  } catch (error) {
    console.error('❌ Error cerrando sesiones:', error.message);
    res.status(500).json({ error: 'No se pudieron cerrar las sesiones.' });
  }
});

module.exports = router;
