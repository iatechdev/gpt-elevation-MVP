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
const DBN = 'q42c', PORT = 8243, api = `http://127.0.0.1:${PORT}`, dbUrl = `postgres://elevation:elevation_local@127.0.0.1:54459/${DBN}`;
const admin = new Client({ connectionString: 'postgres://elevation:elevation_local@127.0.0.1:54459/postgres' }); await admin.connect(); await admin.query(`DROP DATABASE IF EXISTS ${DBN} WITH (FORCE)`); await admin.query(`CREATE DATABASE ${DBN}`);
const out = []; const check = (id, ok, d = '') => { out.push({ id, ok: !!ok, detail: String(d).slice(0, 420) }); console.log(JSON.stringify({ id, ok: !!ok, detail: String(d).slice(0, 340) })); };
const sleep = ms => new Promise(r => setTimeout(r, ms)); const kids = [];
kids.push(spawn(process.execPath, [S + '/m142mock.cjs', '9943'], { stdio: 'ignore' }));
kids.push(spawn(process.execPath, ['server.js'], { cwd: BACK, stdio: 'ignore', env: { ...process.env, PORT: String(PORT), DATABASE_URL: dbUrl, DB_SSL: 'false', JWT_SECRET: JWT, DATA_ENCRYPTION_KEY: DEK, PROMPT_ENCRYPTION_KEY: PEK, DATA_RIGHTS_ENABLED: 'true', NODE_ENV: 'development', ANTHROPIC_API_KEY: 'sk-synthetic-not-real', ANTHROPIC_BASE_URL: 'http://127.0.0.1:9943', AI_BUDGET_TOKENS_PER_USER: '50000000', AI_BUDGET_TOKENS_COHORT: '500000000' } }));
for (let i = 0; i < 80; i++) { try { if ((await fetch(api + '/api/health')).ok) break; } catch { /* */ } await sleep(500); }
const db = new Client({ connectionString: dbUrl, ssl: false }); await db.connect(); for (let i = 0; i < 120; i++) { if ((await db.query(`select to_regclass('"Users"') t, to_regclass('"Messages"') m, to_regclass('"DiaryEntries"') d`)).rows[0].d) break; await sleep(500); } await sleep(2500);
const q = async (s, p = []) => (await db.query(s, p)).rows;
const call = async (method, url, { token, body } = {}) => { const h = {}; if (token) h.Authorization = 'Bearer ' + token; if (body !== undefined) h['Content-Type'] = 'application/json'; const t0 = performance.now(); const r = await fetch(api + url, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) }); const text = await r.text(); let json = null; try { json = JSON.parse(text); } catch { /* */ } return { s: r.status, json, text, ms: performance.now() - t0 }; };
const stamp = Date.now(); const mint = u => jwt.sign({ id: u.id, name: u.name, role: u.role, iatMs: Date.now() }, JWT, { expiresIn: '8h', jwtid: randomBytes(16).toString('hex') });
const mkUser = async (tag, role = 'user') => { const email = `qa42-${tag}-${stamp}@example.test`, password = randomBytes(14).toString('base64url') + 'aA1!'; const r = await call('POST', '/api/register', { body: { name: 'QA42 ' + tag, email, password } }); if (r.s !== 201) throw new Error('registro ' + tag + ' ' + r.s); if (role !== 'user') await q('update "Users" set role=$1 where email=$2', [role, email]); const u = (await q('select id,name,role from "Users" where email=$1', [email]))[0]; return { ...u, token: mint(u) }; };
const A = await mkUser('A'), B = await mkUser('B');
// ── ES-42 · Corte 3 · complemento C: derechos de datos (exportación propia / ajena) ──
const X = await mkUser('x'), Y = await mkUser('y');
await call('POST', '/api/diary', { token: X.token, body: { date: '2026-11-03', content: 'DIARIO-DE-X-QA42C' } }); await call('POST', '/api/diary', { token: Y.token, body: { date: '2026-11-03', content: 'DIARIO-DE-Y-QA42C-SECRETO' } });
const pv = await call('POST', '/api/exports/preview', { token: X.token, body: { type: 'personal', locale: 'es' } });
const dlRaw = async (u, id) => { const r = await fetch(api + `/api/exports/${id}/download`, { method: 'POST', headers: { Authorization: 'Bearer ' + u.token, 'content-type': 'application/json' }, body: '{}' }); const buf = Buffer.from(await r.arrayBuffer()); return { s: r.status, text: buf.toString('latin1'), len: buf.length }; };
const own = pv.json?.id ? await dlRaw(X, pv.json.id) : { s: 0, text: '' }; const foreign = pv.json?.id ? await dlRaw(Y, pv.json.id) : { s: 0, text: '' }; const anon = pv.json?.id ? await fetch(api + `/api/exports/${pv.json.id}/download`, { method: 'POST' }) : { status: 0 };
check('D1 la exportación propia se genera (201) y se descarga (200)', pv.s === 201 && own.s === 200 && own.len > 100, `preview=${pv.s} descarga=${own.s} bytes=${own.len}`);
check('D2 otra persona NO descarga la exportación de X (403/404) y sin sesión tampoco', [403, 404].includes(foreign.s) && !foreign.text.includes('DIARIO-DE-X') && [401, 403].includes(anon.status), `ajena=${foreign.s} sinSesion=${anon.status}`);
check('D3 la exportación de X no contiene datos de Y', !own.text.includes('SECRETO') && !own.text.includes('DIARIO-DE-Y'), 'sin canario de Y');
const idsAjenos = []; for (const id of [0, -1, 999999, "1'; DROP TABLE x;--", '../../etc/passwd']) idsAjenos.push((await call('POST', `/api/exports/${encodeURIComponent(id)}/download`, { token: Y.token, body: {} })).s);
check('D4 IDs de exportación raros o inexistentes: 4xx y nunca 5xx', idsAjenos.every(s => s >= 400 && s < 500), idsAjenos.join(','));
const del = await call('POST', '/api/account/deletion-requests', { token: Y.token, body: { confirm: true, locale: 'es' } });
const yAfter = await call('GET', '/api/diary', { token: Y.token }); const xAfter = await call('GET', '/api/diary', { token: X.token });
check('D5 solicitar el borrado de Y: se acepta de forma controlada, no afecta a X, y no hay 5xx', del.s < 500 && xAfter.s === 200, `borrado=${del.s} ${del.text.slice(0, 90)} · Y después=${yAfter.s} · X después=${xAfter.s}`);
fs.writeFileSync(path.join('C:/Users/Usuario/Documents/gpt-elevation-qa/qa/evidence', 'ES-42-complemento-c.json'), JSON.stringify(out, null, 1));
console.log('RESUMEN-ES42C ' + JSON.stringify({ total: out.length, fallos: out.filter(o => !o.ok).length }));
for (const k of kids) { try { k.kill(); } catch { /* */ } } process.exit(0);
