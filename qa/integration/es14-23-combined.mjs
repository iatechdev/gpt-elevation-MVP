// [QA-Claude] ES-14 + ES-23 combinados (QA-14-01): el contexto del participante en la exportación personal, la purga y el reaplicado.
// Uso: QA_SUT=<clon del head de #32> QA_API=http://127.0.0.1:8095 (DATA_RIGHTS_ENABLED=true) DATABASE_URL=<base> QA_JWT_SECRET=<el del servidor> DATA_ENCRYPTION_KEY=<el del servidor>
//      node qa/integration/es14-23-combined.mjs
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
  const r = await fetch(api + url, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await r.text(); let json = null; try { json = JSON.parse(text); } catch { /* no JSON */ }
  return { status: r.status, json, text };
};
const stamp = Date.now();
const mint = (u) => jwt.sign({ id: u.id, name: u.name, role: u.role, iatMs: Date.now() }, JWT, { expiresIn: '8h', jwtid: randomBytes(16).toString('hex') });
const mkUser = async (tag) => {
  const email = `qa-ctx-${tag}-${stamp}@example.test`, password = randomBytes(14).toString('base64url') + 'aA1!';
  const r = await call('POST', '/api/register', { body: { name: 'QACTX ' + tag, email, password } });
  if (r.status !== 201) throw new Error('registro ' + tag + ' ' + r.status);
  return { tag, ...(await q('select id,name,role from "Users" where email=$1', [email]))[0] };
};
const CAN = 'CANARIO-CTX-' + randomBytes(3).toString('hex');
const ctx = (over = {}) => ({ preferredLanguage: 'es', residenceCountry: 'CO', targetMarket: 'DK', timeZone: 'America/Bogota', profession: 'Docente ' + CAN, interests: 'datos', availabilityMinutesPerWeek: 300, careerGoal: null, careerConstraints: null, ...over });
const put = (t, version, action, context) => call('PUT', '/api/user/context', { token: t, body: { schemaVersion: 1, expectedVersion: version, action, context } });
const purge = (id, replay = false) => spawnSync(process.execPath, ['scripts/purgePersonalData.js', id, '--producers-stopped-and-drained', ...(replay ? ['--replay'] : [])], { cwd: path.join(sut, 'backend'), env: { ...process.env, DATABASE_URL: dbUrl, DB_SSL: 'false', JWT_SECRET: JWT }, encoding: 'utf8' });
const count = async (id) => (await q('select count(*)::int n from "ParticipantContexts" where "UserId"=$1', [id]))[0].n;

// A: contexto completado y editado (varias versiones y eventos de invalidación)
const A = await mkUser('A'); const a = mint(A);
await put(a, 0, 'save_draft', ctx({ profession: null }));
await put(a, 1, 'continue', ctx());
const B = await mkUser('B'); const b = mint(B);
await put(b, 0, 'continue', ctx({ profession: 'Profesión de B' }));
const exp = await call('POST', '/api/exports/preview', { token: a, body: { type: 'personal', locale: 'es' } });
info('exportacion', `status=${exp.status} claves=${Object.keys(exp.json?.data ?? {}).join(',')}`);
const pc = exp.json?.data?.participantContext;
check('CTX-X01 la exportación personal incluye participantContext', exp.status === 201 && Array.isArray(pc) && pc.length === 1, `status=${exp.status} n=${pc?.length}`);
check('CTX-X02 el contenido se entrega descifrado y como objeto (no como texto cifrado v2:) con lo que la persona escribió', typeof pc?.[0]?.content === 'object' && pc[0].content.profession === 'Docente ' + CAN && !exp.text.includes('"content":"v2:'), JSON.stringify(pc?.[0]?.content ?? {}).slice(0, 120));
check('CTX-X03 trae versión y completedAt, y no incluye el contexto de otra persona', pc?.[0]?.version === 2 && !!pc[0].completedAt && !exp.text.includes('Profesión de B'), `version=${pc?.[0]?.version}`);
const dl = await call('POST', `/api/exports/${exp.json?.id}/download`, { token: a });
check('CTX-X04 la descarga del dueño trae el contexto', dl.status === 200 && dl.text.includes('Docente ' + CAN), `status=${dl.status}`);
// cambiar el contexto entre vista previa y descarga
const exp2 = await call('POST', '/api/exports/preview', { token: a, body: { type: 'personal', locale: 'es' } });
await put(a, 2, 'save_draft', ctx({ profession: 'Cambiada tras la vista previa' }));
const dl2 = await call('POST', `/api/exports/${exp2.json?.id}/download`, { token: a });
check('CTX-X05 si el contexto cambia entre vista previa y descarga → 409 export_outdated (no se entrega lo viejo)', dl2.status === 409 && dl2.json?.code === 'export_outdated', `status=${dl2.status} code=${dl2.json?.code}`);

