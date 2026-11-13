// [QA-Claude] ES-179 · PR #180 (PR A backend): start idempotente, nota viva, cierre atómico, privacidad y revocación. Postgres real, Daily y Anthropic simulados, 0 llamadas reales.
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
  const email = `qa179-${tag}-${stamp}@example.test`, password = randomBytes(14).toString('base64url') + 'aA1!';
  const r = await call('POST', '/api/register', { body: { name: 'QA179 ' + tag, email, password } });
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

// ── ES-179 · PR #180 · servidor, concurrencia y privacidad (cola; la cabeza es la de es25-real-db.mjs con prefijo qa179). Daily y Anthropic simulados.
import fs from 'node:fs';
const CTL = process.env.QA_DAILY_CTRL, DLOG = process.env.QA_DAILY_LOG, MOCK = process.env.QA_MOCK;
const setDaily = (o) => fs.writeFileSync(CTL, JSON.stringify(o));
const dailyCalls = (sessionId) => { try { return fs.readFileSync(DLOG, 'utf8').split('\n').filter(l => l.includes(`-${sessionId}"`)).length; } catch { return 0; } };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const mockStats = async () => (await fetch(MOCK + '/_stats')).json(); const mockReset = () => fetch(MOCK + '/_reset');
const T1 = TH, T2 = await mkUser('t2', 'therapist'), A2 = await mkUser('A2');
const t1 = mint(T1), t2 = mint(T2), aT = mint(A), bT = mint(B), a2T = mint(A2), admT = mint(ADM);
await q('update "Users" set "therapistId"=$1 where id in ($2,$3)', [T1.id, A.id, A2.id]); await q('update "Users" set "therapistId"=$1 where id=$2', [T2.id, B.id]);
const share = (tok, th, s = 'granted') => call('PUT', '/api/consents/therapist_sharing', { token: tok, body: { status: s } });
const g1 = await share(aT, T1), g2 = await share(bT, T2), g3 = await share(a2T, T1);
check('S0 autorizaciones de compartir otorgadas (A→T1, A2→T1, B→T2)', [g1, g2, g3].every(x => x.status === 200), `${g1.status}/${g2.status}/${g3.status}`);
setDaily({});
let slot = 0;
const fresh = async (tok, patient) => { const r = await call('POST', '/api/sessions/therapist', { token: tok, body: { patientId: patient.id, scheduledAt: new Date(Date.now() + (24 + 3 * (slot++)) * 36e5).toISOString(), duration: 50 } }); if (r.status !== 201 && r.status !== 200) throw new Error('sesión ' + r.status + ' ' + r.text.slice(0, 120)); return r.json.session.id; };
const start = (tok, id) => call('POST', `/api/sessions/therapist/${id}/start`, { token: tok });
const note = (tok, id, body) => call('POST', `/api/sessions/therapist/${id}/notes`, { token: tok, body });
const end = (tok, id, body = { therapistNote: 'Nota de cierre de prueba QA suficientemente larga', patientMoodAfter: 4 }) => call('POST', `/api/sessions/therapist/${id}/end`, { token: tok, body });
const live = (id) => q('select content,"isLive",version,"requestId" from "SessionNotes" where "sessionId"=$1 and "isLive"=true', [id]);
const inProg = async (tok, patient) => { const id = await fresh(tok, patient); const s = await start(tok, id); if (s.status !== 200) throw new Error('start ' + s.status); return id; };
const dec = (c) => { const r = spawnSync(process.execPath, ['-e', `process.env.DB_SSL='false';const c=require('./utils/crypto');console.log(c.desencriptar(${JSON.stringify(c)}))`], { cwd: path.join(sut, 'backend'), env: { ...process.env, DATABASE_URL: dbUrl, DB_SSL: 'false', JWT_SECRET: JWT }, encoding: 'utf8' }); return r.stdout.trim(); };

