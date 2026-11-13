// ES-247: permisos de lectura por fuente de El Puente (chat / diario / hoja de vida) con la respuesta PERDIDA, contra el servidor REAL (Express + ruta real de consentimientos + PostgreSQL embebido real)
// y la aplicación React construida en Chromium. Se compara siempre lo que ve la persona con la BASE. Además mide E190-1: durante el guardado el foco no cae a body.
// Datos sintéticos, base efímera en 127.0.0.1, sin IA ni producción. El resto de la pantalla (contexto de carrera, hojas de vida) se simula.
// Uso:  (cd frontend && npx vite build && npx vite preview --host 127.0.0.1 --port 4247 --strictPort)
//       ES247_BACKEND_DIR=<backend> ES247_PREVIEW_URL=http://127.0.0.1:4247 PLAYWRIGHT_MODULE=<playwright> [AXE_PATH=<axe.min.js>] node scripts/es247-api-integration.cjs
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
  assert.ok(process.env.ES247_BACKEND_DIR, 'Se necesita el directorio del backend');
  const fromBackend = createRequire(path.join(path.resolve(process.env.ES247_BACKEND_DIR), 'package.json'));
  const { default: EmbeddedPostgres } = await import(pathToFileURL(fromBackend.resolve('embedded-postgres')).href);
  const parent = path.resolve(os.tmpdir()); const directory = fs.mkdtempSync(path.join(parent, 'es247-pg-'));
  assert.equal(path.dirname(path.resolve(directory)), parent); assert.ok(path.basename(directory).startsWith('es247-pg-'));
  const probe = net.createServer();
  const port = await new Promise((resolve, reject) => { probe.once('error', reject); probe.listen(0, '127.0.0.1', () => { const selected = probe.address().port; probe.close(() => resolve(selected)); }); });
  const password = randomBytes(24).toString('hex');
  const pg = new EmbeddedPostgres({ databaseDir: directory, user: 'es247_test', password, port, persistent: false, initdbFlags: ['--encoding=UTF8', '--locale=C'], postgresFlags: ['-h', '127.0.0.1'], onLog() {}, onError() {} });
  let started = false; let sequelize; let server; let browser; const checks = []; const check = label => { checks.push(label); console.log('PASS ' + label); };
  try {
    await pg.initialise(); await pg.start(); started = true;
    const { Sequelize } = fromBackend('sequelize');
    sequelize = new Sequelize(`postgres://es247_test:${password}@127.0.0.1:${port}/postgres`, { logging: false, dialectOptions: { ssl: false } });
    process.env.JWT_SECRET = randomBytes(32).toString('hex'); process.env.DATA_ENCRYPTION_KEY = randomBytes(32).toString('hex');
    const id = fromBackend.resolve('./database'); require.cache[id] = { id, filename: id, loaded: true, exports: { sequelize } };
    for (const name of ['PricingPlan', 'User', 'Consent', 'ConsentEvent', 'ChatTurn', 'DiaryEntry', 'DerivedInvalidation', 'CareerContextVersion', 'BridgeTransfer', 'RevokedToken', 'AuthRevocation', 'DeletionRequest', 'AiJob', 'SkillCandidate', 'ParticipantResume']) fromBackend('./' + name);
    await sequelize.sync();
    const User = fromBackend('./User'); const consent = fromBackend('./utils/consent');
    const person = await User.create({ name: 'Persona Sintética', email: 'persona@example.invalid', password: 'x', role: 'user' });
    const express = fromBackend('express'); const app = express(); app.use(express.json());
    app.use('/api/consents', fromBackend('./middlewares/auth').verificarToken, fromBackend('./routes/consents'));
    server = app.listen(0, '127.0.0.1'); await once(server, 'listening'); const apiUrl = `http://127.0.0.1:${server.address().port}`;
    const token = fromBackend('./utils/sessions').issueToken({ id: person.id, role: 'user' });
    const dbState = async () => ({ chat: (await consent.hasConsent(person.id, 'insights_chat')) ? 'granted' : 'no', diary: (await consent.hasConsent(person.id, 'insights_diary')) ? 'granted' : 'no' });
    async function seed(chat, diary) {
      await consent.setConsent(person.id, 'insights_chat', chat ? 'granted' : 'revoked'); await consent.setConsent(person.id, 'insights_diary', diary ? 'granted' : 'revoked'); await consent.setConsent(person.id, 'insights_resume', 'revoked');
    }

    const { chromium } = process.env.PLAYWRIGHT_MODULE ? require(process.env.PLAYWRIGHT_MODULE) : await import('playwright');
    browser = await chromium.launch({ headless: true });
    const frontend = process.env.ES247_PREVIEW_URL || 'http://127.0.0.1:4247'; assert.ok(['127.0.0.1', 'localhost'].includes(new URL(frontend).hostname));
    const axeSource = process.env.AXE_PATH ? fs.readFileSync(process.env.AXE_PATH, 'utf8') : '';
    async function axeCheck(page, label) {
      if (!axeSource) return;
      await page.addScriptTag({ content: axeSource });
      const violations = await page.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } }).then(r => r.violations.map(v => v.id + ':' + v.nodes.length)));
      assert.deepEqual(violations, [], label + ' axe'); check(label + ': axe 0');
    }
    // put: 'ok' | 'lose-reply' (el servidor lo aplica y la respuesta no llega) | 'lose-request' (no llega); failReadsAfterPut: la relectura falla; delay: ms que tarda el PUT
    async function open(lang) {
      const context = await browser.newContext({ viewport: { width: 1000, height: 1000 } }); const page = await context.newPage();
      const control = { put: 'ok', failReadsAfterPut: false, putDone: false, delay: 0 }; const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(([t, l]) => { localStorage.setItem('elevation_token', t); localStorage.setItem('elv_lang', l); }, [token, lang]);
      await page.route('**/api/**', route => {
        const p = new URL(route.request().url()).pathname;
        if (p === '/api/session') return route.fulfill({ json: { role: 'user', onboardingCompleted: true } });
        if (p === '/api/career-context') return route.fulfill({ json: { active: null, versions: [] } });
        if (p === '/api/user/resumes') return route.fulfill({ json: { resumes: [] } });
        return route.fulfill({ json: {} });
      });
      await page.route('**/api/consents**', async route => {
        const request = route.request(); const url = new URL(request.url());
        if (request.method() === 'PUT') {
          if (control.delay) await new Promise(resolve => setTimeout(resolve, control.delay));
          if (control.put === 'lose-request') { control.put = 'ok'; control.putDone = true; return route.abort('connectionreset'); }
          const response = await route.fetch({ url: apiUrl + url.pathname });
          if (control.put === 'lose-reply') { control.put = 'ok'; control.putDone = true; return route.abort('connectionreset'); }
          return route.fulfill({ response });
        }
        if (control.failReadsAfterPut && control.putDone) return route.abort('connectionreset');
        const response = await route.fetch({ url: apiUrl + url.pathname }); return route.fulfill({ response });
      });
      await page.goto(frontend + '/app/bridge');
      await page.locator('[data-source="chat"]').waitFor();
      return { context, page, control, errors };
    }
    const T = {
      es: { revoked: 'Retiraste el permiso. La IA ya no lee tu chat.', granted: 'Autorizaste el análisis de tu diario.', unsureOff: 'No pudimos confirmar si se retiró el permiso', notSeen: 'Todavía no vemos retirado el permiso', pill: 'Sin confirmar', check: 'Comprobar' },
      en: { revoked: 'You withdrew the permission. The AI no longer reads your chat.', granted: 'You allowed the analysis of your journal.', unsureOff: 'We could not confirm whether the permission was withdrawn', notSeen: 'We do not see the permission withdrawn yet', pill: 'Unconfirmed', check: 'Check' } };
    const sw = (page, source) => page.locator(`[role="switch"][data-source="${source}"]`);
    for (const lang of ['es', 'en']) {
      const t = T[lang];
      // A) Retirar «chat» con la respuesta perdida: el servidor lo retiró; la pantalla lo dice con la base como verdad, sin error.
      { await seed(true, false);
        const { context, page, control, errors } = await open(lang);
        assert.equal(await sw(page, 'chat').getAttribute('aria-checked'), 'true'); control.put = 'lose-reply';
        await sw(page, 'chat').click();
        await page.getByText(t.revoked, { exact: true }).first().waitFor();
        assert.deepEqual(await dbState(), { chat: 'no', diary: 'no' }); assert.equal(await sw(page, 'chat').getAttribute('aria-checked'), 'false');
        assert.equal(await page.getByRole('alert').filter({ hasText: /.+/ }).count(), 0);
        check(`${lang}: retiro con la respuesta perdida → base sin permiso; la pantalla lo dice («${t.revoked.slice(0, 24)}…») sin error y el interruptor queda apagado`);
        assert.deepEqual(errors, []); await page.unrouteAll({ behavior: 'ignoreErrors' }); await context.close(); }
      // B) La petición no llegó: el permiso sigue; la pantalla NO dice que se retiró, avisa que la IA aún puede leer y el interruptor sigue encendido.
      { await seed(true, false);
        const { context, page, control } = await open(lang);
        control.put = 'lose-request'; await sw(page, 'chat').click();
        await page.getByText(t.notSeen, { exact: false }).waitFor();
        assert.deepEqual(await dbState(), { chat: 'granted', diary: 'no' }); assert.equal(await sw(page, 'chat').getAttribute('aria-checked'), 'true');
        check(`${lang}: la petición no llegó → base intacta (permiso vigente); la pantalla avisa «${t.notSeen.slice(0, 26)}…» y el interruptor sigue encendido`);
        await page.unrouteAll({ behavior: 'ignoreErrors' }); await context.close(); }
      // C) Respuesta perdida Y la relectura cae: la fuente queda «Sin confirmar», sin interruptor que afirme nada, con «Comprobar»; comprobar resuelve con la base.
      { await seed(true, false);
        const { context, page, control } = await open(lang);
        control.put = 'lose-reply'; control.failReadsAfterPut = true; await sw(page, 'chat').click();
        await page.getByText(t.unsureOff, { exact: false }).waitFor();
        assert.deepEqual(await dbState(), { chat: 'no', diary: 'no' }); // la base SÍ lo retiró; la pantalla no afirma lo contrario
        assert.equal(await sw(page, 'chat').count(), 0); await page.getByText(t.pill, { exact: true }).waitFor();
        assert.equal(await page.getByRole('button', { name: t.check, exact: true }).count(), 1);
        check(`${lang}: respuesta perdida y relectura caída → «${t.pill}», sin interruptor de esa fuente, aviso de que la IA puede seguir leyendo y «${t.check}»`);
        await axeCheck(page, `${lang}: estado «sin confirmar»`);
        control.failReadsAfterPut = false; await page.getByRole('button', { name: t.check, exact: true }).click();
        await page.getByText(t.revoked, { exact: true }).first().waitFor();
        assert.equal(await sw(page, 'chat').getAttribute('aria-checked'), 'false'); assert.equal(await page.getByText(t.pill, { exact: true }).count(), 0);
        check(`${lang}: «${t.check}» relee y la pantalla = base (permiso retirado)`);
        await page.unrouteAll({ behavior: 'ignoreErrors' }); await context.close(); }
      // D) Autorizar «diario» con la respuesta perdida: el servidor lo registró; la pantalla confirma tras releer.
      { await seed(false, false);
        const { context, page, control } = await open(lang);
        await sw(page, 'diary').click(); control.put = 'lose-reply'; await page.locator('.bridge-modal .bridge-ok').click();
        await page.getByText(t.granted, { exact: true }).first().waitFor();
        assert.deepEqual(await dbState(), { chat: 'no', diary: 'granted' }); assert.equal(await sw(page, 'diary').getAttribute('aria-checked'), 'true');
        check(`${lang}: autorizar con la respuesta perdida → base con permiso; la pantalla lo confirma tras releer`);
        await page.unrouteAll({ behavior: 'ignoreErrors' }); await context.close(); }
      // E) E190-1: mientras se guarda el retiro, el foco no cae a body; al terminar vuelve al interruptor.
      { await seed(true, false);
        const { context, page, control } = await open(lang);
        control.delay = 1200; await sw(page, 'chat').focus(); await sw(page, 'chat').click();
        await page.waitForTimeout(400);
        const during = await page.evaluate(() => document.activeElement && document.activeElement.tagName);
        assert.notEqual(during, 'BODY'); assert.equal(during, 'SECTION');
        await page.getByText(t.revoked, { exact: true }).first().waitFor();
        await page.waitForFunction(() => document.activeElement && document.activeElement.getAttribute('data-source') === 'chat');
        check(`${lang}: durante el retiro el foco está en la sección (no en body) y al terminar vuelve al interruptor`);
        await page.unrouteAll({ behavior: 'ignoreErrors' }); await context.close(); }
    }
    console.log(`ES-247 servidor real: ${checks.length} comprobaciones superadas. Express + ruta de consentimientos + PostgreSQL reales.`);
  } catch (error) {
    console.error('ES-247 falló:', error); require('./_exitOnFailure.cjs').fail();
  } finally {
    if (browser) await browser.close(); if (server) await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
    if (sequelize) await sequelize.close(); if (started) await pg.stop(); fs.rmSync(directory, { recursive: true, force: true });
  }
})();
