// ES-186 (parte C, servidor) · «Eliminar» a una persona solicita la eliminación por el circuito ES-23 (202, idempotente, sin DELETE físico) y el mantenimiento no deja huérfanos;
// profesionales/junta/administración: DELETE solo sin datos ni vínculos (409 has_dependent_data). Incluye la medición ANTES/DESPUÉS. HTTP REAL, PostgreSQL REAL (migraciones reales), pool de 5.
//   ES186C_TEST_DATABASE_URL=postgres://elevation:elevation_local@127.0.0.1:54391/postgres node --test test/integration/es-186c-postgres.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { once } = require('node:events');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { Client } = require('pg');
const { Sequelize } = require('sequelize');

const backend = path.resolve(__dirname, '..', '..');

// ES-186 D · Contrato con la pantalla: la respuesta REAL del servidor se guarda como fixture del frontend (ES186_WRITE_FIXTURE=1) y cada corrida comprueba que su forma no cambió.
const fixtureFs = require('node:fs');
const FIXTURES = path.join(__dirname, '..', '..', '..', 'frontend', 'test', 'fixtures');
const shapeOf = (v) => (v === null ? null : Array.isArray(v) ? [v.length ? shapeOf(v[0]) : null] : (v && typeof v === 'object') ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, shapeOf(v[k])])) : typeof v);
const sameShape = (a, b) => (a === null || b === null) ? true : (Array.isArray(a) ? Array.isArray(b) && sameShape(a[0] ?? null, b[0] ?? null) : (a && typeof a === 'object') ? (b && typeof b === 'object' && !Array.isArray(b) && JSON.stringify(Object.keys(a)) === JSON.stringify(Object.keys(b)) && Object.keys(a).every((k) => sameShape(a[k], b[k]))) : typeof a === typeof b);
function contractFixture(name, status, body) {
  const file = path.join(FIXTURES, name);
  if (process.env.ES186_WRITE_FIXTURE) { fixtureFs.mkdirSync(FIXTURES, { recursive: true }); fixtureFs.writeFileSync(file, JSON.stringify({ status, body }, null, 2) + String.fromCharCode(10)); return; }
  const saved = JSON.parse(fixtureFs.readFileSync(file, 'utf8'));
  assert.equal(saved.status, status, name);
  assert.ok(sameShape(shapeOf(saved.body), shapeOf(body)), `la respuesta cambió de forma respecto de ${name}; regenera con ES186_WRITE_FIXTURE=1 y revisa la pantalla`);
}

