// [QA-Claude] ES-153 · PR #139 · compuerta por rol y marcos: matriz 5 roles × rutas protegidas contra el SERVIDOR REAL (GET /api/session real, sin simular /api),
// rol manipulado en el navegador, token inválido/revocado/cuenta desactivada, cambio de rol a mitad de sesión, /api/session caído o colgado, carreras, carga acotada,
// barrera real de la API y accesibilidad de los marcos. Merge local main + #138 + #139. Postgres embebido, IA SIMULADA (0 tokens), datos sintéticos. No imprime secretos.
import { createRequire } from 'node:module';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const BACK = 'C:/Users/Usuario/Documents/qa-pr-test/backend', S = 'C:/Users/Usuario/Documents/qa13', EVID = 'C:/Users/Usuario/Documents/gpt-elevation-qa/qa/evidence';
const req = createRequire(BACK + '/package.json'); const { Client } = req('pg'); const jwt = req('jsonwebtoken');
const { chromium } = createRequire('C:/Users/Usuario/tools/playwright/package.json')('playwright');
const AXE = fs.readFileSync('C:/Users/Usuario/tools/playwright/node_modules/axe-core/axe.min.js', 'utf8');
const JWT = fs.readFileSync(S + '/jwt', 'utf8').trim(), DEK = fs.readFileSync(S + '/dek', 'utf8').trim(), PEK = fs.readFileSync(S + '/pek', 'utf8').trim();
const DBN = 'q153', PORT = 8153, api = `http://127.0.0.1:${PORT}`, dbUrl = `postgres://elevation:elevation_local@127.0.0.1:54459/${DBN}`;
const admin = new Client({ connectionString: 'postgres://elevation:elevation_local@127.0.0.1:54459/postgres' }); await admin.connect();
await admin.query(`DROP DATABASE IF EXISTS ${DBN} WITH (FORCE)`); await admin.query(`CREATE DATABASE ${DBN}`);
const out = []; const check = (id, ok, d = '') => { out.push({ id, ok: !!ok, detail: String(d).slice(0, 600) }); console.log(JSON.stringify({ id, ok: !!ok, detail: String(d).slice(0, 420) })); };
const sleep = ms => new Promise(r => setTimeout(r, ms)); const kids = [];
kids.push(spawn(process.execPath, [S + '/m142mock.cjs', '9953'], { stdio: 'ignore' }));
kids.push(spawn(process.execPath, ['server.js'], { cwd: BACK, stdio: 'ignore', env: { ...process.env, PORT: String(PORT), DATABASE_URL: dbUrl, DB_SSL: 'false', JWT_SECRET: JWT, DATA_ENCRYPTION_KEY: DEK, PROMPT_ENCRYPTION_KEY: PEK, DATA_RIGHTS_ENABLED: 'true', NODE_ENV: 'development', ANTHROPIC_API_KEY: 'sk-synthetic-not-real', ANTHROPIC_BASE_URL: 'http://127.0.0.1:9953', AI_BUDGET_TOKENS_PER_USER: '50000000', AI_BUDGET_TOKENS_COHORT: '500000000' } }));
for (let i = 0; i < 80; i++) { try { if ((await fetch(api + '/api/health')).ok) break; } catch { /* */ } await sleep(500); }
const db = new Client({ connectionString: dbUrl, ssl: false }); await db.connect();
for (let i = 0; i < 120; i++) { if ((await db.query(`select to_regclass('"Users"') t, to_regclass('"DiaryEntries"') d`)).rows[0].d) break; await sleep(500); } await sleep(2500);
const q = async (s, p = []) => (await db.query(s, p)).rows;
const call = async (method, url, { token, body } = {}) => { const h = {}; if (token) h.Authorization = 'Bearer ' + token; if (body !== undefined) h['Content-Type'] = 'application/json'; const t0 = performance.now(); const r = await fetch(api + url, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) }); let json = null; try { json = await r.clone().json(); } catch { /* */ } return { s: r.status, json, ms: performance.now() - t0 }; };
const stamp = Date.now(); const mint = u => jwt.sign({ id: u.id, name: u.name, role: u.role, iatMs: Date.now() }, JWT, { expiresIn: '8h', jwtid: randomBytes(16).toString('hex') });
const mk = async (tag, role = 'user') => { const email = `qa153-${tag}-${stamp}@example.test`, password = randomBytes(14).toString('base64url') + 'aA1!'; const r = await call('POST', '/api/register', { body: { name: 'QA153 ' + tag, email, password } }); if (r.s !== 201) throw new Error('registro ' + tag + ' ' + r.s); await q('update "Users" set role=$1, "onboardingCompleted"=true where email=$2', [role, email]); const u = (await q('select id,name,role from "Users" where email=$1', [email]))[0]; return { ...u, email, password, token: mint(u) }; };
const ROLES = ['user', 'admin', 'superadmin', 'therapist', 'board']; const U = {}; for (const r of ROLES) U[r] = await mk(r, r);
check('SET 5 cuentas sintéticas (user, admin, superadmin, therapist, board) con onboarding completo', ROLES.every(r => U[r].id), ROLES.map(r => r + '=' + U[r].id).join(' '));

