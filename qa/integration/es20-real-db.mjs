// [QA-Claude] ES-20 · conversaciones y diario privados, contra Postgres REAL (base local de ES-80) y proveedor simulado.
// Uso: QA_SUT=<clon> QA_API=http://127.0.0.1:8097 QA_MOCK=http://127.0.0.1:9911 DATABASE_URL=<base> DATA_ENCRYPTION_KEY=<la del servidor> node qa/integration/es20-real-db.mjs
// Solo datos sintéticos. No se imprimen contraseñas ni tokens.
import { createRequire } from 'node:module';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const sut = process.env.QA_SUT, api = process.env.QA_API, mock = process.env.QA_MOCK, dbUrl = process.env.DATABASE_URL;
if (!sut || !api || !mock || !dbUrl) throw new Error('Defina QA_SUT, QA_API, QA_MOCK y DATABASE_URL.');
const req = createRequire(path.join(sut, 'backend', 'package.json'));
const { Client } = req('pg');
const db = new Client({ connectionString: dbUrl, ssl: false }); await db.connect();
const results = []; let failed = 0;
const check = (id, ok, detail = '') => { results.push({ id, ok, detail }); if (!ok) failed++; console.log(JSON.stringify({ id, ok, detail })); };
const info = (id, detail) => console.log(JSON.stringify({ id, info: detail }));
const call = async (method, url, { token, body } = {}) => {
  const h = {}; if (token) h.Authorization = 'Bearer ' + token; if (body !== undefined) h['Content-Type'] = 'application/json';
  const t0 = performance.now();
  const r = await fetch(api + url, { method, headers: h, body: body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body)) });
  const text = await r.text(); let json = null; try { json = JSON.parse(text); } catch { /* no JSON */ }
  return { status: r.status, json, ms: performance.now() - t0, size: text.length };
};
const stats = async () => (await (await fetch(mock + '/_stats')).json());
const reset = async () => fetch(mock + '/_reset');
const stamp = Date.now();
const mkUser = async (tag, role = 'user') => {
  const email = `qa-${tag}-${stamp}@example.test`, password = randomBytes(14).toString('base64url') + 'aA1!';
  if ((await call('POST', '/api/register', { body: { name: 'QA ' + tag, email, password } })).status !== 201) throw new Error('registro ' + tag);
  if (role !== 'user') await db.query('update "Users" set role=$1 where email=$2', [role, email]);
  const id = (await db.query('select id from "Users" where email=$1', [email])).rows[0].id;
  const tok = async () => (await call('POST', '/api/login', { body: { email, password } })).json.token;
  return { tag, id, tok };
};
const q = async (sql, p = []) => (await db.query(sql, p)).rows;
const count = async (table, uid) => (await q(`select count(*)::int n from "${table}" where "UserId"=$1`, [uid]))[0].n;
const rid = () => 'qa' + randomBytes(8).toString('hex');

const need = ['ChatTurns', 'DiaryEntries', 'DerivedInvalidations'];
const have = (await q("select table_name from information_schema.tables where table_schema='public'")).map(r => r.table_name);
check('REAL-T01 tablas nuevas creadas por sync()', need.every(t => have.includes(t)), JSON.stringify(need.map(t => [t, have.includes(t)])));
const uq = await q("select indexdef from pg_indexes where tablename='ChatTurns'");
check('REAL-T02 restricción única de ChatTurns (UserId, requestId)', uq.some(i => /UNIQUE/i.test(i.indexdef) && /UserId/.test(i.indexdef) && /requestId/.test(i.indexdef)));

const A = await mkUser('A'); const B = await mkUser('B'); const ADM = await mkUser('adm', 'admin'); const TER = await mkUser('ter', 'therapist'); const SU = await mkUser('su', 'superadmin'); const BRD = await mkUser('brd', 'board');
const a = await A.tok(), b = await B.tok(), adm = await ADM.tok(), ter = await TER.tok(), su = await SU.tok(), brd = await BRD.tok();

