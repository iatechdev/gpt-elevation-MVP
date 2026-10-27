// [QA-Claude] ES-14 · PR #32 (entrada bilingüe y contexto privado versionado) — parte de API contra Postgres REAL local. Sin IA.
// Uso: QA_SUT=<clon> QA_API=http://127.0.0.1:8095 DATABASE_URL=<base> QA_JWT_SECRET=<el del servidor> DATA_ENCRYPTION_KEY=<el del servidor> node qa/integration/es14-real-db.mjs
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
  const email = `qa14-${tag}-${stamp}@example.test`, password = randomBytes(14).toString('base64url') + 'aA1!';
  const r = await call('POST', '/api/register', { body: { name: 'QA14 ' + tag, email, password } });
  if (r.status !== 201) throw new Error('registro ' + tag + ' ' + r.status);
  if (role !== 'user') await q('update "Users" set role=$1 where email=$2', [role, email]);
  return { tag, email, password, ...(await q('select id,name,role from "Users" where email=$1', [email]))[0] };
};
const p95 = a => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.ceil(s.length * 0.95) - 1)]; };
const dec = (t) => req(path.join(sut, 'backend', 'utils', 'crypto.js')).desencriptar(t);
const CAN = 'CANARIO-CTX-' + randomBytes(3).toString('hex');
const ctx = (over = {}) => ({ preferredLanguage: 'es', residenceCountry: 'CO', targetMarket: 'DK', timeZone: 'America/Bogota', profession: 'Docente ' + CAN, interests: 'datos, educación', availabilityMinutesPerWeek: 300, careerGoal: null, careerConstraints: null, ...over });
const put = (t, version, action, context, extra = {}) => call('PUT', '/api/user/context', { token: t, body: { schemaVersion: 1, expectedVersion: version, action, context, ...extra } });
const A = await mkUser('A'), B = await mkUser('B'), ADM = await mkUser('adm', 'admin'), SU = await mkUser('su', 'superadmin'), TH = await mkUser('th', 'therapist'), BRD = await mkUser('brd', 'board');
const a = mint(A), b = mint(B);

// ── Acceso
let r = await call('GET', '/api/user/context');
check('ES14-S01 GET sin token → rechazado', [401, 403].includes(r.status), `status=${r.status}`);
r = await call('PUT', '/api/user/context', { body: { schemaVersion: 1, expectedVersion: 0, action: 'save_draft', context: ctx() } });
check('ES14-S01b PUT sin token → rechazado', [401, 403].includes(r.status), `status=${r.status}`);
r = await call('GET', '/api/user/context', { token: 'basura.no.jwt' });
check('ES14-S01c token inválido → rechazado', [401, 403].includes(r.status), `status=${r.status}`);
for (const [who, u] of [['admin', ADM], ['superadmin', SU], ['terapeuta', TH], ['board', BRD]]) {
  const x = await call('GET', '/api/user/context', { token: mint(u) }), y = await put(mint(u), 0, 'save_draft', ctx());
  check(`ES14-S03 ${who} → 403 en GET y PUT`, x.status === 403 && y.status === 403, `GET=${x.status} PUT=${y.status}`);
}
// cuenta desactivada / rol cambiado con token vigente
const Z = await mkUser('Z'); const z = mint(Z);
await q('update "Users" set active=false where id=$1', [Z.id]);
check('ES14-S04 token vigente de una cuenta desactivada → 403', (await call('GET', '/api/user/context', { token: z })).status >= 400, `status=${(await call('GET', '/api/user/context', { token: z })).status}`);
const Y = await mkUser('Y'); const y2 = mint(Y);
await q(`update "Users" set role='therapist' where id=$1`, [Y.id]);
check('ES14-S04b token con rol «user» pero la base ya dice terapeuta → 403', (await call('GET', '/api/user/context', { token: y2 })).status >= 400, `status=${(await call('GET', '/api/user/context', { token: y2 })).status}`);
// snapshot vacío
r = await call('GET', '/api/user/context', { token: a });
check('ES14-F01 GET inicial: version 0, context null, completedAt null, sin inventar datos', r.status === 200 && r.json?.version === 0 && r.json.context === null && r.json.completedAt === null && r.json.savedAt === null, JSON.stringify(r.json));
check('ES14-S07 no-store', /no-store/.test(r.headers.get('cache-control') || ''), r.headers.get('cache-control'));

