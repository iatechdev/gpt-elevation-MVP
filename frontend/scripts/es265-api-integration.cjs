// ES-265: panel profesional (/therapist/dashboard) con el servidor REAL (Express + middlewares de sesión + rutas del profesional y de sesiones + PostgreSQL embebido migrado) y la pantalla construida en Chromium.
//  - 401 REAL: el token de un profesional cuyas sesiones fueron revocadas en la base (AuthRevocations, como un corte de administrador) → la pantalla borra la sesión y llega a /login.
//  - 403 REAL: el token de una persona usuaria (rol «user») ante rutas de profesional → «No tienes permiso para ver este bloque», sin «Reintentar», sesión intacta.
//  - Control: un profesional vigente ve su panel sin errores.
// ÚNICO simulado: GET /api/session (la comprobación de rol de la compuerta) responde «therapist»; todo lo demás va al servidor real. Datos sintéticos, base efímera en 127.0.0.1, sin IA ni producción.
// Uso:  (cd frontend && npx vite build && npx vite preview --host 127.0.0.1 --port 4265 --strictPort)
//       ES265_BACKEND_DIR=<backend> ES265_PREVIEW_URL=http://127.0.0.1:4265 PLAYWRIGHT_MODULE=<playwright> AXE_PATH=<axe.min.js> node scripts/es265-api-integration.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const net = require('node:net');
const { once } = require('node:events');
const { randomBytes } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { createRequire } = require('node:module');
const { pathToFileURL } = require('node:url');
(async () => {
  assert.ok(process.env.ES265_BACKEND_DIR, 'Se necesita el directorio del backend');
  const backend = path.resolve(process.env.ES265_BACKEND_DIR);
  const fromBackend = createRequire(path.join(backend, 'package.json'));
  const { default: EmbeddedPostgres } = await import(pathToFileURL(fromBackend.resolve('embedded-postgres')).href);
  const directory = fs.mkdtempSync(path.join(path.resolve(os.tmpdir()), 'es265-pg-'));
  const probe = net.createServer();
  const port = await new Promise((resolve, reject) => { probe.once('error', reject); probe.listen(0, '127.0.0.1', () => { const p = probe.address().port; probe.close(() => resolve(p)); }); });
  const password = randomBytes(24).toString('hex');
  const pg = new EmbeddedPostgres({ databaseDir: directory, user: 'es265_test', password, port, persistent: false, initdbFlags: ['--encoding=UTF8', '--locale=C'], postgresFlags: ['-h', '127.0.0.1'], onLog: () => {}, onError: () => {} });
  let started = false; let sequelize; let server; let browser; let db; let count = 0;
  const check = (label) => { count += 1; console.log('PASS ' + label); };
  try {
    await pg.initialise(); await pg.start(); started = true;
    const url = `postgres://es265_test:${password}@127.0.0.1:${port}/postgres`;
    const migrated = spawnSync('npx', ['sequelize-cli', 'db:migrate'], { cwd: backend, encoding: 'utf8', shell: process.platform === 'win32', env: { ...process.env, DATABASE_URL: url, DB_SSL: 'false', NODE_ENV: 'test' } });
    assert.equal(migrated.status, 0, 'Fallaron las migraciones: ' + (migrated.stdout + migrated.stderr).slice(-500));
    const { Sequelize } = fromBackend('sequelize'); const { Client } = fromBackend('pg');
    sequelize = new Sequelize(url, { logging: false, dialectOptions: { ssl: false }, pool: { max: 8, min: 0 } });
    process.env.JWT_SECRET = randomBytes(32).toString('hex'); process.env.DATA_ENCRYPTION_KEY = randomBytes(32).toString('hex'); process.env.NODE_ENV = 'test';
    const dbId = fromBackend.resolve('./database'); require.cache[dbId] = { id: dbId, filename: dbId, loaded: true, exports: { sequelize } };
    const anthropicId = fromBackend.resolve('./utils/anthropic'); require.cache[anthropicId] = { id: anthropicId, filename: anthropicId, loaded: true, exports: { MODEL: 'sintetico', messages: { create: async () => ({ content: [{ type: 'text', text: 'Resumen sintético.' }], usage: { input_tokens: 1, output_tokens: 1 } }) } } };
    fromBackend('./associations')();
    const { issueToken, revokeUserSessions } = fromBackend('./utils/sessions'); const { verificarToken, verificarTerapeuta } = fromBackend('./middlewares/auth');
    const express = fromBackend('express'); const api = express(); api.use(express.json());
    api.use('/api/therapist/validation', verificarToken, fromBackend('./routes/validation')); // igual que server.js: esta ruta solo exige sesión
    api.use('/api/therapist', verificarTerapeuta, fromBackend('./routes/therapistRoutes'));
    api.use('/api/sessions', verificarToken, fromBackend('./routes/sessions'));
    server = api.listen(0, '127.0.0.1'); await once(server, 'listening'); const apiUrl = `http://127.0.0.1:${server.address().port}`;
    db = new Client({ connectionString: url, ssl: false }); await db.connect();
    const q = async (text, params) => (await db.query(text, params)).rows;
    const columns = await q(`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='Users' AND is_nullable='NO' AND column_default IS NULL AND column_name <> 'id'`);
    let seq = 0;
    async function mkUser(role, name) {
      seq += 1; const names = []; const values = [];
      for (const c of columns) {
        let v;
        if (c.column_name === 'role') v = role; else if (c.column_name === 'name') v = name;
        else if (c.data_type.includes('char') || c.data_type === 'text') v = c.column_name === 'email' ? `canario-correo-${seq}@example.test` : `sintetico-${seq}-${c.column_name}`;
        else if (c.data_type === 'integer') v = 0; else if (c.data_type === 'boolean') v = true; else if (c.data_type.startsWith('timestamp')) v = new Date(); else v = '{}';
        names.push(`"${c.column_name}"`); values.push(v);
      }
      const id = (await q(`INSERT INTO "Users" (${names.join(',')}) VALUES (${values.map((_, i) => `$${i + 1}`).join(',')}) RETURNING id`, values))[0].id;
      await q('UPDATE "Users" SET role=$2, active=true WHERE id=$1', [id, role]);
      return { id, role, token: issueToken({ id, role }) };
    }
    const call = async (who, route) => { const res = await fetch(apiUrl + route, { headers: { Authorization: `Bearer ${who.token}` } }); return res.status; };
    const endpoints = ['/api/therapist/pacientes', '/api/sessions/therapist/upcoming', '/api/therapist/alerts', '/api/therapist/prompt', '/api/therapist/validation/status'];

    // Comprobación directa contra el servidor (sin navegador): los códigos que la pantalla debe tratar.
    const okTherapist = await mkUser('therapist', 'Profesional Vigente');
    const revoked = await mkUser('therapist', 'Profesional Revocado');
    const person = await mkUser('user', 'Persona Sintética');
    for (const e of endpoints) assert.equal(await call(okTherapist, e), 200, `vigente ${e}`);
    await new Promise((r) => setTimeout(r, 1100)); // el corte compara segundos: el token ya fue emitido antes
    await revokeUserSessions(revoked.id);
    assert.equal((await q('SELECT count(*)::int AS n FROM "AuthRevocations" WHERE "UserId"=$1', [revoked.id]))[0].n, 1, 'revocación guardada en la base');
    for (const e of endpoints) { assert.equal(await call(revoked, e), 401, `revocado ${e}`); }
    for (const e of ['/api/therapist/pacientes', '/api/therapist/alerts', '/api/therapist/prompt']) assert.equal(await call(person, e), 403, `persona ${e}`);
    check('servidor real: vigente 200; sesiones revocadas (AuthRevocations) → 401; rol «user» ante /api/therapist → 403');

    const { chromium } = process.env.PLAYWRIGHT_MODULE ? require(process.env.PLAYWRIGHT_MODULE) : await import('playwright');
    browser = await chromium.launch({ headless: true });
    const frontend = process.env.ES265_PREVIEW_URL || 'http://127.0.0.1:4265'; assert.ok(['127.0.0.1', 'localhost'].includes(new URL(frontend).hostname));
    const axeSource = process.env.AXE_PATH ? fs.readFileSync(process.env.AXE_PATH, 'utf8') : '';
    const axe = async (page, label) => { if (!axeSource) return; await page.addScriptTag({ content: axeSource }); const v = await page.evaluate(() => axe.run(document, { runOnly: ['wcag2a', 'wcag2aa'] }).then((r) => r.violations.map((x) => x.id + ':' + x.nodes.map((n) => n.target.join(' ')).join(' ; ')))); assert.deepEqual(v, [], label + ' axe'); };
    const errors = [];
    async function open(who, lang, width) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' }); const page = await context.newPage();
      page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 200)); });
      await page.addInitScript(([t, l]) => { if (!sessionStorage.getItem('es265')) { sessionStorage.setItem('es265', '1'); localStorage.setItem('elevation_token', t); localStorage.setItem('elevation_role', 'therapist'); } localStorage.setItem('elv_lang', l); }, [who.token, lang]);
      await page.route('**/api/session', (r) => r.fulfill({ json: { role: 'therapist', onboardingCompleted: true } })); // único simulado
      await page.route(/\/api\/(therapist|sessions)\//, async (r) => { const u = new URL(r.request().url()); try { await r.fulfill({ response: await r.fetch({ url: apiUrl + u.pathname + u.search }) }); } catch { /* cerrada */ } });
      await page.goto(`${frontend}/therapist/dashboard`);
      return { context, page };
    }
    for (const lang of ['es', 'en']) for (const width of [390, 1360]) {
      const tag = `${lang} ${width}px`; const retry = lang === 'es' ? 'Reintentar' : 'Try again';
      { // vigente: sin errores
        const { context, page } = await open(okTherapist, lang, width);
        await page.getByRole('heading', { level: 2, name: lang === 'es' ? 'Personas' : 'People' }).waitFor({ timeout: 10000 });
        await page.waitForLoadState('networkidle');
        assert.equal(await page.getByRole('alert').count(), 0, `profesional vigente sin errores (${tag})`);
        assert.ok(await page.evaluate(() => !!localStorage.getItem('elevation_token')));
        await context.close();
      }
      { // 401 real
        const { context, page } = await open(revoked, lang, width);
        await page.waitForURL('**/login', { timeout: 10000 });
        assert.equal(await page.evaluate(() => localStorage.getItem('elevation_token')), null, `token revocado borrado (${tag})`);
        assert.equal(await page.getByRole('button', { name: retry }).count(), 0, `sin «Reintentar» (${tag})`);
        await axe(page, `login tras 401 ${tag}`);
        await context.close();
      }
      { // 403 real
        const { context, page } = await open(person, lang, width);
        const box = page.locator('section[aria-labelledby="panel-alerts-title"]'); await box.getByRole('alert').waitFor({ timeout: 10000 });
        const want = lang === 'es' ? 'No tienes permiso para ver este bloque.' : "You don't have permission to see this block.";
        assert.equal((await box.getByRole('alert').innerText()).trim(), want, `texto 403 (${tag})`);
        assert.equal(await box.getByRole('button', { name: new RegExp('^' + retry) }).count(), 0, `403 sin «Reintentar» en el bloque (${tag})`);
        assert.equal(await page.locator('section[aria-labelledby="panel-people-title"]').getByRole('button', { name: new RegExp('^' + retry) }).count(), 0, `403 sin «Reintentar» en Personas (${tag})`);
        assert.ok(await page.evaluate((t) => localStorage.getItem('elevation_token') === t, person.token), `403 no cierra la sesión (${tag})`);
        await axe(page, `403 ${tag}`);
        await context.close();
      }
      check(`navegador + servidor real (${tag}): vigente sin errores; 401 por revocación → token borrado y /login sin «Reintentar»; 403 por rol → mensaje propio sin «Reintentar», sesión intacta, axe 0`);
    }
    assert.deepEqual(errors, [], 'errores de consola o de página: ' + errors.join(' | '));
    console.log(`\nES-265 (servidor real): ${count} comprobaciones OK`);
  } finally {
    try { await browser?.close(); } catch { /* ya cerrado */ }
    try { server?.close(); } catch { /* ya cerrado */ }
    try { await db?.end(); } catch { /* ya cerrado */ }
    try { await sequelize?.close(); } catch { /* ya cerrado */ }
    if (started) { try { await pg.stop(); } catch { /* ya detenido */ } }
    try { fs.rmSync(directory, { recursive: true, force: true }); } catch { /* EBUSY en Windows */ }
  }
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
