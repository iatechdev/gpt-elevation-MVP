// ES-278 (H1, hallazgo de QA-Claude-4 sobre #348): el servidor solo acepta las monedas y los períodos que la pantalla de planes ofrece (USD/COP/EUR y month/year/forever).
// Antes aceptaba cualquier código de 3 a 10 letras y cualquier palabra en minúsculas (XXX, «decada») con 201. Prueba de la función pura; la de HTTP + PostgreSQL está en integration/es-278-postgres.cjs.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validatePlan, CURRENCIES, PERIODS } = require('../utils/pricingValidation');

const base = { slug: 'plan', name_es: 'Plan', name_en: 'Plan', price: 10 };

test('ES-278 H1: las listas coinciden con lo que ofrece la pantalla de administración', () => {
  assert.deepEqual([...CURRENCIES], ['USD', 'COP', 'EUR']);
  assert.deepEqual([...PERIODS], ['month', 'year', 'forever']);
  const screen = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', '..', 'frontend', 'src', 'pages', 'admin', 'AdminContent.tsx'), 'utf8');
  for (const c of CURRENCIES) assert.ok(screen.includes(`<option value="${c}">`), `la pantalla ofrece ${c}`);
  for (const p of PERIODS) assert.ok(screen.includes(`<option value="${p}">`), `la pantalla ofrece ${p}`);
});

test('ES-278 H1: monedas y períodos válidos se aceptan (la moneda se normaliza a mayúsculas)', () => {
  for (const currency of ['USD', 'usd', 'COP', 'eur']) assert.equal(validatePlan({ ...base, currency }, { creating: true }).values.currency, currency.toUpperCase());
  for (const period of PERIODS) assert.equal(validatePlan({ ...base, period }, { creating: true }).values.period, period);
});

test('ES-278 H1: monedas y períodos que no existen (o que la pantalla no ofrece) son 400 con el campo y mensaje ES/EN', () => {
  for (const currency of ['XXX', 'JPY', 'ABC', 'US', 'USD1', '', 5, null]) {
    const out = validatePlan({ ...base, currency }, { creating: true });
    assert.equal(out.ok, false, String(currency)); assert.equal(out.status, 400); assert.equal(out.body.field, 'currency'); assert.match(out.body.error, / \/ /);
  }
  for (const period of ['decada', 'week', 'Month', 'month ', '', 3, null]) {
    const out = validatePlan({ ...base, period }, { creating: true });
    assert.equal(out.ok, false, String(period)); assert.equal(out.status, 400); assert.equal(out.body.field, 'period'); assert.match(out.body.error, / \/ /);
  }
});

test('ES-278 H1: al editar, una edición parcial sin moneda ni período no los exige; con un valor inválido se rechaza', () => {
  assert.equal(validatePlan({ price: 5 }, { creating: false }).ok, true);
  assert.equal(validatePlan({ currency: 'XXX' }, { creating: false }).ok, false);
  assert.equal(validatePlan({ period: 'decada' }, { creating: false }).ok, false);
});

test('ES-278 H1: los mensajes de error de moneda y período son bilingües y dicen los valores válidos (texto de API fijado)', () => {
  const currency = validatePlan({ ...base, currency: 'XXX' }, { creating: true }).body;
  assert.equal(currency.code, 'invalid_plan');
  assert.equal(currency.error, 'La moneda debe ser USD, COP o EUR. / The currency must be USD, COP or EUR.');
  const period = validatePlan({ ...base, period: 'decada' }, { creating: true }).body;
  assert.equal(period.error, 'El período debe ser month, year o forever. / The period must be month, year or forever.');
});
