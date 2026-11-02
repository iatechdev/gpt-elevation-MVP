// ES-118: borrador sin verificar con las 8 habilidades técnicas de PerfiladorV2. Mismo andamiaje que ES-29/ES-116 (Express real, modelos en memoria).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { startApp } = require('./support.cjs');
const { install } = require('./es-29-store.cjs');
const skillCatalog = require('../utils/skillCatalog');
const seed = require('../seeds/skillCatalogTechnicalDraft.json');
const transversal = require('../seeds/skillCatalogDraft.json');

const ADMIN = { role: 'admin', id: 900 };
const levels = Object.fromEntries([1, 2, 3, 4].map((n) => [n, { es: `n${n}`, en: `l${n}` }]));
const complete = (name, over = {}) => ({ type: 'transversal', labels: { es: name, en: name }, territories: ['dir'], rubric: { levels, source: 'Fuente sintética', verifiedBy: 'Revisor sintético', verifiedAt: '2026-10-01' }, ...over });

test('ES-118 el borrador técnico trae 8 habilidades de dominio con clave válida, nombres ES/EN y territorio «ing»', () => {
  assert.match(seed.notice, /SIN VERIFICAR/);
  assert.equal(seed.skills.length, 8);
  const keys = new Set();
  for (const s of seed.skills) {
    assert.match(s.skillKey, skillCatalog.KEY_RE, s.skillKey); assert.ok(!keys.has(s.skillKey)); keys.add(s.skillKey);
    assert.equal(s.type, 'domain');
    assert.ok(s.labels.es.length > 0 && s.labels.en.length > 0 && s.labels.es.length <= 80 && s.labels.en.length <= 80);
    assert.deepEqual(s.territories, ['ing']);
    assert.doesNotThrow(() => skillCatalog.normalizeDefinition({ type: s.type, labels: s.labels, territories: s.territories }));
  }
});
test('ES-118 NO se inventa ni se convierte ningún criterio de nivel: el seed no lleva rúbrica y las anclas originales (1, 3, 5) quedan solo como referencia', () => {
  for (const s of seed.skills) {
    assert.equal('rubric' in s || 'levels' in s, false, s.skillKey);
    assert.deepEqual(Object.keys(s.reference.anchors), ['1', '3', '5']); // escala original 1-5, sin 2 ni 4
    assert.ok(s.reference.descriptionEn.length > 0);
  }
  const text = JSON.stringify(seed);
  assert.equal(/seniority|gap_vs_target|required_score|importance_weight|@|github/i.test(text.replace(/seniority_benchmarks ni gap_vs_target/g, '')), false); // ni benchmarks ni datos de personas
});
test('ES-118 las claves técnicas no chocan con las 8 transversales del catálogo base', () => {
  const base = new Set(transversal.skills.map((s) => s.skillKey));
  for (const s of seed.skills) assert.equal(base.has(s.skillKey), false, s.skillKey);
});
test('ES-118 como borrador son incompletas («falta» todo lo de la rúbrica), no se pueden publicar y no pisan el catálogo vigente', async (t) => {
  install();
  const request = await startApp(t);
  // catálogo vigente con una habilidad completa
  const d1 = (await request('POST', '/api/admin/skill-catalog', ADMIN)).body;
  assert.equal((await request('PUT', `/api/admin/skill-catalog/${d1.id}/skills/comunicacion`, { ...ADMIN, body: complete('Comunicación') })).status, 200);
  assert.equal((await request('POST', `/api/admin/skill-catalog/${d1.id}/publish`, ADMIN)).status, 200);
  // borrador nuevo = vigente + las 8 técnicas (lo que hace el script)
  const d2 = (await request('POST', '/api/admin/skill-catalog', ADMIN)).body;
  for (const s of seed.skills) {
    const r = await request('PUT', `/api/admin/skill-catalog/${d2.id}/skills/${s.skillKey}`, { ...ADMIN, body: { type: s.type, labels: s.labels, territories: s.territories } });
    assert.equal(r.status, 200, s.skillKey);
    assert.ok(r.body.missing.includes('rubric.verifiedBy') && r.body.missing.includes('rubric.levels.4.en'));
  }
  const detail = (await request('GET', `/api/admin/skill-catalog/${d2.id}`, ADMIN)).body;
  assert.equal(detail.skills.length, 9);
  assert.equal(detail.skills.find((s) => s.skillKey === 'comunicacion').missing.length, 0); // la existente conserva su rúbrica completa
  const blocked = await request('POST', `/api/admin/skill-catalog/${d2.id}/publish`, ADMIN);
  assert.deepEqual([blocked.status, blocked.body.code], [422, 'incomplete_catalog']);
  assert.deepEqual(Object.keys(blocked.body.missing).sort(), seed.skills.map((s) => s.skillKey).sort());
  assert.equal((await skillCatalog.getPublished()).version, 1); // el vigente sigue siendo el v1
});
test('ES-118 la guía de referencia lista las 8 claves y dice qué falta; el script nunca publica y se niega ante claves existentes', () => {
  const doc = fs.readFileSync(path.join(__dirname, '../../docs/hu-tecnicas/ES-118-HABILIDADES-TECNICAS-REFERENCIA.md'), 'utf8');
  for (const s of seed.skills) assert.ok(doc.includes('`' + s.skillKey + '`'), s.skillKey);
  assert.match(doc, /SIN VERIFICAR/); assert.match(doc, /no se convierte automáticamente/);
  const script = fs.readFileSync(path.join(__dirname, '../scripts/seedSkillCatalogTechnicalDraft.js'), 'utf8');
  assert.equal(/\.publish\(/.test(script), false);
  assert.match(script, /skill_exists/); assert.match(script, /published: false/);
});
