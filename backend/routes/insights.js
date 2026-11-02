// backend/routes/insights.js
// POST /api/insights/proposals — { sources: ['chat'|'diary'], turnIds?, entryIds?, locale } -> propuestas de insights (sin estado; nada se guarda).
// El titular siempre es req.user.id; un ID ajeno es 404. Autorizar un insight es el flujo de ES-25 (/api/career-context/preview y /confirm).
// verificarToken aplicado en server.js.

const express = require('express');
const router = express.Router();
const aiProposals = require('../utils/aiProposals');
const { proposeInsights } = require('../utils/insightProposal');

router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

router.post('/proposals', async (req, res) => {
  try {
    res.json(await proposeInsights(req.user.id, req.body));
  } catch (error) {
    if (aiProposals.respondError(res, error)) return;
    // Nunca se registran textos de la persona.
    console.error('Error en insights:', error && error.name);
    res.status(500).json({ code: 'insights_failed', error: 'No se pudo completar la operación. / The operation could not be completed.' });
  }
});

module.exports = router;
