// ES-300: el mapa REAL (Express + ruta real /api/skill-map + PostgreSQL embebido + catálogo publicado de 12 capacidades + autoevaluaciones guardadas con evidencia confirmada) y la aplicación React construida en Chromium,
// SIN simular ninguna API del mapa. Compara lo que dicen el Relieve, la Lista y el Radar con la BASE (SkillAssessment vigente): el MISMO nivel en las tres vistas, «Sin nivel» donde no hay fila vigente, una persona ajena
// no ve nada de la otra, y el radar/relieve no se solapan ni rompen axe 2.2 AA con datos reales. Datos sintéticos, base efímera en 127.0.0.1, sin IA ni producción.
// Uso:  (cd frontend && npx vite build && npx vite preview --host 127.0.0.1 --port 4310 --strictPort)
//       ES300_BACKEND_DIR=<backend> ES300_PREVIEW_URL=http://127.0.0.1:4310 PLAYWRIGHT_MODULE=<playwright> AXE_PATH=<axe.min.js> node scripts/es300-api-integration.cjs
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
  assert.ok(process.env.ES300_BACKEND_DIR, 'Se necesita el directorio del backend');
  const fromBackend = createRequire(path.join(path.resolve(process.env.ES300_BACKEND_DIR), 'package.json'));
  const { default: EmbeddedPostgres } = await import(pathToFileURL(fromBackend.resolve('embedded-postgres')).href);
  const parent = path.resolve(os.tmpdir()); const directory = fs.mkdtempSync(path.join(parent, 'es300-pg-'));
  assert.equal(path.dirname(path.resolve(directory)), parent); assert.ok(path.basename(directory).startsWith('es300-pg-'));
  const probe = net.createServer();
  const port = await new Promise((resolve, reject) => { probe.once('error', reject); probe.listen(0, '127.0.0.1', () => { const selected = probe.address().port; probe.close(() => resolve(selected)); }); });
  const password = randomBytes(24).toString('hex');
  const pg = new EmbeddedPostgres({ databaseDir: directory, user: 'es300_test', password, port, persistent: false, initdbFlags: ['--encoding=UTF8', '--locale=C'], postgresFlags: ['-h', '127.0.0.1'], onLog() {}, onError() {} });
  let started = false; let sequelize; let server; let browser; let ok = false; let count = 0; const check = (label) => { count += 1; console.log('PASS ' + label); };
  try {
    await pg.initialise(); await pg.start(); started = true;
    const { Sequelize } = fromBackend('sequelize');
    sequelize = new Sequelize(`postgres://es300_test:${password}@127.0.0.1:${port}/postgres`, { logging: false, dialectOptions: { ssl: false } });
    process.env.JWT_SECRET = randomBytes(32).toString('hex'); process.env.DATA_ENCRYPTION_KEY = randomBytes(32).toString('hex');
    const id = fromBackend.resolve('./database'); require.cache[id] = { id, filename: id, loaded: true, exports: { sequelize } };
    for (const name of ['PricingPlan', 'User', 'Consent', 'ConsentEvent', 'ChatTurn', 'DiaryEntry', 'DerivedInvalidation', 'CareerContextVersion', 'BridgeTransfer', 'RevokedToken', 'AuthRevocation', 'DeletionRequest', 'AiJob', 'SkillCandidate', 'ParticipantResume', 'Evidence', 'EvidenceVersion', 'SkillCatalog', 'SkillDefinition', 'SkillAssessment', 'AiBudgetCounter', 'AiUsage']) { try { fromBackend('./' + name); } catch { /* el modelo puede no existir */ } }
    await sequelize.sync();
    const User = fromBackend('./User'); const evidence = fromBackend('./utils/evidence'); const catalog = fromBackend('./utils/skillCatalog'); const { selfAssess } = fromBackend('./utils/skillMap'); const Assessment = fromBackend('./SkillAssessment');
    const levels = Object.fromEntries([1, 2, 3, 4].map((n) => [n, { es: `Criterio del nivel ${n}`, en: `Level ${n} criterion` }]));
    const TERR = ['dir', 'con', 'com', 'ing', 'inn'];
    const keys = Array.from({ length: 12 }, (_, i) => `cap_${String(i + 1).padStart(2, '0')}`);
    const draft = await catalog.createDraft();
    for (let i = 0; i < keys.length; i++) await catalog.upsertSkill(draft.id, keys[i], { type: i < 6 ? 'transversal' : 'domain', labels: { es: `Capacidad real ${i + 1}`, en: `Real skill ${i + 1}` }, territories: i % 7 === 6 ? [] : [TERR[i % 5]], rubric: { levels, source: 'Fuente sintética', verifiedBy: 'Revisor sintético', verifiedAt: '2026-10-01' } });
    await catalog.publish(draft.id, 1);
    const persona = await User.create({ name: 'Persona A', email: 'a@example.invalid', password: 'x', role: 'user' });
    const ajena = await User.create({ name: 'Persona C', email: 'c@example.invalid', password: 'x', role: 'user' });
    const evBody = (n) => ({ payload: { title: `Evidencia ${n}`, situation: 's', responsibility: { text: 'r' }, actions: [{ text: 'a' }], delivered: { text: 'd' }, observedEffect: { known: false }, autonomy: 'autonomous' }, status: 'confirmed', requestId: `es300-ev-${String(n).padStart(6, '0')}` });
    const ev = await evidence.create(persona.id, evBody(1)); const evC = await evidence.create(ajena.id, evBody(2));
    const planned = { cap_01: 3, cap_02: 4, cap_04: 1, cap_05: 2, cap_07: 4, cap_08: 3, cap_10: 2, cap_11: 1 }; // 8 con nivel, 4 sin nivel
    let seq = 0;
    for (const [skillKey, level] of Object.entries(planned)) await selfAssess(persona.id, { skillKey, level, evidenceRefs: [{ evidenceId: ev.id, version: 1 }], requestId: `es300-self-${String(++seq).padStart(6, '0')}` });
    await selfAssess(ajena.id, { skillKey: 'cap_03', level: 4, evidenceRefs: [{ evidenceId: evC.id, version: 1 }], requestId: 'es300-self-c-000001' });
    const dbLevels = async (userId) => Object.fromEntries((await Assessment.findAll({ where: { UserId: userId, track: 'self', status: 'current' } })).map((row) => [row.skillKey, row.level]));
    assert.deepEqual(await dbLevels(persona.id), planned, 'la base tiene lo sembrado'); assert.deepEqual(await dbLevels(ajena.id), { cap_03: 4 });

    const express = fromBackend('express'); const app = express(); app.use(express.json());
    app.use('/api/skill-map', fromBackend('./middlewares/auth').verificarToken, fromBackend('./routes/skillMap'));
    app.use('/api/session', fromBackend('./middlewares/auth').verificarToken, (req, res) => res.json({ role: 'user', onboardingCompleted: true }));
    app.use('/api/consents', fromBackend('./middlewares/auth').verificarToken, fromBackend('./routes/consents'));
    server = app.listen(0, '127.0.0.1'); await once(server, 'listening'); const apiUrl = `http://127.0.0.1:${server.address().port}`;
    const issue = fromBackend('./utils/sessions').issueToken;
    const tokenA = issue({ id: persona.id, role: 'user' }); const tokenC = issue({ id: ajena.id, role: 'user' });

    const { chromium } = process.env.PLAYWRIGHT_MODULE ? require(process.env.PLAYWRIGHT_MODULE) : await import('playwright');
    browser = await chromium.launch({ headless: true });
    const frontend = process.env.ES300_PREVIEW_URL || 'http://127.0.0.1:4310'; assert.ok(['127.0.0.1', 'localhost'].includes(new URL(frontend).hostname));
    const axeSource = fs.readFileSync(process.env.AXE_PATH, 'utf8');
    const axe = async (page) => { await page.evaluate(axeSource); return page.evaluate(async () => (await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] })).violations.map((v) => v.id + ':' + v.nodes.length)); };
    const overlapping = (page, selector) => page.evaluate((sel) => { const r = [...document.querySelectorAll(sel)].map((e) => e.getBoundingClientRect()).filter((x) => x.width > 0); let bad = 0; for (let i = 0; i < r.length; i++) for (let j = i + 1; j < r.length; j++) if (Math.min(r[i].right, r[j].right) - Math.max(r[i].left, r[j].left) > 0.5 && Math.min(r[i].bottom, r[j].bottom) - Math.max(r[i].top, r[j].top) > 0.5) bad++; return bad; }, selector);

    for (const [width, lang, scheme, token, expected] of [[1360, 'es', 'light', tokenA, planned], [390, 'en', 'dark', tokenA, planned], [1360, 'es', 'dark', tokenC, { cap_03: 4 }]]) {
      const tag = `${width}px ${lang} ${scheme} ${token === tokenA ? 'persona A' : 'persona C'}`;
      const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: scheme, reducedMotion: 'reduce' }); const page = await context.newPage(); const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.addInitScript(([t, l]) => { localStorage.setItem('elevation_token', t); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elv_lang', l); }, [token, lang]);
      await page.route('**/api/**', async (route) => { const url = new URL(route.request().url()); const response = await route.fetch({ url: apiUrl + url.pathname + url.search }); await route.fulfill({ response }); });
      await page.goto(frontend + '/app/skill-map', { waitUntil: 'networkidle' });
      await page.locator('.skill-map-place').first().waitFor({ timeout: 15000 }).catch(async () => { throw new Error('el mapa no cargó: ' + (await page.locator('main').innerText()).split('\n').join(' | ').slice(0, 400) + ' | ' + errors.join(' ; ')); });
      const label = (n) => (lang === 'es' ? `Capacidad real ${n}` : `Real skill ${n}`);
      const levelWord = (level) => (level === undefined ? (lang === 'es' ? 'Sin evidencia vigente' : 'No current evidence') : (lang === 'es' ? `Nivel ${level} de 4` : `Level ${level} of 4`));
      const radarWord = (level) => (level === undefined ? (lang === 'es' ? 'Sin nivel' : 'No level') : levelWord(level));
      // relieve
      for (let i = 1; i <= 12; i++) {
        const key = `cap_${String(i).padStart(2, '0')}`;
        assert.equal(await page.locator('.skill-map-place').nth(0).evaluate((_, [name]) => [...document.querySelectorAll('.skill-map-place')].find((el) => el.getAttribute('aria-label').startsWith(name + ':')).getAttribute('aria-label'), [label(i)]), `${label(i)}: ${levelWord(expected[key])}`, `relieve ${key} (${tag})`);
      }
      assert.equal(await overlapping(page, '.skill-map-place'), 0, `relieve sin solapes con datos reales (${tag})`);
      assert.deepEqual(await axe(page), [], `axe relieve real (${tag})`);
      // lista
      await page.locator('.skill-map-views').getByRole('button', { name: lang === 'es' ? 'Lista' : 'List', exact: true }).click();
      for (const [key, level] of Object.entries(expected)) {
        const n = Number(key.slice(4)); const text = await page.locator('.skill-map-pick').evaluateAll((els, name) => els.filter((el) => el.querySelector('.skill-map-pick-name').textContent === name).map((el) => el.textContent), label(n));
        assert.ok(text.length >= 1 && text.every((value) => value.includes(levelWord(level))), `lista ${key}: ${levelWord(level)} (${tag}): ${text[0]}`);
      }
      assert.deepEqual(await axe(page), [], `axe lista real (${tag})`);
      // radar
      await page.locator('.skill-map-views').getByRole('button', { name: 'Radar', exact: true }).click(); await page.locator('.radar-poly').waitFor();
      assert.equal(await page.locator('.radar-axis').count(), 12, `radar: 12 ejes = las 12 capacidades del catálogo publicado (${tag})`);
      for (let i = 1; i <= 12; i++) { const key = `cap_${String(i).padStart(2, '0')}`; assert.equal(await page.locator('.radar-axis').nth(i - 1).getAttribute('aria-label'), `${label(i)}: ${radarWord(expected[key])}`, `radar ${key} (${tag})`); }
      assert.equal(await page.locator('.radar-poly svg circle').count(), Object.keys(expected).length, `radar: un punto por fila vigente de la base (${tag})`);
      assert.equal(await overlapping(page, '.radar-axis'), 0, `radar sin solapes (${tag})`);
      assert.deepEqual(await axe(page), [], `axe radar real (${tag})`);
      assert.deepEqual(errors, [], 'errores de página');
      await context.close();
      check(`mapa real (${tag}): relieve, lista y radar dicen LO MISMO que la base (${Object.keys(expected).length} con nivel, el resto sin nivel), sin solapes, axe 2.2 AA 0`);
    }
    ok = true;
  } finally {
    if (browser) await browser.close().catch(() => undefined);
    if (server) server.close(); if (sequelize) await sequelize.close().catch(() => undefined);
    if (started) await pg.stop().catch(() => undefined);
    try { fs.rmSync(directory, { recursive: true, force: true }); } catch { /* Windows puede retener el directorio un instante */ }
  }
  if (ok) console.log(`\nES-300 (servidor real): ${count} comprobaciones OK`);
  process.exit(ok ? 0 : 1);
})().catch((error) => { console.error('FAIL', error.message); process.exit(1); });
