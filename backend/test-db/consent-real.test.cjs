// ES-19 contra Postgres REAL: restricción única, bloqueos de fila y concurrencia del consentimiento por propósito.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const harness = require('./harness.cjs');

let sequelize;
let Consent;
let ConsentEvent;
let consent;
let sampler;
let maxConnections = 0;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const state = async (UserId, purpose) => {
  const row = await Consent.findOne({ where: { UserId, purpose, scope: 'default' } });
  const events = await ConsentEvent.findAll({ where: { UserId, purpose, scope: 'default' }, order: [['id', 'ASC']] });
  return { row, events };
};

before(async () => {
  await harness.create();
  ({ sequelize } = require('../database'));
  Consent = require('../Consent');
  ConsentEvent = require('../ConsentEvent');
  consent = require('../utils/consent');
  await Consent.sync();
  await ConsentEvent.sync();
  sampler = setInterval(() => { harness.connections().then((n) => { maxConnections = Math.max(maxConnections, n); }).catch(() => {}); }, 15);
});

after(async () => {
  clearInterval(sampler);
  if (sequelize) await sequelize.close();
  await harness.drop();
});

test('ES-19 real: el servidor es Postgres y existe la restricción única de (persona, propósito, alcance)', async () => {
  const [{ version }] = await sequelize.query('SELECT version() AS version', { type: 'SELECT' });
  assert.match(version, /^PostgreSQL 17/);
  const indexes = await sequelize.query(
    `SELECT indexdef FROM pg_indexes WHERE tablename = 'Consents' AND indexdef ILIKE '%UNIQUE%'`, { type: 'SELECT' });
  assert.ok(indexes.some((index) => /UserId.*purpose.*scope/.test(index.indexdef)), 'falta el índice único');
  await assert.rejects(async () => {
    await Consent.create({ UserId: 1, purpose: 'research', scope: 'default', status: 'granted', version: 1, decidedAt: new Date() });
    await Consent.create({ UserId: 1, purpose: 'research', scope: 'default', status: 'granted', version: 1, decidedAt: new Date() });
  }, (error) => error.name === 'SequelizeUniqueConstraintError');
  await Consent.destroy({ where: { UserId: 1 } });
});

test('ES-19 real: doce primeras decisiones simultáneas de una persona nueva dejan una sola fila y un solo evento', async () => {
  const results = await Promise.allSettled(Array.from({ length: 12 }, () => consent.setConsent(501, 'research', 'granted')));
  assert.deepEqual(results.filter((r) => r.status === 'rejected').map((r) => r.reason.message), []);
  const { row, events } = await state(501, 'research');
  assert.equal(row.status, 'granted');
  assert.equal(await Consent.count({ where: { UserId: 501, purpose: 'research' } }), 1);
  assert.equal(events.length, 1); // idempotente: solo la primera decisión cambió algo
  assert.equal(results.filter((r) => r.status === 'fulfilled' && r.value.changed).length, 1);
});

test('ES-19 real: decisiones contradictorias simultáneas terminan en un estado coherente con su historial', async () => {
  for (const user of [502, 503, 504]) {
    const statuses = Array.from({ length: 30 }, (_, i) => (i % 2 === 0 ? 'granted' : 'revoked'));
    const results = await Promise.allSettled(statuses.map((status) => consent.setConsent(user, 'notifications', status)));
    assert.deepEqual(results.filter((r) => r.status === 'rejected').map((r) => r.reason.message), []);
    const { row, events } = await state(user, 'notifications');
    assert.equal(await Consent.count({ where: { UserId: user, purpose: 'notifications' } }), 1);
    assert.equal(row.status, events.at(-1).status); // el estado vigente es el del último evento confirmado
    assert.ok(events.length >= 1 && events.length <= 30);
    for (let i = 1; i < events.length; i++) assert.notEqual(events[i].status, events[i - 1].status);
  }
});

test('ES-19 real: una revocación durante un acceso espera a que termine y después ya no hay acceso', async () => {
  await consent.setConsent(510, 'professional_bridge', 'granted');
  let entered;
  const inside = new Promise((resolve) => { entered = resolve; });
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const log = [];

  const access = consent.withConsent(510, 'professional_bridge', async () => {
    entered();
    await gate;
    log.push('acceso terminado');
    return 'datos autorizados';
  });
  await inside;
  const revoking = consent.setConsent(510, 'professional_bridge', 'revoked').then((result) => { log.push('revocado'); return result; });
  try {
    await delay(400);
    // La lectura de otra conexión no se bloquea (MVCC) y sigue viendo «granted»: la revocación está esperando el bloqueo.
    assert.deepEqual(log, []);
    assert.equal((await state(510, 'professional_bridge')).row.status, 'granted');
  } finally {
    release(); // si una aserción falla, el acceso y la revocación terminan y no dejan el bloqueo tomado
  }
  assert.equal(await access, 'datos autorizados');
  assert.equal((await revoking).row.status, 'revoked');
  assert.deepEqual(log, ['acceso terminado', 'revocado']);
  await assert.rejects(consent.withConsent(510, 'professional_bridge', async () => 'no debe ejecutarse'),
    (error) => error.code === 'consent_required');
});

test('ES-19 real: si la revocación ya tiene el bloqueo, un acceso nuevo espera y luego se rechaza', async () => {
  await consent.setConsent(511, 'facilitator_sharing', 'granted');
  const manual = await sequelize.transaction();
  const { Transaction } = require('sequelize');
  let ran = false;
  let settled = false;
  let access;
  try {
    const locked = await Consent.findOne({ where: { UserId: 511, purpose: 'facilitator_sharing', scope: 'default' }, transaction: manual, lock: Transaction.LOCK.UPDATE });
    await locked.update({ status: 'revoked', decidedAt: new Date() }, { transaction: manual });
    access = consent.withConsent(511, 'facilitator_sharing', async () => { ran = true; })
      .then(() => 'ejecutado', (error) => error.code).finally(() => { settled = true; });
    await delay(400);
    assert.equal(settled, false); // el acceso está esperando a que la revocación confirme
  } catch (error) {
    await manual.rollback().catch(() => {}); // libera el bloqueo para que el acceso en espera y el cierre del arnés no se cuelguen
    if (access) await access;
    throw error;
  }
  await manual.commit();
  assert.equal(await access, 'consent_required');
  assert.equal(ran, false); // la operación nunca se ejecutó con un consentimiento revocado
});

test('ES-19 real: hubo varias conexiones reales simultáneas durante las pruebas', async () => {
  await delay(60);
  assert.ok(maxConnections >= 2, `conexiones máximas observadas: ${maxConnections}`);
  console.log(`# Postgres ${await harness.versionInfo()}; conexiones simultáneas máximas observadas: ${maxConnections}`);
});
