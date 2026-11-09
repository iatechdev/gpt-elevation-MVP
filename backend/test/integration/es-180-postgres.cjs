// ES-180 (HU-P29) contra Postgres REAL: métricas y avisos de administración. Cifras coherentes con la base (se comparan con un cálculo independiente en
// JavaScript), 30 días siempre completos (cero = 0, en zona Bogotá), «null» cuando no hay datos, avisos con falla parcial (cada uno con su estado),
// manifiesto real (no escrito a mano), solo admin y superadmin, y rendimiento con ~10.000 registros. Sin llamadas a Claude.
// Crea y borra SOLO su propia base aleatoria en un servidor de loopback. Nunca carga .env ni usa DATABASE_URL.
// Uso (en backend/):  ES180_TEST_DATABASE_URL=postgres://elevation:elevation_local@127.0.0.1:54329/postgres npm run test:admin-metrics:pg
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { once } = require('node:events');
const express = require('express');
const { Sequelize } = require('sequelize');

test('ES-180 PostgreSQL: métricas y avisos de administración', { timeout: 300000 }, async (t) => {
  const source = process.env.ES180_TEST_DATABASE_URL;
  assert.ok(source, 'ES180_TEST_DATABASE_URL debe apuntar a un PostgreSQL local desechable.');
  const target = new URL(source);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname), 'Solo se permite PostgreSQL en loopback.');
  const dbName = `es180_test_${randomBytes(8).toString('hex')}`;
  assert.match(dbName, /^es180_test_[a-f0-9]{16}$/);
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
  sequelize = new Sequelize(target.toString(), { logging: false, dialectOptions: { ssl: false }, pool: { max: 12, min: 0, acquire: 20000 } });
  process.env.JWT_SECRET = randomBytes(32).toString('hex');
  process.env.PROMPT_ENCRYPTION_KEY = randomBytes(32).toString('hex');
  const dbModule = require.resolve('../../database');
  require.cache[dbModule] = { id: dbModule, filename: dbModule, loaded: true, exports: { sequelize } };

  const User = require('../../User');
  const MoodLog = require('../../MoodLog');
  const SessionRating = require('../../SessionRating');
  const TherapistProfile = require('../../TherapistProfile');
  const EthicManifest = require('../../EthicManifest');
  const { PromptVault, encryptPrompt } = require('../../promptVault');
  const DeletionRequest = require('../../DeletionRequest');
  const AuthRevocation = require('../../AuthRevocation');
  const RevokedToken = require('../../RevokedToken');
  await require('../../PricingPlan').sync();
  await Promise.all([User, DeletionRequest, AuthRevocation, RevokedToken].map((model) => model.sync()));
  await Promise.all([MoodLog, SessionRating, TherapistProfile, EthicManifest, PromptVault].map((model) => model.sync()));
  const { issueToken } = require('../../utils/sessions');
  const { verificarAdmin } = require('../../middlewares/auth');
  const app = express(); app.use(express.json());
  app.use('/api/admin/metrics', verificarAdmin, require('../../routes/adminMetrics'));
  app.use('/api/admin/usuarios', verificarAdmin, require('../../routes/adminUsers'));
  server = app.listen(0, '127.0.0.1'); await once(server, 'listening');

  const person = (role, name, extra = {}) => User.create({ name, email: `${name.toLowerCase()}@example.invalid`, password: 'x', role, ...extra });
  const tokens = new Map();
  const tokenFor = (who) => { if (!tokens.has(who.id)) tokens.set(who.id, issueToken(who)); return tokens.get(who.id); };
  const call = async (who, path) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}${path}`, { headers: who ? { Authorization: `Bearer ${tokenFor(who)}` } : {} });
    const text = await response.text();
    let json = null; try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text.slice(0, 80) }; }
    return { status: response.status, body: json, headers: response.headers };
  };
  const [adm, sup, pro, plain, board] = [await person('admin', 'Adm'), await person('superadmin', 'Sup'), await person('therapist', 'Pro'), await person('user', 'Persona0'), await person('board', 'Junta')];

  // La fecha de «hoy» en Bogotá, como la calcula el servidor (el cálculo independiente de esta prueba).
  const bogotaToday = () => new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Bogota' }));
  const isoDay = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const dayOffset = (n) => { const d = bogotaToday(); d.setDate(d.getDate() - n); return isoDay(d); };
  const round1 = (x) => Math.round(x * 10) / 10;

  await t.test('sin datos: todo en cero o «null» (nunca cero inventado), 30 días completos y sin errores', async () => {
    const r = await call(sup, '/api/admin/metrics');
    assert.equal(r.status, 200); assert.match(r.headers.get('cache-control'), /no-store/);
    const m = r.body;
    assert.equal(m.totalUsers, 1); assert.equal(m.activeUsers, 1); assert.equal(m.totalTherapists, 1); assert.equal(m.totalSessions, 0);
    assert.equal(m.avgMood, null); assert.equal(m.avgRating, null); assert.equal(m.activeThisWeek, 0);
    assert.equal(m.days30.length, 30); assert.ok(m.days30.every((d) => d.count === 0)); assert.deepEqual(m.sessionsByDay, []);
    assert.equal(m.total30, 0); assert.equal(m.max30, null); assert.equal(m.dailyAverage30, 0);
    assert.deepEqual(m.range, { start: dayOffset(29), end: dayOffset(0), timeZone: 'America/Bogota' });
    assert.deepEqual(m.topTherapists.map((x) => [x.name, x.patientCount, x.avgRating]), [['Pro', 0, null]]);
  });

  // ~10.000 registros de ánimo: 330 personas × 40 días, con profesionales, valoraciones y días en cero.
  const people = []; const therapists = [pro];
  for (let i = 0; i < 4; i += 1) therapists.push(await person('therapist', `Pro${i + 1}`));
  await User.bulkCreate(Array.from({ length: 330 }, (_, i) => ({ name: `Persona${i + 1}`, email: `persona${i + 1}@example.invalid`, password: 'x', role: 'user', active: i % 10 !== 0, therapistId: i % 3 === 0 ? therapists[i % 5].id : null })));
  const all = await User.findAll({ where: { role: 'user' }, attributes: ['id'], order: [['id', 'ASC']] });
  people.push(...all);
  const logs = [];
  for (const [i, p] of people.entries()) {
    for (let d = 0; d < 40; d += 1) {
      if ((i * 7 + d * 3) % 5 === 0) continue; // huecos
      if (d === 4 || d === 11) continue; // dos días SIN registros para ninguna persona (cero en la gráfica)
      logs.push({ UserId: p.id, date: dayOffset(d), checkin_mood: 1 + ((i + d) % 5), checkout_mood: (i + d) % 4 === 0 ? null : 1 + ((i * 3 + d) % 5) });
    }
  }
  await MoodLog.bulkCreate(logs);
  const ratings = people.slice(0, 120).map((p, i) => ({ UserId: p.id, date: dayOffset(i % 20), rating: i % 9 === 0 ? null : 1 + (i % 5) }));
  await SessionRating.bulkCreate(ratings);

  await t.test('las cifras coinciden con un cálculo independiente sobre la misma base (7 cifras, 30 días, profesionales)', async () => {
    const m = (await call(adm, '/api/admin/metrics')).body;
    const dbUsers = await User.findAll({ raw: true });
    assert.equal(m.totalUsers, dbUsers.filter((u) => u.role === 'user').length);
    assert.equal(m.activeUsers, dbUsers.filter((u) => u.role === 'user' && u.active).length);
    assert.equal(m.totalTherapists, dbUsers.filter((u) => u.role === 'therapist' && u.active).length);
    const dbLogs = await MoodLog.findAll({ raw: true });
    assert.equal(m.totalSessions, dbLogs.length); assert.ok(dbLogs.length > 9000, `${dbLogs.length} registros`);
    const moods = dbLogs.flatMap((l) => [l.checkin_mood, l.checkout_mood]).filter(Boolean);
    assert.equal(m.avgMood, round1(moods.reduce((a, b) => a + b, 0) / moods.length));
    const rated = (await SessionRating.findAll({ raw: true })).map((r) => r.rating).filter((x) => x !== null);
    assert.equal(m.avgRating, round1(rated.reduce((a, b) => a + b, 0) / rated.length));
    const weekStart = dayOffset(7);
    assert.equal(m.activeThisWeek, new Set(dbLogs.filter((l) => l.date >= weekStart).map((l) => l.UserId)).size);
    // 30 días completos, en orden, con ceros reales
    assert.equal(m.days30.length, 30); assert.equal(m.days30[0].date, dayOffset(29)); assert.equal(m.days30[29].date, dayOffset(0));
    for (const day of m.days30) assert.equal(day.count, dbLogs.filter((l) => l.date === day.date).length, day.date);
    assert.equal(m.days30.find((d) => d.date === dayOffset(4)).count, 0); assert.equal(m.days30.find((d) => d.date === dayOffset(11)).count, 0);
    assert.deepEqual(m.sessionsByDay, m.days30.filter((d) => d.count > 0), 'sessionsByDay conserva solo los días con registros (pantalla actual)');
    assert.equal(m.total30, m.days30.reduce((n, d) => n + d.count, 0));
    assert.equal(m.max30.count, Math.max(...m.days30.map((d) => d.count)));
    assert.equal(m.dailyAverage30, round1(m.total30 / 30));
    // profesionales con más personas (hasta 5), orden por personas y nombre; valoración null si no hay datos
    const expected = therapists.map((th) => {
      const mine = dbUsers.filter((u) => u.therapistId === th.id && u.role === 'user').map((u) => u.id);
      return { id: th.id, name: th.name, patientCount: mine.length, mine };
    });
    const dbRatings = await SessionRating.findAll({ raw: true });
    for (const e of expected) {
      const own = dbRatings.filter((r) => e.mine.includes(r.UserId) && r.rating !== null).map((r) => r.rating);
      e.avgRating = own.length ? round1(own.reduce((a, b) => a + b, 0) / own.length) : null;
    }
    expected.sort((a, b) => b.patientCount - a.patientCount || a.name.localeCompare(b.name) || a.id - b.id);
    assert.deepEqual(m.topTherapists.map((x) => [x.id, x.patientCount, x.avgRating]), expected.slice(0, 5).map((e) => [e.id, e.patientCount, e.avgRating]));
  });

  await t.test('rendimiento: p95 < 500 ms con ~10.000 registros (umbral propuesto) y consultas constantes', async () => {
    const samples = [];
    for (let i = 0; i < 15; i += 1) { const t0 = process.hrtime.bigint(); const r = await call(adm, '/api/admin/metrics'); samples.push(Number(process.hrtime.bigint() - t0) / 1e6); assert.equal(r.status, 200); }
    samples.sort((a, b) => a - b);
    const p95 = samples[Math.ceil(samples.length * 0.95) - 1];
    console.log(`ES-180 /api/admin/metrics con ${await MoodLog.count()} registros: p50=${samples[7].toFixed(0)}ms p95=${p95.toFixed(0)}ms`);
    assert.ok(p95 < 500, `p95 ${p95.toFixed(0)} ms`);
    let n = 0; const previous = sequelize.options.logging; sequelize.options.logging = () => { n += 1; };
    try { await call(adm, '/api/admin/metrics'); } finally { sequelize.options.logging = previous; }
    assert.ok(n <= 12, `${n} consultas (constantes; antes 2 o 3 por profesional)`);
  });

  await t.test('solo admin y superadmin; sin sesión, persona, profesional y junta se rechazan', async () => {
    for (const who of [plain, pro, board]) for (const path of ['/api/admin/metrics', '/api/admin/usuarios/alerts']) assert.equal((await call(who, path)).status, 403, `${who.role} ${path}`);
    for (const path of ['/api/admin/metrics', '/api/admin/usuarios/alerts']) assert.ok([401, 403].includes((await call(null, path)).status));
    assert.equal((await call(adm, '/api/admin/metrics')).status, 200); assert.equal((await call(sup, '/api/admin/usuarios/alerts')).status, 200);
  });

  await t.test('avisos: sin guías ni manifiesto devuelven ceros y null con estado ok; el manifiesto sale del activo, no de un valor escrito', async () => {
    let r = (await call(adm, '/api/admin/usuarios/alerts')).body;
    assert.deepEqual(Object.values(r.sections).map((s) => s.status), ['ok', 'ok', 'ok']);
    assert.equal(r.sections.guides.count, 0); assert.deepEqual(r.sections.guides.items, []);
    assert.equal(r.sections.manifest.version, null); assert.equal(r.sections.manifest.date, null); assert.equal(r.manifestoVersion, null);
    const uploader = sup.id;
    await EthicManifest.create({ content: 'x', version: 'v1', isActive: false, uploadedBy: uploader });
    const active = await EthicManifest.create({ content: 'y', version: 'v2', isActive: true, uploadedBy: uploader });
    r = (await call(adm, '/api/admin/usuarios/alerts')).body;
    assert.equal(r.sections.manifest.version, 'v2'); assert.equal(r.sections.manifest.date, active.createdAt.toISOString().slice(0, 10));
    assert.equal(r.manifestoVersion, 'v2'); assert.notEqual(r.manifestoVersion, 'v1.0'); assert.notEqual(r.manifestoDate, '2026-04-02');
  });

  await t.test('avisos: la cuenta de guías es real (no topa en 5), perfiles incompletos se cuentan bien y rechazadas por la revisión no cuentan', async () => {
    const content = encryptPrompt('Texto sintético de la guía.');
    const row = (key, version, status, proposedBy) => ({ key, version, status, isActive: false, proposed_by: proposedBy, contentEncrypted: content, createdAt: new Date(), updatedAt: new Date() });
    await PromptVault.bulkCreate([
      ...Array.from({ length: 7 }, (_, i) => row(`therapist_prompt_${pro.id}`, 10 + i, 'pending_review', 'pro@example.invalid')),
      row('guia_global', 2, 'pending_review', 'admin@example.invalid'), row('guia_global', 3, 'rejected', 'admin@example.invalid'), row('guia_global', 4, 'active', 'admin@example.invalid'),
    ]);
    const r = (await call(adm, '/api/admin/usuarios/alerts')).body;
    assert.equal(r.sections.guides.count, 8); assert.equal(r.pendingPrompts, 8);
    assert.equal(r.sections.guides.items.length, 5); assert.equal(r.pendingPromptsList.length, 5);
    assert.ok(r.sections.guides.items.every((i) => !i.key.endsWith('x')) && r.sections.guides.items.some((i) => i.therapistName === 'Pro'));
    // perfiles: 5 profesionales activos sin perfil → 5; con perfil completo → baja; biografía vacía o sin especialidades siguen contando
    assert.equal(r.sections.professionalsIncomplete.count, 5); assert.equal(r.therapistsWithoutProfile, 5);
    await TherapistProfile.create({ UserId: therapists[1].id, bio: 'Biografía', specialties: ['ansiedad'] });
    await TherapistProfile.create({ UserId: therapists[2].id, bio: '   ', specialties: ['ansiedad'] });
    await TherapistProfile.create({ UserId: therapists[3].id, bio: 'Biografía', specialties: [] });
    const r2 = (await call(adm, '/api/admin/usuarios/alerts')).body;
    assert.equal(r2.sections.professionalsIncomplete.count, 4, 'solo el perfil completo deja de contar');
    await User.update({ active: false }, { where: { id: therapists[4].id } });
    assert.equal((await call(adm, '/api/admin/usuarios/alerts')).body.sections.professionalsIncomplete.count, 3, 'una profesional inactiva no cuenta');
  });

  await t.test('falla parcial: si un aviso falla los demás se entregan y el que falló lleva estado «error» (la pantalla reintenta solo ese)', async () => {
    await sequelize.query('ALTER TABLE "TherapistProfiles" RENAME TO "TherapistProfiles_x"');
    try {
      const response = await call(adm, '/api/admin/usuarios/alerts');
      assert.equal(response.status, 200);
      const r = response.body;
      assert.deepEqual(r.sections.professionalsIncomplete, { status: 'error' });
      assert.equal(r.sections.guides.status, 'ok'); assert.equal(r.sections.manifest.status, 'ok');
      assert.equal(r.therapistsWithoutProfile, null); assert.equal(r.manifestoVersion, 'v2');
      assert.ok(!JSON.stringify(r).match(/relation|TherapistProfiles|SELECT/i), 'sin detalles internos');
    } finally {
      await sequelize.query('ALTER TABLE "TherapistProfiles_x" RENAME TO "TherapistProfiles"');
    }
    assert.equal((await call(adm, '/api/admin/usuarios/alerts')).body.sections.professionalsIncomplete.status, 'ok');
  });
});
