// backend/routes/consents.js
// GET /api/consents          — estado por propósito de la persona autenticada
// GET /api/consents/history  — historial de sus decisiones
// PUT /api/consents/:purpose — { status: 'granted' | 'revoked', scope? }
// Solo la propia persona: el titular siempre es req.user.id (nunca un identificador del cuerpo ni de la ruta).
// verificarToken aplicado en server.js

const express = require('express');
const router = express.Router();
const { validateBody, optional } = require('../middlewares/validateBody');
const {
  PURPOSES, SCOPES, STATUSES, DEFAULT_SCOPE, isPurpose, setConsent, listConsents, listHistory,
} = require('../utils/consent');

router.get('/', async (req, res) => {
  try {
    res.json({ consents: await listConsents(req.user.id) });
  } catch (error) {
    console.error('❌ Error listando consentimientos:', error.message);
    res.status(500).json({ error: 'No se pudieron obtener los consentimientos.' });
  }
});

router.get('/history', async (req, res) => {
  try {
    res.json({ history: await listHistory(req.user.id) });
  } catch (error) {
    console.error('❌ Error listando historial de consentimientos:', error.message);
    res.status(500).json({ error: 'No se pudo obtener el historial.' });
  }
});

router.put('/:purpose', validateBody({
  status: (value) => STATUSES.includes(value),
  scope: optional((value) => SCOPES.includes(value)),
}), async (req, res) => {
  const { purpose } = req.params;
  if (!isPurpose(purpose)) {
    return res.status(404).json({ error: 'Propósito desconocido. / Unknown purpose.' });
  }
  const { status } = req.body;
  if (PURPOSES[purpose].required && status === 'revoked') {
    return res.status(409).json({
      error: 'El uso necesario no se puede revocar; elimina la cuenta si no quieres continuar. / Necessary processing cannot be revoked; delete your account instead.',
      code: 'necessary_not_revocable',
    });
  }
  try {
    const { row, changed } = await setConsent(req.user.id, purpose, status, req.body.scope ?? DEFAULT_SCOPE);
    res.json({
      purpose, scope: row.scope, status: row.status, version: row.version, decidedAt: row.decidedAt, changed,
    });
  } catch (error) {
    console.error('❌ Error guardando consentimiento:', error.message);
    res.status(500).json({ error: 'No se pudo guardar la decisión.' });
  }
});

module.exports = router;
