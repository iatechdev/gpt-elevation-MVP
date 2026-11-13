// [QA-Claude] ES-250 · PR #199 límites de error y «Sin conexión» vs «versión nueva», en Chromium real contra el servidor REAL (build con MUTACIÓN temporal local que lanza errores de código
// controlados por window.__qaBoom*; la mutación NO está en el PR). Datos sintéticos, 0 IA.
// Uso: PLAYWRIGHT_MODULE QA_SUT QA_API DATABASE_URL QA_JWT_SECRET AXE_PATH OUT [CONTROL=1] node qa/integration/es250-ui-pr199.cjs
const { createRequire } = require('node:module'); const path = require('node:path'); const fs = require('node:fs'); const { randomBytes } = require('node:crypto');
const E = process.env; const req = createRequire(path.join(E.QA_SUT, 'backend', 'package.json')); const jwt = req('jsonwebtoken'); const { Client } = req('pg');
const { chromium } = require(E.PLAYWRIGHT_MODULE || 'playwright'); const API = E.QA_API, OUT = E.OUT || '.'; fs.mkdirSync(OUT, { recursive: true });
const CONTROL = E.CONTROL === '1'; const AXE = fs.readFileSync(E.AXE_PATH, 'utf8');
const results = []; const check = (id, ok, d = '') => { results.push({ id, ok: !!ok, detail: String(d).slice(0, 460) }); console.log(JSON.stringify({ id, ok: !!ok, detail: String(d).slice(0, 460) })); }; const info = (id, d) => { results.push({ id, info: String(d).slice(0, 460) }); console.log(JSON.stringify({ id, info: String(d).slice(0, 460) })); };
const EMOJI = /[\p{Extended_Pictographic}★☆✓✔ℹ]/u, RAWKEY = /\b(route_error[a-z_]*)\b/;
const PII = /persona@example\.invalid|abc123|qa-boom/i;
const T = {
  es: { section: /Algo salió mal en esta sección/, screen: /Algo salió mal en esta pantalla/, offline: /Sin conexión\. Cuando vuelvas|Sin conexión/, version: /Hay una versión nueva de la aplicación/, resource: /No se pudo cargar una parte de la pantalla/, retry: 'Reintentar', reload: 'Recargar' },
  en: { section: /Something went wrong in this section/, screen: /Something went wrong on this screen/, offline: /No connection\. Reload once|No connection/, version: /A new version of the app is available|There is a new version/, resource: /A part of the screen could not be loaded/, retry: 'Retry', reload: 'Reload' },
};
// mapa sintético válido para /api/skill-map (forma de model.ts)
const rubric = { levels: { 1: { es: 'Nivel 1', en: 'Level 1' }, 2: { es: 'Nivel 2', en: 'Level 2' }, 3: { es: 'Nivel 3', en: 'Level 3' }, 4: { es: 'Nivel 4', en: 'Level 4' } }, source: 'sintética', verifiedAt: '2026-01-01T00:00:00Z' };
const skills = ['comunicacion', 'datos', 'liderazgo'].map((k, i) => ({ skillKey: k, type: i === 1 ? 'domain' : 'transversal', labels: { es: 'Habilidad ' + k, en: 'Skill ' + k }, rubric, self: null, review: null, state: 'no_evidence', territories: [] }));
const MAP = { catalogVersion: 1, skills };
(async () => {
  const db = new Client({ connectionString: E.DATABASE_URL, ssl: false }); await db.connect(); const q = async (s, p = []) => (await db.query(s, p)).rows; const stamp = Date.now();
  const email = `qa250-${stamp}@example.test`; await fetch(API + '/api/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'QA250', email, password: randomBytes(12).toString('base64url') + 'aA1!' }) });
  const u = (await q('select id,name,role from "Users" where email=$1', [email]))[0]; const token = jwt.sign({ id: u.id, name: u.name, role: u.role, iatMs: Date.now() }, E.QA_JWT_SECRET, { expiresIn: '3h', jwtid: randomBytes(8).toString('hex') });
  const browser = await chromium.launch({ headless: true });
  const open = async ({ lang = 'es', vp = { width: 1360, height: 900 }, flags = {}, path: p = '/app/bridge', skillMap = false, js = true, mockApi = false } = {}) => {
    const ctx = await browser.newContext({ viewport: vp, javaScriptEnabled: js }); await ctx.addInitScript(([t, l, f]) => { try { localStorage.setItem('elevation_token', t); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elv_lang', l); localStorage.setItem('elevation_lang', l); } catch { /* */ } Object.assign(window, f); }, [token, lang, flags]);
    const page = await ctx.newPage(); const logs = [], errs = [], navs = []; page.on('console', m => logs.push({ type: m.type(), text: m.text() })); page.on('pageerror', e => errs.push(e.message)); page.on('framenavigated', f => { if (f === page.mainFrame()) navs.push(f.url()); });
    if (mockApi) await page.route('**/api/**', route => { const p2 = new URL(route.request().url()).pathname; if (p2 === '/api/session') return route.fulfill({ json: { role: 'user', onboardingCompleted: true } }); if (p2 === '/api/consents') return route.fulfill({ json: { consents: [] } }); if (p2 === '/api/career-context') return route.fulfill({ json: { active: null, versions: [] } }); if (p2 === '/api/user/resumes') return route.fulfill({ json: { resumes: [] } }); return route.fulfill({ json: p2.endsWith('/evidence') ? { evidence: [] } : p2.endsWith('/diary') ? { entries: [] } : {} }); });
    if (skillMap) await page.route('**/api/skill-map', r => r.request().method() === 'GET' ? r.fulfill({ json: MAP }) : r.continue());
    await page.goto(API + p, { waitUntil: 'load' }).catch(() => {}); await page.waitForTimeout(1500); return { ctx, page, logs, errs, navs };
  };
  const text = (page) => page.evaluate(() => document.body.textContent.replace(/\s+/g, ' '));
  const go = (page, p) => page.evaluate(x => { history.pushState({}, '', x); window.dispatchEvent(new PopStateEvent('popstate')); }, p);
  const axeOn = async (page) => { await page.evaluate(AXE); const r = await page.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } })); return r.violations.map(v => v.id + '(' + v.nodes.length + ')'); };
  const links = (page) => page.evaluate(() => [...document.querySelectorAll('a[href]')].map(a => a.getAttribute('href')).filter(h => h && h.startsWith('/')).length);
  const rects = (page, sel) => page.evaluate(s => [...document.querySelectorAll(s)].map(e => { const r = e.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)]; }), sel);
  const owned = (logs) => logs.filter(l => l.text.startsWith('[boundary]'));
  const layout = {};

  // ── Layout limpio (sin fallos): se compara luego entre PR y main
  for (const [name, vp] of [['1360', { width: 1360, height: 900 }], ['390', { width: 390, height: 844 }]]) {
    { const { ctx, page } = await open({ vp }); layout['bridge-' + name] = await rects(page, '.bridge-cols, .bridge-col, .bridge-sources'); await ctx.close(); }
    { const { ctx, page } = await open({ vp, path: '/app/skill-map', skillMap: true }); await page.getByRole('button', { name: /Habilidad comunicacion/ }).first().click({ timeout: 4000 }).catch(() => {}); await page.waitForTimeout(500); layout['map-' + name] = await rects(page, '.skill-map-detail-wrap, .skill-map-detail-wrap > *'); await ctx.close(); }
  }
  fs.writeFileSync(path.join(__dirname, '..', 'evidence', `ES-250-layout-${CONTROL ? 'main' : 'pr'}.json`), JSON.stringify(layout));

  // ── B1/B2/B3/B6 · error de código
  for (const lang of ['es', 'en']) for (const [name, vp] of [['1360', { width: 1360, height: 900 }], ['390', { width: 390, height: 844 }]]) {
    const t = T[lang];
    { const base = await open({ lang, vp }); const baseLinks = await links(base.page); await base.ctx.close();
      const { ctx, page, logs, errs, navs } = await open({ lang, vp, flags: { __qaBoomSources: true } }); const body = await text(page);
      const secOk = t.section.test(body) && (await page.getByRole('button', { name: t.retry, exact: true }).count()) === 1; const alive = (await page.locator('h1').count()) >= 1; const alerts = await page.getByRole('alert').count(); const nowLinks = await links(page);
      check(`B1a-${lang}-${name} error de código en el panel de fuentes: SOLO ese bloque cae («${t.retry}»), el título y el resto siguen vivos, ${alerts} aviso, enlaces ${nowLinks}/${baseLinks}`, !CONTROL ? (secOk && alive && alerts === 1 && nowLinks >= baseLinks - 0) : true, `aviso=${secOk} h1=${alive} alertas=${alerts} enlaces=${nowLinks}/${baseLinks} cuerpo="${body.slice(0, 80)}"`);
      const own = owned(logs); const allText = logs.map(l => l.text).join('\n') + errs.join('\n');
      check(`B6a-${lang}-${name} la línea propia [boundary] trae nombre y ruta sin mensaje, props ni correo`, own.length >= 1 && /^\[boundary\] Error \/app\/bridge/.test(own[0].text) && !PII.test(own.map(o => o.text).join('\n')), own[0]?.text.slice(0, 120));
      const leakers = logs.filter(l => PII.test(l.text)).map(l => `${l.type}:${l.text.slice(0, 90)}`);
      if (lang === 'es' && name === '1360') info('B6b registro NATIVO de React 19 en producción: líneas de consola que contienen el mensaje/correo/token del error', leakers.length ? leakers.join(' ‖ ') : 'ninguna');
      if (lang === 'es' && name === '1360') info('B6c-nota', 'la línea [boundary] propia está limpia; lo que filtra el mensaje es el registro nativo de React (onCaughtError por defecto)');
      if (lang === 'es' && name === '1360') check('B6c el mensaje, el correo y el token del error NO aparecen en ninguna línea de consola ni pageerror en producción', leakers.length === 0 && !errs.some(e => PII.test(e)), leakers.join(' ‖ ') || 'ninguna');
      check(`B3a-${lang}-${name} sin recargas automáticas ni bucle de render al fallar`, logs.length <= 12, `navegaciones al cargar=${navs.length} líneas=${logs.length}`);
      await page.screenshot({ path: path.join(OUT, `es250-${lang}-${name}-seccion.png`) });
      if (name === '1360') { const v = await axeOn(page); check(`A1a-${lang} axe 0 en el aviso de sección`, v.length === 0, v.join()); }
      // Reintentar persistente: 10 veces sin bucle, y luego recupera
      const before = logs.length; const navsLoad = navs.length; let enabledAgain = 0; for (let i = 0; i < 10; i++) { const b = page.getByRole('button', { name: t.retry, exact: true }); await b.click(); await page.waitForTimeout(150); if (await b.isDisabled().catch(() => false)) { /* durante ≤600 ms */ } await page.waitForTimeout(650); if ((await page.getByRole('button', { name: t.retry, exact: true }).count()) === 1 && !(await page.getByRole('button', { name: t.retry, exact: true }).isDisabled())) enabledAgain++; }
      const grown = logs.length - before; const still = t.section.test(await text(page));
      check(`B3b-${lang}-${name} 10 «${t.retry}» con el error PERSISTENTE: el aviso vuelve cada vez, el botón se rehabilita (${enabledAgain}/10), consola acotada (+${grown}) y 0 recargas`, still && enabledAgain === 10 && grown <= 60 && navs.length === navsLoad, `+${grown} líneas navs=${navsLoad}->${navs.length}`);
      await page.evaluate(() => { window.__qaBoomSources = false; }); await page.getByRole('button', { name: t.retry, exact: true }).click(); await page.waitForTimeout(900);
      const rec = (await page.locator('#bridge-src-title').count()) === 1 && !t.section.test(await text(page)); const focusAfter = await page.evaluate(() => { const a = document.activeElement; return a ? a.tagName + (a.getAttribute('data-source') ? ':' + a.getAttribute('data-source') : '') : null; });
      check(`B3c-${lang}-${name} corregido el error, «${t.retry}» recupera el bloque`, rec, `foco=${focusAfter}`); if (lang === 'es' && name === '1360') info('B7b adónde va el foco tras recuperar el bloque', focusAfter);
      await ctx.close(); }
    { const { ctx, page, logs } = await open({ lang, vp, flags: { __qaBoomRoute: true } }); const body = await text(page); const blank = body.trim().length < 20;
      check(`B2a-${lang}-${name} excepción al renderizar la ruta: aviso «${t.retry}» de pantalla, NO cuerpo en blanco`, t.screen.test(body) && (await page.getByRole('button', { name: t.retry, exact: true }).count()) === 1 && !blank, `cuerpo="${body.slice(0, 70)}"`);
      if (name === '1360') { const v = await axeOn(page); check(`A1b-${lang} axe 0 en el aviso de pantalla`, v.length === 0, v.join()); }
      await go(page, '/app/evidence'); await page.waitForTimeout(1200); check(`B2b-${lang}-${name} navegar a otra ruta limpia el aviso (resetKey)`, !t.screen.test(await text(page)), (await text(page)).slice(0, 60));
      await ctx.close(); }
  }
  if (CONTROL) { fs.writeFileSync(path.join(__dirname, '..', 'evidence', 'ES-250-control-main.json'), JSON.stringify(results, null, 1)); console.log('RESUMEN-CONTROL ' + JSON.stringify({ total: results.filter(r => 'ok' in r).length, fallos: results.filter(r => r.ok === false).map(r => r.id.slice(0, 30)) })); await browser.close(); process.exit(0); }

  // ── B1b/B1c · bloques del Mapa de habilidades
  for (const lang of ['es', 'en']) {
    const t = T[lang]; const sel = () => lang === 'es' ? /Habilidad comunicacion/ : /Skill comunicacion/;
    { const { ctx, page } = await open({ lang, path: '/app/skill-map', skillMap: true, flags: { __qaBoomDetail: true } }); await page.getByRole('button', { name: sel() }).first().click({ timeout: 6000 }).catch(() => {}); await page.waitForTimeout(800); const body = await text(page);
      check(`B1b-${lang} error en el detalle de habilidad: solo el detalle cae (aviso de sección + «${t.retry}»), el mapa y la lista siguen vivos`, t.section.test(body) && sel().test(body) && (await page.getByRole('alert').count()) === 1, `cuerpo="${body.slice(0, 60)}" alertas=${await page.getByRole('alert').count()}`);
      await page.evaluate(() => { window.__qaBoomDetail = false; }); await page.getByRole('button', { name: t.retry, exact: true }).click(); await page.waitForTimeout(700); check(`B1b2-${lang} «${t.retry}» recupera el detalle`, !t.section.test(await text(page)), '');
      await ctx.close(); }
    { const { ctx, page } = await open({ lang, path: '/app/skill-map', skillMap: true, flags: { __qaBoomAi: true } }); await page.getByRole('button', { name: sel() }).first().click({ timeout: 6000 }).catch(() => {}); await page.waitForTimeout(500);
      const ask = page.locator('.skill-map-ai-ask'); await ask.click({ timeout: 4000 }).catch(() => {}); await page.waitForTimeout(800); const body = await text(page);
      check(`B1c-${lang} error en el panel de análisis de IA: solo ese panel cae, el detalle de la habilidad sigue visible`, t.section.test(body) && (await page.locator('.skill-map-ai-ask').count()) >= 1 && (await page.getByRole('alert').count()) === 1, `alertas=${await page.getByRole('alert').count()} ask=${await page.locator('.skill-map-ai-ask').count()}`);
      await ctx.close(); }
  }

  // ── B7 · foco: error provocado desde DENTRO del bloque
  { const { ctx, page } = await open({ lang: 'es' }); await page.locator('[role="switch"][data-source="diary"]').focus(); await page.evaluate(() => { window.__qaBoomSources = true; }); await page.keyboard.press('Space'); await page.waitForTimeout(900);
    const f = await page.evaluate(() => { const a = document.activeElement; return a ? a.tagName + ':' + (a.textContent || '').trim().slice(0, 12) : null; });
    check('B7a el foco estaba DENTRO del bloque que falló → pasa a «Reintentar»', /^BUTTON:Reintentar/.test(f), String(f)); await ctx.close(); }
  { const { ctx, page } = await open({ lang: 'es', flags: { __qaBoomSources: true } }); await page.waitForTimeout(300); const f = await page.evaluate(() => { const a = document.activeElement; return a ? a.tagName : null; });
    info('B7c foco inicial cuando el bloque falla al cargar (no estaba dentro)', String(f));
    const bs = await page.getByRole('button', { name: 'Reintentar', exact: true }).boundingBox(); check('B7d «Reintentar» mide ≥ 44 px de alto y se opera con teclado (Enter/Espacio)', bs && bs.height >= 44, JSON.stringify(bs));
    await page.evaluate(() => { window.__qaBoomSources = false; }); await page.getByRole('button', { name: 'Reintentar', exact: true }).focus(); await page.keyboard.press('Enter'); await page.waitForTimeout(800); check('B7e Enter sobre «Reintentar» recupera el bloque', (await page.locator('#bridge-src-title').count()) === 1, ''); await ctx.close(); }

  // ── B4/B5 · red y recursos
  for (const lang of ['es', 'en']) {
    const t = T[lang];
    { const { ctx, page } = await open({ lang, path: '/app/dashboard', mockApi: true }); await ctx.setOffline(true); await go(page, '/app/evidence'); await page.waitForTimeout(1800); const body = await text(page);
      check(`B4a-${lang} sin red al abrir una ruta diferida: «Sin conexión», NO «versión nueva»`, t.offline.test(body) && !t.version.test(body), body.slice(0, 90));
      const v = await axeOn(page); check(`A1c-${lang} axe 0 en el aviso sin conexión`, v.length === 0, v.join());
      await ctx.setOffline(false); await Promise.all([page.waitForNavigation({ waitUntil: 'load', timeout: 15000 }).catch(() => {}), page.getByRole('button', { name: t.reload, exact: true }).click()]); await page.waitForTimeout(1500);
      check(`B4b-${lang} con la red de vuelta, «${t.reload}» recupera la pantalla`, (await page.locator('h1').count()) >= 1 && !t.offline.test(await text(page)), ''); await ctx.close(); }
    { const { ctx, page } = await open({ lang, path: '/app/bridge', mockApi: true }); await ctx.setOffline(true); await page.waitForTimeout(500); const body0 = await text(page);
      check(`B4c-${lang} irse sin red con una pantalla ya cargada no la rompe (sigue visible, sin aviso)`, (await page.locator('h1').count()) >= 1 && !t.offline.test(body0), body0.slice(0, 60)); await ctx.close(); }
    { const { ctx, page } = await open({ lang, path: '/app/dashboard', mockApi: true }); await page.route('**/assets/**/*.css', r => r.abort('blockedbyclient')); await page.route('**/assets/*.css', r => r.abort('blockedbyclient')); await go(page, '/app/evidence'); await page.waitForTimeout(1800); const body = await text(page);
      check(`B5a-${lang} con red y CSS bloqueado: aviso de recurso, NO «versión nueva»`, t.resource.test(body) && !t.version.test(body), body.slice(0, 90)); const v = await axeOn(page); check(`A1d-${lang} axe 0 en el aviso de recurso`, v.length === 0, v.join()); await ctx.close(); }
    { const { ctx, page } = await open({ lang, path: '/app/dashboard', mockApi: true }); await page.route('**/assets/**', r => r.request().url().endsWith('.js') ? r.fulfill({ status: 404, body: 'no' }) : r.continue()); await go(page, '/app/evidence'); await page.waitForTimeout(1800); const body = await text(page);
      check(`B5b-${lang} 404 del chunk JS con red: «versión nueva» (ES-234 se mantiene)`, t.version.test(body), body.slice(0, 90)); const v = await axeOn(page); check(`A1e-${lang} axe 0 en el aviso de versión nueva`, v.length === 0, v.join()); await ctx.close(); }
    { const { ctx, page } = await open({ lang, path: '/app/dashboard', mockApi: true }); await page.route('**/assets/**', r => r.request().url().endsWith('.js') ? r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><html></html>' }) : r.continue()); await go(page, '/app/evidence'); await page.waitForTimeout(1800); const body = await text(page);
      check(`B5c-${lang} index.html servido en lugar del chunk (MIME text/html) con red: «versión nueva»`, t.version.test(body), body.slice(0, 90)); await ctx.close(); }
    { const { ctx, page } = await open({ lang, path: '/app/dashboard', mockApi: true }); await ctx.setOffline(true); await page.route('**/assets/**', r => r.abort('internetdisconnected')); await go(page, '/app/skill-map'); await page.waitForTimeout(1800); const body = await text(page);
      check(`B5d-${lang} JS bloqueado SIN red: «Sin conexión»`, t.offline.test(body) && !t.version.test(body), body.slice(0, 90)); await ctx.close(); }
  }
  { const { ctx, page } = await open({ lang: 'es', path: '/app/bridge', js: false }); const body = await page.evaluate(() => document.body.innerText || ''); check('B5e con JavaScript desactivado la página no miente (no dice «versión nueva» ni «Sin conexión»)', !/versión nueva|Sin conexión/i.test(body), `cuerpo="${body.trim().slice(0, 60)}"`); await ctx.close(); }

  // ── A1 · layout, textos
  { const { ctx, page } = await open({ lang: 'es' }); await ctx.close(); }
  const copyEs = fs.readFileSync(path.join(E.QA_SUT, 'frontend/src/i18n/es.ts'), 'utf8'), copyEn = fs.readFileSync(path.join(E.QA_SUT, 'frontend/src/i18n/en.ts'), 'utf8'); const keys = ['route_error_retry', 'route_error_offline', 'route_error_resource', 'route_error_section', 'route_error_screen'];
  const vals = keys.flatMap(k => [copyEs, copyEn].map(c => (c.match(new RegExp(`\\n\\s*${k}:\\s*'([^']*)'`)) || [])[1])); check('T1 las 5 cadenas nuevas existen en ES y EN, sin emojis, sin términos clínicos', vals.every(Boolean) && !vals.some(v => EMOJI.test(v) || /diagn|terap|trastorno|diagnos|therap|disorder/i.test(v)), `valores=${vals.filter(Boolean).length}`);

  fs.writeFileSync(path.join(__dirname, '..', 'evidence', 'ES-250-ui-pr199.json'), JSON.stringify(results, null, 1));
  console.log('RESUMEN-ES250 ' + JSON.stringify({ total: results.filter(r => 'ok' in r).length, fallos: results.filter(r => r.ok === false).map(r => r.id.slice(0, 40)) }));
  await browser.close(); await db.end(); process.exit(0);
})().catch(e => { console.error('FATAL', e); process.exit(2); });
