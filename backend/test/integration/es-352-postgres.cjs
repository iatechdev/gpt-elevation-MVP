// ES-352 · NOMBRES con caracteres invisibles o de dirección: registro e invitación. HTTP REAL contra el server.js real y PostgreSQL REAL (migraciones reales). 0 IA, datos sintéticos.
// Decisión de Infra (reversible): se RECHAZA con 400 `invalid_name` (controles, U+200B, U+200E/200F, U+202A–202E, U+2066–2069, U+2028/2029, U+FEFF; además tags y U+2060) y se PERMITEN ZWNJ, ZWJ y selectores de variación.
//   ES352_TEST_DATABASE_URL=postgres://elevation:elevation_local@127.0.0.1:54391/postgres node --test test/integration/es-352-postgres.cjs
// @pg-env ES352_TEST_DATABASE_URL=postgres://elevation:elevation_local@127.0.0.1:54391/postgres
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
process.env.LOGIN_RATE_LIMIT_MAX = '100000'; process.env.PASSWORD_RESET_IP_LIMIT = '100000';
process.env.REGISTER_RATE_LIMIT_MAX = '100000'; process.env.INVITATION_ACCEPT_LIMIT = '100000';
const { startRealApi } = require('../support/realApi.cjs');
const { makeSeeder } = require('../support/seedRow.cjs');

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const BAD = {
  'ZWSP en medio': 'An\u{200B}a', 'solo ZWSP': '\u{200B}', 'RLO': '\u{202E}anA', 'LRM': 'Ana\u{200E}', 'RLM': 'Ana\u{200F}', 'isolate U+2067': '\u{2067}Ana', 'pop U+2069': 'Ana\u{2069}',
  'separador de línea U+2028': 'Ana\u{2028}Pérez', 'separador de párrafo U+2029': 'Ana\u{2029}Pérez', 'BOM al inicio': '\u{FEFF}Ana', 'tag': 'Ana\u{E0041}', 'word joiner': 'An\u{2060}a', 'NUL': 'Ana\u{0}', 'salto de línea': 'Ana\nPérez',
  'solo signos de puntuación': '!!!', 'solo ZWNJ/ZWJ (nada que dibujar)': '\u{200C}\u{200D}',
  // E397-1 (QA-Claude-5): nombres que SE VEN en blanco
  'braille en blanco U+2800': '\u{2800}', 'relleno Hangul U+3164': '\u{3164}', 'relleno Hangul U+FFA0': 'Ana\u{FFA0}', 'fillers U+115F/1160': '\u{115F}\u{1160}', 'CGJ U+034F': 'A\u{034F}na', 'vocal jemer U+17B4': '\u{17B4}', 'marca combinante suelta': '\u{0301}', 'ALM U+061C': 'Ana\u{061C}', 'separador mongol U+180E': 'Ana\u{180E}',
};
const GOOD = { 'persa con ZWNJ': 'می\u{200C}خواهم', 'árabe': 'محمد', 'hebreo': 'דוד כהן', 'índica con ZWJ': 'क्\u{200D}ष', 'emoji compuesto con letras': 'Ana 👨\u{200D}👩\u{200D}👧', 'selector de variación': 'Ana ❤\u{FE0F}', 'acentos': 'María José Núñez-Peña' };

