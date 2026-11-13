// ES-244: «Compartir con mi profesional» con la respuesta PERDIDA en ambos sentidos, contra el servidor REAL (Express + rutas reales de consentimientos + PostgreSQL embebido real)
// y la aplicación React construida en Chromium. Datos sintéticos, base efímera en 127.0.0.1, sin proveedor de IA ni producción.
// En cada caso se compara lo que ve la persona con la FILA REAL de la base (pantalla = base). Solo la pantalla de «Mi profesional» y su lectura de datos están simuladas.
// Uso (backend con node_modules; vista previa del frontend construido en 127.0.0.1):
//   (cd frontend && npx vite build && npx vite preview --host 127.0.0.1 --port 4244 --strictPort)
//   ES244_BACKEND_DIR=<backend> ES244_PREVIEW_URL=http://127.0.0.1:4244 PLAYWRIGHT_MODULE=<playwright> node scripts/es244-api-integration.cjs
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
  assert.ok(process.env.ES244_BACKEND_DIR, 'Se necesita el directorio del backend');
  const fromBackend = createRequire(path.join(path.resolve(process.env.ES244_BACKEND_DIR), 'package.json'));
  const { default: EmbeddedPostgres } = await import(pathToFileURL(fromBackend.resolve('embedded-postgres')).href);
  const parent = path.resolve(os.tmpdir()); const directory = fs.mkdtempSync(path.join(parent, 'es244-pg-'));
  assert.equal(path.dirname(path.resolve(directory)), parent); assert.ok(path.basename(directory).startsWith('es244-pg-'));
  const probe = net.createServer();
  const port = await new Promise((resolve, reject) => { probe.once('error', reject); probe.listen(0, '127.0.0.1', () => { const selected = probe.address().port; probe.close(() => resolve(selected)); }); });
  const password = randomBytes(24).toString('hex');
  const pg = new EmbeddedPostgres({ databaseDir: directory, user: 'es244_test', password, port, persistent: false, initdbFlags: ['--encoding=UTF8', '--locale=C'], postgresFlags: ['-h', '127.0.0.1'], onLog() {}, onError() {} });
  let started = false; let sequelize; let server; let browser; const checks = []; const check = label => { checks.push(label); console.log('PASS ' + label); };
  try {
    await pg.initialise(); await pg.start(); started = true;
    const { Sequelize } = fromBackend('sequelize');
    sequelize = new Sequelize(`postgres://es244_test:${password}@127.0.0.1:${port}/postgres`, { logging: false, dialectOptions: { ssl: false } });
    process.env.JWT_SECRET = randomBytes(32).toString('hex'); process.env.DATA_ENCRYPTION_KEY = randomBytes(32).toString('hex');
    const id = fromBackend.resolve('./database'); require.cache[id] = { id, filename: id, loaded: true, exports: { sequelize } };
    for (const name of ['PricingPlan', 'User', 'Consent', 'ConsentEvent', 'ChatTurn', 'DiaryEntry', 'DerivedInvalidation', 'CareerContextVersion', 'BridgeTransfer', 'RevokedToken', 'AuthRevocation', 'DeletionRequest', 'AiJob', 'SkillCandidate']) fromBackend('./' + name);
    await sequelize.sync();
    const User = fromBackend('./User'); const Consent = fromBackend('./Consent');
    const therapist = await User.create({ name: 'Profesional Sintético', email: 'pro@example.invalid', password: 'x', role: 'therapist' });
    const person = await User.create({ name: 'Persona Sintética', email: 'persona@example.invalid', password: 'x', role: 'user', therapistId: therapist.id });
    const express = fromBackend('express'); const app = express(); app.use(express.json());
    app.use('/api/consents', fromBackend('./middlewares/auth').verificarToken, fromBackend('./routes/consents'));
    server = app.listen(0, '127.0.0.1'); await once(server, 'listening'); const apiUrl = `http://127.0.0.1:${server.address().port}`;
    const sessions = fromBackend('./utils/sessions'); const token = sessions.issueToken({ id: person.id, role: 'user' });
    const dbStatus = async () => { const row = await Consent.findOne({ where: { UserId: person.id, purpose: 'therapist_sharing' } }); return row ? row.status : 'sin fila'; };

    const { chromium } = process.env.PLAYWRIGHT_MODULE ? require(process.env.PLAYWRIGHT_MODULE) : await import('playwright');
    browser = await chromium.launch({ headless: true });
    const frontend = process.env.ES244_PREVIEW_URL || 'http://127.0.0.1:4244'; assert.ok(['127.0.0.1', 'localhost'].includes(new URL(frontend).hostname));
    // modo: qué pasa con la siguiente petición de consentimientos: 'ok' | 'lose-reply' (el servidor lo aplica y la respuesta no llega) | 'lose-request' (no llega al servidor) | 'fail-read' (la lectura GET falla)
    async function open(lang) {
      const context = await browser.newContext({ viewport: { width: 1000, height: 900 } }); const page = await context.newPage();
      const control = { put: 'ok', failReadsAfterPut: false, puts: 0, putDone: false }; const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(([t, l]) => { localStorage.setItem('elevation_token', t); localStorage.setItem('elv_lang', l); }, [token, lang]);
      await page.route('**/api/session', route => route.fulfill({ json: { role: 'user', onboardingCompleted: true } }));
      await page.route('**/api/sessions/user/my-therapist', route => route.fulfill({ json: { therapist: { id: therapist.id, name: therapist.name, email: therapist.email, profile: null }, upcomingSessions: [], pastSessions: [] } }));
      await page.route('**/api/consents**', async route => {
        const request = route.request(); const url = new URL(request.url());
        if (request.method() === 'PUT') {
          control.puts++;
          if (control.put === 'lose-request') { control.put = 'ok'; control.putDone = true; return route.abort('connectionreset'); }
          const response = await route.fetch({ url: apiUrl + url.pathname });
          if (control.put === 'lose-reply') { control.put = 'ok'; control.putDone = true; return route.abort('connectionreset'); }
          return route.fulfill({ response });
        }
        if (control.failReadsAfterPut && control.putDone) return route.abort('connectionreset');
        const response = await route.fetch({ url: apiUrl + url.pathname }); return route.fulfill({ response });
      });
      await page.goto(frontend + '/app/my-therapist');
      return { context, page, control, errors };
    }
    const sw = page => page.getByRole('switch');
    // axe WCAG 2.x A/AA y objetivos >= 24 px en el estado actual de la pantalla (si hay AXE_PATH).
    const axeSource = process.env.AXE_PATH ? fs.readFileSync(process.env.AXE_PATH, 'utf8') : '';
    async function axeCheck(page, label) {
      if (!axeSource) return;
      await page.addScriptTag({ content: axeSource });
      const violations = await page.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } }).then(r => r.violations.map(v => v.id + ':' + v.nodes.length)));
      const small = await page.evaluate(() => [...document.querySelectorAll('button, a[href]')].filter(el => { const b = el.getBoundingClientRect(); return b.width > 1 && b.height > 1 && (b.width < 24 || b.height < 24) }).map(el => (el.innerText || el.getAttribute('aria-label') || '').trim().slice(0, 24)));
      assert.deepEqual(violations, [], label + ' axe'); assert.deepEqual(small, [], label + ' objetivos >= 24 px'); check(label + ': axe 0 y objetivos >= 24 px');
    }
    const T = { es: { title: 'Compartir mis datos con mi profesional', saved: 'Listo', check: 'Comprobar', unsureOn: 'No pudimos confirmar si quedó activado. Comprueba antes de reintentar.', unsureOff: 'No pudimos confirmar si se desactivó. Puede que tu profesional siga viendo tus datos.', notSeenOn: 'Todavía no vemos que se haya activado.' },
      en: { title: 'Share my data with my professional', saved: 'Done', check: 'Check', unsureOn: 'We could not confirm whether it was turned on. Check before trying again.', unsureOff: 'We could not confirm whether it was turned off. Your professional may still see your data.', notSeenOn: 'We do not see it turned on yet.' } };

    for (const lang of ['es', 'en']) {
      const t = T[lang];
      // 1) ENCENDER con la respuesta perdida: el servidor lo concede; la pantalla debe mostrarlo ENCENDIDO (F5c).
      {
        const { context, page, control, errors } = await open(lang); await sw(page).waitFor();
        assert.equal(await sw(page).getAttribute('aria-checked'), 'false'); assert.equal(await dbStatus(), 'sin fila');
        control.put = 'lose-reply'; await sw(page).click();
        await page.getByText(t.saved, { exact: true }).waitFor();
        assert.equal(await dbStatus(), 'granted'); assert.equal(await sw(page).getAttribute('aria-checked'), 'true');
        assert.equal(await page.getByText(/No se pudo guardar|Could not save/).count(), 0); assert.equal(control.puts, 1);
        check(`${lang}: ENCENDER con la respuesta perdida → el servidor lo concedió y la pantalla lo muestra ENCENDIDO (pantalla = base)`);
        // 2) APAGAR con la respuesta perdida: el retiro se verifica.
        control.put = 'lose-reply'; await sw(page).click();
        await page.getByText(t.saved, { exact: true }).waitFor();
        await page.waitForFunction(() => document.querySelector('[role=switch]')?.getAttribute('aria-checked') === 'false');
        assert.equal(await dbStatus(), 'revoked');
        check(`${lang}: APAGAR con la respuesta perdida → el servidor lo retiró y la pantalla lo muestra APAGADO (pantalla = base)`);
        // 3) La petición ni siquiera llegó: nada cambió; la pantalla dice la verdad y deja «Comprobar» y reintentar.
        control.put = 'lose-request'; await sw(page).click();
        await page.getByText(t.notSeenOn).waitFor();
        assert.equal(await sw(page).getAttribute('aria-checked'), 'false'); assert.equal(await dbStatus(), 'revoked');
        assert.equal(await page.getByRole('button', { name: t.check, exact: true }).count(), 1);
        check(`${lang}: la petición no llegó → pantalla APAGADA = base ('revoked'), con «${t.check}» y sin falso éxito`);
        await axeCheck(page, `${lang}: estado «todavía no lo vemos»`);
        await sw(page).click(); await page.waitForFunction(() => document.querySelector('[role=switch]')?.getAttribute('aria-checked') === 'true');
        assert.equal(await dbStatus(), 'granted');
        check(`${lang}: reintentar tras no verlo funciona y no duplica (una sola fila 'granted')`);
        assert.equal(await Consent.count({ where: { UserId: person.id, purpose: 'therapist_sharing' } }), 1);
        assert.deepEqual(errors, []);
        await context.close();
        await Consent.destroy({ where: { UserId: person.id, purpose: 'therapist_sharing' } });
      }
      // 4) ENCENDER con respuesta perdida Y la relectura también falla: no se muestra ningún interruptor (sería un estado inventado); «Comprobar» lo resuelve.
      {
        const { context, page, control } = await open(lang); await sw(page).waitFor();
        control.put = 'lose-reply'; control.failReadsAfterPut = true; await sw(page).click();
        await page.getByText(t.unsureOn, { exact: true }).waitFor();
        assert.equal(await sw(page).count(), 0); assert.equal(await dbStatus(), 'granted'); // la base SÍ lo concedió y la pantalla no finge lo contrario
        check(`${lang}: respuesta perdida y relectura caída → sin interruptor engañoso, aviso «${t.unsureOn.slice(0, 30)}…» y «${t.check}»`);
        await axeCheck(page, `${lang}: estado «no pudimos confirmar»`);
        control.failReadsAfterPut = false; await page.getByRole('button', { name: t.check, exact: true }).click();
        await page.getByText(t.saved, { exact: true }).waitFor();
        assert.equal(await sw(page).getAttribute('aria-checked'), 'true');
        check(`${lang}: «${t.check}» relee el estado real y la pantalla = base ('granted')`);
        // 5) APAGAR con respuesta perdida y relectura caída: avisa que el profesional PUEDE seguir viendo los datos hasta comprobar.
        control.put = 'lose-reply'; control.failReadsAfterPut = true; await sw(page).click();
        await page.getByText(t.unsureOff, { exact: false }).waitFor();
        assert.equal(await sw(page).count(), 0); assert.equal(await dbStatus(), 'revoked');
        control.failReadsAfterPut = false; await page.getByRole('button', { name: t.check, exact: true }).click();
        await page.waitForFunction(() => document.querySelector('[role=switch]')?.getAttribute('aria-checked') === 'false');
        check(`${lang}: retiro incierto → avisa que el profesional puede seguir viendo los datos, y «${t.check}» deja la pantalla = base ('revoked')`);
        await context.close();
        await Consent.destroy({ where: { UserId: person.id, purpose: 'therapist_sharing' } });
      }
    }
    console.log(`ES-244 servidor real: ${checks.length} comprobaciones superadas. Express + rutas de consentimientos + PostgreSQL reales; solo «Mi profesional» (datos de la página) está simulada.`);
  } catch (error) {
    console.error('ES-244 falló:', error); require('./_exitOnFailure.cjs').fail();
  } finally {
    if (browser) await browser.close(); if (server) await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
    if (sequelize) await sequelize.close(); if (started) await pg.stop(); fs.rmSync(directory, { recursive: true, force: true });
  }
})();
