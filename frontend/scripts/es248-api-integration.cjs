// ES-248: «Retirar mi autorización» de hojas de vida con la respuesta PERDIDA, contra el servidor REAL (Express + rutas reales de consentimientos y de hojas de vida + PostgreSQL embebido real)
// y la aplicación React construida en Chromium. Retirar la autorización BORRA las hojas de vida (ES-109): si la respuesta se pierde, el servidor ya pudo haberlo hecho.
// Se compara siempre lo que ve la persona con la BASE (permiso y número de hojas). Datos sintéticos, base efímera en 127.0.0.1, sin IA ni producción.
// Uso:  (cd frontend && npx vite build && npx vite preview --host 127.0.0.1 --port 4248 --strictPort)
//       ES248_BACKEND_DIR=<backend> ES248_PREVIEW_URL=http://127.0.0.1:4248 PLAYWRIGHT_MODULE=<playwright> [AXE_PATH=<axe.min.js>] node scripts/es248-api-integration.cjs
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
  assert.ok(process.env.ES248_BACKEND_DIR, 'Se necesita el directorio del backend');
  const fromBackend = createRequire(path.join(path.resolve(process.env.ES248_BACKEND_DIR), 'package.json'));
  const { default: EmbeddedPostgres } = await import(pathToFileURL(fromBackend.resolve('embedded-postgres')).href);
  const parent = path.resolve(os.tmpdir()); const directory = fs.mkdtempSync(path.join(parent, 'es248-pg-'));
  assert.equal(path.dirname(path.resolve(directory)), parent); assert.ok(path.basename(directory).startsWith('es248-pg-'));
  const probe = net.createServer();
  const port = await new Promise((resolve, reject) => { probe.once('error', reject); probe.listen(0, '127.0.0.1', () => { const selected = probe.address().port; probe.close(() => resolve(selected)); }); });
  const password = randomBytes(24).toString('hex');
  const pg = new EmbeddedPostgres({ databaseDir: directory, user: 'es248_test', password, port, persistent: false, initdbFlags: ['--encoding=UTF8', '--locale=C'], postgresFlags: ['-h', '127.0.0.1'], onLog() {}, onError() {} });
  let started = false; let sequelize; let server; let browser; const checks = []; const check = label => { checks.push(label); console.log('PASS ' + label); };
  try {
    await pg.initialise(); await pg.start(); started = true;
    const { Sequelize } = fromBackend('sequelize');
    sequelize = new Sequelize(`postgres://es248_test:${password}@127.0.0.1:${port}/postgres`, { logging: false, dialectOptions: { ssl: false } });
    process.env.JWT_SECRET = randomBytes(32).toString('hex'); process.env.DATA_ENCRYPTION_KEY = randomBytes(32).toString('hex');
    const id = fromBackend.resolve('./database'); require.cache[id] = { id, filename: id, loaded: true, exports: { sequelize } };
    for (const name of ['PricingPlan', 'User', 'Consent', 'ConsentEvent', 'ChatTurn', 'DiaryEntry', 'DerivedInvalidation', 'CareerContextVersion', 'BridgeTransfer', 'RevokedToken', 'AuthRevocation', 'DeletionRequest', 'AiJob', 'SkillCandidate', 'ParticipantResume']) fromBackend('./' + name);
    await sequelize.sync();
    const User = fromBackend('./User'); const Resume = fromBackend('./ParticipantResume'); const consent = fromBackend('./utils/consent'); const resumes = fromBackend('./utils/resumes');
    const person = await User.create({ name: 'Persona Sintética', email: 'persona@example.invalid', password: 'x', role: 'user' });
    const express = fromBackend('express'); const app = express(); app.use(express.json());
    const verify = fromBackend('./middlewares/auth').verificarToken;
    app.use('/api/consents', verify, fromBackend('./routes/consents'));
    app.use('/api/user/resumes', verify, fromBackend('./routes/resumes'));
    server = app.listen(0, '127.0.0.1'); await once(server, 'listening'); const apiUrl = `http://127.0.0.1:${server.address().port}`;
    const sessions = fromBackend('./utils/sessions'); const token = sessions.issueToken({ id: person.id, role: 'user' });
    const dbState = async () => ({ consent: (await consent.hasConsent(person.id, 'resume_ai_reading')) ? 'granted' : 'no', resumes: await Resume.count({ where: { UserId: person.id } }) });
    async function seed() { await Resume.destroy({ where: { UserId: person.id } }); await consent.setConsent(person.id, 'resume_ai_reading', 'granted'); await sequelize.transaction(async transaction => { await resumes.storeResume(person.id, Buffer.from('%PDF-1.4 sintetico uno'), transaction); await resumes.storeResume(person.id, Buffer.from('%PDF-1.4 sintetico dos'), transaction); }); }

    const { chromium } = process.env.PLAYWRIGHT_MODULE ? require(process.env.PLAYWRIGHT_MODULE) : await import('playwright');
    browser = await chromium.launch({ headless: true });
    const frontend = process.env.ES248_PREVIEW_URL || 'http://127.0.0.1:4248'; assert.ok(['127.0.0.1', 'localhost'].includes(new URL(frontend).hostname));
    const axeSource = process.env.AXE_PATH ? fs.readFileSync(process.env.AXE_PATH, 'utf8') : '';
    async function axeCheck(page, label) {
      if (!axeSource) return;
      await page.addScriptTag({ content: axeSource });
      const violations = await page.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } }).then(r => r.violations.map(v => v.id + ':' + v.nodes.length)));
      assert.deepEqual(violations, [], label + ' axe'); check(label + ': axe 0');
    }
    // put: 'ok' | 'lose-reply' (el servidor lo aplica y la respuesta no llega) | 'lose-request' (no llega) ; failReadsAfterPut: la relectura del permiso falla
    async function open(lang) {
      const context = await browser.newContext({ viewport: { width: 1000, height: 900 } }); const page = await context.newPage();
      const control = { put: 'ok', failReadsAfterPut: false, putDone: false }; const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(([t, l]) => { localStorage.setItem('elevation_token', t); localStorage.setItem('elv_lang', l); }, [token, lang]);
      await page.route('**/api/session', route => route.fulfill({ json: { role: 'user', onboardingCompleted: true } }));
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
      await page.route('**/api/user/resumes**', async route => { const url = new URL(route.request().url()); const response = await route.fetch({ url: apiUrl + url.pathname + url.search }); return route.fulfill({ response }); });
      await page.goto(frontend + '/app/context/resumes');
      return { context, page, control, errors };
    }
    const T = { es: { withdraw: 'Retirar mi autorización', yes: 'Sí, retirar y borrar', done: 'Retiramos tu autorización y borramos tus hojas de vida.', unsure: 'No pudimos confirmar si se retiró la autorización. Puede que tus hojas de vida ya se hayan borrado.', notSeen: 'Todavía no vemos que se haya retirado la autorización', check: 'Comprobar', empty: 'Todavía no has subido ninguna hoja de vida', versions: /Versión \d/ },
      en: { withdraw: 'Withdraw my permission', yes: 'Yes, withdraw and delete', done: 'We withdrew your permission and deleted your résumés.', unsure: 'We could not confirm whether the permission was withdrawn. Your résumés may already have been deleted.', notSeen: 'We do not see the permission withdrawn yet', check: 'Check', empty: /You have not uploaded|no résumé|No résumé/i, versions: /Version \d/ } };
    for (const lang of ['es', 'en']) {
      const t = T[lang];
      // A) Respuesta perdida: el servidor retiró el permiso y BORRÓ las hojas; la pantalla debe decir exactamente eso (no «error»).
      { await seed(); assert.deepEqual(await dbState(), { consent: 'granted', resumes: 2 });
        const { context, page, control, errors } = await open(lang);
        await page.getByRole('button', { name: t.withdraw, exact: true }).click(); control.put = 'lose-reply';
        await page.getByRole('button', { name: t.yes, exact: true }).click();
        await page.getByText(t.done, { exact: true }).first().waitFor();
        assert.deepEqual(await dbState(), { consent: 'no', resumes: 0 });
        assert.equal(await page.getByText(t.versions).count(), 0); assert.equal(await page.getByRole('alert').filter({ hasText: /.+/ }).count(), 0);
        check(`${lang}: retiro con la respuesta perdida → base sin permiso y SIN hojas; la pantalla lo dice («${t.done.slice(0, 28)}…»), sin error y sin hojas`);
        assert.deepEqual(errors, []); await page.unrouteAll({ behavior: 'ignoreErrors' }); await context.close(); }
      // B) La petición no llegó: nada cambió. La pantalla no finge el borrado y deja «Comprobar».
      { await seed();
        const { context, page, control } = await open(lang);
        await page.getByRole('button', { name: t.withdraw, exact: true }).click(); control.put = 'lose-request';
        await page.getByRole('button', { name: t.yes, exact: true }).click();
        await page.getByText(t.notSeen, { exact: false }).waitFor();
        assert.deepEqual(await dbState(), { consent: 'granted', resumes: 2 });
        await page.getByText(t.versions).first().waitFor(); assert.equal(await page.getByText(t.versions).count(), 2); assert.equal(await page.getByRole('button', { name: t.check, exact: true }).count(), 1);
        check(`${lang}: la petición no llegó → base intacta (permiso y 2 hojas) y la pantalla las sigue mostrando, con «${t.check}»`);
        await axeCheck(page, `${lang}: estado «todavía no lo vemos»`);
        await page.unrouteAll({ behavior: 'ignoreErrors' }); await context.close(); }
      // C) Respuesta perdida Y la relectura cae: aviso de que las hojas pueden estar ya borradas; «Comprobar» resuelve con la verdad de la base.
      { await seed();
        const { context, page, control } = await open(lang);
        await page.getByRole('button', { name: t.withdraw, exact: true }).click(); control.put = 'lose-reply'; control.failReadsAfterPut = true;
        await page.getByRole('button', { name: t.yes, exact: true }).click();
        await page.getByText(t.unsure, { exact: false }).waitFor();
        assert.deepEqual(await dbState(), { consent: 'no', resumes: 0 }); // la base SÍ las borró; la pantalla no afirma lo contrario
        check(`${lang}: respuesta perdida y relectura caída → «${t.unsure.slice(0, 30)}…» (la base ya las había borrado)`);
        await axeCheck(page, `${lang}: estado «no pudimos confirmar»`);
        control.failReadsAfterPut = false; await page.getByRole('button', { name: t.check, exact: true }).click();
        await page.getByText(t.done, { exact: true }).first().waitFor();
        check(`${lang}: «${t.check}» relee y la pantalla = base (permiso retirado, 0 hojas)`);
        await page.unrouteAll({ behavior: 'ignoreErrors' }); await context.close(); }
    }
    console.log(`ES-248 servidor real: ${checks.length} comprobaciones superadas. Express + rutas de consentimientos y de hojas de vida + PostgreSQL reales.`);
  } catch (error) {
    console.error('ES-248 falló:', error); process.exitCode = 1;
  } finally {
    if (browser) await browser.close(); if (server) await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
    if (sequelize) await sequelize.close(); if (started) await pg.stop(); fs.rmSync(directory, { recursive: true, force: true });
  }
})();
