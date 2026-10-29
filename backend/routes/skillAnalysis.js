// backend/routes/skillAnalysis.js
// Análisis de IA del contexto profesional autorizado (worker, ES-84). El titular siempre es req.user.id; verificarToken aplicado en server.js.
// POST /api/skill-analysis/jobs                    — { requestId } crea el análisis (idempotente por requestId; uno vivo por persona)
// GET  /api/skill-analysis/jobs                    — los últimos análisis de la propia persona
// GET  /api/skill-analysis/jobs/:id                — un análisis con sus candidatas
// POST /api/skill-analysis/jobs/:id/cancel         — cancela un análisis vivo
// GET  /api/skill-analysis/candidates?status=      — candidatas de la propia persona
// POST /api/skill-analysis/candidates/:id/review   — { action: 'accept', level? } | { action: 'reject' }
// No hay ruta de lectura para administradores, terapeutas ni facilitadores. Sin pantalla nueva: el resultado se muestra en la interfaz existente.

const express = require('express');
const router = express.Router();
const analysis = require('../utils/skillAnalysis');

router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

const handle = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (error) {
    if (error instanceof analysis.AnalysisError) {
      const body = { code: error.code, error: error.message };
      if (error.job) body.job = error.job;
      return res.status(error.status).json(body);
    }
    // Nunca se registran textos de la persona ni errores de base de datos con parámetros.
    console.error('Error en el análisis de competencias:', error && error.name);
    res.status(500).json({ code: 'analysis_failed', error: 'No se pudo completar la operación. / The operation could not be completed.' });
  }
};

router.post('/jobs', handle(async (req, res) => {
  const { job, created } = await analysis.createJob(req.user.id, req.body);
  res.status(created ? 201 : 200).json(job);
}));
router.get('/jobs', handle(async (req, res) => { res.json(await analysis.listJobs(req.user.id)); }));
router.get('/jobs/:id', handle(async (req, res) => { res.json(await analysis.getJob(req.user.id, req.params.id)); }));
router.post('/jobs/:id/cancel', handle(async (req, res) => { res.json(await analysis.cancelJob(req.user.id, req.params.id)); }));
router.get('/candidates', handle(async (req, res) => { res.json(await analysis.listCandidates(req.user.id, req.query)); }));
router.post('/candidates/:id/review', handle(async (req, res) => { res.json(await analysis.reviewCandidate(req.user.id, req.params.id, req.body)); }));

module.exports = router;
