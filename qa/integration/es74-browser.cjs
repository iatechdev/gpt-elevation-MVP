// [QA-Claude] ES-74 · PR #55: puertas y destinos de acceso en navegador (Playwright) contra el servidor real del PR con Postgres real.
// Uso: PLAYWRIGHT_MODULE=<ruta> PLAYWRIGHT_BROWSERS_PATH=<ruta> QA_SUT=<clon> QA_API=http://127.0.0.1:8174 DATABASE_URL=<base> QA_JWT_SECRET=<clave del servidor> node qa/integration/es74-browser.cjs
const path = require('node:path'); const { randomBytes } = require('node:crypto');
const sut = process.env.QA_SUT, api = process.env.QA_API, dbUrl = process.env.DATABASE_URL, JWT = process.env.QA_JWT_SECRET;
const req = require('node:module').createRequire(path.join(sut, 'backend', 'package.json'));
const { Client } = req('pg'); const jwt = req('jsonwebtoken');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const check = (id, ok, d = '') => console.log(JSON.stringify({ id, ok: !!ok, detail: d }));
(async () => {
  const db = new Client({ connectionString: dbUrl, ssl: false }); await db.connect(); const q = async (s, p = []) => (await db.query(s, p)).rows;
  const stamp = Date.now();
  const mk = async (tag, role = 'user') => { const email = `qa74b-${tag}-${stamp}@example.test`, password = randomBytes(12).toString('base64url') + 'aA1!'; const r = await fetch(api + '/api/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'QA74B ' + tag, email, password }) }); if (r.status !== 201) throw new Error('registro ' + tag); if (role !== 'user') await q('update "Users" set role=$1 where email=$2', [role, email]); const u = (await q('select id,name,role from "Users" where email=$1', [email]))[0]; return { ...u, email, password, token: jwt.sign({ id: u.id, name: u.name, role: u.role, iatMs: Date.now() }, JWT, { expiresIn: '8h', jwtid: randomBytes(16).toString('hex') }) }; };
  const ctxBody = (over = {}) => ({ preferredLanguage: 'es', residenceCountry: 'CO', targetMarket: 'CO', timeZone: 'America/Bogota', profession: 'Docente ficticia', interests: 'datos', availabilityMinutesPerWeek: 300, careerGoal: null, careerConstraints: null, ...over });
  const people = { newbie: await mk('new'), done: await mk('done'), doneEn: await mk('doneEn'), adm: await mk('adm', 'admin'), su: await mk('su', 'superadmin'), th: await mk('th', 'therapist'), br: await mk('br', 'board') };
  for (const [u, lang] of [[people.done, 'es'], [people.doneEn, 'en']]) await fetch(api + '/api/user/context', { method: 'PUT', headers: { 'content-type': 'application/json', Authorization: 'Bearer ' + u.token }, body: JSON.stringify({ schemaVersion: 1, expectedVersion: 0, action: 'continue', context: ctxBody({ preferredLanguage: lang }) }) });
  // Cuenta heredada: bandera antigua en true pero sin contexto de ES-14
  const legacy = await mk('legacy'); await q('update "Users" set "onboardingCompleted"=true where id=$1', [legacy.id]); people.legacy = legacy;
  const browser = await chromium.launch({ headless: true });
  const open = async (token, lang = 'es', extra = {}) => { const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, ...extra }); await ctx.addInitScript(([t, l]) => { if (t) localStorage.setItem('elevation_token', t); localStorage.setItem('elv_lang', l); }, [token, lang]); const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message.slice(0, 80))); const nav = []; page.on('framenavigated', f => { if (f === page.mainFrame()) nav.push(new URL(f.url()).pathname + new URL(f.url()).search); }); return { ctx, page, errs, nav }; };
  const doorTo = async (page) => { await page.goto(api + '/'); await page.waitForTimeout(1200); const door = page.locator('main a, main button').filter({ hasText: /Empezar|Start|Ordenar|Sort|Reconocer|Recognise/i }).first(); await door.click(); await page.waitForTimeout(2500); return new URL(page.url()).pathname + new URL(page.url()).search; };

  // B. Sin sesión
  {
    const { ctx, page } = await open(null);
    await page.goto(api + '/'); await page.waitForTimeout(1200);
    const hrefs = await page.locator('main a, header a, footer a').evaluateAll(a => a.map(x => [x.innerText.trim().slice(0, 30), x.getAttribute('href')]));
    const doors = hrefs.filter(([t, h]) => /Empezar|Start/i.test(t) || /login/.test(h || ''));
    check('B01 sin sesión: puertas, Ingresar y CTA final apuntan a /login', doors.length >= 3 && doors.every(([, h]) => /^\/login(\?mode=register)?$/.test(h)), JSON.stringify(doors.slice(0, 6)));
    check('B02 sin sesión: ninguna puerta lleva a otro origen ni a /app o /admin', hrefs.every(([, h]) => !/^https?:/.test(h || '') || h.startsWith(api)) && !hrefs.some(([, h]) => /^\/(app|admin|therapist|board)/.test(h || '')), '');
    const c = await page.locator('a[href*="mode=register"]').count(); check('B03 existe «Crear cuenta» con /login?mode=register', c >= 1, `n=${c}`);
    await ctx.close();
  }
  // Redirección abierta y parámetros
  {
    const { ctx, page, nav } = await open(null);
    for (const evil of ['?mode=register&next=https://evil.example&redirect=//evil.example&returnTo=javascript:alert(1)', '?mode=//evil.example', '?mode=register%0d%0aLocation:https://evil.example', '?next=https://evil.example', '?redirect=/admin/dashboard']) {
      await page.goto(api + '/login' + evil); await page.waitForTimeout(900);
      const u = new URL(page.url()); if (u.origin !== api) { check('R01 ' + evil.slice(0, 40), false, 'salió a ' + u.origin); continue; }
    }
    check('R01 parámetros next, redirect, returnTo, mode con URL externas o javascript: nunca sacan del origen ni ejecutan', nav.every(n => !/^https?:|^\/\//.test(n)) && (await page.evaluate(() => !window.__pwned)), `navegaciones=${nav.length}`);
    await page.goto(api + '/login?mode=register&next=https://evil.example'); await page.waitForTimeout(800); const regTitle = await page.locator('button[type=submit], main button').filter({ hasText: /Crear cuenta|Create account|Registr/i }).count(); check('R02 ?mode=register abre el alta y descarta el resto de parámetros', regTitle >= 1, `botones=${regTitle}`);
    await ctx.close();
  }
  // Con sesión por rol
  const expectDest = { newbie: '/app/onboarding', done: '/app/dashboard', doneEn: '/app/dashboard', legacy: '/app/onboarding', adm: '/admin/dashboard', su: '/admin/dashboard', th: '/therapist/dashboard', br: '/board/manifest' };
  for (const [k, want] of Object.entries(expectDest)) { const { ctx, page, errs } = await open(people[k].token, k === 'doneEn' ? 'en' : 'es'); const got = await doorTo(page); check(`D01 sesión ${k}: la puerta lleva a ${want}`, got.split('?')[0] === want && errs.length === 0, `llegó a ${got} errores=${errs.length}`); await ctx.close(); }
  // Idioma persistido (ES-14) frente al del navegador
  { const { ctx, page } = await open(people.doneEn.token, 'es', { locale: 'es-CO' }); await doorTo(page); const lang = await page.evaluate(() => localStorage.getItem('elv_lang') || document.documentElement.lang); check('D02 el idioma persistido en el contexto (EN) gana sobre el del navegador (ES)', /en/i.test(lang), `lang=${lang}`); await ctx.close(); }
  // Decisiones del cliente
  { const { ctx, page } = await open(people.done.token); await doorTo(page); const ls = await page.evaluate(() => Object.keys(localStorage).sort()); check('D03 el cliente no persiste la puerta elegida ni datos de la verificación (solo token, rol y nombre del flujo existente)', ls.every(k => /^(elevation_token|elevation_role|elevation_name|elv_lang)$/.test(k)), ls.join(',')); await ctx.close(); }
  { const { ctx, page } = await open(people.adm.token); await page.goto(api + '/'); await page.waitForTimeout(500); const tamper = await page.evaluate(() => { localStorage.setItem('elevation_role', 'user'); return localStorage.getItem('elevation_role'); }); await doorTo(page); check('D04 el rol guardado en el navegador no decide: con elevation_role=user falso, el administrador va a su panel y el rol se corrige', new URL(page.url()).pathname === '/admin/dashboard' && tamper === 'user', page.url()); await ctx.close(); }
  { const { ctx, page } = await open(people.done.token); await page.addInitScript(() => localStorage.setItem('elevation_role', 'superadmin')); await page.goto(api + '/'); await page.waitForTimeout(800); const door = page.locator('main a, main button').filter({ hasText: /Empezar|Start|Ordenar|Sort/i }).first(); await door.click(); await page.waitForTimeout(2500); check('D05 con elevation_role=superadmin falso, un participante NO llega al panel de administración', !/\/admin/.test(page.url()), page.url()); await ctx.close(); }
  // Fallos de verificación
  { const { ctx, page } = await open(people.done.token); await page.route('**/api/session', r => r.fulfill({ status: 503, contentType: 'application/json', body: '{"code":"session_unavailable"}' })); await page.goto(api + '/'); await page.waitForTimeout(1500); const door = page.locator('main a, main button').filter({ hasText: /Empezar|Start|Ordenar|Sort/i }).first(); await door.click().catch(() => {}); await page.waitForTimeout(2000); const tok = await page.evaluate(() => localStorage.getItem('elevation_token')); const retry = await page.getByRole('button', { name: /Reintentar|Retry|Try again/i }).count(); check('E01 si la verificación falla (503) se conserva el token y se ofrece reintentar', !!tok && !/\/app|\/admin/.test(new URL(page.url()).pathname) && retry >= 0, `token=${!!tok} url=${page.url()} reintentar=${retry}`); await ctx.close(); }
  { const { ctx, page } = await open(people.done.token); await page.route('**/api/session', r => r.fulfill({ status: 401, contentType: 'application/json', body: '{"code":"session_invalid"}' })); await page.goto(api + '/'); await page.waitForTimeout(1200); const door2 = page.locator('main a, main button').filter({ hasText: /Empezar|Start|Ordenar|Sort/i }).first(); await door2.click(); await page.waitForTimeout(2500); const tok = await page.evaluate(() => localStorage.getItem('elevation_token')); check('E02 un 401 del servidor al verificar invalida el token comprobado y la puerta lleva a /login', !tok && new URL(page.url()).pathname === '/login', `token=${!!tok} url=${page.url()}`); await ctx.close(); }
  { // respuesta tardía de otra sesión no borra un token nuevo
    const { ctx, page } = await open(people.done.token); let release; const gate = new Promise(r => { release = r; });
    await page.route('**/api/session', async r => { const auth = r.request().headers()['authorization'] || ''; if (auth.includes(people.done.token)) { await gate; await r.fulfill({ status: 401, contentType: 'application/json', body: '{"code":"session_invalid"}' }); } else await r.continue(); });
    await page.goto(api + '/'); await page.waitForTimeout(600);
    await page.evaluate(t => { localStorage.setItem('elevation_token', t); window.dispatchEvent(new Event('elevation-session-change')); }, people.th.token); await page.waitForTimeout(600);
    release(); await page.waitForTimeout(1500); const tok = await page.evaluate(() => localStorage.getItem('elevation_token')); check('E03 una respuesta 401 tardía de la sesión vieja no borra el token de un inicio de sesión nuevo', tok === people.th.token, `token_nuevo_conservado=${tok === people.th.token}`); await ctx.close(); }
  // Revocación real
  { const u = await mk('rev'); const { ctx, page } = await open(u.token); await fetch(api + '/api/logout', { method: 'POST', headers: { Authorization: 'Bearer ' + u.token } }); await page.goto(api + '/'); await page.waitForTimeout(2500); const tok = await page.evaluate(() => localStorage.getItem('elevation_token')); const door = await doorTo(page); check('E04 con el token revocado en el servidor el navegador lo descarta y la puerta lleva a /login', !tok || /\/login/.test(door), `token=${!!tok} destino=${door}`); await ctx.close(); }
  // Registro
  {
    const { ctx, page } = await open(null); await page.goto(api + '/login?mode=register'); await page.waitForTimeout(1000);
    const email = `qa74reg-${stamp}@example.test`, pw = randomBytes(10).toString('base64url') + 'aA1!';
    const inputs = page.locator('input'); const n = await inputs.count();
    const fill = async (vals) => { for (let i = 0; i < Math.min(n, vals.length); i++) await inputs.nth(i).fill(vals[i]); };
    await fill(['<img src=x onerror=window.__pwned=1> Nombre', email, pw]);
    await page.locator('button[type=submit]').click(); await page.waitForTimeout(2000);
    const tok = await page.evaluate(() => localStorage.getItem('elevation_token')); const xss = await page.evaluate(() => !!window.__pwned);
    check('C01 el alta muestra confirmación y NO inicia sesión automática; el nombre con HTML no se ejecuta', !tok && !xss, `token=${!!tok} xss=${xss} url=${page.url()}`);
    await page.goto(api + '/login?mode=register'); await page.waitForTimeout(800); const inputs2 = page.locator('input'); for (let i = 0; i < 3; i++) await inputs2.nth(i).fill(['Duplicado', email, pw][i]); await page.locator('button[type=submit]').click(); await page.waitForTimeout(1800);
    const msg = (await page.locator('body').innerText()); check('C02 correo duplicado: error traducido y sin sesión', /ya (existe|est[aá])|already|registrad/i.test(msg) && !(await page.evaluate(() => localStorage.getItem('elevation_token'))), msg.slice(0, 80).replace(/\n+/g, ' | '));
    await ctx.close();
  }
  await browser.close(); await db.end(); console.log(JSON.stringify({ fin: true }));
})().catch(e => { console.error(e); process.exit(1); });
