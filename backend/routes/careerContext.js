// backend/routes/careerContext.js
// POST /api/career-context/preview  — { fields:[{key,text,origin?}] } -> vista previa exacta + token (10 min). No guarda nada.
// POST /api/career-context/confirm  — { fields, token, requestId } -> crea la versión aprobada (idempotente por requestId)
// POST /api/career-context/revoke   — revoca la versión activa
// GET  /api/career-context          — versión activa e historial de la propia persona
// El titular siempre es req.user.id. No hay ruta de lectura para administradores, terapeutas ni facilitadores: el motor
// profesional lee solo mediante utils/careerContext.getApprovedContext. verificarToken aplicado en server.js.

const express = require('express');
const router = express.Router();
const { object } = require('../middlewares/validateBody');
const bridge = require('../utils/careerContext');

router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

const handle = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (error) {
    if (error instanceof bridge.BridgeError) {
      const body = { code: error.code, error: error.message };
      if (error.fieldIndex !== undefined) body.fieldIndex = error.fieldIndex;
      return res.status(error.status).json(body);
    }
    // Nunca se registran textos de la persona ni errores de base de datos con parámetros.
    console.error('Error en el puente profesional:', error && error.name);
    res.status(500).json({ code: 'bridge_failed', error: 'No se pudo completar la operación. / The operation could not be completed.' });
  }
};

const invalid = (res) => res.status(400).json({ code: 'invalid_input', error: 'Datos inválidos. / Invalid data.' });
const only = (body, keys) => object(body) && Object.keys(body).every((k) => keys.includes(k));

router.post('/preview', handle(async (req, res) => {
  if (!only(req.body, ['fields', 'locale']) || (req.body.locale !== undefined && !['es', 'en'].includes(req.body.locale))) return invalid(res);
  res.json(await bridge.preview(req.user.id, req.body));
}));

router.post('/confirm', handle(async (req, res) => {
  if (!only(req.body, ['fields', 'token', 'requestId'])) return invalid(res);
  const { record, created } = await bridge.confirm(req.user.id, req.body);
  res.status(created ? 201 : 200).json(record);
}));

router.post('/revoke', handle(async (req, res) => {
  if (req.body !== undefined && !only(req.body, [])) return invalid(res);
  res.json(await bridge.revoke(req.user.id));
}));

router.get('/', handle(async (req, res) => {
  res.json(await bridge.list(req.user.id));
}));

module.exports = router;
