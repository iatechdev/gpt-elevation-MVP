// ES-221 · Registro sin oráculo de «cuenta inactiva», con tiempo equivalente y límite por IP. HTTP REAL contra el server.js real y PostgreSQL REAL (migraciones reales). 0 IA.
// Lo que NO cambia (decisión del 12-nov, opción A): «ya registrado» (400) sigue siendo distinguible de «nuevo» (201) hasta que haya correo de verificación (ES-12).
//   ES221_TEST_DATABASE_URL=postgres://elevation:elevation_local@127.0.0.1:54391/postgres node --test test/integration/es-221-postgres.cjs
// @pg-env ES221_TEST_DATABASE_URL=postgres://elevation:elevation_local@127.0.0.1:54391/postgres
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { startRealApi } = require('../support/realApi.cjs');

test('ES-221 PostgreSQL + HTTP: /api/register no distingue inactiva de activa, iguala el tiempo, ordena aceptación antes del correo y limita por IP', { timeout: 900000 }, async (t) => {
  const { q, http, mkUser } = await startRealApi(t, { envVar: 'ES221_TEST_DATABASE_URL', prefix: 'es221' });
  const terms = require('../../utils/terms');
  const realCurrent = terms.current;
  t.after(() => { terms.current = realCurrent; });
  const PASSWORD = 'Sintetica-Clave-2026!';
  let seq = 0;
  const fresh = () => `es221-${++seq}-${crypto.randomBytes(4).toString('hex')}@example.invalid`;
  const register = (mail, patch = {}) => http(null, 'POST', '/api/register', { name: 'Persona Sintética', email: mail, password: PASSWORD, acceptedTerms: true, termsVersion: terms.current().version, ...patch });
  const emailOf = async (user) => (await q('SELECT email FROM "Users" WHERE id=$1', [user.id]))[0].email;
  const count = async () => Number((await q('SELECT count(*) n FROM "Users"'))[0].n);
  const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
  // Peticiones de /api/register desde la IP de la prueba (el límite es de 30 por hora): se cuentan todas, también las rechazadas.
  let registrations = 0;
  const counted = async (mail, patch) => { registrations += 1; return register(mail, patch); };

  await t.test('una cuenta inactiva responde IGUAL que una activa (400, mismo cuerpo), sin reactivarla ni crear otra', async () => {
    const active = await mkUser('user'); const inactive = await mkUser('user');
    await q('UPDATE "Users" SET active=false WHERE id=$1', [inactive.id]);
    const before = await count(); const hashBefore = (await q('SELECT password FROM "Users" WHERE id=$1', [inactive.id]))[0].password;
    const a = await counted(await emailOf(active)); const i = await counted(await emailOf(inactive));
    assert.equal(a.status, 400, JSON.stringify(a.body)); assert.equal(i.status, 400, JSON.stringify(i.body));
    assert.deepEqual(i.body, a.body, 'mismo cuerpo'); assert.equal(i.body.error, 'El correo ya está registrado.');
    assert.equal((await q('SELECT active FROM "Users" WHERE id=$1', [inactive.id]))[0].active, false, 'sigue inactiva');
    assert.equal((await q('SELECT password FROM "Users" WHERE id=$1', [inactive.id]))[0].password, hashBefore, 'sin cambiar la contraseña');
    assert.equal(await count(), before, 'no se creó ninguna cuenta');
    // mayúsculas y espacios a los lados (ES-306) también dan el mismo resultado
    const spaced = await counted(`  ${(await emailOf(inactive)).toUpperCase()}  `); assert.equal(spaced.status, 400); assert.deepEqual(spaced.body, a.body);
    // un correo nuevo sí se crea (201): «ya registrado» sigue siendo distinguible de «nuevo» (compromiso declarado)
    const created = await counted(fresh()); assert.equal(created.status, 201, JSON.stringify(created.body));
    assert.equal(await count(), before + 1);
  });

  await t.test('el login con la contraseña correcta de una cuenta inactiva conserva su aviso (no es parte de este cambio)', async () => {
    const mail = fresh(); assert.equal((await counted(mail)).status, 201);
    await q('UPDATE "Users" SET active=false WHERE email=$1', [mail]);
    const login = await http(null, 'POST', '/api/login', { email: mail, password: PASSWORD });
    assert.equal(login.status, 403); assert.match(login.body.error, /Cuenta inactiva/);
  });

  await t.test('orden de ES-301: la aceptación se valida ANTES de consultar el correo (mismo cuerpo para correo existente, inactivo y nuevo)', async () => {
    terms.current = () => Object.freeze({ version: '2026-11-v1', required: true });
    const known = await mkUser('user'); const inactive = await mkUser('user'); await q('UPDATE "Users" SET active=false WHERE id=$1', [inactive.id]);
    const before = await count();
    const out = [];
    for (const mail of [await emailOf(known), await emailOf(inactive), fresh()]) out.push(await counted(mail, { acceptedTerms: undefined, termsVersion: undefined }));
    for (const r of out) { assert.equal(r.status, 400); assert.equal(r.body.code, 'terms_required'); }
    assert.deepEqual(out[0].body, out[1].body); assert.deepEqual(out[1].body, out[2].body);
    assert.equal(await count(), before);
    terms.current = realCurrent;
  });

  await t.test('tiempo: «ya registrado» cuesta lo mismo que «nuevo» (muestra de 5; la mediana del duplicado no baja de la mitad de la del nuevo)', async () => {
    const known = await mkUser('user'); const knownMail = await emailOf(known);
    const dup = []; const created = [];
    for (let n = 0; n < 5; n++) {
      let s = process.hrtime.bigint(); await counted(knownMail); dup.push(Number(process.hrtime.bigint() - s) / 1e6);
      s = process.hrtime.bigint(); await counted(fresh()); created.push(Number(process.hrtime.bigint() - s) / 1e6);
    }
    const md = median(dup); const mn = median(created);
    console.log(`  tiempo (ms, local): duplicado=${md.toFixed(1)} nuevo=${mn.toFixed(1)} razón=${(md / mn).toFixed(2)}`);
    assert.ok(md >= mn * 0.5, `duplicado ${md} ms vs nuevo ${mn} ms: el duplicado no debe ser mucho más rápido (antes se saltaba bcrypt)`);
  });

  await t.test('límite por IP: el piloto (6 personas detrás de una misma red) se registra sin bloqueo; el barrido masivo recibe 429 ES/EN, sin 500', async () => {
    assert.ok(registrations <= 24, `las peticiones previas (${registrations}) dejan sitio a 6 registros del piloto`);
    for (let n = 0; n < 6; n++) { const r = await counted(fresh()); assert.equal(r.status, 201, JSON.stringify(r.body)); }
    let limited = null; let guard = 0;
    while (!limited && guard++ < 60) { const r = await counted(fresh()); assert.ok([201, 429].includes(r.status), `inesperado ${r.status}`); if (r.status === 429) limited = r; }
    assert.ok(limited, 'el límite se alcanza');
    assert.equal(registrations, 31, 'el 429 llega con la petición 31 (tope de 30 por hora)');
    assert.match(limited.body.error, /Demasiados intentos/); assert.match(limited.body.error, /Too many attempts/);
    // el login tiene su propio límite: el del registro no lo toca
    const login = await http(null, 'POST', '/api/login', { email: fresh(), password: PASSWORD }); assert.equal(login.status, 401);
  });
});
