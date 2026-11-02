// backend/middlewares/params.js
// Ids de ruta (ES-98, ES93-B1): un id no numérico, negativo, con decimales o mayor que un INTEGER de Postgres nunca debe llegar a una consulta.
// Antes producía un 500 por el error de sintaxis de la base; ahora es el mismo 404 uniforme que un recurso que no existe o que no es tuyo
// (no se revela nada sobre la existencia). El mensaje es bilingüe y no repite la entrada.

const MAX_INT = 2147483647;
const isRouteId = (value) => typeof value === 'string' && /^[1-9][0-9]{0,9}$/.test(value) && Number(value) <= MAX_INT;

const notFound = (res) => res.status(404).json({ code: 'not_found', error: 'No se encontró. / Not found.' });

// Registra la validación para los parámetros indicados en un router: router.param(nombre, ...) se ejecuta antes de cualquier ruta que lo use.
function validateIdParams(router, ...names) {
  for (const name of names) {
    router.param(name, (req, res, next, value) => (isRouteId(value) ? next() : notFound(res)));
  }
}

module.exports = { isRouteId, validateIdParams, MAX_INT };
