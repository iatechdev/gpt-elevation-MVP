// ES-279 (pantalla): aviso de conflicto de edición simultánea en Administración › Textos públicos, medido en Chromium sobre el build real de React con DOS SUPERADMINISTRADORES REALES
// (dos contextos de navegador con su propia sesión) contra el servidor real (rutas reales de landing-content con sus guardas) y PostgreSQL embebido real. Personas sintéticas, sin IA ni producción.
// Flujo: A guarda → B (versión vieja) guarda → aviso en la fila (la base NO cambia y lo escrito se conserva) → «Ver su versión» → «Conservar la mía» (gana B) → «Usar la suya» (no guarda)
// → el texto ya no existe (current = null) → carrera real de dos guardados simultáneos → ES/EN × 390/1360/320 (sin desbordes) y axe con el aviso abierto.
// Control: CONTROL=1 sobre el build de main (ES279_FRONTEND_DIR) demuestra el problema que arregla: el segundo guardado pisa al primero EN SILENCIO y ve «Guardado».
// Uso: ES279_BACKEND_DIR=<backend> PLAYWRIGHT_MODULE=<playwright> AXE_PATH=<axe.min.js> [ES279_FRONTEND_DIR=<frontend>] [CONTROL=1] node scripts/es279-conflicto-check.cjs
const assert = require('node:assert/strict'); const fs = require('node:fs'); const path = require('node:path'); const os = require('node:os'); const net = require('node:net'); const http = require('node:http');
const { once } = require('node:events'); const { randomBytes } = require('node:crypto'); const { createRequire } = require('node:module'); const { pathToFileURL } = require('node:url'); const { spawnSync } = require('node:child_process');


