// [QA-Claude] ES-33 / ES-34 · QA-33-02 · PR #132 (head c82abdf2): interfaz de la vista preliminar (aviso con razones, rebase, borradores «de la versión anterior»).
// Chromium sobre dos builds estáticos del merge local: qa13/lot-career132 (escenario normal) y qa13/lot-career132e (escenario «evidence»: tres razones). Datos sintéticos, 0 IA.
// Uso: node qa/integration/es33-ui132.cjs   (textos leídos de frontend/src/career/copy.ts; capturas en la carpeta de evidencia, fuera del repo)
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('C:/Users/Usuario/tools/playwright/node_modules/playwright');
const Q = 'C:/Users/Usuario/Documents/qa13', COPY = fs.readFileSync('C:/Users/Usuario/Documents/qa-pr-test/frontend/src/career/copy.ts', 'utf8');
const SHOTS = 'C:/Users/Usuario/Documents/qa-e2e-evidencia/ES-33-pr132-ui'; fs.mkdirSync(SHOTS, { recursive: true });
const tr = (key, lang) => { const m = COPY.match(new RegExp(key + ": \\['((?:[^'\\\\]|\\\\.)*)', '((?:[^'\\\\]|\\\\.)*)'\\]")); if (!m) throw new Error('sin texto ' + key); return (lang === 'es' ? m[1] : m[2]).replace(/\\'/g, "'"); };
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const serve = dist => new Promise(r => { const s = http.createServer((q, res) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p.startsWith('/api/')) { res.statusCode = 503; return res.end('{}'); } let f = path.join(dist, p); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(dist, 'index.html'); res.setHeader('content-type', MIME[path.extname(f)] || 'application/octet-stream'); fs.createReadStream(f).pipe(res); }); s.listen(0, '127.0.0.1', () => r({ s, base: 'http://127.0.0.1:' + s.address().port })); });
const out = []; const check = (id, ok, d = '') => { out.push({ id, ok: !!ok, detail: String(d).slice(0, 400) }); console.log(JSON.stringify({ id, ok: !!ok, detail: String(d).slice(0, 300) })); };
const lum = c => { const [r, g, b] = c.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const SAMPLE = '<img src=x onerror="window.__xss=1"> Mi muestra propia de QA';
async function toReview(page, base, lang) {
  const T = k => tr(k, lang), B = (n, o = {}) => page.getByRole('button', { name: n, ...o }), L = n => page.getByLabel(n, { exact: true });
  await page.goto(base + '/app/next-step', { waitUntil: 'load' }); await page.waitForTimeout(1000);
  await page.getByLabel('Colombia').check(); await B(T('saveConstraints')).click(); await B(T('choose')).first().click(); await B(T('acceptExperiment')).first().click();
  await B(T('start'), { exact: true }).click(); await page.getByLabel(T('sample')).fill(SAMPLE); await page.getByLabel(T('help')).selectOption({ label: T('none') }); await B(T('saveSubmission')).click();
  await page.getByLabel(T('observation')).fill('obs QA'); await page.getByLabel(T('interpretation')).fill('interp QA'); await B(T('saveReflection')).click();
  await L(T('decision')).selectOption({ label: T('continue') }); await page.getByLabel(T('reason')).fill('razón QA'); await B(T('saveDecision')).click(); await page.waitForTimeout(400);
  await page.getByRole('link', { name: T('options') === '' ? 'x' : /Rutas|Routes/ }).click(); await page.waitForTimeout(400); await page.getByLabel('Colombia').uncheck(); await page.getByLabel('Colombia').check(); await page.locator('select').first().selectOption({ index: 2 }); await B(T('saveConstraints')).click();
  await page.getByRole('link', { name: /Experimentos|Experiments/ }).click(); await page.waitForTimeout(900); try { await B(T('open')).first().click({ timeout: 15000 }); } catch (e) { console.log(JSON.stringify({ info: 'no hay botón Abrir', ruta: new URL(page.url()).pathname, texto: (await page.evaluate(() => document.body.innerText)).replace(/s+/g, ' ').slice(0, 500) })); throw e; } await page.waitForTimeout(500);
}
(async () => {
  const b = await chromium.launch(); const servers = { normal: await serve(Q + '/lot-career132'), evidence: await serve(Q + '/lot-career132e') };
  for (const lang of ['es', 'en']) {
    const T = k => tr(k, lang);
    for (const scen of ['normal', 'evidence']) {
      const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); await ctx.addInitScript(l => { try { localStorage.setItem('elv_lang', l); localStorage.setItem('elevation_token', 'x.y.z'); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elevation_name', 'QA'); } catch { /* */ } }, lang);
      const page = await ctx.newPage(); const errs = []; let dialogs = 0; page.on('pageerror', e => errs.push(String(e).slice(0, 100))); page.on('dialog', d => { dialogs++; d.dismiss(); });
      await toReview(page, servers[scen].base, lang); const tag = `${lang}-${scen}`;
      const banner = await page.locator('div', { hasText: T('basisTitle') }).filter({ has: page.getByRole('heading', { name: T('basisTitle') }) }).last();
      const btxt = await page.evaluate(() => document.body.innerText); const role = await page.locator('[role=status]').filter({ hasText: T('basisTitle') }).count();
      const expected = scen === 'evidence' ? ['reasonRules', 'reasonRouteEvidence', 'reasonCitedEvidence'] : ['reasonRules'];
      check(`U1 ${tag} aviso «${T('basisTitle')}» con las razones (${expected.length}) y «qué se conserva»; role=status`, btxt.includes(T('basisTitle')) && expected.every(k => btxt.includes(T(k))) && btxt.includes(T('basisKeep').slice(0, 40)) && role >= 1, `razones visibles=${expected.filter(k => btxt.includes(T(k))).length}/${expected.length} status=${role}`);
      await page.screenshot({ path: `${SHOTS}/${tag}-aviso.png`, fullPage: true });
      await page.getByRole('button', { name: T('rebase') }).click(); await page.waitForTimeout(500);
      const focused = await page.evaluate(() => (document.activeElement?.textContent || document.activeElement?.tagName || '').trim().slice(0, 60));
      const body2 = await page.evaluate(() => document.body.innerText); const useBtns = page.getByRole('button', { name: T('useDraft'), exact: true }), dscBtns = page.getByRole('button', { name: T('discardDraft'), exact: true });
      check(`U2 ${tag} tras el rebase: sección «${T('carriedTitle')}» con tres borradores (usar/descartar), aviso de no vigente y la muestra visible como texto`, body2.includes(T('carriedTitle')) && await useBtns.count() === 3 && await dscBtns.count() === 3 && body2.includes(T('carriedNotCurrent')) && body2.includes('Mi muestra propia de QA'), `usar=${await useBtns.count()} descartar=${await dscBtns.count()}`);
      check(`U5a ${tag} el foco pasa al encabezado de la sección de borradores tras el rebase`, focused.includes(T('carriedTitle').slice(0, 20)), `foco="${focused}"`);
      const dis = await useBtns.evaluateAll(els => els.map(e => ({ d: e.disabled || e.getAttribute('aria-disabled') === 'true', desc: e.getAttribute('aria-describedby'), t: e.getAttribute('aria-describedby') ? (document.getElementById(e.getAttribute('aria-describedby'))?.textContent || '') : '' })));
      check(`U3 ${tag} orden entrega → reflexión → decisión: la primera se puede usar; la segunda y la tercera están bloqueadas con el motivo enlazado por aria-describedby`, !dis[0].d && dis[1].d && dis[2].d && /Primero|First/.test(dis[1].t) && /Primero|First/.test(dis[2].t), JSON.stringify(dis.map(x => [x.d, x.t.slice(0, 40)])));
      check(`U8a ${tag} XSS: el HTML del texto arrastrado se muestra como texto y no se ejecuta`, (await page.evaluate(() => window.__xss)) === undefined && (await page.locator('img[src="x"]').count()) === 0, 'sin ejecución');
      // teclado: llegar a «Usar» con Tab y ver el foco visible
      await page.evaluate(() => document.activeElement?.blur()); let reached = false, visible = false; for (let i = 0; i < 40 && !reached; i++) { await page.keyboard.press('Tab'); const r = await page.evaluate(n => { const e = document.activeElement; if (!e || e.textContent.trim() !== n) return null; const cs = getComputedStyle(e); return { out: cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0, sh: cs.boxShadow !== 'none' }; }, T('useDraft')); if (r) { reached = true; visible = r.out || r.sh; } }
      check(`U8b ${tag} teclado: el botón «${T('useDraft')}» se alcanza con Tab y tiene indicador de foco visible`, reached && visible, `alcanzado=${reached} indicador=${visible}`);
      // descarte con confirmación en pantalla (sin confirm())
      await dscBtns.first().click(); await page.waitForTimeout(300); const ask = await page.evaluate(() => document.body.innerText);
      check(`U4a ${tag} descartar pide confirmación en pantalla (sin diálogo del navegador) con «${T('discardYes')}» y «${T('keepDraft')}»`, ask.includes(T('discardAsk').slice(0, 30)) && dialogs === 0 && ask.includes(T('discardYes')) && ask.includes(T('keepDraft')), `diálogos=${dialogs}`);
      await page.getByRole('button', { name: T('keepDraft') }).click(); await page.waitForTimeout(200); check(`U4b ${tag} «${T('keepDraft')}» conserva el borrador (siguen 3)`, await dscBtns.count() === 3, `descartar=${await dscBtns.count()}`);
      // usar la entrega
      await useBtns.first().click(); await page.waitForTimeout(500); const body3 = await page.evaluate(() => document.body.innerText);
      check(`U6 ${tag} usar la entrega: pasa al cuerpo del experimento (versión «${T('submitted')}»), sin perder el texto; quedan 2 borradores`, body3.includes('Mi muestra propia de QA') && body3.includes(T('submitted')) && await useBtns.count() === 2, `borradores=${await useBtns.count()}`);
      const dis2 = await useBtns.evaluateAll(els => els.map(e => e.disabled || e.getAttribute('aria-disabled') === 'true')); check(`U3b ${tag} tras usar la entrega se habilita la reflexión y sigue bloqueada la decisión`, !dis2[0] && dis2[1], JSON.stringify(dis2));
      await useBtns.first().click(); await page.waitForTimeout(400); await dscBtns.first().click(); await page.getByRole('button', { name: T('discardYes') }).click(); await page.waitForTimeout(400); const body4 = await page.evaluate(() => document.body.innerText);
      check(`U4c ${tag} reflexión usada y decisión descartada: desaparece la sección de borradores y el historial conserva las versiones`, !body4.includes(T('carriedTitle')) && body4.includes(T('versions')), 'sin borradores');
      check(`U10 ${tag} sin errores de página en todo el recorrido`, errs.length === 0, errs.join(' | ')); await page.screenshot({ path: `${SHOTS}/${tag}-final.png`, fullPage: true }); await ctx.close();
    }
  }
  // responsive y tema oscuro (vista con borradores) en ES
  for (const lang of ['es', 'en']) {
    const T = k => tr(k, lang);
    for (const w of [320, 375, 768, 1024, 1440]) {
      const ctx = await b.newContext({ viewport: { width: w, height: 900 }, colorScheme: w === 1440 ? 'dark' : 'light' }); await ctx.addInitScript(l => { try { localStorage.setItem('elv_lang', l); localStorage.setItem('elevation_token', 'x.y.z'); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elevation_name', 'QA'); } catch { /* */ } }, lang);
      const page = await ctx.newPage(); await toReview(page, servers.evidence.base, lang); const ov1 = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      await page.getByRole('button', { name: T('rebase') }).click(); await page.waitForTimeout(500); const ov2 = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      check(`U7 ${lang} ${w}px aviso y borradores sin desborde horizontal`, ov1 <= 0 && ov2 <= 0, `aviso=${ov1} borradores=${ov2}`);
      if (w === 1440) { const cr = await page.evaluate(() => { const parse = s => s.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number); const bgOf = e => { while (e) { const c = getComputedStyle(e).backgroundColor; const m = c.match(/rgba?\(([^)]+)\)/); if (m && !(m[1].split(',').length === 4 && Number(m[1].split(',')[3]) === 0)) return parse(c); e = e.parentElement; } return [255, 255, 255]; }; const res = []; for (const sel of ['h3', 'button', 'p']) { const els = [...document.querySelectorAll('main ' + sel + ', ' + sel)].slice(0, 12); for (const e of els) { const fg = parse(getComputedStyle(e).color); res.push({ sel, fg, bg: bgOf(e), t: (e.textContent || '').trim().slice(0, 30) }); } } return res; });
        const low = cr.map(x => ({ ...x, r: ratio(x.fg, x.bg) })).filter(x => x.t && x.r < 4.5); check(`U9 ${lang} tema oscuro: texto de títulos, botones y párrafos con contraste ≥ 4,5:1`, low.length === 0, low.slice(0, 3).map(x => `${x.sel}:"${x.t}" ${x.r.toFixed(2)}`).join(' | ') || `${cr.length} elementos medidos`); await page.screenshot({ path: `${SHOTS}/${lang}-oscuro.png`, fullPage: true }); }
      await ctx.close();
    }
  }
  await b.close(); for (const s of Object.values(servers)) s.s.close();
  console.log('RESUMEN-ES33-UI ' + JSON.stringify({ total: out.length, fallos: out.filter(o => !o.ok).length })); fs.writeFileSync(path.join(__dirname, '..', 'evidence', 'ES-33-pr132-ui-resultados.json'), JSON.stringify(out, null, 1));
})().catch(e => { console.log('ERROR ' + String(e.stack).slice(0, 600)); process.exit(1); });
