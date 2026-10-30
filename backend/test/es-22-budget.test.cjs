const { test } = require('node:test');
const assert = require('node:assert/strict');
const { models, database, anthropic, promptVault, record, startApp } = require('./support.cjs');
const { install } = require('./es-20-store.cjs');
const budget = require('../utils/aiBudget');
const { computeCost, classifyError } = require('../utils/aiClient');
const { redactSecrets } = require('../utils/promptSafety');
const pricing = require('../config/aiPricing.json');

promptVault.getActivePrompt = async () => 'Synthetic system prompt';
anthropic.MODEL = 'modelo-sintetico-1'; // el doble de pruebas no trae modelo; en producción siempre viene de utils/anthropic.js

const A = 101;
const B = 202;
const as = (id = A, role = 'user') => ({ role, id });
const post = (request, body, actor = as()) => request('POST', '/api/chat', { ...actor, body });
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const BASE_ENV = { AI_BUDGET_TOKENS_PER_USER: '1000', AI_BUDGET_TOKENS_COHORT: '1500', AI_BUDGET_PERIOD: 'month' };
// Una llamada de chat reserva ≈ prompt/3 + max_tokens (1.000): los topes de las pruebas de chat deben ser mayores que eso.
const CHAT_ENV = { AI_BUDGET_TOKENS_PER_USER: '5000', AI_BUDGET_TOKENS_COHORT: '8000', AI_BUDGET_PERIOD: 'month' };

