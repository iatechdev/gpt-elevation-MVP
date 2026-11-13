// [QA-Claude] ES-177 · PR #182 (PR A backend): «Persona n» — ordinal estable y único, aislamiento A/B, sin nombre ni correo de quien no comparte, ciclo de vida. Postgres real.
// Uso: QA_SUT=<clon> QA_API=http://127.0.0.1:8091 DATABASE_URL=<base> QA_JWT_SECRET=<el del servidor> DATA_ENCRYPTION_KEY=<el del servidor> node qa/integration/es25-real-db.mjs
// Solo datos sintéticos (@example.test). No se imprimen contraseñas ni tokens.
import { createRequire } from 'node:module';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const sut = process.env.QA_SUT, api = process.env.QA_API, dbUrl = process.env.DATABASE_URL, JWT = process.env.QA_JWT_SECRET;
if (!sut || !api || !dbUrl || !JWT) throw new Error('Defina QA_SUT, QA_API, DATABASE_URL y QA_JWT_SECRET.');
const req = createRequire(path.join(sut, 'backend', 'package.json'));
const { Client } = req('pg'); const jwt = req('jsonwebtoken');
const db = new Client({ connectionString: dbUrl, ssl: false }); await db.connect();
const q = async (sql, p = []) => (await db.query(sql, p)).rows;
const check = (id, ok, detail = '') => console.log(JSON.stringify({ id, ok: !!ok, detail }));
const info = (id, detail) => console.log(JSON.stringify({ id, info: detail }));
const call = async (method, url, { token, body } = {}) => {
  const h = {}; if (token) h.Authorization = 'Bearer ' + token; if (body !== undefined) h['Content-Type'] = 'application/json';
  const t0 = performance.now();
  const r = await fetch(api + url, { method, headers: h, body: body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body)) });
  const text = await r.text(); let json = null; try { json = JSON.parse(text); } catch { /* no JSON */ }
  return { status: r.status, json, text, ms: performance.now() - t0, headers: r.headers };
};
const stamp = Date.now();
const mint = (u) => jwt.sign({ id: u.id, name: u.name, role: u.role, iatMs: Date.now() }, JWT, { expiresIn: '8h', jwtid: randomBytes(16).toString('hex') });
const mkUser = async (tag, role = 'user') => {
  const email = `qa177-${tag}-${stamp}@example.test`, password = randomBytes(14).toString('base64url') + 'aA1!';
  const r = await call('POST', '/api/register', { body: { name: 'QA177 ' + tag, email, password } });
  if (r.status !== 201) throw new Error('registro ' + tag + ' ' + r.status);
  if (role !== 'user') await q('update "Users" set role=$1 where email=$2', [role, email]);
  return { tag, ...(await q('select id,name,role from "Users" where email=$1', [email]))[0] };
};
const p95 = a => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.ceil(s.length * 0.95) - 1)]; };
const rid = () => 'qa' + randomBytes(8).toString('hex');
const tag = () => randomBytes(4).toString('hex');
const CAN_DIARY = 'CANARIO-DIARIO-' + tag(), CAN_CHAT = 'CANARIO-CHAT-' + tag(), CAN_CRISIS = 'CANARIO-CRISIS-' + tag();
const A = await mkUser('A'), B = await mkUser('B'), ADM = await mkUser('adm', 'admin'), TH = await mkUser('th', 'therapist');
const a = mint(A), b = mint(B);
const grant = (t, s = 'granted') => call('PUT', '/api/consents/professional_bridge', { token: t, body: { status: s } });
const motiv = (text, extra = {}) => ({ key: 'motivations', text, ...extra });
const engine = (userId) => { // ejecuta getApprovedContext directamente, como lo haría el motor
  const r = spawnSync(process.execPath, ['-e', `process.env.DB_SSL='false';(async()=>{const m=require('./utils/careerContext');try{console.log(JSON.stringify(await m.getApprovedContext(${userId},'qa-engine')))}catch(e){console.log(JSON.stringify({error:e.code||e.name,status:e.status}))}process.exit(0)})()`],
    { cwd: path.join(sut, 'backend'), env: { ...process.env, DATABASE_URL: dbUrl, DB_SSL: 'false', JWT_SECRET: JWT }, encoding: 'utf8' });
  const line = r.stdout.trim().split('\n').filter(l => l.startsWith('{') || l === 'null').pop();
  try { return JSON.parse(line); } catch { return { raw: (r.stdout + r.stderr).slice(0, 200) }; }
};

