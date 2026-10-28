// ES-32: todo pertenece al principal de servidor, sin lectura por terceros ni bypass admin.
const router = require('express').Router();
const routes = require('../utils/routes');
router.use(async (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  try {
    await routes.authorize(req.user.id);
    const keys = Object.keys(req.query);
    if (keys.some(key => !(req.path === '/choices' && req.method === 'GET' && key === 'after'))) return res.status(400).json({ code: 'invalid_input', error: 'Datos inválidos. / Invalid data.' });
    next();
  } catch (error) { respond(res, error); }
});
function respond(res, error) {
  if (error.status && error.code) return res.status(error.status).json({ code: error.code, error: error.message });
  // No registrar SQL, payload, nota, huella ni tokens.
  return res.status(503).json({ code: 'routes_unavailable', error: 'Rutas no disponibles. / Routes unavailable.' });
}
const handle = fn => async (req, res) => { try { await fn(req, res); } catch (error) { respond(res, error); } };
router.get('/', handle(async (req, res) => res.json(await routes.getRoutes(req.user.id))));
router.get('/constraints', handle(async (req, res) => res.json(await routes.getConstraints(req.user.id))));
router.put('/constraints', handle(async (req, res) => { const result = await routes.putConstraints(req.user.id, req.body); res.status(result.created ? 201 : 200).json(result); }));
router.get('/choices', handle(async (req, res) => {
  const after = req.query.after === undefined ? 0 : Number(req.query.after);
  if (!Number.isSafeInteger(after) || after < 0 || (req.query.after !== undefined && !/^\d+$/.test(req.query.after))) return res.status(400).json({ code: 'invalid_input', error: 'Datos inválidos. / Invalid data.' });
  res.json(await routes.listChoices(req.user.id, after));
}));
router.get('/choices/:id', handle(async (req, res) => {
  const id = Number(req.params.id);
  if (!/^\d+$/.test(req.params.id) || !Number.isSafeInteger(id) || id < 1) return res.status(404).json({ code: 'route_record_not_found', error: 'Registro no encontrado. / Record not found.' });
  res.json(await routes.getChoice(req.user.id, id));
}));
router.post('/choices', handle(async (req, res) => { const result = await routes.choose(req.user.id, req.body); res.status(result.created ? 201 : 200).json(result); }));
router.get('/review-requests', handle(async (req, res) => res.json(await routes.getReview(req.user.id))));
router.post('/review-requests', handle(async (req, res) => { const result = await routes.requestReview(req.user.id, req.body); res.status(result.created ? 201 : 200).json(result); }));
router.use((req, res) => res.status(404).json({ code: 'not_found', error: 'Ruta no encontrada. / Route not found.' }));
module.exports = router;
