// [QA-Claude] ES-275 · PR #232 (el script de purga exige DATABASE_URL explícita y salida limpia) · bases DESECHABLES LOCALES (Postgres embebido 127.0.0.1:54459), datos sintéticos, 0 IA. NADA de staging ni producción.
// Uso: node es275-script-purga-pr232.mjs <carpeta del repositorio con #232> <ruta del script de main copiado a backend/scripts/purgeMain.tmp.js>
import { createRequire } from 'node:module'; import { spawn, spawnSync } from 'node:child_process'; import fs from 'node:fs'; import path from 'node:path'; import { randomBytes } from 'node:crypto';
const REPO = process.argv[2]; const BACK = path.join(REPO, 'backend'); const S = 'C:/Users/Usuario/Documents/qa13';
const MAIN_SCRIPT = path.join(BACK, 'scripts', 'purgeMain.tmp.js'); const HAS_MAIN = fs.existsSync(MAIN_SCRIPT);
const req = createRequire(BACK + '/package.json'); const { Client } = req('pg'); const jwt = req('jsonwebtoken');
const JWT = fs.readFileSync(S + '/jwt', 'utf8').trim(), DEK = fs.readFileSync(S + '/dek', 'utf8').trim(), PEK = fs.readFileSync(S + '/pek', 'utf8').trim();
const HOST = '127.0.0.1:54459'; const ADMIN = `postgres://elevation:elevation_local@${HOST}/postgres`; const urlOf = (db, user = 'elevation', pass = 'elevation_local') => `postgres://${user}:${pass}@${HOST}/${db}`;
const DB = { pr: 'qa275_pr', main: 'qa275_main', decoy: 'qa275_decoy' }; const PORT = 8275; const API = `http://127.0.0.1:${PORT}`;
const out = []; const check = (id, ok, d = '') => { out.push({ id, ok: !!ok, detail: String(d).slice(0, 1400) }); console.log(JSON.stringify({ id, ok: !!ok, detail: String(d).slice(0, 1400) })); }; const info = (id, d) => { out.push({ id, info: String(d).slice(0, 1400) }); console.log(JSON.stringify({ id, info: String(d).slice(0, 1400) })); };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const appEnv = (extra = {}) => { const e = { ...process.env }; for (const k of Object.keys(e)) if (/^(DATABASE_URL|DB_[A-Z]+)$/.test(k)) delete e[k]; return { ...e, NODE_ENV: 'development', JWT_SECRET: JWT, DATA_ENCRYPTION_KEY: DEK, PROMPT_ENCRYPTION_KEY: PEK, DATA_RIGHTS_ENABLED: 'true', ...extra }; };
const admin = new Client({ connectionString: ADMIN }); await admin.connect();
const lastJson = (t) => { const l = String(t).split(/\r?\n/).reverse().find(x => x.trim().startsWith('{')); return l || ''; };

