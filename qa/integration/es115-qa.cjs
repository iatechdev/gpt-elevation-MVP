// [QA-Claude] ES-115 · PR #87 (head 1b80d427) · pruebas independientes contra el merge local con PostgreSQL embebido (datos sintéticos, 0 tokens, 0 coste de nube).
// Todo corre como un rol SIN superusuario y SIN BYPASSRLS (qa_app115, dueño de la base), como en un despliegue real.
// Uso: node qa/integration/es115-qa.cjs   (no imprime contraseñas; escribe qa/evidence/ES-115-pr87-resultados.json)
const { spawn, spawnSync } = require('child_process'); const { createRequire } = require('module');
const crypto = require('crypto'); const fs = require('fs'); const path = require('path');
const ROOT = 'C:/Users/Usuario/Documents/qa-pr-test'; const BACK = ROOT + '/backend'; const S = 'C:/Users/Usuario/Documents/qa13';
const { Client } = createRequire(BACK + '/package.json')('pg');
const out = []; const R = (id, ok, d = '') => { out.push({ id, ok: !!ok, detail: String(d).slice(0, 500) }); console.log(JSON.stringify({ id, ok: !!ok, detail: String(d).slice(0, 380) })); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const APP = 'qa_app115', PW = 'Qa115-' + crypto.randomBytes(8).toString('hex'); const adminUrl = 'postgres://elevation:elevation_local@127.0.0.1:54459/postgres';
const urlOf = db => `postgres://${APP}:${encodeURIComponent(PW)}@127.0.0.1:54459/${db}`;
const connect = async u => { const c = new Client({ connectionString: u, ssl: false }); c.on('error', () => {}); await c.connect(); return c; };
const ES85 = ['20261028190000-es85-ai-jobs-skill-candidates.js', '20261028190100-es85-worker-role-functions.js'];
const HIST = ['20261028210000-es89-candidate-review.js', '20261029010000-es116-skill-territories.js', '20261030000000-es107-cv-binary.js', '20261030020000-es43-ai-usage-stop-reason.js'];
const migs = fs.readdirSync(BACK + '/migrations').filter(f => /^\d.*\.(js|cjs)$/.test(f)).sort();
const ES117 = '20261102120000-es117-supabase-rls.js', ES142 = '20261102000000-es142-chat-truncated.js';
const env = (db, extra = {}) => ({ ...process.env, DATABASE_URL: urlOf(db), DB_SSL: 'false', NODE_ENV: 'test', ...extra });
const node = (script, args, db, extra) => spawnSync(process.execPath, [path.join(BACK, 'scripts', script), ...args], { cwd: BACK, encoding: 'utf8', env: env(db, extra) });
const cli = (args, db, extra) => spawnSync('npx', ['--no-install', 'sequelize-cli', ...args], { cwd: BACK, encoding: 'utf8', shell: true, env: env(db, extra) });
const meta = async c => (await c.query('SELECT name FROM "SequelizeMeta"')).rows.map(r => r.name).sort();
const catalog = async c => crypto.createHash('sha256').update(JSON.stringify([
  (await c.query(`SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY 1`)).rows,
  (await c.query(`SELECT indexname, indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY 1`)).rows,
  (await c.query(`SELECT conname FROM pg_constraint WHERE connamespace='public'::regnamespace ORDER BY 1`)).rows,
  (await c.query(`SELECT c.relname, c.relrowsecurity FROM pg_class c WHERE c.relnamespace='public'::regnamespace AND c.relkind='r' ORDER BY 1`)).rows])).digest('hex');
let admin; const created = [];
const mkdb = async db => { await admin.query(`DROP DATABASE IF EXISTS ${db} WITH (FORCE)`); await admin.query(`CREATE DATABASE ${db} OWNER ${APP}`); created.push(db); };
const stagingLike = async (db, { rls = true } = {}) => { // reproduce staging: sync() + ES-85 + historial real registrado + ES-117/ES-142 por directorio aislado
  await mkdb(db); const d = await connect(urlOf(db));
  const sy = node('schema-sync-once.cjs', [], db); if (sy.status !== 0) throw new Error('sync: ' + (sy.stdout + sy.stderr).slice(-300));
  await d.query('DROP TABLE "SkillCandidates"'); await d.query('DROP TABLE "AiJobs"');
  for (const m of ES85) { const r = cli(['db:migrate', '--name', m], db); if (r.status !== 0) throw new Error('es85: ' + (r.stdout + r.stderr).slice(-300)); }
  await d.query('CREATE TABLE IF NOT EXISTS "SequelizeMeta" ("name" varchar(255) NOT NULL PRIMARY KEY)'); for (const m of HIST) await d.query('INSERT INTO "SequelizeMeta" VALUES ($1) ON CONFLICT DO NOTHING', [m]);
  const req = (await d.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name='Users' AND is_nullable='NO' AND column_default IS NULL`)).rows;
  const val = ({ column_name: c, data_type: t }) => (/timestamp/.test(t) ? 'now()' : /int|numeric/.test(t) ? '0' : t === 'boolean' ? 'false' : c === 'email' ? "'sintetico-115qa@example.invalid'" : "'x'");
  await d.query(`INSERT INTO "Users" (${req.map(c => '"' + c.column_name + '"').join(',')}) VALUES (${req.map(val).join(',')})`);
  if (rls) { const dir = path.join(BACK, 'mig-qa115'); fs.mkdirSync(dir, { recursive: true }); for (const f of [ES142, ES117]) fs.copyFileSync(path.join(BACK, 'migrations', f), path.join(dir, f));
    const r = cli(['db:migrate', '--migrations-path', 'mig-qa115'], db); fs.rmSync(dir, { recursive: true, force: true }); if (r.status !== 0) throw new Error('es117 aislado: ' + (r.stdout + r.stderr).slice(-300)); }
  return d;
};
(async () => {
  admin = await connect(adminUrl);
  await admin.query(`DROP DATABASE IF EXISTS q115a WITH (FORCE)`); await admin.query(`DROP ROLE IF EXISTS ${APP}`);
  for (const r of ['anon', 'authenticated', 'service_role']) if (!(await admin.query('SELECT 1 FROM pg_roles WHERE rolname=$1', [r])).rowCount) await admin.query(`CREATE ROLE ${r} NOLOGIN`);
  await admin.query(`CREATE ROLE ${APP} LOGIN CREATEROLE CREATEDB NOSUPERUSER NOBYPASSRLS PASSWORD '${PW}'`);
  for (const r of ['elevation_worker', 'elevation_worker_owner']) if ((await admin.query('SELECT 1 FROM pg_roles WHERE rolname=$1', [r])).rowCount) await admin.query(`GRANT ${r} TO ${APP} WITH ADMIN OPTION`);
  const at = (await admin.query('SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname=$1', [APP])).rows[0]; R('F0 el rol de la app no es superusuario ni tiene BYPASSRLS', !at.rolsuper && !at.rolbypassrls, JSON.stringify(at));

  // ── Escenario STAGING con RLS ya activo (F4–F8, F11) ────────────────────────────
  const d = await stagingLike('q115stg'); const reg0 = await meta(d); const usr0 = (await d.query('SELECT count(*)::int n FROM "Users"')).rows[0].n; const cat0 = await catalog(d);
  R('F11a escenario: sync() + historial + ES-142 y ES-117 aplicados (RLS activo) y baseline sin registrar', reg0.includes(ES117) && !reg0.includes('20261001000000-baseline.js'), `registradas=${reg0.length} usuarios=${usr0}`);
  const dry = node('adopt-existing-schema.cjs', [], 'q115stg'); const cat1 = await catalog(d);
  R('F5/F11 diagnóstico por defecto: lista adoptables y NO escribe (catálogo y SequelizeMeta idénticos)', dry.status === 0 && /adoptable\s+20261001000000-baseline/.test(dry.stdout) && /adoptable\s+20261030010000-es109/.test(dry.stdout) && /no se escribió nada/.test(dry.stdout) && cat1 === cat0 && JSON.stringify(await meta(d)) === JSON.stringify(reg0), dry.stdout.split('\n').slice(0, 4).join(' | '));
  const blk = node('migrate-deploy.cjs', [], 'q115stg'); R('F4 migrate-deploy sin adoptar: se niega (exit 1) y no escribe', blk.status === 1 && /sin adoptar/.test(blk.stderr) && await catalog(d) === cat0 && JSON.stringify(await meta(d)) === JSON.stringify(reg0), `exit=${blk.status}`);
  // F8 negativos
  await d.query('DROP INDEX participant_resumes_user_sha_unique'); const neg1 = node('adopt-existing-schema.cjs', ['--apply'], 'q115stg');
  R('F8a índice faltante (ES-109): --apply se bloquea ANTES de escribir (exit 1, no registra nada, ni la línea base)', neg1.status === 1 && /no_adoptable\s+20261030010000-es109/.test(neg1.stdout) && /No se registra nada/.test(neg1.stderr) && JSON.stringify(await meta(d)) === JSON.stringify(reg0), `exit=${neg1.status}`);
  await d.query('CREATE UNIQUE INDEX participant_resumes_user_sha_unique ON "ParticipantResumes" ("UserId", "sha256")').catch(async e => { R('INFO no pude recrear el índice con ese nombre de columna', true, e.message); });
  const exists = (await d.query(`SELECT 1 FROM pg_indexes WHERE indexname='participant_resumes_user_sha_unique'`)).rowCount;
  if (!exists) { const col = (await d.query(`SELECT column_name FROM information_schema.columns WHERE table_name='ParticipantResumes' AND column_name ILIKE '%sha%'`)).rows[0]?.column_name; if (col) await d.query(`CREATE UNIQUE INDEX participant_resumes_user_sha_unique ON "ParticipantResumes" ("UserId", "${col}")`); }
  await d.query('ALTER TABLE "ProfessionalApplicationFiles" RENAME TO "PAF_qa"'); const neg2 = node('adopt-existing-schema.cjs', ['--apply'], 'q115stg');
  R('F8b tabla faltante (ES-95): bloquea y no registra nada', neg2.status === 1 && /no_adoptable\s+20261029000000-es95/.test(neg2.stdout) && JSON.stringify(await meta(d)) === JSON.stringify(reg0), `exit=${neg2.status}`); await d.query('ALTER TABLE "PAF_qa" RENAME TO "ProfessionalApplicationFiles"');
  const catRestored = await catalog(d);
  const ap = node('adopt-existing-schema.cjs', ['--apply'], 'q115stg'); const regA = await meta(d); const added = regA.filter(x => !reg0.includes(x));
  R('F6/F7 --apply registra solo baseline, ES-95 y ES-109 (comprobadas por objetos) y NO toca objetos', ap.status === 0 && added.length === 3 && await catalog(d) === catRestored, `añadidas=${added.map(a => a.split('-')[0]).join(',')}`);
  const dep = node('migrate-deploy.cjs', [], 'q115stg'); const regD = await meta(d);
  R('F7 migrate-deploy aplica lo pendiente sobre el fixture (con RLS activo) y deja todas registradas', dep.status === 0 && JSON.stringify(regD) === JSON.stringify(migs), `exit=${dep.status} registradas=${regD.length}/${migs.length} ${dep.status ? (dep.stdout + dep.stderr).slice(-200) : ''}`);
  R('F11b datos de la persona intactos', (await d.query('SELECT count(*)::int n FROM "Users"')).rows[0].n === usr0, 'usuarios=' + usr0);
  const chk = spawnSync(process.execPath, ['scripts/check-rls.cjs'], { cwd: BACK, encoding: 'utf8', env: env('q115stg') }); R('F11c check:rls después de migrar: «RLS ok»', chk.status === 0 && /RLS ok/.test(chk.stdout), (chk.stdout + chk.stderr).trim().slice(0, 140));
  const dep2 = node('migrate-deploy.cjs', [], 'q115stg'); R('F2 repetir migrate-deploy: sin cambios (idempotente)', dep2.status === 0 && JSON.stringify(await meta(d)) === JSON.stringify(migs) && /al día/.test(dep2.stdout), `exit=${dep2.status}`);
  const t0 = Date.now(); node('migrate-deploy.cjs', [], 'q115stg'); const msNoop = Date.now() - t0; R('P1 migrate-deploy sin pendientes (umbral propuesto ≤ 5 s)', msNoop <= 5000, msNoop + ' ms');
  await d.end();

  // ── Base nueva y migración fallida (F1, F3, P2) ─────────────────────────────────
  await mkdb('q115fresh'); const t1 = Date.now(); const fr = node('migrate-deploy.cjs', [], 'q115fresh'); const msFresh = Date.now() - t1; const f = await connect(urlOf('q115fresh'));
  R('F1 base nueva: migrate-deploy aplica todas las migraciones y queda registrada la lista completa', fr.status === 0 && JSON.stringify(await meta(f)) === JSON.stringify(migs), `exit=${fr.status} ${msFresh} ms`);
  const sh = spawnSync('sh', ['-c', 'node backend/scripts/migrate-deploy.cjs && echo SERVIDOR_ARRANCA'], { cwd: ROOT, encoding: 'utf8', env: env('q115fresh') }); R('F13 forma del CMD (sh -c «migrate && servidor»): con migraciones al día arranca el servidor', sh.status === 0 && /SERVIDOR_ARRANCA/.test(sh.stdout), `exit=${sh.status}`);
  // migración que falla
  const bad = path.join(BACK, 'migrations', '29990101000000-qa115-falla.js'); fs.writeFileSync(bad, `module.exports={async up(q){await q.sequelize.transaction(async (transaction)=>{await q.sequelize.query('CREATE TABLE qa115_tabla_a_medias (id int)',{transaction});throw new Error('falla simulada de QA')})},async down(){}}`); // con transacción, como las migraciones del repo (p. ej. ES-117)
  const before = await catalog(f); const rb = spawnSync('sh', ['-c', 'node backend/scripts/migrate-deploy.cjs && echo SERVIDOR_ARRANCA'], { cwd: ROOT, encoding: 'utf8', env: env('q115fresh') }); fs.unlinkSync(bad);
  const half = (await f.query(`SELECT to_regclass('qa115_tabla_a_medias') t`)).rows[0].t;
  R('F3 migración que falla: sale ≠ 0, el servidor NO arranca, sin tabla a medias y la base queda como estaba', rb.status !== 0 && !/SERVIDOR_ARRANCA/.test(rb.stdout) && !half && await catalog(f) === before && !(await meta(f)).includes('29990101000000-qa115-falla.js'), `exit=${rb.status}`);
  // INFO: una migración SIN transacción deja la tabla a medias (propiedad de la migración, no de migrate-deploy)
  fs.writeFileSync(bad, `module.exports={async up(q){await q.sequelize.query('CREATE TABLE qa115_sin_transaccion (id int)');throw new Error('falla simulada de QA')},async down(){}}`); const rn = node('migrate-deploy.cjs', [], 'q115fresh'); fs.unlinkSync(bad); const half2 = (await f.query(`SELECT to_regclass('qa115_sin_transaccion') t`)).rows[0].t;
  R('INFO F3b migración fallida SIN transacción: deja objetos a medias y migrate-deploy no los limpia (riesgo para migraciones futuras; exigir transacción)', true, `exit=${rn.status} tabla_a_medias=${!!half2}`);
  await f.end();
  // P2: arranque completo
  await mkdb('q115boot'); const t2 = Date.now(); const bt = node('migrate-deploy.cjs', [], 'q115boot'); const srv = spawn(process.execPath, ['server.js'], { cwd: BACK, stdio: 'ignore', env: env('q115boot', { PORT: '9961', DB_SYNC_DISABLED: 'true', JWT_SECRET: fs.readFileSync(S + '/jwt', 'utf8').trim(), DATA_ENCRYPTION_KEY: fs.readFileSync(S + '/dek', 'utf8').trim(), PROMPT_ENCRYPTION_KEY: fs.readFileSync(S + '/pek', 'utf8').trim() }) });
  let ready = false; for (let i = 0; i < 80 && !ready; i++) { try { ready = (await fetch('http://127.0.0.1:9961/api/health')).ok; } catch { /* */ } if (!ready) await sleep(500); } const msBoot = Date.now() - t2; srv.kill();
  R('P2 base vacía → migraciones → servidor listo (umbral propuesto ≤ 60 s)', bt.status === 0 && ready && msBoot <= 60000, msBoot + ' ms');

  // ── Interruptor de sync() (F9, F10) ─────────────────────────────────────────────
  const variants = [['true', true], ['TRUE', false], ['1', false], ['false', false], ['', false], [undefined, false]];
  for (const [v, off] of variants) {
    const c = await connect(urlOf('q115boot')); await c.query('DROP TABLE IF EXISTS "EthicManifests" CASCADE'); await c.end();
    const e = env('q115boot', { PORT: '9962', JWT_SECRET: fs.readFileSync(S + '/jwt', 'utf8').trim(), DATA_ENCRYPTION_KEY: fs.readFileSync(S + '/dek', 'utf8').trim(), PROMPT_ENCRYPTION_KEY: fs.readFileSync(S + '/pek', 'utf8').trim() }); delete e.DB_SYNC_DISABLED; if (v !== undefined) e.DB_SYNC_DISABLED = v;
    const sv = spawn(process.execPath, ['server.js'], { cwd: BACK, stdio: 'ignore', env: e }); let up = false; for (let i = 0; i < 60 && !up; i++) { try { up = (await fetch('http://127.0.0.1:9962/api/health')).ok; } catch { /* */ } if (!up) await sleep(500); } await sleep(1500); sv.kill(); await sleep(500);
    const c2 = await connect(urlOf('q115boot')); const has = !!(await c2.query(`SELECT to_regclass('"EthicManifests"') t`)).rows[0].t; await c2.end();
    R(`F9 DB_SYNC_DISABLED=${v === undefined ? '(ausente)' : JSON.stringify(v)}: ${off ? 'NO llama a sync() (la tabla borrada NO reaparece)' : 'sync() sigue activo (la tabla borrada se recrea)'}`, up && (off ? !has : has), `servidor=${up} tabla=${has}`);
  }

  // ── Seguridad (S1–S6) ───────────────────────────────────────────────────────────
  const bad1 = spawnSync(process.execPath, [path.join(BACK, 'scripts', 'adopt-existing-schema.cjs')], { cwd: BACK, encoding: 'utf8', env: { ...process.env, DATABASE_URL: `postgres://qa_user:SecretoQA${PW}@127.0.0.1:54459/q115boot`, DB_SSL: 'false' } });
  R('S1a contraseña errónea: el error no imprime la contraseña ni la URL', bad1.status !== 0 && !(bad1.stdout + bad1.stderr).includes('SecretoQA') && !(bad1.stdout + bad1.stderr).includes(PW), `exit=${bad1.status} ${(bad1.stderr).trim().slice(0, 80)}`);
  const bad2 = spawnSync(process.execPath, [path.join(BACK, 'scripts', 'migrate-deploy.cjs')], { cwd: BACK, encoding: 'utf8', env: { ...process.env, DATABASE_URL: `postgres://qa_user:ClaveFalsaQA9@host malformado/db`, DB_SSL: 'false' } });
  R('S1b DATABASE_URL malformada: error claro sin la contraseña', bad2.status !== 0 && !(bad2.stdout + bad2.stderr).includes('ClaveFalsaQA9'), `exit=${bad2.status} ${(bad2.stderr).trim().slice(0, 90)}`);
  const noUrl = spawnSync(process.execPath, [path.join(BACK, 'scripts', 'adopt-existing-schema.cjs'), '--apply'], { cwd: BACK, encoding: 'utf8', env: { PATH: process.env.PATH } }); R('S3 sin DATABASE_URL: error claro (exit 2) sin tocar nada', noUrl.status === 2, `exit=${noUrl.status}`);
  const src = ['migrate-deploy.cjs', 'adopt-existing-schema.cjs'].map(f => fs.readFileSync(path.join(BACK, 'scripts', f), 'utf8').replace(/\/\/.*$/gm, '')).join('\n');
  R('S6 los scripts no contienen DROP/TRUNCATE/DELETE/ALTER ni UPDATE (solo SELECT, CREATE TABLE IF NOT EXISTS de SequelizeMeta e INSERT en SequelizeMeta)', !/\b(DROP|TRUNCATE|DELETE\s+FROM|ALTER|UPDATE\s+\S+\s+SET)\b/i.test(src), 'revisión estática');
  const allNew = [fs.readFileSync(path.join(BACK, 'scripts/migrate-deploy.cjs'), 'utf8'), fs.readFileSync(path.join(BACK, 'scripts/adopt-existing-schema.cjs'), 'utf8'), fs.readFileSync(ROOT + '/docs/DESPLIEGUE-RAILWAY.md', 'utf8')].join('\n');
  R('S2 sin secretos, correos reales ni identificadores de proyecto en los archivos', !/(postgres:\/\/[^'"\s<]*:[^'"\s<@]{4,}@)|(eyJ[A-Za-z0-9_-]{20,})|(sk-[A-Za-z0-9]{10,})|(hxfgugdd|pxtijden)/i.test(allNew), 'revisión por expresión regular');
  // S5 concurrencia
  await mkdb('q115conc'); const mk = () => new Promise(res => { const c = spawn(process.execPath, [path.join(BACK, 'scripts', 'migrate-deploy.cjs')], { cwd: BACK, env: env('q115conc') }); let o = ''; c.stdout.on('data', x => o += x); c.stderr.on('data', x => o += x); c.on('close', code => res({ code, o })); });
  const [c1, c2] = await Promise.all([mk(), mk()]); const cc = await connect(urlOf('q115conc')); const mc = await meta(cc); await cc.end(); const again = node('migrate-deploy.cjs', [], 'q115conc');
  R('S5 dos migrate-deploy simultáneos sobre base vacía (el PR admite que no hay bloqueo): resultado y recuperación', true, `salidas=${c1.code},${c2.code} registradas=${mc.length}/${migs.length} · un tercer intento posterior: exit ${again.status} · ${c1.code !== 0 || c2.code !== 0 ? 'UNO FALLÓ (riesgo declarado; reintento lo resuelve=' + (again.status === 0) + ')' : 'ambos terminaron bien'}`);
  // F14 estáticas
  const rj = JSON.parse(fs.readFileSync(ROOT + '/railway.json', 'utf8')); const df = fs.readFileSync(ROOT + '/Dockerfile', 'utf8');
  R('F14 railway.json sin startCommand ni preDeployCommand y Dockerfile con CMD «migrate-deploy && exec node backend/server.js»', !JSON.stringify(rj).includes('startCommand') && !JSON.stringify(rj).includes('preDeployCommand') && /CMD \["sh", "-c", "node backend\/scripts\/migrate-deploy\.cjs && exec node backend\/server\.js"\]/.test(df), JSON.stringify(rj.deploy ?? rj).slice(0, 160));
  const docs = fs.readFileSync(ROOT + '/docs/DESPLIEGUE-RAILWAY.md', 'utf8'); R('F12 la documentación cita los comandos reales (adopt-existing-schema --apply, DB_SYNC_DISABLED, reversión)', /adopt-existing-schema/.test(docs) && /DB_SYNC_DISABLED/.test(docs) && /(revert|vuelve|Rollback)/i.test(docs), 'lectura');

  console.log('RESUMEN-ES115 ' + JSON.stringify({ total: out.length, fallos: out.filter(o => !o.ok).length }));
  fs.writeFileSync(path.join(__dirname, '..', 'evidence', 'ES-115-pr87-resultados.json'), JSON.stringify(out, null, 1));
  for (const db of [...created, 'q115a']) await admin.query(`DROP DATABASE IF EXISTS ${db} WITH (FORCE)`).catch(() => {}); await admin.query(`DROP ROLE IF EXISTS ${APP}`).catch(() => {}); await admin.end();
})().catch(e => { console.log('ERROR ' + String(e.stack).slice(0, 700)); process.exit(1); });