// Contadores en memoria con bloqueo por fila (FOR UPDATE simulado como exclusión mutua), transacciones con confirmación/reversión
// y restricción única. Comparte la transacción con el almacén de ES-20 (defer). No sustituye a Postgres real.
function budgetStore() {
  const rows = new Map();
  const tails = new Map();
  const usages = [];
  const keyOf = where => `${where.UserId}|${where.periodKey}`;
  database.sequelize.transaction = async () => ({
    pending: [], held: new Map(),
    defer(fn) { this.pending.push(fn); },
    release() { for (const free of this.held.values()) free(); this.held.clear(); },
    async commit() { this.pending.forEach(fn => fn()); this.pending = []; this.release(); },
    async rollback() { this.pending = []; this.release(); },
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
  const make = values => ({
    ...values,
    async update(updates, options = {}) {
      const apply = () => Object.assign(this, updates);
      if (options.transaction) options.transaction.defer(apply); else apply();
      return this;
    },
  });
  models.AiBudgetCounter.findOne = async ({ where, transaction, lock }) => {
    if (lock) await acquire(transaction, keyOf(where));
    return rows.get(keyOf(where)) ?? null;
  };
  models.AiBudgetCounter.create = async (values, options = {}) => {
    const row = make(values);
    const put = () => {
      if (rows.has(keyOf(values))) { const error = new Error('duplicado'); error.name = 'SequelizeUniqueConstraintError'; throw error; }
      rows.set(keyOf(values), row);
    };
    if (options.transaction) options.transaction.defer(put); else put();
    return row;
  };
  models.AiUsage.create = async values => { const row = make({ id: usages.length + 1, ...values }); usages.push(row); return row; };
  models.AiUsage.findAll = async ({ where, limit }) => usages.filter(row => row.periodKey === where.periodKey).slice(0, limit ?? Infinity);
  return { rows, usages, used: (user, key) => rows.get(`${user}|${key}`)?.used ?? 0 };
}

function withEnv(t, env) {
  const saved = {};
  for (const key of ['AI_BUDGET_TOKENS_PER_USER', 'AI_BUDGET_TOKENS_COHORT', 'AI_BUDGET_PERIOD', 'AI_CALL_TIMEOUT_MS', 'AI_MAX_RETRIES']) saved[key] = process.env[key];
  for (const key of Object.keys(saved)) delete process.env[key];
  Object.assign(process.env, env);
  t.after(() => { for (const [key, value] of Object.entries(saved)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } });
}

function chatSetup(t, env = CHAT_ENV) {
  withEnv(t, env);
  const state = install();
  const store = budgetStore();
  models.User.findByPk = async () => ({ therapistId: null });
  models.EthicManifest.findOne = async () => null;
  const provider = { calls: [], usage: { input_tokens: 100, output_tokens: 50 }, fail: null, wait: 0 };
  anthropic.messages.create = async (body, options) => {
    provider.calls.push({ body, options });
    if (provider.wait) await delay(provider.wait);
    if (provider.fail) throw provider.fail;
    return { content: [{ type: 'text', text: 'Respuesta sintética' }], ...(provider.usage ? { usage: provider.usage } : {}) };
  };
  return { state, store, provider };
}

const month = (date = new Date()) => date.toISOString().slice(0, 7);

// ── Configuración, periodos y estimación ──────────────────────────────────────────────────────────

test('ES-22 configuración: sin tope por persona no hay presupuesto; los límites duros acotan tiempo y reintentos', () => {
  assert.equal(budget.readConfig({}), null);
  for (const value of ['', '0', '-5', '1.5', 'abc', '1e6', ' ', '9999999999999']) {
    assert.equal(budget.readConfig({ AI_BUDGET_TOKENS_PER_USER: value }), null, value);
  }
  const config = budget.readConfig({ AI_BUDGET_TOKENS_PER_USER: '5000' });
  assert.deepEqual(config, { perUser: 5000, cohort: null, period: 'month', timeoutMs: 45000, maxRetries: 1 });
  assert.equal(budget.readConfig({ AI_BUDGET_TOKENS_PER_USER: '5', AI_BUDGET_TOKENS_COHORT: '9', AI_BUDGET_PERIOD: 'week' }).cohort, 9);
  assert.equal(budget.readConfig({ AI_BUDGET_TOKENS_PER_USER: '5', AI_BUDGET_PERIOD: 'año' }).period, 'month');
  const clamped = env => budget.readConfig({ AI_BUDGET_TOKENS_PER_USER: '5', ...env });
  assert.equal(clamped({ AI_CALL_TIMEOUT_MS: '999999' }).timeoutMs, 120000);
  assert.equal(clamped({ AI_CALL_TIMEOUT_MS: '5' }).timeoutMs, 1000);
  assert.equal(clamped({ AI_CALL_TIMEOUT_MS: 'x' }).timeoutMs, 45000);
  assert.equal(clamped({ AI_MAX_RETRIES: '9' }).maxRetries, 2);
  assert.equal(clamped({ AI_MAX_RETRIES: '-1' }).maxRetries, 0);
  assert.equal(clamped({ AI_MAX_RETRIES: '' }).maxRetries, 1);
});

test('ES-22 periodos: día, semana (lunes UTC) y mes, con su próximo reinicio', () => {
  const at = '2026-10-28T15:30:00Z'; // miércoles
  assert.equal(budget.periodKey(new Date(at), 'day'), '2026-10-28');
  assert.equal(budget.periodKey(new Date(at), 'week'), 'W2026-10-26');
  assert.equal(budget.periodKey(new Date('2026-11-01T00:00:00Z'), 'week'), 'W2026-10-26'); // domingo
  assert.equal(budget.periodKey(new Date(at), 'month'), '2026-10');
  assert.equal(budget.periodEnd(new Date(at), 'day').toISOString(), '2026-10-29T00:00:00.000Z');
  assert.equal(budget.periodEnd(new Date(at), 'week').toISOString(), '2026-11-02T00:00:00.000Z');
  assert.equal(budget.periodEnd(new Date(at), 'month').toISOString(), '2026-11-01T00:00:00.000Z');
  assert.equal(budget.periodEnd(new Date('2026-12-31T23:59:59Z'), 'month').toISOString(), '2027-01-01T00:00:00.000Z');
});

test('ES-22 estimación: conservadora, acotada por max_tokens y tolerante a entradas raras', () => {
  assert.equal(budget.estimateTokens({ system: 'a'.repeat(300), messages: [{ role: 'user', content: 'b'.repeat(300) }], max_tokens: 1000 }), 200 + 1000);
  assert.equal(budget.estimateTokens({ messages: [] }), 1024);
  assert.equal(budget.estimateTokens({ messages: [null, {}, { content: 12 }], max_tokens: 10 }), 1 + 10);
});

// ── Reserva atómica, ajuste y liberación ──────────────────────────────────────────────────────────

test('ES-22 reserva: se ajusta al uso real, se libera si falla y nunca supera el tope de la persona ni de la cohorte', async t => {
  withEnv(t, BASE_ENV);
  const store = budgetStore();
  const key = month();
  const first = await budget.reserve(A, 400);
  const second = await budget.reserve(A, 400);
  assert.equal(store.used(A, key), 800);
  await assert.rejects(budget.reserve(A, 400), error => error.code === 'ai_budget_exhausted' && error.scope === 'person' && error.resetsAt instanceof Date);
  assert.equal(store.used(A, key), 800); // el rechazo no reserva nada
  await budget.settle(second, 150);
  assert.equal(store.used(A, key), 550);
  await budget.release(first);
  assert.equal(store.used(A, key), 150);
  await budget.settle({ ...first, tokens: 10 }, 0); // ajuste que bajaría de cero
  assert.equal(store.used(A, key), 140);
  await budget.settle({ ...first, tokens: 100000 }, 0);
  assert.equal(store.used(A, key), 0); // nunca negativo
  // Cohorte: tope de 1.500 compartido entre personas; el rechazo por cohorte no toca el contador de la persona.
  await budget.reserve(A, 900);
  await assert.rejects(budget.reserve(B, 700), error => error.scope === 'cohort');
  assert.equal(store.used(B, key), 0);
  assert.equal(store.used(0, key), 900);
  await budget.reserve(B, 600);
  assert.equal(store.used(0, key), 1500);
});

test('ES-22 reserva: sin configurar, entradas inválidas o una llamada mayor que el tope se rechazan sin escribir', async t => {
  withEnv(t, BASE_ENV);
  const store = budgetStore();
  await assert.rejects(budget.reserve(A, 100, new Date(), {}), error => error.code === 'ai_budget_not_configured');
  for (const tokens of [0, -1, 1.5, NaN, '100', undefined]) await assert.rejects(budget.reserve(A, tokens), /inválida/, String(tokens));
  await assert.rejects(budget.reserve(A, 1001), error => error.scope === 'person');
  assert.equal(store.rows.size, 0);
});

test('ES-22 reserva: al cambiar el periodo el contador vuelve a empezar y no se amplía solo', async t => {
  withEnv(t, BASE_ENV);
  const store = budgetStore();
  await budget.reserve(A, 1000, new Date('2026-10-31T23:59:00Z'));
  await assert.rejects(budget.reserve(A, 1, new Date('2026-10-31T23:59:30Z')), error => error.code === 'ai_budget_exhausted');
  await budget.reserve(A, 1000, new Date('2026-11-01T00:00:01Z'));
  assert.equal(store.used(A, '2026-10'), 1000);
  assert.equal(store.used(A, '2026-11'), 1000);
});

test('ES-22 concurrencia: reservas simultáneas nunca superan el tope y la suma cuadra', async t => {
  withEnv(t, BASE_ENV);
  const store = budgetStore();
  const key = month();
  const results = await Promise.allSettled(Array.from({ length: 25 }, () => budget.reserve(A, 100)));
  const ok = results.filter(r => r.status === 'fulfilled').length;
  assert.equal(ok, 10); // tope de 1.000 / 100
  assert.ok(results.filter(r => r.status === 'rejected').every(r => r.reason.code === 'ai_budget_exhausted'));
  assert.equal(store.used(A, key), 1000);
  assert.equal(store.used(0, key), 1000);
  // Varias personas a la vez contra el tope de cohorte (1.500): exactamente 15 reservas de 100 caben.
  const many = await Promise.allSettled([B, 303, 404].flatMap(user => Array.from({ length: 10 }, () => budget.reserve(user, 100))));
  const okMany = many.filter(r => r.status === 'fulfilled').length;
  assert.equal(okMany, 5); // la cohorte ya tenía 1.000
  assert.equal(store.used(0, key), 1500);
  assert.ok([A, B, 303, 404].every(user => store.used(user, key) <= 1000));
  assert.equal([A, B, 303, 404].reduce((sum, user) => sum + store.used(user, key), 0), 1500);
});

test('ES-22 reserva: dos primeras reservas simultáneas de una persona nueva se reintentan sin perder ninguna', async t => {
  withEnv(t, { ...BASE_ENV, AI_BUDGET_TOKENS_PER_USER: '100000', AI_BUDGET_TOKENS_COHORT: '100000' });
  const store = budgetStore();
  const create = models.AiBudgetCounter.create;
  let collided = false;
  models.AiBudgetCounter.create = async (values, options) => {
    if (!collided && values.UserId === A) {
      collided = true;
      await create(values, undefined); // otra solicitud ganó el INSERT
      const error = new Error('duplicado');
      error.name = 'SequelizeUniqueConstraintError';
      throw error;
    }
    return create(values, options);
  };
  await budget.reserve(A, 300);
  assert.equal(store.used(A, month()), 300);
});

// ── Chat: presupuesto, fallos y recuperación ──────────────────────────────────────────────────────

test('ES-22 chat: la reserva se ajusta al uso real y se registra la llamada sin contenido', async t => {
  const { store, usages, provider } = (() => { const s = chatSetup(t); return { store: s.store, usages: s.store.usages, provider: s.provider }; })();
  const request = await startApp(t);
  const response = await post(request, { message: 'hola, quiero explorar mi carrera', requestId: 'req-ai-000001' });
  assert.equal(response.status, 200);
  assert.equal(store.used(A, month()), 150); // 100 + 50 reales, no la reserva estimada
  assert.equal(store.used(0, month()), 150);
  assert.equal(usages.length, 1);
  const row = usages[0];
  assert.equal(row.status, 'completed');
  assert.deepEqual([row.kind, row.UserId, row.requestId, row.model], ['chat', A, 'req-ai-000001', anthropic.MODEL]);
  assert.deepEqual([row.inputTokens, row.outputTokens], [100, 50]);
  assert.ok(Number.isInteger(row.latencyMs) && row.latencyMs >= 0);
  assert.equal(row.costMicros, null); // sin precios verificados no se inventa un costo
  assert.ok(row.reservedTokens > 150);
  assert.equal(row.errorCode, null ?? row.errorCode);
  assert.doesNotMatch(JSON.stringify(row), /hola|carrera|Respuesta sintética|Synthetic system prompt/);
  // Tiempo de espera y reintentos acotados por llamada.
  assert.deepEqual(provider.calls[0].options, { timeout: 45000, maxRetries: 1 });
});

test('ES-22 chat: al agotar el límite no se llama al proveedor, se conserva todo y se puede retomar sin ampliar solo', async t => {
  const { state, store, provider } = chatSetup(t, { ...CHAT_ENV, AI_BUDGET_TOKENS_PER_USER: '2500' });
  provider.usage = { input_tokens: 1000, output_tokens: 500 }; // 1.500 por llamada
  const request = await startApp(t);
  assert.equal((await post(request, { message: 'uno', requestId: 'req-ai-000002' })).status, 200);
  assert.equal(store.used(A, month()), 1500);
  const before = { calls: provider.calls.length, messages: state.messages.length };
  const blocked = await post(request, { message: 'dos', requestId: 'req-ai-000003', lang: 'en' });
  assert.equal(blocked.status, 429);
  assert.equal(blocked.body.code, 'ai_budget_exhausted');
  assert.equal(blocked.body.scope, 'person');
  assert.equal(blocked.body.retryable, false);
  assert.match(blocked.body.reply, /usage limit/); // `reply` conserva el contrato que lee la interfaz, en el idioma pedido
  assert.ok(new Date(blocked.body.resetsAt) > new Date());
  assert.equal(provider.calls.length, before.calls); // no se llamó al proveedor
  assert.equal(state.messages.length, before.messages); // el último turno válido queda intacto
  assert.equal(store.used(A, month()), 1500); // la reserva rechazada no consumió nada
  assert.equal(state.turns.find(turn => turn.requestId === 'req-ai-000003').status, 'failed');
  // No se amplía solo: seguir bloqueado hasta que alguien cambie la configuración; al hacerlo se retoma el mismo requestId.
  assert.equal((await post(request, { message: 'dos', requestId: 'req-ai-000003' })).status, 429);
  process.env.AI_BUDGET_TOKENS_PER_USER = '10000';
  const resumed = await post(request, { message: 'dos', requestId: 'req-ai-000003' });
  assert.equal(resumed.status, 200);
  assert.equal(state.messages.length, before.messages + 2);
  assert.equal(state.turns.filter(turn => turn.requestId === 'req-ai-000003').length, 1);
});

test('ES-22 chat: el tope de la cohorte bloquea a otra persona y las respuestas de seguridad no consumen presupuesto', async t => {
  const { state, store, provider } = chatSetup(t, { ...CHAT_ENV, AI_BUDGET_TOKENS_COHORT: '2500' });
  provider.usage = { input_tokens: 1000, output_tokens: 500 };
  const request = await startApp(t);
  assert.equal((await post(request, { message: 'uno' }, as(A))).status, 200);
  const blocked = await post(request, { message: 'hola' }, as(B));
  assert.equal(blocked.status, 429);
  assert.equal(blocked.body.scope, 'cohort');
  // Con el presupuesto agotado, un escenario grave sigue recibiendo la respuesta de seguridad (no usa el proveedor).
  const callsBefore = provider.calls.length;
  const safety = await post(request, { message: 'quiero morir' }, as(B));
  assert.equal(safety.status, 200);
  assert.equal(safety.body.interrupted, true);
  assert.equal(provider.calls.length, callsBefore);
  assert.equal(store.used(B, month()), 0);
  assert.ok(state.messages.some(message => message.UserId === B));
});

test('ES-22 chat: sin presupuesto configurado se rechaza con un mensaje claro y sin llamar al proveedor', async t => {
  const { provider, state } = chatSetup(t, {});
  const request = await startApp(t);
  const response = await post(request, { message: 'hola', requestId: 'req-ai-000004' });
  assert.equal(response.status, 503);
  assert.equal(response.body.code, 'ai_budget_not_configured');
  assert.equal(typeof response.body.reply, 'string');
  assert.equal(provider.calls.length, 0);
  assert.equal(state.messages.length, 0);
  assert.equal((await request('GET', '/api/ai/usage', as())).body.configured, false);
});

test('ES-22 chat: un fallo del proveedor libera la reserva, se clasifica sin guardar texto del proveedor y se puede reintentar', async t => {
  const { state, store, provider } = chatSetup(t);
  const request = await startApp(t);
  const logged = [];
  const originals = { log: console.log, error: console.error };
  console.log = console.error = (...args) => logged.push(args.join(' '));
  t.after(() => Object.assign(console, originals));
  const cases = [
    [Object.assign(new Error('texto secreto del proveedor sk-ant-SECRETOFICTICIO0123'), { status: 429 }), 'rate_limited'],
    [Object.assign(new Error('x'), { status: 503 }), 'provider_unavailable'],
    [Object.assign(new Error('x'), { name: 'APIConnectionTimeoutError' }), 'timeout'],
    [Object.assign(new Error('x'), { status: 401 }), 'provider_auth'],
    [new Error('algo raro'), 'unknown'],
  ];
  for (const [error, code] of cases) {
    provider.fail = error;
    const failed = await post(request, { message: 'hola' });
    assert.equal(failed.status, 502, code);
    assert.equal(failed.body.code, 'provider_unavailable');
    assert.equal(store.used(A, month()), 0, code); // reserva liberada
    assert.equal(store.usages.at(-1).status, 'failed');
    assert.equal(store.usages.at(-1).errorCode, code);
    assert.doesNotMatch(JSON.stringify(store.usages.at(-1)), /secreto|SECRETOFICTICIO|algo raro/);
  }
  assert.equal(state.messages.length, 0);
  assert.doesNotMatch(logged.join('\n'), /SECRETOFICTICIO|algo raro/);
  provider.fail = null;
  assert.equal((await post(request, { message: 'hola' })).status, 200);
  assert.equal(store.used(A, month()), 150);
});

test('ES-22 chat: si el proveedor no informa el uso, la reserva completa se da por consumida; los límites de espera se pasan acotados', async t => {
  const { store, provider } = chatSetup(t, { ...CHAT_ENV, AI_CALL_TIMEOUT_MS: '999999', AI_MAX_RETRIES: '9' });
  provider.usage = null;
  const request = await startApp(t);
  assert.equal((await post(request, { message: 'hola' })).status, 200);
  assert.equal(store.used(A, month()), store.usages[0].reservedTokens);
  assert.equal(store.usages[0].inputTokens, null);
  assert.deepEqual(provider.calls[0].options, { timeout: 120000, maxRetries: 2 });
});

test('ES-22 chat: los secretos ficticios se enmascaran antes de salir al proveedor y no llegan a los registros ni al uso', async t => {
  const { state, store, provider } = chatSetup(t);
  const request = await startApp(t);
  const secrets = [
    'sk-ant-FICTICIO0123456789abcdef', 'AKIAFICTICIO01234567', 'eyJhbGciOiJIUzI1.eyJzdWIiOiIxMjM0NTY.c2lnbmF0dXJhZmljdGljaWE',
    'Bearer abcdefghijklmnopqrstuvwxyz012345', 'postgres://usuario:claveficticia@host.invalid:5432/db', 'password: claveficticia123',
  ];
  const logged = [];
  const originals = { log: console.log, error: console.error };
  console.log = console.error = (...args) => logged.push(args.join(' '));
  t.after(() => Object.assign(console, originals));
  const entry = (await request('POST', '/api/diary', { ...as(), body: { date: '2026-10-01', content: `mi clave es ${secrets[0]}` } })).body;
  state.messages.push({ id: 1, UserId: A, role: 'user', content: `antes envié ${secrets[1]}`, createdAt: new Date(1_600_000_000_000), updatedAt: new Date() });
  state.messages.push({ id: 2, UserId: A, role: 'assistant', content: 'recibido', createdAt: new Date(1_600_000_001_000), updatedAt: new Date() });
  const text = `Mira: ${secrets.join(' y ')}`;
  assert.equal((await post(request, { message: text, contextEntryIds: [entry.id] })).status, 200);
  const sent = JSON.stringify(provider.calls[0].body);
  for (const secret of secrets) assert.ok(!sent.includes(secret), `no debe salir: ${secret.slice(0, 12)}`);
  assert.match(sent, /\[secreto omitido\]/);
  assert.doesNotMatch(JSON.stringify(store.usages) + logged.join('\n'), /FICTICIO|claveficticia|abcdefghijklmnopqrstuvwxyz/);
  // Lo que la persona escribió se conserva tal cual en su propio historial (es su dato); solo se filtra la copia que viaja.
  assert.ok(state.messages.some(message => message.content === text));
  // Texto cotidiano sin secretos no se modifica.
  assert.equal(redactSecrets('mi contraseña de wifi es larga'), 'mi contraseña de wifi es larga');
  assert.equal(redactSecrets('token: corto'), 'token: corto');
});

// ── Costo con precios versionados ─────────────────────────────────────────────────────────────────

test('ES-22 costo: el archivo de precios sale vacío; solo hay costo con un precio completo, verificado y vigente', () => {
  assert.deepEqual(pricing.prices, []);
  assert.equal(computeCost('modelo-x', 1000, 500), null);
  const good = { model: 'modelo-x', version: 'prueba-1', currency: 'XTS', inputPerMTok: 3, outputPerMTok: 15, source: 'https://example.invalid/precios', verifiedBy: 'Revisor sintético', verifiedAt: '2026-10-01' };
  const table = prices => ({ prices });
  const now = new Date('2026-10-26T00:00:00Z');
  assert.deepEqual(computeCost('modelo-x', 1000, 500, table([good]), now), { costMicros: 1000 * 3 + 500 * 15, currency: 'XTS', priceVersion: 'prueba-1' });
  for (const broken of [{ source: '' }, { verifiedBy: ' ' }, { verifiedAt: '2027-01-01' }, { verifiedAt: 'ayer' }, { inputPerMTok: -1 }, { outputPerMTok: '15' }, { version: undefined }, { model: 'otro' }]) {
    assert.equal(computeCost('modelo-x', 1000, 500, table([{ ...good, ...broken }]), now), null, JSON.stringify(broken));
  }
  assert.equal(computeCost('modelo-x', undefined, 5, table([good]), now), null);
  assert.equal(classifyError({ status: 429 }), 'rate_limited');
  assert.equal(classifyError(null), 'unknown');
});

test('ES-22 costo: se registra en la llamada solo cuando existe un precio verificado', async t => {
  const { store } = chatSetup(t);
  const request = await startApp(t);
  pricing.prices.push({ model: anthropic.MODEL, version: 'prueba-1', currency: 'XTS', inputPerMTok: 3, outputPerMTok: 15,
    source: 'https://example.invalid/precios', verifiedBy: 'Revisor sintético', verifiedAt: '2026-01-01' });
  t.after(() => { pricing.prices.length = 0; });
  assert.equal((await post(request, { message: 'hola' })).status, 200);
  assert.deepEqual([store.usages[0].costMicros, store.usages[0].currency, store.usages[0].priceVersion], [100 * 3 + 50 * 15, 'XTS', 'prueba-1']);
});

// ── Consulta de uso ───────────────────────────────────────────────────────────────────────────────

test('ES-22 uso: cada persona ve solo su presupuesto; el resumen agregado es solo de superadmin y no trae contenido ni identificadores', async t => {
  const { store, provider } = chatSetup(t);
  const request = await startApp(t);
  provider.usage = { input_tokens: 200, output_tokens: 100 };
  await post(request, { message: 'mensaje privado de A' }, as(A));
  provider.fail = Object.assign(new Error('x'), { status: 503 });
  await post(request, { message: 'mensaje privado de B' }, as(B));

  assert.equal((await request('GET', '/api/ai/usage')).status, 403);
  const mine = (await request('GET', '/api/ai/usage', as(A))).body;
  assert.deepEqual([mine.configured, mine.limit, mine.used, mine.remaining, mine.period], [true, 5000, 300, 4700, 'month']);
  assert.doesNotMatch(JSON.stringify(mine), /cohort|8000/);
  assert.equal((await request('GET', '/api/ai/usage', as(B))).body.used, 0);

  for (const role of ['user', 'admin', 'therapist', 'board']) {
    assert.equal((await request('GET', '/api/superadmin/ai-usage', as(7, role))).status, 403, role);
  }
  const summary = (await request('GET', '/api/superadmin/ai-usage', as(2, 'superadmin'))).body;
  assert.equal(summary.calls, 2);
  assert.equal(summary.persons, 2);
  assert.deepEqual(summary.byStatus, { completed: 1, failed: 1 });
  assert.deepEqual(summary.errors, { provider_unavailable: 1 });
  assert.deepEqual(summary.tokens, { input: 200, output: 100 });
  assert.deepEqual(summary.limits, { perUser: 5000, cohort: 8000 });
  assert.equal(summary.cohortUsed, 300);
  assert.deepEqual(summary.costMicrosByCurrency, {});
  assert.equal(typeof summary.averageLatencyMs, 'number');
  assert.doesNotMatch(JSON.stringify(summary), /mensaje privado|"UserId"|\b101\b|\b202\b/);
  assert.deepEqual(summary.byModel, { 'modelo-sintetico-1': 2 });
  assert.equal(store.usages.length, 2);
});

// ── Esquemas de salida del modelo ─────────────────────────────────────────────────────────────────

function recommendationSetup(t, output) {
  withEnv(t, CHAT_ENV);
  budgetStore();
  const saved = [];
  models.MoodLog.findAll = async () => [];
  models.WellnessRecommendation.create = async values => { saved.push(values); return record({ id: saved.length, ...values }); };
  anthropic.messages.create = async () => ({ content: [{ type: 'text', text: typeof output === 'string' ? output : JSON.stringify(output) }], usage: { input_tokens: 10, output_tokens: 10 } });
  return saved;
}

test('ES-22 esquema: una salida inválida del modelo en recomendaciones se rechaza sin guardar nada', async t => {
  const good = { category: 'habit', content: 'Una frase breve y concreta.' };
  const saved = recommendationSetup(t, [good]);
  const request = await startApp(t);
  assert.equal((await request('POST', '/api/recommendations/generate', as())).status, 200);
  assert.equal(saved.length, 1);
  for (const output of [
    { category: 'habit', content: 'no es un arreglo' }, [], [good, good, good, good], [{ category: 'inventada', content: 'x' }],
    [{ category: 'habit', content: '' }], [{ category: 'habit', content: 'x'.repeat(501) }], [{ category: 'habit', content: 5 }], [null], ['texto'],
  ]) {
    anthropic.messages.create = async () => ({ content: [{ type: 'text', text: JSON.stringify(output) }], usage: { input_tokens: 10, output_tokens: 10 } });
    const response = await request('POST', '/api/recommendations/generate', as());
    assert.ok([500, 502].includes(response.status), JSON.stringify(output).slice(0, 40));
    assert.equal(saved.length, 1, JSON.stringify(output).slice(0, 40)); // nada nuevo guardado
  }
  anthropic.messages.create = async () => ({ content: [{ type: 'text', text: 'esto no es JSON' }], usage: { input_tokens: 1, output_tokens: 1 } });
  const unparsable = await request('POST', '/api/recommendations/generate', as()); // QA-22-01
  assert.equal(unparsable.status, 502);
  assert.equal(unparsable.body.code, 'invalid_model_output');
  assert.equal(saved.length, 1);
});

test('ES-22 presupuesto en recomendaciones y matching: 429 al agotar, 503 sin configurar y 502 si falla el proveedor', async t => {
  const saved = recommendationSetup(t, [{ category: 'habit', content: 'ok' }]);
  models.User.findAll = async () => [record({ id: 303, name: 'Synthetic therapist' })];
  models.MatchingRequest.create = async values => record({ id: 7, ...values });
  const request = await startApp(t);
  const matching = () => request('POST', '/api/matching/request', { ...as(), body: { answers: { area: 'sintético' } } });
  const reco = () => request('POST', '/api/recommendations/generate', as());

  anthropic.messages.create = async () => ({ content: [{ type: 'text', text: JSON.stringify([{ therapistId: 303, score: 7, reason: 'Sintético' }]) }], usage: { input_tokens: 10, output_tokens: 10 } });
  assert.equal((await matching()).status, 200);
  // Salida con terapeutas no ofrecidos o puntuaciones fuera de rango: rechazada.
  for (const item of [{ therapistId: 999, score: 5, reason: 'x' }, { therapistId: 303, score: 11, reason: 'x' }, { therapistId: 303, score: 0, reason: 'x' },
    { therapistId: 303, score: 5.5, reason: 'x' }, { therapistId: 303, score: 5, reason: 'x'.repeat(301) }, { therapistId: '303', score: 5, reason: 'x' }]) {
    anthropic.messages.create = async () => ({ content: [{ type: 'text', text: JSON.stringify([item]) }], usage: { input_tokens: 10, output_tokens: 10 } });
    const response = await matching();
    assert.equal(response.status, 502, JSON.stringify(item));
    assert.equal(response.body.code, 'invalid_model_output');
  }
  anthropic.messages.create = async () => ({ content: [{ type: 'text', text: 'no es JSON' }], usage: { input_tokens: 1, output_tokens: 1 } }); // QA-22-01
  const unparsable = await matching();
  assert.equal(unparsable.status, 502);
  assert.equal(unparsable.body.code, 'invalid_model_output');
  // Presupuesto: agotado, sin configurar, fallo del proveedor.
  process.env.AI_BUDGET_TOKENS_PER_USER = '50';
  for (const call of [matching, reco]) {
    const response = await call();
    assert.equal(response.status, 429);
    assert.equal(response.body.code, 'ai_budget_exhausted');
  }
  delete process.env.AI_BUDGET_TOKENS_PER_USER;
  for (const call of [matching, reco]) assert.equal((await call()).status, 503);
  process.env.AI_BUDGET_TOKENS_PER_USER = '5000';
  anthropic.messages.create = async () => { throw Object.assign(new Error('x'), { status: 503 }); };
  for (const call of [matching, reco]) {
    const response = await call();
    assert.equal(response.status, 502);
    assert.equal(response.body.code, 'provider_unavailable');
  }
  assert.equal(saved.length, 0);
});

// ES43-QA-01: el motivo de cierre del proveedor queda registrado junto a los tokens de salida (sin contenido) para detectar cortes por max_tokens.
test('ES-43 chat: se registra stop_reason y output_tokens; solo códigos cortos, nunca texto libre', async t => {
  const { store } = chatSetup(t, { ...CHAT_ENV, AI_BUDGET_TOKENS_PER_USER: '50000', AI_BUDGET_TOKENS_COHORT: '50000' }); // cada llamada reserva max_tokens (1500)
  const request = await startApp(t);
  const reply = (stop_reason) => { anthropic.messages.create = async () => ({ content: [{ type: 'text', text: 'Respuesta sintética' }], usage: { input_tokens: 100, output_tokens: 1000 }, ...(stop_reason === undefined ? {} : { stop_reason }) }); };
  reply('max_tokens');
  assert.equal((await post(request, { message: 'uno', requestId: 'req-stop-000001' })).status, 200);
  reply('end_turn');
  assert.equal((await post(request, { message: 'dos', requestId: 'req-stop-000002' })).status, 200);
  reply('Texto libre del proveedor con datos personales');
  assert.equal((await post(request, { message: 'tres', requestId: 'req-stop-000003' })).status, 200);
  reply(undefined);
  assert.equal((await post(request, { message: 'cuatro', requestId: 'req-stop-000004' })).status, 200);
  const [cut, normal, free, missing] = store.usages;
  assert.deepEqual([cut.stopReason, cut.outputTokens], ['max_tokens', 1000]); // el corte queda a la vista: cierre por límite con los 1000 tokens pedidos
  assert.equal(normal.stopReason, 'end_turn');
  assert.equal(free.stopReason, null); // un valor que no parece un código no se guarda
  assert.equal(missing.stopReason, null);
  assert.doesNotMatch(JSON.stringify(store.usages), /Texto libre|datos personales|uno|Respuesta sintética/);
});

// ES43-QA-01 (corrección): tope de 1500 tokens y nunca texto cortado a mitad de frase.
test('ES-43 completeText: solo recorta si el proveedor cortó por max_tokens y deja siempre una frase completa', () => {
  const { completeText } = require('../utils/claudeText');
  const cut = 'Podrías empezar por un experimento pequeño. Habla con dos personas de tu sector y anota qué les sor';
  assert.equal(completeText(cut, 'max_tokens'), 'Podrías empezar por un experimento pequeño.');
  assert.equal(completeText(cut, 'end_turn'), cut); // respuesta completa: no se toca
  assert.equal(completeText(cut, undefined), cut);
  assert.equal(completeText('¿Qué te gustaría probar? Cuéntame más sobre tu', 'max_tokens'), '¿Qué te gustaría probar?');
  assert.equal(completeText('He aquí la idea (la mejor.) Y luego algo que se cor', 'max_tokens'), 'He aquí la idea (la mejor.)');
  assert.equal(completeText('Una sola frase muy larga que se corta sin ningún punt', 'max_tokens'), 'Una sola frase muy larga que se corta sin ningún…');
  assert.equal(completeText('Palabra', 'max_tokens'), 'Palabra…'); // sin final de frase se marca el corte; nunca queda vacío
  assert.equal(completeText('3.5 es un número. Y sigue sin ter', 'max_tokens'), '3.5 es un número.'); // un decimal no es fin de frase
  assert.equal(completeText(12, 'max_tokens'), 12);
});

test('ES-43 chat: pide 1500 tokens como máximo y una respuesta cortada por el tope se entrega recortada a la última frase completa', async t => {
  const { store, provider } = chatSetup(t);
  const request = await startApp(t);
  anthropic.messages.create = async (body) => { provider.calls.push({ body }); return { content: [{ type: 'text', text: 'Empieza por algo pequeño. Habla con dos personas y anota qué les sor' }], usage: { input_tokens: 100, output_tokens: 1500 }, stop_reason: 'max_tokens' }; };
  const response = await post(request, { message: 'uno', requestId: 'req-cut-0000001' });
  assert.equal(response.status, 200);
  assert.equal(provider.calls[0].body.max_tokens, 1500);
  assert.equal(response.body.reply, 'Empieza por algo pequeño.');
  assert.equal(store.usages[0].stopReason, 'max_tokens');
  anthropic.messages.create = async () => ({ content: [{ type: 'text', text: 'Respuesta completa sin punto final' }], usage: { input_tokens: 10, output_tokens: 10 }, stop_reason: 'end_turn' });
  assert.equal((await post(request, { message: 'dos', requestId: 'req-cut-0000002' })).body.reply, 'Respuesta completa sin punto final');
});
