// ES-280 (ES-189 PR-1) · IDs hostiles sobre TODAS las rutas con parámetro, montadas como en server.js: nunca 5xx ni detalle interno. HTTP REAL, JWT real, PostgreSQL REAL, pool de 5.
//   ES280_TEST_DATABASE_URL=postgres://elevation:elevation_local@127.0.0.1:54391/postgres node --test test/integration/es-280-postgres.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { once } = require('node:events');
const path = require('node:path');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const { Client } = require('pg');
const { Sequelize } = require('sequelize');

const backend = path.resolve(__dirname, '..', '..');

test('ES-280 PostgreSQL + HTTP: IDs hostiles en todas las rutas con parámetro (ES-189 PR-1)', { timeout: 600000 }, async (t) => {
  assert.ok(process.env.ES280_TEST_DATABASE_URL, 'Se requiere ES280_TEST_DATABASE_URL (clúster desechable en loopback)');
  const target = new URL(process.env.ES280_TEST_DATABASE_URL);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname), 'Solo loopback');
  const dbName = `es280_test_${crypto.randomBytes(8).toString('hex')}`;
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

  app = new Sequelize(urlFor(dbName), { logging: false, dialectOptions: { ssl: false }, pool: { max: 5, min: 0, acquire: 8000 } });
  process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
  process.env.DATA_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
  process.env.NODE_ENV = 'test';
  process.env.AI_BUDGET_TOKENS_PER_USER = '1000000000'; process.env.AI_BUDGET_PERIOD = 'month';
  const dbModule = require.resolve('../../database');
  require.cache[dbModule] = { id: dbModule, filename: dbModule, loaded: true, exports: { sequelize: app } };
  const mailer = { sent: true }; const mailerModule = require.resolve('../../utils/mailer'); const realMailer = require('../../utils/mailer');
  require.cache[mailerModule] = { id: mailerModule, filename: mailerModule, loaded: true, exports: { ...realMailer, sendInvitation: async () => ({ sent: mailer.sent }) } };
  const anthropicModule = require.resolve('../../utils/anthropic');
  const provider = { calls: 0 };
  require.cache[anthropicModule] = { id: anthropicModule, filename: anthropicModule, loaded: true, exports: {
    MODEL: 'modelo-sintetico', messages: { create: async () => { provider.calls += 1; return { content: [{ type: 'text', text: 'Recomendación sintética.' }], usage: { input_tokens: 10, output_tokens: 5 } }; } },
  } };
  require('../../associations')();
  const { issueToken } = require('../../utils/sessions');
  const { setConsent } = require('../../utils/consent');
  const { verificarToken, verificarAdmin, verificarSuperAdmin, verificarTerapeuta } = require('../../middlewares/auth');
  const express = require('express');
  const api = express(); api.use(express.json());

  const R = (n) => require('../../routes/' + n);
  const adminPrompts = R('adminPrompts'); const { verificarEditorManifiesto } = require('../../middlewares/auth');
  const MOUNTS = [
    ['/api', null, R('auth')], ['/api', null, R('passwordReset')], ['/api/admin/contact-entries', verificarAdmin, R('contactEntries').adminRouter],
    ['/api/admin/exercises', verificarAdmin, R('exercises').adminRouter], ['/api/exercises', verificarToken, R('exercises').readRouter],
    ['/api/admin/invitations', verificarAdmin, R('invitations').adminRouter], ['/api/professional-applications', null, R('professionalApplications').publicRouter],
    ['/api/pricing', null, R('pricing')], ['/api', verificarToken, R('chat')], ['/api', verificarToken, R('session')], ['/api/consents', verificarToken, R('consents')],
    ['/api/career-context', verificarToken, R('careerContext')], ['/api/skill-map', verificarToken, R('skillMap')], ['/api/skill-analysis', verificarToken, R('skillAnalysis')],
    ['/api/evidence', verificarToken, R('evidence')], ['/api/insights', verificarToken, R('insights')], ['/api/route-catalog', verificarToken, R('routeCatalog')],
    ['/api/routes', verificarToken, R('routes')], ['/api/experiments', verificarToken, R('careerPlan').experiments], ['/api/career-plan', verificarToken, R('careerPlan').plans],
    ['/api/diary', verificarToken, R('diary')], ['/api/mood', verificarToken, R('mood')], ['/api', verificarToken, R('ratings')], ['/api/recommendations', verificarToken, R('recommendations')],
    ['/api/user/context', verificarToken, R('participantContext')], ['/api/user/resumes', verificarToken, R('resumes')], ['/api/user/resume-skills', verificarToken, R('resumeSkills')],
    ['/api/user', verificarToken, R('progress')], ['/api/user/plan', verificarToken, R('plans')], ['/api/plan-requests', verificarToken, R('planRequests')],
    ['/api/matching', verificarToken, R('matching')], ['/api/sessions', verificarToken, R('sessions')], ['/api/therapist/validation', verificarToken, R('validation')],
    ['/api/therapist', verificarTerapeuta, R('therapistRoutes')], ['/api/admin/skill-catalog', verificarAdmin, R('skillCatalog')], ['/api/admin/route-catalog', verificarAdmin, R('routeCatalogAdmin')],
    ['/api/admin/usuarios', verificarAdmin, R('adminUsers')], ['/api/admin/professional-applications', verificarAdmin, R('professionalApplications').adminRouter],
    ['/api/admin/matching', verificarAdmin, R('matching')], ['/api/admin/pricing', verificarAdmin, R('pricing')], ['/api/admin/plan-requests', verificarAdmin, R('planRequests')],
    ['/api/admin', verificarAdmin, adminPrompts], ['/api/superadmin', verificarSuperAdmin, adminPrompts], ['/api/board', verificarEditorManifiesto, R('board')], ['/api/junta', verificarSuperAdmin, R('validation')],
    ['/api/superadmin/audit', verificarSuperAdmin, R('adminAudit')], ['/api/superadmin/ai-usage', verificarSuperAdmin, R('aiUsage').admin], ['/api/ai/usage', verificarToken, R('aiUsage').owner],
  ];
  for (const [prefix, guard, router] of MOUNTS) guard ? api.use(prefix, guard, router) : api.use(prefix, router);
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
    return { id, role, token: issueToken({ id, role }) };
  }
  const http = async (who, method, route, body) => {
    const res = await fetch(`${base}${route}`, { method, headers: { ...(who ? { Authorization: `Bearer ${who.token}` } : {}), 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const text = await res.text(); let parsed = null; try { parsed = text ? JSON.parse(text) : null; } catch { /* no JSON */ }
    return { status: res.status, body: parsed };
  };


  // ES-280 (ES-189 PR-1) · IDs hostiles en TODAS las rutas con parámetro, montadas como en server.js: ninguna responde 5xx, ningún cuerpo filtra detalle interno (PostgreSQL, trazas,
  // nombres de variables) y el registro de rutas con parámetro es CERRADO: una ruta nueva debe añadirse al fixture (y, con ella, pasa por esta batería).
  const fixturePath = path.join(__dirname, '..', 'fixtures', 'routes-with-params.json');
  const walk = (router, prefix, out) => {
    for (const layer of (router.stack || [])) {
      if (layer.route) { for (const m of Object.keys(layer.route.methods)) out.push([m.toUpperCase(), prefix + layer.route.path]); }
    }
  };
  const all = []; for (const [prefix, , router] of MOUNTS) walk(router, prefix, all);
  const seen = new Set(); const routes = all.filter(([m, p]) => { const k = m + ' ' + p; if (seen.has(k)) return false; seen.add(k); return /:[A-Za-z]+/.test(p); });
  const listing = routes.map(([m, p]) => m + ' ' + p).sort();

  await t.test('registro cerrado: la lista de rutas con parámetro coincide con el fixture (una ruta nueva se añade a propósito y entra a esta batería)', async () => {
    if (process.env.ES280_WRITE_FIXTURE === '1') fs.writeFileSync(fixturePath, JSON.stringify(listing, null, 2) + '\n');
    const expected = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
    assert.deepEqual(listing.filter((r) => !expected.includes(r)), [], 'rutas con parámetro NUEVAS: añádelas al fixture con ES280_WRITE_FIXTURE=1');
    assert.deepEqual(expected.filter((r) => !listing.includes(r)), [], 'rutas del fixture que ya no existen');
    assert.ok(listing.length >= 90, 'el recorrido de rutas encontró ' + listing.length);
  });

  await t.test('IDs hostiles: ninguna de las rutas con parámetro responde 5xx ni filtra detalle interno, con persona, profesional, administración y superadministración', async () => {
    const HOSTILE = ['abc', '0', '-1', '1.5', '01', '1e3', '99999999999', '2147483648', 'NaN', '%20', '1%3BDROP', '%D9%A3', '%00', '%27%20OR%201%3D1--', 'x'.repeat(200)];
    const sup = await mkUser('superadmin'); const th = await mkUser('therapist'); const person = await mkUser('user', { therapistId: th.id });
    const who = [person, th, sup]; // superadmin atraviesa también las guardas de administración; el rol sin permiso se corta antes de leer el id
    const LEAK = /SequelizeDatabaseError|invalid input syntax|out of range for type|violates|relation ".*" does not exist|PROMPT_ENCRYPTION|JWT_SECRET|DATA_ENCRYPTION|\n\s+at \w|node_modules|ECONN/i;
    const failures = [];
    for (const [method, pattern] of routes) {
      if (/\/(logout|logout-all)$/.test(pattern)) continue;
      for (const hostile of HOSTILE) {
        const url = pattern.replace(/:[A-Za-z]+/g, hostile);
        const outs = await Promise.all(who.map(async (actor) => { let out; try { out = await http(actor, method, url, ['GET', 'DELETE'].includes(method) ? undefined : {}); } catch (e) { out = { status: -1, body: { e: String(e) } }; } return [actor, out]; }));
        for (const [actor, out] of outs) {
          const text = JSON.stringify(out.body || {});
          const stateDependent = out.status === 503 && out.body && out.body.code === 'catalog_unavailable'; // catálogo vacío: pasa con cualquier id, no depende de él
          if ((out.status >= 500 || out.status === -1) && !stateDependent) failures.push(`${method} ${pattern} <- ${JSON.stringify(hostile).slice(0, 18)} as ${actor.role} => ${out.status} ${text.slice(0, 70)}`);
          else if (LEAK.test(text)) failures.push(`${method} ${pattern} <- ${JSON.stringify(hostile).slice(0, 18)} as ${actor.role} => ${out.status} FILTRA ${text.slice(0, 70)}`);
        }
      }
    }
    const byRoute = {}; for (const f of failures) (byRoute[f.split(' <- ')[0]] ||= []).push(f);
    assert.deepEqual(Object.keys(byRoute), [], Object.entries(byRoute).map(([k, v]) => `${k} x${v.length} p.ej. ${v[0].split(' <- ')[1]}`).join('\n'));
  });

  await t.test('el parámetro válido sigue funcionando igual: un id existente se atiende y uno inexistente da 404 (recomendaciones, planes de precio, invitaciones, guías)', async () => {
    const person = await mkUser('user'); const sup = await mkUser('superadmin');
    assert.equal((await http(person, 'PUT', '/api/recommendations/99999999/seen', {})).status, 404);
    assert.equal((await http(sup, 'PUT', '/api/admin/pricing/99999999', { name_es: 'x' })).status < 500, true);
    assert.equal((await http(sup, 'DELETE', '/api/admin/pricing/99999999')).status, 404);
    assert.equal((await http(sup, 'POST', '/api/admin/invitations/99999999/revoke', {})).status, 404);
    assert.equal((await http(sup, 'POST', '/api/superadmin/prompt/99999999/approve', {})).status, 404);
    assert.equal((await http(sup, 'POST', '/api/superadmin/prompt/99999999/rollback', {})).status, 404);
    assert.equal((await http(sup, 'PUT', '/api/board/manifest/99999999/activate', {})).status, 404);
  });
});
