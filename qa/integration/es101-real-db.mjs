// [QA-Claude] ES-101 · PR #72: el terapeuta no accede a personas con eliminación aceptada o cuenta inactiva (corrección de ES93-A1). Postgres REAL, IA simulada, datos sintéticos.
// Uso: QA_SUT=<clon> QA_API=<servidor con DATA_RIGHTS_ENABLED=true> QA_MOCK=<mock> QA_SRVLOG=<registro del servidor> DATABASE_URL=<base> QA_JWT_SECRET=<clave> node qa/integration/es101-real-db.mjs
import { createRequire } from 'node:module'; import { randomBytes } from 'node:crypto'; import { readFileSync } from 'node:fs'; import path from 'node:path';
const sut = process.env.QA_SUT, api = process.env.QA_API, mock = process.env.QA_MOCK, JWT = process.env.QA_JWT_SECRET;
const req = createRequire(path.join(sut, 'backend', 'package.json')); const { Client } = req('pg'); const jwt = req('jsonwebtoken');
const db = new Client({ connectionString: process.env.DATABASE_URL, ssl: false }); await db.connect(); const q = async (s, p = []) => (await db.query(s, p)).rows;
const check = (id, ok, d = '') => console.log(JSON.stringify({ id, ok: !!ok, detail: d })); const info = (id, d) => console.log(JSON.stringify({ id, info: d }));
const stamp = Date.now();
const call = async (m, u, { t, body } = {}) => { const h = {}; if (t) h.Authorization = 'Bearer ' + t; if (body !== undefined) h['Content-Type'] = 'application/json'; const t0 = performance.now(); const r = await fetch(api + u, { method: m, headers: h, body: body === undefined ? undefined : JSON.stringify(body) }); const text = await r.text(); let json = null; try { json = JSON.parse(text); } catch { /* */ } return { status: r.status, json, text, ms: performance.now() - t0 }; };
const sign = (u) => jwt.sign({ id: u.id, name: u.name, role: u.role, iatMs: Date.now() }, JWT, { expiresIn: '3h', jwtid: randomBytes(8).toString('hex') });
const mk = async (tag, role = 'user') => { const email = `qa101-${tag}-${stamp}@example.test`; const r = await call('POST', '/api/register', { body: { name: 'QA101 ' + tag, email, password: randomBytes(12).toString('base64url') + 'aA1!' } }); if (r.status !== 201) throw new Error('registro ' + tag + ' ' + r.status); if (role !== 'user') await q('update "Users" set role=$1 where email=$2', [role, email]); const u = (await q('select id,name,role from "Users" where email=$1', [email]))[0]; return { ...u, email, t: sign(u) }; };
const A = await mk('thA', 'therapist'), B = await mk('thB', 'therapist'), ADM = await mk('adm', 'admin');
const day = n => new Date(Date.now() - n * 864e5).toISOString().split('T')[0]; const fut = h => new Date(Date.now() + h * 36e5).toISOString();
// Persona con datos y sesiones
const mkPatient = async (tag, therapist = A) => { const p = await mk(tag); await q('update "Users" set "therapistId"=$1 where id=$2', [therapist.id, p.id]); for (const [n, ci, co] of [[1, 4, 5], [2, 4, 4], [5, 2, 2]]) await q('insert into "MoodLogs" ("UserId", date, checkin_mood, checkout_mood, "createdAt", "updatedAt") values ($1,$2,$3,$4,now(),now())', [p.id, day(n), ci, co]); await call('POST', '/api/rating', { t: p.t, body: { rating: 4 } }); const note = await call('POST', `/api/therapist/pacientes/${p.id}/notas`, { t: therapist.t, body: { content: 'Nota sintética ' + tag, sessionDate: '2026-10-20' } }); const s1 = await call('POST', '/api/sessions/therapist', { t: therapist.t, body: { patientId: p.id, scheduledAt: fut(24), duration: 50 } }); const s2 = await call('POST', '/api/sessions/therapist', { t: therapist.t, body: { patientId: p.id, scheduledAt: fut(48), duration: 50 } }); const s3 = await call('POST', '/api/sessions/therapist', { t: therapist.t, body: { patientId: p.id, scheduledAt: fut(72), duration: 50 } }); await call('POST', `/api/sessions/therapist/${s3.json.session.id}/start`, { t: therapist.t }); return { ...p, noteId: note.json?.note?.id, s1: s1.json?.session?.id, s2: s2.json?.session?.id, live: s3.json?.session?.id }; };
// Todas las operaciones del terapeuta sobre una persona; devuelve {nombre: estado}
const ops = async (who, p) => ({
  lista: (await call('GET', '/api/therapist/pacientes', { t: who.t })).text.includes(p.name) ? 'aparece' : 'no aparece',
  alertas: (await call('GET', '/api/therapist/alerts', { t: who.t })).text.includes(`"userId":${p.id}`) ? 'aparece' : 'no aparece',
  historial: (await call('GET', `/api/therapist/pacientes/${p.id}/historial`, { t: who.t })).status,
  historia: (await call('GET', `/api/therapist/pacientes/${p.id}/historia`, { t: who.t })).status,
  resumen: (await call('GET', `/api/therapist/pacientes/${p.id}/resumen-ia`, { t: who.t })).status,
  notaCrear: (await call('POST', `/api/therapist/pacientes/${p.id}/notas`, { t: who.t, body: { content: 'intento tras bloqueo', sessionDate: '2026-10-21' } })).status,
  notaEditar: (await call('PUT', `/api/therapist/notas/${p.noteId}`, { t: who.t, body: { content: 'editada tras bloqueo' } })).status,
  agendar: (await call('POST', '/api/sessions/therapist', { t: who.t, body: { patientId: p.id, scheduledAt: fut(100) } })).status,
  sesEditar: (await call('PUT', `/api/sessions/therapist/${p.s1}`, { t: who.t, body: { duration: 30 } })).status,
  sesNotasLeer: (await call('GET', `/api/sessions/therapist/${p.live}/notes`, { t: who.t })).status,
  sesNotasEscribir: (await call('POST', `/api/sessions/therapist/${p.live}/notes`, { t: who.t, body: { content: 'nota en vivo tras bloqueo' } })).status,
  sesIniciar: (await call('POST', `/api/sessions/therapist/${p.s2}/start`, { t: who.t })).status,
  sesTerminar: (await call('POST', `/api/sessions/therapist/${p.live}/end`, { t: who.t, body: { therapistNote: 'Cierre tras bloqueo (prueba)', patientMoodAfter: 3 } })).status,
  sesLista: (await call('GET', '/api/sessions/therapist', { t: who.t })).text.includes(`"patientId":${p.id},`) ? 'aparece' : 'no aparece',
  sesProximas: (await call('GET', '/api/sessions/therapist/upcoming', { t: who.t })).text.includes(`"patientId":${p.id},`) ? 'aparece' : 'no aparece',
});
const open = o => o.historial === 200 && o.historia === 200;
const blockedOk = o => o.lista === 'no aparece' && o.alertas === 'no aparece' && o.historial === 404 && o.historia === 404 && o.resumen === 404 && o.notaCrear === 404 && o.notaEditar === 404 && o.agendar === 403 && o.sesEditar === 404 && o.sesNotasLeer === 404 && o.sesNotasEscribir === 404 && o.sesIniciar === 404 && o.sesTerminar === 404 && o.sesLista === 'no aparece' && o.sesProximas === 'no aparece';
// ── Línea base: antes de cualquier bloqueo A ve todo
const P1 = await mkPatient('p1'); const base = await ops(A, P1);
check('ES101-B01 línea base: antes de bloquear, el terapeuta ve a P1 y opera con normalidad (lista, historial, historia, resumen, notas, sesiones)', open(base) && base.lista === 'aparece' && base.resumen === 200 && base.notaCrear === 201 && base.notaEditar === 200 && [200, 400].includes(base.sesTerminar), JSON.stringify(base));
// Rehacer la persona sin las escrituras de la línea base que alteran estados
const P2 = await mkPatient('p2'), P3 = await mkPatient('p3'), P4 = await mkPatient('p4'), P5 = await mkPatient('p5', B); await call('POST', '/api/mood/checkin', { t: P2.t, body: { mood: 2 } });
// ── A1: eliminación aceptada
const del = await call('POST', '/api/account/deletion-requests', { t: P2.t, body: { confirm: true } }); const o2 = await ops(A, P2);
check('ES101-A01 [PRIV] eliminación aceptada (202): el terapeuta recibe 404 en historial, historia, resumen, crear y editar nota y sesiones; agendar 403; la persona no aparece en lista, alertas ni sesiones', del.status === 202 && blockedOk(o2), `eliminación=${del.status} ${JSON.stringify(o2)}`);
const body404 = await call('GET', `/api/therapist/pacientes/${P2.id}/historia`, { t: A.t }); const log = (() => { try { return readFileSync(process.env.QA_SRVLOG, 'utf8'); } catch { return ''; } })();
check('ES101-A02 [PRIV] el 404 es uniforme (igual al de una persona ajena) y no trae nombre, correo ni datos; los registros del servidor no los contienen', body404.status === 404 && !/QA101 p2|@example|qa101-p2|Nota sintética/.test(body404.text) && body404.text === (await call('GET', '/api/therapist/pacientes/999999/historia', { t: A.t })).text && !/qa101-p2|QA101 p2/.test(log), body404.text.slice(0, 80));
// A sigue viendo a las demás personas
const o3a = await ops(A, P3); check('ES101-A03 las demás personas de A (P3, P4) siguen accesibles mientras P2 está bloqueada', open(o3a) && o3a.lista === 'aparece', `P3 historial=${o3a.historial} lista=${o3a.lista}`);
// ── Cuenta inactiva por el administrador (API)
const off = await call('PUT', `/api/admin/usuarios/${P3.id}`, { t: ADM.t, body: { active: false } }); const o3 = await ops(A, P3);
check('ES101-I01 [PRIV] cuenta desactivada por el administrador (API): mismo bloqueo en todas las rutas', off.status === 200 && blockedOk(o3), `PUT=${off.status} ${JSON.stringify(o3)}`);
const on = await call('PUT', `/api/admin/usuarios/${P3.id}`, { t: ADM.t, body: { active: true } }); const o3b = await ops(A, P3);
check('ES101-I02 reactivar la cuenta restablece el acceso del terapeuta (lectura y escritura)', on.status === 200 && open(o3b) && o3b.notaCrear === 201 && o3b.lista === 'aparece', `PUT=${on.status} historial=${o3b.historial} notaCrear=${o3b.notaCrear} lista=${o3b.lista}`);
await q('update "Users" set active=false where id=$1', [P4.id]); const o4 = await ops(A, P4); check('ES101-I03 [PRIV] cuenta inactiva por SQL: mismo bloqueo', blockedOk(o4), JSON.stringify(o4)); await q('update "Users" set active=true where id=$1', [P4.id]);
// ── Tombstone con active=true (un administrador reactiva por error)
await q('update "Users" set active=true where id=$1', [P2.id]); const o2r = await ops(A, P2); check('ES101-T01 [PRIV] el tombstone bloquea aunque la cuenta quede active=true', blockedOk(o2r), `historial=${o2r.historial} historia=${o2r.historia} lista=${o2r.lista}`);
// ── «Cancelada» (no hay API: se borra la fila como lo haría un operador)
const delRow = await q('delete from "DeletionRequests" where "UserId"=$1 returning id', [P2.id]); const o2c = await ops(A, P2); check('ES101-C01 si la solicitud de eliminación desaparece (cancelada por un operador), el acceso se restablece', delRow.length === 1 && open(o2c), `historial=${o2c.historial}`);
// ── Fallo cerrado
await q('alter table "DeletionRequests" rename to "DeletionRequests_qa"'); const fc = []; for (const [m, u, b] of [['GET', '/api/therapist/pacientes'], ['GET', '/api/therapist/alerts'], ['GET', `/api/therapist/pacientes/${P4.id}/historial`], ['GET', `/api/therapist/pacientes/${P4.id}/historia`], ['GET', `/api/therapist/pacientes/${P4.id}/resumen-ia`], ['POST', `/api/therapist/pacientes/${P4.id}/notas`, { content: 'x', sessionDate: '2026-10-22' }], ['PUT', `/api/therapist/notas/${P4.noteId}`, { content: 'y' }], ['GET', '/api/sessions/therapist'], ['GET', '/api/sessions/therapist/upcoming'], ['POST', '/api/sessions/therapist', { patientId: P4.id, scheduledAt: fut(120) }]]) { const r = await call(m, u, { t: A.t, body: b }); fc.push(`${m} ${u.split('/').slice(3).join('/') || 'x'}:${r.status}:${/QA101 p4|Nota sintética p4|checkin_mood/.test(r.text) ? 'DATOS' : 'sin datos'}`); }
await q('alter table "DeletionRequests_qa" rename to "DeletionRequests"');
check('ES101-F01 [PRIV] con el registro de eliminaciones no disponible, ninguna ruta concede acceso ni devuelve datos de la persona (error controlado)', fc.every(x => !/:200:/.test(x) && !/:201:/.test(x) && !/DATOS/.test(x)), fc.join(' | '));
const recov = await call('GET', `/api/therapist/pacientes/${P4.id}/historial`, { t: A.t }); check('ES101-F02 al volver el registro, el acceso a una persona sin bloqueo se restablece sin reiniciar', recov.status === 200, `status=${recov.status}`);
// ── Otros vínculos y aislamiento
const oB = await ops(B, P5); check('ES101-V01 el terapeuta B y su persona P5 (sin bloqueo) operan con normalidad', open(oB) && oB.lista === 'aparece', `historial=${oB.historial}`);
const cross = await ops(A, P5); check('ES101-V02 [PRIV] A sigue sin acceso a la persona de B (aislamiento de ES-93)', cross.historial === 404 && cross.historia === 404 && cross.resumen === 404 && cross.notaCrear === 404 && cross.lista === 'no aparece', JSON.stringify(cross));
// ── Concurrencia: A consulta y escribe en bucle mientras P4 pide la eliminación
const stopAt = Date.now() + 6000; const seq = []; let notesAfter = 0; let delAt = null;
const loop = (async () => { while (Date.now() < stopAt) { const r = await call('GET', `/api/therapist/pacientes/${P4.id}/historia`, { t: A.t }); const w = await call('POST', `/api/therapist/pacientes/${P4.id}/notas`, { t: A.t, body: { content: 'bucle', sessionDate: '2026-10-22' } }); seq.push({ at: Date.now(), r: r.status, w: w.status }); } })();
await new Promise(r => setTimeout(r, 1500)); const d4 = await call('POST', '/api/account/deletion-requests', { t: P4.t, body: { confirm: true } }); delAt = Date.now(); await loop;
const firstBlock = seq.findIndex(x => x.r === 404); const after = firstBlock === -1 ? [] : seq.slice(firstBlock); const writesAfter = seq.filter(x => x.at > delAt + 300 && x.w === 201).length; const fiveXX = seq.filter(x => x.r >= 500 || x.w >= 500).length;
check('ES101-K01 [PRIV] concurrencia: tras aceptarse la eliminación todas las lecturas son 404 (monótono), no se crean notas nuevas y no hay 5xx', d4.status === 202 && firstBlock !== -1 && after.every(x => x.r === 404) && writesAfter === 0 && fiveXX === 0, `eliminación=${d4.status} peticiones=${seq.length} primera404=${firstBlock} escriturasTrasBloqueo=${writesAfter} 5xx=${fiveXX}`);
// ── Lado de la persona (informativo)
const my = await call('GET', '/api/sessions/user/my-therapist', { t: P2.t }); const joinP = await call('GET', `/api/sessions/user/${P4.live}/join`, { t: P4.t }); info('ES101-L01 [INFO] lado de la persona durante la eliminación (el PR no lo toca)', { miTerapeuta: my.status, unirse: joinP.status });
// ── Rendimiento con 50 pacientes
const many = []; for (let i = 0; i < 49; i++) { const p = await mk('m' + i); await q('update "Users" set "therapistId"=$1 where id=$2', [A.id, p.id]); for (let k = 0; k < 10; k++) await q('insert into "MoodLogs" ("UserId", date, checkin_mood, checkout_mood, "createdAt", "updatedAt") values ($1,$2,$3,$4,now(),now())', [p.id, day(k), 1 + (k % 5), 1 + ((k + 2) % 5)]); many.push(p); }
const p95 = async (fn, n = 20) => { const a = []; for (let i = 0; i < n; i++) a.push((await fn()).ms); a.sort((x, y) => x - y); return a[Math.ceil(a.length * .95) - 1]; };
const pl = await p95(() => call('GET', '/api/therapist/pacientes', { t: A.t })), pa = await p95(() => call('GET', '/api/therapist/alerts', { t: A.t })), ph = await p95(() => call('GET', `/api/therapist/pacientes/${many[0].id}/historia`, { t: A.t })), ps = await p95(() => call('GET', '/api/sessions/therapist', { t: A.t }));
check('ES101-R01 con 50 pacientes: lista y alertas p95 < 500 ms; historia p95 < 300 ms (umbrales de ES-93)', pl < 500 && pa < 500 && ph < 300, `lista=${pl.toFixed(0)} alertas=${pa.toFixed(0)} historia=${ph.toFixed(0)} sesiones=${ps.toFixed(0)} ms`);
const conc = await Promise.all(Array.from({ length: 60 }, (_, i) => call('GET', i % 2 ? '/api/therapist/alerts' : '/api/therapist/pacientes', { t: A.t }))); check('ES101-R02 60 peticiones simultáneas del panel con 50 pacientes: sin 5xx (pool de 5 conexiones)', conc.every(r => r.status < 500), `estados=${[...new Set(conc.map(r => r.status))].join(',')} máx=${Math.max(...conc.map(r => r.ms)).toFixed(0)} ms`);
// ── Personas bloqueadas entre muchas: la lista excluye solo a las bloqueadas
for (const p of many.slice(0, 5)) await q('update "Users" set active=false where id=$1', [p.id]); const lst = await call('GET', '/api/therapist/pacientes', { t: A.t }); const ids = JSON.stringify(lst.json); check('ES101-R03 con 5 de las 50 personas inactivas, la lista las excluye y conserva a las otras 44 más las propias activas', many.slice(0, 5).every(p => !ids.includes(`"name":"${p.name}"`)) && many.slice(5).every(p => ids.includes(`"name":"${p.name}"`)), `en lista=${(lst.json?.patients ?? lst.json)?.length}`);
console.log(JSON.stringify({ fin: true })); await db.end();
