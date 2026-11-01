// [QA-Claude] ES-129 · PR #121 (head bce47b86): aviso «Recargar» cuando falla un bloque diferido. Navegador real (Playwright/Chromium), servidor local con el build del merge, datos SINTÉTICOS, 0 tokens de IA.
// Modos de fallo: (404) el bloque responde 404; (html) el servidor entrega index.html en su lugar (MIME); (red) corte de red. ES/EN, 320 y 1440 px.
// Uso: QA_PR=<servidor> OUT=<carpeta> node qa/integration/es129b-ui.cjs
const fs = require('fs'); const path = require('path'); const E = process.env; const { chromium } = require('C:/Users/Usuario/tools/playwright/node_modules/playwright');
const PR = E.QA_PR, OUT = E.OUT; fs.mkdirSync(OUT, { recursive: true }); const out = [];
const check = (id, ok, d = '') => { out.push({ id, ok: !!ok, detail: String(d).slice(0, 300) }); console.log(JSON.stringify({ id, ok: !!ok, detail: String(d).slice(0, 300) })); };
const TXT = { es: { msg: 'Hay una versión nueva de la aplicación. Recarga la página para continuar.', btn: 'Recargar' }, en: { msg: 'A new version of the app is available. Reload the page to continue.', btn: 'Reload' } };
const J = async (p, body) => { const r = await fetch(PR + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); return r.json().catch(() => ({})); };
(async () => {
  const b = await chromium.launch(); const html = await (await fetch(PR + '/')).text();
  const initial = new Set([...html.matchAll(/(?:src|href)="(\/assets\/[^"]+\.js)"/g)].map(m => m[1]));
  check('PRE-bloques-iniciales', initial.size >= 1, [...initial].join(','));
  const stamp = Date.now(); const email = `qa129b-${stamp}@example.test`, password = 'Contraseña-QA129-' + stamp; await J('/api/register', { name: 'QA129b', email, password });
  let lg = await J('/api/login', { email, password }); for (let i = 0; i < 6 && !lg.token; i++) { await new Promise(r => setTimeout(r, 15000)); lg = await J('/api/login', { email, password }); }
  const isLazy = u => { const p = new URL(u).pathname; return /^\/assets\/.+\.js$/.test(p) && !initial.has(p); };
  const mode = { current: null };
  const mk = async ({ lang, w, session, block }) => {
    const ctx = await b.newContext({ viewport: { width: w, height: 800 } });
    await ctx.addInitScript(([l, s]) => { try { localStorage.setItem('elv_lang', l); if (s) { localStorage.setItem('elevation_token', s.token); localStorage.setItem('elevation_role', s.role); localStorage.setItem('elevation_name', s.name || ''); } } catch { /* */ } }, [lang, session || null]);
    const st = { block, navs: 0, docReq: 0 };
    await ctx.route('**/*', route => { const req = route.request(); if (st.block && isLazy(req.url())) { if (st.block === '404') return route.fulfill({ status: 404, contentType: 'text/plain', body: 'Not found' }); if (st.block === 'html') return route.fulfill({ status: 200, contentType: 'text/html', body: html }); return route.abort('internetdisconnected'); } return route.continue(); });
    const p = await ctx.newPage(); p.on('request', r => { if (r.isNavigationRequest() && r.frame() === p.mainFrame() && r.resourceType() === 'document') st.navs++; }); return { ctx, p, st };
  };
  const state = p => p.evaluate(() => { const a = document.querySelector('[role="alert"]'); const btn = a && a.querySelector('button'); const r = document.getElementById('root'); return { alert: a ? a.innerText : null, focusBtn: !!btn && document.activeElement === btn, btnText: btn ? btn.innerText : null, rootText: r ? r.innerText.trim().length : 0, hscroll: document.documentElement.scrollWidth > window.innerWidth + 1, btnH: btn ? btn.getBoundingClientRect().height : 0 }; });
  // F1-F3 × ES/EN × 320/1440
  for (const blockMode of ['404', 'html', 'red']) for (const lang of ['es', 'en']) for (const w of [320, 1440]) {
    const { ctx, p, st } = await mk({ lang, w, block: blockMode }); await p.goto(PR + '/profesionales', { waitUntil: 'domcontentloaded' }); await p.waitForSelector('[role="alert"]', { timeout: 15000 }).catch(() => {}); await p.waitForTimeout(3500);
    const s = await state(p); const id = `F-${blockMode}-${lang}-${w}`; const t = TXT[lang];
    check(id, s.alert && s.alert.includes(t.msg) && s.btnText === t.btn && s.focusBtn && s.rootText > 20 && !s.hscroll && st.navs === 1 && s.btnH >= 44, JSON.stringify({ ...s, navs: st.navs }));
    if (w === 320 && lang === 'es') await p.screenshot({ path: path.join(OUT, `aviso-${blockMode}-320-es.png`) });
    if (w === 1440 && lang === 'en') await p.screenshot({ path: path.join(OUT, `aviso-${blockMode}-1440-en.png`) });
    await ctx.close();
  }
  // F4: recuperación con clic y con teclado, sin bucle
  for (const how of ['click', 'enter']) {
    const { ctx, p, st } = await mk({ lang: 'es', w: 1280, block: '404' }); await p.goto(PR + '/profesionales', { waitUntil: 'domcontentloaded' }); await p.waitForSelector('[role="alert"]', { timeout: 15000 }); st.block = null; const before = st.navs;
    if (how === 'click') await p.getByRole('button', { name: 'Recargar' }).click(); else await p.keyboard.press('Enter');
    await p.waitForLoadState('domcontentloaded'); await p.waitForTimeout(2500); const s = await state(p);
    check('F4-recarga-' + how, s.alert === null && s.rootText > 40 && st.navs === before + 1, JSON.stringify({ ...s, navs: st.navs, before })); await ctx.close();
  }
  // F5: si el servidor sigue fallando, el botón no entra en bucle (una recarga por clic)
  { const { ctx, p, st } = await mk({ lang: 'es', w: 1280, block: '404' }); await p.goto(PR + '/profesionales', { waitUntil: 'domcontentloaded' }); await p.waitForSelector('[role="alert"]'); const b0 = st.navs; await p.getByRole('button', { name: 'Recargar' }).click(); await p.waitForSelector('[role="alert"]', { timeout: 15000 }); await p.waitForTimeout(4000); check('F5-sin-bucle-si-sigue-fallando', st.navs === b0 + 1, `navs=${st.navs} antes=${b0}`); await ctx.close(); }
  // F6: navegación dentro de la app (sin recarga) y recuperación al cambiar de ruta
  { const { ctx, p, st } = await mk({ lang: 'es', w: 1280, block: null }); await p.goto(PR + '/login', { waitUntil: 'load' }); await p.waitForTimeout(800); st.block = '404'; const n0 = st.navs;
    await p.evaluate(() => { history.pushState({}, '', '/profesionales'); window.dispatchEvent(new PopStateEvent('popstate')); }); await p.waitForSelector('[role="alert"]', { timeout: 15000 }).catch(() => {}); const s1 = await state(p);
    st.block = null; await p.evaluate(() => { history.pushState({}, '', '/login'); window.dispatchEvent(new PopStateEvent('popstate')); }); await p.waitForTimeout(1500); const s2 = await state(p);
    check('F6-navegacion-interna-aviso-y-recupera', s1.alert && s1.alert.includes(TXT.es.msg) && st.navs === n0 && s2.alert === null && s2.rootText > 40, JSON.stringify({ aviso: !!s1.alert, navs: st.navs - n0, tras_cambiar_ruta_alert: s2.alert })); await ctx.close(); }
  // F7: pantalla protegida con sesión
  { const { ctx, p, st } = await mk({ lang: 'en', w: 390, session: { token: lg.token, role: lg.role || 'user', name: 'QA129b' }, block: '404' }); await p.goto(PR + '/app/chat', { waitUntil: 'domcontentloaded' }); await p.waitForSelector('[role="alert"]', { timeout: 15000 }).catch(() => {}); await p.waitForTimeout(2500); const s = await state(p);
    check('F7-protegida-con-sesion-EN-390', s.alert && s.alert.includes(TXT.en.msg) && st.navs === 1 && !s.hscroll, JSON.stringify({ ...s, navs: st.navs })); await ctx.close(); }
  // F8: camino feliz sin fallos: sin aviso en ES y EN
  for (const lang of ['es', 'en']) { const { ctx, p } = await mk({ lang, w: 1280, block: null }); await p.goto(PR + '/profesionales', { waitUntil: 'load' }); await p.waitForTimeout(1500); const s = await state(p); const c = []; check('F8-camino-feliz-' + lang, s.alert === null && s.rootText > 100, JSON.stringify(s)); await ctx.close(); }
  // F9: un error que no es de bloque no se enmascara como «versión nueva» (texto del aviso no aparece por un 500 de API)
  { const { ctx, p } = await mk({ lang: 'es', w: 1280, block: null }); await ctx.route('**/api/**', r => r.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"x"}' })); await p.goto(PR + '/login', { waitUntil: 'load' }); await p.waitForTimeout(1500); const s = await state(p); check('F9-500-de-API-no-es-aviso-de-version', !(s.alert || '').includes('versión nueva') && s.rootText > 20, JSON.stringify(s)); await ctx.close(); }
  fs.writeFileSync(path.join(OUT, 'resultados-ui.json'), JSON.stringify(out, null, 1)); console.log('RESUMEN', out.filter(o => o.ok).length + '/' + out.length); await b.close();
})().catch(e => { console.log(JSON.stringify({ id: 'ERROR', detail: String(e.stack).slice(0, 500) })); process.exit(1); });
