// ES-116: territorios por habilidad del catálogo. Mismo andamiaje que ES-29 (Express real, modelos en memoria).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { startApp } = require('./support.cjs');
const { install } = require('./es-29-store.cjs');
const skillCatalog = require('../utils/skillCatalog');

const U = { role: 'user', id: 101 };
const ADMIN = { role: 'admin', id: 900 };
const levels = (prefix) => Object.fromEntries([1, 2, 3, 4].map((n) => [n, { es: `${prefix} nivel ${n}`, en: `${prefix} level ${n}` }]));
const body = (name, over = {}) => ({
  type: 'transversal', labels: { es: `Habilidad ${name}`, en: `Skill ${name}` },
  rubric: { levels: levels(name), source: 'Rúbrica sintética de prueba', verifiedBy: 'Revisor sintético', verifiedAt: '2026-10-01' }, ...over,
});
const put = (request, id, key, b) => request('PUT', `/api/admin/skill-catalog/${id}/skills/${key}`, { ...ADMIN, body: b });

test('ES-116 los cinco ids de territorio son los del frontend y no se repiten', () => {
  assert.deepEqual(skillCatalog.TERRITORIES, ['dir', 'con', 'com', 'ing', 'inn']);
  const front = fs.readFileSync(path.join(__dirname, '../../frontend/src/skill-map/territories.ts'), 'utf8');
  for (const id of skillCatalog.TERRITORIES) assert.match(front, new RegExp(`id: '${id}'`), `falta ${id} en el frontend`);
});

test('ES-116 territorios: se guardan en el borrador, se copian a la nueva versión y salen en GET /api/skill-map', async (t) => {
  install();
  const request = await startApp(t);
  const draft = (await request('POST', '/api/admin/skill-catalog', ADMIN)).body;
  const saved = await put(request, draft.id, 'comunicacion', body('comunicacion', { territories: ['com', 'dir'] }));
  assert.equal(saved.status, 200); assert.deepEqual(saved.body.territories, ['com', 'dir']);
  await put(request, draft.id, 'planificacion', body('planificacion')); // sin territorios: opcional
  assert.equal((await request('GET', `/api/admin/skill-catalog/${draft.id}`, ADMIN)).body.skills.find((s) => s.skillKey === 'planificacion').territories.length, 0);
  assert.equal((await request('POST', `/api/admin/skill-catalog/${draft.id}/publish`, ADMIN)).status, 200); // los territorios no son obligatorios para publicar
  const map = (await request('GET', '/api/skill-map', U)).body;
  assert.deepEqual(Object.fromEntries(map.skills.map((s) => [s.skillKey, s.territories])), { comunicacion: ['com', 'dir'], planificacion: [] });
  // nueva versión: copia los territorios del vigente
  const v2 = (await request('POST', '/api/admin/skill-catalog', ADMIN)).body;
  const copied = (await request('GET', `/api/admin/skill-catalog/${v2.id}`, ADMIN)).body.skills;
  assert.deepEqual(copied.find((s) => s.skillKey === 'comunicacion').territories, ['com', 'dir']);
  // omitir `territories` en un PUT conserva lo guardado; [] lo vacía de forma explícita
  await put(request, v2.id, 'comunicacion', body('comunicacion'));
  assert.deepEqual((await request('GET', `/api/admin/skill-catalog/${v2.id}`, ADMIN)).body.skills.find((s) => s.skillKey === 'comunicacion').territories, ['com', 'dir']);
  await put(request, v2.id, 'comunicacion', body('comunicacion', { territories: [] }));
  assert.deepEqual((await request('GET', `/api/admin/skill-catalog/${v2.id}`, ADMIN)).body.skills.find((s) => s.skillKey === 'comunicacion').territories, []);
});

