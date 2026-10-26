// [QA-Claude] ES-22 · presupuesto, fallos y reintentos de IA. Postgres real (ES-80) y proveedor simulado.
// Tres servidores del MISMO commit contra la MISMA base: NONE (sin presupuesto), LIM (límites bajos) y BIG (límites altos para carga).
// Uso: QA_SUT=<clon> QA_NONE=http://127.0.0.1:8095 QA_LIM=http://127.0.0.1:8094 QA_BIG=http://127.0.0.1:8093 QA_MOCK=http://127.0.0.1:9911 DATABASE_URL=<base>
//      LIM: AI_BUDGET_TOKENS_PER_USER=6000 AI_BUDGET_TOKENS_COHORT=20000 AI_BUDGET_PERIOD=day AI_CALL_TIMEOUT_MS=3000 AI_MAX_RETRIES=0
import { createRequire } from 'node:module';
import { randomBytes } from 'node:crypto';
import path from 'node:path';

const sut = process.env.QA_SUT, NONE = process.env.QA_NONE, LIM = process.env.QA_LIM, BIG = process.env.QA_BIG, mock = process.env.QA_MOCK, dbUrl = process.env.DATABASE_URL;
if (![sut, NONE, LIM, BIG, mock, dbUrl].every(Boolean)) throw new Error('Defina QA_SUT, QA_NONE, QA_LIM, QA_BIG, QA_MOCK y DATABASE_URL.');
const req = createRequire(path.join(sut, 'backend', 'package.json'));
const { Client } = req('pg'); const jwt = req('jsonwebtoken'); const JWT = process.env.QA_JWT_SECRET; if (!JWT) throw new Error('Defina QA_JWT_SECRET (el mismo JWT_SECRET de los servidores) para acuñar tokens sin pasar por el limitador de login.'); const budget = req(path.join(sut, 'backend', 'utils', 'aiBudget.js'));
const db = new Client({ connectionString: dbUrl, ssl: false }); await db.connect();
let failed = 0; const check = (id, ok, detail = '') => { if (!ok) failed++; console.log(JSON.stringify({ id, ok, detail })); };
const info = (id, detail) => console.log(JSON.stringify({ id, info: detail }));
const q = async (s, p = []) => (await db.query(s, p)).rows;
const call = async (base, method, url, { token, body } = {}) => { const h = {}; if (token) h.Authorization = 'Bearer ' + token; if (body !== undefined) h['Content-Type'] = 'application/json';
  const t0 = performance.now(); const r = await fetch(base + url, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) }); const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch { /* no JSON */ }
  return { status: r.status, json: j, text: t, ms: performance.now() - t0 }; };
const stats = async () => (await (await fetch(mock + '/_stats')).json()); const reset = () => fetch(mock + '/_reset'); const setText = t => fetch(mock + '/_text?v=' + encodeURIComponent(t));
const stamp = Date.now();
const mkUser = async (tag, role = 'user', base = LIM) => { const email = `qa-${tag}-${stamp}@example.test`, password = randomBytes(14).toString('base64url') + 'aA1!';
  if ((await call(base, 'POST', '/api/register', { body: { name: 'QA ' + tag, email, password } })).status !== 201) throw new Error('registro ' + tag); if (role !== 'user') await db.query('update "Users" set role=$1 where email=$2', [role, email]);
  const id = (await q('select id from "Users" where email=$1', [email]))[0].id; return { id, email, tok: async () => jwt.sign({ id, name: 'QA ' + tag, role, jti: randomBytes(16).toString('hex'), iatMs: Date.now() }, JWT, { expiresIn: '1h' }) }; };
const used = async uid => (await q('select used from "AiBudgetCounters" where "UserId"=$1 order by id desc limit 1', [uid]))[0]?.used ?? 0;
const cohortUsed = async () => (await q('select coalesce(sum(used),0)::int n from "AiBudgetCounters" where "UserId"=0'))[0].n;
const rid = () => 'qa' + randomBytes(8).toString('hex');
const have = (await q("select table_name from information_schema.tables where table_schema='public'")).map(r => r.table_name);
check('REAL-T01 tablas nuevas creadas por sync()', ['AiBudgetCounters', 'AiUsages'].every(t => have.includes(t)), JSON.stringify(['AiBudgetCounters', 'AiUsages'].map(t => [t, have.includes(t)])));
const idx = await q("select indexdef from pg_indexes where tablename='AiBudgetCounters'");
check('REAL-T02 restricción única de AiBudgetCounters (UserId, periodKey)', idx.some(i => /UNIQUE/i.test(i.indexdef) && /UserId/.test(i.indexdef) && /periodKey/.test(i.indexdef)), idx.map(i => i.indexdef).join(' | ').slice(0, 160));

