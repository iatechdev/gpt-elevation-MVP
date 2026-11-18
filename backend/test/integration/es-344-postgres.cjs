// ES-344 contra Postgres REAL: aprobar y rechazar A LA VEZ la misma versión de una guía tiene UN solo ganador y nunca deja status='rejected' con
// isActive=true; getActivePrompt (lo que lee el chat) nunca devuelve texto no aprobado; la migración limpia filas inconsistentes sin borrar nada.
// Rutas y vault REALES (dos superadmin); sin llamadas a Claude. Crea y borra SOLO su propia base aleatoria en un servidor de loopback. Nunca carga .env ni usa DATABASE_URL.
// Uso (en backend/):  ES344_TEST_DATABASE_URL=postgres://elevation:elevation_local@127.0.0.1:54329/postgres npm run test:prompt-race:pg
//   ES344_ROUNDS=60 (por defecto) = intentos simultáneos aprobar+rechazar.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { once } = require('node:events');
const express = require('express');
const { Sequelize } = require('sequelize');

test('ES-344 PostgreSQL: aprobar+rechazar simultáneos tienen un solo ganador y el chat nunca sirve texto rechazado', { timeout: 280000 }, async (t) => {
  const source = process.env.ES344_TEST_DATABASE_URL;
  assert.ok(source, 'ES344_TEST_DATABASE_URL debe apuntar a un PostgreSQL local desechable.');
  const target = new URL(source);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname), 'Solo se permite PostgreSQL en loopback.');
  const rounds = Number(process.env.ES344_ROUNDS || 60);
  assert.ok(rounds >= 50, 'el criterio pide al menos 50 intentos');
  const dbName = `es344_test_${randomBytes(8).toString('hex')}`;
  assert.match(dbName, /^es344_test_[a-f0-9]{16}$/);
  const admin = new Sequelize(source, { logging: false, dialectOptions: { ssl: false } });
  let sequelize; let created = false; let server;
  t.after(async () => {
    if (server) { server.close(); server.closeAllConnections(); }
    if (sequelize) await sequelize.close();
    if (created) await admin.query(`DROP DATABASE "${dbName}"`); // dbName lo genera este archivo, nunca viene de fuera
    await admin.close();
  });
  await admin.query(`CREATE DATABASE "${dbName}"`);
  created = true;
  target.pathname = '/' + dbName;
  sequelize = new Sequelize(target.toString(), { logging: false, dialectOptions: { ssl: false }, pool: { max: 20, min: 0, acquire: 20000 } });
  process.env.JWT_SECRET = randomBytes(32).toString('hex');
  process.env.PROMPT_ENCRYPTION_KEY = randomBytes(32).toString('hex');
  process.env.PROMPT_PROPOSALS_PER_HOUR = '1000';
  const dbModule = require.resolve('../../database');
  require.cache[dbModule] = { id: dbModule, filename: dbModule, loaded: true, exports: { sequelize } };

  const User = require('../../User');
  const DeletionRequest = require('../../DeletionRequest');
  const AuthRevocation = require('../../AuthRevocation');
  const RevokedToken = require('../../RevokedToken');
  await require('../../PricingPlan').sync();
  await Promise.all([User, DeletionRequest, AuthRevocation, RevokedToken].map((model) => model.sync()));
  const { PromptVault, getActivePrompt, encryptPrompt } = require('../../promptVault');
  await PromptVault.sync(); // con los índices únicos (clave, versión) y una activa por clave, como en producción (ES-219)
  await require('../../migrations/20261107000000-es191-prompt-review.cjs').up(sequelize); // tabla de reglas y reglas iniciales (la revisión automática falla cerrada sin ellas)
  const migration = require('../../migrations/20261118010000-es344-prompt-isactive-consistency.cjs');

  const { issueToken } = require('../../utils/sessions');
  const { verificarAdmin, verificarSuperAdmin } = require('../../middlewares/auth');
  const app = express(); app.use(express.json());
  app.use('/api/admin', verificarAdmin, require('../../routes/adminPrompts'));
  app.use('/api/superadmin', verificarSuperAdmin, require('../../routes/adminPrompts'));
  server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  const person = (role, name) => User.create({ name, email: `${name.toLowerCase()}@example.invalid`, password: 'x', role });
  const [adm, sup1, sup2] = [await person('admin', 'Adm'), await person('superadmin', 'SupUno'), await person('superadmin', 'SupDos')];
  const tokens = new Map();
  const tokenFor = (p) => { if (!tokens.has(p.id)) tokens.set(p.id, issueToken(p)); return tokens.get(p.id); };
  const call = async (p, method, path, body) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}${path}`, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenFor(p)}` }, body: body === undefined ? undefined : JSON.stringify(body) });
    const text = await response.text();
    let json = null; try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text.slice(0, 80) }; }
    return { status: response.status, body: json };
  };
  const GOOD = 'Acompaña a la persona con calma y respeto, sin presionarla, y ayúdala a nombrar lo que ya hace bien. Haz una pregunta a la vez.';
  const BASE = `${GOOD} Texto base aprobado.`;
  const proposedText = (i) => `${GOOD} Texto propuesto número ${i}.`;
  const rowsOf = (key) => sequelize.query('SELECT "id","version","status","isActive" FROM "PromptVaults" WHERE "key" = :key ORDER BY "version"', { type: 'SELECT', replacements: { key } });
  const NOTE = { note: 'No corresponde a esta guía.' };

  await t.test(`${rounds} intentos: aprobar (Sup1) y rechazar (Sup2) la MISMA versión a la vez → un solo ganador, nunca rejected+isActive, el chat nunca sirve el texto rechazado`, async () => {
    const outcomes = { approvedWon: 0, rejectedWon: 0 };
    for (let i = 0; i < rounds; i++) {
      const key = `guia_carrera_${i}`;
      assert.equal((await call(sup1, 'POST', '/api/superadmin/prompt/create', { key, content: BASE })).status, 200);
      const proposal = await call(adm, 'POST', '/api/admin/prompt/propose', { key, content: proposedText(i) });
      assert.equal(proposal.status, 200, JSON.stringify(proposal.body));
      const id = (await rowsOf(key)).find((r) => r.status === 'pending_review').id;
      const [approve, reject] = await Promise.all([
        call(sup1, 'POST', `/api/superadmin/prompt/${id}/approve`),
        call(sup2, 'POST', `/api/superadmin/prompt/${id}/reject`, NOTE),
      ]);
      const statuses = [approve.status, reject.status].sort();
      assert.deepEqual(statuses, [200, 409], `ronda ${i}: debe ganar UNO solo y el otro recibir 409 estable; fue aprobar=${approve.status} rechazar=${reject.status}`);
      const after = await rowsOf(key);
      assert.ok(!after.some((r) => r.status !== 'active' && r.isActive), `ronda ${i}: quedó una fila no activa marcada isActive=true: ${JSON.stringify(after)}`);
      assert.equal(after.filter((r) => r.status === 'active').length, 1, `ronda ${i}: debe haber exactamente una activa: ${JSON.stringify(after)}`);
      const served = await getActivePrompt(key);
      if (approve.status === 200) { outcomes.approvedWon++; assert.equal(served, proposedText(i), `ronda ${i}: ganó aprobar; el chat debe servir el texto aprobado`); }
      else { outcomes.rejectedWon++; assert.equal(served, BASE, `ronda ${i}: ganó rechazar; el chat debe seguir sirviendo el texto base, no el rechazado`); }
      assert.notEqual(after.find((r) => r.status === 'rejected')?.isActive ?? false, true);
    }
    console.log(`ES-344: ${rounds} rondas · aprobar ganó ${outcomes.approvedWon} · rechazar ganó ${outcomes.rejectedWon}`);
  });

  await t.test('dos rechazos o dos aprobaciones simultáneos de la misma versión: un solo 200', async () => {
    for (const action of ['reject', 'approve']) for (let i = 0; i < 20; i++) {
      const key = `guia_doble_${action}_${i}`;
      await call(sup1, 'POST', '/api/superadmin/prompt/create', { key, content: BASE });
      await call(adm, 'POST', '/api/admin/prompt/propose', { key, content: proposedText(i) });
      const id = (await rowsOf(key)).find((r) => r.status === 'pending_review').id;
      const results = await Promise.all([sup1, sup2].map((p) => call(p, 'POST', `/api/superadmin/prompt/${id}/${action}`, action === 'reject' ? NOTE : undefined)));
      assert.deepEqual(results.map((r) => r.status).sort(), [200, 409], `${action} ${i}: ${JSON.stringify(results.map((r) => r.status))}`);
      const after = await rowsOf(key);
      assert.equal(after.filter((r) => r.status === 'active').length, 1);
      assert.ok(!after.some((r) => r.status !== 'active' && r.isActive));
    }
  });

  await t.test('aprobar una versión mientras otra persona vuelve (rollback) a una anterior: una sola activa y ninguna fila inconsistente', async () => {
    for (let i = 0; i < 20; i++) {
      const key = `guia_rollback_${i}`;
      await call(sup1, 'POST', '/api/superadmin/prompt/create', { key, content: BASE });
      await call(sup1, 'POST', '/api/superadmin/prompt/publish', { key, content: proposedText(1000 + i) }); // v2 activa, v1 archivada
      await call(adm, 'POST', '/api/admin/prompt/propose', { key, content: proposedText(2000 + i) }); // v3 pendiente
      const all = await rowsOf(key);
      const pending = all.find((r) => r.status === 'pending_review').id; const archived = all.find((r) => r.status === 'approved').id;
      await Promise.all([call(sup1, 'POST', `/api/superadmin/prompt/${pending}/approve`), call(sup2, 'POST', `/api/superadmin/prompt/${archived}/rollback`)]);
      const after = await rowsOf(key);
      assert.equal(after.filter((r) => r.status === 'active').length, 1, JSON.stringify(after));
      assert.ok(!after.some((r) => r.status !== 'active' && r.isActive), JSON.stringify(after));
      assert.ok(await getActivePrompt(key));
    }
  });

  await t.test('roles: admin no aprueba ni rechaza (403) y no cambia nada', async () => {
    const key = 'guia_roles';
    await call(sup1, 'POST', '/api/superadmin/prompt/create', { key, content: BASE });
    await call(adm, 'POST', '/api/admin/prompt/propose', { key, content: proposedText(1) });
    const id = (await rowsOf(key)).find((r) => r.status === 'pending_review').id;
    assert.equal((await call(adm, 'POST', `/api/superadmin/prompt/${id}/approve`)).status, 403);
    assert.equal((await call(adm, 'POST', `/api/superadmin/prompt/${id}/reject`, NOTE)).status, 403);
    assert.equal((await rowsOf(key)).find((r) => r.id === id).status, 'pending_review');
  });

  await t.test('getActivePrompt no sirve nada sin una versión status=active (ni por isActive=true)', async () => {
    await sequelize.query(`INSERT INTO "PromptVaults" ("key","contentEncrypted","version","status","isActive","createdAt","updatedAt") VALUES ('guia_huerfana',:c,2,'rejected',true,now(),now())`, { replacements: { c: encryptPrompt('Texto rechazado que no debe servirse.') } });
    assert.equal(await getActivePrompt('guia_huerfana'), null);
  });

  await t.test('la migración limpia filas inconsistentes sin borrar nada, no toca la activa y es idempotente', async () => {
    const insert = (key, version, status, isActive) => sequelize.query(`INSERT INTO "PromptVaults" ("key","contentEncrypted","version","status","isActive","createdAt","updatedAt") VALUES (:key,:c,:version,:status,:isActive,now(),now())`,
      { replacements: { key, c: encryptPrompt(BASE), version, status, isActive } });
    await insert('guia_mig', 1, 'active', true); await insert('guia_mig', 2, 'rejected', true); await insert('guia_mig', 3, 'approved', true); await insert('guia_mig', 4, 'pending_review', true); await insert('guia_mig', 5, 'archived', false);
    const count = async () => (await sequelize.query('SELECT count(*)::int AS n FROM "PromptVaults"', { type: 'SELECT' }))[0].n;
    const before = await count();
    const found = (await migration.findInconsistent(sequelize)).filter((r) => r.key === 'guia_mig');
    assert.deepEqual(found.map((r) => r.version), [2, 3, 4]);
    assert.ok(!JSON.stringify(found).includes('contentEncrypted'), 'el informe no lleva el texto');
    const changed = await migration.up(sequelize);
    assert.ok(changed >= 3, `cambió ${changed}`);
    assert.equal(await count(), before, 'no se borró ninguna fila');
    const after = await rowsOf('guia_mig');
    assert.deepEqual(after.map((r) => [r.version, r.status, r.isActive]), [[1, 'active', true], [2, 'rejected', false], [3, 'approved', false], [4, 'pending_review', false], [5, 'archived', false]]);
    assert.equal(await migration.up(sequelize), 0, 'idempotente');
    assert.equal((await migration.findInconsistent(sequelize)).length, 0);
    assert.equal(await getActivePrompt('guia_mig'), BASE);
  });
});