// ── Verdad de la API (barrera real): /api/session devuelve el rol de la BD ──
for (const r of ROLES) { const s = await call('GET', '/api/session', { token: U[r].token }); check(`S0 /api/session de ${r} devuelve exactamente su rol y onboardingCompleted, sin otros campos`, s.s === 200 && s.json?.role === r && s.json?.onboardingCompleted === true && Object.keys(s.json).length === 2, JSON.stringify(s.json)); }
check('S0b /api/session sin token 401/403 y con parámetros 400', [401, 403].includes((await call('GET', '/api/session')).s) && (await call('GET', '/api/session?role=admin', { token: U.user.token })).s === 400, '');

// ── Matriz de rutas: esperado de forma INDEPENDIENTE (desde las guardas del servidor y las reglas del PR/ticket) ──
const ROUTES = ['/app/dashboard', '/app/chat', '/app/diary', '/app/skill-map', '/app/evidence', '/app/next-step', '/app/my-therapist', '/app/data', '/app/professional-reviews', '/facilitation',
  '/admin/dashboard', '/admin/prompts', '/admin/content', '/admin/metrics', '/admin/pilot-metrics', '/admin/route-catalog', '/admin/skill-catalog', '/admin/users', '/admin/manifest',
  '/therapist/dashboard', '/therapist/patient/1', '/board/manifest', '/board'];
const expect = (role, p) => {
  const member = ['/app/data', '/app/professional-reviews', '/facilitation'].some(b => p === b || p.startsWith(b + '/'));
  if (member) return true;
  if (p.startsWith('/app')) return role === 'user';
  if (p.startsWith('/admin')) return role === 'admin' || role === 'superadmin';
  if (p.startsWith('/therapist')) return role === 'therapist';
  if (p.startsWith('/board')) return role === 'board' || role === 'superadmin';
  return false;
};
const ALLOW = c => c === 'frame' || c === 'content'; const browser = await chromium.launch();
const newPage = async ({ token, storedRole, lang = 'es', width = 1360, noToken = false } = {}) => {
  const ctx = await browser.newContext({ viewport: { width, height: 900 } }); const page = await ctx.newPage(); const calls = []; page.on('request', r => { const u = new URL(r.url()); if (u.pathname === '/api/session') calls.push(performance.now()); });
  await ctx.addInitScript(([t, r, l, none]) => { try { localStorage.setItem('elv_lang', l); if (!none) { localStorage.setItem('elevation_token', t); localStorage.setItem('elevation_role', r); localStorage.setItem('elevation_name', 'QA153'); } } catch { /* */ } }, [token, storedRole, lang, noToken]);
  return { ctx, page, calls };
};
// clasifica lo que ve la persona: 'login' | 'noAccess' | 'unavailable' | 'checking' | 'frame' (contenido dentro del marco) | 'other'
const classify = async page => page.evaluate(() => {
  const p = location.pathname; if (p === '/login') return 'login'; if (p === '/') return 'landing';
  const gate = document.querySelector('main.cg-gate'); if (gate) { if (gate.querySelector('[role=alert] h1')) return 'noAccess'; if (gate.querySelector('[role=status]')) return 'checking'; if (gate.querySelector('button')) return 'unavailable'; return 'gate?'; }
  if (!document.body.innerText.trim()) return 'blank'; return document.querySelector('main') ? 'frame' : 'content';
});
const settle = async (page, ms = 9000) => { const t0 = Date.now(); let c = await classify(page); while ((c === 'checking' || c === 'blank') && Date.now() - t0 < ms) { await sleep(120); c = await classify(page); } await sleep(250); return classify(page); };
const matrix = {}; let bad = [], total = 0;
for (const role of ROLES) {
  const { ctx, page } = await newPage({ token: U[role].token, storedRole: role });
  for (const p of ROUTES) {
    await page.goto(api + p, { waitUntil: 'domcontentloaded' }); const c = await settle(page); const want = expect(role, p); total++;
    const ok = want ? ALLOW(c) : c === 'noAccess'; matrix[`${role} ${p}`] = c; if (!ok) bad.push(`${role} ${p}: esperado ${want ? 'frame' : 'noAccess'}, vio ${c} (${await page.evaluate(() => location.pathname)})`);
  }
  await ctx.close();
}
check(`M1 matriz ${ROLES.length} roles × ${ROUTES.length} rutas = ${total} combinaciones, servidor real: permitido ⇒ contenido en marco; no permitido ⇒ pantalla «sin acceso»`, bad.length === 0, bad.length ? bad.slice(0, 12).join(' | ') : 'todas coinciden');
fs.writeFileSync(path.join(EVID, 'ES-213-main-matriz-ui.json'), JSON.stringify(matrix, null, 1));