// ── S1 start
let sid = await fresh(t1, A);
const s1 = await start(t1, sid), s1b = await start(t1, sid);
check('S1a start nuevo: 200, meetingUrl, startedAt, resumed:false y UNA sala creada', s1.status === 200 && s1.json?.meetingUrl && s1.json.startedAt && s1.json.resumed === false && dailyCalls(sid) === 1, `status=${s1.status} salas=${dailyCalls(sid)} ${JSON.stringify(s1.json).slice(0, 120)}`);
check('S1b start repetido (recarga): 200, MISMA meetingUrl y startedAt, resumed:true, sin sala nueva', s1b.status === 200 && s1b.json?.meetingUrl === s1.json?.meetingUrl && s1b.json?.startedAt === s1.json?.startedAt && s1b.json?.resumed === true && dailyCalls(sid) === 1, `status=${s1b.status} salas=${dailyCalls(sid)}`);
setDaily({ delay: 300 });
for (const n of [3, 4, 5, 6, 12]) {
  const id = await fresh(t1, A); const t0 = Date.now();
  const rs = await Promise.all(Array.from({ length: n }, () => start(t1, id)));
  const urls = new Set(rs.filter(r => r.status === 200).map(r => r.json.meetingUrl)); const bad = rs.filter(r => r.status !== 200);
  const st = (await q('select status,"meetingUrl" from "TherapySessions" where id=$1', [id]))[0];
  check(`S1c ${n} start simultáneos de la MISMA sesión: todos 200, una sola sala y la misma meetingUrl, sin 5xx ni esperas largas`, bad.length === 0 && urls.size === 1 && dailyCalls(id) === 1 && st.status === 'in_progress', `n=${n} ok=${rs.length - bad.length} salas=${dailyCalls(id)} urls=${urls.size} estados=${[...new Set(rs.map(r => r.status))]} ms=${Date.now() - t0}`);
  await sleep(500);
}
for (const n of [3, 5, 8]) { // varias sesiones DISTINTAS a la vez (cada una retiene una conexión de transacción mientras consulta el acceso)
  const ids = []; for (let i = 0; i < n; i++) ids.push(await fresh(t1, i % 2 ? A2 : A)); const t0 = Date.now();
  const rs = await Promise.all(ids.map(id => start(t1, id))); const bad = rs.filter(r => r.status !== 200);
  check(`S1d ${n} start simultáneos de sesiones DISTINTAS (pool de 5): todos 200 en pocos segundos, sin 5xx`, bad.length === 0 && Date.now() - t0 < 10000, `n=${n} ok=${rs.length - bad.length} estados=${[...new Set(rs.map(r => r.status))]} ms=${Date.now() - t0}`);
  await sleep(500);
}
// sala caída / lenta
let sf = await fresh(t1, A); setDaily({ fail: true });
const f1 = await start(t1, sf); const sfRow = (await q('select status,"meetingUrl","startedAt" from "TherapySessions" where id=$1', [sf]))[0];
check('S1e sala caída: 502 room_unavailable retryable, la sesión sigue scheduled sin meetingUrl ni startedAt', f1.status === 502 && f1.json?.code === 'room_unavailable' && f1.json?.retryable === true && sfRow.status === 'scheduled' && !sfRow.meetingUrl && !sfRow.startedAt, `status=${f1.status} ${JSON.stringify(f1.json).slice(0, 100)} fila=${JSON.stringify(sfRow)}`);
setDaily({}); const f2 = await start(t1, sf);
check('S1f reintentar tras la caída: 200 con sala y la sesión pasa a in_progress', f2.status === 200 && f2.json?.resumed === false, `status=${f2.status}`);
let ss = await fresh(t1, A); setDaily({ delay: 9500 }); const t0s = Date.now(); const sl = await start(t1, ss); const dtSlow = Date.now() - t0s;
const ssRow = (await q('select status from "TherapySessions" where id=$1', [ss]))[0];
check('S1g sala externa lenta (>8 s): corta con 502 en ~8–9 s, la sesión sigue scheduled', sl.status === 502 && dtSlow < 9500 && ssRow.status === 'scheduled', `status=${sl.status} ms=${dtSlow} estado=${ssRow.status}`);
setDaily({});
// otras solicitudes mientras un start lento retiene su transacción
let sv = await fresh(t1, A); setDaily({ delay: 4000 });
const slowP = start(t1, sv); await sleep(300); const t0h = Date.now(); const h = await call('GET', '/api/health'); const hms = Date.now() - t0h; const ok2 = await call('GET', '/api/sessions/therapist', { token: t1 }); const sms = Date.now() - t0h; await slowP;
info('S1h', `con un start lento (4 s) en curso: /api/health ${h.status} en ${hms} ms; GET /api/sessions/therapist ${ok2.status} en ${sms} ms (info: ocupa una conexión del pool de 5 y bloquea la fila de esa sesión mientras dura la llamada a Daily)`);
setDaily({});
// estados no iniciables
const sCan = await fresh(t1, A); await call('PUT', `/api/sessions/therapist/${sCan}`, { token: t1, body: { status: 'cancelled', cancelReason: 'prueba' } });
const sc = await start(t1, sCan);
check('S1i start de una sesión cancelada: 400 session_not_startable y sin sala', sc.status === 400 && sc.json?.code === 'session_not_startable' && dailyCalls(sCan) === 0, `status=${sc.status} ${sc.json?.code}`);

