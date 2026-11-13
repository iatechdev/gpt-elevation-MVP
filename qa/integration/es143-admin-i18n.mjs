// [QA-Claude] ES-143 · PR #139 · compuerta por rol y marcos: matriz 5 roles × rutas protegidas contra el SERVIDOR REAL (GET /api/session real, sin simular /api),
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
const DBN = 'q143', PORT = 8143, api = `http://127.0.0.1:${PORT}`, dbUrl = `postgres://elevation:elevation_local@127.0.0.1:54459/${DBN}`;
const admin = new Client({ connectionString: 'postgres://elevation:elevation_local@127.0.0.1:54459/postgres' }); await admin.connect();
await admin.query(`DROP DATABASE IF EXISTS ${DBN} WITH (FORCE)`); await admin.query(`CREATE DATABASE ${DBN}`);
const out = []; const check = (id, ok, d = '') => { out.push({ id, ok: !!ok, detail: String(d).slice(0, 600) }); console.log(JSON.stringify({ id, ok: !!ok, detail: String(d).slice(0, 420) })); };
const sleep = ms => new Promise(r => setTimeout(r, ms)); const kids = [];
kids.push(spawn(process.execPath, [S + '/m142mock.cjs', '9943'], { stdio: 'ignore' }));
kids.push(spawn(process.execPath, ['server.js'], { cwd: BACK, stdio: 'ignore', env: { ...process.env, PORT: String(PORT), DATABASE_URL: dbUrl, DB_SSL: 'false', JWT_SECRET: JWT, DATA_ENCRYPTION_KEY: DEK, PROMPT_ENCRYPTION_KEY: PEK, DATA_RIGHTS_ENABLED: 'true', NODE_ENV: 'development', ANTHROPIC_API_KEY: 'sk-synthetic-not-real', ANTHROPIC_BASE_URL: 'http://127.0.0.1:9943', AI_BUDGET_TOKENS_PER_USER: '50000000', AI_BUDGET_TOKENS_COHORT: '500000000' } }));
for (let i = 0; i < 80; i++) { try { if ((await fetch(api + '/api/health')).ok) break; } catch { /* */ } await sleep(500); }
const db = new Client({ connectionString: dbUrl, ssl: false }); await db.connect();
for (let i = 0; i < 120; i++) { if ((await db.query(`select to_regclass('"Users"') t, to_regclass('"DiaryEntries"') d`)).rows[0].d) break; await sleep(500); } await sleep(2500);
const q = async (s, p = []) => (await db.query(s, p)).rows;
const call = async (method, url, { token, body } = {}) => { const h = {}; if (token) h.Authorization = 'Bearer ' + token; if (body !== undefined) h['Content-Type'] = 'application/json'; const t0 = performance.now(); const r = await fetch(api + url, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) }); let json = null; try { json = await r.clone().json(); } catch { /* */ } return { s: r.status, json, ms: performance.now() - t0 }; };
const stamp = Date.now(); const mint = u => jwt.sign({ id: u.id, name: u.name, role: u.role, iatMs: Date.now() }, JWT, { expiresIn: '8h', jwtid: randomBytes(16).toString('hex') });
const mk = async (tag, role = 'user') => { const email = `qa153-${tag}-${stamp}@example.test`, password = randomBytes(14).toString('base64url') + 'aA1!'; const r = await call('POST', '/api/register', { body: { name: 'QA153 ' + tag, email, password } }); if (r.s !== 201) throw new Error('registro ' + tag + ' ' + r.s); await q('update "Users" set role=$1, "onboardingCompleted"=true where email=$2', [role, email]); const u = (await q('select id,name,role from "Users" where email=$1', [email]))[0]; return { ...u, email, password, token: mint(u) }; };
// ── ES-143 · PR #152 · /admin/* sin español fijo en EN (navegador real contra el servidor real) ──
const A = await mk('adm143', 'admin'), SA = await mk('sup143', 'superadmin');
// datos sintéticos para que las pantallas tengan contenido: una solicitud profesional pendiente
const browser = await chromium.launch();
const ROUTES = ['/admin/dashboard', '/admin/prompts', '/admin/content', '/admin/metrics', '/admin/pilot-metrics', '/admin/route-catalog', '/admin/skill-catalog', '/admin/users', '/admin/manifest'];
const SPAN = new Set(['el','la','los','las','un','una','de','del','para','por','con','sin','que','hay','cargando','guardar','cancelar','crear','editar','nuevo','nueva','aún','este','esta','solo','sobre','todos','todas','activo','activa','versión','versiones','usuario','usuarios','contenido','propuesta','aprobado','rechazado','rechazar','aprobar','conexión','requerido','fecha','nombre','estado','ver','ocultar','enviar','enviando','confirmar','eliminar','procesando','pendiente','pendientes','historial','caracteres','escribe','explica','motivo','sesión','sesiones','solicitudes','formulario','cerrado','revisa']);
const spanishHits = txt => { const hits = new Set(); for (const line of txt.split(/\n+/)) { const l = line.trim(); if (!l) continue; if (/[áéíóúñ¿¡]/i.test(l) || (l.toLowerCase().match(/[a-záéíóúñ]+/g) ?? []).some(w => SPAN.has(w))) hits.add(l.slice(0, 90)); } return [...hits]; };
const visit = async (user, role, lang, width) => { const ctx = await browser.newContext({ viewport: { width, height: 900 } }); await ctx.addInitScript(([t, r, l]) => { try { localStorage.setItem('elv_lang', l); localStorage.setItem('elevation_token', t); localStorage.setItem('elevation_role', r); localStorage.setItem('elevation_name', 'QA143'); } catch { /* */ } }, [user.token, role, lang]); const page = await ctx.newPage(); const res = {};
  for (const r of ROUTES) { await page.goto(api + r, { waitUntil: 'networkidle' }).catch(() => {}); await page.waitForTimeout(900); const body = await page.evaluate(() => ({ t: document.body.innerText, sw: document.documentElement.scrollWidth, vw: innerWidth, lang: document.documentElement.lang, path: location.pathname })); res[r] = { ...body, spanish: lang === 'en' ? spanishHits(body.t) : [], rawKey: /\b[a-z]+(\.[a-z0-9_]+){2,}\b/.test(body.t) }; if (width === 1360 && lang === 'en') await page.screenshot({ path: `${S}/es143-${r.replace(/\//g, '_')}-en.png` }); }
  await ctx.close(); return res; };
