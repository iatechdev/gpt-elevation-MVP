const { test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const express = require('express');
const { models, database, record, startApp } = require('./support.cjs');
const consent = require('../utils/consent');

const A = 101;
const B = 202;
const as = (id, role = 'user') => ({ role, id });
const put = (request, purpose, status, actor = as(A), extra = {}) =>
  request('PUT', `/api/consents/${purpose}`, { ...actor, body: { status, ...extra } });
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };

// Almacén en memoria con bloqueo por fila (lock FOR UPDATE / FOR SHARE simulado como exclusión mutua)
// para que la lógica de ES-19 se pruebe frente a accesos concurrentes. No sustituye a Postgres real.
function consentStore() {
  const rows = new Map();
  const events = [];
  const tails = new Map();
  const keyOf = where => `${where.UserId}|${where.purpose}|${where.scope}`;
  const newTransaction = () => ({
    held: new Map(),
    release() { for (const free of this.held.values()) free(); this.held.clear(); },
    async commit() { this.release(); },
    async rollback() { this.release(); },
  });
  async function acquire(transaction, key) {
    if (transaction.held.has(key)) return;
    const previous = tails.get(key) ?? Promise.resolve();
    let free;
    const mine = new Promise(resolve => { free = resolve; });
    tails.set(key, previous.then(() => mine));
    await previous;
    transaction.held.set(key, free);
  }
  database.sequelize.transaction = async () => newTransaction();
  models.User.findByPk = async (id) => record({ id, therapistId: null }); // ES-96: therapist_sharing se refiere al terapeuta actual de la persona
  models.Consent.findOne = async ({ where, transaction, lock }) => {
    if (lock) await acquire(transaction, keyOf(where));
    return rows.get(keyOf(where)) ?? null;
  };
  models.Consent.create = async values => {
    const row = record({ id: rows.size + 1, ...values });
    rows.set(keyOf(values), row);
    return row;
  };
  models.Consent.findAll = async ({ where }) =>
    [...rows.values()].filter(row => row.UserId === where.UserId && row.scope === where.scope);
  models.ConsentEvent.create = async values => { events.push({ id: events.length + 1, ...values }); };
  models.ConsentEvent.findAll = async ({ where, limit }) =>
    events.filter(event => event.UserId === where.UserId).sort((a, b) => b.id - a.id).slice(0, limit);
  return { rows, events, keyOf };
}

test('ES-19: catálogo cerrado de ocho propósitos (ES-96 añade therapist_sharing; ES-121 añade insights_chat e insights_diary), todos sin decidir y solo visibles para su titular', async t => {
  consentStore();
  const request = await startApp(t);
  assert.equal((await request('GET', '/api/consents')).status, 403);
  const response = await request('GET', '/api/consents', as(A));
  assert.equal(response.status, 200);
  assert.deepEqual(response.body.consents.map(c => c.purpose),
    ['necessary', 'professional_bridge', 'facilitator_sharing', 'research', 'notifications', 'therapist_sharing', 'insights_chat', 'insights_diary']);
  assert.deepEqual(response.body.consents.map(c => c.status), Array(8).fill('undecided'));
  assert.deepEqual(response.body.consents.map(c => c.required), [true, false, false, false, false, false, false, false]);
  for (const entry of response.body.consents) {
    const base = ['decidedAt', 'purpose', 'required', 'requiredVersion', 'scope', 'status', 'version'];
    assert.deepEqual(Object.keys(entry).sort(), entry.purpose === 'therapist_sharing' ? [...base, 'applicable'].sort() : base);
  }
  // Sin terapeuta vinculado no hay a quién autorizar.
  assert.equal(response.body.consents.find(c => c.purpose === 'therapist_sharing').applicable, false);
});

test('ES-19: decisiones contradictorias e idempotencia; el historial conserva cada cambio', async t => {
  const { events } = consentStore();
  const request = await startApp(t);
  const states = [];
  for (const status of ['granted', 'granted', 'revoked', 'granted', 'revoked', 'revoked']) {
    const response = await put(request, 'facilitator_sharing', status);
    assert.equal(response.status, 200);
    states.push([response.body.status, response.body.changed]);
  }
  assert.deepEqual(states, [
    ['granted', true], ['granted', false], ['revoked', true], ['granted', true], ['revoked', true], ['revoked', false],
  ]);
  assert.deepEqual(events.map(e => e.status), ['granted', 'revoked', 'granted', 'revoked']);
  const state = (await request('GET', '/api/consents', as(A))).body.consents.find(c => c.purpose === 'facilitator_sharing');
  assert.equal(state.status, 'revoked');
  const history = (await request('GET', '/api/consents/history', as(A))).body.history;
  assert.deepEqual(history.map(h => h.status), ['revoked', 'granted', 'revoked', 'granted']);
  for (const item of history) assert.deepEqual(Object.keys(item).sort(), ['decidedAt', 'purpose', 'scope', 'status', 'version']);
});

