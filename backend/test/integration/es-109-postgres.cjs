// ES-109 · Hoja de vida (PDF): análisis, histórico cifrado, consentimiento y derechos de datos con HTTP REAL, JWT real y PostgreSQL REAL.
// Migraciones reales (sequelize-cli); PDFs sintéticos reales; solo el proveedor de IA es un doble. Datos sintéticos, nunca reales.
//   ES109_TEST_DATABASE_URL=postgres://elevation:elevation_local@127.0.0.1:54329/postgres npm run test:resume:pg
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { once } = require('node:events');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { Client } = require('pg');
const { Sequelize } = require('sequelize');
const { makeTextPdf } = require('../support/pdfFixtures.cjs');

const backend = path.resolve(__dirname, '..', '..');
const CV = ['MARÍA GÓMEZ', 'maria.gomez@example.test · +57 300 123 4567', 'linkedin.com/in/maria-gomez', 'Líder de diseño · Estudio Norte · 2021–2026',
  'Diseño Industrial · Universidad Nacional · 2016', 'Habilidades: Power BI, SQL, Gestión de proyectos', 'Idiomas: Español nativo'];
const OUTPUT = { profession: 'Líder de diseño', interests: null, sector: null, totalYearsExperience: null,
  experience: [{ role: 'Líder de diseño', organization: 'Estudio Norte', startYear: 2021, endYear: 2026, isCurrent: false }],
  education: [{ kind: 'education', title: 'Diseño Industrial', institution: 'Universidad Nacional', year: 2016 }],
  declaredSkills: [{ name: 'Power BI', support: null }, { name: 'SQL', support: null }], languages: [{ name: 'Español', level: 'nativo' }] };

