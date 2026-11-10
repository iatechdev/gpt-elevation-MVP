// ES-255: catálogo de rutas de la persona (/app/route-catalog) con la respuesta REAL de GET /api/route-catalog/published (Express + ruta real + PostgreSQL embebido real + React construido en Chromium).
// Catálogo SINTÉTICO completo publicado con la lógica real (seeds/routeCatalogSynthetic.cjs). Comprueba contra los datos publicados: aviso «se abre en una pestaña nueva» en cada enlace externo,
// industria en cada tarjeta, ninguna clave cruda de capacidad en el DOM, mercado e idioma con nombre (no códigos), filtro de idioma por idioma del ROL, axe 0, ES/EN × 390/1360.
// Datos sintéticos, base efímera en 127.0.0.1, sin IA ni producción.
// Uso:  (cd frontend && npx vite build && npx vite preview --host 127.0.0.1 --port 4255 --strictPort)
//       ES255_BACKEND_DIR=<backend> ES255_PREVIEW_URL=http://127.0.0.1:4255 PLAYWRIGHT_MODULE=<playwright> [AXE_PATH=<axe.min.js>] node scripts/es255-api-integration.cjs
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
  assert.ok(process.env.ES255_BACKEND_DIR, 'Se necesita el directorio del backend');
  const fromBackend = createRequire(path.join(path.resolve(process.env.ES255_BACKEND_DIR), 'package.json'));
  const { default: EmbeddedPostgres } = await import(pathToFileURL(fromBackend.resolve('embedded-postgres')).href);
  const parent = path.resolve(os.tmpdir()); const directory = fs.mkdtempSync(path.join(parent, 'es255-pg-'));
  assert.equal(path.dirname(path.resolve(directory)), parent); assert.ok(path.basename(directory).startsWith('es255-pg-'));
  const probe = net.createServer();
  const port = await new Promise((resolve, reject) => { probe.once('error', reject); probe.listen(0, '127.0.0.1', () => { const selected = probe.address().port; probe.close(() => resolve(selected)); }); });
  const password = randomBytes(24).toString('hex');
  const pg = new EmbeddedPostgres({ databaseDir: directory, user: 'es255_test', password, port, persistent: false, initdbFlags: ['--encoding=UTF8', '--locale=C'], postgresFlags: ['-h', '127.0.0.1'], onLog() {}, onError() {} });
  let started = false; let sequelize; let server; let browser; const checks = []; const check = label => { checks.push(label); console.log('PASS ' + label); };
  try {
    await pg.initialise(); await pg.start(); started = true;
    const { Sequelize } = fromBackend('sequelize');
    sequelize = new Sequelize(`postgres://es255_test:${password}@127.0.0.1:${port}/postgres`, { logging: false, dialectOptions: { ssl: false } });
    process.env.JWT_SECRET = randomBytes(32).toString('hex'); process.env.DATA_ENCRYPTION_KEY = randomBytes(32).toString('hex');
    const id = fromBackend.resolve('./database'); require.cache[id] = { id, filename: id, loaded: true, exports: { sequelize } };
    for (const name of ['PricingPlan', 'User', 'RouteCatalog', 'RouteCatalogItem', 'RevokedToken', 'AuthRevocation', 'DeletionRequest']) fromBackend('./' + name);
    await sequelize.sync();
    const User = fromBackend('./User'); const catalog = fromBackend('./utils/routeCatalog'); const { build } = fromBackend('./seeds/routeCatalogSynthetic.cjs');
    const person = await User.create({ name: 'Persona Sintética', email: 'persona@example.invalid', password: 'x', role: 'user' });
    const draft = await catalog.createDraft(); const data = build();
    for (const kind of catalog.KINDS) for (const [key, item] of Object.entries(data[kind])) await catalog.upsertItem(draft.id, kind, key, item);
    await catalog.publish(draft.id, person.id, { allowSynthetic: true });
    const published = await catalog.getPublishedRouteCatalog();
    assert.ok(published.roles.length >= 2);
    const express = fromBackend('express'); const app = express(); app.use(express.json());
    app.use('/api/route-catalog', fromBackend('./middlewares/auth').verificarToken, fromBackend('./routes/routeCatalog'));
    server = app.listen(0, '127.0.0.1'); await once(server, 'listening'); const apiUrl = `http://127.0.0.1:${server.address().port}`;
    const token = fromBackend('./utils/sessions').issueToken({ id: person.id, role: 'user' });
    const skillKeys = [...new Set([...published.roles.flatMap(r => (r.capabilities || []).map(c => c.skillKey)), ...published.resources.map(r => r.linkedSkillKey)].filter(Boolean))];
    assert.ok(skillKeys.length > 0, 'el catálogo sintético trae claves de capacidad');

    const { chromium } = process.env.PLAYWRIGHT_MODULE ? require(process.env.PLAYWRIGHT_MODULE) : await import('playwright');
    browser = await chromium.launch({ headless: true });
    const frontend = process.env.ES255_PREVIEW_URL || 'http://127.0.0.1:4255'; assert.ok(['127.0.0.1', 'localhost'].includes(new URL(frontend).hostname));
    const axeSource = process.env.AXE_PATH ? fs.readFileSync(process.env.AXE_PATH, 'utf8') : '';
    async function axeCheck(page, label) {
      if (!axeSource) return;
      await page.addScriptTag({ content: axeSource });
      const violations = await page.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } }).then(r => r.violations.map(v => v.id + ':' + v.nodes.length)));
      assert.deepEqual(violations, [], label + ' axe'); check(label + ': axe 0');
    }
    async function open(lang, width, route) {
      const context = await browser.newContext({ viewport: { width, height: 900 } }); const page = await context.newPage();
      const errors = []; page.on('pageerror', error => errors.push(error.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
      await page.addInitScript(([t, l]) => { localStorage.setItem('elevation_token', t); localStorage.setItem('elv_lang', l); }, [token, lang]);
      await page.route('**/api/session', r => r.fulfill({ json: { role: 'user', onboardingCompleted: true } }));
      await page.route('**/api/route-catalog**', async r => { const url = new URL(r.request().url()); const response = await r.fetch({ url: apiUrl + url.pathname + url.search }); return r.fulfill({ response }); });
      await page.goto(frontend + route);
      return { context, page, errors };
    }
    const T = { es: { newTab: 'se abre en una pestaña nueva', unknown: 'Por confirmar', skill: 'Capacidad por confirmar', locale: 'es' }, en: { newTab: 'opens in a new tab', unknown: 'To be confirmed', skill: 'Skill to be confirmed', locale: 'en' } };
    for (const lang of ['es', 'en']) for (const width of [390, 1360]) {
      const t = T[lang]; const tag = `${lang} ${width}px`;
      const regions = new Intl.DisplayNames([lang], { type: 'region' }); const languages = new Intl.DisplayNames([lang], { type: 'language' });
      // A) lista
      { const { context, page, errors } = await open(lang, width, '/app/route-catalog');
        await page.locator('.catalog-card').first().waitFor({ timeout: 8000 }).catch(async () => { throw new Error('sin tarjetas; errores: ' + errors.join(' / ').slice(0, 400) + ' html: ' + (await page.locator('body').innerHTML()).slice(0, 700)); });
        assert.equal(await page.locator('.catalog-card').count(), published.roles.length);
        for (const role of published.roles) {
          const card = page.locator('.catalog-card', { hasText: role.labels[lang] }).first();
          const text = await card.innerText();
          assert.ok(text.includes(role.industry[lang]), `industria en la tarjeta de ${role.roleKey}`);
          assert.ok(text.includes(regions.of(role.market)), `mercado con nombre (${regions.of(role.market)})`);
          for (const code of role.languagesRequired) if (code !== 'unknown') assert.ok(text.includes(languages.of(code)), `idioma con nombre (${languages.of(code)})`);
          assert.ok(!new RegExp(`(^|[^A-Za-z])${role.market}([^A-Za-z]|$)`).test(text.replace(role.labels[lang], '')), 'sin el código crudo del mercado');
        }
        check(`${tag}: lista → industria, mercado e idiomas con nombre en cada una de las ${published.roles.length} tarjetas`);
        // filtro de idioma por idioma del ROL
        const options = await page.locator('#filter-language_filter option').evaluateAll(list => list.map(o => o.value).filter(Boolean));
        const expected = [...new Set(published.roles.flatMap(r => r.languagesRequired))].filter(code => code !== 'unknown').sort();
        assert.deepEqual([...options].sort(), expected);
        for (const code of expected) {
          await page.selectOption('#filter-language_filter', code);
          assert.equal(await page.locator('.catalog-card').count(), published.roles.filter(r => r.languagesRequired.includes(code)).length, `filtro ${code}`);
        }
        await page.selectOption('#filter-language_filter', '');
        check(`${tag}: filtro de idioma por idioma del rol (${expected.join(', ')}) → tarjetas = roles con ese idioma, también los sin recursos`);
        const body = await page.locator('body').innerText();
        for (const key of skillKeys) assert.ok(!body.includes(key), `clave cruda ${key} en la lista`);
        await axeCheck(page, `${tag}: lista`); assert.deepEqual(errors, []); await context.close(); }
      // B) ficha de cada rol: enlaces con aviso, sin claves crudas
      { let links = 0;
        for (const role of published.roles) {
          const { context, page } = await open(lang, width, `/app/route-catalog/roles/${role.roleKey}`);
          await page.locator('.catalog-detail').waitFor();
          const anchors = page.locator('a[target="_blank"]'); const n = await anchors.count();
          for (let i = 0; i < n; i++) { const a = anchors.nth(i); assert.equal(await a.getAttribute('rel'), 'noopener noreferrer'); assert.ok((await a.innerText()).includes(t.newTab), `aviso en el enlace ${i} de ${role.roleKey}`); assert.ok((await a.getAttribute('href')).startsWith('https://')); }
          links += n;
          const body = await page.locator('body').innerText();
          for (const key of skillKeys) assert.ok(!body.includes(key), `clave cruda ${key} en la ficha de ${role.roleKey}`);
          if ((role.capabilities || []).length) assert.ok(body.includes(t.skill), 'capacidad por confirmar');
          if (role === published.roles[0] && width === 1360) await axeCheck(page, `${tag}: ficha`);
          await context.close();
        }
        assert.ok(links > 0, 'el catálogo sintético trae enlaces externos');
        check(`${tag}: fichas → ${links} enlaces externos, todos con «${t.newTab}», https y noopener; ninguna clave de capacidad cruda (${skillKeys.length} claves)`); }
    }
    console.log(`ES-255 servidor real: ${checks.length} comprobaciones superadas. Express + ruta del catálogo + PostgreSQL reales.`);
  } catch (error) {
    console.error('ES-255 falló:', error); process.exitCode = 1;
  } finally {
    if (browser) await browser.close(); if (server) await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
    if (sequelize) await sequelize.close(); if (started) await pg.stop(); try { fs.rmSync(directory, { recursive: true, force: true, maxRetries: 8, retryDelay: 300 }); } catch { /* Windows aún bloquea el directorio temporal */ }
  }
})();
