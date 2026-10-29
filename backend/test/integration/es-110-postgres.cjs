// ES-110 · De la hoja de vida a «Mis evidencias» con HTTP REAL, JWT real y PostgreSQL REAL (migraciones reales). Solo el proveedor de IA es un doble.
// Flujo completo: analizar → guardar el contexto → ver las habilidades → elegir → evidencia en borrador SIN nivel → editar sin perder el origen →
// borrar la hoja de vida → «para revisión». También: sin duplicados en concurrencia, aislamiento entre personas y que el motor no lee borradores.
//   ES110_TEST_DATABASE_URL=postgres://elevation:elevation_local@127.0.0.1:54329/postgres npm run test:resume-skills:pg
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
const CV = ['MARÍA GÓMEZ', 'maria.gomez@example.test · +57 300 123 4567', 'Líder de diseño · Estudio Norte · 2021–2026', 'Habilidades: Power BI, SQL, Excel avanzado, Gestión de proyectos, Storytelling con datos',
  'Consultas SQL para reportes semanales', 'Idiomas: Español nativo'];
const OUTPUT = { profession: 'Líder de diseño', interests: null, sector: null, totalYearsExperience: null, experience: [], education: [],
  declaredSkills: [{ name: 'Power BI', support: null }, { name: 'SQL', support: 'Consultas SQL para reportes semanales' }, { name: 'Gestión de proyectos', support: null }, { name: 'Storytelling con datos', support: null }], languages: [] };

