// [QA-Claude-3] PR #417 (E385-1/E385-4): migración 20261118020000-es288-requestid-unico. Base de datos desechable propia (loopback), bases con nombre aleatorio que se borran. Datos sintéticos.
// Escenarios: S = esquema creado por sync(); M = esquema creado por las migraciones (db:migrate) con los índices quitados para sembrar duplicados. En ambos: duplicados + marcas que chocan + 64 caracteres, idempotencia, nada se borra, concurrencia.
// Uso: BACKEND=<ruta backend del head fusionado> PGBASE=postgres://elevation:elevation_local@127.0.0.1:54341 node qa/e417-migracion.cjs
const path = require('path'), cp = require('child_process'), crypto = require('crypto')
const BACKEND = process.env.BACKEND, PGBASE = process.env.PGBASE
const req = m => require(require.resolve(m, { paths: [BACKEND] }))
const { Client } = req('pg'), { Sequelize } = req('sequelize')
let total = 0, fails = 0; const ck = (n, ok, d = '') => { total++; if (!ok) fails++; console.log(`${ok ? 'OK   ' : 'FALLA'} ${n}${ok ? '' : ' :: ' + d}`) }
const rnd = () => 'qa3_417_' + crypto.randomBytes(5).toString('hex')
const url = db => `${PGBASE}/${db}`
async function seedTools(sq) {
  const q = (sql, r) => sq.query(sql, { type: 'SELECT', replacements: r })
  const cols = async table => q(`SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name = :t`, { t: table })
  const ins = async (table, vals) => { const cs = await cols(table); const row = {}; for (const c of cs) { if (c.column_name === 'id') continue; if (c.column_name in vals) row[c.column_name] = vals[c.column_name]; else if (c.is_nullable === 'NO' && !c.column_default) row[c.column_name] = /int/.test(c.data_type) ? 1 : /bool/.test(c.data_type) ? false : /timestamp/.test(c.data_type) ? new Date() : /json/.test(c.data_type) ? '{}' : 'x' }
    const keys = Object.keys(row); const [r] = await sq.query(`INSERT INTO "${table}" (${keys.map(k => `"${k}"`).join(',')}) VALUES (${keys.map(k => ':' + k).join(',')}) RETURNING id`, { replacements: row, type: 'SELECT' }); return r.id }
  return { q, ins }
}
async function dupsAndChecks(label, sq, mig, { dropIdx }) {
  const { q, ins } = await seedTools(sq)
  if (dropIdx) { await sq.query('DROP INDEX IF EXISTS "ai_usages__request_done"'); await sq.query('DROP INDEX IF EXISTS "session_notes__request"') }
  const A = { UserId: 1, kind: 'chat', status: 'completed' }; const long = 'L'.repeat(64)
  const ids = {}
  ids.a1 = await ins('AiUsages', { ...A, requestId: 'dup-A' }); ids.a2 = await ins('AiUsages', { ...A, requestId: 'dup-A' }); ids.a3 = await ins('AiUsages', { ...A, requestId: 'dup-A' })
  ids.collide = await ins('AiUsages', { ...A, requestId: `dup-A~dup${ids.a2}` }) // la marca natural de a2 ya está ocupada en su grupo (E385-1)
  ids.l1 = await ins('AiUsages', { ...A, requestId: long }); ids.l2 = await ins('AiUsages', { ...A, requestId: long }) // 64 caracteres (E385-4)
  ids.f1 = await ins('AiUsages', { ...A, status: 'failed', requestId: 'dup-F' }); ids.f2 = await ins('AiUsages', { ...A, status: 'failed', requestId: 'dup-F' }) // fuera del índice parcial
  ids.o1 = await ins('AiUsages', { ...A, UserId: 2, requestId: 'dup-A' }) // otra persona: otro grupo
  ids.n1 = await ins('AiUsages', { ...A, requestId: null }); ids.n2 = await ins('AiUsages', { ...A, requestId: null })
  const N = { sessionId: 1, therapistId: 1 }; ids.s1 = await ins('SessionNotes', { ...N, requestId: 'note-R' }); ids.s2 = await ins('SessionNotes', { ...N, requestId: 'note-R' }); ids.s3 = await ins('SessionNotes', { ...N, requestId: `note-R~dup${ids.s2}` }); ids.s4 = await ins('SessionNotes', { ...N, requestId: long }); ids.s5 = await ins('SessionNotes', { ...N, requestId: long })
  const snap = async () => ({ a: await q('SELECT * FROM "AiUsages" ORDER BY id'), s: await q('SELECT * FROM "SessionNotes" ORDER BY id') })
  const before = await snap(); const hash = rows => rows.map(r => { const { requestId, updatedAt, ...rest } = r; return crypto.createHash('sha1').update(JSON.stringify(rest)).digest('hex') })
  let res1, err1; try { res1 = await mig.up(sq) } catch (e) { err1 = e }
  ck(`${label}: la migración con duplicados y marcas que chocan NO falla`, !err1, err1 && err1.message.slice(0, 120))
  if (err1) return
  const after = await snap()
  ck(`${label}: no se borró ni se añadió ninguna fila`, after.a.length === before.a.length && after.s.length === before.s.length, `${before.a.length}/${before.s.length} → ${after.a.length}/${after.s.length}`)
  ck(`${label}: solo cambió requestId (todo lo demás idéntico fila a fila)`, JSON.stringify(hash(before.a)) === JSON.stringify(hash(after.a)) && JSON.stringify(hash(before.s)) === JSON.stringify(hash(after.s)), '')
  const byId = (rows, id) => rows.find(r => r.id === id)
  ck(`${label}: la fila más antigua de cada grupo conserva su requestId`, byId(after.a, ids.a1).requestId === 'dup-A' && byId(after.a, ids.l1).requestId === long && byId(after.s, ids.s1).requestId === 'note-R' && byId(after.s, ids.s4).requestId === long, '')
  ck(`${label}: el duplicado cuya marca natural estaba ocupada recibe «_n» y es único (E385-1)`, /^dup-A~dup\d+_\d+$/.test(byId(after.a, ids.a2).requestId) && byId(after.a, ids.collide).requestId === `dup-A~dup${ids.a2}` && /_\d+$/.test(byId(after.s, ids.s2).requestId), `${byId(after.a, ids.a2).requestId} | ${byId(after.s, ids.s2).requestId}`)
  ck(`${label}: a3 se marca con el formato de siempre «dup-A~dup<id>»`, byId(after.a, ids.a3).requestId === `dup-A~dup${ids.a3}`, byId(after.a, ids.a3).requestId)
  ck(`${label}: 64 caracteres: la marca cabe (≤ 64), conserva el prefijo del original y es única (E385-4)`, [byId(after.a, ids.l2), byId(after.s, ids.s5)].every(r => r.requestId.length <= 64 && r.requestId.startsWith('L'.repeat(40)) && /~dup\d+/.test(r.requestId)), `${byId(after.a, ids.l2).requestId.length}/${byId(after.s, ids.s5).requestId.length}`)
  ck(`${label}: filas «failed», de otra persona y sin requestId quedan intactas`, byId(after.a, ids.f1).requestId === 'dup-F' && byId(after.a, ids.f2).requestId === 'dup-F' && byId(after.a, ids.o1).requestId === 'dup-A' && byId(after.a, ids.n1).requestId === null && byId(after.a, ids.n2).requestId === null, '')
  const uniqA = (await q(`SELECT count(*) - count(DISTINCT ("UserId","kind","requestId")) AS d FROM "AiUsages" WHERE "requestId" IS NOT NULL AND "status"='completed'`))[0].d, uniqS = (await q(`SELECT count(*) - count(DISTINCT ("sessionId","therapistId","requestId")) AS d FROM "SessionNotes" WHERE "requestId" IS NOT NULL`))[0].d
  ck(`${label}: no quedan duplicados dentro de los índices y existen los dos índices únicos parciales`, Number(uniqA) === 0 && Number(uniqS) === 0 && (await q(`SELECT indexname FROM pg_indexes WHERE indexname IN ('ai_usages__request_done','session_notes__request')`)).length === 2, `${uniqA}/${uniqS}`)
  const snap2 = JSON.stringify(await snap()); const res2 = await mig.up(sq); const snap3 = JSON.stringify(await snap())
  ck(`${label}: idempotente: la segunda ejecución no cambia nada (0 duplicados resueltos)`, snap2 === snap3 && Object.values(res2).every(n => n === 0), JSON.stringify(res2))
  // concurrencia con requestId repetido
  const par = async (table, base) => { const rs = await Promise.allSettled([...Array(10)].map(() => ins(table, base))); return { ok: rs.filter(r => r.status === 'fulfilled').length, uq: rs.filter(r => r.status === 'rejected' && /unique|único|duplic/i.test(String(r.reason?.message || r.reason))).length } }
  const pa = await par('AiUsages', { ...A, UserId: 7, requestId: 'race-1' }), ps = await par('SessionNotes', { ...N, sessionId: 7, requestId: 'race-1' }), pf = await par('AiUsages', { ...A, UserId: 7, status: 'failed', requestId: 'race-2' })
  ck(`${label}: 10 inserciones simultáneas con el MISMO requestId → 1 sola entra (AiUsages completadas y SessionNotes), las demás chocan con el índice`, pa.ok === 1 && pa.uq === 9 && ps.ok === 1 && ps.uq === 9, JSON.stringify([pa, ps]))
  ck(`${label}: los consumos «failed» con el mismo requestId siguen pudiendo repetirse (10/10)`, pf.ok === 10, JSON.stringify(pf))
}
;(async () => {
  const root = new Client({ connectionString: url('postgres') }); await root.connect(); const dbs = []
  const mkdb = async () => { const n = rnd(); await root.query(`CREATE DATABASE ${n}`); dbs.push(n); return n }
  const mig = require(path.join(BACKEND, 'migrations/20261118020000-es288-requestid-unico.cjs'))
  try {
    { const db = await mkdb(); const sq = new Sequelize(url(db), { logging: false }); process.env.DATABASE_URL = url(db); process.env.DB_SSL = 'false'
      const r = cp.spawnSync('node', ['-e', `const {sequelize}=require('./database');Promise.all([require('./AiUsage').sync(),require('./SessionNote').sync()]).then(()=>sequelize.close()).then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1)})`], { cwd: BACKEND, env: { ...process.env, DATABASE_URL: url(db), DB_SSL: 'false' }, encoding: 'utf8' })
      ck('S: tablas creadas por sync() (sin los índices)', r.status === 0, r.stderr.slice(0, 200)); await dupsAndChecks('S[sync]', sq, mig, { dropIdx: true }); await sq.close() }
    { const db = await mkdb(); const sq = new Sequelize(url(db), { logging: false })
      const r = cp.spawnSync('npx', ['sequelize-cli', 'db:migrate'], { cwd: BACKEND, env: { ...process.env, DATABASE_URL: url(db), DB_SSL: 'false' }, encoding: 'utf8', shell: process.platform === 'win32' })
      ck('M: esquema creado por db:migrate desde una base vacía', r.status === 0, (r.stdout + r.stderr).slice(-300)); if (r.status === 0) { await sq.close(); const one = new Sequelize(url(db), { logging: false, pool: { max: 1 } }); await one.query('SET session_replication_role = replica'); /* las claves foráneas reales no importan para sembrar: solo se prueba el índice */ await dupsAndChecks('M[migraciones]', one, mig, { dropIdx: true }); await one.close() } else await sq.close() }
  } finally { for (const n of dbs) await root.query(`DROP DATABASE IF EXISTS ${n} WITH (FORCE)`).catch(() => {}); await root.end() }
  console.log(`RESUMEN: ${total - fails}/${total} OK, ${fails} FALLAS`); process.exit(fails ? 1 : 0)
})().catch(e => { console.error('FALLO', e); process.exit(1) })
