const { test } = require('node:test');
const assert = require('node:assert/strict');
const { models, startApp } = require('./support.cjs');
const { catalog } = require('../content/landingDefaults');

test('ES-68: new copy uses the existing public read and protected CMS write (mock persistence)', async t => {
  const rows = new Map();
  models.LandingContent.findAll = async ({ where }) => [...rows.values()].filter(row => row.lang === where.lang);
  models.LandingContent.upsert = async row => { rows.set(row.key + ':' + row.lang, row); };
  const request = await startApp(t); // production Express mounts, real HTTP and signed JWTs
  const entries = catalog.filter(entry => /^landing\.(problem|modules|journey)\./.test(entry.key));
  assert.ok(entries.length > 30);
  const body = { key: 'landing.modules.connection', lang: 'es', value: 'Synthetic editorial change' };
  for (const role of [undefined, 'user', 'therapist', 'board', 'admin']) {
    assert.equal((await request('PUT', '/api/landing-content', { role, body })).status, 403);
  }
  assert.equal((await request('PUT', '/api/landing-content', {
    body, headers: { Authorization: 'Bearer invalid' },
  })).status, 401);
  assert.equal(rows.size, 0);
  for (const entry of entries) for (const lang of ['es', 'en']) {
    const edit = `Synthetic ${lang}: ${entry.key}`;
    assert.equal((await request('PUT', '/api/landing-content', {
      role: 'superadmin', body: { key: entry.key, lang, value: edit },
    })).status, 200);
  }
  for (const lang of ['es', 'en']) {
    const response = await request('GET', '/api/landing-content?lang=' + lang);
    assert.equal(response.status, 200);
    for (const entry of entries) assert.equal(response.body[entry.key], `Synthetic ${lang}: ${entry.key}`);
  }
  for (const invalid of [{ ...body, value: ' ' }, { ...body, lang: 'fr' }, { ...body, value: 'x'.repeat(5001) }]) {
    assert.equal((await request('PUT', '/api/landing-content', { role: 'superadmin', body: invalid })).status, 400);
  }
  assert.equal(rows.size, entries.length * 2);
});
