// ES-249: «Revocar todos» del mapa de competencias (permiso `professional_bridge`) con la respuesta PERDIDA, contra el servidor REAL (Express + ruta real de consentimientos + PostgreSQL embebido real)
// y la aplicación React construida en Chromium. Se compara siempre lo que dice la pantalla con la BASE. Datos sintéticos, base efímera en 127.0.0.1, sin IA ni producción. El mapa se simula (vacío).
// Uso:  (cd frontend && npx vite build && npx vite preview --host 127.0.0.1 --port 4249 --strictPort)
//       ES249_BACKEND_DIR=<backend> ES249_PREVIEW_URL=http://127.0.0.1:4249 PLAYWRIGHT_MODULE=<playwright> [AXE_PATH=<axe.min.js>] node scripts/es249-api-integration.cjs
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
  assert.ok(process.env.ES249_BACKEND_DIR, 'Se necesita el directorio del backend');
  const fromBackend = createRequire(path.join(path.resolve(process.env.ES249_BACKEND_DIR), 'package.json'));
  const { default: EmbeddedPostgres } = await import(pathToFileURL(fromBackend.resolve('embedded-postgres')).href);
  const parent = path.resolve(os.tmpdir()); const directory = fs.mkdtempSync(path.join(parent, 'es249-pg-'));
  assert.equal(path.dirname(path.resolve(directory)), parent); assert.ok(path.basename(directory).startsWith('es249-pg-'));
  const probe = net.createServer();
  const port = await new Promise((resolve, reject) => { probe.once('error', reject); probe.listen(0, '127.0.0.1', () => { const selected = probe.address().port; probe.close(() => resolve(selected)); }); });
  const password = randomBytes(24).toString('hex');
  const pg = new EmbeddedPostgres({ databaseDir: directory, user: 'es249_test', password, port, persistent: false, initdbFlags: ['--encoding=UTF8', '--locale=C'], postgresFlags: ['-h', '127.0.0.1'], onLog() {}, onError() {} });
  let started = false; let sequelize; let server; let browser; const checks = []; const check = label => { checks.push(label); console.log('PASS ' + label); };
  try {
    await pg.initialise(); await pg.start(); started = true;
    const { Sequelize } = fromBackend('sequelize');
    sequelize = new Sequelize(`postgres://es249_test:${password}@127.0.0.1:${port}/postgres`, { logging: false, dialectOptions: { ssl: false } });
    process.env.JWT_SECRET = randomBytes(32).toString('hex'); process.env.DATA_ENCRYPTION_KEY = randomBytes(32).toString('hex');
    const id = fromBackend.resolve('./database'); require.cache[id] = { id, filename: id, loaded: true, exports: { sequelize } };
    for (const name of ['PricingPlan', 'User', 'Consent', 'ConsentEvent', 'ChatTurn', 'DiaryEntry', 'DerivedInvalidation', 'CareerContextVersion', 'BridgeTransfer', 'RevokedToken', 'AuthRevocation', 'DeletionRequest', 'AiJob', 'SkillCandidate', 'ParticipantResume', 'Evidence', 'EvidenceVersion', 'SkillCatalog', 'SkillDefinition', 'SkillAssessment']) fromBackend('./' + name);
    await sequelize.sync();
    const User = fromBackend('./User'); const consent = fromBackend('./utils/consent');
    const person = await User.create({ name: 'Persona Sintética', email: 'persona@example.invalid', password: 'x', role: 'user' });
    const express = fromBackend('express'); const app = express(); app.use(express.json());
    app.use('/api/consents', fromBackend('./middlewares/auth').verificarToken, fromBackend('./routes/consents'));
    server = app.listen(0, '127.0.0.1'); await once(server, 'listening'); const apiUrl = `http://127.0.0.1:${server.address().port}`;
    const token = fromBackend('./utils/sessions').issueToken({ id: person.id, role: 'user' });
    const dbState = async () => (await consent.hasConsent(person.id, 'professional_bridge')) ? 'granted' : 'no';
    const seed = () => consent.setConsent(person.id, 'professional_bridge', 'granted');

    const { chromium } = process.env.PLAYWRIGHT_MODULE ? require(process.env.PLAYWRIGHT_MODULE) : await import('playwright');
    browser = await chromium.launch({ headless: true });
    const frontend = process.env.ES249_PREVIEW_URL || 'http://127.0.0.1:4249'; assert.ok(['127.0.0.1', 'localhost'].includes(new URL(frontend).hostname));
    const axeSource = process.env.AXE_PATH ? fs.readFileSync(process.env.AXE_PATH, 'utf8') : '';
    async function axeCheck(page, label) {
      if (!axeSource) return;
      await page.addScriptTag({ content: axeSource });
      const violations = await page.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } }).then(r => r.violations.map(v => v.id + ':' + v.nodes.length)));
      assert.deepEqual(violations, [], label + ' axe'); check(label + ': axe 0');
    }
    // put: 'ok' | 'lose-reply' (el servidor lo aplica y la respuesta no llega) | 'lose-request' (no llega); failReadsAfterPut: la relectura falla
    async function open(lang) {
      const context = await browser.newContext({ viewport: { width: 1000, height: 900 } }); const page = await context.newPage();
      const control = { put: 'ok', failReadsAfterPut: false, putDone: false }; const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(([t, l]) => { localStorage.setItem('elevation_token', t); localStorage.setItem('elv_lang', l); }, [token, lang]);
      await page.route('**/api/**', route => {
        const p = new URL(route.request().url()).pathname;
        if (p === '/api/session') return route.fulfill({ json: { role: 'user', onboardingCompleted: true } });
        if (p === '/api/skill-map') return route.fulfill({ json: { catalogVersion: 1, skills: [] } });
        return route.fulfill({ json: {} });
      });
      await page.route('**/api/consents**', async route => {
        const request = route.request(); const url = new URL(request.url());
        if (request.method() === 'PUT') {
          if (control.put === 'lose-request') { control.put = 'ok'; control.putDone = true; return route.abort('connectionreset'); }
          const response = await route.fetch({ url: apiUrl + url.pathname });
          if (control.put === 'lose-reply') { control.put = 'ok'; control.putDone = true; return route.abort('connectionreset'); }
          return route.fulfill({ response });
        }
        if (control.failReadsAfterPut && control.putDone) return route.abort('connectionreset');
        const response = await route.fetch({ url: apiUrl + url.pathname }); return route.fulfill({ response });
      });
      await page.goto(frontend + '/app/skill-map');
      return { context, page, control, errors };
    }
    const T = {
      es: { all: 'Revocar todos', yes: 'Sí, revocar', done: 'Listo: ya no cruza nada hacia el recorrido profesional.', unsure: 'No pudimos confirmar la retirada.', notSeen: 'Todavía no vemos retirado el permiso', check: 'Comprobar', error: 'No pudimos revocar.' },
      en: { all: 'Revoke all', yes: 'Yes, revoke', done: 'Done: nothing crosses into the career path anymore.', unsure: 'We could not confirm the withdrawal.', notSeen: 'We do not see the permission withdrawn yet', check: 'Check', error: 'We could not revoke.' } };
    async function start(page) {
      const header = page.getByRole('button', { name: T.es.all, exact: true }).or(page.getByRole('button', { name: T.en.all, exact: true }));
      await header.waitFor(); await page.waitForFunction(() => !document.querySelector('.skill-map-tools button[disabled]:not([aria-pressed])') || true);
      return header;
    }
    for (const lang of ['es', 'en']) {
      const t = T[lang];
      // A) Respuesta perdida: el servidor retiró el permiso; la pantalla dice «Listo», no «error».
      { await seed(); const { context, page, control, errors } = await open(lang);
        const header = await start(page); await page.waitForFunction(() => [...document.querySelectorAll('button')].some(b => /Revocar todos|Revoke all/.test(b.textContent) && !b.disabled));
        await header.click(); control.put = 'lose-reply'; await page.getByRole('button', { name: t.yes, exact: true }).click();
        await page.getByText(t.done, { exact: true }).first().waitFor();
        assert.equal(await dbState(), 'no'); assert.equal(await page.getByText(t.error).count(), 0);
        check(`${lang}: «${t.all}» con la respuesta perdida → base sin permiso; la pantalla dice «${t.done.slice(0, 24)}…», no error`);
        assert.deepEqual(errors, []); await page.unrouteAll({ behavior: 'ignoreErrors' }); await context.close(); }
      // B) La petición no llegó: el permiso sigue vigente; la pantalla NO dice «Listo» y avisa que lo autorizado sigue cruzando.
      { await seed(); const { context, page, control } = await open(lang);
        const header = await start(page); await page.waitForFunction(() => [...document.querySelectorAll('button')].some(b => /Revocar todos|Revoke all/.test(b.textContent) && !b.disabled));
        await header.click(); control.put = 'lose-request'; await page.getByRole('button', { name: t.yes, exact: true }).click();
        await page.getByText(t.notSeen, { exact: false }).waitFor();
        assert.equal(await dbState(), 'granted'); assert.equal(await page.getByText(t.done, { exact: true }).count(), 0);
        check(`${lang}: la petición no llegó → base intacta (permiso vigente); la pantalla dice «${t.notSeen.slice(0, 26)}…», no «Listo»`);
        await page.unrouteAll({ behavior: 'ignoreErrors' }); await context.close(); }
      // C) Respuesta perdida Y la relectura cae: «No pudimos confirmar…» + «Comprobar»; comprobar resuelve con la verdad de la base.
      { await seed(); const { context, page, control } = await open(lang);
        const header = await start(page); await page.waitForFunction(() => [...document.querySelectorAll('button')].some(b => /Revocar todos|Revoke all/.test(b.textContent) && !b.disabled));
        await header.click(); control.put = 'lose-reply'; control.failReadsAfterPut = true; await page.getByRole('button', { name: t.yes, exact: true }).click();
        await page.getByText(t.unsure, { exact: false }).waitFor();
        assert.equal(await dbState(), 'no'); // la base SÍ lo retiró; la pantalla no afirma lo contrario
        assert.equal(await page.getByRole('button', { name: t.check, exact: true }).count(), 1); assert.equal(await page.getByText(t.done, { exact: true }).count(), 0);
        check(`${lang}: respuesta perdida y relectura caída → «${t.unsure}» + «${t.check}» (la base ya lo había retirado)`);
        await axeCheck(page, `${lang}: estado «no pudimos confirmar»`);
        control.failReadsAfterPut = false; await page.getByRole('button', { name: t.check, exact: true }).click();
        await page.getByText(t.done, { exact: true }).first().waitFor();
        check(`${lang}: «${t.check}» relee y la pantalla = base (permiso retirado)`);
        await page.unrouteAll({ behavior: 'ignoreErrors' }); await context.close(); }
    }
    console.log(`ES-249 servidor real: ${checks.length} comprobaciones superadas. Express + ruta de consentimientos + PostgreSQL reales.`);
  } catch (error) {
    console.error('ES-249 falló:', error); process.exitCode = 1;
  } finally {
    if (browser) await browser.close(); if (server) await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
    if (sequelize) await sequelize.close(); if (started) await pg.stop(); fs.rmSync(directory, { recursive: true, force: true });
  }
})();
