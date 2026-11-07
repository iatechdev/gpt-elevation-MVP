// [QA-Claude] ES-43 · PR #104 (ES43-QA-01): registro de `stop_reason` en AiUsages. Postgres REAL con migraciones, proveedor SIMULADO que fija stop_reason (incluidos valores hostiles). Datos SINTÉTICOS.
// Uso: QA_SUT=<clon> QA_API=<servidor> QA_STOP=<proxy que fija stop_reason> QA_MOCK=<mock IA> DATABASE_URL=<base> QA_JWT_SECRET=<clave> node qa/integration/es43-stopreason.mjs
import { createRequire } from 'node:module'; import { randomBytes } from 'node:crypto'; import { spawnSync } from 'node:child_process'; import path from 'node:path';
const E = process.env; const backend = path.join(E.QA_SUT, 'backend'); const req = createRequire(path.join(backend, 'package.json')); const { Client } = req('pg'); const jwt = req('jsonwebtoken');
const API = E.QA_API; const db = new Client({ connectionString: E.DATABASE_URL, ssl: false }); await db.connect(); const q = async (s, p = []) => (await db.query(s, p)).rows;
const check = (id, ok, d = '') => console.log(JSON.stringify({ id, ok: !!ok, detail: String(d).slice(0, 260) })); const stamp = Date.now(); const sleep = ms => new Promise(r => setTimeout(r, ms));
const sign = u => jwt.sign({ id: u.id, name: u.name, role: u.role, iatMs: Date.now() }, E.QA_JWT_SECRET, { expiresIn: '3h', jwtid: randomBytes(8).toString('hex') });
const mk = async tag => { const email = `qa104-${tag}-${stamp}@example.test`; await fetch(API + '/api/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'QA104 ' + tag, email, password: randomBytes(12).toString('base64url') + 'aA1!' }) }); const u = (await q('select id,name,role from "Users" where email=$1', [email]))[0]; return { ...u, t: sign(u) }; };
const call = async (u, m, p, body) => { const r = await fetch(API + p, { method: m, headers: { Authorization: 'Bearer ' + u.t, ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined }); const text = await r.text(); let json = null; try { json = JSON.parse(text); } catch { /* */ } return { status: r.status, json, text }; };
const setStop = v => fetch(E.QA_STOP + '/_stop?v=' + encodeURIComponent(v)); const setText = v => fetch(E.QA_MOCK + '/_text?v=' + encodeURIComponent(v));
const chat = async (u, message) => { const requestId = 'q104' + randomBytes(6).toString('hex'); const r = await call(u, 'POST', '/api/chat', { message, requestId }); return { ...r, requestId }; };
const rowOf = async requestId => (await q('select "requestId","stopReason","outputTokens","inputTokens",status from "AiUsages" where "requestId"=$1', [requestId]))[0];

// S1 · estructura de la columna (la migración ya se aplicó antes de arrancar)
const col = (await q(`select column_name, data_type, character_maximum_length, is_nullable from information_schema.columns where table_name='AiUsages' and column_name='stopReason'`))[0];
check('S1a la migración añadió `AiUsages.stopReason` varchar(24), opcional', col && col.data_type === 'character varying' && Number(col.character_maximum_length) === 24 && col.is_nullable === 'YES', JSON.stringify(col));
// S2 · valores del proveedor
const U = await mk('a'); await setText('Respuesta sintética para medir.');
const cases = [['end_turn', 'end_turn'], ['max_tokens', 'max_tokens'], ['stop_sequence', 'stop_sequence'], ['', null]];
for (const [stop, want] of cases) { await setStop(stop); const r = await chat(U, 'Mensaje sintético ' + (stop || 'sin campo')); const row = await rowOf(r.requestId); check(`S2 stop_reason «${stop || '(ausente)'}» se guarda como ${want === null ? 'null' : want}, enlazado por requestId`, r.status === 200 && row && row.stopReason === want, `http=${r.status} fila=${JSON.stringify(row)}`); await sleep(300); }
// S3 · valores hostiles: nunca texto libre ni contenido
const PRIV = 'TEXTO-PRIVADO-DE-LA-PERSONA-' + randomBytes(3).toString('hex');
for (const [label, v] of [['HTML', '<script>alert(1)</script>'], ['largo (500 caracteres)', 'x'.repeat(500)], ['con el texto de la persona', PRIV], ['con mayúsculas y espacios', 'MAX TOKENS'], ['inyección SQL', "end_turn'; drop table \"AiUsages\";--"]]) { await setStop(v); const r = await chat(U, 'Mensaje que incluye ' + PRIV); const row = await rowOf(r.requestId); const bad = row && row.stopReason !== null; check(`S3 stop_reason hostil (${label}) NO se guarda (queda null) y la respuesta sigue siendo 200`, r.status === 200 && row && row.stopReason === null, `http=${r.status} guardado=${JSON.stringify(row?.stopReason)}`); await sleep(300); }
await setStop('end_turn'); const leak = (await q(`select count(*)::int n from "AiUsages" where "stopReason" ~ '[^a-z_]' or length("stopReason") > 24`))[0].n; const leakTxt = (await q(`select count(*)::int n from "AiUsages" where "stopReason" like $1`, ['%' + PRIV + '%']))[0].n; check('S3b ninguna fila guarda caracteres fuera de [a-z_] ni el texto de la persona', leak === 0 && leakTxt === 0, `raros=${leak} texto=${leakTxt}`);
const own = await call(U, 'GET', '/api/ai/usage'); check('S3c el uso que ve la persona no expone `stopReason`', own.status === 200 && !/stopReason/.test(own.text), own.text.slice(0, 160));
// S4/S5 · concurrencia y presupuesto
const P = []; for (let i = 0; i < 12; i++) P.push(await mk('p' + i)); const t0 = performance.now(); const res = await Promise.all(P.map(u => chat(u, 'Mensaje simultáneo de prueba'))); const ms = Math.round(performance.now() - t0);
const rows = await q(`select "stopReason", status, count(*)::int n from "AiUsages" where "UserId" = any($1) group by 1,2`, [P.map(p => p.id)]);
check('S5 12 turnos simultáneos: todos 200, sin 5xx, todas las llamadas registran `end_turn`', res.every(r => r.status === 200) && rows.length === 1 && rows[0].stopReason === 'end_turn' && rows[0].n === 12, `total=${ms}ms filas=${JSON.stringify(rows)}`);
const before = (await q(`select count(*)::int n from "AiUsages" where "UserId"=$1`, [U.id]))[0].n; const u2 = (await call(U, 'GET', '/api/ai/usage')).json; check('S4a el presupuesto sigue contando: `used` > 0 y `remaining` = límite − usado', u2.configured === true && u2.used > 0 && u2.remaining === u2.limit - u2.used, JSON.stringify(u2));
await db.end();
