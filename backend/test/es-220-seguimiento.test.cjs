// ES-220 (seguimiento de QA): LOGIN_RATE_LIMIT_MAX solo se respeta fuera de producción, y inundar el contador de correos sin cuenta no libera bloqueos vigentes.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loginRateMax, DEFAULT_MAX } = require('../utils/loginRateLimit');
const attempts = require('../utils/loginAttempts');

test('ES-220 seguimiento: el límite de login por IP es 10 y LOGIN_RATE_LIMIT_MAX solo cuenta fuera de producción', () => {
  assert.equal(DEFAULT_MAX, 10);
  assert.equal(loginRateMax({}), 10);
  assert.equal(loginRateMax({ LOGIN_RATE_LIMIT_MAX: '200' }), 200); // pruebas y desarrollo
  assert.equal(loginRateMax({ NODE_ENV: 'test', LOGIN_RATE_LIMIT_MAX: '50' }), 50);
  // Producción y staging (NODE_ENV=production o Railway): la variable se ignora aunque alguien la suba.
  assert.equal(loginRateMax({ NODE_ENV: 'production', LOGIN_RATE_LIMIT_MAX: '100000' }), 10);
  assert.equal(loginRateMax({ RAILWAY_ENVIRONMENT_ID: 'abc', LOGIN_RATE_LIMIT_MAX: '100000' }), 10);
  assert.equal(loginRateMax({ NODE_ENV: 'production', RAILWAY_ENVIRONMENT_ID: 'abc' }), 10);
  // Valores raros: se vuelve a 10, nunca a «sin límite».
  for (const value of ['0', '-5', '1.5', 'abc', '', 'Infinity', 'NaN']) assert.equal(loginRateMax({ LOGIN_RATE_LIMIT_MAX: value }), 10, value);
});

test('ES-220 seguimiento (QA-220-02): inundar con correos distintos no libera un bloqueo vigente', () => {
  attempts.reset();
  const t0 = 5_000_000;
  for (let i = 0; i < attempts.MAX_ATTEMPTS; i++) attempts.recordFailure('victima@example.invalid', t0 + i);
  assert.ok(attempts.lockedUntil('victima@example.invalid', t0 + 100), 'bloqueada');
  // Inundación: el doble de la capacidad en correos distintos, todos con un solo fallo (sin bloquear).
  for (let i = 0; i < attempts.MAX_ENTRIES * 2; i++) attempts.recordFailure(`flood${i}@example.invalid`, t0 + 1000 + i);
  assert.ok(attempts.size() <= attempts.MAX_ENTRIES, String(attempts.size()));
  assert.ok(attempts.lockedUntil('victima@example.invalid', t0 + 100_000), 'el bloqueo vigente sigue ahí tras la inundación');
  // Si TODO está bloqueado a la vez, igualmente se respeta la cota de memoria (se descarta el más antiguo).
  attempts.reset();
  for (let i = 0; i < attempts.MAX_ENTRIES + 50; i++) for (let k = 0; k < attempts.MAX_ATTEMPTS; k++) attempts.recordFailure(`lock${i}@example.invalid`, t0 + i);
  assert.ok(attempts.size() <= attempts.MAX_ENTRIES, String(attempts.size()));
  attempts.reset();
});
