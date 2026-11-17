// ES-330: volver a la ruta protegida original tras iniciar sesión, SIN redirección abierta. E2E en Chromium sobre el build real, contra el server.js REAL y PostgreSQL REAL (migraciones reales).
// Personas SINTÉTICAS (registro real por /api/register), sin IA ni correo reales; el navegador reenvía /api/* al servidor real desde Node (sin CORS). ES y EN.
// Uso (desde frontend/): ES330_BACKEND_DIR=<backend> PLAYWRIGHT_MODULE=<playwright> PLAYWRIGHT_BROWSERS_PATH=<navegadores> node scripts/es330-return-real.cjs   (construye con vite; tarda unos minutos)
const assert = require('node:assert/strict'); const fs = require('node:fs'); const path = require('node:path'); const os = require('node:os'); const net = require('node:net'); const http = require('node:http');
const { once } = require('node:events'); const { randomBytes } = require('node:crypto'); const { createRequire } = require('node:module'); const { pathToFileURL } = require('node:url'); const { spawnSync } = require('node:child_process');

(async () => {
  assert.ok(process.env.ES330_BACKEND_DIR, 'Se necesita ES330_BACKEND_DIR (directorio del backend)');
  const backend = path.resolve(process.env.ES330_BACKEND_DIR); const root = path.resolve(__dirname, '..'); const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'es330-'));
  const fromBackend = createRequire(path.join(backend, 'package.json'));
  const { default: EmbeddedPostgres } = await import(pathToFileURL(fromBackend.resolve('embedded-postgres')).href);
  const probe = net.createServer(); const port = await new Promise((resolve, reject) => { probe.once('error', reject); probe.listen(0, '127.0.0.1', () => { const p = probe.address().port; probe.close(() => resolve(p)); }); });
  const password = randomBytes(24).toString('hex');
  const pg = new EmbeddedPostgres({ databaseDir: path.join(tmp, 'pg'), user: 'es330_test', password, port, persistent: false, initdbFlags: ['--encoding=UTF8', '--locale=C'], postgresFlags: ['-h', '127.0.0.1'], onLog() {}, onError() {} });
  const cleanups = []; const checks = []; const check = label => { checks.push(label); console.log('PASS ' + label); };
  let started = false, browser, staticServer;
  try {
    await pg.initialise(); await pg.start(); started = true;
    process.env.LOGIN_RATE_LIMIT_MAX = '1000'; // el límite real (10/min por IP) no aplica a una ráfaga de personas sintéticas desde 127.0.0.1
    process.env.ES330_TEST_DATABASE_URL = `postgres://es330_test:${password}@127.0.0.1:${port}/postgres`;
    const { startRealApi } = fromBackend('./test/support/realApi.cjs');
    const api = await startRealApi({ after: fn => cleanups.push(fn) }, { envVar: 'ES330_TEST_DATABASE_URL', prefix: 'es330' });
    const terms = fromBackend('./utils/terms'); const PASSWORD = 'Sintetica-Clave-2026!'; let seq = 0;
    const mkPerson = async (role, onboarded = true) => {
      const email = `es330-${++seq}-${randomBytes(3).toString('hex')}@example.test`;
      const reg = await api.http(null, 'POST', '/api/register', { name: 'Persona Sintética', email, password: PASSWORD, acceptedTerms: true, termsVersion: terms.current().version });
      assert.equal(reg.status, 201, JSON.stringify(reg.body));
      await api.q('UPDATE "Users" SET role=$2, active=true WHERE email=$1', [email, role]);
      const login = await api.http(null, 'POST', '/api/login', { email, password: PASSWORD }); assert.equal(login.status, 200, JSON.stringify(login.body));
      if (role === 'user' && onboarded) {
        const blank = { preferredLanguage: null, residenceCountry: null, targetMarket: null, timeZone: null, profession: null, interests: null, availabilityMinutesPerWeek: null, careerGoal: null, careerConstraints: null, sector: null, totalYearsExperience: null, experience: [], education: [], declaredSkills: [], languages: [] };
        const done = await api.http({ token: login.body.token }, 'PUT', '/api/user/context', { schemaVersion: 2, expectedVersion: 0, action: 'continue', context: { ...blank, preferredLanguage: 'es', timeZone: 'America/Bogota' } });
        assert.equal(done.status, 200, JSON.stringify(done.body));
      }
      return { email, token: login.body.token };
    };
    const person = await mkPerson('user'); const fresh = await mkPerson('user', false); const admin = await mkPerson('admin'); const pro = await mkPerson('therapist');

    const dist = path.join(tmp, 'dist');
    const built = spawnSync(process.execPath, [path.join(root, 'node_modules/vite/bin/vite.js'), 'build', '--outDir', dist], { cwd: root, encoding: 'utf8', env: { ...process.env, VITE_BACKEND_URL: '' } });
    if (built.status !== 0) throw new Error('build: ' + built.stderr);
    staticServer = http.createServer((req, res) => {
      const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); const target = path.resolve(dist, '.' + pathname);
      const file = target.startsWith(dist + path.sep) && fs.existsSync(target) && fs.statSync(target).isFile() ? target : path.join(dist, 'index.html');
      res.setHeader('Content-Type', ({ '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' })[path.extname(file)] || 'text/html'); res.end(fs.readFileSync(file));
    }); staticServer.listen(0, '127.0.0.1'); await once(staticServer, 'listening'); const origin = `http://127.0.0.1:${staticServer.address().port}`;

    const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright'); browser = await chromium.launch({ headless: true });
    const open = async lang => {
      const context = await browser.newContext({ viewport: { width: 1000, height: 800 }, reducedMotion: 'reduce' }); const page = await context.newPage(); const external = [];
      await context.addInitScript(l => { localStorage.setItem('elv_lang', l); }, lang);
      await page.route('**/*', async route => {
        const url = new URL(route.request().url());
        if (url.origin !== origin) { external.push(url.href); return route.abort(); } // cualquier salida a otro origen es un fallo
        if (!url.pathname.startsWith('/api/')) return route.continue();
        const req = route.request();
        const res = await fetch(api.base + url.pathname + url.search, { method: req.method(), headers: { 'Content-Type': 'application/json', ...(req.headers().authorization ? { Authorization: req.headers().authorization } : {}) }, ...(req.postData() ? { body: req.postData() } : {}) });
        return route.fulfill({ status: res.status, contentType: 'application/json', body: await res.text() });
      });
      return { context, page, external };
    };
    const login = async (page, who) => { await page.locator('#access-email').fill(who.email); await page.locator('#access-password').fill(PASSWORD); await page.locator('button[type=submit]').click(); };
    const settle = async (page, expected) => { await page.waitForURL(u => u.pathname === expected || u.pathname.startsWith(expected + '/'), { timeout: 20000 }); await page.waitForLoadState('networkidle'); };

    for (const lang of ['es', 'en']) {
      // 1) ruta de persona pedida SIN sesión → /login → entra → vuelve a ella (con su búsqueda)
      { const { context, page, external } = await open(lang);
        await page.goto(origin + '/app/diary?from=correo'); await settle(page, '/login'); assert.equal(new URL(page.url()).search, '', '/login no lleva la ruta en la URL (nada que manipular)');
        await login(page, person); await settle(page, '/app/diary'); assert.equal(new URL(page.url()).search, '?from=correo'); assert.deepEqual(external, []); await context.close(); }
      check(`${lang}: persona pide /app/diary?from=correo sin sesión → /login → vuelve a la misma ruta y búsqueda`);
      // 2) la ruta sobrevive a «olvidé mi contraseña» y volver (y a alternar registro, que es el mismo /login)
      { const { context, page } = await open(lang);
        await page.goto(origin + '/app/skill-map'); await settle(page, '/login');
        await page.goto(origin + '/forgot-password'); await page.locator('a[href="/login"]').first().click(); await settle(page, '/login');
        await login(page, person); await settle(page, '/app/skill-map'); await context.close(); }
      check(`${lang}: la ruta recordada sobrevive a «olvidé mi contraseña» y se vuelve tras entrar`);
      // 3) administración
      { const { context, page } = await open(lang); await page.goto(origin + '/admin/users'); await settle(page, '/login'); await login(page, admin); await settle(page, '/admin/users'); await context.close(); }
      check(`${lang}: administración pide /admin/users → vuelve a /admin/users`);
      // 4) el rol real no corresponde → inicio de SU rol (nunca la ruta ajena)
      { const { context, page } = await open(lang); await page.goto(origin + '/admin/users'); await settle(page, '/login'); await login(page, pro); await settle(page, '/therapist/dashboard');
        assert.ok(!new URL(page.url()).pathname.startsWith('/admin'), 'el profesional no llega a administración'); await context.close(); }
      check(`${lang}: un profesional que pidió /admin/users cae en su inicio (/therapist/dashboard), no en administración`);
      { const { context, page } = await open(lang); await page.goto(origin + '/app/skill-map'); await settle(page, '/login'); await login(page, admin); await settle(page, '/admin/dashboard'); await context.close(); }
      check(`${lang}: administración que pidió una pantalla de persona cae en /admin/dashboard`);
      // 5) persona sin onboarding terminado → onboarding primero
      { const { context, page } = await open(lang); await page.goto(origin + '/app/skill-map'); await settle(page, '/login'); await login(page, fresh); await settle(page, '/app/onboarding'); await context.close(); }
      check(`${lang}: persona sin onboarding terminado entra primero a /app/onboarding`);
      // 6) valores hostiles escritos a mano en la pestaña NUNCA se siguen (sin salida a otro origen)
      for (const evil of ['//evil.example.test/x', 'https://evil.example.test/', 'javascript:alert(1)', '/\\evil.example.test', '/app/../login', '/app/x#h']) {
        const { context, page, external } = await open(lang); await page.goto(origin + '/login');
        await page.evaluate(value => sessionStorage.setItem('elevation_return_to', JSON.stringify({ path: value, at: Date.now() })), evil);
        await login(page, admin); await settle(page, '/admin/dashboard'); await page.waitForTimeout(500);
        const where = new URL(page.url()); assert.equal(where.origin, origin, evil); assert.equal(where.pathname, '/admin/dashboard', `${evil} → ${where.pathname}`);
        assert.deepEqual(external, [], 'ninguna petición a otro origen: ' + evil); await context.close(); }
      check(`${lang}: destinos hostiles guardados a mano (//, https:, javascript:, \\, ../, hash) → inicio del rol, 0 salidas a otro origen`);
    }
    console.log(`\n${checks.length} comprobaciones, todas PASS`);
  } finally {
    if (browser) await browser.close().catch(() => {}); if (staticServer) staticServer.close();
    for (const fn of cleanups.reverse()) await Promise.resolve(fn()).catch(() => {});
    if (started) await pg.stop().catch(() => {});
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* limpieza */ }
  }
})().catch(error => { console.error('FALLA', error && error.stack || error); process.exit(1); });
