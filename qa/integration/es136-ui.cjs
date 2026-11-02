// [QA-Claude] ES-136 · PR #127: «Cerrar sesión» (L1–L8). Servidor local con el merge, Postgres real, Chromium, datos SINTÉTICOS, 0 tokens de IA.
// Uso: QA_PR=http://127.0.0.1:8127 OUT=<carpeta> node qa/integration/es136-ui.cjs
const fs = require('fs'); const path = require('path'); const E = process.env; const { chromium } = require('C:/Users/Usuario/tools/playwright/node_modules/playwright');
const PR = E.QA_PR, OUT = E.OUT; fs.mkdirSync(OUT, { recursive: true }); const out = [];
const check = (id, ok, d = '') => { out.push({ id, ok: !!ok, detail: String(d).slice(0, 300) }); console.log(JSON.stringify({ id, ok: !!ok, detail: String(d).slice(0, 300) })); };
const J = async (p, body, tok) => { const r = await fetch(PR + p, { method: 'POST', headers: { 'content-type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}) }, body: JSON.stringify(body) }); return { s: r.status, j: await r.json().catch(() => ({})) }; };
const G = async (p, tok) => (await fetch(PR + p, { headers: { Authorization: 'Bearer ' + tok } })).status;
const BTN = { es: 'Cerrar sesión', en: 'Sign out' };
const ROUTE = { persona: '/app/dashboard', admin: '/admin/dashboard', superadmin: '/admin/dashboard', therapist: '/therapist/dashboard', board: '/board/manifest' };
const stamp = Date.now();
const mkUser = async (role, name = 'QA136 ' + role) => {
  const email = `qa136-${role}-${stamp}-${Math.random().toString(36).slice(2, 6)}@example.test`, password = 'Contraseña-QA136-' + stamp + 'aA!';
  await J('/api/register', { name, email, password });
  if (role !== 'persona') { const { Client } = require('C:/Users/Usuario/Documents/qa-pr-test/backend/node_modules/pg'); const c = new Client({ connectionString: 'postgres://elevation:elevation_local@127.0.0.1:54459/qa135' }); await c.connect(); await c.query('update "Users" set role=$1 where email=$2', [role, email]); await c.end(); }
  let r = await J('/api/login', { email, password }); for (let i = 0; i < 6 && !r.j.token; i++) { await new Promise(x => setTimeout(x, 15000)); r = await J('/api/login', { email, password }); }
  return { email, password, token: r.j.token, role: r.j.role, name: r.j.name ?? '' };
};
(async () => {
  const b = await chromium.launch();
  const open = async (u, { lang = 'es', w = 1440, h = 900 } = {}) => {
    const ctx = await b.newContext({ viewport: { width: w, height: h } });
    await ctx.addInitScript(([l, s]) => { try { localStorage.setItem('elv_lang', l); if (!sessionStorage.getItem('qa_init')) { localStorage.setItem('elevation_token', s.token); localStorage.setItem('elevation_role', s.role); localStorage.setItem('elevation_name', s.name); sessionStorage.setItem('elevation_pending_chat', JSON.stringify({ t: 'qa', message: 'texto privado pendiente', lang: 'es', requestId: 'qa-136', ids: [], mode: 'chat' })); sessionStorage.setItem('qa_init', '1'); } } catch { /* */ } }, [lang, u]);
    const p = await ctx.newPage(); const logout = []; p.on('request', r => { if (/\/api\/logout$/.test(r.url()) && r.method() === 'POST') logout.push(Date.now()); }); const errs = []; p.on('pageerror', e => errs.push(String(e).slice(0, 150))); return { ctx, p, logout, errs };
  };
  const state = async p => { try { return await p.evaluate(() => ({ t: localStorage.getItem('elevation_token'), r: localStorage.getItem('elevation_role'), n: localStorage.getItem('elevation_name'), pend: [...Object.keys(localStorage), ...Object.keys(sessionStorage)].filter(k => /pending/i.test(k)), url: location.pathname, hs: document.documentElement.scrollWidth > innerWidth + 1 })); } catch { return { t: null, r: null, n: null, pend: [], url: 'sin-acceso-al-almacenamiento:' + p.url(), hs: false }; } };
  // En el dashboard de la persona el botón de la cabecera abre el modal de despedida (diseño declarado por Dev); el «Cerrar sesión» final está en el modal.
  const clickSignOut = async (p, lang, mode = 'click') => { const btn = p.getByRole('button', { name: BTN[lang], exact: true }); if (!await btn.count()) return false; await btn.first()[mode === 'dbl' ? 'click' : 'click'](); await p.waitForTimeout(900); if (await btn.count() > 1) { if (await btn.last().isDisabled()) { await p.locator('button', { hasText: '🙂' }).last().click(); await p.waitForTimeout(400); } await btn.last()[mode === 'dbl' ? 'dblclick' : 'click'](); } else if (mode === 'dbl') { await btn.first().dblclick().catch(() => {}); } return true; };
  const users = {}; for (const r of ['persona', 'admin', 'superadmin', 'therapist', 'board']) users[r] = await mkUser(r);
  check('PRE-sesiones', Object.values(users).every(u => u.token), Object.keys(users).map(k => k + ':' + !!users[k].token).join(','));
  // L1, L2, L4: todos los roles, ES y EN
  for (const lang of ['es', 'en']) for (const role of Object.keys(users)) {
    const fresh = await mkUser(role); const before = await G('/api/diary', fresh.token);
    const { ctx, p, logout, errs } = await open(fresh, { lang }); await p.goto(PR + ROUTE[role], { waitUntil: 'load' }); await p.waitForTimeout(2000);
    const btn = p.getByRole('button', { name: BTN[lang], exact: true }); const visible = await btn.count() > 0 && await btn.first().isVisible().catch(() => false);
    if (visible) { await clickSignOut(p, lang); await p.waitForTimeout(2500); }
    const s = await state(p); const after = await G('/api/diary', fresh.token);
    check(`L1L2L4-${role}-${lang}`, visible && before !== 401 && after === 401 && !s.t && !s.r && !s.n && s.pend.length === 0 && s.url === '/' && logout.length === 1 && errs.length === 0, JSON.stringify({ visible, antes: before, despues: after, url: s.url, token: !!s.t, pend: s.pend, llamadas_logout: logout.length, errs }));
    if (visible) { await p.goBack().catch(() => {}); await p.waitForTimeout(1500); const s2 = await state(p); check(`L2-atras-${role}-${lang}`, !s2.t && (!/^\/(app|admin|therapist|board)/.test(s2.url) || /login/.test(s2.url)), JSON.stringify({ url: s2.url, token: !!s2.t })); }
    await ctx.close();
  }
  // L3: falla del servidor
  for (const mode of ['500', '401', 'red']) {
    const fresh = await mkUser('persona'); const { ctx, p } = await open(fresh);
    await ctx.route('**/api/logout', r => mode === 'red' ? r.abort('internetdisconnected') : r.fulfill({ status: Number(mode), contentType: 'application/json', body: '{"error":"x"}' }));
    await p.goto(PR + ROUTE.persona, { waitUntil: 'load' }); await p.waitForTimeout(1800); await clickSignOut(p, 'es'); await p.waitForTimeout(2500);
    const s = await state(p); check('L3-falla-' + mode, !s.t && s.pend.length === 0 && s.url === '/', JSON.stringify(s)); await ctx.close();
  }
  // L5: doble clic y dos pestañas
  {
    const fresh = await mkUser('persona'); const { ctx, p, logout } = await open(fresh); await p.goto(PR + ROUTE.persona, { waitUntil: 'load' }); await p.waitForTimeout(1800);
    await clickSignOut(p, 'es', 'dbl'); await p.waitForTimeout(2500); check('L5-doble-clic-una-llamada', logout.length === 1, 'llamadas=' + logout.length);
    const f2 = await mkUser('persona'); const { ctx: c2, p: p1 } = await open(f2); await p1.goto(PR + ROUTE.persona, { waitUntil: 'load' }); const p2 = await c2.newPage(); await p2.goto(PR + '/app/diary', { waitUntil: 'load' }); await p2.waitForTimeout(1500);
    await p1.bringToFront(); await clickSignOut(p1, 'es'); await p1.waitForTimeout(2500); await p2.reload({ waitUntil: 'load' }); await p2.waitForTimeout(2000);
    const s2 = await state(p2); check('L5-otra-pestana-pide-login', /login|^\/$/.test(s2.url) && !s2.t, JSON.stringify(s2)); await ctx.close(); await c2.close();
  }
  // L6: teclado y responsive
  for (const lang of ['es', 'en']) for (const [role, w] of [['persona', 320], ['persona', 375], ['persona', 768], ['persona', 1440], ['admin', 320], ['therapist', 320], ['board', 375]]) {
    const fresh = await mkUser(role); const { ctx, p } = await open(fresh, { lang, w, h: 800 }); await p.goto(PR + ROUTE[role], { waitUntil: 'load' }); await p.waitForTimeout(1800);
    const info = await p.evaluate(n => { const x = [...document.querySelectorAll('button')].find(b => b.innerText.trim() === n); if (!x) return null; const r = x.getBoundingClientRect(); return { h: Math.round(r.height), inView: r.right <= innerWidth + 1 && r.left >= -1, hs: document.documentElement.scrollWidth > innerWidth + 1 }; }, BTN[lang]);
    let kb = false;
    if (info) {
      await p.locator('button', { hasText: new RegExp('^' + BTN[lang] + '$') }).first().focus();
      const f = await p.evaluate(() => { const a = document.activeElement; const cs = getComputedStyle(a); return { tag: a.tagName, outline: cs.outlineStyle !== 'none' || cs.boxShadow !== 'none' }; });
      await p.keyboard.press('Enter'); await p.waitForTimeout(900);
      if (await p.getByRole('button', { name: BTN[lang], exact: true }).count() > 1) { const last = p.getByRole('button', { name: BTN[lang], exact: true }).last(); if (await last.isDisabled()) { await p.locator('button', { hasText: '🙂' }).last().focus(); await p.keyboard.press('Enter'); await p.waitForTimeout(400); } await last.focus(); await p.keyboard.press('Enter'); }
      await p.waitForTimeout(2500); kb =f.tag === 'BUTTON' && f.outline && (await state(p)).url === '/';
    }
    check(`L6-${role}-${lang}-${w}`, info && info.h >= 40 && info.inView && !info.hs && kb, JSON.stringify({ ...info, teclado_ok: kb }));
    if (role === 'persona' && w === 320 && lang === 'es') await p.screenshot({ path: path.join(OUT, 'dashboard-320-es.png') });
    await ctx.close();
  }
  // L8: XSS en el nombre mostrado y token revocado sin datos en la URL
  {
    const xss = await mkUser('persona', '<img src=x onerror="window.__x136=1">'); const { ctx, p } = await open(xss); await p.goto(PR + ROUTE.persona, { waitUntil: 'load' }); await p.waitForTimeout(2200);
    const ex = await p.evaluate(() => window.__x136 === 1); const url = p.url(); await clickSignOut(p, 'es'); await p.waitForTimeout(2200);
    check('L8-xss-nombre-no-ejecuta-y-token-revocado', !ex && !/token|eyJ/.test(url) && await G('/api/diary', xss.token) === 401, JSON.stringify({ ejecutado: ex, url_con_token: /token|eyJ/.test(url) })); await ctx.close();
  }
  fs.writeFileSync(path.join(OUT, 'resultados-136.json'), JSON.stringify(out, null, 1)); console.log('RESUMEN', out.filter(o => o.ok).length + '/' + out.length); await b.close();
})().catch(e => { console.log(JSON.stringify({ id: 'ERROR', detail: String(e.stack).slice(0, 600) })); process.exit(1); });