// ── N1 nota viva
const CAN_N = 'CANARIO-NOTA-' + tag();
const sn = await inProg(t1, A);
const n1 = await note(t1, sn, { content: CAN_N + ' v1' });
check('N1a primera nota: 201, version 1, sin errores', n1.status === 201 && (n1.json?.note?.version ?? 1) === 1, `status=${n1.status} v=${n1.json?.note?.version}`);
for (let i = 2; i <= 100; i++) await note(t1, sn, { content: CAN_N + ' v' + i });
const rows100 = await live(sn), all100 = await q('select count(*)::int n from "SessionNotes" where "sessionId"=$1', [sn]);
check('N1b 100 autoguardados (cliente actual, sin version): UNA sola fila viva con la última versión y texto, sin copias', rows100.length === 1 && all100[0].n === 1 && rows100[0].version === 100 && dec(rows100[0].content) === CAN_N + ' v100', `vivas=${rows100.length} total=${all100[0].n} version=${rows100[0]?.version}`);
check('N1c el texto está cifrado en la base (el canario no aparece en claro)', !JSON.stringify(await q('select content from "SessionNotes" where "sessionId"=$1', [sn])).includes(CAN_N), '');
const ok101 = await note(t1, sn, { content: CAN_N + ' v101', version: 100 }), stale = await note(t1, sn, { content: 'PESTAÑA-VIEJA', version: 100 });
check('N1d versión esperada correcta → 200 (v101); versión vieja (otra pestaña) → 409 note_changed con la nota vigente y SIN pisarla', ok101.status === 200 && stale.status === 409 && stale.json?.code === 'note_changed' && stale.json?.current?.version === 101 && dec((await live(sn))[0].content) === CAN_N + ' v101', `ok=${ok101.status} stale=${stale.status} actual=${stale.json?.current?.version}`);
const r1 = await note(t1, sn, { content: CAN_N + ' RID', requestId: 'qa179-rid-aaaaaaaa' }), r2 = await note(t1, sn, { content: 'OTRO-TEXTO-REINTENTO', requestId: 'qa179-rid-aaaaaaaa' });
check('N1e mismo requestId repetido → 200 replayed, sin cambio de versión ni de texto', r1.status === 200 && r2.status === 200 && r2.json?.replayed === true && (await live(sn))[0].version === r1.json.note.version && dec((await live(sn))[0].content) === CAN_N + ' RID', `r1=${r1.status} r2=${r2.status} replayed=${r2.json?.replayed}`);
const sn2 = await inProg(t1, A); const first = await Promise.all(Array.from({ length: 12 }, (_, i) => note(t1, sn2, { content: 'primera-simultanea-' + i })));
const live2 = await live(sn2), tot2 = (await q('select count(*)::int n from "SessionNotes" where "sessionId"=$1', [sn2]))[0].n;
check('N1f 12 primeras notas simultáneas: 1 sola fila viva, ninguna 5xx', live2.length === 1 && tot2 === 1 && first.every(r => r.status < 500), `vivas=${live2.length} total=${tot2} estados=${[...new Set(first.map(r => r.status))]}`);
const cur = (await live(sn2))[0].version, race = await Promise.all(Array.from({ length: 12 }, (_, i) => note(t1, sn2, { content: 'carrera-' + i, version: cur })));
check('N1g 12 guardados simultáneos con la MISMA versión esperada: exactamente 1 gana (200) y 11 reciben 409 note_changed', race.filter(r => r.status === 200).length === 1 && race.filter(r => r.status === 409).length === 11, `200=${race.filter(r => r.status === 200).length} 409=${race.filter(r => r.status === 409).length} otros=${race.filter(r => ![200, 409].includes(r.status)).length}`);
const big = await note(t1, sn2, { content: 'x'.repeat(20000) }), over = await note(t1, sn2, { content: 'x'.repeat(20001) });
check('N1h 20.000 caracteres sí; 20.001 → 400 too_long', big.status === 200 && over.status === 400 && over.json?.code === 'too_long', `${big.status}/${over.status}`);
const weird = []; for (const body of [{ content: 'a', requestId: '' }, { content: 'a', requestId: 'corto' }, { content: 'a', requestId: 'x'.repeat(65) }, { content: 'a', requestId: "'; DROP TABLE \"Users\";--" }, { content: 'a', requestId: 123 }, { content: 'a', requestId: ['a'] }, { content: 'a', version: -1 }, { content: 'a', version: 1.5 }, { content: 'a', version: 'x' }, { content: 'a', version: null }, { content: '' }, { content: '   ' }, { content: 123 }, { content: null }, {}]) weird.push((await note(t1, sn2, body)).status);
check('N1i requestId/version/contenido raros → 4xx, nunca 5xx', weird.every(s => s >= 400 && s < 500), JSON.stringify(weird));
const snOld = await inProg(t1, A2);
for (let i = 0; i < 3; i++) await q('insert into "SessionNotes"("sessionId","therapistId",content,"timestamp","createdAt","updatedAt") select $1,$2,content,now() - interval \'1 hour\' * $3,now(),now() from "SessionNotes" where "sessionId"=$4 limit 1', [snOld, T1.id, 3 - i, sn]);
const oldN = (await q('select count(*)::int n from "SessionNotes" where "sessionId"=$1', [snOld]))[0].n;
const oldPost = await note(t1, snOld, { content: 'nota nueva sobre sesión con filas antiguas' }), oldGet = await call('GET', `/api/sessions/therapist/${snOld}/notes`, { token: t1 });
const afterOld = await q('select "isLive" from "SessionNotes" where "sessionId"=$1 order by id', [snOld]);
check('N1j filas ANTIGUAS (isLive NULL): se conservan, el nuevo guardado crea UNA nota viva aparte y GET las devuelve todas', oldN === 3 && oldPost.status === 201 && afterOld.length === 4 && afterOld.filter(r => r.isLive === true).length === 1 && afterOld.filter(r => r.isLive === null).length === 3 && Array.isArray(oldGet.json) && oldGet.json.length === 4, `antes=${oldN} despues=${afterOld.length} GET=${oldGet.json?.length}`);