// ── F01 · sin configuración ───────────────────────────────────────────────────
await reset(); const N = await mkUser('N', 'user', NONE); const nt = await N.tok(NONE);
const n1 = await call(NONE, 'POST', '/api/chat', { token: nt, body: { message: 'hola sin presupuesto' } });
const n2 = await call(NONE, 'POST', '/api/recommendations/generate', { token: nt }); const n3 = await call(NONE, 'POST', '/api/matching/request', { token: nt, body: { answers: { area: 'x' } } });
const nOk = await call(NONE, 'GET', '/api/mood/history', { token: nt }); const nUse = await call(NONE, 'GET', '/api/ai/usage', { token: nt });
check('ES22-F01 sin AI_BUDGET_TOKENS_PER_USER: chat y recomendaciones → 503 `ai_budget_not_configured`, sin llamar al proveedor; el resto funciona', n1.status === 503 && n1.json.code === 'ai_budget_not_configured' && n2.status === 503 && (await stats()).calls === 0 && nOk.status === 200 && nUse.json.configured === false, `chat=${n1.status} reco=${n2.status} matching=${n3.status} resto=${nOk.status} calls=${(await stats()).calls}`);

// ── F02/F03/F04 · reserva, ajuste, agotar, seguridad ─────────────────────────
const U = await mkUser('U'); const u = await U.tok();
await reset(); let r = await call(LIM, 'POST', '/api/chat', { token: u, body: { message: 'primera __TOK2500__' } }); const after1 = await used(U.id);
check('ES22-F02a la reserva se ajusta al uso real tras responder (2500 tokens informados por el proveedor)', r.status === 200 && after1 === 2500, `status=${r.status} usado=${after1}`);
const rowsU = await q('select status,"inputTokens","outputTokens","reservedTokens","latencyMs","errorCode",kind from "AiUsages" where "UserId"=$1', [U.id]);
check('ES22-F07a AiUsages registra tipo, tokens y latencia de la llamada completada', rowsU.length === 1 && rowsU[0].status === 'completed' && rowsU[0].kind === 'chat' && rowsU[0].inputTokens === 2500 && rowsU[0].latencyMs >= 0, JSON.stringify(rowsU[0]));
const usageOwn = await call(LIM, 'GET', '/api/ai/usage', { token: u });
check('ES22-F02b GET /api/ai/usage muestra límite, usado y restante propios', usageOwn.json.limit === 6000 && usageOwn.json.used === 2500 && usageOwn.json.remaining === 3500, JSON.stringify(usageOwn.json));
await call(LIM, 'POST', '/api/chat', { token: u, body: { message: 'segunda __TOK2500__' } });
const callsBefore429 = (await stats()).calls; const msgsBefore = (await q('select count(*)::int n from "Messages" where "UserId"=$1', [U.id]))[0].n;
const ex = await call(LIM, 'POST', '/api/chat', { token: u, body: { message: 'tercera tras agotar', requestId: 'qaagotado0001' } });
check('ES22-F03a agotado: 429 `ai_budget_exhausted` con reply, scope y resetsAt, sin llamar al proveedor y sin tocar el historial', ex.status === 429 && ex.json.code === 'ai_budget_exhausted' && ex.json.scope === 'person' && !!ex.json.resetsAt && typeof ex.json.reply === 'string' && (await stats()).calls === callsBefore429 && (await q('select count(*)::int n from "Messages" where "UserId"=$1', [U.id]))[0].n === msgsBefore, `status=${ex.status} scope=${ex.json?.scope}`);
const usedBefore = await used(U.id);
const gr = await call(LIM, 'POST', '/api/chat', { token: u, body: { message: 'estoy pensando en suicidarme' } });
check('ES22-F04 con el presupuesto agotado la respuesta de seguridad se entrega y NO consume presupuesto ni llama a Claude', gr.status === 200 && gr.json.interrupted === true && await used(U.id) === usedBefore && (await stats()).calls === callsBefore429, `usado ${usedBefore}→${await used(U.id)}`);
await q('update "AiBudgetCounters" set used=0 where "UserId"=$1', [U.id]);
const retry = await call(LIM, 'POST', '/api/chat', { token: u, body: { message: 'tercera tras agotar', requestId: 'qaagotado0001' } });
const dupMsgs = (await q('select count(*)::int n from "Messages" where "UserId"=$1', [U.id]))[0].n - msgsBefore;
check('ES22-F03b al renovarse el periodo el mismo requestId se retoma sin duplicar (un solo par de mensajes más el par de seguridad)', retry.status === 200 && dupMsgs === 4, `reintento=${retry.status} mensajesNuevos=${dupMsgs}`);

