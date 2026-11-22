// ES-378 (H440-1) · El refresco de los textos públicos sembrados: actualiza SOLO las filas que nadie editó, crea las nuevas, retira las claves retiradas y es idempotente.
// HTTP REAL (GET público), PostgreSQL REAL (migraciones reales), datos SINTÉTICOS.
//   ES378_TEST_DATABASE_URL=postgres://elevation:elevation_local@127.0.0.1:54367/postgres node --test test/integration/es-378-postgres.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { startRealApi } = require('../support/realApi.cjs');

test('ES-378 PostgreSQL + HTTP: refresco de textos sembrados (actualiza, respeta lo editado, crea, retira, idempotente, dry-run, rollback)', { timeout: 300000 }, async (t) => {
  const { q, http, base, app } = await startRealApi(t, { envVar: 'ES378_TEST_DATABASE_URL', prefix: 'es378' });
  const LandingContent = require('../../LandingContent');
  const { catalog } = require('../../content/landingDefaults');
  const { refreshSeededLandingContent, seedLandingContent, SEED_TAG } = require('../../scripts/seedLandingContent');
  const env = { APP_ENV: 'staging', LANDING_SEED_CONFIRM: 'staging' };
  const by = Object.fromEntries(catalog.map(e => [e.key, e]));
  const row = async (key, lang = 'es') => (await q('SELECT value, updated_by FROM "LandingContents" WHERE key=$1 AND lang=$2', [key, lang]))[0];
  const count = async () => (await q('SELECT count(*)::int n FROM "LandingContents"'))[0].n;
  const ins = (key, lang, value, by) => q('INSERT INTO "LandingContents" (key, lang, value, updated_by, "createdAt", "updatedAt") VALUES ($1,$2,$3,$4,now(),now())', [key, lang, value, by]);
  const publicText = async (lang) => (await fetch(`${base}/api/landing-content?lang=${lang}`).then(r => r.json()));
  void http;

  // Estado de partida de staging: sembrado con textos ANTIGUOS, una edición de una persona, claves retiradas (una sembrada, una editada) y casi todo lo nuevo sin crear.
  await ins('landing.portada.hero_pre', 'es', 'Tu experiencia tiene', SEED_TAG)
  await ins('landing.portada.hero_pre', 'en', 'Your experience has', SEED_TAG)
  await ins('landing.nav.skillmap', 'es', 'Skill Map editado por Ana', 'Ana Sintética')
  await ins('landing.nav.how', 'es', by['landing.nav.how'].es, SEED_TAG) // ya al día
  await ins('landing.pricing.title', 'es', 'Elige cómo quieres acompañarte', SEED_TAG) // retirada y sembrada → se borra
  await ins('landing.pricing.subtitle', 'es', 'Texto editado de una clave retirada', 'Ana Sintética') // retirada y editada → se deja (la lectura pública la ignora)
  const before = await count()

  await t.test('sin la confirmación de staging se rechaza antes de tocar nada', async () => {
    for (const bad of [{}, { APP_ENV: 'production', LANDING_SEED_CONFIRM: 'staging' }, { APP_ENV: 'staging' }]) {
      await assert.rejects(refreshSeededLandingContent({ model: LandingContent, sequelize: app, env: bad }), /staging/)
    }
    assert.equal(await count(), before)
  })

  await t.test('dry-run: cuenta lo que haría y NO escribe', async () => {
    const report = await refreshSeededLandingContent({ model: LandingContent, sequelize: app, env, dryRun: true })
    assert.equal(report.dryRun, true); assert.equal(report.updated, 2); assert.equal(report.removed, 1); assert.equal(report.kept, 2)
    assert.equal(report.created, catalog.length * 2 - 4, 'cuatro filas del catálogo ya existían (hero_pre es/en, nav.skillmap es, nav.how es)')
    assert.equal(await count(), before, 'no se escribió nada')
    assert.equal((await row('landing.portada.hero_pre')).value, 'Tu experiencia tiene'); assert.ok(await row('landing.pricing.title'))
  })

  let first
  await t.test('refresco real: actualiza las sembradas, respeta la editada, crea las nuevas, retira la sembrada retirada y deja la editada retirada', async () => {
    first = await refreshSeededLandingContent({ model: LandingContent, sequelize: app, env })
    assert.equal(first.updated, 2); assert.deepEqual(first.updatedKeys.sort(), ['landing.portada.hero_pre|en', 'landing.portada.hero_pre|es'])
    assert.equal(first.removed, 1); assert.deepEqual(first.removedKeys, ['landing.pricing.title|es'])
    assert.equal(first.kept, 2) // nav.skillmap (editada) y pricing.subtitle (retirada y editada)
    assert.ok(!JSON.stringify(first).includes('Tu experiencia tiene'), 'la auditoría no lleva textos, solo conteos y claves')
    assert.equal((await row('landing.portada.hero_pre')).value, by['landing.portada.hero_pre'].es); assert.equal((await row('landing.portada.hero_pre', 'en')).value, by['landing.portada.hero_pre'].en)
    assert.equal((await row('landing.portada.hero_pre')).updated_by, SEED_TAG)
    const edited = await row('landing.nav.skillmap'); assert.equal(edited.value, 'Skill Map editado por Ana'); assert.equal(edited.updated_by, 'Ana Sintética')
    assert.equal(await row('landing.pricing.title'), undefined, 'la sembrada retirada se borró')
    assert.equal((await row('landing.pricing.subtitle')).value, 'Texto editado de una clave retirada', 'la editada retirada se conserva')
    for (const entry of catalog) for (const lang of ['es', 'en']) if (!(entry.key === 'landing.nav.skillmap' && lang === 'es')) assert.ok(await row(entry.key, lang), `${entry.key} ${lang}`)
    assert.equal(await count(), catalog.length * 2 + 1 /* subtitle editada */)
  })

  await t.test('la lectura pública sirve el texto nuevo, conserva el editado por la persona e ignora la clave retirada', async () => {
    const es = await publicText('es'); const en = await publicText('en')
    assert.equal(es['landing.portada.hero_pre'], by['landing.portada.hero_pre'].es); assert.equal(en['landing.portada.hero_pre'], by['landing.portada.hero_pre'].en)
    assert.equal(es['landing.nav.skillmap'], 'Skill Map editado por Ana'); assert.equal(en['landing.nav.skillmap'], by['landing.nav.skillmap'].en)
    assert.equal('landing.pricing.subtitle' in es, false); assert.equal('landing.pricing.title' in es, false)
  })

  await t.test('segunda corrida: no cambia nada (idempotente) y no mueve updatedAt', async () => {
    const stamp = (await q('SELECT max("updatedAt") m FROM "LandingContents"'))[0].m
    const second = await refreshSeededLandingContent({ model: LandingContent, sequelize: app, env })
    assert.deepEqual([second.created, second.updated, second.removed], [0, 0, 0]); assert.equal(second.kept, 2)
    assert.equal(new Date((await q('SELECT max("updatedAt") m FROM "LandingContents"'))[0].m).getTime(), new Date(stamp).getTime())
    assert.equal(await seedLandingContent({ model: LandingContent, sequelize: app, env }), 0, 'el seed original sigue sin crear nada ni pisar')
  })

  await t.test('una edición posterior de una persona sobre una fila sembrada ya no se pisa en la siguiente corrida', async () => {
    await q('UPDATE "LandingContents" SET value=$1, updated_by=$2 WHERE key=$3 AND lang=$4', ['Titular editado', 'Luis Sintético', 'landing.portada.hero_pre', 'es'])
    const report = await refreshSeededLandingContent({ model: LandingContent, sequelize: app, env })
    assert.equal(report.updated, 0); assert.equal((await row('landing.portada.hero_pre')).value, 'Titular editado')
  })

  await t.test('rollback: si algo falla a mitad, no queda nada a medias', async () => {
    await q('UPDATE "LandingContents" SET value=$1, updated_by=$2 WHERE key=$3 AND lang=$4', ['Texto antiguo', SEED_TAG, 'landing.nav.how', 'es'])
    await q('DELETE FROM "LandingContents" WHERE key=$1', ['landing.footer.privacy'])
    const snapshot = await q('SELECT key, lang, value, updated_by FROM "LandingContents" ORDER BY key, lang')
    const failing = new Proxy(LandingContent, { get: (target, prop) => prop === 'create' ? async () => { throw new Error('fallo sintético') } : target[prop] })
    await assert.rejects(refreshSeededLandingContent({ model: failing, sequelize: app, env }), /fallo sintético/)
    assert.deepEqual(await q('SELECT key, lang, value, updated_by FROM "LandingContents" ORDER BY key, lang'), snapshot, 'la actualización de nav.how se revirtió')
    const ok = await refreshSeededLandingContent({ model: LandingContent, sequelize: app, env })
    assert.equal(ok.updated, 1); assert.equal(ok.created, 2) // nav.how + privacy es/en
  })
})
