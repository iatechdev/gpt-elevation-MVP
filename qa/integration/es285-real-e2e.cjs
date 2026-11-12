// [QA-Claude] ES-285 (PR #243) · GuideBlock y ValidationBlock con el SERVIDOR REAL (server.js completo + PostgreSQL desechable) y revocación REAL de sesiones.
//   QA_BASE=http://127.0.0.1:9285 QA_SUT=<repo> QA_MODE=head|control QA_OUT=<carpeta> node qa/integration/es285-real-e2e.cjs
// Simulado SOLO donde se declara: GET /api/session y las lecturas del panel en C3 (token de persona con pantalla de profesional) y el `abort` de C5/C6.
// Datos sintéticos, base local desechable, 0 IA. El «control» corre el mismo guion con el dist de main y debe FALLAR el aviso de sesión vencida.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const BASE = process.env.QA_BASE || 'http://127.0.0.1:9285';
const SUT = path.join(process.env.QA_SUT || 'C:/Users/Usuario/Documents/qa-pr-221', 'backend');
const OUT = process.env.QA_OUT || '.';
const MODE = process.env.QA_MODE || 'head';
const S = 'C:/Users/Usuario/Documents/qa13';
const { createRequire } = require('module');
const req = createRequire(SUT + '/package.json');
const { Client } = req('pg'); const jwt = req('jsonwebtoken');
const SECRET = fs.readFileSync(S + '/jwt', 'utf8').trim();
const { chromium } = require('C:/Users/Usuario/tools/playwright/node_modules/playwright');
const axeSource = fs.readFileSync('C:/Users/Usuario/tools/playwright/node_modules/axe-core/axe.min.js', 'utf8');
const results = []; const errors = [];
const rec = (id, ok, detail) => { results.push({ id, ok, detail }); console.log(JSON.stringify({ id, ok, detail: String(detail).slice(0, 600) })); };
const info = (id, detail) => { results.push({ id, info: detail }); console.log(JSON.stringify({ id, info: String(detail).slice(0, 600) })); };
const T = {
  es: { create: 'Crear guía', enter: 'Entrar', check: 'Comprobar', guideWarn: /Tu propuesta no se envió/, fileWarn: /El documento no se subió/, forbid: 'No tienes permiso para esta acción.' },
  en: { create: 'Create guide', enter: 'Sign in', check: 'Check', guideWarn: /Your proposal was not sent/, fileWarn: /The document was not uploaded/, forbid: "You don't have permission for this action." },
};
const pdf = { name: 'doc.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 sintetico') };