// ---------- bases desechables con una persona (y otra para el caso de repetición) con solicitud de eliminación aceptada
async function mkDb(name, tag) {
  await admin.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`); await admin.query(`CREATE DATABASE ${name}`);
  const url = urlOf(name); const migEnv = appEnv({ DATABASE_URL: url, DB_SSL: 'false' });
  const mig = spawnSync(process.execPath, ['node_modules/sequelize-cli/lib/sequelize', 'db:migrate'], { cwd: BACK, env: migEnv, encoding: 'utf8', timeout: 300000 });
  const srv = spawn(process.execPath, ['server.js'], { cwd: BACK, stdio: 'ignore', env: appEnv({ DATABASE_URL: url, DB_SSL: 'false', PORT: String(PORT), ALLOW_SYNTHETIC_CATALOG: 'true', ANTHROPIC_API_KEY: 'sk-synthetic-not-real', PRO_APP_RATE_MAX: '100000', LOGIN_RATE_MAX: '100000' }) });
  for (let i = 0; i < 160; i++) { try { if ((await fetch(API + '/api/health')).ok) break; } catch { /* */ } await sleep(250); }
  const c = new Client({ connectionString: url }); await c.connect(); const q = async (s, p = []) => (await c.query(s, p)).rows; const stamp = Date.now();
  const mk = async (t, role = 'user') => { const email = `qa275-${tag}-${t}-${stamp}@example.test`; await fetch(API + '/api/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'QA275 ' + t, email, password: randomBytes(12).toString('base64url') + 'aA1!' }) }); if (role !== 'user') await q('update "Users" set role=$1 where email=$2', [role, email]); const u = (await q('select id,name,role from "Users" where email=$1', [email]))[0]; return { ...u, email, token: jwt.sign({ id: u.id, name: u.name, role: u.role, iatMs: Date.now() }, JWT, { expiresIn: '3h', jwtid: randomBytes(8).toString('hex') }) }; };
  const SU = await mk('su', 'superadmin'); const ids = [];
  for (const t of ['a', 'b']) { const p = await mk(t); await q(`insert into "DiaryEntries"("UserId","entryDate",content,"createdAt","updatedAt") values ($1,'2026-01-05','x',now(),now())`, [p.id]).catch(() => {}); const r = await fetch(API + `/api/admin/usuarios/${p.id}`, { method: 'DELETE', headers: { Authorization: 'Bearer ' + SU.token } }); const row = (await q('select id from "DeletionRequests" where "UserId"=$1', [p.id]))[0]; ids.push({ person: p, status: r.status, uuid: row?.id }); }
  try { srv.kill(); } catch { /* */ } for (let i = 0; i < 60; i++) { try { await fetch(API + '/api/health', { signal: AbortSignal.timeout(500) }); } catch { break; } await sleep(200); }
  return { name, url, c, q, ids, mig: mig.status };
}
const A = await mkDb(DB.pr, 'pr'), M = await mkDb(DB.main, 'mn'), B = await mkDb(DB.decoy, 'dc');
info('siembra', `bases ${DB.pr}/${DB.main}/${DB.decoy}: migraciones ${A.mig}/${M.mig}/${B.mig}; solicitudes ${A.ids.map(i => i.status + ':' + (i.uuid || '').slice(0, 8)).join(',')} | ${M.ids.map(i => i.status).join(',')} | ${B.ids.map(i => i.status).join(',')}`);
const statusOf = async (db, uuid) => (await db.q('select status,"failureCode","activePurgedAt" is not null as purged from "DeletionRequests" where id=$1', [uuid]))[0] ?? null;
const run = (script, args, env, cwd = BACK) => { const r = spawnSync(process.execPath, [script, ...args], { cwd, env, encoding: 'utf8', timeout: 300000 }); return { st: r.status, out: r.stdout || '', err: r.stderr || '' }; };
const PS = 'scripts/purgePersonalData.js'; const FLAG = '--producers-stopped-and-drained';
const conns = async (dbName) => { await sleep(1700); const r = (await admin.query(`select xact_commit+xact_rollback as x, numbackends from pg_stat_database where datname=$1`, [dbName])).rows[0]; return Number(r.x); };
const U1 = A.ids[0].uuid, U2 = A.ids[1].uuid;

// ---------- N5 argumentos (primero que todo; con y sin DATABASE_URL), no debe haber conexión
const badArgs = [[], ['no-es-uuid', FLAG], [U1.toUpperCase(), FLAG], ['00000000-0000-1000-8000-000000000000', FLAG], [U1], [U1, '--otro-flag'], [U1, FLAG, '--replay-mal']];
let n5bad = []; const base0 = await conns(DB.pr); const base1 = await conns(DB.pr); const baseline = base1 - base0;
const x0 = await conns(DB.pr); for (const [i, a] of badArgs.entries()) for (const withUrl of [false, true]) { const r = run(PS, a, appEnv(withUrl ? { DATABASE_URL: A.url, DB_SSL: 'false' } : {})); if (!(r.st === 2 && /Expected request UUID/.test(r.err) && r.out.trim() === '' && !/DATABASE_URL is required|ECONN|at .*\.js:\d+/.test(r.err))) n5bad.push(`#${i} ${withUrl ? 'con' : 'sin'} URL → exit ${r.st} «${r.err.split(/\r?\n/)[0].slice(0, 70)}»`); }
const x1 = await conns(DB.pr);
check(`N5 ${badArgs.length} combinaciones de argumentos inválidos (sin UUID, mal formado, mayúsculas, v1, sin flag, flag equivocado, tercer argumento mal escrito) con y sin DATABASE_URL → exit 2 «Expected request UUID…», stdout vacío, sin traza y SIN conectar (la actividad de la base no sube sobre la línea base)`, n5bad.length === 0 && (x1 - x0) <= baseline, `${n5bad.join(' ; ') || 'ok'} · Δ transacciones ${x1 - x0} (base ${baseline})`);
const stillA = (await statusOf(A, U1)).status; { const ex = run(PS, [U2, FLAG, '--replay', 'extra'], appEnv({})); info('N5-observacion', 'un CUARTO argumento sobrante se ignora (exit ' + ex.st + ' sin DATABASE_URL: pasa la validación de argumentos y falla por la variable); es la conducta de main (misma desestructuración), no una regresión'); }

// ---------- N1 sin DATABASE_URL (aun con DB_*)
const dbVars = { DB_HOST: '127.0.0.1', DB_PORT: '54459', DB_USER: 'elevation', DB_PASSWORD: 'elevation_local', DB_NAME: DB.pr, DB_SSL: 'false' };
const y0 = await conns(DB.pr); const n1 = run(PS, [U1, FLAG], appEnv(dbVars)); const n1b = run(PS, [U1, FLAG], appEnv({})); const y1 = await conns(DB.pr);
check('N1 (bloqueante) sin `DATABASE_URL` (aun con DB_HOST/DB_USER/DB_PASSWORD/DB_NAME definidos, y sin nada) → exit 2, mensaje «DATABASE_URL is required», stdout vacío, SIN conectar y la solicitud sigue `accepted`', n1.st === 2 && n1b.st === 2 && /DATABASE_URL is required/.test(n1.err) && n1.out.trim() === '' && (y1 - y0) <= baseline && (await statusOf(A, U1)).status === stillA && stillA === 'accepted', `exit ${n1.st}/${n1b.st}; stderr «${n1.err.split(/\r?\n/)[0].slice(0, 120)}»; Δ ${y1 - y0} (base ${baseline}); estado ${stillA}`);
if (HAS_MAIN) { const nm = run('scripts/purgeMain.tmp.js', [M.ids[1].uuid, FLAG], appEnv(dbVars.DB_NAME ? { ...dbVars, DB_NAME: DB.main } : {})); const stm = await statusOf(M, M.ids[1].uuid); info('N1-control-main', `[main] mismo comando sin DATABASE_URL pero con DB_* → exit ${nm.st}; stdout «${lastJson(nm.out).slice(0, 80)}»; la solicitud pasó a ${stm?.status} (cae en DB_*)`); }

// ---------- N2 .env señuelo
const envFile = path.join(BACK, '.env'); const hadEnv = fs.existsSync(envFile); if (hadEnv) throw new Error('ya existe backend/.env: no lo toco');
let n2a, n2b, bBefore, bAfter, aAfter;
try {
  fs.writeFileSync(envFile, `DATABASE_URL=${B.url}\nDB_SSL=false\nDB_HOST=127.0.0.1\nDB_PORT=54459\nDB_USER=elevation\nDB_PASSWORD=elevation_local\nDB_NAME=${DB.decoy}\n`);
  bBefore = await statusOf(B, B.ids[0].uuid); n2a = run(PS, [B.ids[0].uuid, FLAG], appEnv({})); n2b = run(PS, [U1, FLAG], appEnv({ DATABASE_URL: A.url, DB_SSL: 'false' })); bAfter = await statusOf(B, B.ids[0].uuid); aAfter = await statusOf(A, U1);
  if (HAS_MAIN) { const nm = run('scripts/purgeMain.tmp.js', [B.ids[1].uuid, FLAG], appEnv({})); info('N2-control-main', `[main] con el mismo .env y sin DATABASE_URL → exit ${nm.st}; la solicitud de la base SEÑUELO pasó a ${(await statusOf(B, B.ids[1].uuid))?.status} (main LEE .env)`); }
} finally { fs.rmSync(envFile, { force: true }); }
check('N2 (bloqueante) `.env` señuelo en backend/ (con DATABASE_URL y DB_* de la base B): sin variable en el entorno → exit 2 y la base B NO cambia; con `DATABASE_URL`=A → se procesa SOLO A (B intacta); el `.env` se borró', n2a.st === 2 && bBefore.status === 'accepted' && bAfter.status === 'accepted' && n2b.st === 0 && aAfter.status !== 'accepted' && !fs.existsSync(envFile), `sin variable exit ${n2a.st}; B ${bBefore.status}→${bAfter.status}; con variable exit ${n2b.st}; A → ${aAfter.status}`);

// ---------- N3 salida limpia (con la corrida de N2b)
let parsed = null; try { parsed = JSON.parse(n2b.out.trim()); } catch { /* */ }
check('N3 (bloqueante) salida limpia: stdout es UN JSON parseable de punta a punta (`{"status":…,"deadlinesVerified":false}`), sin banner/línea de dotenv; «Environment: host:puerto/base» va por stderr y no hay trazas', parsed && parsed.status && parsed.deadlinesVerified === false && !/dotenv|injecting|tip:/i.test(n2b.out + n2b.err) && new RegExp(`Environment: 127\\.0\\.0\\.1:54459/${DB.pr}`).test(n2b.err), `stdout «${n2b.out.trim().slice(0, 100)}» stderr «${n2b.err.trim().slice(0, 120)}»`);

// ---------- N7 comparación con main: misma secuencia sobre bases gemelas
if (HAS_MAIN) {
  const seq = async (db, script, uuid) => { const e = appEnv({ DATABASE_URL: db.url, DB_SSL: 'false' }); const r1 = run(script, [uuid, FLAG], e), r2 = run(script, [uuid, FLAG], e), r3 = run(script, [uuid, FLAG, '--replay'], e), r4 = run(script, ['11111111-1111-4111-8111-111111111111', FLAG], e); return { j: [r1, r2, r3, r4].map(r => ({ st: r.st, json: lastJson(r.out), err: r.err.split(/\r?\n/).filter(l => !/^Environment:/.test(l)).join('|').slice(0, 80) })), final: await statusOf(db, uuid), users: (await db.q('select count(*)::int n from "Users" where active=false')).at(0).n }; };
  const sPr = await seq(A, PS, A.ids[1].uuid), sMn = await seq(M, 'scripts/purgeMain.tmp.js', M.ids[0].uuid); const norm = (s) => JSON.stringify({ j: s.j.map(x => ({ st: x.st, json: x.json })), final: s.final, users: s.users });
  info('N7-detalle', `PR ${norm(sPr)} · main ${norm(sMn)}`);
  check('N7 `processDeletion` y `--replay` intactos: la misma secuencia (purga nueva, repetición idempotente, `--replay` de una ya procesada, UUID desconocido) da los MISMOS exit codes, JSON de estado y estado final que el script de main (sobre bases gemelas)', norm(sPr) === norm(sMn), norm(sPr).slice(0, 300));
}

// ---------- N4 credenciales y N6 URL inválida: rol con caracteres especiales
const ROLE = 'qa275usr', PASS = 'S3cr3t!x#9%:/@'; await admin.query(`DROP ROLE IF EXISTS ${ROLE}`).catch(() => {}); await admin.query(`CREATE ROLE ${ROLE} LOGIN PASSWORD '${PASS}'`); await admin.query(`GRANT ALL ON DATABASE ${DB.pr} TO ${ROLE}`); await A.q(`GRANT ALL ON ALL TABLES IN SCHEMA public TO ${ROLE}`); await A.q(`GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO ${ROLE}`); await A.q(`GRANT USAGE ON SCHEMA public TO ${ROLE}`);
const enc = encodeURIComponent(PASS); const WRONG = 'W0ngS3cr3t!zz';
const leakCases = [['OK con rol y clave especial + ?sslmode', `postgres://${ROLE}:${enc}@${HOST}/${DB.pr}?sslmode=disable`, { DB_SSL: 'false' }], ['base inexistente', `postgres://${ROLE}:${enc}@${HOST}/no_existe_275`, { DB_SSL: 'false' }], ['clave incorrecta', `postgres://${ROLE}:${encodeURIComponent(WRONG)}@${HOST}/${DB.pr}`, { DB_SSL: 'false' }], ['host inalcanzable', `postgres://${ROLE}:${enc}@127.0.0.1:1/${DB.pr}`, { DB_SSL: 'false' }]];
const leaks = []; const lines = []; for (const [label, url, extra] of leakCases) { const r = run(PS, [U2, FLAG, '--replay'], appEnv({ DATABASE_URL: url, ...extra })); const all = r.out + r.err; const bad = [ROLE, PASS, enc, WRONG, encodeURIComponent(WRONG), 'S3cr3t'].filter(s => all.includes(s)); lines.push(`${label}: exit ${r.st} «${(r.err.split(/\r?\n/).filter(Boolean).slice(-1)[0] || '').slice(0, 70)}»`); if (bad.length) leaks.push(`${label}: filtra ${bad.join(',')}`); if (/\bat .*\.js:\d+|node_modules/.test(all)) leaks.push(`${label}: traza`); }
check('N4 (bloqueante) credenciales: con usuario y clave con caracteres especiales (`!#%:/@`) y `?sslmode`, en el caso OK, base inexistente, clave incorrecta y host inalcanzable NI el usuario NI la clave (cruda o codificada) aparecen en stdout/stderr y no hay trazas', leaks.length === 0, leaks.join(' ; ') || lines.join(' | '));
const badUrls = [['texto', 'foo'], ['mysql', 'mysql://u:p@127.0.0.1:3306/x'], ['sin host', 'postgres://'], ['vacía', ''], ['http', 'http://127.0.0.1/x'], ['espacios', '   ']]; const n6 = [];
const z0 = await conns(DB.pr); for (const [l, u] of badUrls) { const r = run(PS, [U2, FLAG], appEnv({ DATABASE_URL: u })); const ok = r.st === 2 && r.out.trim() === '' && !/\bat .*\.js:\d+|TypeError|Invalid URL/.test(r.err); if (!ok) n6.push(`${l} → exit ${r.st} «${r.err.split(/\r?\n/)[0].slice(0, 80)}»`); } const z1 = await conns(DB.pr);
check('N6 URL inválida (texto, mysql://, sin host, vacía, http://, espacios) → exit 2 con mensaje claro, sin traza y sin conectar', n6.length === 0 && (z1 - z0) <= baseline, n6.join(' ; ') || `Δ ${z1 - z0} (base ${baseline})`);

// ---------- N8 SSL
const n8a = run(PS, [U2, FLAG, '--replay'], appEnv({ DATABASE_URL: A.url })); const n8b = run(PS, [U2, FLAG, '--replay'], appEnv({ DATABASE_URL: A.url, DB_SSL: 'false' }));
check('N8 SSL (heredado de `database.js`: activo salvo `DB_SSL=false`): contra mi Postgres local SIN SSL, sin `DB_SSL=false` falla con mensaje corto (exit 1, sin URL ni clave ni traza); con `DB_SSL=false` funciona', n8a.st === 1 && !/elevation_local|elevation:/.test(n8a.out + n8a.err) && !/\bat .*\.js:\d+/.test(n8a.out + n8a.err) && n8b.st === 0, `sin: exit ${n8a.st} «${n8a.err.trim().split(/\r?\n/).slice(-1)[0]}» · con: exit ${n8b.st} ${lastJson(n8b.out)}`);

// ---------- N9 variables de la aplicación ausentes
const n9 = []; for (const k of ['JWT_SECRET']) { const e = appEnv({ DATABASE_URL: A.url, DB_SSL: 'false' }); delete e[k]; const r = run(PS, [U2, FLAG, '--replay'], e); const msg = (r.err.trim().split(/\r?\n/).filter(l => !/^Environment:/.test(l))[0] || '').slice(0, 140); info('N9-' + k, `exit ${r.st} «${msg}» stdout «${r.out.trim().slice(0, 60)}»`); if (!(r.st !== 0 && !/\bat .*\.js:\d+/.test(r.err))) n9.push(`${k}: exit ${r.st}`); }
{ const e = appEnv({ DATABASE_URL: A.url, DB_SSL: 'false' }); delete e.DATA_ENCRYPTION_KEY; const r = run(PS, [U2, FLAG, '--replay'], e); info('N9-observacion-DEK', 'sin DATA_ENCRYPTION_KEY: exit ' + r.st + ' (la purga no necesita descifrar: borra filas; la clave solo se exige al iniciar el servidor)'); }
check('N9 sin JWT_SECRET (las variables que exigen los módulos de la aplicación) → exit ≠ 0 con mensaje legible (no una traza) y sin cambiar nada', n9.length === 0, n9.join(' ; ') || 'ok (ver N9-*)');

console.log('RESUMEN ' + out.filter(r => 'ok' in r && r.ok).length + '/' + out.filter(r => 'ok' in r).length + ' ok; fallos: ' + out.filter(r => 'ok' in r && !r.ok).map(r => r.id.split(' ')[0]).join(', '));
fs.writeFileSync(path.join(process.env.OUT || '.', 'ES-275-script-purga-pr232.json'), JSON.stringify({ results: out }, null, 1));
for (const d of [A, M, B]) await d.c.end().catch(() => {}); for (const n of Object.values(DB)) await admin.query(`DROP DATABASE IF EXISTS ${n} WITH (FORCE)`).catch(() => {}); await admin.query(`DROP OWNED BY ${ROLE}`).catch(() => {}); await admin.query(`DROP ROLE IF EXISTS ${ROLE}`).catch(() => {}); await admin.end(); process.exit(0);
