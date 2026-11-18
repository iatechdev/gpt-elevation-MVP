// ES-326 (E301-4) · Quien acepta una invitación también acepta el aviso de privacidad y los términos: el SERVIDOR pone versión y fecha, con los mismos 400 estables que el registro.
// HTTP REAL contra el server.js real y PostgreSQL REAL (migraciones reales). 0 IA, sin correo real. Sin aceptación no se crea ni se activa la cuenta y el enlace NO se gasta.
//   ES326_TEST_DATABASE_URL=postgres://elevation:elevation_local@127.0.0.1:54391/postgres node --test test/integration/es-326-postgres.cjs
// @pg-env ES326_TEST_DATABASE_URL=postgres://elevation:elevation_local@127.0.0.1:54391/postgres
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
process.env.INVITATION_ACCEPT_LIMIT = '100000'; // el límite real (10 por minuto) no aplica a una ráfaga sintética desde 127.0.0.1
const { startRealApi } = require('../support/realApi.cjs');
const { makeSeeder } = require('../support/seedRow.cjs');

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

test('ES-326 PostgreSQL + HTTP: /api/invitations/accept exige y guarda la aceptación (versión y fecha del servidor)', { timeout: 600000 }, async (t) => {
  const { q, http, mkUser } = await startRealApi(t, { envVar: 'ES326_TEST_DATABASE_URL', prefix: 'es326' });
  const terms = require('../../utils/terms');
  const seed = makeSeeder(q);
  const PASSWORD = 'Sintetica-Clave-2026!'; const VERSION = terms.current().version;
  assert.equal(VERSION, '2026-11-v2', 'constante REAL del servidor');
  const sup = await mkUser('superadmin');
  let seq = 0;
  const invite = async (role = 'user') => {
    seq += 1; const token = crypto.randomBytes(32).toString('base64url'); const email = `es326-${seq}-${crypto.randomBytes(3).toString('hex')}@example.invalid`;
    await seed('Invitations', { email, role, invitedBy: sup.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 3600000), usedAt: null, locale: 'es', requestId: null });
    return { token, email };
  };
  const accept = (token, patch = {}) => http(null, 'POST', '/api/invitations/accept', { token, name: 'Persona Invitada', password: PASSWORD, ...patch });
  const user = async (email) => (await q('SELECT id, active, role, "termsVersion", "acceptedAt" FROM "Users" WHERE email=$1', [email]))[0];
  const link = async (email) => (await q('SELECT "usedAt", "acceptedUserId" FROM "Invitations" WHERE email=$1', [email]))[0];
  const total = async () => Number((await q('SELECT count(*) n FROM "Users"'))[0].n);

  await t.test('sin aceptación o con aceptación inválida: 400 estable, sin cuenta y el enlace NO se gasta (y luego el mismo enlace funciona)', async () => {
    const { token, email } = await invite(); const before = await total();
    const cases = [
      ['sin aceptación', {}, 'terms_required'], ['acceptedTerms false', { acceptedTerms: false, termsVersion: VERSION }, 'terms_not_accepted'],
      ['acceptedTerms "true" (texto)', { acceptedTerms: 'true', termsVersion: VERSION }, 'terms_not_accepted'], ['acceptedTerms 1', { acceptedTerms: 1, termsVersion: VERSION }, 'terms_not_accepted'],
      ['acceptedTerms null', { acceptedTerms: null, termsVersion: VERSION }, 'terms_not_accepted'], ['solo termsVersion', { termsVersion: VERSION }, 'terms_not_accepted'],
      ['versión que no es la vigente', { acceptedTerms: true, termsVersion: '2026-10-v0' }, 'terms_version_mismatch'], ['versión vieja v1', { acceptedTerms: true, termsVersion: '2026-11-v1' }, 'terms_version_mismatch'],
      ['versión lista', { acceptedTerms: true, termsVersion: [VERSION] }, 'terms_version_invalid'], ['versión vacía', { acceptedTerms: true, termsVersion: '' }, 'terms_version_invalid'],
      ['sin versión', { acceptedTerms: true }, 'terms_version_invalid'],
    ];
    for (const [label, patch, code] of cases) {
      const out = await accept(token, patch);
      assert.equal(out.status, 400, label); assert.equal(out.body.code, code, label);
      if (code === 'terms_required' || code === 'terms_version_mismatch') assert.equal(out.body.currentVersion, VERSION, `${label}: informa la versión vigente`);
      assert.equal(await user(email), undefined, `${label}: no se creó la cuenta`); assert.equal((await link(email)).usedAt, null, `${label}: el enlace no se gastó`);
    }
    assert.equal(await total(), before, 'ninguna cuenta nueva');
    const ok = await accept(token, { acceptedTerms: true, termsVersion: VERSION });
    assert.equal(ok.status, 201, JSON.stringify(ok.body));
  });

  await t.test('con aceptación: cuenta ACTIVA con la versión vigente y la fecha del servidor; el cliente no puede fijarlas; el enlace queda usado una sola vez', async () => {
    const { token, email } = await invite();
    const out = await accept(token, { acceptedTerms: true, termsVersion: VERSION, acceptedAt: '2000-01-01T00:00:00Z', acceptedVersion: 'otra', role: 'superadmin', active: false, id: 1 });
    assert.equal(out.status, 201, JSON.stringify(out.body));
    const saved = await user(email);
    assert.equal(saved.termsVersion, VERSION); assert.ok(saved.acceptedAt instanceof Date && Math.abs(Date.now() - saved.acceptedAt.getTime()) < 60000, 'fecha del servidor, no la del cliente');
    assert.equal(saved.active, true); assert.equal(saved.role, 'user', 'el rol viene de la invitación, no del cliente'); assert.notEqual(saved.id, 1);
    const used = await link(email); assert.ok(used.usedAt); assert.equal(used.acceptedUserId, saved.id);
    const again = await accept(token, { acceptedTerms: true, termsVersion: VERSION }); assert.equal(again.status, 400); assert.equal(again.body.code, 'invitation_invalid', 'un enlace usado responde igual que uno inválido');
  });

  await t.test('la política de contraseña sigue primero y no gasta el enlace; un enlace inválido con aceptación correcta responde igual que antes', async () => {
    const { token, email } = await invite();
    const weak = await accept(token, { password: 'abc', acceptedTerms: true, termsVersion: VERSION }); assert.equal(weak.status, 400); assert.equal(weak.body.code, 'password_policy');
    assert.equal((await link(email)).usedAt, null);
    const bad = await accept(crypto.randomBytes(32).toString('base64url'), { acceptedTerms: true, termsVersion: VERSION }); assert.equal(bad.status, 400); assert.equal(bad.body.code, 'invitation_invalid');
    const rejected = await accept(crypto.randomBytes(32).toString('base64url')); assert.equal(rejected.body.code, 'terms_required', 'sin aceptación se informa antes de mirar el enlace: no revela si existe');
  });

  await t.test('carreras: 8 envíos simultáneos del mismo enlace con aceptación → una sola cuenta (201) y el resto 400', async () => {
    const { token, email } = await invite();
    const outs = await Promise.all(Array.from({ length: 8 }, () => accept(token, { acceptedTerms: true, termsVersion: VERSION })));
    assert.equal(outs.filter((o) => o.status === 201).length, 1, JSON.stringify(outs.map((o) => o.status))); assert.ok(outs.every((o) => o.status === 201 || o.status === 400), 'sin 5xx');
    assert.equal(Number((await q('SELECT count(*) n FROM "Users" WHERE email=$1', [email]))[0].n), 1);
  });

  await t.test('exportación y purga (ES-23): la aceptación se exporta con la cuenta y la purga la deja en NULL, como la de quien se registró', async () => {
    const { token, email } = await invite(); assert.equal((await accept(token, { acceptedTerms: true, termsVersion: VERSION })).status, 201);
    const { personalData } = require('../../utils/personalData'); const User = require('../../User'); const { requestDeletion } = require('../../utils/dataRights'); const { processDeletion } = require('../../utils/deletionProcessor');
    const mine = await user(email);
    const data = await personalData(await User.findByPk(mine.id), 'es'); assert.equal(data.profile.termsVersion, VERSION); assert.ok(data.profile.acceptedAt, 'la fecha se exporta');
    await requestDeletion(mine.id); const request = (await q('SELECT id FROM "DeletionRequests" WHERE "UserId"=$1', [mine.id]))[0].id; await processDeletion(request, { quiescent: true });
    const purged = (await q('SELECT "termsVersion", "acceptedAt", active FROM "Users" WHERE id=$1', [mine.id]))[0];
    assert.equal(purged.termsVersion, null); assert.equal(purged.acceptedAt, null); assert.equal(purged.active, false);
  });

  await t.test('cuentas ya existentes sin aceptación (NULL) no se bloquean: pueden iniciar sesión como antes', async () => {
    const old = await mkUser('user'); // creada por la vía de arnés: termsVersion NULL
    assert.equal((await q('SELECT "termsVersion" FROM "Users" WHERE id=$1', [old.id]))[0].termsVersion, null);
    assert.equal((await http(old, 'GET', '/api/session')).status, 200);
  });
});
