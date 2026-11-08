// ES-207: lectura pública del manifiesto activo (sin datos internos), error visible y edición solo de administración/superadmin.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { models, record, startApp } = require('./support.cjs');

const active = record({ id: 41, version: 'v3', content: 'Synthetic manifesto text', isActive: true, uploadedBy: 9, note: 'Synthetic internal note', createdAt: new Date('2026-11-01T10:00:00Z'), updatedAt: new Date('2026-11-08T12:00:00Z') });

test('ES-207: GET /api/manifest/active sin sesión devuelve solo versión, texto y fecha; nunca nota, autor ni IDs', async t => {
  models.EthicManifest.findOne = async () => active;
  const request = await startApp(t);
  const res = await request('GET', '/api/manifest/active');
  assert.equal(res.status, 200);
  assert.deepEqual(Object.keys(res.body).sort(), ['content', 'publishedAt', 'version']);
  assert.equal(res.body.publishedAt, '2026-11-08T12:00:00.000Z');
  const raw = JSON.stringify(res.body);
  for (const secret of ['Synthetic internal note', 'uploadedBy', 'uploader', 'email', '"id"']) assert.equal(raw.includes(secret), false, secret);
});

test('ES-207: sin versión activa responde 200 { content: null } (vacío), distinto de un error', async t => {
  models.EthicManifest.findOne = async () => null;
  const request = await startApp(t);
  const res = await request('GET', '/api/manifest/active');
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { content: null });
});

test('ES-207: un fallo interno responde 500 genérico (ya no se disfraza de vacío) y sin detalles', async t => {
  const original = console.error; console.error = () => {};
  models.EthicManifest.findOne = async () => { throw new Error('db down: secret-detail'); };
  const request = await startApp(t);
  const res = await request('GET', '/api/manifest/active');
  console.error = original;
  assert.equal(res.status, 500);
  assert.deepEqual(res.body, { error: 'Could not load manifest.' });
});

test('ES-207: la lectura pública no cambia por rol y el historial/edición rechaza a la junta ética (board) y a otros roles', async t => {
  models.EthicManifest.findOne = async () => active;
  models.EthicManifest.findAll = async () => { throw new Error('no debe consultarse'); };
  const request = await startApp(t);
  for (const role of [undefined, 'user', 'therapist', 'board']) {
    const res = await request('GET', '/api/manifest/active', { role });
    assert.equal(res.status, 200, String(role));
    assert.equal(res.body.version, 'v3');
    for (const prefix of ['/api/manifest', '/api/board']) {
      assert.equal((await request('GET', prefix + '/manifest', { role })).status, 403, `${prefix} historial ${role}`);
      assert.equal((await request('POST', prefix + '/manifest', { role, body: { content: 'x'.repeat(60) } })).status, 403, `${prefix} subir ${role}`);
      assert.equal((await request('PUT', prefix + '/manifest/41/activate', { role, body: {} })).status, 403, `${prefix} activar ${role}`);
    }
  }
});
