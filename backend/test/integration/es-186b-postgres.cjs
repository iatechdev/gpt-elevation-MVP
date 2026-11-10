// ES-186 (parte B, servidor) · Auditoría de administración: una entrada por acción en la MISMA transacción (si la auditoría falla, la acción no ocurre), denegaciones aparte,
// lectura solo superadmin con filtros acotados e invitar idempotente por requestId (secuencial y simultáneo). HTTP REAL, JWT real, PostgreSQL REAL (migraciones reales), pool de 5.
//   ES186B_TEST_DATABASE_URL=postgres://elevation:elevation_local@127.0.0.1:54391/postgres node --test test/integration/es-186b-postgres.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { once } = require('node:events');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { Client } = require('pg');
const { Sequelize } = require('sequelize');

const backend = path.resolve(__dirname, '..', '..');

test('ES-186 parte B PostgreSQL + HTTP: auditoría de administración en la misma transacción, lectura solo superadmin e invitar idempotente por requestId', { timeout: 240000 }, async (t) => {
  assert.ok(process.env.ES186B_TEST_DATABASE_URL, 'Se requiere ES186B_TEST_DATABASE_URL (clúster desechable en loopback)');
  const target = new URL(process.env.ES186B_TEST_DATABASE_URL);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname), 'Solo loopback');
  const dbName = `es186b_test_${crypto.randomBytes(8).toString('hex')}`;
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
  const { verificarToken, verificarAdmin, verificarSuperAdmin } = require('../../middlewares/auth');
  const express = require('express');
  const api = express(); api.use(express.json());
  api.use('/api/admin/matching', verificarAdmin, require('../../routes/matching'));
  api.use('/api/admin/plan-requests', verificarAdmin, require('../../routes/planRequests'));
  api.use('/api/admin/usuarios', verificarAdmin, require('../../routes/adminUsers'));
  api.use('/api/admin/invitations', verificarAdmin, require('../../routes/invitations').adminRouter);
  api.use('/api/superadmin/audit', verificarSuperAdmin, require('../../routes/adminAudit'));
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
  const audit = (where = '', params = []) => q(`SELECT * FROM "AdminAuditEntries" ${where} ORDER BY id`, params);
  const lastAudit = async () => (await q('SELECT * FROM "AdminAuditEntries" ORDER BY id DESC LIMIT 1'))[0];
  const mkRequest = async (userId, chosen) => (await q(`INSERT INTO "MatchingRequests" ("UserId","answers","suggestions","status","chosenTherapistId","createdAt","updatedAt") VALUES ($1,'{"area":"other"}','[]','pending',$2,now(),now()) RETURNING id`, [userId, chosen]))[0].id;
  const plan = (await q(`INSERT INTO "PricingPlans" (slug,"name_es","name_en","description_es","description_en",price,currency,period,"isActive","createdAt","updatedAt") VALUES ('plan-b186','Plan B','Plan B','','',10,'USD','month',true,now(),now()) RETURNING id`))[0].id;
  const mkPlanRequest = async (userId) => (await q(`INSERT INTO "PlanRequests" ("userId","planId",status,"createdAt","updatedAt") VALUES ($1,$2,'pending',now(),now()) RETURNING id`, [userId, plan]))[0].id;

  await t.test('cada acción de administración deja UNA entrada ok con quién, qué y sobre quién; sin correos, tokens ni contraseñas', async () => {
    const person = await mkUser('user'); const other = await mkUser('user'); const doomed = await mkUser('user');
    const expectOne = async (label, action, targetType, targetId, run) => {
      const before = (await audit()).length;
      const res = await run();
      assert.ok(res.status < 300, `${label}: ${res.status} ${JSON.stringify(res.body)}`);
      const rows = (await audit()).slice(before);
      assert.equal(rows.length, 1, `${label}: ${rows.length} entradas`);
      assert.deepEqual([rows[0].actorId, rows[0].actorRole, rows[0].action, rows[0].targetType, rows[0].targetId, rows[0].result], [sup.id, 'superadmin', action, targetType, targetId, 'ok'], label);
    };
    await expectOne('cambiar rol', 'user.update', 'user', other.id, () => http(sup, 'PUT', `/api/admin/usuarios/${other.id}`, { active: false }));
    await expectOne('asignar terapeuta', 'user.assign_therapist', 'user', person.id, () => http(sup, 'PUT', `/api/admin/usuarios/${person.id}/asignar-terapeuta`, { therapistId: therapistA.id }));
    await expectOne('asignar plan', 'user.set_plan', 'user', person.id, () => http(sup, 'PUT', `/api/admin/usuarios/${person.id}/plan`, { planId: plan }));
    await expectOne('desbloquear', 'user.unlock', 'user', person.id, () => http(sup, 'PUT', `/api/admin/usuarios/${person.id}/unlock`, {}));
    await expectOne('enlace de restablecimiento', 'user.reset_link', 'user', person.id, () => http(sup, 'POST', `/api/admin/usuarios/${person.id}/reset-link`, {}));
    const request = await mkRequest(person.id, therapistB.id);
    await expectOne('confirmar emparejamiento', 'matching.confirm', 'matching_request', request, () => http(sup, 'POST', `/api/admin/matching/${request}/confirm`, {}));
    const pr1 = await mkPlanRequest(other.id); const pr2 = await mkPlanRequest(doomed.id);
    await expectOne('aprobar plan', 'plan_request.approve', 'plan_request', pr1, () => http(sup, 'PUT', `/api/admin/plan-requests/admin/${pr1}/approve`, {}));
    await expectOne('rechazar plan', 'plan_request.reject', 'plan_request', pr2, () => http(sup, 'PUT', `/api/admin/plan-requests/admin/${pr2}/reject`, { adminNote: 'Nota sintética' }));
    const inv = await http(sup, 'POST', '/api/admin/invitations', { email: `invitada-${dbName}@example.test`, role: 'user' });
    assert.equal(inv.status, 201);
    assert.equal((await lastAudit()).action, 'invitation.create'); assert.equal((await lastAudit()).targetId, inv.body.id);
    await expectOne('anular invitación', 'invitation.revoke', 'invitation', inv.body.id, () => http(sup, 'POST', `/api/admin/invitations/${inv.body.id}/revoke`, {}));
    await expectOne('eliminar usuario', 'user.delete', 'user', doomed.id, () => http(sup, 'DELETE', `/api/admin/usuarios/${doomed.id}`));
    const text = JSON.stringify(await audit());
    for (const leak of ['@example.test', 'tokenHash', 'password', 'canario']) assert.equal(text.includes(leak), false, 'la auditoría no guarda ' + leak);
    // revocar algo que ya no se puede anular (404) no deja entrada
    const n = (await audit()).length;
    assert.equal((await http(sup, 'POST', `/api/admin/invitations/${inv.body.id}/revoke`, {})).status, 404);
    assert.equal((await audit()).length, n);
  });

  await t.test('acciones negadas: quedan como denied (y el 403 no se vuelve 500)', async () => {
    const victim = await mkUser('user'); const otherSuper = await mkUser('superadmin');
    const before = (await audit()).length;
    assert.equal((await http(adm, 'POST', `/api/admin/usuarios/${victim.id}/reset-link`, {})).status, 403);
    assert.equal((await http(adm, 'PUT', `/api/admin/usuarios/${otherSuper.id}/unlock`, {})).status, 403);
    assert.equal((await http(adm, 'PUT', `/api/admin/usuarios/${otherSuper.id}`, { active: false })).status, 403);
    assert.equal((await http(adm, 'DELETE', `/api/admin/usuarios/${victim.id}`)).status, 403);
    assert.equal((await http(adm, 'POST', '/api/admin/invitations', { email: `x-${dbName}@example.test`, role: 'superadmin' })).status, 403);
    const rows = (await audit()).slice(before);
    assert.deepEqual(rows.map((r) => [r.action, r.result, r.actorId]), [['user.reset_link', 'denied', adm.id], ['user.unlock', 'denied', adm.id], ['user.update', 'denied', adm.id], ['user.delete', 'denied', adm.id], ['invitation.create', 'denied', adm.id]]);
  });

  await t.test('atomicidad: si la auditoría falla, la acción NO ocurre (una sola transacción) — emparejamiento, planes, rol e invitación', async () => {
    const person = await mkUser('user'); const target = await mkUser('user');
    const request = await mkRequest(person.id, therapistB.id); const pr = await mkPlanRequest(target.id);
    await q(`CREATE FUNCTION es186b_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic audit failure'; END $$`);
    await q('CREATE TRIGGER es186b_fail BEFORE INSERT ON "AdminAuditEntries" FOR EACH ROW EXECUTE FUNCTION es186b_fail()');
    try {
      assert.equal((await http(sup, 'POST', `/api/admin/matching/${request}/confirm`, {})).status, 500);
      assert.equal((await q('SELECT status FROM "MatchingRequests" WHERE id=$1', [request]))[0].status, 'pending');
      assert.equal((await q('SELECT "therapistId" FROM "Users" WHERE id=$1', [person.id]))[0].therapistId, null);
      assert.equal((await http(sup, 'PUT', `/api/admin/plan-requests/admin/${pr}/approve`, {})).status, 500);
      assert.equal((await q('SELECT status FROM "PlanRequests" WHERE id=$1', [pr]))[0].status, 'pending');
      assert.equal((await q('SELECT "planId" FROM "Users" WHERE id=$1', [target.id]))[0].planId, null);
      assert.equal((await http(sup, 'PUT', `/api/admin/usuarios/${target.id}`, { active: false })).status, 500);
      assert.equal((await q('SELECT active FROM "Users" WHERE id=$1', [target.id]))[0].active, true);
      const invitationsBefore = (await q('SELECT count(*)::int AS n FROM "Invitations"'))[0].n;
      assert.equal((await http(sup, 'POST', '/api/admin/invitations', { email: `atomica-${dbName}@example.test`, role: 'user' })).status, 500);
      assert.equal((await q('SELECT count(*)::int AS n FROM "Invitations"'))[0].n, invitationsBefore);
      // una denegación NO se vuelve 500 aunque la auditoría falle
      assert.equal((await http(adm, 'POST', `/api/admin/usuarios/${target.id}/reset-link`, {})).status, 403);
      // y el enlace de restablecimiento no sale si no se pudo auditar
      assert.equal((await http(sup, 'POST', `/api/admin/usuarios/${target.id}/reset-link`, {})).status, 500);
    } finally {
      await q('DROP TRIGGER es186b_fail ON "AdminAuditEntries"'); await q('DROP FUNCTION es186b_fail()');
    }
    assert.equal((await http(sup, 'POST', `/api/admin/matching/${request}/confirm`, {})).status, 200, 'sin el fallo, la misma acción procede');
  });

  await t.test('lectura: solo superadmin; paginada por cursor; filtros acotados; entrada inválida → 400, nunca 500; sin datos personales', async () => {
    assert.equal((await http(adm, 'GET', '/api/superadmin/audit')).status, 403);
    assert.equal((await http({ token: 'x' }, 'GET', '/api/superadmin/audit')).status, 401);
    const first = await http(sup, 'GET', '/api/superadmin/audit?limit=5');
    assert.equal(first.status, 200); assert.equal(first.body.entries.length, 5); assert.ok(first.body.nextBefore);
    assert.deepEqual(Object.keys(first.body.entries[0]).sort(), ['action', 'actorId', 'actorRole', 'createdAt', 'id', 'result', 'targetId', 'targetType']);
    const ids = first.body.entries.map((e) => e.id); assert.deepEqual(ids, [...ids].sort((a, b) => b - a), 'más reciente primero');
    const second = await http(sup, 'GET', `/api/superadmin/audit?limit=5&before=${first.body.nextBefore}`);
    assert.ok(second.body.entries.every((e) => e.id < first.body.nextBefore));
    const onlyDenied = await http(sup, 'GET', '/api/superadmin/audit?result=denied&limit=100');
    assert.ok(onlyDenied.body.entries.length >= 5 && onlyDenied.body.entries.every((e) => e.result === 'denied'));
    const byAction = await http(sup, 'GET', '/api/superadmin/audit?action=matching.confirm&limit=100');
    assert.ok(byAction.body.entries.length >= 1 && byAction.body.entries.every((e) => e.action === 'matching.confirm'));
    for (const bad of ['limit=101', 'limit=0', 'limit=abc', 'before=x', 'before=99999999999', 'actorId=-1', 'action=zz', 'result=zz', 'action=a&action=b', 'limit=1&limit=2', "actorId=1'%20OR%201=1"]) {
      const out = await http(sup, 'GET', `/api/superadmin/audit?${bad}`);
      assert.equal(out.status, 400, `${bad}: ${out.status}`); assert.equal(out.body.code, 'invalid_filter');
    }
    const all = JSON.stringify((await http(sup, 'GET', '/api/superadmin/audit?limit=100')).body);
    for (const leak of ['@example.test', 'tokenHash', 'password']) assert.equal(all.includes(leak), false);
  });

  await t.test('invitar es idempotente por requestId: secuencial y 8 simultáneas = una invitación, una entrada de auditoría, la primera sigue viva', async () => {
    const email = `idem-${dbName}@example.test`; const requestId = 'req-abcdefgh-0001';
    const one = await http(sup, 'POST', '/api/admin/invitations', { email, role: 'user', requestId });
    assert.equal(one.status, 201);
    const again = await http(sup, 'POST', '/api/admin/invitations', { email, role: 'user', requestId });
    assert.equal(again.status, 200); assert.equal(again.body.replayed, true); assert.equal(again.body.id, one.body.id);
    const email2 = `idem2-${dbName}@example.test`; const requestId2 = 'req-abcdefgh-0002';
    const auditBefore = (await audit("WHERE action='invitation.create'")).length;
    const outs = await Promise.all(Array.from({ length: 8 }, () => http(sup, 'POST', '/api/admin/invitations', { email: email2, role: 'user', requestId: requestId2 })));
    assert.deepEqual(outs.map((o) => o.status).sort(), [200, 200, 200, 200, 200, 200, 200, 201], outs.map((o) => o.status).join());
    assert.equal(new Set(outs.map((o) => o.body.id)).size, 1, 'todas devuelven la MISMA invitación');
    assert.equal((await q('SELECT count(*)::int AS n FROM "Invitations" WHERE "requestId"=$1', [requestId2]))[0].n, 1);
    assert.equal((await q('SELECT "usedAt" FROM "Invitations" WHERE "requestId"=$1', [requestId2]))[0].usedAt, null, 'la invitación del primero no quedó anulada por los reintentos');
    assert.equal((await audit("WHERE action='invitation.create'")).length, auditBefore + 1);
    // otra persona que invita con el mismo requestId es otra invitación; un requestId mal formado es 400
    const mine = await http(adm, 'POST', '/api/admin/invitations', { email: `adm-${dbName}@example.test`, role: 'user', requestId: requestId2 });
    assert.equal(mine.status, 201); assert.notEqual(mine.body.id, outs[0].body.id);
    for (const bad of ['corto', 'con espacio 12345', 'x'.repeat(65), "req';DROP--1234"]) assert.equal((await http(sup, 'POST', '/api/admin/invitations', { email: `bad-${dbName}@example.test`, role: 'user', requestId: bad })).status, 400, bad);
    assert.equal((await q(`SELECT count(*)::int AS n FROM pg_indexes WHERE indexname='invitations__invited_by_request_id'`))[0].n, 1);
  });
});