// ── Guardado parcial y completo
const partial = ctx({ residenceCountry: null, targetMarket: null, timeZone: null, profession: null, interests: null, availabilityMinutesPerWeek: null });
r = await put(a, 0, 'save_draft', partial);
check('ES14-F08a guardar borrador parcial (solo idioma) → 200 versión 1 y sin completedAt', r.status === 200 && r.json?.version === 1 && r.json.completedAt === null && r.json.context.preferredLanguage === 'es' && r.json.context.profession === null, `status=${r.status} ${r.text.slice(0, 120)}`);
r = await call('GET', '/api/user/context', { token: a });
check('ES14-F08b recuperar tras «recarga»: los mismos valores', r.json?.version === 1 && r.json.context.preferredLanguage === 'es', '');
r = await put(a, 1, 'save_draft', ctx());
check('ES14-F03 guardar todos los campos: cada valor en su campo y sin completedAt', r.status === 200 && r.json?.version === 2 && r.json.context.residenceCountry === 'CO' && r.json.context.targetMarket === 'DK' && r.json.context.timeZone === 'America/Bogota' && r.json.context.availabilityMinutesPerWeek === 300 && r.json.completedAt === null, `status=${r.status}`);
r = await put(a, 2, 'continue', ctx());
check('ES14-F13a continuar → completedAt confirmado por el servidor', r.status === 200 && r.json?.version === 3 && !!r.json.completedAt, `status=${r.status}`);
// 'continue' con casi todo vacío
const C2 = await mkUser('C2'); const c2 = mint(C2);
r = await put(c2, 0, 'continue', ctx({ residenceCountry: null, targetMarket: null, timeZone: null, profession: null, interests: null, availabilityMinutesPerWeek: null }));
info('F13-continuar-casi-vacío', `status=${r.status} completedAt=${r.json?.completedAt ? 'sí' : 'no'} (solo el idioma es obligatorio)`);
check('ES14-F13b continuar sin idioma → 400 invalid_context (preferredLanguage)', (await put(mint(await mkUser('C3')), 0, 'continue', ctx({ preferredLanguage: null }))).status === 400, '');
r = await put(a, 3, 'save_draft', ctx({ profession: 'Nueva profesión' }));
check('ES14-F13c editar tras completar conserva completedAt y sube la versión', r.status === 200 && r.json?.version === 4 && !!r.json.completedAt, `status=${r.status}`);
// ── Cifrado e invalidación
const row = (await q('select content, version, "completedAt" from "ParticipantContexts" where "UserId"=$1', [A.id]))[0];
check('ES14-S06 el contenido está cifrado v2 en la base y no hay texto plano', /^v2:/.test(row.content) && !row.content.includes('Docente') && !row.content.includes(CAN), row.content.slice(0, 8));
check('ES14-S06b descifrado coincide con lo enviado y no contiene claves de puerta ni relato', (() => { const o = JSON.parse(dec(row.content)); return o.profession === 'Nueva profesión' && !('door' in o) && !('puerta' in o) && Object.keys(o).sort().join() === Object.keys(ctx()).sort().join(); })(), '');
const inv = await q(`select "sourceType", reason, "sourceId" from "DerivedInvalidations" where "UserId"=$1`, [A.id]);
check('ES14-S08 las ediciones generan DerivedInvalidation (participant_context) sin contenido', inv.length >= 2 && inv.every(x => x.sourceType === 'participant_context') && !JSON.stringify(inv).includes('Docente'), `eventos=${inv.length}`);

