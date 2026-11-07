// [QA-Claude] ES-132 · PR #128: repetición de F5 (muestras débiles correctas) y reproducción de S3 (carrera en el límite por cuenta). Mismo entorno que es132-api.cjs.
const fs = require('fs'); const path = require('path'); const E = process.env; const { Client } = require('C:/Users/Usuario/Documents/qa-pr-test/backend/node_modules/pg');
const A = E.A, OUT = E.OUT; const sleep = ms => new Promise(r => setTimeout(r, ms)); const stamp = Date.now(); const out = [];
const check = (id, ok, d = '') => { out.push({ id, ok: !!ok, detail: d }); console.log(JSON.stringify({ id, ok: !!ok, detail: String(d).slice(0, 500) })); };
const call = async (p, body) => { const r = await fetch(A + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch { /* */ } return { s: r.status, j }; };
const db = async (text, values) => { const c = new Client({ connectionString: 'postgres://elevation:elevation_local@127.0.0.1:54459/es132test' }); await c.connect(); const r = await c.query(text, values); await c.end(); return r; };
const mails = to => fs.readFileSync(path.join(E.MAILDIR, 'mail-a.jsonl'), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)).filter(m => m.to === to);
const tokenOf = m => decodeURIComponent((m.text.match(/#token=([^\s]+)/) || [])[1] || '');
const OLD = 'Clave-Original-QB132-' + stamp + 'aA!', STRONG = 'Nueva-Clave-QB132-' + stamp + 'aA!'; let n = 0;
const mk = async tag => { const email = `qb132-${tag}-${stamp}-${n++}@example.test`; await call('/api/register', { name: 'QB', email, password: OLD }); return email; };
(async () => {
  // F5 con muestras que sí incumplen la política de ES-128 (mínimo 8, mayúscula, minúscula, dígito y especial)
  const e = await mk('pol'); await call('/api/password-reset/request', { email: e }); await sleep(700); const t = tokenOf(mails(e)[0]);
  const weak = ['corta1A', 'sinmayuscula123!', 'SINMINUSCULA123!', 'SinDigitos-Largo!', 'SinEspecial12345Aa', ''];
  const wr = []; for (const w of weak) wr.push(await call('/api/password-reset/confirm', { token: t, password: w })); const ok = await call('/api/password-reset/confirm', { token: t, password: STRONG });
  check('F5-politica-ES128-no-gasta-el-enlace', wr.slice(0, 5).every(r => r.s === 400 && r.j && r.j.code === 'password_policy' && Array.isArray(r.j.missing)) && wr[5].s === 400 && ok.s === 200, `débiles=${wr.map(r => r.s + (r.j && r.j.code ? ':' + r.j.code : '')).join(' | ')}; luego válida=${ok.s}`);
  // S3: espaciadas 400 ms (esperado: 3 correos) y en ráfaga de 6 simultáneas (esperado: 3)
  const e2 = await mk('sp'); for (let i = 0; i < 4; i++) { await call('/api/password-reset/request', { email: e2 }); await sleep(400); } await sleep(500);
  check('S3a-espaciadas-limite-3', mails(e2).length === 3, `solicitudes espaciadas 400 ms: correos=${mails(e2).length}`);
  const e3 = await mk('rafaga'); await Promise.all(Array.from({ length: 6 }, () => call('/api/password-reset/request', { email: e3 }))); await sleep(1500);
  const rows = (await db('select count(*) from "PasswordResets" pr join "Users" u on u.id=pr."UserId" where u.email=$1', [e3])).rows[0].count; const vivos = (await db('select count(*) from "PasswordResets" pr join "Users" u on u.id=pr."UserId" where u.email=$1 and pr."usedAt" is null', [e3])).rows[0].count;
  check('S3b-rafaga-6-simultaneas-limite-3', mails(e3).length <= 3, `ráfaga de 6 simultáneas: correos emitidos=${mails(e3).length}, filas creadas=${rows}, enlaces vivos=${vivos} (esperado: ≤3 correos y 1 vivo)`);
  fs.writeFileSync(path.join(E.OUT, 'resultados-api-132-b.json'), JSON.stringify(out, null, 1));
})().catch(e => { console.log('ERROR', String(e.stack).slice(0, 500)); process.exit(1); });
