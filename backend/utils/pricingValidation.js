// backend/utils/pricingValidation.js
// ES-278 (E216-4): el servidor decide qué es un plan válido, con los rangos de la columna. Toda entrada inválida es un 400 con cuerpo fijo (ES/EN); nunca un 500 de la base,
// y el precio NUNCA se inventa: si falta al crear, se rechaza (antes se guardaba 0,00).
const SLUG = /^[a-z0-9-]{1,20}$/;
const CODE = /^[A-Za-z]{3,10}$/;      // moneda: columna STRING(10)
const PERIOD = /^[a-z]{1,20}$/;      // período: columna STRING(20)
const MAX_PRICE = 99999999.99;       // DECIMAL(10,2)
const MAX_NAME = 255;                // columna STRING
const MAX_DESCRIPTION = 2000;
const MAX_FEATURES = 20;
const MAX_FEATURE = 200;
const MAX_ORDER = 1000000;

const INVALID = Object.freeze({ code: 'invalid_plan', error: 'Datos del plan inválidos. / Invalid plan data.' });
const MESSAGES = Object.freeze({
  slug: 'El identificador usa solo minúsculas, números y guion (máximo 20). / The identifier uses only lowercase letters, numbers and hyphens (max 20).',
  name: 'El nombre debe tener entre 1 y 255 caracteres. / The name must be 1 to 255 characters.',
  description: 'La descripción es demasiado larga. / The description is too long.',
  price: 'El precio debe ser un número entre 0 y 99 999 999,99 con a lo sumo dos decimales. / The price must be a number from 0 to 99,999,999.99 with at most two decimals.',
  price_required: 'El precio es obligatorio. / The price is required.',
  currency: 'La moneda debe ser un código de 3 a 10 letras. / The currency must be a 3 to 10 letter code.',
  period: 'El período debe ser una palabra en minúsculas (máximo 20). / The period must be a lowercase word (max 20).',
  features: 'Las características son una lista de hasta 20 textos de hasta 200 caracteres. / Features are a list of up to 20 texts of up to 200 characters.',
  order: 'El orden debe ser un entero entre 0 y 1 000 000. / The order must be an integer from 0 to 1,000,000.',
});
const fail = (field, key = field) => ({ ok: false, status: 400, body: { code: 'invalid_plan', field, error: MESSAGES[key] || INVALID.error } });

const isText = (v) => typeof v === 'string';
const priceOf = (value) => {
  const raw = typeof value === 'number' ? String(value) : (isText(value) ? value.trim() : '');
  if (!/^\d{1,8}(\.\d{1,2})?$/.test(raw)) return null; // sin signo, sin notación científica y a lo sumo dos decimales
  const n = Number(raw);
  return n >= 0 && n <= MAX_PRICE ? n : null;
};

// -> { ok: true, values } con los campos normalizados que vinieron, o { ok: false, status, body }.
function validatePlan(body, { creating }) {
  const values = {};
  const has = (k) => body[k] !== undefined;
  if (creating || has('slug')) { if (!isText(body.slug) || !SLUG.test(body.slug)) return fail('slug'); values.slug = body.slug; }
  for (const key of ['name_es', 'name_en']) {
    if (creating || has(key)) { if (!isText(body[key]) || !body[key].trim() || body[key].length > MAX_NAME) return fail(key, 'name'); values[key] = body[key].trim(); }
  }
  for (const key of ['description_es', 'description_en']) {
    if (has(key)) { if (body[key] !== null && (!isText(body[key]) || body[key].length > MAX_DESCRIPTION)) return fail(key, 'description'); values[key] = body[key] ?? ''; }
  }
  if (creating && !has('price')) return fail('price', 'price_required'); // nunca se inventa un precio
  if (has('price')) { const price = priceOf(body.price); if (price === null) return fail('price'); values.price = price; }
  if (has('currency')) { if (!isText(body.currency) || !CODE.test(body.currency)) return fail('currency'); values.currency = body.currency.toUpperCase(); }
  if (has('period')) { if (!isText(body.period) || !PERIOD.test(body.period)) return fail('period'); values.period = body.period; }
  for (const key of ['features_es', 'features_en']) {
    if (has(key)) { const list = body[key]; if (!Array.isArray(list) || list.length > MAX_FEATURES || !list.every((f) => isText(f) && f.length <= MAX_FEATURE)) return fail(key, 'features'); values[key] = list; }
  }
  if (has('order')) { const n = Number(body.order); if (!(typeof body.order === 'number' || (isText(body.order) && body.order.trim() !== '')) || !Number.isInteger(n) || n < 0 || n > MAX_ORDER) return fail('order'); values.order = n; }
  for (const key of ['isHighlighted', 'isActive']) if (has(key)) { if (typeof body[key] !== 'boolean') return fail(key, 'flag'); values[key] = body[key]; }
  return { ok: true, values };
}

module.exports = { validatePlan, SLUG, INVALID, MAX_PRICE };