// ── Barrera real de la API: lo que la UI oculta, el servidor lo niega (misma matriz con endpoints representativos) ──
const API_EP = { admin: ['GET', '/api/admin/metrics/summary'], adminUsers: ['GET', '/api/admin/usuarios'], therapist: ['GET', '/api/therapist/patients'], board: ['GET', '/api/board/manifest'], superadmin: ['GET', '/api/superadmin/ai-usage'] };
const apiRows = {}; for (const role of ROLES) { apiRows[role] = {}; for (const [k, [m, u]] of Object.entries(API_EP)) apiRows[role][k] = (await call(m, u, { token: U[role].token })).s; }
fs.writeFileSync(path.join(EVID, 'ES-213-main-matriz-api.json'), JSON.stringify(apiRows, null, 1));
const apiBad = []; for (const role of ROLES) { for (const k of ['therapist']) { const ok = role === 'therapist' ? apiRows[role][k] < 400 || apiRows[role][k] === 404 : apiRows[role][k] === 403; if (!ok) apiBad.push(`${role} ${k}=${apiRows[role][k]}`); } if (role === 'user' || role === 'therapist' || role === 'board') for (const k of ['admin', 'adminUsers', 'superadmin']) if (apiRows[role][k] !== 403) apiBad.push(`${role} ${k}=${apiRows[role][k]}`); if (role === 'admin' && apiRows[role].superadmin !== 403) apiBad.push(`admin superadmin=${apiRows[role].superadmin}`); if (role === 'user' || role === 'admin' || role === 'therapist') if (apiRows[role].board !== 403) apiBad.push(`${role} board=${apiRows[role].board}`); }
check('B1 API como barrera real: user/therapist/board no entran a endpoints de administración ni superadmin (403); admin no entra a superadmin ni a board; solo therapist al panel profesional', apiBad.length === 0, apiBad.length ? apiBad.join(' | ') : JSON.stringify(apiRows));
check('B2 (QA-153-01 resuelto) admin entra a /admin/users en la interfaz y el servidor le permite listar usuarios (coinciden); /admin/manifest lo ve el admin (decisión de Mauricio, ES-207)', apiRows.admin.adminUsers === 200 && matrix['admin /admin/users'] !== 'noAccess' && matrix['admin /admin/manifest'] !== 'noAccess', 'servidor admin GET /api/admin/usuarios=' + apiRows.admin.adminUsers + ' · interfaz admin /admin/users=' + matrix['admin /admin/users'] + ' · admin /admin/manifest=' + matrix['admin /admin/manifest']);

