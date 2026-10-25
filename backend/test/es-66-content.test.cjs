const { test } = require('node:test');
const assert = require('node:assert/strict');
const { models, startApp } = require('./support.cjs');
const { catalog } = require('../content/landingDefaults');
const { seedLandingContent } = require('../scripts/seedLandingContent');

test('ES-66: public content defaults, persisted edits and real role checks', async t => {
  const rows = [];
  let writes = 0;
  models.LandingContent.findAll = async ({ where }) => rows.filter(row => row.lang === where.lang);
  models.LandingContent.upsert = async row => { writes++; rows.push(row); };
  const request = await startApp(t);
  for (const lang of ['es', 'en']) {
    const response = await request('GET', '/api/landing-content?lang=' + lang);
    assert.equal(response.status, 200);
    for (const entry of catalog) assert.equal(response.body[entry.key], entry[lang]);
  }
  const body = { key: 'landing.hero.title', lang: 'en', value: 'Synthetic editable title' };
  for (const role of [undefined, 'user', 'therapist', 'board', 'admin']) {
    assert.equal((await request('PUT', '/api/landing-content', { role, body })).status, 403);
  }
  assert.equal((await request('PUT', '/api/landing-content', {
    body, headers: { Authorization: 'Bearer invalid' },
  })).status, 401);
  assert.equal(writes, 0);
  assert.equal((await request('PUT', '/api/landing-content', { role: 'superadmin', body })).status, 200);
  assert.equal((await request('GET', '/api/landing-content?lang=en')).body[body.key], body.value);
  assert.equal((await request('GET', '/api/landing-content?lang=es')).body[body.key], catalog.find(e => e.key === body.key).es);
  for (const invalid of [
    { ...body, value: ' ' }, { ...body, value: '<'.repeat(5001) },
    { ...body, lang: 'fr' }, { ...body, key: 'landing.unapproved' },
    { ...body, key: 'x'.repeat(256) }, { ...body, value: {} },
  ]) assert.equal((await request('PUT', '/api/landing-content', { role: 'superadmin', body: invalid })).status, 400);
  assert.equal(writes, 1);
  // Compatibility: old keys still editable, no destructive retirement.
  assert.equal((await request('PUT', '/api/landing-content', {
    role: 'superadmin', body: { ...body, key: 'hero_title' },
  })).status, 200);
  rows.push({ key: body.key, lang: 'es', value: ' ' });
  assert.equal((await request('GET', '/api/landing-content?lang=es')).body[body.key], catalog.find(e => e.key === body.key).es);
  models.LandingContent.findAll = async () => { throw new Error('Synthetic database failure'); };
  t.mock.method(console, 'error', () => {});
  for (const lang of ['es', 'en']) {
    const fallback = await request('GET', '/api/landing-content?lang=' + lang);
    assert.equal(fallback.status, 200);
    for (const entry of catalog) assert.equal(fallback.body[entry.key], entry[lang]);
  }
});

test('ES-66: staging seed refuses other environments and preserves edits on rerun (mock DB)', async () => {
  const rows = new Map([['landing.hero.title:es', 'Synthetic existing edit']]);
  let transactions = 0;
  const transaction = {};
  const sequelize = { transaction: async fn => { transactions++; return fn(transaction); } };
  const model = { findOrCreate: async options => {
    assert.equal(options.transaction, transaction);
    const key = options.where.key + ':' + options.where.lang;
    const inserted = !rows.has(key);
    if (inserted) rows.set(key, options.defaults.value);
    return [{}, inserted];
  } };
  for (const env of [{}, { APP_ENV: 'production', LANDING_SEED_CONFIRM: 'staging' }, { APP_ENV: 'staging' }]) {
    await assert.rejects(seedLandingContent({ model, sequelize, env }), /staging/);
  }
  assert.equal(transactions, 0);
  const env = { APP_ENV: 'staging', LANDING_SEED_CONFIRM: 'staging' };
  assert.equal(await seedLandingContent({ model, sequelize, env }), catalog.length * 2 - 1);
  assert.equal(await seedLandingContent({ model, sequelize, env }), 0);
  assert.equal(rows.get('landing.hero.title:es'), 'Synthetic existing edit');
});

test('ES-66: browser resolver falls back per language on missing, blank, malformed and failed responses', async t => {
  const { landingText, loadLandingContent } = await import('../../frontend/src/content/landingContent.ts');
  const key = 'landing.hero.title';
  assert.equal(new Set(catalog.map(entry => entry.key)).size, catalog.length);
  for (const lang of ['es', 'en']) for (const entry of catalog) {
    assert.equal(typeof entry[lang], 'string');
    assert.ok(entry[lang].trim());
    assert.equal(landingText(entry.key, lang, { [entry.key]: ' ' }), entry[lang]);
    assert.equal(landingText(entry.key, lang), entry[lang]);
  }
  for (const response of [
    () => Promise.reject(new Error('Network down')),
    async () => ({ ok: false }),
    async () => ({ ok: true, json: async () => [] }),
    async () => ({ ok: true, json: async () => null }),
    async () => ({ ok: true, json: async () => { throw new Error('Invalid JSON'); } }),
  ]) {
    t.mock.method(globalThis, 'fetch', response);
    for (const lang of ['es', 'en']) {
      assert.equal(landingText(key, lang, await loadLandingContent(lang)), catalog.find(e => e.key === key)[lang]);
    }
    t.mock.restoreAll();
  }
  t.mock.method(globalThis, 'fetch', async url => {
    assert.ok(url.endsWith('?lang=en'));
    return { ok: true, json: async () => ({ [key]: 'Synthetic edit' }) };
  });
  assert.equal(landingText(key, 'en', await loadLandingContent('en')), 'Synthetic edit');
});