// fallo del proveedor: libera la reserva
const failBase = await used(U.id);
const fl = await call(LIM, 'POST', '/api/chat', { token: u, body: { message: 'esto debe fallar __FAIL__' } }); const failAfter = await used(U.id);
const failRow = (await q('select status,"errorCode" from "AiUsages" where "UserId"=$1 order by id desc limit 1', [U.id]))[0];
check('ES22-F02c si el proveedor falla: 502, la reserva se libera (contador intacto) y el error se clasifica', fl.status === 502 && failAfter === failBase && failRow.status === 'failed' && failRow.errorCode === 'provider_unavailable', `usado ${failBase}→${failAfter} fila=${JSON.stringify(failRow)}`);

// ── F05 · tiempos ─────────────────────────────────────────────────────────────
const to0 = await used(U.id); const slow = await call(LIM, 'POST', '/api/chat', { token: u, body: { message: 'esto tarda __VERYSLOW__' } });
const slowRow = (await q('select status,"errorCode","latencyMs" from "AiUsages" where "UserId"=$1 order by id desc limit 1', [U.id]))[0];
check('ES22-F05 el tiempo de espera de 3 s se respeta: 502 en ~3 s (no 6 s), error `timeout` y reserva liberada', slow.status === 502 && slow.ms < 5000 && slowRow.errorCode === 'timeout' && await used(U.id) === to0, `${slow.ms.toFixed(0)}ms fila=${JSON.stringify(slowRow)}`);

// ── F06 · esquemas de salida ──────────────────────────────────────────────────
const R = await mkUser('R', 'user', BIG); const rt = await R.tok(BIG); const T = await mkUser('T', 'therapist', BIG);
const recCount = async () => (await q('select count(*)::int n from "WellnessRecommendations" where "UserId"=$1', [R.id]))[0].n;
const recCases = { 'JSON roto': 'esto no es json', 'categoría inventada': '[{"category":"medicacion","content":"toma algo"}]', 'sin contenido': '[{"category":"habit","content":"  "}]', 'más de 3': JSON.stringify(Array.from({ length: 4 }, () => ({ category: 'habit', content: 'x' }))), 'contenido > 500': JSON.stringify([{ category: 'habit', content: 'x'.repeat(501) }]), 'no es arreglo': '{"category":"habit","content":"x"}', 'vacío': '[]' };
const recRes = {}; for (const [k, t] of Object.entries(recCases)) { await reset(); await setText(t); const x = await call(BIG, 'POST', '/api/recommendations/generate', { token: rt }); recRes[k] = x.status; }
const recSaved = await recCount();
check('ES22-F06a recomendaciones: salida inválida → rechazo (502) y nada guardado', Object.values(recRes).every(s => s === 502) && recSaved === 0, `estados=${JSON.stringify(recRes)} guardadas=${recSaved}`);
await reset(); await setText(JSON.stringify([{ category: 'habit', content: 'Camina diez minutos hoy.' }, { category: 'reflection', content: 'Anota una cosa que salió bien.' }]));
const recOk = await call(BIG, 'POST', '/api/recommendations/generate', { token: rt });
check('ES22-F06b recomendaciones válidas → 200 y guardadas', recOk.status === 200 && await recCount() === 2, `status=${recOk.status}`);
const mrCount = async () => (await q('select count(*)::int n from "MatchingRequests" where "UserId"=$1', [R.id]))[0].n;
const matchCases = { 'JSON roto': 'no json', 'terapeuta no ofrecido': `[{"therapistId":99999999,"score":8,"reason":"ok"}]`, 'puntuación 11': `[{"therapistId":${T.id},"score":11,"reason":"ok"}]`, 'puntuación decimal': `[{"therapistId":${T.id},"score":7.5,"reason":"ok"}]`, 'razón > 300': `[{"therapistId":${T.id},"score":8,"reason":"${'x'.repeat(301)}"}]`, 'más de 3': JSON.stringify(Array.from({ length: 4 }, () => ({ therapistId: T.id, score: 5, reason: 'ok' }))) };
const matchRes = {}; for (const [k, t] of Object.entries(matchCases)) { await reset(); await setText(t); const x = await call(BIG, 'POST', '/api/matching/request', { token: rt, body: { answers: { area: 'carrera' } } }); matchRes[k] = x.status; }
check('ES22-F06c matching: salida inválida → rechazo y nada guardado', Object.values(matchRes).every(s => [502].includes(s)) && await mrCount() === 0, `estados=${JSON.stringify(matchRes)} guardadas=${await mrCount()}`);
info('ES22-F06c-detalle (el criterio de Dev dice 502 para salida inválida)', JSON.stringify(matchRes));
await reset(); await setText(`[{"therapistId":${T.id},"score":8,"reason":"Encaja con lo que buscas."}]`);
const matchOk = await call(BIG, 'POST', '/api/matching/request', { token: rt, body: { answers: { area: 'carrera' } } });
check('ES22-F06d matching válido → 200 y guardado', matchOk.status === 200 && await mrCount() === 1, `status=${matchOk.status}`);

