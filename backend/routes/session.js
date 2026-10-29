// backend/routes/session.js
// POST /api/logout      — cierra la sesión actual
// POST /api/logout-all  — cierra todas las sesiones de la persona
// verificarToken aplicado en server.js

const express = require('express');
const router = express.Router();
const { revokeToken, revokeUserSessions } = require('../utils/sessions');
const User = require('../User');

// ES-74: minimal owner-only reader, explicitly authorised in Jira 10332.
// verificarToken/sessionProblem remain the single source for JWT validity and revocation.
router.get('/session', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.vary('Authorization');
  if (Object.keys(req.query).length) return res.status(400).json({
    code: 'invalid_input', error: 'No se admiten parámetros. / Parameters are not accepted.',
  });
  try {
    const user = await User.findByPk(req.user.id, { attributes: ['role', 'active', 'onboardingCompleted'] });
    if (!user || user.active !== true) return res.status(401).json({
      code: 'session_invalid', error: 'Inicia sesión de nuevo. / Sign in again.',
    });
    if (!['user', 'admin', 'superadmin', 'therapist', 'board'].includes(user.role)
      || typeof user.onboardingCompleted !== 'boolean') return res.status(503).json({
      code: 'session_unavailable', error: 'No se pudo verificar la sesión. / Session verification failed.',
    });
    return res.json({ role: user.role, onboardingCompleted: user.onboardingCompleted });
  } catch {
    return res.status(503).json({
      code: 'session_unavailable', error: 'No se pudo verificar la sesión. / Session verification failed.',
    });
  }
});

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
