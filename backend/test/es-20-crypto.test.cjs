// Prueba del módulo REAL de cifrado (no usa support.cjs, que lo sustituye por un doble).
process.env.DATA_ENCRYPTION_KEY = require('node:crypto').randomBytes(24).toString('hex');
process.env.NODE_ENV = 'test';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { encriptar, encriptarV2, desencriptar, DecryptionError } = require('../utils/crypto');

test('ES-20 cifrado v2: ida y vuelta, IV distinto por mensaje y formato esperado', () => {
  for (const text of ['hola', '', 'ñandú — 日本語 😀', 'x'.repeat(20000), 'a:b:c']) {
    const sealed = encriptarV2(text);
    assert.match(sealed, /^v2:[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]*$/);
    assert.equal(desencriptar(sealed), text);
  }
  assert.notEqual(encriptarV2('igual'), encriptarV2('igual'));
  assert.ok(!encriptarV2('texto en claro').includes('texto en claro'));
});

test('ES-20 cifrado v2: un dato alterado o truncado falla en vez de devolver texto cifrado', () => {
  const sealed = encriptarV2('mensaje privado');
  const [prefix, iv, tag, body] = sealed.split(':');
  const flip = hex => hex.slice(0, -1) + (hex.endsWith('0') ? '1' : '0');
  for (const tampered of [
    [prefix, iv, tag, flip(body)].join(':'),
    [prefix, iv, flip(tag), body].join(':'),
    [prefix, flip(iv), tag, body].join(':'),
    [prefix, iv, tag].join(':'),
    prefix + ':',
    'v2:zz:zz:zz',
  ]) {
    assert.throws(() => desencriptar(tampered), error => error instanceof DecryptionError && error.code === 'decryption_failed');
  }
});

test('ES-20 cifrado v2: otra clave no descifra (falla) y el mensaje de error no filtra datos', () => {
  const sealed = encriptarV2('mensaje privado');
  const script = `process.env.DATA_ENCRYPTION_KEY='otra-clave-distinta-0123456789'; const c=require(${JSON.stringify(path.resolve(__dirname, '../utils/crypto'))});
    try { c.desencriptar(${JSON.stringify(sealed)}); console.log('NO-FALLO'); } catch (e) { console.log(e.code + '|' + e.message); }`;
  const result = spawnSync(process.execPath, ['-e', script], { encoding: 'utf8', env: { ...process.env, NODE_ENV: 'test' } });
  assert.match(result.stdout, /^decryption_failed\|/);
  assert.doesNotMatch(result.stdout, /mensaje privado|NO-FALLO/);
});

test('ES-20 cifrado: los datos heredados (CBC y texto plano) siguen siendo legibles', () => {
  assert.equal(desencriptar(encriptar('dato heredado')), 'dato heredado');
  assert.equal(desencriptar('texto plano antiguo sin cifrar'), 'texto plano antiguo sin cifrar');
  assert.match(encriptar('x'), /^[0-9a-f]{32}:[0-9a-f]+$/); // el formato heredado no cambia
});