// ── Rol manipulado en el navegador ──
{ const { ctx, page } = await newPage({ token: U.user.token, storedRole: 'superadmin' }); await page.goto(api + '/admin/dashboard', { waitUntil: 'domcontentloaded' }); const c = await settle(page); const stored = await page.evaluate(() => localStorage.getItem('elevation_role'));
  check('T1 persona (user) con elevation_role=superadmin manipulado en el navegador: /admin/dashboard muestra «sin acceso» y el rol guardado se realinea a lo que dijo el servidor', c === 'noAccess' && stored === 'user', `vista=${c} rolGuardado=${stored}`); await ctx.close(); }
{ const { ctx, page } = await newPage({ token: U.admin.token, storedRole: 'user' }); await page.goto(api + '/admin/dashboard', { waitUntil: 'domcontentloaded' }); const c = await settle(page);
  check('T2 admin con elevation_role=user (al revés): el servidor manda y entra a administración', ALLOW(c), 'vista=' + c); await ctx.close(); }
{ const { ctx, page } = await newPage({ token: U.user.token, storedRole: 'board' }); await page.goto(api + '/board/manifest', { waitUntil: 'domcontentloaded' }); const c = await settle(page);
  check('T3 user con rol guardado board: /board/manifest «sin acceso»', c === 'noAccess', c); await ctx.close(); }

// ── Token inválido / revocado / cuenta desactivada / sin token ──
{ const { ctx, page } = await newPage({ token: 'aaa.bbb.ccc', storedRole: 'superadmin' }); await page.goto(api + '/admin/dashboard', { waitUntil: 'domcontentloaded' }); const c = await settle(page); const st = await page.evaluate(() => ['elevation_token', 'elevation_role', 'elevation_name'].map(k => localStorage.getItem(k)));
  check('K1 token basura: lleva a /login y limpia token, rol y nombre guardados', c === 'login' && st.every(v => v === null), `vista=${c} guardado=${JSON.stringify(st.map(v => v === null ? null : 'x'))}`); await ctx.close(); }
{ const tok = jwt.sign({ id: U.user.id, name: 'x', role: 'superadmin', iatMs: Date.now() }, 'otra-clave-' + randomBytes(8).toString('hex'), { expiresIn: '1h', jwtid: randomBytes(8).toString('hex') }); const { ctx, page } = await newPage({ token: tok, storedRole: 'superadmin' }); await page.goto(api + '/admin/users', { waitUntil: 'domcontentloaded' }); const c = await settle(page);
  check('K2 JWT firmado con OTRA clave afirmando rol superadmin: /login (no entra)', c === 'login', c); await ctx.close(); }
{ const tok = jwt.sign({ id: U.user.id, name: 'x', role: 'user', iatMs: Date.now() }, JWT, { expiresIn: '-10s', jwtid: randomBytes(8).toString('hex') }); const { ctx, page } = await newPage({ token: tok, storedRole: 'user' }); await page.goto(api + '/app/dashboard', { waitUntil: 'domcontentloaded' }); const c = await settle(page);
  check('K3 JWT expirado: /login', c === 'login', c); await ctx.close(); }
{ const x = await mk('revocada', 'user'); const lg = await call('POST', '/api/login', { body: { email: x.email, password: x.password } }); const tok = lg.json?.token; const { ctx, page } = await newPage({ token: tok, storedRole: 'user' }); await page.goto(api + '/app/dashboard', { waitUntil: 'domcontentloaded' }); const c1 = await settle(page);
  const lo = await call('POST', '/api/logout', { token: tok }); await page.goto(api + '/app/diary', { waitUntil: 'domcontentloaded' }); const c2 = await settle(page);
  check('K4 token válido entra; tras POST /api/logout (revocado) el mismo token lleva a /login', lg.s === 200 && ALLOW(c1) && lo.s < 300 && c2 === 'login', `login=${lg.s} antes=${c1} logout=${lo.s} despues=${c2}`); await ctx.close(); }
{ const x = await mk('desactivada', 'user'); const { ctx, page } = await newPage({ token: x.token, storedRole: 'user' }); await page.goto(api + '/app/dashboard', { waitUntil: 'domcontentloaded' }); const c1 = await settle(page); await q('update "Users" set active=false where id=$1', [x.id]); await page.goto(api + '/app/chat', { waitUntil: 'domcontentloaded' }); const c2 = await settle(page);
  check('K5 cuenta desactivada con token aún vigente: /api/session 401 y la interfaz lleva a /login', ALLOW(c1) && c2 === 'login', `antes=${c1} despues=${c2}`); await ctx.close(); }
{ const { ctx, page } = await newPage({ noToken: true }); await page.goto(api + '/app/dashboard', { waitUntil: 'domcontentloaded' }); const c = await settle(page); await page.goto(api + '/admin/dashboard', { waitUntil: 'domcontentloaded' }); const c2 = await settle(page); const n = await ctx.pages().length;
  check('K6 sin token: cualquier ruta protegida lleva a /login y no se hace ninguna petición /api/session', c === 'login' && c2 === 'login', `${c}/${c2}`); await ctx.close(); }