// ── F01 · turno atómico ───────────────────────────────────────────────────────
await reset();
let r = await call('POST', '/api/chat', { token: a, body: { message: 'Hola, primer mensaje sintético' } });
let s = await stats();
check('ES20-F01a chat correcto: 200, 1 llamada al proveedor y 2 mensajes guardados', r.status === 200 && typeof r.json.reply === 'string' && s.calls === 1 && await count('Messages', A.id) === 2, `status=${r.status} llamadas=${s.calls} mensajes=${await count('Messages', A.id)}`);
const before = await count('Messages', A.id);
r = await call('POST', '/api/chat', { token: a, body: { message: 'esto debe fallar __FAIL__' } });
check('ES20-F01b fallo del proveedor: 502 reintentable y SIN mensaje huérfano', r.status === 502 && r.json.retryable === true && typeof r.json.reply === 'string' && await count('Messages', A.id) === before, `status=${r.status} retryable=${r.json?.retryable} mensajes=${await count('Messages', A.id)} (antes ${before})`);
const idF = rid();
r = await call('POST', '/api/chat', { token: a, body: { message: 'reintento __FAILTWICE__', requestId: idF } });
const st1 = await call('GET', `/api/chat/turns/${idF}`, { token: a });
const msgsAfterFail = await count('Messages', A.id);
r = await call('POST', '/api/chat', { token: a, body: { message: 'reintento __FAILTWICE__', requestId: idF } });
check('ES20-F01c turno fallido queda "failed/retryable" y el reintento con el mismo requestId funciona', st1.json?.status === 'failed' && st1.json?.retryable === true && r.status === 200 && await count('Messages', A.id) === msgsAfterFail + 2, `estadoTrasFallo=${st1.json?.status} reintento=${r.status}`);

// ── F02 · idempotencia y concurrencia ────────────────────────────────────────
await reset();
const R1 = rid(); const base = await count('Messages', A.id);
const first = await call('POST', '/api/chat', { token: a, body: { message: 'mensaje idempotente', requestId: R1 } });
const rep = await call('POST', '/api/chat', { token: a, body: { message: 'mensaje idempotente', requestId: R1 } });
s = await stats();
check('ES20-F02a repetir el mismo requestId: misma respuesta, sin segunda llamada ni mensajes duplicados', first.status === 200 && rep.status === 200 && rep.json.replayed === true && rep.json.reply === first.json.reply && s.calls === 1 && await count('Messages', A.id) === base + 2, `repetido=${rep.json?.replayed} llamadas=${s.calls}`);
const reuse = await call('POST', '/api/chat', { token: a, body: { message: 'OTRO mensaje', requestId: R1 } });
check('ES20-F02b mismo requestId con otro mensaje → 409 request_id_reuse', reuse.status === 409 && reuse.json?.code === 'request_id_reuse', `status=${reuse.status}`);
await reset(); const R2 = rid(); const base2 = await count('Messages', A.id);
const conc = await Promise.all(Array.from({ length: 12 }, () => call('POST', '/api/chat', { token: a, body: { message: 'concurrente __SLOW__', requestId: R2 } })));
await new Promise(r2 => setTimeout(r2, 300)); s = await stats();
const ok200 = conc.filter(x => x.status === 200 && !x.json.replayed).length; const c409 = conc.filter(x => x.status === 409).length; const other = conc.filter(x => ![200, 409].includes(x.status)).map(x => x.status);
check('ES20-F02c 12 envíos simultáneos del mismo requestId: UNA llamada al proveedor, un solo par de mensajes, sin 5xx', s.calls === 1 && await count('Messages', A.id) === base2 + 2 && other.length === 0 && ok200 === 1, `200 originales=${ok200} 409=${c409} otros=${JSON.stringify(other)} llamadas=${s.calls}`);
// turno pendiente vencido (>2 min): se puede reintentar
const R3 = rid();
await q('insert into "ChatTurns" ("UserId","requestId",status,"userContent","createdAt","updatedAt") values ($1,$2,\'pending\',$3,now() - interval \'5 minutes\', now() - interval \'5 minutes\')', [A.id, R3, 'v2:00:00:00']);
const vencidoGet = await call('GET', `/api/chat/turns/${R3}`, { token: a });
check('ES20-F02d turno pendiente vencido se informa como reintentable', vencidoGet.json?.status === 'pending' && vencidoGet.json?.retryable === true, JSON.stringify(vencidoGet.json));
// exploratorio: reclamo de un turno "vencido" que en realidad sigue en curso (el proveedor puede tardar hasta ~2 min)
await reset(); const R4 = rid(); const base4 = await count('Messages', A.id);
const slow = call('POST', '/api/chat', { token: a, body: { message: 'lento __SLOW__ exploratorio', requestId: R4 } });
await new Promise(r2 => setTimeout(r2, 400));
await q('update "ChatTurns" set "updatedAt" = now() - interval \'5 minutes\' where "requestId"=$1', [R4]);
const retry = await call('POST', '/api/chat', { token: a, body: { message: 'lento __SLOW__ exploratorio', requestId: R4 } });
await slow; s = await stats();
const dupMsgs = (await count('Messages', A.id)) - base4;
info('ES20-X01 (exploratorio) turno marcado vencido mientras el original sigue en curso', `reintento=${retry.status} llamadas=${s.calls} mensajesNuevos=${dupMsgs} (esperado sin duplicar: 2)`);