test('ES-186 parte C PostgreSQL + HTTP: «Eliminar» solicita la eliminación por ES-23 (sin huérfanos) y los profesionales solo se eliminan sin dependencias', { timeout: 240000 }, async (t) => {
  assert.ok(process.env.ES186C_TEST_DATABASE_URL, 'Se requiere ES186C_TEST_DATABASE_URL (clúster desechable en loopback)');
  const target = new URL(process.env.ES186C_TEST_DATABASE_URL);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname), 'Solo loopback');
  const dbName = `es186c_test_${crypto.randomBytes(8).toString('hex')}`;
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
  const { CORE } = require('../../utils/personalData');
  const { processDeletion } = require('../../utils/deletionProcessor');
  const fkRows = await q(`select conrelid::regclass::text t, a.attname col, confrelid::regclass::text ref, co.confdeltype del from pg_constraint co join pg_attribute a on a.attrelid=co.conrelid and a.attnum=any(co.conkey) where co.contype='f'`);
  const fkOf = (t, col) => fkRows.find((f) => f.t.replace(/"/g, '') === t && f.col === col);
  const audit = (where = '', params = []) => q(`SELECT * FROM "AdminAuditEntries" ${where} ORDER BY id`, params);

  // Almacenes de personalData.CORE (tabla + columna dueña), salvo los que se limpian por otra vía (enlaces de restablecimiento en cascada, invitación aceptada).
  const stores = CORE.filter(([, name]) => !['PasswordReset', 'Invitation'].includes(name)).map(([, name, owner]) => ({ name, owner, table: require('../../' + name).getTableName() }));
  const tableName = (s) => (typeof s.table === 'string' ? s.table : s.table.tableName);

  // Siembra una fila sintética en `table.col = userId`. Devuelve true si pudo (las tablas que necesitan filas padre se omiten y se cuentan aparte).
  async function seed(table, col, userId, otherId) {
    const cols = await q(`select column_name, data_type, udt_name, is_nullable, column_default from information_schema.columns where table_schema='public' and table_name=$1`, [table]);
    const names = []; const vals = [];
    for (const k of cols) {
      if (k.column_name === col) { names.push(`"${k.column_name}"`); vals.push(userId); continue; }
      if (k.is_nullable === 'YES' || k.column_default !== null) continue;
      const fk = fkOf(table, k.column_name); let v;
      if (fk && fk.ref.replace(/"/g, '') === 'Users') v = otherId;
      else if (fk) return false;
      else if (/char|text/.test(k.data_type)) v = 'x'; else if (k.data_type === 'integer' || k.data_type === 'bigint') v = 1; else if (k.data_type === 'boolean') v = false;
      else if (k.data_type.startsWith('timestamp') || k.data_type === 'date') v = new Date(); else if (k.data_type.includes('json')) v = '{}';
      else if (k.data_type === 'bytea') v = Buffer.from('x'); else if (k.data_type === 'uuid') v = crypto.randomUUID();
      else if (k.data_type === 'USER-DEFINED') { const e = await q(`select enumlabel from pg_enum e join pg_type ty on ty.oid=e.enumtypid where ty.typname=$1 limit 1`, [k.udt_name]); v = e[0]?.enumlabel; }
      else return false;
      names.push(`"${k.column_name}"`); vals.push(v);
    }
    try { await q(`INSERT INTO "${table}" (${names.join(',')}) VALUES (${vals.map((_, i) => `$${i + 1}`).join(',')})`, vals); return true; } catch { return false; }
  }
  async function seedPerson(userId, otherId) {
    const seeded = [];
    for (const s of stores) if (await seed(tableName(s), s.owner, userId, otherId)) seeded.push(s);
    return seeded;
  }
  const remaining = async (seeded, userId) => { const out = {}; for (const s of seeded) { const n = (await q(`SELECT count(*)::int n FROM "${tableName(s)}" WHERE "${s.owner}"=$1`, [userId]))[0].n; if (n) out[tableName(s)] = n; } return out; };

  await t.test('ANTES (medición): borrar la fila de la persona, como hacía usuario.destroy(), deja HUÉRFANOS los almacenes sin FK y es BLOQUEADO por los de FK sin acción', async () => {
    const other = await mkUser('user');
    const noFk = await mkUser('user'); const blocking = await mkUser('user');
    const orphanStores = [];
    for (const s of stores.filter((x) => !fkOf(tableName(x), x.owner))) if (await seed(tableName(s), s.owner, noFk.id, other.id)) orphanStores.push(s);
    assert.ok(orphanStores.length >= 8, 'almacenes sin FK sembrados: ' + orphanStores.map((s) => tableName(s)).join());
    await q('DELETE FROM "Users" WHERE id=$1', [noFk.id]); // sin FK sin acción de por medio, el borrado físico PASA
    const left = await remaining(orphanStores, noFk.id);
    assert.ok(Object.keys(left).length >= 8, 'tras el DELETE físico quedan datos de una persona que ya no existe: ' + JSON.stringify(left));
    const blockers = stores.filter((s) => { const f = fkOf(tableName(s), s.owner); return f && f.del === 'a'; });
    let blockedBy = null;
    for (const s of blockers) { if (await seed(tableName(s), s.owner, blocking.id, other.id)) { try { await q('DELETE FROM "Users" WHERE id=$1', [blocking.id]); } catch (e) { blockedBy = e.constraint; } if (blockedBy) break; } }
    assert.ok(blockedBy, 'una FK sin acción impide el borrado físico de quien tiene carrera/rutas/IA (hoy 500): ' + blockedBy);
  });

  await t.test('DESPUÉS: «Eliminar» a una persona = solicitud ES-23 (202), sin DELETE físico, cuenta sin acceso, auditada una vez; el proceso de mantenimiento no deja huérfanos', async () => {
    const person = await mkUser('user'); const other = await mkUser('user');
    const seeded = await seedPerson(person.id, other.id);
    assert.ok(seeded.length >= 12);
    assert.ok(seeded.some((s) => /Career|Route|AiJob|SkillCandidate|ChatTurn|Diary|Consent|Evidence/.test(s.name)), 'incluye carrera/rutas/diario/consentimientos');
    const before = (await audit()).length;
    const res = await http(sup, 'DELETE', `/api/admin/usuarios/${person.id}`);
    assert.equal(res.status, 202, JSON.stringify(res.body)); assert.equal(res.body.code, 'deletion_requested'); assert.equal(res.body.repeated, false);
    assert.match(res.body.message, /mantenimiento.*retención.*maintenance.*retention/s, 'dice que hay datos que se conservan según la política de retención'); assert.doesNotMatch(res.body.message, /se completa en el proceso de mantenimiento/); assert.ok(!/\b\d+\s*(días|dias|days|horas|hours)\b/i.test(res.body.message), 'sin plazo prometido');
    const row = (await q('SELECT active FROM "Users" WHERE id=$1', [person.id]))[0];
    assert.equal(row.active, false, 'la fila sigue (sin DELETE físico) pero la cuenta ya no entra');
    assert.equal((await q('SELECT count(*)::int n FROM "DeletionRequests" WHERE "UserId"=$1', [person.id]))[0].n, 1);
    const entries = (await audit()).slice(before);
    assert.deepEqual(entries.map((e) => [e.action, e.targetId, e.result]), [['user.delete_request', person.id, 'ok']]);
    // el mantenimiento (ES-23) completa el borrado de TODOS los almacenes sembrados
    assert.ok(Object.keys(await remaining(seeded, person.id)).length > 0, 'antes del mantenimiento los datos siguen (solicitud, no borrado)');
    const request = (await q('SELECT id FROM "DeletionRequests" WHERE "UserId"=$1', [person.id]))[0];
    await processDeletion(request.id, { quiescent: true });
    assert.deepEqual(await remaining(seeded.filter((s) => s.name !== 'DerivedInvalidation'), person.id), {}, 'ningún almacén queda con datos de la persona');
  });

  await t.test('idempotente: repetir y 8 solicitudes simultáneas = una solicitud, una entrada de auditoría, sin 5xx', async () => {
    const person = await mkUser('user'); const before = (await audit("WHERE action='user.delete_request'")).length;
    const outs = await Promise.all(Array.from({ length: 8 }, () => http(sup, 'DELETE', `/api/admin/usuarios/${person.id}`)));
    assert.ok(outs.every((o) => o.status === 202), outs.map((o) => o.status).join());
    assert.equal(outs.filter((o) => o.body.repeated === false).length, 1);
    assert.equal((await q('SELECT count(*)::int n FROM "DeletionRequests" WHERE "UserId"=$1', [person.id]))[0].n, 1);
    assert.equal((await audit("WHERE action='user.delete_request'")).length, before + 1);
    const again = await http(sup, 'DELETE', `/api/admin/usuarios/${person.id}`);
    assert.deepEqual([again.status, again.body.repeated], [202, true]);
    assert.equal((await audit("WHERE action='user.delete_request'")).length, before + 1);
  });

  await t.test('si la auditoría falla, la solicitud de eliminación NO queda registrada (misma transacción) y responde 500 sin tocar la cuenta', async () => {
    const person = await mkUser('user');
    await q(`CREATE FUNCTION es186c_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic audit failure'; END $$`);
    await q('CREATE TRIGGER es186c_fail BEFORE INSERT ON "AdminAuditEntries" FOR EACH ROW EXECUTE FUNCTION es186c_fail()');
    try {
      assert.equal((await http(sup, 'DELETE', `/api/admin/usuarios/${person.id}`)).status, 500);
      assert.equal((await q('SELECT count(*)::int n FROM "DeletionRequests" WHERE "UserId"=$1', [person.id]))[0].n, 0);
      assert.equal((await q('SELECT active FROM "Users" WHERE id=$1', [person.id]))[0].active, true);
    } finally { await q('DROP TRIGGER es186c_fail ON "AdminAuditEntries"'); await q('DROP FUNCTION es186c_fail()'); }
  });

  await t.test('profesional con notas, vínculos o datos: 409 has_dependent_data, nada se borra, nunca 500; sin dependencias: se elimina y se audita', async () => {
    const withNotes = await mkUser('therapist'); const patient = await mkUser('user');
    await q(`INSERT INTO "ClinicalNotes" ("UserId","therapistId","content","createdAt","updatedAt") VALUES ($1,$2,'x',now(),now())`, [patient.id, withNotes.id]).catch(async () => { await seed('ClinicalNotes', 'therapistId', withNotes.id, patient.id); });
    const linked = await mkUser('therapist'); const person = await mkUser('user', { therapistId: linked.id });
    const withData = await mkUser('therapist'); await seed('Consents', 'UserId', withData.id, patient.id);
    for (const target of [withNotes, linked, withData]) {
      const out = await http(sup, 'DELETE', `/api/admin/usuarios/${target.id}`);
      assert.equal(out.status, 409, `${target.id}: ${out.status} ${JSON.stringify(out.body)}`); assert.equal(out.body.code, 'has_dependent_data');
      assert.match(out.body.error, /No se puede eliminar.*It cannot be deleted/s);
      assert.equal((await q('SELECT count(*)::int n FROM "Users" WHERE id=$1', [target.id]))[0].n, 1);
    }
    assert.equal((await q('SELECT "therapistId" FROM "Users" WHERE id=$1', [person.id]))[0].therapistId, linked.id, 'el vínculo de la persona no se rompió');
    const clean = await mkUser('therapist'); const board = await mkUser('board');
    const inv = (await q(`INSERT INTO "Invitations" (email, role, "invitedBy", "tokenHash", locale, "expiresAt", "acceptedUserId", "createdAt", "updatedAt") VALUES ($1,'therapist',$2,$3,'es',now() + interval '1 day',$4,now(),now()) RETURNING id`, [`inv-${dbName}@example.test`, sup.id, crypto.randomBytes(16).toString('hex'), clean.id]))[0].id;
    for (const target of [clean, board]) {
      const before = (await audit()).length;
      const out = await http(sup, 'DELETE', `/api/admin/usuarios/${target.id}`);
      assert.equal(out.status, 200, JSON.stringify(out.body)); assert.equal(out.body.code, 'deleted');
      assert.equal((await q('SELECT count(*)::int n FROM "Users" WHERE id=$1', [target.id]))[0].n, 0);
      assert.deepEqual((await audit()).slice(before).map((e) => [e.action, e.targetId]), [['user.delete', target.id]]);
    }
    assert.equal((await q('SELECT "acceptedUserId" FROM "Invitations" WHERE id=$1', [inv]))[0].acceptedUserId, null, 'la invitación aceptada se desvincula');
  });

  await t.test('reglas que siguen: admin recibe 403 (y queda denied), nadie se elimina a sí mismo, un superadmin no se elimina, id inexistente 404', async () => {
    const victim = await mkUser('user'); const before = (await audit()).length;
    assert.equal((await http(adm, 'DELETE', `/api/admin/usuarios/${victim.id}`)).status, 403);
    assert.equal((await http(sup, 'DELETE', `/api/admin/usuarios/${sup.id}`)).status, 403);
    assert.equal((await http(sup, 'DELETE', `/api/admin/usuarios/${adm.id}`)).status, 200); // una cuenta de administración sin dependencias sí se elimina
    const other = await mkUser('superadmin');
    assert.equal((await http(sup, 'DELETE', `/api/admin/usuarios/${other.id}`)).status, 403);
    assert.equal((await http(sup, 'DELETE', '/api/admin/usuarios/99999999')).status, 404);
    assert.equal((await q('SELECT active FROM "Users" WHERE id=$1', [victim.id]))[0].active, true);
    assert.deepEqual((await audit()).slice(before).map((e) => [e.action, e.result]), [['user.delete', 'denied'], ['user.delete', 'ok']]);
  });

  await t.test('ES-186 D0: el listado marca deletionRequested (solo un booleano) en la cuenta con eliminación solicitada y en ninguna otra; conserva lockedUntil, plan y profesional', async () => {
    const requested = await mkUser('user'); const plain = await mkUser('user');
    const before = await http(sup, 'GET', '/api/admin/usuarios');
    assert.equal(before.status, 200);
    const beforeById = new Map(before.body.map((u) => [u.id, u]));
    assert.deepEqual([beforeById.get(requested.id).deletionRequested, beforeById.get(plain.id).deletionRequested], [false, false], 'ninguna de las dos la tiene antes de pedirla');
    assert.ok(before.body.every((u) => typeof u.deletionRequested === 'boolean'));
    assert.equal((await http(sup, 'DELETE', `/api/admin/usuarios/${requested.id}`)).status, 202);
    const after = await http(sup, 'GET', '/api/admin/usuarios');
    const byId = new Map(after.body.map((u) => [u.id, u]));
    assert.equal(byId.get(requested.id).deletionRequested, true);
    assert.equal(byId.get(plain.id).deletionRequested, false);
    assert.equal(after.body.filter((u) => u.deletionRequested).every((u) => typeof u.deletionRequested === 'boolean'), true);
    for (const key of ['lockedUntil', 'isLocked', 'plan', 'therapistId', 'active']) assert.ok(Object.hasOwn(byId.get(plain.id), key), key);
    assert.equal(JSON.stringify(after.body).includes('DeletionRequest'), false, 'sin estado ni identificadores de la solicitud');
    const freshAdmin = await mkUser('admin'); // (la cuenta adm de casos anteriores ya se eliminó)
    assert.equal((await http(freshAdmin, 'GET', '/api/admin/usuarios')).status, 200); // misma guarda de siempre
  });

  await t.test('contrato con la pantalla: respuestas reales de eliminar (202, repetida, 409 y 200) y un elemento del listado con deletionRequested', async () => {
    const person = await mkUser('user');
    const requested = await http(sup, 'DELETE', `/api/admin/usuarios/${person.id}`);
    assert.equal(requested.status, 202); contractFixture('es-186-delete-requested.json', requested.status, requested.body);
    const repeated = await http(sup, 'DELETE', `/api/admin/usuarios/${person.id}`);
    assert.equal(repeated.status, 202); assert.equal(repeated.body.repeated, true); contractFixture('es-186-delete-repeated.json', repeated.status, repeated.body);
    const patient = await mkUser('user'); const withNotes = await mkUser('therapist');
    await seed('ClinicalNotes', 'therapistId', withNotes.id, patient.id);
    const blocked = await http(sup, 'DELETE', `/api/admin/usuarios/${withNotes.id}`);
    assert.equal(blocked.status, 409); assert.equal(blocked.body.code, 'has_dependent_data'); contractFixture('es-186-delete-blocked.json', blocked.status, blocked.body);
    const clean = await mkUser('therapist');
    const deleted = await http(sup, 'DELETE', `/api/admin/usuarios/${clean.id}`);
    assert.equal(deleted.status, 200); assert.equal(deleted.body.code, 'deleted'); contractFixture('es-186-delete-deleted.json', deleted.status, deleted.body);
    const list = await http(sup, 'GET', '/api/admin/usuarios');
    const item = list.body.find((u) => u.id === person.id);
    assert.equal(item.deletionRequested, true);
    contractFixture('es-186-user-list.json', list.status, [item]);
    const someAdmin = await mkUser('admin'); // (la cuenta adm de casos anteriores ya se eliminó)
    const reset = await http(someAdmin, 'POST', `/api/admin/usuarios/${patient.id}/reset-link`, {});
    assert.equal(reset.status, 403); assert.equal(reset.body.code, 'superadmin_only'); contractFixture('es-186-reset-link-superadmin-only.json', reset.status, reset.body);
  });
});