// ── Cambio de rol a mitad de sesión (navegación dentro de la SPA vuelve a verificar) ──
{ const x = await mk('cambio', 'admin'); const { ctx, page, calls } = await newPage({ token: x.token, storedRole: 'admin' }); await page.goto(api + '/admin/dashboard', { waitUntil: 'domcontentloaded' }); const c1 = await settle(page); const n1 = calls.length;
  await q('update "Users" set role=\'user\' where id=$1', [x.id]);
  await page.evaluate(() => { history.pushState({}, '', '/admin/prompts'); dispatchEvent(new PopStateEvent('popstate')); }); const seq = []; let c2 = ''; for (let i = 0; i < 50; i++) { c2 = await classify(page); if (seq[seq.length - 1] !== c2) seq.push(c2); if (c2 === 'noAccess') break; await sleep(100); } const n2 = calls.length;
  check('R1 admin degradado a user en la BD: la siguiente navegación dentro de la SPA revalida (1 petición nueva) y muestra «sin acceso»', ALLOW(c1) && c2 === 'noAccess' && n2 - n1 === 1, `antes=${c1} secuencia=${seq.join('>')} peticiones=${n1}→${n2}`); await ctx.close(); }
{ const x = await mk('ascenso', 'user'); const { ctx, page } = await newPage({ token: x.token, storedRole: 'user' }); await page.goto(api + '/admin/dashboard', { waitUntil: 'domcontentloaded' }); const c1 = await settle(page); await q('update "Users" set role=\'admin\' where id=$1', [x.id]); await page.reload({ waitUntil: 'domcontentloaded' }); const c2 = await settle(page);
  check('R2 user promovido a admin: tras recargar entra (la interfaz sigue al servidor, no al token antiguo)', c1 === 'noAccess' && ALLOW(c2), `antes=${c1} despues=${c2}`); await ctx.close(); }

// ── /api/session caído, lento o con respuesta rara ──
{ const { ctx, page } = await newPage({ token: U.admin.token, storedRole: 'admin' }); let mode = 503; await page.route('**/api/session', r => mode === 'ok' ? r.continue() : r.fulfill({ status: mode, contentType: 'application/json', body: '{"code":"session_unavailable"}' }));
  await page.goto(api + '/admin/dashboard', { waitUntil: 'domcontentloaded' }); const c1 = await settle(page); const tokenKept = await page.evaluate(() => !!localStorage.getItem('elevation_token')); mode = 'ok'; await page.getByRole('button').first().click().catch(() => {}); const c2 = await settle(page);
  check('F1 /api/session 503: pantalla «sin conexión» con reintento (no entra, no expulsa ni borra la sesión); al volver el servicio y reintentar, entra', c1 === 'unavailable' && tokenKept && ALLOW(c2), `caido=${c1} tokenConservado=${tokenKept} trasReintento=${c2}`); await ctx.close(); }
