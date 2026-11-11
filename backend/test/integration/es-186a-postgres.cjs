// ES-186 (parte A, servidor) · Confirmar emparejamiento retira la autorización anterior; resoluciones simultáneas de emparejamientos y planes sin doble efecto;
// códigos propios del 403 de reset-link. HTTP REAL, JWT real y PostgreSQL REAL (migraciones reales), pool de 5 conexiones.
//   ES186A_TEST_DATABASE_URL=postgres://elevation:elevation_local@127.0.0.1:54391/postgres node --test test/integration/es-186a-postgres.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { once } = require('node:events');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { Client } = require('pg');
const { Sequelize } = require('sequelize');

const backend = path.resolve(__dirname, '..', '..');

test('ES-186 parte A PostgreSQL + HTTP: emparejamiento retira la autorización anterior, resoluciones simultáneas sin doble efecto y códigos del 403', { timeout: 240000 }, async (t) => {
  assert.ok(process.env.ES186A_TEST_DATABASE_URL, 'Se requiere ES186A_TEST_DATABASE_URL (clúster desechable en loopback)');
  const target = new URL(process.env.ES186A_TEST_DATABASE_URL);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname), 'Solo loopback');
  const dbName = `es186a_test_${crypto.randomBytes(8).toString('hex')}`;
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
  const { verificarToken, verificarAdmin } = require('../../middlewares/auth');
  const express = require('express');
  const api = express(); api.use(express.json());
  api.use('/api/admin/matching', verificarAdmin, require('../../routes/matching'));
  api.use('/api/admin/plan-requests', verificarAdmin, require('../../routes/planRequests'));
  api.use('/api/admin/usuarios', verificarAdmin, require('../../routes/adminUsers'));
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

  const sup = await mkUser('superadmin'); const adm = await mkUser('admin');
  const therapistA = await mkUser('therapist'); const therapistB = await mkUser('therapist');
  const mkRequest = async (userId, chosen) => (await q(`INSERT INTO "MatchingRequests" ("UserId","answers","suggestions","status","chosenTherapistId","createdAt","updatedAt") VALUES ($1,'{"area":"other"}','[]','pending',$2,now(),now()) RETURNING id`, [userId, chosen]))[0].id;
  const consentOf = async (userId, therapistId) => (await q(`SELECT status FROM "Consents" WHERE "UserId"=$1 AND purpose='therapist_sharing' AND scope=$2`, [userId, `therapist-${therapistId}`]))[0]?.status ?? null;
  const confirm = (who, id) => http(who, 'POST', `/api/admin/matching/${id}/confirm`, {});

  await t.test('H1: confirmar un emparejamiento RETIRA la autorización de compartir con el profesional anterior y no revive si la persona vuelve a él', async () => {
    const person = await mkUser('user', { therapistId: therapistA.id });
    await setConsent(person.id, 'therapist_sharing', 'granted', `therapist-${therapistA.id}`);
    assert.equal(await consentOf(person.id, therapistA.id), 'granted');
    const request = await mkRequest(person.id, therapistB.id);
    const ok = await confirm(adm, request);
    assert.equal(ok.status, 200);
    assert.equal((await q('SELECT "therapistId" FROM "Users" WHERE id=$1', [person.id]))[0].therapistId, therapistB.id);
    assert.equal(await consentOf(person.id, therapistA.id), 'revoked', 'la autorización del anterior se retiró en la misma transacción');
    const back = await mkRequest(person.id, therapistA.id);
    assert.equal((await confirm(adm, back)).status, 200);
    assert.equal(await consentOf(person.id, therapistA.id), 'revoked', 'al volver al primero NO revive: debe autorizar de nuevo');
    assert.equal(await consentOf(person.id, therapistB.id), null, 'y la del nuevo tampoco se inventa');
    // confirmar al MISMO profesional que ya tiene no retira nada
    await setConsent(person.id, 'therapist_sharing', 'granted', `therapist-${therapistA.id}`);
    const same = await mkRequest(person.id, therapistA.id);
    assert.equal((await confirm(adm, same)).status, 200);
    assert.equal(await consentOf(person.id, therapistA.id), 'granted', 'mismo profesional: la autorización se conserva');
  });

  await t.test('H2: 2 y 8 confirmaciones simultáneas de la MISMA solicitud (pool de 5) = una sola 200, el resto 409 request_closed, sin 5xx ni vínculos dobles', async () => {
    for (const n of [2, 8]) {
      const person = await mkUser('user'); const request = await mkRequest(person.id, therapistB.id);
      const outs = await Promise.all(Array.from({ length: n }, () => confirm(n % 2 ? sup : adm, request)));
      assert.deepEqual(outs.map((o) => o.status).sort(), [200, ...Array(n - 1).fill(409)], `${n} simultáneas: ${outs.map((o) => o.status)}`);
      assert.ok(outs.filter((o) => o.status === 409).every((o) => o.body.code === 'request_closed'));
      assert.equal((await q('SELECT "therapistId" FROM "Users" WHERE id=$1', [person.id]))[0].therapistId, therapistB.id);
      assert.equal((await q('SELECT status FROM "MatchingRequests" WHERE id=$1', [request]))[0].status, 'confirmed');
    }
  });

  await t.test('H2: dos solicitudes de la MISMA persona confirmadas a la vez se serializan: queda el último vínculo y la autorización del primero retirada, sin 5xx', async () => {
    const person = await mkUser('user');
    const r1 = await mkRequest(person.id, therapistA.id); const r2 = await mkRequest(person.id, therapistB.id);
    await setConsent(person.id, 'therapist_sharing', 'granted', `therapist-${therapistA.id}`).catch(() => {});
    const outs = await Promise.all([confirm(adm, r1), confirm(sup, r2)]);
    assert.ok(outs.every((o) => o.status === 200), JSON.stringify(outs.map((o) => o.status)));
    const final = (await q('SELECT "therapistId" FROM "Users" WHERE id=$1', [person.id]))[0].therapistId;
    const loser = final === therapistA.id ? therapistB.id : therapistA.id;
    assert.ok([therapistA.id, therapistB.id].includes(final));
    assert.notEqual(await consentOf(person.id, loser), 'granted', 'ninguna autorización viva con quien ya no es su profesional');
  });

  await t.test('H2: aprobar/rechazar planes — 8 resoluciones simultáneas de la MISMA solicitud (4 aprobar + 4 rechazar): una gana, el resto 409; el plan se asigna solo si ganó aprobar', async () => {
    const plan = (await q(`INSERT INTO "PricingPlans" (slug,"name_es","name_en","description_es","description_en",price,currency,period,"isActive","createdAt","updatedAt") VALUES ('plan-a186','Plan A','Plan A','','',10,'USD','month',true,now(),now()) RETURNING id`))[0].id;
    for (let round = 0; round < 3; round++) {
      const person = await mkUser('user');
      const request = (await q(`INSERT INTO "PlanRequests" ("userId","planId",status,"createdAt","updatedAt") VALUES ($1,$2,'pending',now(),now()) RETURNING id`, [person.id, plan]))[0].id;
      const calls = [];
      for (let i = 0; i < 4; i++) { calls.push(http(sup, 'PUT', `/api/admin/plan-requests/admin/${request}/approve`, {})); calls.push(http(adm, 'PUT', `/api/admin/plan-requests/admin/${request}/reject`, { adminNote: 'Nota sintética' })); }
      const outs = await Promise.all(calls);
      assert.deepEqual(outs.map((o) => o.status).sort(), [200, ...Array(7).fill(409)], `ronda ${round}: ${outs.map((o) => o.status)}`);
      assert.ok(outs.filter((o) => o.status === 409).every((o) => o.body.code === 'request_closed'));
      const row = (await q('SELECT status FROM "PlanRequests" WHERE id=$1', [request]))[0].status;
      const assigned = (await q('SELECT "planId" FROM "Users" WHERE id=$1', [person.id]))[0].planId;
      assert.equal(assigned, row === 'approved' ? plan : null, `estado ${row}: el plan se asigna solo si se aprobó`);
    }
    // una solicitud ya resuelta no se reabre ni por aprobar ni por rechazar
    const person = await mkUser('user');
    const request = (await q(`INSERT INTO "PlanRequests" ("userId","planId",status,"createdAt","updatedAt") VALUES ($1,$2,'rejected',now(),now()) RETURNING id`, [person.id, plan]))[0].id;
    assert.equal((await http(sup, 'PUT', `/api/admin/plan-requests/admin/${request}/approve`, {})).body.code, 'request_closed');
    assert.equal((await http(sup, 'PUT', `/api/admin/plan-requests/admin/${request}/reject`, { adminNote: 'x' })).status, 409);
    assert.equal((await http(sup, 'PUT', '/api/admin/plan-requests/admin/99999999/approve', {})).status, 404);
  });

  await t.test('reset-link: el 403 lleva un código propio para cada causa (superadmin_only / superadmin_target)', async () => {
    const victim = await mkUser('user'); const other = await mkUser('superadmin');
    const notSuper = await http(adm, 'POST', `/api/admin/usuarios/${victim.id}/reset-link`, {});
    assert.deepEqual([notSuper.status, notSuper.body.code], [403, 'superadmin_only']);
    const toOther = await http(sup, 'POST', `/api/admin/usuarios/${other.id}/reset-link`, {});
    assert.deepEqual([toOther.status, toOther.body.code], [403, 'superadmin_target']);
    assert.equal((await http(sup, 'POST', `/api/admin/usuarios/${victim.id}/reset-link`, {})).status, 202);
  });

  await t.test('ES-262 (E203-1): aprobar/rechazar con un id mal formado, enorme o no numérico responde 404 uniforme, nunca 5xx; con un id válido la lógica no cambia', async () => {
    const bad = ['abc', '1.5', '-1', '0', '00', '01', '1e3', '99999999999', '2147483648', 'NaN', 'null', '%20', '1%3BDROP', '%D9%A3', '1%00', 'x'.repeat(200)];
    for (const id of bad) {
      for (const [verb, body] of [['approve', {}], ['reject', { adminNote: 'Nota sintética' }]]) {
        const out = await http(sup, 'PUT', `/api/admin/plan-requests/admin/${id}/${verb}`, body);
        assert.equal(out.status, 404, `${verb} ${id.slice(0, 20)} → ${out.status}`);
        assert.equal(out.body.code, 'not_found');
      }
    }
    // la guarda de rol va ANTES: un usuario sin permiso recibe 403 también con un id malo, y nadie recibe 5xx
    const person = await mkUser('user');
    assert.equal((await http(person, 'PUT', '/api/admin/plan-requests/admin/abc/approve', {})).status, 403);
    // un id válido sigue funcionando igual
    const plan = (await q(`INSERT INTO "PricingPlans" (slug,"name_es","name_en","description_es","description_en",price,currency,period,"isActive","createdAt","updatedAt") VALUES ('plan-e262','Plan','Plan','','',10,'USD','month',true,now(),now()) RETURNING id`))[0].id;
    const request = (await q(`INSERT INTO "PlanRequests" ("userId","planId",status,"createdAt","updatedAt") VALUES ($1,$2,'pending',now(),now()) RETURNING id`, [person.id, plan]))[0].id;
    assert.equal((await http(sup, 'PUT', `/api/admin/plan-requests/admin/${request}/approve`, {})).status, 200);
    assert.equal((await http(sup, 'PUT', `/api/admin/plan-requests/admin/${request}/approve`, {})).status, 409);
    assert.equal((await http(sup, 'PUT', '/api/admin/plan-requests/admin/99999999/approve', {})).status, 404);
  });
});