// ── ES-177 · PR #182 · «Persona n»: ordinal estable y único, aislamiento, sin nombre de quien no comparte (cola; cabeza de es25-real-db.mjs con prefijo qa177)
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const TA = TH, TB = await mkUser('tb', 'therapist'), TC = await mkUser('tc', 'therapist');
const tA = mint(TA), tB = mint(TB), tC = mint(TC), admT = mint(ADM);
const mkP = async (tag, th = null, sharing = false) => { const u = await mkUser(tag); u.email = (await q('select email from "Users" where id=$1', [u.id]))[0].email; if (th) await q('update "Users" set "therapistId"=$1 where id=$2', [th.id, u.id]); if (sharing) await call('PUT', '/api/consents/therapist_sharing', { token: mint(u), body: { status: 'granted' } }); return u; };
const list = (tok) => call('GET', '/api/therapist/pacientes', { token: tok });
const rowsOf = (r) => [].concat(r.json?.patients ?? r.json ?? []);
const ordMap = (r) => new Map(rowsOf(r).map(p => [p.id, p.ordinal]));
const dbOrd = (th) => q('select "personId","ordinal" from "TherapistPersonOrdinals" where "therapistId"=$1 order by "ordinal"', [th.id]);
const A_S = [await mkP('s1', TA, true), await mkP('s2', TA, true), await mkP('s3', TA, true)], A_N = [await mkP('n4', TA), await mkP('n5', TA), await mkP('n6', TA)];
const B_P = [await mkP('b1', TB, true), await mkP('b2', TB), await mkP('b3', TB)];
const PERSONS = [...A_S, ...A_N];
check('S0 sin filas de ordinales antes de la primera lectura (la asignación ocurre al aparecer en la lista)', (await dbOrd(TA)).length === 0, '');

// ── O1 primera lectura con 12 llamadas simultáneas (pool de 5)
const t0 = Date.now();
const burst = Promise.all(Array.from({ length: 12 }, () => list(tA)));
await sleep(80); const o0 = Date.now(); const other = await call('GET', '/api/career-context', { token: mint(A_S[0]) }); const otherMs = Date.now() - o0;
const rs = await burst, ms = Date.now() - t0;
const maps = rs.map(ordMap), first = maps[0], db1 = await dbOrd(TA), nums = [...first.values()].sort((a, b) => a - b);
check('O1a 12 primeras lecturas simultáneas de /pacientes: todas 200, los mismos números en todas, 1..6 sin repetir ni saltar, 6 filas en la base, sin esperas largas ni bloquear a otras personas', rs.every(r => r.status === 200) && maps.every(m => PERSONS.every(p => m.get(p.id) === first.get(p.id))) && JSON.stringify(nums) === '[1,2,3,4,5,6]' && db1.length === 6 && ms < 6000 && otherMs < 3000, `estados=${[...new Set(rs.map(r => r.status))]} nums=${JSON.stringify(nums)} filas=${db1.length} total=${ms} ms; otra persona ${other.status} en ${otherMs} ms`);
const again = await list(tA), againMap = ordMap(again);
check('O1b llamadas repetidas devuelven los MISMOS números', PERSONS.every(p => againMap.get(p.id) === first.get(p.id)), '');
const p7 = await mkP('n7', TA); const r7 = ordMap(await list(tA));
check('O1c una persona nueva recibe el siguiente número (7) y las demás no cambian', r7.get(p7.id) === 7 && PERSONS.every(p => r7.get(p.id) === first.get(p.id)), `n7=${r7.get(p7.id)}`);
const bMap = ordMap(await list(tB));
check('O1d el otro profesional numera de forma INDEPENDIENTE desde 1 (1..3)', JSON.stringify([...bMap.values()].sort()) === '[1,2,3]', JSON.stringify([...bMap.values()]));

// ── P1 aislamiento A/B
{ const ra = await list(tA), rb = await list(tB), alA = await call('GET', '/api/therapist/alerts', { token: tA }), alB = await call('GET', '/api/therapist/alerts', { token: tB });
  const aText = ra.text + alA.text, bText = rb.text + alB.text; const bLeak = B_P.some(p => aText.includes(p.email) || aText.includes(p.name)) || B_P.some(p => rowsOf(ra).some(x => x.id === p.id)); const aLeak = [...PERSONS, p7].some(p => bText.includes(p.email) || bText.includes(p.name) || rowsOf(rb).some(x => x.id === p.id));
  const byId = []; for (const p of B_P) for (const route of ['historia', 'historial', 'resumen-ia']) byId.push((await call('GET', `/api/therapist/pacientes/${p.id}/${route}`, { token: tA })).status);
  const roles = []; for (const [n, tok] of [['persona', mint(A_S[0])], ['admin', admT], ['sin sesión', null]]) roles.push([n, (await call('GET', '/api/therapist/pacientes', { token: tok })).status]);
  check('P1 aislamiento: A no ve ni cuenta a las personas de B (ni por lista ni por id: 403/404) y B no ve a las de A; persona, admin y sin sesión no entran', !bLeak && !aLeak && byId.every(s => [403, 404].includes(s)) && roles.every(([, s]) => [401, 403].includes(s)) && rowsOf(ra).length === 7 && rowsOf(rb).length === 3, `A ve ${rowsOf(ra).length}, B ve ${rowsOf(rb).length}; porId=${JSON.stringify([...new Set(byId)])} roles=${JSON.stringify(roles.map(r => r[1]))}`); }