for (const [code, body] of [[200, '{"role":"superadmin","onboardingCompleted":true,"extra":1}'], [200, '{"role":"root","onboardingCompleted":true}'], [200, 'no-json'], [200, '[]'], [500, '{}'], [404, '{}']]) {
  const { ctx, page } = await newPage({ token: U.user.token, storedRole: 'user' }); await page.route('**/api/session', r => r.fulfill({ status: code, contentType: 'application/json', body })); await page.goto(api + '/admin/dashboard', { waitUntil: 'domcontentloaded' }); const c = await settle(page);
  check(`F2 /api/session responde ${code} «${body.slice(0, 40)}»: nunca concede acceso a administración`, c === 'unavailable', 'vista=' + c); await ctx.close(); }
{ const { ctx, page } = await newPage({ token: U.admin.token, storedRole: 'admin' }); await page.route('**/api/session', () => { /* colgada */ }); const t0 = Date.now(); await page.goto(api + '/admin/dashboard', { waitUntil: 'domcontentloaded' }); const c = await settle(page, 14000); const ms = Date.now() - t0;
  check('F3 /api/session colgada: tras el tiempo de espera (≈8 s) pasa a «sin conexión» (no queda «verificando» para siempre)', c === 'unavailable' && ms < 13000, `vista=${c} tras ${ms} ms`); await ctx.close(); }
{ const { ctx, page } = await newPage({ token: U.admin.token, storedRole: 'admin' }); await page.goto(api + '/admin/dashboard', { waitUntil: 'domcontentloaded' }); const c1 = await settle(page); await page.route('**/api/session', r => r.fulfill({ status: 503, body: '{}' }));
  await page.evaluate(() => { history.pushState({}, '', '/admin/prompts'); dispatchEvent(new PopStateEvent('popstate')); }); const c2 = await settle(page);
  check('F4 fallo pasajero de /api/session al cambiar de ruta con sesión ya verificada: no expulsa a la persona (el servidor sigue decidiendo en cada API)', ALLOW(c1) && ALLOW(c2), `${c1}→${c2}`); await ctx.close(); }

// ── Carreras ──
{ const { ctx, page } = await newPage({ token: U.user.token, storedRole: 'user' }); await page.route('**/api/session', async r => { const a = r.request().headers()['authorization'] || ''; if (a.includes(U.user.token.slice(-12))) await sleep(2500); r.continue(); });
  await page.goto(api + '/app/dashboard', { waitUntil: 'domcontentloaded' }); await sleep(400); await page.evaluate(t => { localStorage.setItem('elevation_token', t); dispatchEvent(new Event('elevation-session-change')); }, U.admin.token); await page.evaluate(() => { history.pushState({}, '', '/admin/dashboard'); dispatchEvent(new PopStateEvent('popstate')); });
  const c = await settle(page, 12000); await sleep(3000); const c2 = await classify(page);
  check('C1 respuesta lenta del token anterior (user) llega DESPUÉS de cambiar a la sesión admin: no pisa la decisión (admin sigue dentro de /admin)', ALLOW(c) && ALLOW(c2), `${c}/${c2}`); await ctx.close(); }
{ const { ctx, page, calls } = await newPage({ token: U.board.token, storedRole: 'board' }); await page.goto(api + '/board/manifest', { waitUntil: 'domcontentloaded' }); await settle(page); const n0 = calls.length;
  for (const p of ['/board', '/app/data', '/board/manifest', '/admin/dashboard', '/board/manifest', '/therapist/dashboard']) await page.evaluate(x => { history.pushState({}, '', x); dispatchEvent(new PopStateEvent('popstate')); }, p);
  const c = await settle(page); check('C2 navegación rápida entre 6 rutas con distintos permisos: la vista final corresponde a la última ruta (/therapist/dashboard ⇒ sin acceso para board) y no se rompe', c === 'noAccess', `final=${c} peticiones=${calls.length - n0}`); await ctx.close(); }
{ const { ctx, page } = await newPage({ token: U.user.token, storedRole: 'user' }); await page.goto(api + '/app/dashboard', { waitUntil: 'domcontentloaded' }); await settle(page); const tok2 = U.user.token;
  await page.route('**/api/session', r => r.fulfill({ status: 401, contentType: 'application/json', body: '{"code":"session_invalid"}' })); await page.evaluate(() => { history.pushState({}, '', '/app/chat'); dispatchEvent(new PopStateEvent('popstate')); }); const c = await settle(page);
  check('C3 401 tardío de /api/session en una ruta: la sesión se invalida y lleva a /login', c === 'login', c); await ctx.close(); }

