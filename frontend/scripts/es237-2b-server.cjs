// ES-237 (paso 2b): servidor LOCAL para probar las pantallas en un navegador contra el backend REAL (routers de ES-31/32/33) y PostgreSQL REAL embebido. Solo local y con datos SINTÉTICOS: nada de staging ni de producción, 0 IA.
// Qué monta: /api/experiments, /api/routes, /api/route-catalog con verificarToken real, un /api/session mínimo (el marco de persona lo consulta) y un endpoint SOLO DE PRUEBA, POST /__test/persona,
// que crea una persona sintética nueva (con disponibilidad semanal confirmada) y devuelve su token. NO_CATALOG=1 no publica el catálogo (para ver el 503 catalog_unavailable como estado real).
// Uso (desde frontend/): ES237_BACKEND_DIR=../backend NODE_PATH=../backend/node_modules PORT=8197 node scripts/es237-2b-server.cjs   (imprime «LISTO <puerto>» cuando está listo; Ctrl+C lo detiene)
const assert = require('node:assert/strict')
const path = require('node:path'), os = require('node:os'), fs = require('node:fs'), net = require('node:net')
const { createRequire } = require('node:module'), { pathToFileURL } = require('node:url')
const { randomBytes } = require('node:crypto')
const { once } = require('node:events')

;(async () => {
  assert.ok(process.env.ES237_BACKEND_DIR, 'Se necesita ES237_BACKEND_DIR')
  const backend = path.resolve(process.env.ES237_BACKEND_DIR), fromBackend = createRequire(path.join(backend, 'package.json'))
  const { default: EmbeddedPostgres } = await import(pathToFileURL(fromBackend.resolve('embedded-postgres')).href)
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'es237-2b-pg-'))
  const probe = net.createServer()
  const port = await new Promise((resolve, reject) => { probe.once('error', reject); probe.listen(0, '127.0.0.1', () => { const p = probe.address().port; probe.close(() => resolve(p)) }) })
  const password = randomBytes(24).toString('hex')
  const pg = new EmbeddedPostgres({ databaseDir: directory, user: 'es237_test', password, port, persistent: false, initdbFlags: ['--encoding=UTF8', '--locale=C'], postgresFlags: ['-h', '127.0.0.1'], onLog: () => {}, onError: () => {} })
  let started = false, sequelize, server
  const stop = async () => {
    if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)) }
    if (sequelize) await sequelize.close().catch(() => {})
    if (started) await pg.stop().catch(() => {})
    try { fs.rmSync(directory, { recursive: true, force: true, maxRetries: 8, retryDelay: 250 }) } catch { /* Windows puede tardar en soltar la carpeta */ }
  }
  process.on('SIGINT', () => { void stop().then(() => process.exit(0)) }); process.on('SIGTERM', () => { void stop().then(() => process.exit(0)) })
  try {
    await pg.initialise(); await pg.start(); started = true
    const { Sequelize } = fromBackend('sequelize')
    sequelize = new Sequelize(`postgres://es237_test:${password}@127.0.0.1:${port}/postgres`, { logging: false, dialectOptions: { ssl: false }, pool: { max: 12, min: 0 } })
    process.env.JWT_SECRET = randomBytes(32).toString('hex'); process.env.DATA_ENCRYPTION_KEY = randomBytes(32).toString('hex'); process.env.NODE_ENV = 'test'
    const dbModule = fromBackend.resolve('./database'); require.cache[dbModule] = { id: dbModule, filename: dbModule, loaded: true, exports: { sequelize } }
    fromBackend('./associations')()
    const { CORE } = fromBackend('./utils/personalData'); for (const [, model] of CORE) fromBackend('./' + model)
    for (const model of ['PricingPlan', 'ProfessionalApplication', 'ProfessionalApplicationFile', 'ConsentEvent', 'TherapistValidation', 'AuthRevocation', 'RevokedToken', 'ExportRequest', 'DeletionRequest', 'RouteCatalog', 'RouteCatalogItem', 'SkillCatalog', 'SkillDefinition']) fromBackend('./' + model)
    await sequelize.sync()
    const User = fromBackend('./User'), ParticipantContext = fromBackend('./ParticipantContext')
    const { encriptarV2 } = fromBackend('./utils/crypto'), { validateContextRequest } = fromBackend('./utils/participantContext')
    const { seedDemo } = fromBackend('./utils/demoSeed'), { issueToken } = fromBackend('./utils/sessions')
    // El catálogo SINTÉTICO sale del seed de demostración (marcado synthetic); con NO_CATALOG=1 no se publica nada.
    if (process.env.NO_CATALOG !== '1') await seedDemo({ env: { ALLOW_SYNTHETIC_CATALOG: 'true', DEMO_USER_PASSWORD: randomBytes(12).toString('hex') } })
    const baseContext = { preferredLanguage: 'es', residenceCountry: 'CO', targetMarket: 'DK', timeZone: 'America/Bogota', profession: 'Docencia sintética', interests: null, availabilityMinutesPerWeek: 90, careerGoal: null, careerConstraints: null, sector: null, totalYearsExperience: null, experience: [], education: [], declaredSkills: [], languages: [] }
    let counter = 0
    const persona = async () => {
      const user = await User.create({ name: 'SYNTHETIC persona', email: `persona${++counter}-${randomBytes(4).toString('hex')}@example.invalid`, password: randomBytes(32).toString('hex'), role: 'user', active: true })
      const valid = validateContextRequest({ schemaVersion: 2, expectedVersion: 0, action: 'save_draft', context: baseContext }); assert.ok(!valid.error, JSON.stringify(valid))
      await ParticipantContext.create({ content: encriptarV2(JSON.stringify(valid.context)), completedAt: new Date(), UserId: user.id, version: 1 })
      return { token: issueToken(user), userId: user.id }
    }
    const express = fromBackend('express'), app = express(), { verificarToken } = fromBackend('./middlewares/auth')
    app.use((req, res, next) => { res.set({ 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS' }); if (req.method === 'OPTIONS') return res.status(204).end(); next() })
    app.use(express.json())
    app.get('/api/session', verificarToken, (req, res) => res.json({ role: 'user', onboardingCompleted: true }))
    app.post('/__test/persona', async (req, res) => res.json(await persona()))
    app.use('/api/experiments', verificarToken, fromBackend('./routes/careerPlan').experiments)
    app.use('/api/routes', verificarToken, fromBackend('./routes/routes')); app.use('/api/route-catalog', verificarToken, fromBackend('./routes/routeCatalog'))
    server = app.listen(Number(process.env.PORT) || 0, '127.0.0.1'); await once(server, 'listening')
    console.log(`LISTO ${server.address().port}`)
    await new Promise(() => {}) // hasta que lo detengan
  } catch (error) { console.error('FALLA', error); await stop(); process.exit(1) }
})()
