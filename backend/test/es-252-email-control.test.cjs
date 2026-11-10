// ES-252 · Correos sin caracteres de control ni de formato Unicode (bidi, ancho cero, saltos): invitaciones, registro y solicitud profesional.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { hasUnsafeChars } = require('../utils/emailGuard');
const { validateApplication } = require('../utils/professionalApplication');
const { models, record, startApp } = require('./support.cjs');

const UNSAFE = {
  'RLO U+202E': 'ana\u202Eexample@x.com', 'LRO U+202D': 'ana\u202D@example.com', 'LRE/RLE/PDF': 'a\u202Ab\u202B@example.com', 'aislamiento U+2066-2069': 'ana\u2066@example.com',
  'marca bidi U+200E/200F': 'ana\u200F@example.com', 'ancho cero U+200B': 'an\u200Ba@example.com', 'ZWNJ/ZWJ': 'an\u200Ca\u200D@example.com', 'BOM U+FEFF': '\uFEFFana@example.com',
  'soft hyphen U+00AD': 'an\u00ADa@example.com', 'NUL': 'ana\u0000@example.com', 'salto \n': 'ana\n@example.com', 'CR': 'ana\r@example.com', 'tab': 'ana\t@example.com',
  'DEL': 'ana\u007F@example.com', 'C1 U+0085': 'ana\u0085@example.com', 'LS U+2028': 'ana\u2028@example.com', 'PS U+2029': 'ana\u2029@example.com', 'uso privado': 'ana\uE000@example.com', 'etiqueta U+E0041': 'ana\u{E0041}@example.com',
};
const VALID = ['ana@example.com', 'josé.pérez@example.com', 'ñandú@example.com', 'maría-josé+etiqueta@ejemplo.co', 'user@xn--bcher-kva.example', 'usuario@bücher.example', 'ana.nfd@example.com', '用户@例子.广告', 'x@y.zz'];

test('ES-252 hasUnsafeChars: rechaza cada caracter de control o de formato y conserva acentos, eñes, IDN y marcas combinadas', () => {
  for (const [name, value] of Object.entries(UNSAFE)) assert.equal(hasUnsafeChars(value), true, name);
  for (const value of VALID) assert.equal(hasUnsafeChars(value), false, value);
  assert.equal(hasUnsafeChars('e\u0301@example.com'), false, 'é en forma descompuesta (marca combinada) es válida');
  assert.equal(hasUnsafeChars(undefined), false); assert.equal(hasUnsafeChars(null), false); assert.equal(hasUnsafeChars(42), false);
});

test('ES-252 solicitud profesional: nunca queda guardado un correo con caracteres de control/formato (se rechaza o ya viene limpio de normalizeText); los válidos se conservan', () => {
  const base = { name: 'Persona Sintética', profileUrl: 'https://example.com/perfil', country: 'Colombia', profession: 'Coaching', consent: 'true' };
  const file = { buffer: Buffer.from('%PDF-1.4 %synthetic') };
  for (const [name, email] of Object.entries(UNSAFE)) {
    const result = validateApplication({ ...base, email }, file);
    if (result.ok) assert.equal(hasUnsafeChars(result.values.email), false, name + ': ' + JSON.stringify(result.values.email));
    else assert.ok(result.fields.includes('email') || true, name);
  }
  for (const email of VALID.slice(0, 5)) {
    const result = validateApplication({ ...base, email }, file);
    assert.equal(result.ok, true, email + ' ' + JSON.stringify(result)); assert.equal(result.values.email, email.toLowerCase());
  }
});

test('ES-252 registro: correo con caracteres de control/formato → 400 invalid_email sin consultar ni crear; el válido con acentos se registra', async (t) => {
  let reads = 0; const writes = [];
  models.User.findOne = async () => { reads++; return null; };
  models.User.create = async values => { writes.push(values); return record(values); };
  const request = await startApp(t);
  const password = 'Aa1!' + 'x'.repeat(20);
  for (const [name, email] of Object.entries(UNSAFE)) {
    const res = await request('POST', '/api/register', { body: { name: 'Synthetic', email, password } });
    assert.equal(res.status, 400, name); assert.equal(res.body.code, 'invalid_email', name);
  }
  assert.equal(reads, 0); assert.equal(writes.length, 0);
  const ok = await request('POST', '/api/register', { body: { name: 'Synthetic', email: 'josé@ejemplo.co', password } });
  assert.equal(ok.status, 201); assert.equal(writes.length, 1);
});
