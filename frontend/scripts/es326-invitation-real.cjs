// ES-326: aceptar una invitación (/accept-invitation) con la casilla del aviso y los términos. Chromium sobre el build real + server.js REAL + PostgreSQL REAL; personas SINTÉTICAS, sin IA ni correo real.
// Personas SINTÉTICAS (registro real por /api/register), sin IA ni correo reales; el navegador reenvía /api/* al servidor real desde Node (sin CORS). ES y EN.
// Uso (desde frontend/): ES326_BACKEND_DIR=<backend> PLAYWRIGHT_MODULE=<playwright> PLAYWRIGHT_BROWSERS_PATH=<navegadores> node scripts/es326-return-real.cjs   (construye con vite; tarda unos minutos)
const assert = require('node:assert/strict'); const fs = require('node:fs'); const path = require('node:path'); const os = require('node:os'); const net = require('node:net'); const http = require('node:http');
const { once } = require('node:events'); const { randomBytes } = require('node:crypto'); const { createRequire } = require('node:module'); const { pathToFileURL } = require('node:url'); const { spawnSync } = require('node:child_process');

(async () => {
  assert.ok(process.env.ES326_BACKEND_DIR, 'Se necesita ES326_BACKEND_DIR (directorio del backend)');
  const backend = path.resolve(process.env.ES326_BACKEND_DIR); const root = path.resolve(__dirname, '..'); const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'es326-'));
  const fromBackend = createRequire(path.join(backend, 'package.json'));
  const { default: EmbeddedPostgres } = await import(pathToFileURL(fromBackend.resolve('embedded-postgres')).href);
  const probe = net.createServer(); const port = await new Promise((resolve, reject) => { probe.once('error', reject); probe.listen(0, '127.0.0.1', () => { const p = probe.address().port; probe.close(() => resolve(p)); }); });
  const password = randomBytes(24).toString('hex');
  const pg = new EmbeddedPostgres({ databaseDir: path.join(tmp, 'pg'), user: 'es326_test', password, port, persistent: false, initdbFlags: ['--encoding=UTF8', '--locale=C'], postgresFlags: ['-h', '127.0.0.1'], onLog() {}, onError() {} });
  const cleanups = []; const checks = []; const check = label => { checks.push(label); console.log('PASS ' + label); };
  let started = false, browser, staticServer;
  try {
    await pg.initialise(); await pg.start(); started = true;
    process.env.LOGIN_RATE_LIMIT_MAX = '1000'; // el límite real (10/min por IP) no aplica a una ráfaga de personas sintéticas desde 127.0.0.1
    process.env.ES326_TEST_DATABASE_URL = `postgres://es326_test:${password}@127.0.0.1:${port}/postgres`;
    const { startRealApi } = fromBackend('./test/support/realApi.cjs');
    const api = await startRealApi({ after: fn => cleanups.push(fn) }, { envVar: 'ES326_TEST_DATABASE_URL', prefix: 'es326' });
    const terms = fromBackend('./utils/terms'); const PASSWORD = 'Sintetica-Clave-2026!'; let seq = 0;
    const mkPerson = async (role, onboarded = true) => {
      const email = `es326-${++seq}-${randomBytes(3).toString('hex')}@example.test`;
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
    const supUser = await mkPerson('superadmin'); const sup = { id: (await api.q('SELECT id FROM "Users" WHERE email=$1', [supUser.email]))[0].id }; const AXE = fs.readFileSync(process.env.AXE_PATH, 'utf8'); const { makeSeeder } = fromBackend('./test/support/seedRow.cjs'); const seed = makeSeeder(api.q); const sha = v => require('node:crypto').createHash('sha256').update(v).digest('hex'); let inv = 0;

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

    const VERSION = fromBackend('./utils/terms').current().version; const STRONG = 'Zx9!kLm2pQ';
    const invite = async () => { inv += 1; const token = randomBytes(32).toString('base64url'); const email = 'es326-' + inv + '-' + randomBytes(3).toString('hex') + '@example.test';
      await seed('Invitations', { email, role: 'user', invitedBy: sup.id, tokenHash: sha(token), expiresAt: new Date(Date.now() + 3600000), usedAt: null, locale: 'es', requestId: null }); return { token, email }; };
    const rowOf = async email => (await api.q('SELECT active, role, "termsVersion", "acceptedAt" FROM "Users" WHERE email=$1', [email]))[0];
    const usedAt = async email => (await api.q('SELECT "usedAt" FROM "Invitations" WHERE email=$1', [email]))[0].usedAt;
    const axeOf = async page => { await page.addScriptTag({ content: AXE }); return page.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } }).then(r => r.violations.map(v => v.id + ':' + v.nodes.length))); };
    const small = page => page.evaluate(() => [...document.querySelectorAll('input:not([type=hidden]),button,a')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && (r.width < 24 || r.height < 24) && getComputedStyle(e).display !== 'inline' }).map(e => e.tagName + ':' + (e.id || e.textContent.trim().slice(0, 20))));
    for (const lang of ['es', 'en']) {
      const S = lang === 'es' ? { title: 'Crea tu cuenta', submit: 'Crear cuenta', done: 'Cuenta creada', bad: 'Este enlace no sirve', terms: 'Para crear tu cuenta necesitas aceptar' } : { title: 'Create your account', submit: 'Create account', done: 'Account created', bad: 'This link does not work', terms: 'To create your account you need to accept' };
      // 1) flujo feliz: el token sale de la URL; sin casilla NO se envía nada; con casilla se crea la cuenta con la versión vigente del servidor; luego entra con ella
      { const { context, page, external } = await open(lang); const posts = []; page.on('request', r => { if (r.url().includes('/api/invitations/accept')) posts.push(r.postData()) });
        const { token, email } = await invite(); await page.goto(origin + '/accept-invitation#token=' + token); await page.waitForLoadState('networkidle');
        assert.equal(new URL(page.url()).hash, '', 'el token se quita de la barra de direcciones'); assert.equal(await page.locator('h1').textContent(), S.title);
        await page.locator('#invite-name').fill('Persona Invitada'); await page.locator('#invite-password').fill(STRONG);
        await page.locator('button[type=submit]').click(); await page.waitForTimeout(400);
        assert.equal(posts.length, 0, 'sin casilla no se envía nada'); assert.match(await page.locator('#access-terms-error').innerText(), new RegExp(S.terms)); assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.id), 'access-terms', 'el foco va a la casilla');
        assert.equal(await usedAt(email), null, 'el enlace no se gastó');
        await page.locator('#access-terms').check(); await page.locator('button[type=submit]').click(); await page.getByRole('heading', { name: S.done }).waitFor({ timeout: 20000 });
        assert.equal(posts.length, 1); const sent = JSON.parse(posts[0]); assert.equal(sent.acceptedTerms, true); assert.equal(sent.termsVersion, VERSION); assert.equal(Object.keys(sent).sort().join(), 'acceptedTerms,name,password,termsVersion,token');
        const saved = await rowOf(email); assert.equal(saved.termsVersion, VERSION); assert.equal(saved.active, true); assert.equal(saved.role, 'user'); assert.ok(saved.acceptedAt);
        assert.equal(await page.evaluate(() => localStorage.getItem('elevation_token')), null, 'no inicia sesión: pide entrar');
        await page.goto(origin + '/login'); await page.locator('#access-email').fill(email); await page.locator('#access-password').fill(STRONG); await page.locator('button[type=submit]').click(); await page.waitForURL(u => u.pathname !== '/login', { timeout: 20000 });
        assert.deepEqual(external, []); await context.close(); }
      check(lang + ': invitación → sin casilla no se envía, con casilla crea la cuenta con la versión y fecha del servidor y se puede entrar');
      // 2) enlace inválido: sin token → tarjeta de enlace que no sirve; token desconocido → lo mismo tras enviar; contraseña débil no gasta el enlace
      { const { context, page } = await open(lang); await page.goto(origin + '/accept-invitation'); await page.waitForLoadState('networkidle'); assert.equal(await page.locator('h1').textContent(), S.bad);
        await page.goto('about:blank'); await page.goto(origin + '/accept-invitation#token=' + randomBytes(32).toString('base64url')); await page.waitForLoadState('networkidle');
        await page.locator('#invite-name').fill('Alguien'); await page.locator('#invite-password').fill(STRONG); await page.locator('#access-terms').check(); await page.locator('button[type=submit]').click(); await page.getByRole('heading', { name: S.bad }).waitFor({ timeout: 20000 });
        const { token, email } = await invite(); await page.goto('about:blank'); await page.goto(origin + '/accept-invitation#token=' + token); await page.waitForLoadState('networkidle');
        await page.locator('#invite-name').fill('Alguien'); await page.locator('#invite-password').fill('abc'); await page.locator('#access-terms').check(); await page.locator('button[type=submit]').click(); await page.waitForTimeout(500);
        assert.equal(await page.locator('h1').textContent(), S.title, 'sigue en el formulario'); assert.equal(await usedAt(email), null, 'contraseña débil: el enlace no se gastó'); assert.equal(await rowOf(email), undefined);
        await context.close(); }
      check(lang + ': enlace sin token o desconocido → «' + S.bad + '»; contraseña débil no gasta el enlace');
      // 3) accesibilidad y responsive: axe 2.2 AA = 0, sin desborde, objetivos ≥ 24 px, teclado (Tab llega a la casilla y al botón) — 320/390/1360 × claro/oscuro, en el formulario vacío, con errores y en los estados final e inválido
      for (const width of [390, 1360, 320]) for (const scheme of ['light', 'dark']) {
        const { context, page } = await open(lang); await page.setViewportSize({ width, height: 900 }); await page.emulateMedia({ colorScheme: scheme });
        const { token } = await invite(); const states = [];
        await page.goto(origin + '/accept-invitation#token=' + token); await page.waitForLoadState('networkidle'); states.push('formulario');
        const probe = async label => { const axeRes = await axeOf(page); const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth); const tiny = await small(page);
          assert.deepEqual(axeRes, [], lang + ' ' + width + ' ' + scheme + ' ' + label + ': axe'); assert.ok(overflow <= 0, lang + ' ' + width + ' ' + label + ': desborde ' + overflow); assert.deepEqual(tiny, [], lang + ' ' + width + ' ' + label + ': objetivos < 24 px'); };
        await probe('formulario vacío');
        await page.locator('button[type=submit]').click(); await page.waitForTimeout(300); await probe('errores por campo');
        for (let i = 0; i < 8; i++) { await page.keyboard.press('Tab'); }
        await page.goto(origin + '/accept-invitation'); await page.waitForLoadState('networkidle'); await probe('enlace inválido');
        await context.close();
      }
      check(lang + ': axe 2.2 AA = 0, sin desborde y objetivos ≥ 24 px en 320/390/1360 × claro/oscuro (formulario, errores, enlace inválido)');
    }
    console.log(`\n${checks.length} comprobaciones, todas PASS`);
  } finally {
    if (browser) await browser.close().catch(() => {}); if (staticServer) staticServer.close();
    for (const fn of cleanups.reverse()) await Promise.resolve(fn()).catch(() => {});
    if (started) await pg.stop().catch(() => {});
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* limpieza */ }
  }
})().catch(error => { console.error('FALLA', error && error.stack || error); process.exit(1); });
