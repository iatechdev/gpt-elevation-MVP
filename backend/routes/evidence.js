// backend/routes/evidence.js
// POST   /api/evidence      — { payload, status, requestId, origins? } -> crea una evidencia (idempotente por requestId)
// PUT    /api/evidence/:id  — { payload, status, baseVersion, requestId, origins? } -> versión nueva
// GET    /api/evidence      — evidencias propias (versión vigente)
// GET    /api/evidence/:id  — una evidencia propia con su historial
// DELETE /api/evidence/:id  — borra (vacía el contenido, registra la invalidación)
// El titular siempre es req.user.id; un ID ajeno es 404. No hay ruta de lectura para administradores, terapeutas ni facilitadores:
// el motor lee solo mediante utils/evidence.getConfirmedEvidence. verificarToken aplicado en server.js.

const express = require('express');
const router = express.Router();
const evidence = require('../utils/evidence');
const aiProposals = require('../utils/aiProposals');
const { proposeEvidence } = require('../utils/evidenceProposal');

router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

const handle = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (error) {
    if (aiProposals.respondError(res, error)) return;
    if (error instanceof evidence.EvidenceError) {
      const body = { code: error.code, error: error.message };
      if (error.missing) body.missing = error.missing;
      if (error.currentVersion !== undefined) body.currentVersion = error.currentVersion;
      return res.status(error.status).json(body);
    }
    // Nunca se registran textos de la persona ni errores de base de datos con parámetros.
    console.error('Error en evidencia:', error && error.name);
    res.status(500).json({ code: 'evidence_failed', error: 'No se pudo completar la operación. / The operation could not be completed.' });
  }
};

const idOf = (req) => (/^[0-9]{1,9}$/.test(req.params.id) ? Number(req.params.id) : 0);

// ES-28: borrador de evidencia propuesto por la IA desde turnos del chat. No guarda nada; la persona lo confirma con POST /api/evidence.
router.post('/proposals', handle(async (req, res) => {
  res.json(await proposeEvidence(req.user.id, req.body));
}));

router.post('/', handle(async (req, res) => {
  const result = await evidence.create(req.user.id, req.body);
  res.status(result.created ? 201 : 200).json(result);
}));

router.put('/:id', handle(async (req, res) => {
  const result = await evidence.update(req.user.id, idOf(req), req.body);
  res.status(result.created ? 201 : 200).json(result);
}));

router.get('/', handle(async (req, res) => {
  res.json(await evidence.list(req.user.id));
}));

router.get('/:id', handle(async (req, res) => {
  res.json(await evidence.get(req.user.id, idOf(req)));
}));

router.delete('/:id', handle(async (req, res) => {
  res.json(await evidence.remove(req.user.id, idOf(req)));
}));

module.exports = router;
