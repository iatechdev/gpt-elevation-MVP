// backend/routes/professionalReviews.js
// ES-175 (HU-P24) — la PERSONA ve lo que recibió, objeta y autoriza/retira.
//   GET    /api/me/professional-reviews                  — mis revisiones recibidas (con mi objeción y la respuesta)
//   POST   /api/me/professional-reviews/:id/objection    — { reason, requestId, locale } (una por revisión)
//   GET    /api/me/review-shares                         — mis autorizaciones
//   POST   /api/me/review-shares                         — { reviewerId, evidenceIds, requestId } autoriza a UN revisor sobre evidencias mías
//   DELETE /api/me/review-shares/:id                     — retira
// El titular siempre es req.user.id. Un id ajeno responde el mismo 404 que uno inexistente. verificarToken aplicado en server.js.
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
    console.error('Error en revisiones profesionales:', error && error.name); // nunca textos de la persona ni parámetros de base de datos
    res.status(500).json({ code: 'reviews_failed', error: 'No se pudo completar la operación. / The operation could not be completed.' });
  }
};

router.get('/professional-reviews', handle(async (req, res) => res.json({ reviews: await reviews.listReviews(req.user.id) })));
router.post('/professional-reviews/:id/objection', handle(async (req, res) => {
  const out = await reviews.object(req.user.id, Number(req.params.id), req.body);
  res.status(out.replay ? 200 : 201).json({ objection: { id: out.id, reviewId: out.reviewId, createdAt: out.createdAt } });
}));
router.get('/review-shares', handle(async (req, res) => res.json({ shares: await reviews.listShares(req.user.id) })));
router.post('/review-shares', handle(async (req, res) => res.status(201).json({ share: await reviews.authorize(req.user.id, req.body) })));
router.delete('/review-shares/:id', handle(async (req, res) => res.json({ share: await reviews.revoke(req.user.id, Number(req.params.id)) })));

module.exports = router;
