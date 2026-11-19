// ES-324 (E305-2) · POST /api/register: un nombre demasiado largo (o con caracteres de control, p. ej. NUL) responde 400 de código estable, nunca 500. HTTP REAL contra el server.js real y PostgreSQL REAL
// (migraciones reales). 0 IA, datos sintéticos. Antes, un `name` de 5.000 caracteres desbordaba la columna (varchar 255) y respondía 500.
//   ES324_TEST_DATABASE_URL=postgres://elevation:elevation_local@127.0.0.1:54391/postgres node --test test/integration/es-324-postgres.cjs
// @pg-env ES324_TEST_DATABASE_URL=postgres://elevation:elevation_local@127.0.0.1:54391/postgres
const { test } = require('node:test');
const assert = require('node:assert/strict');
process.env.LOGIN_RATE_LIMIT_MAX = '100000'; process.env.PASSWORD_RESET_IP_LIMIT = '100000';
process.env.REGISTER_RATE_LIMIT_MAX = '100000';
const { startRealApi } = require('../support/realApi.cjs');

test('ES-324 PostgreSQL + HTTP: nombre largo / con caracteres de control / de tipo erróneo → 400 estable sin crear cuenta; el registro normal sigue igual', { timeout: 600000 }, async (t) => {
  const { q, http } = await startRealApi(t, { envVar: 'ES324_TEST_DATABASE_URL', prefix: 'es324' });
  const PASSWORD = 'Sintetica-Clave-2026!';
  let n = 0; const mail = () => `persona${++n}@example.invalid`;
  const register = (patch = {}) => http(null, 'POST', '/api/register', { name: 'Persona Sintética', email: mail(), password: PASSWORD, acceptedTerms: true, termsVersion: '2026-11-v2', ...patch });
  const people = async () => Number((await q('SELECT count(*) n FROM "Users"'))[0].n);

  await t.test('nombre de 5.000 caracteres: 400 invalid_name (antes 500); sin cuenta creada; el cuerpo no repite lo recibido', async () => {
    const before = await people(); const long = 'A'.repeat(5000);
    const out = await register({ name: long });
    assert.equal(out.status, 400, JSON.stringify(out.body).slice(0, 200)); assert.equal(out.body.code, 'invalid_name'); assert.match(out.body.error, /Nombre inválido\. \/ Invalid name\./);
    assert.ok(!JSON.stringify(out.body).includes('AAAA'), 'no repite el nombre'); assert.equal(await people(), before);
  });

  await t.test('límite exacto: 100 caracteres entran (201), 101 no (400); cuenta en caracteres, no en bytes (acentos, ñ y emoji)', async () => {
    assert.equal((await register({ name: 'N'.repeat(100) })).status, 201);
    assert.equal((await register({ name: 'N'.repeat(101) })).status, 400);
    assert.equal((await register({ name: 'ñ'.repeat(100) })).status, 201, '100 eñes = 200 bytes');
    assert.equal((await register({ name: '😀'.repeat(100) })).status, 201, '100 emojis, cada uno de 2 unidades UTF-16');
    assert.equal((await register({ name: '😀'.repeat(101) })).status, 400);
    assert.equal((await register({ name: ' ' + 'N'.repeat(99) + ' ' })).status, 201, 'los espacios a los lados no cuentan');
  });

  await t.test('se guarda el MISMO valor que se validó (recortado): relleno de 500 espacios ASCII o NBSP a los lados NO desborda la columna (antes 500 o truncado en silencio); el interior largo sigue siendo 400', async () => {
    const before = await people();
    for (const [label, name, expected] of [['espacios ASCII al final', 'Ana' + ' '.repeat(500), 'Ana'], ['NBSP al final', 'Ana' + ' '.repeat(500), 'Ana'], ['espacios a ambos lados', ' '.repeat(300) + 'Luis' + ' '.repeat(300), 'Luis'], ['tabulador y NBSP mezclados', '   Eva' + '  '.repeat(400), 'Eva'], ['espacios ideográficos', '　'.repeat(400) + 'Mei' + '　'.repeat(400), 'Mei']]) {
      const email = mail(); const out = await register({ name, email }); assert.equal(out.status, 201, label + ': ' + JSON.stringify(out.body));
      const rows = await q('SELECT name FROM "Users" WHERE email = $1', [email]); assert.deepEqual(rows.map((r) => r.name), [expected], label + ': el nombre guardado es el recortado, no el original');
    }
    for (const name of ['A' + ' '.repeat(500) + 'B', 'A' + ' '.repeat(120) + 'B', ' '.repeat(400)]) { const out = await register({ name }); assert.equal(out.status, 400, JSON.stringify(name.length)); assert.equal(out.body.code, name.trim() ? 'invalid_name' : 'invalid_input'); }
    assert.equal(await people(), before + 5, 'solo las 5 cuentas válidas; las 3 rechazadas no dejan fila');
  });

  await t.test('entradas inválidas del nombre: NUL, controles, saltos de línea, tipos erróneos y vacío → 400 estable (nunca 500), sin cuenta creada', async () => {
    const before = await people();
    for (const name of ['Ana\u0000Pérez', 'Ana\u0007', 'Ana\nPérez', 'Ana\u0085Pérez', ' ', '', null, 123, true, {}, [], ['Ana'], { toString: 'x' }]) {
      const out = await register({ name });
      assert.equal(out.status, 400, `${JSON.stringify(name)} → ${out.status} ${JSON.stringify(out.body).slice(0, 120)}`);
      assert.ok(['invalid_name', 'invalid_input'].includes(out.body.code), `código estable: ${JSON.stringify(out.body)}`);
    }
    assert.equal((await register({ name: undefined })).status, 400);
    assert.equal(await people(), before, 'ninguna de las 15 entradas creó una cuenta');
  });

  await t.test('nombres legítimos siguen entrando: acentos, ñ, apóstrofo, guion, mayúsculas, escrituras no latinas y ZWNJ persa (no se rechaza el formato Unicode)', async () => {
    for (const name of ["María José", "Núñez-Peña", "O'Brien", 'Zoë', 'Ольга Иванова', 'Αθανάσιος', 'محمد', 'می\u200cخواهم']) {
      const out = await register({ name }); assert.equal(out.status, 201, `${name}: ${JSON.stringify(out.body)}`);
    }
    const saved = await q(`SELECT name FROM "Users" WHERE name = $1`, ['Núñez-Peña']); assert.equal(saved.length, 1);
  });

  await t.test('el resto del registro no cambia: correo/contraseña inválidos siguen con sus códigos y el duplicado sigue igual (sin regresión)', async () => {
    assert.equal((await register({ email: 'sin-arroba' })).body.code, 'invalid_email');
    assert.equal((await register({ password: 'corta' })).body.code, 'password_policy');
    const email = mail(); assert.equal((await register({ email })).status, 201); const dup = await register({ email }); assert.equal(dup.status, 400); assert.match(dup.body.error, /ya está registrado/);
  });
});