test('ES-109 PostgreSQL + HTTP: migración, histórico cifrado, aislamiento entre personas, revocación, concurrencia y derechos de datos', { timeout: 240000 }, async (t) => {
  assert.ok(process.env.ES109_TEST_DATABASE_URL, 'Se requiere ES109_TEST_DATABASE_URL (clúster desechable en loopback)');
  const target = new URL(process.env.ES109_TEST_DATABASE_URL);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname), 'Solo loopback');
  const dbName = `es109_test_${crypto.randomBytes(8).toString('hex')}`;
  const urlFor = (name) => { const u = new URL(target.toString()); u.pathname = `/${name}`; return u.toString(); };
  const admin = new Client({ connectionString: target.toString(), ssl: false }); await admin.connect();
  let created = false; let app; let server; let db;
  t.after(async () => {
    if (server) await new Promise((r) => { server.close(r); server.closeAllConnections?.(); });
    if (db) await db.end().catch(() => {});
    if (app) await app.close().catch(() => {});
    if (created) await admin.query(`DROP DATABASE "${dbName}" WITH (FORCE)`).catch(() => {});
    await admin.end().catch(() => {});
  });
  await admin.query(`CREATE DATABASE "${dbName}"`); created = true;
  const cli = (args, extra = {}) => spawnSync('npx', ['sequelize-cli', ...args], { cwd: backend, encoding: 'utf8', shell: process.platform === 'win32',
    env: { ...process.env, DATABASE_URL: urlFor(dbName), DB_SSL: 'false', NODE_ENV: 'test', ...extra } });
  const migrated = cli(['db:migrate']);
  assert.equal(migrated.status, 0, `Fallaron las migraciones: ${(migrated.stdout + migrated.stderr).slice(-600)}`);

  app = new Sequelize(urlFor(dbName), { logging: false, dialectOptions: { ssl: false }, pool: { max: 5, min: 0, acquire: 5000 } });
  process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
  process.env.DATA_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
  process.env.NODE_ENV = 'test';
  process.env.AI_BUDGET_TOKENS_PER_USER = '1000000000'; process.env.AI_BUDGET_PERIOD = 'month'; process.env.RESUME_ANALYZE_RATE_MAX = '1000';
  const dbModule = require.resolve('../../database');
  require.cache[dbModule] = { id: dbModule, filename: dbModule, loaded: true, exports: { sequelize: app } };
  const anthropicModule = require.resolve('../../utils/anthropic');
  const provider = { calls: [] };
  require.cache[anthropicModule] = { id: anthropicModule, filename: anthropicModule, loaded: true, exports: {
    MODEL: 'modelo-sintetico', messages: { create: async (body) => { provider.calls.push(body); return { content: [{ type: 'text', text: JSON.stringify(OUTPUT) }], usage: { input_tokens: 400, output_tokens: 200 } }; } },
  } };
  require('../../associations')();
  const { issueToken } = require('../../utils/sessions');
  const { verificarToken } = require('../../middlewares/auth');
  const consent = require('../../utils/consent');
  const resumes = require('../../utils/resumes');
  const { personalData } = require('../../utils/personalData');
  const { desencriptarBuffer } = require('../../utils/crypto');
  const express = require('express');
  const api = express(); api.use(express.json());
  api.use('/api/consents', verificarToken, require('../../routes/consents'));
  api.use('/api/user/resumes', verificarToken, require('../../routes/resumes'));
  server = api.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  db = new Client({ connectionString: urlFor(dbName), ssl: false }); await db.connect();
  const q = async (text, params) => (await db.query(text, params)).rows;

  const columns = await q(`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='Users' AND is_nullable='NO' AND column_default IS NULL AND column_name <> 'id'`);
  let seq = 0;
  async function mkUser(role = 'user') {
    seq += 1; const names = []; const values = [];
    for (const c of columns) {
      let v;
      if (c.column_name === 'role') v = role; else if (c.column_name === 'name') v = `Sintético ${seq}`;
      else if (c.data_type.includes('char') || c.data_type === 'text') v = c.column_name === 'email' ? `canario-${seq}-${dbName}@example.test` : `sintetico-${seq}-${c.column_name}`;
      else if (c.data_type === 'integer') v = 0; else if (c.data_type === 'boolean') v = true; else if (c.data_type.startsWith('timestamp')) v = new Date(); else v = '{}';
      names.push(`"${c.column_name}"`); values.push(v);
    }
    const id = (await q(`INSERT INTO "Users" (${names.join(',')}) VALUES (${values.map((_, i) => `$${i + 1}`).join(',')}) RETURNING id`, values))[0].id;
    await q('UPDATE "Users" SET role=$2, active=true WHERE id=$1', [id, role]);
    return { id, role, token: issueToken({ id, role }) };
  }
  const call = async (who, method, route, body) => {
    const headers = { Authorization: `Bearer ${who.token}` }; let payload;
    if (body instanceof FormData) payload = body; else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
    const res = await fetch(base + route, { method, headers, body: payload });
    const bytes = Buffer.from(await res.arrayBuffer()); const text = bytes.toString('utf8'); let json = null; try { json = JSON.parse(text); } catch { /* PDF */ }
    return { status: res.status, body: json, bytes, headers: res.headers };
  };
  const form = (pdf) => { const f = new FormData(); f.append('requestId', crypto.randomUUID()); f.append('cv', new Blob([pdf], { type: 'application/pdf' }), 'cv.pdf'); return f; };
  const grant = (who, status = 'granted') => call(who, 'PUT', '/api/consents/resume_ai_reading', { status });
  const pdfOf = (n) => makeTextPdf([...CV, `Variante ${n} del documento sintético`]);

  const A = await mkUser(); const B = await mkUser(); const C = await mkUser();

  await t.test('sin autorización no se procesa nada; con ella se guarda cifrado como binario (PDF + 29 bytes) y se proponen campos', async () => {
    const denied = await call(A, 'POST', '/api/user/resumes/analyze', form(pdfOf(0)));
    assert.deepEqual([denied.status, denied.body.code], [403, 'consent_required']); assert.equal(provider.calls.length, 0);
    assert.equal(Number((await q('SELECT count(*)::int AS n FROM "ParticipantResumes"'))[0].n), 0);
    assert.equal((await grant(A)).status, 200);
    const pdf = pdfOf(1);
    const ok = await call(A, 'POST', '/api/user/resumes/analyze', form(pdf));
    assert.equal(ok.status, 200, JSON.stringify(ok.body)); assert.equal(ok.body.resume.version, 1);
    assert.equal(ok.body.suggestions.profession, 'Líder de diseño'); assert.deepEqual(ok.body.suggestions.declaredSkills.map((s) => [s.name, s.resumeVersion]), [['Power BI', 1], ['SQL', 1]]);
    const prompt = JSON.stringify(provider.calls[0]);
    for (const c of ['maria.gomez', '300 123', 'linkedin']) assert.equal(prompt.includes(c), false, `contacto en el prompt: ${c}`);
    const row = (await q('SELECT octet_length(data) AS n, size, sha256, data FROM "ParticipantResumes" WHERE "UserId"=$1', [A.id]))[0];
    assert.equal(Number(row.n), pdf.length + 29); assert.equal(row.size, pdf.length);
    assert.equal(row.sha256, crypto.createHash('sha256').update(pdf).digest('hex')); assert.equal(row.data.includes(Buffer.from('%PDF')), false);
    assert.equal(desencriptarBuffer(row.data).equals(pdf), true);
    const down = await call(A, 'GET', `/api/user/resumes/${ok.body.resume.id}/file`); assert.equal(down.status, 200); assert.equal(down.bytes.equals(pdf), true);
    // Lo sugerido NO se guardó: no hay nada del análisis en la base (solo el PDF cifrado).
    const dump = JSON.stringify(await q('SELECT * FROM "ParticipantContexts"')); assert.equal(dump.includes('Estudio Norte'), false);
  });

  await t.test('aislamiento A/B con SQL real: lista, descarga y borrado de una persona ajena responden como inexistentes; roles ajenos 403', async () => {
    assert.equal((await grant(B)).status, 200);
    const mine = await call(B, 'POST', '/api/user/resumes/analyze', form(pdfOf(2))); assert.equal(mine.status, 200);
    const idA = Number((await q('SELECT id FROM "ParticipantResumes" WHERE "UserId"=$1', [A.id]))[0].id);
    const list = await call(B, 'GET', '/api/user/resumes'); assert.deepEqual(list.body.resumes.map((r) => r.id), [mine.body.resume.id]);
    const stolen = await call(B, 'GET', `/api/user/resumes/${idA}/file`); const none = await call(B, 'GET', '/api/user/resumes/999999/file');
    assert.deepEqual([stolen.status, stolen.body], [none.status, none.body]); assert.equal(stolen.bytes.includes(Buffer.from('%PDF')), false);
    const del = await call(B, 'DELETE', `/api/user/resumes/${idA}`); assert.equal(del.status, 404);
    assert.equal(Number((await q('SELECT count(*)::int AS n FROM "ParticipantResumes" WHERE id=$1', [idA]))[0].n), 1, 'la ajena sigue intacta');
    for (const who of [await mkUser('therapist'), await mkUser('admin')]) assert.equal((await call(who, 'GET', '/api/user/resumes')).status, 403);
  });

  await t.test('borrar una versión la elimina de verdad y registra la invalidación «para revisión»', async () => {
    const id = Number((await q('SELECT id FROM "ParticipantResumes" WHERE "UserId"=$1', [B.id]))[0].id);
    assert.equal((await call(B, 'DELETE', `/api/user/resumes/${id}`)).status, 200);
    assert.equal(Number((await q('SELECT count(*)::int AS n FROM "ParticipantResumes" WHERE "UserId"=$1', [B.id]))[0].n), 0);
    assert.deepEqual(await q(`SELECT "sourceType", "sourceId", reason FROM "DerivedInvalidations" WHERE "UserId"=$1`, [B.id]), [{ sourceType: 'resume', sourceId: id, reason: 'deleted' }]);
    assert.equal((await call(B, 'GET', `/api/user/resumes/${id}/file`)).status, 404);
  });

  await t.test('retirar la autorización borra TODAS las versiones en la misma transacción, marca lo derivado y bloquea nuevos análisis', async () => {
    for (const n of [3, 4]) assert.equal((await call(A, 'POST', '/api/user/resumes/analyze', form(pdfOf(n)))).status, 200);
    assert.equal(Number((await q('SELECT count(*)::int AS n FROM "ParticipantResumes" WHERE "UserId"=$1', [A.id]))[0].n), 3);
    const before = provider.calls.length;
    const revoked = await grant(A, 'revoked'); assert.equal(revoked.status, 200);
    assert.equal(Number((await q('SELECT count(*)::int AS n FROM "ParticipantResumes" WHERE "UserId"=$1', [A.id]))[0].n), 0);
    assert.equal(Number((await q(`SELECT count(*)::int AS n FROM "DerivedInvalidations" WHERE "UserId"=$1 AND "sourceType"='resume'`, [A.id]))[0].n), 3);
    const denied = await call(A, 'POST', '/api/user/resumes/analyze', form(pdfOf(5)));
    assert.deepEqual([denied.status, denied.body.code], [403, 'consent_required']); assert.equal(provider.calls.length, before);
    assert.equal(Number((await q(`SELECT count(*)::int AS n FROM "ConsentEvents" WHERE "UserId"=$1 AND purpose='resume_ai_reading'`, [A.id]))[0].n), 2, 'una autorización y su retiro, cada una registrada una vez');
  });

  await t.test('concurrencia: 10 altas simultáneas de archivos distintos dejan exactamente 5 versiones sin repetir número; el mismo archivo 8 veces deja una', async () => {
    assert.equal((await grant(C)).status, 200);
    const sealed = await Promise.allSettled(Array.from({ length: 10 }, (_, i) => consent.withConsent(C.id, 'resume_ai_reading', (tx) => resumes.storeResume(C.id, pdfOf(100 + i), tx))));
    assert.equal(sealed.filter((r) => r.status === 'fulfilled').length, 5);
    assert.equal(sealed.filter((r) => r.status === 'rejected' && r.reason.code === 'resume_limit').length, 5);
    assert.deepEqual((await q('SELECT version FROM "ParticipantResumes" WHERE "UserId"=$1 ORDER BY version', [C.id])).map((r) => r.version), [1, 2, 3, 4, 5]);
    const D = await mkUser(); assert.equal((await grant(D)).status, 200); const same = pdfOf(777);
    const outcomes = await Promise.all(Array.from({ length: 8 }, () => consent.withConsent(D.id, 'resume_ai_reading', (tx) => resumes.storeResume(D.id, same, tx))));
    assert.equal(outcomes.filter((o) => !o.reused).length, 1); assert.equal(Number((await q('SELECT count(*)::int AS n FROM "ParticipantResumes" WHERE "UserId"=$1', [D.id]))[0].n), 1);
    // Con el pool de 5 y 12 solicitudes HTTP simultáneas (análisis, listas y descargas) nadie recibe 5xx.
    const E = await mkUser(); assert.equal((await grant(E)).status, 200);
    const results = await Promise.all([...Array.from({ length: 6 }, (_, i) => call(E, 'POST', '/api/user/resumes/analyze', form(pdfOf(300 + i)))), ...Array.from({ length: 6 }, () => call(E, 'GET', '/api/user/resumes'))]);
    assert.deepEqual(results.map((r) => r.status).filter((s) => s >= 500), []);
    assert.equal(results.slice(0, 6).filter((r) => r.status === 200).length, 1, 'un análisis a la vez por persona');
    assert.ok(results.slice(0, 6).filter((r) => r.status === 409).length >= 4);
  });

  await t.test('derechos de datos (ES-23): la exportación lleva solo metadatos (nunca el archivo) y borrar la cuenta elimina las versiones en cascada', async () => {
    const exported = await app.transaction(async (transaction) => personalData(await app.models.User.findByPk(C.id, { transaction }), 'es', transaction));
    assert.equal(exported.participantResumes.length, 5);
    assert.deepEqual(Object.keys(exported.participantResumes[0]).sort(), ['createdAt', 'id', 'sha256', 'size', 'version']);
    assert.equal(JSON.stringify(exported).includes('%PDF'), false);
    await q('DELETE FROM "Users" WHERE id=$1', [C.id]);
    assert.equal(Number((await q('SELECT count(*)::int AS n FROM "ParticipantResumes" WHERE "UserId"=$1', [C.id]))[0].n), 0);
  });

  await t.test('la migración tiene guarda: sin permiso explícito el down se niega y no deja la base a medias (el ciclo down/up completo lo comprueba db:drift)', async () => {
    const refused = cli(['db:migrate:undo'], { ALLOW_DESTRUCTIVE_MIGRATION: 'false' });
    assert.notEqual(refused.status, 0);
    assert.equal(Number((await q(`SELECT count(*)::int AS n FROM information_schema.tables WHERE table_name='ParticipantResumes'`))[0].n), 1, 'no dejó la base a medias');
  });
});