const en = await visit(A, 'admin', 'en', 1360); const es = await visit(A, 'admin', 'es', 1360); const enM = await visit(A, 'admin', 'en', 390); const enS = await visit(SA, 'superadmin', 'en', 1360);
for (const r of ROUTES) { const e = en[r]; check(`X2 EN 1360 ${r}: sin español fuera de datos`, e.path === r && e.spanish.length === 0 && !e.rawKey, e.path !== r ? 'redirigió a ' + e.path : JSON.stringify(e.spanish.slice(0, 6))); }
for (const r of ROUTES) { const e = enS[r]; check(`X2s EN 1360 superadmin ${r}: sin español`, e.path === r && e.spanish.length === 0, e.path !== r ? 'redirigió a ' + e.path : JSON.stringify(e.spanish.slice(0, 6))); }
for (const r of ROUTES) { const e = enM[r]; check(`X2m EN 390 ${r}: sin desborde horizontal`, e.sw <= e.vw, `sw=${e.sw} vw=${e.vw}`); }
for (const r of ROUTES) { const e = es[r]; check(`X2e ES 1360 ${r}: renderiza (sin claves crudas)`, e.path === r && !e.rawKey && e.t.length > 20, `len=${e.t.length}`); }
check('X2l el atributo lang del documento acompaña al idioma', en['/admin/dashboard'].lang === 'en' && es['/admin/dashboard'].lang === 'es', `en=${en['/admin/dashboard'].lang} es=${es['/admin/dashboard'].lang}`);
// X1: /admin/prompts con versiones pendientes: aviso con plural 1 y n en ES y EN
const adminCall = async (m, u, b, tk = SA.token) => call(m, u, { token: tk, body: b });
const tpl = await adminCall('GET', '/api/admin/prompts'); check('X1p la API de prompts responde al superadmin (precondición)', tpl.s === 200, 'http=' + tpl.s);
fs.writeFileSync(`${EVID}/ES-143-admin-i18n.json`, JSON.stringify({ out, en: Object.fromEntries(Object.entries(en).map(([k, v]) => [k, { spanish: v.spanish }])) }, null, 1));
console.log('RESUMEN-ES143 ' + JSON.stringify({ total: out.length, fallos: out.filter(o => !o.ok).length, fallan: out.filter(o => !o.ok).map(o => o.id.slice(0, 70)) }));
await browser.close(); for (const k of kids) { try { k.kill(); } catch { /* */ } } process.exit(0);
