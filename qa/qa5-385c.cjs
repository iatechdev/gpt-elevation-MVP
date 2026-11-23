// [QA-Claude-5] PR #385: coste de la migración sobre una tabla GRANDE (AiUsages con N filas y duplicados) y su efecto sobre las escrituras concurrentes (LOCK TABLE … SHARE ROW EXCLUSIVE), y carrera «duplicado que entra durante la migración».
// Uso: QA_BACKEND=<backend> QA_PG=... [ROWS=300000] [ITER=6] node qa/qa5-385c.cjs
const crypto = require('node:crypto'); const path = require('node:path'); const { spawn, spawnSync } = require('node:child_process')
const BE = path.resolve(process.env.QA_BACKEND); const { Client } = require(path.join(BE, 'node_modules/pg')); const ROWS = +(process.env.ROWS || 300000); const ITER = +(process.env.ITER || 6)
const PREV = '20261118010000-es344-prompt-isactive-consistency.cjs'
;(async () => {
  const target = new URL(process.env.QA_PG); const admin = new Client({ connectionString: target.toString() }); await admin.connect(); const dbs = []
  const urlFor = (n) => { const u = new URL(target.toString()); u.pathname = '/' + n; return u.toString() }
  let failed = 0, ok = 0, maxBlock = 0, migMs = []
  for (let it = 0; it < ITER; it++) {
    const db = `qa5_385c_${crypto.randomBytes(4).toString('hex')}`; await admin.query(`CREATE DATABASE "${db}"`); dbs.push(db)
    const r = spawnSync('npx', ['sequelize-cli', 'db:migrate', '--to', PREV], { cwd: BE, encoding: 'utf8', shell: true, env: { ...process.env, DATABASE_URL: urlFor(db), DB_SSL: 'false', NODE_ENV: 'test' } }); if (r.status !== 0) throw new Error('prev ' + (r.stdout + r.stderr).slice(-200))
    const c = new Client({ connectionString: urlFor(db) }); await c.connect(); const cols = (await c.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='Users' AND is_nullable='NO' AND column_default IS NULL AND column_name <> 'id'`)).rows
    const names = [], vals = []; for (const x of cols) { let v; if (x.column_name === 'role') v = 'user'; else if (x.column_name === 'name') v = 'S'; else if (x.data_type.includes('char') || x.data_type === 'text') v = x.column_name === 'email' ? `q@${db}.test` : 's-' + x.column_name; else if (x.data_type === 'integer') v = 0; else if (x.data_type === 'boolean') v = true; else if (x.data_type.startsWith('timestamp')) v = new Date(); else v = '{}'; names.push(`"${x.column_name}"`); vals.push(v) }
    const uid = (await c.query(`INSERT INTO "Users" (${names.join(',')}) VALUES (${vals.map((_, k) => `$${k + 1}`).join(',')}) RETURNING id`, vals)).rows[0].id
    await c.query(`INSERT INTO "AiUsages" ("UserId", kind, model, "periodKey", "reservedTokens", status, "requestId", "inputTokens", "outputTokens", "createdAt", "updatedAt") SELECT $1, 'chat', 'm', '2026-11', 10, 'completed', 'req-' || (g % ($2/2)), 1, 1, now(), now() FROM generate_series(1,$2) g`, [uid, ROWS])
    // hilo escritor: inserta un consumo completado con requestId REPETIDO cada ~2 ms durante la migración y mide cuánto tarda cada INSERT
    const w = new Client({ connectionString: urlFor(db) }); await w.connect(); let stop = false; let worst = 0; let n = 0
    const writer = (async () => { while (!stop) { const t = Date.now(); try { await w.query(`INSERT INTO "AiUsages" ("UserId", kind, model, "periodKey", "reservedTokens", status, "requestId", "createdAt", "updatedAt") VALUES ($1,'chat','m','2026-11',10,'completed',$2,now(),now())`, [uid, 'race-' + (n++ % 3)]) } catch { /* unicidad tras el índice */ } worst = Math.max(worst, Date.now() - t); await new Promise((r2) => setTimeout(r2, 2)) } })()
    const t0 = Date.now(); const m = spawnSync('npx', ['sequelize-cli', 'db:migrate'], { cwd: BE, encoding: 'utf8', shell: true, env: { ...process.env, DATABASE_URL: urlFor(db), DB_SSL: 'false', NODE_ENV: 'test' } }); const ms = Date.now() - t0; stop = true; await writer; await w.end()
    const ix = (await c.query(`SELECT count(*)::int n FROM pg_indexes WHERE indexname IN ('ai_usages__request_done','session_notes__request')`)).rows[0].n
    const dups = (await c.query(`SELECT count(*)::int n FROM (SELECT 1 FROM "AiUsages" WHERE status='completed' AND "requestId" IS NOT NULL GROUP BY "UserId", kind, "requestId" HAVING count(*) > 1) x`)).rows[0].n
    if (m.status === 0 && ix === 2 && dups === 0) ok++; else { failed++; console.log(`  corrida ${it}: FALLÓ status=${m.status} índices=${ix} duplicados restantes=${dups} :: ${(m.stdout + m.stderr).slice(-200).replace(/\s+/g, ' ')}`) }
    maxBlock = Math.max(maxBlock, worst); migMs.push(ms); await c.end()
  }
  console.log(`MIGRACIÓN con ${ROWS} filas en AiUsages (la mitad duplicadas) y un escritor concurrente: ${ok}/${ITER} corridas OK, ${failed} fallidas · duración de db:migrate (incluye arranque de sequelize-cli): ${JSON.stringify(migMs)} ms · INSERT concurrente más lento durante la migración: ${maxBlock} ms`)
  for (const n of dbs) await admin.query(`DROP DATABASE IF EXISTS "${n}" WITH (FORCE)`).catch(() => {}); await admin.end(); process.exit(failed ? 1 : 0)
})().catch((e) => { console.error('ABORTA', e); process.exit(2) })