test('ES-110 PostgreSQL + HTTP: habilidades de la hoja de vida a evidencias (borrador, sin nivel), origen conservado y «para revisión»', { timeout: 240000 }, async (t) => {
  assert.ok(process.env.ES110_TEST_DATABASE_URL, 'Se requiere ES110_TEST_DATABASE_URL (clúster desechable en loopback)');
  const target = new URL(process.env.ES110_TEST_DATABASE_URL);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname), 'Solo loopback');
  const dbName = `es110_test_${crypto.randomBytes(8).toString('hex')}`;
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
  const migrated = spawnSync('npx', ['sequelize-cli', 'db:migrate'], { cwd: backend, encoding: 'utf8', shell: process.platform === 'win32',
    env: { ...process.env, DATABASE_URL: urlFor(dbName), DB_SSL: 'false', NODE_ENV: 'test' } });
  assert.equal(migrated.status, 0, `Fallaron las migraciones: ${(migrated.stdout + migrated.stderr).slice(-600)}`);

  app = new Sequelize(urlFor(dbName), { logging: false, dialectOptions: { ssl: false }, pool: { max: 5, min: 0, acquire: 5000 } });
  process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex'); process.env.DATA_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
  process.env.NODE_ENV = 'test'; process.env.AI_BUDGET_TOKENS_PER_USER = '1000000000'; process.env.AI_BUDGET_PERIOD = 'month'; process.env.RESUME_ANALYZE_RATE_MAX = '1000';
  const dbModule = require.resolve('../../database');
  require.cache[dbModule] = { id: dbModule, filename: dbModule, loaded: true, exports: { sequelize: app } };
  const anthropicModule = require.resolve('../../utils/anthropic');
  require.cache[anthropicModule] = { id: anthropicModule, filename: anthropicModule, loaded: true, exports: {
    MODEL: 'modelo-sintetico', messages: { create: async () => ({ content: [{ type: 'text', text: JSON.stringify(OUTPUT) }], usage: { input_tokens: 400, output_tokens: 200 } }) },
  } };
  require('../../associations')();
  const { issueToken } = require('../../utils/sessions');
  const { verificarToken } = require('../../middlewares/auth');
  const evidence = require('../../utils/evidence');
  const express = require('express');
  const api = express(); api.use(express.json());
  api.use('/api/consents', verificarToken, require('../../routes/consents'));
  api.use('/api/user/context', verificarToken, require('../../routes/participantContext'));
  api.use('/api/user/resumes', verificarToken, require('../../routes/resumes'));
  api.use('/api/user/resume-skills', verificarToken, require('../../routes/resumeSkills'));
  api.use('/api/evidence', verificarToken, require('../../routes/evidence'));
  server = api.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  db = new Client({ connectionString: urlFor(dbName), ssl: false }); await db.connect();
  const q = async (text, params) => (await db.query(text, params)).rows;

  // Catálogo vigente (lo publica el cliente): estos cuatro nombres están; «Storytelling con datos» no.
  const cat = (await q(`INSERT INTO "SkillCatalogs" (version,status,"publishedAt","createdAt","updatedAt") VALUES (1,'published',now(),now(),now()) RETURNING id`))[0].id;
  for (const [key, es, en] of [['power_bi', 'Power BI', 'Power BI'], ['sql', 'SQL', 'SQL'], ['gestion_proyectos', 'Gestión de proyectos', 'Project management']]) {
    await q(`INSERT INTO "SkillDefinitions" ("catalogId","skillKey",type,labels,rubric,"createdAt","updatedAt") VALUES ($1,$2,'domain',$3,$4,now(),now())`, [cat, key, JSON.stringify({ es, en }), JSON.stringify({ levels: { 1: { es: 'a', en: 'a' } } })]);
  }
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
    const res = await fetch(base + route, { method, headers, body: payload }); const text = await res.text(); let json = null; try { json = JSON.parse(text); } catch { /* sin JSON */ }
    return { status: res.status, body: json, text };
  };
  const form = (pdf) => { const f = new FormData(); f.append('requestId', crypto.randomUUID()); f.append('cv', new Blob([pdf], { type: 'application/pdf' }), 'cv.pdf'); return f; };
  const grant = (who, status = 'granted') => call(who, 'PUT', '/api/consents/resume_ai_reading', { status });
  const EMPTY = { preferredLanguage: 'es', residenceCountry: null, targetMarket: null, timeZone: null, profession: null, interests: null, availabilityMinutesPerWeek: null, careerGoal: null, careerConstraints: null,
    sector: null, totalYearsExperience: null, experience: [], education: [], declaredSkills: [], languages: [] };
  const promote = (who, names, requestId = crypto.randomUUID()) => call(who, 'POST', '/api/user/resume-skills/promote', { requestId, names });

  const A = await mkUser(); const B = await mkUser();
  let resumeId; let evidenceId;

  await t.test('analizar → guardar el contexto con las habilidades sugeridas → la lista las muestra clasificadas, con la cita de respaldo y ninguna añadida', async () => {
    assert.equal((await grant(A)).status, 200);
    const analysis = await call(A, 'POST', '/api/user/resumes/analyze', form(makeTextPdf(CV)));
    assert.equal(analysis.status, 200, analysis.text); resumeId = analysis.body.resume.id;
    const skills = analysis.body.suggestions.declaredSkills; assert.deepEqual(skills.map((s) => s.name), ['Power BI', 'SQL', 'Gestión de proyectos', 'Storytelling con datos']);
    assert.ok(skills.every((s) => typeof s.support === 'string' && s.support.length > 0), 'todas traen su cita de respaldo (la línea del documento si el modelo no la dio)');
    assert.match(skills[0].support, /Power BI/);
    const saved = await call(A, 'PUT', '/api/user/context', { schemaVersion: 2, expectedVersion: 0, action: 'save_draft', context: { ...EMPTY, declaredSkills: skills } });
    assert.equal(saved.status, 200, saved.text);
    const list = await call(A, 'GET', '/api/user/resume-skills');
    assert.equal(list.status, 200); const by = Object.fromEntries(list.body.skills.map((s) => [s.name, s]));
    assert.equal(by['Power BI'].classified.skillKey, 'power_bi'); assert.equal(by['Storytelling con datos'].classified, null);
    assert.ok(list.body.skills.every((s) => s.added === false && s.resume.version === 1)); assert.equal(Number((await q('SELECT count(*)::int AS n FROM "Evidence"'))[0].n), 0, 'por defecto no se añade nada');
  });

  await t.test('elegir: borrador de evidencia SIN nivel, con origen y con el texto exacto; no se crea ninguna evaluación y el motor no la lee', async () => {
    const res = await promote(A, ['Power BI', 'SQL', 'Storytelling con datos']);
    assert.equal(res.status, 200, res.text); assert.deepEqual(res.body.created.map((c) => c.name), ['Power BI', 'SQL']); assert.deepEqual(res.body.skipped, [{ name: 'Storytelling con datos', reason: 'unclassified' }]);
    evidenceId = res.body.created[0].id;
    const rows = await q(`SELECT v.status, v.authoring, v."hasChatOrigin", v."consentVersion", v.origins FROM "EvidenceVersions" v WHERE v."UserId"=$1 ORDER BY v."EvidenceId"`, [A.id]);
    assert.deepEqual(rows.map((r) => [r.status, r.authoring, r.hasChatOrigin, r.consentVersion]), [['draft', 'person', false, null], ['draft', 'person', false, null]]);
    assert.deepEqual(rows[0].origins.map((o) => [o.type, o.id, o.version, o.skillKey]), [['resume', resumeId, 1, 'power_bi']]); assert.match(rows[0].origins[0].stamp, /^\d{4}-\d{2}-\d{2}T/);
    assert.equal(Number((await q('SELECT count(*)::int AS n FROM "SkillAssessments"'))[0].n), 0, 'sin nivel: no se crea ninguna evaluación');
    assert.deepEqual(await evidence.getConfirmedEvidence(A.id, 'engine'), [], 'una habilidad declarada no es evidencia confirmada');
    const list = await call(A, 'GET', '/api/evidence'); assert.equal(list.body.evidence.length, 2); assert.equal(list.body.evidence[0].payload.artifactRefs[0].excerpt.includes('Power BI'), true);
    assert.deepEqual(list.body.evidence[0].origin, { kind: 'resume', version: 1, date: rows[0].origins[0].stamp, needsReview: false });
    assert.equal(JSON.stringify(list.body).includes('"level"'), false);
  });

  await t.test('sin duplicados: el mismo requestId es idempotente y 8 confirmaciones simultáneas de la misma habilidad dejan UNA evidencia', async () => {
    const id = crypto.randomUUID();
    const first = await promote(A, ['Gestión de proyectos'], id); const again = await promote(A, ['Gestión de proyectos'], id);
    assert.deepEqual([first.body.created[0].replayed, again.body.created[0].replayed, again.body.created[0].id], [false, true, first.body.created[0].id]);
    assert.equal(Number((await q(`SELECT count(*)::int AS n FROM "EvidenceVersions" WHERE "UserId"=$1`, [A.id]))[0].n), 3);
    await call(A, 'DELETE', `/api/evidence/${first.body.created[0].id}`); // vuelve a estar libre
    const race = await Promise.all(Array.from({ length: 8 }, () => promote(A, ['Gestión de proyectos'])));
    assert.deepEqual(race.map((r) => r.status).filter((s) => s >= 500), []);
    assert.equal(race.reduce((n, r) => n + r.body.created.length, 0), 1, 'exactamente una evidencia creada');
    assert.equal(race.reduce((n, r) => n + r.body.skipped.filter((s) => s.reason === 'already_added').length, 0), 7);
  });

  await t.test('editar la evidencia (como cualquier otra) NO pierde el origen; una versión nueva sigue apuntando a la misma hoja de vida', async () => {
    const edit = await call(A, 'PUT', `/api/evidence/${evidenceId}`, { payload: { title: 'Power BI', situation: 'Tableros para el equipo comercial', artifactRefs: [{ kind: 'text', excerpt: 'Power BI para el equipo comercial' }] }, status: 'draft', baseVersion: 1, requestId: crypto.randomUUID() });
    assert.equal(edit.status, 201, edit.text);
    const rows = await q(`SELECT version, origins FROM "EvidenceVersions" WHERE "EvidenceId"=$1 ORDER BY version`, [evidenceId]);
    assert.equal(rows.length, 2); assert.ok(rows.every((r) => r.origins.length === 1 && r.origins[0].type === 'resume' && r.origins[0].id === resumeId));
    const forged = await call(A, 'POST', '/api/evidence', { payload: { title: 'Falsa', situation: 'x' }, status: 'draft', requestId: crypto.randomUUID(), origins: [{ type: 'resume', id: resumeId }] });
    assert.equal(forged.status, 400, 'el cliente no puede crear un origen «hoja de vida»');
  });

  await t.test('aislamiento: otra persona no ve las habilidades, no puede añadirlas ni ve las evidencias ajenas', async () => {
    const list = await call(B, 'GET', '/api/user/resume-skills'); assert.deepEqual(list.body.skills, []);
    const res = await promote(B, ['Power BI']); assert.deepEqual(res.body.skipped, [{ name: 'Power BI', reason: 'not_declared' }]);
    assert.equal((await call(B, 'GET', '/api/evidence')).body.evidence.length, 0); assert.equal((await call(B, 'GET', `/api/evidence/${evidenceId}`)).status, 404);
    assert.equal((await call(await mkUser('therapist'), 'GET', '/api/user/resume-skills')).status, 403);
  });

  await t.test('borrar la hoja de vida de origen: la evidencia sigue y pasa a «para revisión»; sin hoja de vida no hay habilidades para añadir', async () => {
    assert.equal((await call(A, 'DELETE', `/api/user/resumes/${resumeId}`)).status, 200);
    const list = await call(A, 'GET', '/api/evidence'); assert.ok(list.body.evidence.length >= 2);
    assert.ok(list.body.evidence.every((e) => e.origin.needsReview === true)); assert.equal(list.body.evidence.find((e) => e.id === evidenceId).payload.title, 'Power BI', 'nada se borra solo');
    assert.deepEqual((await call(A, 'GET', '/api/user/resume-skills')).body.skills, []);
    assert.equal(Number((await q(`SELECT count(*)::int AS n FROM "DerivedInvalidations" WHERE "UserId"=$1 AND "sourceType"='resume'`, [A.id]))[0].n), 1, 'la invalidación de lo derivado quedó registrada');
    assert.equal((await call(A, 'DELETE', `/api/evidence/${evidenceId}`)).status, 200); // la persona decide: borrar
    assert.equal((await call(A, 'GET', `/api/evidence/${evidenceId}`)).status, 404);
  });

  await t.test('retirar la autorización de lectura con IA borra las hojas de vida y deja lo derivado «para revisión» sin perder el contexto guardado', async () => {
    const C = await mkUser(); assert.equal((await grant(C)).status, 200);
    const analysis = await call(C, 'POST', '/api/user/resumes/analyze', form(makeTextPdf(CV))); assert.equal(analysis.status, 200);
    await call(C, 'PUT', '/api/user/context', { schemaVersion: 2, expectedVersion: 0, action: 'save_draft', context: { ...EMPTY, declaredSkills: analysis.body.suggestions.declaredSkills } });
    const added = await promote(C, ['SQL']); assert.equal(added.body.created.length, 1);
    assert.equal((await grant(C, 'revoked')).status, 200);
    assert.equal(Number((await q('SELECT count(*)::int AS n FROM "ParticipantResumes" WHERE "UserId"=$1', [C.id]))[0].n), 0);
    const list = await call(C, 'GET', '/api/evidence'); assert.equal(list.body.evidence.length, 1); assert.equal(list.body.evidence[0].origin.needsReview, true);
    const ctx = await call(C, 'GET', '/api/user/context'); assert.equal(ctx.body.context.declaredSkills.length, 4, 'el contexto ya guardado no cambia');
  });
});