// ── F03 · historial reciente ──────────────────────────────────────────────────
const H = await mkUser('H'); const h = await H.tok(); await reset();
for (let i = 1; i <= 25; i++) await call('POST', '/api/chat', { token: h, body: { message: `turno-${String(i).padStart(2, '0')}` } });
await call('POST', '/api/chat', { token: h, body: { message: 'turno-26-final' } });
s = await stats(); const sent = s.last.messages;
const firstUser = sent.find(m => m.role === 'user');
check('ES20-F03 el historial enviado son los MÁS RECIENTES (≤ 21), empieza por usuario y termina con el mensaje nuevo', sent.length <= 21 && sent[0].role === 'user' && sent.at(-1).content === 'turno-26-final' && !JSON.stringify(sent).includes('turno-01') && JSON.stringify(sent).includes('turno-25'), `enviados=${sent.length} primero=${JSON.stringify(sent[0]).slice(0, 50)}`);

// ── F04 · diario ──────────────────────────────────────────────────────────────
const MARK = 'MARCA-DIARIO-' + randomBytes(4).toString('hex');
const e1 = await call('POST', '/api/diary', { token: a, body: { date: '2026-10-20', content: MARK + ' primera entrada ñandú 😀' } });
const e2 = await call('POST', '/api/diary', { token: a, body: { date: '2026-10-21', content: 'segunda-entrada-sintetica' } });
const raw = (await q('select content from "DiaryEntries" where id=$1', [e1.json.id]))[0].content;
check('ES20-F04a crear: 201 y el contenido en la base va cifrado v2 (sin texto en claro)', e1.status === 201 && raw.startsWith('v2:') && !raw.includes('MARCA') && !raw.includes('entrada'), `status=${e1.status} prefijo=${raw.slice(0, 3)}`);
const rd = await call('GET', `/api/diary/${e1.json.id}`, { token: a });
check('ES20-F04b leer devuelve el texto original (incluye acentos y emoji)', rd.json?.content === MARK + ' primera entrada ñandú 😀', '');
const ed = await call('PUT', `/api/diary/${e1.json.id}`, { token: a, body: { content: MARK + ' editada' } });
const inv1 = await q('select reason, "sourceType" from "DerivedInvalidations" where "UserId"=$1 and "sourceId"=$2', [A.id, e1.json.id]);
check('ES20-F04c editar registra la invalidación', ed.status === 200 && inv1.some(x => x.reason === 'edited'), JSON.stringify(inv1));
const dl = await call('DELETE', `/api/diary/${e2.json.id}`, { token: a });
const delRow = (await q('select content, "deletedAt" from "DiaryEntries" where id=$1', [e2.json.id]))[0];
const inv2 = await q('select reason from "DerivedInvalidations" where "UserId"=$1 and "sourceId"=$2', [A.id, e2.json.id]);
const cols = (await q("select column_name from information_schema.columns where table_name='DerivedInvalidations'")).map(x => x.column_name);
check('ES20-F04d borrar: deletedAt marcado, contenido vaciado, invalidación sin contenido, ya no se lista ni se lee', dl.status === 200 && delRow.deletedAt && inv2.some(x => x.reason === 'deleted') && !cols.some(c => /content|text|body/i.test(c))
  && (await call('GET', `/api/diary/${e2.json.id}`, { token: a })).status === 404 && !(await call('GET', '/api/diary', { token: a })).json.entries.some(x => x.id === e2.json.id), `columnasInvalidaciones=${cols.join(',')}`);
check('ES20-F04e borrar dos veces → 404 la segunda', (await call('DELETE', `/api/diary/${e2.json.id}`, { token: a })).status === 404);