// ── P2 sin nombre de quien no comparte (en TODO el cuerpo)
{ const ra = await list(tA), alA = await call('GET', '/api/therapist/alerts', { token: tA }); const bad = [];
  for (const p of [...A_N, p7]) { for (const [lbl, body] of [['/pacientes', ra.text], ['/alerts', alA.text]]) { if (body.toLowerCase().includes(p.name.toLowerCase())) bad.push(`${lbl}: nombre de ${p.tag}`); if (body.toLowerCase().includes(p.email.toLowerCase())) bad.push(`${lbl}: correo de ${p.tag}`); } }
  const rowN = rowsOf(ra).find(x => x.id === A_N[0].id), rowS = rowsOf(ra).find(x => x.id === A_S[0].id);
  check('P2a /pacientes y /alerts: el nombre y el correo de quien NO comparte no aparecen en ningún punto del cuerpo; la fila trae `name: null` y `ordinal` entero, `sharing:false` y `email` vacío', bad.length === 0 && rowN?.name === null && Number.isInteger(rowN?.ordinal) && rowN?.sharing === false && rowN?.email === '', bad.join(' | ') + ` fila=${JSON.stringify(rowN).slice(0, 220)}`);
  check('P2b quien SÍ comparte conserva nombre, correo y ordinal', rowS?.name === A_S[0].name && rowS?.email === A_S[0].email && Number.isInteger(rowS?.ordinal), `fila=${JSON.stringify(rowS).slice(0, 200)}`);
  check('P2c /alerts no contiene `improvementPercent` ni porcentajes', !/improvementPercent/.test(alA.text) && !/\d\s?%/.test(alA.text), alA.text.slice(0, 160)); }

// ── O2 ciclo de vida
{ const bad = []; const base = ordMap(await list(tA)); const s2 = A_S[1], n5 = A_N[1];
  await q('update "Users" set "therapistId"=null where id=$1', [s2.id]); const un = await list(tA); if (rowsOf(un).some(x => x.id === s2.id)) bad.push('desvinculada sigue en la lista'); const mid = ordMap(un); if (![...mid.keys()].every(id => mid.get(id) === base.get(id))) bad.push('se movieron números al desvincular');
  const rowStill = (await dbOrd(TA)).find(r => r.personId === s2.id); if (!rowStill) bad.push('desvincular borró la fila del ordinal');
  await q('update "Users" set "therapistId"=$1 where id=$2', [TA.id, s2.id]); const re = ordMap(await list(tA)); if (re.get(s2.id) !== base.get(s2.id)) bad.push(`revincular al mismo profesional: ${base.get(s2.id)} → ${re.get(s2.id)}`);
  await q('update "Users" set "therapistId"=$1 where id=$2', [TB.id, s2.id]); const bAfter = ordMap(await list(tB)); if (bAfter.get(s2.id) !== 4) bad.push(`vinculada a B recibe ${bAfter.get(s2.id)} (esperado 4, el siguiente de B)`); await q('update "Users" set "therapistId"=$1 where id=$2', [TA.id, s2.id]);
  const nBefore = ordMap(await list(tA)).get(n5.id); const sharedTok = mint(n5); await call('PUT', '/api/consents/therapist_sharing', { token: sharedTok, body: { status: 'granted' } }); const withShare = rowsOf(await list(tA)).find(x => x.id === n5.id);
  await call('PUT', '/api/consents/therapist_sharing', { token: sharedTok, body: { status: 'revoked' } }); const noShare = rowsOf(await list(tA)).find(x => x.id === n5.id);
  if (withShare.ordinal !== nBefore || noShare.ordinal !== nBefore) bad.push('el ordinal cambió al conceder/retirar el permiso'); if (withShare.name !== n5.name) bad.push('con permiso no muestra el nombre'); if (noShare.name !== null) bad.push('tras retirar el permiso sigue el nombre');
  check('O2a ciclo de vida: desvincular conserva la fila y los demás números; revincular al mismo profesional = misma n; vincular a otro profesional = la n de ese profesional; conceder/retirar el permiso mantiene la n (el nombre aparece y desaparece)', bad.length === 0, bad.join(' | ') || `s2=${base.get(s2.id)} n5=${nBefore}`); }
{ // eliminación: ¿se reutiliza el número más alto?
  const cur = ordMap(await list(tA)); const maxN = Math.max(...cur.values()); const top = [...cur.entries()].find(([, n]) => n === maxN)[0]; const topUser = [p7].find(p => p.id === top) || p7;
  await q('delete from "Users" where id=$1', [p7.id]); const gone = (await dbOrd(TA)).some(r => r.personId === p7.id); const p8 = await mkP('n8', TA); const m8 = ordMap(await list(tA));
  check('O2b eliminar a la persona con la n MÁS ALTA no libera su número: la siguiente persona NO hereda la n de quien salió (decisión de Infra en 11391: el ordinal no se reutiliza nunca)', m8.get(p8.id) !== maxN && m8.get(p8.id) > maxN, `n eliminada=${maxN} (fila borrada en cascada=${gone}); la persona nueva recibió ${m8.get(p8.id)}`);
  const mid = A_N[2]; const midN = cur.get(mid.id); await q('delete from "Users" where id=$1', [mid.id]).catch(() => {}); const p9 = await mkP('n9', TA); const m9 = ordMap(await list(tA));
  check('O2c eliminar a una persona intermedia tampoco reutiliza su número', m9.get(p9.id) > Math.max(...[...m8.values()]) - 0 && m9.get(p9.id) !== midN, `eliminada n=${midN}; nueva=${m9.get(p9.id)}`); }
{ const c1 = await mkP('c1', TC), c2 = await mkP('c2', TC); await list(tC); const before = (await dbOrd(TC)).length; await q('delete from "Users" where id=$1', [TC.id]).catch(async () => { await q('update "Users" set "therapistId"=null where "therapistId"=$1', [TC.id]); await q('delete from "Users" where id=$1', [TC.id]); });
  const after = (await q('select count(*)::int n from "TherapistPersonOrdinals" where "therapistId"=$1', [TC.id]))[0].n;
  check('O2d eliminar al profesional borra sus filas de ordinales en cascada', before === 2 && after === 0, `antes=${before} después=${after}`); }
{ const ids = (await q('select "personId" from "TherapistPersonOrdinals" where "therapistId"=$1', [TA.id])).map(r => r.personId); const live = new Set((await q('select id from "Users" where id = any($1)', [ids])).map(r => r.id));
  check('O2e no quedan filas de ordinales huérfanas (personas que ya no existen)', ids.every(i => live.has(i)), `filas=${ids.length}`); }

