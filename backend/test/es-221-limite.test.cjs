// ES-221: el límite de registro por IP es 30 por hora y REGISTER_RATE_LIMIT_MAX solo se respeta fuera de producción (igual que el del login, ES-220).
const test = require('node:test');
const assert = require('node:assert/strict');
const { registerRateMax, REGISTER_DEFAULT_MAX } = require('../utils/loginRateLimit');

test('ES-221: el límite por IP del registro es 30 y REGISTER_RATE_LIMIT_MAX solo cuenta fuera de producción', () => {
  assert.equal(REGISTER_DEFAULT_MAX, 30);
  assert.equal(registerRateMax({}), 30);
  assert.equal(registerRateMax({ REGISTER_RATE_LIMIT_MAX: '200' }), 200);
  assert.equal(registerRateMax({ NODE_ENV: 'test', REGISTER_RATE_LIMIT_MAX: '50' }), 50);
  assert.equal(registerRateMax({ NODE_ENV: 'production', REGISTER_RATE_LIMIT_MAX: '100000' }), 30);
  assert.equal(registerRateMax({ RAILWAY_ENVIRONMENT_ID: 'abc', REGISTER_RATE_LIMIT_MAX: '100000' }), 30);
  for (const bad of ['0', '-3', '1.5', 'abc', '']) assert.equal(registerRateMax({ REGISTER_RATE_LIMIT_MAX: bad }), 30, bad);
});

test('ES-221: /register usa el límite por IP y calcula el hash antes de consultar el correo; «inactiva» ya no tiene 403 en el registro', () => {
  const src = require('node:fs').readFileSync(require.resolve('../routes/auth.js'), 'utf8');
  const register = src.slice(src.indexOf("router.post('/register'"), src.indexOf("router.post('/login'"));
  assert.match(register, /registerLimiter, validateBody/);
  assert.ok(register.indexOf('terms.validate') < register.indexOf('bcrypt.hash') && register.indexOf('bcrypt.hash') < register.indexOf('findUserByEmail'), 'aceptación → hash (en el semáforo) → consulta del correo');
  assert.doesNotMatch(register, /403|Cuenta inactiva/);
});
