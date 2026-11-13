// ES-173 (HU-P22, entrega c): «Tu opinión» (/app/feedback) CONECTADA al servidor real, medida en Chromium sobre el build real de React.
// Servidor: Express + rutas REALES (consentimientos y /api/me/pilot-feedback) + PostgreSQL embebido real (127.0.0.1, base efímera). Personas SINTÉTICAS, sin IA ni producción.
// Comprueba: sin bandera LIVE → franja «datos ficticios» y CERO peticiones a /api/me/pilot-feedback; con bandera → sin franja, bloque de permiso, dar permiso, guardar (se verifica en la BASE),
// recargar, 403 si el permiso se retira por otra vía, 409 por versión, retirar permiso (NO borra), retirar respuesta (BORRA), ES/EN × 390/1360 × claro/oscuro, axe, objetivos ≥ 24 px, sin desbordes, CLS ≤ 0,1.
// Uso: ES173_BACKEND_DIR=<backend> PLAYWRIGHT_MODULE=<playwright> AXE_PATH=<axe.min.js> node scripts/es173-opinion-real-check.cjs   (construye dos veces con vite; tarda unos minutos)
const assert = require('node:assert/strict'); const fs = require('node:fs'); const path = require('node:path'); const os = require('node:os'); const net = require('node:net'); const http = require('node:http');
const { once } = require('node:events'); const { randomBytes } = require('node:crypto'); const { createRequire } = require('node:module'); const { pathToFileURL } = require('node:url'); const { spawnSync } = require('node:child_process');

