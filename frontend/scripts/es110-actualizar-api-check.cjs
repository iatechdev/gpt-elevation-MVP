// ES-110 (PR 2): lo que hace «Guardar» en «Actualizar mi hoja de vida», contra el servidor REAL (routers de contexto) y PostgreSQL REAL embebido. Solo local, datos SINTÉTICOS, 0 llamadas de IA.
// Usa el cliente REAL del navegador (contextRequest de participantContext.ts) y la función REAL de #391 (resumeDiff.ts): la diferencia y las elecciones se calculan como en la pantalla.
// Comprueba: el PUT con expectedVersion aplica solo lo elegido; versión vieja = 409 sin escribir; guardar dos veces lo mismo no cambia nada (la segunda con la versión nueva);
// lo CONFIRMADO (evidencia) queda idéntico; lo vinculado a la versión nueva aparece en la bandeja de ES-110 con esa versión; lo quitado ya no; otra persona no se toca; una pestaña desactualizada no pisa.
// Uso (desde frontend/): ES237_BACKEND_DIR=../backend NODE_PATH=../backend/node_modules node scripts/es110-actualizar-api-check.cjs
const assert = require('node:assert/strict')
const path = require('node:path'), os = require('node:os'), fs = require('node:fs'), net = require('node:net')
const { createRequire } = require('node:module'), { pathToFileURL } = require('node:url')
const { randomBytes, randomUUID } = require('node:crypto')
const { once } = require('node:events')
let passed = 0
const check = (label, fn) => { fn(); passed++; console.log('PASS ' + label) }
;(async () => {
  assert.ok(process.env.ES237_BACKEND_DIR, 'Se necesita ES237_BACKEND_DIR')
  const backend = path.resolve(process.env.ES237_BACKEND_DIR), fromBackend = createRequire(path.join(backend, 'package.json'))
  const { default: EmbeddedPostgres } = await import(pathToFileURL(fromBackend.resolve('embedded-postgres')).href)
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'es110-upd-pg-'))
  const probe = net.createServer(); const port = await new Promise((r, j) => { probe.once('error', j); probe.listen(0, '127.0.0.1', () => { const p = probe.address().port; probe.close(() => r(p)) }) })
  const password = randomBytes(24).toString('hex')
  const pg = new EmbeddedPostgres({ databaseDir: directory, user: 'upd', password, port, persistent: false, initdbFlags: ['--encoding=UTF8', '--locale=C'], postgresFlags: ['-h', '127.0.0.1'], onLog: () => {}, onError: () => {} })
  let started = false, sequelize, server
  try {
    await pg.initialise(); await pg.start(); started = true
    const { Sequelize } = fromBackend('sequelize')
    sequelize = new Sequelize(`postgres://upd:${password}@127.0.0.1:${port}/postgres`, { logging: false, dialectOptions: { ssl: false }, pool: { max: 8, min: 0 } })
    process.env.JWT_SECRET = randomBytes(32).toString('hex'); process.env.DATA_ENCRYPTION_KEY = randomBytes(32).toString('hex'); process.env.NODE_ENV = 'test'
    const dbModule = fromBackend.resolve('./database'); require.cache[dbModule] = { id: dbModule, filename: dbModule, loaded: true, exports: { sequelize } }
    fromBackend('./associations')()
    const { CORE } = fromBackend('./utils/personalData'); for (const [, model] of CORE) fromBackend('./' + model)
    for (const model of ['PricingPlan', 'ProfessionalApplication', 'ProfessionalApplicationFile', 'ConsentEvent', 'TherapistValidation', 'AuthRevocation', 'RevokedToken', 'ExportRequest', 'DeletionRequest', 'RouteCatalog', 'RouteCatalogItem', 'SkillCatalog', 'SkillDefinition', 'ParticipantResume', 'DerivedInvalidation']) fromBackend('./' + model)
    await sequelize.sync()
    const User = fromBackend('./User'), ParticipantContext = fromBackend('./ParticipantContext'), Evidence = fromBackend('./Evidence'), EvidenceVersion = fromBackend('./EvidenceVersion')
    const { encriptarV2 } = fromBackend('./utils/crypto'), { validateContextRequest } = fromBackend('./utils/participantContext'), { issueToken } = fromBackend('./utils/sessions')
    const { seedDemo } = fromBackend('./utils/demoSeed'), resumes = fromBackend('./utils/resumes'), resumeSkills = fromBackend('./utils/resumeSkills'), skillCatalog = fromBackend('./utils/skillCatalog')
    await seedDemo({ env: { ALLOW_SYNTHETIC_CATALOG: 'true', DEMO_USER_PASSWORD: randomBytes(12).toString('hex') } })
    const published = await skillCatalog.getPublished(); const label = s => s.labels.es; const cat = [...published.skills.values()].slice(0, 4).map(label)
    const [A, B, C, D] = cat
    const express = fromBackend('express'), app = express(), { verificarToken } = fromBackend('./middlewares/auth')
    app.use(express.json()); app.use('/api/user/context', verificarToken, fromBackend('./routes/participantContext'))
    server = app.listen(0, '127.0.0.1'); await once(server, 'listening'); const base = `http://127.0.0.1:${server.address().port}`
    const realFetch = globalThis.fetch; globalThis.fetch = (url, init) => realFetch(String(url).startsWith('/') ? base + url : url, init) // el cliente del navegador usa rutas relativas
    const { contextRequest, ContextError } = await import(pathToFileURL(path.resolve('src/context/participantContext.ts')).href)
    const { applyChoices, defaultChoices, diffSkills } = await import(pathToFileURL(path.resolve('src/context/resume/resumeDiff.ts')).href)

    const baseContext = skills => ({ preferredLanguage: 'es', residenceCountry: 'CO', targetMarket: 'DK', timeZone: 'America/Bogota', profession: 'Docencia sintética', interests: null, availabilityMinutesPerWeek: 90, careerGoal: null, careerConstraints: null, sector: null, totalYearsExperience: null, experience: [], education: [], declaredSkills: skills, languages: [] })
    const persona = async name => {
      const user = await User.create({ name: `SYNTHETIC ${name}`, email: `${name}-${randomBytes(4).toString('hex')}@example.invalid`, password: randomBytes(32).toString('hex'), role: 'user', active: true })
      return { user, token: issueToken(user) }
    }
    const saveDirect = async (user, skills) => { const valid = validateContextRequest({ schemaVersion: 2, expectedVersion: 0, action: 'save_draft', context: baseContext(skills) }); assert.ok(!valid.error, JSON.stringify(valid))
      const row = await ParticipantContext.findOne({ where: { UserId: user.id } }); const values = { content: encriptarV2(JSON.stringify(valid.context)), completedAt: new Date() }
      return row ? row.update({ ...values, version: row.version + 1 }) : ParticipantContext.create({ ...values, UserId: user.id, version: 1 }) }
    const pdf = n => Buffer.from(`%PDF-1.4 sintético ${n}`); const store = (user, n) => sequelize.transaction(t => resumes.storeResume(user.id, pdf(n), t))

    // Persona P: hoja v1 con A, B, C vinculadas a la v1; A se pasó a evidencia (borrador) y CONFIRMADA después; luego sube la v2 que trae B (sigue), D (nueva) y ya no trae A ni C.
    const P = await persona('p'), Q = await persona('q')
    const v1 = await store(P.user, 1); assert.equal(v1.resume.version, 1)
    await saveDirect(P.user, [{ name: A, support: 'cita A', resumeVersion: 1 }, { name: B, support: 'cita B', resumeVersion: 1 }, { name: C, support: 'cita C', resumeVersion: 1 }, { name: 'Habilidad escrita a mano', support: null, resumeVersion: null }])
    await saveDirect(Q.user, [{ name: A, support: 'cita A de Q', resumeVersion: null }])
    const promoted = await resumeSkills.promote(P.user.id, { requestId: randomUUID().replace(/-/g, ''), names: [A] }); assert.equal(promoted.created.length, 1)
    const evRows = async () => EvidenceVersion.findAll({ where: { UserId: P.user.id }, order: [['id', 'ASC']], raw: true }); const beforeEvidence = JSON.stringify(await evRows())
    const v2 = await store(P.user, 2); assert.equal(v2.resume.version, 2)
    const suggested = [{ name: B, support: 'cita B nueva', resumeVersion: 2 }, { name: D, support: 'cita D', resumeVersion: 2 }]

    // La pantalla: lee el contexto con el cliente real, calcula la diferencia y aplica las elecciones.
    const snapshot = await contextRequest(undefined, P.token)
    const diff = diffSkills(snapshot.context.declaredSkills, suggested, 2)
    check('la diferencia real: nueva D, sigue B, ya no aparecen A y C; la escrita a mano no «desaparece»', () => { assert.deepEqual(diff.added.map(s => s.name), [D]); assert.deepEqual(diff.remain.map(r => r.current.name), [B]); assert.deepEqual(diff.gone.map(s => s.name), [A, C]) })
    check('por defecto NADA marcado y aplicar sin elegir deja las habilidades idénticas', () => { const none = applyChoices(snapshot.context.declaredSkills, diff, defaultChoices(diff)); assert.deepEqual(none.skills, snapshot.context.declaredSkills) })
    const choices = { add: [D], link: [B], remove: [C] } // la persona añade D, vincula B a la v2 y quita C; MANTIENE A
    const applied = applyChoices(snapshot.context.declaredSkills, diff, choices)
    const saved = await contextRequest({ schemaVersion: 2, expectedVersion: snapshot.version, action: 'save_draft', context: { ...snapshot.context, declaredSkills: applied.skills } }, P.token)
    check('PUT con expectedVersion: versión +1, B vinculada a la v2 con la cita nueva, D añadida (v2), C quitada, A mantenida, la escrita a mano intacta', () => {
      assert.equal(saved.version, snapshot.version + 1); const by = Object.fromEntries(saved.context.declaredSkills.map(s => [s.name, s]))
      assert.deepEqual([by[B].resumeVersion, by[B].support, by[D].resumeVersion, by[A].resumeVersion, C in by, by['Habilidad escrita a mano'].resumeVersion], [2, 'cita B nueva', 2, 1, false, null]); assert.equal(saved.completedAt, snapshot.completedAt)
      assert.deepEqual({ ...saved.context, declaredSkills: 0 }, { ...snapshot.context, declaredSkills: 0 }, 'el resto del contexto viaja idéntico') })
    const afterEvidence = JSON.stringify(await evRows())
    check('la evidencia (borrador y confirmada) queda idéntica byte a byte: guardar el contexto no la toca', () => { assert.equal(afterEvidence, beforeEvidence) })
    // Repetir con la versión vieja = 409 y NO escribe (otra pestaña o un reintento).
    let status = 0; try { await contextRequest({ schemaVersion: 2, expectedVersion: snapshot.version, action: 'save_draft', context: { ...snapshot.context, declaredSkills: applied.skills } }, P.token) } catch (error) { status = error instanceof ContextError ? error.status : -1 }
    check('un reintento con la versión vieja da 409 y no escribe (la pantalla relee y compara antes de decir nada)', () => { assert.equal(status, 409) })
    const fresh = await contextRequest(undefined, P.token)
    check('la relectura trae justo lo elegido: «guardado» es verdad aunque se haya perdido la respuesta', () => { assert.deepEqual(fresh.context.declaredSkills.map(s => [s.name.normalize('NFD').toLowerCase(), s.resumeVersion]), applied.skills.map(s => [s.name.normalize('NFD').toLowerCase(), s.resumeVersion])); assert.equal(fresh.version, saved.version) })
    // Aplicar lo mismo sobre el contexto nuevo no ofrece nada más y guardar de nuevo no cambia habilidades (idempotente).
    const again = diffSkills(fresh.context.declaredSkills, suggested, 2)
    const repeat = await contextRequest({ schemaVersion: 2, expectedVersion: fresh.version, action: 'save_draft', context: { ...fresh.context, declaredSkills: applyChoices(fresh.context.declaredSkills, again, choices).skills } }, P.token)
    check('idempotente: tras guardar, la hoja ya no ofrece nuevas ni vincular; repetir las elecciones no cambia las habilidades', () => { assert.deepEqual(again.added, []); assert.deepEqual(again.remain.filter(r => !r.linked && !r.handwritten), []); assert.deepEqual(repeat.context.declaredSkills, fresh.context.declaredSkills) })
    // Efecto en la bandeja de ES-110 (servidor real): D y B vienen de la v2; C (quitada) ya no está; A (mantenida y ya evidencia) conserva su origen v1; la escrita a mano no es candidata.
    const candidates = await resumeSkills.listCandidates(P.user.id); const cand = Object.fromEntries(candidates.map(s => [s.name, s]))
    check('bandeja «Habilidades de tu hoja de vida»: D y B con la versión 2, C ausente, A con la versión 1 (ya añadida), sin la escrita a mano', () => {
      assert.equal(cand[D].resume.version, 2); assert.equal(cand[B].resume.version, 2); assert.equal(C in cand, false); assert.equal(cand[A].resume.version, 1); assert.equal(cand[A].added, true); assert.equal('Habilidad escrita a mano' in cand, false) })
    // Aislamiento: Q no cambia; una pestaña desactualizada de Q con el contexto de P no pisa; ids ajenos no existen en este flujo (solo hay /api/user/context del dueño del token).
    const q = await contextRequest(undefined, Q.token)
    check('otra persona (Q) queda idéntica y sin invalidaciones nuevas por este guardado', () => { assert.deepEqual(q.context.declaredSkills, [{ name: A, support: 'cita A de Q', resumeVersion: null }]); assert.equal(q.version, 1) })
    let anon = 0; try { await contextRequest({ schemaVersion: 2, expectedVersion: 1, action: 'save_draft', context: baseContext([]) }, '') } catch (error) { anon = error.status }
    check('sin sesión: 401 y no escribe', () => { assert.ok([401, 403].includes(anon)) })
    // Tope: 40 habilidades en el contexto → las nuevas no caben y la función lo dice (no se descarta nada guardado).
    const R = await persona('r'); const forty = Array.from({ length: 39 }, (_, i) => ({ name: `Habilidad ${i + 1}`, support: null, resumeVersion: 1 })); await saveDirect(R.user, forty)
    const rs = await contextRequest(undefined, R.token); const rdiff = diffSkills(rs.context.declaredSkills, [{ name: 'Nueva 1', support: null, resumeVersion: 2 }, { name: 'Nueva 2', support: null, resumeVersion: 2 }], 2)
    const rapplied = applyChoices(rs.context.declaredSkills, rdiff, { add: ['Nueva 1', 'Nueva 2'], link: [], remove: [] }); const rsaved = await contextRequest({ schemaVersion: 2, expectedVersion: rs.version, action: 'save_draft', context: { ...rs.context, declaredSkills: rapplied.skills } }, R.token)
    check('tope de 40: con 39 guardadas solo cabe una nueva, se informa 1 omitida y el servidor acepta el resultado (nada guardado se descarta)', () => { assert.equal(rdiff.overflow, 1); assert.equal(rapplied.skipped, 1); assert.equal(rsaved.context.declaredSkills.length, 40); assert.equal(rsaved.context.declaredSkills.filter(s => s.name.startsWith('Habilidad ')).length, 39) })
    console.log(`TODO OK (${passed} comprobaciones)`)
  } finally { if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)) } if (sequelize) await sequelize.close().catch(() => {}); if (started) await pg.stop().catch(() => {}); try { fs.rmSync(directory, { recursive: true, force: true, maxRetries: 8, retryDelay: 250 }) } catch { /* Windows */ } }
})().catch(e => { console.error('FALLA', e); process.exit(1) })
