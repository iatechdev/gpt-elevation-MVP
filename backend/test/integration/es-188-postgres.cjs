// ES-188 contra Postgres REAL: catálogo de habilidades. (H1) no se publica una versión que omita una habilidad con niveles registrados o propuestas por confirmar
// (409 `skill_in_use`, por habilidad y número de personas, sin identificarlas); (H2) edición concurrente de la misma habilidad (`expectedUpdatedAt` → 409 `skill_changed`).
// Crea y borra SOLO su propia base aleatoria en un servidor de loopback. Nunca carga .env ni usa DATABASE_URL. Datos SINTÉTICOS.
// Uso (en backend/):  ES188_TEST_DATABASE_URL=postgres://elevation:elevation_local@127.0.0.1:54329/postgres npm run test:skillcatalog:pg
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { Sequelize } = require('sequelize');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

test('ES-188 PostgreSQL: publicar sin una habilidad en uso y edición concurrente por habilidad', { timeout: 90000 }, async (t) => {
  const source = process.env.ES188_TEST_DATABASE_URL;
  assert.ok(source, 'ES188_TEST_DATABASE_URL debe apuntar a un PostgreSQL local desechable.');
  const target = new URL(source);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname), 'Solo se permite PostgreSQL en loopback.');
  const dbName = `es188_test_${randomBytes(8).toString('hex')}`;
  assert.match(dbName, /^es188_test_[a-f0-9]{16}$/);
  const admin = new Sequelize(source, { logging: false, dialectOptions: { ssl: false } });
  let sequelize;
  let server;
  let created = false;
  t.after(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (sequelize) await sequelize.close();
    if (created) await admin.query(`DROP DATABASE "${dbName}"`); // dbName lo genera este archivo, nunca viene de fuera
    await admin.close();
  });
  await admin.query(`CREATE DATABASE "${dbName}"`);
  created = true;
  target.pathname = '/' + dbName;
  sequelize = new Sequelize(target.toString(), { logging: false, dialectOptions: { ssl: false }, pool: { max: 12, min: 0 } });
  process.env.JWT_SECRET = randomBytes(32).toString('hex');
  process.env.DATA_ENCRYPTION_KEY = randomBytes(32).toString('hex');
  const dbModule = require.resolve('../../database');
  require.cache[dbModule] = { id: dbModule, filename: dbModule, loaded: true, exports: { sequelize } };

  const Catalog = require('../../SkillCatalog');
  const Definition = require('../../SkillDefinition');
  const Assessment = require('../../SkillAssessment');
  const Candidate = require('../../SkillCandidate');
  require('../../PricingPlan'); require('../../AiJob');
  const User = require('../../User');
  await sequelize.sync();
  const catalog = require('../../utils/skillCatalog');
  const express = require('express');
  const app = express();
  app.use(express.json());
  app.use('/api/admin/skill-catalog', (req, res, next) => { req.user = { id: 1, role: 'admin' }; next(); }, require('../../routes/skillCatalog'));
  await new Promise((resolve) => { server = app.listen(0, '127.0.0.1', resolve); });
  const base = `http://127.0.0.1:${server.address().port}/api/admin/skill-catalog`;
  const call = async (method, path, body) => {
    const res = await fetch(base + path, { method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: res.status, body: await res.json().catch(() => null) };
  };

  const levels = Object.fromEntries([1, 2, 3, 4].map((n) => [n, { es: `nivel ${n}`, en: `level ${n}` }]));
  const def = (name) => ({ type: 'transversal', labels: { es: name, en: name }, rubric: { levels, source: 'Fuente sintética', verifiedBy: 'Revisor sintético', verifiedAt: '2026-10-01' }, territories: ['dir'] });
  const mkUser = (n) => User.create({ name: `Sintético ${n}`, email: `es188-${n}@example.test`, password: 'x'.repeat(12), role: 'user' });
  let seq = 0;
  const assessment = (userId, skillKey, over = {}) => Assessment.create({ UserId: userId, skillKey, track: 'self', level: 2, state: 'initial', catalogVersion: 1, rubricHash: 'a'.repeat(64), evidenceRefs: [], confidence: 'low', confidenceReasonCode: 'x', confidenceRuleVersion: 1, authoring: 'person', status: 'current', requestId: `r${++seq}`, ...over });

  // versión 1 publicada con tres habilidades
  const first = await catalog.createDraft();
  for (const key of ['comunicacion', 'planificacion', 'liderazgo']) await catalog.upsertSkill(first.id, key, def(key));
  await catalog.publish(first.id, 1);
  const [u1, u2, u3] = [await mkUser(1), await mkUser(2), await mkUser(3)];
  await assessment(u1.id, 'planificacion'); await assessment(u2.id, 'planificacion'); await assessment(u1.id, 'planificacion', { track: 'review', state: 'reviewed' }); // 2 personas, 3 filas
  await assessment(u3.id, 'liderazgo', { status: 'superseded' }); // sustituida: no cuenta
  await Candidate.create({ jobId: 1, UserId: u3.id, skillKey: 'comunicacion', level: 2, citations: [], status: 'REVIEW_REQUIRED', catalogVersion: 1 });
  await Candidate.create({ jobId: 1, UserId: u2.id, skillKey: 'liderazgo', level: 2, citations: [], status: 'REJECTED', catalogVersion: 1 }); // ya resuelta: no cuenta

  await t.test('H1: publicar un borrador sin una habilidad con niveles registrados o propuestas por confirmar = 409 skill_in_use y la vigente no cambia', async () => {
    const draft = await call('POST', '');
    assert.equal(draft.status, 201);
    assert.equal((await call('DELETE', `/${draft.body.id}/skills/planificacion`)).status, 200);
    assert.equal((await call('DELETE', `/${draft.body.id}/skills/comunicacion`)).status, 200);
    assert.equal((await call('DELETE', `/${draft.body.id}/skills/liderazgo`)).status, 200); // sin niveles vigentes ni propuestas por confirmar: no estorba
    assert.equal((await call('PUT', `/${draft.body.id}/skills/otra_habilidad`, def('otra_habilidad'))).status, 200);
    const blocked = await call('POST', `/${draft.body.id}/publish`);
    assert.equal(blocked.status, 409, JSON.stringify(blocked.body));
    assert.equal(blocked.body.code, 'skill_in_use');
    assert.deepEqual(blocked.body.inUse, [{ skillKey: 'comunicacion', people: 1 }, { skillKey: 'planificacion', people: 2 }]);
    assert.doesNotMatch(JSON.stringify(blocked.body), /es188-|Sintético|UserId/, 'no se identifica a las personas');
    assert.equal((await Catalog.findOne({ where: { id: first.id } })).status, 'published', 'la vigente no cambia');
    assert.equal((await Catalog.findOne({ where: { id: draft.body.id } })).status, 'draft');
  });

  await t.test('al volver a incluir las habilidades en uso, se publica y la vigente pasa a archivada', async () => {
    const [draft] = await Catalog.findAll({ where: { status: 'draft' } });
    for (const key of ['planificacion', 'comunicacion']) assert.equal((await call('PUT', `/${draft.id}/skills/${key}`, def(key))).status, 200);
    const done = await call('POST', `/${draft.id}/publish`);
    assert.equal(done.status, 200, JSON.stringify(done.body));
    assert.equal((await Catalog.findOne({ where: { id: first.id } })).status, 'archived');
  });

  await t.test('H1 sin evaluaciones ni propuestas, quitar habilidades sí se puede publicar; y sin vigente (primera publicación) no estorba', async () => {
    const draft = (await call('POST', '')).body;
    await Assessment.destroy({ where: {} }); await Candidate.destroy({ where: {} });
    for (const key of ['planificacion', 'comunicacion']) assert.equal((await call('DELETE', `/${draft.id}/skills/${key}`)).status, 200);
    assert.equal((await call('PUT', `/${draft.id}/skills/solo_una`, def('solo_una'))).status, 200);
    assert.equal((await call('POST', `/${draft.id}/publish`)).status, 200);
  });

  await t.test('H2: updatedAt por habilidad; versión vigente guarda; vieja = 409 skill_changed con la actual y sin pisar; 12 simultáneos = 1×200 + 11×409', async () => {
    const draft = (await call('POST', '')).body;
    const created = await call('PUT', `/${draft.id}/skills/solo_una`, { ...def('solo_una'), territories: ['con'] });
    assert.equal(created.status, 200); assert.ok(created.body.updatedAt);
    const read = (await call('GET', `/${draft.id}`)).body.skills.find((s) => s.skillKey === 'solo_una');
    assert.equal(read.updatedAt, created.body.updatedAt);
    const ok = await call('PUT', `/${draft.id}/skills/solo_una`, { ...def('dos'), expectedUpdatedAt: read.updatedAt });
    assert.equal(ok.status, 200); assert.notEqual(ok.body.updatedAt, read.updatedAt);
    const stale = await call('PUT', `/${draft.id}/skills/solo_una`, { ...def('tres'), expectedUpdatedAt: read.updatedAt });
    assert.equal(stale.status, 409); assert.equal(stale.body.code, 'skill_changed');
    assert.equal(stale.body.current.labels.es, 'dos'); assert.equal(stale.body.current.updatedAt, ok.body.updatedAt);
    assert.equal((await Definition.findOne({ where: { catalogId: draft.id, skillKey: 'solo_una' } })).labels.es, 'dos');
    const results = await Promise.all(Array.from({ length: 12 }, (_, n) => call('PUT', `/${draft.id}/skills/solo_una`, { ...def(`carrera ${n}`), expectedUpdatedAt: ok.body.updatedAt })));
    assert.deepEqual(results.map((r) => r.status).sort(), [200, ...Array(11).fill(409)], JSON.stringify(results.map((r) => [r.status, r.body && r.body.code])));
    assert.ok(results.filter((r) => r.status === 409).every((r) => r.body.code === 'skill_changed'));
  });

  await t.test('H2: sin expectedUpdatedAt gana el último; formato raro = 400; habilidad quitada + versión = 409 con current null; la versión no se guarda en la rúbrica', async () => {
    const [draft] = await Catalog.findAll({ where: { status: 'draft' } });
    const legacy = await call('PUT', `/${draft.id}/skills/solo_una`, def('heredado'));
    assert.equal(legacy.status, 200);
    for (const bad of ['no-es-fecha', 12345, null, {}]) {
      const res = await call('PUT', `/${draft.id}/skills/solo_una`, { ...def('x'), expectedUpdatedAt: bad });
      assert.equal(res.status, 400, JSON.stringify(bad)); assert.equal(res.body.code, 'invalid_expected');
    }
    assert.equal((await call('DELETE', `/${draft.id}/skills/solo_una`)).status, 200);
    const gone = await call('PUT', `/${draft.id}/skills/solo_una`, { ...def('y'), expectedUpdatedAt: legacy.body.updatedAt });
    assert.equal(gone.status, 409); assert.equal(gone.body.code, 'skill_changed'); assert.equal(gone.body.current, null);
    const meta = await call('PUT', `/${draft.id}/skills/meta_x`, { ...def('meta'), updatedAt: '2020-01-01T00:00:00.000Z' });
    assert.equal(meta.status, 200);
    const row = await Definition.findOne({ where: { catalogId: draft.id, skillKey: 'meta_x' } });
    assert.equal(row.rubric.updatedAt, undefined); assert.equal(row.labels.updatedAt, undefined);
    assert.equal((await call('PUT', `/${draft.id}/skills/new`, def('reservada'))).status, 400, 'clave reservada');
  });
  // QA 217: la prueba tenía que detectar quitar el bloqueo de la fila del catálogo. Sin él, las transacciones apenas se solapan en una prueba rápida; aquí la ventana de carrera
  // se AMPLÍA (cada lectura de la habilidad espera 40 ms dentro de la transacción), así que sin el bloqueo las 12 pasan la comparación con la misma versión y las 12 guardan.
  await t.test('H2 con ventana de carrera ampliada: 12 guardados con la misma versión siguen siendo 1×200 + 11×409 (falla si se quita el bloqueo de la fila)', async () => {
    const draft = (await Catalog.findOne({ where: { status: 'draft' } })).id;
    const created = await call('PUT', `/${draft}/skills/carrera_ancha`, def('carrera_ancha'));
    assert.equal(created.status, 200);
    const original = Definition.findOne;
    Definition.findOne = async function slowFindOne(...args) { const row = await original.apply(this, args); await new Promise((resolve) => setTimeout(resolve, 40)); return row; };
    try {
      for (let round = 0; round < 2; round += 1) {
        const current = (await call('GET', `/${draft}`)).body.skills.find((x) => x.skillKey === 'carrera_ancha');
        const results = await Promise.all(Array.from({ length: 12 }, (_, n) => call('PUT', `/${draft}/skills/carrera_ancha`, { ...def(`ancha ${round}-${n}`), expectedUpdatedAt: current.updatedAt })));
        assert.deepEqual(results.map((r) => r.status).sort(), [200, ...Array(11).fill(409)], `ronda ${round}: ` + JSON.stringify(results.map((r) => [r.status, r.body && r.body.code])));
        const row = await original.call(Definition, { where: { catalogId: draft, skillKey: 'carrera_ancha' } });
        assert.equal(row.labels.es, results.find((r) => r.status === 200).body.labels.es, 'el contenido final es el del único ganador');
      }
    } finally {
      Definition.findOne = original;
    }
  });

  // E217-1: los territorios salen de DATOS (shared/skill-territories.json), no de una lista fija: un territorio nuevo entra sin tocar código.
  await t.test('E217-1: añadir territorios en el archivo de datos los hace válidos sin cambiar código; los desconocidos y el exceso siguen rechazados; archivo roto = nada pasa', async () => {
    const draft = (await call('POST', '')).body.id ?? (await Catalog.findOne({ where: { status: 'draft' } })).id;
    const base = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', '..', 'shared', 'skill-territories.json'), 'utf8'));
    const file = path.join(os.tmpdir(), `es188-territories-${randomBytes(6).toString('hex')}.json`);
    t.after(() => { delete process.env.SKILL_TERRITORIES_FILE; fs.rmSync(file, { force: true }); });
    try {
      assert.deepEqual(catalog.TERRITORIES, ['dir', 'con', 'com', 'ing', 'inn'], 'hoy son los cinco definidos');
      assert.equal((await call('PUT', `/${draft}/skills/con_nuevo`, { ...def('con_nuevo'), territories: ['dir', 'nuevo_a'] })).status, 400, 'nuevo_a todavía no existe en los datos');
      const eight = { territories: [...base.territories, { id: 'nuevo_a', status: 'in_definition' }, { id: 'nuevo_b', status: 'in_definition' }, { id: 'nuevo_c', status: 'in_definition' }] };
      fs.writeFileSync(file, JSON.stringify(eight)); process.env.SKILL_TERRITORIES_FILE = file;
      assert.equal(catalog.TERRITORIES.length, 8);
      const ok = await call('PUT', `/${draft}/skills/con_nuevo`, { ...def('con_nuevo'), territories: ['dir', 'nuevo_a', 'nuevo_c'] });
      assert.equal(ok.status, 200, JSON.stringify(ok.body)); assert.deepEqual(ok.body.territories, ['dir', 'nuevo_a', 'nuevo_c']);
      const listed = await call('GET', '/territories');
      assert.equal(listed.status, 200); assert.equal(listed.body.territories.length, 8);
      assert.deepEqual(listed.body.territories.filter((x) => x.status === 'in_definition').map((x) => x.id), ['nuevo_a', 'nuevo_b', 'nuevo_c'], 'los tres nuevos salen «en definición»');
      assert.equal((await call('PUT', `/${draft}/skills/con_nuevo`, { ...def('con_nuevo'), territories: ['nuevo_d'] })).status, 400, 'un id que no está en los datos se rechaza');
      assert.equal((await call('PUT', `/${draft}/skills/con_nuevo`, { ...def('con_nuevo'), territories: ['dir', 'dir'] })).status, 400, 'repetidos');
      // archivo ilegible o inválido: falla cerrado (ningún territorio pasa), nunca se cae a una lista fija en silencio
      fs.writeFileSync(file, '{ no es json'); process.env.SKILL_TERRITORIES_FILE = file;
      fs.utimesSync(file, new Date(), new Date(Date.now() + 5000));
      const broken = await call('PUT', `/${draft}/skills/con_nuevo`, { ...def('con_nuevo'), territories: ['dir'] });
      assert.notEqual(broken.status, 200, 'con el archivo roto no se aceptan territorios');
      fs.writeFileSync(file, JSON.stringify({ territories: [{ id: 'dir', status: 'raro' }] })); fs.utimesSync(file, new Date(), new Date(Date.now() + 10000));
      assert.notEqual((await call('PUT', `/${draft}/skills/con_nuevo`, { ...def('con_nuevo'), territories: ['dir'] })).status, 200, 'estado inválido en los datos');
    } finally {
      delete process.env.SKILL_TERRITORIES_FILE;
    }
    assert.equal((await call('PUT', `/${draft}/skills/con_nuevo`, { ...def('con_nuevo'), territories: ['nuevo_a'] })).status, 400, 'sin el archivo de prueba vuelve a regir el real');
  });
});
