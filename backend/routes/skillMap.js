// backend/routes/skillMap.js
// GET  /api/skill-map       — el mapa de la propia persona: una entrada por habilidad del catálogo vigente (nivel null sin evidencia)
// POST /api/skill-map/self  — { skillKey, level, evidenceRefs, rationale?, requestId } autoevaluación; level null la retira
// El titular siempre es req.user.id. No hay ruta de lectura para administradores, terapeutas ni facilitadores (la revisión humana
// llegará con la consola de facilitación, ES-35). verificarToken aplicado en server.js.

const express = require('express');
const router = express.Router();
const skillMap = require('../utils/skillMap');
const aiProposals = require('../utils/aiProposals');
const { proposeAssessments, confirmProposals } = require('../utils/skillProposal');

router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

const handle = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (error) {
    if (aiProposals.respondError(res, error)) return;
    if (error instanceof skillMap.SkillMapError) {
      const body = { code: error.code, error: error.message };
      if (error.index !== undefined) body.index = error.index;
      return res.status(error.status).json(body);
    }
    console.error('Error en el Skill Map:', error && error.name);
    res.status(500).json({ code: 'skill_map_failed', error: 'No se pudo completar la operación. / The operation could not be completed.' });
  }
};

router.get('/', handle(async (req, res) => { res.json(await skillMap.getMap(req.user.id)); }));

router.post('/self', handle(async (req, res) => {
  const result = await skillMap.selfAssess(req.user.id, req.body);
  if (result.cleared !== undefined) return res.json(result);
  res.status(result.created ? 201 : 200).json(result);
}));

// ES-28: la IA propone evaluaciones desde las evidencias confirmadas; nada se guarda hasta confirmar (y al confirmar solo se puede bajar el nivel).
router.post('/proposals', handle(async (req, res) => { res.json(await proposeAssessments(req.user.id, req.body)); }));
router.post('/proposals/confirm', handle(async (req, res) => {
  const result = await confirmProposals(req.user.id, req.body);
  res.status(result.created ? 201 : 200).json(result);
}));

module.exports = router;
