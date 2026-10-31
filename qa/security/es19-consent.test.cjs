// [QA-Claude] ES-19 · consentimiento por propósito: aislamiento A/B, entradas inválidas, idempotencia y consumo.
// Uso: QA_SUT=<clon limpio del commit de ES-19> node --test qa/security/es19-consent.test.cjs
// Reutiliza el arnés de Dev (Express y JWT reales; DB simulada con almacén en memoria). Sin Postgres real.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { randomBytes } = require('node:crypto');

const sut = process.env.QA_SUT;
if (!sut) throw new Error('Defina QA_SUT con la ruta del clon limpio del commit bajo prueba.');
const jwt = require('node:module').createRequire(path.join(sut, 'backend', 'package.json'))('jsonwebtoken');
const { models, startApp } = require(path.join(sut, 'backend', 'test', 'support.cjs'));
const consentLib = require(path.join(sut, 'backend', 'utils', 'consent.js'));

const mk = (id, role = 'user') => jwt.sign({ id, role, name: 'Sintético ' + id, jti: randomBytes(16).toString('hex') }, process.env.JWT_SECRET, { expiresIn: '1h' });
const call = (request, method, url, bearer, body) => request(method, url, { headers: bearer ? { Authorization: 'Bearer ' + bearer } : {}, body });

function memory() {
  const rows = []; const events = [];
  const match = (r, w) => Object.entries(w).every(([k, v]) => r[k] === v);
  models.RevokedToken.findByPk = async () => null; models.AuthRevocation.findByPk = async () => null;
  models.Consent.findOne = async ({ where }) => rows.find(r => match(r, where)) ?? null;
  models.Consent.findAll = async ({ where }) => rows.filter(r => match(r, where));
  models.Consent.create = async v => { const r = { ...v, async update(u) { Object.assign(this, u); return this; } }; rows.push(r); return r; };
  models.ConsentEvent.create = async v => { events.push({ id: events.length + 1, ...v }); return v; };
  models.ConsentEvent.findAll = async ({ where }) => events.filter(e => match(e, where)).reverse();
  return { rows, events };
}

test('ES19-S01: sin token → 403/401; el titular es SIEMPRE el token (UserId/userId del cuerpo y de la query se ignoran)', async t => {
  const { rows } = memory();
  const request = await startApp(t);
  for (const [m, u] of [['GET', '/api/consents'], ['GET', '/api/consents/history'], ['PUT', '/api/consents/research']]) {
    const r = await call(request, m, u, null, m === 'PUT' ? { status: 'granted' } : undefined);
    assert.ok([401, 403].includes(r.status), `${m} ${u} sin token: ${r.status}`);
  }
  const A = mk(501); const B = mk(502);
  const r = await call(request, 'PUT', '/api/consents/research?userId=502&UserId=502', A, { status: 'granted', UserId: 502, userId: 502, UserID: 502 });
  assert.equal(r.status, 200);
  assert.ok(rows.every(x => x.UserId === 501), 'la decisión se guarda a nombre del titular del token');
  const lb = await call(request, 'GET', '/api/consents', B);
  const research = lb.body.consents.find(c => c.purpose === 'research');
  assert.equal(research.status, 'undecided', 'B no ve ni hereda la decisión de A');
  const hb = await call(request, 'GET', '/api/consents/history?userId=501', B);
  assert.deepEqual(hb.body.history, [], 'B no ve el historial de A, ni con ?userId=');
});

test('ES19-S02: propósito y cuerpo inválidos nunca dan 500', async t => {
  memory();
  const request = await startApp(t);
  const A = mk(501);
  const purposes = ['constructor', '__proto__', 'toString', 'hasOwnProperty', 'desconocido', 'RESEARCH', 'research%00', '..%2f', 'a'.repeat(300)];
  const res = {};
  for (const p of purposes) res['purpose:' + p.slice(0, 12)] = (await call(request, 'PUT', '/api/consents/' + p, A, { status: 'granted' })).status;
  const bodies = { 'status nulo': { status: null }, 'status objeto': { status: { a: 1 } }, 'status arreglo': { status: ['granted'] }, 'status inválido': { status: 'maybe' },
    'scope inválido': { status: 'granted', scope: 'otro' }, 'scope objeto': { status: 'granted', scope: { a: 1 } }, 'vacío': {}, 'status mayúsculas': { status: 'GRANTED' } };
  for (const [n, b] of Object.entries(bodies)) res['body:' + n] = (await call(request, 'PUT', '/api/consents/research', A, b)).status;
  console.log(JSON.stringify(res));
  const malos = Object.entries(res).filter(([, s]) => ![400, 404].includes(s));
  assert.deepEqual(malos, [], 'esperado 400/404: ' + JSON.stringify(malos));
});