// ── F05 · contexto por selección explícita ────────────────────────────────────
await reset();
await call('POST', '/api/chat', { token: a, body: { message: 'sin contexto elegido' } });
s = await stats();
check('ES20-F05a sin contextEntryIds el diario NO entra al prompt', !JSON.stringify(s.last).includes('MARCA-DIARIO'), '');
await call('POST', '/api/chat', { token: a, body: { message: 'con contexto', contextEntryIds: [e1.json.id] } });
s = await stats();
check('ES20-F05b con contextEntryIds la entrada elegida entra al prompt (y solo ella)', JSON.stringify(s.last.system).includes('MARCA-DIARIO') && !JSON.stringify(s.last).includes('segunda-entrada'), '');
const callsBefore = (await stats()).calls;
const bEntry = await call('POST', '/api/diary', { token: b, body: { date: '2026-10-22', content: 'privado-de-B' } });
const foreign = await call('POST', '/api/chat', { token: a, body: { message: 'x', contextEntryIds: [bEntry.json.id] } });
const deleted = await call('POST', '/api/chat', { token: a, body: { message: 'x', contextEntryIds: [e2.json.id] } });
const mixed = await call('POST', '/api/chat', { token: a, body: { message: 'x', contextEntryIds: [e1.json.id, bEntry.json.id] } });
check('ES20-F05c entradas ajenas, borradas o mezcladas → 404 sin llamar al proveedor', [foreign, deleted, mixed].every(x => x.status === 404) && (await stats()).calls === callsBefore, `ajena=${foreign.status} borrada=${deleted.status} mezcla=${mixed.status}`);
const many = await call('POST', '/api/chat', { token: a, body: { message: 'x', contextEntryIds: [1, 2, 3, 4] } });
check('ES20-F05d más de 3 entradas → 400', many.status === 400, `status=${many.status}`);

// ── S01 · aislamiento A/B ─────────────────────────────────────────────────────
const aid = e1.json.id; const Rn = rid(); await call('POST', '/api/chat', { token: a, body: { message: 'turno de A', requestId: Rn } });
const sb = [await call('GET', `/api/diary/${aid}`, { token: b }), await call('PUT', `/api/diary/${aid}`, { token: b, body: { content: 'hackeado' } }), await call('DELETE', `/api/diary/${aid}`, { token: b }), await call('GET', `/api/chat/turns/${Rn}`, { token: b })];
const still = (await q('select "deletedAt" from "DiaryEntries" where id=$1', [aid]))[0];
const bList = await call('GET', '/api/diary', { token: b });
const bMsgs = await call('GET', '/api/messages', { token: b });
check('ES20-S01 B no lee, edita ni borra el diario de A ni ve sus turnos (404) y la fila no cambia; sus listas no incluyen lo de A', sb.every(x => x.status === 404) && still.deletedAt === null && bList.json.entries.every(x => x.content === 'privado-de-B') && bMsgs.json.every(m => !String(m.text).includes('turno de A')), `estados=${sb.map(x => x.status)}`);

// ── S02 · ningún rol profesional ve el diario ajeno ──────────────────────────
const roles = { admin: adm, therapist: ter, superadmin: su, board: brd };
const leaks = [];
for (const [name, t] of Object.entries(roles)) {
  const g = await call('GET', `/api/diary/${aid}`, { token: t }); const l = await call('GET', '/api/diary', { token: t });
  if (g.status !== 404) leaks.push(`${name}:GET:${g.status}`); if ((l.json?.entries ?? []).some(x => String(x.content).includes('MARCA'))) leaks.push(`${name}:lista`);
}
const admStats = await call('GET', `/api/admin/usuarios/${A.id}/stats`, { token: adm });
const ownerReaders = spawnSync(process.platform === 'win32' ? 'findstr' : 'grep', process.platform === 'win32' ? ['/S', '/M', '/I', 'DiaryEntry', path.join(sut, 'backend', 'routes', '*.js'), path.join(sut, 'backend', 'utils', '*.js')] : ['-rl', 'DiaryEntry', path.join(sut, 'backend', 'routes'), path.join(sut, 'backend', 'utils')], { encoding: 'utf8' }).stdout.trim().split(/\r?\n/).filter(Boolean).map(x => path.basename(x)).sort();
check('ES20-S02 admin, terapeuta, superadmin y board: 404/lista propia ante el diario de A; las stats del admin no lo exponen; solo chat.js y diary.js leen el diario', leaks.length === 0 && !JSON.stringify(admStats.json ?? {}).includes('MARCA') && JSON.stringify(ownerReaders) === JSON.stringify(['chat.js', 'diary.js']), `fugas=${JSON.stringify(leaks)} lectores=${JSON.stringify(ownerReaders)}`);

