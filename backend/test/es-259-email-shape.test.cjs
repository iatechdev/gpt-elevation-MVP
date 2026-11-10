// ES-259 · Correo: forma y longitud máxima (254) en registro y solicitud profesional, con la misma regla que invitaciones.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { isValidEmail } = require('../utils/emailGuard');
const { validateApplication } = require('../utils/professionalApplication');
const { models, record, startApp } = require('./support.cjs');

const long = (n) => 'a'.repeat(n - '@example.com'.length) + '@example.com';
const max254 = 'a'.repeat(64) + '@' + 'b'.repeat(185) + '.com'; // 254: parte local ≤ 64 y dominio ≤ 190+punto+TLD
const INVALID = {
  'enorme 260': long(260), 'enorme 5000': long(5000), 'justo 255': long(255), 'parte local de 65': 'a'.repeat(65) + '@example.com',
  coma: 'ana,perez@example.com', 'coma en dominio': 'ana@exa,mple.com', 'punto y coma': 'ana;x@example.com', espacio: 'ana perez@example.com', 'espacio final interno': 'ana@example .com',
  'doble @': 'ana@@example.com', 'dos @ separados': 'ana@foo@example.com', 'sin @': 'anaexample.com', 'sin dominio': 'ana@', 'sin parte local': '@example.com', 'sin punto': 'ana@example',
  'TLD de 1': 'ana@example.c', 'angulares': '<ana@example.com>', comillas: '"ana"@example.com', paréntesis: 'ana(x)@example.com', 'barra invertida': 'ana\\x@example.com', 'inyección SQL': "ana'--@example.com",
};
const VALID = ['ana@example.com', 'josé.pérez@example.com', 'maría-josé+etiqueta@ejemplo.co', 'user@xn--bcher-kva.example', 'usuario@bücher.example', '用户@例子.广告', 'x@y.zz', max254, 'a'.repeat(64) + '@example.com'];

test('ES-259 isValidEmail: rechaza enormes, comas, espacios y doble @; conserva válidos e IDN', () => {
  for (const [name, value] of Object.entries(INVALID)) assert.equal(isValidEmail(value), false, name);
  for (const value of VALID) assert.equal(isValidEmail(value), true, value.slice(0, 40));
  for (const value of [undefined, null, 42, {}, []]) assert.equal(isValidEmail(value), false);
});

test('ES-259 solicitud profesional: coma, doble @ y longitud → campo email inválido; los válidos se aceptan en minúsculas', () => {
  const base = { name: 'Persona Sintética', profileUrl: 'https://example.com/perfil', country: 'Colombia', profession: 'Coaching', consent: 'true' };
  const file = { buffer: Buffer.from('%PDF-1.4 %synthetic') };
  for (const [name, email] of Object.entries(INVALID)) {
    const r = validateApplication({ ...base, email }, file);
    assert.equal(r.ok, false, name); assert.ok(r.fields.includes('email'), name);
    assert.equal(JSON.stringify(r).includes(email.slice(0, 20)) && email.length > 20, false, 'no repite el valor recibido');
  }
  for (const email of ['Ana@Example.com', 'josé.pérez@example.com', 'usuario@bücher.example']) {
    const r = validateApplication({ ...base, email }, file);
    assert.equal(r.ok, true, email); assert.equal(r.values.email, email.toLowerCase());
  }
});

test('ES-259 registro: nunca 5xx por el correo; forma/longitud inválida → 400 invalid_email sin consultar ni crear; válidos se registran', async (t) => {
  let reads = 0; const writes = [];
  models.User.findOne = async () => { reads++; return null; };
  models.User.create = async values => { writes.push(values); return record(values); };
  const request = await startApp(t);
  const password = 'Aa1!' + 'x'.repeat(20);
  for (const [name, email] of Object.entries(INVALID)) {
    const res = await request('POST', '/api/register', { body: { name: 'Synthetic', email, password } });
    assert.equal(res.status, 400, name); assert.equal(res.body.code, 'invalid_email', name);
  }
  assert.equal(reads, 0); assert.equal(writes.length, 0);
  for (const email of ['josé@ejemplo.co', 'usuario@bücher.example', max254]) {
    const ok = await request('POST', '/api/register', { body: { name: 'Synthetic', email, password } });
    assert.equal(ok.status, 201, email.slice(0, 30));
  }
  assert.equal(writes.length, 3);
});
