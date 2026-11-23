// [QA-Claude-5] Servidor de pruebas para #398 (ES-110 PR 2): rutas REALES del backend (consents, contexto, hojas de vida, habilidades de la hoja, evidencia) con verificarToken real, PostgreSQL REAL (migraciones),
// IA SIMULADA (costo 0: el «modelo» lee la línea «QA-SKILLS: a|b|c» del documento) y CORS para el navegador. Endpoint SOLO DE PRUEBA: POST /__test/persona crea una persona sintética y devuelve su token.
// Uso: QA_BACKEND=<backend del PR> QA_PG=postgres://...@127.0.0.1:54361/postgres PORT=8197 node qa/qa5-398-server.cjs   (imprime «LISTO <puerto>»)
const crypto = require('node:crypto'); const { once } = require('node:events'); const path = require('node:path'); const { spawnSync } = require('node:child_process')
const BE = path.resolve(process.env.QA_BACKEND); const req = (p) => require(path.join(BE, p))
const { Client } = req('node_modules/pg'); const { Sequelize } = req('node_modules/sequelize')
;(async () => {
  const target = new URL(process.env.QA_PG); if (!['127.0.0.1', 'localhost'].includes(target.hostname)) throw new Error('Solo loopback')
  const dbName = `qa5_398_${crypto.randomBytes(5).toString('hex')}`; const urlFor = (n) => { const u = new URL(target.toString()); u.pathname = '/' + n; return u.toString() }
  const admin = new Client({ connectionString: target.toString(), ssl: false }); await admin.connect(); await admin.query(`CREATE DATABASE "${dbName}"`)
  const mg = spawnSync('npx', ['sequelize-cli', 'db:migrate'], { cwd: BE, encoding: 'utf8', shell: true, env: { ...process.env, DATABASE_URL: urlFor(dbName), DB_SSL: 'false', NODE_ENV: 'test' } }); if (mg.status !== 0) throw new Error('migraciones ' + (mg.stdout + mg.stderr).slice(-400))
  const app = new Sequelize(urlFor(dbName), { logging: false, dialectOptions: { ssl: false }, pool: { max: 15, min: 0, acquire: 8000 } })
  process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex'); process.env.DATA_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex'); process.env.NODE_ENV = 'test'
  process.env.AI_BUDGET_TOKENS_PER_USER = '1000000000'; process.env.AI_BUDGET_PERIOD = 'month'; process.env.RESUME_ANALYZE_RATE_MAX = process.env.RESUME_ANALYZE_RATE_MAX || '6'
  const stub = (p, exports) => { const m = require.resolve(path.join(BE, p)); require.cache[m] = { id: m, filename: m, loaded: true, exports } }
  stub('database', { sequelize: app }); let aiCalls = 0
  stub('utils/anthropic', { MODEL: 'modelo-sintetico', messages: { create: async (body) => { aiCalls += 1
    const raw = JSON.stringify(body); const m = /QA-SKILLS: ?([^"\\]+)/.exec(raw); const names = m ? m[1].split('|').map((s) => s.trim()).filter(Boolean) : []
    const out = { profession: 'Perfil sintético', interests: null, sector: null, totalYearsExperience: null, experience: [], education: [], declaredSkills: names.map((name) => ({ name, support: null })), languages: [] }
    return { content: [{ type: 'text', text: JSON.stringify(out) }], usage: { input_tokens: 300, output_tokens: 100 } } } } })
  req('associations')()
  const { issueToken } = req('utils/sessions'); const { verificarToken } = req('middlewares/auth'); const express = req('node_modules/express'); const api = express()
  api.use((rq, rs, next) => { rs.set({ 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS' }); if (rq.method === 'OPTIONS') return rs.status(204).end(); next() })
  api.use(express.json())
  api.get('/api/session', verificarToken, (rq, rs) => rs.json({ role: 'user', onboardingCompleted: true }))
  api.use('/api/consents', verificarToken, req('routes/consents')); api.use('/api/user/context', verificarToken, req('routes/participantContext'))
  api.use('/api/user/resumes', verificarToken, req('routes/resumes')); api.use('/api/user/resume-skills', verificarToken, req('routes/resumeSkills')); api.use('/api/evidence', verificarToken, req('routes/evidence'))
  const db = new Client({ connectionString: urlFor(dbName), ssl: false }); await db.connect()
  const cat = (await db.query(`INSERT INTO "SkillCatalogs" (version,status,"publishedAt","createdAt","updatedAt") VALUES (1,'published',now(),now(),now()) RETURNING id`)).rows[0].id
  for (const [key, es, en] of [['power_bi', 'Power BI', 'Power BI'], ['sql', 'SQL', 'SQL'], ['gestion_proyectos', 'Gestión de proyectos', 'Project management'], ['docker', 'Docker', 'Docker']]) await db.query(`INSERT INTO "SkillDefinitions" ("catalogId","skillKey",type,labels,rubric,"createdAt","updatedAt") VALUES ($1,$2,'domain',$3,$4,now(),now())`, [cat, key, JSON.stringify({ es, en }), JSON.stringify({ levels: { 1: { es: 'a', en: 'a' } } })])
  const columns = (await db.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='Users' AND is_nullable='NO' AND column_default IS NULL AND column_name <> 'id'`)).rows
  let seq = 0
  api.post('/__test/persona', async (rq, rs) => { seq += 1; const names = []; const values = []
    for (const c of columns) { let v; if (c.column_name === 'role') v = 'user'; else if (c.column_name === 'name') v = `Sintética ${seq}`; else if (c.data_type.includes('char') || c.data_type === 'text') v = c.column_name === 'email' ? `qa5-${seq}-${dbName}@example.test` : `sintetico-${seq}-${c.column_name}`; else if (c.data_type === 'integer') v = 0; else if (c.data_type === 'boolean') v = true; else if (c.data_type.startsWith('timestamp')) v = new Date(); else v = '{}'; names.push(`"${c.column_name}"`); values.push(v) }
    const id = (await db.query(`INSERT INTO "Users" (${names.join(',')}) VALUES (${values.map((_, i) => `$${i + 1}`).join(',')}) RETURNING id`, values)).rows[0].id; await db.query('UPDATE "Users" SET role=$2, active=true WHERE id=$1', [id, 'user']); rs.json({ id, token: issueToken({ id, role: 'user' }) }) })
  api.get('/__test/ai-calls', (rq, rs) => rs.json({ aiCalls })); api.post('/__test/sql', async (rq, rs) => { try { rs.json({ rows: (await db.query(rq.body.q, rq.body.p || [])).rows }) } catch (e) { rs.status(400).json({ error: e.message }) } })
  const server = api.listen(Number(process.env.PORT) || 8197, '127.0.0.1'); await once(server, 'listening'); console.log('LISTO ' + server.address().port)
  const stop = async () => { server.closeAllConnections?.(); server.close(); await db.end().catch(() => {}); await app.close().catch(() => {}); await admin.query(`DROP DATABASE "${dbName}" WITH (FORCE)`).catch(() => {}); await admin.end().catch(() => {}); process.exit(0) }
  process.on('SIGINT', stop); process.on('SIGTERM', stop)
})().catch((e) => { console.error('FALLA', e); process.exit(1) })
