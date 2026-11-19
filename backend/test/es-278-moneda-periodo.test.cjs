// ES-278 (H1, hallazgo de QA-Claude-4 sobre #348): el servidor solo acepta las monedas y los períodos que la pantalla de planes ofrece (USD/COP/EUR y month/year; E366-1 retiró `forever`).
// Antes aceptaba cualquier código de 3 a 10 letras y cualquier palabra en minúsculas (XXX, «decada») con 201. Prueba de la función pura; la de HTTP + PostgreSQL está en integration/es-278-postgres.cjs.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validatePlan, CURRENCIES, PERIODS } = require('../utils/pricingValidation');

const base = { slug: 'plan', name_es: 'Plan', name_en: 'Plan', price: 10 };

test('ES-278 H1: las listas coinciden con lo que ofrece la pantalla de administración', () => {
  assert.deepEqual([...CURRENCIES], ['USD', 'COP', 'EUR']);
  assert.deepEqual([...PERIODS], ['month', 'year']); // E366-1: `forever` retirado (la pantalla pública solo dibuja month y year)
  const screen = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', '..', 'frontend', 'src', 'pages', 'admin', 'AdminContent.tsx'), 'utf8');
  for (const c of CURRENCIES) assert.ok(screen.includes(`<option value="${c}">`), `la pantalla ofrece ${c}`);
  for (const p of PERIODS) assert.ok(screen.includes(`<option value="${p}">`), `la pantalla ofrece ${p}`);
  assert.ok(!screen.includes('<option value="forever">'), 'el desplegable ya no ofrece «forever» (E366-1)');
});

// E366-1 (ALTO, QA-Claude-2 sobre #366): un período que el servidor acepta pero la pantalla pública no sabe dibujar tumba /pricing para todas las personas. La lista del servidor DEBE ser un subconjunto
// de lo que admite parsePlans (frontend/src/pricing/plans.ts) y tener su texto ES/EN en shared/landing-content.json: si alguien añade un período aquí sin soportarlo allí, esta prueba falla.
test('ES-278 E366-1: los períodos del servidor son un subconjunto de los que dibuja la pantalla pública (y tienen su texto ES/EN)', () => {
  const fs = require('node:fs'); const path = require('node:path');
  const root = path.join(__dirname, '..', '..');
  const line = fs.readFileSync(path.join(root, 'frontend', 'src', 'pricing', 'plans.ts'), 'utf8').split('\n').find((l) => l.includes('String(raw.period)')) ?? '';
  assert.ok(line.includes("'month'") && line.includes("'year'") && !line.includes("'forever'"), `parsePlans admite exactamente month y year: ${line.trim()}`);
  for (const p of PERIODS) assert.ok(line.includes(`'${p}'`), `parsePlans admite ${p}`);
  const texts = Object.fromEntries(JSON.parse(fs.readFileSync(path.join(root, 'shared', 'landing-content.json'), 'utf8')).map((row) => [row.key, row]));
  for (const p of PERIODS) { const row = texts[`landing.pricing.period.${p}`]; assert.ok(row && row.es && row.en, `texto ES y EN del período ${p}`); }
  assert.equal(texts['landing.pricing.period.forever'], undefined, 'no hay texto para «forever» (por eso se retiró)');
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
  for (const period of ['decada', 'week', 'Month', 'month ', 'forever', '', 3, null]) {
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
  assert.equal(period.error, 'El período debe ser month o year. / The period must be month or year.');
});
