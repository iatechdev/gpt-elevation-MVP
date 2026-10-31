// [QA-Claude] Landing: chips de estado editables por superadmin (ES-66/ES-70): edición, independencia ES/EN, HTML, límites y permisos, verificados en navegador.
// Uso: PLAYWRIGHT_MODULE=<ruta> PLAYWRIGHT_BROWSERS_PATH=<ruta> QA_SUT=<clon> QA_API=http://127.0.0.1:8170 DATABASE_URL=<base> QA_JWT_SECRET=<clave> STATUS_KEY=landing.features.conversation.status node qa/integration/landing-status-edit.mjs
import { createRequire } from 'node:module';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
const sut = process.env.QA_SUT, api = process.env.QA_API, dbUrl = process.env.DATABASE_URL, JWT = process.env.QA_JWT_SECRET, KEY = process.env.STATUS_KEY, TAG = process.env.TAG || 'ST';
const req = createRequire(path.join(sut, 'backend', 'package.json'));
const { Client } = req('pg'); const jwt = req('jsonwebtoken');
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const db = new Client({ connectionString: dbUrl, ssl: false }); await db.connect(); const q = async (s, p = []) => (await db.query(s, p)).rows;
const check = (id, ok, d = '') => console.log(JSON.stringify({ id, ok: !!ok, detail: d }));
const stamp = Date.now();
const mk = async (tag, role) => { const email = `qa-st-${tag}-${stamp}@example.test`; await fetch(api + '/api/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'QAST ' + tag, email, password: randomBytes(12).toString('base64url') + 'aA1!' }) }); if (role !== 'user') await q('update "Users" set role=$1 where email=$2', [role, email]); const u = (await q('select id,name,role from "Users" where email=$1', [email]))[0]; return jwt.sign({ id: u.id, name: u.name, role: u.role, iatMs: Date.now() }, JWT, { expiresIn: '8h', jwtid: randomBytes(8).toString('hex') }); };
const su = await mk('su', 'superadmin'), adm = await mk('adm', 'admin'), usr = await mk('usr', 'user');
const put = (t, body) => fetch(api + '/api/landing-content', { method: 'PUT', headers: { 'content-type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}) }, body: JSON.stringify(body) });
const get = async (lang) => (await (await fetch(api + '/api/landing-content?lang=' + lang)).json());
const orig = { es: (await get('es'))[KEY], en: (await get('en'))[KEY] };
check(TAG + '-01 el estado inicial es «Próximamente» / «Coming soon»', /Próximamente/i.test(orig.es) && /Coming soon/i.test(orig.en), JSON.stringify(orig));
check(TAG + '-02 administrador, usuario y sin token no pueden editar un estado', (await put(adm, { key: KEY, lang: 'es', value: 'Disponible' })).status === 403 && (await put(usr, { key: KEY, lang: 'es', value: 'Disponible' })).status === 403 && [401, 403].includes((await put(null, { key: KEY, lang: 'es', value: 'Disponible' })).status), '');
const r1 = await put(su, { key: KEY, lang: 'es', value: 'Disponible' }); check(TAG + '-03 superadmin cambia el estado ES a «Disponible» → 200', r1.status === 200, `status=${r1.status}`);
check(TAG + '-04 el cambio en ES no altera EN (independientes)', (await get('en'))[KEY] === orig.en && (await get('es'))[KEY] === 'Disponible', '');
const bad = [['vacío', ''], ['solo espacios', '   '], ['5001 caracteres', 'x'.repeat(5001)]]; for (const [n, v] of bad) check(TAG + `-05 valor ${n} → 400 y no cambia`, (await put(su, { key: KEY, lang: 'es', value: v })).status === 400 && (await get('es'))[KEY] === 'Disponible', '');
await put(su, { key: KEY, lang: 'en', value: '<img src=x onerror=window.__x=1> "Available" <b>x</b>' });
const browser = await chromium.launch({ headless: true });
for (const [lang, expect] of [['ES', /Disponible/], ['EN', /<img src=x/]]) {
  const ctx = await browser.newContext({ viewport: { width: 320, height: 900 } }); await ctx.addInitScript(l => localStorage.setItem('elv_lang', l), lang.toLowerCase()); const page = await ctx.newPage();
  await page.goto(api + '/'); await page.waitForTimeout(1800);
  const info = await page.evaluate(() => ({ chips: document.body.innerText, x: !!window.__x, img: document.querySelectorAll('main img[src="x"]').length, hs: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 }));
  check(TAG + `-06 ${lang}: el chip refleja el texto editado, HTML como texto sin ejecutar y sin desbordar a 320 px`, expect.test(info.chips) && !info.x && info.img === 0 && !info.hs, `x=${info.x} img=${info.img} hs=${info.hs}`);
  await ctx.close();
}
await put(su, { key: KEY, lang: 'es', value: orig.es }); await put(su, { key: KEY, lang: 'en', value: orig.en });
check(TAG + '-07 se restauran los textos originales', (await get('es'))[KEY] === orig.es && (await get('en'))[KEY] === orig.en, '');
await browser.close(); await db.end(); console.log(JSON.stringify({ fin: true }));
