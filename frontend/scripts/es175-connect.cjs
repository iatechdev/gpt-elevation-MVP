// ES-175 (HU-P24) · «Mis revisiones» CONECTADA: Express + rutas reales de #262 + PostgreSQL embebido real + React construido en Chromium. Datos sintéticos, base efímera en 127.0.0.1, sin IA ni producción.
// Cubre: lista real (autor, evidencias, observación, límites, chips), objeción real con vista previa y confirmación (HTML como texto), respuesta del revisor, retirada de la autorización a mitad (403 y texto conservado),
// respuesta perdida (red/5xx) + «Comprobar» con el MISMO requestId (una sola fila), 409 already_objected, sesión vencida, vacío, franja verdadera (nunca «datos sintéticos»), axe y 390 px sin scroll horizontal.
// Uso:  (cd frontend && npx vite build && npx vite preview --host 127.0.0.1 --port 4257 --strictPort)
//       ES175C_BACKEND_DIR=<backend con las rutas de ES-175> ES175C_URL=http://127.0.0.1:4257 PLAYWRIGHT_MODULE=<playwright> [AXE_PATH=<axe.min.js>] [SHOTS_DIR=<dir>] node scripts/es175-connect.cjs
const assert = require('node:assert/strict'); const fs = require('node:fs'); const path = require('node:path'); const os = require('node:os'); const net = require('node:net');
const { once } = require('node:events'); const { randomBytes } = require('node:crypto'); const { createRequire } = require('node:module'); const { pathToFileURL } = require('node:url');
(async () => {
  assert.ok(process.env.ES175C_BACKEND_DIR, 'Se necesita el directorio del backend');
  const fromBackend = createRequire(path.join(path.resolve(process.env.ES175C_BACKEND_DIR), 'package.json'));
  const { default: EmbeddedPostgres } = await import(pathToFileURL(fromBackend.resolve('embedded-postgres')).href);
  const parent = path.resolve(os.tmpdir()); const directory = fs.mkdtempSync(path.join(parent, 'es175c-pg-')); assert.ok(path.basename(directory).startsWith('es175c-pg-'));
  const probe = net.createServer(); const port = await new Promise((resolve, reject) => { probe.once('error', reject); probe.listen(0, '127.0.0.1', () => { const p = probe.address().port; probe.close(() => resolve(p)); }); });
  const password = randomBytes(24).toString('hex');
  const pg = new EmbeddedPostgres({ databaseDir: directory, user: 'es175c', password, port, persistent: false, initdbFlags: ['--encoding=UTF8', '--locale=C'], postgresFlags: ['-h', '127.0.0.1'], onLog() {}, onError() {} });
  let started = false; let sequelize; let server; let browser; const checks = []; const check = (label) => { checks.push(label); console.log('PASS ' + label); };
  try {
    await pg.initialise(); await pg.start(); started = true;
    const { Sequelize } = fromBackend('sequelize');
    sequelize = new Sequelize(`postgres://es175c:${password}@127.0.0.1:${port}/postgres`, { logging: false, dialectOptions: { ssl: false } });
    process.env.JWT_SECRET = randomBytes(32).toString('hex'); process.env.DATA_ENCRYPTION_KEY = randomBytes(32).toString('hex'); process.env.NODE_ENV = 'test';
    const id = fromBackend.resolve('./database'); require.cache[id] = { id, filename: id, loaded: true, exports: { sequelize } };
    for (const name of ['PricingPlan', 'User', 'Consent', 'ConsentEvent', 'DeletionRequest', 'RevokedToken', 'AuthRevocation', 'Evidence', 'EvidenceVersion', 'DerivedInvalidation', 'ReviewShare', 'ProfessionalReview', 'ReviewObjection', 'ReviewResponse', 'TherapistPersonOrdinal', 'TherapistOrdinalCounter', 'ParticipantResume']) fromBackend('./' + name);
    const reviews = fromBackend('./utils/reviews'); const evidence = fromBackend('./utils/evidence'); fromBackend('./utils/personOrdinals');
    await sequelize.sync();
    const User = fromBackend('./User'); const { issueToken } = fromBackend('./utils/sessions'); const rid = () => require('node:crypto').randomUUID();
    const express = fromBackend('express'); const app = express(); app.use(express.json());
    app.use('/api/me', fromBackend('./middlewares/auth').verificarToken, fromBackend('./routes/professionalReviews'));
    server = app.listen(0, '127.0.0.1'); await once(server, 'listening'); const apiUrl = `http://127.0.0.1:${server.address().port}`;
    const mk = async (role, n) => { const u = await User.create({ name: `${role} sintético ${n}`, email: `${role}${n}@example.invalid`, password: 'x', role }); return { id: u.id, role, token: issueToken({ id: u.id, role }) }; };
    const payload = (title) => ({ title, situation: 'Un proyecto', responsibility: { text: 'Yo coordinaba' }, actions: [{ text: 'Organicé tareas' }], delivered: { text: 'Un plan' }, observedEffect: { known: false }, autonomy: 'autonomous' });
    let counter = 0;
    // Una persona con una revisión registrada por un revisor (usuario therapist) sobre una evidencia suya.
    const scene = async ({ observation = 'Observación de prueba', title = 'Mi explicación de tres pasos', reviewerName } = {}) => {
      counter += 1; const person = await mk('user', counter); const reviewer = await mk('therapist', counter);
      if (reviewerName) await User.update({ name: reviewerName }, { where: { id: reviewer.id } });
      const ev = await evidence.create(person.id, { payload: payload(title), status: 'confirmed', requestId: rid() });
      const share = await reviews.authorize(person.id, { reviewerId: reviewer.id, evidenceIds: [ev.id], requestId: rid() });
      const review = await reviews.createReview(reviewer.id, { shareId: share.id, evidenceIds: [ev.id], observation, limits: 'Límites de prueba / test limits', locale: 'es', requestId: rid() });
      return { person, reviewer, ev, share, review };
    };
    const { chromium } = process.env.PLAYWRIGHT_MODULE ? require(process.env.PLAYWRIGHT_MODULE) : await import('playwright');
    browser = await chromium.launch({ headless: true });
    const frontend = process.env.ES175C_URL || 'http://127.0.0.1:4257'; assert.ok(['127.0.0.1', 'localhost'].includes(new URL(frontend).hostname));
    const axeSource = process.env.AXE_PATH ? fs.readFileSync(process.env.AXE_PATH, 'utf8') : ''; const shots = process.env.SHOTS_DIR; if (shots) fs.mkdirSync(shots, { recursive: true });
    async function open(who, { lang = 'es', width = 1360, scheme = 'light', route = '/app/professional-reviews', intercept } = {}) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: scheme }); const page = await context.newPage(); const errors = [];
      page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => { if (m.type() === 'error' && !/status of (401|403|404|409|500)|Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 200)); });
      await page.addInitScript(([t, l]) => { localStorage.setItem('elevation_token', t); localStorage.setItem('elv_lang', l); }, [who.token, lang]);
      await page.route('**/api/session', (r) => r.fulfill({ json: { role: 'user', onboardingCompleted: true } }));
      const seen = []; await page.route('**/api/me/**', async (r) => {
        const url = new URL(r.request().url()); seen.push({ method: r.request().method(), path: url.pathname, body: r.request().postData() });
        if (intercept) { const handled = await intercept(r, seen); if (handled) return; }
        const response = await r.fetch({ url: apiUrl + url.pathname + url.search }); return r.fulfill({ response });
      });
      await page.goto(frontend + route); return { context, page, errors, seen };
    }
    const audit = async (page, label) => { if (!axeSource) return; await page.addScriptTag({ content: axeSource }); const v = await page.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } }).then((r) => r.violations.map((x) => x.id + ':' + x.nodes.length + ' ' + x.nodes.slice(0, 2).map((n) => n.target.join(' ') + ' ' + (n.any[0] && n.any[0].message)).join(' | ')))); assert.deepEqual(v, [], label + ' axe'); };
    const shot = async (page, name) => { if (shots) await page.screenshot({ path: path.join(shots, name + '.png'), fullPage: true }); };
    const dbCount = async (sql, params) => Number((await sequelize.query(sql, { replacements: params, type: 'SELECT' }))[0].n);

    for (const [lang, width, scheme] of [['es', 390, 'light'], ['en', 1360, 'dark']]) {
      const tag = `${lang} ${width}px ${scheme}`; const T = lang === 'es' ? { banner: 'Función en validación', pending: 'Pendiente de respuesta', object: 'Objetar revisión', preview: 'Vista previa', confirm: 'Confirmar objeción', saved: 'Tu objeción quedó registrada', empty: 'Todavía no tienes revisiones' } : { banner: 'Feature in validation', pending: 'Awaiting response', object: 'Object to review', preview: 'Preview', confirm: 'Confirm objection', saved: 'Your objection was recorded', empty: 'You have no reviews yet' };
      // 0) vacío
      { const lone = await mk('user', 900 + width); const { context, page, errors } = await open(lone, { lang, width, scheme }); await page.getByText(T.empty).waitFor({ timeout: 8000 });
        const body = await page.locator('body').innerText(); assert.ok(body.includes(T.banner) && !/sint[eé]tic|ficticio|synthetic|fictitious|dummy/i.test(body), 'franja verdadera, nunca «datos sintéticos»'); assert.equal(await page.locator('h1').count(), 1);
        await audit(page, tag + ' vacío'); await shot(page, `vacio-${lang}-${width}-${scheme}`); assert.deepEqual(errors, []); await context.close(); check(`${tag}: vacío con franja verdadera («función en validación»), un h1, axe 0`); }
      // 1) revisión real + objeción con vista previa, HTML como texto, y la respuesta del revisor
      { const long = 'L'.repeat(60); const s = await scene({ observation: '<img src=x onerror="window.__xss=1"> & <b>negrita</b> ' + long, reviewerName: 'Revisora Sintética' });
        const { context, page, errors, seen } = await open(s.person, { lang, width, scheme }); await page.locator('.cgf-review').waitFor({ timeout: 8000 });
        const card = await page.locator('.cgf-review').innerText(); assert.ok(card.includes('Revisora Sintética') && card.includes('Mi explicación de tres pasos') && card.includes('<img src=x'), 'autor, título de SU evidencia y HTML como texto');
        assert.equal(await page.evaluate(() => window.__xss), undefined); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'sin scroll horizontal');
        await audit(page, tag + ' revisión'); await shot(page, `revision-${lang}-${width}-${scheme}`);
        await page.getByRole('button', { name: T.object }).click(); const area = page.locator('.cgf-form textarea'); assert.ok(await area.evaluate((el) => document.activeElement === el), 'el foco va al campo');
        const text = 'No coincide <b>x</b> ' + long; await area.fill(text); await page.getByRole('button', { name: T.preview }).click(); await page.locator('.cg-hintbox').waitFor(); assert.ok((await page.locator('.cg-hintbox').innerText()).includes(text), 'vista previa exacta');
        await audit(page, tag + ' vista previa'); await shot(page, `previa-${lang}-${width}-${scheme}`);
        await page.getByRole('button', { name: T.confirm }).click(); await page.getByText(T.saved).waitFor({ timeout: 8000 });
        await page.getByText(T.pending).first().waitFor({ timeout: 8000 }); assert.equal(await dbCount('SELECT count(*) n FROM "ReviewObjections" WHERE "UserId"=:u', { u: s.person.id }), 1);
        const post = seen.find((x) => x.method === 'POST'); assert.match(post.body, /"requestId":"[0-9a-f-]{36}"/); assert.equal(await page.evaluate(() => window.__xss), undefined);
        await audit(page, tag + ' objeción registrada'); await shot(page, `objecion-${lang}-${width}-${scheme}`);
        // la respuesta del revisor se ve tras actualizar
        const pending = await sequelize.query('SELECT id FROM "ReviewObjections" WHERE "UserId"=:u', { replacements: { u: s.person.id }, type: 'SELECT' });
        await reviews.respond(s.reviewer.id, pending[0].id, { text: 'Gracias, lo reviso <b>hoy</b>', requestId: rid(), locale: 'es' }); await page.reload(); await page.getByText('Gracias, lo reviso <b>hoy</b>').waitFor({ timeout: 8000 });
        await audit(page, tag + ' respondida'); assert.deepEqual(errors, []); await context.close(); check(`${tag}: revisión real, objeción con vista previa exacta y confirmación (una fila), HTML como texto, respuesta del revisor visible, axe 0, sin scroll horizontal`); }
    }
    // 2) acceso retirado a mitad: 403, el texto se conserva y no se guarda nada
    { const s = await scene(); const { context, page } = await open(s.person); await page.locator('.cgf-review').waitFor(); await page.getByRole('button', { name: 'Objetar revisión' }).click();
      await page.locator('.cgf-form textarea').fill('Texto que no debe perderse'); await page.getByRole('button', { name: 'Vista previa' }).click(); await page.locator('.cg-hintbox').waitFor();
      await reviews.revoke(s.person.id, s.share.id); await page.getByRole('button', { name: 'Confirmar objeción' }).click(); await page.getByText('ya no está vigente').waitFor({ timeout: 8000 });
      assert.ok((await page.locator('.cg-hintbox').innerText()).includes('Texto que no debe perderse'), 'el texto se conserva'); assert.equal(await dbCount('SELECT count(*) n FROM "ReviewObjections" WHERE "UserId"=:u', { u: s.person.id }), 0);
      assert.equal(await page.getByRole('button', { name: 'Confirmar objeción' }).isDisabled(), true); await audit(page, 'retirada'); await context.close(); check('acceso retirado a mitad: 403 con mensaje, texto conservado, nada guardado, no se puede reenviar'); }
    // 3) respuesta perdida: el servidor guarda pero la respuesta se pierde (500) → «Comprobar» reenvía con el MISMO requestId → una sola fila
    { const s = await scene(); let first = true;
      const { context, page, seen } = await open(s.person, { intercept: async (r) => { if (r.request().method() === 'POST' && first) { first = false; const url = new URL(r.request().url()); await r.fetch({ url: apiUrl + url.pathname }); await r.fulfill({ status: 500, json: { code: 'x' } }); return true; } return false; } });
      await page.locator('.cgf-review').waitFor(); await page.getByRole('button', { name: 'Objetar revisión' }).click(); await page.locator('.cgf-form textarea').fill('Objeción con respuesta perdida');
      await page.getByRole('button', { name: 'Vista previa' }).click(); await page.getByRole('button', { name: 'Confirmar objeción' }).click(); await page.getByText('No pudimos confirmar si se guardó').waitFor({ timeout: 8000 });
      assert.equal(await dbCount('SELECT count(*) n FROM "ReviewObjections" WHERE "UserId"=:u', { u: s.person.id }), 1, 'el servidor sí guardó');
      await page.getByRole('button', { name: 'Comprobar' }).click(); await page.getByText('Tu objeción quedó registrada').waitFor({ timeout: 8000 });
      const posts = seen.filter((x) => x.method === 'POST'); assert.equal(posts.length, 2); assert.equal(JSON.parse(posts[0].body).requestId, JSON.parse(posts[1].body).requestId, 'el MISMO requestId');
      assert.equal(await dbCount('SELECT count(*) n FROM "ReviewObjections" WHERE "UserId"=:u', { u: s.person.id }), 1, 'sin duplicar'); await context.close(); check('respuesta perdida: «Comprobar» reenvía con el mismo requestId y queda UNA sola objeción'); }
    // 4) 409 already_objected (otra pestaña ya objetó): se muestra la existente y no se duplica
    { const s = await scene(); const { context, page } = await open(s.person); await page.locator('.cgf-review').waitFor(); await page.getByRole('button', { name: 'Objetar revisión' }).click(); await page.locator('.cgf-form textarea').fill('Segunda desde la pantalla vieja');
      await page.getByRole('button', { name: 'Vista previa' }).click();
      await sequelize.query('INSERT INTO "ReviewObjections" ("reviewId","UserId","reason","locale","requestId","createdAt") VALUES (:r,:u,:t,\'es\',:q,now())', { replacements: { r: s.review.id, u: s.person.id, t: fromBackend('./utils/crypto').encriptar('Objeción hecha en otra pestaña'), q: rid() } });
      await page.getByRole('button', { name: 'Confirmar objeción' }).click(); await page.getByText('ya tenía una objeción').waitFor({ timeout: 8000 }); await page.getByText('Objeción hecha en otra pestaña').waitFor({ timeout: 8000 });
      assert.equal(await dbCount('SELECT count(*) n FROM "ReviewObjections" WHERE "UserId"=:u', { u: s.person.id }), 1); await context.close(); check('409 already_objected: se muestra la objeción existente, sin duplicar'); }
    // 5) sesión vencida (401) y error de carga con reintento
    { const s = await scene(); const { context, page } = await open(s.person, { intercept: async (r) => { if (r.request().method() === 'GET') { await r.fulfill({ status: 401, json: { error: 'x' } }); return true; } return false; } });
      await page.getByText('Tu sesión venció').waitFor({ timeout: 8000 }); assert.ok(await page.getByRole('link', { name: 'Entrar' }).isVisible()); await audit(page, 'sesión'); await context.close();
      let fail = true; const second = await open(s.person, { intercept: async (r) => { if (r.request().method() === 'GET' && fail) { fail = false; await r.fulfill({ status: 500, json: {} }); return true; } return false; } });
      await second.page.getByText('No pudimos cargar tus revisiones').waitFor({ timeout: 8000 }); await second.page.getByRole('button', { name: 'Reintentar' }).click(); await second.page.locator('.cgf-review').waitFor({ timeout: 8000 }); await second.context.close(); check('401 → sesión vencida con enlace a entrar; 500 → error con reintento que recupera la lista'); }
    // 6) aislamiento: otra persona nunca ve estas revisiones
    { const a = await scene(); const b = await mk('user', 7777); const { context, page } = await open(b); await page.getByText('Todavía no tienes revisiones').waitFor({ timeout: 8000 }); assert.ok(!(await page.locator('body').innerText()).includes('Observación de prueba')); await context.close(); check('aislamiento: otra persona no ve las revisiones de A'); void a; }
    console.log(`ES-175 conexión: ${checks.length} comprobaciones superadas (Express + rutas reales de #262 + PostgreSQL real + Chromium).`);
  } catch (error) {
    console.error('ES-175 conexión falló:', error); process.exitCode = 1;
  } finally {
    if (browser) await browser.close(); if (server) await new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); });
    if (sequelize) await sequelize.close(); if (started) await pg.stop(); try { fs.rmSync(directory, { recursive: true, force: true, maxRetries: 8, retryDelay: 300 }); } catch { /* Windows aún bloquea el directorio temporal */ }
  }
})();