// ── S03 · entradas inválidas ─────────────────────────────────────────────────
const bad = {};
const chatBad = { 'requestId corto': { message: 'x', requestId: 'abc' }, 'requestId con símbolos': { message: 'x', requestId: 'abcdefgh!@#$' }, 'requestId objeto': { message: 'x', requestId: { a: 1 } }, 'requestId 65 chars': { message: 'x', requestId: 'a'.repeat(65) },
  'contextEntryIds no arreglo': { message: 'x', contextEntryIds: 'uno' }, 'contextEntryIds negativos': { message: 'x', contextEntryIds: [-1] }, 'contextEntryIds decimales': { message: 'x', contextEntryIds: [1.5] }, 'contextEntryIds texto': { message: 'x', contextEntryIds: ['1'] },
  'message número': { message: 5 }, 'message objeto': { message: { a: 1 } }, 'message vacío': { message: '   ' }, 'sin cuerpo': {} };
for (const [n, body] of Object.entries(chatBad)) bad['chat:' + n] = (await call('POST', '/api/chat', { token: a, body })).status;
const diaryBad = { 'fecha inválida': { date: '2026-02-30', content: 'x' }, 'fecha futura': { date: '2999-01-01', content: 'x' }, 'fecha texto': { date: 'ayer', content: 'x' }, 'fecha SQL': { date: "2026-01-01'; drop table \"Users\";--", content: 'x' }, 'contenido número': { date: '2026-10-20', content: 5 }, 'contenido objeto': { date: '2026-10-20', content: { a: 1 } },
  'contenido > 10000': { date: '2026-10-20', content: 'x'.repeat(10001) }, 'contenido vacío': { date: '2026-10-20', content: '' }, 'sin fecha': { content: 'x' } };
for (const [n, body] of Object.entries(diaryBad)) bad['diario:' + n] = (await call('POST', '/api/diary', { token: a, body })).status;
for (const id of ['0', '-1', '1e3', 'abc', '99999999999', '1.5', '%00', '1;select']) bad['id:' + id] = (await call('GET', `/api/diary/${id}`, { token: a })).status;
for (const lim of ['-5', 'abc', '99999', '0', '1e2']) bad['limit:' + lim] = (await call('GET', `/api/diary?limit=${lim}`, { token: a })).status;
bad['PUT vacío'] = (await call('PUT', `/api/diary/${aid}`, { token: a, body: {} })).status;
bad['JSON roto'] = (await call('POST', '/api/diary', { token: a, body: '{"date": ' })).status;
const notOk = Object.entries(bad).filter(([k, v]) => k.startsWith('limit:') ? ![200, 400].includes(v) : ![400, 404].includes(v));
check('ES20-S03 entradas inválidas: 400/404 (y límites válidos 200), nunca 500', notOk.length === 0, notOk.length ? JSON.stringify(notOk) : `${Object.keys(bad).length} casos`);

// ── S04 · cifrado v2 ──────────────────────────────────────────────────────────
const cryptoPath = path.join(sut, 'backend', 'utils', 'crypto.js');
const cmod = req(cryptoPath);
const enc1 = cmod.encriptarV2('texto secreto ñ 😀'), enc2 = cmod.encriptarV2('texto secreto ñ 😀');
const flip = enc1.slice(0, -2) + (enc1.at(-1) === '0' ? '11' : '00');
let tampered = false, truncated = false, otraClaveFalla = false;
try { cmod.desencriptar(flip); } catch (e) { tampered = e.code === 'decryption_failed' || e.name === 'DecryptionError'; }
try { cmod.desencriptar(enc1.slice(0, 20)); } catch (e) { truncated = true; }
const sp = spawnSync(process.execPath, ['-e', `process.env.DATA_ENCRYPTION_KEY='otra-clave-sintetica-distinta-0000000000'; const c=require(${JSON.stringify(cryptoPath)}); try{ c.desencriptar(${JSON.stringify(enc1)}); console.log('LEYO') }catch(e){ console.log('FALLA') }`], { encoding: 'utf8' });
otraClaveFalla = sp.stdout.trim() === "FALLA";
const legacy = cmod.encriptar('dato heredado');
check('ES20-S04 cifrado v2: ida y vuelta, IV distinto, alterado/truncado/otra clave fallan, el formato heredado se sigue leyendo', cmod.desencriptar(enc1) === 'texto secreto ñ 😀' && enc1 !== enc2 && tampered && truncated && otraClaveFalla && cmod.desencriptar(legacy) === 'dato heredado', `alterado=${tampered} truncado=${truncated} otraClave=${otraClaveFalla}`);
const plain = await q('select count(*)::int n from "ChatTurns" where "userContent" like $1 or "replyContent" like $1', ['%concurrente%']);
check('ES20-S04b ChatTurns sin texto en claro', plain[0].n === 0);

