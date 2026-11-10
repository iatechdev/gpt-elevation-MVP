const { test } = require('node:test');
const assert = require('node:assert/strict');
const { models, startApp } = require('./support.cjs');

test('ES-185: administrative content requires admin and reports database errors', async t => {
  models.LandingContent.findAll = async ({ where }) => [{ key: 'hero_title', value: where.lang === 'en' ? 'Saved EN' : 'Guardado ES' }];
  const request = await startApp(t);
  for (const role of [undefined, 'user', 'therapist', 'board']) {
    const response = await request('GET', '/api/landing-content/admin?lang=es', { role });
    assert.ok([401, 403].includes(response.status), `unexpected access for ${role}`);
  }
  for (const role of ['admin', 'superadmin']) {
    const response = await request('GET', '/api/landing-content/admin?lang=en', { role });
    assert.equal(response.status, 200);
    assert.equal(response.body.hero_title, 'Saved EN');
    assert.equal(response.headers.get('cache-control'), 'no-store');
  }
  let saved = 0;
  models.LandingContent.upsert = async () => { saved += 1; };
  const body = { key: 'hero_title', lang: 'es', value: 'Texto ficticio' };
  assert.equal((await request('PUT', '/api/landing-content', { role: 'admin', body })).status, 403);
  assert.equal(saved, 0);
  assert.equal((await request('PUT', '/api/landing-content', { role: 'superadmin', body })).status, 200);
  assert.equal(saved, 1);
  models.LandingContent.findAll = async () => { throw new Error('synthetic database failure'); };
  const response = await request('GET', '/api/landing-content/admin?lang=es', { role: 'admin' });
  assert.equal(response.status, 503);
  assert.deepEqual(response.body, { error: 'No se pudo cargar el contenido.' });
  const publicResponse = await request('GET', '/api/landing-content?lang=es');
  assert.equal(publicResponse.status, 200);
  assert.ok(publicResponse.body.hero_title);
});
