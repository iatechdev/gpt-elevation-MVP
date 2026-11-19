// [QA-Claude-3] PR #352 (ES-271). Backend REAL (código del PR) + PostgreSQL desechable; sin navegador. Uso: via qa/run.sh con LABEL=pr|main, DIST irrelevante.
// Compara el comportamiento con el catálogo sano, con tablas de etiquetas ausentes, sin permisos, y con un fallo REAL del catálogo; roles y log.
const L = require('./lib3.cjs'); const { ck, info, call, dbq, mk, sleep } = L; const fs = L.fs
const LOG = process.env.BE_LOG
const logTail = (from) => (fs.existsSync(LOG) ? fs.readFileSync(LOG).subarray(from).toString('utf8') : '')
const logLen = () => (fs.existsSync(LOG) ? fs.statSync(LOG).size : 0)
const strip = (j) => { const { skillLabels, ...rest } = j || {}; return JSON.stringify(rest) }
;(async () => {
  await L.DB.connect()
  const tables = (await dbq("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND (table_name ILIKE '%skill%' OR table_name ILIKE '%routecatalog%') ORDER BY 1")).map(r => r.table_name); info('tablas relevantes:', tables.join(','))
  const A = await mk('user', 'A-352'), B = await mk('user', 'B-352'), T = await mk('therapist', 'T-352'), AD = await mk('admin', 'AD-352'), SU = await mk('superadmin', 'SU-352')
  const base = '/api/route-catalog'; const roleOf = async tk => (await call('GET', base, tk))
  let healthy = await roleOf(A.token); info('catálogo sano:', healthy.s, 'skillLabels claves:', Object.keys(healthy.j?.skillLabels || {}).length, 'roles:', (healthy.j?.roles || []).length)
  const roleKey = healthy.j?.roles?.[0]?.roleKey; info('roleKey de prueba:', roleKey)
  const healthyRole = roleKey ? await call('GET', `${base}/roles/${roleKey}`, A.token) : null
  ck('S352-0 con el catálogo sano responde 200 con roles', healthy.s === 200 && (healthy.j?.roles || []).length > 0, String(healthy.s))
  const labelsHealthy = Object.keys(healthy.j?.skillLabels || {}).length; info('etiquetas con catálogo sano:', labelsHealthy)
  // S2 roles: comparar respuestas entre roles (misma forma) y sin token
  for (const [nm, tk] of [['sin token', null], ['token falso', 'x.y.z']]) { const r = await call('GET', base, tk); ck(`S352-1 ${nm}: 401/403`, r.s === 401 || r.s === 403, String(r.s)) }
  for (const U of [B, T, AD, SU]) { const r = await roleOf(U.token); ck(`S352-2 ${U.role}: 200 y el mismo catálogo que la persona A (sin datos personales)`, r.s === 200 && strip(r.j) === strip(healthy.j) && !/@example\.test|qa3-/.test(r.tx), String(r.s)) }
  // F1: tablas de etiquetas ausentes
  for (const table of ['SkillDefinitions', 'SkillCatalogs']) {
    if (!tables.includes(table)) { ck(`F352-1 existe la tabla ${table}`, false, 'no existe'); continue }
    const l0 = logLen(); await dbq(`ALTER TABLE "${table}" RENAME TO "${table}_ausente"`)
    try {
      const w = await roleOf(A.token); const r = roleKey ? await call('GET', `${base}/roles/${roleKey}`, A.token) : null; await sleep(300); const lg = logTail(l0)
      if (L.LABEL === 'pr') {
        ck(`F352-1 [${table} ausente] GET /api/route-catalog → 200 con skillLabels:{} y el resto IDÉNTICO al sano`, w.s === 200 && Object.keys(w.j?.skillLabels || {}).length === 0 && strip(w.j) === strip(healthy.j), `${w.s} etiquetas=${Object.keys(w.j?.skillLabels || {}).length}`)
        ck(`F352-1 [${table} ausente] GET /roles/:roleKey → 200 con skillLabels:{}`, !r || (r.s === 200 && Object.keys(r.j?.skillLabels || {}).length === 0 && strip(r.j) === strip(healthyRole.j)), String(r?.s))
        ck(`F352-1 [${table} ausente] se registra solo el nombre del error: sin SQL, tabla, usuario ni correo`, /Etiquetas de habilidades no disponibles/.test(lg) && !/SELECT|relation|does not exist|"Skill|qa3-|@example/i.test(lg.split('\n').filter(x => /Etiquetas de habilidades/.test(x)).join('\n')), lg.split('\n').filter(x => /Etiquetas de habilidades/.test(x)).slice(0, 2).join(' | '))
      } else info(`CONTROL main [${table} ausente]: GET ${w.s} / roles ${r?.s}`); ck(`F352-0 control: main con ${table} ausente responde ${L.LABEL === 'main' ? '500 (el defecto)' : '200'}`, L.LABEL === 'main' ? w.s >= 500 : w.s === 200, String(w.s))
    } finally { await dbq(`ALTER TABLE "${table}_ausente" RENAME TO "${table}"`) }
    const back = await roleOf(A.token); ck(`F352-1 restaurada ${table}: vuelve el payload de siempre (mismas etiquetas)`, back.s === 200 && JSON.stringify(back.j) === JSON.stringify(healthy.j), String(back.s))
  }
  // F2: un fallo REAL del catálogo (no de etiquetas) sigue siendo error
  const catTables = tables.filter(t => /^RouteCatalog/.test(t)); info('tablas del catálogo de rutas:', catTables.join(','))
  for (const table of catTables) {
    await dbq(`ALTER TABLE "${table}" RENAME TO "${table}_ausente"`)
    try { const w = await roleOf(A.token); ck(`F352-2 [${table} ausente] un fallo REAL del catálogo sigue siendo error (no se traga): ${L.LABEL}`, w.s >= 500 || w.s === 404 || (w.s === 200 && (w.j?.roles || []).length === 0 && false), `${w.s} ${w.tx.slice(0, 80)}`) } finally { await dbq(`ALTER TABLE "${table}_ausente" RENAME TO "${table}"`) }
  }
  // consulta rota de otra forma (columna ausente: error de SQL que NO es «tabla ausente»); un superusuario no puede probarse con REVOKE, así que se rompe la consulta de etiquetas
  if (tables.includes('SkillCatalogs')) {
    const l0 = logLen(); await dbq('ALTER TABLE "SkillCatalogs" RENAME COLUMN "status" TO "status_x"')
    try { const w = await roleOf(A.token); await sleep(1200); const lg = logTail(l0).split(String.fromCharCode(10)).filter(x => /Etiquetas de habilidades/.test(x)).join(' | '); info(`consulta de etiquetas rota (columna) (${L.LABEL}): estado`, w.s, 'etiquetas', Object.keys(w.j?.skillLabels || {}).length, 'log:', lg.slice(0, 160)); ck('F352-3 consulta de etiquetas rota por otra causa (no tabla ausente): PR 200 con {} y log solo con el nombre del error; main error', L.LABEL === 'pr' ? (w.s === 200 && lg.length > 0 && Object.keys(w.j?.skillLabels || {}).length === 0 && strip(w.j) === strip(healthy.j) && !/status|SELECT|SkillCatalogs/i.test(lg)) : w.s >= 500, `${w.s} ${lg.slice(0, 100)}`) } finally { await dbq('ALTER TABLE "SkillCatalogs" RENAME COLUMN "status_x" TO "status"') }
  }
  const fin = await roleOf(A.token); ck('F352-4 tras restaurar todo, el catálogo vuelve a ser el sano', fin.s === 200 && JSON.stringify(fin.j) === JSON.stringify(healthy.j), String(fin.s))
  await L.done(); process.exit(0)
})().catch(e => { console.error('FALLO', e); process.exit(1) })
