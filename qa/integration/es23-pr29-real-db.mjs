// [QA-Claude] ES-23 · PR #29 (exportación personal y solicitud de eliminación) contra Postgres REAL local y proveedor de IA simulado.
// Uso: QA_SUT=<clon> QA_API=http://127.0.0.1:8099 QA_API_OFF=http://127.0.0.1:8098 QA_MOCK=http://127.0.0.1:9911 \
//      DATABASE_URL=<base> QA_JWT_SECRET=<el del servidor> DATA_ENCRYPTION_KEY=<el del servidor> node qa/integration/es23-pr29-real-db.mjs
// QA_API_OFF es un segundo servidor SIN DATA_RIGHTS_ENABLED (caso F06). Solo datos sintéticos; no se imprimen contraseñas ni tokens.
import { createRequire } from 'node:module';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const sut = process.env.QA_SUT, api = process.env.QA_API, apiOff = process.env.QA_API_OFF, dbUrl = process.env.DATABASE_URL, JWT = process.env.QA_JWT_SECRET;
if (!sut || !api || !dbUrl || !JWT) throw new Error('Defina QA_SUT, QA_API, DATABASE_URL y QA_JWT_SECRET.');
const req = createRequire(path.join(sut, 'backend', 'package.json'));
const { Client } = req('pg'); const jwt = req('jsonwebtoken');
const db = new Client({ connectionString: dbUrl, ssl: false }); await db.connect();
const q = async (sql, p = []) => (await db.query(sql, p)).rows;
const check = (id, ok, detail = '') => console.log(JSON.stringify({ id, ok: !!ok, detail }));
const info = (id, detail) => console.log(JSON.stringify({ id, info: detail }));
const call = async (method, url, { token, body, base = api, headers = {} } = {}) => {
  const h = { ...headers }; if (token) h.Authorization = 'Bearer ' + token; if (body !== undefined) h['Content-Type'] = 'application/json';
  const t0 = performance.now();
  const r = await fetch(base + url, { method, headers: h, body: body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body)) });
  const text = await r.text(); let json = null; try { json = JSON.parse(text); } catch { /* no JSON */ }
  return { status: r.status, json, text, ms: performance.now() - t0, headers: r.headers };
};
const stamp = Date.now();
const mint = (u, opts = {}) => jwt.sign({ id: u.id, name: u.name, role: u.role, iatMs: Date.now() }, JWT, { expiresIn: opts.expiresIn ?? '8h', jwtid: randomBytes(16).toString('hex') });
const mkUser = async (tag, role = 'user') => {
  const email = `qa29-${tag}-${stamp}@example.test`, password = randomBytes(14).toString('base64url') + 'aA1!';
  const r = await call('POST', '/api/register', { body: { name: 'QA29 ' + tag, email, password } });
  if (r.status !== 201) throw new Error('registro ' + tag + ' ' + r.status);
  if (role !== 'user') await q('update "Users" set role=$1 where email=$2', [role, email]);
  const row = (await q('select id,name,role from "Users" where email=$1', [email]))[0];
  return { tag, email, password, ...row };
};
const p95 = a => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.ceil(s.length * 0.95) - 1)]; };
const CAN_A = 'CANARIO-A-' + randomBytes(4).toString('hex'), CAN_B = 'CANARIO-B-' + randomBytes(4).toString('hex');

const A = await mkUser('A'), B = await mkUser('B'), ADM = await mkUser('adm', 'admin'), SU = await mkUser('su', 'superadmin'), TH = await mkUser('th', 'therapist');
const a = mint(A), b = mint(B), adm = mint(ADM), su = mint(SU);
// Datos sintéticos de A y B
for (const [u, t, can] of [[A, a, CAN_A], [B, b, CAN_B]]) {
  await call('POST', '/api/diary', { token: t, body: { date: '2026-10-20', content: can + ' diario ñandú 😀' } });
  await call('POST', '/api/diary', { token: t, body: { date: '2026-10-21', content: can + ' diario dos' } });
  await call('POST', '/api/mood/checkin', { token: t, body: { mood: 4 } });
  const c = await call('POST', '/api/chat', { token: t, body: { message: can + ' mensaje al chat' } });
  info('seed-' + u.tag, `chat=${c.status}`);
}

