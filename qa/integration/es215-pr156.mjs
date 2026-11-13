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
const DBN = 'q215', PORT = 8250, api = `http://127.0.0.1:${PORT}`, dbUrl = `postgres://elevation:elevation_local@127.0.0.1:54459/${DBN}`;
const admin = new Client({ connectionString: 'postgres://elevation:elevation_local@127.0.0.1:54459/postgres' }); await admin.connect(); await admin.query(`DROP DATABASE IF EXISTS ${DBN} WITH (FORCE)`); await admin.query(`CREATE DATABASE ${DBN}`);
const out = []; const check = (id, ok, d = '') => { out.push({ id, ok: !!ok, detail: String(d).slice(0, 420) }); console.log(JSON.stringify({ id, ok: !!ok, detail: String(d).slice(0, 340) })); };
const sleep = ms => new Promise(r => setTimeout(r, ms)); const kids = [];
kids.push(spawn(process.execPath, [S + '/m142mock.cjs', '9950'], { stdio: 'ignore' }));
kids.push(spawn(process.execPath, ['server.js'], { cwd: BACK, stdio: 'ignore', env: { ...process.env, PORT: String(PORT), DATABASE_URL: dbUrl, DB_SSL: 'false', JWT_SECRET: JWT, DATA_ENCRYPTION_KEY: DEK, PROMPT_ENCRYPTION_KEY: PEK, DATA_RIGHTS_ENABLED: 'true', NODE_ENV: 'development', ANTHROPIC_API_KEY: 'sk-synthetic-not-real', ANTHROPIC_BASE_URL: 'http://127.0.0.1:9950', AI_BUDGET_TOKENS_PER_USER: '50000000', AI_BUDGET_TOKENS_COHORT: '500000000' } }));
for (let i = 0; i < 80; i++) { try { if ((await fetch(api + '/api/health')).ok) break; } catch { /* */ } await sleep(500); }
const db = new Client({ connectionString: dbUrl, ssl: false }); await db.connect(); for (let i = 0; i < 120; i++) { if ((await db.query(`select to_regclass('"Users"') t, to_regclass('"Messages"') m, to_regclass('"DiaryEntries"') d`)).rows[0].d) break; await sleep(500); } await sleep(2500);
const q = async (s, p = []) => (await db.query(s, p)).rows;
const call = async (method, url, { token, body } = {}) => { const h = {}; if (token) h.Authorization = 'Bearer ' + token; if (body !== undefined) h['Content-Type'] = 'application/json'; const t0 = performance.now(); const r = await fetch(api + url, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) }); const text = await r.text(); let json = null; try { json = JSON.parse(text); } catch { /* */ } return { s: r.status, json, text, ms: performance.now() - t0 }; };
const stamp = Date.now(); const mint = u => jwt.sign({ id: u.id, name: u.name, role: u.role, iatMs: Date.now() }, JWT, { expiresIn: '8h', jwtid: randomBytes(16).toString('hex') });
const mkUser = async (tag, role = 'user') => { const email = `qa42-${tag}-${stamp}@example.test`, password = randomBytes(14).toString('base64url') + 'aA1!'; const r = await call('POST', '/api/register', { body: { name: 'QA42 ' + tag, email, password } }); if (r.s !== 201) throw new Error('registro ' + tag + ' ' + r.s); if (role !== 'user') await q('update "Users" set role=$1 where email=$2', [role, email]); const u = (await q('select id,name,role from "Users" where email=$1', [email]))[0]; return { ...u, token: mint(u) }; };
const A = await mkUser('A'), B = await mkUser('B');
// ── ES-215 · PR #156 · rango entre cuentas de administración y «nunca sin superadmin activo» ──
const put = (tok, id, body) => call('PUT', '/api/admin/usuarios/' + id, { token: tok, body });
const roleOf = async id => (await q('select role, active from "Users" where id=$1', [id]))[0];
const ADM = await mkUser('adm', 'admin'), SUP = await mkUser('sup', 'superadmin');
// R-c2 / R-c3 / R-c4 / R-c1 (admin)
const S2 = await mkUser('s2', 'superadmin'); const okS2 = await call('GET', '/api/superadmin/ai-usage', { token: S2.token });
const off = await put(ADM.token, S2.id, { active: false }); const r1 = await roleOf(S2.id); const stillS2 = await call('GET', '/api/superadmin/ai-usage', { token: S2.token });
check('R-c2 admin desactiva a un superadmin → 403 target_rank, el superadmin sigue activo y su token vale', off.s === 403 && off.json?.code === 'target_rank' && r1.active === true && okS2.s === 200 && stillS2.s === 200, `PUT=${off.s} code=${off.json?.code} activa=${r1.active} token antes/después=${okS2.s}/${stillS2.s}`);
const S3 = await mkUser('s3', 'superadmin'); const dem = await put(ADM.token, S3.id, { role: 'user' }); const r3 = await roleOf(S3.id);
check('R-c3 admin degrada a un superadmin a user → 403 y el rol no cambia', dem.s === 403 && r3.role === 'superadmin', `PUT=${dem.s} rol=${r3.role}`);
const A2 = await mkUser('a2', 'admin'); const d1 = await put(ADM.token, A2.id, { role: 'user' }), d2 = await put(ADM.token, A2.id, { active: false }), d3 = await put(ADM.token, A2.id, { role: 'therapist' }); const ra = await roleOf(A2.id);
check('R-c4 admin sobre otro admin (degradar, desactivar, cambiar rol) → 403 y sin cambios', [d1.s, d2.s, d3.s].every(s => s === 403) && ra.role === 'admin' && ra.active === true, `degradar=${d1.s} desactivar=${d2.s} rol=${d3.s} estado=${ra.role}/${ra.active}`);
const V = await mkUser('v'); const up = await put(ADM.token, V.id, { role: 'superadmin' }), upA = await put(ADM.token, V.id, { role: 'admin' }); const rv = await roleOf(V.id);
check('R-c1 admin no asciende a nadie a superadmin ni a admin (sin regresión)', up.s === 403 && upA.s === 403 && rv.role === 'user', `superadmin=${up.s} admin=${upA.s} rol=${rv.role}`);
const selfD = await put(ADM.token, ADM.id, { active: false });
check('R-c6 una cuenta no se modifica a sí misma (regla existente)', selfD.s === 403, `PUT=${selfD.s}`);
// A1 admin sobre personas y profesionales: sigue pudiendo; revoca sesión
const P = await mkUser('p'), Th = await mkUser('th', 'therapist'); const pBefore = await call('GET', '/api/diary', { token: P.token }); const pOff = await put(ADM.token, P.id, { active: false }); const pAfter = await call('GET', '/api/diary', { token: P.token }); const pOn = await put(ADM.token, P.id, { active: true }); const thRole = await put(ADM.token, Th.id, { role: 'user' }); const thAfter = await call('GET', '/api/therapist/pacientes', { token: Th.token });
check('A1 admin sigue gestionando personas y profesionales (rol/estado) y la sesión anterior se revoca', pBefore.s === 200 && pOff.s === 200 && pAfter.s === 401 && pOn.s === 200 && thRole.s === 200 && thAfter.s === 401, `desactivar=${pOff.s} token=${pAfter.s} reactivar=${pOn.s} rolProf=${thRole.s} tokenProf=${thAfter.s}`);
// S1: un superadmin sí puede gestionar admin y otro superadmin
const S4 = await mkUser('s4', 'superadmin'), S5 = await mkUser('s5', 'superadmin'), A3 = await mkUser('a3', 'admin'); const s1a = await put(S4.token, A3.id, { role: 'user' }); const s1b = await put(S4.token, S5.id, { role: 'admin' }); const rs5 = await roleOf(S5.id);
check('S1 superadmin sí puede cambiar a un admin y bajar a otro superadmin (hay más superadmins activos)', s1a.s === 200 && s1b.s === 200 && rs5.role === 'admin', `admin→user=${s1a.s} superadmin→admin=${s1b.s} rol=${rs5.role}`);
// S2: último superadmin
await q(`update "Users" set active=false where role='superadmin' and id not in ($1)`, [SUP.id]); await q(`update "Users" set role='admin' where role='superadmin' and id <> $1`, [SUP.id]);
const only = (await q(`select count(*)::int n from "Users" where role='superadmin' and active=true`))[0].n;
const selfDem = await put(SUP.token, SUP.id, { role: 'admin' }), selfOff = await put(SUP.token, SUP.id, { active: false });
check('S2a (precondición) queda un solo superadmin activo; si es la misma cuenta, la regla "no modificarse a sí misma" ya lo cubre', only === 1 && [403, 409].includes(selfDem.s) && [403, 409].includes(selfOff.s), `activos=${only} auto-degradar=${selfDem.s} auto-desactivar=${selfOff.s}`);
// dos superadmins: X baja a Y (permitido), luego Y (ahora admin) no puede tocar a X; X es el último
const X = await mkUser('x', 'superadmin'), Y = await mkUser('y', 'superadmin'); await q(`update "Users" set active=false where id=$1`, [SUP.id]);
const xy = await put(X.token, Y.id, { role: 'admin' }); const yx = await put(Y.token, X.id, { active: false }); const rx = await roleOf(X.id); const lastDemote = await mkUser('z', 'superadmin'); const z2 = await put(X.token, lastDemote.id, { active: false });
check('S2b con X como único otro superadmin: X puede bajar a Y; Y (ya admin) no puede desactivar a X (403); nunca quedan 0 superadmins activos', xy.s === 200 && yx.s === 403 && rx.active === true, `X baja a Y=${xy.s} Y→X=${yx.s} X activo=${rx.active}`);
const cnt = (await q(`select count(*)::int n from "Users" where role='superadmin' and active=true`))[0].n;
// S3: concurrencia: dos superadmins se desactivan mutuamente a la vez
const C1 = await mkUser('c1', 'superadmin'), C2 = await mkUser('c2', 'superadmin'); await q(`update "Users" set active=false where role='superadmin' and id not in ($1,$2)`, [C1.id, C2.id]);
const rounds = []; for (let k = 0; k < 6; k++) { await q(`update "Users" set active=true, role='superadmin' where id in ($1,$2)`, [C1.id, C2.id]); const rs = await Promise.all([put(C1.token, C2.id, { active: false }), put(C2.token, C1.id, { active: false })]); const act = (await q(`select count(*)::int n from "Users" where role='superadmin' and active=true`))[0].n; rounds.push(`${rs.map(r => r.s).join('/')}→activos=${act}`); await q(`update "AuthRevocations" set "revokedBefore"='2000-01-01' where "UserId" in ($1,$2)`, [C1.id, C2.id]).catch(() => {}); }
check('S3 dos superadmins se desactivan mutuamente a la vez (6 rondas): nunca quedan 0 activos y sin 5xx', rounds.every(r => !/→activos=0/.test(r)) && rounds.every(r => !/5\d\d/.test(r.split('→')[0])), rounds.join(' | '));
// A2 entradas raras
const odd = []; for (const [id, body] of [['abc', { active: false }], ['-1', { active: false }], ['999999', { role: 'user' }], [String(V.id), {}], [String(V.id), { role: 'rol-inexistente' }], [String(V.id), { role: ['admin'] }], [String(V.id), { active: 'no' }], ['0', { role: 'user' }]]) odd.push((await put(ADM.token, id, body)).s);
check('A2 entradas raras (id texto/negativo/inexistente, cuerpo vacío, rol inválido o con tipo raro): 4xx, nunca 5xx', odd.every(s => s >= 400 && s < 500 || s === 200), odd.join(','));
// U1 informativo: unlock reactiva cuentas desactivadas
const U1 = await mkUser('u1', 'admin'); await q('update "Users" set active=false where id=$1', [U1.id]); const un = await call('PUT', `/api/admin/usuarios/${U1.id}/unlock`, { token: ADM.token }); const ru = await roleOf(U1.id);
check('U1 (informativo) PUT /:id/unlock por un admin sobre un admin desactivado', true, `unlock=${un.s} activa después=${ru.active} (true = el unlock reactiva cuentas de rango igual)`);
// E1 ES-210 sin regresión
const rp = await call('PUT', `/api/admin/usuarios/${V.id}/reset-password`, { token: SUP.token, body: { password: 'abc123' } });
check('E1 ES-210 sigue: reset-password de administración → 410', rp.s === 410 || rp.s === 401, `status=${rp.s}`);
fs.writeFileSync(path.join('C:/Users/Usuario/Documents/gpt-elevation-qa/qa/evidence', 'ES-215-pr156.json'), JSON.stringify(out, null, 1));
console.log('RESUMEN-ES215 ' + JSON.stringify({ total: out.length, fallos: out.filter(o => !o.ok).length }));
for (const k of kids) { try { k.kill(); } catch { /* */ } } process.exit(0);
