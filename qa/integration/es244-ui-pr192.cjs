// [QA-Claude] ES-244 · PR #192 «Compartir con mi profesional» tras un resultado incierto, en Chromium real contra el servidor REAL (Postgres embebido, migraciones, build real). Solo datos sintéticos, 0 IA.
// Uso: PLAYWRIGHT_MODULE=<ruta> PLAYWRIGHT_BROWSERS_PATH=<ruta> QA_SUT=<clon> QA_API=<servidor> DATABASE_URL=<base> QA_JWT_SECRET=<clave> OUT=<capturas> node qa/integration/es169-ui-pr187.cjs
const { createRequire } = require('node:module'); const path = require('node:path'); const fs = require('node:fs'); const { randomBytes } = require('node:crypto');
const E = process.env; const req = createRequire(path.join(E.QA_SUT, 'backend', 'package.json')); const jwt = req('jsonwebtoken'); const { Client } = req('pg');
const { chromium } = require(E.PLAYWRIGHT_MODULE || 'playwright'); const API = E.QA_API, OUT = E.OUT || '.'; fs.mkdirSync(OUT, { recursive: true });
const AXE = fs.readFileSync(E.AXE_PATH, 'utf8');
const results = []; const check = (id, ok, d = '') => { results.push({ id, ok: !!ok }); console.log(JSON.stringify({ id, ok: !!ok, detail: String(d).slice(0, 420) })); }; const info = (id, d) => console.log(JSON.stringify({ id, info: String(d).slice(0, 420) }));
const SRC = path.join(E.QA_SUT, 'frontend', 'src');
const FORBID = /terapeut|paciente|therapist|patient/i, EMOJI = /[\p{Extended_Pictographic}★☆✓✔ℹ]/u, RAWKEY = /\b(mp|room_t|mt|therapist)_[a-z0-9_]{2,}\b/;
(async () => {
  const db = new Client({ connectionString: E.DATABASE_URL, ssl: false }); await db.connect(); const q = async (s, p = []) => (await db.query(s, p)).rows; const stamp = Date.now();
  const mk = async (tag, role = 'user', name = null) => { const email = `qa169-${tag}-${stamp}@example.test`; await fetch(API + '/api/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: name || 'QA169 ' + tag, email, password: randomBytes(12).toString('base64url') + 'aA1!' }) }); if (role !== 'user') await q('update "Users" set role=$1 where email=$2', [role, email]); const u = (await q('select id,name,role from "Users" where email=$1', [email]))[0]; return { ...u, email, token: jwt.sign({ id: u.id, name: u.name, role: u.role, iatMs: Date.now() }, E.QA_JWT_SECRET, { expiresIn: '3h', jwtid: randomBytes(8).toString('hex') }) }; };
  const call = async (u, m, p, body) => { const r = await fetch(API + p, { method: m, headers: { Authorization: 'Bearer ' + u.token, ...(body !== undefined ? { 'content-type': 'application/json' } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) }); const text = await r.text(); let json = null; try { json = JSON.parse(text); } catch { /* */ } return { status: r.status, json, text }; };
  const share = (u, status = 'granted') => call(u, 'PUT', '/api/consents/therapist_sharing', { status });
  const link = (p, th) => q('update "Users" set "therapistId"=$1 where id=$2', [th.id, p.id]);
  const sessionRow = (p, th, whenMs, status, mood = null) => q('insert into "TherapySessions"("patientId","therapistId","scheduledAt",status,duration,"patientMoodAfter","createdAt","updatedAt") values($1,$2,$3,$4,50,$5,now(),now())', [p.id, th.id, new Date(Date.now() + whenMs).toISOString(), status, mood]);
  const consentOf = async (p) => (await q(`select status from "Consents" where "UserId"=$1 and purpose='therapist_sharing' order by id desc limit 1`, [p.id]))[0]?.status ?? null;
  const browser = await chromium.launch({ headless: true });
  const open = async (who, url, { lang = 'es', vp = { width: 1100, height: 900 }, routes = null, scheme = 'light', wait = 1800 } = {}) => {
    const ctx = await browser.newContext({ viewport: vp, colorScheme: scheme });
    await ctx.addInitScript(([t, r, l]) => { try { localStorage.setItem('elevation_token', t); localStorage.setItem('elevation_role', r); localStorage.setItem('elv_lang', l); localStorage.setItem('elevation_lang', l); } catch { /* */ } }, [who.token, who.role, lang]);
    const page = await ctx.newPage(); const reqs = [], errs = []; page.on('request', r => reqs.push({ m: r.method(), u: r.url(), b: r.postData() })); page.on('pageerror', e => errs.push(e.message));
    page.on('console', m => { if (m.type() === 'error' && !/40[0-9]|42[0-9]|50[0-9]|Failed to load resource|ERR_/.test(m.text())) errs.push(m.text()); });
    if (routes) await routes(page); await page.goto(API + url); await page.waitForTimeout(wait); return { ctx, page, reqs, errs };
  };
  const textOf = (page) => page.evaluate(() => { const t = [document.body.innerText]; document.querySelectorAll('*').forEach(e => { for (const a of ['aria-label', 'title', 'alt', 'placeholder']) { const v = e.getAttribute && e.getAttribute(a); if (v) t.push(v); } }); return t.join('\n'); });
  const axeOn = async (page) => { await page.evaluate(AXE); const r = await page.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } })); return r.violations.map(v => v.id + '(' + v.nodes.length + ')'); };
  const SW = (page) => page.getByRole('switch'); const RETRY = /Reintentar|Try again/; const UNLINK = /desvincularme|Stop sharing and unlink/;
  const myT = '**/api/sessions/user/my-therapist';

  // ── ES-244 · cola
  const TH = await mk('th', 'therapist', 'Dra. Prueba Uno'); const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const evSeq = async (u) => (await q(`select status from "ConsentEvents" where "UserId"=$1 and purpose='therapist_sharing' order by id`, [u.id]).catch(() => [])).map(r => r.status);
  const rowCount = async (u) => (await q(`select count(*)::int n from "Consents" where "UserId"=$1 and purpose='therapist_sharing'`, [u.id]))[0].n;
  const proView = async (u) => (await call(TH, 'GET', `/api/therapist/pacientes/${u.id}/historia`)).status;
  const prep = async (tag, initial) => { const u = await mk(tag); await link(u, TH); await share(u, initial); return u; };
  const FORBID = /terapeut|paciente|therapist|patient/i, EMOJI = /[\p{Extended_Pictographic}★☆✓✔ℹ]/u, RAWKEY = /\b(mt|mp|room_t|therapist)_[a-z0-9_]{2,}\b/;
  const putRoute = (kind) => async (page) => { await page.route('**/api/consents/therapist_sharing', async r => {
    if (r.request().method() !== 'PUT') return r.continue();
    try {
      if (kind === 'lost') { await r.fetch(); return await r.abort(); }
      if (kind === 'cut') return await r.abort();
      if (kind === '5xx-applied') { await r.fetch(); return await r.fulfill({ status: 502, contentType: 'text/plain', body: 'Bad gateway' }); }
      if (kind === '5xx-notapplied') return await r.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"x"}' });
      if (kind === 'slow-applied') { await r.fetch(); await sleep(16500); return await r.abort(); }
      if (kind === 'slow-notapplied') { await sleep(16500); return await r.abort(); }
      return await r.continue();
    } catch { /* el cliente ya cortó */ }
  }); };
  const state = async (page) => { const sw = SW(page); const has = await sw.count(); const ui = has ? await sw.getAttribute('aria-checked') : null; const txt = await textOf(page); const check_ = await page.getByRole('button', { name: /^(Comprobar|Check)$/ }).count(); return { has, ui, txt, check_ }; };
  const FALSE_FAIL = /No se pudo guardar|could not be saved|No pudimos guardar/i, SAID_SAVED = /Guardado|Saved/i;

  // ── U1 / U2 / U5: ENCENDER y APAGAR con distintas pérdidas
  const KINDS = ['lost', 'cut', '5xx-applied', '5xx-notapplied', 'slow-applied', 'slow-notapplied'];
  const bad1 = [], bad2 = [], infoU = [];
  for (const [dir, initial, target] of [['ENCENDER', 'revoked', 'granted'], ['APAGAR', 'granted', 'revoked']]) for (const kind of KINDS) for (const lang of (kind === 'lost' || kind === 'cut' ? ['es', 'en'] : ['es'])) {
    const u = await prep(`u-${dir[0]}-${kind}-${lang}`, initial); const o = await open(u, '/app/my-therapist', { lang, routes: putRoute(kind) }); const sw = SW(o.page);
    if ((await sw.getAttribute('aria-checked')) !== (initial === 'granted' ? 'true' : 'false')) (dir === 'ENCENDER' ? bad1 : bad2).push(`${kind}/${lang}: estado inicial mal`);
    await sw.click(); await o.page.waitForTimeout(/slow/.test(kind) ? 21000 : 3500);
    const s = await state(o.page), db = await consentOf(u), pv = await proView(u), applied = db === target, bad = dir === 'ENCENDER' ? bad1 : bad2; const tag = `${kind}/${lang}`;
    if (s.has) { if ((s.ui === 'true') !== (db === 'granted')) bad.push(`${tag}: interruptor ${s.ui} ≠ base ${db}`); } else if (!s.check_) bad.push(`${tag}: sin interruptor y sin «Comprobar»`);
    if (applied && FALSE_FAIL.test(s.txt)) bad.push(`${tag}: la base SÍ aplicó el cambio y la pantalla dice que no se pudo guardar`);
    if (!applied && SAID_SAVED.test(s.txt)) bad.push(`${tag}: la base NO aplicó el cambio y la pantalla dice guardado`);
    if (dir === 'APAGAR' && !applied && !(/siga viendo|may still see|todavía|still/i.test(s.txt) || s.ui === 'true')) bad.push(`${tag}: no se aplicó el apagado y la pantalla no advierte que el profesional sigue viendo`);
    if ((pv === 200) !== (db === 'granted')) bad.push(`${tag}: profesional ve=${pv} con permiso=${db}`);
    if ((await rowCount(u)) !== 1) bad.push(`${tag}: filas de Consents=${await rowCount(u)}`);
    infoU.push(`${dir}/${tag}: base=${db} interruptor=${s.ui ?? 'sin'}${s.check_ ? '+Comprobar' : ''} prof=${pv}`);
    // «Comprobar»/«Reintentar» lleva a coincidir con la base
    const cb = o.page.getByRole('button', { name: /^(Comprobar|Check)$/ }); if (await cb.count()) { await o.page.unroute('**/api/consents/therapist_sharing').catch(() => {}); await cb.first().click(); await o.page.waitForTimeout(2500); const s2 = await state(o.page); const db2 = await consentOf(u); if (s2.has && (s2.ui === 'true') !== (db2 === 'granted')) bad.push(`${tag}: tras Comprobar interruptor ${s2.ui} ≠ base ${db2}`); }
    await o.ctx.close();
  }
  info('U-matriz', infoU.join(' · '));
  check('U1 ENCENDER con respuesta perdida / corte / 5xx tras aplicar / 5xx sin aplicar / 15 s sin respuesta (aplicado y no): la pantalla = la fila de la base, no dice «no se pudo guardar» si se aplicó ni «guardado» si no, una sola fila de consentimiento, y el profesional ve los datos si y solo si el permiso está concedido', bad1.length === 0, bad1.join(' | ') || `${KINDS.length} escenarios (ES y EN en pérdida y corte)`);
  check('U2 APAGAR con las mismas pérdidas: pantalla = base; si no se aplicó, advierte que el profesional puede seguir viendo (o muestra el interruptor encendido con la verdad); tras confirmarse el apagado el profesional recibe 403', bad2.length === 0, bad2.join(' | ') || `${KINDS.length} escenarios`);

  // ── U3 no se puede releer
  { const bad = []; const u = await prep('u3', 'revoked'); let failReads = false; const o = await open(u, '/app/my-therapist', { routes: async (page) => { await putRoute('cut')(page); await page.route('**/api/consents', async r => { if (failReads && r.request().method() === 'GET') return r.abort(); return r.continue(); }); await page.route('**/api/consents?*', async r => { if (failReads && r.request().method() === 'GET') return r.abort(); return r.continue(); }); } });
    failReads = true; await SW(o.page).click(); await o.page.waitForTimeout(3500); const s = await state(o.page); const prof = await textOf(o.page);
    if (s.has) bad.push('sigue mostrando el interruptor sin poder leer el estado real'); if (!s.check_) bad.push('sin botón «Comprobar»'); if (!/No pudimos confirmar|could not confirm/i.test(s.txt)) bad.push('sin mensaje veraz'); if (!/Dra\. Prueba Uno/.test(prof)) bad.push('perdió el resto de la pantalla (perfil)');
    failReads = false; await o.page.unroute('**/api/consents/therapist_sharing').catch(() => {}); await o.page.getByRole('button', { name: /^(Comprobar|Check)$/ }).first().click(); await o.page.waitForTimeout(2500); const s2 = await state(o.page), db = await consentOf(u);
    if (!s2.has || (s2.ui === 'true') !== (db === 'granted')) bad.push(`tras Comprobar: interruptor=${s2.ui} base=${db}`);
    check('U3 no se puede releer (PUT y relectura fallan): NO hay interruptor, aparece «Comprobar» y un mensaje veraz sin perder el resto; al volver la red «Comprobar» deja pantalla = base', bad.length === 0, bad.join(' | ') || `base final=${db}`); await o.ctx.close(); }

  // ── U4 idempotencia, doble clic y varias pestañas
  { const bad = []; const u = await prep('u4', 'revoked'); const o = await open(u, '/app/my-therapist'); const puts = []; o.page.on('request', r => { if (r.method() === 'PUT' && /therapist_sharing/.test(r.url())) puts.push(1); });
    await SW(o.page).dblclick().catch(() => {}); await o.page.waitForTimeout(2500); const s = await state(o.page), db = await consentOf(u);
    if ((s.ui === 'true') !== (db === 'granted')) bad.push(`doble clic: interruptor ${s.ui} ≠ base ${db}`); if (puts.length > 2) bad.push('doble clic: ' + puts.length + ' PUT'); await o.ctx.close();
    const t1 = await open(u, '/app/my-therapist'), t2 = await open(u, '/app/my-therapist'); await Promise.all([SW(t1.page).click(), SW(t2.page).click()]); await sleep(3000);
    const dbF = await consentOf(u); const f1 = await state(t1.page), f2 = await state(t2.page); info('U4-pestañas', `base=${dbF} pestaña1=${f1.ui} pestaña2=${f2.ui}`);
    if ((await rowCount(u)) !== 1) bad.push('filas=' + await rowCount(u)); const seq = await evSeq(u); if (seq.some((x, i) => i > 0 && x === seq[i - 1])) bad.push('historial con eventos consecutivos repetidos: ' + seq.join('>'));
    await t1.page.reload(); await t1.page.waitForTimeout(1500); const rl = await state(t1.page); if ((rl.ui === 'true') !== ((await consentOf(u)) === 'granted')) bad.push('tras recargar la pantalla no coincide con la base');
    for (let i = 0; i < 6; i++) { const r = await share(u, i % 2 ? 'granted' : 'revoked'); if (r.status >= 500) bad.push('5xx al alternar'); } const burst = await Promise.all(Array.from({ length: 10 }, (_, i) => share(u, i % 2 ? 'granted' : 'revoked')));
    if (burst.some(r => r.status >= 500)) bad.push('5xx en ráfaga de 10'); if ((await rowCount(u)) !== 1) bad.push('filas tras ráfaga=' + await rowCount(u));
    check('U4 reintento idempotente: doble clic, dos pestañas a la vez y ráfaga de 10 PUT contradictorios → una sola fila por permiso, sin 5xx, historial sin eventos duplicados seguidos y pantalla = base tras recargar', bad.length === 0, bad.join(' | ') || `historial=${(await evSeq(u)).join('>').slice(0, 80)}`); await t1.ctx.close(); await t2.ctx.close(); }

  // ── U6 respuestas definitivas
  { const bad = []; for (const code of [401, 403, 404, 409, 422]) { const u = await prep('u6-' + code, 'revoked'); let gets = 0; const o = await open(u, '/app/my-therapist', { routes: async (page) => { await page.route('**/api/consents/therapist_sharing', r => r.request().method() === 'PUT' ? r.fulfill({ status: code, contentType: 'application/json', body: JSON.stringify({ error: 'x' }) }) : r.continue()); await page.route('**/api/consents', r => { if (r.request().method() === 'GET') gets++; return r.continue(); }); } });
      const g0 = gets; await SW(o.page).click().catch(() => {}); await o.page.waitForTimeout(2200); const s = await state(o.page), db = await consentOf(u); const len = await o.page.evaluate(() => document.body.innerText.trim().length);
      if (len < 20) bad.push(`${code}: pantalla en blanco`); if (s.has && (s.ui === 'true') !== (db === 'granted')) bad.push(`${code}: interruptor ${s.ui} ≠ base ${db}`); if (gets - g0 > 2) bad.push(`${code}: ${gets - g0} relecturas (bucle)`); if (SAID_SAVED.test(s.txt)) bad.push(`${code}: dice guardado`); await o.ctx.close(); }
    check('U6 respuestas definitivas 401/403/404/409/422 en el PUT: sin pantalla en blanco, sin bucle de relecturas, sin decir «guardado», interruptor = base', bad.length === 0, bad.join(' | ') || '5 códigos'); }

  // ── U7 textos y accesibilidad
  { const bad = [], badAx = []; let n = 0;
    const reach = async (st, lang, vw, scheme) => { const u = await prep(`u7-${st}-${lang}-${vw}-${scheme}`, st === 'on' ? 'granted' : st === 'off' ? 'revoked' : 'revoked'); const reads = { fail: false };
      const routes = async (page) => { if (st === 'cut' || st === 'unknown') await putRoute('cut')(page); if (st === 'unknown') { await page.route('**/api/consents', r => (reads.fail && r.request().method() === 'GET') ? r.abort() : r.continue()); } };
      const o = await open(u, '/app/my-therapist', { lang, vp: { width: vw, height: 900 }, scheme, routes }); if (st === 'unknown') reads.fail = true; if (st === 'cut' || st === 'unknown') { await SW(o.page).click(); await o.page.waitForTimeout(3500); } return o; };
    for (const lang of ['es', 'en']) for (const st of ['on', 'off', 'cut', 'unknown']) for (const [vw, scheme] of [[390, 'light'], [1360, 'light'], [1360, 'dark']]) { const o = await reach(st, lang, vw, scheme); const txt = await textOf(o.page); n++;
      if (FORBID.test(txt)) bad.push(`${st}/${lang}: «${txt.match(FORBID)[0]}»`); if (EMOJI.test(txt)) bad.push(`${st}/${lang}: emoji`); if (RAWKEY.test(txt)) bad.push(`${st}/${lang}: clave cruda ${txt.match(RAWKEY)[0]}`);
      const v = await axeOn(o.page); if (v.length) badAx.push(`${st}/${lang}/${vw}/${scheme}: ${v.join(',')}`); const live = await o.page.locator('[role=status]').count(); if (live > 2) bad.push(`${st}/${lang}: ${live} regiones role=status`);
      const small = await o.page.evaluate(() => [...document.querySelectorAll('button,[role=switch],a')].filter(e => { const b = e.getBoundingClientRect(); return b.width > 0 && Math.min(b.width, b.height) < 24; }).length); if (small) bad.push(`${st}/${lang}: ${small} controles <24 px`); await o.ctx.close(); }
    check('U7a textos: ES/EN de los estados nuevos sin «terapeuta/paciente», sin emojis, sin claves crudas, sin regiones de anuncio duplicadas y objetivos ≥24 px', bad.length === 0, bad.join(' | ') || `${n} vistas`);
    check('U7b axe WCAG A/AA/2.2 AA: 0 violaciones en activado, apagado, incierto (con «Comprobar») y no-se-puede-releer × ES/EN × 390/1360 × claro/oscuro', badAx.length === 0, badAx.join(' | ').slice(0, 400) || `${n} corridas`); }
  { const u = await prep('u7t', 'revoked'); const o = await open(u, '/app/my-therapist', { routes: putRoute('cut') }); await SW(o.page).click(); await o.page.waitForTimeout(3500); const seq = []; for (let i = 0; i < 8; i++) { await o.page.keyboard.press('Tab'); seq.push(await o.page.evaluate(() => { const e = document.activeElement; if (!e || e === document.body) return null; const c = getComputedStyle(e); return (e.textContent || e.getAttribute('aria-label') || e.tagName).trim().slice(0, 26) + ((c.outlineStyle !== 'none' && parseFloat(c.outlineWidth) > 0) || c.boxShadow !== 'none' ? '' : ' [sin foco visible]'); })); }
    const real = seq.filter(Boolean); check('U7c teclado: en el estado incierto «Comprobar» es alcanzable con Tab y todo control enfocado muestra foco visible', real.some(s => /Comprobar|Check/.test(s)) && !real.some(s => /sin foco visible/.test(s)), real.join(' → ').slice(0, 300)); await o.ctx.close(); }

  // ── U8 desvincular y compartir intactos
  { const bad = []; const u = await prep('u8', 'granted'); const o = await open(u, '/app/my-therapist'); await SW(o.page).click(); await o.page.waitForTimeout(1500); if ((await consentOf(u)) !== 'revoked' || (await proView(u)) !== 403) bad.push('apagar normal no funciona'); await SW(o.page).click(); await o.page.waitForTimeout(1500); if ((await consentOf(u)) !== 'granted' || (await proView(u)) !== 200) bad.push('encender normal no funciona');
    const opener = o.page.getByRole('button', { name: UNLINK }); await opener.click(); await o.page.waitForTimeout(400); const ft = await o.page.evaluate(() => document.activeElement && document.activeElement.textContent.trim()); if (!/^(Cancelar|Cancel)$/.test(ft)) bad.push('foco inicial del diálogo: ' + ft); await o.page.keyboard.press('Escape'); await o.page.waitForTimeout(300); if ((await o.page.getByRole('dialog').count()) !== 0) bad.push('Esc no cierra');
    await opener.click(); const dels = []; o.page.on('request', r => { if (r.method() === 'DELETE') dels.push(1); }); await o.page.getByRole('button', { name: /Sí, desvincularme|Yes, unlink/ }).dblclick().catch(() => {}); await o.page.waitForTimeout(2200); if (dels.length !== 1) bad.push('DELETE x' + dels.length); if ((await q('select "therapistId" from "Users" where id=$1', [u.id]))[0].therapistId !== null) bad.push('no se desvinculó');
    check('U8 compartir normal (apagar → 403 / encender → 200) y desvincular (foco inicial en Cancelar, Esc, doble clic = 1 DELETE) siguen intactos', bad.length === 0, bad.join(' | ') || 'ok'); await o.ctx.close(); }

  await browser.close(); await db.end();
  console.log('RESUMEN-ES244 ' + JSON.stringify({ total: results.length, fallos: results.filter(r => !r.ok).length })); process.exit(0);
})().catch(e => { console.log('ERROR-ES244 ' + (e && e.stack || e)); process.exit(1); });
