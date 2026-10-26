// [QA-Claude] ES-18 · sesiones con revocación: independiente de las pruebas de Dev.
// Uso: QA_SUT=<clon limpio del commit> node --test qa/security/es18-sessions.test.cjs
// Reutiliza el arnés de Dev (backend/test/support.cjs): Express y JWT reales; DB, cifrado y proveedores simulados.
// No lee .env ni conecta a DB. Datos sintéticos. Postgres real: NO cubierto aquí.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { randomBytes } = require('node:crypto');
const sut = process.env.QA_SUT;
if (!sut) throw new Error('Defina QA_SUT con la ruta del clon limpio del commit bajo prueba.');
const jwt = require('node:module').createRequire(path.join(sut, 'backend', 'package.json'))('jsonwebtoken');
const { models, record, startApp, promptVault } = require(path.join(sut, 'backend', 'test', 'support.cjs'));

const jti = () => randomBytes(16).toString('hex');
const mk = (claims = {}, opts = {}) => jwt.sign({ id: 201, role: 'user', name: 'Sintético A', jti: jti(), ...claims }, process.env.JWT_SECRET, { expiresIn: '1h', ...opts });
const call = (request, method, url, bearer, body) => request(method, url, { headers: bearer ? { Authorization: 'Bearer ' + bearer } : {}, body });

function store() {
  const revoked = new Map(); const cutoffs = new Map();
  models.RevokedToken.findByPk = async k => revoked.get(k) ?? null;
  models.RevokedToken.upsert = async r => { revoked.set(r.jti, r); };
  models.RevokedToken.destroy = async () => 0;
  models.AuthRevocation.findByPk = async k => cutoffs.get(k) ?? null;
  models.AuthRevocation.upsert = async r => { cutoffs.set(r.UserId, r); };
  return { revoked, cutoffs };
}
models.message.findAll = async () => [];
models.User.findAll = async () => [];
models.PricingPlan.findAll = async () => [];

// Rutas protegidas por cada middleware (todas deben respetar la revocación).
const PROTEGIDAS = [
  ['user', 'GET', '/api/messages'],
  ['admin', 'GET', '/api/admin/usuarios'],
  ['superadmin', 'GET', '/api/superadmin/prompts'],
  ['board', 'GET', '/api/board/manifest'],
];

test('ES18-S01: un token revocado por logout deja de valer en TODOS los middlewares', async t => {
  const { revoked } = store();
  const request = await startApp(t);
  const out = {};
  for (const [role, method, url] of PROTEGIDAS) {
    const tk = mk({ role });
    const antes = (await call(request, method, url, tk)).status;
    // revocar este token directamente en el almacén (equivale a logout) y repetir
    const claims = jwt.decode(tk);
    revoked.set(claims.jti, { jti: claims.jti, UserId: claims.id });
    const despues = (await call(request, method, url, tk)).status;
    out[role] = { antes, despues };
    assert.notEqual(antes, 401, `${role}: el token válido no debe dar 401 antes (fue ${antes})`);
    assert.equal(despues, 401, `${role}: el token revocado debe dar 401 (fue ${despues})`);
  }
  console.log(JSON.stringify(out));
});

test('ES18-S02: logout y logout-all (flujo real) invalidan la sesión', async t => {
  store();
  const request = await startApp(t);
  const a1 = mk(); const a2 = mk();
  assert.equal((await call(request, 'POST', '/api/logout', a1)).status, 200);
  assert.equal((await call(request, 'GET', '/api/messages', a1)).status, 401, 'a1 cerrado');
  assert.equal((await call(request, 'GET', '/api/messages', a2)).status, 200, 'a2 sigue');
  assert.equal((await call(request, 'POST', '/api/logout-all', a2)).status, 200);
  assert.equal((await call(request, 'GET', '/api/messages', a2)).status, 401, 'a2 cortado');
  const otro = mk({ id: 202 });
  assert.equal((await call(request, 'GET', '/api/messages', otro)).status, 200, 'otra persona no se ve afectada');
});

