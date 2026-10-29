// ES-90: ningún marcador entre corchetes llega a la landing pública; el superadmin puede reemplazar cada texto pendiente.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { models, startApp } = require('./support.cjs');
const { catalog } = require('../content/landingDefaults');

const PENDING_KEYS = [
  'landing.modules.elevation.status', 'landing.skillmap.routes.continuity.pending', 'landing.skillmap.routes.adjacent.pending',
  'landing.skillmap.routes.exploratory.pending', 'landing.join.professional_pending',
];
const marker = /\[[^\]]*\]/;

test('ES-90: el catálogo no trae marcadores [..] en ES ni EN', () => {
  for (const entry of catalog) for (const lang of ['es', 'en']) assert.doesNotMatch(entry[lang], marker, `${entry.key} ${lang}`);
});

test('ES-90: GET público devuelve los textos provisionales honestos y ningún marcador', async t => {
  models.LandingContent.findAll = async () => [];
  const request = await startApp(t);
  for (const lang of ['es', 'en']) {
    const { status, body } = await request('GET', '/api/landing-content?lang=' + lang);
    assert.equal(status, 200);
    for (const [key, value] of Object.entries(body)) assert.doesNotMatch(String(value), marker, `${key} ${lang}`);
    for (const key of PENDING_KEYS) assert.ok(body[key] && body[key].length > 5, key);
  }
  const es = (await request('GET', '/api/landing-content?lang=es')).body;
  assert.equal(es['landing.modules.elevation.status'], 'En piloto');
  assert.equal((await request('GET', '/api/landing-content?lang=en')).body['landing.join.professional_pending'], 'Coming soon: professional sign-up is not available yet.');
});

test('ES-90: solo el superadmin reemplaza un pendiente y el valor nuevo se publica; otros roles reciben 403', async t => {
  const rows = [];
  models.LandingContent.findAll = async ({ where }) => rows.filter(row => row.lang === where.lang);
  models.LandingContent.upsert = async row => { rows.push(row); };
  const request = await startApp(t);
  const body = { key: 'landing.modules.elevation.status', lang: 'es', value: 'Valor sintético de prueba' };
  for (const role of ['user', 'admin', 'therapist']) assert.equal((await request('PUT', '/api/landing-content', { role, body })).status, 403, role);
  assert.equal(rows.length, 0);
  assert.equal((await request('PUT', '/api/landing-content', { role: 'superadmin', body })).status, 200);
  assert.equal((await request('GET', '/api/landing-content?lang=es')).body[body.key], body.value);
  assert.equal((await request('GET', '/api/landing-content?lang=en')).body[body.key], 'In pilot'); // el otro idioma conserva su provisional
});