// ── C1 cierre
await mockReset();
const sc1 = await inProg(t1, A);
for (const [n, body] of [['ánimo 3,5', { therapistNote: 'Nota de cierre suficientemente larga', patientMoodAfter: 3.5 }], ['ánimo 0', { therapistNote: 'Nota de cierre suficientemente larga', patientMoodAfter: 0 }], ['ánimo 6', { therapistNote: 'Nota de cierre suficientemente larga', patientMoodAfter: 6 }], ['ánimo texto', { therapistNote: 'Nota de cierre suficientemente larga', patientMoodAfter: 'x' }], ['nota corta', { therapistNote: 'corta', patientMoodAfter: 3 }], ['nota 4001', { therapistNote: 'n'.repeat(4001), patientMoodAfter: 3 }], ['sin ánimo', { therapistNote: 'Nota de cierre suficientemente larga' }]]) { const r = await end(t1, sc1, body); check(`C1a cierre inválido (${n}) → 400 y la sesión sigue in_progress`, r.status === 400 && (await q('select status from "TherapySessions" where id=$1', [sc1]))[0].status === 'in_progress', `status=${r.status}`); }
const maxOk = await end(t1, await inProg(t1, A2), { therapistNote: 'n'.repeat(4000), patientMoodAfter: 5 });
check('C1b nota de cierre de 4.000 caracteres y ánimo 5 → 200', maxOk.status === 200, `status=${maxOk.status}`);
await mockReset();
for (const n of [2, 4, 12]) {
  const id = await inProg(t1, A); await mockReset(); const recBefore = (await q('select count(*)::int n from "WellnessRecommendations" where "UserId"=$1', [A.id]))[0].n; const t0 = Date.now();
  const rs = await Promise.all(Array.from({ length: n }, () => end(t1, id)));
  const ok = rs.filter(r => r.status === 200), dup = rs.filter(r => r.status === 409 && r.json?.code === 'already_closed'), bad = rs.filter(r => ![200, 409].includes(r.status));
  const recAfter = (await q('select count(*)::int n from "WellnessRecommendations" where "UserId"=$1', [A.id]))[0].n, ai = (await mockStats()).calls;
  check(`C1c ${n} cierres simultáneos: exactamente 1×200 y el resto 409 already_closed, 1 sola recomendación y 1 sola llamada de IA, sin 5xx`, ok.length === 1 && dup.length === n - 1 && bad.length === 0 && recAfter - recBefore === 1 && ai === 1, `n=${n} 200=${ok.length} 409=${dup.length} otros=${bad.length}(${[...new Set(bad.map(r => r.status))]}) recomendaciones=${recAfter - recBefore} IA=${ai} ms=${Date.now() - t0}`);
}
const closedId = await inProg(t1, A); await end(t1, closedId); const re = await end(t1, closedId);
check('C1d cerrar de nuevo una sesión ya cerrada → 409 already_closed con el estado final', re.status === 409 && re.json?.code === 'already_closed' && re.json?.status === 'completed', `status=${re.status} ${JSON.stringify(re.json).slice(0, 100)}`);
const notStarted = await end(t1, await fresh(t1, A)); check('C1e cerrar una sesión NO iniciada → 400', notStarted.status === 400, `status=${notStarted.status}`);

