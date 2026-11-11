// Validate before queries, hashing, encryption or provider calls. Never echo input.
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = value => typeof value === 'string';
const nonempty = value => text(value) && value.trim().length > 0;
const optional = check => value => value === undefined || check(value);
const nullable = check => value => value === null || check(value);
const numeric = value => (typeof value === 'number' || (text(value) && value.trim() !== ''))
  && Number.isFinite(Number(value));
const id = value => numeric(value) && Number.isSafeInteger(Number(value)) && Number(value) > 0;
const date = value => nonempty(value) && Number.isFinite(Date.parse(value));
const score = value => Number.isInteger(value) && value >= 1 && value <= 5;
const boolean = value => typeof value === 'boolean';
const textArray = value => Array.isArray(value) && value.every(text);

function validateBody(schema) {
  return (req, res, next) => {
    if (!object(req.body)) return res.status(400).json({ code: 'invalid_input', error: 'Datos de entrada inválidos. / Invalid input data.' });
    const failed = Object.entries(schema).find(([key, check]) => !check(req.body[key]));
    if (failed) {
      // ES-178: `code` y `field` permiten a la pantalla marcar el campo; el mensaje de siempre se conserva y nunca se repite lo recibido.
      return res.status(400).json({ code: 'invalid_input', field: failed[0], error: 'Datos de entrada inválidos. / Invalid input data.' });
    }
    next();
  };
}

module.exports = { validateBody, object, text, nonempty, optional, nullable, numeric, id, date, score, boolean, textArray };
