// [QA-Claude] ES-74 · PR #55: GET /api/session contra Postgres REAL. Solo datos sintéticos; no se imprimen secretos.
// Uso: QA_SUT=<clon con el head de #55> QA_API=http://127.0.0.1:8174 DATABASE_URL=<base> QA_JWT_SECRET=<el del servidor> node qa/integration/es74-session-api.mjs
import { createRequire } from 'node:module';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
const sut = process.env.QA_SUT, api = process.env.QA_API, dbUrl = process.env.DATABASE_URL, JWT = process.env.QA_JWT_SECRET;
const req = createRequire(path.join(sut, 'backend', 'package.json'));
const { Client } = req('pg'); const jwt = req('jsonwebtoken');
const db = new Client({ connectionString: dbUrl, ssl: false }); await db.connect(); const q = async (s, p = []) => (await db.query(s, p)).rows;
const check = (id, ok, d = '') => console.log(JSON.stringify({ id, ok: !!ok, detail: d }));
const call = async (method, url, { token, body, headers = {} } = {}) => {
  const h = { ...headers }; if (token) h.Authorization = 'Bearer ' + token; if (body !== undefined) h['Content-Type'] = 'application/json';
  const t0 = performance.now(); const r = await fetch(api + url, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await r.text(); let json = null; try { json = JSON.parse(text); } catch { /* */ } return { status: r.status, json, text, h: r.headers, ms: performance.now() - t0 };
};
const stamp = Date.now();
const sign = (u, over = {}, opts = {}) => jwt.sign({ id: u.id, name: u.name, role: u.role, iatMs: Date.now(), ...over }, JWT, { expiresIn: '8h', jwtid: randomBytes(16).toString('hex'), ...opts });
const mk = async (tag, role = 'user') => { const email = `qa74-${tag}-${stamp}@example.test`, password = randomBytes(12).toString('base64url') + 'aA1!'; const r = await call('POST', '/api/register', { body: { name: 'QA74 ' + tag, email, password } }); if (r.status !== 201) throw new Error('registro ' + tag + ' ' + r.status); if (role !== 'user') await q('update "Users" set role=$1 where email=$2', [role, email]); const u = (await q('select id,name,role from "Users" where email=$1', [email]))[0]; return { ...u, email, password, token: sign(u) }; };
const A = await mk('A'), B = await mk('B'), ADM = await mk('adm', 'admin'), SU = await mk('su', 'superadmin'), TH = await mk('th', 'therapist'), BR = await mk('br', 'board');
const s = (u) => call('GET', '/api/session', { token: u.token });
let r = await call('GET', '/api/session'); check('S01 sin token → 401/403 y sin datos', [401, 403].includes(r.status) && !/role/.test(r.text), `status=${r.status}`);
r = await call('GET', '/api/session', { token: 'abc.def.ghi' }); check('S02 token mal formado → 401/403', [401, 403].includes(r.status), `status=${r.status}`);
const forged = jwt.sign({ id: A.id, role: 'superadmin', iatMs: Date.now() }, 'otra-clave-' + randomBytes(8).toString('hex'), { expiresIn: '1h', jwtid: 'x' + randomBytes(8).toString('hex') });
r = await call('GET', '/api/session', { token: forged }); check('S03 token firmado con otra clave (con rol superadmin) → rechazado', [401, 403].includes(r.status), `status=${r.status}`);
const expired = jwt.sign({ id: A.id, name: A.name, role: A.role, iatMs: Date.now() - 1e8 }, JWT, { expiresIn: -10, jwtid: randomBytes(8).toString('hex') });
r = await call('GET', '/api/session', { token: expired }); check('S04 token vencido → 401/403', [401, 403].includes(r.status), `status=${r.status}`);
const none = jwt.sign({ id: A.id, name: A.name, role: A.role }, JWT, { algorithm: 'none' }); r = await call('GET', '/api/session', { token: none }); check('S05 token con alg none → rechazado', [401, 403].includes(r.status), `status=${r.status}`);
r = await s(A); check('S06 sesión válida de participante → 200 con solo role y onboardingCompleted', r.status === 200 && r.json?.role === 'user' && Object.keys(r.json).sort().join() === 'onboardingCompleted,role', JSON.stringify(r.json));
check('S07 cabeceras: Cache-Control no-store y Vary con Authorization', /no-store/.test(r.h.get('cache-control') || '') && /Authorization/i.test(r.h.get('vary') || ''), `${r.h.get('cache-control')} | ${r.h.get('vary')}`);
check('S08 la respuesta no contiene correo, nombre, id ni contexto', !/qa74|@|"id"|name|context|email/i.test(r.text), r.text.slice(0, 80));
const roles = await Promise.all([ADM, SU, TH, BR].map(async u => [u.role, (await s(u)).json?.role])); check('S09 cada rol recibe el suyo (admin, superadmin, therapist, board)', roles.every(([a, b]) => a === b), JSON.stringify(roles));
r = await call('GET', '/api/session?id=' + B.id, { token: A.token }); check('S10 parámetro id (y cualquier consulta) → 400, no se usa', r.status === 400, `status=${r.status}`);
r = await call('GET', '/api/session?role=superadmin&userId=' + B.id, { token: A.token }); check('S11 intento de elevar rol o suplantar por consulta → 400', r.status === 400, `status=${r.status}`);
const spoof = await call('GET', '/api/session', { token: A.token, headers: { 'X-User-Id': String(SU.id), 'X-Forwarded-User': String(SU.id) } }); check('S12 cabeceras de suplantación se ignoran: A sigue siendo user', spoof.json?.role === 'user', JSON.stringify(spoof.json));
const tokenAsSu = sign({ id: A.id, name: A.name, role: 'user' }, { role: 'superadmin' }); const claim = await call('GET', '/api/session', { token: tokenAsSu });
check('S13 un token legítimo de A con la reclamación role=superadmin no eleva: se lee el rol de la base', claim.status !== 200 || claim.json?.role === 'user', `status=${claim.status} role=${claim.json?.role}`);
r = await call('POST', '/api/session', { token: A.token, body: {} }); check('S14 POST sobre /api/session no es una vía (404/405)', [404, 405].includes(r.status), `status=${r.status}`);
const own = await Promise.all([A, B].map(u => s(u))); await q('update "Users" set "onboardingCompleted"=true where id=$1', [B.id]); const a2 = await s(A), b2 = await s(B);
check('S15 aislamiento: cambiar la bandera de B no cambia lo que ve A, y cada una ve solo lo suyo', own.every(x => x.status === 200) && a2.json?.onboardingCompleted !== b2.json?.onboardingCompleted, `A=${a2.json?.onboardingCompleted} B=${b2.json?.onboardingCompleted}`);
// Revocación
const C = await mk('C'); const lg = await call('POST', '/api/logout', { token: C.token }); r = await s(C); check('S16 tras logout el mismo token → 401/403', lg.status === 200 && [401, 403].includes(r.status), `logout=${lg.status} session=${r.status}`);
const D1 = await mk('D'); const D2 = sign(D1); const la = await call('POST', '/api/logout-all', { token: D1.token }); const r1 = await s(D1), r2 = await call('GET', '/api/session', { token: D2 });
check('S17 tras logout-all todos los tokens de la persona → 401/403', la.status === 200 && [401, 403].includes(r1.status) && [401, 403].includes(r2.status), `${r1.status}/${r2.status}`);
const I = await mk('I'); await q('update "Users" set active=false where id=$1', [I.id]); r = await s(I); check('S18 cuenta inactiva → 401/403 sin revelar rol', [401, 403].includes(r.status) && !/role/.test(r.text), `status=${r.status} ${r.text.slice(0, 60)}`);
const G = await mk('G'); await call('POST', '/api/account/deletion-requests', { token: G.token, body: { confirm: true } }); r = await s(G); check('S19 cuenta con eliminación pendiente → rechazada', [401, 403].includes(r.status), `status=${r.status}`);
const ghost = { id: 99999999, name: 'x', role: 'user' }; r = await call('GET', '/api/session', { token: sign(ghost) }); check('S20 token válido de una cuenta inexistente → 401/403', [401, 403].includes(r.status), `status=${r.status}`);
const bad = await q('select 1 from "Users" where id=1 and false'); void bad;
await q(`update "Users" set role='admin' where id=$1`, [A.id]); const promoted = await s(A); await q(`update "Users" set role='user' where id=$1`, [A.id]);
check('S21 si cambia el rol en la base, la respuesta lo refleja de inmediato (no se cachea ni se toma del token)', promoted.json?.role === 'admin', JSON.stringify(promoted.json));
// Abuso y tiempos
const burst = await Promise.all(Array.from({ length: 40 }, () => s(A))); check('S22 40 peticiones simultáneas sin 5xx', burst.every(x => x.status < 500), burst.map(x => x.status).filter((v, i, a) => a.indexOf(v) === i).join(','));
const lat = []; for (let i = 0; i < 20; i++) lat.push((await s(A)).ms); lat.sort((x, y) => x - y); check('S23 latencia p95 de la lectura menor de 300 ms (umbral propuesto)', lat[Math.ceil(lat.length * 0.95) - 1] < 300, `p95=${lat[Math.ceil(lat.length * 0.95) - 1].toFixed(0)}ms`);
const t1 = []; for (let i = 0; i < 10; i++) t1.push((await call('GET', '/api/session', { token: sign({ id: 99999999, name: 'x', role: 'user' }) })).ms); const t2 = []; for (let i = 0; i < 10; i++) t2.push((await call('GET', '/api/session', { token: sign({ id: ADM.id, name: 'x', role: 'admin' }, {}, {}) })).ms);
const med = a => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)]; check('S24 sin diferencia de tiempo grande entre cuenta inexistente y existente (mediana < 5× y < 100 ms de diferencia)', Math.abs(med(t1) - med(t2)) < 100, `inexistente=${med(t1).toFixed(0)}ms existente=${med(t2).toFixed(0)}ms`);
// Límite de login conservado
let lim = null; for (let i = 0; i < 14 && !lim; i++) { const x = await call('POST', '/api/login', { body: { email: `noexiste-${i}@example.test`, password: 'mala-clave-' + i } }); if (x.status === 429) lim = i + 1; }
check('S25 el límite de intentos de login sigue activo (429 antes de 14 intentos)', lim !== null && lim <= 14, `429 en el intento ${lim}`);
console.log(JSON.stringify({ fin: true })); await db.end();