// Purga
const E = await mkUser('E'); const e = mint(E);
await put(e, 0, 'continue', ctx());
await put(e, 1, 'save_draft', ctx({ interests: 'más datos' }));
const before = await count(E.id); const invBefore = (await q(`select count(*)::int n from "DerivedInvalidations" where "UserId"=$1 and "sourceType"='participant_context'`, [E.id]))[0].n;
const del = await call('POST', '/api/account/deletion-requests', { token: e, body: { confirm: true } });
const guard = await call('GET', '/api/user/context', { token: e });
check('CTX-E01 con la solicitud de eliminación aceptada la sesión ya no lee ni edita el contexto (4xx)', del.status === 202 && guard.status >= 400 && guard.status < 500 && (await put(e, 2, 'save_draft', ctx())).status >= 400, `solicitud=${del.status} lectura=${guard.status}`);
const reqId = (await q('select id from "DeletionRequests" where "UserId"=$1', [E.id]))[0].id;
const p1 = purge(reqId);
const after = await count(E.id);
check('CTX-E02 la purga borra el contexto (había filas, quedan 0)', before === 1 && p1.status === 0 && after === 0, `antes=${before} después=${after} exit=${p1.status} ${p1.stdout.trim().split('\n').pop()}`);
check('CTX-E03 los eventos de invalidación no contienen contenido', !JSON.stringify(await q(`select * from "DerivedInvalidations" where "UserId"=$1`, [E.id])).includes(CAN) && invBefore >= 1, `eventos=${invBefore}`);
check('CTX-E04 el contexto de otra persona (B) sigue intacto tras purgar a E', (await count(B.id)) === 1, '');
// Replay tras restaurar
await q(`insert into "ParticipantContexts" ("UserId", version, content, "completedAt", "createdAt", "updatedAt") values ($1, 9, 'v2:restaurado', now(), now(), now())`, [E.id]);
const p2 = purge(reqId, true);
check('CTX-E05 --replay tras restaurar vuelve a borrar el contexto restaurado', p2.status === 0 && (await count(E.id)) === 0, `exit=${p2.status} filas=${await count(E.id)}`);
const p3 = purge(reqId);
check('CTX-E06 repetir la purga es idempotente (exit 0)', p3.status === 0, `exit=${p3.status}`);
const mkOrphan = await q(`select count(*)::int n from "Users" where email like '%@deleted.invalid'`);
info('cuentas-purgadas', mkOrphan[0].n);

// Todo junto: una persona con contexto, puente, evidencia y evaluación
const F = await mkUser('F'); const f = mint(F);
await put(f, 0, 'continue', ctx());
const ev = await call('POST', '/api/evidence', { token: f, body: { payload: { title: 'Todo junto ' + CAN, situation: 's', responsibility: { text: 'r' }, actions: [{ text: 'a' }], delivered: { text: 'd' }, observedEffect: { known: false }, autonomy: 'assisted' }, status: 'confirmed', requestId: 'qa' + randomBytes(8).toString('hex') } });
const fields = [{ key: 'values', text: 'Valor ' + CAN }];
const pv = await call('POST', '/api/career-context/preview', { token: f, body: { fields } });
const cf = await call('POST', '/api/career-context/confirm', { token: f, body: { fields, token: pv.json?.token, requestId: 'qa' + randomBytes(8).toString('hex') } });
const expF = await call('POST', '/api/exports/preview', { token: f, body: { type: 'personal', locale: 'es' } });
check('CTX-J01 una persona con contexto, puente y evidencia: la exportación trae las tres piezas', expF.status === 201 && ['participantContext', 'careerContext', 'evidence', 'evidenceVersions'].every(k => (expF.json?.data?.[k] ?? []).length >= 1) && expF.text.includes('Valor ' + CAN) && expF.text.includes('Todo junto ' + CAN), `status=${expF.status} claves=${Object.keys(expF.json?.data ?? {}).length} evidencia=${ev.status} puente=${cf.status}`);
await call('POST', '/api/account/deletion-requests', { token: f, body: { confirm: true } });
const reqF = (await q('select id from "DeletionRequests" where "UserId"=$1', [F.id]))[0].id;
const pf = purge(reqF);
const leftF = { contexto: await count(F.id), puente: (await q('select count(*)::int n from "CareerContextVersions" where "UserId"=$1', [F.id]))[0].n, evidencia: (await q('select count(*)::int n from "Evidence" where "UserId"=$1', [F.id]))[0].n, versiones: (await q('select count(*)::int n from "EvidenceVersions" where "UserId"=$1', [F.id]))[0].n };
check('CTX-J02 la purga deja 0 filas de contexto, puente y evidencia', pf.status === 0 && Object.values(leftF).every(n => n === 0), JSON.stringify(leftF));
console.log(JSON.stringify({ fin: true }));
await db.end();
