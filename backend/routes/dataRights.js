const express = require('express');
const router = express.Router();
const { verificarToken, verificarTokenParaBorrado } = require('../middlewares/auth');
const { object } = require('../middlewares/validateBody');
const rateLimit = require('express-rate-limit');
const rights = require('../utils/dataRights');

// QA-23-03: límite de frecuencia por persona (no por IP). Armar el archivo es costoso; la vista previa vigente se reutiliza.
const perMinute = (name, fallback) => () => { const n = Number(process.env[name]); return Number.isInteger(n) && n > 0 ? n : fallback; };
const limiter = (name, fallback) => rateLimit({
  windowMs: 60 * 1000, limit: perMinute(name, fallback), standardHeaders: true, legacyHeaders: false,
  keyGenerator: (req) => `user:${req.user.id}`,
  handler: (req, res) => res.status(429).json({ code: 'rate_limited', error: 'Demasiadas solicitudes. Espera un minuto. / Too many requests. Wait a minute.' }),
});
const previewLimiter = limiter('DATA_RIGHTS_PREVIEWS_PER_MINUTE', 6);
const downloadLimiter = limiter('DATA_RIGHTS_DOWNLOADS_PER_MINUTE', 12);

router.use(['/exports', '/account/deletion-requests'], (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  res.set('Pragma', 'no-cache');
  res.vary('Authorization');
  next();
});

// Opt-in until dependencies, migration, review and QA are complete.
router.use(['/exports', '/account/deletion-requests'], (req, res, next) => {
  if (process.env.DATA_RIGHTS_ENABLED !== 'true') return res.status(503).json({
    code: 'data_rights_unavailable', error: 'Esta función aún no está disponible. / This feature is not available yet.',
  });
  next();
});

const invalid = res => res.status(400).json({ code: 'invalid_input', error: 'Datos inválidos. / Invalid data.' });
const handle = fn => async (req, res) => {
  try { await fn(req, res); }
  catch (error) {
    if (res.headersSent) return; // Download may have been handed to HTTP before a DB read-transaction commit failed.
    if (error instanceof rights.DataRightsError) return res.status(error.status).json({ code: error.code, error: error.message });
    // QA-23-04: la cuenta cambió a la vez (p. ej. se aceptó un borrado) y el reintento interno tampoco pudo completarse.
    if (rights.isConcurrency(error)) return res.status(409).json({ code: 'concurrent_change', error: 'La cuenta cambió mientras se procesaba la solicitud. Vuelve a intentarlo. / The account changed while the request was processed. Try again.' });
    // Never log DB errors, SQL parameters, payloads or provider responses from this boundary.
    res.status(503).json({ code: 'data_rights_failed', error: 'No se pudo completar la operación. Reintenta. / The operation could not be completed. Retry.' });
  }
};

router.post('/exports/preview', verificarToken, previewLimiter, handle(async (req, res) => {
  const body = req.body;
  if (!object(body) || Object.keys(body).some(k => !['type', 'locale'].includes(k)) ||
      !['personal', 'professional'].includes(body.type) || !['es', 'en'].includes(body.locale)) return invalid(res);
  const result = await rights.preview(req.user.id, body);
  res.status(result.reused ? 200 : 201).json({ id: result.id, expiresAt: result.expiresAt, data: result.data });
}));

router.post('/exports/:id/download', verificarToken, downloadLimiter, handle(async (req, res) => {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(req.params.id)) {
    return res.status(404).json({ code: 'export_not_found', error: 'Exportación no encontrada. / Export not found.' });
  }
  if (req.body !== undefined && (!object(req.body) || Object.keys(req.body).length)) return invalid(res);
  await rights.download(req.user.id, req.params.id, data => {
    res.set('Content-Disposition', 'attachment; filename="elevation-personal.json"');
    res.json(data);
  });
}));

// This narrow middleware accepts an unexpired, otherwise valid existing session
// solely to retry its own deletion request. No data-read or account-reactivation path.
router.post('/account/deletion-requests', verificarTokenParaBorrado, handle(async (req, res) => {
  if (!object(req.body) || req.body.confirm !== true || Object.keys(req.body).some(k => k !== 'confirm')) return invalid(res);
  const result = await rights.requestDeletion(req.user.id);
  res.status(result.repeated ? 200 : 202).json(result);
}));

// API paths never fall through to the SPA (including GETs that could otherwise be cached).
router.use(['/exports', '/account/deletion-requests'], (req, res) => {
  res.status(404).json({ code: 'not_found', error: 'Ruta no encontrada. / Route not found.' });
});

module.exports = router;
