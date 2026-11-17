// ES-237 (paso 1): el cliente `src/career/api.ts` contra el servidor REAL (routers de ES-33) y PostgreSQL REAL. Sin pantallas, sin IA, sin simulaciones de la base ni del servidor; datos sintéticos.
// Las dependencias de ES-14/ES-32 (contexto, rutas, elección) son las reales (seedDemo). Cubre: titular por token, requestId repetido, versión caducada, transición inválida, IDs ajenos = 404,
// entradas hostiles = 400 sin 500, y el plan (proponer → aceptar → pausar). Recordatorios: no cubiertos aquí (exigen el consentimiento de notificaciones; ver «no verificado» del PR).
// Uso (desde frontend/, con NODE_PATH=<backend>/node_modules si el worktree no resuelve `pg`):
//   ES237_BACKEND_DIR=<ruta a backend> node scripts/es237-api-integration.cjs
const assert = require('node:assert/strict')
const path = require('node:path'), os = require('node:os'), fs = require('node:fs'), net = require('node:net')
const { createRequire } = require('node:module'), { pathToFileURL } = require('node:url')
const { randomBytes, randomUUID } = require('node:crypto')
const { once } = require('node:events')

;(async () => {
  assert.ok(process.env.ES237_BACKEND_DIR, 'Se necesita ES237_BACKEND_DIR')
  const backend = path.resolve(process.env.ES237_BACKEND_DIR)
  const fromBackend = createRequire(path.join(backend, 'package.json'))
  const checks = []; const check = (label) => { checks.push(label); console.log('PASS ' + label) }
  const frontendRequire = createRequire(path.join(__dirname, '..', 'package.json'))
  const { build } = await import(pathToFileURL(frontendRequire.resolve('rolldown')).href)
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'es237-api-'))
  await build({ input: path.resolve(__dirname, '../src/career/api.ts'), platform: 'node', output: { format: 'esm', file: path.join(out, 'api.mjs') }, logLevel: 'warn' })
  const api = await import(pathToFileURL(path.join(out, 'api.mjs')).href)

  const { default: EmbeddedPostgres } = await import(pathToFileURL(fromBackend.resolve('embedded-postgres')).href)
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'es237-pg-'))
  const probe = net.createServer()
  const port = await new Promise((resolve, reject) => { probe.once('error', reject); probe.listen(0, '127.0.0.1', () => { const p = probe.address().port; probe.close(() => resolve(p)) }) })
  const password = randomBytes(24).toString('hex')
  const pg = new EmbeddedPostgres({ databaseDir: directory, user: 'es237_test', password, port, persistent: false, initdbFlags: ['--encoding=UTF8', '--locale=C'], postgresFlags: ['-h', '127.0.0.1'], onLog: () => {}, onError: () => {} })
  let started = false, sequelize, server
  try {
    await pg.initialise(); await pg.start(); started = true
    const url = `postgres://es237_test:${password}@127.0.0.1:${port}/postgres`
    const { Sequelize } = fromBackend('sequelize')
    sequelize = new Sequelize(url, { logging: false, dialectOptions: { ssl: false }, pool: { max: 12, min: 0 } })
    process.env.JWT_SECRET = randomBytes(32).toString('hex'); process.env.DATA_ENCRYPTION_KEY = randomBytes(32).toString('hex'); process.env.NODE_ENV = 'test'
    const dbModule = fromBackend.resolve('./database'); require.cache[dbModule] = { id: dbModule, filename: dbModule, loaded: true, exports: { sequelize } }
    fromBackend('./associations')()
    const { CORE } = fromBackend('./utils/personalData'); for (const [, model] of CORE) fromBackend('./' + model)
    for (const model of ['PricingPlan', 'ProfessionalApplication', 'ProfessionalApplicationFile', 'ConsentEvent', 'TherapistValidation', 'AuthRevocation', 'RevokedToken', 'ExportRequest', 'DeletionRequest', 'RouteCatalog', 'RouteCatalogItem', 'SkillCatalog', 'SkillDefinition']) fromBackend('./' + model)
    await sequelize.sync()
    const User = fromBackend('./User'), ParticipantContext = fromBackend('./ParticipantContext')
    const { encriptarV2 } = fromBackend('./utils/crypto'), { validateContextRequest } = fromBackend('./utils/participantContext')
    const { seedDemo, DEMO_EMAIL } = fromBackend('./utils/demoSeed'), routes = fromBackend('./utils/routes'), { issueToken } = fromBackend('./utils/sessions')
    await seedDemo({ env: { ALLOW_SYNTHETIC_CATALOG: 'true', DEMO_USER_PASSWORD: randomBytes(12).toString('hex') } })
    const a = await User.findOne({ where: { email: DEMO_EMAIL } })
    const b = await User.create({ name: 'SYNTHETIC other', email: 'other@example.invalid', password: randomBytes(32).toString('hex'), role: 'user', active: true })
    const constraints = { targetMarkets: ['CO'], languages: ['es'], modalities: ['hybrid', 'remote'], acceptRegulated: 'unknown', originContextKey: 'ctx_educacion_formacion', interestContextKeys: ['ctx_contabilidad_analisis'], preferredModalities: [] }
    await routes.putConstraints(a.id, { baseVersion: 0, requestId: randomUUID(), payload: constraints })
    const proposed = await routes.getRoutes(a.id); const pick = proposed.routes.find(r => !r.regulated.isRegulated && r.tasks.length)
    const choice = (await routes.choose(a.id, { requestId: randomUUID(), roleKey: pick.roleKey, slot: pick.slot, decision: 'accepted', basisHash: proposed.basisHash })).choice
    const baseContext = { preferredLanguage: 'es', residenceCountry: 'CO', targetMarket: 'DK', timeZone: 'America/Bogota', profession: 'Docencia sintética', interests: null, availabilityMinutesPerWeek: 90, careerGoal: null, careerConstraints: null, sector: null, totalYearsExperience: null, experience: [], education: [], declaredSkills: [], languages: [] }
    const setContext = async (userId, over = {}) => {
      const valid = validateContextRequest({ schemaVersion: 2, expectedVersion: 0, action: 'save_draft', context: { ...baseContext, ...over } }); assert.ok(!valid.error, JSON.stringify(valid))
      const row = await ParticipantContext.findOne({ where: { UserId: userId } }); const values = { content: encriptarV2(JSON.stringify(valid.context)), completedAt: new Date() }
      return row ? row.update({ ...values, version: row.version + 1 }) : ParticipantContext.create({ ...values, UserId: userId, version: 1 })
    }

    const express = fromBackend('express'); const app = express(); app.use(express.json()); const { verificarToken } = fromBackend('./middlewares/auth')
    app.use('/api/experiments', verificarToken, fromBackend('./routes/careerPlan').experiments); app.use('/api/career-plan', verificarToken, fromBackend('./routes/careerPlan').plans)
    server = app.listen(0, '127.0.0.1'); await once(server, 'listening')
    const baseUrl = `http://127.0.0.1:${server.address().port}`
    const as = (user) => ({ baseUrl, token: issueToken(user) })
    const A = as(a), B = as(b)
    const fails = async (promise, kind, status, code) => { try { await promise } catch (error) { assert.ok(error instanceof api.CareerApiError, 'es un CareerApiError: ' + error); assert.equal(error.kind, kind); assert.equal(error.status, status); if (code !== undefined) assert.equal(error.code, code); return error } assert.fail('se esperaba un error ' + kind) }

    // --- Sesión y entradas -------------------------------------------------------------------------------------------------------------
    await fails(api.listExperiments({ baseUrl, token: '' }), 'expired', 401, ''); check('sin token no se hace ninguna petición: expired')
    await fails(api.listExperiments({ baseUrl, token: 'sintetico-no-valido' }), 'expired', 401); check('token inválido → expired (401)')
    await fails(api.listExperiments({ baseUrl: 'http://127.0.0.1:1', token: A.token, timeoutMs: 3000 }), 'network', 0); check('servidor inalcanzable → network, y cuenta como resultado incierto')
    assert.equal(api.isUncertain(new api.CareerApiError('network', 0, '')), true); assert.equal(api.isUncertain(new api.CareerApiError('unavailable', 503, '')), true); assert.equal(api.isUncertain(new api.CareerApiError('conflict', 409, 'version_conflict')), false); check('isUncertain: red y 5xx sí; un 4xx con código no')
    assert.match(api.newRequestId(), /^[A-Za-z0-9_-]{8,64}$/); check('newRequestId cumple el formato del servidor')
    await fails(api.getExperiment(A, 0), 'invalid', 400, 'invalid_input'); await fails(api.getExperiment(A, 1.5), 'invalid', 400); await fails(api.getPlan(A, -3), 'invalid', 400); check('ids no válidos se rechazan en el cliente (sin petición)')

    // --- Experimentos ------------------------------------------------------------------------------------------------------------------
    await fails(api.proposeExperiment(A, { choiceId: choice.id, taskIndex: 0, minutes: 20 }), 'conflict', 409, 'context_incomplete'); check('sin contexto completo: conflict context_incomplete (no se inventa)')
    await setContext(a.id, { availabilityMinutesPerWeek: 90 })
    await fails(api.proposeExperiment(A, { choiceId: choice.id, taskIndex: 0, minutes: 99 }), 'invalid', 400); await fails(api.proposeExperiment(A, { choiceId: choice.id, taskIndex: -1, minutes: 20 }), 'invalid', 400); check('minutos o tarea fuera de rango → invalid (400), sin 500')
    const proposal = await api.proposeExperiment(A, { choiceId: choice.id, taskIndex: 0, minutes: 20 }); assert.equal(proposal.proposal.availability.weeklyMinutes, 90); check('propuesta con el contexto real (90 min/semana)')
    const requestId = api.newRequestId()
    const made = await api.createExperiment(A, { requestId, proposal: proposal.proposal, token: proposal.token }); assert.equal(made.created, true)
    const again = await api.createExperiment(A, { requestId, proposal: proposal.proposal, token: proposal.token }); assert.deepEqual(again, { experimentId: made.experimentId, created: false })
    assert.equal(Number((await sequelize.query('SELECT count(*) n FROM "CareerExperiments"', { type: 'SELECT' }))[0].n), 1); check('crear con el mismo requestId no duplica (created:false, un solo experimento)')
    const id = made.experimentId
    let view = await api.getExperiment(A, id); assert.equal(view.current.lifecycle, 'ready'); assert.equal(view.experiment.currentVersion, 1); assert.deepEqual(view.basis, { status: 'current', reasons: [] }); check('el experimento nuevo está «ready», versión 1 y con base vigente')
    assert.equal((await api.listExperiments(A)).experiments.length, 1); check('la lista del titular trae su experimento')

    const step = (n, change) => ({ requestId: api.newRequestId(), expectedVersion: n, change })
    await fails(api.changeExperiment(A, id, step(1, { action: 'decide', decision: 'continue', reason: 'Sintético' })), 'conflict', 409, 'transition_not_allowed'); check('decidir sin haber entregado: conflict transition_not_allowed')
    const startInput = step(1, { action: 'start' })
    const started1 = await api.changeExperiment(A, id, startInput); assert.equal(started1.created, true); assert.equal(started1.version.version, 2); assert.equal(started1.version.lifecycle, 'in_progress')
    const startedAgain = await api.changeExperiment(A, id, startInput); assert.equal(startedAgain.created, false); assert.equal(startedAgain.version.id, started1.version.id)
    assert.equal(Number((await sequelize.query('SELECT count(*) n FROM "CareerExperimentVersions" WHERE "experimentId" = :id', { type: 'SELECT', replacements: { id } }))[0].n), 2); check('iniciar dos veces con el mismo requestId no crea una versión de más')
    await fails(api.changeExperiment(A, id, { ...startInput, change: { action: 'rebase' } }), 'conflict', 409, 'version_conflict'); check('el mismo requestId con otro contenido → conflict version_conflict (no se reaprovecha)')
    await fails(api.changeExperiment(A, id, step(1, { action: 'start' })), 'conflict', 409, 'version_conflict'); check('versión caducada (expectedVersion 1 con la 2 vigente) → conflict version_conflict')
    await fails(api.changeExperiment(A, id, step(2, { action: 'submit', sample: 'Muestra sintética', assistance: 'ninguna' })), 'invalid', 400, 'invalid_input')
    await fails(api.changeExperiment(A, id, step(2, { action: 'submit', assistance: 'none' })), 'invalid', 400, 'invalid_input')
    await fails(api.changeExperiment(A, id, step(2, { action: 'submit', sample: 'x'.repeat(6001), assistance: 'none' })), 'invalid', 400, 'invalid_input')
    await fails(api.changeExperiment(A, id, step(2, { action: 'invent' })), 'invalid', 400); check('entrada hostil (ayuda desconocida, entrega vacía, muestra de 6001 caracteres, acción inventada) → invalid, sin 500')
    const sub = await api.changeExperiment(A, id, step(2, { action: 'submit', sample: 'Muestra sintética <b>x</b>', evidenceRefs: [], assistance: 'planning' })); assert.equal(sub.version.lifecycle, 'submitted'); assert.equal(sub.version.payload.submission.assistance.degree, 'planning')
    await fails(api.changeExperiment(A, id, step(3, { action: 'decide', decision: 'continue', reason: 'Sintético' })), 'conflict', 409, 'transition_not_allowed'); check('entregar y decidir sin reflexionar: conflict transition_not_allowed')
    const reflected = await api.changeExperiment(A, id, step(3, { action: 'reflect', observation: 'Observación sintética', interpretation: 'Interpretación sintética' })); assert.equal(reflected.version.lifecycle, 'self_reviewed')
    await fails(api.changeExperiment(A, id, step(4, { action: 'decide', decision: 'abandonar', reason: 'Sintético' })), 'conflict', 409, 'transition_not_allowed'); check('un verbo que el servidor no tiene («abandonar») no se acepta como decisión')
    const decided = await api.changeExperiment(A, id, step(4, { action: 'decide', decision: 'continue', reason: 'Quiero seguir, dato sintético' })); assert.equal(decided.version.lifecycle, 'decided'); assert.equal(decided.version.payload.decision.value, 'continue')
    view = await api.getExperiment(A, id); assert.equal(view.experiment.currentVersion, 5); assert.equal(view.versions.length, 5); assert.deepEqual(view.versions.map(v => v.lifecycle), ['ready', 'in_progress', 'submitted', 'self_reviewed', 'decided']); check('ciclo completo ready → in_progress → submitted → self_reviewed → decided, 5 versiones inmutables')
    assert.equal((await api.getExperiment(A, id, view.versions[2].id)).versions.length, 2); check('lectura incremental con el cursor `after`')

    // --- Aislamiento: otra persona ---------------------------------------------------------------------------------------------------
    await fails(api.getExperiment(B, id), 'not_found', 404, 'resource_not_found'); await fails(api.changeExperiment(B, id, step(5, { action: 'start' })), 'not_found', 404); await fails(api.listReviews(B, id), 'not_found', 404)
    await fails(api.requestReview(B, id, { requestId: api.newRequestId(), expectedVersion: 5, action: 'request', submissionVersion: 3, evidenceRefs: [], includeSample: false }), 'not_found', 404)
    await fails(api.createExperiment(B, { requestId: api.newRequestId(), proposal: proposal.proposal, token: proposal.token }), 'conflict', 409)
    assert.deepEqual((await api.listExperiments(B)).experiments, []); check('otra persona (B): el experimento de A es inexistente (404) en lectura, cambio y revisión; su lista está vacía; el token de propuesta de A no sirve a B')
    await fails(api.getExperiment(A, id + 1000), 'not_found', 404); check('un id que no existe también es 404')

    // --- Plan ------------------------------------------------------------------------------------------------------------------------
    await fails(api.proposePlan(A, { experimentId: id, expectedVersion: 4 }), 'conflict', 409, 'version_conflict'); check('proponer el plan con una versión caducada → conflict')
    const planProposal = await api.proposePlan(A, { experimentId: id, expectedVersion: 5 }); assert.deepEqual(planProposal.proposal.actions.map(x => x.actionKey), ['step_7', 'step_30', 'step_90']); check('la propuesta de plan trae las 3 acciones del servidor (7, 30 y 90 días)')
    const day = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10)
    const selections = [{ actionKey: 'step_7', chosenDate: day(3), estimatedMinutes: 20, resourceRefs: [] }, { actionKey: 'step_30', chosenDate: day(14), estimatedMinutes: 20, resourceRefs: [] }, { actionKey: 'step_90', chosenDate: day(40), estimatedMinutes: 20, resourceRefs: [] }]
    await fails(api.savePlan(A, { requestId: api.newRequestId(), expectedVersion: 0, action: 'accept', proposal: planProposal.proposal, token: planProposal.token, selections: [{ ...selections[0], estimatedMinutes: 500 }] }), 'invalid', 400); check('aceptar con 500 minutos en la primera acción → invalid')
    await fails(api.savePlan(A, { requestId: api.newRequestId(), expectedVersion: 0, action: 'accept', proposal: planProposal.proposal, token: planProposal.token, selections: [{ ...selections[0], chosenDate: '2020-01-01' }] }), 'invalid', 400); check('aceptar con una fecha pasada → invalid')
    const planRequest = api.newRequestId()
    const accepted = await api.savePlan(A, { requestId: planRequest, expectedVersion: 0, action: 'accept', proposal: planProposal.proposal, token: planProposal.token, selections }); assert.equal(accepted.created, true); assert.equal(accepted.plan.status, 'accepted')
    const acceptedAgain = await api.savePlan(A, { requestId: planRequest, expectedVersion: 0, action: 'accept', proposal: planProposal.proposal, token: planProposal.token, selections }); assert.equal(acceptedAgain.created, false); assert.equal(acceptedAgain.plan.id, accepted.plan.id)
    assert.equal((await api.listPlans(A)).plans.length, 1); check('aceptar el plan con el mismo requestId no duplica (created:false, un solo plan)')
    await fails(api.getPlan(B, accepted.plan.id), 'not_found', 404); assert.deepEqual((await api.listPlans(B)).plans, []); check('otra persona no ve el plan de A (404; lista vacía)')
    await fails(api.savePlan(B, { requestId: api.newRequestId(), expectedVersion: 1, action: 'pause', planId: accepted.plan.id }), 'not_found', 404); check('otra persona no puede pausar el plan de A (404)')
    await fails(api.savePlan(A, { requestId: api.newRequestId(), expectedVersion: 0, action: 'pause', planId: accepted.plan.id }), 'conflict', 409, 'version_conflict'); check('pausar con una versión caducada → conflict')
    const paused = await api.savePlan(A, { requestId: api.newRequestId(), expectedVersion: 1, action: 'pause', planId: accepted.plan.id }); assert.equal(paused.plan.status, 'paused'); assert.equal((await api.getPlan(A, paused.plan.id)).plan.status, 'paused'); check('pausar el plan crea la versión 2 («paused»); la versión 1 queda como historia')
    assert.deepEqual((await api.listReminders(B, { history: true })).reminders, []); check('otra persona no ve recordatorios de A (lista vacía)')
    // Con el consentimiento de notificaciones de la persona de la demostración retirado, el servidor responde 403 consent_required: el cliente lo expone como `forbidden` con ese código (la pantalla decidirá el texto en el paso 3).
    await fails(api.listReminders(A), 'forbidden', 403, 'consent_required'); check('recordatorios sin consentimiento de notificaciones → forbidden consent_required')
    console.log(`
${checks.length} comprobaciones OK`)
  } finally {
    if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)) }
    if (sequelize) await sequelize.close().catch(() => {})
    if (started) await pg.stop().catch(() => {})
    fs.rmSync(directory, { recursive: true, force: true }); fs.rmSync(out, { recursive: true, force: true })
  }
})().catch(error => { console.error('FALLA', error); process.exit(1) })
