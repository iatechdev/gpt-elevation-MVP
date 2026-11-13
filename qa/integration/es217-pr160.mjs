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
const DBN = 'q217', PORT = 8251, api = `http://127.0.0.1:${PORT}`, dbUrl = `postgres://elevation:elevation_local@127.0.0.1:54459/${DBN}`;
const admin = new Client({ connectionString: 'postgres://elevation:elevation_local@127.0.0.1:54459/postgres' }); await admin.connect(); await admin.query(`DROP DATABASE IF EXISTS ${DBN} WITH (FORCE)`); await admin.query(`CREATE DATABASE ${DBN}`);
const out = []; const check = (id, ok, d = '') => { out.push({ id, ok: !!ok, detail: String(d).slice(0, 420) }); console.log(JSON.stringify({ id, ok: !!ok, detail: String(d).slice(0, 340) })); };
const sleep = ms => new Promise(r => setTimeout(r, ms)); const kids = [];
kids.push(spawn(process.execPath, [S + '/m142mock.cjs', '9951'], { stdio: 'ignore' }));
kids.push(spawn(process.execPath, ['server.js'], { cwd: BACK, stdio: 'ignore', env: { ...process.env, PORT: String(PORT), DATABASE_URL: dbUrl, DB_SSL: 'false', JWT_SECRET: JWT, DATA_ENCRYPTION_KEY: DEK, PROMPT_ENCRYPTION_KEY: PEK, DATA_RIGHTS_ENABLED: 'true', NODE_ENV: 'development', ANTHROPIC_API_KEY: 'sk-synthetic-not-real', ANTHROPIC_BASE_URL: 'http://127.0.0.1:9951', AI_BUDGET_TOKENS_PER_USER: '50000000', AI_BUDGET_TOKENS_COHORT: '500000000' } }));
for (let i = 0; i < 80; i++) { try { if ((await fetch(api + '/api/health')).ok) break; } catch { /* */ } await sleep(500); }
const db = new Client({ connectionString: dbUrl, ssl: false }); await db.connect(); for (let i = 0; i < 120; i++) { if ((await db.query(`select to_regclass('"Users"') t, to_regclass('"Messages"') m, to_regclass('"DiaryEntries"') d`)).rows[0].d) break; await sleep(500); } await sleep(2500);
const q = async (s, p = []) => (await db.query(s, p)).rows;
const call = async (method, url, { token, body } = {}) => { const h = {}; if (token) h.Authorization = 'Bearer ' + token; if (body !== undefined) h['Content-Type'] = 'application/json'; const t0 = performance.now(); const r = await fetch(api + url, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) }); const text = await r.text(); let json = null; try { json = JSON.parse(text); } catch { /* */ } return { s: r.status, json, text, ms: performance.now() - t0 }; };
const stamp = Date.now(); const mint = u => jwt.sign({ id: u.id, name: u.name, role: u.role, iatMs: Date.now() }, JWT, { expiresIn: '8h', jwtid: randomBytes(16).toString('hex') });
const mkUser = async (tag, role = 'user') => { const email = `qa42-${tag}-${stamp}@example.test`, password = randomBytes(14).toString('base64url') + 'aA1!'; const r = await call('POST', '/api/register', { body: { name: 'QA42 ' + tag, email, password } }); if (r.s !== 201) throw new Error('registro ' + tag + ' ' + r.s); if (role !== 'user') await q('update "Users" set role=$1 where email=$2', [role, email]); const u = (await q('select id,name,role from "Users" where email=$1', [email]))[0]; return { ...u, email, password, token: mint(u) }; };
const A = await mkUser('A'), B = await mkUser('B');
// ── ES-217 · PR #160 · unlock no reactiva, respeta rangos; id inválido 400 ──
const put = (tok, path, body) => call('PUT', '/api/admin/usuarios/' + path, { token: tok, body });
const row = async id => (await q('select role, active, "loginAttempts" as la, "lockedUntil" as lu from "Users" where id=$1', [id]))[0];
const ADM = await mkUser('adm', 'admin'), SUP = await mkUser('sup', 'superadmin'), SUP2 = await mkUser('sup2', 'superadmin');
// U1: unlock sobre cuentas DESACTIVADAS (persona, profesional, admin, superadmin) con admin y con superadmin
const targets = { persona: await mkUser('tp'), profesional: await mkUser('tt', 'therapist'), admin: await mkUser('ta', 'admin'), superadmin: await mkUser('ts', 'superadmin') };
for (const t of Object.values(targets)) await q(`update "Users" set active=false, "loginAttempts"=5, "lockedUntil"=now() + interval '15 minutes' where id=$1`, [t.id]);
const u1 = {}; for (const [k, t] of Object.entries(targets)) { const viaAdmin = await put(ADM.token, `${t.id}/unlock`); const viaSup = await put(SUP.token, `${t.id}/unlock`); const r = await row(t.id); u1[k] = { admin: viaAdmin.s, sup: viaSup.s, activa: r.active, intentos: r.la, bloqueo: r.lu }; }
check('U1 unlock sobre cuentas DESACTIVADAS: ninguna se reactiva (active=false) con admin ni con superadmin', Object.values(u1).every(v => v.activa === false) && Object.values(u1).every(v => v.admin < 500 && v.sup < 500), JSON.stringify(u1));
check('U1b el superadmin sí limpia el bloqueo por intentos de cualquier cuenta; el admin de personas/profesionales también', ['persona', 'profesional', 'admin', 'superadmin'].every(k => u1[k].intentos === 0 && u1[k].bloqueo === null), JSON.stringify(Object.fromEntries(Object.entries(u1).map(([k, v]) => [k, `${v.intentos}/${v.bloqueo === null ? 'sin bloqueo' : 'bloqueada'}`]))));
// U2: bloqueo por intentos en cuenta activa: se levanta y puede iniciar sesión
const L = await mkUser('lock'); for (let i = 0; i < 5; i++) await call('POST', '/api/login', { body: { email: L.email, password: 'MalaClave1!' + i } }); const lockedLogin = await call('POST', '/api/login', { body: { email: L.email, password: L.password } }); const rl = await row(L.id);
const un = await put(ADM.token, `${L.id}/unlock`); const okLogin = await call('POST', '/api/login', { body: { email: L.email, password: L.password } }); const rl2 = await row(L.id);
check('U2 cuenta ACTIVA bloqueada por intentos: antes no entra (423), unlock por admin la libera, entra, y active no cambia', rl.lu !== null && lockedLogin.s === 423 && un.s === 200 && okLogin.s === 200 && rl2.active === true && rl2.la === 0, `bloqueada=${lockedLogin.s} unlock=${un.s} login=${okLogin.s} activa=${rl2.active} intentos=${rl2.la}`);
// U3: jerarquía
const A2 = await mkUser('a2', 'admin'), S3 = await mkUser('s3', 'superadmin'); await q(`update "Users" set "loginAttempts"=4 where id in ($1,$2)`, [A2.id, S3.id]);
const a2 = await put(ADM.token, `${A2.id}/unlock`), s3 = await put(ADM.token, `${S3.id}/unlock`), sup2 = await put(SUP.token, `${A2.id}/unlock`), sup3 = await put(SUP.token, `${S3.id}/unlock`);
check('U3 jerarquía: admin→admin y admin→superadmin = 403 target_rank; superadmin→admin y superadmin→superadmin = 200', a2.s === 403 && a2.json?.code === 'target_rank' && s3.s === 403 && sup2.s === 200 && sup3.s === 200, `admin→admin=${a2.s} admin→sup=${s3.s} sup→admin=${sup2.s} sup→sup=${sup3.s}`);
// U4: reactivar sigue siendo explícito
const P = await mkUser('p'); await q('update "Users" set active=false where id=$1', [P.id]); const rp = await put(ADM.token, String(P.id), { active: true }); const rpa = await row(P.id);
const Da = await mkUser('da', 'admin'); await q('update "Users" set active=false where id=$1', [Da.id]); const ra1 = await put(ADM.token, String(Da.id), { active: true }), ra2 = await put(SUP.token, String(Da.id), { active: true }); const raRow = await row(Da.id);
check('U4 reactivar es acción explícita: admin reactiva a una persona; a un admin solo lo reactiva el superadmin', rp.s === 200 && rpa.active === true && ra1.s === 403 && ra2.s === 200 && raRow.active === true, `admin→persona=${rp.s} admin→admin=${ra1.s} sup→admin=${ra2.s}`);
// U5: casos de borde de unlock
const nx = await put(ADM.token, '999999/unlock'), noTok = await call('PUT', `/api/admin/usuarios/${P.id}/unlock`), asUser = await put(P.token, `${P.id}/unlock`);
check('U5 unlock: id inexistente 404; sin token 401/403; una persona sin permiso 403; sin 5xx', nx.s === 404 && [401, 403].includes(noTok.s) && asUser.s === 403, `inexistente=${nx.s} sinToken=${noTok.s} persona=${asUser.s}`);
// I1: ids inválidos en todas las rutas /usuarios/:id
const bad = ['abc', '-1', '0', '1.5', '1e3', "1'%20OR%201=1", '%20', '99999999999999999999', '4294967296', '2147483648', '0x10', '01'];
const routes = [['PUT', '', { active: false }], ['DELETE', '', undefined], ['PUT', '/unlock', undefined], ['PUT', '/asignar-terapeuta', { therapistId: null }], ['PUT', '/plan', { planId: null }], ['PUT', '/reset-password', {}], ['GET', '/', undefined]];
const fivexx = [], nonfour = []; for (const id of bad) for (const [m, suf, body] of routes) { const r = await call(m, `/api/admin/usuarios/${id}${suf}`, { token: SUP.token, body }); if (r.s >= 500) fivexx.push(`${m} ${id}${suf}=${r.s}`); else if (r.s !== 400 && r.s !== 404 && r.s !== 405 && r.s !== 410) nonfour.push(`${m} ${id}${suf}=${r.s}`); }
check('I1 id inválido en TODAS las rutas /usuarios/:id (12 formas × 7 rutas, como superadmin): ninguna da 5xx', fivexx.length === 0, fivexx.length ? fivexx.slice(0, 8).join(' | ') : `${bad.length * routes.length} peticiones, 0 respuestas 5xx; otros códigos: ${nonfour.slice(0, 4).join(' | ') || 'ninguno'}`);
const ex = await put(SUP.token, 'abc', { active: false }); const ex2 = await put(ADM.token, '-1', { active: false });
check('I1b el código y la forma de la respuesta: 400 con code invalid_id', ex.s === 400 && ex.json?.code === 'invalid_id' && ex2.s === 400, `abc=${ex.s} ${ex.json?.code} · -1=${ex2.s}`);
// R1: #156 sin regresión
const S4 = await mkUser('s4', 'superadmin'), A4 = await mkUser('a4', 'admin'); const c2 = await put(ADM.token, String(S4.id), { active: false }), c3 = await put(ADM.token, String(S4.id), { role: 'user' }), c4 = await put(ADM.token, String(A4.id), { role: 'user' }); const rs4 = await row(S4.id);
check('R1 #156 sin regresión: admin no desactiva ni degrada a un superadmin ni toca a otro admin (403)', c2.s === 403 && c3.s === 403 && c4.s === 403 && rs4.role === 'superadmin' && rs4.active === true, `desactivar=${c2.s} degradar=${c3.s} admin→admin=${c4.s}`);
const C1 = await mkUser('c1', 'superadmin'), C2 = await mkUser('c2', 'superadmin'); await q(`update "Users" set active=false where role='superadmin' and id not in ($1,$2)`, [C1.id, C2.id]); const rounds = [];
for (let k = 0; k < 6; k++) { await q(`update "Users" set active=true, role='superadmin' where id in ($1,$2)`, [C1.id, C2.id]); const rs = await Promise.all([put(C1.token, String(C2.id), { active: false }), put(C2.token, String(C1.id), { active: false })]); const act = (await q(`select count(*)::int n from "Users" where role='superadmin' and active=true`))[0].n; rounds.push(`${rs.map(r => r.s).join('/')}→${act}`); await q(`delete from "AuthRevocations" where "UserId" in ($1,$2)`, [C1.id, C2.id]).catch(() => {}); }
check('R1b nunca quedan 0 superadmins activos con cambios simultáneos (6 rondas)', rounds.every(r => !r.endsWith('→0')) && rounds.every(r => !/5\d\d/.test(r.split('→')[0])), rounds.join(' | '));
fs.writeFileSync(path.join('C:/Users/Usuario/Documents/gpt-elevation-qa/qa/evidence', 'ES-217-pr160.json'), JSON.stringify(out, null, 1));
console.log('RESUMEN-ES217 ' + JSON.stringify({ total: out.length, fallos: out.filter(o => !o.ok).length }));
for (const k of kids) { try { k.kill(); } catch { /* */ } } process.exit(0);