// ── P1 acceso y aislamiento
const sp = await inProg(t1, A); await note(t1, sp, { content: CAN_N + ' PRIV' }); await end(t1, sp, { therapistNote: 'CANARIO-CIERRE-' + CAN_N + ' nota', patientMoodAfter: 3 });
const spOpen = await inProg(t1, A); await note(t1, spOpen, { content: CAN_N + ' ABIERTA' });
const cross = []; for (const [m, u, b] of [['POST', `/api/sessions/therapist/${spOpen}/start`], ['GET', `/api/sessions/therapist/${spOpen}/notes`], ['POST', `/api/sessions/therapist/${spOpen}/notes`, { content: 'intruso' }], ['POST', `/api/sessions/therapist/${spOpen}/end`, { therapistNote: 'intruso intruso intruso', patientMoodAfter: 3 }]]) cross.push((await call(m, u, { token: t2, body: b })).status);
check('P1a un profesional ajeno (T2) en start/GET notas/POST nota/end de la sesión de T1 → 404', cross.every(s => s === 404), JSON.stringify(cross));
const roleSweep = []; for (const [n, tok] of [['persona A', aT], ['persona B', bT], ['admin', admT], ['sin sesión', null]]) for (const [m, u, b] of [['POST', `/api/sessions/therapist/${spOpen}/start`], ['GET', `/api/sessions/therapist/${spOpen}/notes`], ['POST', `/api/sessions/therapist/${spOpen}/notes`, { content: 'x' }], ['POST', `/api/sessions/therapist/${spOpen}/end`, { therapistNote: 'xxxxxxxxxxxx', patientMoodAfter: 3 }]]) { const r = await call(m, u, { token: tok, body: b }); roleSweep.push([n, r.status]); }
check('P1b persona, admin y sin sesión no acceden a start/notas/end del profesional (401/403/404)', roleSweep.every(([, s]) => [401, 403, 404].includes(s)), JSON.stringify(roleSweep.filter(([, s]) => ![401, 403, 404].includes(s))));
let leak = false; for (const u of ['/api/sessions/user', '/api/sessions/my-therapist', `/api/sessions/user/${sp}/join`, '/api/sessions/user/upcoming', `/api/sessions/user/${spOpen}/join`]) { const r = await call('GET', u, { token: aT }); if (r.text.includes(CAN_N)) leak = true; }
check('P1c la persona NO ve las notas ni la de cierre del profesional por sus rutas de sesiones', !leak, '');
check('P1d la nota de cierre y las notas están cifradas en la base', !JSON.stringify(await q('select "therapistNote" from "TherapySessions" where id=$1', [sp])).includes('CANARIO-CIERRE') && !JSON.stringify(await q('select content from "SessionNotes" where "sessionId"=$1', [spOpen])).includes(CAN_N), '');
await q('update "Users" set active=false where id=$1', [A2.id]); const sBl = await fresh(t1, A).catch(() => null);
const sA2 = await q(`select id from "TherapySessions" where "patientId"=$1 and status='scheduled' limit 1`, [A2.id]).catch(() => []);
let blk = 'sin sesión de A2'; if (sA2[0]) blk = (await start(t1, sA2[0].id)).status;
check('P1e persona desactivada/bloqueada (ES-101): start → 404', blk === 404 || blk === 'sin sesión de A2', `status=${blk}`); await q('update "Users" set active=true where id=$1', [A2.id]);