// ── F07 · privacidad de lo medido ─────────────────────────────────────────────
const cols = (await q("select column_name from information_schema.columns where table_name='AiUsages'")).map(c => c.column_name);
const allRows = JSON.stringify(await q('select * from "AiUsages"'));
check('ES22-F07b AiUsages no tiene columnas de contenido y sus filas no contienen texto de conversaciones ni del proveedor', !cols.some(c => /content|text|prompt|message|reply|body/i.test(c)) && !/primera|segunda|tercera|esto debe fallar|fallo simulado|Respuesta sintética/.test(allRows), `columnas=${cols.join(',')}`);
check('ES22-F07c sin precios verificados el costo queda desconocido', (await q('select count(*)::int n from "AiUsages" where "costMicros" is not null'))[0].n === 0);

// ── S01 · concurrencia con conexiones reales ─────────────────────────────────
await reset(); const W = await mkUser('W'); const w = await W.tok();
const par = await Promise.all(Array.from({ length: 40 }, (_, i) => call(LIM, 'POST', '/api/chat', { token: w, body: { message: `paralelo ${i} __TOK1500__` } })));
const ok = par.filter(x => x.status === 200).length, c429 = par.filter(x => x.status === 429).length, otros = par.filter(x => ![200, 429].includes(x.status)).map(x => x.status);
const wUsed = await used(W.id); const wCalls = (await stats()).calls; const wDone = (await q('select count(*)::int n from "AiUsages" where "UserId"=$1 and status=\'completed\'', [W.id]))[0].n;
check('ES22-S01a 40 envíos simultáneos de una persona con límite 6000: nunca se supera el límite, los excedentes son 429 y no llaman al proveedor', wUsed <= 6000 && ok * 1500 <= 6000 && wCalls === ok && otros.length === 0 && ok >= 1 && wDone === ok, `200=${ok} 429=${c429} otros=${JSON.stringify(otros)} usado=${wUsed} llamadasAlProveedor=${wCalls}`);
await reset(); const cohort = []; for (let i = 0; i < 12; i++) cohort.push(await mkUser('K' + i)); const ctok = await Promise.all(cohort.map(c => c.tok()));
await q('delete from "AiBudgetCounters" where "UserId"=0'); const cp = await Promise.all(ctok.flatMap((t, i) => [0, 1, 2].map(j => call(LIM, 'POST', '/api/chat', { token: t, body: { message: `cohorte ${i}-${j} __TOK1500__` } }))));
const cOk = cp.filter(x => x.status === 200).length, c429b = cp.filter(x => x.status === 429); const cu = await cohortUsed(); const cScopes = [...new Set(c429b.map(x => x.json?.scope))];
check('ES22-S01b 36 envíos de 12 personas contra un tope de cohorte de 20000: la cohorte nunca lo supera y los rechazos indican alcance `cohort`', cu <= 20000 && cOk * 1500 <= 20000 && cp.every(x => [200, 429].includes(x.status)) && (c429b.length === 0 || cScopes.includes('cohort')), `200=${cOk} 429=${c429b.length} alcances=${JSON.stringify(cScopes)} cohorteUsada=${cu}`);

