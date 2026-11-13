// [QA-Claude] ES-169 · PR #260 (etiqueta del tema «Estrés y carga» en el modal de emparejamiento) · Chromium real contra el server.js REAL (Postgres desechable, migraciones, build real servido por el backend). Datos sintéticos, 0 IA.
//   QA_SUT=<repo> QA260_DB=postgres://... OUT=<capturas> PLAYWRIGHT_MODULE=<ruta> PLAYWRIGHT_BROWSERS_PATH=<ruta> AXE_PATH=<axe.min.js> node qa/integration/es169-ui-pr260.cjs
const fs = require('fs'); const path = require('path');
const E = process.env; const SUT = path.join(E.QA_SUT || 'C:/Users/Usuario/Documents/qa-pr-221'); const OUT = E.OUT || '.'; fs.mkdirSync(OUT, { recursive: true });
const { startRealApi } = require(path.join(SUT, 'backend/test/support/realApi.cjs')); process.chdir(path.join(SUT, 'backend'));
const { chromium } = require(E.PLAYWRIGHT_MODULE || 'playwright'); const AXE = fs.readFileSync(E.AXE_PATH, 'utf8');
const hooks = []; const t = { after: (fn) => hooks.push(fn) }; const results = [];
const check = (id, ok, d = '') => { results.push({ id, ok: !!ok }); console.log(JSON.stringify({ id, ok: !!ok, detail: String(d).slice(0, 600) })); };
const info = (id, d) => console.log(JSON.stringify({ id, info: String(d).slice(0, 600) }));
const OLD = /ansiedad|anxiety/i;
(async () => {
  const { q, mkUser, http, base } = await startRealApi(t, { envVar: 'QA260_DB', prefix: 'qa260' });
  const th = await mkUser('therapist'); const P0 = await mkUser('user'); const P1 = await mkUser('user'); await q('UPDATE "Users" SET "therapistId"=$1 WHERE id=$2', [th.id, P1.id]);
  const browser = await chromium.launch({ headless: true });
  const open = async (who, url, { lang = 'es', vp = { width: 1360, height: 900 }, scheme = 'light' } = {}) => {
    const ctx = await browser.newContext({ viewport: vp, colorScheme: scheme });
    await ctx.addInitScript(([tk, r, l]) => { try { localStorage.setItem('elevation_token', tk); localStorage.setItem('elevation_role', r); localStorage.setItem('elv_lang', l); localStorage.setItem('elevation_lang', l); } catch { /* */ } }, [who.token, who.role, lang]);
    const page = await ctx.newPage(); const reqs = []; page.on('request', (r) => reqs.push({ m: r.method(), u: r.url(), b: r.postData() })); const errs = []; page.on('pageerror', (e) => errs.push(e.message));
    await page.goto(base + url); await page.waitForTimeout(1800); return { ctx, page, reqs, errs };
  };
  const textOf = (page) => page.evaluate(() => { const out = [document.body.innerText]; document.querySelectorAll('*').forEach((e) => { for (const a of ['aria-label', 'title', 'alt', 'placeholder', 'value']) { const v = e.getAttribute && e.getAttribute(a); if (v) out.push(v); } }); return out.join('\n'); });
  const axeOn = async (page) => { await page.evaluate(AXE); const r = await page.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } })); return r.violations.map((v) => v.id + '(' + v.nodes.length + ')'); };
  const ENTRIES = [['dashboard (sin profesional)', P0, '/app/dashboard', /Buscar mi terapeuta|Find my therapist/i], ['mi profesional (cambiar)', P1, '/app/my-therapist', /cambiar de profesional|change.*professional|change.*therapist/i]];
  const LABEL = { es: 'Estrés y carga', en: 'Stress and workload' };

  // T1 etiqueta en las dos entradas × idioma × viewport
  const bad = []; const okc = [];
  for (const [name, who, url, btn] of ENTRIES) for (const lang of ['es', 'en']) for (const w of [390, 1360]) {
    const o = await open(who, url, { lang, vp: { width: w, height: 900 } });
    try { await o.page.getByRole('button', { name: btn }).first().click({ timeout: 6000 }); await o.page.waitForTimeout(500);
      const txt = await textOf(o.page); const chip = await o.page.getByRole('button', { name: LABEL[lang], exact: true }).count();
      if (OLD.test(txt)) bad.push(`${name}/${lang}/${w}: aparece «${(txt.match(OLD) || [''])[0]}»`); if (!chip) bad.push(`${name}/${lang}/${w}: no está el chip «${LABEL[lang]}»`); else okc.push(`${name}/${lang}/${w}`);
      await o.page.screenshot({ path: path.join(OUT, `260-${name.split(' ')[0]}-${lang}-${w}.png`) }); }
    catch (e) { bad.push(`${name}/${lang}/${w}: ${String(e.message).slice(0, 80)}`); }
    await o.ctx.close(); }
  check('T1 el chip dice «Estrés y carga» / «Stress and workload» y NO aparece «Ansiedad»/«Anxiety» (texto, aria-label, title, value) en las 2 entradas × ES/EN × 390/1360', bad.length === 0 && okc.length === 8, bad.join(' | ') || `${okc.length}/8 vistas`);

  // T2 el valor enviado sigue siendo 'anxiety'
  { const o = await open(P0, '/app/dashboard'); await o.page.getByRole('button', { name: /Buscar mi terapeuta/ }).first().click(); await o.page.waitForTimeout(400);
    await o.page.getByRole('button', { name: LABEL.es, exact: true }).click(); await o.page.getByRole('button', { name: 'Reflexivo', exact: true }).click(); await o.page.getByRole('button', { name: 'Español', exact: true }).click();
    const wait = o.page.waitForResponse((r) => /\/api\/matching\/request/.test(r.url()), { timeout: 8000 }).catch(() => null); await o.page.getByRole('button', { name: /Buscar|Search/i }).last().click(); const resp = await wait; await o.page.waitForTimeout(500);
    const post = o.reqs.find((r) => r.m === 'POST' && /\/api\/matching\/request/.test(r.u)); const sent = post && JSON.parse(post.b);
    check('T2 al elegir «Estrés y carga» el navegador envía answers.area === \'anxiety\' (la clave del contrato) y NO la etiqueta', sent && sent.answers.area === 'anxiety' && !/Estr/.test(post.b), post ? post.b : 'sin petición'); info('T2b respuesta del servidor real a esa petición (proveedor simulado)', resp ? resp.status() : 'sin respuesta');
    await o.ctx.close(); }
  { const r1 = await http(P0, 'POST', '/api/matching/request', { answers: { area: 'anxiety', style: 'reflective', language: 'es' } }); const r2 = await http(P0, 'POST', '/api/matching/request', { answers: { area: 'Estrés y carga', style: 'reflective', language: 'es' } });
    check('T2c servidor real: area=anxiety NO es rechazado como entrada inválida (sin cambio de contrato) y la etiqueta «Estrés y carga» sí (por eso la clave no debe cambiar)', r1.status !== 400 && r2.status === 400, `anxiety → ${r1.status} ${r1.body && (r1.body.code || r1.body.error || '')}; etiqueta → ${r2.status}`); }

  // T3 estático
  { const files = []; const walk = (d) => { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) walk(p); else if (/\.(tsx?|ts)$/.test(f.name)) files.push(p); } }; walk(path.join(SUT, 'frontend/src'));
    const hits = []; for (const f of files) { fs.readFileSync(f, 'utf8').split('\n').forEach((l, i) => { if (OLD.test(l)) hits.push(path.relative(SUT, f).replace(/\\/g, '/') + ':' + (i + 1)); }); }
    check('T3 búsqueda propia «ansiedad|anxiety» en frontend/src: solo la clave interna y UserProgress.tsx (declarado, ES-173)', hits.every((h) => /MatchingModal\.tsx:\d+$/.test(h) || /UserProgress\.tsx:\d+$/.test(h)), hits.join(', ')); info('T3b el panel de administración muestra la clave cruda «anxiety» en «Área: …» (AdminUsersQueues.tsx:55): no lo toca este PR', 'ver evidencia'); }

  // T5 accesibilidad del modal abierto
  { const viol = []; let n = 0;
    for (const lang of ['es', 'en']) for (const w of [390, 1360]) for (const scheme of ['light', 'dark']) { const o = await open(P0, '/app/dashboard', { lang, vp: { width: w, height: 900 }, scheme }); await o.page.getByRole('button', { name: /Buscar mi terapeuta|Find my therapist/i }).first().click(); await o.page.waitForTimeout(400);
      const v = await axeOn(o.page); n += 1; if (v.length) viol.push(`${lang}/${w}/${scheme}: ${v.join(',')}`); await o.ctx.close(); }
    info('T5a axe WCAG A/AA/2.2 AA con el modal abierto (' + n + ' combinaciones)', viol.length ? viol.join(' | ') : '0 violaciones');
    results.push({ id: 'T5a', ok: viol.length === 0 });
    const o = await open(P0, '/app/dashboard', { lang: 'es', vp: { width: 320, height: 700 } }); await o.page.getByRole('button', { name: /Buscar mi terapeuta/ }).first().click(); await o.page.waitForTimeout(400);
    const ov = await o.page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth); const chipBox = await o.page.getByRole('button', { name: LABEL.es, exact: true }).boundingBox();
    check('T5b 320 px: sin desborde horizontal y el chip «Estrés y carga» cabe en pantalla', ov <= 0 && chipBox && chipBox.x >= 0 && chipBox.x + chipBox.width <= 320, `desborde ${ov}px; chip x=${chipBox && chipBox.x.toFixed(0)} ancho=${chipBox && chipBox.width.toFixed(0)}`);
    await o.page.getByRole('button', { name: LABEL.es, exact: true }).focus(); await o.page.keyboard.press('Enter'); await o.page.waitForTimeout(200);
    const state = await o.page.getByRole('button', { name: LABEL.es, exact: true }).evaluate((e) => ({ pressed: e.getAttribute('aria-pressed'), bg: getComputedStyle(e).backgroundColor, border: getComputedStyle(e).borderColor }));
    info('T5c teclado: Enter sobre el chip lo selecciona (estado visible/ARIA)', JSON.stringify(state)); await o.ctx.close(); }

  fs.writeFileSync(path.join(OUT, 'ES-169-260.json'), JSON.stringify(results)); console.log('RESUMEN ' + results.filter((r) => r.ok).length + '/' + results.length);
  await browser.close(); for (const h of hooks.reverse()) await h(); process.exit(0);
})().catch((e) => { console.error('FATAL', e.stack); process.exit(1); });