// ── Versiones y 409
r = await put(a, 2, 'save_draft', ctx());
check('ES14-F09 versión vieja → 409 context_conflict y no se pisa', r.status === 409 && r.json?.error === 'context_conflict' && (await q('select version from "ParticipantContexts" where "UserId"=$1', [A.id]))[0].version === 4, `status=${r.status}`);
r = await put(a, 99, 'save_draft', ctx());
check('ES14-F09b versión futura → 409', r.status === 409, `status=${r.status}`);
// ── Validación
const bad = async (id, body, expect = 400) => { const x = await call('PUT', '/api/user/context', { token: a, body }); check(id, x.status === expect, `status=${x.status} ${x.text.slice(0, 100)}`); return x; };
const B0 = (over = {}) => ({ schemaVersion: 1, expectedVersion: 4, action: 'save_draft', context: ctx(), ...over });
await bad('ES14-V01 clave extra en el cuerpo → 400', B0({ userId: B.id }));
await bad('ES14-V02 clave extra en el contexto → 400 invalid_context', B0({ context: { ...ctx(), isAdmin: true } }));
await bad('ES14-V03 schemaVersion distinta → 400', B0({ schemaVersion: 2 }));
await bad('ES14-V04 action desconocida → 400', B0({ action: 'delete' }));
await bad('ES14-V05 expectedVersion negativa, decimal o texto → 400', B0({ expectedVersion: -1 }));
await bad('ES14-V05b expectedVersion decimal → 400', B0({ expectedVersion: 1.5 }));
await bad('ES14-V05c expectedVersion como texto → 400', B0({ expectedVersion: '4' }));
await bad('ES14-V06 país fuera de la lista cerrada → 400', B0({ context: ctx({ residenceCountry: 'ZZ' }) }));
await bad('ES14-V06b mercado con SQL → 400', B0({ context: ctx({ targetMarket: "CO'; drop table \"Users\";--" }) }));
await bad('ES14-V07 zona horaria inválida → 400', B0({ context: ctx({ timeZone: 'Marte/Olimpo' }) }));
await bad('ES14-V07b zona horaria sin «/» salvo UTC → 400', B0({ context: ctx({ timeZone: 'Bogota' }) }));
await bad('ES14-V08 minutos negativos → 400', B0({ context: ctx({ availabilityMinutesPerWeek: -5 }) }));
await bad('ES14-V08b minutos fraccionarios → 400', B0({ context: ctx({ availabilityMinutesPerWeek: 12.5 }) }));
await bad('ES14-V08c minutos 10081 (más de una semana) → 400', B0({ context: ctx({ availabilityMinutesPerWeek: 10081 }) }));
await bad('ES14-V08d minutos como texto → 400', B0({ context: ctx({ availabilityMinutesPerWeek: '300' }) }));
await bad('ES14-V09 idioma «fr» → 400', B0({ context: ctx({ preferredLanguage: 'fr' }) }));
await bad('ES14-V10 profesión de 121 caracteres → 400', B0({ context: ctx({ profession: 'x'.repeat(121) }) }));
await bad('ES14-V10b intereses de 501 caracteres → 400', B0({ context: ctx({ interests: 'x'.repeat(501) }) }));
await bad('ES14-V10c texto como objeto → 400', B0({ context: ctx({ profession: { $ne: 1 } }) }));
await bad('ES14-V11 contexto con campo faltante (undefined) → 400', B0({ context: (() => { const c = ctx(); delete c.interests; return c; })() }));
const protoB = await call('PUT', '/api/user/context', { token: a, body: '{"schemaVersion":1,"expectedVersion":4,"action":"save_draft","context":{"__proto__":{"admin":true}}}' });
check('ES14-V12 __proto__ → 400', protoB.status === 400, `status=${protoB.status}`);
const arrB = await call('PUT', '/api/user/context', { token: a, body: '[]' });
check('ES14-V13 cuerpo que no es objeto → 400', arrB.status === 400, `status=${arrB.status}`);
const xss = await put(a, 4, 'save_draft', ctx({ profession: '<script>alert(1)</script> \'; --', interests: '${7*7} {{7*7}}' }));
check('ES14-V14 HTML y plantillas se guardan como dato (200, JSON)', xss.status === 200 && /application\/json/.test(xss.headers.get('content-type') || ''), `status=${xss.status}`);
const ws = await put(a, 5, 'save_draft', ctx({ profession: '   ', interests: '' }));
check('ES14-V15 cadenas vacías o de espacios se guardan como null (sin inventar)', ws.status === 200 && ws.json.context.profession === null && ws.json.context.interests === null, JSON.stringify([ws.json?.context?.profession, ws.json?.context?.interests]));
// identidad ajena
for (const [label, u2, m, body] of [['query ?userId=', `/api/user/context?userId=${A.id}`, 'GET'], ['ruta /:id', `/api/user/context/${A.id}`, 'GET'], ['ruta /:id PUT', `/api/user/context/${A.id}`, 'PUT', B0()], ['DELETE', `/api/user/context`, 'DELETE']]) {
  const x = await call(m, u2, { token: b, body });
  check(`ES14-S02 B con ${label} no obtiene datos de A (400/404/403, nunca 200 con datos)`, x.status !== 200 && !x.text.includes(CAN) && !x.text.includes('Nueva profesión') && x.status < 500, `status=${x.status}`);
}
const gb = await call('GET', '/api/user/context', { token: b });
check('ES14-S02b el GET de B devuelve su propio estado vacío, sin nada de A', gb.status === 200 && gb.json.context === null && !gb.text.includes(CAN), '');
const pb = await put(b, 0, 'save_draft', ctx({ profession: 'Profesión de B' }));
check('ES14-S02c B escribe solo en su propio contexto; el de A no cambia', pb.status === 200 && (await q('select count(*)::int n from "ParticipantContexts" where "UserId" in ($1,$2)', [A.id, B.id]))[0].n === 2 && JSON.parse(dec((await q('select content from "ParticipantContexts" where "UserId"=$1', [A.id]))[0].content)).profession === null, '');

