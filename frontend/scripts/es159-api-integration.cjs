// ES-159 («Hoy»): el registro del día contra el servidor REAL (Express + rutas reales de ánimo y de servicios de ayuda + PostgreSQL embebido real).
// Prueba lo que la pantalla da por hecho: la escala 1–5 llega tal cual (0 y 6 se rechazan: la pantalla anterior enviaba 0–4 y el 400 se ignoraba), el reintento y el doble envío
// no duplican (un registro por persona y día), nadie escribe ni lee el ánimo de otra persona cambiando un ID, un profesional no lo recibe, y los servicios de ayuda
// son solo los activos con verificación vigente (sin entradas = lista vacía). Datos sintéticos, base efímera en 127.0.0.1, sin IA ni producción.
// Uso: ES159_BACKEND_DIR=<carpeta backend con node_modules> node scripts/es159-api-integration.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const net = require('node:net');
const { once } = require('node:events');
const { randomBytes } = require('node:crypto');
const { createRequire } = require('node:module');
const { pathToFileURL } = require('node:url');
(async () => {
  assert.ok(process.env.ES159_BACKEND_DIR, 'Se necesita el directorio del backend');
  const backendDir = path.resolve(process.env.ES159_BACKEND_DIR);
  const fromBackend = createRequire(path.join(backendDir, 'package.json'));
  const { default: EmbeddedPostgres } = await import(pathToFileURL(fromBackend.resolve('embedded-postgres')).href);
  const parent = path.resolve(os.tmpdir()); const directory = fs.mkdtempSync(path.join(parent, 'es159-pg-'));
  assert.equal(path.dirname(path.resolve(directory)), parent); assert.ok(path.basename(directory).startsWith('es159-pg-'));
  const probe = net.createServer();
  const port = await new Promise((resolve, reject) => { probe.once('error', reject); probe.listen(0, '127.0.0.1', () => { const selected = probe.address().port; probe.close(() => resolve(selected)); }); });
  const password = randomBytes(24).toString('hex');
  const pg = new EmbeddedPostgres({ databaseDir: directory, user: 'es159_test', password, port, persistent: false, initdbFlags: ['--encoding=UTF8', '--locale=C'], postgresFlags: ['-h', '127.0.0.1'], onLog() {}, onError() {} });
  let started = false; let sequelize; let server; let ok = false; let count = 0; const check = label => { count += 1; console.log('PASS ' + label); };
  try {
    await pg.initialise(); await pg.start(); started = true;
    const { Sequelize } = fromBackend('sequelize');
    sequelize = new Sequelize(`postgres://es159_test:${password}@127.0.0.1:${port}/postgres`, { logging: false, dialectOptions: { ssl: false } });
    process.env.JWT_SECRET = randomBytes(32).toString('hex'); process.env.DATA_ENCRYPTION_KEY = randomBytes(32).toString('hex');
    const id = fromBackend.resolve('./database'); require.cache[id] = { id, filename: id, loaded: true, exports: { sequelize } };
    for (const name of ['PricingPlan', 'User', 'MoodLog', 'ContactEntry', 'RevokedToken', 'AuthRevocation', 'DeletionRequest']) fromBackend('./' + name);
    await sequelize.sync();
    const User = fromBackend('./User'); const MoodLog = fromBackend('./MoodLog'); const ContactEntry = fromBackend('./ContactEntry');
    const mkUser = (name, role = 'user') => User.create({ name, email: `${name.toLowerCase().replace(/\W+/g, '-')}@example.invalid`, password: 'x', role });
    const [alice, bob, pro] = [await mkUser('Persona A'), await mkUser('Persona B'), await mkUser('Profesional P', 'therapist')];
    const express = fromBackend('express'); const app = express(); app.use(express.json());
    app.use('/api/mood', fromBackend('./middlewares/auth').verificarToken, fromBackend('./routes/mood'));
    app.use('/api/contact-entries', fromBackend('./routes/contactEntries').publicRouter);
    server = app.listen(0, '127.0.0.1'); await once(server, 'listening'); const api = `http://127.0.0.1:${server.address().port}`;
    const issue = fromBackend('./utils/sessions').issueToken;
    const tokens = { a: issue({ id: alice.id, role: 'user' }), b: issue({ id: bob.id, role: 'user' }), p: issue({ id: pro.id, role: 'therapist' }) };
    const call = (method, url, token, body) => fetch(api + url, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    const rows = userId => MoodLog.findAll({ where: { UserId: userId }, order: [['id', 'ASC']] });

    // 1. La escala 1–5 llega tal cual y el reintento no duplica
    for (const value of [1, 5, 3]) { const res = await call('POST', '/api/mood/checkin', tokens.a, { mood: value }); assert.equal(res.status, 200, `mood ${value}`); }
    let own = await rows(alice.id); assert.equal(own.length, 1, 'un registro por persona y día (upsert)'); assert.equal(own[0].checkin_mood, 3, 'el último valor gana');
    check('1, 5 y 3 se guardan tal cual; repetir el envío actualiza el MISMO registro del día (reintento idempotente)');

    // 2. Fuera de escala o mal formado: 400, nunca 500, y no cambia nada (0 era la primera opción de la pantalla anterior)
    for (const bad of [0, 6, -1, 3.5, '3', null, 'x', {}, [], undefined]) {
      const res = await call('POST', '/api/mood/checkin', tokens.a, bad === undefined ? {} : { mood: bad });
      assert.equal(res.status, 400, `mood ${JSON.stringify(bad)} debe ser 400 y fue ${res.status}`);
    }
    own = await rows(alice.id); assert.equal(own.length, 1); assert.equal(own[0].checkin_mood, 3, 'lo inválido no cambia nada');
    check('0, 6, negativos, decimales, texto, null y cuerpo vacío → 400 y la base no cambia (la pantalla ya trata no-2xx como error)');

    // 3. Doble envío / concurrencia: cinco envíos a la vez dejan un solo registro
    await MoodLog.destroy({ where: { UserId: bob.id } });
    const results = await Promise.all([1, 2, 3, 4, 5].map(value => call('POST', '/api/mood/checkin', tokens.b, { mood: value })));
    assert.ok(results.every(res => res.status === 200), 'todas responden 200: ' + results.map(res => res.status).join(','));
    assert.equal((await rows(bob.id)).length, 1, 'cinco envíos simultáneos = un solo registro del día');
    check('cinco envíos simultáneos de la misma persona dejan UN registro (sin duplicados)');

    // 4. Aislamiento: cambiar el ID en el cuerpo o en la consulta no lee ni escribe lo de otra persona
    const before = (await rows(alice.id))[0].checkin_mood;
    const forged = await call('POST', '/api/mood/checkin', tokens.b, { mood: 1, UserId: alice.id, userId: alice.id });
    assert.equal(forged.status, 200); assert.equal((await rows(alice.id))[0].checkin_mood, before, 'el ID del cuerpo se ignora: lo de A no cambia');
    assert.equal((await rows(alice.id)).length, 1);
    const historyB = await (await call('GET', `/api/mood/history?userId=${alice.id}&UserId=${alice.id}`, tokens.b)).json();
    assert.ok(Array.isArray(historyB) && historyB.every(row => row.UserId === bob.id), 'B solo ve lo suyo');
    const historyA = await (await call('GET', '/api/mood/history', tokens.a)).json();
    assert.ok(historyA.length === 1 && historyA.every(row => row.UserId === alice.id));
    check('cambiar el ID (cuerpo o consulta) no escribe ni lee el ánimo de otra persona');

    // 5. Un profesional no recibe el ánimo de las personas; sin sesión no hay acceso
    const historyPro = await (await call('GET', `/api/mood/history?userId=${alice.id}`, tokens.p)).json();
    assert.deepEqual(historyPro, [], 'el profesional solo ve lo suyo (nada)');
    assert.equal((await call('GET', '/api/mood/history')).status, 403); assert.equal((await call('GET', '/api/mood/history', 'basura')).status, 401);
    assert.equal((await call('POST', '/api/mood/checkin', undefined, { mood: 3 })).status, 403);
    assert.equal((await call('POST', '/api/mood/checkin', 'basura', { mood: 3 })).status, 401);
    check('un profesional vinculado no recibe el ánimo (solo lo suyo); sin sesión 403; token inválido 401');

    // 6. Servicios de ayuda: solo activos y verificados; sin entradas = lista vacía; país inválido = 400
    const today = new Date().toISOString().slice(0, 10); const old = '2020-01-01';
    const base = { source: 'Fuente sintética', verifiedBy: 'QA sintético', version: 1 };
    await ContactEntry.bulkCreate([
      { ...base, country: 'CO', name: 'Servicio vigente', contact: '111 222 333', descriptionEs: 'es', descriptionEn: 'en', active: true, verifiedAt: today, position: 1 },
      { ...base, country: 'CO', name: 'Servicio inactivo', contact: '111 222 334', active: false, verifiedAt: today, position: 2 },
      { ...base, country: 'CO', name: 'Servicio vencido', contact: '111 222 335', active: true, verifiedAt: old, position: 3 },
      { ...base, country: 'CO', name: 'Servicio sin verificar', contact: '111 222 336', active: true, verifiedAt: null, position: 4 },
    ]);
    const co = await (await call('GET', '/api/contact-entries?country=CO')).json();
    assert.deepEqual(co.entries.map(entry => entry.name), ['Servicio vigente']);
    assert.deepEqual(Object.keys(co.entries[0]).sort(), ['contact', 'country', 'description', 'id', 'name']);
    assert.deepEqual((await (await call('GET', '/api/contact-entries?country=DK')).json()).entries, [], 'sin entradas para el país = lista vacía');
    assert.equal((await call('GET', '/api/contact-entries?country=COL')).status, 400);
    assert.equal((await call('GET', '/api/contact-entries?country=1')).status, 400);
    check('los servicios de ayuda son solo los activos con verificación vigente; otro país = lista vacía; país inválido = 400 (la pantalla lo trata como error y deja el texto genérico)');
    ok = true;
  } finally {
    if (server) server.close(); if (sequelize) await sequelize.close().catch(() => undefined);
    if (started) await pg.stop().catch(() => undefined);
    fs.rmSync(directory, { recursive: true, force: true });
  }
  if (ok) console.log(`\nES-159 (servidor real): ${count} comprobaciones OK`);
  process.exit(ok ? 0 : 1);
})().catch((error) => { console.error('FAIL', error.message); process.exit(1); });
