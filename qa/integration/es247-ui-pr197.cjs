// [QA-Claude] ES-247 · PR #197 permisos de las fuentes de El Puente con respuesta perdida + foco E190-1, en Chromium real contra el servidor REAL
// (Postgres embebido, migraciones, build real). La respuesta perdida es REAL (route.fetch() aplica la petición y luego route.abort()). Siempre se contrasta pantalla vs FILA de Consents. Solo datos sintéticos, 0 IA.
// Uso: PLAYWRIGHT_MODULE=<ruta> PLAYWRIGHT_BROWSERS_PATH=<ruta> QA_SUT=<clon> QA_API=<servidor> DATABASE_URL=<base> QA_JWT_SECRET=<clave> AXE_PATH=<axe> OUT=<capturas> [CONTROL=1] node qa/integration/es247-ui-pr197.cjs
const { createRequire } = require('node:module'); const path = require('node:path'); const fs = require('node:fs'); const { randomBytes } = require('node:crypto');
const E = process.env; const req = createRequire(path.join(E.QA_SUT, 'backend', 'package.json')); const jwt = req('jsonwebtoken'); const { Client } = req('pg');
const { chromium } = require(E.PLAYWRIGHT_MODULE || 'playwright'); const API = E.QA_API, OUT = E.OUT || '.'; fs.mkdirSync(OUT, { recursive: true });
const CONTROL = E.CONTROL === '1'; const AXE = fs.readFileSync(E.AXE_PATH, 'utf8');
const results = []; const check = (id, ok, d = '') => { results.push({ id, ok: !!ok, detail: String(d).slice(0, 420) }); console.log(JSON.stringify({ id, ok: !!ok, detail: String(d).slice(0, 420) })); }; const info = (id, d) => { results.push({ id, info: String(d).slice(0, 420) }); console.log(JSON.stringify({ id, info: String(d).slice(0, 420) })); };
const SRC = path.join(E.QA_SUT, 'frontend', 'src'); const SOURCES = ['chat', 'diary', 'resume'];
const EMOJI = /[\p{Extended_Pictographic}★☆✓✔ℹ]/u, RAWKEY = /\b(src|dlg|bridge)_[a-z0-9_]{2,}\b/;
(async () => {
  const db = new Client({ connectionString: E.DATABASE_URL, ssl: false }); await db.connect(); const q = async (s, p = []) => (await db.query(s, p)).rows; const stamp = Date.now();
  const mk = async (tag, role = 'user') => { const email = `qa247-${tag}-${stamp}@example.test`; await fetch(API + '/api/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'QA247 ' + tag, email, password: randomBytes(12).toString('base64url') + 'aA1!' }) }); if (role !== 'user') await q('update "Users" set role=$1 where email=$2', [role, email]); const u = (await q('select id,name,role from "Users" where email=$1', [email]))[0]; return { ...u, email, token: jwt.sign({ id: u.id, name: u.name, role: u.role, iatMs: Date.now() }, E.QA_JWT_SECRET, { expiresIn: '3h', jwtid: randomBytes(8).toString('hex') }) }; };
  const call = async (u, m, p, body) => { const r = await fetch(API + p, { method: m, headers: { Authorization: 'Bearer ' + u.token, ...(body !== undefined ? { 'content-type': 'application/json' } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) }); const text = await r.text(); let json = null; try { json = JSON.parse(text); } catch { /* */ } return { status: r.status, json, text }; };
  const P = await mk('p'); const purpose = s => 'insights_' + s;
  const dbState = async (u, s) => (await q(`select status from "Consents" where "UserId"=$1 and purpose=$2 order by id desc limit 1`, [u.id, purpose(s)]))[0]?.status ?? null;
  const seed = async (u, map) => { for (const s of SOURCES) { const want = map[s] ? 'granted' : 'revoked'; if ((await dbState(u, s)) !== want) await call(u, 'PUT', '/api/consents/' + purpose(s), { status: want }); } };
  const browser = await chromium.launch({ headless: true });
  const T = { es: { pill: 'Sin confirmar', check: 'Comprobar', off: 'Retiraste el permiso', unsureOff: 'No pudimos confirmar si se retiró', notSeen: 'Todavía no vemos retirado', saveErr: 'No pudimos guardar', unsureOn: 'No pudimos confirmar si se autorizó' }, en: { pill: 'Unconfirmed', check: 'Check', off: 'You withdrew the permission', unsureOff: 'We could not confirm whether the permission was withdrawn', notSeen: 'We do not see the permission withdrawn', saveErr: 'We could not save', unsureOn: 'We could not confirm whether the analysis' } };
  // mode del PUT: 'ok' | 'lose-reply' | 'lose-request' | '500-applied' | '500-not-applied' | '401' | 'slow-applied:ms'; failReads: la relectura de GET /api/consents falla tras el PUT
  const open = async (who, { lang = 'es', vp = { width: 1100, height: 1000 }, scheme = 'light' } = {}) => {
    const ctx = await browser.newContext({ viewport: vp, colorScheme: scheme });
    await ctx.addInitScript(([t, r, l]) => { try { localStorage.setItem('elevation_token', t); localStorage.setItem('elevation_role', r); localStorage.setItem('elv_lang', l); localStorage.setItem('elevation_lang', l); } catch { /* */ } }, [who.token, who.role, lang]);
    const page = await ctx.newPage(); const ctl = { mode: 'ok', failReads: false, putDone: false, puts: [], gets: 0, delay: 0 }; const errs = [], logs = [];
    page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { logs.push(m.text()); if (m.type() === 'error' && !/40[0-9]|50[0-9]|Failed to load resource|ERR_|net::/.test(m.text())) errs.push(m.text()); });
    await page.route('**/api/consents**', async route => {
      const r = route.request(); const u = new URL(r.url());
      if (r.method() === 'PUT') {
        ctl.puts.push(u.pathname + ' ' + r.postData()); if (ctl.delay) await new Promise(res => setTimeout(res, ctl.delay));
        const m = ctl.mode; if (m !== 'ok') ctl.mode = 'ok'; ctl.putDone = true;
        if (m === 'lose-request') return route.abort('connectionreset');
        if (m === '401') return route.fulfill({ status: 401, json: { error: 'Sesión cerrada o inválida. / Session closed or invalid.' } });
        if (m === '500-not-applied') return route.fulfill({ status: 500, json: { error: 'Error en el servidor' } });
        const resp = await route.fetch(); if (m === 'lose-reply') return route.abort('connectionreset'); if (m === '500-applied') return route.fulfill({ status: 500, json: { error: 'Error en el servidor' } });
        return route.fulfill({ response: resp });
      }
      if (r.method() === 'GET') { ctl.gets++; if (ctl.failReads && ctl.putDone) return route.abort('connectionreset'); }
      return route.continue();
    });
    await page.goto(API + '/app/bridge'); await page.locator('[data-source="chat"]').first().waitFor({ timeout: 15000 }).catch(() => {}); await page.waitForTimeout(600);
    return { ctx, page, ctl, errs, logs };
  };
  const sw = (page, s) => page.locator(`[role="switch"][data-source="${s}"]`);
  const src = (page, s) => page.locator(`[data-source="${s}"]`);
  const checked = async (page, s) => (await sw(page, s).count()) ? await sw(page, s).getAttribute('aria-checked') : null;
  const visibleText = (page) => page.evaluate(() => document.body.textContent.replace(/\s+/g, ' '));
  const axeOn = async (page) => { await page.evaluate(AXE); const r = await page.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } })); return r.violations.map(v => v.id + '(' + v.nodes.length + ')'); };
  const confirmIfDialog = async (page) => { const ok = page.locator('.bridge-modal .bridge-ok'); if (await ok.count()) await ok.click(); };
  const toggle = async (page, s, on) => { await sw(page, s).click(); if (on) { await page.locator('.bridge-modal').waitFor({ timeout: 4000 }); await confirmIfDialog(page); } };
  const settle = (page, ms = 1500) => page.waitForTimeout(ms);

  // ── P1/P2 · respuesta perdida en ambos sentidos, tres fuentes, ES y EN
  for (const lang of ['es', 'en']) for (const s of SOURCES) for (const on of [true, false]) {
    await seed(P, { [s]: !on }); const { ctx, page, ctl, errs } = await open(P, { lang }); const before = await checked(page, s);
    ctl.mode = 'lose-reply'; await toggle(page, s, on); await settle(page); const st = await dbState(P, s); const sh = await checked(page, s); const alert = await page.getByRole('alert').filter({ hasText: /.+/ }).count();
    check(`P${on ? 1 : 2}-${lang}-${s} respuesta perdida al ${on ? 'ENCENDER' : 'APAGAR'}: la base queda ${on ? 'granted' : 'revoked'} y la pantalla lo muestra (${on ? 'encendido' : 'apagado'}) sin error`, before === (on ? 'false' : 'true') && st === (on ? 'granted' : 'revoked') && sh === (on ? 'true' : 'false') && alert === 0 && !errs.length, `antes=${before} base=${st} pantalla=${sh} alertas=${alert} errs=${errs.length}`);
    await ctx.close();
  }
  if (CONTROL) { fs.writeFileSync(path.join(__dirname, '..', 'evidence', 'ES-247-control-main.json'), JSON.stringify(results, null, 1)); console.log('RESUMEN-CONTROL ' + JSON.stringify({ total: results.filter(r => 'ok' in r).length, fallos: results.filter(r => r.ok === false).length })); process.exit(0); }

  // ── P3 · la petición no llega
  for (const lang of ['es', 'en']) for (const on of [true, false]) {
    await seed(P, { chat: !on }); const { ctx, page, ctl } = await open(P, { lang }); ctl.mode = 'lose-request'; await toggle(page, 'chat', on); await settle(page);
    const txt = await visibleText(page); const st = await dbState(P, 'chat'); const sh = await checked(page, 'chat');
    const rx = on ? new RegExp(T[lang].saveErr) : new RegExp(T[lang].notSeen);
    check(`P3-${lang}-${on ? 'on' : 'off'} la petición no llega: la base NO cambia (${on ? 'revoked' : 'granted'}), el interruptor sigue igual y el aviso dice la verdad`, st === (on ? 'revoked' : 'granted') && sh === (on ? 'false' : 'true') && rx.test(txt) && !new RegExp(T[lang].off).test(txt), `base=${st} pantalla=${sh} aviso=${rx.test(txt)}`);
    await ctx.close();
  }
  // ── P4 · respuesta perdida y relectura caída
  for (const lang of ['es', 'en']) for (const s of SOURCES) for (const on of [true, false]) {
    await seed(P, { chat: false, diary: false, resume: false, [s]: !on }); const { ctx, page, ctl } = await open(P, { lang });
    ctl.mode = 'lose-reply'; ctl.failReads = true; await toggle(page, s, on); await settle(page); const txt = await visibleText(page);
    const others = SOURCES.filter(x => x !== s); const otherSw = []; for (const o of others) otherSw.push(await sw(page, o).count());
    const checkBtn = page.getByRole('button', { name: T[lang].check, exact: true }); const base = await dbState(P, s);
    const expectMsg = new RegExp(on ? T[lang].unsureOn : T[lang].unsureOff);
    check(`P4a-${lang}-${s}-${on ? 'on' : 'off'} sin poder releer: SIN interruptor de esa fuente, pill «${T[lang].pill}», «${T[lang].check}» y aviso específico; las otras 2 fuentes conservan su interruptor; la base realmente es ${on ? 'granted' : 'revoked'}`, (await sw(page, s).count()) === 0 && (await page.locator('.bridge-pill', { hasText: T[lang].pill }).count()) === 1 && (await checkBtn.count()) === 1 && expectMsg.test(txt) && otherSw.every(n => n === 1) && base === (on ? 'granted' : 'revoked'), `interruptor=${await sw(page, s).count()} pill=${await page.locator('.bridge-pill', { hasText: T[lang].pill }).count()} btn=${await checkBtn.count()} aviso=${expectMsg.test(txt)} otros=${otherSw} base=${base}`);
    if (lang === 'es' && s === 'chat') {
      const analyze = await page.locator(`li:has([data-source="${s}"]) button`).allInnerTexts(); info('P4b botones de la fuente sin confirmar', JSON.stringify(analyze));
      await checkBtn.click(); await settle(page, 900); const stillUnsure = (await page.locator('.bridge-pill', { hasText: T[lang].pill }).count()) === 1;
      check('P4c «Comprobar» con la lectura TODAVÍA caída: sigue «Sin confirmar» (no inventa un estado) y se puede repetir', stillUnsure && (await checkBtn.count()) === 1, 'sigue=' + stillUnsure);
      ctl.failReads = false; await checkBtn.click(); await settle(page, 1200); const t2 = await visibleText(page); const shown = await checked(page, s);
      check(`P4d «Comprobar» con la lectura restablecida deja la pantalla = base (${on ? 'encendido' : 'apagado'}), sin pill ni botón`, shown === (on ? 'true' : 'false') && (await page.locator('.bridge-pill', { hasText: T[lang].pill }).count()) === 0 && (await checkBtn.count()) === 0, `pantalla=${shown} base=${await dbState(P, s)}`);
    }
    await ctx.close();
  }
  // ── P5 · 5xx, lentitud y 401
  for (const [mode, applied] of [['500-applied', true], ['500-not-applied', false]]) for (const on of [true, false]) {
    await seed(P, { chat: !on }); const { ctx, page, ctl } = await open(P, {}); ctl.mode = mode;
    if (mode === '500-applied') { const real = on ? 'granted' : 'revoked'; ctl.mode = 'lose-reply'; /* aplica y devuelve 500 */ ctl.mode = '500-applied'; }
    await toggle(page, 'chat', on); await settle(page); const st = await dbState(P, 'chat'); const sh = await checked(page, 'chat'); const txt = await visibleText(page);
    check(`P5-${mode}-${on ? 'on' : 'off'} PUT con 500 ${applied ? '(el servidor SÍ lo aplicó)' : '(NO lo aplicó)'}: la pantalla relee y coincide con la base (${st}); no queda «${T.es.pill}» porque la lectura funciona`, sh === (st === 'granted' ? 'true' : 'false') && (await page.locator('.bridge-pill', { hasText: T.es.pill }).count()) === 0, `base=${st} pantalla=${sh}`);
    await ctx.close();
  }
  { await seed(P, { chat: true }); const { ctx, page, ctl } = await open(P, {}); ctl.delay = 16500; ctl.mode = 'ok'; await sw(page, 'chat').click(); await page.waitForTimeout(18500); const st = await dbState(P, 'chat'); const sh = await checked(page, 'chat'); const txt = await visibleText(page);
    info('P5c PUT que tarda más de 15 s y se aplica DESPUÉS de que el cliente releyó: pantalla vs base (observación)', `base=${st} pantalla=${sh} aviso=${/Todavía no vemos retirado/.test(txt)}`); check('P5c con un PUT lento la pantalla NUNCA afirma que se retiró (no hay mensaje de éxito) cuando al releer aún no estaba retirado', !/Retiraste el permiso/.test(txt), 'aviso_no_retirado=' + /Todavía no vemos retirado/.test(txt)); await ctx.close(); }
  { await seed(P, { chat: true }); const { ctx, page, ctl } = await open(P, {}); ctl.mode = '401'; await sw(page, 'chat').click().catch(() => {}); await page.waitForTimeout(1800); const txt = await visibleText(page); const url = page.url();
    info('P5d 401 en el PUT', `url=${url.replace(API, '')} login=${/iniciar sesi|sign in|ingresa/i.test(txt)}`);
    check('P5e un 401 NO se trata como «Sin confirmar»', (await page.locator('.bridge-pill', { hasText: T.es.pill }).count()) === 0, url.replace(API, '')); await ctx.close(); }

  // ── P6 · efectos laterales
  { await seed(P, { chat: true, diary: true, resume: false }); const { ctx, page, ctl, logs } = await open(P, {}); const analyzeBefore = await page.getByRole('button', { name: /Analizar/ }).evaluateAll(b => b.filter(x => !x.disabled).length);
    ctl.mode = 'lose-reply'; ctl.failReads = true; await sw(page, 'chat').click(); await settle(page); const chatBtns = await page.locator('li:has([data-source="chat"]) button').allInnerTexts(); const analyzeAfter = await page.getByRole('button', { name: /Analizar/ }).evaluateAll(b => b.filter(x => !x.disabled).length); const chatAnalyzeDisabled = await page.locator('li:has([data-source="chat"]) button', { hasText: /Analizar/ }).evaluateAll(b => b.every(x => x.disabled));
    check('P6a con la fuente «Sin confirmar» su botón «Analizar» queda DESHABILITADO (y «Comprobar» activo); las demás fuentes confirmadas conservan el suyo habilitado', chatAnalyzeDisabled && chatBtns.some(b => /comprobar/i.test(b)) && analyzeAfter === analyzeBefore - 1, `antes=${analyzeBefore} después=${analyzeAfter} botones=${JSON.stringify(chatBtns)}`); await ctx.close(); }
  { await seed(P, { chat: false }); const { ctx, page, ctl } = await open(P, {}); await sw(page, 'chat').click(); await page.locator('.bridge-modal').waitFor(); const ok = page.locator('.bridge-modal .bridge-ok'); ctl.delay = 800;
    await ok.click(); await ok.click({ force: true, timeout: 400 }).catch(() => {}); await page.keyboard.press('Enter').catch(() => {}); await settle(page, 2500);
    check('P6b doble clic / Enter repetido al confirmar: UNA sola petición PUT y la base queda granted', ctl.puts.length === 1 && (await dbState(P, 'chat')) === 'granted', `puts=${ctl.puts.length}`); await ctx.close(); }
  { await seed(P, { chat: true }); const { ctx, page, ctl } = await open(P, {}); ctl.delay = 800; await sw(page, 'chat').dblclick({ force: true }).catch(() => {}); await settle(page, 2500);
    check('P6c doble clic en el interruptor de retiro: UNA sola petición PUT', ctl.puts.length === 1, `puts=${ctl.puts.length}`); await ctx.close(); }
  { await seed(P, { chat: true, diary: true, resume: true }); const { ctx, page, ctl, logs } = await open(P, {}); ctl.mode = 'lose-reply'; ctl.failReads = true; await sw(page, 'diary').click(); await settle(page);
    const store = await page.evaluate(() => JSON.stringify([Object.entries(localStorage).filter(([k]) => k !== 'elevation_token'), Object.entries(sessionStorage)]));
    check('P6d sin token ni correo de la persona en consola ni en almacenamiento (salvo la sesión) durante los fallos', !new RegExp(P.token.slice(-25)).test(logs.join('\n') + store) && !new RegExp(P.email).test(logs.join('\n') + store), `consola=${logs.length}`); await ctx.close(); }

  // ── F1 · foco (E190-1)
  for (const lang of ['es', 'en']) {
    await seed(P, { chat: true, diary: false }); const { ctx, page, ctl } = await open(P, { lang }); const tags = [];
    ctl.delay = 1200; await sw(page, 'chat').focus(); await sw(page, 'chat').click(); for (const t of [200, 600, 1000]) { await page.waitForTimeout(t === 200 ? 200 : 400); tags.push(await page.evaluate(() => document.activeElement && document.activeElement.tagName)); }
    await settle(page, 1500); const endFocus = await page.evaluate(() => document.activeElement && document.activeElement.getAttribute('data-source'));
    check(`F1a-${lang} guardar con el interruptor: durante el guardado el foco NO está en BODY (${tags.join(',')}) y al terminar vuelve al interruptor «chat»`, tags.every(t => t !== 'BODY') && endFocus === 'chat', `${tags} fin=${endFocus}`);
    ctl.delay = 1000; await sw(page, 'diary').focus(); await sw(page, 'diary').click(); await page.locator('.bridge-modal').waitFor(); await page.locator('.bridge-modal .bridge-ok').click(); const during = []; for (let i = 0; i < 3; i++) { await page.waitForTimeout(250); during.push(await page.evaluate(() => { const a = document.activeElement; return a ? a.tagName + (a.getAttribute('role') ? ':' + a.getAttribute('role') : '') : null; })); }
    await settle(page, 1800); const end2 = await page.evaluate(() => document.activeElement && document.activeElement.getAttribute('data-source'));
    check(`F1b-${lang} guardar desde el diálogo: el foco no cae a BODY durante el guardado (${during.join(',')}) y termina en el interruptor «diary»`, during.every(t => t && t !== 'BODY') && end2 === 'diary', `${during} fin=${end2}`);
    await seed(P, { chat: true, diary: false }); await page.reload(); await page.locator('[data-source="chat"]').first().waitFor(); ctl.putDone = false; ctl.mode = 'lose-reply'; ctl.failReads = true; ctl.delay = 0; await sw(page, 'chat').focus(); await sw(page, 'chat').click(); await settle(page); const unsureFocus = await page.evaluate(() => document.activeElement && (document.activeElement.getAttribute('data-source') || document.activeElement.tagName));
    check(`F1c-${lang} tras un resultado incierto el foco queda en «${T[lang].check}» de esa fuente (no se pierde)`, unsureFocus === 'chat' && /Comprobar|Check/.test(await page.evaluate(() => document.activeElement.textContent)), String(unsureFocus));
    ctl.failReads = false; ctl.delay = 700; await page.getByRole('button', { name: T[lang].check, exact: true }).click(); const dc = []; for (let i = 0; i < 2; i++) { await page.waitForTimeout(250); dc.push(await page.evaluate(() => document.activeElement && document.activeElement.tagName)); } await settle(page, 1500); const endC = await page.evaluate(() => document.activeElement && document.activeElement.getAttribute('data-source'));
    check(`F1d-${lang} «${T[lang].check}»: el foco no cae a BODY y termina en el interruptor de la fuente`, dc.every(t => t !== 'BODY') && endC === 'chat', `${dc} fin=${endC}`);
    // Esc del diálogo (regresión ES-236)
    await seed(P, { chat: true, diary: false }); await page.reload(); await page.locator('[data-source="diary"]').first().waitFor(); await sw(page, 'diary').focus(); await page.keyboard.press('Space'); await page.locator('.bridge-modal').waitFor(); const inDlg = await page.evaluate(() => !!document.activeElement.closest('.bridge-modal'));
    for (let i = 0; i < 8; i++) await page.keyboard.press('Tab'); const trapped = await page.evaluate(() => !!document.activeElement.closest('.bridge-modal')); await page.keyboard.press('Escape'); await page.waitForTimeout(400);
    check(`F1e-${lang} regresión ES-236: foco dentro del diálogo, Tab atrapado, Esc lo cierra y devuelve el foco al interruptor`, inDlg && trapped && (await page.locator('.bridge-modal').count()) === 0 && (await page.evaluate(() => document.activeElement.getAttribute('data-source'))) === 'diary', `dentro=${inDlg} atrapado=${trapped}`);
    await ctx.close();
  }

  // ── A1 · accesibilidad y responsive
  for (const lang of ['es', 'en']) for (const [name, vp] of [['390', { width: 390, height: 844 }], ['1360', { width: 1360, height: 900 }]]) {
    await seed(P, { chat: true, diary: false, resume: false }); const { ctx, page, ctl } = await open(P, { lang, vp }); const v = [];
    v.push(['lista', await axeOn(page)]);
    await sw(page, 'diary').click(); await page.locator('.bridge-modal').waitFor(); v.push(['diálogo', await axeOn(page)]); await page.keyboard.press('Escape'); await page.waitForTimeout(300);
    ctl.mode = 'lose-reply'; ctl.failReads = true; await sw(page, 'chat').click(); await settle(page); v.push(['sin confirmar', await axeOn(page)]);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1); const small = await page.evaluate(() => [...document.querySelectorAll('.bridge-sources button, .bridge-sources [role=switch]')].filter(e => { const r = e.getBoundingClientRect(); return r.width && (r.width < 24 || r.height < 24); }).length);
    const txt = await visibleText(page); await page.screenshot({ path: path.join(OUT, `es247-${lang}-${name}-sinconfirmar.png`) });
    check(`A1-${lang}-${name} axe 0 en lista, diálogo y «sin confirmar»; sin desborde horizontal; objetivos ≥ 24 px; sin claves crudas`, v.every(([, x]) => x.length === 0) && !overflow && small === 0 && !RAWKEY.test(txt), JSON.stringify(v) + ` desborde=${overflow} pequeños=${small}`);
    await ctx.close();
  }
  // oscuro: se mide y se declara
  { await seed(P, { chat: true }); const { ctx, page, ctl } = await open(P, { scheme: 'dark' }); ctl.mode = 'lose-reply'; ctl.failReads = true; await sw(page, 'chat').click(); await settle(page); info('A1-oscuro axe en «sin confirmar» (se mide y se declara)', JSON.stringify(await axeOn(page))); await ctx.close(); }
  // textos: ES/EN completos, sin emojis nuevos ni términos clínicos en las cadenas nuevas
  { const copy = fs.readFileSync(path.join(SRC, 'bridge', 'copy.ts'), 'utf8'); const keys = ['src_unsure', 'src_check', 'src_unsure_on', 'src_unsure_off', 'src_not_seen_off']; const both = keys.every(k => (copy.match(new RegExp(`\\b${k}:`, 'g')) || []).length === 2);
    const vals = keys.flatMap(k => [...copy.matchAll(new RegExp(`\\b${k}:\\s*'([^']*)'`, 'g'))].map(m => m[1]));
    check('T1 las 5 cadenas nuevas existen en ES y EN, sin emojis ni términos clínicos/de diagnóstico', both && vals.length === 10 && !vals.some(v => EMOJI.test(v) || /diagn|terap|trastorno|diagnos|therap|disorder/i.test(v)), `claves=${both} valores=${vals.length}`); }

  fs.writeFileSync(path.join(__dirname, '..', 'evidence', 'ES-247-ui-pr197.json'), JSON.stringify(results, null, 1));
  console.log('RESUMEN-ES247 ' + JSON.stringify({ total: results.filter(r => 'ok' in r).length, fallos: results.filter(r => r.ok === false).map(r => r.id.slice(0, 40)) }));
  await browser.close(); await db.end(); process.exit(0);
})().catch(e => { console.error('FATAL', e); process.exit(2); });
