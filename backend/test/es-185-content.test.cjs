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

test('ES-185: updating a plan never changes its identifier', async t => {
  const plan = {
    slug: 'original',
    name_es: 'Anterior',
    async update(values) { Object.assign(this, values); },
  };
  models.PricingPlan.findByPk = async () => plan;
  const request = await startApp(t);
  const response = await request('PUT', '/api/admin/pricing/1', {
    role: 'admin',
    body: { slug: 'reemplazo', name_es: 'Actualizado' },
  });
  assert.equal(response.status, 200);
  assert.equal(plan.slug, 'original');
  assert.equal(plan.name_es, 'Actualizado');
});

test('ES-185: creating a plan preserves its selected active state', async t => {
  let created;
  models.PricingPlan.create = async values => { created = values; return values; };
  const request = await startApp(t);
  const response = await request('POST', '/api/admin/pricing', {
    role: 'admin',
    body: { slug: 'fixture', name_es: 'Plan ficticio', name_en: 'Fixture plan', price: 0, isActive: false },
  });
  assert.equal(response.status, 201);
  assert.equal(created.isActive, false);
});