// ── P02 · tamaño y P01 · carga ───────────────────────────────────────────────
const Z = await mkUser('Z'); const z = await Z.tok();
for (let i = 0; i < 200; i++) await call('POST', '/api/diary', { token: z, body: { date: '2026-10-' + String((i % 28) + 1).padStart(2, '0'), content: 'entrada sintética número ' + i + ' ' + 'x'.repeat(200) } });
const dl50 = await call('GET', '/api/diary', { token: z }); const dl100 = await call('GET', '/api/diary?limit=100', { token: z }); const dlBig = await call('GET', '/api/diary?limit=999', { token: z });
check('ES20-P02a diario de 200 entradas: la lista está acotada (50 por defecto, 100 máximo; límites no válidos vuelven a 50)', dl50.json.entries.length === 50 && dl100.json.entries.length === 100 && dlBig.json.entries.length === 100, `50=${dl50.json.entries.length} 100=${dl100.json.entries.length} tope=${dlBig.json.entries.length}`);
info('ES20-P02b tiempos y tamaño', `lista50=${dl50.ms.toFixed(0)}ms/${dl50.size}B lista100=${dl100.ms.toFixed(0)}ms/${dl100.size}B`);
const M = await mkUser('M'); const m = await M.tok(); await reset();
for (let i = 0; i < 250; i++) await call('POST', '/api/chat', { token: m, body: { message: 'mensaje de volumen ' + i } });
const big = await call('GET', '/api/messages', { token: m });
info('ES20-P02c GET /api/messages con 500 mensajes', `${big.json.length} mensajes, ${big.ms.toFixed(0)} ms, ${(big.size / 1024).toFixed(0)} KB (sin paginación)`);

const secs = Number(process.env.QA_LOAD_SECS || 120); const end = Date.now() + secs * 1000; const lat = []; let e5 = 0, n = 0;
const vus = await Promise.all(Array.from({ length: 6 }, async (_, i) => { const u = await mkUser('vu' + i); return { id: u.id, t: await u.tok() }; }));
await reset();
await Promise.all(vus.map(async (vu, i) => { let k = 0; while (Date.now() < end) { const repeat = k % 4 === 3; const requestId = repeat ? vu.last : rid(); const message = repeat ? vu.lastMsg : `carga ${i}-${k}`; if (!repeat) { vu.last = requestId; vu.lastMsg = message; }
  const x = await call('POST', '/api/chat', { token: vu.t, body: { message, requestId } }); lat.push(x.ms); n++; if (x.status >= 500) e5++; k++; } }));
lat.sort((x, y) => x - y); const p = f => lat[Math.min(lat.length - 1, Math.floor(lat.length * f))];
const dupCheck = await q('select count(*)::int n from (select "UserId", "requestId" from "ChatTurns" group by 1,2 having count(*)>1) t');
check('ES20-P01 carga: 6 personas, 2 min, requestId repetidos: 0 errores 5xx, sin turnos duplicados', e5 === 0 && dupCheck[0].n === 0, `peticiones=${n} 5xx=${e5} p50=${p(0.5).toFixed(0)}ms p95=${p(0.95).toFixed(0)}ms máx=${lat.at(-1).toFixed(0)}ms (umbral propuesto p95 ≤ 500 ms)`);
check('ES20-P01b p95 ≤ 500 ms (umbral propuesto)', p(0.95) <= 500, `p95=${p(0.95).toFixed(0)}ms`);

console.log(JSON.stringify({ resumen: { total: results.length, fallos: failed } }));
await db.end(); process.exit(failed ? 1 : 0);