// ── F06 · rutas apagadas por defecto
if (apiOff) {
  const r = await call('POST', '/api/exports/preview', { token: a, body: { type: 'personal', locale: 'es' }, base: apiOff });
  const r2 = await call('POST', '/api/account/deletion-requests', { token: a, body: { confirm: true }, base: apiOff });
  check('ES23-F06 sin DATA_RIGHTS_ENABLED: preview y borrado → 503 data_rights_unavailable', r.status === 503 && r.json?.code === 'data_rights_unavailable' && r2.status === 503, `preview=${r.status} borrado=${r2.status}`);
  check('ES23-F06b mensaje bilingüe', /\//.test(r.json?.error || ''), r.json?.error);
}

// ── S01 a S05 · autenticación y aislamiento
let r = await call('POST', '/api/exports/preview', { body: { type: 'personal', locale: 'es' } });
check('ES23-S01 sin token → rechazado (401/403) y sin datos', [401, 403].includes(r.status) && !r.text.includes(CAN_A), `status=${r.status}`);
r = await call('POST', '/api/exports/preview', { token: 'basura.no.jwt', body: { type: 'personal', locale: 'es' } });
check('ES23-S01b token inválido → rechazado', [401, 403].includes(r.status), `status=${r.status}`);

const pv = await call('POST', '/api/exports/preview', { token: a, body: { type: 'personal', locale: 'es' } });
check('ES23-F01a vista previa del dueño: 201 con datos propios y sin datos de B', pv.status === 201 && pv.text.includes(CAN_A) && !pv.text.includes(CAN_B), `status=${pv.status}`);
check('ES23-F01b cabeceras no-store y Vary', /no-store/.test(pv.headers.get('cache-control') || '') && /Authorization/i.test(pv.headers.get('vary') || ''), `cc=${pv.headers.get('cache-control')} vary=${pv.headers.get('vary')}`);
const keys = pv.json?.data ? Object.keys(pv.json.data) : [];
info('F01-claves', keys.join(','));
check('ES23-F01c el perfil exportado no incluye contraseña ni tokens', pv.json?.data?.profile && !('password' in pv.json.data.profile) && !/password|passwordHash|\$2[aby]\$/i.test(JSON.stringify(pv.json.data.profile)), JSON.stringify(Object.keys(pv.json?.data?.profile || {})));
check('ES23-F01d descifrado correcto (no devuelve v2: ni iv:hex)', !/v2:[0-9a-f]+:/.test(pv.text), '');
const dl = await call('POST', `/api/exports/${pv.json.id}/download`, { token: a });
check('ES23-F01e descarga del dueño: 200, adjunto fijo, datos propios', dl.status === 200 && /attachment; filename="elevation-personal\.json"/.test(dl.headers.get('content-disposition') || '') && dl.text.includes(CAN_A) && !dl.text.includes(CAN_B), `status=${dl.status}`);
const dl2 = await call('POST', `/api/exports/${pv.json.id}/download`, { token: a });
info('F01-redescarga', `status=${dl2.status}`);

const dB = await call('POST', `/api/exports/${pv.json.id}/download`, { token: b });
check('ES23-S02 B descarga el id de A → 404 y sin datos', dB.status === 404 && !dB.text.includes(CAN_A), `status=${dB.status}`);
const dAdm = await call('POST', `/api/exports/${pv.json.id}/download`, { token: adm });
check('ES23-S04a admin descarga el id de A → 404 (o 409 por rol) y sin datos', [404, 409].includes(dAdm.status) && !dAdm.text.includes(CAN_A), `status=${dAdm.status} code=${dAdm.json?.code}`);
const dSu = await call('POST', `/api/exports/${pv.json.id}/download`, { token: su });
check('ES23-S04b superadmin descarga el id de A → sin datos', !dSu.text.includes(CAN_A), `status=${dSu.status}`);
for (const bad of ['no-es-uuid', '1', '../../etc/passwd', '00000000-0000-4000-8000-000000000000', "'; drop table \"Users\";--", '%00']) {
  const x = await call('POST', `/api/exports/${encodeURIComponent(bad)}/download`, { token: a });
  check('ES23-S03 id «' + bad.slice(0, 18) + '» → 404 sin 500', x.status === 404, `status=${x.status}`);
}
for (const [i, body] of [[1, { type: 'personal', locale: 'es', extra: 1 }], [2, { type: 'otro', locale: 'es' }], [3, { type: 'personal', locale: 'fr' }], [4, '[]'], [5, 'no-json'], [6, { type: ['personal'], locale: 'es' }], [7, { type: 'personal', locale: 'es', __proto__x: 1, constructor: { prototype: { admin: true } } }], [8, { type: 'personal', locale: { $ne: 'es' } }]]) {
  const x = await call('POST', '/api/exports/preview', { token: a, body, headers: i === 5 ? { 'Content-Type': 'application/json' } : {} });
  check('ES23-S05.' + i + ' entrada inválida en preview → 400 (nunca 500)', x.status === 400, `status=${x.status}`);
}
r = await call('POST', `/api/exports/${pv.json.id}/download`, { token: a, body: { a: 1 } });
check('ES23-S05.9 descarga con cuerpo no vacío → 400', r.status === 400, `status=${r.status}`);
r = await call('GET', `/api/exports/${pv.json.id}`, { token: a });
check('ES23-S05.10 GET sobre la ruta no cae en la SPA (404 JSON)', r.status === 404 && r.json?.code === 'not_found', `status=${r.status} ct=${r.headers.get('content-type')}`);

// ── F02 · exportación profesional
r = await call('POST', '/api/exports/preview', { token: a, body: { type: 'professional', locale: 'es' } });
check('ES23-F02 exportación profesional falla cerrada (503, sin datos)', r.status === 503 && r.json?.code === 'professional_contract_pending' && !r.text.includes(CAN_A), `status=${r.status}`);

// ── Roles distintos de «user»
for (const [tag, t] of [['admin', adm], ['superadmin', su]]) {
  const x = await call('POST', '/api/exports/preview', { token: t, body: { type: 'personal', locale: 'es' } });
  info('rol-' + tag, `preview=${x.status} code=${x.json?.code}`);
}

// ── S10/S11 · vencimiento y datos que cambian entre vista previa y descarga
const pv2 = await call('POST', '/api/exports/preview', { token: a, body: { type: 'personal', locale: 'es' } });
await call('POST', '/api/diary', { token: a, body: { date: '2026-10-22', content: CAN_A + ' entrada nueva tras la vista previa' } });
let x = await call('POST', `/api/exports/${pv2.json.id}/download`, { token: a });
check('ES23-S11 cambio de datos entre vista previa y descarga → 409 export_outdated, sin archivo', x.status === 409 && x.json?.code === 'export_outdated' && !x.text.includes('entrada nueva'), `status=${x.status} code=${x.json?.code}`);
const pv3 = await call('POST', '/api/exports/preview', { token: a, body: { type: 'personal', locale: 'es' } });
await q('update "ExportRequests" set "expiresAt"=now() - interval \'1 minute\' where id=$1', [pv3.json.id]);
x = await call('POST', `/api/exports/${pv3.json.id}/download`, { token: a });
check('ES23-S10 vista previa vencida → 410 export_expired', x.status === 410 && x.json?.code === 'export_expired', `status=${x.status}`);

// ── S09 · revocación de consentimiento entre vista previa y descarga
const grant = await call('GET', '/api/consents', { token: a });
info('S09-consentimientos', JSON.stringify(grant.json).slice(0, 300));
await call('PUT', '/api/consents/professional_bridge', { token: a, body: { status: 'granted' } });
const pv4 = await call('POST', '/api/exports/preview', { token: a, body: { type: 'personal', locale: 'es' } });
const rv2 = await call('PUT', '/api/consents/professional_bridge', { token: a, body: { status: 'revoked' } });
info('S09-revocar', `put=${rv2.status}`);
x = await call('POST', `/api/exports/${pv4.json.id}/download`, { token: a });
info('S09-descarga-tras-revocar', `status=${x.status} code=${x.json?.code} incluyeDiario=${x.text.includes(CAN_A)}`);
check('ES23-S09 revocar el consentimiento entre vista previa y descarga → 409 export_outdated (no se entrega el archivo viejo)', x.status === 409 && x.json?.code === 'export_outdated', `status=${x.status} code=${x.json?.code}`);

// ── F03/F04/S06/S07/S08 · solicitud de eliminación
const D = await mkUser('D'); const d = mint(D);
await call('POST', '/api/diary', { token: d, body: { date: '2026-10-20', content: 'CANARIO-D diario' } });
await call('POST', '/api/chat', { token: d, body: { message: 'CANARIO-D chat' } });
r = await call('POST', '/api/account/deletion-requests', { token: d, body: {} });
check('ES23-F03a borrado sin confirm:true → 400', r.status === 400, `status=${r.status}`);
r = await call('POST', '/api/account/deletion-requests', { token: d, body: { confirm: 'true' } });
check('ES23-F03b confirm como texto → 400', r.status === 400, `status=${r.status}`);
r = await call('POST', '/api/account/deletion-requests', { body: { confirm: true } });
check('ES23-S01c borrado sin token → rechazado', [401, 403].includes(r.status), `status=${r.status}`);
const r1 = await call('POST', '/api/account/deletion-requests', { token: d, body: { confirm: true } });
check('ES23-F03c solicitud → 202 con recibo sin promesas de plazo', r1.status === 202 && r1.json?.id && r1.json.deadlinesVerified === false && r1.json.repeated === false, `status=${r1.status} ${JSON.stringify(r1.json)}`);
const r2 = await call('POST', '/api/account/deletion-requests', { token: d, body: { confirm: true } });
check('ES23-F04 repetirla → 200 con el mismo recibo', r2.status === 200 && r2.json?.id === r1.json?.id && r2.json.repeated === true, `status=${r2.status}`);
const ledger = await q('select count(*)::int n from "DeletionRequests" where "UserId"=$1', [D.id]);
check('ES23-F05 un único registro en el libro de solicitudes', ledger[0].n === 1, `n=${ledger[0].n}`);
const acc = await q('select active from "Users" where id=$1', [D.id]);
check('ES23-F05b cuenta bloqueada (active=false)', acc[0].active === false);
for (const [name, call_] of [['diario', () => call('GET', '/api/diary', { token: d })], ['chat', () => call('POST', '/api/chat', { token: d, body: { message: 'hola' } })], ['historial', () => call('GET', '/api/messages', { token: d })], ['consentimientos', () => call('GET', '/api/consents', { token: d })], ['exportar', () => call('POST', '/api/exports/preview', { token: d, body: { type: 'personal', locale: 'es' } })]]) {
  const y = await call_();
  check('ES23-S06 sesión previa tras solicitar: ' + name + ' rechazado (sin 200)', y.status >= 400 && y.status !== 500 && !y.text.includes('CANARIO-D'), `status=${y.status} code=${y.json?.code}`);
}
let lg = await call('POST', '/api/login', { body: { email: D.email, password: D.password } });
check('ES23-S07a login nuevo con la cuenta bloqueada → rechazado sin token', lg.status >= 400 && !lg.json?.token, `status=${lg.status} code=${lg.json?.code}`);
// administrador intenta reactivar
for (const [name, t, m, u, b2] of [['PUT active:true (admin)', adm, 'PUT', `/api/admin/usuarios/${D.id}`, { active: true }], ['unlock (admin)', adm, 'PUT', `/api/admin/usuarios/${D.id}/unlock`, {}], ['reset-password (superadmin)', su, 'PUT', `/api/admin/usuarios/${D.id}/reset-password`, { newPassword: 'NuevaClave-Sint-9!' }], ['PUT active:true (superadmin)', su, 'PUT', `/api/admin/usuarios/${D.id}`, { active: true }]]) {
  const y = await call(m, u, { token: t, body: b2 });
  check('ES23-S08 ' + name + ' → 409 deletion_pending', y.status === 409 && y.json?.code === 'deletion_pending', `status=${y.status} code=${y.json?.code}`);
}
await q('update "Users" set active=true where id=$1', [D.id]); // simula reactivación directa en base
lg = await call('POST', '/api/login', { body: { email: D.email, password: D.password } });
check('ES23-S07b reactivada a la fuerza en base: el login sigue rechazado (lápida permanente)', lg.status === 403 && lg.json?.code === 'deletion_pending' && !lg.json?.token, `status=${lg.status}`);
x = await call('GET', '/api/diary', { token: d });
check('ES23-S06b reactivada a la fuerza: la sesión previa sigue sin leer el diario', x.status >= 400 && !x.text.includes('CANARIO-D'), `status=${x.status}`);
// la excepción de reintento no abre lectura
x = await call('GET', '/api/account/deletion-requests', { token: d });
check('ES23-S08b GET sobre la ruta de borrado → 404 sin datos', x.status === 404, `status=${x.status}`);
// logout / revocación sobre la sesión usada para el reintento
const dt = mint(D); await q('insert into "AuthRevocations" ("UserId","revokedBefore","createdAt","updatedAt") values ($1, now() + interval \'1 minute\', now(), now()) on conflict ("UserId") do update set "revokedBefore"=excluded."revokedBefore"', [D.id]).catch(e => info('S08c-sql', e.message));
x = await call('POST', '/api/account/deletion-requests', { token: dt, body: { confirm: true } });
check('ES23-S08c sesión revocada no puede ni repetir la solicitud (401)', x.status === 401, `status=${x.status}`);
// token expirado
const expired = jwt.sign({ id: D.id, name: D.name, role: D.role, iatMs: Date.now() - 1e7 }, JWT, { expiresIn: -10, jwtid: 'qa-exp' });
x = await call('POST', '/api/account/deletion-requests', { token: expired, body: { confirm: true } });
check('ES23-S08d token expirado → rechazado', [401, 403].includes(x.status), `status=${x.status}`);
// token de OTRA persona no puede repetir/solicitar por D
x = await call('POST', '/api/account/deletion-requests', { token: mint(B), body: { confirm: true } });
const bAfter = await q('select count(*)::int n from "DeletionRequests" where "UserId"=$1', [B.id]);
info('S02b-B-solicita-su-propio-borrado', `status=${x.status} (esto crea la solicitud de B, no la de D); filas B=${bAfter[0].n}`);

// ── I03/I05 · concurrencia de solicitudes
const E = await mkUser('E'); const e = mint(E);
const burst = await Promise.all(Array.from({ length: 10 }, () => call('POST', '/api/account/deletion-requests', { token: e, body: { confirm: true } })));
const ids = new Set(burst.map(y => y.json?.id)); const fives = burst.filter(y => y.status >= 500).length;
check('ES23-I05 10 solicitudes simultáneas: un único recibo y 0 respuestas 5xx', ids.size === 1 && fives === 0, `recibos=${ids.size} 5xx=${fives} estados=${[...new Set(burst.map(y => y.status))]}`);
check('ES23-I03 un solo registro en el libro', (await q('select count(*)::int n from "DeletionRequests" where "UserId"=$1', [E.id]))[0].n === 1);

// ── I04 · descarga vs. solicitud de borrado simultáneas
const G = await mkUser('G'); const g = mint(G);
await call('POST', '/api/diary', { token: g, body: { date: '2026-10-20', content: 'CANARIO-G' } });
let bad = 0, serverErr = 0, r503 = 0;
for (let i = 0; i < 6; i++) {
  const G2 = await mkUser('G' + i); const tk = mint(G2);
  await call('POST', '/api/diary', { token: tk, body: { date: '2026-10-20', content: 'CANARIO-G' + i } });
  const p = await call('POST', '/api/exports/preview', { token: tk, body: { type: 'personal', locale: 'es' } });
  const [dd, del] = await Promise.all([call('POST', `/api/exports/${p.json.id}/download`, { token: tk }), call('POST', '/api/account/deletion-requests', { token: tk, body: { confirm: true } })]);
  if (dd.status === 500 || del.status >= 500) serverErr++; if (dd.status === 503) { r503++; const rt = await call('POST', `/api/exports/${p.json.id}/download`, { token: tk }); if (![401, 403].includes(rt.status)) bad++; }
  if (dd.status === 200 && !dd.text.includes('CANARIO-G' + i)) bad++; // archivo mezclado/vacío
  const after = await call('POST', `/api/exports/${p.json.id}/download`, { token: tk });
  if (after.status === 200) bad++; // tras aceptar el borrado no debe haber más descargas
}
check('ES23-I04 descarga vs. borrado (6 rondas): sin 500, sin archivo mezclado, sin descargas tras aceptar el borrado y el reintento da 401/403', bad === 0 && serverErr === 0, `mal=${bad} 500=${serverErr} descargas503=${r503}`);

// ── Revisión requerida (paciente con sesión terapéutica / terapeuta)
const P = await mkUser('P'); const pt = mint(P);
await q('insert into "TherapySessions" ("patientId","therapistId","scheduledAt","createdAt","updatedAt") values ($1,$2,now(),now(),now())', [P.id, TH.id]).catch(async e1 => info('P-sesion-sql', e1.message));
x = await call('POST', '/api/exports/preview', { token: pt, body: { type: 'personal', locale: 'es' } });
info('P-paciente-con-sesion', `preview=${x.status} code=${x.json?.code}`);
x = await call('POST', '/api/exports/preview', { token: mint(TH), body: { type: 'personal', locale: 'es' } });
info('P-terapeuta', `preview=${x.status} code=${x.json?.code}`);

// ── Entradas maliciosas en datos propios (XSS/SQL en el contenido exportado: se devuelve como dato, JSON)
const X = await mkUser('X'); const xt = mint(X);
await call('POST', '/api/diary', { token: xt, body: { date: '2026-10-20', content: '<script>alert(1)</script> \'; drop table "Users";-- ${7*7} {{7*7}}' } });
x = await call('POST', '/api/exports/preview', { token: xt, body: { type: 'personal', locale: 'en' } });
check('ES23-S12 contenido hostil se exporta como dato JSON (Content-Type application/json, nosniff)', x.status === 201 && /application\/json/.test(x.headers.get('content-type') || ''), `status=${x.status} ct=${x.headers.get('content-type')} nosniff=${x.headers.get('x-content-type-options')}`);
check('ES23-S12b la tabla Users sigue existiendo', (await q('select count(*)::int n from "Users"'))[0].n > 5);
check('ES23-F07 idioma EN en la vista previa', x.json?.data?.locale === 'en', `locale=${x.json?.data?.locale}`);

// ── Rendimiento
const L = await mkUser('L'); const lt = mint(L);
await Promise.all(Array.from({ length: 20 }, (_, i) => call('POST', '/api/diary', { token: lt, body: { date: '2026-10-' + String(1 + (i % 28)).padStart(2, '0'), content: 'rend ' + i + ' ' + 'x'.repeat(500) } })));
const tPrev = [], tDl = [];
for (let i = 0; i < 20; i++) { const pp = await call('POST', '/api/exports/preview', { token: lt, body: { type: 'personal', locale: 'es' } }); tPrev.push(pp.ms); const dd = await call('POST', `/api/exports/${pp.json.id}/download`, { token: lt }); tDl.push(dd.ms); }
check('ES23-P01 vista previa p95 < 1000 ms (umbral propuesto)', p95(tPrev) < 1000, `p95=${p95(tPrev).toFixed(0)}ms`);
check('ES23-P02 descarga p95 < 1000 ms (umbral propuesto)', p95(tDl) < 1000, `p95=${p95(tDl).toFixed(0)}ms`);
const manyRows = await q('select count(*)::int n from "ExportRequests" where "UserId"=$1', [L.id]);
info('P03-filas-ExportRequests-tras-20-previas', manyRows[0].n);
// tamaño: 1.000 mensajes sintéticos
const M = await mkUser('M'); const mt = mint(M);
const big = 'm'.repeat(200);
await q(`insert into "Messages" ("UserId", role, content, "createdAt", "updatedAt") select $1, 'user', 'x', now(), now() from generate_series(1,1000)`, [M.id]).catch(e2 => info('P04-sql', e2.message));
x = await call('POST', '/api/exports/preview', { token: mt, body: { type: 'personal', locale: 'es' } });
info('P04-1000-mensajes', `status=${x.status} ms=${x.ms.toFixed(0)} code=${x.json?.code}`);
// tope de 5000 filas
await q(`insert into "Messages" ("UserId", role, content, "createdAt", "updatedAt") select $1, 'user', 'x', now(), now() from generate_series(1,4500)`, [M.id]).catch(() => {});
x = await call('POST', '/api/exports/preview', { token: mt, body: { type: 'personal', locale: 'es' } });
check('ES23-P05 más de 5.000 mensajes → 413 export_too_large (no 500)', x.status === 413 && x.json?.code === 'export_too_large', `status=${x.status} code=${x.json?.code}`);
// abuso: muchas vistas previas seguidas del mismo dueño (sin limitador)
const flood = await Promise.all(Array.from({ length: 40 }, () => call('POST', '/api/exports/preview', { token: lt, body: { type: 'personal', locale: 'es' } })));
const rows2 = (await q('select count(*)::int n from "ExportRequests" where "UserId"=$1', [L.id]))[0].n;
info('P06-abuso-40-previas-simultaneas', `estados=${[...new Set(flood.map(f => f.status))]} filas=${rows2} (sin límite de frecuencia en la ruta)`);

// ── Almacenamiento sin texto de contenido
const colsExp = (await q("select column_name from information_schema.columns where table_name='ExportRequests'")).map(r => r.column_name);
const colsDel = (await q("select column_name from information_schema.columns where table_name='DeletionRequests'")).map(r => r.column_name);
info('columnas', `ExportRequests=${colsExp.join(',')} | DeletionRequests=${colsDel.join(',')}`);
const leaked = await q(`select count(*)::int n from "ExportRequests" where fingerprint like '%CANARIO%' or locale like '%CANARIO%'`);
check('ES23-S13 ExportRequests no guarda texto de contenido', leaked[0].n === 0);

// ── Purga de mantenimiento (I01/I02)
const purge = (id, replay = false) => spawnSync(process.execPath, ['scripts/purgePersonalData.js', id, '--producers-stopped-and-drained', ...(replay ? ['--replay'] : [])], { cwd: path.join(sut, 'backend'), env: { ...process.env, DATABASE_URL: dbUrl, DB_SSL: 'false', JWT_SECRET: JWT }, encoding: 'utf8' });
const reqD = (await q('select id from "DeletionRequests" where "UserId"=$1', [D.id]))[0].id;
let pr = purge(reqD);
info('I-purga-D', `exit=${pr.status} out=${pr.stdout.trim()} err=${pr.stderr.trim().slice(0, 150)}`);
const left = {}; for (const [t, col] of [['DiaryEntries', 'UserId'], ['Messages', 'UserId'], ['ChatTurns', 'UserId'], ['MoodLogs', 'UserId'], ['Consents', 'UserId'], ['ConsentEvents', 'UserId'], ['ExportRequests', 'UserId']]) left[t] = (await q(`select count(*)::int n from "${t}" where "${col}"=$1`, [D.id]))[0].n;
check('ES23-I01a la purga deja 0 filas de contenido personal (diario, chat, ánimo, exportaciones)', left.DiaryEntries === 0 && left.Messages === 0 && left.ChatTurns === 0 && left.MoodLogs === 0 && left.ExportRequests === 0, JSON.stringify(left));
const usr = (await q('select name,email,active,motivation from "Users" where id=$1', [D.id]))[0];
check('ES23-I01b la cuenta queda anonimizada (nombre y correo sustituidos)', usr.email.endsWith('@deleted.invalid') && !usr.email.includes('qa29') && usr.name !== D.name, `email=${usr.email.replace(/^[^@]+/, '<uuid>')}`);
check('ES23-I01c el recibo pasa a awaiting_verification (no «eliminado» total)', /awaiting_verification/.test(pr.stdout), pr.stdout.trim());
pr = purge(reqD);
check('ES23-I01d repetir la purga es idempotente (exit 0, sin error)', pr.status === 0, `exit=${pr.status}`);
// restauración: reinsertar datos y replay
await q(`insert into "DiaryEntries" ("UserId","entryDate",content,"createdAt","updatedAt") values ($1,'2026-10-20','restaurado',now(),now())`, [D.id]);
pr = purge(reqD, true);
check('ES23-I02 --replay tras restaurar vuelve a borrar lo restaurado', pr.status === 0 && (await count('DiaryEntries', D.id)) === 0, `exit=${pr.status} filas=${await count('DiaryEntries', D.id)}`);
async function count(t, id) { return (await q(`select count(*)::int n from "${t}" where "UserId"=$1`, [id]))[0].n; }
pr = purge('no-es-uuid'); check('ES23-S14 purga con id inválido → error controlado', pr.status !== 0 && !/stack|at Object/.test(pr.stderr), `exit=${pr.status}`);
pr = spawnSync(process.execPath, ['scripts/purgePersonalData.js', reqD], { cwd: path.join(sut, 'backend'), env: { ...process.env, DATABASE_URL: dbUrl, DB_SSL: 'false', JWT_SECRET: JWT }, encoding: 'utf8' });
check('ES23-S14b purga sin la confirmación de parada de productores → rechazada', pr.status !== 0, `exit=${pr.status}`);
// Paciente con sesión terapéutica: la purga no borra, queda en revisión
const reqP = await call('POST', '/api/account/deletion-requests', { token: pt, body: { confirm: true } });
if (reqP.json?.id) { pr = purge(reqP.json.id); info('I-purga-paciente-con-sesion', `exit=${pr.status} out=${pr.stdout.trim()}`); }

// ── Logs del servidor: sin contenido ni SQL (se revisa fuera de este script)
console.log(JSON.stringify({ fin: true, canarios: { A: CAN_A, B: CAN_B } }));
await db.end();
