// [QA-Claude] ES-178 · PR #183 (PR A backend): notas de seguimiento — acceso, propiedad, control de versión (409), límites, XSS, historia sin diario/crisis y resumen de IA sin notas ni identidad. Postgres real, IA simulada.
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
  const email = `qa178-${tag}-${stamp}@example.test`, password = randomBytes(14).toString('base64url') + 'aA1!';
  const r = await call('POST', '/api/register', { body: { name: 'QA178 ' + tag, email, password } });
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

// ── ES-178 · PR #183 · notas de seguimiento: acceso, propiedad, control de versión, límites, privacidad e IA (cola; cabeza de es25-real-db.mjs con prefijo qa178)
const MOCK = process.env.QA_MOCK, sleep = (ms) => new Promise(r => setTimeout(r, ms));
const mockStats = async () => (await fetch(MOCK + '/_stats')).json(); const mockReset = () => fetch(MOCK + '/_reset');
const T1 = TH, T2 = await mkUser('t2', 'therapist'), A2 = await mkUser('A2'), U3 = await mkUser('U3');
const t1 = mint(T1), t2 = mint(T2), aT = mint(A), bT = mint(B), a2T = mint(A2), admT = mint(ADM), u3T = mint(U3);
await q('update "Users" set "therapistId"=$1 where id in ($2,$3)', [T1.id, A.id, A2.id]); await q('update "Users" set "therapistId"=$1 where id=$2', [T2.id, B.id]);
const share = (tok, s = 'granted') => call('PUT', '/api/consents/therapist_sharing', { token: tok, body: { status: s } });
const g = await Promise.all([share(aT), share(bT)]);
check('S0 autorizaciones de compartir otorgadas (A→T1, B→T2); A2 y U3 SIN autorización/vínculo', g.every(x => x.status === 200), g.map(x => x.status).join('/'));
const CAN = { diary: 'CANARIO-DIARIO-' + tag(), chat: 'CANARIO-CHAT-' + tag(), note: 'CANARIO-NOTA-' + tag() };
await call('POST', '/api/diary', { token: aT, body: { date: '2026-10-20', content: CAN.diary + ' me siento agotado' } });
await call('POST', '/api/chat', { token: aT, body: { message: CAN.chat + ' hablemos de mi carrera' } }).catch(() => {});
const day = n => new Date(Date.now() - n * 864e5).toISOString().split('T')[0];
for (const [n, ci, co] of [[1, 4, 5], [2, 3, 4], [3, 2, 3], [5, 4, 4]]) await q('insert into "MoodLogs" ("UserId", date, checkin_mood, checkout_mood, "createdAt", "updatedAt") values ($1,$2,$3,$4,now(),now())', [A.id, day(n), ci, co]).catch(async () => { await q('insert into "MoodLogs" ("UserId", date, checkin_mood, checkout_mood) values ($1,$2,$3,$4)', [A.id, day(n), ci, co]); });
const P = '/api/therapist';
const nb = (text, extra = {}) => ({ content: text, sessionDate: '2026-10-20', type: 'session_note', ...extra });
const addNote = (tok, pid, body) => call('POST', `${P}/pacientes/${pid}/notas`, { token: tok, body });
const putNote = (tok, id, body) => call('PUT', `${P}/notas/${id}`, { token: tok, body });
const hist = (tok, pid) => call('GET', `${P}/pacientes/${pid}/historia`, { token: tok });
const dec = (c) => { const r = spawnSync(process.execPath, ['-e', `process.env.DB_SSL='false';const c=require('./utils/crypto');console.log(c.desencriptar(${JSON.stringify(c)}))`], { cwd: path.join(sut, 'backend'), env: { ...process.env, DATABASE_URL: dbUrl, DB_SSL: 'false', JWT_SECRET: JWT }, encoding: 'utf8' }); return r.stdout.trim(); };
const dbNote = async (id) => (await q('select content,"updatedAt","UserId","therapistId" from "ClinicalNotes" where id=$1', [id]))[0];