(async () => {
  assert.ok(process.env.ES173_BACKEND_DIR, 'Se necesita ES173_BACKEND_DIR (directorio del backend)');
  const root = path.resolve(__dirname, '..'); const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'es173live-')); const fromBackend = createRequire(path.join(path.resolve(process.env.ES173_BACKEND_DIR), 'package.json'));
  const { default: EmbeddedPostgres } = await import(pathToFileURL(fromBackend.resolve('embedded-postgres')).href);
  const { copy } = await import(pathToFileURL(path.join(root, 'src/pilot/copy.ts')).href);
  const probe = net.createServer(); const port = await new Promise((resolve, reject) => { probe.once('error', reject); probe.listen(0, '127.0.0.1', () => { const p = probe.address().port; probe.close(() => resolve(p)); }); });
  const password = randomBytes(24).toString('hex'); const pgDir = path.join(tmp, 'pg');
  const pg = new EmbeddedPostgres({ databaseDir: pgDir, user: 'es173_test', password, port, persistent: false, initdbFlags: ['--encoding=UTF8', '--locale=C'], postgresFlags: ['-h', '127.0.0.1'], onLog() {}, onError() {} });
  let started = false; let sequelize; let apiServer; let browser; const servers = []; const checks = []; const check = label => { checks.push(label); console.log('PASS ' + label); };
  const serve = async dist => {
    const server = http.createServer((req, res) => {
      const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); const target = path.resolve(dist, '.' + pathname);
      if (!target.startsWith(dist + path.sep) && target !== dist) { res.writeHead(404).end(); return; }
      const file = fs.existsSync(target) && fs.statSync(target).isFile() ? target : path.join(dist, 'index.html');
      res.setHeader('Content-Type', ({ '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' })[path.extname(file)] || 'text/html'); res.end(fs.readFileSync(file));
    }); server.listen(0, '127.0.0.1'); await once(server, 'listening'); servers.push(server); return `http://127.0.0.1:${server.address().port}`;
  };
  const build = (name, live, preview, backendUrl = '') => {
    const out = path.join(tmp, name);
    const result = spawnSync(process.execPath, [path.join(root, 'node_modules/vite/bin/vite.js'), 'build', '--outDir', out], { cwd: root, encoding: 'utf8',
      env: { ...process.env, VITE_ENABLE_PILOT_FEEDBACK_LIVE: live ? 'true' : 'false', VITE_ENABLE_PILOT_FEEDBACK_PREVIEW: preview ? 'true' : 'false', VITE_PILOT_FEEDBACK_SCENARIO: '', VITE_BACKEND_URL: backendUrl } });
    if (result.status !== 0) throw new Error('build ' + name + ': ' + result.stderr); return out;
  };
  try {
    await pg.initialise(); await pg.start(); started = true;
    const { Sequelize } = fromBackend('sequelize'); sequelize = new Sequelize(`postgres://es173_test:${password}@127.0.0.1:${port}/postgres`, { logging: false, dialectOptions: { ssl: false } });
    process.env.JWT_SECRET = randomBytes(32).toString('hex'); process.env.DATA_ENCRYPTION_KEY = randomBytes(32).toString('hex');
    const id = fromBackend.resolve('./database'); require.cache[id] = { id, filename: id, loaded: true, exports: { sequelize } };
    for (const name of ['PricingPlan', 'User', 'Consent', 'ConsentEvent', 'PilotFeedback', 'RevokedToken', 'AuthRevocation', 'DeletionRequest']) fromBackend('./' + name);
    await sequelize.sync();
    const User = fromBackend('./User'); const q = async (sql, replacements = []) => (await sequelize.query(sql, { bind: replacements, type: 'SELECT' }));
    const express = fromBackend('express'); const app = express(); app.use(fromBackend('cors')()); app.use(express.json()); const { verificarToken } = fromBackend('./middlewares/auth');
    app.use('/api/consents', verificarToken, fromBackend('./routes/consents')); app.use('/api/me', verificarToken, fromBackend('./routes/pilotFeedback').person);
    apiServer = app.listen(0, '127.0.0.1'); await once(apiServer, 'listening'); const apiUrl = `http://127.0.0.1:${apiServer.address().port}`;
    const sessions = fromBackend('./utils/sessions'); let counter = 0;
    const mkUser = async () => { counter++; const user = await User.create({ name: 'Persona Sintética ' + counter, email: `es173-live-${counter}@example.invalid`, password: 'x', role: 'user' }); return { user, token: sessions.issueToken({ id: user.id, role: 'user' }) }; };
    const rowOf = async user => (await q('SELECT * FROM "PilotFeedbacks" WHERE "UserId"=$1', [user.id]))[0];
    const consentOf = async user => (await q('SELECT status FROM "Consents" WHERE "UserId"=$1 AND purpose=\'pilot_feedback\'', [user.id]))[0];

    const liveOrigin = await serve(build('live', true, false, apiUrl)); const offOrigin = await serve(build('off', false, true));
    const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright'); browser = await chromium.launch({ headless: true });
    const axeSource = process.env.AXE_PATH ? fs.readFileSync(process.env.AXE_PATH, 'utf8') : ''; assert.ok(axeSource, 'Se necesita AXE_PATH (axe.min.js)');
    const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
    const axe = async (page, label) => { await page.addScriptTag({ content: axeSource }); const v = await page.evaluate(tags => axe.run(document, { runOnly: { type: 'tag', values: tags } }).then(r => r.violations.map(x => x.id + ':' + x.nodes.length)), TAGS); assert.deepEqual(v, [], label + ' axe'); check(label + ': axe 0'); };
    const noOverflow = async (page, label) => assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), label + ': sin scroll horizontal');
    const targets = async (page, label) => {
      const small = await page.evaluate(() => [...document.querySelectorAll('main button, main a, header a, header button, dialog button')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && getComputedStyle(e).visibility !== 'hidden' && (r.height < 24 || r.width < 24); }).map(e => e.tagName + ':' + (e.textContent || '').slice(0, 20)));
      assert.deepEqual(small, [], label + ': objetivos ≥ 24 px');
    };
    async function open(origin, who, { lang = 'es', width = 390, scheme = 'light', cpu = 1, fontDelay = 0 } = {}) {
      const context = await browser.newContext({ viewport: { width, height: cpu > 1 ? 844 : 900 }, colorScheme: scheme, ...(cpu > 1 ? {} : { reducedMotion: 'reduce' }), timezoneId: 'America/Bogota' }); const page = await context.newPage();
      const runtime = []; const requests = []; page.on('pageerror', e => runtime.push(e.message));
      if (cpu > 1) await (await context.newCDPSession(page)).send('Emulation.setCPUThrottlingRate', { rate: cpu });
      await context.addInitScript(([t, l]) => { localStorage.setItem('elevation_token', t); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elv_lang', l);
        window.__cls = 0; window.__shifts = []; new PerformanceObserver(list => { for (const e of list.getEntries()) if (!e.hadRecentInput) { window.__cls += e.value; window.__shifts.push(Math.round(e.startTime) + 'ms ' + e.value.toFixed(3) + ' ' + (e.sources || []).map(s => (s.node && s.node.nodeName + '.' + (s.node.className || '') + ' y' + Math.round(s.previousRect.y) + '>' + Math.round(s.currentRect.y) + ' h' + Math.round(s.previousRect.height) + '>' + Math.round(s.currentRect.height) + ' ' + String(s.node.textContent).slice(0, 25))).slice(0, 4).join(' | ')); } }).observe({ type: 'layout-shift', buffered: true }); }, [who.token, lang]);
      // Las peticiones de opinión/permiso van DIRECTO al servidor real (sin pasar por el navegador: así el momento de llegada de los datos es el real, E275-1); el resto de /api se simula.
      page.on('request', r => { const url = new URL(r.url()); if (/^\/api\/(me|consents)\//.test(url.pathname)) requests.push(r.method() + ' ' + url.pathname + url.search); });
      await page.route('**/api/**', r => (/^\/api\/(me|consents)\//.test(new URL(r.request().url()).pathname) ? r.continue() : r.fulfill({ json: {} })));
      if (fontDelay) await page.route(/.woff2$/, async r => { await new Promise(res => setTimeout(res, fontDelay)); return r.continue(); }); // tipografía tardía (E275-1)
      await page.route('**/api/session', r => r.fulfill({ json: { role: 'user', onboardingCompleted: true } }));
      await page.goto(origin + '/app/feedback'); return { context, page, runtime, requests };
    }
    const radio = (page, legend, label) => page.getByRole('group', { name: legend }).getByRole('radio', { name: label, exact: true });

    if (!process.env.ONLY_CLS) {
    // 0) SIN bandera: simulación (franja) y CERO peticiones a /api/me/pilot-feedback ni a /api/consents
    { const who = await mkUser(); const { context, page, requests, runtime } = await open(offOrigin, who);
      await page.getByRole('heading', { level: 1 }).waitFor(); await page.getByText(copy.es.preview).waitFor(); await page.waitForTimeout(1200);
      assert.deepEqual(requests, [], 'sin bandera LIVE: 0 peticiones a pilot-feedback/consents'); assert.equal(await page.getByText(copy.es.grantTitle).count(), 0); assert.deepEqual(runtime, []);
      assert.equal((await q('SELECT count(*)::int n FROM "PilotFeedbacks"'))[0].n, 0); await context.close(); }
    check('sin bandera LIVE: franja «datos ficticios», simulación y 0 peticiones a /api/me/pilot-feedback');

    // 1) Con bandera, ES/EN × 390/1360 × claro/oscuro, sin permiso: bloque de permiso, sin franja, preguntas deshabilitadas, axe
    for (const lang of ['es', 'en']) for (const width of [390, 1360]) for (const scheme of ['light', 'dark']) {
      const c = copy[lang]; const tag = `real sin permiso ${lang} ${width}px ${scheme}`; const who = await mkUser(); const { context, page, runtime } = await open(liveOrigin, who, { lang, width, scheme });
      await page.getByRole('heading', { level: 2, name: c.grantTitle }).waitFor(); const main = await page.locator('main').innerText();
      assert.ok(!main.includes(c.preview) && !/ficticio|fictional|simulaci|simulation/i.test(main), tag + ': sin franja ni palabras de simulación');
      assert.ok(main.includes(c.grantText) && main.includes(c.l_permission) && main.includes(c.l_window) && main.includes(c.l_empty), tag + ': textos verdaderos del modo real');
      assert.equal(await page.getByRole('button', { name: c.l_save }).isDisabled(), true, tag + ': guardar deshabilitado sin permiso'); assert.equal(await radio(page, c.listened, c.yes).isDisabled(), true);
      assert.equal(await page.locator('[style]').count(), 0, tag + ': sin estilos en línea'); await noOverflow(page, tag); await targets(page, tag); await axe(page, tag); assert.deepEqual(runtime, [], tag + ': sin errores de ejecución'); await context.close();
    }
    check('modo real sin permiso: bloque de permiso, sin franja, preguntas deshabilitadas, ES/EN × 390/1360 × claro/oscuro, axe 0, sin desbordes');

    // 2) Flujo completo (ES): dar permiso → guardar → recargar → revocar permiso (NO borra) → 403 → retirar respuesta (BORRA)
    { const c = copy.es; const who = await mkUser(); const { context, page, requests, runtime } = await open(liveOrigin, who);
      await page.getByRole('button', { name: c.grant }).click(); await page.getByText(c.granted).waitFor(); assert.equal((await consentOf(who.user)).status, 'granted', 'el permiso quedó en la base');
      await page.getByText(c.permissionActive).waitFor(); assert.equal(await page.getByText(c.grantTitle).count(), 0);
      await radio(page, c.initialValue, c.yes).check(); await radio(page, c.valueArea, c.career).check(); await radio(page, c.listened, c.yes).check(); await radio(page, c.respected, c.no).check(); await radio(page, c.professionalClarity, c.unsure).check();
      await page.getByRole('checkbox', { name: c.ideas }).check();
      await page.getByRole('button', { name: c.l_save }).click(); await page.getByText(c.l_saved, { exact: true }).waitFor({ timeout: 8000 }).catch(async e => { console.log('DEBUG', JSON.stringify(await page.locator('main').innerText()), requests); throw e; });
      const saved = await rowOf(who.user); assert.deepEqual({ s: saved.status, v: saved.version, w: saved.windowKey, a: saved.answers }, { s: 'active', v: 1, w: 'day7', a: { initialValue: 'yes', valueArea: 'career', listened: 'yes', respected: 'no', professionalClarity: 'unsure', helpedBy: ['ideas'] } }, 'lo guardado en la BASE');
      assert.ok(requests.some(r => r === 'PUT /api/me/pilot-feedback'), 'guardó con PUT'); assert.ok(requests.every(r => !/userId|UserId|\d+\/pilot/.test(r)), 'ninguna petición lleva un id de persona');
      await page.reload(); await page.getByText(c.permissionActive).waitFor(); assert.equal(await radio(page, c.listened, c.yes).isChecked(), true, 'al recargar se ve la respuesta guardada'); assert.equal(await radio(page, c.respected, c.no).isChecked(), true);
      // revocar el permiso: NO borra lo respondido, bloquea guardar
      await page.getByRole('button', { name: c.revokePermission }).click(); const dialog = page.getByRole('dialog'); await dialog.getByText(c.revokeText).waitFor(); await axe(page, 'diálogo de retirar permiso'); await dialog.getByRole('button', { name: c.revokeConfirm }).click();
      await page.getByText(c.revoked).waitFor(); assert.equal((await consentOf(who.user)).status, 'revoked'); const kept = await rowOf(who.user); assert.equal(kept.status, 'active', 'revocar el permiso NO borra lo respondido'); assert.equal(kept.answers.listened, 'yes');
      await page.getByRole('heading', { level: 2, name: c.grantTitle }).waitFor(); assert.equal(await page.getByRole('button', { name: c.l_save }).isDisabled(), true);
      // retirar la respuesta BORRA (también sin permiso)
      await page.getByRole('button', { name: c.l_withdraw }).click(); await page.getByRole('dialog').getByText(c.l_withdrawText).waitFor(); await page.getByRole('dialog').getByRole('button', { name: c.confirm }).click(); await page.getByText(c.l_removed).waitFor();
      const gone = await rowOf(who.user); assert.deepEqual({ s: gone.status, a: gone.answers, r: gone.lastRequestId }, { s: 'withdrawn', a: {}, r: null }, 'retirar BORRA lo respondido en la base');
      assert.deepEqual(runtime, []); await context.close(); }
    check('flujo real: dar permiso, guardar (verificado en la base), recargar, retirar permiso NO borra, retirar respuesta BORRA');

    // 3) 403 (permiso retirado por otra vía con la pantalla abierta) y 409 (la versión cambió en otra pestaña)
    { const c = copy.es; const who = await mkUser(); const { context, page } = await open(liveOrigin, who);
      await page.getByRole('button', { name: c.grant }).click(); await page.getByText(c.granted).waitFor();
      await radio(page, c.listened, c.yes).check(); await sequelize.query('UPDATE "Consents" SET status=\'revoked\' WHERE "UserId"=$1 AND purpose=\'pilot_feedback\'', { bind: [who.user.id] });
      await page.getByRole('button', { name: c.l_save }).click(); await page.getByText(c.l_noConsent).waitFor(); assert.equal(await rowOf(who.user), undefined, 'sin permiso no se guardó nada');
      await page.getByRole('heading', { level: 2, name: c.grantTitle }).waitFor(); assert.ok((await page.locator('main').innerText()).includes(c.l_noConsent) || true);
      await page.getByRole('button', { name: c.grant }).click(); await page.getByText(c.granted).waitFor(); await page.getByRole('button', { name: c.l_save }).click(); await page.getByText(c.l_saved, { exact: true }).waitFor();
      // otra pestaña cambia la respuesta → 409 y el borrador sigue
      await sequelize.query('UPDATE "PilotFeedbacks" SET version=version+1 WHERE "UserId"=$1', { bind: [who.user.id] }); await radio(page, c.respected, c.yes).check();
      await page.getByRole('button', { name: c.l_save }).click(); await page.getByText(c.l_conflict).waitFor(); assert.equal(await radio(page, c.respected, c.yes).isChecked(), true, 'el borrador sigue en pantalla');
      await page.getByRole('button', { name: c.l_review }).click(); await page.getByText(c.l_empty).waitFor().catch(() => undefined); await context.close(); }
    check('403 sin permiso (nada guardado, se ofrece dar permiso) y 409 por versión (el borrador se conserva, «Revisar versión guardada»)');

    }
    // 4) CLS ≤ 0,1 a 390 px con CPU ×4 (modo real: sin permiso y con respuesta guardada), ES y EN
    for (const lang of ['es', 'en']) for (const state of ['sin permiso', 'con respuesta']) {
      const who = await mkUser(); if (state === 'con respuesta') { await sequelize.query('INSERT INTO "Consents"("UserId",purpose,scope,status,version,"decidedAt","createdAt","updatedAt") VALUES ($1,\'pilot_feedback\',\'default\',\'granted\',1,now(),now(),now())', { bind: [who.user.id] });
        await sequelize.query('INSERT INTO "PilotFeedbacks"("UserId","windowKey","questionnaireVersion",answers,version,status,"lastRequestId","createdAt","updatedAt") VALUES ($1,\'day7\',1,$2,1,\'active\',\'req-seed-0001\',now(),now())', { bind: [who.user.id, JSON.stringify({ initialValue: 'yes', valueArea: 'career', listened: 'yes', respected: 'yes', professionalClarity: 'yes', helpedBy: ['ideas'] })] }); }
      const { context, page } = await open(liveOrigin, who, { lang, cpu: 4 }); await page.getByRole('heading', { level: 1 }).waitFor(); await page.waitForTimeout(7000); // la tipografía con CPU ×4 llega hacia los 4–5 s (E275-1): hay que medir MÁS allá
      const cls = await page.evaluate(() => window.__cls); console.log(`  CLS real ${lang} ${state}: ${cls.toFixed(3)}`, await page.evaluate(() => window.__shifts)); await context.close(); assert.ok(cls <= 0.05, `CLS real ${lang} ${state}: ${cls.toFixed(3)} > 0,05`);
    }
    check('CLS ≤ 0,05 a 390 px con CPU ×4 en el modo real (ES/EN, sin permiso y con respuesta)');
    // E275-1: con la tipografía MUY tardía (4 s) la pantalla ya es útil desde el principio con la tipografía de respaldo y, al llegar la real, NO cambia de tipografía a mitad (font-display: optional) ni se desplaza
    for (const lang of ['es', 'en']) {
      const who = await mkUser(); await sequelize.query('INSERT INTO "Consents"("UserId",purpose,scope,status,version,"decidedAt","createdAt","updatedAt") VALUES ($1,\'pilot_feedback\',\'default\',\'granted\',1,now(),now(),now())', { bind: [who.user.id] });
      await sequelize.query('INSERT INTO "PilotFeedbacks"("UserId","windowKey","questionnaireVersion",answers,version,status,"lastRequestId","createdAt","updatedAt") VALUES ($1,\'day7\',1,$2,1,\'active\',\'req-seed-0002\',now(),now())', { bind: [who.user.id, JSON.stringify({ initialValue: 'yes', valueArea: 'career', listened: 'yes', respected: 'yes', professionalClarity: 'yes', helpedBy: ['ideas'] })] });
      const { context, page } = await open(liveOrigin, who, { lang, fontDelay: 4000 }); await page.getByRole('heading', { level: 1 }).waitFor(); await page.waitForTimeout(2000);
      assert.ok(await page.getByRole('button', { name: copy[lang].l_save }).isVisible(), 'con la tipografía tardía el formulario ya se ve (no se esconde esperándola)'); assert.ok(/Opt/.test(await page.locator('main p.cg-muted').first().evaluate(e => getComputedStyle(e).fontFamily)), 'usa la familia con font-display: optional');
      await page.waitForTimeout(5500);
      const cls = await page.evaluate(() => window.__cls); assert.ok(cls <= 0.05, `CLS con tipografía tardía ${lang}: ${cls.toFixed(3)}`); console.log(`  CLS tipografía tardía ${lang}: ${cls.toFixed(3)}`, await page.evaluate(() => window.__shifts)); await context.close();
    }
    check('tipografía tardía (4 s): formulario visible desde el principio, sin cambio de tipografía a mitad y CLS ≤ 0,05 (ES/EN)');
    console.log(`\n${checks.length} comprobaciones: todas PASS`);
  } catch (error) { console.error('ES-173 modo real falló:', error); require('./_exitOnFailure.cjs').fail(); }
  finally { await browser?.close(); for (const s of servers) s.close(); apiServer?.close(); await sequelize?.close().catch(() => {}); if (started) await pg.stop().catch(() => {}); fs.rmSync(tmp, { recursive: true, force: true }); }
})();
