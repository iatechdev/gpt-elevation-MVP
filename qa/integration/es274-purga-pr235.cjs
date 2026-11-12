// [QA-Claude] ES-274 · PR #235 (purga opción A) · base DESECHABLE LOCAL (Postgres embebido 127.0.0.1), datos sintéticos, 0 IA. NADA de Supabase ni de datos reales.
// Uso: QA_SUT=<clon con la fusión> PGADMIN=postgres://usuario:clave@127.0.0.1:54459/postgres [QA_OUT=<carpeta>] [MODE=main] node qa/integration/es274-purga-pr235.cjs
// MODE=main: control contra main (esperado: persona con notas/emparejamiento queda en awaiting_review).
const { createRequire } = require('node:module'); const path = require('node:path'); const fs = require('node:fs'); const crypto = require('node:crypto'); const { spawnSync } = require('node:child_process'); const { once } = require('node:events');
const E = process.env; const B = path.join(E.QA_SUT, 'backend'); const req = createRequire(path.join(B, 'package.json')); const { Client } = req('pg'); const { Sequelize } = req('sequelize'); const express = req('express');
const MAIN = E.MODE === 'main';
if (!/@(127\.0\.0\.1|localhost)[:/]/.test(E.PGADMIN || '')) throw new Error('PGADMIN debe ser local');
const results = []; const check = (id, ok, d = '') => { results.push({ id, ok: !!ok, detail: String(d).slice(0, 900) }); console.log(JSON.stringify({ id, ok: !!ok, detail: String(d).slice(0, 900) })); };
const info = (id, d) => { results.push({ id, info: String(d).slice(0, 1500) }); console.log(JSON.stringify({ id, info: String(d).slice(0, 1500) })); };
const sleep = ms => new Promise(r => setTimeout(r, ms)); const md5 = s => crypto.createHash('md5').update(s).digest('hex');
const FORBID = /anonim|desvincul|anonymi[sz]|de-?identif|unlink|desidentific/i; const PLAZO = /\b\d+\s*(días|dias|horas|days|hours|semanas|weeks|meses|months)\b/i;
(async () => {
  const DBN = 'qa274_' + crypto.randomBytes(5).toString('hex'); const adm = new Client({ connectionString: E.PGADMIN }); await adm.connect(); await adm.query(`CREATE DATABASE "${DBN}"`);
  const u = new URL(E.PGADMIN); u.pathname = '/' + DBN; const URL_ = u.toString();
  const keys = { jwt: crypto.randomBytes(32).toString('hex'), dek: crypto.randomBytes(32).toString('hex') };
  const mig = spawnSync(process.execPath, ['node_modules/sequelize-cli/lib/sequelize', 'db:migrate'], { cwd: B, encoding: 'utf8', timeout: 300000, env: { ...process.env, DATABASE_URL: URL_, DB_SSL: 'false', NODE_ENV: 'test', JWT_SECRET: keys.jwt, DATA_ENCRYPTION_KEY: keys.dek } });
  if (mig.status !== 0) throw new Error('migraciones: ' + (mig.stdout + mig.stderr).slice(-400));
  const app = new Sequelize(URL_, { logging: false, dialectOptions: { ssl: false }, pool: { max: 5, min: 0, acquire: 15000 } });
  process.env.JWT_SECRET = keys.jwt; process.env.DATA_ENCRYPTION_KEY = keys.dek; process.env.NODE_ENV = 'test'; process.env.DATA_RIGHTS_ENABLED = 'true'; process.env.AI_BUDGET_TOKENS_PER_USER = '1000000000'; process.env.AI_BUDGET_PERIOD = 'month';
  const dbModule = req.resolve('./database'); req.cache = req.cache; require.cache[dbModule] = { id: dbModule, filename: dbModule, loaded: true, exports: { sequelize: app, connectDB: async () => {} } };
  const mm = req.resolve('./utils/mailer'); const realMailer = req('./utils/mailer'); require.cache[mm] = { id: mm, filename: mm, loaded: true, exports: { ...realMailer, sendInvitation: async () => ({ sent: true }) } };
  const am = req.resolve('./utils/anthropic'); require.cache[am] = { id: am, filename: am, loaded: true, exports: { MODEL: 'sintetico', messages: { create: async () => ({ content: [{ type: 'text', text: 'x' }], usage: { input_tokens: 1, output_tokens: 1 } }) } } };
  req('./associations')();
  const { issueToken } = req('./utils/sessions'); const { verificarToken, verificarAdmin, verificarTerapeuta } = req('./middlewares/auth');
  const api = express(); api.use(express.json());
  api.use('/api/admin/usuarios', verificarAdmin, req('./routes/adminUsers')); api.use('/api/sessions', verificarToken, req('./routes/sessions')); api.use('/api/therapist', verificarTerapeuta, req('./routes/therapistRoutes')); api.use('/api', req('./routes/dataRights'));
  const server = api.listen(0, '127.0.0.1'); await once(server, 'listening'); const base = `http://127.0.0.1:${server.address().port}`;
  const db = new Client({ connectionString: URL_, ssl: false }); await db.connect(); const q = async (s, p = []) => (await db.query(s, p)).rows;
  const http = async (who, method, route, body) => { const r = await fetch(base + route, { method, headers: { ...(who ? { Authorization: 'Bearer ' + who.token } : {}), 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }); const text = await r.text(); let json = null; try { json = JSON.parse(text); } catch { /* */ } return { status: r.status, json, text }; };
  const rights = req('./utils/dataRights'); const { processDeletion } = req('./utils/deletionProcessor'); const PD = req('./utils/personalData');
  const M = n => req('./' + n);
  const ucols = await q(`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='Users' AND is_nullable='NO' AND column_default IS NULL AND column_name <> 'id'`);
  const idType = (await q(`select data_type from information_schema.columns where table_schema='public' and table_name='Users' and column_name='id'`))[0].data_type;
  let seq = 0; const CAN = {};
  const mkUser = async (role, tag, extra = {}) => {
    seq++; const names = [], vals = []; const nm = `NOMBRE-${tag}-${DBN}`; const em = `canario-${tag}-${DBN}@example.test`;
    for (const c of ucols) { let v; if (c.column_name === 'role') v = role; else if (c.column_name === 'name') v = nm; else if (c.column_name === 'email') v = em; else if (c.data_type.includes('char') || c.data_type === 'text') v = `s-${seq}-${c.column_name}`; else if (c.data_type === 'integer') v = 0; else if (c.data_type === 'boolean') v = true; else if (c.data_type.startsWith('timestamp')) v = new Date(); else v = '{}'; names.push(`"${c.column_name}"`); vals.push(v); }
    const id = (await q(`INSERT INTO "Users" (${names.join(',')}) VALUES (${vals.map((_, i) => `$${i + 1}`).join(',')}) RETURNING id`, vals))[0].id;
    await q('UPDATE "Users" SET role=$2, active=true, "therapistId"=$3 WHERE id=$1', [id, role, extra.therapistId ?? null]);
    CAN[id] = { name: nm, email: em, tag }; return { id, role, tag, name: nm, email: em, token: issueToken({ id, role }) };
  };
  // ---------- esquema
  const tables = (await q(`select table_name t from information_schema.tables where table_schema='public' and table_type='BASE TABLE' and table_name<>'SequelizeMeta'`)).map(r => r.t);
  const allCols = await q(`select table_name t, column_name c, data_type d from information_schema.columns where table_schema='public'`);
  const idLike = /(user|patient|therapist|person|owner|actor|target|uploaded|resolved|chosen|assigned|created|updated|reviewed|published|by)(id)?$|^id$/i;
  const idCols = allCols.filter(x => ['uuid', 'integer', 'bigint', 'character varying', 'text'].includes(x.d) && idLike.test(x.c) && !(x.c === 'id' && x.t !== 'Users'));
  const fks = await q(`select kcu.table_name t, kcu.column_name c from information_schema.referential_constraints rc join information_schema.key_column_usage kcu on kcu.constraint_name=rc.constraint_name and kcu.constraint_schema=rc.constraint_schema join information_schema.constraint_column_usage ccu on ccu.constraint_name=rc.unique_constraint_name where ccu.table_name='Users'`);
  const SESSION5 = ['patientMoodAfter', 'cancelReason', 'meetingUrl', 'recordingUrl', 'googleEventId'];
  const refs = async (id) => { const out = {}; for (const x of idCols) { const n = (await q(`select count(*)::int n from "${x.t}" where "${x.c}"::text=$1`, [String(id)]))[0].n; if (n) out[x.t + '.' + x.c] = n; } return out; };
  const canaryHits = async (needle) => { const out = {}; for (const t of tables) { const n = (await q(`select count(*)::int n from "${t}" x where x::text like $1`, ['%' + needle + '%']))[0].n; if (n) out[t] = n; } return out; };
  const dump = async (id, { skipTables = [], dropWith = [] } = {}) => { // huella de las filas que mencionan a `id` (sin las 5 columnas de persona en sesiones)
    const out = {}; for (const x of idCols) { const rows = await q(`select row_to_json(x) j from "${x.t}" x where "${x.c}"::text=$1 order by 1::text`, [String(id)]); for (const r of rows) { const j = { ...r.j }; if (x.t === 'TherapySessions') { for (const k of SESSION5) delete j[k]; delete j.updatedAt; } if (skipTables.includes(x.t)) continue; const s = JSON.stringify(j); if (dropWith.some(w => s.includes(String(w)))) continue; (out[x.t] ||= new Set()).add(s); } }
    return md5(JSON.stringify(Object.keys(out).sort().map(t => [t, [...out[t]].sort()])));
  };
  // ---------- siembra genérica
  const colsOf = (t) => q(`select column_name n,data_type d,udt_name u from information_schema.columns where table_schema='public' and table_name=$1 and is_nullable='NO' and column_default is null and column_name<>'id'`, [t]);
  const seedGeneric = async (t, over) => {
    const cols = await colsOf(t); const names = [], vals = [];
    for (const k of cols) { let v; if (k.n in over) v = over[k.n]; else if (/timestamp/.test(k.d)) v = new Date(); else if (k.d === 'uuid') v = crypto.randomUUID(); else if (/int|numeric|double|real/.test(k.d)) v = 1; else if (k.d === 'boolean') v = false; else if (/json/.test(k.d)) v = '{}'; else if (k.d === 'USER-DEFINED') v = (await q(`select enumlabel from pg_enum e join pg_type t on t.oid=e.enumtypid where t.typname=$1 order by enumsortorder limit 1`, [k.u]))[0]?.enumlabel; else if (k.d === 'date') v = '2026-10-01'; else v = 'qa'; names.push(`"${k.n}"`); vals.push(v); }
    for (const [k, v] of Object.entries(over)) if (!cols.find(c => c.n === k)) { names.push(`"${k}"`); vals.push(v); }
    await q(`insert into "${t}" (${names.join(',')}) values (${vals.map((_, i) => `$${i + 1}`).join(',')})`, vals);
  };
  const EXCL = new Set(['Users', 'ClinicalNotes', 'TherapySessions', 'SessionNotes', 'MatchingRequests', 'TherapistProfiles', 'TherapistValidations', 'EthicManifests', 'PlanRequests', 'AdminAuditEntries', 'DeletionRequests', 'AuthRevocations', 'RevokedTokens', 'TherapistOrdinalCounters']);
  const seeded = [], unseeded = [];
  const NOTE = (tag) => `Nota del profesional ${tag}: ${CAN[tag.split('-')[0]]?.name || ''}`;
  const mkRich = async (tag, th, nSessions = 3) => {
    const p = await mkUser('user', tag, { therapistId: th.id });
    const mk = M('ClinicalNote'), TS = M('TherapySession'), SN = M('SessionNote'), MR = M('MatchingRequest');
    await mk.create({ UserId: p.id, therapistId: th.id, content: `Nota clinica ${p.name} CANARIO-NOTA`, type: 'session_note', sessionDate: '2026-10-01' });
    await mk.create({ UserId: p.id, therapistId: th.id, content: `Segunda nota ${p.name}`, type: 'session_note', sessionDate: '2026-10-08' });
    p.sessionIds = [];
    for (let i = 0; i < nSessions; i++) { const s = await TS.create({ therapistId: th.id, patientId: p.id, scheduledAt: new Date(Date.UTC(2026, 9, 1 + i, 15)), status: 'completed', duration: 50, therapistNote: `Nota de sesion ${p.name}`, patientMoodAfter: 4, cancelReason: 'motivo-persona-' + tag, meetingUrl: 'https://example.test/sala/' + tag, recordingUrl: 'https://example.test/grab/' + tag, googleEventId: 'evt-' + tag }); await SN.create({ sessionId: s.id, therapistId: th.id, content: `Nota en vivo ${p.name}` }); p.sessionIds.push(s.id); }
    await MR.create({ UserId: p.id, answers: '{"pregunta":"respuesta sintética"}', suggestions: '[]', chosenTherapistId: th.id, status: 'confirmed' });
    for (const f of fks) { if (EXCL.has(f.t)) continue; try { await seedGeneric(f.t, { [f.c]: p.id }); seeded.push(f.t + '.' + f.c); } catch { unseeded.push(f.t + '.' + f.c); } }
    return p;
  };
  const T1 = await mkUser('therapist', 'T1'), T2 = await mkUser('therapist', 'T2'); const SU = await mkUser('superadmin', 'SU');
  const A = await mkRich('A', T1), Bp = await mkRich('B', T1), C = await mkRich('C', T2);
  info('siembra', `Users.id=${idType}; tablas con clave hacia Users: ${fks.length}; sembradas para cada persona: ${seeded.length / 3 | 0}; no sembradas (requieren otras filas): ${[...new Set(unseeded)].join(',') || 'ninguna'}`);
  const pro = async (p) => { const r = []; for (const [t, w] of [['ClinicalNotes', '"UserId"'], ['TherapySessions', '"patientId"']]) { const rows = await q(`select row_to_json(x) j from "${t}" x where ${w}=$1 order by id`, [p.id]); r.push(rows.map(x => { const j = { ...x.j }; if (t === 'TherapySessions') { for (const k of SESSION5) delete j[k]; delete j.updatedAt; } return j; })); } r.push(await q(`select row_to_json(x) j from "SessionNotes" x where "sessionId" = any($1::int[]) order by id`, [p.sessionIds]).catch(async () => q(`select row_to_json(x) j from "SessionNotes" x where "sessionId"::text = any($1::text[]) order by id`, [p.sessionIds.map(String)]))); return JSON.stringify(r); };
  const five = async (p) => JSON.stringify(await q(`select "patientMoodAfter","cancelReason","meetingUrl","recordingUrl","googleEventId" from "TherapySessions" where "patientId"=$1 order by id`, [p.id]));
  const personRows = async (p) => JSON.stringify([await q('select id,answers,"chosenTherapistId" from "MatchingRequests" where "UserId"=$1 order by id', [p.id]), await five(p)]);
  const reqOf = async (p) => { await rights.requestDeletion(p.id); return (await q('select id from "DeletionRequests" where "UserId"=$1', [p.id]))[0].id; };
  const logs = []; const origErr = console.error, origLog = console.log, origWarn = console.warn; const capture = (on) => { if (on) { console.error = (...a) => logs.push(a.map(String).join(' ')); console.warn = console.error; } else { console.error = origErr; console.warn = origWarn; } };

  // ---------- control de aislamiento: huellas antes
  const before = { B: await dump(Bp.id), C: await dump(C.id), T2: await dump(T2.id), T1: await dump(T1.id, { dropWith: [A.id] }), Bpro: await pro(Bp), Bfive: await five(Bp), Bp: await personRows(Bp), Cp: await personRows(C), Apro: await pro(A) };
  const exportA_before = await rights.preview(A.id, { type: 'personal', locale: 'es' }).catch(e => ({ err: e.message }));
  // ---------- P1 purga y barrido
  const t0 = Date.now(); const reqA = await reqOf(A); const rec = await processDeletion(reqA, { quiescent: true }); const msA = Date.now() - t0;
  if (MAIN) { check('P0-main (control) en main la persona con emparejamiento y notas queda en awaiting_review y no se purga', rec.status === 'awaiting_review' && (await q('select count(*)::int n from "MatchingRequests" where "UserId"=$1', [A.id]))[0].n === 1, rec.status); await finish(); return; }
  const tomb = (await q('select name,email,active,role from "Users" where id=$1', [A.id]))[0];
  const refsA = await refs(A.id); const allowed = new Set(['Users.id', 'DeletionRequests.UserId', 'AuthRevocations.UserId', 'ClinicalNotes.UserId', 'TherapySessions.patientId', 'RevokedTokens.UserId', 'ProfessionalApplications.userId', 'TherapistPersonOrdinals.therapistId']); // PA: excepción ES-95 preexistente; TherapistPersonOrdinals.therapistId: artefacto de siembra genérica (la persona sembrada como profesional)
  const unexpected = Object.keys(refsA).filter(k => !allowed.has(k));
  const mailHits = await canaryHits(A.email.split('@')[0]); const nameHits = await canaryHits(A.name);
  const nameAllowed = new Set(['ClinicalNotes', 'SessionNotes', 'TherapySessions']);
  const nameUnexpected = Object.keys(nameHits).filter(t => !nameAllowed.has(t));
  check('P1a (bloqueante) purga de la persona rica → awaiting_verification, lápida sin nombre ni correo, recibo con `retained` (solo categorías)', rec.status === 'awaiting_verification' && /Cuenta eliminada/.test(tomb.name) && /@deleted\.invalid$/.test(tomb.email) && tomb.active === false && JSON.stringify(rec.retained) === '["clinicalNotes","sessionNotes","therapySessions"]', JSON.stringify({ rec, tomb }));
  check('P1b (bloqueante) barrido por esquema: toda columna que mencione a la persona queda solo en lo declarado (lápida, solicitud, revocaciones, notas y sesiones del profesional); ninguna otra tabla', unexpected.length === 0, `restos=${JSON.stringify(refsA)} inesperados=${unexpected.join(',')}`);
  check('P1c (bloqueante) el correo canario de la persona no aparece en NINGUNA tabla; su nombre canario solo en ClinicalNotes/SessionNotes/TherapySessions (texto libre del profesional, conservado por decisión)', Object.keys(mailHits).length === 0 && nameUnexpected.length === 0, `correo=${JSON.stringify(mailHits)} nombre=${JSON.stringify(nameHits)}`);
  const mrLeft = (await q('select count(*)::int n from "MatchingRequests" where "UserId"=$1', [A.id]))[0].n;
  check('P1d emparejamiento de la persona borrado; las 5 columnas de persona en sus 3 sesiones en NULL; todo lo demás de la fila igual', mrLeft === 0 && JSON.parse(await five(A)).every(r => SESSION5.every(k => r[k] === null)) && JSON.parse(await five(A)).length === 3, await five(A));
  check('P1e (bloqueante) lo que escribió el profesional queda IDÉNTICO fila a fila (notas clínicas, notas en vivo, sesiones sin las 5 columnas)', await pro(A) === before.Apro, '');
  // ---------- P2 aislamiento
  const afterB = { B: await dump(Bp.id), C: await dump(C.id), T2: await dump(T2.id), T1: await dump(T1.id, { dropWith: [A.id] }) };
  check('P2a (bloqueante) otra persona del mismo profesional (B), otra del otro profesional (C), el otro profesional (T2) y el propio T1 (sin lo de A) quedan idénticos', afterB.B === before.B && afterB.C === before.C && afterB.T2 === before.T2 && afterB.T1 === before.T1, JSON.stringify({ B: afterB.B === before.B, C: afterB.C === before.C, T2: afterB.T2 === before.T2, T1: afterB.T1 === before.T1 }));
  check('P2b B conserva sus 5 columnas de persona, su emparejamiento y sus notas; C también', await five(Bp) === before.Bfive && await personRows(Bp) === before.Bp && await personRows(C) === before.Cp && await pro(Bp) === before.Bpro, '');
  // ---------- P5 idempotencia
  const rec2 = await processDeletion(reqA, { quiescent: true }); const rowsOf = async () => { const o = {}; for (const x of idCols) { const rows = await q(`select row_to_json(x) j from "${x.t}" x where "${x.c}"::text=$1 order by 1::text`, [String(A.id)]); for (const r of rows) { o[x.t] = (o[x.t] || []).concat(JSON.stringify(r.j)); } } return o; };
  const rowsA1 = await rowsOf(); const dumpAfter1 = await dump(A.id, { skipTables: ['DeletionRequests', 'Users'] }); const rec3 = await processDeletion(reqA, { quiescent: true, replay: true }); const rowsA2 = await rowsOf(); const diffT = Object.keys({ ...rowsA1, ...rowsA2 }).filter(t => JSON.stringify(rowsA1[t]) !== JSON.stringify(rowsA2[t])); const diffDetail = diffT.map(t => t + ': ' + [...(rowsA1[t] || [])].filter(x => !(rowsA2[t] || []).includes(x)).map(x => { const o2 = JSON.parse(x); const m = (rowsA2[t] || []).map(JSON.parse).find(y => y.id === o2.id); return m ? Object.keys(o2).filter(k => JSON.stringify(o2[k]) !== JSON.stringify(m[k])).join('+') : 'fila desaparece'; }).join(';')).join(' | '); info('P5-diff', 'tablas que cambian con el --replay: ' + (diffDetail || 'ninguna')); const dumpAfter2 = await dump(A.id, { skipTables: ['DeletionRequests', 'Users'] });
  const unk = await processDeletion(crypto.randomUUID(), { quiescent: true }).then(() => 'resolvió', e => 'rechaza');
  check('P5a repetir y --replay: mismo recibo (con retained), lo conservado idéntico (el --replay solo renueva la lápida —contraseña aleatoria y updatedAt— y el contador de la solicitud: ver P5-diff); UUID desconocido falla sin tocar nada', rec2.status === 'awaiting_verification' && JSON.stringify(rec2.retained) === JSON.stringify(rec.retained) && rec3.status === 'awaiting_verification' && dumpAfter1 === dumpAfter2 && await pro(A) === before.Apro && unk === 'rechaza', `${rec2.status} ${rec3.status} ${unk} retainedIgual=${JSON.stringify(rec2.retained) === JSON.stringify(rec.retained)} dump=${dumpAfter1 === dumpAfter2} pro=${await pro(A) === before.Apro}`);
  // por el script de operador (ES-275)
  const S1 = await mkRich('S1', T1, 2); const reqS = await reqOf(S1);
  const runScript = (args) => spawnSync(process.execPath, ['scripts/purgePersonalData.js', ...args], { cwd: B, encoding: 'utf8', timeout: 120000, env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, DATABASE_URL: URL_, DB_SSL: 'false', JWT_SECRET: keys.jwt, DATA_ENCRYPTION_KEY: keys.dek, NODE_ENV: 'test' } });
  const s1 = runScript([reqS, '--producers-stopped-and-drained']); const s1b = runScript([reqS, '--producers-stopped-and-drained']); const s1r = runScript([reqS, '--producers-stopped-and-drained', '--replay']); const s1u = runScript([crypto.randomUUID(), '--producers-stopped-and-drained']);
  let j1 = null; try { j1 = JSON.parse(s1.stdout); } catch { /* */ }
  check('P5b por el script de operador (ES-275): primera, repetida y --replay → exit 0 con JSON (JSON mínimo `status`+`deadlinesVerified`, sin contenido); UUID desconocido → error; lo conservado sigue y lo de la persona se fue', s1.status === 0 && s1b.status === 0 && s1r.status === 0 && j1 && j1.status === 'awaiting_verification' && s1u.status !== 0 && (await q('select count(*)::int n from "MatchingRequests" where "UserId"=$1', [S1.id]))[0].n === 0 && JSON.parse(await five(S1)).every(r => SESSION5.every(k => r[k] === null)) && !/CANARIO|NOMBRE-/.test(s1.stdout + s1.stderr), `${s1.status}/${s1b.status}/${s1r.status}/${s1u.status} ${s1.stdout.slice(0, 160)}`);
  // ---------- P3 profesional sigue en revisión
  const casos = [];
  const mkRef = async (name, build) => { const x = await mkUser('user', 'R' + name); const mood = await seedGeneric('MoodLogs', { UserId: x.id }).then(() => true, () => false); try { await build(x); } catch (e) { casos.push(name + ': NO SEMBRADO ' + e.message.slice(0, 60)); return; } const rid = await reqOf(x); const out = await processDeletion(rid, { quiescent: true }); const still = (await q('select name from "Users" where id=$1', [x.id]))[0].name === x.name; const moods = (await q('select count(*)::int n from "MoodLogs" where "UserId"=$1', [x.id]))[0].n; if (!(out.status === 'awaiting_review' && still && (!mood || moods === 1) && !out.retained)) casos.push(`${name}: ${out.status} nombre=${still} moods=${moods}`); else casos.push(name + ': ok'); };
  const other = await mkUser('user', 'otra');
  await mkRef('ClinicalNote.therapistId', x => M('ClinicalNote').create({ UserId: other.id, therapistId: x.id, content: 'n', type: 'session_note', sessionDate: '2026-10-01' }));
  await mkRef('TherapySession.therapistId', x => M('TherapySession').create({ therapistId: x.id, patientId: other.id, scheduledAt: new Date(Date.UTC(2026, 10, 1, 15)), status: 'scheduled', duration: 50 }));
  await mkRef('SessionNote.therapistId', async x => { const s = await M('TherapySession').create({ therapistId: T2.id, patientId: other.id, scheduledAt: new Date(Date.UTC(2026, 10, 2, 15)), status: 'scheduled', duration: 50 }); await M('SessionNote').create({ sessionId: s.id, therapistId: x.id, content: 'n' }); });
  await mkRef('TherapistProfile.UserId', x => seedGeneric('TherapistProfiles', { UserId: x.id }));
  await mkRef('TherapistValidation.therapistId', x => seedGeneric('TherapistValidations', { therapistId: x.id }));
  await mkRef('MatchingRequest.chosenTherapistId', x => M('MatchingRequest').create({ UserId: other.id, answers: '{}', suggestions: '[]', chosenTherapistId: x.id, status: 'confirmed' }));
  await mkRef('EthicManifest.uploadedBy', x => seedGeneric('EthicManifests', { uploadedBy: x.id }));
  await mkRef('PlanRequest.resolvedBy', async x => { await seedGeneric('PricingPlans', { slug: 'qa-' + x.id }); const pid = (await q('select id from "PricingPlans" where slug=$1', ['qa-' + x.id]))[0].id; await seedGeneric('PlanRequests', { resolvedBy: x.id, userId: other.id, planId: pid }); });
  await mkRef('User.therapistId (asignados)', async x => { await q('update "Users" set "therapistId"=$1 where id=$2', [x.id, other.id]); });
  for (const role of ['therapist', 'admin', 'superadmin', 'board']) { const x = await mkUser(role, 'role-' + role); await seedGeneric('MoodLogs', { UserId: x.id }).catch(() => {}); const out = await processDeletion(await reqOf(x), { quiescent: true }); casos.push(`rol ${role}: ${out.status === 'awaiting_review' ? 'ok' : out.status}`); }
  check('P3 (bloqueante) cada referencia del lado del profesional/administración por separado (9) y los roles therapist/admin/superadmin/board → awaiting_review, nada borrado, sin `retained`', casos.every(c => c.endsWith(': ok')), casos.filter(c => !c.endsWith(': ok')).join(' | ') || casos.length + '/' + casos.length);
  // ---------- P4 rollback
  const stopHook = async (name) => { await q(`drop trigger if exists ${name} on "TherapySessions"`); await q(`drop trigger if exists ${name}2 on "MatchingRequests"`); await q(`drop trigger if exists ${name}3 on "Users"`); };
  await q(`create or replace function qa_fail() returns trigger language plpgsql as $$ begin raise exception 'QA fallo sintetico SELECT secreto'; end $$`);
  const rb = [];
  for (const [label, tbl, ev, cond] of [['sesiones (UPDATE)', 'TherapySessions', 'update', null], ['emparejamiento (DELETE)', 'MatchingRequests', 'delete', null], ['lápida (UPDATE Users)', 'Users', 'update', `when (new.name like 'Cuenta eliminada%')`]]) {
    const X = await mkRich('X' + rb.length, T1, 2); const rid = await reqOf(X); const snapAll = await dump(X.id, { skipTables: ['DeletionRequests'] }); const snapP = await personRows(X); const proX = await pro(X);
    await q(`create trigger qa_t before ${ev} on "${tbl}" for each row ${cond || ''} execute function qa_fail()`);
    logs.length = 0; capture(true); const res = await processDeletion(rid, { quiescent: true }).then(() => 'resolvió', e => e.message); capture(false);
    await q(`drop trigger qa_t on "${tbl}"`);
    const row = (await q('select status,"failureCode" from "DeletionRequests" where id=$1', [rid]))[0]; const leak = (res + logs.join(' ') + JSON.stringify(row)).match(/SELECT secreto|NOMBRE-|CANARIO|qa_fail|Nota/i);
    const same = (await dump(X.id, { skipTables: ['DeletionRequests'] })) === snapAll && (await personRows(X)) === snapP && (await pro(X)) === proX && (await q('select active from "Users" where id=$1', [X.id]))[0].active === false;
    const retry = await processDeletion(rid, { quiescent: true, replay: true });
    if (!(res !== 'resolvió' && same && row.status === 'failed' && !leak && retry.status === 'awaiting_verification' && (await q('select count(*)::int n from "MatchingRequests" where "UserId"=$1', [X.id]))[0].n === 0)) rb.push(`${label}: res=${String(res).slice(0, 50)} igual=${same} estado=${row.status}/${row.failureCode} fuga=${leak && leak[0]} reintento=${retry.status}`);
  }
  check('P4 (bloqueante) fallo a mitad (trigger que lanza error en sesiones, en emparejamiento y en la lápida): transacción revertida por completo; solicitud en `failed` con código genérico; ni la respuesta ni el log llevan SQL ni contenido; reintento tras quitar el fallo completa la purga', rb.length === 0, rb.join(' | ') || '3/3');
  // ---------- P6 textos
  const texts = { rec: JSON.stringify(rec), rec2: JSON.stringify(rec2), s1: s1.stdout + s1.stderr };
  const SUp = await mkRich('P6', T1, 1); const del = await http(SU, 'DELETE', `/api/admin/usuarios/${SUp.id}`); texts.d202 = del.text; const del2 = await http(SU, 'DELETE', `/api/admin/usuarios/${SUp.id}`); texts.d202b = del2.text;
  const selfP = await mkRich('P6b', T1, 1); const selfReq = await http(selfP, 'POST', '/api/account/deletion-requests', { confirm: true }); texts.self = selfReq.text; const selfReq2 = await http(selfP, 'POST', '/api/account/deletion-requests', { confirm: true }); texts.self2 = selfReq2.text;
  const mkLean = async (tag, th) => { const p = await mkUser('user', tag, { therapistId: th.id }); await M('ClinicalNote').create({ UserId: p.id, therapistId: th.id, content: 'Nota clinica CANARIO-NOTA ' + p.name, type: 'session_note', sessionDate: '2026-10-01' }); const s = await M('TherapySession').create({ therapistId: th.id, patientId: p.id, scheduledAt: new Date(Date.UTC(2026, 9, 3, 15)), status: 'completed', duration: 50, therapistNote: 'Nota de sesion', meetingUrl: 'https://example.test/sala/x' }); await M('SessionNote').create({ sessionId: s.id, therapistId: th.id, content: 'Nota en vivo' }); await M('MatchingRequest').create({ UserId: p.id, answers: '{}', suggestions: '[]', chosenTherapistId: th.id, status: 'confirmed' }); await M('MoodLog').create({ UserId: p.id, date: '2026-10-02', checkin_mood: 3 }); return p; };
  const BL = await mkLean('BL', T1), CL = await mkLean('CL', T2); const exports_ = {}; for (const [who, nm] of [[BL, 'B'], [CL, 'C']]) for (const loc of ['es', 'en']) { const r = await http(who, 'POST', '/api/exports/preview', { type: 'personal', locale: loc }); exports_[nm + loc] = r; texts['exp' + nm + loc] = JSON.stringify(r.json?.data?.notices ?? r.text.slice(0, 200)); }
  const bad = Object.entries(texts).filter(([, v]) => FORBID.test(v) || PLAZO.test(v)).map(([k]) => k);
  check('P6a (bloqueante) ninguna salida de servidor (202 y repetido en ES/EN, solicitud propia y repetida, recibos, script, avisos de exportación ES/EN) contiene anonimiz*/desvincul*/anonymi*/unlink/de-identif* ni plazos', bad.length === 0 && del.status === 202 && selfReq.status === 202, `${bad.join(',')} 202=${del.status} self=${selfReq.status}/${selfReq2.status}`);
  check('P6b el 202 dice que solo se conservan las notas y registros del profesional, que pueden identificar a la persona (ES y EN) y que la política de retención está en definición', /Solo se conservan las notas y registros que escribió su profesional, que pueden contener datos que la identifiquen/.test(del.text) && /Only the notes and records written by their professional are kept, and they may contain data that identifies the person/.test(del.text) && /retención está en definición/.test(del.text), del.text.slice(0, 300));
  // ---------- P7 export
  const MARK = [T1.name, T1.email, String(T1.id), 'CANARIO-NOTA', 'Nota clinica', 'Nota de sesion', 'Nota en vivo', 'https://example.test/sala'];
  const expB = exports_.Bes; const Bp_ = BL; const expBtxt = JSON.stringify(expB.json?.data || {}); const leakEx = MARK.filter(m => m.length > 3 && expBtxt.includes(m));
  const expBen = exports_.Ben;
  const solo = await mkUser('user', 'solo'); const expSolo = await http(solo, 'POST', '/api/exports/preview', { type: 'personal', locale: 'es' });
  const anon = await http(null, 'POST', '/api/exports/preview', { type: 'personal', locale: 'es' });
  check('P7a (bloqueante) export de B (con notas del profesional): 201, SIN texto de notas, sin id/nombre/correo del profesional ni URLs de sesión; `notices[0].code = professional_notes_not_included` en ES y EN; sin conteos', [200, 201].includes(expB.status) && leakEx.length === 0 && expB.json.data.notices?.[0]?.code === 'professional_notes_not_included' && expBen.json.data.notices?.[0]?.code === 'professional_notes_not_included' && !/\d+ (notas|notes)/.test(JSON.stringify(expB.json.data.notices)), `fuga=${leakEx.join(',')} estado=${expB.status}/${expBen.status}`);
  check('P7b persona sin nada del profesional → export sin `notices`; sin sesión → 401/403', expSolo.json?.data && expSolo.json.data.notices === undefined && [401, 403].includes(anon.status), `${expSolo.status} ${anon.status}`);
  const dl = await http(BL, 'POST', `/api/exports/${expBen.json.id}/download`); const dlOther = await http(CL, 'POST', `/api/exports/${expBen.json.id}/download`);
  check('P7c el export de B solo se descarga por B (otra persona C con el mismo id → no entrega datos de B) y la descarga no trae notas ni al profesional', dl.status === 200 && MARK.filter(m => m.length > 3 && dl.text.includes(m)).length === 0 && !dlOther.text.includes(BL.name), `B=${dl.status} C=${dlOther.status}`);
  check('P7d la persona A purgada ya no puede exportar ni reabrir sesión (token anterior → 401/403)', [401, 403].includes((await http(A, 'POST', '/api/exports/preview', { type: 'personal', locale: 'es' })).status) && [401, 403].includes((await http(A, 'GET', '/api/sessions/user')).status), '');
  // ---------- P8 profesional después de la purga
  const p8 = {}; const sA = A.sessionIds[0];
  p8.lista = await http(T1, 'GET', '/api/therapist/pacientes'); p8.hist = await http(T1, 'GET', `/api/therapist/pacientes/${A.id}/historial`); p8.hia = await http(T1, 'GET', `/api/therapist/pacientes/${A.id}/historia`);
  p8.notaNueva = await http(T1, 'POST', `/api/therapist/pacientes/${A.id}/notas`, { content: 'nota nueva sobre A', sessionDate: '2026-11-05' });
  const oneNote = (await q('select id from "ClinicalNotes" where "UserId"=$1 order by id limit 1', [A.id]))[0].id; p8.editNota = await http(T1, 'PUT', `/api/therapist/notas/${oneNote}`, { content: 'editada ' + A.id });
  p8.listaSes = await http(T1, 'GET', '/api/sessions/therapist'); p8.putSes = await http(T1, 'PUT', `/api/sessions/therapist/${sA}`, { status: 'cancelled', cancelReason: 'NUEVO-MOTIVO-reingreso' }); p8.getNotes = await http(T1, 'GET', `/api/sessions/therapist/${sA}/notes`); p8.postNote = await http(T1, 'POST', `/api/sessions/therapist/${sA}/notes`, { content: 'nota viva nueva' }); p8.upc = await http(T1, 'GET', '/api/sessions/therapist/upcoming');
  const all8 = Object.values(p8).map(r => r.text).join('\n'); const names8 = [A.name, A.email].filter(m => all8.includes(m));
  const reentry = await q('select "cancelReason","meetingUrl","recordingUrl","googleEventId","patientMoodAfter" from "TherapySessions" where id=$1', [sA]);
  check('P8a (bloqueante) T1 tras la purga de A: ninguna respuesta (lista de pacientes, historial, historia, sesiones, notas, próximas) trae el nombre ni el correo de A; sin 5xx', names8.length === 0 && Object.values(p8).every(r => r.status < 500), JSON.stringify(Object.fromEntries(Object.entries(p8).map(([k, v]) => [k, v.status]))) + ' nombres=' + names8.join(','));
  info('P8b ESCRITURA del profesional sobre lo de A tras la purga', JSON.stringify({ 'crear nota clínica nueva sobre A': p8.notaNueva.status, 'editar una nota clínica conservada': p8.editNota.status, 'PUT sesión de A (cancelReason nuevo)': p8.putSes.status, 'leer notas en vivo de la sesión de A': p8.getNotes.status, 'agregar nota en vivo a la sesión de A': p8.postNote.status, 'columnas de persona en la sesión tras los intentos': reentry[0] }));
  check('P8c (bloqueante) el profesional NO puede reintroducir datos de persona en las columnas purgadas (cancelReason, enlaces, ánimo) ni crear notas nuevas sobre una persona purgada', reentry[0].cancelReason === null && reentry[0].meetingUrl === null && reentry[0].recordingUrl === null && reentry[0].googleEventId === null && reentry[0].patientMoodAfter === null && [404, 403, 400, 409].includes(p8.notaNueva.status) && (await q('select count(*)::int n from "ClinicalNotes" where "UserId"=$1', [A.id]))[0].n === 2, JSON.stringify({ reentry: reentry[0], nota: p8.notaNueva.status, put: p8.putSes.status }));
  // ---------- P9 concurrencia y tiempos
  const Z1 = await mkRich('Z1', T1, 2), Z2 = await mkRich('Z2', T1, 2); const z1r = await reqOf(Z1);
  const two = await Promise.allSettled([processDeletion(z1r, { quiescent: true }), processDeletion(z1r, { quiescent: true })]);
  const z1ok = two.filter(r => r.status === 'fulfilled').length; const z1state = (await q('select status,attempts from "DeletionRequests" where id=$1', [z1r]))[0];
  check('P9a dos `processDeletion` simultáneos de la MISMA solicitud: sin deadlock, estado final awaiting_verification, nada de la persona queda, lo conservado intacto', z1state.status === 'awaiting_verification' && z1ok >= 1 && (await q('select count(*)::int n from "MatchingRequests" where "UserId"=$1', [Z1.id]))[0].n === 0 && JSON.parse(await five(Z1)).every(r => SESSION5.every(k => r[k] === null)) && (await q('select count(*)::int n from "ClinicalNotes" where "UserId"=$1', [Z1.id]))[0].n === 2, `${two.map(r => r.status + (r.reason ? ':' + String(r.reason.message).slice(0, 40) : '')).join(' | ')} ${JSON.stringify(z1state)}`);
  const Z2r = await reqOf(Z2); const [pu, pu2, putS] = await Promise.allSettled([processDeletion(Z2r, { quiescent: true }), rights.requestDeletion(Z2.id), http(T1, 'PUT', `/api/sessions/therapist/${Z2.sessionIds[0]}`, { status: 'cancelled', cancelReason: 'carrera' })]);
  const z2 = (await q('select status from "DeletionRequests" where "UserId"=$1', [Z2.id]))[0].status;
  check('P9b purga ‖ nueva solicitud ‖ escritura del profesional sobre la sesión de la persona: sin 5xx ni deadlock; estado final coherente; en NULL las 5 columnas aunque el profesional escriba durante la purga', [pu, pu2, putS].every(r => r.status === 'fulfilled') && putS.value.status < 500 && z2 === 'awaiting_verification' && JSON.parse(await five(Z2)).every(r => SESSION5.every(k => r[k] === null)), `${[pu, pu2, putS].map(r => r.status + (r.reason ? ':' + String(r.reason.message).slice(0, 50) : '')).join(' | ')} estado=${z2} cinco=${await five(Z2)}`);
  const five5 = []; for (let i = 0; i < 5; i++) five5.push(await mkRich('F' + i, T1, 2)); const frs = []; for (const f of five5) frs.push(await reqOf(f)); const tF = Date.now(); const fr = await Promise.allSettled(frs.map(r => processDeletion(r, { quiescent: true }))); const msF = Date.now() - tF;
  check('P9c 5 personas distintas purgadas en paralelo con pool 5 (umbral aprobado < 15 s): todas awaiting_verification, sin deadlock', fr.every(r => r.status === 'fulfilled' && r.value.status === 'awaiting_verification') && msF < 15000, `${msF} ms ${fr.map(r => r.status === 'fulfilled' ? r.value.status : r.reason.message.slice(0, 40)).join(',')}`);
  const big = await mkRich('BIG', T1, 3); await q(`insert into "TherapySessions" ("therapistId","patientId","scheduledAt",status,duration,"therapistNote","patientMoodAfter","cancelReason","meetingUrl","recordingUrl","googleEventId","createdAt","updatedAt") select $1,$2,now() - (g||' hours')::interval,'completed',50,'nota '||g,3,'motivo '||g,'https://example.test/'||g,'https://example.test/r'||g,'e'||g,now(),now() from generate_series(1,2000) g`, [T1.id, big.id]);
  await q(`insert into "ClinicalNotes" ("UserId","therapistId",content,type,"sessionDate","createdAt","updatedAt") select $2,$1,'nota clinica '||g,'session_note','2026-10-01',now(),now() from generate_series(1,2000) g`, [T1.id, big.id]).catch(e => info('P9d-siembra', 'notas masivas: ' + e.message.slice(0, 100)));
  const brq = await reqOf(big); const tB = Date.now(); const brec = await processDeletion(brq, { quiescent: true }); const msBig = Date.now() - tB;
  const left = (await q(`select count(*)::int n from "TherapySessions" where "patientId"=$1 and ("cancelReason" is not null or "meetingUrl" is not null or "recordingUrl" is not null or "googleEventId" is not null or "patientMoodAfter" is not null)`, [big.id]))[0].n;
  check('P9d persona rica con 2 003 sesiones y 2 002 notas (umbral aprobado < 5 s): purga completa, 0 sesiones con columnas de persona', brec.status === 'awaiting_verification' && left === 0 && msBig < 5000, `${msBig} ms, restantes=${left}`);
  const hung = (await q(`select count(*)::int n from pg_stat_activity where datname=current_database() and state like 'idle in transaction%' and pid<>pg_backend_pid()`))[0].n;
  check('Z0 sin transacciones colgadas al terminar', hung === 0, String(hung));
  info('tiempos', `purga persona rica: ${msA} ms; ráfaga de 5: ${msF} ms; persona con 2 000+ filas: ${msBig} ms`);
  await finish();
  async function finish() {
    server.close(); await db.end().catch(() => {}); await app.close().catch(() => {}); await adm.query(`DROP DATABASE IF EXISTS "${DBN}" WITH (FORCE)`); await adm.end();
    fs.writeFileSync(path.join(E.QA_OUT || '.', MAIN ? 'ES-274-purga-pr235-main.json' : 'ES-274-purga-pr235.json'), JSON.stringify(results, null, 1));
    console.log('RESUMEN ' + results.filter(r => r.ok).length + '/' + results.filter(r => 'ok' in r).length + (MAIN ? ' (MODE=main)' : '')); process.exit(0);
  }
})().catch(e => { console.error('FATAL', e); process.exit(1); });
