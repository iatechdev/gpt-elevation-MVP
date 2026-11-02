// ES-88 · Revocación, borrado (ES-23) y exportación con los jobs y candidatas del worker (ES-84), contra PostgreSQL REAL.
// El código de la aplicación es el REAL (consent.setConsent, careerContext.revoke, dataRights, deletionProcessor, personalData) sobre las
// migraciones reales (ES-85, con sus disparadores). El worker es una conexión real con el rol `elevation_worker` que llama a worker_publish /
// worker_claim / worker_heartbeat / worker_fail. Crea y borra SOLO su propia base aleatoria en un clúster desechable de loopback; datos sintéticos.
//   ES88_TEST_DATABASE_URL=postgres://elevation:elevation_local@127.0.0.1:54339/postgres node --test test/integration/es-88-postgres.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { Client } = require('pg');
const { Sequelize } = require('sequelize');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const sha256 = (text) => crypto.createHash('sha256').update(text, 'utf8').digest('hex');
const backend = path.resolve(__dirname, '..', '..');
const blocked = async (promise, ms = 400) => Promise.race([promise.then(() => false, () => false), sleep(ms).then(() => true)]);

test('ES-88 PostgreSQL: revocación, borrado con worker activo y exportación de jobs y candidatas', { timeout: 200000 }, async (t) => {
  assert.ok(process.env.ES88_TEST_DATABASE_URL, 'Se requiere ES88_TEST_DATABASE_URL (clúster desechable en loopback)');
  const target = new URL(process.env.ES88_TEST_DATABASE_URL);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname), 'Solo loopback');
  const dbName = `es88_test_${crypto.randomBytes(8).toString('hex')}`;
  const workerPassword = crypto.randomBytes(16).toString('hex');
  const urlFor = (name, user, password) => { const u = new URL(target.toString()); u.pathname = `/${name}`; if (user) { u.username = user; u.password = password; } return u.toString(); };
  const admin = new Client({ connectionString: target.toString(), ssl: false }); await admin.connect();
  let created = false; let app; const extra = [];
  t.after(async () => {
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

  // La aplicación usa el rol dueño de la base (como el API); el worker, su rol restringido.
  app = new Sequelize(urlFor(dbName), { logging: false, dialectOptions: { ssl: false }, pool: { max: 10, min: 0 } });
  process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
  process.env.DATA_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
  process.env.NODE_ENV = 'test';
  const dbModule = require.resolve('../../database');
  require.cache[dbModule] = { id: dbModule, filename: dbModule, loaded: true, exports: { sequelize: app } };
  require('../../associations')();
  const { CORE } = require('../../utils/personalData');
  for (const [, name] of CORE) require('../../' + name);
  const consent = require('../../utils/consent');
  const bridge = require('../../utils/careerContext');
  const rights = require('../../utils/dataRights');
  const { processDeletion } = require('../../utils/deletionProcessor');
  const aiJobs = require('../../utils/aiJobs');
  const { personalData } = require('../../utils/personalData');
  const User = require('../../User');
  const { encriptarV2 } = require('../../utils/crypto');

  const openWorker = async () => { const c = new Client({ connectionString: urlFor(dbName, 'elevation_worker', workerPassword), ssl: false }); await c.connect(); extra.push(c); return c; };
  const worker = await openWorker();
  const db = new Client({ connectionString: urlFor(dbName), ssl: false }); await db.connect(); extra.push(db);
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
  const PAYLOAD_TEXT = [{ key: 'motivations', text: 'Texto sintético del contexto' }, { key: 'interests', text: 'Datos' }];
  const payloadOf = () => encriptarV2(JSON.stringify(PAYLOAD_TEXT));
  async function mkPerson() {
    const userId = await mkUser();
    await consent.setConsent(userId, 'professional_bridge', 'granted');
    const payload = payloadOf();
    await q(`INSERT INTO "CareerContextVersions" ("UserId","version","status","payload","origins","consentVersion","requestId","approvedAt","createdAt","updatedAt")
      VALUES ($1,1,'active',$2,$3,1,$4,now(),now(),now())`, [userId, payload, JSON.stringify(PAYLOAD_TEXT.map((f, index) => ({ key: f.key, index, type: 'direct' }))), `ctx-${crypto.randomBytes(6).toString('hex')}`]);
    return { userId, payload };
  }
  const mkJob = async (p, status = 'PENDING') => (await q(`INSERT INTO "AiJobs" ("UserId","kind","contextVersion","contextHash","requestId","status","createdAt","updatedAt")
    VALUES ($1,'competency_extraction',1,$2,$3,$4,now(),now()) RETURNING id`, [p.userId, sha256(p.payload), `job-${crypto.randomBytes(8).toString('hex')}`, status]))[0].id;
  const mkCandidate = (p, jobId, skillKey, status = 'REVIEW_REQUIRED') => q(`INSERT INTO "SkillCandidates" ("jobId","UserId","skillKey","level","citations","status","catalogVersion","createdAt","updatedAt")
    VALUES ($1,$2,$3,2,'["interests"]',$4,1,now(),now())`, [jobId, p.userId, skillKey, status]);
  const jobs = (userId) => q('SELECT id, status, "errorCode", "leaseOwner" FROM "AiJobs" WHERE "UserId"=$1 ORDER BY id', [userId]);
  const cands = (userId) => q('SELECT "skillKey", status FROM "SkillCandidates" WHERE "UserId"=$1 ORDER BY id', [userId]);
  await q(`INSERT INTO "SkillCatalogs" ("version","status","publishedAt","createdAt","updatedAt") VALUES (1,'published',now(),now(),now())`);
  const catalogId = (await q('SELECT id FROM "SkillCatalogs" WHERE version=1'))[0].id;
  for (const key of ['sql', 'comunicacion']) {
    await q(`INSERT INTO "SkillDefinitions" ("catalogId","skillKey","type","labels","rubric","createdAt","updatedAt") VALUES ($1,$2,'domain','{"es":"x","en":"x"}','{"levels":{}}',now(),now())`, [catalogId, key]);
  }
  const claim = async (client = worker, owner = 'w-88') => (await client.query('SELECT worker_claim($1,120,3) AS r', [owner])).rows[0].r;
  const publish = async (client, jobId, fence, list) => (await client.query('SELECT worker_publish($1,$2,$3::jsonb) AS r', [jobId, fence, JSON.stringify(list)])).rows[0].r;
  const GOOD = [{ skillKey: 'sql', level: null, citations: ['interests'] }, { skillKey: 'comunicacion', level: 2, citations: ['motivations'] }];
  const drain = () => q(`UPDATE "AiJobs" SET status='CANCELLED' WHERE status IN ('PENDING','RUNNING','REVIEW_REQUIRED')`);

  await t.test('revocar el puente invalida, en la misma transacción, jobs y candidatas vivos de ESA persona y deja intacto lo demás', async () => {
    const a = await mkPerson(); const b = await mkPerson();
    const pending = await mkJob(a); const running = await mkJob(a, 'RUNNING'); const review = await mkJob(a, 'REVIEW_REQUIRED'); const done = await mkJob(a, 'COMPLETED');
    await mkCandidate(a, review, 'sql'); await mkCandidate(a, review, 'comunicacion', 'ACCEPTED'); await mkCandidate(a, done, 'sql', 'REJECTED');
    const bJob = await mkJob(b, 'REVIEW_REQUIRED'); await mkCandidate(b, bJob, 'sql');
    const before = await q('SELECT count(*)::int n FROM "AiJobs"');
    await consent.setConsent(a.userId, 'professional_bridge', 'revoked');
    const aJobs = await jobs(a.userId);
    assert.deepEqual(aJobs.map((j) => [j.id, j.status, j.errorCode]), [
      [pending, 'INVALIDATED', 'consent_revoked'], [running, 'INVALIDATED', 'consent_revoked'], [review, 'INVALIDATED', 'consent_revoked'], [done, 'COMPLETED', null]]);
    assert.equal(aJobs.find((j) => j.id === running).leaseOwner, null, 'el lease se libera');
    assert.deepEqual(await cands(a.userId), [{ skillKey: 'sql', status: 'INVALIDATED' }, { skillKey: 'comunicacion', status: 'INVALIDATED' }, { skillKey: 'sql', status: 'REJECTED' }],
      'por revisar y aceptadas se invalidan; la rechazada no cambia');
    assert.deepEqual((await jobs(b.userId)).map((j) => j.status), ['REVIEW_REQUIRED']);
    assert.deepEqual(await cands(b.userId), [{ skillKey: 'sql', status: 'REVIEW_REQUIRED' }], 'otra persona, intacta');
    assert.equal((await q('SELECT count(*)::int n FROM "AiJobs"'))[0].n, before[0].n);
    // Idempotente, y volver a consentir no resucita nada.
    const again = await consent.setConsent(a.userId, 'professional_bridge', 'revoked');
    assert.equal(again.changed, false);
    await consent.setConsent(a.userId, 'professional_bridge', 'granted');
    assert.ok((await jobs(a.userId)).filter((j) => j.status === 'INVALIDATED').length === 3);
    assert.equal((await cands(a.userId)).filter((c) => c.status === 'REVIEW_REQUIRED').length, 0);
  });

  await t.test('atomicidad: si la invalidación falla, la revocación se deshace (el consentimiento sigue vigente y nada cambia)', async () => {
    const p = await mkPerson(); const jobId = await mkJob(p, 'REVIEW_REQUIRED'); await mkCandidate(p, jobId, 'sql');
    const original = aiJobs.invalidateForUser;
    aiJobs.invalidateForUser = async () => { throw new Error('fallo sintético'); };
    try { await assert.rejects(consent.setConsent(p.userId, 'professional_bridge', 'revoked'), /fallo sintético/); } finally { aiJobs.invalidateForUser = original; }
    assert.equal((await q(`SELECT status FROM "Consents" WHERE "UserId"=$1 AND purpose='professional_bridge'`, [p.userId]))[0].status, 'granted');
    assert.deepEqual((await jobs(p.userId)).map((j) => j.status), ['REVIEW_REQUIRED']);
    assert.equal((await q(`SELECT status FROM "CareerContextVersions" WHERE "UserId"=$1`, [p.userId]))[0].status, 'active');
    assert.equal((await q(`SELECT count(*)::int n FROM "ConsentEvents" WHERE "UserId"=$1 AND status='revoked'`, [p.userId]))[0].n, 0, 'sin evento de revocación a medias');
  });

  // Mantiene abierta la transacción de la revocación DESPUÉS de invalidar (con todos sus bloqueos tomados), para medir contra el worker.
  function holdRevocation(userId, mode = 'consent') {
    const gate = {}; gate.promise = new Promise((r) => { gate.open = r; });
    const original = aiJobs.invalidateForUser;
    aiJobs.invalidateForUser = async (...args) => { const result = await original(...args); await gate.promise; return result; };
    const run = mode === 'consent' ? consent.setConsent(userId, 'professional_bridge', 'revoked') : bridge.revoke(userId);
    const settled = run.finally(() => { aiJobs.invalidateForUser = original; });
    return { gate, settled };
  }

  await t.test('revocación y worker, orden 1: la revocación (con el gancho real) retiene los bloqueos; la publicación espera y no publica nada', async () => {
    await drain();
    const p = await mkPerson(); const jobId = await mkJob(p);
    const claimed = await claim(); assert.equal(claimed.jobId, jobId);
    const held = holdRevocation(p.userId);
    await sleep(200);
    const pending = publish(worker, jobId, claimed.fence, GOOD);
    assert.equal(await blocked(pending), true, 'la publicación espera a la revocación');
    held.gate.open(); await held.settled;
    assert.deepEqual(await pending, { ok: false, reason: 'fenced' }, 'el job ya estaba invalidado por el gancho');
    assert.equal((await cands(p.userId)).length, 0);
    assert.deepEqual((await jobs(p.userId)).map((j) => [j.status, j.errorCode]), [['INVALIDATED', 'consent_revoked']]);
    assert.equal((await worker.query('SELECT worker_heartbeat($1,$2,$3,120) AS ok', [jobId, claimed.fence, 'w-88'])).rows[0].ok, false, 'el heartbeat avisa al worker');
  });

  await t.test('revocación y worker, orden 2: la publicación va primero; la revocación espera y luego invalida lo recién publicado', async () => {
    await drain();
    const p = await mkPerson(); const jobId = await mkJob(p);
    const claimed = await claim();
    await worker.query('BEGIN');
    assert.deepEqual((await worker.query('SELECT worker_publish($1,$2,$3::jsonb) AS r', [jobId, claimed.fence, JSON.stringify(GOOD)])).rows[0].r, { ok: true, candidates: 2 });
    const revocation = consent.setConsent(p.userId, 'professional_bridge', 'revoked');
    assert.equal(await blocked(revocation), true, 'la revocación espera a la publicación');
    await worker.query('COMMIT');
    await revocation;
    assert.deepEqual((await cands(p.userId)).map((c) => c.status), ['INVALIDATED', 'INVALIDATED'], 'nunca queda una candidata por revisar tras la revocación');
    assert.deepEqual((await jobs(p.userId)).map((j) => j.status), ['INVALIDATED']);
  });

  await t.test('revocar solo la versión de contexto (voluntaria) también invalida lo derivado, incluso con una publicación en curso', async () => {
    await drain();
    const p = await mkPerson(); const jobId = await mkJob(p);
    const claimed = await claim();
    await worker.query('BEGIN');
    await worker.query('SELECT worker_publish($1,$2,$3::jsonb)', [jobId, claimed.fence, JSON.stringify(GOOD)]);
    const revocation = bridge.revoke(p.userId);
    assert.equal(await blocked(revocation), true, 'espera a la publicación en curso (bloqueo del job)');
    await worker.query('COMMIT');
    assert.deepEqual(await revocation, { revoked: true });
    assert.deepEqual((await cands(p.userId)).map((c) => c.status), ['INVALIDATED', 'INVALIDATED']);
    const row = (await jobs(p.userId))[0];
    assert.deepEqual([row.status, row.errorCode], ['INVALIDATED', 'context_revoked']);
    // Sin versión activa que revocar no se toca nada.
    const other = await mkPerson(); const otherJob = await mkJob(other); await q(`UPDATE "CareerContextVersions" SET status='superseded' WHERE "UserId"=$1`, [other.userId]);
    assert.deepEqual(await bridge.revoke(other.userId), { revoked: false });
    assert.deepEqual((await jobs(other.userId)).map((j) => [j.id, j.status]), [[otherJob, 'PENDING']]);
  });

  await t.test('exportación: incluye los jobs y candidatas de la persona (incluso invalidados), sin estado técnico interno y sin datos ajenos', async () => {
    await drain();
    const a = await mkPerson(); const b = await mkPerson();
    const job1 = await mkJob(a, 'REVIEW_REQUIRED'); await mkCandidate(a, job1, 'sql'); await mkCandidate(a, job1, 'comunicacion', 'ACCEPTED');
    const job2 = await mkJob(a, 'INVALIDATED'); await mkCandidate(a, job2, 'sql', 'INVALIDATED');
    const bJob = await mkJob(b, 'REVIEW_REQUIRED'); await mkCandidate(b, bJob, 'sql');
    const user = await User.findByPk(a.userId);
    const data = await personalData(user, 'es');
    assert.deepEqual(data.aiJobs.map((j) => [j.id, j.kind, j.status, j.contextVersion]), [[job1, 'competency_extraction', 'REVIEW_REQUIRED', 1], [job2, 'competency_extraction', 'INVALIDATED', 1]]);
    assert.deepEqual(data.skillCandidates.map((c) => [c.jobId, c.skillKey, c.level, c.citations, c.status]), [
      [job1, 'sql', 2, ['interests'], 'REVIEW_REQUIRED'], [job1, 'comunicacion', 2, ['interests'], 'ACCEPTED'], [job2, 'sql', 2, ['interests'], 'INVALIDATED']]);
    const text = JSON.stringify([data.aiJobs, data.skillCandidates]);
    for (const hidden of ['contextHash', 'requestId', 'leaseOwner', 'fence', 'notBefore', 'UserId']) assert.ok(!text.includes(`"${hidden}"`), `no se exporta ${hidden}`);
    assert.ok(!JSON.stringify(data).includes(String(bJob) + ',"kind"'), 'nada de otra persona');
    // Por el camino público (vista previa y descarga) con la misma huella.
    const preview = await rights.preview(a.userId, { type: 'personal', locale: 'es' });
    assert.equal(preview.data.aiJobs.length, 2);
    assert.deepEqual(await rights.download(a.userId, preview.id, (d) => d), preview.data);
  });

  await t.test('borrado con el worker activo: la solicitud invalida lo vivo; el worker no escribe ni antes ni después de la purga; todo se borra', async () => {
    await drain();
    const a = await mkPerson(); const b = await mkPerson();
    const live = await mkJob(a); const claimed = await claim(); assert.equal(claimed.jobId, live);       // un worker lo está procesando
    const review = await mkJob(a, 'REVIEW_REQUIRED'); await mkCandidate(a, review, 'sql');
    const bJob = await mkJob(b, 'REVIEW_REQUIRED'); await mkCandidate(b, bJob, 'sql');
    const bBefore = { jobs: await jobs(b.userId), cands: await cands(b.userId) };

    const receipt = await rights.requestDeletion(a.userId);
    assert.equal(receipt.repeated, false);
    assert.deepEqual((await jobs(a.userId)).map((j) => [j.status, j.errorCode]), [['INVALIDATED', 'deletion_requested'], ['INVALIDATED', 'deletion_requested']]);
    assert.ok((await cands(a.userId)).every((c) => c.status === 'INVALIDATED'));
    // El worker en curso ya no puede hacer nada: heartbeat falso, publicar y fallar no escriben.
    assert.equal((await worker.query('SELECT worker_heartbeat($1,$2,$3,120) AS ok', [live, claimed.fence, 'w-88'])).rows[0].ok, false);
    assert.deepEqual(await publish(worker, live, claimed.fence, GOOD), { ok: false, reason: 'fenced' });
    assert.equal((await cands(a.userId)).filter((c) => c.status === 'REVIEW_REQUIRED').length, 0);
    assert.equal(await claim(), null, 'ni siquiera un job nuevo de esa persona se reclama');
    const late = await mkJob(a);                       // un job creado después de la solicitud (p. ej. una petición en vuelo)
    assert.equal(await claim(), null);
    assert.deepEqual((await jobs(a.userId)).find((j) => j.id === late), { id: late, status: 'INVALIDATED', errorCode: 'consent_revoked', leaseOwner: null });

    const result = await processDeletion(receipt.id, { quiescent: true });
    assert.equal(result.status, 'awaiting_verification');
    assert.deepEqual(await jobs(a.userId), [], 'jobs borrados');
    assert.deepEqual(await cands(a.userId), [], 'candidatas borradas');
    // Después de la purga el worker no puede escribir: el job ya no existe.
    assert.deepEqual(await publish(worker, live, claimed.fence, GOOD), { ok: false, reason: 'job_not_found' });
    assert.deepEqual((await worker.query('SELECT worker_fail($1,$2,$3,true,0,3) AS r', [live, claimed.fence, 'timeout'])).rows[0].r, { ok: false, reason: 'job_not_found' });
    assert.equal((await worker.query('SELECT worker_heartbeat($1,$2,$3,120) AS ok', [live, claimed.fence, 'w-88'])).rows[0].ok, false);
    assert.deepEqual(await cands(a.userId), []);
    // Lo de otra persona no se toca.
    assert.deepEqual({ jobs: await jobs(b.userId), cands: await cands(b.userId) }, bBefore);
    // Repetir la purga (replay) tampoco falla ni deja restos.
    const replay = await processDeletion(receipt.id, { quiescent: true, replay: true });
    assert.equal(replay.status, 'awaiting_verification');
  });

  await t.test('borrado con una publicación en curso: la solicitud espera a la publicación y después se invalida y se purga todo lo publicado', async () => {
    await drain();
    const a = await mkPerson(); const jobId = await mkJob(a);
    const claimed = await claim();
    await worker.query('BEGIN');
    await worker.query('SELECT worker_publish($1,$2,$3::jsonb)', [jobId, claimed.fence, JSON.stringify(GOOD)]);
    const request = rights.requestDeletion(a.userId);
    assert.equal(await blocked(request), true, 'la solicitud de borrado espera a la publicación');
    await worker.query('COMMIT');
    const receipt = await request;
    assert.ok((await cands(a.userId)).every((c) => c.status === 'INVALIDATED') && (await cands(a.userId)).length === 2);
    await processDeletion(receipt.id, { quiescent: true });
    assert.deepEqual([await jobs(a.userId), await cands(a.userId)], [[], []]);
  });

  await t.test('la purga espera a una publicación en curso (la candidata toma la fila de Users) y borra también la candidata que esta acaba de confirmar', async () => {
    await drain();
    const a = await mkPerson(); const jobId = await mkJob(a, 'REVIEW_REQUIRED'); await mkCandidate(a, jobId, 'sql');
    const receipt = await rights.requestDeletion(a.userId);
    const holder = new Client({ connectionString: urlFor(dbName), ssl: false }); await holder.connect(); extra.push(holder);
    await holder.query('BEGIN');
    await holder.query('SELECT id FROM "AiJobs" WHERE "UserId" = $1 FOR UPDATE', [a.userId]); // lo mismo que retiene worker_publish mientras escribe
    await holder.query(`INSERT INTO "SkillCandidates" ("jobId","UserId","skillKey","level","citations","status","catalogVersion","createdAt","updatedAt")
      VALUES ($1,$2,'comunicacion',NULL,'["interests"]','REVIEW_REQUIRED',1,now(),now())`, [jobId, a.userId]); // candidata aún sin confirmar (invisible para la purga)
    const purge = processDeletion(receipt.id, { quiescent: true });
    assert.equal(await blocked(purge), true, 'la purga espera a la publicación en curso');
    await holder.query('COMMIT');
    assert.equal((await purge).status, 'awaiting_verification');
    assert.deepEqual([await jobs(a.userId), await cands(a.userId)], [[], []]);
  });

  await t.test('registro cerrado: toda tabla con UserId está en el registro de exportación y borrado (ES-23) o en la lista de excepciones revisadas', async () => {
    const tables = (await q(`SELECT table_name FROM information_schema.columns WHERE table_schema='public' AND column_name IN ('UserId','userId') GROUP BY 1 ORDER BY 1`)).map((r) => r.table_name);
    const registered = new Set(CORE.map(([, name]) => require('../../' + name).getTableName()));
    // Fuera del registro por decisión revisada: ledger de borrado y exportación y sesiones (se tratan aparte), y los datos clínicos/de terapeutas,
    // que bloquean la exportación y la purga mediante requiresReview (ES-23) hasta que Mauricio defina su retención.
    // ES-95: ProfessionalApplications son solicitudes PÚBLICAS de profesionales (no datos de una cuenta de la plataforma): su userId es opcional
    // (ON DELETE SET NULL) y su retención la regula scripts/purgeProfessionalApplications.js. Decisión a confirmar por Mauricio si se quiere exportar
    // o borrar también esas solicitudes con la cuenta.
    const exceptions = new Set(['DeletionRequests', 'ExportRequests', 'AuthRevocations', 'RevokedTokens', 'ClinicalNotes', 'MatchingRequests', 'TherapistProfiles', 'ProfessionalApplications']);
    const missing = tables.filter((n) => !registered.has(n) && !exceptions.has(n));
    assert.ok(registered.has('AiJobs') && registered.has('SkillCandidates'), 'los dos modelos nuevos están registrados');
    const order = CORE.map(([, name]) => name);
    assert.ok(order.indexOf('SkillCandidate') < order.indexOf('AiJob'), 'las candidatas se borran antes que los jobs (clave foránea)');
    assert.deepEqual(missing, [], `tablas con UserId sin decisión de exportación/borrado: ${missing.join(', ')}`);
  });
});
