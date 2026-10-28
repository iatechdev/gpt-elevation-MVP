// backend/routes/routeCatalog.js — lectura para personas autenticadas (ES-31). Solo lo PUBLICADO, con la frescura ya calculada.
// GET /api/route-catalog                  — catálogo vigente (contextos, fuentes, roles, ofertas, recursos)
// GET /api/route-catalog/roles/:roleKey   — una ficha de rol con sus fuentes, ofertas y recursos
// No se publican nombres de quien revisó o consultó. verificarToken aplicado en server.js.

const express = require('express');
const router = express.Router();
const catalog = require('../utils/routeCatalog');

router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

const unavailable = (res) => res.status(503).json({ code: 'catalog_unavailable', error: 'El catálogo de rutas aún no está disponible. / The route catalog is not available yet.' });

router.get('/', async (req, res) => {
  try {
    const published = await catalog.getPublishedRouteCatalog();
    if (!published) return unavailable(res);
    res.json(published);
  } catch (error) {
    console.error('Error leyendo el catálogo de rutas:', error && error.name);
    res.status(500).json({ code: 'catalog_failed', error: 'No se pudo completar la operación. / The operation could not be completed.' });
  }
});

router.get('/roles/:roleKey', async (req, res) => {
  try {
    const published = await catalog.getPublishedRouteCatalog();
    if (!published) return unavailable(res);
    const role = published.roles.find((r) => r.roleKey === req.params.roleKey);
    if (!role) return res.status(404).json({ code: 'role_not_found', error: 'Ficha no encontrada. / Role profile not found.' });
    res.json({
      version: published.version,
      role,
      sources: published.sources.filter((s) => (role.sourceKeys || []).includes(s.sourceKey)),
      offers: published.offers.filter((o) => o.roleKey === role.roleKey),
      resources: published.resources.filter((r) => (r.roleKeys || []).includes(role.roleKey)),
    });
  } catch (error) {
    console.error('Error leyendo la ficha de rol:', error && error.name);
    res.status(500).json({ code: 'catalog_failed', error: 'No se pudo completar la operación. / The operation could not be completed.' });
  }
});

module.exports = router;