test('ES-19: rechazar investigación o notificaciones no bloquea lo necesario ni otras funciones', async t => {
  consentStore();
  models.message.findAll = async () => [];
  const request = await startApp(t);
  assert.equal((await put(request, 'research', 'revoked')).body.status, 'revoked');
  assert.equal((await put(request, 'notifications', 'revoked')).body.status, 'revoked');
  assert.equal((await request('GET', '/api/messages', as(A))).status, 200);
  assert.equal(await consent.hasConsent(A, 'research'), false);
  assert.equal((await put(request, 'necessary', 'granted')).body.status, 'granted');
  assert.equal(await consent.hasConsent(A, 'necessary'), true);
  const byPurpose = Object.fromEntries((await request('GET', '/api/consents', as(A))).body.consents.map(c => [c.purpose, c.status]));
  assert.deepEqual(byPurpose, {
    necessary: 'granted', professional_bridge: 'undecided', facilitator_sharing: 'undecided', research: 'revoked', notifications: 'revoked', therapist_sharing: 'undecided', insights_chat: 'undecided', insights_diary: 'undecided',
  });
});

test('ES-19: el uso necesario no se revoca desde la API', async t => {
  consentStore();
  const request = await startApp(t);
  await put(request, 'necessary', 'granted');
  const refused = await put(request, 'necessary', 'revoked');
  assert.equal(refused.status, 409);
  assert.equal(refused.body.code, 'necessary_not_revocable');
  assert.equal(await consent.hasConsent(A, 'necessary'), true);
});

test('ES-19: entradas inválidas y propósitos inventados se rechazan sin escribir', async t => {
  const { rows, events } = consentStore();
  const request = await startApp(t);
  for (const purpose of ['unknown', '__proto__', 'constructor', 'toString', 'RESEARCH', '%20']) {
    assert.equal((await put(request, purpose, 'granted')).status, 404, purpose);
  }
  for (const body of [undefined, {}, [], { status: 'GRANTED' }, { status: true }, { status: null }, { status: 'granted', scope: 'otro' }, { status: 'granted', scope: {} }]) {
    const response = await request('PUT', '/api/consents/research', { ...as(A), body });
    assert.equal(response.status, 400, JSON.stringify(body));
  }
  assert.equal(rows.size, 0);
  assert.equal(events.length, 0);
});

test('ES-19: aislamiento A/B; el titular sale del token, no del cuerpo ni de la ruta, y nadie más puede cambiarlo', async t => {
  const { rows, keyOf } = consentStore();
  const request = await startApp(t);
  await put(request, 'professional_bridge', 'granted', as(A));
  // B no ve lo de A; un UserId en el cuerpo se ignora; un administrador solo gestiona los suyos.
  const forB = (await request('GET', '/api/consents', as(B))).body.consents.find(c => c.purpose === 'professional_bridge');
  assert.equal(forB.status, 'undecided');
  const attempt = await request('PUT', '/api/consents/professional_bridge', { ...as(B), body: { status: 'revoked', UserId: A, userId: A } });
  assert.equal(attempt.status, 200);
  assert.equal(rows.get(keyOf({ UserId: A, purpose: 'professional_bridge', scope: 'default' })).status, 'granted');
  assert.equal(rows.get(keyOf({ UserId: B, purpose: 'professional_bridge', scope: 'default' })).status, 'revoked');
  assert.deepEqual((await request('GET', '/api/consents/history', as(A))).body.history.map(h => h.status), ['granted']);
  const admin = await request('GET', '/api/consents', as(1, 'admin'));
  assert.ok(admin.body.consents.every(c => c.status === 'undecided'));
  // No existe ninguna ruta de administrador para leer o cambiar consentimientos ajenos: el identificador no es un propósito.
  assert.equal((await request('PUT', `/api/consents/${A}`, { ...as(1, 'admin'), body: { status: 'revoked' } })).status, 404);
});

test('ES-19: se verifica al acceder; permisos previos con versión antigua y errores no abren acceso', async t => {
  const { rows, keyOf } = consentStore();
  const app = express();
  app.get('/datos/:id', consent.requireConsent('facilitator_sharing', req => req.params.id), (req, res) => res.json({ ok: true }));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const get = async id => fetch(`http://127.0.0.1:${server.address().port}/datos/${id}`);
  const key = { UserId: A, purpose: 'facilitator_sharing', scope: 'default' };

  assert.equal((await get(A)).status, 403); // sin decidir
  const request = await startApp(t);
  await put(request, 'facilitator_sharing', 'granted');
  assert.equal((await get(A)).status, 200);
  assert.equal((await get(B)).status, 403); // el permiso de A no cubre a B
  assert.equal((await get('abc')).status, 403);
  assert.equal((await get('')).status, 404);
  await put(request, 'facilitator_sharing', 'revoked');
  const denied = await get(A);
  assert.equal(denied.status, 403);
  assert.equal((await denied.json()).code, 'consent_required');
  // Un «granted» de una versión anterior ya no vale y se informa como 'outdated'.
  rows.set(keyOf(key), record({ ...key, status: 'granted', version: 0, decidedAt: new Date() }));
  assert.equal((await get(A)).status, 403);
  assert.equal((await request('GET', '/api/consents', as(A))).body.consents.find(c => c.purpose === 'facilitator_sharing').status, 'outdated');
  // Si no se puede comprobar, se rechaza.
  models.Consent.findOne = async () => { throw new Error('base caída'); };
  const failed = await get(A);
  assert.equal(failed.status, 503);
  assert.doesNotMatch(await failed.text(), /base caída/);
});

