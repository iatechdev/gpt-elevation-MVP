// ES-170: «Mis herramientas» y «Ejercicios» con la respuesta REAL de GET /api/exercises (Express + ruta real de lectura de ES-194 + PostgreSQL embebido real + React construido en Chromium).
// La persona ve SOLO los publicados (un borrador y un retirado no salen, ni por clave); «Contenido en revisión» solo si reviewStatus !== 'done'; el tiempo sale de `minutes`; el ejercicio retirado entre la lista y abrirlo
// dice «ya no está disponible»; vacío, cargando y error con «Reintentar» (con el foco); notas que no se guardan, copiar con error si el portapapeles se niega, aviso al cerrar con notas; el enlace del menú no depende de una bandera.
// Datos sintéticos, base efímera en 127.0.0.1, sin IA ni producción.
// Uso:  (cd frontend && npx vite build && npx vite preview --host 127.0.0.1 --port 4170 --strictPort)
//       ES170_BACKEND_DIR=<backend> ES170_PREVIEW_URL=http://127.0.0.1:4170 PLAYWRIGHT_MODULE=<playwright> [AXE_PATH=<axe.min.js>] node scripts/es170-api-integration.cjs
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
  assert.ok(process.env.ES170_BACKEND_DIR, 'Se necesita el directorio del backend');
  const fromBackend = createRequire(path.join(path.resolve(process.env.ES170_BACKEND_DIR), 'package.json'));
  const { default: EmbeddedPostgres } = await import(pathToFileURL(fromBackend.resolve('embedded-postgres')).href);
  const parent = path.resolve(os.tmpdir()); const directory = fs.mkdtempSync(path.join(parent, 'es170-pg-'));
  assert.equal(path.dirname(path.resolve(directory)), parent); assert.ok(path.basename(directory).startsWith('es170-pg-'));
  const probe = net.createServer();
  const port = await new Promise((resolve, reject) => { probe.once('error', reject); probe.listen(0, '127.0.0.1', () => { const selected = probe.address().port; probe.close(() => resolve(selected)); }); });
  const password = randomBytes(24).toString('hex');
  const pg = new EmbeddedPostgres({ databaseDir: directory, user: 'es170_test', password, port, persistent: false, initdbFlags: ['--encoding=UTF8', '--locale=C'], postgresFlags: ['-h', '127.0.0.1'], onLog() {}, onError() {} });
  let started = false; let sequelize; let server; let browser; const checks = []; const check = label => { checks.push(label); console.log('PASS ' + label); };
  try {
    await pg.initialise(); await pg.start(); started = true;
    const { Sequelize } = fromBackend('sequelize');
    sequelize = new Sequelize(`postgres://es170_test:${password}@127.0.0.1:${port}/postgres`, { logging: false, dialectOptions: { ssl: false } });
    process.env.JWT_SECRET = randomBytes(32).toString('hex'); process.env.DATA_ENCRYPTION_KEY = randomBytes(32).toString('hex');
    const id = fromBackend.resolve('./database'); require.cache[id] = { id, filename: id, loaded: true, exports: { sequelize } };
    for (const name of ['PricingPlan', 'User', 'Exercise', 'ExerciseAudit', 'RevokedToken', 'AuthRevocation', 'DeletionRequest']) fromBackend('./' + name);
    await sequelize.sync();
    const User = fromBackend('./User'); const Exercise = fromBackend('./Exercise');
    const person = await User.create({ name: 'Persona Sintética', email: 'persona@example.invalid', password: 'x', role: 'user' });
    const express = fromBackend('express'); const app = express(); app.use(express.json());
    app.use('/api/exercises', fromBackend('./middlewares/auth').verificarToken, fromBackend('./routes/exercises').readRouter);
    server = app.listen(0, '127.0.0.1'); await once(server, 'listening'); const apiUrl = `http://127.0.0.1:${server.address().port}`;
    const token = fromBackend('./utils/sessions').issueToken({ id: person.id, role: 'user' });
    const content = (name) => ({ es: { title: `Título ${name}`, purpose: `Propósito ${name}`, question: `¿Pregunta ${name}?`, help: `Ayuda ${name}` }, en: { title: `Title ${name}`, purpose: `Purpose ${name}`, question: `Question ${name}?`, help: `Help ${name}` } });
    const seed = async (rows) => { await Exercise.destroy({ where: {} }); for (const row of rows) await Exercise.create({ version: 1, ...content(row.key), ...row }); };
    const fullSet = [
      { key: 'alpha_pending', status: 'published', reviewStatus: 'pending', minutesMin: 3, minutesMax: 5 },
      { key: 'beta_done', status: 'published', reviewStatus: 'done' },
      { key: 'gamma_draft', status: 'draft', reviewStatus: 'pending' },
      { key: 'delta_withdrawn', status: 'withdrawn', reviewStatus: 'done' },
    ];

    const { chromium } = process.env.PLAYWRIGHT_MODULE ? require(process.env.PLAYWRIGHT_MODULE) : await import('playwright');
    browser = await chromium.launch({ headless: true });
    const frontend = process.env.ES170_PREVIEW_URL || 'http://127.0.0.1:4170'; assert.ok(['127.0.0.1', 'localhost'].includes(new URL(frontend).hostname));
    const axeSource = process.env.AXE_PATH ? fs.readFileSync(process.env.AXE_PATH, 'utf8') : '';
    async function axeCheck(page, label) {
      if (!axeSource) return;
      await page.addScriptTag({ content: axeSource });
      const violations = await page.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } }).then(r => r.violations.map(v => v.id + ':' + v.nodes.length)));
      assert.deepEqual(violations, [], label + ' axe'); check(label + ': axe 0');
    }
    async function open(lang, width, route, { failFirst = false, denyClipboard = false } = {}) {
      const context = await browser.newContext({ viewport: { width, height: 900 } }); const page = await context.newPage();
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(([t, l, deny]) => { localStorage.setItem('elevation_token', t); localStorage.setItem('elv_lang', l); if (deny) Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.reject(new Error('denied')) }, configurable: true }); }, [token, lang, denyClipboard]);
      await page.route('**/api/session', r => r.fulfill({ json: { role: 'user', onboardingCompleted: true } }));
      const control = { calls: 0, failFirst };
      await page.route('**/api/exercises**', async r => {
        control.calls++; if (control.failFirst && control.calls === 1) return r.abort('connectionreset');
        const url = new URL(r.request().url()); const response = await r.fetch({ url: apiUrl + url.pathname + url.search }); return r.fulfill({ response });
      });
      await page.route('**/api/**', r => (['/api/session'].includes(new URL(r.request().url()).pathname) || new URL(r.request().url()).pathname.startsWith('/api/exercises')) ? r.fallback() : r.fulfill({ json: {} }));
      await page.goto(frontend + route);
      return { context, page, control, errors };
    }
    const T = {
      es: { a: 'Título alpha_pending', b: 'Título beta_done', c: 'Título gamma_draft', d: 'Título delta_withdrawn', review: 'Contenido en revisión', time: 'Tiempo orientativo: 3–5 minutos', choose: 'Elegir', empty: 'Aún no hay ejercicios publicados.', error: 'No pudimos cargar los ejercicios.', retry: 'Reintentar', gone: 'Este ejercicio ya no está disponible.', copy: 'Copiar mis notas', copyError: 'No pudimos copiar', close: 'Cerrar ejercicio', leave: 'Las notas se perderán al cerrar.', discard: 'Cerrar sin guardar', lines: ['Explora ideas de profesión a partir de lo que valoras.', 'Guarda y revisa lo que has hecho y lo que sabes hacer.', 'Mira tus competencias por territorios, con la evidencia que hay hoy.', 'Conoce roles y rutas con sus fuentes y su fecha.'] },
      en: { a: 'Title alpha_pending', b: 'Title beta_done', c: 'Title gamma_draft', d: 'Title delta_withdrawn', review: 'Content under review', time: 'Suggested time: 3–5 minutes', choose: 'Choose', empty: 'No exercises are published yet.', error: 'We could not load the exercises.', retry: 'Retry', gone: 'This exercise is no longer available.', copy: 'Copy my notes', copyError: 'We could not copy', close: 'Close exercise', leave: 'Closing will discard your notes.', discard: 'Close without saving', lines: ['Explore career ideas starting from what you value.', 'Save and review what you have done and can do.', 'See your skills by territory, with the evidence that exists today.', 'Learn about roles and routes with their sources and date.'] } };
    const activeText = page => page.evaluate(() => { const e = document.activeElement; return !e ? null : e === document.body ? 'BODY' : (e.id || e.tagName + ':' + (e.textContent || '').trim().slice(0, 40)) });
    const emoji = /\p{Extended_Pictographic}/u;
    for (const lang of ['es', 'en']) for (const width of [390, 1360]) {
      const t = T[lang]; const tag = `${lang} ${width}px`;
      // A) lista: solo publicados; aviso de revisión solo con reviewStatus !== 'done'; tiempo solo si viene
      await seed(fullSet);
      { const { context, page, errors } = await open(lang, width, '/app/exercises');
        await page.getByText(t.a, { exact: true }).waitFor();
        const body = await page.locator('main').innerText();
        assert.ok(body.includes(t.a) && body.includes(t.b)); assert.ok(!body.includes(t.c) && !body.includes(t.d), 'borrador y retirado no salen');
        assert.equal(await page.locator('article').count(), 2);
        const cardA = await page.locator('article', { hasText: t.a }).innerText(); const cardB = await page.locator('article', { hasText: t.b }).innerText();
        assert.ok(cardA.includes(t.review) && cardA.includes(t.time)); assert.ok(!cardB.includes(t.review) && !/minut/i.test(cardB), 'alpha: en revisión y 3–5 min; beta: revisado y sin tiempo (minutes null)');
        check(`${tag}: lista → solo los 2 publicados (no el borrador ni el retirado); «${t.review}» solo en el no revisado; tiempo solo si viene`);
        await axeCheck(page, `${tag}: lista`); assert.deepEqual(errors, []); await context.close(); }
      // B) abrir, notas que no se guardan, portapapeles denegado, cerrar con notas
      { const { context, page } = await open(lang, width, '/app/exercises', { denyClipboard: true });
        await page.locator('article', { hasText: t.a }).getByRole('button', { name: t.choose, exact: true }).click();
        await page.getByText('¿Pregunta alpha_pending?'.replace('¿Pregunta', lang === 'es' ? '¿Pregunta' : 'Question').replace('?', lang === 'es' ? '?' : '?')).waitFor();
        assert.ok((await activeText(page)).startsWith('H3'), 'foco en la pregunta al abrir');
        await page.fill('#exercise-notes', 'Notas sintéticas');
        await page.getByRole('button', { name: t.copy, exact: true }).click();
        await page.getByText(t.copyError, { exact: false }).first().waitFor(); assert.ok(await page.getByRole('alert').count() >= 1);
        await page.getByRole('button', { name: t.close, exact: true }).click();
        await page.getByText(t.leave, { exact: true }).waitFor();
        await page.getByRole('button', { name: t.discard, exact: true }).click();
        await page.getByText(t.a, { exact: true }).waitFor();
        check(`${tag}: abrir (foco en la pregunta) → copiar con el portapapeles negado muestra el error → cerrar con notas avisa → «${t.discard}» vuelve a la lista`);
        await context.close(); }
    }
    for (const lang of ['es', 'en']) {
      const t = T[lang];
      // C) retirado entre la lista y abrirlo
      await seed(fullSet);
      { const { context, page } = await open(lang, 1360, '/app/exercises');
        await page.getByText(t.a, { exact: true }).waitFor();
        await Exercise.update({ status: 'withdrawn' }, { where: { key: 'alpha_pending' } });
        await page.locator('article', { hasText: t.a }).getByRole('button', { name: t.choose, exact: true }).click();
        await page.getByText(t.gone, { exact: true }).waitFor();
        await page.waitForFunction(label => !document.body.innerText.includes(label), t.a);
        assert.ok(await page.getByText(t.b, { exact: true }).count() === 1);
        check(`${lang}: el ejercicio se retiró entre la lista y abrirlo → «${t.gone}» y la lista se refresca sin él`);
        await context.close(); }
      // D) vacío
      await seed([{ key: 'gamma_draft', status: 'draft', reviewStatus: 'pending' }]);
      { const { context, page } = await open(lang, 1360, '/app/exercises');
        await page.getByText(t.empty, { exact: true }).waitFor(); assert.equal(await page.locator('article').count(), 0);
        await axeCheck(page, `${lang}: vacío`); check(`${lang}: sin ejercicios publicados → «${t.empty}»`); await context.close(); }
      // E) error con reintento y foco
      await seed(fullSet);
      { const { context, page } = await open(lang, 1360, '/app/exercises', { failFirst: true });
        await page.getByText(t.error, { exact: true }).waitFor(); await page.waitForTimeout(300);
        assert.equal(await activeText(page), `BUTTON:${t.retry}`, 'foco en Reintentar al aparecer el error');
        await axeCheck(page, `${lang}: error`);
        await page.getByRole('button', { name: t.retry, exact: true }).click(); await page.getByText(t.a, { exact: true }).waitFor();
        check(`${lang}: la primera lectura se pierde → «${t.error}» con foco en «${t.retry}»; al reintentar aparecen los publicados`); await context.close(); }
      // F) herramientas: una línea por tarjeta y sin emojis
      { const { context, page } = await open(lang, 1360, '/app/space/tools');
        await page.locator('h1').waitFor(); const main = await page.locator('main, body').first().innerText();
        for (const line of t.lines) assert.ok(main.includes(line), `línea «${line}»`);
        assert.doesNotMatch(main, emoji);
        await axeCheck(page, `${lang}: herramientas`); check(`${lang}: herramientas → las 4 líneas descriptivas, sin emojis`); await context.close(); }
      // G) el enlace de ejercicios del menú ya no depende de una bandera
      { const { context, page } = await open(lang, 1360, '/app/diary');
        await page.locator('summary').first().click();
        const link = page.locator('a[href^="/app/exercises"]'); await link.first().waitFor({ timeout: 8000 });
        assert.equal(await link.count(), 1); check(`${lang}: el menú de Mi espacio muestra el enlace a los ejercicios sin bandera de compilación`); await context.close(); }
    }
    console.log(`ES-170 servidor real: ${checks.length} comprobaciones superadas. Express + ruta de lectura de ejercicios + PostgreSQL reales.`);
  } catch (error) {
    console.error('ES-170 falló:', error); process.exitCode = 1;
  } finally {
    if (browser) await browser.close(); if (server) await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
    if (sequelize) await sequelize.close(); if (started) await pg.stop(); try { fs.rmSync(directory, { recursive: true, force: true, maxRetries: 8, retryDelay: 300 }); } catch { /* Windows aún bloquea el directorio temporal */ }
  }
})();
