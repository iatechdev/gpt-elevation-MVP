// [QA-Claude-5] #456 (ES-386): migración 20261123010000-es386-audit-actor-label (lección #412). PostgreSQL desechable propio; no toca nada más.
// Uso: BACKEND=$QA_TOOLS/qa5/main/backend PGBASE=postgres://qa5:...@127.0.0.1:54361 node qa/qa5-456-mig.cjs
const { Client } = require('pg'); const cp = require('child_process'); const path = require('path')
const BACKEND = process.env.BACKEND; const BASE = process.env.PGBASE; let ok = 0, bad = 0
const check = (l, c, ev) => { if (c) { ok++; console.log('OK    ' + l) } else { bad++; console.log('FALLA ' + l + (ev !== undefined ? ' · ' + String(ev).slice(0, 500) : '')) } }
const info = (...a) => console.log('INFO ', ...a)
const url = (db) => `${BASE}/${db}`
const q = async (db, s, a) => { const c = new Client({ connectionString: url(db) }); await c.connect(); try { return (await c.query(s, a)).rows } finally { await c.end() } }
const admin = (s) => q('postgres', s)
const sh = (cmd, args, db, extra = {}) => cp.spawnSync(cmd, args, { cwd: BACKEND, encoding: 'utf8', shell: process.platform === 'win32', env: { ...process.env, DATABASE_URL: url(db), DB_SSL: 'false', NODE_ENV: 'development', ...extra }, timeout: 300000 })
const cols = async (db) => (await q(db, `SELECT column_name, data_type, character_maximum_length, is_nullable FROM information_schema.columns WHERE table_name='AdminAuditEntries' ORDER BY column_name`)).map((c) => `${c.column_name}:${c.data_type}${c.character_maximum_length ? '(' + c.character_maximum_length + ')' : ''}:${c.is_nullable}`)
const MIG = '20261123010000-es386-audit-actor-label'
;(async () => {
  const fresh = async (db) => { await admin(`DROP DATABASE IF EXISTS ${db} WITH (FORCE)`); await admin(`CREATE DATABASE ${db}`) }
  // 1) Railway: migrate-deploy sobre base nueva → columna creada VARCHAR(32) NULL, registrada
  await fresh('qa5_456a'); let r = sh('node', ['scripts/migrate-deploy.cjs'], 'qa5_456a'); check('migrate-deploy sobre base nueva: código 0', r.status === 0, (r.stdout + r.stderr).slice(-400))
  const c1 = await cols('qa5_456a'); check('AdminAuditEntries tiene actorLabel character varying(32) NULL', c1.includes('actorLabel:character varying(32):YES'), c1.join(' '))
  check('la migración quedó registrada en SequelizeMeta', (await q('qa5_456a', `SELECT name FROM "SequelizeMeta" WHERE name LIKE '%es386%'`)).length === 1)
  // 2) correr dos veces: db:migrate sin pendientes + up() directo dos veces (idempotente)
  r = sh('npx', ['--no-install', 'sequelize-cli', 'db:migrate'], 'qa5_456a'); check('segunda corrida de db:migrate: código 0 y «No migrations were executed»', r.status === 0 && /No migrations were executed/i.test(r.stdout + r.stderr), (r.stdout + r.stderr).slice(-300))
  const { Sequelize } = require(path.join(BACKEND, 'node_modules', 'sequelize')); const sq = new Sequelize(url('qa5_456a'), { logging: false, dialectOptions: { ssl: false } }); const mig = require(path.join(BACKEND, 'migrations', MIG + '.cjs'))
  let threw = null; try { await mig.up(sq); await mig.up(sq); await mig.up({ sequelize: sq }) } catch (e) { threw = e.message }; check('up() ya aplicada, tres veces seguidas (con sequelize y con {sequelize}): sin error y sigue una sola columna', threw === null && (await cols('qa5_456a')).filter((x) => x.startsWith('actorLabel')).length === 1, threw)
  // 3) filas existentes no cambian: insertar una fila ANTES de la migración (esquema previo) y comprobar
  await fresh('qa5_456b'); await admin('SELECT 1')
  const pre = sh('npx', ['--no-install', 'sequelize-cli', 'db:migrate', '--to', '20261121010000-es366-session-version.cjs'], 'qa5_456b'); check('migrar hasta la anterior (es366): código 0 (esquema previo a ES-386)', pre.status === 0, (pre.stdout + pre.stderr).slice(-300))
  check('antes: la columna NO existe', !(await cols('qa5_456b')).some((x) => x.startsWith('actorLabel')))
  await q('qa5_456b', `INSERT INTO "AdminAuditEntries" ("actorId","actorRole",action,"targetType","targetId",result,"createdAt") VALUES (NULL,'operator','user.operator_link','user',1,'ok',now())`)
  // 3b) CÓDIGO NUEVO ANTES QUE LA MIGRACIÓN: el modelo ya incluye actorLabel → qué pasa
  const probe = `process.env.DATABASE_URL=${JSON.stringify(url('qa5_456b'))};process.env.DB_SSL='false';process.env.NODE_ENV='development';const {recordAdminAction}=require('./utils/adminAudit');recordAdminAction({actor:{id:null,role:'operator',label:'ops-ana'},action:'user.operator_link',targetType:'user',targetId:1}).then(()=>{console.log('AUDIT_OK');process.exit(0)},e=>{console.log('AUDIT_FALLA '+String(e.message).slice(0,160));process.exit(0)})`
  r = cp.spawnSync(process.execPath, ['-e', probe], { cwd: BACKEND, encoding: 'utf8', timeout: 60000 }); info('código NUEVO sobre base SIN la migración (despliegue fuera de orden): ' + (r.stdout.trim().split('\n').pop() || r.stderr.slice(-200)))
  check('código nuevo y SIN la migración, auditoría CON etiqueta de operador (script): FALLA cerrado (columna inexistente), no escribe nada', /AUDIT_FALLA/.test(r.stdout) && (await q('qa5_456b', 'SELECT count(*)::int n FROM "AdminAuditEntries"'))[0].n === 1)
  const probe2 = probe.replace("label:'ops-ana'", "label:undefined").replace("{id:null,role:'operator'", "{id:7,role:'admin'")
  r = cp.spawnSync(process.execPath, ['-e', probe2], { cwd: BACKEND, encoding: 'utf8', timeout: 60000 }); check('código nuevo y SIN la migración, auditoría de una cuenta de la aplicación (sin etiqueta): FUNCIONA y la fila queda (ventana de despliegue sin fallos en las rutas de administración)', /AUDIT_OK/.test(r.stdout) && (await q('qa5_456b', 'SELECT count(*)::int n FROM "AdminAuditEntries"'))[0].n === 2, r.stdout + r.stderr.slice(-200))
  const bef = (await q('qa5_456b', 'SELECT count(*)::int n FROM "AdminAuditEntries"'))[0].n; info('filas antes de migrar:', bef)
  // 3c) migración ahora; fila antigua intacta con actorLabel NULL
  const before = JSON.stringify(await q('qa5_456b', 'SELECT * FROM "AdminAuditEntries" ORDER BY id'))
  r = sh('npx', ['--no-install', 'sequelize-cli', 'db:migrate'], 'qa5_456b'); check('migrar a la cabeza: código 0', r.status === 0, (r.stdout + r.stderr).slice(-300))
  const after = await q('qa5_456b', 'SELECT * FROM "AdminAuditEntries" ORDER BY id'); check('la fila existente no cambia (solo gana actorLabel = NULL)', after.length === bef && after.every((x) => x.actorLabel === null) && JSON.stringify(after.map(({ actorLabel, ...rest }) => rest)) === JSON.stringify(JSON.parse(before)), JSON.stringify(after))
  // 3d) código VIEJO contra base con la columna (despliegue/rollback del código): INSERT del modelo antiguo sigue funcionando
  await q('qa5_456b', `INSERT INTO "AdminAuditEntries" ("actorId","actorRole",action,"targetType","targetId",result,"createdAt") VALUES (NULL,'operator','user.operator_link','user',1,'ok',now())`); check('código viejo (INSERT sin actorLabel) sobre la base migrada: funciona (columna aditiva NULL)', (await q('qa5_456b', 'SELECT count(*)::int n FROM "AdminAuditEntries"'))[0].n === bef + 1)
  r = cp.spawnSync(process.execPath, ['-e', probe.replace("label:'ops-ana'", "label:'ops-ana'")], { cwd: BACKEND, encoding: 'utf8', timeout: 60000 }); check('código nuevo sobre la base migrada: audita y guarda actorLabel «ops-ana»', /AUDIT_OK/.test(r.stdout) && (await q('qa5_456b', `SELECT "actorLabel" FROM "AdminAuditEntries" WHERE "actorLabel" IS NOT NULL`)).length === 1, r.stdout + r.stderr)
  // 4) base creada por sync() (columna ya existe) y luego migrate: no rompe
  await fresh('qa5_456c'); r = sh('node', ['scripts/schema-sync-once.cjs'], 'qa5_456c', { ALLOW_SCHEMA_SYNC: 'true' }); info('schema-sync-once (puede exigir banderas): código ' + r.status + ' ' + (r.stdout + r.stderr).replace(/\s+/g, ' ').slice(0, 200))
  // 5) deriva
  r = sh('node', ['scripts/schema-drift.cjs'], 'postgres'); check('db:drift: sin deriva (código 0)', r.status === 0, (r.stdout + r.stderr).slice(-500)); info('drift:', (r.stdout + r.stderr).replace(/\s+/g, ' ').slice(-200))
  // 6) rollback: el down exige ALLOW_DESTRUCTIVE_MIGRATION y no corre en producción
  r = sh('npx', ['--no-install', 'sequelize-cli', 'db:migrate:undo'], 'qa5_456b'); check('down SIN permiso: se niega (código ≠ 0) y la columna sigue', r.status !== 0 && (await cols('qa5_456b')).some((x) => x.startsWith('actorLabel')), (r.stdout + r.stderr).slice(-250))
  r = sh('npx', ['--no-install', 'sequelize-cli', 'db:migrate:undo'], 'qa5_456b', { ALLOW_DESTRUCTIVE_MIGRATION: 'true', NODE_ENV: 'production' }); check('down con permiso pero NODE_ENV=production: se niega y la columna sigue', r.status !== 0 && (await cols('qa5_456b')).some((x) => x.startsWith('actorLabel')), (r.stdout + r.stderr).slice(-250))
  r = sh('npx', ['--no-install', 'sequelize-cli', 'db:migrate:undo'], 'qa5_456b', { ALLOW_DESTRUCTIVE_MIGRATION: 'true' }); check('down con permiso explícito y fuera de producción: quita la columna y las filas quedan', r.status === 0 && !(await cols('qa5_456b')).some((x) => x.startsWith('actorLabel')) && (await q('qa5_456b', 'SELECT count(*)::int n FROM "AdminAuditEntries"'))[0].n >= bef + 1, (r.stdout + r.stderr).slice(-250))
  r = sh('npx', ['--no-install', 'sequelize-cli', 'db:migrate'], 'qa5_456b'); check('volver a migrar tras el down: vuelve la columna', r.status === 0 && (await cols('qa5_456b')).some((x) => x.startsWith('actorLabel')))
  for (const d of ['qa5_456a', 'qa5_456b', 'qa5_456c']) await admin(`DROP DATABASE IF EXISTS ${d} WITH (FORCE)`)
  console.log(`#456-mig: ${ok} correctas, ${bad} fallos`) })().catch((e) => { console.error('ABORTA', e); process.exit(2) })
