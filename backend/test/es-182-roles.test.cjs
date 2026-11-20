// ES-182 (decisión 12079): LEER el historial del manifiesto es de administración y superadmin; PUBLICAR, activar y reactivar versiones es SOLO de superadmin.
// El servidor es la autoridad (la pantalla solo deja de pintar los controles). Se prueba por los dos montajes del router (/api/board y /api/manifest).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { models, record, startApp } = require('./support.cjs');

const version = record({ id: 41, version: 'v3', content: 'x', isActive: true, uploadedBy: 9, note: null, createdAt: new Date('2026-11-01T10:00:00Z'), updatedAt: new Date('2026-11-01T10:00:00Z'), uploader: null });
const long = 'Texto sintético del manifiesto con más de cincuenta caracteres para pasar la validación.';

test('ES-182: admin puede LEER el historial pero recibe 403 al publicar y al reactivar; la base no se toca', async t => {
  let writes = 0
  models.EthicManifest.findAll = async () => []
  models.EthicManifest.create = async () => { writes += 1; return version }
  models.EthicManifest.update = async () => { writes += 1; return [1] }
  models.EthicManifest.findByPk = async () => { writes += 1; return version }
  const request = await startApp(t)
  for (const prefix of ['/api/board', '/api/manifest']) {
    assert.equal((await request('GET', prefix + '/manifest', { role: 'admin' })).status, 200, `${prefix} admin lee el historial`)
    const post = await request('POST', prefix + '/manifest', { role: 'admin', body: { content: long } })
    assert.equal(post.status, 403, `${prefix} admin no publica`)
    assert.match(post.body.error, /superadministración/i)
    assert.equal((await request('PUT', prefix + '/manifest/41/activate', { role: 'admin', body: {} })).status, 403, `${prefix} admin no reactiva`)
  }
  assert.equal(writes, 0, 'con 403 no se consultó ni se escribió la tabla')
})

test('ES-182: superadmin pasa la guarda de publicar y reactivar (llega a la validación o a la base, nunca 401/403)', async t => {
  models.EthicManifest.findAll = async () => []
  models.EthicManifest.findByPk = async () => null
  const request = await startApp(t)
  for (const prefix of ['/api/board', '/api/manifest']) {
    assert.equal((await request('GET', prefix + '/manifest', { role: 'superadmin' })).status, 200, `${prefix} superadmin lee`)
    assert.equal((await request('POST', prefix + '/manifest', { role: 'superadmin', body: { content: 'corto' } })).status, 400, `${prefix} superadmin llega a la validación de 50 caracteres`)
    assert.equal((await request('PUT', prefix + '/manifest/41/activate', { role: 'superadmin', body: {} })).status, 404, `${prefix} superadmin llega a la base (versión inexistente)`)
  }
})

test('ES-182: user, therapist y board siguen sin historial, sin publicar y sin reactivar; sin sesión 401', async t => {
  models.EthicManifest.findAll = async () => { throw new Error('no debe consultarse') }
  const request = await startApp(t)
  for (const prefix of ['/api/board', '/api/manifest']) for (const role of [undefined, 'user', 'therapist', 'board']) {
    const expected = role === undefined ? 401 : 403
    assert.equal((await request('GET', prefix + '/manifest', { role })).status, expected, `${prefix} historial ${role}`)
    assert.equal((await request('POST', prefix + '/manifest', { role, body: { content: long } })).status, expected, `${prefix} publicar ${role}`)
    assert.equal((await request('PUT', prefix + '/manifest/41/activate', { role, body: {} })).status, expected, `${prefix} reactivar ${role}`)
  }
})

test('ES-182: la ruta usa la guarda de superadmin para publicar y reactivar, y la de lectura solo para el historial', () => {
  const route = fs.readFileSync(path.join(__dirname, '../routes/board.js'), 'utf8')
  assert.match(route, /router\.post\('\/manifest', verificarPublicadorManifiesto,/)
  assert.match(route, /router\.put\('\/manifest\/:id\/activate', verificarPublicadorManifiesto,/)
  assert.match(route, /router\.get\('\/manifest', verificarEditorManifiesto,/)
  const auth = fs.readFileSync(path.join(__dirname, '../middlewares/auth.js'), 'utf8')
  assert.match(auth, /const MANIFEST_EDITOR_ROLES = \['admin', 'superadmin'\]/)
  assert.match(auth, /verificarPublicadorManifiesto = [\s\S]*?req\.user\.role !== 'superadmin'/)
})