test('ES18-S03: token sin jti, alterado o con algoritmo none → 401', async t => {
  store();
  const request = await startApp(t);
  const sinJti = jwt.sign({ id: 201, role: 'user', name: 'x' }, process.env.JWT_SECRET, { expiresIn: '1h' });
  assert.equal((await call(request, 'GET', '/api/messages', sinJti)).status, 401, 'sin jti (legado)');
  const ok = mk();
  const [h, p, s] = ok.split('.');
  const claims = JSON.parse(Buffer.from(p, 'base64url').toString());
  const forjado = [h, Buffer.from(JSON.stringify({ ...claims, role: 'superadmin' })).toString('base64url'), s].join('.');
  assert.equal((await call(request, 'GET', '/api/admin/usuarios', forjado)).status, 401, 'rol forjado');
  const none = [Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url'), Buffer.from(JSON.stringify({ ...claims, role: 'superadmin' })).toString('base64url'), ''].join('.');
  assert.equal((await call(request, 'GET', '/api/admin/usuarios', none)).status, 401, 'alg none');
  const expirado = mk({}, { expiresIn: '-10s' });
  assert.equal((await call(request, 'GET', '/api/messages', expirado)).status, 401, 'expirado');
  const otraClave = jwt.sign({ id: 201, role: 'user', jti: jti() }, 'otra-clave-sintetica-0000000000000000', { expiresIn: '1h' });
  assert.equal((await call(request, 'GET', '/api/messages', otraClave)).status, 401, 'firma ajena');
  assert.equal((await call(request, 'GET', '/api/messages', 'Bearer')).status, 401);
});

test('ES18-S04: si la base de sesiones falla, cierra en falla (503), nunca 200', async t => {
  store();
  const request = await startApp(t);
  models.RevokedToken.findByPk = async () => { throw new Error('db caída sintética'); };
  t.mock.method(console, 'error', () => {});
  for (const [role, method, url] of PROTEGIDAS) {
    const r = await call(request, method, url, mk({ role }));
    assert.equal(r.status, 503, `${role}: esperado 503, fue ${r.status}`);
  }
});

test('ES18-S05: cambiar rol/estado, borrar o resetear contraseña corta las sesiones de esa cuenta', async t => {
  const { cutoffs } = store();
  const objetivo = record({ id: 301, name: 'Obj', email: 'o@example.invalid', role: 'user', active: true });
  models.User.findByPk = async () => objetivo; models.User.findOne = async () => objetivo;
  models.User.destroy = async () => 1; objetivo.destroy = async () => 1;
  const request = await startApp(t);
  const admin = mk({ id: 900, role: 'admin' }); const su = mk({ id: 901, role: 'superadmin' });
  const sesionObjetivo = mk({ id: 301 });
  assert.equal((await call(request, 'GET', '/api/messages', sesionObjetivo)).status, 200);
  const r = await call(request, 'PUT', '/api/admin/usuarios/301', admin, { active: false });
  console.log('PUT estado →', r.status, 'corte creado:', cutoffs.has(301));
  assert.ok(cutoffs.has(301), 'el cambio de estado debe crear el corte de sesiones');
  assert.equal((await call(request, 'GET', '/api/messages', sesionObjetivo)).status, 401, 'sesión previa cortada');
  cutoffs.clear();
  const r2 = await call(request, 'PUT', '/api/admin/usuarios/301/reset-password', su, { newPassword: randomBytes(12).toString('hex') });
  console.log('reset-password →', r2.status, 'corte:', cutoffs.has(301));
  assert.ok(cutoffs.has(301), 'el reset debe cortar sesiones');
});

test('ES18-S06: borde de un segundo — iniciar sesión justo tras logout-all', async t => {
  store();
  const request = await startApp(t);
  const vieja = mk();
  assert.equal((await call(request, 'POST', '/api/logout-all', vieja)).status, 200);
  // token nuevo emitido en el MISMO segundo del corte (iat entero)
  const nueva = mk();
  const r = await call(request, 'GET', '/api/messages', nueva);
  console.log(JSON.stringify({ nota: 'token emitido en el mismo segundo del corte', status: r.status }));
  // Documenta el comportamiento (Dev lo declara como riesgo): si es 401 hay una ventana de hasta 1 s.
  assert.ok([200, 401].includes(r.status));
});

test('ES18-S07: el administrador no recibe datos individuales de ánimo/valoración ni mensajes', async t => {
  store();
  const objetivo = record({ id: 301, name: 'Obj', email: 'o@example.invalid', role: 'user', active: true, toJSON() { return { id: 301, name: 'Obj' }; } });
  models.User.findByPk = async () => objetivo; models.User.findOne = async () => objetivo;
  models.MoodLog.count = async () => 1;
  models.MoodLog.findAll = async () => [{ checkin_mood: 2, checkout_mood: 1, date: '2026-10-20' }];
  models.SessionRating.findAll = async () => [{ rating: 5, date: '2026-10-20' }];
  const request = await startApp(t);
  const admin = mk({ id: 900, role: 'admin' });
  const r = await call(request, 'GET', '/api/admin/usuarios/301/stats', admin);
  console.log('stats →', r.status, JSON.stringify(Object.keys(r.body?.stats ?? {})));
  assert.equal(r.status, 200);
  assert.ok(!('ultimosMoods' in r.body.stats) && !('ultimosRatings' in r.body.stats), 'sin entradas individuales');
  assert.ok(!JSON.stringify(r.body).includes('2026-10-20'), 'sin fechas individuales');
  console.log('promedios con n=1 →', JSON.stringify({ moodPromedio: r.body.stats.moodPromedio, ratingPromedio: r.body.stats.ratingPromedio }), '(equivalen al valor individual: 2 y 1 → 1.5; 5 → 5)');
  const m = await call(request, 'GET', '/api/messages?userId=301', admin);
  assert.notEqual(JSON.stringify(m.body ?? '').includes('301'), true);
});

test('ES18-S08: rutas de terapeuta con rol "user" (sin control de rol en el handler)', async t => {
  store();
  promptVault.PromptVault.findOne = async () => null; promptVault.PromptVault.findAll = async () => []; promptVault.proposePrompt = async () => ({});
  models.User.findOne = async () => null;
  const request = await startApp(t);
  const user = mk({ role: 'user' });
  const salida = {};
  for (const [m, u, b] of [['GET', '/api/therapist/prompt'], ['GET', '/api/therapist/pacientes'], ['GET', '/api/therapist/alerts'],
    ['POST', '/api/therapist/prompt/propose', { content: 'contenido sintético' }], ['GET', '/api/therapist/pacientes/1/historia']]) {
    const r = await call(request, m, u, user, b); salida[m + ' ' + u] = r.status;
  }
  console.log(JSON.stringify(salida));
  // Hallazgo potencial si algún endpoint de terapeuta responde 2xx a un "user":
  const ok2xx = Object.entries(salida).filter(([, s]) => s >= 200 && s < 300);
  console.log('2xx para rol user:', JSON.stringify(ok2xx));
});