test('ES-19: una revocación durante un acceso espera a que termine y desde ese momento ya no hay acceso', async t => {
  const { rows, events, keyOf } = consentStore();
  const request = await startApp(t);
  await put(request, 'professional_bridge', 'granted');
  const entered = deferred();
  const gate = deferred();
  const log = [];

  const access = consent.withConsent(A, 'professional_bridge', async () => {
    entered.resolve();
    await gate.promise;
    log.push('acceso terminado');
    return 'datos autorizados';
  });
  await entered.promise;
  const revoking = put(request, 'professional_bridge', 'revoked').then(response => { log.push('revocado'); return response; });
  await delay(80);
  // Mientras el acceso sigue abierto, la revocación no se ha aplicado.
  assert.deepEqual(log, []);
  assert.equal(rows.get(keyOf({ UserId: A, purpose: 'professional_bridge', scope: 'default' })).status, 'granted');
  gate.resolve();
  assert.equal(await access, 'datos autorizados');
  assert.equal((await revoking).body.status, 'revoked');
  assert.deepEqual(log, ['acceso terminado', 'revocado']);
  await assert.rejects(consent.withConsent(A, 'professional_bridge', async () => 'no debe ejecutarse'),
    error => error.code === 'consent_required' && error.purpose === 'professional_bridge');
  assert.deepEqual(events.map(e => e.status), ['granted', 'revoked']);
});

test('ES-19: withConsent no ejecuta la operación sin consentimiento y libera el bloqueo ante errores', async t => {
  consentStore();
  const request = await startApp(t);
  let ran = false;
  await assert.rejects(consent.withConsent(A, 'research', async () => { ran = true; }), { code: 'consent_required' });
  await assert.rejects(consent.withConsent('x', 'research', async () => { ran = true; }), { code: 'consent_required' });
  await assert.rejects(consent.withConsent(A, 'inventado', async () => { ran = true; }), { code: 'consent_required' });
  assert.equal(ran, false);
  await put(request, 'research', 'granted');
  await assert.rejects(consent.withConsent(A, 'research', async () => { throw new Error('fallo interno'); }), /fallo interno/);
  // El bloqueo se liberó: una revocación posterior no queda esperando.
  const revoked = await Promise.race([put(request, 'research', 'revoked'), delay(1000).then(() => 'bloqueado')]);
  assert.equal(revoked.status, 200);
});

test('ES-19: decisiones simultáneas contradictorias terminan en un estado coherente con su historial', async t => {
  const { rows, events, keyOf } = consentStore();
  const request = await startApp(t);
  const statuses = ['granted', 'revoked', 'granted', 'revoked', 'granted', 'revoked', 'granted'];
  const results = await Promise.all(statuses.map(status => put(request, 'notifications', status)));
  assert.ok(results.every(response => response.status === 200));
  const final = rows.get(keyOf({ UserId: A, purpose: 'notifications', scope: 'default' }));
  assert.equal(final.status, events.at(-1).status);
  assert.ok(events.length >= 2 && events.length <= statuses.length);
  for (let i = 1; i < events.length; i++) assert.notEqual(events[i].status, events[i - 1].status);
});

test('ES-19: dos primeras decisiones simultáneas: el choque de unicidad se reintenta una vez', async t => {
  const { rows, events, keyOf } = consentStore();
  const create = models.Consent.create;
  let collided = false;
  models.Consent.create = async (values, options) => {
    if (!collided) {
      collided = true;
      // La otra solicitud ganó el INSERT.
      await create({ ...values, status: 'revoked' }, options);
      const error = new Error('duplicado');
      error.name = 'SequelizeUniqueConstraintError';
      throw error;
    }
    return create(values, options);
  };
  const request = await startApp(t);
  const response = await put(request, 'research', 'granted');
  assert.equal(response.status, 200);
  assert.equal(response.body.status, 'granted');
  assert.equal(rows.get(keyOf({ UserId: A, purpose: 'research', scope: 'default' })).status, 'granted');
  assert.equal(events.at(-1).status, 'granted');
});

test('ES-19: si falla la base no se filtra el error y el estado no cambia', async t => {
  consentStore();
  const request = await startApp(t);
  models.Consent.findAll = async () => { throw new Error('detalle interno de base'); };
  const failed = await request('GET', '/api/consents', as(A));
  assert.equal(failed.status, 500);
  assert.doesNotMatch(JSON.stringify(failed.body), /detalle interno/);
});
