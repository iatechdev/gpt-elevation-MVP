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
const DBN = 'q217c', PORT = 8254, api = `http://127.0.0.1:${PORT}`, dbUrl = `postgres://elevation:elevation_local@127.0.0.1:54459/${DBN}`;
const admin = new Client({ connectionString: 'postgres://elevation:elevation_local@127.0.0.1:54459/postgres' }); await admin.connect(); await admin.query(`DROP DATABASE IF EXISTS ${DBN} WITH (FORCE)`); await admin.query(`CREATE DATABASE ${DBN}`);
const out = []; const check = (id, ok, d = '') => { out.push({ id, ok: !!ok, detail: String(d).slice(0, 420) }); console.log(JSON.stringify({ id, ok: !!ok, detail: String(d).slice(0, 340) })); };
const sleep = ms => new Promise(r => setTimeout(r, ms)); const kids = [];
kids.push(spawn(process.execPath, [S + '/m142mock.cjs', '9954'], { stdio: 'ignore' }));
kids.push(spawn(process.execPath, ['server.js'], { cwd: BACK, stdio: 'ignore', env: { ...process.env, PORT: String(PORT), DATABASE_URL: dbUrl, DB_SSL: 'false', JWT_SECRET: JWT, DATA_ENCRYPTION_KEY: DEK, PROMPT_ENCRYPTION_KEY: PEK, DATA_RIGHTS_ENABLED: 'true', NODE_ENV: 'development', ANTHROPIC_API_KEY: 'sk-synthetic-not-real', ANTHROPIC_BASE_URL: 'http://127.0.0.1:9954', AI_BUDGET_TOKENS_PER_USER: '50000000', AI_BUDGET_TOKENS_COHORT: '500000000' } }));
for (let i = 0; i < 80; i++) { try { if ((await fetch(api + '/api/health')).ok) break; } catch { /* */ } await sleep(500); }
const db = new Client({ connectionString: dbUrl, ssl: false }); await db.connect(); for (let i = 0; i < 120; i++) { if ((await db.query(`select to_regclass('"Users"') t, to_regclass('"Messages"') m, to_regclass('"DiaryEntries"') d`)).rows[0].d) break; await sleep(500); } await sleep(2500);
const q = async (s, p = []) => (await db.query(s, p)).rows;
const call = async (method, url, { token, body } = {}) => { const h = {}; if (token) h.Authorization = 'Bearer ' + token; if (body !== undefined) h['Content-Type'] = 'application/json'; const t0 = performance.now(); const r = await fetch(api + url, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) }); const text = await r.text(); let json = null; try { json = JSON.parse(text); } catch { /* */ } return { s: r.status, json, text, ms: performance.now() - t0 }; };
const stamp = Date.now(); const mint = u => jwt.sign({ id: u.id, name: u.name, role: u.role, iatMs: Date.now() }, JWT, { expiresIn: '8h', jwtid: randomBytes(16).toString('hex') });
const mkUser = async (tag, role = 'user') => { const email = `qa42-${tag}-${stamp}@example.test`, password = randomBytes(14).toString('base64url') + 'aA1!'; const r = await call('POST', '/api/register', { body: { name: 'QA42 ' + tag, email, password } }); if (r.s !== 201) throw new Error('registro ' + tag + ' ' + r.s); if (role !== 'user') await q('update "Users" set role=$1 where email=$2', [role, email]); const u = (await q('select id,name,role from "Users" where email=$1', [email]))[0]; return { ...u, email, password, token: mint(u) }; };
const A = await mkUser('A'), B = await mkUser('B');
const P = await mkUser('pv'), T = await mkUser('tv', 'therapist'), B2 = await mkUser('bv', 'board'), V = await mkUser('vv'), SUP = await mkUser('sv', 'superadmin');
const rs = {}; for (const [k, u] of Object.entries({ persona: P, profesional: T, junta: B2 })) { const r = await call('PUT', `/api/admin/usuarios/${V.id}/unlock`, { token: u.token }); const r2 = await call('PUT', `/api/admin/usuarios/${V.id}`, { token: u.token, body: { active: false } }); rs[k] = `${r.s}/${r2.s}`; }
const alive = await call('GET', '/api/diary', { token: P.token });
check('U5b con SESIÓN VÁLIDA, persona/profesional/junta → 403 en unlock y PUT de administración', alive.s === 200 && Object.values(rs).every(v => v === '403/403'), JSON.stringify(rs));
const edge = {}; for (const id of ['2147483647', '2147483648', '3000000000', '9999999999', '10000000000']) { const a = await call('PUT', `/api/admin/usuarios/${id}`, { token: SUP.token, body: { active: false } }); const b = await call('PUT', `/api/admin/usuarios/${id}/unlock`, { token: SUP.token }); const c = await call('DELETE', `/api/admin/usuarios/${id}`, { token: SUP.token }); edge[id] = `${a.s}/${b.s}/${c.s}`; }
check('I1c frontera int32: 2147483647 → 404 (no existe); 2147483648 en adelante → 400; ninguna 5xx (PUT/unlock/DELETE)', edge['2147483647'] === '404/404/404' && ['2147483648', '3000000000', '9999999999', '10000000000'].every(k => edge[k] === '400/400/400'), JSON.stringify(edge));
console.log('RESUMEN-U5 ' + JSON.stringify({ fallos: out.filter(o => !o.ok).length })); for (const k of kids) { try { k.kill(); } catch { /* */ } } process.exit(0);
