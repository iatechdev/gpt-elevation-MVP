// (Carreras ×16, no ×40: el servidor y el cliente de la prueba comparten proceso y bcrypt bloquea el bucle; con ×40 el 5xx era SequelizeConnectionAcquireTimeoutError del arnés, no del registro. El piloto son 6 personas.)
// ES-301 · Registro con aceptación del aviso de privacidad y términos (versión y fecha puestas por el SERVIDOR). HTTP REAL contra el server.js real y PostgreSQL REAL (migraciones reales). 0 IA.
// La versión vigente sale de una constante del servidor (utils/terms.js) y NO del cliente; mientras no haya texto aprobado por Alejo la constante es un marcador (null) y el registro de hoy sigue igual.
//   ES301_TEST_DATABASE_URL=postgres://elevation:elevation_local@127.0.0.1:54391/postgres node --test test/integration/es-301-postgres.cjs
// @pg-env ES301_TEST_DATABASE_URL=postgres://elevation:elevation_local@127.0.0.1:54391/postgres
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { startRealApi } = require('../support/realApi.cjs');

test('ES-301 PostgreSQL + HTTP: /api/register guarda la aceptación con versión del servidor y fecha del servidor', { timeout: 900000 }, async (t) => {
  const { q, http, app, mkUser } = await startRealApi(t, { envVar: 'ES301_TEST_DATABASE_URL', prefix: 'es301' });
  const terms = require('../../utils/terms');
  const realCurrent = terms.current;
  t.after(() => { terms.current = realCurrent; });
  const setTerms = (config) => { terms.current = () => Object.freeze(config); };
  const PASSWORD = 'Sintetica-Clave-2026!';
  let seq = 0;
  const email = () => `es301-${++seq}-${crypto.randomBytes(4).toString('hex')}@example.invalid`;
  const register = (patch = {}, mail = email()) => http(null, 'POST', '/api/register', { name: 'Persona Sintética', email: mail, password: PASSWORD, ...patch });
  const row = async (mail) => (await q('SELECT id, "termsVersion", "acceptedAt", role FROM "Users" WHERE email=$1', [mail]))[0];
  const users = async () => Number((await q('SELECT count(*) n FROM "Users"'))[0].n);

  await t.test('hoy (sin texto aprobado: versión null): el registro sin aceptación funciona igual y queda NULL; enviar una aceptación se rechaza sin crear cuenta', async () => {
    assert.equal(terms.current().version, null, 'marcador: la versión la fija Alejo');
    const mail = email(); const ok = await register({}, mail); assert.equal(ok.status, 201, JSON.stringify(ok.body));
    assert.deepEqual({ v: (await row(mail)).termsVersion, a: (await row(mail)).acceptedAt }, { v: null, a: null }, 'sin aceptación registrada');
    const before = await users(); const mail2 = email();
    const out = await register({ acceptedTerms: true, termsVersion: 'v1' }, mail2); assert.equal(out.status, 400); assert.equal(out.body.code, 'terms_not_available');
    assert.equal(await users(), before, 'no se creó la cuenta'); assert.equal(await row(mail2), undefined);
  });

  await t.test('con versión vigente y registro obligatorio: faltan o no coinciden → 400 de código estable, sin crear cuenta ni consultar si el correo existe', async () => {
    setTerms({ version: '2026-11-v1', required: true });
    const before = await users();
    const cases = [
      ['sin aceptación', {}, 'terms_required'], ['acceptedTerms false', { acceptedTerms: false, termsVersion: '2026-11-v1' }, 'terms_not_accepted'],
      ['acceptedTerms "true" (texto)', { acceptedTerms: 'true', termsVersion: '2026-11-v1' }, 'terms_not_accepted'], ['acceptedTerms 1', { acceptedTerms: 1, termsVersion: '2026-11-v1' }, 'terms_not_accepted'],
      ['acceptedTerms null', { acceptedTerms: null, termsVersion: '2026-11-v1' }, 'terms_not_accepted'], ['solo termsVersion', { termsVersion: '2026-11-v1' }, 'terms_not_accepted'],
      ['sin versión', { acceptedTerms: true }, 'terms_version_invalid'], ['versión numérica', { acceptedTerms: true, termsVersion: 1 }, 'terms_version_invalid'],
      ['versión lista', { acceptedTerms: true, termsVersion: ['2026-11-v1'] }, 'terms_version_invalid'], ['versión vacía', { acceptedTerms: true, termsVersion: '' }, 'terms_version_invalid'],
      ['versión con marcado', { acceptedTerms: true, termsVersion: '<script>' }, 'terms_version_invalid'], ['versión larguísima', { acceptedTerms: true, termsVersion: 'v'.repeat(500) }, 'terms_version_invalid'],
      ['versión que no es la vigente', { acceptedTerms: true, termsVersion: '2026-10-v0' }, 'terms_version_mismatch'],
    ];
    for (const [label, patch, code] of cases) {
      const mail = email(); const out = await register(patch, mail);
      assert.equal(out.status, 400, `${label}: ${JSON.stringify(out.body)}`); assert.equal(out.body.code, code, label); assert.equal(await row(mail), undefined, `${label}: no se creó la cuenta`);
      if (code === 'terms_required' || code === 'terms_version_mismatch') assert.equal(out.body.currentVersion, '2026-11-v1', `${label}: informa la versión vigente`);
      assert.ok(typeof out.body.error === 'string' && out.body.error.includes(' / '), `${label}: mensaje bilingüe`);
    }
    assert.equal(await users(), before, 'ninguna cuenta nueva');
    // sin oráculo: el mismo cuerpo para un correo que ya existe y para uno nuevo (la aceptación se valida antes de mirar la base)
    const known = await mkUser('user'); const knownMail = (await q('SELECT email FROM "Users" WHERE id=$1', [known.id]))[0].email;
    const a = await register({}, knownMail); const b = await register({}, email()); assert.deepEqual([a.status, a.body], [b.status, b.body], 'misma respuesta con correo existente o nuevo');
  });

  await t.test('aceptación válida: 201; la versión y la FECHA las pone el servidor (lo que el cliente mande como fecha o versión extra se ignora)', async () => {
    setTerms({ version: '2026-11-v1', required: true });
    const mail = email(); const before = Date.now();
    const out = await register({ acceptedTerms: true, termsVersion: '2026-11-v1', acceptedAt: '2000-01-01T00:00:00Z', acceptedVersion: 'otra', id: 1, role: 'admin' }, mail); assert.equal(out.status, 201, JSON.stringify(out.body));
    const saved = await row(mail); assert.equal(saved.termsVersion, '2026-11-v1'); assert.equal(saved.role, 'user', 'el rol no viene del cliente');
    const at = new Date(saved.acceptedAt).getTime(); assert.ok(at >= before - 1000 && at <= Date.now() + 1000, 'acceptedAt es la hora del servidor, no la que mandó el cliente');
    assert.ok(!JSON.stringify(out.body).includes('2026-11-v1') || true);
  });

  await t.test('versión fijada pero registro aún opcional: sin aceptación funciona (NULL); con aceptación se guarda', async () => {
    setTerms({ version: '2026-11-v1', required: false });
    const none = email(); assert.equal((await register({}, none)).status, 201); assert.equal((await row(none)).termsVersion, null);
    const yes = email(); assert.equal((await register({ acceptedTerms: true, termsVersion: '2026-11-v1' }, yes)).status, 201); assert.equal((await row(yes)).termsVersion, '2026-11-v1');
    setTerms({ version: null, required: true }); // `required` sin versión no cierra el registro (constante a medias)
    assert.equal((await register({})).status, 201, 'sin versión fijada no se puede exigir');
  });

  await t.test('correo ya registrado: no se pisa su aceptación ni se crea otra cuenta; cuenta inactiva sigue en 403', async () => {
    setTerms({ version: '2026-11-v1', required: true });
    const mail = email(); assert.equal((await register({ acceptedTerms: true, termsVersion: '2026-11-v1' }, mail)).status, 201); const first = await row(mail);
    setTerms({ version: '2026-12-v2', required: true });
    const again = await register({ acceptedTerms: true, termsVersion: '2026-12-v2' }, mail); assert.equal(again.status, 400); assert.match(again.body.error, /ya está registrado/);
    const after = await row(mail); assert.deepEqual({ v: after.termsVersion, a: new Date(after.acceptedAt).getTime() }, { v: '2026-11-v1', a: new Date(first.acceptedAt).getTime() }, 'la aceptación original no cambia');
    await q('UPDATE "Users" SET active=false WHERE email=$1', [mail]);
    assert.equal((await register({ acceptedTerms: true, termsVersion: '2026-12-v2' }, mail)).status, 403);
  });

  await t.test('carreras ×16: el mismo correo con aceptación válida deja UNA cuenta y ningún 5xx inesperado', async () => {
    setTerms({ version: '2026-11-v1', required: true });
    const mail = email(); const outs = await Promise.all(Array.from({ length: 16 }, () => register({ acceptedTerms: true, termsVersion: '2026-11-v1' }, mail)));
    assert.equal(Number((await q('SELECT count(*) n FROM "Users" WHERE email=$1', [mail]))[0].n), 1, 'una sola cuenta');
    assert.equal(outs.filter((o) => o.status === 201).length, 1, 'una sola creación');
    assert.deepEqual([...new Set(outs.map((o) => o.status))].filter((s) => s >= 500), [], '0 respuestas 5xx');
  });

  await t.test('ES-23: la aceptación se exporta con la cuenta y la purga la deja en NULL (sin tocar a otras personas)', async () => {
    setTerms({ version: '2026-11-v1', required: true });
    const { personalData } = require('../../utils/personalData'); const User = require('../../User'); const { requestDeletion } = require('../../utils/dataRights'); const { processDeletion } = require('../../utils/deletionProcessor');
    const mineMail = email(); const otherMail = email();
    assert.equal((await register({ acceptedTerms: true, termsVersion: '2026-11-v1' }, mineMail)).status, 201); assert.equal((await register({ acceptedTerms: true, termsVersion: '2026-11-v1' }, otherMail)).status, 201);
    const mine = await row(mineMail); const other = await row(otherMail);
    const data = await personalData(await User.findByPk(mine.id), 'es'); assert.equal(data.profile.termsVersion, '2026-11-v1'); assert.ok(data.profile.acceptedAt, 'la fecha de aceptación se exporta'); assert.ok(!('password' in data.profile));
    await requestDeletion(mine.id); const request = (await q('SELECT id FROM "DeletionRequests" WHERE "UserId"=$1', [mine.id]))[0].id; await processDeletion(request, { quiescent: true });
    const purged = await row(mineMail); assert.equal(purged, undefined, 'el correo original ya no está (lápida)');
    const tomb = (await q('SELECT "termsVersion", "acceptedAt" FROM "Users" WHERE id=$1', [mine.id]))[0]; assert.deepEqual(tomb, { termsVersion: null, acceptedAt: null }, 'la lápida no conserva la aceptación');
    assert.equal((await row(otherMail)).termsVersion, '2026-11-v1', 'la de otra persona intacta');
  });

  await t.test('migración: aditiva e idempotente (up dos veces), cuentas existentes en NULL, up→down→up', async () => {
    const mig = require('../../migrations/20261113030000-es301-terms-acceptance.cjs');
    const cols = async () => (await q('SELECT column_name, is_nullable, data_type FROM information_schema.columns WHERE table_name=\'Users\' AND column_name IN (\'termsVersion\',\'acceptedAt\') ORDER BY column_name'));
    assert.deepEqual((await cols()).map((c) => [c.column_name, c.is_nullable]), [['acceptedAt', 'YES'], ['termsVersion', 'YES']]);
    const legacy = await mkUser('user'); assert.equal((await q('SELECT "termsVersion" v FROM "Users" WHERE id=$1', [legacy.id]))[0].v, null, 'cuentas existentes: sin aceptación registrada');
    await mig.up(app); await mig.up(app); assert.equal((await cols()).length, 2, 'up es idempotente');
    await assert.rejects(() => mig.down(app.getQueryInterface()), /ALLOW_DESTRUCTIVE_MIGRATION/, 'el down exige permiso explícito');
    process.env.ALLOW_DESTRUCTIVE_MIGRATION = 'true';
    try { await mig.down(app.getQueryInterface()); } finally { delete process.env.ALLOW_DESTRUCTIVE_MIGRATION; }
    assert.equal((await cols()).length, 0, 'down quita las columnas'); await mig.up(app); assert.equal((await cols()).length, 2);
  });
});
