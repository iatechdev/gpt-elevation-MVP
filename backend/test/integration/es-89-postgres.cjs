// ES-89 · API del análisis de IA del worker (crear, consultar, cancelar, revisar candidatas) por HTTP REAL, JWT real y PostgreSQL REAL.
// Express real con verificarToken y la ruta; migraciones reales (ES-85 y ES-89 con sus disparadores y CHECK); el worker es una conexión real con
// el rol restringido (worker_claim/worker_publish/worker_heartbeat) para producir candidatas de verdad. Crea y borra SOLO su base aleatoria.
//   ES89_TEST_DATABASE_URL=postgres://elevation:elevation_local@127.0.0.1:54339/postgres node --test test/integration/es-89-postgres.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { once } = require('node:events');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { Client } = require('pg');
const { Sequelize } = require('sequelize');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const sha256 = (text) => crypto.createHash('sha256').update(text, 'utf8').digest('hex');
const backend = path.resolve(__dirname, '..', '..');
const blocked = async (promise, ms = 400) => Promise.race([promise.then(() => false, () => false), sleep(ms).then(() => true)]);

test('ES-89 PostgreSQL + HTTP: crear, consultar, cancelar y revisar el análisis de IA', { timeout: 200000 }, async (t) => {
  assert.ok(process.env.ES89_TEST_DATABASE_URL, 'Se requiere ES89_TEST_DATABASE_URL (clúster desechable en loopback)');
  const target = new URL(process.env.ES89_TEST_DATABASE_URL);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname), 'Solo loopback');
  const dbName = `es89_test_${crypto.randomBytes(8).toString('hex')}`;
  const workerPassword = crypto.randomBytes(16).toString('hex');
  const urlFor = (name, user, password) => { const u = new URL(target.toString()); u.pathname = `/${name}`; if (user) { u.username = user; u.password = password; } return u.toString(); };
  const admin = new Client({ connectionString: target.toString(), ssl: false }); await admin.connect();
  let created = false; let app; let server; const extra = [];
  t.after(async () => {
    if (server) await new Promise((r) => { server.close(r); server.closeAllConnections?.(); });
    for (const c of extra) await c.end().catch(() => {});
    if (app) await app.close().catch(() => {});
    if (created) await admin.query(`DROP DATABASE "${dbName}" WITH (FORCE)`).catch(() => {});
    await admin.query('ALTER ROLE elevation_worker PASSWORD NULL').catch(() => {});
    await admin.end().catch(() => {});
  });
  await admin.query(`CREATE DATABASE "${dbName}"`); created = true;
  const migrated = spawnSync('npx', ['sequelize-cli', 'db:migrate'], { cwd: backend, encoding: 'utf8', shell: process.platform === 'win32',
    env: { ...process.env, DATABASE_URL: urlFor(dbName), DB_SSL: 'false', NODE_ENV: 'test' } });
  assert.equal(migrated.status, 0, `Fallaron las migraciones: ${(migrated.stdout + migrated.stderr).slice(-600)}`);
  await admin.query(`ALTER ROLE elevation_worker PASSWORD '${workerPassword}'`);

  app = new Sequelize(urlFor(dbName), { logging: false, dialectOptions: { ssl: false }, pool: { max: 12, min: 0 } });
  process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
  process.env.DATA_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
  process.env.NODE_ENV = 'test';
  delete process.env.AI_ANALYSIS_TRIGGER; delete process.env.PROFESSIONAL_ENCRYPTION_KEY;
  const dbModule = require.resolve('../../database');
  require.cache[dbModule] = { id: dbModule, filename: dbModule, loaded: true, exports: { sequelize: app } };
  require('../../associations')();
  const consent = require('../../utils/consent');
  const bridge = require('../../utils/careerContext');
  const { encriptarV2 } = require('../../utils/crypto');
  const { issueToken } = require('../../utils/sessions');
  const { verificarToken } = require('../../middlewares/auth');
  const { personalData } = require('../../utils/personalData');
  const User = require('../../User');

  const express = require('express');
  const api = express(); api.use(express.json());
  api.use('/api/skill-analysis', verificarToken, require('../../routes/skillAnalysis'));
  server = api.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}/api/skill-analysis`;

  const db = new Client({ connectionString: urlFor(dbName), ssl: false }); await db.connect(); extra.push(db);
  const worker = new Client({ connectionString: urlFor(dbName, 'elevation_worker', workerPassword), ssl: false }); await worker.connect(); extra.push(worker);
  const q = async (text, params) => (await db.query(text, params)).rows;

  // ── Datos sintéticos ────────────────────────────────────────────────────────────────────────────
  const notNull = async () => q(`SELECT column_name, data_type, udt_name FROM information_schema.columns WHERE table_schema='public' AND table_name='Users'
    AND is_nullable='NO' AND column_default IS NULL AND column_name <> 'id'`);
  let seq = 0;
  async function mkUser() {
    seq += 1; const names = []; const values = [];
    for (const c of await notNull()) {
      let v;
      if (c.data_type.includes('char') || c.data_type === 'text') v = c.column_name === 'email' ? `sintetico-${seq}-${dbName}@example.test` : `sintetico-${seq}-${c.column_name}`;
      else if (c.data_type === 'integer') v = 0; else if (c.data_type === 'boolean') v = false; else if (c.data_type.startsWith('timestamp')) v = new Date();
      else if (c.data_type === 'USER-DEFINED') v = (await q('SELECT enumlabel FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname=$1 ORDER BY enumsortorder LIMIT 1', [c.udt_name]))[0].enumlabel;
      else v = '{}';
      names.push(`"${c.column_name}"`); values.push(v);
    }
    return (await q(`INSERT INTO "Users" (${names.join(',')}) VALUES (${values.map((_, i) => `$${i + 1}`).join(',')}) RETURNING id`, values))[0].id;
  }
  const FIELDS = [{ key: 'motivations', text: 'Texto sintético' }, { key: 'interests', text: 'Datos' }];
  async function mkPerson({ withConsent = true, withContext = true } = {}) {
    const id = await mkUser();
    if (withConsent) await consent.setConsent(id, 'professional_bridge', 'granted');
    let payload = null;
    if (withContext) {
      payload = encriptarV2(JSON.stringify(FIELDS));
      await q(`INSERT INTO "CareerContextVersions" ("UserId","version","status","payload","origins","consentVersion","requestId","approvedAt","createdAt","updatedAt")
        VALUES ($1,1,'active',$2,$3,1,$4,now(),now(),now())`, [id, payload, JSON.stringify(FIELDS.map((f, index) => ({ key: f.key, index, type: 'direct' }))), `ctx-${crypto.randomBytes(6).toString('hex')}`]);
    }
    return { id, payload, token: issueToken({ id, role: 'user' }) };
  }
  await q(`INSERT INTO "SkillCatalogs" ("version","status","publishedAt","createdAt","updatedAt") VALUES (1,'published',now(),now(),now())`);
  const catalogId = (await q('SELECT id FROM "SkillCatalogs" WHERE version=1'))[0].id;
  for (const key of ['sql', 'comunicacion', 'liderazgo']) {
    await q(`INSERT INTO "SkillDefinitions" ("catalogId","skillKey","type","labels","rubric","createdAt","updatedAt") VALUES ($1,$2,'domain',$3,'{"levels":{}}',now(),now())`, [catalogId, key, JSON.stringify({ es: `ES ${key}`, en: `EN ${key}` })]);
  }
  const http = async (person, method, route, body) => {
    const res = await fetch(`${base}${route}`, { method, headers: { ...(person ? { Authorization: `Bearer ${person.token}` } : {}), 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const text = await res.text();
    let parsed = null; try { parsed = text ? JSON.parse(text) : null; } catch { /* respuesta de error HTML del analizador de cuerpos */ }
    return { status: res.status, body: parsed, text };
  };
  const rid = () => `req-${crypto.randomBytes(8).toString('hex')}`;
  const claim = async () => (await worker.query('SELECT worker_claim($1,120,3) AS r', ['w-89'])).rows[0].r;
  const publish = async (jobId, fence, list) => (await worker.query('SELECT worker_publish($1,$2,$3::jsonb) AS r', [jobId, fence, JSON.stringify(list)])).rows[0].r;
  const GOOD = [{ skillKey: 'sql', level: 3, citations: ['interests'] }, { skillKey: 'comunicacion', level: null, citations: ['motivations'] }, { skillKey: 'liderazgo', level: 2, citations: ['motivations', 'interests'] }];
  const drain = () => q(`UPDATE "AiJobs" SET status='CANCELLED' WHERE status IN ('PENDING','RUNNING','REVIEW_REQUIRED')`);
  const FORBIDDEN_KEYS = ['contextHash', 'fence', 'leaseOwner', 'leaseExpiresAt', 'payload', 'requestId', 'UserId', 'notBefore', 'errorCode', 'origins'];
  const noInternals = (text) => { for (const k of FORBIDDEN_KEYS) assert.ok(!text.includes(`"${k}"`), `la respuesta no expone ${k}`); };
  // Un análisis ya publicado con las tres candidatas, listo para revisar.
  async function publishedJob(person) {
    await drain();
    const created = await http(person, 'POST', '/jobs', { requestId: rid() });
    assert.equal(created.status, 201);
    const claimed = await claim(); assert.equal(claimed.jobId, created.body.id);
    assert.deepEqual(await publish(created.body.id, claimed.fence, GOOD), { ok: true, candidates: 3 });
    return { jobId: created.body.id, fence: claimed.fence };
  }

  await t.test('autenticación: sin token ninguna ruta responde', async () => {
    for (const [method, route, body] of [['POST', '/jobs', { requestId: rid() }], ['GET', '/jobs'], ['GET', '/jobs/1'], ['POST', '/jobs/1/cancel', {}], ['GET', '/candidates'], ['POST', '/candidates/1/review', { action: 'reject' }]]) {
      const r = await http(null, method, route, body); // el middleware del repositorio responde 403 sin token
      assert.ok([401, 403].includes(r.status), `${method} ${route} -> ${r.status}`);
      noInternals(r.text);
    }
  });

  await t.test('crear: exige consentimiento y contexto; valida la entrada; es idempotente; un análisis vivo por persona; la respuesta no expone internos', async () => {
    const noConsent = await mkPerson({ withConsent: false });
    assert.deepEqual([(await http(noConsent, 'POST', '/jobs', { requestId: rid() })).status, (await http(noConsent, 'POST', '/jobs', { requestId: rid() })).body.code], [403, 'consent_required']);
    const noContext = await mkPerson({ withContext: false });
    const r0 = await http(noContext, 'POST', '/jobs', { requestId: rid() });
    assert.deepEqual([r0.status, r0.body.code], [409, 'no_context']);
    assert.equal((await q('SELECT count(*)::int n FROM "AiJobs" WHERE "UserId" = ANY($1)', [[noConsent.id, noContext.id]]))[0].n, 0);

    const p = await mkPerson();
    for (const bad of [undefined, null, [], 'x', {}, { requestId: 'corto' }, { requestId: 'a'.repeat(65) }, { requestId: 'tiene espacios!!' }, { requestId: rid(), userId: 99 }, { requestId: 12345678 }]) {
      assert.equal((await http(p, 'POST', '/jobs', bad)).status, 400, JSON.stringify(bad));
    }
    assert.equal((await q('SELECT count(*)::int n FROM "AiJobs" WHERE "UserId"=$1', [p.id]))[0].n, 0, 'lo inválido no crea nada');
    const requestId = rid();
    const first = await http(p, 'POST', '/jobs', { requestId });
    assert.equal(first.status, 201);
    assert.deepEqual([first.body.status, first.body.contextVersion, first.body.reason, first.body.retryAt], ['PENDING', 1, null, null]);
    noInternals(first.text);
    const again = await http(p, 'POST', '/jobs', { requestId });
    assert.deepEqual([again.status, again.body.id], [200, first.body.id], 'mismo requestId = misma respuesta');
    const second = await http(p, 'POST', '/jobs', { requestId: rid() });
    assert.deepEqual([second.status, second.body.code, second.body.job.id], [409, 'analysis_in_progress', first.body.id]);
    // El hash que guarda el API coincide con el que calcula el SQL del worker: el reclamo no invalida el job.
    const claimed = await claim();
    assert.equal(claimed.jobId, first.body.id, 'el worker acepta el job creado por el API');
    assert.equal((await q('SELECT "contextHash" FROM "AiJobs" WHERE id=$1', [first.body.id]))[0].contextHash, sha256(p.payload));
  });

  await t.test('concurrencia: seis altas distintas a la vez dejan un solo análisis; cinco con el mismo requestId, una sola fila', async () => {
    await drain();
    const p = await mkPerson();
    const results = await Promise.all(Array.from({ length: 6 }, () => http(p, 'POST', '/jobs', { requestId: rid() })));
    assert.deepEqual(results.map((r) => r.status).sort(), [201, 409, 409, 409, 409, 409]);
    assert.equal((await q('SELECT count(*)::int n FROM "AiJobs" WHERE "UserId"=$1', [p.id]))[0].n, 1);
    const p2 = await mkPerson(); const same = rid();
    const repeated = await Promise.all(Array.from({ length: 5 }, () => http(p2, 'POST', '/jobs', { requestId: same })));
    assert.deepEqual(repeated.map((r) => r.status).sort(), [200, 200, 200, 200, 201]);
    assert.equal(new Set(repeated.map((r) => r.body.id)).size, 1);
    assert.equal((await q('SELECT count(*)::int n FROM "AiJobs" WHERE "UserId"=$1', [p2.id]))[0].n, 1);
  });

  await t.test('propietario: otra persona recibe 404 en consultar, cancelar y revisar; ids malformados también; las listas son solo propias', async () => {
    const a = await mkPerson(); const b = await mkPerson();
    const { jobId } = await publishedJob(a);
    const candidateId = (await q('SELECT id FROM "SkillCandidates" WHERE "jobId"=$1 ORDER BY id LIMIT 1', [jobId]))[0].id;
    for (const [method, route, body] of [['GET', `/jobs/${jobId}`], ['POST', `/jobs/${jobId}/cancel`, {}], ['POST', `/candidates/${candidateId}/review`, { action: 'accept' }]]) {
      const r = await http(b, method, route, body);
      assert.deepEqual([r.status, r.body.code], [404, 'not_found'], `${method} ${route}`);
      assert.ok(!r.text.includes('sql'), 'no revela nada del recurso ajeno');
    }
    for (const bad of ['0', '-1', 'abc', '1.5', '99999999999', '1e3', '%20', '1;DROP']) {
      assert.equal((await http(a, 'GET', `/jobs/${bad}`)).status, 404, bad);
    }
    assert.deepEqual((await http(b, 'GET', '/jobs')).body.jobs, []);
    assert.deepEqual((await http(b, 'GET', '/candidates')).body.candidates, []);
    assert.equal((await http(a, 'GET', '/candidates')).body.candidates.length, 3);
    assert.equal((await q('SELECT status FROM "AiJobs" WHERE id=$1', [jobId]))[0].status, 'REVIEW_REQUIRED', 'lo ajeno no cambió');
  });

  await t.test('consultar: el análisis trae las candidatas con etiquetas del catálogo y sin estado interno', async () => {
    const p = await mkPerson();
    const { jobId } = await publishedJob(p);
    const r = await http(p, 'GET', `/jobs/${jobId}`);
    assert.equal(r.status, 200);
    assert.equal(r.body.status, 'REVIEW_REQUIRED');
    assert.deepEqual(r.body.candidates.map((c) => [c.skillKey, c.level, c.confirmedLevel, c.status]), [['sql', 3, null, 'REVIEW_REQUIRED'], ['comunicacion', null, null, 'REVIEW_REQUIRED'], ['liderazgo', 2, null, 'REVIEW_REQUIRED']]);
    assert.deepEqual(r.body.candidates[0].label, { es: 'ES sql', en: 'EN sql' });
    assert.deepEqual(r.body.candidates[0].citations, ['interests']);
    noInternals(r.text);
    assert.equal((await http(p, 'GET', '/candidates?status=REVIEW_REQUIRED')).body.candidates.length, 3);
    assert.equal((await http(p, 'GET', '/candidates?status=ACCEPTED')).body.candidates.length, 0);
    assert.equal((await http(p, 'GET', '/candidates?status=cualquiera')).status, 400);
    assert.equal((await http(p, 'GET', '/jobs')).body.jobs[0].id, jobId);
  });

  await t.test('motivos visibles: códigos gruesos, sin detalle de infraestructura; la espera por presupuesto trae retryAt', async () => {
    const p = await mkPerson(); await drain();
    const mk = async (status, errorCode, notBefore = null) => (await q(`INSERT INTO "AiJobs" ("UserId","kind","contextVersion","contextHash","requestId","status","errorCode","notBefore","createdAt","updatedAt")
      VALUES ($1,'competency_extraction',1,'x',$2,$3,$4,$5,now(),now()) RETURNING id`, [p.id, rid(), status, errorCode, notBefore]))[0].id;
    const expected = [['FAILED', 'provider_auth', 'provider'], ['FAILED', 'timeout', 'provider'], ['PENDING', 'invalid_output', 'invalid_output'], ['FAILED', 'decrypt_failed', 'internal'], ['FAILED', 'lease_expired', 'internal'],
      ['INVALIDATED', 'context_reencrypted', 'context_changed'], ['INVALIDATED', 'deletion_requested', 'revoked'], ['FAILED', 'budget_not_configured', 'budget'], ['FAILED', 'algo_raro', 'internal']];
    for (const [status, code, reason] of expected) {
      const id = await mk(status, code);
      const r = await http(p, 'GET', `/jobs/${id}`);
      assert.equal(r.body.reason, reason, code);
      noInternals(r.text);
    }
    const future = new Date(Date.now() + 600000);
    const waiting = await mk('PENDING', 'budget_exhausted', future);
    const w = await http(p, 'GET', `/jobs/${waiting}`);
    assert.deepEqual([w.body.reason, new Date(w.body.retryAt).getTime()], ['budget', future.getTime()]);
  });

  await t.test('revisar: aceptar (igual o a la baja), rechazar, no subir niveles, idempotencia y cierre del análisis', async () => {
    const p = await mkPerson();
    const { jobId } = await publishedJob(p);
    const cands = (await http(p, 'GET', `/jobs/${jobId}`)).body.candidates;
    const [sql, comm, lead] = cands;
    // Entrada inválida
    for (const bad of [undefined, {}, { action: 'otra' }, { action: 'accept', level: 5 }, { action: 'accept', level: 0 }, { action: 'accept', level: 2.5 }, { action: 'accept', level: '2' }, { action: 'reject', level: 1 }, { action: 'accept', extra: 1 }]) {
      assert.equal((await http(p, 'POST', `/candidates/${sql.id}/review`, bad)).status, 400, JSON.stringify(bad));
    }
    // Subir por encima de lo propuesto, o poner nivel donde no se propuso ninguno
    assert.deepEqual([(await http(p, 'POST', `/candidates/${sql.id}/review`, { action: 'accept', level: 4 })).status, (await http(p, 'POST', `/candidates/${sql.id}/review`, { action: 'accept', level: 4 })).body.code], [422, 'cannot_raise_level']);
    assert.equal((await http(p, 'POST', `/candidates/${comm.id}/review`, { action: 'accept', level: 1 })).body.code, 'cannot_raise_level');
    // Aceptar a la baja
    const lowered = await http(p, 'POST', `/candidates/${sql.id}/review`, { action: 'accept', level: 2 });
    assert.deepEqual([lowered.status, lowered.body.status, lowered.body.level, lowered.body.confirmedLevel, lowered.body.repeated], [200, 'ACCEPTED', 3, 2, false]);
    assert.ok(lowered.body.reviewedAt);
    noInternals(lowered.text);
    assert.equal((await http(p, 'POST', `/candidates/${sql.id}/review`, { action: 'accept', level: 2 })).body.repeated, true, 'repetir lo mismo es idempotente');
    assert.equal((await http(p, 'POST', `/candidates/${sql.id}/review`, { action: 'reject' })).body.code, 'already_reviewed');
    assert.equal((await http(p, 'POST', `/candidates/${sql.id}/review`, { action: 'accept', level: 1 })).body.code, 'already_reviewed');
    // Aceptar sin nivel propuesto y sin corregir; poner a null un nivel propuesto
    const plain = await http(p, 'POST', `/candidates/${comm.id}/review`, { action: 'accept' });
    assert.deepEqual([plain.body.status, plain.body.level, plain.body.confirmedLevel], ['ACCEPTED', null, null]);
    assert.equal((await q('SELECT status FROM "AiJobs" WHERE id=$1', [jobId]))[0].status, 'REVIEW_REQUIRED', 'queda una por revisar');
    const rejected = await http(p, 'POST', `/candidates/${lead.id}/review`, { action: 'reject' });
    assert.deepEqual([rejected.body.status, rejected.body.confirmedLevel], ['REJECTED', null]);
    assert.equal((await q('SELECT status FROM "AiJobs" WHERE id=$1', [jobId]))[0].status, 'COMPLETED', 'sin nada pendiente, el análisis termina');
    // La propuesta de la IA no cambió; la decisión de la persona se guarda aparte; el DB impone el tope.
    const row = (await q('SELECT level, "confirmedLevel" FROM "SkillCandidates" WHERE id=$1', [sql.id]))[0];
    assert.deepEqual([row.level, row.confirmedLevel], [3, 2]);
    await assert.rejects(q('UPDATE "SkillCandidates" SET "confirmedLevel"=4 WHERE id=$1', [sql.id]), (e) => e.code === '23514');
    await assert.rejects(q('UPDATE "SkillCandidates" SET level=1 WHERE id=$1', [sql.id]), /immutable/);
    // Poner a null lo propuesto
    const q2 = await mkPerson(); const second = await publishedJob(q2);
    const c2 = (await http(q2, 'GET', `/jobs/${second.jobId}`)).body.candidates[0];
    assert.equal((await http(q2, 'POST', `/candidates/${c2.id}/review`, { action: 'accept', level: null })).body.confirmedLevel, null);
    // Exportación incluye la decisión
    const exported = await personalData(await User.findByPk(p.id), 'es');
    assert.deepEqual(exported.skillCandidates.map((c) => [c.skillKey, c.level, c.confirmedLevel, c.status]), [['sql', 3, 2, 'ACCEPTED'], ['comunicacion', null, null, 'ACCEPTED'], ['liderazgo', 2, null, 'REJECTED']]);
    assert.ok(exported.skillCandidates.every((c) => c.reviewedAt));
  });

  await t.test('cancelar: pendiente, en curso (el worker no publica) y por revisar; idempotente; lo terminado no se cancela; luego se puede pedir otro', async () => {
    await drain();
    const p = await mkPerson();
    const j1 = (await http(p, 'POST', '/jobs', { requestId: rid() })).body;
    const c1 = await http(p, 'POST', `/jobs/${j1.id}/cancel`, {});
    assert.deepEqual([c1.status, c1.body.status], [200, 'CANCELLED']);
    assert.equal((await http(p, 'POST', `/jobs/${j1.id}/cancel`, {})).body.status, 'CANCELLED', 'idempotente');
    assert.equal(await claim(), null, 'el worker ya no lo ve');
    // En curso
    const j2 = (await http(p, 'POST', '/jobs', { requestId: rid() })).body;
    const claimed = await claim(); assert.equal(claimed.jobId, j2.id);
    assert.equal((await http(p, 'POST', `/jobs/${j2.id}/cancel`, {})).body.status, 'CANCELLED');
    assert.equal((await worker.query('SELECT worker_heartbeat($1,$2,$3,120) AS ok', [j2.id, claimed.fence, 'w-89'])).rows[0].ok, false);
    assert.deepEqual(await publish(j2.id, claimed.fence, GOOD), { ok: false, reason: 'fenced' });
    assert.equal((await q('SELECT count(*)::int n FROM "SkillCandidates" WHERE "jobId"=$1', [j2.id]))[0].n, 0);
    // Por revisar: lo no revisado se descarta, lo aceptado se conserva
    const { jobId } = await publishedJob(p);
    const [a] = (await http(p, 'GET', `/jobs/${jobId}`)).body.candidates;
    await http(p, 'POST', `/candidates/${a.id}/review`, { action: 'accept' });
    const cancelled = await http(p, 'POST', `/jobs/${jobId}/cancel`, {});
    assert.equal(cancelled.body.status, 'CANCELLED');
    assert.deepEqual((await q('SELECT "skillKey", status FROM "SkillCandidates" WHERE "jobId"=$1 ORDER BY id', [jobId])).map((r) => r.status), ['ACCEPTED', 'REJECTED', 'REJECTED']);
    // Lo terminado no se cancela
    const done = (await q(`INSERT INTO "AiJobs" ("UserId","kind","contextVersion","contextHash","requestId","status","createdAt","updatedAt") VALUES ($1,'competency_extraction',1,'x',$2,'COMPLETED',now(),now()) RETURNING id`, [p.id, rid()]))[0].id;
    assert.deepEqual([(await http(p, 'POST', `/jobs/${done}/cancel`, {})).status, (await http(p, 'POST', `/jobs/${done}/cancel`, {})).body.code], [409, 'job_final']);
    // Tras cancelar se puede pedir otro
    assert.equal((await http(p, 'POST', '/jobs', { requestId: rid() })).status, 201);
  });

  await t.test('cancelar con una publicación en curso: espera a que confirme y descarta lo publicado sin revisar', async () => {
    await drain();
    const p = await mkPerson();
    const job = (await http(p, 'POST', '/jobs', { requestId: rid() })).body;
    const claimed = await claim();
    await worker.query('BEGIN');
    await worker.query('SELECT worker_publish($1,$2,$3::jsonb)', [job.id, claimed.fence, JSON.stringify(GOOD)]);
    const cancel = http(p, 'POST', `/jobs/${job.id}/cancel`, {});
    assert.equal(await blocked(cancel), true, 'espera a la publicación');
    await worker.query('COMMIT');
    assert.equal((await cancel).body.status, 'CANCELLED');
    assert.deepEqual((await q('SELECT status FROM "SkillCandidates" WHERE "jobId"=$1', [job.id])).map((r) => r.status), ['REJECTED', 'REJECTED', 'REJECTED']);
  });

  await t.test('revocación: el análisis queda invalidado y visible como «revoked»; no se puede crear ni revisar', async () => {
    const p = await mkPerson();
    const { jobId } = await publishedJob(p);
    const cand = (await http(p, 'GET', `/jobs/${jobId}`)).body.candidates[0];
    await consent.setConsent(p.id, 'professional_bridge', 'revoked');
    const job = await http(p, 'GET', `/jobs/${jobId}`);
    assert.deepEqual([job.body.status, job.body.reason], ['INVALIDATED', 'revoked']);
    assert.ok(job.body.candidates.every((c) => c.status === 'INVALIDATED'));
    assert.equal((await http(p, 'POST', `/candidates/${cand.id}/review`, { action: 'accept' })).body.code, 'candidate_invalidated');
    assert.deepEqual([(await http(p, 'POST', '/jobs', { requestId: rid() })).status, (await http(p, 'POST', '/jobs', { requestId: rid() })).body.code], [403, 'consent_required']);
    assert.equal((await http(p, 'POST', `/jobs/${jobId}/cancel`, {})).body.code, 'job_final');
  });

  await t.test('disparo configurable: explícito por defecto; con AI_ANALYSIS_TRIGGER=automatic el análisis se pide solo al confirmar el contexto', async () => {
    await drain();
    const confirmDirect = async (person, text) => {
      const fields = [{ key: 'motivations', text }];
      const preview = await bridge.preview(person.id, { fields });
      return bridge.confirm(person.id, { fields, token: preview.token, requestId: rid() });
    };
    // Explícito: confirmar el contexto no crea nada.
    const e = await mkPerson({ withContext: false });
    await confirmDirect(e, 'Texto explícito');
    assert.equal((await q('SELECT count(*)::int n FROM "AiJobs" WHERE "UserId"=$1', [e.id]))[0].n, 0);
    process.env.AI_ANALYSIS_TRIGGER = 'automatic';
    try {
      const a = await mkPerson({ withContext: false });
      await confirmDirect(a, 'Texto automático');
      const auto = await q('SELECT status, "contextVersion", "requestId" FROM "AiJobs" WHERE "UserId"=$1', [a.id]);
      assert.deepEqual([auto.length, auto[0].status, auto[0].contextVersion], [1, 'PENDING', 1]);
      assert.match(auto[0].requestId, /^auto-[0-9a-f]{40}$/);
      assert.equal((await http(a, 'GET', '/jobs')).body.jobs.length, 1, 'el mismo análisis se ve por la API');
      // Con uno vivo, otra confirmación no crea otro ni falla.
      await confirmDirect(a, 'Otra versión');
      assert.equal((await q('SELECT count(*)::int n FROM "AiJobs" WHERE "UserId"=$1', [a.id]))[0].n, 1);
      // Sin consentimiento vigente: la confirmación funciona y no se crea análisis.
      const n = await mkPerson({ withConsent: false, withContext: false });
      await confirmDirect(n, 'Sin consentimiento');
      assert.equal((await q('SELECT count(*)::int n FROM "AiJobs" WHERE "UserId"=$1', [n.id]))[0].n, 0);
      assert.equal((await q('SELECT count(*)::int n FROM "CareerContextVersions" WHERE "UserId"=$1', [n.id]))[0].n, 1);
    } finally { delete process.env.AI_ANALYSIS_TRIGGER; }
  });
});
