// ES-86 · Prueba del módulo REAL de cifrado del dominio profesional (no usa support.cjs, que sustituye utils/crypto por un doble).
const DATA_KEY = require('node:crypto').randomBytes(24).toString('hex');
const PRO_KEY = require('node:crypto').randomBytes(32).toString('hex');
process.env.DATA_ENCRYPTION_KEY = DATA_KEY;
process.env.NODE_ENV = 'test';
delete process.env.PROFESSIONAL_ENCRYPTION_KEY; delete process.env.PROFESSIONAL_KEY_ID;
delete process.env.PROFESSIONAL_ENCRYPTION_KEY_PREVIOUS; delete process.env.PROFESSIONAL_KEY_ID_PREVIOUS;

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const pro = require('../utils/professionalCrypto');
const { desencriptar, encriptarV2 } = require('../utils/crypto');

const setKeys = (env) => {
  for (const k of ['PROFESSIONAL_ENCRYPTION_KEY', 'PROFESSIONAL_KEY_ID', 'PROFESSIONAL_ENCRYPTION_KEY_PREVIOUS', 'PROFESSIONAL_KEY_ID_PREVIOUS']) delete process.env[k];
  Object.assign(process.env, env);
};
const run = (script, env) => spawnSync(process.execPath, ['-e', script], { encoding: 'utf8', env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, ...env } });
const modulePath = JSON.stringify(path.resolve(__dirname, '../utils/professionalCrypto'));
const cryptoPath = JSON.stringify(path.resolve(__dirname, '../utils/crypto'));

test('ES-86 sin clave profesional no hay clave por defecto: cifrar y descifrar fallan con un código claro', () => {
  setKeys({});
  assert.equal(pro.configured(), false);
  assert.throws(() => pro.encrypt('hola'), (e) => e instanceof pro.ProfessionalKeyError && e.code === 'professional_key_missing');
  setKeys({ PROFESSIONAL_ENCRYPTION_KEY: PRO_KEY });
  const sealed = pro.encrypt('hola');
  setKeys({});
  assert.throws(() => pro.decrypt(sealed), (e) => e.code === 'professional_key_missing');
  assert.throws(() => desencriptar(sealed), (e) => e.code === 'professional_key_missing', 'crypto.js tampoco devuelve el texto cifrado');
});

test('ES-86 ida y vuelta, formato con kid, IV distinto por mensaje y el texto no aparece cifrado', () => {
  setKeys({ PROFESSIONAL_ENCRYPTION_KEY: PRO_KEY, PROFESSIONAL_KEY_ID: 'p7' });
  for (const text of ['hola', '', 'ñandú — 日本語 😀', 'x'.repeat(20000), 'a:b:c', '{"key":"values","text":"autonomía"}']) {
    const sealed = pro.encrypt(text);
    assert.match(sealed, /^v2p:p7:[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]*$/);
    assert.equal(pro.decrypt(sealed), text);
    assert.equal(desencriptar(sealed), text, 'utils/crypto.desencriptar delega v2p: (lectura del API y exportación)');
  }
  assert.notEqual(pro.encrypt('igual'), pro.encrypt('igual'));
  assert.ok(!pro.encrypt('texto en claro').includes('texto en claro'));
  assert.equal(pro.keyIdOf(pro.encrypt('x')), 'p7');
  assert.equal(pro.keyIdOf(encriptarV2('x')), null);
});

test('ES-86 un dato alterado, truncado o con otro kid falla (el kid está autenticado)', () => {
  setKeys({ PROFESSIONAL_ENCRYPTION_KEY: PRO_KEY });
  const [prefix, kid, iv, tag, body] = pro.encrypt('contexto aprobado').split(':');
  const flip = (hex) => hex.slice(0, -1) + (hex.endsWith('0') ? '1' : '0');
  for (const tampered of [
    [prefix, kid, iv, tag, flip(body)], [prefix, kid, iv, flip(tag), body], [prefix, kid, flip(iv), tag, body],
    [prefix, kid, iv, tag], [prefix, kid, iv, tag, body, 'extra'], [prefix, kid, 'zz', 'zz', 'zz'], [prefix, kid],
  ]) {
    assert.throws(() => pro.decrypt(tampered.join(':')), (e) => e instanceof pro.ProfessionalDecryptionError && e.code === 'decryption_failed');
  }
  // Mismo secreto registrado bajo otro kid: sigue sin descifrar un dato cuyo kid fue cambiado (AAD).
  setKeys({ PROFESSIONAL_ENCRYPTION_KEY: PRO_KEY, PROFESSIONAL_KEY_ID: 'p1', PROFESSIONAL_ENCRYPTION_KEY_PREVIOUS: PRO_KEY, PROFESSIONAL_KEY_ID_PREVIOUS: 'p0' }); // misma clave bajo dos kid
  assert.throws(() => pro.decrypt([prefix, 'p0', iv, tag, body].join(':')), (e) => e.code === 'decryption_failed');
  assert.throws(() => pro.decrypt([prefix, 'zz', iv, tag, body].join(':')), (e) => e.code === 'unknown_key_id');
});

