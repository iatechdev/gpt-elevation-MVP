const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const jwt = require('jsonwebtoken');
const { models, startApp } = require('./support.cjs');

test('QA-57-04: role matrix, authorized persistence and invalid inputs', async t => {
  const saved = [];
  let reads = 0;
  models.LandingContent.upsert = async values => { saved.push(values); };
  models.LandingContent.findAll = async ({ where }) => {
    reads++;
    return saved.filter(row => row.lang === where.lang);
  };
  const request = await startApp(t);
  const body = { key: 'hero_title', lang: 'es', value: 'Texto sintético' };
  for (const role of [undefined, 'user', 'therapist', 'admin', 'board']) {
    assert.equal((await request('PUT', '/api/landing-content', { role, body })).status, 403);
    assert.equal(saved.length, 0);
    assert.equal(reads, 0);
  }
  for (const token of [
    'invalid',
    jwt.sign({ id: 101, role: 'superadmin', exp: 1 }, process.env.JWT_SECRET),
    jwt.sign({ id: 101, role: 'superadmin' }, randomBytes(32).toString('hex')),
  ]) {
    assert.equal((await request('PUT', '/api/landing-content', {
      headers: { Authorization: 'Bearer ' + token }, body,
    })).status, 401);
    assert.equal(saved.length, 0);
  }
  for (const invalid of [undefined, {}, [], { ...body, key: {} }, { ...body, value: [] },
    { ...body, value: ' ' }, { ...body, lang: 'invalid' }]) {
    assert.equal((await request('PUT', '/api/landing-content', { role: 'superadmin', body: invalid })).status, 400);
    assert.equal(saved.length, 0);
  }
  for (const lang of ['es', 'en']) {
    assert.equal((await request('PUT', '/api/landing-content', {
      role: 'superadmin', body: { ...body, lang },
    })).status, 200);
    assert.equal(saved.at(-1).updated_by, 'Synthetic actor');
    const content = await request('GET', '/api/landing-content?lang=' + lang);
    assert.equal(content.status, 200);
    assert.equal(content.body.hero_title, body.value);
  }
  assert.equal(saved.length, 2);
});
