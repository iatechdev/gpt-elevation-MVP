// [QA-Claude] ES-132 · PR #128: pantallas de recuperación de contraseña (F8–F11, S6 en navegador). Servidor local A con el merge del PR, Chromium, datos SINTÉTICOS, 0 tokens de IA.
// Uso: A=http://127.0.0.1:8128 MAILDIR=<carpeta con mail-a.jsonl> OUT=<carpeta> node qa/integration/es132-ui.cjs
const fs = require('fs'); const path = require('path'); const E = process.env; const { chromium } = require('C:/Users/Usuario/tools/playwright/node_modules/playwright');
const A = E.A, OUT = E.OUT; fs.mkdirSync(OUT, { recursive: true }); const out = []; const stamp = Date.now(); const sleep = ms => new Promise(r => setTimeout(r, ms));
const check = (id, ok, d = '') => { out.push({ id, ok: !!ok, detail: String(d).slice(0, 400) }); console.log(JSON.stringify({ id, ok: !!ok, detail: String(d).slice(0, 400) })); };
const J = async (p, body) => { const r = await fetch(A + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); return { s: r.status, j: await r.json().catch(() => ({})) }; };
const mails = to => fs.readFileSync(path.join(E.MAILDIR, 'mail-a.jsonl'), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)).filter(m => m.to === to);
const linkOf = m => (m.text.match(/(http[^\s]+#token=[^\s]+)/) || [])[1];
const OLD = 'Clave-Original-QU132-' + stamp + 'aA!', NEW = 'Clave-Nueva-QU132-' + stamp + 'aA!'; let n = 0;
const mk = async tag => { const email = `qu132-${tag}-${stamp}-${n++}@example.test`; await J('/api/register', { name: 'QU132', email, password: OLD }); return email; };
const T = { es: { forgot: '¿Olvidaste tu contraseña?', sent: /te enviaremos un enlace/i, strongHint: /contraseña/i }, en: { forgot: 'Forgot your password?', sent: /we will send you a link/i } };
const VOSEO = /\b(tenés|podés|querés|sos|vos|olvidaste vos|elegí|ingresá|hacé|escribí)\b/i; const ES_IN_EN = /\b(contraseña|olvidaste|enviar|correo|enlace|volver|guardar)\b/i;
(async () => {
  const b = await chromium.launch();
  const open = async (lang, w = 1440, h = 900) => { const ctx = await b.newContext({ viewport: { width: w, height: h } }); await ctx.addInitScript(l => { try { localStorage.setItem('elv_lang', l); } catch { /* */ } }, lang); const p = await ctx.newPage(); const reqs = []; p.on('request', r => reqs.push({ u: r.url(), ref: r.headers()['referer'] || '', m: r.method(), body: r.postData() || '' })); const errs = []; p.on('pageerror', e => errs.push(String(e).slice(0, 120))); return { ctx, p, reqs, errs }; };
  const body = p => p.evaluate(() => document.body.innerText);
  // F8: enlace solo en login, no en registro; ES y EN
  for (const lang of ['es', 'en']) {
    const { ctx, p } = await open(lang); await p.goto(A + '/login', { waitUntil: 'load' }); await p.waitForTimeout(1200);
    const inLogin = await p.getByText(T[lang].forgot, { exact: false }).count(); await p.goto(A + '/login?mode=register', { waitUntil: 'load' }); await p.waitForTimeout(1200); const inReg = await p.getByText(T[lang].forgot, { exact: false }).count();
    await p.goto(A + '/login', { waitUntil: 'load' }); await p.waitForTimeout(800); await p.getByText(T[lang].forgot, { exact: false }).first().click(); await p.waitForTimeout(1200);
    check('F8-enlace-solo-en-login-' + lang, inLogin >= 1 && inReg === 0 && new URL(p.url()).pathname === '/forgot-password', `login=${inLogin} registro=${inReg} destino=${new URL(p.url()).pathname}`); await ctx.close();
  }
  // F8/F9: flujo completo por la interfaz en ES y EN
  for (const lang of ['es', 'en']) {
    const email = await mk('flujo-' + lang); const { ctx, p, reqs, errs } = await open(lang); await p.goto(A + '/forgot-password', { waitUntil: 'load' }); await p.waitForTimeout(1000);
    const t0 = await body(p); await p.locator('input[type=email]').fill(email); await p.keyboard.press('Enter'); await p.waitForSelector('[role=status]', { timeout: 8000 }).catch(() => {}); const t1 = await body(p);
    const neutro = await p.locator('[role=status]').innerText().catch(() => '');
    await p.screenshot({ path: path.join(OUT, `olvido-enviado-${lang}.png`) });
    let m = mails(email); for (let i = 0; i < 20 && !m.length; i++) { await sleep(200); m = mails(email); } const link = m[0] && linkOf(m[0]);
    check('F8-pide-enlace-mensaje-neutro-' + lang, !!link && (lang === 'es' ? /enlace/i.test(neutro) : /link/i.test(neutro)) && !(lang === 'en' && ES_IN_EN.test(t0 + t1)) && !(lang === 'es' && VOSEO.test(t0 + t1)), `estado="${neutro.slice(0, 90)}"`);
    // abrir el enlace del correo en una página nueva
    const { ctx: c2, p: p2, reqs: reqs2 } = await open(lang); await p2.goto(link, { waitUntil: 'load' }); await p2.waitForTimeout(1500);
    const urlTrasCargar = p2.url(); const hashLimpio = !/token/.test(urlTrasCargar) && !new URL(urlTrasCargar).hash; const tok = decodeURIComponent((link.match(/#token=(.+)$/) || [])[1]);
    const fugas = reqs2.filter(r => r.u.includes(tok) || r.ref.includes(tok) || (r.body.includes(tok) && !/password-reset\/confirm/.test(r.u)));
    check('S6-token-fuera-de-la-url-y-de-peticiones-' + lang, hashLimpio && fugas.length === 0, `url tras cargar=${new URL(urlTrasCargar).pathname}${new URL(urlTrasCargar).hash}; peticiones con el token fuera de /confirm=${fugas.length}`);
    // contraseña débil: política local; fuerte: éxito
    const pw = p2.locator('input[autocomplete=new-password]'); await pw.fill('corta1A'); await p2.keyboard.press('Enter'); await p2.waitForTimeout(700); const alerta = await p2.locator('[role=alert]').innerText().catch(() => ''); const llamadasConfirm = reqs2.filter(r => /password-reset\/confirm/.test(r.u)).length;
    check('F9-politica-local-sin-gastar-enlace-' + lang, alerta.length > 5 && llamadasConfirm === 0, `alerta="${alerta.slice(0, 100)}"; llamadas a confirm=${llamadasConfirm}`);
    await pw.fill(NEW); await p2.getByRole('button', { name: lang === 'es' ? /Guardar|Cambiar|Crear/i : /Save|Change|Create|Reset/i }).first().click().catch(async () => { await p2.keyboard.press('Enter'); }); await p2.waitForTimeout(1800); const tDone = await body(p2);
    await p2.screenshot({ path: path.join(OUT, `reset-listo-${lang}.png`) });
    check('F8-restablece-y-pantalla-final-' + lang, /✓/.test(tDone) && !(lang === 'en' && ES_IN_EN.test(tDone)) && !(lang === 'es' && VOSEO.test(tDone)), tDone.replace(/\s+/g, ' ').slice(0, 160));
    // iniciar sesión por la interfaz con la clave nueva
    await p2.getByRole('link').first().click().catch(() => {}); await p2.waitForTimeout(1200); await p2.goto(A + '/login', { waitUntil: 'load' }); await p2.locator('input[type=email]').fill(email); await p2.locator('input[type=password]').first().fill(NEW); await p2.keyboard.press('Enter'); await p2.waitForTimeout(3000);
    check('F8-login-con-clave-nueva-' + lang, /\/app|\/admin|\/therapist|\/board/.test(new URL(p2.url()).pathname), 'destino=' + new URL(p2.url()).pathname + (errs.length ? ' errores=' + errs.join('|') : ''));
    // F11: reutilizar el mismo enlace
    const { ctx: c3, p: p3 } = await open(lang); await p3.goto(link, { waitUntil: 'load' }); await p3.waitForTimeout(1200); await p3.locator('input[autocomplete=new-password]').fill(NEW + 'x'); await p3.keyboard.press('Enter'); await p3.waitForTimeout(1800); const t3 = await body(p3);
    check('F9-enlace-ya-usado-pide-uno-nuevo-' + lang, /forgot-password|reset-password/.test(p3.url()) && /(nuevo|new)/i.test(t3), t3.replace(/\s+/g, ' ').slice(0, 170)); await ctx.close(); await c2.close(); await c3.close();
  }
  // F9: sin token y token falso
  for (const lang of ['es', 'en']) { const { ctx, p } = await open(lang); await p.goto(A + '/reset-password', { waitUntil: 'load' }); await p.waitForTimeout(1200); const t = await body(p); const nuevo = await p.getByRole('link', { name: lang === 'es' ? /nuevo/i : /new/i }).count();
    check('F9-sin-token-' + lang, nuevo >= 1 && !(lang === 'en' && ES_IN_EN.test(t)), t.replace(/\s+/g, ' ').slice(0, 140)); await p.goto('about:blank'); await p.goto(A + '/reset-password#token=' + 'Ab3_'.repeat(11), { waitUntil: 'load' }); await p.locator('input[autocomplete=new-password]').fill(NEW); await p.keyboard.press('Enter'); await p.waitForTimeout(1500); const t2 = await body(p); check('F9-token-falso-' + lang, /(nuevo|new)/i.test(t2), t2.replace(/\s+/g, ' ').slice(0, 140)); await ctx.close(); }
  // F9: 429 y error de red simulados; estado "enviando"; doble envío
  { const { ctx, p } = await open('es'); await ctx.route('**/api/password-reset/request', r => r.fulfill({ status: 429, contentType: 'application/json', body: '{"code":"rate_limited"}' })); await p.goto(A + '/forgot-password', { waitUntil: 'load' }); await p.locator('input[type=email]').fill('a@example.test'); await p.keyboard.press('Enter'); await p.waitForSelector('[role=alert]', { timeout: 5000 }).catch(() => {}); const al = await p.locator('[role=alert]').innerText().catch(''); check('F9-429-mensaje-claro', al.length > 10 && !/\bundefined\b/.test(al), al.slice(0, 100)); await ctx.close(); }
  { const { ctx, p } = await open('es'); await ctx.route('**/api/password-reset/request', r => r.abort('internetdisconnected')); await p.goto(A + '/forgot-password', { waitUntil: 'load' }); await p.locator('input[type=email]').fill('a@example.test'); await p.keyboard.press('Enter'); await p.waitForSelector('[role=alert]', { timeout: 5000 }).catch(() => {}); const al = await p.locator('[role=alert]').innerText().catch(''); check('F9-error-de-red-mensaje-claro', al.length > 10, al.slice(0, 100)); await ctx.close(); }
  { const { ctx, p, reqs } = await open('es'); await ctx.route('**/api/password-reset/request', async r => { await sleep(1500); r.continue(); }); await p.goto(A + '/forgot-password', { waitUntil: 'load' }); await p.locator('input[type=email]').fill(`dbl-${stamp}@example.test`); const btn = p.locator('button[type=submit]'); await btn.dblclick().catch(() => {}); await p.waitForTimeout(300); const textoBusy = await btn.innerText(); const dis = await btn.isDisabled(); await p.waitForTimeout(2500);
    check('F11-doble-clic-una-sola-peticion-y-estado-enviando', reqs.filter(r => /password-reset\/request/.test(r.u) && r.m === 'POST').length === 1 && dis, `peticiones=${reqs.filter(r => /password-reset\/request/.test(r.u) && r.m === 'POST').length}; botón mientras envía="${textoBusy}" deshabilitado=${dis}`); await ctx.close(); }
  // F10: teclado y responsive
  for (const lang of ['es', 'en']) for (const w of [320, 390, 1440]) {
    const { ctx, p } = await open(lang, w, 800); await p.goto(A + '/forgot-password', { waitUntil: 'load' }); await p.waitForTimeout(1000);
    const m = await p.evaluate(() => { const bt = document.querySelector('button[type=submit]').getBoundingClientRect(); return { hs: document.documentElement.scrollWidth > innerWidth + 1, h: Math.round(bt.height), fits: bt.right <= innerWidth + 1 }; });
    await p.keyboard.press('Tab'); let reached = false, focusVisible = false; for (let i = 0; i < 8; i++) { const f = await p.evaluate(() => { const a = document.activeElement; const cs = getComputedStyle(a); return { tag: a.tagName, type: a.type || '', vis: cs.outlineStyle !== 'none' || cs.boxShadow !== 'none' }; }); if (f.type === 'email') { reached = true; focusVisible = f.vis; break; } await p.keyboard.press('Tab'); }
    check(`F10-forgot-${lang}-${w}`, !m.hs && m.fits && m.h >= 40 && reached, JSON.stringify({ ...m, tab_llega_al_correo: reached, foco_visible: focusVisible }));
    if (w === 320) { await p.screenshot({ path: path.join(OUT, `olvido-320-${lang}.png`) }); const email = await mk(`resp-${lang}`); await J('/api/password-reset/request', { email }); await sleep(600); const lk = linkOf(mails(email)[0]); await p.goto(lk, { waitUntil: 'load' }); await p.waitForTimeout(1200); const m2 = await p.evaluate(() => ({ hs: document.documentElement.scrollWidth > innerWidth + 1 })); await p.screenshot({ path: path.join(OUT, `reset-320-${lang}.png`) }); check(`F10-reset-${lang}-320`, !m2.hs, JSON.stringify(m2)); }
    await ctx.close();
  }
  fs.writeFileSync(path.join(OUT, 'resultados-ui-132.json'), JSON.stringify(out, null, 1)); console.log('RESUMEN', out.filter(o => o.ok).length + '/' + out.length); await b.close();
})().catch(e => { console.log(JSON.stringify({ id: 'ERROR', detail: String(e.stack).slice(0, 700) })); process.exit(1); });