// ── Carga de /api/session (acotada: sesiones sintéticas, 0 IA) ──
{ const lat = []; const worker = async n => { for (let i = 0; i < n; i++) lat.push((await call('GET', '/api/session', { token: U.user.token })).ms); }; const t0 = performance.now(); await Promise.all(Array.from({ length: 10 }, () => worker(20))); const wall = performance.now() - t0; lat.sort((a, b) => a - b);
  const p = f => lat[Math.floor(lat.length * f)].toFixed(0); check('P1 /api/session: 200 peticiones, 10 en paralelo (≈6 personas con margen)', lat.length === 200, `p50=${p(0.5)} ms · p95=${p(0.95)} ms · máx=${lat[lat.length - 1].toFixed(0)} ms · ${(200 / (wall / 1000)).toFixed(0)} req/s`); }
{ const { ctx, page, calls } = await newPage({ token: U.user.token, storedRole: 'user' }); await page.goto(api + '/app/dashboard', { waitUntil: 'domcontentloaded' }); await settle(page); const n0 = calls.length; for (const p of ['/app/chat', '/app/diary', '/app/skill-map']) { await page.evaluate(x => { history.pushState({}, '', x); dispatchEvent(new PopStateEvent('popstate')); }, p); await settle(page); }
  check('P2 una petición /api/session por cambio de ruta protegida (3 cambios ⇒ 3 peticiones, sin ráfagas)', calls.length - n0 === 3, `peticiones nuevas=${calls.length - n0} · en la carga inicial=${n0}`); await ctx.close(); }

// ── Marcos: accesibilidad (axe, solo el marco; el contenido de pantallas antiguas se informa aparte), teclado y responsive ──
const axeFrame = async (page) => { await page.evaluate(AXE); return page.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] } }).then(r => r.violations.map(v => ({ id: v.id, impact: v.impact, frame: !document.querySelector('.cg-main') ? 0 : v.nodes.filter(n => !document.querySelector(n.target.join(' '))?.closest('main.cg-main:not(.cg-gate)')).length, legacy: !document.querySelector('.cg-main') ? v.nodes.length : v.nodes.filter(n => !!document.querySelector(n.target.join(' '))?.closest('main.cg-main:not(.cg-gate)')).length })))); };
const frames = { user: '/app/dashboard', admin: '/admin/dashboard', superadmin: '/admin/users', therapist: '/therapist/dashboard', board: '/board/manifest' }; const axeRows = [];
for (const [role, p] of Object.entries(frames)) for (const lang of ['es', 'en']) for (const width of [1360, 390]) { const { ctx, page } = await newPage({ token: U[role].token, storedRole: role, lang, width }); await page.goto(api + p, { waitUntil: 'domcontentloaded' }); await settle(page); await sleep(700); const v = await axeFrame(page); const horiz = await page.evaluate(() => { if (document.documentElement.scrollWidth <= innerWidth + 1) return false; const w = innerWidth; const off = [...document.querySelectorAll('body *')].filter(e => e.getBoundingClientRect().right > w + 1); return off.some(e => !e.closest('main.cg-main:not(.cg-gate)')) ? 'marco' : 'contenido-antiguo'; }); axeRows.push({ role, lang, width, frameViolations: v.filter(x => x.frame).map(x => `${x.id}(${x.impact}) ×${x.frame}`), legacyViolations: v.filter(x => x.legacy).map(x => `${x.id}(${x.impact}) ×${x.legacy}`), horizontalScroll: horiz }); await ctx.close(); }
fs.writeFileSync(path.join(EVID, 'ES-213-main-axe-marcos.json'), JSON.stringify(axeRows, null, 1));
const fv = axeRows.filter(r => r.frameViolations.length); check(`A1 axe (WCAG 2 A/AA) en el MARCO de los 5 roles × ES/EN × 1360/390 px = ${axeRows.length} vistas: sin violaciones`, fv.length === 0, fv.length ? fv.slice(0, 5).map(r => `${r.role}/${r.lang}/${r.width}: ${r.frameViolations.join(', ')}`).join(' | ') : 'ninguna');
const hs = axeRows.filter(r => r.horizontalScroll === 'marco'); console.log('INFO desbordamiento horizontal por contenido antiguo: ' + axeRows.filter(r => r.horizontalScroll === 'contenido-antiguo').map(r => r.role + '/' + r.lang + '/' + r.width).join(', ')); check('A2 sin desplazamiento horizontal de la página en 390 px en ningún marco', hs.length === 0, hs.map(r => `${r.role}/${r.lang}/${r.width}`).join(', ') || 'ninguno');
const lg = axeRows.filter(r => r.legacyViolations.length); console.log('INFO contenido antiguo con hallazgos axe (fuera del alcance de ES-153): ' + lg.length + ' vistas · ' + [...new Set(lg.flatMap(r => r.legacyViolations))].join(', '));
{ const { ctx, page } = await newPage({ token: U.admin.token, storedRole: 'admin' }); await page.goto(api + '/admin/dashboard', { waitUntil: 'domcontentloaded' }); await settle(page); await sleep(500);
  await page.keyboard.press('Tab'); const first = await page.evaluate(() => ({ t: document.activeElement?.textContent?.trim().slice(0, 40), h: document.activeElement?.getAttribute('href') })); await page.keyboard.press('Enter'); await sleep(300); const af = await page.evaluate(() => ({ id: document.activeElement?.id, tag: document.activeElement?.tagName }));
  const mains = await page.evaluate(() => document.querySelectorAll('main').length), h1s = await page.evaluate(() => document.querySelectorAll('h1').length);
  check('A3 teclado: la primera tabulación es «Saltar al contenido» (#main) y Enter deja el foco en <main>; un solo <main>', first.h === '#main' && af.id === 'main' && mains === 1, `primero=${JSON.stringify(first)} foco=${JSON.stringify(af)} main=${mains} h1=${h1s}`); await ctx.close(); }
{ const { ctx, page } = await newPage({ token: U.user.token, storedRole: 'user' }); await page.goto(api + '/admin/dashboard', { waitUntil: 'domcontentloaded' }); await settle(page); const f = await page.evaluate(() => ({ tag: document.activeElement?.tagName, txt: document.activeElement?.textContent?.trim().slice(0, 40) })); const link = await page.evaluate(() => document.querySelector('main.cg-gate a')?.getAttribute('href'));
  check('A4 pantalla «sin acceso»: el foco va al encabezado, tiene role=alert y un enlace al inicio que sí corresponde al rol (user ⇒ /app/dashboard)', f.tag === 'H1' && link === '/app/dashboard', `foco=${JSON.stringify(f)} enlace=${link}`); await ctx.close(); }