(async () => {
  assert.ok(process.env.ES279_BACKEND_DIR, 'Se necesita ES279_BACKEND_DIR (directorio del backend)');
  const CONTROL = process.env.CONTROL === '1';
  const root = path.resolve(process.env.ES279_FRONTEND_DIR || path.join(__dirname, '..')); const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'es279-')); const fromBackend = createRequire(path.join(path.resolve(process.env.ES279_BACKEND_DIR), 'package.json'));
  const { default: EmbeddedPostgres } = await import(pathToFileURL(fromBackend.resolve('embedded-postgres')).href);
  const probe = net.createServer(); const port = await new Promise((resolve, reject) => { probe.once('error', reject); probe.listen(0, '127.0.0.1', () => { const p = probe.address().port; probe.close(() => resolve(p)); }); });
  const password = randomBytes(24).toString('hex');
  const pg = new EmbeddedPostgres({ databaseDir: path.join(tmp, 'pg'), user: 'es279_test', password, port, persistent: false, initdbFlags: ['--encoding=UTF8', '--locale=C'], postgresFlags: ['-h', '127.0.0.1'], onLog() {}, onError() {} });
  let started = false; let sequelize; let apiServer; let webServer; let browser; const checks = []; const check = label => { checks.push(label); console.log('PASS ' + label); };
  try {
    await pg.initialise(); await pg.start(); started = true;
    const { Sequelize } = fromBackend('sequelize'); sequelize = new Sequelize(`postgres://es279_test:${password}@127.0.0.1:${port}/postgres`, { logging: false, dialectOptions: { ssl: false } });
    process.env.JWT_SECRET = randomBytes(32).toString('hex'); process.env.DATA_ENCRYPTION_KEY = randomBytes(32).toString('hex');
    const id = fromBackend.resolve('./database'); require.cache[id] = { id, filename: id, loaded: true, exports: { sequelize } };
    for (const name of ['PricingPlan', 'User', 'LandingContent', 'RevokedToken', 'AuthRevocation', 'DeletionRequest']) fromBackend('./' + name);
    await sequelize.sync();
    const User = fromBackend('./User'); const q = async (sql, bind = []) => sequelize.query(sql, { bind, type: 'SELECT' });
    const express = fromBackend('express'); const app = express(); app.use(fromBackend('cors')()); app.use(express.json());
    const puts = []; app.use('/api/landing-content', (req, res, next) => { if (req.method === 'PUT') puts.push({ at: Date.now(), body: req.body }); next(); }, fromBackend('./routes/landingContent'));
    apiServer = app.listen(0, '127.0.0.1'); await once(apiServer, 'listening'); const apiUrl = `http://127.0.0.1:${apiServer.address().port}`;
    const sessions = fromBackend('./utils/sessions'); let n = 0;
    const mkAdmin = async name => { n++; const user = await User.create({ name, email: `es279-${n}@example.invalid`, password: 'x', role: 'superadmin' }); return { user, token: sessions.issueToken({ id: user.id, role: 'superadmin', name }) }; };
    const A = await mkAdmin('Admin Alfa'); const B = await mkAdmin('Admin Beta');
    const KEY = 'hero_title'; const field = `#landing-${KEY}`;
    const row = async () => (await q('SELECT value, updated_by FROM "LandingContents" WHERE key=$1 AND lang=$2', [KEY, 'es']))[0];
    const put = (who, value, expected) => fetch(apiUrl + '/api/landing-content', { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + who.token }, body: JSON.stringify({ key: KEY, lang: 'es', value, ...(expected === undefined ? {} : { expectedUpdatedAt: expected }) }) });
    await put(A, 'Texto base'); // semilla (sin versión esperada: comportamiento anterior)

    const out = path.join(tmp, 'web'); const built = spawnSync(process.execPath, [path.join(root, 'node_modules/vite/bin/vite.js'), 'build', '--outDir', out], { cwd: root, encoding: 'utf8', env: { ...process.env, VITE_BACKEND_URL: apiUrl } });
    if (built.status !== 0) throw new Error('build: ' + built.stderr);
    webServer = http.createServer((req, res) => { const p = decodeURIComponent(new URL(req.url, 'http://x').pathname); const t = path.resolve(out, '.' + p); const f = t.startsWith(out) && fs.existsSync(t) && fs.statSync(t).isFile() ? t : path.join(out, 'index.html');
      res.setHeader('Content-Type', ({ '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' })[path.extname(f)] || 'text/html'); res.end(fs.readFileSync(f)); });
    webServer.listen(0, '127.0.0.1'); await once(webServer, 'listening'); const origin = `http://127.0.0.1:${webServer.address().port}`;
    const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright'); browser = await chromium.launch({ headless: true });
    const axeSource = process.env.AXE_PATH ? fs.readFileSync(process.env.AXE_PATH, 'utf8') : ''; assert.ok(axeSource, 'Se necesita AXE_PATH (axe.min.js)');
    const requests = [];
    async function open(who, { lang = 'es', width = 1360, scheme = 'light' } = {}) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: scheme, reducedMotion: 'reduce', timezoneId: 'America/Bogota' }); const page = await context.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
      await context.addInitScript(([t, l, r]) => { localStorage.setItem('elevation_token', t); localStorage.setItem('elevation_role', r); localStorage.setItem('elv_lang', l); }, [who.token, lang, 'superadmin']);
      page.on('request', r => { if (r.method() === 'PUT' && /landing-content/.test(r.url())) requests.push(r.postData()); });
      await page.route('**/api/**', r => (/\/api\/landing-content/.test(r.request().url()) ? r.continue() : /\/api\/session$/.test(r.request().url()) ? r.fulfill({ json: { role: 'superadmin', onboardingCompleted: true } }) : r.fulfill({ json: [] })));
      await page.goto(origin + '/admin/content'); await page.getByRole('tab', { name: /Textos públicos|Public texts/ }).click(); await page.waitForSelector(field); return { context, page, errors };
    }
    const alertOf = page => page.locator('.ac-conflict [role=alert]');
    const saveBtn = page => page.locator(`li:has(${field}) .ac-fact button`);
    const axe = async (page, label) => { await page.addScriptTag({ content: axeSource }); const v = await page.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } }).then(r => r.violations.map(x => x.id + ':' + x.nodes.length))); assert.deepEqual(v, [], label + ': axe 0'); };

    const pa = await open(A); const pb = await open(B); // las dos pantallas leen la MISMA versión
    // A guarda primero
    await pa.page.fill(field, 'Texto de Alfa'); await saveBtn(pa.page).click(); await pa.page.getByText('✓ Guardado').waitFor();
    assert.equal((await row()).value, 'Texto de Alfa'); check('A guarda primero: «✓ Guardado» y la base trae su texto');
    // B (versión vieja) guarda después
    await pb.page.fill(field, 'Texto de Beta'); await saveBtn(pb.page).click();
    if (CONTROL) {
      await pb.page.getByText('✓ Guardado').waitFor(); assert.equal((await row()).value, 'Texto de Beta'); assert.equal(await alertOf(pb.page).count(), 0);
      check('CONTROL (main): el segundo guardado pisa al primero EN SILENCIO y ve «Guardado» (no hay aviso, no se envía versión)'); assert.ok(requests.every(body => !/expectedUpdatedAt/.test(body)), 'main no envía expectedUpdatedAt');
      await browser.close(); browser = undefined; return;
    }
    await alertOf(pb.page).waitFor(); assert.match(await alertOf(pb.page).innerText(), /Otra persona guardó este texto mientras lo editabas\. Tus cambios siguen en esta pantalla\./);
    assert.equal((await row()).value, 'Texto de Alfa', 'un 409 NO escribe'); assert.equal(await pb.page.inputValue(field), 'Texto de Beta', 'lo escrito se conserva');
    assert.equal(await pb.page.getAttribute(field, 'aria-invalid'), 'true'); assert.match(await pb.page.getAttribute(field, 'aria-describedby'), /landing-conflict-hero_title/);
    assert.equal(await pb.page.evaluate(() => document.activeElement.textContent.trim()), 'Ver su versión', 'el foco va a «Ver su versión»');
    check('B con versión vieja: aviso en la FILA (role=alert, campo aria-invalid + describedby), la base NO cambia, lo escrito se conserva y el foco va a «Ver su versión»');
    // Ver su versión
    await pb.page.getByRole('button', { name: 'Ver su versión' }).click(); assert.equal(await pb.page.getByRole('button', { name: 'Ocultar su versión' }).getAttribute('aria-expanded'), 'true');
    const theirs = await pb.page.locator('.ac-theirs').innerText(); assert.match(theirs, /Texto de Alfa/); assert.match(theirs, /Guardado por Admin Alfa/); await pb.page.getByRole('button', { name: 'Usar la suya' }).waitFor();
    check('«Ver su versión»: muestra su texto, quién lo guardó y cuándo, y aparece «Usar la suya»');
    await axe(pb.page, 'aviso abierto (ES 1360 claro)');
    // Conservar la mía → reenvía con la versión vigente y gana
    const before = requests.length; await pb.page.getByRole('button', { name: 'Conservar la mía' }).click(); await pb.page.getByText('✓ Guardado').waitFor();
    assert.equal((await row()).value, 'Texto de Beta'); assert.equal((await row()).updated_by, 'Admin Beta'); assert.equal(await alertOf(pb.page).count(), 0); assert.equal(await pb.page.evaluate(() => document.activeElement.id), `landing-${KEY}`, 'el foco vuelve al campo');
    assert.equal(JSON.parse(requests[before]).expectedUpdatedAt !== null, true, 'reenvía con la versión vigente'); check('«Conservar la mía»: reenvía con expectedUpdatedAt = la versión vigente, gana B, desaparece el aviso y el foco vuelve al campo');
    // Usar la suya (A queda viejo)
    await pa.page.fill(field, 'Texto de Alfa 2'); await saveBtn(pa.page).click(); await alertOf(pa.page).waitFor(); await pa.page.getByRole('button', { name: 'Ver su versión' }).click();
    const putsBefore = requests.length; await pa.page.getByRole('button', { name: 'Usar la suya' }).click();
    assert.equal(await pa.page.inputValue(field), 'Texto de Beta', 'pone su texto en el campo'); assert.equal(requests.length, putsBefore, '«Usar la suya» NO guarda'); assert.equal((await row()).value, 'Texto de Beta'); assert.equal(await alertOf(pa.page).count(), 0);
    await saveBtn(pa.page).click(); await pa.page.getByText('✓ Guardado').waitFor(); check('«Usar la suya»: pone su texto en el campo SIN guardar y toma su versión: un guardado posterior ya no da conflicto');
    // El texto ya no existe (current = null)
    await sequelize.query('DELETE FROM "LandingContents" WHERE key=$1 AND lang=$2', { bind: [KEY, 'es'] });
    await pb.page.fill(field, 'Texto nuevo de Beta'); await saveBtn(pb.page).click(); await alertOf(pb.page).waitFor();
    assert.equal(await pb.page.getByRole('button', { name: 'Ver su versión' }).count(), 0, 'sin su versión no hay «Ver su versión»'); assert.equal(await pb.page.getByRole('button', { name: 'Usar la suya' }).count(), 0);
    assert.equal(await pb.page.evaluate(() => document.activeElement.textContent.trim()), 'Conservar la mía'); await pb.page.getByRole('button', { name: 'Conservar la mía' }).click(); await pb.page.getByText('✓ Guardado').waitFor();
    assert.equal((await row()).value, 'Texto nuevo de Beta'); assert.equal(JSON.parse(requests[requests.length - 1]).expectedUpdatedAt, null); check('texto borrado (current = null): sin «Ver su versión» ni «Usar la suya»; «Conservar la mía» reenvía con null y lo recrea');
    // Carrera real: las dos pantallas guardan a la vez desde la MISMA versión
    await pa.page.reload(); await pa.page.getByRole('tab', { name: 'Textos públicos' }).click(); await pa.page.waitForSelector(field); await pb.page.reload(); await pb.page.getByRole('tab', { name: 'Textos públicos' }).click(); await pb.page.waitForSelector(field);
    await pa.page.fill(field, 'Carrera A'); await pb.page.fill(field, 'Carrera B'); await Promise.all([saveBtn(pa.page).click(), saveBtn(pb.page).click()]);
    await Promise.race([alertOf(pa.page).waitFor(), alertOf(pb.page).waitFor()]); const winner = (await row()).value; assert.ok(['Carrera A', 'Carrera B'].includes(winner));
    const conflicts = (await alertOf(pa.page).count()) + (await alertOf(pb.page).count()); assert.equal(conflicts, 1, 'exactamente UNA pantalla recibe el aviso'); assert.equal(await pa.page.getByText('✓ Guardado').count() + await pb.page.getByText('✓ Guardado').count(), 1, 'exactamente una guarda');
    check('carrera real: dos guardados simultáneos desde la misma versión → exactamente uno gana (' + winner + ') y el otro ve el aviso, sin 5xx');
    // ES/EN × anchos (aviso abierto) sin desbordes, y axe en inglés oscuro
    for (const [lang, width, scheme] of [['es', 390, 'light'], ['en', 1360, 'dark'], ['en', 390, 'dark'], ['es', 320, 'light']]) {
      await sequelize.query('UPDATE "LandingContents" SET value=$3 WHERE key=$1 AND lang=$2', { bind: [KEY, 'es', 'Otro cambio ' + width] });
      const who = lang === 'en' ? A : B; const view = await open(who, { lang, width, scheme });
      await put(A, 'Cambio ajeno ' + width + lang, (await q('SELECT "updatedAt" FROM "LandingContents" WHERE key=$1 AND lang=$2', [KEY, 'es']))[0].updatedAt.toISOString()).then(r => assert.equal(r.status, 200));
      await view.page.fill(field, 'Mi texto largo '.repeat(8)); await saveBtn(view.page).click(); await alertOf(view.page).waitFor();
      await view.page.getByRole('button', { name: lang === 'en' ? 'See their version' : 'Ver su versión' }).click(); assert.ok(await view.page.getByRole('button', { name: lang === 'en' ? 'Keep mine' : 'Conservar la mía' }).isVisible());
      assert.ok(await view.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${lang} ${width}: sin scroll horizontal`);
      const small = await view.page.evaluate(() => [...document.querySelectorAll('.ac-conflict button')].filter(b => b.getBoundingClientRect().height < 24).length); assert.equal(small, 0, 'objetivos ≥ 24 px');
      if (lang === 'en' && width === 1360) { await axe(view.page, 'aviso abierto (EN 1360 oscuro)'); assert.match(await alertOf(view.page).innerText(), /Someone else saved this text while you were editing it\. Your changes are still on this screen\./); }
      assert.deepEqual(view.errors, []); await view.context.close();
    }
    check('ES/EN × 390/1360/320 (claro y oscuro): aviso y su versión sin desbordes, botones ≥ 24 px, textos en el idioma elegido y axe 0'); assert.deepEqual([...pa.errors, ...pb.errors], [], 'sin errores de página');
    console.log(`\nES-279 pantalla: ${checks.length} comprobaciones OK`);
  } catch (error) { console.error('FAIL', error && error.stack || error); require('./_exitOnFailure.cjs').fail(); }
  finally { if (browser) await browser.close().catch(() => {}); for (const s of [webServer, apiServer]) if (s) s.close(); if (sequelize) await sequelize.close().catch(() => {}); if (started) await pg.stop().catch(() => {}); try { fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 }); } catch { /* el PostgreSQL embebido libera la carpeta tras salir */ } process.exit(process.exitCode || 0); }
})();
