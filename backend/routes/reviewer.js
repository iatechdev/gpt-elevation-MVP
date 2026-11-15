// backend/routes/reviewer.js
// ES-175 (HU-P24) — lado MÍNIMO del revisor (usuario con rol `therapist`; sin pantallas). Solo ve lo que la persona autorizó, con la autorización vigente en cada acceso,
// y a la persona como alias «Persona n». Nunca crisis, diario, chat ni correo.
//   GET  /api/reviewer/shares                       — material autorizado vigente
//   POST /api/reviewer/reviews                      — registra una revisión inmutable { shareId, evidenceIds, observation, limits, locale, requestId, supersedesId? }
//   GET  /api/reviewer/objections                   — objeciones recibidas
//   POST /api/reviewer/objections/:id/response      — { text, requestId, locale } (una por objeción)
// verificarTerapeuta aplicado en server.js.
const express = require('express');
const router = express.Router();
const reviews = require('../utils/reviews');
const { validateIdParams } = require('../middlewares/params');

router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
validateIdParams(router, 'id');

const handle = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (error) {
    if (error instanceof reviews.ReviewError) return res.status(error.status).json({ code: error.code, error: error.message, ...(error.max ? { max: error.max } : {}) });
    console.error('Error en el lado del revisor:', error && error.name);
    res.status(500).json({ code: 'reviews_failed', error: 'No se pudo completar la operación. / The operation could not be completed.' });
  }
};

router.get('/shares', handle(async (req, res) => res.json({ shares: await reviews.reviewerShares(req.user.id) })));
router.post('/reviews', handle(async (req, res) => {
  const out = await reviews.createReview(req.user.id, req.body);
  res.status(out.replay ? 200 : 201).json({ review: { id: out.id, createdAt: out.createdAt } });
}));
router.get('/objections', handle(async (req, res) => res.json({ objections: await reviews.reviewerObjections(req.user.id) })));
router.post('/objections/:id/response', handle(async (req, res) => {
  const out = await reviews.respond(req.user.id, Number(req.params.id), req.body);
  res.status(out.replay ? 200 : 201).json({ response: { id: out.id, createdAt: out.createdAt } });
}));

module.exports = router;