test('ES-352 PostgreSQL + HTTP: el nombre con caracteres invisibles o de dirección se rechaza (400 invalid_name, sin cuenta) y los legítimos se guardan tal cual', { timeout: 600000 }, async (t) => {
  const { q, mkUser, http } = await startRealApi(t, { envVar: 'ES352_TEST_DATABASE_URL', prefix: 'es352' });
  const seed = makeSeeder(q);
  const PASSWORD = 'Sintetica-Clave-2026!';
  let n = 0; const mail = () => `persona${++n}@example.invalid`;
  const people = async () => Number((await q('SELECT count(*) n FROM "Users"'))[0].n);
  const register = (patch = {}) => http(null, 'POST', '/api/register', { name: 'Persona Sintética', email: mail(), password: PASSWORD, acceptedTerms: true, termsVersion: '2026-11-v2', ...patch });
  const inviter = await mkUser('superadmin');
  const invite = async () => { const token = crypto.randomBytes(16).toString('hex'); await seed('Invitations', { email: mail(), role: 'user', invitedBy: inviter.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 3600000), usedAt: null, locale: 'es', requestId: null }); return token; };
  const accept = (token, name) => http(null, 'POST', '/api/invitations/accept', { token, name, password: PASSWORD, acceptedTerms: true, termsVersion: '2026-11-v2' });

  await t.test('registro: cada nombre inválido → 400 invalid_name, sin crear la cuenta y sin repetir lo recibido', async () => {
    const before = await people();
    for (const [label, name] of Object.entries(BAD)) {
      const out = await register({ name });
      assert.equal(out.status, 400, `${label}: ${JSON.stringify(out.body)}`); assert.equal(out.body.code, 'invalid_name', label);
      assert.match(out.body.error, /Nombre inválido\. \/ Invalid name\./); assert.ok(!JSON.stringify(out.body).includes(name.trim()) || name.trim() === '', `${label}: el cuerpo no repite el nombre`);
    }
    assert.equal(await people(), before, 'ninguna cuenta se creó');
  });

  await t.test('registro: los nombres legítimos (ZWNJ, ZWJ, selector de variación, escrituras no latinas) entran y se guardan EXACTAMENTE como se escribieron', async () => {
    for (const [label, name] of Object.entries(GOOD)) {
      const out = await register({ name: `  ${name}  ` }); assert.equal(out.status, 201, `${label}: ${JSON.stringify(out.body)}`);
      const saved = await q('SELECT name FROM "Users" WHERE name = $1', [name]); assert.equal(saved.length, 1, `${label}: guardado sin borrar ningún carácter`);
    }
  });

  await t.test('invitación: la misma regla; un nombre inválido responde 400 invalid_name y NO gasta el enlace; uno legítimo crea la cuenta con el nombre exacto', async () => {
    for (const [label, name] of Object.entries(BAD)) {
      const token = await invite(); const out = await accept(token, name);
      assert.equal(out.status, 400, `${label}: ${JSON.stringify(out.body)}`); assert.equal(out.body.code, 'invalid_name', label);
      assert.equal((await q('SELECT "usedAt" FROM "Invitations" WHERE "tokenHash"=$1', [sha256(token)]))[0].usedAt, null, `${label}: el enlace no se gasta`);
    }
    for (const [label, name] of Object.entries(GOOD)) {
      const token = await invite(); const out = await accept(token, name); assert.equal(out.status, 201, `${label}: ${JSON.stringify(out.body).slice(0, 160)}`);
      assert.equal((await q('SELECT name FROM "Users" WHERE name = $1', [name])).length >= 1, true, `${label}: guardado exacto`);
    }
  });

  await t.test('invitación: el recorte de trim() no deja pasar BOM ni U+2028 en los bordes (se valida el texto SIN recortar)', async () => {
    for (const name of ['\u{FEFF}Ana', 'Ana\u{FEFF}', '\u{2028}Ana', 'Ana\u{2029}']) {
      const token = await invite(); const out = await accept(token, name); assert.equal(out.status, 400, JSON.stringify(name)); assert.equal(out.body.code, 'invalid_name');
    }
  });

  await t.test('sin regresión: el límite de 100 puntos de código, el correo y la contraseña conservan sus códigos', async () => {
    assert.equal((await register({ name: 'Ж'.repeat(100) })).status, 201);
    assert.equal((await register({ name: 'Ж'.repeat(101) })).body.code, 'invalid_name');
    assert.equal((await register({ name: '𝒜'.repeat(100) })).status, 201, '100 puntos de código astrales');
    assert.equal((await register({ email: 'sin-arroba' })).body.code, 'invalid_email');
    assert.equal((await register({ password: 'corta' })).body.code, 'password_policy');
  });

  await t.test('el registro no normaliza en silencio: un ZWJ legítimo se conserva (el texto libre del chat tampoco se rechaza; eso no cambia)', async () => {
    const out = await register({ name: 'Ana\u{200D}Pérez' }); assert.equal(out.status, 201);
    assert.equal((await q('SELECT name FROM "Users" WHERE name = $1', ['Ana\u{200D}Pérez'])).length, 1, 'ZWJ conservado');
  });
});
