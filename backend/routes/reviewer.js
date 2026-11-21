// backend/routes/reviewer.js
// ES-175 (HU-P24) — lado MÍNIMO del revisor (usuario con rol `therapist`; sin pantallas). Solo ve lo que la persona autorizó, con la autorización vigente en cada acceso,
// y a la persona como alias «Persona n». Nunca crisis, diario, chat ni correo.
//   GET  /api/reviewer/shares                       — material autorizado vigente
//   POST /api/reviewer/reviews                      — registra una revisión inmutable { shareId, evidenceIds, observation, limits, locale, requestId, supersedesId? }
//   GET  /api/reviewer/objections                   — objeciones recibidas
//   POST /api/reviewer/objections/:id/response      — { text, requestId, locale } (una por objeción)
//   POST   /api/reviewer/invites                    — ES-303: { requestId } emite una invitación de un solo uso (el código sale UNA vez)
//   GET    /api/reviewer/invites                    — mis invitaciones (estado y fechas; nunca el código ni quién la canjeó)
//   DELETE /api/reviewer/invites/:id                — anula una invitación activa
// verificarTerapeuta aplicado en server.js.
const express = require('express');
const router = express.Router();
const reviews = require('../utils/reviews');
const reviewInvites = require('../utils/reviewInvites');
const { validateIdParams } = require('../middlewares/params');

router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
validateIdParams(router, 'id');

const handle = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (error) {
    if (error instanceof reviews.ReviewError || error instanceof reviewInvites.InviteError) return res.status(error.status).json({ code: error.code, error: error.message, ...(error.max ? { max: error.max } : {}) });
    console.error('Error en el lado del revisor:', error && error.name);
    res.status(500).json({ code: 'reviews_failed', error: 'No se pudo completar la operación. / The operation could not be completed.' });
  }
};

router.post('/invites', handle(async (req, res) => {
  if (!await reviews.reviewerOf(req.user.id)) throw new reviewInvites.InviteError(403, 'not_allowed', 'No puedes emitir invitaciones.', 'You cannot issue invitations.'); // rol y cuenta activa vigentes en la base, no solo en el token
  const out = await reviewInvites.issue(req.user, req.body);
  res.status(out.replay ? 200 : 201).json(out.replay ? { invite: out.invite } : { invite: out.invite, code: out.code });
}));
router.get('/invites', handle(async (req, res) => res.json({ invites: await reviewInvites.listForReviewer(req.user.id) })));
router.delete('/invites/:id', handle(async (req, res) => res.json({ invite: await reviewInvites.revoke(req.user.id, Number(req.params.id)) })));
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
