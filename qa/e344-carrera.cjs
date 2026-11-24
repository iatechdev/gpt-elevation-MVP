// QA-Claude-2 — PR #338 (ES-344): carrera aprobar/rechazar la misma versión de una guía, contra PostgreSQL REAL.
// Uso: BACKEND=<clon>/backend QA_PG=postgres://usuario:clave@127.0.0.1:54331 [ROUNDS=150] node qa/e344-carrera.cjs
// Crea y borra SOLO su propia base aleatoria (loopback). Rutas y vault reales; sin llamadas a Claude; datos sintéticos.
// Diferencias con la prueba del PR: orden y desfase aleatorios (para que gane cada lado), tres peticiones a la vez, lectores
// concurrentes que consultan getActivePrompt y GET /prompt/:key DURANTE la carrera (el texto rechazado nunca debe verse),
// y comprobación del texto servido contra el ganador.
const path = require('path'), { randomBytes } = require('crypto'), { once } = require('events')
const B = process.env.BACKEND; if (!B) throw new Error('BACKEND'); const rq = (m) => require(path.join(B, 'node_modules', m)), mod = (m) => require(path.join(B, m))
const express = rq('express'), { Sequelize } = rq('sequelize')
const ROUNDS = Number(process.env.ROUNDS || 150)
let total = 0, fails = 0; const ck = (n, ok, d = '') => { total++; if (!ok) { fails++; console.log(`  FALLA ${n} ${d}`) } }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
;(async () => {
  const src = new URL(process.env.QA_PG + '/postgres'); if (!['127.0.0.1', 'localhost'].includes(src.hostname)) throw new Error('solo loopback')
  const dbName = 'qa2_e344_' + randomBytes(6).toString('hex')
  const admin = new Sequelize(src.toString(), { logging: false, dialectOptions: { ssl: false } }); await admin.query(`CREATE DATABASE "${dbName}"`)
  const url = new URL(src); url.pathname = '/' + dbName
  const sequelize = new Sequelize(url.toString(), { logging: false, dialectOptions: { ssl: false }, pool: { max: 30, min: 0, acquire: 20000 } })
  process.env.JWT_SECRET = randomBytes(32).toString('hex'); process.env.PROMPT_ENCRYPTION_KEY = randomBytes(32).toString('hex'); process.env.PROMPT_PROPOSALS_PER_HOUR = '100000'
  const dbm = require.resolve(path.join(B, 'database')); require.cache[dbm] = { id: dbm, filename: dbm, loaded: true, exports: { sequelize } }
  const User = mod('User'); await mod('PricingPlan').sync(); for (const m of ['User', 'DeletionRequest', 'AuthRevocation', 'RevokedToken']) await mod(m).sync()
  const { PromptVault, getActivePrompt } = mod('promptVault'); await PromptVault.sync(); await mod('migrations/20261107000000-es191-prompt-review.cjs').up(sequelize)
  const { issueToken } = mod('utils/sessions'), { verificarAdmin, verificarSuperAdmin } = mod('middlewares/auth')
  const app = express(); app.use(express.json()); app.use('/api/admin', verificarAdmin, mod('routes/adminPrompts')); app.use('/api/superadmin', verificarSuperAdmin, mod('routes/adminPrompts'))
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening'); const port = server.address().port
  const mk = (role, n) => User.create({ name: n, email: n.toLowerCase() + '@example.invalid', password: 'x', role })
  const [adm, s1, s2] = [await mk('admin', 'QaAdm'), await mk('superadmin', 'QaSupUno'), await mk('superadmin', 'QaSupDos')]
  const tok = new Map(); const T = (p) => { if (!tok.has(p.id)) tok.set(p.id, issueToken(p)); return tok.get(p.id) }
  const call = async (p, m, u, b) => { const r = await fetch(`http://127.0.0.1:${port}${u}`, { method: m, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${T(p)}` }, body: b === undefined ? undefined : JSON.stringify(b) }); const t = await r.text(); let j = null; try { j = JSON.parse(t) } catch { j = { raw: t.slice(0, 60) } } return { s: r.status, j } }
  const GOOD = 'Acompaña a la persona con calma y respeto, sin presionarla, y ayúdala a nombrar lo que ya hace bien. Haz una pregunta a la vez.'
  const BASE = `${GOOD} Texto base aprobado.`, PROP = (i, tag) => `${GOOD} Texto ${tag} número ${i}.`
  const rows = (key) => sequelize.query('SELECT "id","version","status","isActive" FROM "PromptVaults" WHERE "key"=:key ORDER BY "version"', { type: 'SELECT', replacements: { key } })
  const NOTE = { note: 'No corresponde a esta guía.' }
  const act = { approve: (id) => ['POST', `/api/superadmin/prompt/${id}/approve`, undefined], reject: (id) => ['POST', `/api/superadmin/prompt/${id}/reject`, NOTE], rollback: (id) => ['POST', `/api/superadmin/prompt/${id}/rollback`, undefined] }
  const SCEN = ['A+R', 'R+A', 'A+A', 'R+R', 'A+B', 'A+R+R', 'A+A+R']
  const stat = {}; let status500 = 0, served_bad = 0, readers_bad = 0, reads = 0
  for (let i = 0; i < ROUNDS; i++) {
    const sc = SCEN[i % SCEN.length], key = `qa_guia_${i}`, base = BASE, prop = PROP(i, 'propuesto'), mid = PROP(i, 'intermedio')
    ck(`r${i} crear`, (await call(s1, 'POST', '/api/superadmin/prompt/create', { key, content: base })).s === 200)
    if (sc === 'A+B') { await call(s1, 'POST', '/api/superadmin/prompt/publish', { key, content: mid }) } // v2 activa, v1 archivada
    ck(`r${i} proponer`, (await call(adm, 'POST', '/api/admin/prompt/propose', { key, content: prop })).s === 200)
    const all = await rows(key); const pending = all.find((r) => r.status === 'pending_review').id, archived = (all.find((r) => r.status === 'approved') || {}).id
    // plan de peticiones: [persona, acción, id]
    const who = [s1, s2, s1], plan = { 'A+R': [['approve', pending], ['reject', pending]], 'R+A': [['reject', pending], ['approve', pending]], 'A+A': [['approve', pending], ['approve', pending]], 'R+R': [['reject', pending], ['reject', pending]], 'A+B': [['approve', pending], ['rollback', archived]], 'A+R+R': [['approve', pending], ['reject', pending], ['reject', pending]], 'A+A+R': [['approve', pending], ['approve', pending], ['reject', pending]] }[sc]
    // lectores concurrentes durante la carrera: getActivePrompt y GET /prompt/:key (admin); registran todo lo visto
    const seen = new Set(); let stop = false
    const reader = (async () => { while (!stop) { const [a, b] = await Promise.all([getActivePrompt(key), call(adm, 'GET', `/api/admin/prompt/${key}`)]); seen.add(a); if (b.s === 200) seen.add(b.j.content); reads++; await sleep(1) } })()
    const results = await Promise.all(plan.map(async ([a, id], k) => { await sleep(Math.floor(Math.random() * 14)); const [m, u, b] = act[a](id); const r = await call(who[k], m, u, b); return { a, s: r.s, code: r.j && r.j.code } }))
    stop = true; await reader
    const codes = results.map((r) => r.s).sort(); status500 += results.filter((r) => r.s >= 500).length
    const oks = results.filter((r) => r.s === 200)
    const lose = results.filter((r) => r.s !== 200)
    // A+B (aprobar + volver a la archivada) puede dejar a ambos con 200 si se serializan (la segunda reemplaza a la primera): es legítimo; los demás: un solo 200
    const dosGanadoresOk = sc === 'A+B'
    ck(`r${i} ${sc} resultado`, (dosGanadoresOk ? oks.length >= 1 : oks.length === 1) && lose.every((r) => r.s === 409 || r.s === 422), JSON.stringify(results))
    const after = await rows(key)
    ck(`r${i} ${sc} una sola activa`, after.filter((r) => r.status === 'active').length === 1, JSON.stringify(after))
    ck(`r${i} ${sc} ninguna no activa con isActive`, !after.some((r) => r.status !== 'active' && r.isActive), JSON.stringify(after))
    const served = await getActivePrompt(key), api = await call(adm, 'GET', `/api/admin/prompt/${key}`)
    const rej = after.find((r) => r.status === 'rejected')
    if (sc === 'A+B') { ck(`r${i} ${sc} sirve activa`, served === prop || served === base, '') }
    else if (rej) { stat[sc + ':rechazar'] = (stat[sc + ':rechazar'] || 0) + 1; ck(`r${i} ${sc} ganó rechazar → sigue el texto base`, served === base, String(served).slice(0, 40)); if (seen.has(prop)) { readers_bad++; ck(`r${i} ${sc} un lector vio el texto RECHAZADO`, false) } }
    else { stat[sc + ':aprobar'] = (stat[sc + ':aprobar'] || 0) + 1; ck(`r${i} ${sc} ganó aprobar → sirve el propuesto`, served === prop) }
    ck(`r${i} GET /prompt/:key coincide con lo que sirve el chat`, api.s === 200 && api.j.content === served && api.j.status === 'active', JSON.stringify(api.j).slice(0, 80))
    if (served !== base && served !== prop && served !== mid) served_bad++
    for (const x of seen) ck(`r${i} lector vio solo texto aprobado en algún momento`, [base, prop, mid, null].includes(x) || x === undefined)
  }
  console.log('Resultados por escenario:', JSON.stringify(stat)); console.log(`peticiones 5xx: ${status500}, lecturas concurrentes: ${reads}, lectores que vieron texto rechazado: ${readers_bad}`)
  // 403: admin no aprueba ni rechaza ni vuelve; propose y 410
  const key = 'qa_roles'; await call(s1, 'POST', '/api/superadmin/prompt/create', { key, content: BASE }); await call(adm, 'POST', '/api/admin/prompt/propose', { key, content: PROP(1, 'x') })
  const r0 = await rows(key), pid = r0.find((r) => r.status === 'pending_review').id, aid = r0.find((r) => r.status === 'active').id
  for (const a of ['approve', 'reject', 'rollback']) { const [m, u, b] = act[a](pid); ck(`admin ${a} → 403`, (await call(adm, m, u, b)).s === 403) }
  ck('POST /prompt sigue en 410', (await call(s1, 'POST', '/api/superadmin/prompt', { key, content: BASE })).s === 410 && (await call(adm, 'POST', '/api/admin/prompt', { key, content: BASE })).s === 410)
  ck('sin cambios tras 403', JSON.stringify(await rows(key)) === JSON.stringify(r0))
  // id inexistente / mal formado: 404/400, nunca 500; versión ya rechazada: aprobar → 409; rollback a rechazada → 4xx
  await call(s1, 'POST', `/api/superadmin/prompt/${pid}/reject`, NOTE)
  for (const [lab, a, id] of [['aprobar rechazada', 'approve', pid], ['rechazar rechazada', 'reject', pid], ['rollback a rechazada', 'rollback', pid], ['aprobar inexistente', 'approve', 99999999], ['rechazar inexistente', 'reject', 99999999], ['id mal formado', 'approve', 'abc'], ['rechazar la activa', 'reject', aid]]) { const [m, u, b] = act[a](id); const r = await call(s1, m, u, b); ck(`${lab} → 4xx estable, no 5xx`, r.s >= 400 && r.s < 500, `${r.s} ${JSON.stringify(r.j).slice(0, 60)}`); console.log(`  info ${lab}: ${r.s}`) }
  ck('activa intacta tras rechazar la activa', (await getActivePrompt(key)) === BASE)
  // sin versión status=active: no se sirve nada (ni por isActive=true)
  await sequelize.query(`INSERT INTO "PromptVaults"("key","contentEncrypted","version","status","isActive","createdAt","updatedAt") VALUES('qa_huerfana',:c,2,'rejected',true,now(),now())`, { replacements: { c: mod('promptVault').encryptPrompt('Texto rechazado que no debe servirse.') } })
  ck('getActivePrompt de fila rechazada+isActive → null', (await getActivePrompt('qa_huerfana')) === null)
  const g = await call(adm, 'GET', '/api/admin/prompt/qa_huerfana'); console.log(`  info GET /prompt/:key con fila rechazada+isActive=true: ${g.s} ${JSON.stringify(g.j).slice(0, 160)}`)
  const lst = await call(adm, 'GET', '/api/admin/prompts'); const e = (lst.j || []).find((x) => x.key === 'qa_huerfana'); console.log(`  info GET /prompts fila rechazada+isActive=true: activeVersion=${e && e.activeVersion}`)
  console.log(`RESUMEN: ${total - fails}/${total} OK, ${fails} FALLAS`)
  server.close(); server.closeAllConnections?.(); await sequelize.close(); await admin.query(`DROP DATABASE "${dbName}"`); await admin.close(); process.exit(fails ? 1 : 0)
})().catch((e) => { console.log('EXCEPCION', e.stack || e.message); process.exit(2) })
