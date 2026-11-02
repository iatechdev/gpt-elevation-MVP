// backend/routes/resumeSkills.js
// ES-110 — habilidades declaradas en la hoja de vida → «Mis evidencias», solo las que la persona acepta.
//   GET  /api/user/resume-skills          habilidades declaradas (con su clasificación en el catálogo vigente y si ya pasaron)
//   POST /api/user/resume-skills/promote  { requestId, names } crea borradores de evidencia sin nivel; idempotente por requestId
// Solo la persona dueña (propietario de la sesión). verificarToken está montado en server.js.
const router = require('express').Router();
const resumeSkills = require('../utils/resumeSkills');

router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  if (!Number.isSafeInteger(req.user.id) || req.user.id <= 0 || req.user.role !== 'user') return res.status(403).json({ code: 'forbidden', error: 'Acceso no permitido. / Access not allowed.' });
  next();
});
const fail = (res, error) => {
  if (error instanceof resumeSkills.ResumeSkillsError) return res.status(error.status).json({ code: error.code, error: error.message });
  console.error('Error en habilidades de la hoja de vida:', error && (error.code || error.name)); // solo el tipo: nunca contenido
  return res.status(500).json({ code: 'internal_error', error: 'No se pudo completar la operación. / The operation could not be completed.' });
};

router.get('/', async (req, res) => {
  try { res.json({ skills: await resumeSkills.listCandidates(req.user.id) }); } catch (error) { fail(res, error); }
});
router.post('/promote', async (req, res) => {
  try { res.json(await resumeSkills.promote(req.user.id, req.body)); } catch (error) { fail(res, error); }
});
router.use((req, res) => res.status(404).json({ code: 'not_found', error: 'No encontrado. / Not found.' }));
module.exports = router;