// ── S02 · aislamiento de lo medido ───────────────────────────────────────────
const Bz = await mkUser('Bz'); const bz = await Bz.tok(); const SU = await mkUser('su', 'superadmin'); const su = await SU.tok(); const AD = await mkUser('ad', 'admin'); const ad = await AD.tok();
const bu = await call(LIM, 'GET', '/api/ai/usage', { token: bz }); const adm = await call(LIM, 'GET', '/api/superadmin/ai-usage', { token: ad }); const sum = await call(LIM, 'GET', '/api/superadmin/ai-usage', { token: su }); const usr = await call(LIM, 'GET', '/api/superadmin/ai-usage', { token: u });
const sumText = JSON.stringify(sum.json);
check('ES22-S02a cada persona solo ve su propio uso (B no ve el de A)', bu.json.used === 0 && bu.json.limit === 6000);
check('ES22-S02b el resumen agregado es solo de superadmin (admin y usuario → 403) y no lleva identificadores, correos ni contenido', adm.status === 403 && usr.status === 403 && sum.status === 200 && !/example\.test|@|primera|segunda|paralelo|"UserId"|"email"/.test(sumText) && typeof sum.json.persons === 'number', `persons=${sum.json.persons} calls=${sum.json.calls}`);
info('ES22-S02c resumen agregado (forma)', JSON.stringify({ calls: sum.json.calls, persons: sum.json.persons, byStatus: sum.json.byStatus, errors: sum.json.errors, cohortUsed: sum.json.cohortUsed, costMicrosByCurrency: sum.json.costMicrosByCurrency }));

// ── S03 · secretos ───────────────────────────────────────────────────────────
const SECRETS = ['sk-ant-api03-ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 'AKIAABCDEFGHIJKLMNOP', 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcdefghijklmnopqrstuvwxyz1234', 'password=Supersecreta123!', '-----BEGIN PRIVATE KEY-----\nMIIBVgIBADANBgkqhkiG9w0BAQEFAASCAUAwggE8\n-----END PRIVATE KEY-----', 'postgres://usuario:clave@host:5432/base'];
await reset(); const S = await mkUser('S', 'user', BIG); const st = await S.tok(BIG);
const dsec = await call(BIG, 'POST', '/api/diary', { token: st, body: { date: '2026-10-20', content: 'mi nota con ' + SECRETS[0] } });
await call(BIG, 'POST', '/api/chat', { token: st, body: { message: 'anterior: ' + SECRETS[1] + ' y ' + SECRETS[3] } });
await reset(); await call(BIG, 'POST', '/api/chat', { token: st, body: { message: 'actual: ' + SECRETS.join(' || '), contextEntryIds: [dsec.json.id] } }); const sent = JSON.stringify((await stats()).last);
const leaked = SECRETS.filter(x => sent.includes(x.slice(0, 20)) || sent.includes(JSON.stringify(x).slice(1, 20)));
const hist = (await call(BIG, 'GET', '/api/messages', { token: st })).json;
check('ES22-S03a ningún secreto ficticio (clave, JWT, contraseña, llave privada, cadena de conexión) llega al proveedor: se enmascara', leaked.length === 0 && sent.includes('[secreto omitido]'), `filtrados=${JSON.stringify(leaked.map(x => x.slice(0, 18)))}`);
check('ES22-S03b el historial de la persona conserva lo que escribió (el enmascarado solo aplica a lo que sale)', hist.some(m => String(m.text).includes('AKIAABCDEFGHIJKLMNOP')));