test('ES-116 territorios: entradas inválidas dan 400 controlado y lo publicado sigue inmutable', async (t) => {
  install();
  const request = await startApp(t);
  const draft = (await request('POST', '/api/admin/skill-catalog', ADMIN)).body;
  for (const territories of ['dir', [1], ['nope'], ['dir', 'dir'], ['dir', 'con', 'com', 'ing', 'inn', 'dir'], null, [['dir']], { 0: 'dir' }]) {
    const r = await put(request, draft.id, 'okey', body('x', { territories }));
    assert.equal(r.status, 400, JSON.stringify(territories));
  }
  assert.equal((await put(request, draft.id, 'okey', body('x', { territories: ['dir', 'inn'] }))).status, 200);
  await request('POST', `/api/admin/skill-catalog/${draft.id}/publish`, ADMIN);
  assert.equal((await put(request, draft.id, 'okey', body('x', { territories: ['con'] }))).body.code, 'catalog_not_editable');
  for (const actor of [U, { role: 'therapist', id: 5 }]) assert.equal((await request('PUT', `/api/admin/skill-catalog/${draft.id}/skills/okey`, { ...actor, body: body('x') })).status, 403);
});

test('ES-116 cambiar los territorios NO cambia rubricHash ni marca «la rúbrica cambió» (catalogOutdated)', async (t) => {
  install();
  const request = await startApp(t);
  const d1 = (await request('POST', '/api/admin/skill-catalog', ADMIN)).body;
  await put(request, d1.id, 'comunicacion', body('comunicacion', { territories: ['com'] }));
  await request('POST', `/api/admin/skill-catalog/${d1.id}/publish`, ADMIN);
  const h1 = (await skillCatalog.getPublished()).skills.get('comunicacion').rubricHash;
  const d2 = (await request('POST', '/api/admin/skill-catalog', ADMIN)).body;
  await put(request, d2.id, 'comunicacion', body('comunicacion', { territories: ['dir', 'inn'] }));
  await request('POST', `/api/admin/skill-catalog/${d2.id}/publish`, ADMIN);
  const published = await skillCatalog.getPublished();
  assert.equal(published.skills.get('comunicacion').rubricHash, h1);
  assert.deepEqual(published.skills.get('comunicacion').territories, ['dir', 'inn']);
  // y una rúbrica distinta sí cambia la huella (la prueba no es vacía)
  const d3 = (await request('POST', '/api/admin/skill-catalog', ADMIN)).body;
  await put(request, d3.id, 'comunicacion', body('comunicacion', { labels: { es: 'Otra etiqueta', en: 'Another label' } }));
  await request('POST', `/api/admin/skill-catalog/${d3.id}/publish`, ADMIN);
  assert.notEqual((await skillCatalog.getPublished()).skills.get('comunicacion').rubricHash, h1);
});

test('ES-116 el borrador provisional trae territorios válidos para las 8 habilidades, rotulado «sin verificar»', () => {
  const seed = require('../seeds/skillCatalogDraft.json');
  assert.match(seed.notice, /SIN VERIFICAR/); assert.match(seed.notice, /PROVISIONAL/);
  assert.equal(seed.skills.length, 8);
  for (const s of seed.skills) {
    assert.ok(Array.isArray(s.territories) && s.territories.length >= 1, s.skillKey);
    assert.ok(s.territories.every((id) => skillCatalog.TERRITORIES.includes(id)), s.skillKey);
    assert.equal(new Set(s.territories).size, s.territories.length);
    assert.doesNotThrow(() => skillCatalog.normalizeDefinition({ type: s.type, labels: s.labels, rubric: { levels: s.levels }, territories: s.territories }));
  }
  const used = new Set(seed.skills.flatMap((s) => s.territories));
  assert.deepEqual([...used].sort(), [...skillCatalog.TERRITORIES].sort()); // ningún territorio queda vacío en el borrador
});

test('ES-116 (QA H-88-02) la clave «new» está reservada: el servidor la rechaza y el resto de claves sigue igual', async (t) => {
  install();
  const request = await startApp(t);
  const draft = (await request('POST', '/api/admin/skill-catalog', ADMIN)).body;
  const reserved = await put(request, draft.id, 'new', body('new'));
  assert.deepEqual([reserved.status, reserved.body.code], [400, 'invalid_input']);
  assert.equal((await put(request, draft.id, 'new_skill', body('nueva'))).status, 200); // solo la clave exacta está reservada
  assert.equal((await request('GET', '/api/admin/skill-catalog/' + draft.id, ADMIN)).body.skills.some((s) => s.skillKey === 'new'), false);
  assert.deepEqual(skillCatalog.RESERVED_KEYS, ['new']);
  assert.equal(skillCatalog.isValidKey('new'), false);
});
