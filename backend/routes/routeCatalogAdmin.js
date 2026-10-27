// backend/routes/routeCatalogAdmin.js — backoffice (ES-31). Montada en /api/admin/route-catalog con verificarAdmin (roles admin y superadmin).
// GET    /                    — versiones del catálogo
// POST   /                    — crea el borrador (copia el vigente)
// GET    /:id                 — una versión con sus elementos y lo que falta para publicar
// PUT    /:id/:kind/:key      — crea o reemplaza un elemento del borrador (kind: contexts | sources | roles | offers | resources)
// DELETE /:id/:kind/:key      — quita un elemento del borrador
// POST   /:id/publish         — publica el borrador (inmutable desde ese momento)

const express = require('express');
const router = express.Router();
const catalog = require('../utils/routeCatalog');

router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

const handle = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (error) {
    if (error instanceof catalog.CatalogError) {
      const body = { code: error.code, error: error.message };
      if (error.missing) body.missing = error.missing;
      if (error.draftId !== undefined) body.draftId = error.draftId;
      return res.status(error.status).json(body);
    }
    console.error('Error en el catálogo de rutas:', error && error.name);
    res.status(500).json({ code: 'catalog_failed', error: 'No se pudo completar la operación. / The operation could not be completed.' });
  }
};

const idOf = (req) => (/^[0-9]{1,9}$/.test(req.params.id) ? Number(req.params.id) : 0);

router.get('/', handle(async (req, res) => { res.json(await catalog.list()); }));
router.post('/', handle(async (req, res) => { res.status(201).json(await catalog.createDraft()); }));
router.get('/:id', handle(async (req, res) => { res.json(await catalog.get(idOf(req))); }));
router.put('/:id/:kind/:key', handle(async (req, res) => { res.json(await catalog.upsertItem(idOf(req), req.params.kind, req.params.key, req.body)); }));
router.delete('/:id/:kind/:key', handle(async (req, res) => { res.json(await catalog.removeItem(idOf(req), req.params.kind, req.params.key)); }));
router.post('/:id/publish', handle(async (req, res) => { res.json(await catalog.publish(idOf(req), req.user.id)); }));

module.exports = router;