// ── Concurrencia
const E = await mkUser('E'); const e = mint(E);
const firsts = await Promise.all(Array.from({ length: 8 }, (_, i) => put(e, 0, 'save_draft', ctx({ profession: 'p' + i }))));
const rowsE = (await q('select count(*)::int n from "ParticipantContexts" where "UserId"=$1', [E.id]))[0].n;
check('ES14-C01 8 primeros guardados simultáneos: una sola fila, uno gana y 7 con 409, ningún 5xx', rowsE === 1 && firsts.filter(x => x.status === 200).length === 1 && firsts.filter(x => x.status === 409).length === 7 && firsts.every(x => x.status < 500), `filas=${rowsE} estados=${firsts.map(x => x.status).sort()}`);
const eds = await Promise.all(Array.from({ length: 8 }, (_, i) => put(e, 1, 'save_draft', ctx({ profession: 'e' + i }))));
check('ES14-C01b 8 ediciones con la misma versión: una gana y 7 con 409', eds.filter(x => x.status === 200).length === 1 && eds.filter(x => x.status === 409).length === 7 && eds.every(x => x.status < 500), `estados=${eds.map(x => x.status).sort()}`);
check('ES14-C01c la versión final es consecutiva (2)', (await q('select version from "ParticipantContexts" where "UserId"=$1', [E.id]))[0].version === 2, '');

// ── Migración
const mig = (n) => spawnSync(process.execPath, ['-e', `process.env.DB_SSL='false';const {sequelize}=require('./database');const m=require('./migrations/001-participant-context.cjs');(async()=>{try{await m.up(sequelize.getQueryInterface(), sequelize.constructor);console.log('OK')}catch(e){console.log('ERR '+e.message)}await sequelize.close();process.exit(0)})()`], { cwd: path.join(sut, 'backend'), env: { ...process.env, DATABASE_URL: dbUrl, DB_SSL: 'false', JWT_SECRET: JWT }, encoding: 'utf8' });
const m1 = mig(1), m2 = mig(2);
check('ES14-C02 la migración se aplica dos veces sobre una tabla ya creada por sync() sin error y sin tocar datos', /OK/.test(m1.stdout) && /OK/.test(m2.stdout) && (await q('select count(*)::int n from "ParticipantContexts"'))[0].n >= 3, `${m1.stdout.trim().slice(-60)} | ${m2.stdout.trim().slice(-60)}`);
const fk = await q(`select confdeltype from pg_constraint where conrelid='"ParticipantContexts"'::regclass and contype='f'`);
const uq = await q(`select indexdef from pg_indexes where tablename='ParticipantContexts'`);
check('ES14-C03 FK con CASCADE y UserId único', fk.some(x => x.confdeltype === 'c') && uq.some(x => /UNIQUE/i.test(x.indexdef) && /UserId/.test(x.indexdef)), `fk=${fk.map(x => x.confdeltype)} idx=${uq.length}`);
// borrar el usuario borra su contexto (CASCADE)
const D = await mkUser('D'); await put(mint(D), 0, 'save_draft', ctx());
await q('delete from "Users" where id=$1', [D.id]);
check('ES14-C04 borrar la cuenta (fila de User) elimina el contexto por CASCADE', (await q('select count(*)::int n from "ParticipantContexts" where "UserId"=$1', [D.id]))[0].n === 0, '');

// ── Login (servidor): el login no devuelve el contexto
const lg = await call('POST', '/api/login', { body: { email: A.email, password: A.password } });
check('ES14-F13d el login no incluye el contexto del participante', lg.status === 200 && !lg.text.includes('Nueva profesión') && !/"context"/.test(lg.text), `status=${lg.status}`);

// ── Rendimiento
const tg = [], tp = []; let ver = (await call('GET', '/api/user/context', { token: a })).json.version;
for (let i = 0; i < 20; i++) { tg.push((await call('GET', '/api/user/context', { token: a })).ms); const x = await put(a, ver, 'save_draft', ctx({ profession: 'r' + i })); tp.push(x.ms); ver = x.json?.version ?? ver; }
check('ES14-P01 GET p95 < 1000 ms (propuesto)', p95(tg) < 1000, `p95=${p95(tg).toFixed(0)}ms`);
check('ES14-P02 PUT p95 < 1000 ms (propuesto)', p95(tp) < 1000, `p95=${p95(tp).toFixed(0)}ms`);

// ── Logs: ver fuera del script
console.log(JSON.stringify({ fin: true, canario: CAN }));
await db.end();
