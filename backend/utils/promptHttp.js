// ES-191: respuestas HTTP comunes de la revisión de guías de la IA (rutas de administración y de profesionales).
// Nunca devuelve el texto de la guía ni datos de la persona: solo el resultado y los motivos legibles en ES y EN.
const { describeReasons, PromptReviewError } = require('./promptReview');

const KEY = /^[A-Za-z0-9_.:-]{1,100}$/;

const replyProposal = (res, result) => {
  if (result.status === 'rejected') {
    return res.status(422).json({
      code: 'prompt_rejected',
      error: 'La revisión automática rechazó la guía. / The automatic review rejected the guide.',
      version: { id: result.id, version: result.version, status: 'rejected' },
      reasons: describeReasons(result.reasons),
    });
  }
  return res.json({
    message: 'Propuesta enviada para aprobación humana. / Proposal sent for human approval.',
    version: { id: result.id, version: result.version, status: 'pending_review' },
    review: { outcome: 'passed', pendingHumanApproval: true },
  });
};

// Devuelve true si respondió (el error era de la revisión).
const replyReviewError = (res, error) => {
  if (!(error instanceof PromptReviewError)) return false;
  if (error.code === 'rules_unavailable') {
    res.status(503).json({ code: 'prompt_rules_unavailable', error: 'La revisión no está disponible ahora. Reintenta más tarde. / The review is not available right now. Try again later.' });
  } else if (error.code === 'not_found') {
    res.status(404).json({ error: 'Versión no encontrada. / Version not found.' });
  } else if (error.code === 'not_pending') {
    res.status(409).json({ code: 'not_pending', error: 'La versión no está pendiente de revisión. / The version is not pending review.' });
  } else if (error.code === 'key_exists') {
    res.status(409).json({ code: 'key_exists', error: 'Ya existe una guía con ese identificador. / A guide with that identifier already exists.' });
  } else if (error.code === 'pending_exists') {
    res.status(409).json({ code: 'pending_exists', error: 'You already have a version pending review. Wait for superadmin approval before proposing a new one.' });
  } else if (error.code === 'rate_limited') {
    res.status(429).json({ code: 'rate_limited', error: 'Demasiadas propuestas seguidas. Espera un rato. / Too many proposals in a row. Wait a while.' });
  } else {
    res.status(422).json({
      code: 'prompt_review_failed',
      error: 'La versión no supera la revisión automática. / The version does not pass the automatic review.',
      reasons: describeReasons(error.reasons),
    });
  }
  return true;
};

module.exports = { KEY, replyProposal, replyReviewError };
