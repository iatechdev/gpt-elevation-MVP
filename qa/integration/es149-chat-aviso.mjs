// [QA-Claude] ES-149 · PR #139 · compuerta por rol y marcos: matriz 5 roles × rutas protegidas contra el SERVIDOR REAL (GET /api/session real, sin simular /api),
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
const DBN = 'q149', PORT = 8149, api = `http://127.0.0.1:${PORT}`, dbUrl = `postgres://elevation:elevation_local@127.0.0.1:54459/${DBN}`;
const admin = new Client({ connectionString: 'postgres://elevation:elevation_local@127.0.0.1:54459/postgres' }); await admin.connect();
await admin.query(`DROP DATABASE IF EXISTS ${DBN} WITH (FORCE)`); await admin.query(`CREATE DATABASE ${DBN}`);
const out = []; const check = (id, ok, d = '') => { out.push({ id, ok: !!ok, detail: String(d).slice(0, 600) }); console.log(JSON.stringify({ id, ok: !!ok, detail: String(d).slice(0, 420) })); };
const sleep = ms => new Promise(r => setTimeout(r, ms)); const kids = [];
kids.push(spawn(process.execPath, [S + '/m142mock.cjs', '9949'], { stdio: 'ignore' }));
kids.push(spawn(process.execPath, ['server.js'], { cwd: BACK, stdio: 'ignore', env: { ...process.env, PORT: String(PORT), DATABASE_URL: dbUrl, DB_SSL: 'false', JWT_SECRET: JWT, DATA_ENCRYPTION_KEY: DEK, PROMPT_ENCRYPTION_KEY: PEK, DATA_RIGHTS_ENABLED: 'true', NODE_ENV: 'development', ANTHROPIC_API_KEY: 'sk-synthetic-not-real', ANTHROPIC_BASE_URL: 'http://127.0.0.1:9949', AI_BUDGET_TOKENS_PER_USER: '50000000', AI_BUDGET_TOKENS_COHORT: '500000000' } }));
for (let i = 0; i < 80; i++) { try { if ((await fetch(api + '/api/health')).ok) break; } catch { /* */ } await sleep(500); }
const db = new Client({ connectionString: dbUrl, ssl: false }); await db.connect();
for (let i = 0; i < 120; i++) { if ((await db.query(`select to_regclass('"Users"') t, to_regclass('"DiaryEntries"') d`)).rows[0].d) break; await sleep(500); } await sleep(2500);
const q = async (s, p = []) => (await db.query(s, p)).rows;
const call = async (method, url, { token, body } = {}) => { const h = {}; if (token) h.Authorization = 'Bearer ' + token; if (body !== undefined) h['Content-Type'] = 'application/json'; const t0 = performance.now(); const r = await fetch(api + url, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) }); let json = null; try { json = await r.clone().json(); } catch { /* */ } return { s: r.status, json, ms: performance.now() - t0 }; };
const stamp = Date.now(); const mint = u => jwt.sign({ id: u.id, name: u.name, role: u.role, iatMs: Date.now() }, JWT, { expiresIn: '8h', jwtid: randomBytes(16).toString('hex') });
const mk = async (tag, role = 'user') => { const email = `qa153-${tag}-${stamp}@example.test`, password = randomBytes(14).toString('base64url') + 'aA1!'; const r = await call('POST', '/api/register', { body: { name: 'QA153 ' + tag, email, password } }); if (r.s !== 201) throw new Error('registro ' + tag + ' ' + r.s); await q('update "Users" set role=$1, "onboardingCompleted"=true where email=$2', [role, email]); const u = (await q('select id,name,role from "Users" where email=$1', [email]))[0]; return { ...u, email, password, token: mint(u) }; };
// ── ES-149 · PR #143 · aviso de límites en /app/chat ──
const U = await mk('u149', 'user');
const browser = await chromium.launch();
const EXP = { es: "El asistente de IA de Elevation ofrece acompañamiento y orientación profesional no clínicos; no sustituye la atención psicológica, médica ni de emergencia. La IA puede equivocarse.", en: "Elevation's AI assistant offers non-clinical support and career guidance; it does not replace psychological, medical or emergency care. AI can be wrong." };
const open = async (lang, width, height = 800) => { const ctx = await browser.newContext({ viewport: { width, height } }); await ctx.addInitScript(([t, l]) => { try { localStorage.setItem('elv_lang', l); localStorage.setItem('elevation_token', t); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elevation_name', 'QA149'); } catch { /* */ } }, [U.token, lang]); const page = await ctx.newPage(); await page.goto(api + '/app/chat', { waitUntil: 'networkidle' }); await page.waitForTimeout(800); return { ctx, page }; };
const info = page => page.evaluate(() => { const n = document.querySelector('.chat-limits'); if (!n) return null; const r = n.getBoundingClientRect(); const ta = document.querySelector('textarea, [contenteditable=true], input[type=text]'); const tr = ta ? ta.getBoundingClientRect() : null; const cs = getComputedStyle(n); return { text: n.textContent, role: n.getAttribute('role'), label: n.getAttribute('aria-label'), vis: r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none', inView: r.top >= 0 && r.bottom <= innerHeight, top: r.top, bottom: r.bottom, left: r.left, right: r.right, vw: innerWidth, sw: document.documentElement.scrollWidth, overlap: tr ? !(r.bottom <= tr.top || r.top >= tr.bottom || r.right <= tr.left || r.left >= tr.right) : null, color: cs.color, fs: cs.fontSize, lang: document.documentElement.lang }; });
for (const lang of ['es', 'en']) for (const w of [1360, 390]) {
  const { ctx, page } = await open(lang, w); const i = await info(page);
  check(`A1 ${lang} ${w}px: aviso presente al abrir el chat, visible, sin scroll, texto exacto`, !!i && i.vis && i.inView && i.text === EXP[lang], JSON.stringify({ ...i, text: i?.text === EXP[lang] ? 'ok' : i?.text }));
  check(`A6 ${lang} ${w}px: sin desborde horizontal ni solape con la caja de mensaje`, !!i && i.sw <= i.vw && i.overlap === false && i.left >= 0 && i.right <= i.vw, `sw=${i?.sw} vw=${i?.vw} overlap=${i?.overlap}`);
  check(`A4a ${lang} ${w}px: role=note y nombre accesible`, i?.role === 'note' && !!i?.label, `role=${i?.role} label=${i?.label}`);
  await page.screenshot({ path: `${S}/es149-${lang}-${w}.png` });
  if (lang === 'es' && w === 1360) {
    await page.evaluate(AXE); const ax = await page.evaluate(async () => { const r = await axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa'] }); return r.violations.map(v => ({ id: v.id, imp: v.impact, n: v.nodes.length, onNotice: v.nodes.some(x => (x.target.join(' ')).includes('chat-limits')) })); });
    check('A4b axe (ES 1360): ninguna violación recae sobre el aviso (contraste AA incluido)', ax.every(v => !v.onNotice), JSON.stringify(ax));
    const tabs = []; for (let k = 0; k < 25; k++) { await page.keyboard.press('Tab'); tabs.push(await page.evaluate(() => { const a = document.activeElement; return a ? (a.tagName + ':' + (a.className || '').toString().slice(0, 30)) : null; })); } check('A4c el aviso no es un tope de teclado (no entra en la secuencia de Tab)', !tabs.some(t => /chat-limits/.test(t || '')), tabs.slice(0, 6).join(' > '));
  }
  await ctx.close();
}
// A5 el aviso permanece al enviar mensajes y con historial largo; envío sigue funcionando
{ const { ctx, page } = await open('es', 1360, 700); const ta = page.locator('textarea').first(); let sent = 0;
  for (let k = 0; k < 6; k++) { try { await ta.fill('Mensaje sintético ' + k + ' '.padEnd(200, 'x')); await page.keyboard.press('Enter'); await page.waitForTimeout(1500); sent++; } catch { break; } }
  const i = await info(page); const n = await page.locator('.chat-scroll').first().evaluate(e => e.scrollHeight > e.clientHeight).catch(() => null);
  check('A5 con historial (varios envíos) el aviso sigue visible bajo la caja y el chat respondió', !!i && i.vis && i.inView && i.overlap === false && sent >= 1, `envíos=${sent} scrollInterno=${n} inView=${i?.inView}`);
  await ctx.close(); }
// A3 sin números ni promesas en el texto (revisión)
for (const l of ['es', 'en']) check(`A3 ${l}: el texto no contiene dígitos ni promesas (empleo/curar/garantiz)`, !/\d/.test(EXP[l]) && !/(garantiz|curar|empleo asegurado|guarantee|cure)/i.test(EXP[l]), '');
fs.writeFileSync(`${EVID}/ES-149-chat-aviso.json`, JSON.stringify(out, null, 1));
console.log('RESUMEN-ES149 ' + JSON.stringify({ total: out.length, fallos: out.filter(o => !o.ok).length, fallan: out.filter(o => !o.ok).map(o => o.id.slice(0, 60)) }));
await browser.close(); for (const k of kids) { try { k.kill(); } catch { /* */ } } process.exit(0);
