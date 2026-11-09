// [QA-Claude] ES-42 · Corte 3 · matriz consolidada de ownership (O1), roles (O2), frontera privada con el terapeuta (O5) y entradas maliciosas (O9) + carga acotada (P1).
// Servidor real del merge local de main (3ab3a41) + PostgreSQL embebido, proveedor de IA SIMULADO, datos sintéticos, 0 tokens. No imprime secretos.
import { createRequire } from 'node:module';
import { randomBytes, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const BACK = 'C:/Users/Usuario/Documents/qa-pr-test/backend', S = 'C:/Users/Usuario/Documents/qa13';
const req = createRequire(BACK + '/package.json'); const { Client } = req('pg'); const jwt = req('jsonwebtoken');
const JWT = fs.readFileSync(S + '/jwt', 'utf8').trim(), DEK = fs.readFileSync(S + '/dek', 'utf8').trim(), PEK = fs.readFileSync(S + '/pek', 'utf8').trim();
const DBN = 'q220b', PORT = 8256, api = `http://127.0.0.1:${PORT}`, dbUrl = `postgres://elevation:elevation_local@127.0.0.1:54459/${DBN}`;
const admin = new Client({ connectionString: 'postgres://elevation:elevation_local@127.0.0.1:54459/postgres' }); await admin.connect(); await admin.query(`DROP DATABASE IF EXISTS ${DBN} WITH (FORCE)`); await admin.query(`CREATE DATABASE ${DBN}`);
const out = []; const check = (id, ok, d = '') => { out.push({ id, ok: !!ok, detail: String(d).slice(0, 420) }); console.log(JSON.stringify({ id, ok: !!ok, detail: String(d).slice(0, 340) })); };
const sleep = ms => new Promise(r => setTimeout(r, ms)); const kids = [];
kids.push(spawn(process.execPath, [S + '/m142mock.cjs', '9956'], { stdio: 'ignore' }));
kids.push(spawn(process.execPath, ['server.js'], { cwd: BACK, stdio: 'ignore', env: { ...process.env, PORT: String(PORT), DATABASE_URL: dbUrl, DB_SSL: 'false', JWT_SECRET: JWT, DATA_ENCRYPTION_KEY: DEK, PROMPT_ENCRYPTION_KEY: PEK, DATA_RIGHTS_ENABLED: 'true', NODE_ENV: 'development', TRUST_PROXY_HOPS: '1', ANTHROPIC_API_KEY: 'sk-synthetic-not-real', ANTHROPIC_BASE_URL: 'http://127.0.0.1:9956', AI_BUDGET_TOKENS_PER_USER: '50000000', AI_BUDGET_TOKENS_COHORT: '500000000' } }));
for (let i = 0; i < 80; i++) { try { if ((await fetch(api + '/api/health')).ok) break; } catch { /* */ } await sleep(500); }
const db = new Client({ connectionString: dbUrl, ssl: false }); await db.connect(); for (let i = 0; i < 120; i++) { if ((await db.query(`select to_regclass('"Users"') t, to_regclass('"Messages"') m, to_regclass('"DiaryEntries"') d`)).rows[0].d) break; await sleep(500); } await sleep(2500);
const q = async (s, p = []) => (await db.query(s, p)).rows;
const call = async (method, url, { token, body } = {}) => { const h = {}; if (token) h.Authorization = 'Bearer ' + token; if (body !== undefined) h['Content-Type'] = 'application/json'; const t0 = performance.now(); const r = await fetch(api + url, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) }); const text = await r.text(); let json = null; try { json = JSON.parse(text); } catch { /* */ } return { s: r.status, json, text, ms: performance.now() - t0 }; };
const stamp = Date.now(); const mint = u => jwt.sign({ id: u.id, name: u.name, role: u.role, iatMs: Date.now() }, JWT, { expiresIn: '8h', jwtid: randomBytes(16).toString('hex') });
const mkUser = async (tag, role = 'user') => { const email = `qa42-${tag}-${stamp}@example.test`, password = randomBytes(14).toString('base64url') + 'aA1!'; const r = await call('POST', '/api/register', { body: { name: 'QA42 ' + tag, email, password } }); if (r.s !== 201) throw new Error('registro ' + tag + ' ' + r.s); if (role !== 'user') await q('update "Users" set role=$1 where email=$2', [role, email]); const u = (await q('select id,name,role from "Users" where email=$1', [email]))[0]; return { ...u, token: mint(u) }; };
const A = await mkUser('A'), B = await mkUser('B');
// ── ES-220 · PR #163 · ¿la concurrencia reabre el oráculo? ráfagas pequeñas desde UNA sola IP (dentro del límite de 10/min) ──
const FIXED = '198.51.100.9';
const lg = async (email, password, ip) => { const r = await fetch(api + '/api/login', { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': ip }, body: JSON.stringify({ email, password }) }); return { s: r.status, text: await r.text() }; };
const pw = () => randomBytes(14).toString('base64url') + 'aA1!';
const reg = async (tag, active = true) => { const email = `qa220b-${tag}-${stamp}@example.test`, password = pw(); const r = await call('POST', '/api/register', { body: { name: 'QA220b ' + tag, email, password } }); if (r.s !== 201) throw new Error('registro ' + tag + ' ' + r.s); if (!active) await q('update "Users" set active=false where email=$1', [email]); return { email, password }; };
const burst = async (email, n, ip) => (await Promise.all(Array.from({ length: n }, (_, i) => lg(email, 'Mala1!' + i, ip)))).map(r => r.s);
const rows = []; for (let round = 0; round < 3; round++) {
  const real = await reg('r' + round), ina = await reg('i' + round, false), nx = `nxb${round}-${stamp}@example.test`;
  const ip = `198.51.100.${10 + round * 3}`; const bR = await burst(real.email, 5, ip); const bN = await burst(nx, 5, `198.51.100.${11 + round * 3}`); const bI = await burst(ina.email, 5, `198.51.100.${12 + round * 3}`);
  const dbRow = (await q('select "loginAttempts" la, "lockedUntil" lu from "Users" where email=$1', [real.email]))[0]; const next = await lg(real.email, real.password, `198.51.100.${200 + round}`);
  rows.push({ round, real: bR.join(','), inexistente: bN.join(','), inactiva: bI.join(','), bdIntentosReal: dbRow.la, realBloqueada: !!dbRow.lu, loginCorrectoDespues: next.s });
}
const distinguible = rows.every(r => r.real.split(',').every(s => s === '401') && r.inexistente.includes('423'));
check('E8c ráfaga de 5 intentos simultáneos desde UNA IP (≤ 10/min): la cuenta REAL responde solo 401 y NO se bloquea, mientras el correo INEXISTENTE llega a 423 → el oráculo de ES-220 se reabre con concurrencia', !distinguible, JSON.stringify(rows));
check('E8d la cuenta real sigue admitiendo el inicio de sesión correcto tras la ráfaga (no quedó bloqueada: el límite de intentos se esquiva con peticiones simultáneas)', rows.every(r => r.loginCorrectoDespues === 200), rows.map(r => r.loginCorrectoDespues).join(','));
fs.writeFileSync(path.join('C:/Users/Usuario/Documents/gpt-elevation-qa/qa/evidence', 'ES-220-concurrencia.json'), JSON.stringify(rows, null, 1));
console.log('RESUMEN-ES220B ' + JSON.stringify({ distinguible, rows }));
for (const k of kids) { try { k.kill(); } catch { /* */ } } process.exit(0);
