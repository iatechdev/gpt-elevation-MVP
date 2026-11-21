// [QA-Claude-3] PR #423: migración 20261121010000-es366-session-version sobre (a) esquema creado por db:migrate desde cero (con y sin la migración nueva) y (b) tabla anterior con filas. Base desechable propia.
// Uso: BACKEND=<wt/backend> PGBASE=postgres://elevation:elevation_local@127.0.0.1:54341 node qa/e423-migracion.cjs
const cp = require('child_process'), crypto = require('crypto'), path = require('path')
const BACKEND = process.env.BACKEND, PGBASE = process.env.PGBASE; const req = m => require(require.resolve(m, { paths: [BACKEND] })); const { Client } = req('pg'), { Sequelize } = req('sequelize')
let total = 0, fails = 0; const ck = (n, ok, d = '') => { total++; if (!ok) fails++; console.log(`${ok ? 'OK   ' : 'FALLA'} ${n}${ok ? '' : ' :: ' + d}`) }
const url = d => `${PGBASE}/${d}`; const mig = require(path.join(BACKEND, 'migrations/20261121010000-es366-session-version.cjs'))
;(async () => { const root = new Client({ connectionString: url('postgres') }); await root.connect(); const db = 'qa3_423m_' + crypto.randomBytes(4).toString('hex'); await root.query(`CREATE DATABASE ${db}`)
  try { const r = cp.spawnSync('npx', ['sequelize-cli', 'db:migrate'], { cwd: BACKEND, env: { ...process.env, DATABASE_URL: url(db), DB_SSL: 'false' }, encoding: 'utf8', shell: true }); ck('db:migrate desde una base vacía termina bien (incluye la migración nueva)', r.status === 0, (r.stdout + r.stderr).slice(-300))
    const sq = new Sequelize(url(db), { logging: false }); const q = (s, r) => sq.query(s, { type: 'SELECT', replacements: r })
    const col = async () => (await q(`SELECT data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name='AuthRevocations' AND column_name='sessionVersion'`))[0]
    let c = await col(); ck('columna sessionVersion INTEGER NOT NULL DEFAULT 0 tras db:migrate', c && /int/.test(c.data_type) && c.is_nullable === 'NO' && c.column_default === '0', JSON.stringify(c))
    // tabla "anterior": quitar la columna, sembrar filas, subir la migración
    await sq.query('ALTER TABLE "AuthRevocations" DROP COLUMN "sessionVersion"'); await sq.query('SET session_replication_role = replica')
    await sq.query(`INSERT INTO "AuthRevocations"("UserId","revokedBefore","createdAt","updatedAt") VALUES (11, now(), now(), now()), (12, now() - interval '1 day', now(), now())`); const before = await q('SELECT "UserId","revokedBefore" FROM "AuthRevocations" ORDER BY "UserId"')
    await mig.up(sq); c = await col(); const after = await q('SELECT "UserId","revokedBefore","sessionVersion" FROM "AuthRevocations" ORDER BY "UserId"')
    ck('migración sobre tabla anterior con filas: columna creada, filas existentes en 0 y revokedBefore intacto', c && after.length === 2 && after.every(x => Number(x.sessionVersion) === 0) && JSON.stringify(after.map(x => x.revokedBefore)) === JSON.stringify(before.map(x => x.revokedBefore)), JSON.stringify(after))
    await mig.up(sq); await mig.up({ sequelize: sq }); ck('idempotente: se puede ejecutar de nuevo (y con el contrato queryInterface) sin error ni cambios', JSON.stringify(await q('SELECT "UserId","revokedBefore","sessionVersion" FROM "AuthRevocations" ORDER BY "UserId"')) === JSON.stringify(after), '')
    const r2 = cp.spawnSync('npx', ['sequelize-cli', 'db:migrate:status'], { cwd: BACKEND, env: { ...process.env, DATABASE_URL: url(db), DB_SSL: 'false' }, encoding: 'utf8', shell: true }); ck('db:migrate:status lista la migración nueva como «up»', /up\s+20261121010000-es366-session-version/.test(r2.stdout), (r2.stdout + r2.stderr).slice(-300))
    // advanceCut sobre fila antigua (versión 0): sube a 1 y conserva el máximo del instante
    const AR = (() => { process.env.DATABASE_URL = url(db); process.env.DB_SSL = 'false'; return null })(); await sq.close()
  } finally { await root.query(`DROP DATABASE IF EXISTS ${db} WITH (FORCE)`).catch(() => {}); await root.end() }
  console.log(`RESUMEN: ${total - fails}/${total} OK, ${fails} FALLAS`); process.exit(fails ? 1 : 0) })().catch(e => { console.error('FALLO', e); process.exit(1) })
