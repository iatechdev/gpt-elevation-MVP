// [QA-Claude] ES-105 · PR #79: promedio de ánimo en resumen del terapeuta, matching y recomendaciones; 502 ante respuesta vacía. Postgres REAL, IA simulada con registro del prompt, datos sintéticos.
// Uso: QA_SUT=<clon> QA_OK=<servidor> QA_EMPTY=<proveedor devuelve content vacío> QA_BLANK=<proveedor devuelve solo espacios> QA_MOCK=<mock> DATABASE_URL=<base> QA_JWT_SECRET=<clave> node qa/integration/es105-real-db.mjs
import { createRequire } from 'node:module'; import { randomBytes } from 'node:crypto'; import path from 'node:path';
const E = process.env; const sut = E.QA_SUT; const URLS = { ok: E.QA_OK, empty: E.QA_EMPTY, blank: E.QA_BLANK }; const mock = E.QA_MOCK, JWT = E.QA_JWT_SECRET;
const req = createRequire(path.join(sut, 'backend', 'package.json')); const { Client } = req('pg'); const jwt = req('jsonwebtoken');
const db = new Client({ connectionString: E.DATABASE_URL, ssl: false }); await db.connect(); const q = async (s, p = []) => (await db.query(s, p)).rows;
const check = (id, ok, d = '') => console.log(JSON.stringify({ id, ok: !!ok, detail: d })); const info = (id, d) => console.log(JSON.stringify({ id, info: d }));
const stamp = Date.now();
const call = async (srv, m, u, { t, body } = {}) => { const h = {}; if (t) h.Authorization = 'Bearer ' + t; if (body !== undefined) h['Content-Type'] = 'application/json'; const r = await fetch(URLS[srv] + u, { method: m, headers: h, body: body === undefined ? undefined : JSON.stringify(body) }); const text = await r.text(); let json = null; try { json = JSON.parse(text); } catch { /* */ } return { status: r.status, json, text }; };
const sign = u => jwt.sign({ id: u.id, name: u.name, role: u.role, iatMs: Date.now() }, JWT, { expiresIn: '3h', jwtid: randomBytes(8).toString('hex') });
const mk = async (tag, role = 'user') => { const email = `qa105-${tag}-${stamp}@example.test`; const r = await call('ok', 'POST', '/api/register', { body: { name: 'Nombre Real ' + tag, email, password: randomBytes(12).toString('base64url') + 'aA1!' } }); if (r.status !== 201) throw new Error('registro ' + tag + ' ' + r.status); if (role !== 'user') await q('update "Users" set role=$1 where email=$2', [role, email]); const u = (await q('select id,name,role from "Users" where email=$1', [email]))[0]; return { ...u, email, t: sign(u) }; };
const stats = async () => (await fetch(mock + '/_stats')).json(); const mreset = () => fetch(mock + '/_reset'); const day = n => new Date(Date.now() - n * 864e5).toISOString().split('T')[0];
const lastMsgs = async () => { const s = await stats(); return { calls: s.calls, msgs: s.last?.messages?.map(m => m.content).join('\n') ?? '' }; };
const A = await mk('thA', 'therapist');
const patient = async tag => { const p = await mk(tag); await q('update "Users" set "therapistId"=$1 where id=$2', [A.id, p.id]); return p; };
const seed = async (uid, logs) => { for (const [i, [a, b]] of logs.entries()) await q('insert into "MoodLogs" ("UserId", date, checkin_mood, checkout_mood, "createdAt", "updatedAt") values ($1,$2,$3,$4,now(),now())', [uid, day(i + 1), a, b]); };
const re = { sum: /Average mood \(1-5\): ([0-9.]+|N\/A)/, rec: /Average mood \(1-5 scale\): ([^\n]+)/, mat: /Average mood \(1-5\): ([^\n]+)/ };
const getSum = async p => { await mreset(); const r = await call('ok', 'GET', `/api/therapist/pacientes/${p.id}/resumen-ia`, { t: A.t }); const l = await lastMsgs(); return { r, v: l.msgs.match(re.sum)?.[1] ?? null, calls: l.calls }; };
const getRec = async p => { await mreset(); const r = await call('ok', 'POST', '/api/recommendations/generate', { t: p.t, body: {} }); const l = await lastMsgs(); return { r, v: l.msgs.match(re.rec)?.[1]?.trim() ?? null, calls: l.calls }; };
const getMat = async p => { await mreset(); const r = await call('ok', 'POST', '/api/matching/request', { t: p.t, body: { answers: { focus: 'estres', style: 'directo' } } }); const l = await lastMsgs(); return { r, v: l.msgs.match(re.mat)?.[1]?.trim() ?? null, calls: l.calls }; };
// ── Un terapeuta disponible para el matching
await q(`insert into "TherapistProfiles" ("UserId","createdAt","updatedAt") select $1,now(),now() where not exists (select 1 from "TherapistProfiles" where "UserId"=$1)`, [A.id]).catch(() => {});
// ── M: nueve casos de borde × tres rutas
const cases = [['sin registros', [], 'N/A', 'No data yet', 'No data'], ['1 registro (4,5)', [[4, 5]], '4.5', '4.5', '4.5'], ['2 registros (4,5)(3,3)', [[4, 5], [3, 3]], '3.8', '3.8', '3.8'], ['solo entrada', [[4, null]], '4.0', '4.0', '4.0'], ['solo salida', [[null, 2]], '2.0', '2.0', '2.0'], ['ambos nulos', [[null, null]], 'N/A', 'No data yet', 'No data'], ['mezclados', [[1, 5], [null, 3], [2, null]], '2.8', '2.8', '2.8'], ['todos 5', [[5, 5], [5, 5]], '5.0', '5.0', '5.0'], ['todos 1', [[1, 1]], '1.0', '1.0', '1.0']];
const bad = []; let i = 0; for (const [name, logs, eS, eR, eM] of cases) { const P = await patient('c' + i++); await seed(P.id, logs); const s = await getSum(P); const r = await getRec(P); const m = await getMat(P); if (s.r.status !== 200 || s.v !== eS) bad.push(`resumen ${name}: ${s.v} (${s.r.status})`); if (r.v !== eR) bad.push(`recomend ${name}: ${r.v} (${r.r.status})`); if (m.v !== eM) bad.push(`matching ${name}: ${m.v} (${m.r.status})`); }
check('ES105-M01 los 9 casos de borde dan el mismo promedio correcto en resumen, recomendaciones y matching (sin registros/nulos: sin número inventado)', bad.length === 0, bad.join(' | ') || '27 comprobaciones');
// ── M02: 30 registros aleatorios en las tres rutas (límites 30/7/14)
const P30 = await patient('r30'); const rows = []; for (let k = 0; k < 30; k++) rows.push([1 + Math.floor(Math.random() * 5), 1 + Math.floor(Math.random() * 5)]); await seed(P30.id, rows);
const mean = a => (a.flat().reduce((x, y) => x + y, 0) / (a.length * 2)).toFixed(1); const s30 = await getSum(P30), r30 = await getRec(P30), m30 = await getMat(P30);
check('ES105-M02 con 30 registros aleatorios: resumen sobre 30, recomendaciones sobre los 7 más recientes, matching sobre los 14 más recientes; todos dentro de 1–5', s30.v === mean(rows) && r30.v === mean(rows.slice(0, 7)) && m30.v === mean(rows.slice(0, 14)) && [s30.v, r30.v, m30.v].every(v => +v >= 1 && +v <= 5), `resumen=${s30.v}/${mean(rows)} recomend=${r30.v}/${mean(rows.slice(0, 7))} matching=${m30.v}/${mean(rows.slice(0, 14))}`);
// ── V: valores fuera de rango guardados por datos antiguos (se ignoran)
const PV = await patient('oor'); await seed(PV.id, [[7, 4], [0, 2], [-3, 5], [3, 99]]); const sv = await getSum(PV), rv = await getRec(PV), mv = await getMat(PV); const expV = ((4 + 2 + 5 + 3) / 4).toFixed(1);
check('ES105-V01 valores fuera de 1–5 (7, 0, -3, 99) se ignoran en las tres rutas; el promedio se calcula con los válidos', sv.v === expV && rv.v === expV && mv.v === expV, `esperado=${expV} resumen=${sv.v} recomend=${rv.v} matching=${mv.v}`);
const PV2 = await patient('oor2'); await seed(PV2.id, [[9, 9], [0, 0]]); const sv2 = await getSum(PV2), rv2 = await getRec(PV2), mv2 = await getMat(PV2);
check('ES105-V02 si todos los valores están fuera de rango no se inventa un promedio (N/A / No data)', sv2.v === 'N/A' && rv2.v === 'No data yet' && mv2.v === 'No data', `${sv2.v} | ${rv2.v} | ${mv2.v}`);
// ── F: respuesta vacía / solo espacios del proveedor
const PF = await patient('fe'); await seed(PF.id, [[3, 4]]);
const e1 = await call('empty', 'GET', `/api/therapist/pacientes/${PF.id}/resumen-ia`, { t: A.t }); const e2 = await call('blank', 'GET', `/api/therapist/pacientes/${PF.id}/resumen-ia`, { t: A.t });
check('ES105-F01 respuesta vacía (content []) y solo espacios del proveedor → 502 `provider_unavailable` reintentable, sin `summary` vacío', [e1, e2].every(x => x.status === 502 && x.json?.code === 'provider_unavailable' && x.json?.retryable === true && !('summary' in (x.json ?? {}))), `${e1.status}/${e2.status} ${e2.text.slice(0, 100)}`);
await mreset(); await fetch(mock + '/_text?v=' + encodeURIComponent('Resumen breve y neutral.')); const okR = await call('ok', 'GET', `/api/therapist/pacientes/${PF.id}/resumen-ia`, { t: A.t });
check('ES105-F02 una respuesta con texto sigue dando 200 con `summary` y `basedOn`', okR.status === 200 && okR.json?.summary === 'Resumen breve y neutral.' && okR.json?.basedOn?.sessions === 1, `status=${okR.status} summary=${JSON.stringify(okR.json?.summary)}`);
await mreset(); await fetch(mock + '/_text?v=' + encodeURIComponent('  \n Con espacios alrededor.  \n')); const okT = await call('ok', 'GET', `/api/therapist/pacientes/${PF.id}/resumen-ia`, { t: A.t });
info('ES105-F03 [INFO] el resumen se devuelve recortado (trim)', JSON.stringify(okT.json?.summary));
// ── S: permisos intactos
const other = await mk('thB', 'therapist'); const xB = await call('ok', 'GET', `/api/therapist/pacientes/${PF.id}/resumen-ia`, { t: other.t }); const xU = await call('ok', 'GET', `/api/therapist/pacientes/${PF.id}/resumen-ia`, { t: PF.t });
check('ES105-S01 [PRIV] otro terapeuta → 404 y participante → 403 (sin cambios)', xB.status === 404 && xU.status === 403, `${xB.status}/${xU.status}`);
console.log(JSON.stringify({ fin: true })); await db.end();