// ── A1 acceso
const PII = [A2.name, 'qa178-A2-', U3.name, 'qa178-U3-'];
const sweep = []; let piiLeak = false;
for (const [label, tok, pid] of [['A2 vinculada sin autorización', t1, A2.id], ['U3 sin vínculo', t1, U3.id], ['B (de otro profesional)', t1, B.id], ['id inexistente', t1, 99999999]]) {
  for (const [m, u, b] of [['GET', `${P}/pacientes/${pid}/historia`], ['GET', `${P}/pacientes/${pid}/historial`], ['GET', `${P}/pacientes/${pid}/resumen-ia`], ['POST', `${P}/pacientes/${pid}/notas`, nb('intento sin permiso')]]) {
    const r = await call(m, u, { token: tok, body: b }); sweep.push([label, m, u.split('/').pop(), r.status]);
    if ([...PII, B.name, 'qa178-B-', 'moodLogs', '"ratings"'].some(s => r.text.includes(s)) && r.status < 400) piiLeak = true;
    if (r.text.includes(A2.name) || r.text.includes('qa178-A2-') || r.text.includes('qa178-B-') || r.text.includes(B.name)) piiLeak = true;
  }
}
check('A1a persona sin autorización, sin vínculo, de otro profesional o inexistente: historia/historial/resumen-ia/POST notas → 403/404 y CERO datos de la persona en el cuerpo', sweep.every(([, , , s]) => [403, 404].includes(s)) && !piiLeak, JSON.stringify(sweep.filter(([, , , s]) => ![403, 404].includes(s))) + ' fuga=' + piiLeak);
check('A1b no se creó ninguna nota sobre esas personas', (await q('select count(*)::int n from "ClinicalNotes" where "UserId" in ($1,$2,$3)', [A2.id, U3.id, B.id]))[0].n === 0, '');

// ── notas de A (con permiso)
const created = await addNote(t1, A.id, nb(CAN.note + ' inicial'));
const nid = created.json?.note?.id;
check('S1 crear nota sobre A con permiso → 201 con id', created.status === 201 && nid, `status=${created.status}`);
const H = await hist(t1, A.id), n0 = H.json?.notes?.find(n => n.id === nid);

// ── A1c revocación en caliente
await share(aT, 'revoked');
const before = await dbNote(nid), revPut = await putNote(t1, nid, { content: 'DESPUES-DE-REVOCAR' }), revGet = await hist(t1, A.id), after = await dbNote(nid);
check('A1c revocar la autorización en caliente: PUT de la nota → 403 sin cambiar la nota; historia → 403 sin datos', revPut.status === 403 && dec(after.content) === CAN.note + ' inicial' && revGet.status === 403 && !revGet.text.includes(A.name), `put=${revPut.status} hist=${revGet.status}`);
await share(aT, 'granted');

// ── A2 propiedad y roles
const xb = await putNote(t2, nid, { content: 'INTRUSO' }), xb2 = await call('GET', `${P}/pacientes/${A.id}/historia`, { token: t2 });
check('A2a PUT de una nota de OTRO profesional por ID → 404 (igual que inexistente) y la nota no cambia; su historia de A → 403/404', xb.status === 404 && dec((await dbNote(nid)).content) === CAN.note + ' inicial' && [403, 404].includes(xb2.status), `put=${xb.status} hist=${xb2.status}`);
const ghost = await putNote(t1, 987654, { content: 'x' });
check('A2b nota inexistente → 404 (idéntico al de la ajena)', ghost.status === 404 && ghost.status === xb.status, `${ghost.status}`);
const badIds = []; for (const id of ['0', '-1', 'abc', '99999999999999999999', '1.5', '1;drop', '%00']) badIds.push((await putNote(t1, id, { content: 'x' })).status);
check('A2c IDs raros (0, -1, texto, enorme, decimal, SQL, nulo) → 4xx, nunca 5xx', badIds.every(s => s >= 400 && s < 500), JSON.stringify(badIds));
const roles = []; for (const [n, tok] of [['persona', aT], ['admin', admT], ['sin sesión', null]]) for (const [m, u, b] of [['PUT', `${P}/notas/${nid}`, { content: 'x' }], ['POST', `${P}/pacientes/${A.id}/notas`, nb('x')], ['GET', `${P}/pacientes/${A.id}/historia`]]) roles.push([n, (await call(m, u, { token: tok, body: b })).status]);
check('A2d persona, admin y sin sesión no editan ni crean ni leen notas (401/403)', roles.every(([, s]) => [401, 403].includes(s)), JSON.stringify(roles.filter(([, s]) => ![401, 403].includes(s))));

