// backend/routes/skillCatalog.js — backoffice (ES-29). Montada en /api/admin/skill-catalog con verificarAdmin (roles admin y superadmin).
// GET    /                         — versiones del catálogo
// POST   /                         — crea el borrador (copia el vigente)
// GET    /:id                      — una versión con sus habilidades y lo que falta para publicar
// PUT    /:id/skills/:skillKey     — crea o reemplaza una habilidad del borrador
// DELETE /:id/skills/:skillKey     — quita una habilidad del borrador
// POST   /:id/publish              — publica el borrador (inmutable desde ese momento)

const express = require('express');
const router = express.Router();
const catalog = require('../utils/skillCatalog');

router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

const handle = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (error) {
    if (error instanceof catalog.SkillError) {
      const body = { code: error.code, error: error.message };
      if (error.missing) body.missing = error.missing;
      if (error.draftId !== undefined) body.draftId = error.draftId;
      return res.status(error.status).json(body);
    }
    console.error('Error en el catálogo de habilidades:', error && error.name);
    res.status(500).json({ code: 'catalog_failed', error: 'No se pudo completar la operación. / The operation could not be completed.' });
  }
};

const idOf = (req) => (/^[0-9]{1,9}$/.test(req.params.id) ? Number(req.params.id) : 0);

router.get('/', handle(async (req, res) => { res.json(await catalog.list()); }));
router.post('/', handle(async (req, res) => { res.status(201).json(await catalog.createDraft()); }));
router.get('/:id', handle(async (req, res) => { res.json(await catalog.get(idOf(req))); }));
router.put('/:id/skills/:skillKey', handle(async (req, res) => { res.json(await catalog.upsertSkill(idOf(req), req.params.skillKey, req.body)); }));
router.delete('/:id/skills/:skillKey', handle(async (req, res) => { res.json(await catalog.removeSkill(idOf(req), req.params.skillKey)); }));
router.post('/:id/publish', handle(async (req, res) => { res.json(await catalog.publish(idOf(req), req.user.id)); }));

module.exports = router;