(async () => {
  const db = new Client({ connectionString: 'postgres://elevation:elevation_local@127.0.0.1:54459/qa285' }); await db.connect();
  const q = async (text, params) => (await db.query(text, params)).rows;
  const cols = await q(`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='Users' AND is_nullable='NO' AND column_default IS NULL AND column_name <> 'id'`);
  let seq = 0; const stamp = crypto.randomBytes(3).toString('hex');
  async function mkUser(role) {
    seq += 1; const names = []; const values = [];
    for (const c of cols) {
      let v; if (c.column_name === 'role') v = role; else if (c.column_name === 'name') v = `Sintético ${role} ${seq}`;
      else if (c.data_type.includes('char') || c.data_type === 'text') v = c.column_name === 'email' ? `qa285-${stamp}-${seq}@example.test` : `sintetico-${seq}-${c.column_name}`;
      else if (c.data_type === 'integer') v = 0; else if (c.data_type === 'boolean') v = true; else if (c.data_type.startsWith('timestamp')) v = new Date(); else v = '{}';
      names.push(`"${c.column_name}"`); values.push(v);
    }
    const id = (await q(`INSERT INTO "Users" (${names.join(',')}) VALUES (${values.map((_, i) => `$${i + 1}`).join(',')}) RETURNING id`, values))[0].id;
    await q('UPDATE "Users" SET role=$2, active=true WHERE id=$1', [id, role]);
    return { id, role, name: `Sintético ${role} ${seq}`, token: tokenFor({ id, role, name: `Sintético ${role} ${seq}` }) };
  }
  const tokenFor = (u) => jwt.sign({ id: u.id, name: u.name, role: u.role, iatMs: Date.now() }, SECRET, { expiresIn: '8h', jwtid: crypto.randomBytes(16).toString('hex') });
  const revoke = async (u) => { await new Promise((r) => setTimeout(r, 30)); await q(`INSERT INTO "AuthRevocations" ("UserId","revokedBefore","createdAt","updatedAt") VALUES ($1, now(), now(), now()) ON CONFLICT ("UserId") DO UPDATE SET "revokedBefore"=now()`, [u.id]); };
  const browser = await chromium.launch({ headless: true, executablePath: undefined });

  async function open(user, width, lang, { mock = false, abortPropose = false, lostOnce = false } = {}) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
    await page.addInitScript(([tk, role, l]) => { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem('elevation_token', tk); localStorage.setItem('elevation_role', role); } localStorage.setItem('elv_lang', l); }, [user.token, 'therapist', lang]);
    if (mock) await page.route('**/api/**', (route) => { // C3: token de persona; solo las LECTURAS del panel y la sesión se simulan; propose y upload van al servidor real
      const p = new URL(route.request().url()).pathname; const m = route.request().method();
      if (p === '/api/session') return route.fulfill({ json: { role: 'therapist', onboardingCompleted: true } });
      if (m === 'GET' && p === '/api/therapist/prompt') return route.fulfill({ json: { hasPrompt: false, content: null, active: null, pending: null, rejected: null } });
      if (m === 'GET' && p === '/api/therapist/alerts') return route.fulfill({ json: { inactivePatients: [], notableProgress: [] } });
      if (m === 'GET' && /^\/api\/(therapist|sessions)\//.test(p)) return route.fulfill({ json: [] });
      return route.fallback();
    });
    if (abortPropose) { let n = 0; await page.route('**/api/therapist/prompt/propose', (route) => { n += 1; if (lostOnce && n > 1) return route.fallback(); return route.abort(); }); }
    await page.goto(BASE + '/therapist/dashboard', { waitUntil: 'networkidle' });
    return { context, page };
  }
  const axe = async (page) => { await page.evaluate(axeSource); return page.evaluate(async () => (await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa'] })).violations.map((v) => v.id + ':' + v.nodes.length)); };
  const tokenOf = (page) => page.evaluate(() => localStorage.getItem('elevation_token'));
  const submitGuide = async (page, lang, text = 'x'.repeat(80)) => { await page.getByRole('button', { name: T[lang].create }).click(); await page.locator('#panel-guide-text').fill(text); };
  const clickSubmitGuide = (page) => page.locator('dialog[open] button[type="submit"]').click();
  const form = (page) => page.locator('form:has(input[type="file"])');
  const reflow = (page) => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);

  const combos = process.env.QA_CORE ? [[390, 'es']] : [[390, 'es'], [390, 'en'], [1360, 'es'], [1360, 'en'], [320, 'es'], [320, 'en']]; // QA_CORE=1: solo el núcleo (para las mutaciones)
  for (const [width, lang] of combos) {
    const tag = `${width}px ${lang}`; const c = T[lang];
    // ── C1 guía 401 real ──
    { const u = await mkUser('therapist'); const { context, page } = await open(u, width, lang);
      try {
        await submitGuide(page, lang);
        await revoke(u);
        const wait = page.waitForResponse((r) => r.url().includes('/api/therapist/prompt/propose') && r.request().method() === 'POST');
        await clickSubmitGuide(page); const status = (await wait).status();
        const box = page.locator('#panel-guide-error'); let warned = true; try { await box.getByText(c.guideWarn).waitFor({ timeout: 4000 }); } catch { warned = false; }
        const kept = (await page.locator('#panel-guide-text').inputValue()).length; const tk = await tokenOf(page); const url = page.url();
        const enter = box.getByRole('button', { name: c.enter, exact: true }); const hasEnter = await enter.count();
        const reintentar = await box.getByRole('button', { name: /Reintentar|Retry|Try again/i }).count();
        let size = null; if (hasEnter) size = await enter.boundingBox();
        const viol = warned ? await axe(page) : ['sin aviso'];
        const flow = await reflow(page);
        if (width === 390 || width === 1360) await page.screenshot({ path: path.join(OUT, `ES-285-${MODE}-guia401-${width}-${lang}.png`) });
        rec(`C1 guía 401 REAL (${tag}) [${MODE}]`, status === 401 && warned && kept === 80 && !!tk && /dashboard/.test(url) && hasEnter === 1 && size && size.height >= 44 && viol.length === 0 && flow,
          `estado real ${status}; aviso ${warned}; texto conservado ${kept}/80; sesión viva ${!!tk}; sigue en el panel ${/dashboard/.test(url)}; «Entrar» ${hasEnter} (${size ? Math.round(size.width) + 'x' + Math.round(size.height) : '-'}); «Reintentar» ${reintentar}; axe ${JSON.stringify(viol)}; sin desborde ${flow}`);
        if (hasEnter) {
          await enter.click(); let ok = true; try { await page.waitForURL('**/login', { timeout: 8000 }); } catch { ok = false; }
          rec(`C1b «Entrar» lleva a /login con la sesión borrada (${tag}) [${MODE}]`, ok && (await tokenOf(page)) === null, `url ${page.url().replace(BASE, '')}; token ${await tokenOf(page)}`);
        }
      } catch (e) { rec(`C1 guía 401 REAL (${tag}) [${MODE}]`, false, 'excepción: ' + e.message.split('\n')[0]); }
      await context.close(); }
    // ── C2 validación 401 real ──
    { const u = await mkUser('therapist'); const { context, page } = await open(u, width, lang);
      try {
        await page.locator('input[type="file"]').setInputFiles(pdf);
        await revoke(u);
        const wait = page.waitForResponse((r) => r.url().includes('/api/therapist/validation/upload') && r.request().method() === 'POST');
        await form(page).locator('button[type="submit"]').click(); const status = (await wait).status();
        let warned = true; try { await form(page).locator('p[role="alert"]').getByText(c.fileWarn).waitFor({ timeout: 4000 }); } catch { warned = false; }
        const fileKept = await page.locator('input[type="file"]').evaluate((el) => el.files.length); const tk = await tokenOf(page);
        const enter = form(page).getByRole('button', { name: c.enter, exact: true }); const hasEnter = await enter.count(); const size = hasEnter ? await enter.boundingBox() : null;
        const viol = warned ? await axe(page) : ['sin aviso']; const flow = await reflow(page);
        if (width === 390 || width === 1360) await page.screenshot({ path: path.join(OUT, `ES-285-${MODE}-validacion401-${width}-${lang}.png`) });
        rec(`C2 validación 401 REAL (${tag}) [${MODE}]`, status === 401 && warned && fileKept === 1 && !!tk && hasEnter === 1 && size && size.height >= 44 && viol.length === 0 && flow,
          `estado real ${status}; aviso ${warned}; archivo conservado ${fileKept}; sesión viva ${!!tk}; «Entrar» ${hasEnter} (${size ? Math.round(size.width) + 'x' + Math.round(size.height) : '-'}); axe ${JSON.stringify(viol)}; sin desborde ${flow}`);
        if (hasEnter) { await enter.click(); let ok = true; try { await page.waitForURL('**/login', { timeout: 8000 }); } catch { ok = false; } rec(`C2b «Entrar» → /login (${tag}) [${MODE}]`, ok && (await tokenOf(page)) === null, `url ${page.url().replace(BASE, '')}`); }
      } catch (e) { rec(`C2 validación 401 REAL (${tag}) [${MODE}]`, false, 'excepción: ' + e.message.split('\n')[0]); }
      await context.close(); }
  }
  if (MODE === 'control' || process.env.QA_CORE) { fs.writeFileSync(path.join(OUT, `ES-285-real-e2e-${MODE}${process.env.QA_CORE ? '-core' : ''}.json`), JSON.stringify(results, null, 1)); console.log('RESUMEN-CONTROL ' + results.filter((r) => r.ok).length + '/' + results.filter((r) => 'ok' in r).length); await browser.close(); await db.end(); process.exit(0); }

  // ── C3 403 real (token de persona; solo lecturas del panel y /api/session simuladas) ──
  for (const lang of ['es', 'en']) for (const width of [390, 1360]) {
    const tag = `${width}px ${lang}`; const c = T[lang];
    { const u = await mkUser('user'); const { context, page } = await open(u, width, lang, { mock: true });
      try {
        await submitGuide(page, lang);
        const wait = page.waitForResponse((r) => r.url().includes('/api/therapist/prompt/propose')); await clickSubmitGuide(page); const status = (await wait).status();
        let msg = true; try { await page.locator('#panel-guide-error').getByText(c.forbid).waitFor({ timeout: 4000 }); } catch { msg = false; }
        const retry = await page.locator('#panel-guide-error').getByRole('button', { name: /Reintentar|Retry|Try again|Entrar|Sign in/i }).count();
        rec(`C3 guía 403 REAL (${tag})`, status === 403 && msg && retry === 0 && !!(await tokenOf(page)) && (await page.locator('#panel-guide-text').inputValue()).length === 80, `estado real ${status}; mensaje propio ${msg}; botones de reintento/entrar ${retry}; sesión viva ${!!(await tokenOf(page))}; texto conservado`);
        await page.getByRole('button', { name: /Cancelar|Cancel/i }).first().click().catch(() => {});
      } catch (e) { rec(`C3 guía 403 REAL (${tag})`, false, 'excepción: ' + e.message.split('\n')[0]); }
      await context.close(); }
    { const u = await mkUser('user'); const { context, page } = await open(u, width, lang, { mock: true });
      try {
        await page.locator('input[type="file"]').setInputFiles(pdf);
        const wait = page.waitForResponse((r) => r.url().includes('/api/therapist/validation/upload')); await form(page).locator('button[type="submit"]').click(); const status = (await wait).status();
        let msg = true; try { await form(page).locator('p[role="alert"]').getByText(c.forbid).waitFor({ timeout: 4000 }); } catch { msg = false; }
        rec(`C3 validación 403 REAL (${tag})`, status === 403 && msg && (await form(page).getByRole('button', { name: new RegExp(`^(${c.enter})$`) }).count()) === 0 && !!(await tokenOf(page)), `estado real ${status}; mensaje propio ${msg}; sesión viva ${!!(await tokenOf(page))}`);
      } catch (e) { rec(`C3 validación 403 REAL (${tag})`, false, 'excepción: ' + e.message.split('\n')[0]); }
      await context.close(); }
  }

  // ── C4 errores conocidos contra el servidor real (se registran los textos para compararlos con main) ──
  for (const lang of ['es', 'en']) {
    { const u = await mkUser('therapist'); const { context, page } = await open(u, 1360, lang);
      try {
        await submitGuide(page, lang, 'corta'); const wait = page.waitForResponse((r) => r.url().includes('/api/therapist/prompt/propose')); await clickSubmitGuide(page); const status = (await wait).status();
        await page.waitForTimeout(500); info(`C4 guía texto corto REAL (${lang})`, `estado ${status}; mensaje: ${(await page.locator('#panel-guide-error').innerText()).replace(/\s+/g, ' ')}`);
      } catch (e) { info(`C4 guía corta (${lang})`, 'excepción ' + e.message.split('\n')[0]); }
      await context.close(); }
    { const u = await mkUser('therapist'); const { context, page } = await open(u, 1360, lang);
      try {
        await submitGuide(page, lang, 'g'.repeat(120)); const wait = page.waitForResponse((r) => r.url().includes('/api/therapist/prompt/propose')); await clickSubmitGuide(page); const status = (await wait).status();
        await page.waitForTimeout(800); info(`C4 guía 120 caracteres REAL (${lang})`, `estado ${status}; texto: ${(await page.locator('#panel-guide-error').innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 200)}`);
      } catch (e) { info(`C4 guía larga (${lang})`, 'excepción ' + e.message.split('\n')[0]); }
      await context.close(); }
    { const u = await mkUser('therapist'); const { context, page } = await open(u, 1360, lang);
      try {
        await page.locator('input[type="file"]').setInputFiles({ name: 'nota.txt', mimeType: 'text/plain', buffer: Buffer.from('no es pdf') });
        const wait = page.waitForResponse((r) => r.url().includes('/api/therapist/validation/upload')); await form(page).locator('button[type="submit"]').click(); const status = (await wait).status();
        await page.waitForTimeout(500); info(`C4 validación formato inválido REAL (${lang})`, `estado ${status}; mensaje: ${(await form(page).locator('p[role="alert"]').innerText().catch(() => '')).replace(/\s+/g, ' ')}`);
      } catch (e) { info(`C4 validación (${lang})`, 'excepción ' + e.message.split('\n')[0]); }
      await context.close(); }
  }

  // ── C5 / C6 «Comprobar» ──
  for (const lang of ['es', 'en']) {
    const c = T[lang];
    { const u = await mkUser('therapist'); const { context, page } = await open(u, 390, lang, { abortPropose: true });
      try {
        await submitGuide(page, lang); await clickSubmitGuide(page);
        const check = page.locator('#panel-guide-error').getByRole('button', { name: c.check }); await check.waitFor({ timeout: 6000 });
        await revoke(u);
        const wait = page.waitForResponse((r) => r.url().includes('/api/therapist/prompt') && !r.url().includes('propose') && r.request().method() === 'GET'); await check.click(); const status = (await wait).status();
        let warned = true; try { await page.locator('#panel-guide-error').getByText(c.guideWarn).waitFor({ timeout: 4000 }); } catch { warned = false; }
        const enter = await page.locator('#panel-guide-error').getByRole('button', { name: c.enter, exact: true }).count();
        rec(`C5 «Comprobar» con sesión revocada (${lang})`, status === 401 && warned && enter === 1 && !!(await tokenOf(page)), `estado real de la relectura ${status}; aviso ${warned}; «Entrar» ${enter}; sesión viva ${!!(await tokenOf(page))}`);
      } catch (e) { rec(`C5 «Comprobar» (${lang})`, false, 'excepción: ' + e.message.split('\n')[0]); }
      await context.close(); }
    { const u = await mkUser('therapist'); const { context, page } = await open(u, 390, lang, { abortPropose: true });
      try {
        await submitGuide(page, lang); await clickSubmitGuide(page);
        const check = page.locator('#panel-guide-error').getByRole('button', { name: c.check }); await check.waitFor({ timeout: 6000 });
        const kept = (await page.locator('#panel-guide-text').inputValue()).length; await check.click(); await page.waitForTimeout(800);
        info(`C6 pérdida de red sin 401 (${lang})`, `texto conservado ${kept}/80; tras «Comprobar» (sesión vigente): ${(await page.locator('#panel-guide-error').innerText().catch(() => '(sin mensaje)')).replace(/\s+/g, ' ').slice(0, 220)}; sesión viva ${!!(await tokenOf(page))}`);
      } catch (e) { info(`C6 (${lang})`, 'excepción ' + e.message.split('\n')[0]); }
      await context.close(); }
  }

  // ── C7 token más nuevo ──
  { const u = await mkUser('therapist'); const { context, page } = await open(u, 1360, 'es');
    try {
      await submitGuide(page, 'es'); await revoke(u); await clickSubmitGuide(page);
      const box = page.locator('#panel-guide-error'); await box.getByText(T.es.guideWarn).waitFor({ timeout: 4000 });
      const newer = tokenFor(u); await page.evaluate((t2) => localStorage.setItem('elevation_token', t2), newer);
      await box.getByRole('button', { name: 'Entrar', exact: true }).click(); await page.waitForTimeout(800);
      const same = (await tokenOf(page)) === newer; const onPanel = /dashboard/.test(page.url()); const stillWarn = await box.getByText(T.es.guideWarn).count();
      rec('C7 un inicio de sesión más nuevo no se cierra al pulsar «Entrar»', same && onPanel, `token nuevo intacto ${same}; sigue en el panel ${onPanel}`);
      info('C7 lo que ve la persona', `tras pulsar «Entrar» con un token más nuevo el aviso sigue visible: ${stillWarn > 0} (el botón no da ninguna señal si no cierra la sesión)`);
    } catch (e) { rec('C7 token más nuevo', false, 'excepción: ' + e.message.split('\n')[0]); }
    await context.close(); }

  // ── C9 teclado (guía y validación) ──
  for (const lang of ['es', 'en']) {
    const c = T[lang]; const u = await mkUser('therapist'); const { context, page } = await open(u, 1360, lang);
    try {
      await submitGuide(page, lang); await revoke(u); await clickSubmitGuide(page);
      const box = page.locator('#panel-guide-error'); await box.getByText(c.guideWarn).waitFor({ timeout: 4000 });
      const activeAfter = await page.evaluate(() => { const a = document.activeElement; return a ? (a.tagName + (a.id ? '#' + a.id : '') + ' ' + (a.textContent || '').trim().slice(0, 25)) : 'ninguno'; });
      let reached = false; let hops = 0; for (; hops < 12; hops += 1) { await page.keyboard.press('Tab'); const txt = await page.evaluate(() => (document.activeElement && document.activeElement.textContent || '').trim()); if (txt === c.enter) { reached = true; break; } }
      const outline = await page.evaluate(() => { const a = document.activeElement; const s = getComputedStyle(a); return `${s.outlineStyle} ${s.outlineWidth} / sombra ${s.boxShadow !== 'none'}`; });
      await page.keyboard.press('Enter'); let ok = true; try { await page.waitForURL('**/login', { timeout: 8000 }); } catch { ok = false; }
      rec(`C9 teclado guía (${lang}): foco tras el aviso, Tab llega a «Entrar», Enter lo activa`, reached && ok, `foco tras aparecer el aviso: ${activeAfter}; Tab hasta «Entrar»: ${reached ? hops + 1 + ' pulsaciones' : 'NO llegó'}; foco visible: ${outline}; Enter → /login ${ok}`);
    } catch (e) { rec(`C9 teclado guía (${lang})`, false, 'excepción: ' + e.message.split('\n')[0]); }
    await context.close();
    const u2 = await mkUser('therapist'); const o2 = await open(u2, 1360, lang);
    try {
      await o2.page.locator('input[type="file"]').setInputFiles(pdf); await revoke(u2);
      await form(o2.page).locator('button[type="submit"]').click(); await form(o2.page).locator('p[role="alert"]').getByText(c.fileWarn).waitFor({ timeout: 4000 });
      let reached = false; for (let i = 0; i < 6; i += 1) { await o2.page.keyboard.press('Tab'); const txt = await o2.page.evaluate(() => (document.activeElement && document.activeElement.textContent || '').trim()); if (txt === c.enter) { reached = true; break; } }
      await o2.page.keyboard.press('Space'); let ok = true; try { await o2.page.waitForURL('**/login', { timeout: 8000 }); } catch { ok = false; }
      rec(`C9 teclado validación (${lang}): Tab llega a «Entrar» y Espacio lo activa`, reached && ok, `llegó ${reached}; /login ${ok}`);
    } catch (e) { rec(`C9 teclado validación (${lang})`, false, 'excepción: ' + e.message.split('\n')[0]); }
    await o2.context.close();
  }

  rec('sin errores de consola ni de página', errors.length === 0, errors.slice(0, 5).join(' | ') || 'ninguno');
  fs.writeFileSync(path.join(OUT, `ES-285-real-e2e-${MODE}.json`), JSON.stringify(results, null, 1));
  console.log('RESUMEN ' + results.filter((r) => r.ok).length + '/' + results.filter((r) => 'ok' in r).length);
  await browser.close(); await db.end(); process.exit(0);
})().catch((e) => { console.error('FATAL', e.stack); process.exit(1); });