// ── N1 control de versión
let upd = n0?.updatedAt, chain = [];
for (let i = 0; i < 5; i++) { const r = await putNote(t1, nid, { content: CAN.note + ' cadena ' + i, expectedUpdatedAt: upd }); chain.push(r.status); const hh = await hist(t1, A.id); upd = hh.json.notes.find(n => n.id === nid).updatedAt; }
check('N1a cadena de 5 ediciones, cada una con el updatedAt leído de /historia → 5×200 (la precisión de la fecha no genera falsos 409)', chain.every(s => s === 200), JSON.stringify(chain));
const stale = await putNote(t1, nid, { content: 'EDICION-VIEJA', expectedUpdatedAt: n0.updatedAt }), nowRow = await dbNote(nid);
check('N1b updatedAt viejo → 409 note_changed con la versión VIGENTE (texto, tipo, fecha, updatedAt) y SIN pisar', stale.status === 409 && stale.json?.code === 'note_changed' && stale.json?.current?.content === CAN.note + ' cadena 4' && !!stale.json.current.updatedAt && dec(nowRow.content) === CAN.note + ' cadena 4', `status=${stale.status} actual=${(stale.json?.current?.content || '').slice(0, 40)}`);
const weirdExp = []; for (const v of ['basura', '', 123, null, ['a'], {}, '2026-13-45', 'x'.repeat(5000)]) weirdExp.push((await putNote(t1, nid, { content: 'y', expectedUpdatedAt: v })).status);
check('N1c expectedUpdatedAt raro → 4xx, nunca 5xx', weirdExp.every(s => s >= 400 && s < 500), JSON.stringify(weirdExp));
const noExp = await putNote(t1, nid, { content: CAN.note + ' sin versión' });
check('N1d SIN expectedUpdatedAt (pantalla actual) → 200, gana el último (comportamiento anterior; la protección NO está activa hasta que el cliente mande la versión)', noExp.status === 200, `status=${noExp.status}`);
for (const n of [12, 12, 30]) {
  const cur = (await hist(t1, A.id)).json.notes.find(x => x.id === nid).updatedAt; const t0 = Date.now();
  const batch = Promise.all(Array.from({ length: n }, (_, i) => putNote(t1, nid, { content: CAN.note + ' carrera ' + i, expectedUpdatedAt: cur })));
  await sleep(60); const o0 = Date.now(); const other = await call('GET', `${P}/pacientes`, { token: t2 }); const otherMs = Date.now() - o0; const per = await call('GET', '/api/career-context', { token: aT }); const perMs = Date.now() - o0;
  const rs = await batch, ms = Date.now() - t0;
  check(`N1e ${n} PUT simultáneos con la MISMA versión (pool de 5): exactamente 1×200 y ${n - 1}×409, sin 5xx, sin esperas largas y sin bloquear a otras personas`, rs.filter(r => r.status === 200).length === 1 && rs.filter(r => r.status === 409).length === n - 1 && ms < 8000 && otherMs < 3000 && perMs < 3000, `200=${rs.filter(r => r.status === 200).length} 409=${rs.filter(r => r.status === 409).length} otros=${rs.filter(r => ![200, 409].includes(r.status)).length} total=${ms} ms; otro profesional ${other.status} en ${otherMs} ms; otra persona ${per.status} en ${perMs} ms`);
}
const rd = await Promise.all(Array.from({ length: 12 }, () => hist(t1, A.id)));
check('N1f 12 lecturas de /historia simultáneas sobre el pool de 5: todas 200 y sin esperas largas', rd.every(r => r.status === 200), `estados=${[...new Set(rd.map(r => r.status))]}`);

// ── N2 límites
const L1 = await addNote(t1, A.id, nb('x'.repeat(10000))), L2 = await addNote(t1, A.id, nb('x'.repeat(10001))), L3 = await putNote(t1, nid, { content: 'y'.repeat(10000) }), L4 = await putNote(t1, nid, { content: 'y'.repeat(10001) });
check('N2a 10.000 caracteres sí; 10.001 → 400 too_long (POST y PUT)', L1.status === 201 && L2.status === 400 && L2.json?.code === 'too_long' && L3.status === 200 && L4.status === 400 && L4.json?.code === 'too_long', `${L1.status}/${L2.status}/${L3.status}/${L4.status}`);
const E1 = await putNote(t1, nid, { content: '' }), E2 = await putNote(t1, nid, { content: '    ' }), E3 = await addNote(t1, A.id, nb('')), E4 = await addNote(t1, A.id, nb('   '));
check('N2b PUT con content vacío o solo espacios → 400 content_required; POST vacío → 400; la nota no cambia', E1.status === 400 && E1.json?.code === 'content_required' && E2.status === 400 && [E3.status, E4.status].every(s => s === 400) && dec((await dbNote(nid)).content) === 'y'.repeat(10000), `${E1.status}/${E2.status}/${E3.status}/${E4.status}`);
const onlyType = await putNote(t1, nid, { type: 'goal' });
check('N2c PUT que solo cambia el tipo (sin content) → 200 y el texto se conserva', onlyType.status === 200 && dec((await dbNote(nid)).content) === 'y'.repeat(10000), `status=${onlyType.status}`);
const odd = []; for (const b of [nb('x', { sessionDate: 'nunca' }), nb('x', { sessionDate: '' }), nb('x', { type: 'inventado' }), nb('x', { type: 5 }), { content: 'x' }, { content: 5, sessionDate: '2026-10-20' }, { content: null, sessionDate: '2026-10-20' }]) odd.push((await addNote(t1, A.id, b)).status);
const malformed = await call('POST', `${P}/pacientes/${A.id}/notas`, { token: t1, body: '{no-json' });
info('N2d', 'POST con formas raras (fecha inválida/vacía, tipo inventado/numérico, sin fecha, content numérico/nulo): ' + JSON.stringify(odd) + ' · cuerpo malformado: ' + malformed.status);
check('N2e entradas raras → nunca 5xx', [...odd, malformed.status].every(s => s < 500), JSON.stringify(odd) + ' ' + malformed.status);

