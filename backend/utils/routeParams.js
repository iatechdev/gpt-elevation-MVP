// ES-280 (ES-189 PR-1) · Parámetros de ruta: un id entero que no existe o no cabe en la columna es un 404 (no encontrado), nunca un 500 de la base ni un texto de PostgreSQL en la
// respuesta. Un único lugar para todas las rutas (antes, cada una con su propia expresión o sin ninguna). Los ids son enteros positivos de 32 bits (columnas INTEGER de PostgreSQL).
const MAX_INT32 = 2147483647;
const isIntId = (value) => typeof value === 'string' && /^[1-9][0-9]{0,9}$/.test(value) && Number(value) <= MAX_INT32;

// Callback para `router.param('id', intIdParam({...}))`: responde 404 con el cuerpo dado si el id no es un entero válido.
const intIdParam = (notFoundBody) => (req, res, next, value) => (isIntId(value) ? next() : res.status(404).json(notFoundBody));
// Middleware para `router.post('/x/:id', intIdGuard(name, body), ...)` cuando el nombre del parámetro no es `id`.
const intIdGuard = (name, notFoundBody) => (req, res, next) => (isIntId(req.params[name]) ? next() : res.status(404).json(notFoundBody));

module.exports = { MAX_INT32, isIntId, intIdParam, intIdGuard };
