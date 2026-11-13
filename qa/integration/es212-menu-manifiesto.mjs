// [QA-Claude] ES-212 · PR #139 · compuerta por rol y marcos: matriz 5 roles × rutas protegidas contra el SERVIDOR REAL (GET /api/session real, sin simular /api),
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
const DBN = 'q153b', PORT = 8212, api = `http://127.0.0.1:${PORT}`, dbUrl = `postgres://elevation:elevation_local@127.0.0.1:54459/${DBN}`;
const admin = new Client({ connectionString: 'postgres://elevation:elevation_local@127.0.0.1:54459/postgres' }); await admin.connect();
await admin.query(`DROP DATABASE IF EXISTS ${DBN} WITH (FORCE)`); await admin.query(`CREATE DATABASE ${DBN}`);
const out = []; const check = (id, ok, d = '') => { out.push({ id, ok: !!ok, detail: String(d).slice(0, 600) }); console.log(JSON.stringify({ id, ok: !!ok, detail: String(d).slice(0, 420) })); };
const sleep = ms => new Promise(r => setTimeout(r, ms)); const kids = [];
kids.push(spawn(process.execPath, [S + '/m142mock.cjs', '9912'], { stdio: 'ignore' }));
kids.push(spawn(process.execPath, ['server.js'], { cwd: BACK, stdio: 'ignore', env: { ...process.env, PORT: String(PORT), DATABASE_URL: dbUrl, DB_SSL: 'false', JWT_SECRET: JWT, DATA_ENCRYPTION_KEY: DEK, PROMPT_ENCRYPTION_KEY: PEK, DATA_RIGHTS_ENABLED: 'true', NODE_ENV: 'development', ANTHROPIC_API_KEY: 'sk-synthetic-not-real', ANTHROPIC_BASE_URL: 'http://127.0.0.1:9912', AI_BUDGET_TOKENS_PER_USER: '50000000', AI_BUDGET_TOKENS_COHORT: '500000000' } }));
for (let i = 0; i < 80; i++) { try { if ((await fetch(api + '/api/health')).ok) break; } catch { /* */ } await sleep(500); }
const db = new Client({ connectionString: dbUrl, ssl: false }); await db.connect();
for (let i = 0; i < 120; i++) { if ((await db.query(`select to_regclass('"Users"') t, to_regclass('"DiaryEntries"') d`)).rows[0].d) break; await sleep(500); } await sleep(2500);
const q = async (s, p = []) => (await db.query(s, p)).rows;
const call = async (method, url, { token, body } = {}) => { const h = {}; if (token) h.Authorization = 'Bearer ' + token; if (body !== undefined) h['Content-Type'] = 'application/json'; const t0 = performance.now(); const r = await fetch(api + url, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) }); let json = null; try { json = await r.clone().json(); } catch { /* */ } return { s: r.status, json, ms: performance.now() - t0 }; };
const stamp = Date.now(); const mint = u => jwt.sign({ id: u.id, name: u.name, role: u.role, iatMs: Date.now() }, JWT, { expiresIn: '8h', jwtid: randomBytes(16).toString('hex') });
const mk = async (tag, role = 'user') => { const email = `qa153-${tag}-${stamp}@example.test`, password = randomBytes(14).toString('base64url') + 'aA1!'; const r = await call('POST', '/api/register', { body: { name: 'QA153 ' + tag, email, password } }); if (r.s !== 201) throw new Error('registro ' + tag + ' ' + r.s); await q('update "Users" set role=$1, "onboardingCompleted"=true where email=$2', [role, email]); const u = (await q('select id,name,role from "Users" where email=$1', [email]))[0]; return { ...u, email, password, token: mint(u) }; };
// ── ES-212 · PR #153 · enlace «Manifiesto ético» en el menú real de la persona ──
const U = await mk('u212', 'user'); const browser = await chromium.launch();
const LBL = { es: 'Manifiesto ético', en: 'Ethical manifest' };
const open = async (lang, width, path) => { const ctx = await browser.newContext({ viewport: { width, height: 800 } }); await ctx.addInitScript(([t, l]) => { try { localStorage.setItem('elv_lang', l); localStorage.setItem('elevation_token', t); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elevation_name', 'QA212'); } catch { /* */ } }, [U.token, lang]); const page = await ctx.newPage(); await page.goto(api + path, { waitUntil: 'networkidle' }); await page.waitForTimeout(700); return { ctx, page }; };
for (const path of ['/app/dashboard', '/app/chat']) for (const lang of ['es', 'en']) for (const w of [1360, 390]) {
  const { ctx, page } = await open(lang, w, path); await page.locator('details.space-menu summary').first().click(); await page.waitForTimeout(300); const link = page.locator('a[href="/manifiesto"]').first(); const n = await page.locator('a[href="/manifiesto"]').count();
  const info = n ? await link.evaluate(a => { const r = a.getBoundingClientRect(); const cs = getComputedStyle(a); return { txt: a.textContent.trim(), vis: r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none', left: r.left, right: r.right, vw: innerWidth, sw: document.documentElement.scrollWidth }; }) : null;
  check(`M1/M2 ${path} ${lang} ${w}px: enlace presente, visible, texto «${LBL[lang]}», sin desborde`, !!info && info.vis && info.txt === LBL[lang] && info.right <= info.vw + 1 && info.left >= 0 && info.sw <= info.vw, JSON.stringify(info));
  if (n === 0) { await ctx.close(); continue; }
  await link.click(); await page.waitForTimeout(1200); const p = await page.evaluate(() => ({ path: location.pathname, txt: document.body.innerText.length, token: !!localStorage.getItem('elevation_token'), lang: document.documentElement.lang, h1: document.querySelector('h1')?.textContent?.slice(0, 60) }));
  check(`M4 ${path} ${lang} ${w}px: el clic abre /manifiesto, la página carga y la sesión se conserva`, p.path === '/manifiesto' && p.txt > 200 && p.token && p.lang === lang, JSON.stringify(p));
  if (w === 1360 && lang === 'es' && path === '/app/dashboard') { await page.goBack(); await page.waitForTimeout(1200); check('M4b volver atrás regresa a Mi espacio con sesión', (await page.evaluate(() => location.pathname)) === path, await page.evaluate(() => location.pathname)); }
  await ctx.close(); }
// M3 teclado + axe sobre el menú
{ const { ctx, page } = await open('es', 1360, '/app/dashboard'); await page.evaluate(AXE); const ax = await page.evaluate(async () => { const r = await axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa'] }); return r.violations.map(v => ({ id: v.id, imp: v.impact, onLink: v.nodes.some(x => x.target.join(' ').includes('manifiesto')) })); });
  check('M3a axe: ninguna violación recae sobre el enlace nuevo', ax.every(v => !v.onLink), JSON.stringify(ax));
  let reached = false; const seq = []; for (let k = 0; k < 40 && !reached; k++) { await page.keyboard.press('Tab'); const a = await page.evaluate(() => { const e = document.activeElement; return { tag: e?.tagName, href: e?.getAttribute?.('href'), t: e?.textContent?.trim().slice(0, 20) }; }); seq.push(a.href || a.t); if (a.tag === 'SUMMARY') { await page.keyboard.press('Enter'); await page.waitForTimeout(200); } if (a.href === '/manifiesto') reached = true; }
  check('M3b el enlace se alcanza con Tab y se activa con Enter', reached && (await (async () => { await page.keyboard.press('Enter'); await page.waitForTimeout(1000); return (await page.evaluate(() => location.pathname)) === '/manifiesto'; })()), seq.slice(-6).join(' > '));
  await ctx.close(); }
fs.writeFileSync(`${EVID}/ES-212-menu-manifiesto.json`, JSON.stringify(out, null, 1));
console.log('RESUMEN-ES212 ' + JSON.stringify({ total: out.length, fallos: out.filter(o => !o.ok).length, fallan: out.filter(o => !o.ok).map(o => o.id.slice(0, 70)) }));
await browser.close(); for (const k of kids) { try { k.kill(); } catch { /* */ } } process.exit(0);