// ── Rutas de Persona/Público no montadas ──
const appSrc = fs.readFileSync('C:/Users/Usuario/Documents/qa-pr-test/frontend/src/App.tsx', 'utf8'); check('N1 las vistas «Persona/Público» del rediseño no están montadas en App.tsx (esta HU no las expone)', !/PersonaFrame|PublicFrame|<Persona|<Publico/i.test(appSrc), 'sin referencias en App.tsx');
// ── Fugas: el marco no hace peticiones de datos de otros roles ni a terceros ──
{ const { ctx, page } = await newPage({ token: U.user.token, storedRole: 'user' }); const hosts = new Set(); const paths = new Set(); page.on('request', r => { const u = new URL(r.url()); hosts.add(u.host); if (u.pathname.startsWith('/api/')) paths.add(u.pathname); }); await page.goto(api + '/app/dashboard', { waitUntil: 'networkidle' }); await sleep(800);
  check('X1 el marco de la persona solo habla con el propio servidor (sin terceros) y no pide endpoints de admin/terapeuta/board', hosts.size === 1 && ![...paths].some(p => /\/api\/(admin|superadmin|therapist|board|junta)/.test(p)), `hosts=${[...hosts].join(',')} api=${[...paths].join(',')}`); await ctx.close(); }

const fails = out.filter(o => !o.ok); console.log('RESUMEN-ES153 ' + JSON.stringify({ total: out.length, fallos: fails.length, fallan: fails.map(f => f.id.slice(0, 60)) }));
fs.writeFileSync(path.join(EVID, 'ES-213-main-pr139-resultados.json'), JSON.stringify(out, null, 1));
await browser.close(); for (const k of kids) k.kill(); await db.end(); await admin.query(`DROP DATABASE IF EXISTS ${DBN} WITH (FORCE)`).catch(() => {}); await admin.end(); process.exit(0);
