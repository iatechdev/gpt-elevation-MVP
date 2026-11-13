// [QA-Claude] ES-13 · PR #59: interfaz de la Brújula profesional de punta a punta. El build CON bandera se sirve estático y /api/** se reenvía al servidor REAL del merge (Postgres real + IA simulada).
// Uso: PLAYWRIGHT_MODULE=<ruta> PLAYWRIGHT_BROWSERS_PATH=<ruta> QA_SUT=<clon> UI_FLAG=http://127.0.0.1:4314 UI_REL=http://127.0.0.1:4313 QA_API=http://127.0.0.1:8213 QA_MOCK=http://127.0.0.1:9913 DATABASE_URL=<base> QA_JWT_SECRET=<clave> OUT=<carpeta capturas> node qa/integration/es13-ui-e2e.cjs
const { createRequire } = require('node:module'); const path = require('node:path'); const { randomBytes } = require('node:crypto');
const req = createRequire(path.join(process.env.QA_SUT, 'backend', 'package.json')); const jwt = req('jsonwebtoken'); const { Client } = req('pg');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const FLAG = process.env.UI_FLAG, REL = process.env.UI_REL, API = process.env.QA_API, MOCK = process.env.QA_MOCK, OUT = process.env.OUT || '.';
const check = (id, ok, d = '') => console.log(JSON.stringify({ id, ok: !!ok, detail: d }));
(async () => {
  const db = new Client({ connectionString: process.env.DATABASE_URL, ssl: false }); await db.connect();
  const email = `qa13-ui-${Date.now()}@example.test`;
  const reg = await fetch(API + '/api/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'QA13 UI', email, password: randomBytes(12).toString('base64url') + 'aA1!' }) });
  const u = (await db.query('select id,name,role from "Users" where email=$1', [email])).rows[0];
  if (reg.status !== 201 || !u) throw new Error('registro ' + reg.status);
  const token = jwt.sign({ id: u.id, name: u.name, role: u.role, iatMs: Date.now() }, process.env.QA_JWT_SECRET, { expiresIn: '2h', jwtid: randomBytes(8).toString('hex') });
  const stats = async () => (await fetch(MOCK + '/_stats')).json(); const reset = () => fetch(MOCK + '/_reset');
  const browser = await chromium.launch({ headless: true });
  async function open(lang, viewport, base = FLAG, scheme = 'light') {
    const ctx = await browser.newContext({ viewport, colorScheme: scheme }); const page = await ctx.newPage(); const errs = [], origins = new Set(), posts = [];
    page.on('pageerror', e => errs.push(e.message.slice(0, 100))); page.on('request', r => { try { origins.add(new URL(r.url()).origin); } catch { /* data: */ } });
    await ctx.addInitScript(([t, l]) => { localStorage.setItem('elevation_token', t); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elv_lang', l); }, [token, lang]);
    await page.route('**/api/**', async route => { // reenvía al servidor real del merge
      const rq = route.request(); const url = new URL(rq.url()); const hdr = { ...rq.headers() }; delete hdr.host;
      if (rq.method() === 'POST' && url.pathname === '/api/chat') posts.push(JSON.parse(rq.postData() || '{}'));
      try { const r = await fetch(API + url.pathname + url.search, { method: rq.method(), headers: hdr, body: rq.postData() || undefined }); const body = Buffer.from(await r.arrayBuffer()); await route.fulfill({ status: r.status, headers: { 'content-type': r.headers.get('content-type') || 'application/json' }, body }); } catch (e) { await route.abort(); }
    });
    return { ctx, page, errs, origins, posts };
  }
  const composer = { es: 'Mensaje (hasta 4.000 caracteres)', en: 'Message (up to 4,000 characters)' };
  // E2E ES
  { const { page, errs, posts, ctx } = await open('es', { width: 1280, height: 900 }); await reset();
    await page.goto(FLAG + '/app/chat'); await page.getByLabel(composer.es).waitFor();
    await page.getByRole('link', { name: 'Brújula profesional', exact: true }).click(); await page.getByRole('heading', { name: 'Brújula profesional', exact: true }).waitFor();
    await page.getByLabel(composer.es).fill('Quiero explorar otra profesión'); await page.getByRole('button', { name: 'Enviar', exact: true }).click(); await page.getByText('Respuesta sintética #1').waitFor({ timeout: 15000 });
    const s1 = await stats(); const sys1 = String(s1.last?.system || '');
    check('ES13-U01 E2E real: enviar desde la Brújula manda mode=compass y el servidor arma el prompt de la Brújula', posts[0]?.mode === 'compass' && sys1.includes('PROFESSIONAL COMPASS RULES') && sys1.includes('COMPANION LIMITS'), `mode=${posts[0]?.mode} calls=${s1.calls}`);
    await page.getByRole('button', { name: 'Cerrar sin presión', exact: true }).click(); await page.waitForURL('**/app/chat'); await page.waitForTimeout(400);
    await page.getByLabel(composer.es).fill('Ahora una conversación normal'); await page.getByRole('button', { name: 'Enviar', exact: true }).click(); await page.getByText('Respuesta sintética #2').waitFor({ timeout: 15000 });
    const s2 = await stats(); const sys2 = String(s2.last?.system || '');
    check('ES13-U02 E2E real: tras «Cerrar sin presión» el siguiente envío va sin mode y el prompt ya no es el de la Brújula', !('mode' in posts[1]) && !sys2.includes('PROFESSIONAL COMPASS RULES') && sys2.includes('COMPANION LIMITS'), `mode2=${posts[1]?.mode}`);
    await page.reload(); await page.getByLabel(composer.es).waitFor(); await page.waitForTimeout(800);
    const body = await page.locator('body').innerText();
    check('ES13-U03 el historial recargado muestra los dos intercambios y ningún rastro del modo ni del prompt', body.includes('Quiero explorar otra profesión') && body.includes('Ahora una conversación normal') && !/PROFESSIONAL COMPASS|COMPANION LIMITS|"mode"/.test(body), '');
    // Riesgo alto desde la Brújula: respuesta de seguridad y el proveedor no se llama
    await page.goto(FLAG + '/app/chat?mode=compass'); await page.getByRole('heading', { name: 'Brújula profesional', exact: true }).waitFor(); await reset();
    await page.getByLabel(composer.es).fill('Quiero morir'); await page.getByRole('button', { name: 'Enviar', exact: true }).click(); await page.waitForTimeout(2500);
    const bodyR = await page.locator('body').innerText(); const sr = await stats();
    check('ES13-U04 riesgo alto escrito en la Brújula: se muestra apoyo de seguridad y el proveedor no recibe la llamada', sr.calls === 0 && /106|línea|emergencia|ayuda|crisis/i.test(bodyR) && !/Respuesta sintética #3/.test(bodyR), `calls=${sr.calls} texto=${bodyR.split(/\s+/).join(' ').slice(-300)}`);
    check('ES13-U05 sin errores de página en el recorrido ES', errs.length === 0, errs.join(' | ')); await ctx.close(); }
  // EN
  { const { page, errs, posts, ctx } = await open('en', { width: 390, height: 844 }); await reset();
    await page.goto(FLAG + '/app/chat?mode=compass'); await page.getByRole('heading', { name: 'Professional compass', exact: true }).waitFor();
    await page.getByLabel(composer.en).fill('I want to explore a new career'); await page.getByRole('button', { name: 'Send', exact: true }).click(); await page.getByText(/Respuesta sintética/).last().waitFor({ timeout: 15000 });
    const sys = String((await stats()).last?.system || '');
    check('ES13-U06 E2E real en EN: el prompt usa el borrador en inglés (ACT)', posts[0]?.mode === 'compass' && posts[0]?.lang === 'en' && /Acceptance and Commitment Therapy/.test(sys), `lang=${posts[0]?.lang} mode=${posts[0]?.mode} sys=${sys.slice(0, 90)}`);
    check('ES13-U07 sin errores de página en EN', errs.length === 0, errs.join(' | ')); await ctx.close(); }
  // Responsive, contraste, foco, red
  const res = [];
  for (const lang of ['es', 'en']) for (const scheme of ['light', 'dark']) for (const w of [320, 375, 768, 1440]) {
    const { page, ctx, origins } = await open(lang, { width: w, height: 900 }, FLAG, scheme); await page.goto(FLAG + '/app/chat?mode=compass'); await page.waitForSelector('.space-compass', { timeout: 15000 }); await page.waitForTimeout(500);
    const r = await page.evaluate(() => {
      const parse = s => s.match(/[\d.]+/g).map(Number); const lum = a => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(a[0]) + 0.7152 * f(a[1]) + 0.0722 * f(a[2]); };
      const box = document.querySelector('.space-compass'); let worst = 99; let n = 0;
      for (const el of box.querySelectorAll('*')) { if (![...el.childNodes].some(x => x.nodeType === 3 && x.textContent.trim())) continue; const cs = getComputedStyle(el); let b = el, bg = null; while (b) { const v = parse(getComputedStyle(b).backgroundColor); if ((v[3] === undefined ? 1 : v[3]) > 0.9) { bg = v; break; } b = b.parentElement; } bg = bg || [255, 255, 255]; const L1 = lum(parse(cs.color)), L2 = lum(bg); const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05); worst = Math.min(worst, ratio); if (ratio < 4.5) n++; }
      const btns = [...box.querySelectorAll('button')].map(b => { const bb = b.getBoundingClientRect(); return { t: b.innerText, h: Math.round(bb.height), w: Math.round(bb.width) }; });
      return { hs: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1, clip: [...box.querySelectorAll('h2,p,button')].filter(e => e.scrollWidth > e.clientWidth + 1).length, worst: +worst.toFixed(2), low: n, btns, visible: box.getBoundingClientRect().height > 0 };
    });
    if (w === 320 || w === 1440) await page.screenshot({ path: path.join(OUT, `brujula-${lang}-${scheme}-${w}.png`) });
    res.push({ lang, scheme, w, ...r, ext: [...origins].filter(o => !o.startsWith('http://127.0.0.1') && !/fonts\.(googleapis|gstatic)\.com/.test(o)) }); await ctx.close();
  }
  check('ES13-U08 sin desplazamiento horizontal ni texto cortado a 320, 375, 768 y 1440 px (ES/EN, claro/oscuro)', res.every(x => !x.hs && x.clip === 0 && x.visible), JSON.stringify(res.filter(x => x.hs || x.clip).map(x => `${x.lang}${x.scheme}${x.w}`)) || 'ok');
  check('ES13-U09 contraste AA (≥ 4,5:1) de todo el texto de la banda en claro y oscuro', res.every(x => x.low === 0), `peor=${Math.min(...res.map(x => x.worst))} fallan=${res.filter(x => x.low).map(x => `${x.lang}${x.scheme}${x.w}:${x.low}`).join(',') || 'ninguno'}`);
  const small = res.filter(x => x.btns.some(b => b.h < 44)); check('ES13-U10 botones de la banda con alto táctil ≥ 44 px', small.length === 0, small.length ? JSON.stringify(small.slice(0, 3).map(x => `${x.lang}${x.w}:${x.btns.map(b => b.h).join('/')}`)) : 'ok');
  check('ES13-U11 la página solo pide al propio origen y a las fuentes ya existentes', res.every(x => x.ext.length === 0), JSON.stringify(res.flatMap(x => x.ext).filter((v, i, a) => a.indexOf(v) === i)));
  // Foco visible
  { const { page, ctx } = await open('es', { width: 1280, height: 900 }); await page.goto(FLAG + '/app/chat?mode=compass'); await page.waitForSelector('.space-compass'); const seen = [];
    for (let i = 0; i < 20; i++) { await page.keyboard.press('Tab'); seen.push(await page.evaluate(() => { const e = document.activeElement; const cs = getComputedStyle(e); return { t: (e.innerText || e.getAttribute('aria-label') || '').trim().slice(0, 22), fv: e.matches(':focus-visible'), o: cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0 || cs.boxShadow !== 'none' }; })); }
    const key = seen.filter(x => /Cerrar sin presión|Ahora no/.test(x.t)); check('ES13-U12 foco visible en «Cerrar sin presión» y «Ahora no» con teclado', key.length >= 2 && key.every(x => x.fv && x.o), JSON.stringify(key)); await ctx.close(); }
  // Release (sin bandera) contra el servidor real
  { const { page, ctx, posts } = await open('es', { width: 1280, height: 900 }, REL); await reset(); await page.goto(REL + '/app/chat?mode=compass'); await page.getByLabel(composer.es).waitFor();
    const link = await page.getByRole('link', { name: 'Brújula profesional' }).count(), h = await page.getByRole('heading', { name: 'Brújula profesional' }).count();
    await page.getByLabel(composer.es).fill('Hola sin bandera'); await page.getByRole('button', { name: 'Enviar', exact: true }).click(); await page.getByText(/Respuesta sintética/).last().waitFor({ timeout: 15000 });
    const sys = String((await stats()).last?.system || '');
    check('ES13-U13 build SIN bandera: ni enlace ni banda, ?mode=compass se ignora y el servidor recibe el chat normal', link === 0 && h === 0 && !('mode' in (posts[0] || {})) && !sys.includes('PROFESSIONAL COMPASS RULES'), `link=${link} banda=${h}`); await ctx.close(); }
  await browser.close(); await db.end(); console.log(JSON.stringify({ fin: true }));
})().catch(e => { console.error(e); process.exit(1); });
