// [QA-Claude] ES-42 · Corte 3 · matriz consolidada de ownership (O1), roles (O2), frontera privada con el terapeuta (O5) y entradas maliciosas (O9) + carga acotada (P1).
import { createRequire as __cr } from 'node:module';
// Servidor real del merge local de main (3ab3a41) + PostgreSQL embebido, proveedor de IA SIMULADO, datos sintéticos, 0 tokens. No imprime secretos.
import { createRequire } from 'node:module';
import { randomBytes, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const BACK = 'C:/Users/Usuario/Documents/qa-pr-test/backend', S = 'C:/Users/Usuario/Documents/qa13';
const req = createRequire(BACK + '/package.json'); const { Client } = req('pg'); const jwt = req('jsonwebtoken');
const JWT = fs.readFileSync(S + '/jwt', 'utf8').trim(), DEK = fs.readFileSync(S + '/dek', 'utf8').trim(), PEK = fs.readFileSync(S + '/pek', 'utf8').trim();
const DBN = 'q220c', PORT = 8257, api = `http://127.0.0.1:${PORT}`, dbUrl = `postgres://elevation:elevation_local@127.0.0.1:54459/${DBN}`;
const admin = new Client({ connectionString: 'postgres://elevation:elevation_local@127.0.0.1:54459/postgres' }); await admin.connect(); await admin.query(`DROP DATABASE IF EXISTS ${DBN} WITH (FORCE)`); await admin.query(`CREATE DATABASE ${DBN}`);
const out = []; const check = (id, ok, d = '') => { out.push({ id, ok: !!ok, detail: String(d).slice(0, 420) }); console.log(JSON.stringify({ id, ok: !!ok, detail: String(d).slice(0, 340) })); };
const sleep = ms => new Promise(r => setTimeout(r, ms)); const kids = [];
kids.push(spawn(process.execPath, [S + '/m142mock.cjs', '9957'], { stdio: 'ignore' }));
kids.push(spawn(process.execPath, ['server.js'], { cwd: BACK, stdio: 'ignore', env: { ...process.env, PORT: String(PORT), DATABASE_URL: dbUrl, DB_SSL: 'false', JWT_SECRET: JWT, DATA_ENCRYPTION_KEY: DEK, PROMPT_ENCRYPTION_KEY: PEK, DATA_RIGHTS_ENABLED: 'true', NODE_ENV: 'development', TRUST_PROXY_HOPS: '1', LOGIN_RATE_LIMIT_MAX: '1000', ANTHROPIC_API_KEY: 'sk-synthetic-not-real', ANTHROPIC_BASE_URL: 'http://127.0.0.1:9957', AI_BUDGET_TOKENS_PER_USER: '50000000', AI_BUDGET_TOKENS_COHORT: '500000000' } }));
for (let i = 0; i < 80; i++) { try { if ((await fetch(api + '/api/health')).ok) break; } catch { /* */ } await sleep(500); }
const db = new Client({ connectionString: dbUrl, ssl: false }); await db.connect(); for (let i = 0; i < 120; i++) { if ((await db.query(`select to_regclass('"Users"') t, to_regclass('"Messages"') m, to_regclass('"DiaryEntries"') d`)).rows[0].d) break; await sleep(500); } await sleep(2500);
const q = async (s, p = []) => (await db.query(s, p)).rows;
const call = async (method, url, { token, body } = {}) => { const h = {}; if (token) h.Authorization = 'Bearer ' + token; if (body !== undefined) h['Content-Type'] = 'application/json'; const t0 = performance.now(); const r = await fetch(api + url, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) }); const text = await r.text(); let json = null; try { json = JSON.parse(text); } catch { /* */ } return { s: r.status, json, text, ms: performance.now() - t0 }; };
const stamp = Date.now(); const mint = u => jwt.sign({ id: u.id, name: u.name, role: u.role, iatMs: Date.now() }, JWT, { expiresIn: '8h', jwtid: randomBytes(16).toString('hex') });
const mkUser = async (tag, role = 'user') => { const email = `qa42-${tag}-${stamp}@example.test`, password = randomBytes(14).toString('base64url') + 'aA1!'; const r = await call('POST', '/api/register', { body: { name: 'QA42 ' + tag, email, password } }); if (r.s !== 201) throw new Error('registro ' + tag + ' ' + r.s); if (role !== 'user') await q('update "Users" set role=$1 where email=$2', [role, email]); const u = (await q('select id,name,role from "Users" where email=$1', [email]))[0]; return { ...u, token: mint(u) }; };
const A = await mkUser('A'), B = await mkUser('B');
// ── ES-220 · PR #163 (head nuevo) · equivalencia del contador al vencer el bloqueo y sin decaimiento ──
let ipn = 0; const nextIp = () => `10.9.${(ipn >> 8) & 255}.${(ipn++ & 255) + 1}`;
const lg = async (email, password) => { const r = await fetch(api + '/api/login', { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': nextIp() }, body: JSON.stringify({ email, password }) }); return { s: r.status, text: await r.text() }; };
const pw = () => randomBytes(14).toString('base64url') + 'aA1!';
const email = `qa220c-${stamp}@example.test`, password = pw(); await call('POST', '/api/register', { body: { name: 'QA220c', email, password } });
const st = async () => (await q('select "loginAttempts" la, "lockedUntil" lu from "Users" where email=$1', [email]))[0];
// real: 3 fallos → bloqueo; vence; un fallo vuelve a bloquear (semántica de siempre)
const r1 = [await lg(email, 'x1'), await lg(email, 'x2'), await lg(email, 'x3')].map(r => r.s); await q(`update "Users" set "lockedUntil"=now() - interval '1 minute' where email=$1`, [email]);
const afterExpiry = await lg(email, 'x4'); const s1 = await st();
check('N1 cuenta REAL: 401,401,423; vencido el bloqueo, el primer fallo vuelve a bloquear (423) y el contador no se reinició', r1.join(',') === '401,401,423' && afterExpiry.s === 423 && s1.la >= 4 && !!s1.lu, `${r1} · tras vencer: ${afterExpiry.s} · BD intentos=${s1.la}`);
await q(`update "Users" set "lockedUntil"=now() - interval '1 minute' where email=$1`, [email]); const okAfter = await lg(email, password); const s2 = await st();
check('N2 cuenta REAL: tras vencer el bloqueo, la contraseña CORRECTA entra (200) y limpia contador y bloqueo', okAfter.s === 200 && s2.la === 0 && s2.lu === null, `login=${okAfter.s} intentos=${s2.la} bloqueo=${s2.lu}`);
// inexistente: mismo comportamiento (módulo directo con reloj controlado)
const la = createRequire(BACK + '/package.json')('./utils/loginAttempts.js'); la.reset(); const t0 = Date.now(); const k = 'fantasma@example.test';
const f = [la.recordFailure(k, t0).locked, la.recordFailure(k, t0 + 1000).locked, la.recordFailure(k, t0 + 2000).locked]; const afterLock = la.recordFailure(k, t0 + la.LOCK_MS + 5000);
check('N3 correo INEXISTENTE (reloj simulado): false,false,true; vencido el bloqueo, el primer fallo vuelve a bloquear — igual que la cuenta real', f.join(',') === 'false,false,true' && afterLock.locked === true, `${f} · tras vencer: bloqueado=${afterLock.locked}`);
la.reset(); const k2 = 'decae@example.test'; la.recordFailure(k2, t0); la.recordFailure(k2, t0 + 1000); const late = la.recordFailure(k2, t0 + 3 * la.LOCK_MS);
check('N4 sin decaimiento: dos fallos, una espera de 45 min y un tercero bloquean (como la cuenta real, cuyos intentos tampoco decaen)', late.locked === true, `tercer fallo tras 45 min: bloqueado=${late.locked}`);
// N5: 20 simultáneos sobre una cuenta real nueva: bloqueo en el 3.º y exactamente 3 respuestas distintas de 423
const e2 = `qa220c2-${stamp}@example.test`; await call('POST', '/api/register', { body: { name: 'QA220c2', email: e2, password: pw() } }); const burst = await Promise.all(Array.from({ length: 20 }, (_, i) => lg(e2, 'm' + i))); const n401 = burst.filter(r => r.s === 401).length, n423 = burst.filter(r => r.s === 423).length; const row2 = (await q('select "loginAttempts" la from "Users" where email=$1', [e2]))[0];
check('N5 20 simultáneos sobre una cuenta real: exactamente 2 respuestas 401 y 18 con 423 (igual que un correo inexistente), sin 5xx', n401 === 2 && n423 === 18 && burst.every(r => r.s < 500), `401=${n401} 423=${n423} BD intentos=${row2.la}`);
fs.writeFileSync(path.join('C:/Users/Usuario/Documents/gpt-elevation-qa/qa/evidence', 'ES-220-equivalencia.json'), JSON.stringify(out, null, 1));
console.log('RESUMEN-ES220C ' + JSON.stringify({ total: out.length, fallos: out.filter(o => !o.ok).length }));
for (const k of kids) { try { k.kill(); } catch { /* */ } } process.exit(0);
