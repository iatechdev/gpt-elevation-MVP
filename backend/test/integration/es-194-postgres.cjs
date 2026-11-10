// ES-194 · Ejercicios (administración y lectura de la persona) por HTTP REAL, JWT real y PostgreSQL REAL (migraciones reales con sequelize-cli).
// Publicación y revisión del especialista INDEPENDIENTES; la persona solo ve publicados; el contenido nuevo no hereda la revisión; concurrencia; historial.
//   ES194_TEST_DATABASE_URL=postgres://elevation:elevation_local@127.0.0.1:54391/postgres node --test test/integration/es-179-postgres.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { once } = require('node:events');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { Client } = require('pg');
const { Sequelize } = require('sequelize');

const backend = path.resolve(__dirname, '..', '..');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

test('ES-194 PostgreSQL + HTTP: ejercicios con publicación y revisión del especialista independientes', { timeout: 240000 }, async (t) => {
  assert.ok(process.env.ES194_TEST_DATABASE_URL, 'Se requiere ES194_TEST_DATABASE_URL (clúster desechable en loopback)');
  const target = new URL(process.env.ES194_TEST_DATABASE_URL);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname), 'Solo loopback');
  const dbName = `es194_test_${crypto.randomBytes(8).toString('hex')}`;
  const urlFor = (name) => { const u = new URL(target.toString()); u.pathname = `/${name}`; return u.toString(); };
  const admin = new Client({ connectionString: target.toString(), ssl: false }); await admin.connect();
  let created = false; let app; let server; let db;
  const realFetch = global.fetch;
  t.after(async () => {
    global.fetch = realFetch;
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

  app = new Sequelize(urlFor(dbName), { logging: false, dialectOptions: { ssl: false }, pool: { max: 12, min: 0, acquire: 8000 } });
  process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
  process.env.DATA_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
  process.env.NODE_ENV = 'test';
  process.env.AI_BUDGET_TOKENS_PER_USER = '1000000000'; process.env.AI_BUDGET_PERIOD = 'month';
  const dbModule = require.resolve('../../database');
  require.cache[dbModule] = { id: dbModule, filename: dbModule, loaded: true, exports: { sequelize: app } };
  const anthropicModule = require.resolve('../../utils/anthropic');
  const provider = { calls: 0 };
  require.cache[anthropicModule] = { id: anthropicModule, filename: anthropicModule, loaded: true, exports: {
    MODEL: 'modelo-sintetico', messages: { create: async () => { provider.calls += 1; return { content: [{ type: 'text', text: 'Recomendación sintética.' }], usage: { input_tokens: 10, output_tokens: 5 } }; } },
  } };
  require('../../associations')();
  const { issueToken } = require('../../utils/sessions');
  const { verificarToken, verificarAdmin } = require('../../middlewares/auth');
  const express = require('express');
  const api = express(); api.use(express.json());
  api.use('/api/consents', verificarToken, require('../../routes/consents'));
  api.use('/api/admin/exercises', verificarAdmin, require('../../routes/exercises').adminRouter);
  api.use('/api/exercises', verificarToken, require('../../routes/exercises').readRouter);
  server = api.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  db = new Client({ connectionString: urlFor(dbName), ssl: false }); await db.connect();
  const q = async (text, params) => (await db.query(text, params)).rows;

  const columns = await q(`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='Users'
    AND is_nullable='NO' AND column_default IS NULL AND column_name <> 'id'`);
  let seq = 0;
  async function mkUser(role, { therapistId = null } = {}) {
    seq += 1; const names = []; const values = [];
    for (const c of columns) {
      let v;
      if (c.column_name === 'role') v = role;
      else if (c.column_name === 'name') v = `Sintético ${seq}`;
      else if (c.data_type.includes('char') || c.data_type === 'text') v = c.column_name === 'email' ? `canario-correo-${seq}-${dbName}@example.test` : `sintetico-${seq}-${c.column_name}`;
      else if (c.data_type === 'integer') v = 0; else if (c.data_type === 'boolean') v = true; else if (c.data_type.startsWith('timestamp')) v = new Date(); else v = '{}';
      names.push(`"${c.column_name}"`); values.push(v);
    }
    const id = (await q(`INSERT INTO "Users" (${names.join(',')}) VALUES (${values.map((_, i) => `$${i + 1}`).join(',')}) RETURNING id`, values))[0].id;
    await q('UPDATE "Users" SET role=$2, active=true, "therapistId"=$3 WHERE id=$1', [id, role, therapistId]);
    return { id, role, name: `Sintético ${seq}`, token: issueToken({ id, role, name: `Sintético ${seq}` }) };
  }
  const http = async (who, method, route, body) => {
    // (la respuesta incluye las cabeceras de caché para comprobar que no se guardan datos de administración)
    const res = await fetch(`${base}${route}`, { method, headers: { ...(who ? { Authorization: `Bearer ${who.token}` } : {}), 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const text = await res.text(); let parsed = null; try { parsed = text ? JSON.parse(text) : null; } catch { /* no JSON */ }
    return { status: res.status, body: parsed, cache: res.headers.get('cache-control') };
  };

  const sup = await mkUser('superadmin'); const adm = await mkUser('admin'); const pro = await mkUser('therapist'); const person = await mkUser('user');
  const catalog = require('../../../shared/companion-exercises.json');
  const COUNT = (sql, params) => q(sql, params).then((r) => r[0].n);
  const A = '/api/admin/exercises';
  const content = (tag = '') => ({
    key: undefined,
    es: { title: 'Una situación que quiero comprender' + tag, purpose: 'Elegir qué parte explorar, sin explicarlo todo.', question: '¿Qué parte te gustaría comprender mejor?', help: 'Puedes compartir solo lo que desees.' },
    en: { title: 'A situation I want to understand' + tag, purpose: 'Choose which part to explore without explaining everything.', question: 'Which part would you like to understand better?', help: 'You can share only what you want.' },
    minutes: [3, 5],
  });
  const create = (key, extra = {}) => http(sup, 'POST', A, { ...content(), key, ...extra });
  const publish = (id, who = sup) => http(who, 'POST', `${A}/${id}/publish`, { confirm: true });
  const review = (id, reviewStatus, who = sup) => http(who, 'POST', `${A}/${id}/review`, { reviewStatus, confirm: true });
  const visible = async (who = person) => (await http(who, 'GET', '/api/exercises')).body;

  await t.test('migración aditiva e idempotente: tablas con RLS, índices, sin ejercicios sembrados', async () => {
    const migration = require('../../migrations/20261111020000-es194-exercises.cjs');
    await migration.up(app); await migration.up(app);
    for (const table of ['Exercises', 'ExerciseAudits']) assert.equal((await q('SELECT relrowsecurity FROM pg_class WHERE relname=$1', [table]))[0].relrowsecurity, true, table);
    assert.equal((await q("SELECT count(*)::int AS n FROM pg_indexes WHERE tablename='Exercises' AND indexname IN ('exercises__key','exercises__status')"))[0].n, 2);
    assert.equal(await COUNT('SELECT count(*)::int AS n FROM "Exercises"'), 0, 'la migración no siembra ningún ejercicio');
  });

  await t.test('solo superadmin administra: admin, profesional y persona = 403 en TODAS las rutas; sin sesión = 401', async () => {
    const made = await create('ejercicio_acceso');
    assert.equal(made.status, 201);
    const id = made.body.id;
    for (const who of [adm, pro, person]) {
      for (const [method, route, body] of [['GET', A], ['GET', `${A}/${id}`], ['POST', A, { ...content(), key: 'otra_clave' }], ['PUT', `${A}/${id}`, { ...content(), expectedVersion: 1 }],
        ['POST', `${A}/${id}/publish`, { confirm: true }], ['POST', `${A}/${id}/withdraw`, { confirm: true }], ['POST', `${A}/${id}/review`, { reviewStatus: 'done', confirm: true }], ['POST', `${A}/import-catalog`, {}]]) {
        const r = await http(who, method, route, body);
        assert.equal(r.status, 403, `${who.role} ${method} ${route}`);
      }
    }
    assert.ok([401, 403].includes((await http(null, 'GET', A)).status), 'sin sesión no entra');
    assert.equal((await q('SELECT count(*)::int AS n FROM "Exercises"'))[0].n, 1, 'los intentos no crearon nada');
    assert.equal(made.cache, 'no-store');
  });

  await t.test('crear: nace borrador con revisión pendiente y la persona NO lo ve (ni en la lista ni por clave); clave repetida, inválida y texto con marcado se rechazan', async () => {
    const made = await create('situacion_a');
    assert.equal(made.status, 201); assert.deepEqual([made.body.status, made.body.reviewStatus, made.body.version], ['draft', 'pending', 1]);
    assert.deepEqual((await visible()).filter((e) => e.key === 'situacion_a'), []);
    const byKey = await http(person, 'GET', '/api/exercises/situacion_a'); const ghost = await http(person, 'GET', '/api/exercises/no_existe_nunca');
    assert.deepEqual([byKey.status, byKey.body], [ghost.status, ghost.body], 'un borrador responde igual que un ejercicio inexistente');
    assert.equal((await create('situacion_a')).body.code, 'key_exists');
    assert.equal((await create('Mala Clave')).body.reason, 'invalid_key');
    const markup = await create('con_marcado', { es: { ...content().es, title: '<script>alert(1)</script>' } });
    assert.deepEqual([markup.status, markup.body.reason], [400, 'markup_not_allowed']);
    assert.equal((await create('muy_largo', { es: { ...content().es, help: 'x'.repeat(301) } })).body.reason, 'too_long');
    assert.equal((await create('con_control', { es: { ...content().es, title: 'a\u0007b' } })).body.reason, 'control_chars');
    assert.equal((await create('minutos_mal', { minutes: [5, 3] })).body.reason, 'invalid');
    assert.equal(await COUNT("SELECT count(*)::int AS n FROM \"Exercises\" WHERE key IN ('con_marcado','muy_largo','con_control','minutos_mal')"), 0);
  });

  await t.test('publicar: exige confirmación, ES+EN completos y la heurística no clínica; SIN revisión hecha se puede y la persona ve «pending»', async () => {
    const made = await create('situacion_b'); const id = made.body.id;
    assert.equal((await http(sup, 'POST', `${A}/${id}/publish`, {})).body.code, 'confirmation_required');
    const draft = await create('incompleto', { en: { title: 'Only title', purpose: '', question: '', help: '' } });
    const incomplete = await publish(draft.body.id);
    assert.deepEqual([incomplete.status, incomplete.body.code], [422, 'incomplete']); assert.ok(incomplete.body.missing.includes('en.purpose'));
    for (const [tag, text, lang] of [['porcentaje', 'Mejorarás un 40 % en una semana.', 'es'], ['diagnóstico', 'Esto sirve como diagnóstico.', 'es'], ['promesa', 'Te garantiza empleo.', 'es'], ['treatment', 'A treatment for your anxiety.', 'en'], ['percent', 'You will improve 30 percent.', 'en']]) {
      const row = await create(`clinico_${tag === 'diagnóstico' ? 'diagnostico' : tag}`, { [lang]: { ...content()[lang], help: text } });
      const r = await publish(row.body.id);
      assert.deepEqual([r.status, r.body.code], [422, 'non_clinical_rule'], tag); assert.ok(r.body.violations.some((v) => v.field === `${lang}.help`), tag);
      assert.equal((await q('SELECT status FROM "Exercises" WHERE id=$1', [row.body.id]))[0].status, 'draft');
    }
    const ok = await publish(id);
    assert.deepEqual([ok.status, ok.body.status, ok.body.reviewStatus, ok.body.publishedBy], [200, 'published', 'pending', sup.name]);
    const mine = (await visible()).find((e) => e.key === 'situacion_b');
    assert.deepEqual([mine.reviewStatus, mine.minutes], ['pending', [3, 5]]);
    assert.deepEqual(Object.keys(mine).sort(), ['en', 'es', 'key', 'minutes', 'reviewStatus', 'version'], 'la persona no recibe quién revisó, quién publicó ni historial');
    const again = await publish(id);
    assert.deepEqual([again.status, again.body.unchanged], [200, true]);
    assert.equal(await COUNT("SELECT count(*)::int AS n FROM \"ExerciseAudits\" WHERE \"exerciseId\"=$1 AND action='publish'", [id]), 1, 'publicar dos veces no duplica el historial');
    for (const role of [pro, adm]) assert.equal((await visible(role)).some((e) => e.key === 'situacion_b'), true, 'cualquier sesión lee los publicados');
    assert.ok([401, 403].includes((await http(null, 'GET', '/api/exercises')).status), 'sin sesión no entra');
  });

  await t.test('revisión del especialista: independiente de publicar, con confirmación y quién/cuándo; contenido nuevo NO hereda la revisión; solo el estado no la toca', async () => {
    const made = await create('situacion_c'); const id = made.body.id; await publish(id);
    assert.equal((await http(sup, 'POST', `${A}/${id}/review`, { reviewStatus: 'done' })).body.code, 'confirmation_required');
    assert.equal((await http(sup, 'POST', `${A}/${id}/review`, { reviewStatus: 'otra', confirm: true })).body.reason, 'invalid');
    const done = await review(id, 'done');
    assert.deepEqual([done.status, done.body.reviewStatus, done.body.reviewedBy, Boolean(done.body.reviewedAt), done.body.status], [200, 'done', sup.name, true, 'published']);
    assert.equal((await visible()).find((e) => e.key === 'situacion_c').reviewStatus, 'done');
    // retirar y volver a publicar NO toca la revisión
    assert.equal((await http(sup, 'POST', `${A}/${id}/withdraw`, { confirm: true })).body.status, 'withdrawn');
    assert.equal((await publish(id)).body.reviewStatus, 'done', 'cambiar solo el estado no borra la revisión');
    // guardar SIN cambiar el contenido: nada cambia
    const same = await http(sup, 'PUT', `${A}/${id}`, { ...content(), expectedVersion: 1 });
    assert.deepEqual([same.status, same.body.unchanged, same.body.reviewStatus, same.body.version], [200, true, 'done', 1]);
    // cambiar el contenido: la revisión vuelve a pendiente y se borra quién/cuándo
    const edited = await http(sup, 'PUT', `${A}/${id}`, { ...content(' (v2)'), expectedVersion: 1 });
    assert.deepEqual([edited.status, edited.body.version, edited.body.reviewStatus, edited.body.reviewedBy, edited.body.reviewedAt], [200, 2, 'pending', null, null]);
    assert.equal((await visible()).find((e) => e.key === 'situacion_c').reviewStatus, 'pending', 'la persona ve «en revisión» otra vez');
    // solo cambiar los minutos también cuenta como contenido
    await review(id, 'done');
    const minutes = await http(sup, 'PUT', `${A}/${id}`, { ...content(' (v2)'), minutes: [4, 6], expectedVersion: 2 });
    assert.deepEqual([minutes.body.version, minutes.body.reviewStatus], [3, 'pending']);
    // se puede retirar la revisión a mano
    await review(id, 'done'); assert.equal((await review(id, 'pending')).body.reviewStatus, 'pending');
    assert.equal((await review(id, 'pending')).body.unchanged, true);
  });

  await t.test('edición concurrente: misma versión esperada = una gana y las demás 409 con la versión vigente; 6 publicaciones simultáneas = una sola en el historial', async () => {
    const made = await create('situacion_d'); const id = made.body.id;
    const all = await Promise.all(Array.from({ length: 6 }, (_, i) => http(sup, 'PUT', `${A}/${id}`, { ...content(` (${i})`), expectedVersion: 1 })));
    assert.deepEqual(all.map((r) => r.status).sort(), [200, 409, 409, 409, 409, 409], JSON.stringify(all.map((r) => r.status)));
    const conflict = all.find((r) => r.status === 409); assert.equal(conflict.body.code, 'exercise_changed'); assert.equal(conflict.body.current.version, 2);
    assert.equal((await http(sup, 'PUT', `${A}/${id}`, { ...content(), expectedVersion: 'x' })).body.code, 'version_required');
    const pubs = await Promise.all(Array.from({ length: 6 }, () => publish(id)));
    assert.deepEqual([...new Set(pubs.map((r) => r.status))], [200]);
    assert.equal(await COUNT("SELECT count(*)::int AS n FROM \"ExerciseAudits\" WHERE \"exerciseId\"=$1 AND action='publish'", [id]), 1);
  });

  await t.test('retirar: la persona deja de verlo (lista y clave); solo se retira un publicado; el historial dice quién y cuándo', async () => {
    const made = await create('situacion_e'); const id = made.body.id;
    assert.equal((await http(sup, 'POST', `${A}/${id}/withdraw`, { confirm: true })).body.code, 'not_published');
    await publish(id); await review(id, 'done');
    assert.equal((await http(person, 'GET', '/api/exercises/situacion_e')).status, 200);
    const out = await http(sup, 'POST', `${A}/${id}/withdraw`, { confirm: true });
    assert.deepEqual([out.status, out.body.status, out.body.withdrawnBy], [200, 'withdrawn', sup.name]);
    assert.equal((await visible()).some((e) => e.key === 'situacion_e'), false);
    const ghost = await http(person, 'GET', '/api/exercises/no_existe_nunca');
    const gone = await http(person, 'GET', '/api/exercises/situacion_e'); assert.deepEqual([gone.status, gone.body], [ghost.status, ghost.body]);
    const detail = await http(sup, 'GET', `${A}/${id}`);
    assert.deepEqual(detail.body.history.map((h) => h.action), ['withdraw', 'review', 'publish', 'create']);
    assert.ok(detail.body.history.every((h) => h.actorName === sup.name && h.createdAt));
    assert.equal((await q('SELECT count(*)::int AS n FROM "ExerciseAudits" WHERE snapshot ILIKE $1', ['%@%']))[0].n, 0, 'el historial no guarda correos ni datos de personas');
  });

  await t.test('importar el catálogo: todo BORRADOR con revisión pendiente, idempotente, no sobrescribe y los textos del catálogo pasan la heurística', async () => {
    const before = await COUNT('SELECT count(*)::int AS n FROM "Exercises"');
    const first = await http(sup, 'POST', `${A}/import-catalog`, {});
    assert.equal(first.status, 200); assert.equal(first.body.created.length, catalog.exercises.length);
    assert.equal(await COUNT('SELECT count(*)::int AS n FROM "Exercises"'), before + catalog.exercises.length);
    assert.equal(await COUNT("SELECT count(*)::int AS n FROM \"Exercises\" WHERE key = ANY($1) AND (status <> 'draft' OR \"reviewStatus\" <> 'pending')", [catalog.exercises.map((e) => e.key)]), 0);
    assert.equal((await visible()).some((e) => catalog.exercises.some((c) => c.key === e.key)), false, 'importar no publica nada');
    const second = await http(sup, 'POST', `${A}/import-catalog`, {});
    assert.deepEqual([second.body.created.length, second.body.skipped.length], [0, catalog.exercises.length]);
    const row = (await q('SELECT id FROM "Exercises" WHERE key=$1', [catalog.exercises[0].key]))[0];
    await http(sup, 'PUT', `${A}/${row.id}`, { es: { ...catalog.exercises[0].es, title: 'Título editado' }, en: catalog.exercises[0].en, minutes: catalog.exercises[0].minutes, expectedVersion: 1 });
    await http(sup, 'POST', `${A}/import-catalog`, {});
    assert.equal((await q('SELECT es FROM "Exercises" WHERE id=$1', [row.id]))[0].es.title, 'Título editado', 'reimportar no pisa lo editado');
    for (const item of catalog.exercises) { // sin falsos positivos: cada ejercicio del catálogo se puede publicar
      const r = (await q('SELECT id FROM "Exercises" WHERE key=$1', [item.key]))[0];
      const published = await publish(r.id); assert.equal(published.status, 200, `${item.key}: ${JSON.stringify(published.body)}`);
    }
  });
});
