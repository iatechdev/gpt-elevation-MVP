// ES-254: «Tu progreso» (/app/progress) con la respuesta REAL de GET /api/user/progress (Express + ruta real + PostgreSQL embebido real + React construido en Chromium).
// Comprueba contra la BASE: sin emojis ni estrellas en el contenido, escala «N de 5», tendencia en TEXTO (Subió / Igual / Bajó) sin colores de alarma, promedios = los de la base,
// aviso «no es una medición de salud», vacío, error con «Reintentar», axe 0, ES/EN × 390/1360. Datos sintéticos, base efímera en 127.0.0.1, sin IA ni producción.
// Uso:  (cd frontend && npx vite build && npx vite preview --host 127.0.0.1 --port 4254 --strictPort)
//       ES254_BACKEND_DIR=<backend> ES254_PREVIEW_URL=http://127.0.0.1:4254 PLAYWRIGHT_MODULE=<playwright> [AXE_PATH=<axe.min.js>] node scripts/es254-api-integration.cjs
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
  assert.ok(process.env.ES254_BACKEND_DIR, 'Se necesita el directorio del backend');
  const fromBackend = createRequire(path.join(path.resolve(process.env.ES254_BACKEND_DIR), 'package.json'));
  const { default: EmbeddedPostgres } = await import(pathToFileURL(fromBackend.resolve('embedded-postgres')).href);
  const parent = path.resolve(os.tmpdir()); const directory = fs.mkdtempSync(path.join(parent, 'es254-pg-'));
  assert.equal(path.dirname(path.resolve(directory)), parent); assert.ok(path.basename(directory).startsWith('es254-pg-'));
  const probe = net.createServer();
  const port = await new Promise((resolve, reject) => { probe.once('error', reject); probe.listen(0, '127.0.0.1', () => { const selected = probe.address().port; probe.close(() => resolve(selected)); }); });
  const password = randomBytes(24).toString('hex');
  const pg = new EmbeddedPostgres({ databaseDir: directory, user: 'es254_test', password, port, persistent: false, initdbFlags: ['--encoding=UTF8', '--locale=C'], postgresFlags: ['-h', '127.0.0.1'], onLog() {}, onError() {} });
  let started = false; let sequelize; let server; let browser; const checks = []; const check = label => { checks.push(label); console.log('PASS ' + label); };
  try {
    await pg.initialise(); await pg.start(); started = true;
    const { Sequelize } = fromBackend('sequelize');
    sequelize = new Sequelize(`postgres://es254_test:${password}@127.0.0.1:${port}/postgres`, { logging: false, dialectOptions: { ssl: false } });
    process.env.JWT_SECRET = randomBytes(32).toString('hex'); process.env.DATA_ENCRYPTION_KEY = randomBytes(32).toString('hex');
    const id = fromBackend.resolve('./database'); require.cache[id] = { id, filename: id, loaded: true, exports: { sequelize } };
    for (const name of ['PricingPlan', 'User', 'MoodLog', 'SessionRating', 'WellnessRecommendation', 'RevokedToken', 'AuthRevocation', 'DeletionRequest']) fromBackend('./' + name);
    await sequelize.sync();
    const User = fromBackend('./User'); const MoodLog = fromBackend('./MoodLog'); const SessionRating = fromBackend('./SessionRating');
    const withData = await User.create({ name: 'Persona Sintética', email: 'con-datos@example.invalid', password: 'x', role: 'user' });
    const empty = await User.create({ name: 'Persona Vacía', email: 'vacia@example.invalid', password: 'x', role: 'user' });
    const day = n => new Date(Date.now() - n * 86400000).toISOString().split('T')[0];
    // entrada→salida: subió (2→4), igual (3→3), bajó (4→2)
    await MoodLog.bulkCreate([{ UserId: withData.id, date: day(0), checkin_mood: 2, checkout_mood: 4 }, { UserId: withData.id, date: day(1), checkin_mood: 3, checkout_mood: 3 }, { UserId: withData.id, date: day(2), checkin_mood: 4, checkout_mood: 2 }]);
    await SessionRating.bulkCreate([{ UserId: withData.id, date: day(0), rating: 5 }, { UserId: withData.id, date: day(1), rating: 4 }, { UserId: withData.id, date: day(2), rating: 1 }]);
    const db = { avgMood: (2 + 4 + 3 + 3 + 4 + 2) / 6, avgRating: (5 + 4 + 1) / 3 };
    const express = fromBackend('express'); const app = express(); app.use(express.json());
    app.use('/api/user', fromBackend('./middlewares/auth').verificarToken, fromBackend('./routes/progress'));
    server = app.listen(0, '127.0.0.1'); await once(server, 'listening'); const apiUrl = `http://127.0.0.1:${server.address().port}`;
    const sessions = fromBackend('./utils/sessions');
    const tokenOf = user => sessions.issueToken({ id: user.id, role: 'user' });

    const { chromium } = process.env.PLAYWRIGHT_MODULE ? require(process.env.PLAYWRIGHT_MODULE) : await import('playwright');
    browser = await chromium.launch({ headless: true });
    const frontend = process.env.ES254_PREVIEW_URL || 'http://127.0.0.1:4254'; assert.ok(['127.0.0.1', 'localhost'].includes(new URL(frontend).hostname));
    const axeSource = process.env.AXE_PATH ? fs.readFileSync(process.env.AXE_PATH, 'utf8') : '';
    async function axeCheck(page, label) {
      if (!axeSource) return;
      await page.addScriptTag({ content: axeSource });
      const violations = await page.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } }).then(r => r.violations.map(v => v.id + ':' + v.nodes.length)));
      assert.deepEqual(violations, [], label + ' axe'); check(label + ': axe 0');
    }
    async function open(user, lang, width, { failFirst = false } = {}) {
      const context = await browser.newContext({ viewport: { width, height: 900 } }); const page = await context.newPage();
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(([t, l]) => { localStorage.setItem('elevation_token', t); localStorage.setItem('elv_lang', l); }, [tokenOf(user), lang]);
      await page.route('**/api/session', route => route.fulfill({ json: { role: 'user', onboardingCompleted: true } }));
      let calls = 0;
      await page.route('**/api/user/progress', async route => {
        calls++; if (failFirst && calls === 1) return route.abort('connectionreset');
        const response = await route.fetch({ url: apiUrl + '/api/user/progress' }); return route.fulfill({ response });
      });
      await page.goto(frontend + '/app/progress');
      return { context, page, errors };
    }
    const T = {
      es: { note: 'Estas cifras son un registro tuyo. No son una medición de salud ni un diagnóstico.', enter: 'Al entrar: 3 de 5 (medio)', up: 'Subió', same: 'Igual', down: 'Bajó', rating: '4 de 5', mood: 'Ánimo promedio', ratingStat: 'Calificación promedio', emptyMood: 'Aún no hay registros.', emptyRatings: 'Aún no hay calificaciones.', error: 'No se pudo cargar tu progreso.', retry: 'Reintentar', locale: 'es-CO' },
      en: { note: 'These figures are your own record. They are not a health measurement or a diagnosis.', enter: 'On arrival: 3 of 5 (medium)', up: 'Went up', same: 'Stayed the same', down: 'Went down', rating: '4 of 5', mood: 'Average mood', ratingStat: 'Average rating', emptyMood: 'No records yet.', emptyRatings: 'No ratings yet.', error: 'Could not load your progress.', retry: 'Retry', locale: 'en-US' } };
    const pictographic = /\p{Extended_Pictographic}|★|☆/u; // ES-173: el diseño aprobado (11859) añade ↑ = ↓ JUNTO a la palabra de tendencia (nunca solos); siguen prohibidos emojis y estrellas
    for (const lang of ['es', 'en']) for (const width of [390, 1360]) {
      const t = T[lang]; const tag = `${lang} ${width}px`;
      // A) con datos: contenido real, sin emojis/estrellas, tendencia en texto, promedios = base
      { const { context, page, errors } = await open(withData, lang, width);
        await page.locator('h1').waitFor(); await page.getByText(t.enter, { exact: false }).first().waitFor();
        const main = await page.locator('main').textContent(); // ES-173: textContent (las rotulaciones van en mayúsculas visuales por text-transform)
        const html = await page.locator('main').innerHTML();
        assert.doesNotMatch(await page.locator('body').innerText(), pictographic); /* E254-1: también el encabezado (botón «Buscar terapeuta») */ assert.ok(!/#22C55E|#EF4444|rgb\(34, 197, 94\)|rgb\(239, 68, 68\)/i.test(html), 'sin colores verde/rojo de tendencia');
        for (const word of [t.up, t.same, t.down]) assert.ok(main.toLowerCase().includes(word.toLowerCase()), `tendencia «${word}»`); // ES-173: la chip de tendencia va en mayúsculas visuales (text-transform), por eso se compara sin distinguir mayúsculas
        assert.ok(main.includes(t.note)); assert.ok(main.includes(t.rating));
        const fmt = value => value.toLocaleString(t.locale, { maximumFractionDigits: 1 });
        assert.ok(main.includes(`${fmt(db.avgMood)} ${lang === 'es' ? 'de' : 'of'} 5`), 'promedio de ánimo = base'); assert.ok(main.includes(`${fmt(db.avgRating)} ${lang === 'es' ? 'de' : 'of'} 5`), 'promedio de calificación = base');
        assert.ok(main.includes(t.mood) && main.includes(t.ratingStat));
        check(`${tag}: con datos reales → sin emojis ni estrellas, tendencia en texto (${t.up}/${t.same}/${t.down}), sin verde/rojo, promedios = base, aviso «no es una medición de salud»`);
        await axeCheck(page, `${tag}: con datos`);
        assert.deepEqual(errors, []); await context.close(); }
    }
    for (const lang of ['es', 'en']) {
      const t = T[lang];
      // B) vacío
      { const { context, page } = await open(empty, lang, 1360);
        await page.getByText(t.emptyMood, { exact: true }).waitFor(); assert.ok(await page.getByText(t.emptyRatings, { exact: true }).count() === 1);
        assert.doesNotMatch(await page.locator('body').innerText(), pictographic); check(`${lang}: sin registros → textos de vacío, sin emojis ni estrellas`);
        await axeCheck(page, `${lang}: vacío`); await context.close(); }
      // C) error con reintento: la primera lectura se pierde; «Reintentar» carga los datos reales
      { const { context, page } = await open(withData, lang, 1360, { failFirst: true });
        await page.getByText(t.error, { exact: true }).waitFor(); assert.equal(await page.getByRole('alert').count(), 1); await page.waitForTimeout(300); assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.textContent.trim()), t.retry, 'E254-3: al aparecer el error el foco está en «Reintentar»');
        await axeCheck(page, `${lang}: error`);
        await page.getByRole('button', { name: t.retry, exact: true }).click(); await page.getByText(t.enter, { exact: false }).first().waitFor();
        assert.equal(await page.getByText(t.error, { exact: true }).count(), 0); assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.tagName), 'H1', 'tras Reintentar con éxito el foco queda en el título (no en body)'); check(`${lang}: la primera lectura se pierde → aviso con «${t.retry}»; al reintentar aparecen los datos de la base`);
        await context.close(); }
    }
    console.log(`ES-254 servidor real: ${checks.length} comprobaciones superadas. Express + ruta de progreso + PostgreSQL reales.`);
  } catch (error) {
    console.error('ES-254 falló:', error); require('./_exitOnFailure.cjs').fail();
  } finally {
    if (browser) await browser.close(); if (server) await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
    if (sequelize) await sequelize.close(); if (started) await pg.stop(); try { fs.rmSync(directory, { recursive: true, force: true, maxRetries: 8, retryDelay: 300 }); } catch { /* Windows aún tiene bloqueado el directorio temporal; no afecta el resultado */ }
  }
})();