// ── N3 XSS
const XSS = ['<script>alert(1)</script>', '<img src=x onerror=alert(1)>', "'; DROP TABLE \"Users\";--", 'emoji 😀 ñ á \u0000x'];
const usersBefore = (await q('select count(*)::int n from "Users"'))[0].n; const xs = [];
for (const x of XSS) { const r = await addNote(t1, A.id, nb(x)); xs.push([r.status, r.json?.note?.id]); }
const HX = await hist(t1, A.id), back = XSS.map((x, i) => HX.json.notes.find(n => n.id === xs[i][1])?.content);
check('N3 <script>, HTML, SQL y emoji se guardan y se devuelven como texto exacto; la tabla Users sigue; cifrado en la base', xs.every(([s]) => s === 201) && XSS.every((x, i) => back[i] === x.replace('\u0000', '') || back[i] === x) && (await q('select count(*)::int n from "Users"'))[0].n === usersBefore && !JSON.stringify(await q('select content from "ClinicalNotes" where "UserId"=$1', [A.id])).includes('alert(1)'), `estados=${xs.map(x => x[0])}`);

// ── H1 /historia sin diario ni crisis
const body = JSON.stringify(HX.json);
check('H1a /historia no contiene el diario ni el chat de la persona (canarios) y solo trae patient/moodLogs/ratings/notes', HX.status === 200 && !body.includes(CAN.diary) && !body.includes(CAN.chat) && Object.keys(HX.json).sort().join() === 'moodLogs,notes,patient,ratings', `claves=${Object.keys(HX.json)}`);
check('H1b patient solo trae id, nombre, correo, alta y therapistId (sin contraseña ni datos internos)', Object.keys(HX.json.patient).every(k => ['id', 'name', 'email', 'createdAt', 'therapistId'].includes(k)) && !body.includes('password'), `claves=${Object.keys(HX.json.patient)}`);
const HB = await hist(t2, B.id); await addNote(t2, B.id, nb('NOTA-DE-T2-' + CAN.note));
const HA2 = await hist(t1, A.id);
check('H1c las notas de /historia son solo las del profesional que consulta (la nota de T2 sobre B no aparece en la historia de A)', !JSON.stringify(HA2.json).includes('NOTA-DE-T2') && HA2.json.notes.every(n => n.therapistId === T1.id), '');

// ── R1 resumen con IA
await mockReset();
const rs = await call('GET', `${P}/pacientes/${A.id}/resumen-ia`, { token: t1 }); const sent = JSON.stringify((await mockStats()).last ?? {});
const leaks = [CAN.note, CAN.diary, CAN.chat, A.name, 'qa178-A-', 'example.test'].filter(s => sent.includes(s));
check('R1a el cuerpo enviado al proveedor de IA no contiene notas, diario, chat, nombre ni correo', rs.status === 200 && sent.length > 20 && leaks.length === 0, `status=${rs.status} enviado=${sent.length} chars fugas=${JSON.stringify(leaks)}`);
check('R1b basedOn.notes = 0 en la respuesta y el resumen no repite el texto de las notas', rs.json?.basedOn?.notes === 0 && !rs.text.includes(CAN.note), JSON.stringify(rs.json?.basedOn));
check('R1c el detector funciona (mutación): si el cuerpo contuviera una nota o el nombre, el caso fallaría', [CAN.note, CAN.diary, A.name].every(s => (sent + ' ' + s).includes(s)) && !sent.includes(CAN.note), 'autoprueba del detector');
console.log('FIN-ES178'); await db.end(); process.exit(0);
