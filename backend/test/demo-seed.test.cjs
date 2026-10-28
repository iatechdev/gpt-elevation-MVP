// Semilla de demostración para staging: protecciones y datos puros, sin base de datos ni red.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { assertSeedAllowed, SeedError, demoSkills, DEMO_EVIDENCE, evidenceBody, assessRequestId, isSyntheticLabel, DEMO_EMAIL, LABEL_MARK } = require('../utils/demoSeedData');

const ok = { ALLOW_SYNTHETIC_CATALOG: 'true', DEMO_USER_PASSWORD: 'x'.repeat(12) };
const refused = (env, code) => assert.throws(() => assertSeedAllowed(env), (e) => e instanceof SeedError && e.code === code);
const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('la semilla exige la bandera sintética y una clave del operador', () => {
  assertSeedAllowed(ok);
  for (const value of [undefined, '', 'TRUE', 'True', '1', 'yes', true, 'false']) refused({ ...ok, ALLOW_SYNTHETIC_CATALOG: value }, 'synthetic_not_allowed');
  for (const value of [undefined, '', 'short', 'x'.repeat(11), 123456789012, null]) refused({ ...ok, DEMO_USER_PASSWORD: value }, 'password_required');
  refused({}, 'synthetic_not_allowed');
});

test('staging corre con NODE_ENV=production: la protección es la bandera, no el entorno', () => {
  assertSeedAllowed({ ...ok, NODE_ENV: 'production' });
  refused({ NODE_ENV: 'development', DEMO_USER_PASSWORD: ok.DEMO_USER_PASSWORD }, 'synthetic_not_allowed');
  for (const file of ['scripts/seedRouteCatalogSynthetic.js', 'scripts/seedStagingDemo.js', 'utils/demoSeed.js', 'utils/demoSeedData.js']) {
    assert.doesNotMatch(read(file), /NODE_ENV\s*===\s*['"]production['"]/, file);
  }
  assert.match(read('scripts/seedRouteCatalogSynthetic.js'), /ALLOW_SYNTHETIC_CATALOG !== 'true'/);
});

test('el catálogo de habilidades de demostración es completo, publicable y está rotulado como sintético en ES y EN', () => {
  const skills = demoSkills(new Date('2026-10-28T12:00:00Z'));
  assert.equal(skills.length, 8);
  for (const skill of skills) {
    assert.ok(skill.labels.es.startsWith(LABEL_MARK.es) && skill.labels.en.startsWith(LABEL_MARK.en), skill.skillKey);
    assert.ok(isSyntheticLabel(skill.labels));
    assert.deepEqual(Object.keys(skill.rubric.levels).sort(), ['1', '2', '3', '4']);
    assert.equal(skill.rubric.verifiedAt, '2026-10-28');
    assert.match(skill.rubric.source, /sintética/i);
    assert.match(skill.rubric.verifiedBy, /sintético/i);
  }
  assert.equal(isSyntheticLabel({ es: 'Comunicación', en: 'Communication' }), false); // una etiqueta real no cuenta como sintética
  assert.equal(isSyntheticLabel(null), false);
});

test('las evidencias y autoevaluaciones de demostración son sintéticas, apuntan a habilidades del catálogo y son idempotentes por requestId', () => {
  const keys = new Set(demoSkills().map((s) => s.skillKey));
  const ids = new Set();
  for (const item of DEMO_EVIDENCE) {
    assert.ok(keys.has(item.skillKey), item.skillKey);
    assert.ok(item.level >= 1 && item.level <= 4);
    assert.match(item.title, /^\[SINTÉTICO\]/);
    const body = evidenceBody(item);
    assert.equal(body.status, 'confirmed');
    assert.equal(body.payload.observedEffect.known, false); // no se inventa un efecto observado
    for (const id of [body.requestId, assessRequestId(item)]) { assert.match(id, /^[A-Za-z0-9_-]{8,64}$/); ids.add(id); }
    assert.notEqual(assessRequestId(item), item.requestId);
  }
  assert.equal(ids.size, DEMO_EVIDENCE.length * 2); // todos distintos
  assert.equal(new Set(DEMO_EVIDENCE.map((e) => e.skillKey)).size, DEMO_EVIDENCE.length);
  assert.ok(DEMO_EVIDENCE.length < keys.size); // las demás habilidades quedan «sin evidencia»
});

test('la persona de demostración usa un correo inválido por construcción y ningún archivo de la semilla trae claves ni correos reales', () => {
  assert.match(DEMO_EMAIL, /@example\.invalid$/);
  for (const file of ['utils/demoSeed.js', 'utils/demoSeedData.js', 'scripts/seedStagingDemo.js']) {
    const text = read(file);
    const emails = text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/g) || [];
    assert.ok(emails.every((e) => e.endsWith('@example.invalid')), file + ': ' + emails.join(','));
    assert.doesNotMatch(text, /password\s*[:=]\s*['"][^'"]{6,}['"]/i, file); // ninguna clave literal
    assert.doesNotMatch(text, /console\.log\([^)]*(DEMO_USER_PASSWORD|password)/i, file); // la clave no se imprime
  }
});
