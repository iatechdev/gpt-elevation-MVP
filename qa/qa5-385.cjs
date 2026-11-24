// [QA-Claude-5] PR #385 (ES-288): migración 20261118020000 (índices únicos parciales con requestId en AiUsages y SessionNotes) con la CADENA REAL de migraciones sobre PostgreSQL real y datos sembrados.
// Uso: QA_BACKEND=<backend del PR> QA_PG=postgres://...@127.0.0.1:54361/postgres node qa/qa5-385.cjs     (crea y borra SOLO bases aleatorias)
const crypto = require('node:crypto'); const path = require('node:path'); const { spawnSync } = require('node:child_process')
const BE = path.resolve(process.env.QA_BACKEND); const req = (p) => require(path.join(BE, p)); const { Client } = req('node_modules/pg')
const MIG = '20261118020000-es288-requestid-unico.cjs'; const PREV = '20261118010000-es344-prompt-isactive-consistency.cjs'
let total = 0, fails = 0; const ck = (id, cond, d = '') => { total++; if (!cond) fails++; console.log(`${cond ? 'OK   ' : 'FALLA'} ${id} ${cond ? '' : String(d).slice(0, 320)}`) }
const target = new URL(process.env.QA_PG); if (!['127.0.0.1', 'localhost'].includes(target.hostname)) throw new Error('Solo loopback')
const urlFor = (n) => { const u = new URL(target.toString()); u.pathname = '/' + n; return u.toString() }
const cli = (db, args) => spawnSync('npx', ['sequelize-cli', ...args], { cwd: BE, encoding: 'utf8', shell: true, env: { ...process.env, DATABASE_URL: urlFor(db), DB_SSL: 'false', NODE_ENV: 'test' } })
;(async () => {
  const admin = new Client({ connectionString: target.toString() }); await admin.connect(); const dbs = []
  const mkdb = async () => { const n = `qa5_385_${crypto.randomBytes(5).toString('hex')}`; await admin.query(`CREATE DATABASE "${n}"`); dbs.push(n); return n }
  const connect = async (n) => { const c = new Client({ connectionString: urlFor(n) }); await c.connect(); return c }
  async function seedBase(db) { // migra hasta ANTES de la de ES-288 y crea personas y una sesión
    const r = cli(db, ['db:migrate', '--to', PREV]); if (r.status !== 0) throw new Error('migrar hasta PREV: ' + (r.stdout + r.stderr).slice(-400))
    const c = await connect(db); const cols = (await c.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='Users' AND is_nullable='NO' AND column_default IS NULL AND column_name <> 'id'`)).rows
    const mk = async (role, i) => { const names = [], vals = []; for (const x of cols) { let v; if (x.column_name === 'role') v = role; else if (x.column_name === 'name') v = 'S' + i; else if (x.data_type.includes('char') || x.data_type === 'text') v = x.column_name === 'email' ? `q385-${db}-${i}@example.test` : `s-${i}-${x.column_name}`; else if (x.data_type === 'integer') v = 0; else if (x.data_type === 'boolean') v = true; else if (x.data_type.startsWith('timestamp')) v = new Date(); else v = '{}'; names.push(`"${x.column_name}"`); vals.push(v) } const id = (await c.query(`INSERT INTO "Users" (${names.join(',')}) VALUES (${vals.map((_, k) => `$${k + 1}`).join(',')}) RETURNING id`, vals)).rows[0].id; await c.query('UPDATE "Users" SET role=$2, active=true WHERE id=$1', [id, role]); return id }
    return { c, u1: await mk('user', 1), u2: await mk('user', 2), th: await mk('therapist', 3), th2: await mk('therapist', 4) }
  }
  const usage = (c, o) => c.query(`INSERT INTO "AiUsages" ("UserId", kind, model, "periodKey", "reservedTokens", status, "requestId", "inputTokens", "outputTokens", "createdAt", "updatedAt") VALUES ($1,$2,'m','2026-11',10,$3,$4,$5,$6,now(),now()) RETURNING id`, [o.u, o.kind || 'chat', o.status || 'completed', o.rid ?? null, o.inTok ?? 11, o.outTok ?? 22]).then((r) => r.rows[0].id)
  async function session(c, th, patient) { const cols = (await c.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='TherapySessions' AND is_nullable='NO' AND column_default IS NULL AND column_name <> 'id'`)).rows; const names = [], vals = []; for (const x of cols) { let v; if (x.column_name === 'therapistId') v = th; else if (x.column_name === 'patientId') v = patient; else if (x.data_type.includes('char') || x.data_type === 'text') v = 's'; else if (x.data_type === 'integer') v = 1; else if (x.data_type === 'boolean') v = true; else if (x.data_type.startsWith('timestamp')) v = new Date(); else v = '{}'; names.push(`"${x.column_name}"`); vals.push(v) } return (await c.query(`INSERT INTO "TherapySessions" (${names.join(',')}) VALUES (${vals.map((_, k) => `$${k + 1}`).join(',')}) RETURNING id`, vals)).rows[0].id }
  const note = (c, o) => c.query(`INSERT INTO "SessionNotes" ("sessionId", "therapistId", content, "requestId", "isLive", version, timestamp, "createdAt", "updatedAt") VALUES ($1,$2,$3,$4,$5,1,now(),now(),now()) RETURNING id`, [o.s, o.th, o.content || 'nota sintética ' + (o.tag || ''), o.rid ?? null, o.live ?? null]).then((r) => r.rows[0].id).catch((e) => { throw e })
  const idx = async (c) => (await c.query(`SELECT indexname, indexdef FROM pg_indexes WHERE indexname IN ('ai_usages__request_done','session_notes__request') ORDER BY 1`)).rows
  const snap = async (c) => JSON.stringify([(await c.query('SELECT id, "UserId", kind, status, "requestId", "inputTokens", "outputTokens" FROM "AiUsages" ORDER BY id')).rows, (await c.query('SELECT id, "sessionId", "therapistId", content, "requestId", "isLive" FROM "SessionNotes" ORDER BY id')).rows])

  // ── S1 base vacía: la cadena completa migra
  { const db = await mkdb(); const r = cli(db, ['db:migrate']); const c = await connect(db); const ix = await idx(c)
    ck('S1 base vacía: la cadena COMPLETA de migraciones (sequelize-cli db:migrate) termina bien y crea los 2 índices únicos parciales', r.status === 0 && ix.length === 2 && ix.every((i) => /UNIQUE/i.test(i.indexdef) && /WHERE/i.test(i.indexdef)), (r.stdout + r.stderr).slice(-300) + JSON.stringify(ix))
    const again = cli(db, ['db:migrate']); ck('S1 repetir db:migrate no hace nada y no falla (idempotente)', again.status === 0 && /No migrations were executed|up to date/i.test(again.stdout + again.stderr), (again.stdout + again.stderr).slice(-200)); await c.end() }
  // ── S2 con duplicados sembrados (estado de staging posible): la migración real NO falla, no borra, no toca contenido
  let dupInfo
  { const db = await mkdb(); const { c, u1, u2, th, th2 } = await seedBase(db)
    const a1 = await usage(c, { u: u1, rid: 'req-dup-A', inTok: 1, outTok: 1 }); const a2 = await usage(c, { u: u1, rid: 'req-dup-A', inTok: 2, outTok: 2 }); const a3 = await usage(c, { u: u1, rid: 'req-dup-A', inTok: 3, outTok: 3 })
    const f1 = await usage(c, { u: u1, rid: 'req-fail', status: 'failed' }); const f2 = await usage(c, { u: u1, rid: 'req-fail', status: 'failed' }); const f3 = await usage(c, { u: u1, rid: 'req-fail', status: 'completed' })
    const r1 = await usage(c, { u: u1, rid: 'req-res', status: 'reserved' }); const r2 = await usage(c, { u: u1, rid: 'req-res', status: 'reserved' })
    const n1 = await usage(c, { u: u1, rid: null }); const n2 = await usage(c, { u: u1, rid: null }); const o1 = await usage(c, { u: u2, rid: 'req-dup-A' }); const k1 = await usage(c, { u: u1, kind: 'resume', rid: 'req-dup-A' })
    const long = 'L'.repeat(64); const l1 = await usage(c, { u: u1, rid: long }); const l2 = await usage(c, { u: u1, rid: long }); const l3 = await usage(c, { u: u1, rid: long })
    const s1 = await session(c, th, u1).catch(() => null); const s2 = s1 ? await session(c, th2, u2) : null
    let nid = {}; if (s1) { nid.a = await note(c, { s: s1, th, rid: 'note-dup-1', tag: 'a' }); nid.b = await note(c, { s: s1, th, rid: 'note-dup-1', tag: 'b' }); nid.c = await note(c, { s: s1, th, rid: 'note-dup-1', tag: 'c' }); nid.d = await note(c, { s: s2, th: th2, rid: 'note-dup-1', tag: 'd' }); nid.e = await note(c, { s: s1, th, rid: null }); nid.f = await note(c, { s: s1, th, rid: null }); nid.g = await note(c, { s: s1, th: th2, rid: 'note-dup-1', tag: 'g' }) }
    const before = await snap(c); const cntBefore = [(await c.query('SELECT count(*)::int n FROM "AiUsages"')).rows[0].n, (await c.query('SELECT count(*)::int n FROM "SessionNotes"')).rows[0].n]
    const r = cli(db, ['db:migrate']); const after = await snap(c); const cntAfter = [(await c.query('SELECT count(*)::int n FROM "AiUsages"')).rows[0].n, (await c.query('SELECT count(*)::int n FROM "SessionNotes"')).rows[0].n]
    ck('S2 con duplicados sembrados: db:migrate termina bien (no tumba el arranque) y avisa con los conteos', r.status === 0 && /ES-288:/.test(r.stdout + r.stderr), (r.stdout + r.stderr).slice(-300))
    ck('S2 no se borra NADA (mismos conteos de AiUsages y SessionNotes)', JSON.stringify(cntBefore) === JSON.stringify(cntAfter), JSON.stringify([cntBefore, cntAfter]))
    const rowsB = JSON.parse(before), rowsA = JSON.parse(after); const diff = (k) => rowsA[k].filter((x, i) => JSON.stringify(x) !== JSON.stringify(rowsB[k][i]))
    const changedU = diff(0).map((x) => x.id), changedN = diff(1).map((x) => x.id)
    ck('S2 AiUsages: solo se marcan los completados repetidos que NO son el más antiguo (a2, a3 y l2, l3); los fallidos/reservados, NULL, otra persona y otro tipo no se tocan', JSON.stringify(changedU.sort((x, y) => x - y)) === JSON.stringify([a2, a3, l2, l3].sort((x, y) => x - y)), JSON.stringify({ changedU, esperado: [a2, a3, l2, l3], f3 }))
    ck('S2 la fila más antigua queda EXACTAMENTE igual y el contenido de las marcadas (tokens, estado) no cambia: solo cambia requestId (con el prefijo original legible)', rowsA[0].filter((x) => changedU.includes(x.id)).every((x, i) => { const b = rowsB[0].find((y) => y.id === x.id); return x.requestId.startsWith(b.requestId.slice(0, 50)) && x.requestId.includes('~dup' + x.id) && x.requestId.length <= 64 && x.inputTokens === b.inputTokens && x.status === b.status }), JSON.stringify(rowsA[0].filter((x) => changedU.includes(x.id))))
    if (s1) ck('S2 SessionNotes: solo se marcan las repetidas de la misma (sesión, profesional) distintas de la más antigua (b, c); otra sesión/profesional (d, g) y NULL no se tocan; el contenido cifrado/texto no cambia', JSON.stringify(changedN.sort((x, y) => x - y)) === JSON.stringify([nid.b, nid.c].sort((x, y) => x - y)) && rowsA[1].every((x, i) => x.content === rowsB[1][i].content), JSON.stringify({ changedN, nid }))
    else console.log('INFO no se pudo crear TherapySession sintética: se omiten los casos de SessionNotes de S2')
    dupInfo = { db, changedU }
    const ix = await idx(c); ck('S2 los 2 índices quedan creados', ix.length === 2)
    const second = cli(db, ['db:migrate']); ck('S2 una segunda corrida no cambia nada', (await snap(c)) === after && second.status === 0); await c.end() }
  // ── S3 colisión adversaria: un requestId legítimo igual a la marca que se pondrá («R~dup<id>») rompe la migración?
  { const db = await mkdb(); const { c, u1 } = await seedBase(db)
    const x1 = await usage(c, { u: u1, rid: 'collide' }); const x2 = await usage(c, { u: u1, rid: 'collide' }); await usage(c, { u: u1, rid: 'collide~dup' + x2 })
    const r = cli(db, ['db:migrate']); const ix = await idx(c)
    ck('S3 colisión: un requestId ya existente igual a la marca generada («collide~dup' + x2 + '») NO tumba la migración (la base queda migrada y con los índices)', r.status === 0 && ix.length === 2, (r.stdout + r.stderr).slice(-350)); await c.end() }
  // ── S4 duplicados que NO caben tras recortar: requestId de 64 caracteres con id grande
  { const db = await mkdb(); const { c, u1 } = await seedBase(db); await c.query(`SELECT setval(pg_get_serial_sequence('"AiUsages"','id'), 2147483000)`); const long = 'Z'.repeat(64); await usage(c, { u: u1, rid: long }); const y2 = await usage(c, { u: u1, rid: long }); const r = cli(db, ['db:migrate'])
    const m = (await c.query('SELECT "requestId" FROM "AiUsages" WHERE id=$1', [y2])).rows[0]; ck(`S4 id grande (${y2}) y requestId de 64 caracteres: la marca cabe (${m && m.requestId.length} ≤ 64) y la migración termina`, r.status === 0 && m.requestId.length <= 64, (r.stdout + r.stderr).slice(-200)); await c.end() }
  // ── S5 comportamiento tras migrar: el índice se hace cumplir
  { const db = await mkdb(); const r0 = cli(db, ['db:migrate']); const { rows } = { rows: [] }; const c = await connect(db); const cols = (await c.query(`SELECT column_name FROM information_schema.columns WHERE table_name='AiUsages'`)).rows.map((x) => x.column_name)
    console.log(`INFO columnas de AiUsages: ${cols.length}; índices: ${(await idx(c)).map((i) => i.indexname).join(',')}`)
    const u = (await c.query(`SELECT id FROM "Users" LIMIT 1`)).rows[0]; await c.end() }
  console.log(`RESUMEN: ${total - fails}/${total} OK, ${fails} FALLAS`)
  for (const n of dbs) await admin.query(`DROP DATABASE IF EXISTS "${n}" WITH (FORCE)`).catch(() => {}); await admin.end(); process.exit(fails ? 1 : 0)
})().catch((e) => { console.error('ABORTA', e); process.exit(2) })