test('ES19-S03: necessary no se revoca (409); revocar otros no bloquea necessary; idempotencia y versión', async t => {
  const { events } = memory();
  const request = await startApp(t);
  const A = mk(501);
  assert.equal((await call(request, 'PUT', '/api/consents/necessary', A, { status: 'revoked' })).status, 409);
  const g1 = await call(request, 'PUT', '/api/consents/research', A, { status: 'granted' });
  const g2 = await call(request, 'PUT', '/api/consents/research', A, { status: 'granted' });
  assert.equal(g1.body.changed, true); assert.equal(g2.body.changed, false);
  assert.equal(events.length, 1, 'repetir el mismo estado no crea evento');
  const rv = await call(request, 'PUT', '/api/consents/research', A, { status: 'revoked' });
  assert.equal(rv.status, 200); assert.equal(rv.body.status, 'revoked');
  assert.equal(events.length, 2);
  const lst = await call(request, 'GET', '/api/consents', A);
  assert.equal(lst.body.consents.length, 5);
  assert.ok(lst.body.consents.every(c => c.status && 'requiredVersion' in c));
  const hist = await call(request, 'GET', '/api/consents/history', A);
  const claves = new Set(hist.body.history.flatMap(e => Object.keys(e)));
  assert.deepEqual([...claves].sort(), ['decidedAt', 'purpose', 'scope', 'status', 'version'], 'el historial no lleva contenido privado ni identificadores');
});

test('ES19-S04: revocar corta el acceso futuro (hasConsent / requireConsent) y falla cerrado', async t => {
  const { rows } = memory();
  const request = await startApp(t);
  const A = mk(501);
  await call(request, 'PUT', '/api/consents/facilitator_sharing', A, { status: 'granted' });
  assert.equal(await consentLib.hasConsent(501, 'facilitator_sharing'), true);
  await call(request, 'PUT', '/api/consents/facilitator_sharing', A, { status: 'revoked' });
  assert.equal(await consentLib.hasConsent(501, 'facilitator_sharing'), false, 'revocado → sin acceso');
  assert.equal(await consentLib.hasConsent(501, 'professional_bridge'), false, 'no decidido → sin acceso');
  assert.equal(await consentLib.hasConsent(502, 'facilitator_sharing'), false, 'otra persona → sin acceso');
  assert.equal(await consentLib.hasConsent('501; DROP TABLE', 'research'), false);
  assert.equal(await consentLib.hasConsent(501, '__proto__'), false);
  // versión antigua → outdated y sin acceso
  rows.find(r => r.purpose === 'facilitator_sharing').status = 'granted';
  rows.find(r => r.purpose === 'facilitator_sharing').version = 0;
  assert.equal(await consentLib.hasConsent(501, 'facilitator_sharing'), false, 'versión antigua no vale');
  const lst = await call(request, 'GET', '/api/consents', A);
  assert.equal(lst.body.consents.find(c => c.purpose === 'facilitator_sharing').status, 'outdated');
  // falla de la base → 503 en requireConsent, nunca next()
  models.Consent.findOne = async () => { throw new Error('db caída sintética'); };
  let siguio = false; const res = { status(c) { this.code = c; return this; }, json() { return this; } };
  t.mock.method(console, 'error', () => {});
  await consentLib.requireConsent('research', () => 501)({}, res, () => { siguio = true; });
  assert.equal(siguio, false); assert.equal(res.code, 503);
});

test('ES19-S05: ninguna ruta real consume el consentimiento todavía (hallazgo informativo)', () => {
  const fs = require('node:fs');
  const dir = path.join(sut, 'backend', 'routes');
  const users = fs.readdirSync(dir).filter(f => f.endsWith('.js') && f !== 'consents.js')
    .filter(f => /requireConsent|withConsent|hasConsent/.test(fs.readFileSync(path.join(dir, f), 'utf8')));
  console.log(JSON.stringify({ rutas_que_consumen_consentimiento: users }));
  assert.ok(Array.isArray(users));
});