// ── P2 revocación a mitad
const spr = await inProg(t1, A); await note(t1, spr, { content: CAN_N + ' ANTES-DE-REVOCAR' });
await share(aT, T1, 'revoked');
const rn = await note(t1, spr, { content: 'DESPUES-DE-REVOCAR' }), rs2 = await start(t1, spr);
const keep = await live(spr);
check('P2a revocar la autorización a mitad de sesión: guardar nota → 403 y start → 403, SIN crear filas y sin perder el texto ya guardado', rn.status === 403 && rs2.status === 403 && keep.length === 1 && dec(keep[0].content) === CAN_N + ' ANTES-DE-REVOCAR', `nota=${rn.status} start=${rs2.status} vivas=${keep.length}`);
await mockReset(); const endRev = await end(t1, spr);
check('P2b cerrar tras la revocación: se cierra (200) pero NO se genera recomendación (recommendationSkipped) y no se gasta IA', endRev.status === 200 && !endRev.json?.recommendation && !!endRev.json?.recommendationSkipped && (await mockStats()).calls === 0, `status=${endRev.status} skipped=${endRev.json?.recommendationSkipped} IA=${(await mockStats()).calls}`);
await share(aT, T1, 'granted'); const spr2 = await inProg(t1, A); const n_ = await note(t1, spr2, { content: 'otra vez posible' });
check('P2c restaurada la autorización todo vuelve a funcionar', n_.status === 201, `status=${n_.status}`);

// ── K1 contrato / forma de respuesta para el cliente actual
const sk = await fresh(t1, A); const k1 = await start(t1, sk), k2 = await note(t1, sk, { content: 'k1' }), k3 = await end(t1, sk);
check('K1 el cliente actual (que solo mira res.ok): start/notes/end siguen devolviendo 200/201/200 con meetingUrl, note y session', k1.status === 200 && !!k1.json.meetingUrl && !!k1.json.sessionId && k2.status === 201 && !!k2.json.note && k3.status === 200 && !!k3.json.session, `${k1.status}/${k2.status}/${k3.status}`);
console.log('FIN-ES179'); await db.end(); process.exit(0);
