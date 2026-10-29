// ES-106 (ES94-C03): el GET público no devuelve textos guardados de claves `landing.*` que ya no existen en el catálogo.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { models, startApp } = require('./support.cjs');
const { catalog } = require('../content/landingDefaults');

const row = (key, lang, value) => ({ key, lang, value });

test('ES-106: un override huérfano no se publica; uno vigente, los heredados y las claves no landing sí; blancos y no textos se ignoran', async t => {
  const stored = [
    row('landing.modules.elevation.status', 'es', 'En piloto'), // clave eliminada en ES-94
    row('landing.clave.que.nunca.existio', 'es', 'huérfano'),
    row('landing.skillmap.routes.continuity.pending', 'es', 'Texto editado vigente'),
    row('hero_title', 'es', 'Título heredado editado'),
    row('otra_clave_no_landing', 'es', 'se conserva'),
    row('landing.nav.skip', 'es', '   '), // en blanco: se ignora y queda el defecto
    row('landing.nav.how', 'es', 7), // no es texto
    row('landing.modules.elevation.status', 'en', 'In pilot'),
  ];
  models.LandingContent.findAll = async ({ where }) => stored.filter(item => item.lang === where.lang);
  const request = await startApp(t);
  const es = (await request('GET', '/api/landing-content?lang=es')).body;
  assert.equal('landing.modules.elevation.status' in es, false);
  assert.equal('landing.clave.que.nunca.existio' in es, false);
  assert.equal(es['landing.skillmap.routes.continuity.pending'], 'Texto editado vigente');
  assert.equal(es.hero_title, 'Título heredado editado'); assert.equal(es.otra_clave_no_landing, 'se conserva');
  assert.equal(es['landing.nav.skip'], catalog.find(e => e.key === 'landing.nav.skip').es);
  assert.equal(es['landing.nav.how'], catalog.find(e => e.key === 'landing.nav.how').es);
  const en = (await request('GET', '/api/landing-content?lang=en')).body;
  assert.equal('landing.modules.elevation.status' in en, false);
  assert.equal(en['landing.skillmap.routes.continuity.pending'], catalog.find(e => e.key === 'landing.skillmap.routes.continuity.pending').en); // el override es solo de ES
});

test('ES-106: sin overrides responde el catálogo completo y ante un fallo de base de datos responde los defectos', async t => {
  models.LandingContent.findAll = async () => [];
  const request = await startApp(t);
  const clean = (await request('GET', '/api/landing-content?lang=es')).body;
  for (const entry of catalog) assert.equal(clean[entry.key], entry.es, entry.key);
  models.LandingContent.findAll = async () => { throw new Error('SYNTHETIC_DB_DOWN'); };
  const logs = []; const previous = console.error; console.error = (...args) => logs.push(args);
  try {
    const failed = await request('GET', '/api/landing-content?lang=en');
    assert.equal(failed.status, 200); for (const entry of catalog) assert.equal(failed.body[entry.key], entry.en, entry.key);
    assert.doesNotMatch(JSON.stringify(logs), /SYNTHETIC_DB_DOWN/);
  } finally { console.error = previous; }
});