test('ES-86 la clave de datos no descifra lo profesional y la profesional no descifra lo privado (aislamiento entre dominios)', () => {
  setKeys({ PROFESSIONAL_ENCRYPTION_KEY: PRO_KEY });
  const professional = pro.encrypt('contexto profesional');
  const privateText = encriptarV2('diario privado');
  // Proceso con SOLO la clave de datos (el API antes de recibir la profesional, o un atacante con DATA_ENCRYPTION_KEY).
  const onlyData = run(`const c=require(${cryptoPath});
    try { c.desencriptar(${JSON.stringify(professional)}); console.log('NO-FALLO'); } catch (e) { console.log(e.code); }`, { DATA_ENCRYPTION_KEY: DATA_KEY, NODE_ENV: 'production' });
  assert.equal(onlyData.stdout.trim(), 'professional_key_missing', onlyData.stderr);
  // Proceso del WORKER: solo la clave profesional. No importa utils/crypto.js y no puede descifrar el diario.
  const worker = run(`const p=require(${modulePath}); const out=[p.decrypt(${JSON.stringify(professional)})];
    out.push(Object.keys(require.cache).some((f) => /utils[\\\\/]crypto\\.js$/.test(f)));
    try { p.decrypt(${JSON.stringify(privateText)}); out.push('NO-FALLO'); } catch (e) { out.push(e.code); }
    console.log(JSON.stringify(out));`, { PROFESSIONAL_ENCRYPTION_KEY: PRO_KEY, NODE_ENV: 'production' });
  assert.deepEqual(JSON.parse(worker.stdout.trim()), ['contexto profesional', false, 'decryption_failed'], worker.stderr);
  // Y con SOLO la clave profesional, el módulo de datos no descifra lo privado (no devuelve texto cifrado).
  const workerData = run(`const c=require(${cryptoPath});
    try { c.desencriptar(${JSON.stringify(privateText)}); console.log('NO-FALLO'); } catch (e) { console.log(e.code); }`, { PROFESSIONAL_ENCRYPTION_KEY: PRO_KEY, DATA_ENCRYPTION_KEY: 'clave-ajena-distinta-0123456789ab', NODE_ENV: 'test' });
  assert.equal(workerData.stdout.trim(), 'decryption_failed');
});

test('ES-86 claves inválidas: corta, igual a la de datos, kid mal formado o repetido; los errores no filtran material de clave', () => {
  const secrets = [];
  const attempt = (env) => {
    setKeys(env); secrets.push(...Object.values(env));
    try { pro.encrypt('x'); return null; } catch (e) { return e; }
  };
  for (const env of [
    { PROFESSIONAL_ENCRYPTION_KEY: 'corta' },
    { PROFESSIONAL_ENCRYPTION_KEY: DATA_KEY },
    { PROFESSIONAL_ENCRYPTION_KEY: PRO_KEY, PROFESSIONAL_KEY_ID: 'MAYUS' },
    { PROFESSIONAL_ENCRYPTION_KEY: PRO_KEY, PROFESSIONAL_KEY_ID: 'p1', PROFESSIONAL_ENCRYPTION_KEY_PREVIOUS: PRO_KEY.replace(/./, 'a') + 'b', PROFESSIONAL_KEY_ID_PREVIOUS: 'p1' },
    { PROFESSIONAL_ENCRYPTION_KEY: PRO_KEY, PROFESSIONAL_ENCRYPTION_KEY_PREVIOUS: 'z'.repeat(40) }, // la anterior exige su kid
  ]) {
    const error = attempt(env);
    assert.ok(error instanceof pro.ProfessionalKeyError && error.code === 'professional_key_invalid', JSON.stringify(Object.keys(env)));
    for (const secret of secrets) assert.ok(!error.message.includes(secret), 'el mensaje no incluye la clave');
  }
});

test('ES-86 rotación: la clave anterior solo descifra; lo nuevo se cifra con la vigente', () => {
  const OLD = require('node:crypto').randomBytes(32).toString('hex');
  setKeys({ PROFESSIONAL_ENCRYPTION_KEY: OLD, PROFESSIONAL_KEY_ID: 'p1' });
  const legacy = pro.encrypt('guardado con p1');
  setKeys({ PROFESSIONAL_ENCRYPTION_KEY: PRO_KEY, PROFESSIONAL_KEY_ID: 'p2', PROFESSIONAL_ENCRYPTION_KEY_PREVIOUS: OLD, PROFESSIONAL_KEY_ID_PREVIOUS: 'p1' });
  assert.equal(pro.decrypt(legacy), 'guardado con p1');
  assert.equal(pro.keyIdOf(pro.encrypt('nuevo')), 'p2');
  setKeys({ PROFESSIONAL_ENCRYPTION_KEY: PRO_KEY, PROFESSIONAL_KEY_ID: 'p2' }); // retirada la anterior
  assert.throws(() => pro.decrypt(legacy), (e) => e.code === 'unknown_key_id');
});