// ── S04 · configuración inválida ─────────────────────────────────────────────
const cfgCases = { 'abc': { AI_BUDGET_TOKENS_PER_USER: 'abc' }, '-5': { AI_BUDGET_TOKENS_PER_USER: '-5' }, '0': { AI_BUDGET_TOKENS_PER_USER: '0' }, '1e3': { AI_BUDGET_TOKENS_PER_USER: '1e3' }, '1.5': { AI_BUDGET_TOKENS_PER_USER: '1.5' }, 'vacío': { AI_BUDGET_TOKENS_PER_USER: '' }, '13 dígitos': { AI_BUDGET_TOKENS_PER_USER: '1234567890123' }, ' 5000 ': { AI_BUDGET_TOKENS_PER_USER: ' 5000 ' } };
const cfg = Object.fromEntries(Object.entries(cfgCases).map(([k, v]) => [k, budget.readConfig(v) ? 'configurado' : 'no configurado']));
const per = budget.readConfig({ AI_BUDGET_TOKENS_PER_USER: '5000', AI_BUDGET_PERIOD: 'year', AI_CALL_TIMEOUT_MS: '999999', AI_MAX_RETRIES: '99' });
check('ES22-S04a valores no numéricos, cero, negativos, decimales o gigantes → no configurado (nunca ilimitado); espacios laterales sí se admiten', ['abc', '-5', '0', '1e3', '1.5', 'vacío', '13 dígitos'].every(k => cfg[k] === 'no configurado') && cfg[' 5000 '] === 'configurado', JSON.stringify(cfg));
check('ES22-S04b periodo inválido → `month`; tiempo y reintentos acotados a sus límites duros (120 s y 2)', per.period === 'month' && per.timeoutMs === 120000 && per.maxRetries === 2, JSON.stringify(per));
const pk = ['2026-12-31T23:59:59Z', '2027-01-01T00:00:00Z'].map(d => budget.periodKey(new Date(d), 'day')); const wk = budget.periodKey(new Date('2026-10-26T12:00:00Z'), 'week');
check('ES22-S04c los periodos son UTC y cambian a medianoche; la semana empieza el lunes', pk[0] !== pk[1] && wk === 'W2026-10-26', JSON.stringify({ pk, wk }));

// ── P01/P02 · rendimiento ────────────────────────────────────────────────────
await reset(); const kk = []; for (let i = 0; i < 40; i++) kk.push(await mkUser('P' + i, 'user', BIG)); const kt = await Promise.all(kk.map(x => x.tok(BIG)));
const t0 = performance.now(); const burst = await Promise.all(kt.map((t, i) => call(BIG, 'POST', '/api/chat', { token: t, body: { message: `ráfaga ${i}` } }))); const bms = performance.now() - t0;
check('ES22-P02 40 reservas simultáneas de 40 personas sobre la fila de cohorte: serializan sin errores ni interbloqueos', burst.every(x => x.status === 200), `estados=${JSON.stringify([...new Set(burst.map(x => x.status))])} total=${bms.toFixed(0)}ms p95=${burst.map(x => x.ms).sort((a, b) => a - b)[Math.floor(burst.length * 0.95)].toFixed(0)}ms`);
const lat = []; let e5 = 0; const end = Date.now() + Number(process.env.QA_LOAD_SECS || 120) * 1000; const vus = kt.slice(0, 6);
await Promise.all(vus.map(async t => { let k = 0; while (Date.now() < end) { const x = await call(BIG, 'POST', '/api/chat', { token: t, body: { message: `carga ${k++}` } }); lat.push(x.ms); if (x.status >= 500) e5++; } }));
lat.sort((a, b) => a - b);
check('ES22-P01 carga: 6 personas, 2 min, con reserva y registro de uso en cada llamada: 0 errores 5xx y p95 ≤ 500 ms (proveedor simulado)', e5 === 0 && lat[Math.floor(lat.length * 0.95)] <= 500, `peticiones=${lat.length} 5xx=${e5} p50=${lat[Math.floor(lat.length / 2)].toFixed(0)}ms p95=${lat[Math.floor(lat.length * 0.95)].toFixed(0)}ms`);
const leakRows = (await q('select count(*)::int n from (select "UserId","periodKey" from "AiBudgetCounters" group by 1,2 having count(*)>1) t'))[0].n;
check('ES22-P03 un solo contador por persona y periodo tras toda la carga (sin filas duplicadas)', leakRows === 0, `duplicados=${leakRows}`);
console.log(JSON.stringify({ resumen: { fallos: failed } })); await db.end(); process.exit(failed ? 1 : 0);