// ── P3 otras rutas del profesional con una persona que NO comparte (informativo clasificado)
{ const NS = A_N[0]; await call('PUT', '/api/consents/therapist_sharing', { token: mint(NS), body: { status: 'granted' } });
  const ses = await call('POST', '/api/sessions/therapist', { token: tA, body: { patientId: NS.id, scheduledAt: new Date(Date.now() + 36e5 * 30).toISOString(), duration: 50 } });
  await call('PUT', '/api/consents/therapist_sharing', { token: mint(NS), body: { status: 'revoked' } });
  const routes = [['/api/sessions/therapist'], ['/api/sessions/therapist/upcoming'], ['/api/therapist/pacientes'], ['/api/therapist/alerts'], [`/api/therapist/pacientes/${NS.id}/historia`], [`/api/therapist/pacientes/${NS.id}/historial`], [`/api/therapist/pacientes/${NS.id}/resumen-ia`]];
  const leaks = []; for (const [u] of routes) { const r = await call('GET', u, { token: tA }); const t = r.text.toLowerCase(); const hits = [t.includes(NS.name.toLowerCase()) ? 'nombre' : null, t.includes(NS.email.toLowerCase()) ? 'correo' : null].filter(Boolean); if (hits.length) leaks.push(`${u} → ${hits.join('+')} (status ${r.status})`); }
  info('P3', `sesión creada=${ses.status}; rutas del profesional que AÚN envían nombre/correo de quien no comparte: ${leaks.join(' · ') || 'ninguna'}`);
  check('P3 [CLASIFICACIÓN] ninguna ruta del profesional envía el CORREO de quien no comparte (el nombre en sesiones queda fuera de este PR: ES-241)', !leaks.some(l => /correo/.test(l)), leaks.join(' · ') || 'sin fugas'); }

// ── rendimiento de /pacientes
{ const ts = []; for (let i = 0; i < 15; i++) { const t = Date.now(); await list(tA); ts.push(Date.now() - t); } ts.sort((a, b) => a - b); info('PERF', `GET /pacientes (${rowsOf(await list(tA)).length} personas): mediana ${ts[7]} ms, p95 ${ts[13]} ms, máx ${ts[14]} ms`); }
console.log('FIN-ES177'); await db.end(); process.exit(0);
