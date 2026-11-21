// ES-336 (F1): forma y límites del contenido de un documento legal (función pura; la prueba con PostgreSQL y HTTP está en integration/es-336-postgres.cjs).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateContent, hasMarkers, contentHash, DOC_KEYS, LANGS, LIMITS } = require('../utils/legalContent');
const seed = require('../seeds/legalSeed.json');
const { TERMS } = require('../utils/terms');

const doc = (paragraph) => ({ title: 'Título', sections: [{ heading: 'Sección', paragraphs: [paragraph] }] });

test('ES-336: listas cerradas de documentos e idiomas (los 7 del borrador del abogado, ES y EN)', () => {
  assert.deepEqual([...DOC_KEYS], ['privacy', 'terms', 'non_clinical', 'cookies', 'sharing', 'feedback', 'retention']);
  assert.deepEqual([...LANGS], ['es', 'en']);
});

test('ES-336: la semilla es válida, de la versión vigente, con privacidad y términos en ES y EN, y trae los marcadores del borrador (ES-301)', () => {
  assert.equal(seed.version, TERMS.version);
  assert.deepEqual(seed.documents.map((d) => `${d.docKey}/${d.lang}`).sort(), ['privacy/en', 'privacy/es', 'terms/en', 'terms/es']);
  for (const d of seed.documents) {
    const out = validateContent(d.content);
    assert.equal(out.ok, true, `${d.docKey}/${d.lang}: ${JSON.stringify(out)}`);
    assert.equal(hasMarkers(out.value), true, 'el borrador de hoy sigue con marcadores [[…]]: la semilla no los quita');
  }
});

test('ES-336: texto normal con **negrita**, [[marcadores]], «data:» a secas, ZWNJ persa y ZWJ de emoji compuesto es válido', () => {
  for (const text of ['Usa **negrita** y [[POR COMPLETAR: fecha]].', 'Personal data: nombre y correo.', 'می‌خواهم', '👨‍👩‍👧 familia', 'Línea con ñ, é y — raya.']) {
    assert.equal(validateContent(doc(text)).ok, true, text);
  }
});

test('ES-336: HTML, esquemas ejecutables, controles y separadores de línea se rechazan', () => {
  const cases = ['<script>alert(1)</script>', '<img src=x onerror=alert(1)>', 'a <b>negrita</b>', '<!-- x -->', '<?xml ?>', 'javascript:alert(1)', 'JaVaScRiPt : x', 'vbscript:x', 'data:text/html;base64,AAAA', 'data: image/png;base64,AA',
    'dos\nlíneas', 'nul\u0000', 'bell\u0007', 'next\u0085line', 'sep arador', 'par rafo'];
  for (const text of cases) assert.equal(validateContent(doc(text)).ok, false, JSON.stringify(text));
  assert.equal(validateContent(doc('<script>x</script>')).reason, 'html_not_allowed');
  assert.equal(validateContent(doc('javascript:alert(1)')).reason, 'script_not_allowed');
  assert.equal(validateContent(doc('nul\u0000')).reason, 'control_character');
});

test('ES-336: formas inválidas y límites', () => {
  for (const bad of [null, [], 'x', {}, { title: 'T' }, { title: 'T', sections: [] }, { title: '', sections: [{ paragraphs: ['a'] }] }, { title: 'T', sections: [{}] }, { title: 'T', sections: [{ paragraphs: [] }] },
    { title: 'T', sections: [{ paragraphs: [5] }] }, { title: 'T', sections: [{ paragraphs: 'a' }] }, { title: 'T', sections: ['a'] }, { title: 'T', banner: 5, sections: [{ paragraphs: ['a'] }] }]) {
    assert.equal(validateContent(bad).ok, false, JSON.stringify(bad));
  }
  assert.equal(validateContent(doc('a'.repeat(LIMITS.text))).ok, true);
  assert.equal(validateContent(doc('a'.repeat(LIMITS.text + 1))).reason, 'too_long');
  assert.equal(validateContent({ title: 'T'.repeat(LIMITS.title + 1), sections: [{ paragraphs: ['a'] }] }).reason, 'too_long');
  assert.equal(validateContent({ title: 'T', sections: Array.from({ length: LIMITS.sections + 1 }, () => ({ paragraphs: ['a'] })) }).reason, 'invalid_list');
  const huge = { title: 'T', sections: Array.from({ length: 60 }, () => ({ paragraphs: Array.from({ length: 50 }, () => 'x'.repeat(LIMITS.text / 20)) })) }; // > 200 KB
  assert.equal(validateContent(huge).reason, 'too_large');
  assert.equal(validateContent({ title: 'T', sections: [{ paragraphs: ['😀'.repeat(LIMITS.text)] }] }).ok, true, 'la longitud se cuenta en puntos de código, no en unidades UTF-16');
});

test('ES-336: solo se conservan las claves permitidas y los textos se recortan (no entra nada extra)', () => {
  const out = validateContent({ title: '  T  ', evil: '<x>', sections: [{ heading: ' H ', paragraphs: [' p '], extra: 1, bullets: [' b '] }] });
  assert.equal(out.ok, true);
  assert.deepEqual(out.value, { title: 'T', sections: [{ heading: 'H', paragraphs: ['p'], bullets: ['b'] }] });
});

test('ES-336: el hash es estable (no depende del orden de las claves) y cambia con el contenido', () => {
  const a = validateContent({ title: 'T', banner: 'B', sections: [{ heading: 'H', paragraphs: ['p'] }] }).value;
  const b = validateContent({ sections: [{ paragraphs: ['p'], heading: 'H' }], banner: 'B', title: 'T' }).value;
  assert.equal(contentHash(a), contentHash(b)); assert.match(contentHash(a), /^[0-9a-f]{64}$/);
  assert.notEqual(contentHash(a), contentHash({ ...a, title: 'T2' }));
});
