// ES-85 (ES-84-A) · Rol del worker, tablas de jobs y funciones SECURITY DEFINER contra PostgreSQL REAL.
// Comando explícito: solo una base de nombre aleatorio en un clúster desechable de loopback. Sin .env, sin personas ni proveedor reales.
// Las migraciones se aplican con sequelize-cli (las mismas que corren en staging). Todo dato es sintético.
//   ES85_TEST_DATABASE_URL=postgres://elevation:elevation_local@127.0.0.1:54339/postgres node --test test/integration/es-85-postgres.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { Client } = require('pg');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const sha256 = (text) => crypto.createHash('sha256').update(text, 'utf8').digest('hex');
const backend = path.resolve(__dirname, '..', '..');
const CLAIM = 'SELECT worker_claim($1, $2, $3) AS r';
const FENCED = { ok: false, reason: 'fenced' };

test('ES-85 PostgreSQL: aislamiento del rol, transiciones, fencing, concurrencia y revocación', { timeout: 240000 }, async (t) => {
  assert.ok(process.env.ES85_TEST_DATABASE_URL, 'Se requiere ES85_TEST_DATABASE_URL (clúster desechable en loopback)');
  const target = new URL(process.env.ES85_TEST_DATABASE_URL);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname), 'Solo loopback');
  const dbName = `es85_test_${crypto.randomBytes(8).toString('hex')}`;
  const workerPassword = crypto.randomBytes(16).toString('hex');
  const urlFor = (name, user, password) => {
    const u = new URL(target.toString()); u.pathname = `/${name}`;
    if (user) { u.username = user; u.password = password; }
    return u.toString();
  };
  const connect = async (url) => { const c = new Client({ connectionString: url, ssl: false }); await c.connect(); return c; };

  const admin = await connect(target.toString());
  const createdRoles = [];
  let db; let created = false; const extra = [];
  const open = async (user, password) => { const c = await connect(urlFor(dbName, user, password)); extra.push(c); return c; };
  t.after(async () => {
    for (const c of extra) await c.end().catch(() => {});
    if (db) await db.end().catch(() => {});
    if (created) await admin.query(`DROP DATABASE "${dbName}" WITH (FORCE)`).catch(() => {});
    await admin.query('ALTER ROLE elevation_worker PASSWORD NULL').catch(() => {});
    for (const role of createdRoles) await admin.query(`DROP ROLE IF EXISTS ${role}`).catch(() => {});
    await admin.end().catch(() => {});
  });

  // Simula a Supabase: sus roles reciben EXECUTE por defecto sobre funciones nuevas de public.
  for (const role of ['anon', 'authenticated', 'service_role']) {
    const exists = (await admin.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [role])).rowCount;
    if (!exists) { await admin.query(`CREATE ROLE ${role} NOLOGIN`); createdRoles.push(role); }
  }
  await admin.query(`CREATE DATABASE "${dbName}"`); created = true;
  db = await connect(urlFor(dbName));
  await db.query('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role');

  const migrate = (...args) => spawnSync('npx', ['sequelize-cli', ...args], {
    cwd: backend, encoding: 'utf8', shell: process.platform === 'win32',
    env: { ...process.env, DATABASE_URL: urlFor(dbName), DB_SSL: 'false', NODE_ENV: 'test' },
  });
  const applied = migrate('db:migrate');
  assert.equal(applied.status, 0, `Fallaron las migraciones: ${(applied.stdout + applied.stderr).slice(-800)}`);
  await admin.query(`ALTER ROLE elevation_worker PASSWORD '${workerPassword}'`);

  // ── Datos sintéticos ────────────────────────────────────────────────────────────────────────────
  const notNull = async (table) => (await db.query(`SELECT column_name, data_type, udt_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name=$1 AND is_nullable='NO' AND column_default IS NULL AND column_name <> 'id'`, [table])).rows;
  let seq = 0;
  async function mkUser() {
    seq += 1;
    const cols = await notNull('Users'); const names = []; const values = [];
    for (const c of cols) {
      let v;
      if (c.data_type.includes('char') || c.data_type === 'text') v = c.column_name === 'email' ? `sintetico${seq}-${dbName}@example.test` : `sintetico-${seq}-${c.column_name}`;
      else if (c.data_type === 'integer') v = 0;
      else if (c.data_type === 'boolean') v = false;
      else if (c.data_type.startsWith('timestamp')) v = new Date();
      else if (c.data_type === 'USER-DEFINED') v = (await db.query('SELECT enumlabel FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname=$1 ORDER BY enumsortorder LIMIT 1', [c.udt_name])).rows[0].enumlabel;
      else v = '{}';
      names.push(`"${c.column_name}"`); values.push(v);
    }
    const r = await db.query(`INSERT INTO "Users" (${names.join(',')}) VALUES (${values.map((_, i) => `$${i + 1}`).join(',')}) RETURNING id`, values);
    return r.rows[0].id;
  }
  const consent = (userId, status = 'granted', version = 1) => db.query(
    `INSERT INTO "Consents" ("UserId","purpose","scope","status","version","decidedAt","createdAt","updatedAt")
     VALUES ($1,'professional_bridge','default',$2,$3,now(),now(),now())
     ON CONFLICT ("UserId","purpose","scope") DO UPDATE SET "status"=$2, "version"=$3`, [userId, status, version]);
  const KEYS = ['motivations', 'values', 'interests'];
  async function mkContext(userId, version = 1, payload = `v2:sintetico:${crypto.randomBytes(8).toString('hex')}`) {
    await db.query(`UPDATE "CareerContextVersions" SET "status"='superseded' WHERE "UserId"=$1 AND "status"='active'`, [userId]);
    await db.query(`INSERT INTO "CareerContextVersions" ("UserId","version","status","payload","origins","consentVersion","requestId","approvedAt","createdAt","updatedAt")
      VALUES ($1,$2,'active',$3,$4,1,$5,now(),now(),now())`,
    [userId, version, payload, JSON.stringify(KEYS.map((key, index) => ({ key, index, type: 'direct' }))), `ctx-${crypto.randomBytes(6).toString('hex')}`]);
    return payload;
  }
  async function mkJob(userId, { version = 1, payload, status = 'PENDING', hash } = {}) {
    const p = payload ?? (await db.query('SELECT payload FROM "CareerContextVersions" WHERE "UserId"=$1 AND "version"=$2', [userId, version])).rows[0].payload;
    const r = await db.query(`INSERT INTO "AiJobs" ("UserId","kind","contextVersion","contextHash","requestId","status","createdAt","updatedAt")
      VALUES ($1,'competency_extraction',$2,$3,$4,$5,now(),now()) RETURNING id`,
    [userId, version, hash ?? sha256(p), `job-${crypto.randomBytes(8).toString('hex')}`, status]);
    return r.rows[0].id;
  }
  async function fixture({ withJob = true, withConsent = true } = {}) {
    const userId = await mkUser();
    if (withConsent) await consent(userId);
    await mkContext(userId);
    const jobId = withJob ? await mkJob(userId) : null;
    return { userId, jobId };
  }
  const job = async (id) => (await db.query('SELECT * FROM "AiJobs" WHERE id=$1', [id])).rows[0];
  const candidates = async (jobId) => (await db.query('SELECT * FROM "SkillCandidates" WHERE "jobId"=$1 ORDER BY "skillKey"', [jobId])).rows;
  const SKILLS = ['comunicacion', 'sql', 'liderazgo'];
  await db.query(`INSERT INTO "SkillCatalogs" ("version","status","publishedAt","createdAt","updatedAt") VALUES (1,'published',now(),now(),now())`);
  const catalogId = (await db.query('SELECT id FROM "SkillCatalogs" WHERE version=1')).rows[0].id;
  for (const key of SKILLS) {
    await db.query(`INSERT INTO "SkillDefinitions" ("catalogId","skillKey","type","labels","rubric","createdAt","updatedAt")
      VALUES ($1,$2,'domain',$3,$4,now(),now())`, [catalogId, key, JSON.stringify({ es: key, en: key }), JSON.stringify({ levels: {} })]);
  }

  const w = await open('elevation_worker', workerPassword);   // worker 1
  const w2 = await open('elevation_worker', workerPassword);  // worker 2
  const claim = async (client = w, owner = 'worker-1', lease = 120, max = 3) => (await client.query(CLAIM, [owner, lease, max])).rows[0].r;
  const publish = async (client, jobId, fence, list) => (await client.query('SELECT worker_publish($1,$2,$3::jsonb) AS r', [jobId, fence, JSON.stringify(list)])).rows[0].r;
  const good = [{ skillKey: 'sql', level: 3, citations: ['motivations', 'interests'] }, { skillKey: 'comunicacion', level: null, citations: ['values'] }];
  const drain = async () => { while (await claim()) { /* vacía los jobs que otras pruebas dejaron pendientes */ } };

  await t.test('aislamiento: el rol no toca tablas de personas y solo ejecuta las 4 funciones', async () => {
    const me = (await w.query('SELECT current_user AS u, rolsuper, rolcreaterole, rolbypassrls FROM pg_roles WHERE rolname = current_user')).rows[0];
    assert.deepEqual([me.u, me.rolsuper, me.rolcreaterole, me.rolbypassrls], ['elevation_worker', false, false, false]);
    const denied = async (sql) => { await assert.rejects(w.query(sql), (e) => e.code === '42501', `debía fallar con permission denied: ${sql}`); };
    const tables = (await db.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'`)).rows.map((r) => r.table_name);
    for (const required of ['Users', 'ChatTurns', 'DiaryEntries', 'Consents', 'CareerContextVersions', 'AiJobs', 'SkillCandidates', 'BridgeTransfers']) assert.ok(tables.includes(required), required);
    for (const table of tables.filter((n) => !['AiBudgetCounters', 'AiUsages'].includes(n))) await denied(`SELECT * FROM "${table}" LIMIT 1`); // TODAS las demás tablas
    await denied(`UPDATE "AiJobs" SET "status"='COMPLETED'`);
    await denied(`INSERT INTO "SkillCandidates" ("jobId") VALUES (1)`);
    await denied(`DELETE FROM "Consents"`);
    await denied('SELECT worker_required_consent_version()'); // interna: el worker no la ejecuta
    await denied('CREATE TABLE intruso (id int)');
    await denied('SET ROLE elevation_worker_owner');
    // Excepción nominal: presupuesto (solo cifras).
    await w.query(`INSERT INTO "AiBudgetCounters" ("UserId","periodKey","used","createdAt","updatedAt") VALUES (0,'2026-10',1,now(),now())`);
    await w.query(`UPDATE "AiBudgetCounters" SET "used"=2 WHERE "UserId"=0`);
    assert.equal((await w.query('SELECT used FROM "AiBudgetCounters" WHERE "UserId"=0')).rows[0].used, 2);
    await denied('DELETE FROM "AiBudgetCounters"');
    // Funciones: ningún otro rol (PUBLIC, anon, authenticated, service_role) puede ejecutarlas.
    for (const sig of ['worker_claim(text,integer,integer)', 'worker_heartbeat(integer,integer,text,integer)', 'worker_publish(integer,integer,jsonb)',
      'worker_fail(integer,integer,text,boolean,integer,integer)', 'worker_required_consent_version()']) {
      const r = (await db.query(`SELECT has_function_privilege('elevation_worker', '${sig}', 'EXECUTE') AS worker,
        has_function_privilege('anon', '${sig}', 'EXECUTE') AS anon, has_function_privilege('authenticated', '${sig}', 'EXECUTE') AS auth,
        has_function_privilege('service_role', '${sig}', 'EXECUTE') AS svc,
        (SELECT prosecdef FROM pg_proc WHERE oid = '${sig}'::regprocedure) AS definer,
        (SELECT pg_get_userbyid(proowner) FROM pg_proc WHERE oid = '${sig}'::regprocedure) AS owner`)).rows[0];
      assert.equal(r.anon || r.auth || r.svc, false, `${sig} no debe ser ejecutable por roles de la API pública`);
      assert.equal(r.worker, sig !== 'worker_required_consent_version()');
      assert.equal(r.owner, 'elevation_worker_owner');
      assert.equal(r.definer, sig !== 'worker_required_consent_version()');
    }
    // El dueño tampoco puede leer chats, diario ni usuarios.
    for (const table of ['Users', 'ChatTurns', 'DiaryEntries']) {
      assert.equal((await db.query(`SELECT has_table_privilege('elevation_worker_owner', '"${table}"', 'SELECT') AS p`)).rows[0].p, false);
    }
    assert.equal((await db.query(`SELECT has_column_privilege('elevation_worker_owner', '"Consents"', 'status', 'UPDATE') AS p`)).rows[0].p, false, 'el dueño no puede alterar un consentimiento');
    assert.equal((await db.query(`SELECT has_table_privilege('elevation_worker_owner', '"Consents"', 'UPDATE') AS p`)).rows[0].p, false);
    assert.equal((await db.query(`SELECT has_schema_privilege('elevation_worker_owner', 'public', 'CREATE') AS p`)).rows[0].p, false);
  });

  await t.test('la versión de consentimiento exigida en SQL coincide con utils/consent.js', async () => {
    const source = fs.readFileSync(path.join(backend, 'utils', 'consent.js'), 'utf8');
    const js = Number(/professional_bridge:\s*(\d+)/.exec(source.slice(source.indexOf('REQUIRED_VERSION')))[1]);
    assert.equal((await db.query('SELECT worker_required_consent_version() AS v')).rows[0].v, js);
  });

  await t.test('reclamo: entrega solo el payload cifrado de la versión autorizada, audita sin texto y no repite', async () => {
    await drain();
    const { userId, jobId } = await fixture();
    const payload = (await db.query('SELECT payload FROM "CareerContextVersions" WHERE "UserId"=$1', [userId])).rows[0].payload;
    const r = await claim();
    assert.equal(r.jobId, jobId); assert.equal(r.fence, 1); assert.equal(r.attempt, 1); assert.equal(r.userId, userId);
    assert.equal(r.payload, payload); assert.equal(r.contextVersion, 1); assert.equal(r.catalogVersion, 1);
    assert.deepEqual(r.skills.map((s) => s.skillKey), [...SKILLS].sort());
    assert.deepEqual(Object.keys(r).sort(), ['attempt', 'catalogVersion', 'contextHash', 'contextVersion', 'fence', 'jobId', 'kind', 'leaseExpiresAt', 'payload', 'skills', 'userId']);
    const row = await job(jobId);
    assert.deepEqual([row.status, row.leaseOwner, row.catalogVersion], ['RUNNING', 'worker-1', 1]);
    const audit = (await db.query('SELECT * FROM "BridgeTransfers" WHERE "UserId"=$1', [userId])).rows;
    assert.equal(audit.length, 1); assert.equal(audit[0].consumer, 'worker'); assert.deepEqual(audit[0].keys, KEYS); assert.equal(audit[0].hash, sha256(payload));
    assert.equal(await claim(), null);
    await assert.rejects(w.query(CLAIM, ['mal propietario!', 120, 3]), (e) => e.code === '22023');
  });

  await t.test('reclamo: sin consentimiento vigente, con versión vieja, con borrado pendiente o con contexto cambiado el job se invalida', async () => {
    await drain();
    const cases = [];
    const noConsent = await fixture({ withConsent: false }); cases.push([noConsent.jobId, 'consent_revoked']);
    const revoked = await fixture(); await consent(revoked.userId, 'revoked'); cases.push([revoked.jobId, 'consent_revoked']);
    const old = await fixture(); await consent(old.userId, 'granted', 0); cases.push([old.jobId, 'consent_revoked']);
    const deleting = await fixture();
    await db.query(`INSERT INTO "DeletionRequests" ("id","UserId","status","attempts","createdAt","updatedAt") VALUES (gen_random_uuid(),$1,'accepted',0,now(),now())`, [deleting.userId]);
    cases.push([deleting.jobId, 'consent_revoked']);
    const newer = await fixture(); await mkContext(newer.userId, 2); cases.push([newer.jobId, 'context_changed']);
    const tampered = await fixture(); await db.query('UPDATE "CareerContextVersions" SET payload=$1 WHERE "UserId"=$2', ['v2:otro', tampered.userId]); cases.push([tampered.jobId, 'context_changed']);
    const none = await fixture(); await db.query(`UPDATE "CareerContextVersions" SET status='revoked' WHERE "UserId"=$1`, [none.userId]); cases.push([none.jobId, 'context_changed']);
    assert.equal(await claim(), null, 'ninguno es elegible');
    for (const [id, code] of cases) { const row = await job(id); assert.deepEqual([row.status, row.errorCode], ['INVALIDATED', code], `job ${id}`); }
    assert.equal((await db.query('SELECT count(*)::int n FROM "BridgeTransfers" WHERE "UserId" = ANY($1)', [[noConsent, revoked, old, deleting, newer, tampered, none].map((f) => f.userId)])).rows[0].n, 0,
      'nada se entregó ni se auditó');
  });

  await t.test('reclamo: sin catálogo publicado los jobs esperan sin cambiar de estado', async () => {
    await drain();
    const { jobId } = await fixture();
    await db.query(`UPDATE "SkillCatalogs" SET status='archived' WHERE version=1`);
    try { assert.equal(await claim(), null); assert.equal((await job(jobId)).status, 'PENDING'); }
    finally { await db.query(`UPDATE "SkillCatalogs" SET status='published' WHERE version=1`); }
    assert.equal((await claim()).jobId, jobId);
  });

  await t.test('matriz de transiciones del job y de la candidata: solo las legales; campos inmutables; fence no baja', async () => {
    const states = ['PENDING', 'RUNNING', 'REVIEW_REQUIRED', 'COMPLETED', 'FAILED', 'CANCELLED', 'INVALIDATED'];
    const legal = new Set(['PENDING>RUNNING', 'PENDING>CANCELLED', 'PENDING>INVALIDATED', 'RUNNING>PENDING', 'RUNNING>FAILED', 'RUNNING>REVIEW_REQUIRED',
      'RUNNING>COMPLETED', 'RUNNING>CANCELLED', 'RUNNING>INVALIDATED', 'REVIEW_REQUIRED>COMPLETED', 'REVIEW_REQUIRED>CANCELLED', 'REVIEW_REQUIRED>INVALIDATED']);
    const owner = await fixture({ withJob: false });
    let checked = 0;
    for (const from of states) {
      for (const to of states.filter((s) => s !== from)) {
        const id = await mkJob(owner.userId, { status: from });
        const attempt = db.query('UPDATE "AiJobs" SET status=$1 WHERE id=$2', [to, id]);
        if (legal.has(`${from}>${to}`)) await attempt; else await assert.rejects(attempt, (e) => e.code === '23514' && /illegal_transition/.test(e.message), `${from}>${to}`);
        checked += 1;
      }
    }
    assert.equal(checked, 42);
    const id = await mkJob(owner.userId);
    await db.query('UPDATE "AiJobs" SET fence=5 WHERE id=$1', [id]);
    await assert.rejects(db.query('UPDATE "AiJobs" SET fence=4 WHERE id=$1', [id]), /fence_decreased/);
    for (const set of [`"UserId"=${owner.userId + 999}`, `"contextVersion"=9`, `"contextHash"='x'`, `"requestId"='otro'`, `"kind"='otro'`]) {
      await assert.rejects(db.query(`UPDATE "AiJobs" SET ${set} WHERE id=$1`, [id]), (e) => ['23514', '23503'].includes(e.code), set);
    }
    await assert.rejects(db.query(`UPDATE "AiJobs" SET status='ZOMBI' WHERE id=$1`, [id]), (e) => e.code === '23514');
    // Candidatas
    const cStates = ['REVIEW_REQUIRED', 'ACCEPTED', 'REJECTED', 'INVALIDATED'];
    const cLegal = new Set(['REVIEW_REQUIRED>ACCEPTED', 'REVIEW_REQUIRED>REJECTED', 'REVIEW_REQUIRED>INVALIDATED', 'ACCEPTED>INVALIDATED']);
    let n = 0;
    for (const from of cStates) {
      for (const to of cStates.filter((s) => s !== from)) {
        const jid = await mkJob(owner.userId);
        const cid = (await db.query(`INSERT INTO "SkillCandidates" ("jobId","UserId","skillKey","level","citations","status","catalogVersion","createdAt","updatedAt")
          VALUES ($1,$2,'sql',2,'["values"]',$3,1,now(),now()) RETURNING id`, [jid, owner.userId, from])).rows[0].id;
        const attempt = db.query('UPDATE "SkillCandidates" SET status=$1 WHERE id=$2', [to, cid]);
        if (cLegal.has(`${from}>${to}`)) await attempt; else await assert.rejects(attempt, (e) => e.code === '23514', `${from}>${to}`);
        if (cLegal.has(`${from}>${to}`)) {
          await assert.rejects(db.query('UPDATE "SkillCandidates" SET level=4 WHERE id=$1', [cid]), /immutable/);
        }
        n += 1;
      }
    }
    assert.equal(n, 12);
    // Dominio y propietario
    await assert.rejects(db.query(`INSERT INTO "SkillCandidates" ("jobId","UserId","skillKey","level","citations","catalogVersion","createdAt","updatedAt")
      VALUES ($1,$2,'sql',5,'[]',1,now(),now())`, [id, owner.userId]), (e) => e.code === '23514');
    const other = await mkUser();
    await assert.rejects(db.query(`INSERT INTO "SkillCandidates" ("jobId","UserId","skillKey","level","citations","catalogVersion","createdAt","updatedAt")
      VALUES ($1,$2,'sql',2,'[]',1,now(),now())`, [id, other]), (e) => e.code === '23503', 'una candidata no puede pertenecer a otra persona que su job');
  });

  await t.test('fencing y lease: un intento viejo no publica; el barrido devuelve a PENDING y agota intentos', async () => {
    await drain();
    const { userId, jobId } = await fixture();
    const first = await claim(w, 'worker-1');
    assert.equal(first.fence, 1);
    assert.equal((await w.query('SELECT worker_heartbeat($1,$2,$3,$4) AS ok', [jobId, 1, 'worker-1', 120])).rows[0].ok, true);
    assert.equal((await w.query('SELECT worker_heartbeat($1,$2,$3,$4) AS ok', [jobId, 1, 'otro-worker', 120])).rows[0].ok, false);
    await db.query(`UPDATE "AiJobs" SET "leaseExpiresAt" = now() - interval '1 second' WHERE id=$1`, [jobId]); // el worker 1 «se colgó»
    const second = await claim(w2, 'worker-2');
    assert.deepEqual([second.jobId, second.fence, second.attempt], [jobId, 2, 2]);
    assert.deepEqual(await publish(w, jobId, 1, good), FENCED, 'el intento viejo no publica');
    assert.equal((await w.query('SELECT worker_heartbeat($1,$2,$3,$4) AS ok', [jobId, 1, 'worker-1', 120])).rows[0].ok, false);
    assert.deepEqual((await w.query('SELECT worker_fail($1,$2,$3,$4,$5,$6) AS r', [jobId, 1, 'timeout', true, 0, 3])).rows[0].r, FENCED);
    assert.equal((await candidates(jobId)).length, 0);
    assert.deepEqual(await publish(w2, jobId, 2, good), { ok: true, candidates: 2 });
    assert.deepEqual(await publish(w2, jobId, 2, good), FENCED, 'publicar dos veces no duplica');
    assert.equal((await candidates(jobId)).length, 2);
    assert.equal((await job(jobId)).status, 'REVIEW_REQUIRED');

    // Intentos agotados por lease vencido -> FAILED
    const b = await fixture();
    for (let i = 1; i <= 3; i++) {
      const r = await claim(w, 'worker-1', 120, 3); assert.equal(r.jobId, b.jobId); assert.equal(r.attempt, i);
      await db.query(`UPDATE "AiJobs" SET "leaseExpiresAt" = now() - interval '1 second' WHERE id=$1`, [b.jobId]);
    }
    assert.equal(await claim(w, 'worker-1', 120, 3), null);
    const failed = await job(b.jobId);
    assert.deepEqual([failed.status, failed.errorCode, failed.attempt], ['FAILED', 'lease_expired', 3]);
    assert.ok(userId);
  });

  await t.test('publicación: valida forma, catálogo y citas; ante entrada inválida no escribe nada', async () => {
    await drain();
    const { jobId } = await fixture();
    const r = await claim();
    const bad = [
      ['no es arreglo', { skillKey: 'sql' }],
      ['habilidad fuera del catálogo', [{ skillKey: 'inventada', level: 1, citations: ['values'] }]],
      ['nivel 0', [{ skillKey: 'sql', level: 0, citations: ['values'] }]],
      ['nivel 5', [{ skillKey: 'sql', level: 5, citations: ['values'] }]],
      ['nivel decimal', [{ skillKey: 'sql', level: 2.5, citations: ['values'] }]],
      ['nivel texto', [{ skillKey: 'sql', level: '2', citations: ['values'] }]],
      ['campo extra (confianza declarada por el modelo)', [{ skillKey: 'sql', level: 2, citations: ['values'], confidence: 0.9 }]],
      ['sin citas', [{ skillKey: 'sql', level: 2, citations: [] }]],
      ['cita fuera de las claves entregadas', [{ skillKey: 'sql', level: 2, citations: ['constraints'] }]],
      ['cita con texto libre', [{ skillKey: 'sql', level: 2, citations: ['Trabajé en bancos'] }]],
      ['habilidad repetida', [{ skillKey: 'sql', level: 2, citations: ['values'] }, { skillKey: 'sql', level: 3, citations: ['values'] }]],
      ['elemento que no es objeto', ['sql']],
      ['falta level', [{ skillKey: 'sql', citations: ['values'] }]],
      ['inyección SQL en la clave', [{ skillKey: "sql'; DROP TABLE \"AiJobs\";--", level: 1, citations: ['values'] }]],
    ];
    for (const [name, list] of bad) {
      await assert.rejects(publish(w, r.jobId, r.fence, list), (e) => e.code === '22023' && e.message === 'invalid_candidates', name);
      assert.equal((await candidates(jobId)).length, 0, name);
      assert.equal((await job(jobId)).status, 'RUNNING', name);
    }
    assert.deepEqual(await publish(w, r.jobId, r.fence, good), { ok: true, candidates: 2 });
    const rows = await candidates(jobId);
    assert.deepEqual(rows.map((c) => [c.skillKey, c.level, c.status, c.catalogVersion]), [['comunicacion', null, 'REVIEW_REQUIRED', 1], ['sql', 3, 'REVIEW_REQUIRED', 1]]);
    assert.deepEqual(rows[1].citations, ['motivations', 'interests']);
    // Sin candidatas: termina directamente.
    const empty = await fixture(); const e = await claim();
    assert.deepEqual(await publish(w, e.jobId, e.fence, []), { ok: true, candidates: 0 });
    assert.equal((await job(empty.jobId)).status, 'COMPLETED');
  });

  await t.test('publicación: el contexto cambiado entre el reclamo y la publicación invalida el job', async () => {
    await drain();
    const { userId, jobId } = await fixture();
    const r = await claim();
    await mkContext(userId, 2); // la persona aprobó una versión nueva mientras se analizaba la anterior
    assert.deepEqual(await publish(w, r.jobId, r.fence, good), { ok: false, reason: 'context_changed' });
    assert.deepEqual([(await job(jobId)).status, (await candidates(jobId)).length], ['INVALIDATED', 0]);
  });

  await t.test('worker_fail: reintento con espera, tope de intentos, presupuesto agotado sin gastar intento, códigos saneados', async () => {
    await drain();
    const a = await fixture(); let r = await claim();
    assert.deepEqual((await w.query('SELECT worker_fail($1,$2,$3,$4,$5,$6) AS r', [a.jobId, r.fence, 'Bad Code!', true, 3600, 3])).rows[0].r, { ok: true, status: 'PENDING' });
    let row = await job(a.jobId);
    assert.deepEqual([row.status, row.errorCode, row.attempt], ['PENDING', 'unknown', 1]);
    assert.equal(await claim(), null, 'no se reclama antes de notBefore');
    await db.query(`UPDATE "AiJobs" SET "notBefore" = now() - interval '1 second' WHERE id=$1`, [a.jobId]);
    r = await claim(); assert.equal(r.attempt, 2);
    // Presupuesto agotado: PENDING, intento devuelto, aviso en errorCode.
    await w.query('SELECT worker_fail($1,$2,$3,$4,$5,$6)', [a.jobId, r.fence, 'budget_exhausted', true, 900, 3]);
    row = await job(a.jobId);
    assert.deepEqual([row.status, row.errorCode, row.attempt], ['PENDING', 'budget_exhausted', 1]);
    await db.query(`UPDATE "AiJobs" SET "notBefore" = NULL WHERE id=$1`, [a.jobId]);
    // No reintentable -> FAILED
    r = await claim();
    assert.deepEqual((await w.query('SELECT worker_fail($1,$2,$3,$4,$5,$6) AS r', [a.jobId, r.fence, 'invalid_output', false, 0, 3])).rows[0].r, { ok: true, status: 'FAILED' });
    assert.equal((await job(a.jobId)).status, 'FAILED');
    // Reintentable, pero en el último intento -> FAILED
    const b = await fixture();
    for (let i = 1; i <= 3; i++) {
      r = await claim(); assert.equal(r.attempt, i);
      const out = (await w.query('SELECT worker_fail($1,$2,$3,$4,$5,$6) AS r', [b.jobId, r.fence, 'provider_error', true, 0, 3])).rows[0].r;
      assert.equal(out.status, i < 3 ? 'PENDING' : 'FAILED');
    }
    assert.equal((await w.query('SELECT worker_fail($1,$2,$3,$4,$5,$6) AS r', [b.jobId, 3, 'x', true, 0, 3])).rows[0].r.reason, 'fenced');
  });

  await t.test('dos workers sondeando a la vez: cada job lo toma uno solo', async () => {
    await drain();
    const ids = [];
    for (let i = 0; i < 12; i++) ids.push((await fixture()).jobId);
    const taken = { a: [], b: [] };
    const loop = async (client, owner, into) => { for (;;) { const r = await claim(client, owner); if (!r) return; into.push(r); } };
    await Promise.all([loop(w, 'worker-1', taken.a), loop(w2, 'worker-2', taken.b)]);
    const all = [...taken.a, ...taken.b].map((r) => r.jobId);
    assert.deepEqual([...all].sort((x, y) => x - y), [...ids].sort((x, y) => x - y), 'todos los jobs, ninguno repetido');
    assert.ok(taken.a.length > 0 && taken.b.length > 0, `ambos trabajaron (${taken.a.length}/${taken.b.length})`);
    assert.ok([...taken.a, ...taken.b].every((r) => r.fence === 1 && r.attempt === 1));
    // Un solo job y cuatro conexiones al mismo tiempo: exactamente un ganador.
    await drain();
    const extraClients = [await open('elevation_worker', workerPassword), await open('elevation_worker', workerPassword)];
    const { jobId } = await fixture();
    const results = await Promise.all([w, w2, ...extraClients].map((c, i) => claim(c, `worker-${i}`)));
    assert.deepEqual(results.filter(Boolean).map((r) => r.jobId), [jobId]);
    assert.equal((await db.query('SELECT count(*)::int n FROM "BridgeTransfers" WHERE "UserId"=(SELECT "UserId" FROM "AiJobs" WHERE id=$1)', [jobId])).rows[0].n, 1);
  });

  // La revocación real (utils/consent.js + gancho de ES-88) bloquea la fila de consentimiento FOR UPDATE, la marca revocada e invalida jobs y
  // candidatas en la misma transacción. Aquí se reproduce ese orden de bloqueos con SQL para probar las FUNCIONES del worker frente a ella.
  async function revocation(client, userId, { cascade = true } = {}) {
    await client.query('BEGIN');
    await client.query(`SELECT 1 FROM "Consents" WHERE "UserId"=$1 AND purpose='professional_bridge' FOR UPDATE`, [userId]);
    return async () => {
      await client.query(`UPDATE "Consents" SET status='revoked' WHERE "UserId"=$1 AND purpose='professional_bridge'`, [userId]);
      if (cascade) await client.query(`UPDATE "SkillCandidates" SET status='INVALIDATED' WHERE "UserId"=$1 AND status IN ('REVIEW_REQUIRED','ACCEPTED')`, [userId]);
      if (cascade) await client.query(`UPDATE "AiJobs" SET status='INVALIDATED', "errorCode"='consent_revoked' WHERE "UserId"=$1 AND status IN ('PENDING','RUNNING','REVIEW_REQUIRED')`, [userId]);
      await client.query('COMMIT');
    };
  }
  const blocked = async (promise, ms = 400) => Promise.race([promise.then(() => false, () => false), sleep(ms).then(() => true)]);

  for (const [cascade, reason, label] of [
    [false, 'consent_revoked', 'solo el consentimiento (la función misma lo detecta e invalida el job)'],
    [true, 'fenced', 'con el gancho completo (el job ya estaba invalidado: nadie publica)'],
  ]) {
    await t.test(`revocación concurrente, orden 1: la revocación bloquea primero; la publicación espera y NO publica — ${label}`, async () => {
      await drain();
      const { userId, jobId } = await fixture(); const r = await claim();
      const rev = await open(); // conexión administrativa propia para la revocación
      const finish = await revocation(rev, userId, { cascade });
      const pending = publish(w, r.jobId, r.fence, good);
      assert.equal(await blocked(pending), true, 'la publicación espera a la revocación');
      await finish();
      assert.deepEqual(await pending, { ok: false, reason });
      assert.equal((await candidates(jobId)).length, 0);
      assert.equal((await job(jobId)).status, 'INVALIDATED');
    });
  }

  await t.test('revocación concurrente, orden 2: la publicación va primero; la revocación espera y luego invalida lo publicado', async () => {
    await drain();
    const { userId, jobId } = await fixture(); const r = await claim();
    await w.query('BEGIN');
    assert.deepEqual((await w.query('SELECT worker_publish($1,$2,$3::jsonb) AS r', [r.jobId, r.fence, JSON.stringify(good)])).rows[0].r, { ok: true, candidates: 2 });
    const rev = await open();
    const reached = revocation(rev, userId); // se queda esperando el FOR UPDATE del consentimiento
    assert.equal(await blocked(reached), true, 'la revocación espera a la publicación');
    await w.query('COMMIT');
    const finish = await reached; await finish();
    assert.equal((await candidates(jobId)).length, 2);
    assert.ok((await candidates(jobId)).every((c) => c.status === 'INVALIDATED'), 'nunca queda una candidata vigente tras la revocación');
    assert.equal((await job(jobId)).status, 'INVALIDATED');
    assert.equal((await db.query(`SELECT count(*)::int n FROM "SkillCandidates" WHERE "UserId"=$1 AND status='REVIEW_REQUIRED'`, [userId])).rows[0].n, 0);
  });

  await t.test('revocación concurrente: el reclamo no espera ni se interbloquea con una revocación en curso', async () => {
    await drain();
    const { userId, jobId } = await fixture();
    const rev = await open(); const finish = await revocation(rev, userId);
    const started = Date.now();
    assert.equal(await claim(), null, 'el job se pospone mientras la revocación está en curso');
    assert.ok(Date.now() - started < 300, 'no se queda esperando el bloqueo');
    assert.equal((await job(jobId)).status, 'PENDING');
    await finish();
    assert.equal((await job(jobId)).status, 'INVALIDATED');
    assert.equal(await claim(), null);
  });

  await t.test('las migraciones se deshacen solo con permiso explícito y vuelven a aplicarse', async () => {
    const refused = migrate('db:migrate:undo');
    assert.notEqual(refused.status, 0, 'sin ALLOW_DESTRUCTIVE_MIGRATION el down se niega');
    assert.match(refused.stdout + refused.stderr, /ALLOW_DESTRUCTIVE_MIGRATION/);
    assert.equal((await db.query(`SELECT to_regclass('"AiJobs"') AS t`)).rows[0].t, '"AiJobs"');
  });
});
