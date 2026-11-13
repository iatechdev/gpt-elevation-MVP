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
const DBN = 'q180p', PORT = 8262, api = `http://127.0.0.1:${PORT}`, dbUrl = `postgres://elevation:elevation_local@127.0.0.1:54459/${DBN}`;
const admin = new Client({ connectionString: 'postgres://elevation:elevation_local@127.0.0.1:54459/postgres' }); await admin.connect(); await admin.query(`DROP DATABASE IF EXISTS ${DBN} WITH (FORCE)`); await admin.query(`CREATE DATABASE ${DBN}`);
const out = []; const check = (id, ok, d = '') => { out.push({ id, ok: !!ok, detail: String(d).slice(0, 420) }); console.log(JSON.stringify({ id, ok: !!ok, detail: String(d).slice(0, 340) })); };
const sleep = ms => new Promise(r => setTimeout(r, ms)); const kids = [];
kids.push(spawn(process.execPath, [S + '/m142mock.cjs', '9962'], { stdio: 'ignore' }));
kids.push(spawn(process.execPath, ['server.js'], { cwd: BACK, stdio: 'ignore', env: { ...process.env, PORT: String(PORT), DATABASE_URL: dbUrl, DB_SSL: 'false', JWT_SECRET: JWT, DATA_ENCRYPTION_KEY: DEK, PROMPT_ENCRYPTION_KEY: PEK, DATA_RIGHTS_ENABLED: 'true', NODE_ENV: 'development', ANTHROPIC_API_KEY: 'sk-synthetic-not-real', ANTHROPIC_BASE_URL: 'http://127.0.0.1:9962', AI_BUDGET_TOKENS_PER_USER: '50000000', AI_BUDGET_TOKENS_COHORT: '500000000' } }));
for (let i = 0; i < 80; i++) { try { if ((await fetch(api + '/api/health')).ok) break; } catch { /* */ } await sleep(500); }
const db = new Client({ connectionString: dbUrl, ssl: false }); await db.connect(); for (let i = 0; i < 120; i++) { if ((await db.query(`select to_regclass('"Users"') t, to_regclass('"Messages"') m, to_regclass('"DiaryEntries"') d`)).rows[0].d) break; await sleep(500); } await sleep(2500);
const q = async (s, p = []) => (await db.query(s, p)).rows;
const call = async (method, url, { token, body } = {}) => { const h = {}; if (token) h.Authorization = 'Bearer ' + token; if (body !== undefined) h['Content-Type'] = 'application/json'; const t0 = performance.now(); const r = await fetch(api + url, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) }); const text = await r.text(); let json = null; try { json = JSON.parse(text); } catch { /* */ } return { s: r.status, json, text, ms: performance.now() - t0 }; };
const stamp = Date.now(); const mint = u => jwt.sign({ id: u.id, name: u.name, role: u.role, iatMs: Date.now() }, JWT, { expiresIn: '8h', jwtid: randomBytes(16).toString('hex') });
const mkUser = async (tag, role = 'user') => { const email = `qa42-${tag}-${stamp}@example.test`, password = randomBytes(14).toString('base64url') + 'aA1!'; const r = await call('POST', '/api/register', { body: { name: 'QA42 ' + tag, email, password } }); if (r.s !== 201) throw new Error('registro ' + tag + ' ' + r.s); if (role !== 'user') await q('update "Users" set role=$1 where email=$2', [role, email]); const u = (await q('select id,name,role from "Users" where email=$1', [email]))[0]; return { ...u, email, password, token: mint(u) }; };
const A = await mkUser('A'), B = await mkUser('B');
// ── ES-180 · B8 rendimiento y B5 A/B de campos anteriores: mismo guion sobre el árbol de main (A) y el de #167 (B) ──
const LABEL = process.env.LABEL || 'x';
const ADM = await mkUser('adm', 'admin'); const TH = []; for (let i = 0; i < 200; i++) TH.push(await mkUser('t' + i, 'therapist')); const PU = []; for (let i = 0; i < 450; i++) PU.push(await mkUser('p' + i));
await q(`update "Users" set "therapistId" = (select id from "Users" t where t.role='therapist' order by t.id offset (("Users".id * 7) % 200) limit 1) where role='user'`);
await q(`insert into "MoodLogs"("UserId","date",checkin_mood,checkout_mood,"createdAt","updatedAt")
  select u.id, (now() at time zone 'America/Bogota')::date - ((g / 450) % 45), 1 + (g % 5), 1 + ((g + 2) % 5), now(), now() from generate_series(1, 20000) g join lateral (select id from "Users" where role='user' order by id offset (g % 450) limit 1) u on true`);
await q(`insert into "SessionRatings"("UserId",rating,"date","createdAt","updatedAt") select u.id, 1 + (g % 5), (now() at time zone 'America/Bogota')::date - ((g / 450) % 20), now(), now() from generate_series(1, 3000) g join lateral (select id from "Users" where role='user' order by id offset (g % 450) limit 1) u on true`);
const cnt = (await q(`select (select count(*)::int from "MoodLogs") m, (select count(*)::int from "Users" where role='therapist') t`))[0];
const lat = []; let status = 0; for (let i = 0; i < 5; i++) await call('GET', '/api/admin/metrics', { token: ADM.token });
for (let i = 0; i < 40; i++) { const r = await call('GET', '/api/admin/metrics', { token: ADM.token }); lat.push(r.ms); status = r.s; }
const conc = []; for (let k = 0; k < 5; k++) { const rs = await Promise.all(Array.from({ length: 6 }, () => call('GET', '/api/admin/metrics', { token: ADM.token }))); conc.push(...rs.map(r => r.ms)); }
const al = []; for (let i = 0; i < 20; i++) al.push((await call('GET', '/api/admin/usuarios/alerts', { token: ADM.token })).ms);
const p95 = a => { const s = [...a].sort((x, y) => x - y); return Math.round(s[Math.max(0, Math.ceil(s.length * 0.95) - 1)]); }; const med = a => Math.round([...a].sort((x, y) => x - y)[Math.floor(a.length / 2)]);
const r = await call('GET', '/api/admin/metrics', { token: ADM.token }); const j = r.json ?? {}; const legacy = { totalUsers: j.totalUsers, activeUsers: j.activeUsers, totalTherapists: j.totalTherapists, totalSessions: j.totalSessions, avgMood: j.avgMood, avgRating: j.avgRating, activeThisWeek: j.activeThisWeek, sessionsByDay: (j.sessionsByDay || []).map(d => ({ date: String(d.date).slice(0, 10), count: Number(d.count) })), topTherapists: (j.topTherapists || []).map(t => ({ id: t.id, name: t.name, patientCount: t.patientCount, avgRating: t.avgRating })) };
const res = { label: LABEL, datos: cnt, estado: status, seqP50: med(lat), seqP95: p95(lat), concP95: p95(conc), alertasP95: p95(al), legacyHash: (await import('node:crypto')).createHash('sha256').update(JSON.stringify(legacy)).digest('hex').slice(0, 16), legacy };
fs.writeFileSync(`C:/Users/Usuario/Documents/qa13/perf180-${LABEL}.json`, JSON.stringify(res, null, 1)); console.log('RESULT ' + JSON.stringify({ ...res, legacy: undefined }));
for (const k of kids) { try { k.kill(); } catch { /* */ } } process.exit(0);
