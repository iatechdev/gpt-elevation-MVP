// ES-22 contra Postgres REAL: reservas de presupuesto de IA bajo concurrencia (bloqueos FOR UPDATE, restricción única,
// orden cohorte → persona sin interbloqueos).
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const harness = require('./harness.cjs');

let sequelize;
let AiBudgetCounter;
let budget;
let sampler;
let maxConnections = 0;

const month = (n) => new Date(Date.UTC(2026, n, 15)); // cada prueba usa su propio periodo (mes) para no mezclar contadores
const keyOf = (n) => budget.periodKey(month(n), 'month');
const used = async (userId, n) => (await AiBudgetCounter.findOne({ where: { UserId: userId, periodKey: keyOf(n) } }))?.used ?? 0;
const exhausted = (result) => result.status === 'rejected' && result.reason.code === 'ai_budget_exhausted';

before(async () => {
  process.env.AI_BUDGET_TOKENS_PER_USER = '1000';
  process.env.AI_BUDGET_TOKENS_COHORT = '1500';
  process.env.AI_BUDGET_PERIOD = 'month';
  await harness.create();
  ({ sequelize } = require('../database'));
  AiBudgetCounter = require('../AiBudgetCounter');
  budget = require('../utils/aiBudget');
  await AiBudgetCounter.sync();
  sampler = setInterval(() => { harness.connections().then((n) => { maxConnections = Math.max(maxConnections, n); }).catch(() => {}); }, 15);
});

after(async () => {
  clearInterval(sampler);
  if (sequelize) await sequelize.close();
  await harness.drop();
});

test('ES-22 real: el servidor es Postgres y existe la restricción única de (persona, periodo)', async () => {
  const [{ version }] = await sequelize.query('SELECT version() AS version', { type: 'SELECT' });
  assert.match(version, /^PostgreSQL 17/);
  const indexes = await sequelize.query(
    `SELECT indexdef FROM pg_indexes WHERE tablename = 'AiBudgetCounters' AND indexdef ILIKE '%UNIQUE%'`, { type: 'SELECT' });
  assert.ok(indexes.some((index) => /UserId.*periodKey/.test(index.indexdef)), 'falta el índice único');
});

test('ES-22 real: 25 reservas simultáneas de una persona nueva nunca superan el tope y la suma cuadra', async () => {
  const results = await Promise.allSettled(Array.from({ length: 25 }, () => budget.reserve(901, 100, month(0))));
  const ok = results.filter((r) => r.status === 'fulfilled');
  assert.equal(ok.length, 10); // 1.000 / 100
  assert.deepEqual(results.filter((r) => r.status === 'rejected' && !exhausted(r)).map((r) => r.reason.message), []); // sin errores inesperados
  assert.equal(await used(901, 0), 1000);
  assert.equal(await used(0, 0), 1000); // contador de cohorte
  assert.equal(await AiBudgetCounter.count({ where: { UserId: 901, periodKey: keyOf(0) } }), 1);
  assert.equal(await AiBudgetCounter.count({ where: { UserId: 0, periodKey: keyOf(0) } }), 1);
});

test('ES-22 real: varias personas a la vez contra el tope de cohorte, sin interbloqueos ni excesos', async () => {
  const users = [902, 903, 904, 905];
  const results = await Promise.allSettled(users.flatMap((user) => Array.from({ length: 10 }, () => budget.reserve(user, 100, month(1)))));
  const ok = results.filter((r) => r.status === 'fulfilled').length;
  assert.deepEqual(results.filter((r) => r.status === 'rejected' && !exhausted(r)).map((r) => r.reason.message), []);
  assert.equal(ok, 15); // tope de cohorte 1.500 / 100
  assert.equal(await used(0, 1), 1500);
  let sum = 0;
  for (const user of users) {
    const value = await used(user, 1);
    assert.ok(value <= 1000, `la persona ${user} superó su tope: ${value}`);
    sum += value;
  }
  assert.equal(sum, 1500);
  assert.ok(results.filter(exhausted).some((r) => r.reason.scope === 'cohort'));
});

test('ES-22 real: ajustar y liberar reservas mientras llegan otras nuevas deja los contadores exactos', async () => {
  const reservations = [];
  for (let i = 0; i < 10; i++) reservations.push(await budget.reserve(906, 100, month(2)));
  assert.equal(await used(906, 2), 1000);
  const toSettle = reservations.slice(0, 5);
  const toRelease = reservations.slice(5, 8);
  const untouched = reservations.slice(8);
  const operations = [
    ...toSettle.map((r) => budget.settle(r, 40).then(() => ({ type: 'settle' }))),
    ...toRelease.map((r) => budget.release(r).then(() => ({ type: 'release' }))),
    ...Array.from({ length: 8 }, () => budget.reserve(906, 100, month(2)).then((r) => ({ type: 'reserve', r }), (error) => ({ type: 'rejected', error }))),
  ];
  const outcomes = await Promise.all(operations);
  assert.deepEqual(outcomes.filter((o) => o.type === 'rejected' && o.error.code !== 'ai_budget_exhausted').map((o) => o.error.message), []);
  const newOnes = outcomes.filter((o) => o.type === 'reserve').length;
  const expected = toSettle.length * 40 + untouched.length * 100 + newOnes * 100; // las liberadas valen 0
  assert.equal(await used(906, 2), expected);
  assert.ok(expected <= 1000);
  assert.ok(expected >= 0);
});

test('ES-22 real: liberar más de lo reservado nunca deja un contador negativo', async () => {
  const reservation = await budget.reserve(907, 100, month(3));
  await budget.settle({ ...reservation, tokens: 100000 }, 0);
  assert.equal(await used(907, 3), 0);
});

test('ES-22 real: un nuevo periodo empieza de cero y sin configuración no se reserva nada', async () => {
  await budget.reserve(908, 1000, month(4));
  await assert.rejects(budget.reserve(908, 1, month(4)), (error) => error.code === 'ai_budget_exhausted');
  await budget.reserve(908, 1000, month(5)); // periodo siguiente
  assert.equal(await used(908, 4), 1000);
  assert.equal(await used(908, 5), 1000);
  const before = await AiBudgetCounter.count();
  await assert.rejects(budget.reserve(909, 100, month(6), {}), (error) => error.code === 'ai_budget_not_configured');
  assert.equal(await AiBudgetCounter.count(), before);
});

test('ES-22 real: hubo varias conexiones reales simultáneas durante las pruebas', async () => {
  assert.ok(maxConnections >= 2, `conexiones máximas observadas: ${maxConnections}`);
  console.log(`# Postgres ${await harness.versionInfo()}; conexiones simultáneas máximas observadas: ${maxConnections}`);
});
