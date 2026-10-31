// QA-Claude-2 — ES-116 (#88) contra backend REAL (Express + Postgres local desechable, datos sintéticos).
// Requiere: backend en API (:8090) sobre una base local con el catálogo v1 publicado (qa/seed-catalog.cjs sin territorios).
// Env: API, DATABASE_URL (local), BACKEND (ruta a backend/ del worktree, para cargar `pg`).
// Cubre F116-1/2/3/4/6, S-1, S-2, S-3, S-5.
const { createRequire } = require('module')
const { Client } = createRequire(process.env.BACKEND + '/package.json')('pg')
const API = process.env.API || 'http://localhost:8090', PASS = require('crypto').randomBytes(12).toString('hex') + 'Aa1!'
let fails = 0; const ck = (n, ok, x = '') => { if (!ok) fails++; console.log(`${ok ? 'OK   ' : 'FALLA'} ${n} ${x}`) }
const call = async (method, p, token, body, raw) => { const r = await fetch(API + p, { method, headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}), 'content-type': 'application/json' }, body: raw ?? (body !== undefined ? JSON.stringify(body) : undefined) }); let j = null; try { j = await r.json() } catch {} return { s: r.status, j } }
const sql = async (q, a) => { const c = new Client({ connectionString: process.env.DATABASE_URL }); await c.connect(); try { return await c.query(q, a) } finally { await c.end() } }
const person = async (tag, role = 'user') => { const email = `qa-${tag}-${Date.now()}@example.test`; await call('POST', '/api/register', null, { name: 'QA ' + tag, email, password: PASS }); if (role !== 'user') await sql('UPDATE "Users" SET role=$1 WHERE email=$2', [role, email]); const l = await call('POST', '/api/login', null, { email, password: PASS }); return { email, token: l.j.token } }
const ev = (n) => ({ requestId: `req-${Date.now()}-${n}`, status: 'confirmed', payload: { title: 'Evidencia sintética ' + n, situation: 'Situación sintética.', responsibility: { text: 'Responsable del entregable.' }, actions: [{ text: 'Preparé y presenté el análisis.' }], delivered: { text: 'Informe sintético.' }, observedEffect: { known: false }, autonomy: 'autonomous' } })
const AD = '/api/admin/skill-catalog'
;(async () => {
  const admin = await person('admin', 'admin'), user = await person('user'), other = await person('other')
  // S-2 acceso
  for (const [n, tk] of [['persona sin rol admin', user.token], ['sin token', null], ['token manipulado', admin.token.slice(0, -4) + 'xxxx']]) {
    const r = await call('GET', AD, tk); ck(`S-2 ${n}: GET catálogo bloqueado`, [401, 403].includes(r.s), `HTTP ${r.s}`)
    const w = await call('POST', AD, tk, {}); ck(`S-2 ${n}: POST borrador bloqueado`, [401, 403].includes(w.s), `HTTP ${w.s}`)
  }
  const list = await call('GET', AD, admin.token); ck('F116-1 admin lista versiones: v1 publicada', list.s === 200 && list.j.catalogs.some(c => c.version === 1 && c.status === 'published'))
  // Una persona con autoevaluación sobre v1 (para probar que cambiar territorios no la marca como «rúbrica cambió»)
  const e1 = await call('POST', '/api/evidence', user.token, ev(1)); ck('evidencia confirmada creada', e1.s === 201, `HTTP ${e1.s} ${JSON.stringify(e1.j).slice(0, 80)}`)
  const sa = await call('POST', '/api/skill-map/self', user.token, { requestId: 'self-' + Date.now(), skillKey: 'comunicacion', level: 3, evidenceRefs: [{ evidenceId: e1.j.id, version: 1 }], rationale: 'Nota sintética' })
  ck('autoevaluación nivel 3 creada', [200, 201].includes(sa.s), `HTTP ${sa.s} ${JSON.stringify(sa.j).slice(0, 90)}`)
  const m1 = (await call('GET', '/api/skill-map', user.token)).j; const c1 = m1.skills.find(s => s.skillKey === 'comunicacion')
  ck('v1: nivel 3 vigente y sin «rúbrica cambió»', c1.self.level === 3 && c1.self.catalogOutdated === false, JSON.stringify({ l: c1.self.level, o: c1.self.catalogOutdated, v: m1.catalogVersion }))
  ck('F116-6 /api/skill-map expone territories (vacío en v1)', Array.isArray(c1.territories) && c1.territories.length === 0, JSON.stringify(c1.territories))
  // Borrador desde vigente
  const d = await call('POST', AD, admin.token, {}); ck('F116-1 crear borrador desde el vigente', d.s === 201 && d.j.status === 'draft', `HTTP ${d.s}`)
  const dup = await call('POST', AD, admin.token, {}); ck('F116-1 solo un borrador a la vez (409)', dup.s === 409, `HTTP ${dup.s} ${dup.j?.code}`)
  const dd = await call('GET', `${AD}/${d.j.id}`, admin.token); ck('borrador copia las 8 habilidades completas', dd.j.skills.length === 8 && dd.j.skills.every(s => s.missing.length === 0))
  const base = dd.j.skills.find(s => s.skillKey === 'comunicacion'); const put = (key, body) => call('PUT', `${AD}/${d.j.id}/skills/${key}`, admin.token, body)
  const full = (over = {}) => ({ type: base.type, labels: base.labels, rubric: base.rubric, ...over })
  // F116-4 validación de territorios
  for (const [n, t] of [['id desconocido', ['xx']], ['repetidos', ['dir', 'dir']], ['no es lista', 'dir'], ['más de 5', ['dir', 'con', 'com', 'ing', 'inn', 'dir']], ['número', [1]], ['objeto', { a: 1 }], ['inyección SQL', ["dir'; DROP TABLE \"SkillDefinitions\";--"]], ['XSS', ['<script>alert(1)</script>']], ['null', null]]) {
    const r = await put('comunicacion', full({ territories: t })); ck(`F116-4/S-3 territorios «${n}» rechazado sin 5xx`, r.s >= 400 && r.s < 500, `HTTP ${r.s} ${r.j?.code || ''}`)
  }
  ck('tras entradas inválidas la tabla sigue íntegra', (await sql('SELECT count(*)::int n FROM "SkillDefinitions"')).rows[0].n >= 8)
  const bad = await put('comunicacion', { ...full(), extra: 1 }); ck('F116-4 campo desconocido en el cuerpo: 400', bad.s === 400, `HTTP ${bad.s}`)
  // asignar y comprobar semántica de «omitido conserva / [] vacía»
  const ok1 = await put('comunicacion', full({ territories: ['dir', 'ing'] })); ck('F116-1 asignar territorios válidos', ok1.s === 200 && ok1.j.territories.join() === 'dir,ing', JSON.stringify(ok1.j.territories))
  const ok2 = await put('comunicacion', full()); ck('territories omitido conserva lo guardado', ok2.s === 200 && ok2.j.territories.join() === 'dir,ing', JSON.stringify(ok2.j.territories))
  const ok3 = await put('adaptabilidad', full({ territories: ['inn'] })); ck('otra habilidad con un territorio', ok3.s === 200)
  const ok4 = await put('adaptabilidad', full({ territories: [] })); ck('[] vacía explícitamente', ok4.s === 200 && ok4.j.territories.length === 0)
  // alta de habilidad nueva con textos con marcado
  const nk = await put('qa_habilidad_xss', { type: 'domain', labels: { es: '<img src=x onerror=alert(1)> Nueva', en: 'New <b>x</b>' }, territories: ['con'] }); ck('F116-1 alta de habilidad nueva (borrador incompleto admitido)', nk.s === 200 && nk.j.missing.length > 0, `faltan ${nk.j?.missing?.length}`)
  const kbad = await put('A', full()); ck('F116-4 clave inválida rechazada', kbad.s >= 400 && kbad.s < 500, `HTTP ${kbad.s}`)
  const pub0 = await call('POST', `${AD}/${d.j.id}/publish`, admin.token); ck('F116-1 publicar con una habilidad incompleta: 422 con lista de faltantes', pub0.s === 422 && pub0.j.code === 'incomplete_catalog' && Object.keys(pub0.j.missing || {}).length > 0, `HTTP ${pub0.s} ${pub0.j?.code}`)
  const del = await call('DELETE', `${AD}/${d.j.id}/skills/qa_habilidad_xss`, admin.token); ck('quitar la habilidad incompleta del borrador', del.s === 200, `HTTP ${del.s}`)
  // S-5 concurrencia: dos ediciones simultáneas de la misma habilidad
  const race = await Promise.all([put('comunicacion', full({ territories: ['dir'] })), put('comunicacion', full({ territories: ['com'] }))])
  ck('S-5 dos ediciones simultáneas: sin 5xx y una sola fila', race.every(r => r.s < 500) && (await sql('SELECT count(*)::int n FROM "SkillDefinitions" WHERE "skillKey"=$1 AND "catalogId"=$2', ['comunicacion', d.j.id])).rows[0].n === 1, race.map(r => r.s).join(','))
  const final = await put('comunicacion', full({ territories: ['dir', 'ing'] })); ck('territorios finales de comunicacion = dir,ing', final.s === 200)
  // F116-2 publicar v2 con SOLO cambios de territorios
  const pub = await call('POST', `${AD}/${d.j.id}/publish`, admin.token); ck('F116-1 publicar v2 completa', pub.s === 200 && pub.j.status === 'published', `HTTP ${pub.s}`)
  const m2 = (await call('GET', '/api/skill-map', user.token)).j; const c2 = m2.skills.find(s => s.skillKey === 'comunicacion')
  ck('F116-2 v2: catálogo 2, nivel 3 intacto y SIN «rúbrica cambió» tras cambiar solo territorios', m2.catalogVersion === 2 && c2.self.level === 3 && c2.self.catalogOutdated === false, JSON.stringify({ v: m2.catalogVersion, l: c2.self.level, o: c2.self.catalogOutdated }))
  ck('F116-6 mapa devuelve territories dir,ing', c2.territories.join() === 'dir,ing', JSON.stringify(c2.territories))
  ck('F116-6 otra persona ve los mismos territorios y su propio mapa vacío', (await call('GET', '/api/skill-map', other.token)).j.skills.find(s => s.skillKey === 'comunicacion').self === null)
  // F116-3 inmutabilidad
  const imm = await call('PUT', `${AD}/${d.j.id}/skills/comunicacion`, admin.token, full({ territories: ['inn'] })); ck('F116-3 editar versión publicada: 409', imm.s === 409, `HTTP ${imm.s} ${imm.j?.code}`)
  const imm2 = await call('PUT', `${AD}/${list.j.catalogs.find(c => c.version === 1).id}/skills/comunicacion`, admin.token, full({ territories: ['inn'] })); ck('F116-3 editar versión archivada: 409', imm2.s === 409)
  const imm3 = await call('DELETE', `${AD}/${d.j.id}/skills/comunicacion`, admin.token); ck('F116-3 quitar de versión publicada: 409', imm3.s === 409)
  const imm4 = await call('POST', `${AD}/${d.j.id}/publish`, admin.token); ck('F116-3 publicar de nuevo lo publicado: sin 5xx', imm4.s < 500, `HTTP ${imm4.s}`)
  // Control positivo: cambiar un criterio SÍ marca «rúbrica cambió»
  const d3 = await call('POST', AD, admin.token, {}); const dd3 = await call('GET', `${AD}/${d3.j.id}`, admin.token); const b3 = dd3.j.skills.find(s => s.skillKey === 'comunicacion')
  await call('PUT', `${AD}/${d3.j.id}/skills/comunicacion`, admin.token, { type: b3.type, labels: b3.labels, rubric: { ...b3.rubric, levels: { ...b3.rubric.levels, 3: { es: b3.rubric.levels['3'].es + ' (cambio)', en: b3.rubric.levels['3'].en } } }, territories: b3.territories })
  await call('POST', `${AD}/${d3.j.id}/publish`, admin.token); const c3 = (await call('GET', '/api/skill-map', user.token)).j.skills.find(s => s.skillKey === 'comunicacion')
  ck('control positivo: cambiar un criterio SÍ marca «rúbrica cambió» (v3)', c3.self.catalogOutdated === true, JSON.stringify({ o: c3.self.catalogOutdated }))
  // S-3 el cuerpo de error no filtra detalles
  const e500 = await call('PUT', `${AD}/abc/skills/comunicacion`, admin.token, full()); ck('S-9 id no numérico: error controlado sin trazas', e500.s < 500 && !/at |node_modules|Sequelize/.test(JSON.stringify(e500.j)), `HTTP ${e500.s}`)
  console.log(fails ? `\nFALLAS: ${fails}` : '\nTODO OK'); process.exit(fails ? 1 : 0)
})().catch(e => { console.error('EXCEPCIÓN', e); process.exit(3) })
