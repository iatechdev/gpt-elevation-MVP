// [QA-Claude] ES-169 PR1 · PR #187 «Mi profesional» en Chromium real contra el servidor REAL (Postgres embebido, migraciones, build real servido por el backend). Solo datos sintéticos, 0 IA.
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
  const TH = await mk('th', 'therapist', 'Dra. Prueba Uno'), TH2 = await mk('th2', 'therapist', 'Dr. Prueba Dos');
  const P0 = await mk('p0'), P1 = await mk('p1', 'user', 'Ana Prueba'), P2 = await mk('p2'), PE = await mk('pe'), PU = await mk('pu'), PF = await mk('pf'), PS = await mk('ps');
  for (const p of [P1, PE, PU, PF, PS]) await link(p, TH); await link(P2, TH2);
  for (const p of [P1, PE, PU, PF, PS]) await share(p); await share(P2);
  await sessionRow(P1, TH, 5 * 60 * 1000, 'scheduled'); await sessionRow(P1, TH, 30 * 36e5, 'scheduled');
  for (const m of [1, 2, 3, 4, 5]) await sessionRow(P1, TH, -(m + 1) * 864e5, 'completed', m);
  await sessionRow(P2, TH2, 40 * 36e5, 'scheduled'); await sessionRow(PU, TH, 50 * 36e5, 'scheduled');
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

  // ── F3 estático
  { const files = ['pages/MyTherapist.tsx', 'components/TherapistSharingCard.tsx', 'pages/myProfessionalCopy.ts']; const bad = []; for (const f of files) { const s = fs.readFileSync(path.join(SRC, f), 'utf8'); if (/lang\s*===?\s*['"](es|en)['"]\s*\?\s*['"`](?!es-CO)/.test(s)) bad.push(f + ': ternario de idioma para textos'); if (EMOJI.test(s.replace(/←/g, ''))) bad.push(f + ': emoji en el código'); }
    check('F3a archivos tocados: sin ternarios de idioma (`lang === \'es\' ?`) ni emojis en el código', bad.length === 0, bad.join(' | ') || files.join(', ')); }

  // ── F1/F2/F3 estados × idioma
  const STATES = [['sin-profesional', P0, '/app/my-therapist', null], ['con-profesional', P1, '/app/my-therapist', null], ['sin-sesiones', PE, '/app/my-therapist', null],
    ['error-carga', P1, '/app/my-therapist', async (page) => { await page.route(myT, r => r.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"x"}' })); }],
    ['error-compartir', P1, '/app/my-therapist', async (page) => { await page.route('**/api/consents*', r => r.request().method() === 'GET' ? r.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"x"}' }) : r.continue()); }]];
  const vocab = []; const emo = []; const rawk = []; const blank = [];
  for (const lang of ['es', 'en']) for (const [name, who, url, routes] of STATES) {
    const o = await open(who, url, { lang, routes }); const txt = await textOf(o.page);
    if (FORBID.test(txt)) vocab.push(`${name}/${lang}: «${(txt.match(FORBID) || [''])[0]}»`); if (EMOJI.test(txt)) emo.push(`${name}/${lang}: ${(txt.match(EMOJI) || [''])[0]}`); if (RAWKEY.test(txt)) rawk.push(`${name}/${lang}: ${(txt.match(RAWKEY) || [''])[0]}`);
    const visible = (await o.page.evaluate(() => document.body.innerText.trim().length)); if (visible < 20) blank.push(`${name}/${lang}`);
    if (o.errs.length) info('F-pageerror', `${name}/${lang}: ${o.errs.slice(0, 2).join(' | ')}`); await o.page.screenshot({ path: path.join(OUT, `169-${name}-${lang}.png`) }).catch(() => {}); await o.ctx.close();
  }
  { const o = await open(P1, '/app/my-therapist'); await o.page.getByRole('button', { name: UNLINK }).click(); await o.page.waitForTimeout(500); const dtxt = await textOf(o.page); if (FORBID.test(dtxt)) vocab.push('diálogo/es: «' + dtxt.match(FORBID)[0] + '»'); if (EMOJI.test(dtxt)) emo.push('diálogo/es'); await o.ctx.close(); }
  check('F1 vocabulario: ni «terapeuta» ni «paciente» (ni therapist/patient) en texto visible ni atributos accesibles, en 5 estados + diálogo × ES/EN', vocab.length === 0, vocab.join(' | ') || '11 vistas');
  check('F2 cero emojis ni pictogramas (★ ✓ ℹ) en texto ni atributos, en todos los estados', emo.length === 0, emo.join(' | ') || '11 vistas');
  check('F3b carga en FRÍO directa de /app/my-therapist ES/EN: sin claves crudas (mp_*, room_t_mood_*, mt_*, therapist_*)', rawk.length === 0, rawk.join(' | ') || '10 cargas en frío');
  check('F4a ningún estado deja la pantalla en blanco', blank.length === 0, blank.join(' | '));

  // ── F7 sesiones + ánimo en palabras
  { const catalog = fs.readFileSync(path.join(SRC, 'i18n', 'therapistCopy.ts'), 'utf8'); const words = (lang) => [1, 2, 3, 4, 5].map(n => { const blockStart = catalog.indexOf(lang === 'es' ? 'export const' : 'export const', 0); const m = [...catalog.matchAll(new RegExp(`room_t_mood_${n}:\\s*'([^']+)'`, 'g'))].map(x => x[1]); return m; });
    const allWords = words('es'); const bad = [];
    for (const lang of ['es', 'en']) { const o = await open(P1, '/app/my-therapist', { lang }); const txt = await textOf(o.page); const found = [1, 2, 3, 4, 5].filter(n => new RegExp(`\\(${n}/5\\)`).test(txt));
      if (found.length !== 5) bad.push(`${lang}: ánimos visibles ${found}`); const moodLines = txt.split('\n').filter(l => /\/5\)/.test(l)); if (!moodLines.every(l => /: .+ \(\d\/5\)/.test(l))) bad.push(`${lang}: formato ${moodLines[0]}`);
      if (!/min\b/.test(txt) || !(lang === 'es' ? /Completada/ : /Completed/).test(txt)) bad.push(`${lang}: falta duración o estado`);
      const btns = await o.page.getByRole('button', { name: lang === 'es' ? /Entrar a videollamada/ : /Join videocall/ }).evaluateAll(els => els.map(e => ({ d: e.disabled || e.getAttribute('aria-disabled') === 'true', t: e.title || '' })));
      info('F7-join-' + lang, JSON.stringify(btns)); if (btns.length < 2 || !(btns.some(b => !b.d) && btns.some(b => b.d))) bad.push(`${lang}: botones de unirse ${JSON.stringify(btns)}`); await o.ctx.close(); }
    check('F7 sesiones: ánimo 1–5 en palabras «… (n/5)» ES/EN, duración «min», estado «Completada/Completed», «Entrar» habilitado solo en la sesión próxima (5 min) y deshabilitado en la de +30 h', bad.length === 0, bad.join(' | ') || 'ES y EN'); }
  { const o = await open(PE, '/app/my-therapist'); const t = await textOf(o.page); check('F7b sin sesiones: vacío honesto «aún no ha agendado una sesión» (sin datos inventados)', /aún no ha agendado/.test(t) && !/\(\d\/5\)/.test(t), t.split('\n').filter(l => /agend/.test(l)).join(' ').slice(0, 100)); await o.ctx.close(); }

  // ── F4 error principal con reintento
  { const bad = []; for (const lang of ['es', 'en']) for (const mode of ['500', 'abort', 'vacío', 'lento']) {
      let stage = 'fail'; const o = await open(P1, '/app/my-therapist', { lang, wait: mode === 'lento' ? 600 : 1800, routes: async (page) => { await page.route(myT, async r => { if (stage !== 'fail') return r.continue(); if (mode === '500') return r.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"x"}' }); if (mode === 'abort') return r.abort(); if (mode === 'vacío') return r.fulfill({ status: 200, contentType: 'application/json', body: 'null' }); await new Promise(res => setTimeout(res, 2500)); return r.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"x"}' }); }); } });
      if (mode === 'lento') { const st = await o.page.getByRole('status').first().textContent().catch(() => null); if (!st) bad.push(`${lang}/lento: sin role=status durante la carga`); await o.page.waitForTimeout(3200); }
      const alert = o.page.getByRole('alert').first(); const has = await alert.count(); const btn = o.page.getByRole('button', { name: RETRY }).first();
      if (mode === 'vacío') { const t = await textOf(o.page); if ((await o.page.evaluate(() => document.body.innerText.trim().length)) < 20) bad.push(`${lang}/vacío: pantalla en blanco`); await o.ctx.close(); continue; }
      if (!has || !(await btn.count())) { bad.push(`${lang}/${mode}: sin aviso o sin Reintentar`); await o.ctx.close(); continue; }
      stage = 'ok'; await btn.click(); await o.page.waitForTimeout(1800); const t = await textOf(o.page); if (!/Dra\. Prueba Uno/.test(t) || (await o.page.getByRole('button', { name: RETRY }).count()) > 0 && !/Dra\. Prueba/.test(t)) bad.push(`${lang}/${mode}: «Reintentar» no recupera`); await o.ctx.close(); }
    check('F4b fallo 500, corte de red, respuesta vacía y carga lenta: aviso con «Reintentar» (role=alert), estado de carga role=status, nunca en blanco, y Reintentar recupera los datos', bad.length === 0, bad.join(' | ') || 'ES/EN × 4 modos'); }
  { const o = await open(P1, '/app/my-therapist', { routes: async (page) => { await page.route(myT, r => r.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"expired"}' })); } }); const len = await o.page.evaluate(() => document.body.innerText.trim().length); check('F4c sesión vencida (401): la pantalla no queda en blanco (login o aviso)', len > 20, `url=${o.page.url().replace(API, '')} texto=${len} chars`); await o.ctx.close(); }

  // ── F5 error de «Compartir»
  { const bad = []; let o = await open(P1, '/app/my-therapist', { routes: async (page) => { await page.route('**/api/consents*', r => r.request().method() === 'GET' ? r.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"x"}' }) : r.continue()); } });
    const t = await textOf(o.page); if (!/Dra\. Prueba Uno/.test(t)) bad.push('el perfil se perdió con el error de Compartir'); const rb = o.page.getByRole('button', { name: RETRY }); if ((await rb.count()) < 1) bad.push('sin Reintentar en Compartir'); await o.ctx.close();
    const o2 = await open(PS, '/app/my-therapist', { routes: async (page) => { await page.route('**/api/consents/therapist_sharing', r => r.request().method() === 'PUT' ? r.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"x"}' }) : r.continue()); } });
    const before = await consentOf(PS), sw = SW(o2.page); await sw.click(); await o2.page.waitForTimeout(1500); const t2 = await textOf(o2.page); const after = await consentOf(PS); const aria = await sw.getAttribute('aria-checked');
    if (before !== after) bad.push('PUT 500 cambió el consentimiento'); if ((aria === 'true') !== (after === 'granted')) bad.push(`PUT 500: interruptor ${aria} ≠ base ${after}`); if (/Guardado|Saved/i.test(t2)) bad.push('dice guardado tras un 500'); await o2.ctx.close();
    check('F5a error de Compartir: al cargar → error propio con «Reintentar» sin perder el perfil; al guardar con 500 → mensaje de error, el interruptor refleja la base y no dice «guardado»', bad.length === 0, bad.join(' | ') || `consent antes=${before} después=${after}`);
    const bad2 = []; const o3 = await open(PS, '/app/my-therapist', { routes: async (page) => { await page.route('**/api/consents/therapist_sharing', async r => { if (r.request().method() !== 'PUT') return r.continue(); await r.fetch(); return r.abort(); }); } });
    const sw3 = SW(o3.page); const b3 = await consentOf(PS); await sw3.click(); await o3.page.waitForTimeout(1500); const a3 = await consentOf(PS); const t3 = await textOf(o3.page); const ui3 = await sw3.getAttribute('aria-checked');
    if (b3 === a3) bad2.push('la respuesta perdida no llegó a aplicarse en el servidor (la prueba no ejerce el caso)'); if (/Guardado|Saved/i.test(t3)) bad2.push('dice guardado sin haber recibido respuesta'); info('F5b-ui-tras-perdida', `interruptor=${ui3} base=${a3} texto=${t3.split('\n').filter(l => /compart|shar|guard|sav|error|No se/i.test(l)).join(' / ').slice(0, 160)}`);
    await o3.page.reload(); await o3.page.waitForTimeout(1500); const ui4 = await SW(o3.page).getAttribute('aria-checked'); if ((ui4 === 'true') !== ((await consentOf(PS)) === 'granted')) bad2.push(`tras recargar: interruptor ${ui4} ≠ base`); await o3.ctx.close();
    check('F5b respuesta perdida REAL al guardar el permiso: el servidor lo aplicó; la pantalla no dice «guardado» sin respuesta y tras recargar queda coherente con la base', bad2.length === 0, bad2.join(' | ') || `base=${a3}`); await share(PS, 'granted'); }

  // ── F5c dirección sensible: ENCENDER el permiso y perder la respuesta (el servidor lo concede; ¿qué dice la pantalla?)
  { await share(PS, 'revoked'); const o = await open(PS, '/app/my-therapist', { routes: async (page) => { await page.route('**/api/consents/therapist_sharing', async r => { if (r.request().method() !== 'PUT') return r.continue(); await r.fetch(); return r.abort(); }); } });
    const sw = SW(o.page); const ui0 = await sw.getAttribute('aria-checked'); await sw.click(); await o.page.waitForTimeout(1500); const base = await consentOf(PS), ui1 = await sw.getAttribute('aria-checked'); const t = await textOf(o.page);
    const msg = t.split('\n').filter(l => /guard|sav|No se pudo|could not/i.test(l)).join(' / ');
    info('F5c', `ENCENDER con respuesta perdida: antes interruptor=${ui0}; el servidor quedó en «${base}»; la pantalla muestra interruptor=${ui1} y dice «${msg}»`);
    const dangerous = base === 'granted' && ui1 === 'false';
    check('F5c [OBSERVACIÓN, preexistente de ES-100] al ENCENDER el permiso con respuesta perdida, la pantalla no muestra «apagado» mientras el servidor ya lo concedió (o lo advierte)', !dangerous || /verific|comprob|revisa|check|actual|current|puede que/i.test(msg), `servidor=${base} interruptor=${ui1} mensaje=«${msg}»`);
    await o.ctx.close(); await share(PS, 'granted'); }

  // ── F6 compartir y desvincular con servidor real
  { const bad = []; const o = await open(PF, '/app/my-therapist'); const sw = SW(o.page); const puts = []; o.page.on('request', r => { if (r.method() === 'PUT' && /therapist_sharing/.test(r.url())) puts.push(r.postData()); });
    await sw.click(); await o.page.waitForTimeout(1500); const c1 = await consentOf(PF); const hist1 = await call(TH, 'GET', `/api/therapist/pacientes/${PF.id}/historia`); if (c1 !== 'revoked' || hist1.status !== 403) bad.push(`apagar: base=${c1} historia=${hist1.status}`);
    await sw.click(); await o.page.waitForTimeout(1500); const c2 = await consentOf(PF); const hist2 = await call(TH, 'GET', `/api/therapist/pacientes/${PF.id}/historia`); if (c2 !== 'granted' || hist2.status !== 200) bad.push(`encender: base=${c2} historia=${hist2.status}`);
    check('F6a interruptor con servidor real: apagar → consentimiento retirado y el profesional ya no ve a la persona (403); encender → vuelve a verla (200); un PUT por clic', bad.length === 0 && puts.length === 2, bad.join(' | ') || `PUT=${puts.length}`); await o.ctx.close(); }
  { const bad = []; const o = await open(PU, '/app/my-therapist'); const opener = o.page.getByRole('button', { name: UNLINK }); await opener.click(); await o.page.waitForTimeout(400);
    const dlg = o.page.getByRole('dialog'); if ((await dlg.count()) !== 1) bad.push('el diálogo no se abre'); const focusTxt = await o.page.evaluate(() => document.activeElement && document.activeElement.textContent.trim()); if (!/^(Cancelar|Cancel)$/.test(focusTxt)) bad.push('foco inicial: ' + focusTxt);
    const inside = []; for (let i = 0; i < 5; i++) { await o.page.keyboard.press('Tab'); inside.push(await o.page.evaluate(() => !!document.activeElement.closest('[role="dialog"]'))); } if (!inside.every(Boolean)) bad.push('Tab sale del diálogo');
    await o.page.keyboard.press('Escape'); await o.page.waitForTimeout(400); if ((await dlg.count()) !== 0) bad.push('Esc no cierra'); const back = await o.page.evaluate(() => document.activeElement && document.activeElement.textContent.trim()); if (!UNLINK.test(back || '')) bad.push('el foco no vuelve al botón: ' + back);
    await opener.click(); await o.page.getByRole('button', { name: /^(Cancelar|Cancel)$/ }).click(); await o.page.waitForTimeout(500); if ((await q('select "therapistId" from "Users" where id=$1', [PU.id]))[0].therapistId !== TH.id) bad.push('Cancelar desvinculó');
    await opener.click(); const dels = []; o.page.on('request', r => { if (r.method() === 'DELETE') dels.push(r.url()); }); const conf = o.page.getByRole('button', { name: /Sí, desvincularme|Yes, unlink/ }); await conf.dblclick().catch(() => {}); await o.page.waitForTimeout(2200);
    const row = (await q('select "therapistId" from "Users" where id=$1', [PU.id]))[0]; const fut = (await q(`select count(*)::int n from "TherapySessions" where "patientId"=$1 and status='scheduled'`, [PU.id]))[0].n; const t = await textOf(o.page);
    if (row.therapistId !== null) bad.push('no se desvinculó'); if (dels.length !== 1) bad.push('DELETE x' + dels.length); if (fut !== 0) bad.push('quedan sesiones futuras: ' + fut); if (!/Aún no tienes un profesional/.test(t)) bad.push('la pantalla no vuelve al estado sin profesional');
    check('F6b desvincular: diálogo con foco inicial en «Cancelar», Tab atrapado, Esc cierra y devuelve el foco, Cancelar no desvincula; confirmar (doble clic) = 1 DELETE, desvinculada, sesiones futuras canceladas y la pantalla pasa a «sin profesional»', bad.length === 0, bad.join(' | ') || 'ok'); await o.ctx.close(); }

  // ── F9 privacidad A/B
  { const bad = []; const o = await open(P2, '/app/my-therapist'); const t = await textOf(o.page); if (/Dra\. Prueba Uno/.test(t) || /\(\d\/5\)/.test(t)) bad.push('P2 ve datos del profesional/sesiones de P1'); if (!/Dr\. Prueba Dos/.test(t)) bad.push('P2 no ve a su propio profesional'); await o.ctx.close();
    const r0 = await call(P0, 'GET', '/api/sessions/user/my-therapist'); const r1 = await call(P1, 'GET', '/api/sessions/user/my-therapist'); const r2 = await call(P2, 'GET', '/api/sessions/user/my-therapist');
    if (r0.json?.therapist) bad.push('P0 recibe un profesional'); if (JSON.stringify(r2.json).includes('Prueba Uno')) bad.push('API de P2 trae datos de TH'); const keys = Object.keys(r1.json?.therapist ?? {}); const sk = Object.keys((r1.json?.sessions ?? r1.json?.upcoming ?? [])[0] ?? {});
    const leakF = /notes?|password|token|hash|clinical/i.test(JSON.stringify(r1.json)); if (leakF) bad.push('la respuesta contiene campos privados (notas/contraseña/etc.)'); info('F9-api', `therapist claves=${keys.join(',')} · sesión claves=${sk.join(',')} · correo del profesional en la respuesta: ${JSON.stringify(r1.json).includes(TH.email)}`);
    check('F9 privacidad A/B: otra persona no ve al profesional ni las sesiones de P1 (pantalla y API), una persona sin profesional no recibe ninguno, y la respuesta no trae notas ni campos privados', bad.length === 0, bad.join(' | ') || 'sin cruces'); }

  // ── F8 accesibilidad y responsive
  { const bad = []; let n = 0; const TARGETS = [['sin-profesional', P0, null], ['con-profesional', P1, null], ['error-carga', P1, STATES[3][3]], ['error-compartir', P1, STATES[4][3]]];
    for (const lang of ['es', 'en']) for (const vw of [390, 1360]) for (const scheme of ['light', 'dark']) for (const [name, who, routes] of TARGETS) { const o = await open(who, '/app/my-therapist', { lang, vp: { width: vw, height: 900 }, scheme, routes, wait: 1500 }); const v = await axeOn(o.page); n++; if (v.length) bad.push(`${name}/${lang}/${vw}/${scheme}: ${v.join(',')}`); await o.ctx.close(); }
    for (const lang of ['es', 'en']) for (const vw of [390, 1360]) { const o = await open(P1, '/app/my-therapist', { lang, vp: { width: vw, height: 900 } }); await o.page.getByRole('button', { name: UNLINK }).click(); await o.page.waitForTimeout(400); const v = await axeOn(o.page); n++; if (v.length) bad.push(`diálogo/${lang}/${vw}: ${v.join(',')}`); await o.ctx.close(); }
    check('F8a axe WCAG A/AA/2.2 AA: 0 violaciones en sin profesional, con profesional, error de carga, error de Compartir (ES/EN × 390/1360 × claro/oscuro) y diálogo de desvincular', bad.length === 0, bad.join(' | ').slice(0, 400) || `${n} corridas`); }
  { const o = await open(P1, '/app/my-therapist', { scheme: 'dark' }); const bg = await o.page.evaluate(() => getComputedStyle(document.body).backgroundColor + ' | ' + getComputedStyle(document.documentElement).backgroundColor); info('F8b-tema', 'con prefers-color-scheme: dark el fondo es ' + bg + ' (pantalla clara por diseño, declarado)'); await o.ctx.close(); }
  { const bad = []; const small = new Set(); for (const lang of ['es', 'en']) for (const w of [320, 375, 768, 1440]) for (const [name, who] of [['sin', P0], ['con', P1]]) { const o = await open(who, '/app/my-therapist', { lang, vp: { width: w, height: 900 }, wait: 1300 });
      const r = await o.page.evaluate(() => { const vis = e => { const b = e.getBoundingClientRect(); const s = getComputedStyle(e); return b.width > 0 && b.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; }; const sm = [...document.querySelectorAll('a,button,[role=switch],input,select,textarea')].filter(vis).filter(e => { const b = e.getBoundingClientRect(); return Math.min(b.width, b.height) < 24; }).map(e => (e.textContent || e.getAttribute('aria-label') || e.tagName).trim().slice(0, 24)); return { over: document.documentElement.scrollWidth > window.innerWidth + 1, h1: document.querySelectorAll('h1').length, h2: document.querySelectorAll('h2').length, sm }; });
      if (r.over) bad.push(`desborde ${name}/${lang}/${w}`); if (r.h1 !== 1) bad.push(`h1=${r.h1} ${name}/${lang}`); if (name === 'con' && r.h2 < 2) bad.push(`h2=${r.h2} con/${lang}`); r.sm.forEach(s => small.add(s)); await o.ctx.close(); }
    check('F8c sin desborde horizontal de 320 a 1440 px (ES/EN), un solo h1, ≥2 h2 con profesional y ningún control menor de 24 px', bad.length === 0 && small.size === 0, bad.join(' | ') + (small.size ? ' pequeños: ' + [...small].join(',') : '') || '16 combinaciones'); }
  { const o = await open(P1, '/app/my-therapist'); const seq = []; for (let i = 0; i < 14; i++) { await o.page.keyboard.press('Tab'); const s = await o.page.evaluate(() => { const e = document.activeElement; if (!e || e === document.body) return null; const c = getComputedStyle(e); return (e.textContent || e.getAttribute('aria-label') || e.tagName).trim().slice(0, 28) + (c.outlineStyle !== 'none' && parseFloat(c.outlineWidth) > 0 || c.boxShadow !== 'none' ? '' : ' [sin foco visible]'); }); if (s === null) break; seq.push(s); }
    check('F8d teclado: el orden de Tab recorre los controles de la pantalla y cada uno muestra foco visible', seq.length >= 4 && !seq.some(s => /sin foco visible/.test(s)), seq.join(' → ').slice(0, 380)); await o.ctx.close(); }

  await browser.close(); await db.end();
  console.log('RESUMEN-ES169 ' + JSON.stringify({ total: results.length, fallos: results.filter(r => !r.ok).length })); process.exit(0);
})().catch(e => { console.log('ERROR-ES169 ' + (e && e.stack || e)); process.exit(1); });
