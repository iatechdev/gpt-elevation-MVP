// ES-187: administración del catálogo de rutas (/admin/route-catalog) con el servidor REAL (Express + rutas del administrador + modelos + PostgreSQL embebido real) y la pantalla construida en Chromium.
// Comprueba contra la base: «Crear borrador» deshabilitado con razón cuando ya hay uno; chip «Completo» / «Faltan datos (n)» = lo que calcula el servidor; el conflicto de edición (otra persona guarda
// mientras tú editas): aviso con foco, lo escrito se conserva, «Ver su versión», «Conservar la mía», y la base NUNCA se pisa sin que la persona lo decida; 401/403 con pantalla propia; axe 0; ES/EN × 390/1360.
// Datos sintéticos, base efímera en 127.0.0.1, sin IA ni producción.
// Uso:  (cd frontend && npx vite build && npx vite preview --host 127.0.0.1 --port 4187 --strictPort)
//       ES187_BACKEND_DIR=<backend> ES187_PREVIEW_URL=http://127.0.0.1:4187 PLAYWRIGHT_MODULE=<playwright> [AXE_PATH=<axe.min.js>] node scripts/es187-api-integration.cjs
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
  assert.ok(process.env.ES187_BACKEND_DIR, 'Se necesita el directorio del backend');
  const fromBackend = createRequire(path.join(path.resolve(process.env.ES187_BACKEND_DIR), 'package.json'));
  const { default: EmbeddedPostgres } = await import(pathToFileURL(fromBackend.resolve('embedded-postgres')).href);
  const parent = path.resolve(os.tmpdir()); const directory = fs.mkdtempSync(path.join(parent, 'es187-pg-'));
  assert.equal(path.dirname(path.resolve(directory)), parent); assert.ok(path.basename(directory).startsWith('es187-pg-'));
  const probe = net.createServer();
  const port = await new Promise((resolve, reject) => { probe.once('error', reject); probe.listen(0, '127.0.0.1', () => { const selected = probe.address().port; probe.close(() => resolve(selected)); }); });
  const password = randomBytes(24).toString('hex');
  const pg = new EmbeddedPostgres({ databaseDir: directory, user: 'es187_test', password, port, persistent: false, initdbFlags: ['--encoding=UTF8', '--locale=C'], postgresFlags: ['-h', '127.0.0.1'], onLog: () => {}, onError: () => {} });
  let started = false; let sequelize; let server; let browser; const checks = []; const check = label => { checks.push(label); console.log('PASS ' + label); };
  try {
    await pg.initialise(); await pg.start(); started = true;
    const { Sequelize } = fromBackend('sequelize');
    sequelize = new Sequelize(`postgres://es187_test:${password}@127.0.0.1:${port}/postgres`, { logging: false, dialectOptions: { ssl: false } });
    process.env.JWT_SECRET = randomBytes(32).toString('hex'); process.env.DATA_ENCRYPTION_KEY = randomBytes(32).toString('hex'); process.env.ALLOW_SYNTHETIC_CATALOG = 'true';
    const id = fromBackend.resolve('./database'); require.cache[id] = { id, filename: id, loaded: true, exports: { sequelize } };
    for (const name of ['PricingPlan', 'User', 'RouteCatalog', 'RouteCatalogItem', 'RevokedToken', 'AuthRevocation', 'DeletionRequest']) fromBackend('./' + name);
    await sequelize.sync();
    const User = fromBackend('./User'); const catalog = fromBackend('./utils/routeCatalog'); const { build } = fromBackend('./seeds/routeCatalogSynthetic.cjs');
    const RouteCatalogItem = fromBackend('./RouteCatalogItem');
    const admin = await User.create({ name: 'Admin Sintética', email: 'admin@example.invalid', password: 'x', role: 'admin' });
    const first = await catalog.createDraft(); const seed = build();
    for (const kind of catalog.KINDS) for (const [key, item] of Object.entries(seed[kind])) await catalog.upsertItem(first.id, kind, key, item);
    await catalog.publish(first.id, admin.id, { allowSynthetic: true });
    const express = fromBackend('express'); const app = express(); app.use(express.json());
    const auth = fromBackend('./middlewares/auth');
    app.use('/api/admin/route-catalog', auth.verificarAdmin, fromBackend('./routes/routeCatalogAdmin'));
    server = app.listen(0, '127.0.0.1'); await once(server, 'listening'); const apiUrl = `http://127.0.0.1:${server.address().port}`;
    const token = fromBackend('./utils/sessions').issueToken({ id: admin.id, role: 'admin' });
    const KEY = 'ctx_educacion_formacion';
    const original = seed.contexts[KEY];
    const withLabel = (es, en = es) => ({ ...original, labels: { es, en } });
    const dbItem = async (catalogId, key = KEY) => { const row = await RouteCatalogItem.findOne({ where: { catalogId, kind: 'contexts', itemKey: key } }); return row ? row.data : null; };

    const { chromium } = process.env.PLAYWRIGHT_MODULE ? require(process.env.PLAYWRIGHT_MODULE) : await import('playwright');
    browser = await chromium.launch({ headless: true });
    const frontend = process.env.ES187_PREVIEW_URL || 'http://127.0.0.1:4187'; assert.ok(['127.0.0.1', 'localhost'].includes(new URL(frontend).hostname));
    const axeSource = process.env.AXE_PATH ? fs.readFileSync(process.env.AXE_PATH, 'utf8') : '';
    async function axeCheck(page, label) {
      if (!axeSource) return;
      await page.addScriptTag({ content: axeSource });
      const violations = await page.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } }).then(r => r.violations.map(v => v.id + ':' + v.nodes.length)));
      assert.deepEqual(violations, [], label + ' axe'); check(label + ': axe 0');
    }
    async function open(lang, width, route, intercept) {
      const context = await browser.newContext({ viewport: { width, height: 900 } }); const page = await context.newPage();
      const errors = []; page.on('pageerror', error => errors.push(error.message)); page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 200)); });
      await page.addInitScript(([t, l]) => { localStorage.setItem('elevation_token', t); localStorage.setItem('elevation_role', 'admin'); localStorage.setItem('elv_lang', l); }, [token, lang]);
      await page.route('**/api/session', r => r.fulfill({ json: { role: 'admin', onboardingCompleted: true } }));
      await page.route('**/api/admin/route-catalog**', async r => { if (intercept && intercept(r)) return; const url = new URL(r.request().url()); try { const response = await r.fetch({ url: apiUrl + url.pathname + url.search }); return await r.fulfill({ response }); } catch { /* la página ya se cerró: petición en vuelo */ } });
      await page.goto(frontend + route);
      return { context, page, errors };
    }
    const T = {
      es: { create: 'Crear borrador', reason: 'Ya hay un borrador abierto', openDraft: 'Abrir borrador', complete: 'Completo', missing: 'Faltan datos', changed: 'Otra persona guardó este elemento mientras lo editabas', removed: 'Otra persona quitó este elemento del borrador', see: 'Ver su versión', hide: 'Ocultar su versión', keep: 'Conservar la mía', save: 'Guardar borrador', saved: 'Guardado en el borrador', session: 'Tu sesión venció', forbidden: 'No tienes permiso', login: 'Iniciar sesión', ready: 'Listo: pulsa' },
      en: { create: 'Create draft', reason: 'A draft is already open', openDraft: 'Open draft', complete: 'Complete', missing: 'Data missing', changed: 'Someone else saved this item while you were editing it', removed: 'Someone else removed this item from the draft', see: 'See their version', hide: 'Hide their version', keep: 'Keep mine', save: 'Save draft', saved: 'Saved in draft', session: 'Your session expired', forbidden: 'You do not have permission', login: 'Sign in', ready: 'Ready: press' },
    };
    let draftId = 0;
    for (const lang of ['es', 'en']) for (const width of [390, 1360]) {
      const t = T[lang]; const tag = `${lang} ${width}px`;
      // A) sin borrador: «Crear borrador» activo; con borrador: deshabilitado con razón y «Abrir borrador»
      if (!draftId) {
        const { context, page } = await open(lang, width, '/admin/route-catalog');
        const button = page.getByRole('button', { name: t.create }); await button.waitFor();
        assert.equal(await button.isDisabled(), false, 'sin borrador el botón está activo');
        await button.click(); await page.waitForURL(/\/admin\/route-catalog\/\d+$/); draftId = Number(page.url().split('/').pop());
        assert.equal((await catalog.get(draftId)).status, 'draft');
        await context.close();
      }
      { const { context, page, errors } = await open(lang, width, '/admin/route-catalog');
        const button = page.getByRole('button', { name: t.create }); await button.waitFor();
        assert.equal(await button.isDisabled(), true, 'con borrador el botón está deshabilitado');
        const reason = await page.locator('#catalog-draft-reason').innerText();
        assert.ok(reason.includes(t.reason) && reason.includes(String((await catalog.get(draftId)).version)), 'razón con la versión del borrador: ' + reason);
        assert.equal(await button.getAttribute('aria-describedby'), 'catalog-draft-reason');
        assert.equal(await page.locator('.catalog-card').count(), 2, 'dos versiones (vigente y borrador)');
        await axeCheck(page, `${tag}: lista con borrador`);
        await page.getByRole('button', { name: t.openDraft }).click(); await page.waitForURL(new RegExp(`/admin/route-catalog/${draftId}$`));
        assert.deepEqual(errors, []); await context.close();
        check(`${tag}: «Crear borrador» deshabilitado con la razón y la versión; «${t.openDraft}» lleva al borrador`); }

      // B) chips «Completo» / «Faltan datos (n)» = lo que calcula el servidor
      await catalog.upsertItem(draftId, 'contexts', 'ctx_incompleto', { labels: { es: 'Solo en español' } });
      { const detail = await catalog.get(draftId);
        const { context, page } = await open(lang, width, `/admin/route-catalog/${draftId}`);
        await page.locator('#contexts').waitFor();
        for (const [kind, rows] of Object.entries(detail.items)) for (const row of rows) {
          const gaps = (detail.missing[`${kind}/${row.itemKey}`] ?? []).length;
          const card = page.locator(`#${kind} article`, { has: page.locator(`button:has-text("${row.itemKey}")`) }); const chip = await card.locator('.catalog-chip').innerText();
          assert.equal(chip, gaps ? `${t.missing} (${gaps})` : t.complete, `chip de ${kind}/${row.itemKey}`);
        }
        assert.ok(Object.keys(detail.missing).some(k => k === 'contexts/ctx_incompleto'), 'el servidor ve faltantes en ctx_incompleto');
        await axeCheck(page, `${tag}: borrador con chips`);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), 0, 'sin desborde');
        await context.close();
        check(`${tag}: cada elemento muestra «${t.complete}» o «${t.missing} (n)» igual a lo que calcula el servidor`); }
      await catalog.removeItem(draftId, 'contexts', 'ctx_incompleto');

      // C) conflicto de edición: otra persona guarda mientras yo edito
      await catalog.upsertItem(draftId, 'contexts', KEY, original);
      { const { context, page, errors } = await open(lang, width, `/admin/route-catalog/${draftId}/contexts/${KEY}`);
        const input = page.locator('#item-labels-es'); await input.waitFor();
        await input.fill('Mi versión'); await page.locator('#item-labels-en').fill('My version');
        await catalog.upsertItem(draftId, 'contexts', KEY, withLabel('Su versión', 'Their version')); // la otra persona guarda primero
        await page.locator('#catalog-save').click();
        const notice = page.getByRole('alert').filter({ hasText: t.changed }); await notice.waitFor();
        assert.equal((await dbItem(draftId)).labels.es, 'Su versión', 'la base NO se pisó con lo mío');
        assert.equal(await input.inputValue(), 'Mi versión', 'lo que escribí sigue en pantalla');
        await page.waitForFunction(() => document.activeElement?.getAttribute('role') === 'alert'); // foco al aviso
        await axeCheck(page, `${tag}: conflicto`);
        await page.getByRole('button', { name: t.see }).click();
        const theirs = await page.locator('.catalog-conflict').innerText();
        assert.ok(theirs.includes('Su versión') || theirs.includes('Their version'), 'muestra su versión: ' + theirs);
        assert.equal(await page.getByRole('button', { name: t.hide }).getAttribute('aria-expanded'), 'true');
        await page.getByRole('button', { name: t.keep }).click();
        await page.getByText(t.ready, { exact: false }).first().waitFor();
        assert.equal((await dbItem(draftId)).labels.es, 'Su versión', 'conservar la mía todavía no guarda');
        await page.waitForFunction(() => document.activeElement?.id === 'catalog-save');
        await page.locator('#catalog-save').click(); await page.getByText(t.saved).first().waitFor();
        assert.equal((await dbItem(draftId)).labels.es, 'Mi versión', 'tras decidirlo, se guarda lo mío');
        assert.equal(await page.locator('.catalog-conflict').count(), 0);
        // un segundo guardado normal funciona (la versión se renovó)
        await input.fill('Segundo guardado'); await page.locator('#catalog-save').click();
        await page.waitForFunction(() => /Segundo|Second/.test('') || true); await page.getByText(t.saved).first().waitFor();
        await page.waitForTimeout(300);
        assert.equal((await dbItem(draftId)).labels.es, 'Segundo guardado');
        assert.deepEqual(errors, []); await context.close();
        check(`${tag}: conflicto → aviso con foco, la base no se pisa, lo escrito se conserva, «${t.see}», «${t.keep}» y luego guarda; un segundo guardado normal funciona`); }

      // D) conflicto: la otra persona quitó el elemento
      await catalog.upsertItem(draftId, 'contexts', KEY, original);
      { const { context, page } = await open(lang, width, `/admin/route-catalog/${draftId}/contexts/${KEY}`);
        const input = page.locator('#item-labels-es'); await input.waitFor(); await input.fill('Sigo aquí');
        await catalog.removeItem(draftId, 'contexts', KEY);
        await page.locator('#catalog-save').click(); await page.getByRole('alert').filter({ hasText: t.removed }).waitFor();
        assert.equal(await dbItem(draftId), null, 'no se recreó solo');
        assert.equal(await input.inputValue(), 'Sigo aquí');
        await page.getByRole('button', { name: t.keep }).click(); await page.locator('#catalog-save').click(); await page.getByText(t.saved).first().waitFor();
        assert.equal((await dbItem(draftId)).labels.es, 'Sigo aquí', 'tras decidirlo, se recrea con lo mío');
        await context.close();
        check(`${tag}: la otra persona quitó el elemento → aviso propio; no se recrea solo; «${t.keep}» lo recrea`); }
      await catalog.upsertItem(draftId, 'contexts', KEY, original);

      // E) sesión vencida y sin permiso: pantallas propias
      for (const [status, expected] of [[401, t.session], [403, t.forbidden]]) {
        const { context, page } = await open(lang, width, '/admin/route-catalog', r => { if (r.request().method() === 'GET') { r.fulfill({ status, json: { code: 'x' } }); return true; } return false; });
        await page.getByRole('alert').filter({ hasText: expected }).waitFor();
        if (status === 401) assert.ok(await page.getByRole('link', { name: t.login }).isVisible());
        assert.equal(await page.getByRole('button', { name: t.create }).count(), 0, 'sin acciones de administración');
        await context.close();
      }
      check(`${tag}: 401 → «${t.session}» con enlace a iniciar sesión; 403 → «${t.forbidden}»; sin acciones`);
    }
    console.log(`ES-187 servidor real: ${checks.length} comprobaciones superadas. Express + rutas del administrador + PostgreSQL reales.`);
  } catch (error) {
    console.error('ES-187 falló:', error); process.exitCode = 1;
  } finally {
    if (browser) await browser.close(); if (server) await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
    if (sequelize) await sequelize.close(); if (started) await pg.stop(); try { fs.rmSync(directory, { recursive: true, force: true, maxRetries: 8, retryDelay: 300 }); } catch { /* Windows aún bloquea el directorio */ }
  }
})();
