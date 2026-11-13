// [QA-Claude] ES-276 · PR #231 (TherapistPersonOrdinals entra al registro de purga y exportación de ES-23) · base DESECHABLE LOCAL (Postgres embebido 127.0.0.1:54459), datos sintéticos, 0 IA.
// Uso: node es276-ordinales-pr231.mjs <carpeta del repositorio> [main]     (con «main» es el control: las comprobaciones se evalúan igual y se informa el «antes»)
import { createRequire } from 'node:module'; import { spawn, spawnSync } from 'node:child_process'; import fs from 'node:fs'; import path from 'node:path'; import { randomBytes } from 'node:crypto';
const REPO = process.argv[2]; const MODE = process.argv[3] === 'main' ? 'main' : 'pr'; const BACK = path.join(REPO, 'backend'); const S = 'C:/Users/Usuario/Documents/qa13';
const req = createRequire(BACK + '/package.json'); const { Client } = req('pg'); const jwt = req('jsonwebtoken');
const JWT = fs.readFileSync(S + '/jwt', 'utf8').trim(), DEK = fs.readFileSync(S + '/dek', 'utf8').trim(), PEK = fs.readFileSync(S + '/pek', 'utf8').trim();
const PGADMIN = 'postgres://elevation:elevation_local@127.0.0.1:54459/postgres'; const DBN = 'qa_ord276_' + MODE; const URL_ = `postgres://elevation:elevation_local@127.0.0.1:54459/${DBN}`; const PORT = MODE === 'main' ? 8277 : 8276; const API = `http://127.0.0.1:${PORT}`;
const out = []; const check = (id, ok, d = '') => { out.push({ id, ok: !!ok, detail: String(d).slice(0, 1500) }); console.log(JSON.stringify({ id, ok: !!ok, detail: String(d).slice(0, 1500) })); }; const info = (id, d) => { out.push({ id, info: String(d).slice(0, 1500) }); console.log(JSON.stringify({ id, info: String(d).slice(0, 1500) })); };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
if (!/@127\.0\.0\.1:54459\//.test(URL_)) throw new Error('destino no local');
const env = (extra = {}) => ({ ...process.env, DATABASE_URL: URL_, DB_SSL: 'false', NODE_ENV: 'development', JWT_SECRET: JWT, DATA_ENCRYPTION_KEY: DEK, PROMPT_ENCRYPTION_KEY: PEK, DATA_RIGHTS_ENABLED: 'true', ...extra });
{ const a = new Client({ connectionString: PGADMIN }); await a.connect(); await a.query(`DROP DATABASE IF EXISTS ${DBN} WITH (FORCE)`); await a.query(`CREATE DATABASE ${DBN}`); await a.end(); }
const mig = spawnSync(process.execPath, ['node_modules/sequelize-cli/lib/sequelize', 'db:migrate'], { cwd: BACK, env: env(), encoding: 'utf8', timeout: 300000 }); info('migraciones', `exit=${mig.status}`);
let srv = null; const startServer = async () => { srv = spawn(process.execPath, ['server.js'], { cwd: BACK, stdio: 'ignore', env: env({ PORT: String(PORT), ALLOW_SYNTHETIC_CATALOG: 'true', ANTHROPIC_API_KEY: 'sk-synthetic-not-real', PRO_APP_RATE_MAX: '100000', LOGIN_RATE_MAX: '100000' }) }); for (let i = 0; i < 160; i++) { try { if ((await fetch(API + '/api/health')).ok) return; } catch { /* */ } await sleep(250); } };
const stopServer = async () => { try { srv.kill(); } catch { /* */ } for (let i = 0; i < 60; i++) { try { await fetch(API + '/api/health', { signal: AbortSignal.timeout(500) }); } catch { return; } await sleep(200); } };
const lastJson = (t) => { const l = String(t).split(/\r?\n/).reverse().find(x => x.trim().startsWith('{')); return l || ''; };
const purge = (uuid) => { const r = spawnSync(process.execPath, ['scripts/purgePersonalData.js', uuid, '--producers-stopped-and-drained'], { cwd: BACK, env: env(), encoding: 'utf8', timeout: 600000 }); return { st: r.status, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() }; };
await startServer();
const c = new Client({ connectionString: URL_ }); await c.connect(); const q = async (s, p = []) => (await c.query(s, p)).rows; const stamp = Date.now();
const mk = async (tag, role = 'user') => { const email = `qa-ord-${tag}-${stamp}@example.test`; const password = randomBytes(12).toString('base64url') + 'aA1!'; await fetch(API + '/api/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'QA Ord ' + tag, email, password }) }); if (role !== 'user') await q('update "Users" set role=$1 where email=$2', [role, email]); const u = (await q('select id,name,role from "Users" where email=$1', [email]))[0]; return { ...u, email, token: jwt.sign({ id: u.id, name: u.name, role: u.role, iatMs: Date.now() }, JWT, { expiresIn: '3h', jwtid: randomBytes(8).toString('hex') }) }; };
const call = async (u, m, p, body) => { const r = await fetch(API + p, { method: m, headers: { ...(u ? { Authorization: 'Bearer ' + u.token } : {}), ...(body !== undefined ? { 'content-type': 'application/json' } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) }); const text = await r.text(); let json = null; try { json = JSON.parse(text); } catch { /* */ } return { status: r.status, json, text }; };
const ords = (t) => q('select "personId","ordinal","therapistId" from "TherapistPersonOrdinals" where "therapistId"=$1 order by "ordinal"', [t]);
const counter = async (t) => (await q('select "lastOrdinal" from "TherapistOrdinalCounters" where "therapistId"=$1', [t]))[0]?.lastOrdinal ?? null;
const SU = await mk('su', 'superadmin'), TH1 = await mk('th1', 'therapist'), TH2 = await mk('th2', 'therapist'), TH3 = await mk('th3', 'therapist');
const P1 = await mk('p1'), P2 = await mk('p2'), P3 = await mk('p3'), PM = await mk('pm'), X = await mk('x'), PD = await mk('pd'), PA = await mk('pa');
// P1,P2,P3,PM con TH1 (sin autorizar compartir: reciben «Persona n»); X con TH2; PA con TH3
await q('update "Users" set "therapistId"=$1 where id = any($2)', [TH1.id, [P1.id, P2.id, P3.id, PM.id]]); await q('update "Users" set "therapistId"=$1 where id=$2', [TH2.id, X.id]); await q('update "Users" set "therapistId"=$1 where id=$2', [TH3.id, PA.id]);
const l1 = await call(TH1, 'GET', '/api/therapist/pacientes'); // asigna 1..4 por orden de id
await q('update "Users" set "therapistId"=$1 where id=$2', [TH2.id, PM.id]); const l2 = await call(TH2, 'GET', '/api/therapist/pacientes'); const l3 = await call(TH3, 'GET', '/api/therapist/pacientes');
const o1 = await ords(TH1.id), o2 = await ords(TH2.id), o3 = await ords(TH3.id); const ctr0 = { t1: await counter(TH1.id), t2: await counter(TH2.id), t3: await counter(TH3.id) };
info('siembra', `listados ${l1.status}/${l2.status}/${l3.status}; ordinales TH1=${JSON.stringify(o1.map(r => [r.personId, r.ordinal]))} TH2=${JSON.stringify(o2.map(r => [r.personId, r.ordinal]))} TH3=${JSON.stringify(o3.map(r => [r.personId, r.ordinal]))}; contadores ${JSON.stringify(ctr0)}`);
const nOrd = async (pid) => (await q('select count(*)::int n from "TherapistPersonOrdinals" where "personId"=$1', [pid]))[0].n;
check('O0 siembra: P1, P2, P3 y PM tienen «Persona n» con TH1 (1–4); PM además con TH2; X con TH2; PA con TH3', o1.length === 4 && (await nOrd(PM.id)) === 2 && o2.length === 2 && o3.length === 1, `TH1=${o1.length} PM=${await nOrd(PM.id)} TH2=${o2.length} TH3=${o3.length}`);

// ---------- O5 columnas
const cols = await q(`select column_name n,data_type d from information_schema.columns where table_schema='public' and table_name='TherapistPersonOrdinals' order by ordinal_position`);
check('O5 la tabla solo guarda ids numéricos, el ordinal y fechas (sin texto libre ni datos personales)', cols.every(k => /^(id|therapistId|personId|ordinal|createdAt|updatedAt)$/.test(k.n)) && cols.every(k => !/char|text|json/.test(k.d)), cols.map(k => `${k.n}:${k.d}`).join(', '));

// ---------- O4 exportación
const exp = async (u) => { const r = await call(u, 'POST', '/api/exports/preview', { type: 'personal', locale: 'es' }); return r; };
const eP2 = await exp(P2), ePM = await exp(PM), eX = await exp(X), ePD = await exp(PD);
const getOrd = (r) => { const d = r.json?.data; if (!d) return undefined; if (d.therapistOrdinals !== undefined) return d.therapistOrdinals; const s = JSON.stringify(d); return s.includes('therapistOrdinals') ? 'anidado' : undefined; };
info('O4-detalle', `[${MODE}] export P2 ${eP2.status} ${JSON.stringify(getOrd(eP2))} · PM ${ePM.status} ${JSON.stringify(getOrd(ePM))} · X ${eX.status} ${JSON.stringify(getOrd(eX))} · PD ${ePD.status} ${JSON.stringify(getOrd(ePD))}`);
const keysOk = (arr) => Array.isArray(arr) && arr.every(r => JSON.stringify(Object.keys(r).sort()) === JSON.stringify(['createdAt', 'id', 'ordinal']));
check('O4 exportación de la persona: `therapistOrdinals` con SOLO `id`, `ordinal`, `createdAt` (nunca `therapistId` ni `personId`); P2 → 1 fila; PM (dos profesionales) → 2 filas; X → solo la suya; PD (sin ordinal) → arreglo vacío; ningún nombre ni correo de profesional', keysOk(getOrd(eP2)) && getOrd(eP2).length === 1 && keysOk(getOrd(ePM)) && getOrd(ePM).length === 2 && keysOk(getOrd(eX)) && getOrd(eX).length === 1 && Array.isArray(getOrd(ePD)) && getOrd(ePD).length === 0 && ![eP2, ePM, eX].some(r => r.text.includes(TH1.email) || r.text.includes(TH2.email) || r.text.includes(TH1.name)), `${JSON.stringify(getOrd(eP2))} | ${JSON.stringify(getOrd(ePM))}`);

// ---------- eliminar P2 y PM (y PA más adelante) por la API, parar productores y purgar
const del = {}; for (const p of [P2, PM]) del[p.id] = await call(SU, 'DELETE', `/api/admin/usuarios/${p.id}`);
const reqId = async (pid) => (await q('select id from "DeletionRequests" where "UserId"=$1', [pid]))[0]?.id;
const u2 = await reqId(P2.id), uM = await reqId(PM.id); await stopServer();
const before = { p1: await ords(TH1.id), x: await ords(TH2.id), ctr: { t1: await counter(TH1.id), t2: await counter(TH2.id), t3: await counter(TH3.id) }, pa: await ords(TH3.id) };
const r2 = purge(u2), rM = purge(uM);
const afterOrd = { p2: await nOrd(P2.id), pm: await nOrd(PM.id) }; const afterT1 = await ords(TH1.id), afterT2 = await ords(TH2.id), ctr1 = { t1: await counter(TH1.id), t2: await counter(TH2.id), t3: await counter(TH3.id) };
const st = async (u) => (await q('select status,"failureCode" from "DeletionRequests" where id=$1', [u]))[0];
info('O1-detalle', `[${MODE}] DELETE ${del[P2.id].status}/${del[PM.id].status}; purga P2 exit=${r2.st} ${lastJson(r2.out).slice(0, 160)} (${JSON.stringify(await st(u2))}); purga PM exit=${rM.st} (${JSON.stringify(await st(uM))}); filas de ordinal que quedan: P2=${afterOrd.p2} PM=${afterOrd.pm}`);
check('O1 tras purgar a P2: 0 filas de `TherapistPersonOrdinals` con su `personId`; las de P1, P3 y PM-en-su-momento no se tocan por esta purga; recibo sin datos personales', r2.st === 0 && afterOrd.p2 === 0 && afterT1.some(r => r.personId === P1.id && r.ordinal === 1) && afterT1.some(r => r.personId === P3.id && r.ordinal === 3) && !r2.out.includes(P2.email) && !r2.out.includes(String(P2.name)), `P2=${afterOrd.p2} · TH1 conserva ${JSON.stringify(afterT1.map(r => [r.personId, r.ordinal]))}`);
check('O7 persona con ordinales de DOS profesionales (PM, cambió de profesional): al purgarla se borran las dos filas (TH1 y TH2) y las ajenas (X en TH2, P1/P3 en TH1) quedan idénticas', rM.st === 0 && afterOrd.pm === 0 && afterT2.some(r => r.personId === X.id && r.ordinal === before.x.find(z => z.personId === X.id).ordinal) && afterT1.filter(r => r.personId === P1.id || r.personId === P3.id).length === 2, `PM=${afterOrd.pm} · TH2 conserva ${JSON.stringify(afterT2.map(r => [r.personId, r.ordinal]))}`);
check('O3 aislamiento: las filas de otros profesionales (TH3 con PA) y los contadores no cambian por la purga', JSON.stringify(await ords(TH3.id)) === JSON.stringify(before.pa) && ctr1.t3 === before.ctr.t3, `TH3 ${JSON.stringify(await ords(TH3.id))}`);
check('O2a el contador monótono NO se toca al purgar: `TherapistOrdinalCounters.lastOrdinal` igual antes y después (TH1 y TH2)', ctr1.t1 === before.ctr.t1 && ctr1.t2 === before.ctr.t2 && ctr1.t1 === 4, `antes ${JSON.stringify(before.ctr)} · después ${JSON.stringify(ctr1)}`);
// O2b: una persona nueva no hereda el número liberado
await startServer(); const P4 = await mk('p4'); await q('update "Users" set "therapistId"=$1 where id=$2', [TH1.id, P4.id]); const l4 = await call(TH1, 'GET', '/api/therapist/pacientes'); const o4 = await ords(TH1.id); const newRow = o4.find(r => r.personId === P4.id); const liberated = [2, 4];
check('O2b una persona NUEVA con TH1 recibe el número siguiente (5), nunca el 2 ni el 4 que quedaron libres; las demás conservan su número', l4.status === 200 && newRow?.ordinal === 5 && !liberated.includes(newRow?.ordinal) && o4.find(r => r.personId === P1.id)?.ordinal === 1 && o4.find(r => r.personId === P3.id)?.ordinal === 3, `P4 → ${newRow?.ordinal} · ${JSON.stringify(o4.map(r => [r.personId, r.ordinal]))}`);
// también para quien tenía el número MÁS ALTO (PM era el 4 con TH1 y ya está purgada): lo cubre O2b (5, no 4)

// ---------- O8 borrar la cuenta del PROFESIONAL (observación)
await q('update "Users" set "therapistId"=null where id=$1', [PA.id]); const dT = await call(SU, 'DELETE', `/api/admin/usuarios/${TH3.id}`); const left = { ords: (await ords(TH3.id)).length, ctr: await counter(TH3.id), user: (await q('select count(*)::int n from "Users" where id=$1', [TH3.id]))[0].n, req: await st((await reqId(TH3.id)) ?? '00000000-0000-4000-8000-000000000000') };
info('O8-profesional', `[${MODE}] DELETE de la cuenta de profesional (sin personas vinculadas ya) → ${dT.status} ${dT.text.slice(0, 120)}; quedan: filas de ordinal=${left.ords} contador=${left.ctr} fila Users=${left.user} solicitud=${JSON.stringify(left.req)}`);

console.log('RESUMEN ' + out.filter(r => 'ok' in r && r.ok).length + '/' + out.filter(r => 'ok' in r).length + ' ok; fallos: ' + out.filter(r => 'ok' in r && !r.ok).map(r => r.id.split(' ')[0]).join(', '));
fs.writeFileSync(path.join(process.env.OUT || '.', MODE === 'main' ? 'ES-276-ordinales-main.json' : 'ES-276-ordinales-pr231.json'), JSON.stringify({ mode: MODE, results: out }, null, 1));
await c.end(); await stopServer(); process.exit(0);
