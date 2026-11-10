// QA-Claude-2 — ES-187 servidor (PR #208): control de edicion concurrente por elemento del catalogo de rutas (PUT con expectedUpdatedAt -> 409 item_changed).
// Backend REAL (:8090, Postgres con migraciones reales) por HTTP con tokens reales. Contenido SINTETICO. 0 IA. Plan C1-C8 (ES-187, comentario 11521).
// Env: BACKEND (ruta a backend/), DATABASE_URL, LABEL (pr|main). Uso: node qa/es208-concurrencia.cjs
const crypto = require('crypto'), { createRequire } = require('module')
const req = createRequire(process.env.BACKEND + '/package.json'), { Client } = req('pg')
const { build } = req('./seeds/routeCatalogSynthetic.cjs')
const API = 'http://localhost:8090', LABEL = process.env.LABEL || 'pr'
let f = 0, total = 0
const ck = (n, ok, x = '') => { total++; if (!ok) f++; console.log((ok ? 'OK   ' : 'FALLA ') + `[${LABEL}] ` + n, x) }
const info = (...a) => console.log('INFO', `[${LABEL}]`, ...a)
const PASS = crypto.randomBytes(9).toString('hex') + 'Aa1!', tag = Date.now().toString(36); let n = 0
const call = async (m, p, t, b, raw) => { const t0 = Date.now(); const r = await fetch(API + p, { method: m, headers: { 'content-type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}) }, body: b === undefined ? undefined : (raw ? b : JSON.stringify(b)) }).catch(e => ({ status: 0, text: async () => String(e) })); const tx = await r.text(); let j = null; try { j = JSON.parse(tx) } catch {} return { s: r.status, j, tx, ms: Date.now() - t0 } }
const DB = new Client({ connectionString: process.env.DATABASE_URL }); const dbq = async (q, a) => (await DB.query(q, a)).rows
const mkUser = async role => { const email = `qa2-e208-${tag}-${++n}@example.test`; const rg = await call('POST', '/api/register', null, { name: 'QA2 e208 ' + n, email, password: PASS }); if (rg.s >= 300) throw new Error('registro ' + rg.s + rg.tx.slice(0, 120)); await dbq('UPDATE "Users" SET role=$1 WHERE email=$2', [role, email]); const l = await call('POST', '/api/login', null, { email, password: PASS }); if (!l.j?.token) throw new Error('login ' + l.s); return { token: l.j.token, email } }
const p95 = a => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.ceil(s.length * 0.95) - 1)] }
;(async () => {
  await DB.connect()
  const seed = build(); const SRC = Object.values(seed.sources)[0]; const CTXS = seed.contexts
  const body = (suffix) => ({ ...SRC, title: `[SINTÉTICO] Fuente ${suffix}` })
  const A = await mkUser('admin'), S = await mkUser('superadmin'), U = await mkUser('user'), T = await mkUser('therapist')
  const cr = await call('POST', '/api/admin/route-catalog', A.token); ck('setup: el administrador crea un borrador', cr.s === 201 && cr.j?.id, `s=${cr.s}`); const id = cr.j.id ?? cr.j.draftId
  const url = (kind, key) => `/api/admin/route-catalog/${id}/${kind}/${key}`
  const rowOf = async (kind, key) => (await dbq('SELECT data, "updatedAt" FROM "RouteCatalogItems" WHERE "catalogId"=$1 AND kind=$2 AND "itemKey"=$3', [id, kind, key]))[0]
  const getItem = async (kind, key) => ((await call('GET', `/api/admin/route-catalog/${id}`, A.token)).j?.items?.[kind] || []).find(i => i.itemKey === key)
  // ============ C3 / C4 base: crear, cadena, sin versión gana el último ============
  const c0 = await call('PUT', url('sources', 'qa_src_base'), A.token, body('uno')); ck('C3 sin expectedUpdatedAt: crear 200 (compatibilidad con el cliente actual)', c0.s === 200 && c0.j?.title?.includes('uno'), `s=${c0.s}`)
  info('C3 forma de la respuesta del PUT sin versión:', Object.keys(c0.j || {}).join(','))
  const c1 = await call('PUT', url('sources', 'qa_src_base'), A.token, body('dos')); ck('C3 sin expectedUpdatedAt: reemplazar 200 (gana el último)', c1.s === 200 && c1.j?.title?.includes('dos'))
  const g = await getItem('sources', 'qa_src_base'); ck('C4 GET /:id trae updatedAt por elemento y coincide con el del último PUT', !!g?.updatedAt && g.updatedAt === c1.j.updatedAt, `${g?.updatedAt} vs ${c1.j.updatedAt}`)
  const dbUp = (await rowOf('sources', 'qa_src_base')).updatedAt.toISOString(); ck('C4 el updatedAt devuelto es el de la base (ISO, ms)', dbUp === c1.j.updatedAt, `${dbUp} vs ${c1.j.updatedAt}`)
  const c2 = await call('PUT', url('sources', 'qa_src_base'), A.token, { ...body('tres'), expectedUpdatedAt: c1.j.updatedAt }); ck('C4 cadena: el updatedAt devuelto sirve para el siguiente PUT', c2.s === 200 && c2.j.title.includes('tres') && c2.j.updatedAt !== c1.j.updatedAt)
  // ============ C2 versión vieja ============
  const stale = await call('PUT', url('sources', 'qa_src_base'), A.token, { ...body('PISADO'), expectedUpdatedAt: c1.j.updatedAt }); ck('C2 versión vieja → 409 item_changed', stale.s === 409 && stale.j?.code === 'item_changed', `s=${stale.s} ${stale.tx.slice(0, 120)}`)
  ck('C2 el 409 trae `current` con el contenido y la versión vigentes (title tres)', stale.j?.current?.title?.includes('tres') && stale.j.current.updatedAt === c2.j.updatedAt && Array.isArray(stale.j.current.missing))
  const r2 = await rowOf('sources', 'qa_src_base'); ck('C2 la base NO cambió (sigue «tres», misma updatedAt) — leída directo de la base', r2.data.title.includes('tres') && !r2.data.title.includes('PISADO') && r2.updatedAt.toISOString() === c2.j.updatedAt)
  ck('C2 el 409 trae mensaje bilingüe', /\/|Someone/.test(stale.j?.error || ''), stale.j?.error)
  const same = await call('GET', `/api/admin/route-catalog/${id}`, A.token); const sameItem = same.j.items.sources.find(i => i.itemKey === 'qa_src_base'); const { missing: _m, kind: _k, ...curNoMeta } = (stale.j?.current || {}); ck('C6 `current` del 409 = lo mismo que GET /:id le muestra al administrador (sin campos extra)', JSON.stringify({ itemKey: 'qa_src_base', ...curNoMeta }) === JSON.stringify(sameItem) || JSON.stringify(Object.keys(curNoMeta).sort()) === JSON.stringify(Object.keys(sameItem).filter(k => k !== 'itemKey').sort()), JSON.stringify([Object.keys(curNoMeta), Object.keys(sameItem)]))
  // ============ C1 concurrencia (BLOQUEANTE) ============
  const rounds = []
  for (let r = 1; r <= 3; r++) {
    const base = await getItem('sources', 'qa_src_base'); const t0 = Date.now()
    const res = await Promise.all(Array.from({ length: 12 }, (_, i) => call('PUT', url('sources', 'qa_src_base'), A.token, { ...body(`ronda${r}-${i}`), expectedUpdatedAt: base.updatedAt })))
    const st = res.map(x => x.s).sort((a, b) => a - b); const win = res.find(x => x.s === 200); const row = await rowOf('sources', 'qa_src_base'); rounds.push(...res.map(x => x.ms))
    ck(`C1 ronda ${r}: 12 simultáneos con la MISMA versión = exactamente 1×200 + 11×409 item_changed, 0 5xx`, st.filter(s => s === 200).length === 1 && st.filter(s => s === 409).length === 11 && res.filter(x => x.s === 409).every(x => x.j?.code === 'item_changed') && !st.some(s => s >= 500), JSON.stringify(st))
    ck(`C1 ronda ${r}: el contenido final en la base es el del único ganador`, !!win && row.data.title === win.j.title && row.updatedAt.toISOString() === win.j.updatedAt, `${row.data.title} / ${win?.j?.title}`)
    ck(`C1 ronda ${r}: cada 409 trae la versión del ganador (current.updatedAt)`, res.filter(x => x.s === 409).every(x => x.j.current?.updatedAt === win.j.updatedAt), `${Date.now() - t0} ms la ronda`)
  }
  info(`C8 rendimiento: 36 PUT en 3 rondas de 12 simultáneos, p95 ${p95(rounds)} ms, máx ${Math.max(...rounds)} ms (umbral aceptado p95 < 1000 ms)`); ck('C8 rendimiento: p95 de los 12 simultáneos < 1 s', p95(rounds) < 1000, `${p95(rounds)} ms`)
  // distintos elementos
  const keys = Array.from({ length: 12 }, (_, i) => `qa_src_d${String(i).padStart(2, '0')}`)
  const dist = await Promise.all(keys.map((k, i) => call('PUT', url('sources', k), A.token, body('distinto' + i)))); ck('C1 12 simultáneos sobre elementos DISTINTOS = 12×200 (no se pisan entre sí)', dist.every(x => x.s === 200), JSON.stringify(dist.map(x => x.s)))
  const cnt = (await dbq('SELECT count(*)::int c FROM "RouteCatalogItems" WHERE "catalogId"=$1 AND kind=$2 AND "itemKey" LIKE $3', [id, 'sources', 'qa_src_d%']))[0].c; ck('C1 y los 12 existen en la base', cnt === 12, String(cnt))
  const bases = await Promise.all(keys.map(k => getItem('sources', k))); const mixed = await Promise.all(keys.flatMap((k, i) => [0, 1].map(j => call('PUT', url('sources', k), A.token, { ...body(`mezcla${i}-${j}`), expectedUpdatedAt: bases[i].updatedAt })))); const perKey = keys.map((_, i) => [mixed[2 * i].s, mixed[2 * i + 1].s].sort().join('/')); ck('C1 24 simultáneos (2 por elemento, 12 elementos): cada elemento = 1×200 + 1×409, 0 5xx', perKey.every(x => x === '200/409') && !mixed.some(x => x.s >= 500), JSON.stringify(perKey))
  // creación simultánea del MISMO elemento nuevo con versión inventada y sin versión
  const nk = `qa_src_nuevo_${tag}`.slice(0, 40).toLowerCase().replace(/[^a-z0-9_]/g, '_'); const cre = await Promise.all(Array.from({ length: 6 }, (_, i) => call('PUT', url('sources', nk), A.token, body('nuevo' + i)))); ck('C1 6 creaciones simultáneas del MISMO elemento nuevo SIN versión: sin 5xx (gana el último) y queda 1 sola fila', !cre.some(x => x.s >= 500) && cre.every(x => x.s === 200), JSON.stringify(cre.map(x => x.s)))
  const rowsN = (await dbq('SELECT count(*)::int c FROM "RouteCatalogItems" WHERE "catalogId"=$1 AND kind=$2 AND "itemKey"=$3', [id, 'sources', nk]))[0].c; ck('C1 …y en la base hay exactamente 1 fila de ese elemento (sin duplicados)', rowsN === 1, String(rowsN))
  // ============ C3 mezclado: sin versión no se rompe aunque otro tenga versión ============
  const cur = await getItem('sources', 'qa_src_base'); const legacy = await call('PUT', url('sources', 'qa_src_base'), A.token, body('heredado')); ck('C3 PUT sin versión después de cambios ajenos = 200 y pisa (gana el último, como antes)', legacy.s === 200 && legacy.j.title.includes('heredado'))
  const afterLegacy = await call('PUT', url('sources', 'qa_src_base'), A.token, { ...body('con-version-vieja'), expectedUpdatedAt: cur.updatedAt }); ck('C3 …y quien tenía la versión anterior ahora recibe 409 (el cambio heredado sí se detecta)', afterLegacy.s === 409 && afterLegacy.j.current.title.includes('heredado'))
  // ============ C4 creación/borrado con versión ============
  const mk = await call('PUT', url('sources', 'qa_src_nuevo_v'), A.token, { ...body('crear'), expectedUpdatedAt: new Date().toISOString() }); ck('C4 crear un elemento que NO existe mandando versión → 409 con current:null', mk.s === 409 && mk.j?.code === 'item_changed' && mk.j.current === null, `s=${mk.s} ${mk.tx.slice(0, 100)}`)
  ck('C4 …y no se creó', ((await dbq('SELECT count(*)::int c FROM "RouteCatalogItems" WHERE "catalogId"=$1 AND "itemKey"=$2', [id, 'qa_src_nuevo_v']))[0].c) === 0)
  const stamp = (await getItem('sources', 'qa_src_d00')).updatedAt; const del = await call('DELETE', url('sources', 'qa_src_d00'), A.token); ck('C4 borrar el elemento (sin versión, como el cliente actual) = 200', del.s === 200)
  const gone = await call('PUT', url('sources', 'qa_src_d00'), A.token, { ...body('revivir'), expectedUpdatedAt: stamp }); ck('C4 PUT con la versión de un elemento ya borrado → 409 con current:null y NO lo revive', gone.s === 409 && gone.j.current === null && ((await dbq('SELECT count(*)::int c FROM "RouteCatalogItems" WHERE "catalogId"=$1 AND "itemKey"=$2', [id, 'qa_src_d00']))[0].c) === 0, `s=${gone.s}`)
  // ============ C5 expectedUpdatedAt raro y cuerpos raros ============
  const base5 = await getItem('sources', 'qa_src_base'); const weird = [['texto no fecha', 'no-es-fecha'], ['número', 12345], ['null', null], ['objeto vacío', {}], ['arreglo', ['x']], ['cadena vacía', ''], ['booleano', true], ['fecha enorme', '9999-99-99T99:99:99Z'], ['arreglo de fecha', [base5.updatedAt]]]
  for (const [nm, v] of weird) { const r = await call('PUT', url('sources', 'qa_src_base'), A.token, { ...body('raro'), expectedUpdatedAt: v }); ck(`C5 expectedUpdatedAt ${nm} → 400 invalid_expected (nunca 5xx), sin cambios`, r.s === 400 && r.j?.code === 'invalid_expected', `s=${r.s} ${r.tx.slice(0, 80)}`) }
  ck('C5 …y ninguno de esos intentos cambió la base', (await rowOf('sources', 'qa_src_base')).updatedAt.toISOString() === base5.updatedAt)
  for (const [nm, v] of [['misma fecha en otra zona (+00:00)', base5.updatedAt.replace('Z', '+00:00')], ['misma fecha sin milisegundos', base5.updatedAt.replace(/\.\d+Z$/, 'Z')]]) { const r = await call('PUT', url('sources', 'qa_src_base'), A.token, { ...body('zona' + nm.length), expectedUpdatedAt: v }); info(`C5 ${nm}: status ${r.s}${r.j?.code ? ' ' + r.j.code : ''} (iguales en instante: ${new Date(v).getTime() === new Date(base5.updatedAt).getTime()})`) }
  for (const [nm, raw] of [['arreglo', '[1,2]'], ['texto', '"hola"'], ['null', 'null'], ['número', '5'], ['JSON roto', '{"a":']]) { const r = await call('PUT', url('sources', 'qa_src_base'), A.token, raw, true); ck(`C5 cuerpo ${nm} → 4xx y nunca 5xx`, r.s >= 400 && r.s < 500, `s=${r.s} ${r.tx.slice(0, 80)}`) }
  { const r = await call('PUT', url('sources', 'qa_src_base'), A.token, '', true); info('C5 cuerpo vacío: status', r.s, '(preexistente por el diff: express.json deja {} y todos los campos son opcionales al guardar borrador; la integridad se exige al publicar)') }
  const clean = await call('PUT', url('sources', 'qa_src_meta'), A.token, { ...body('meta'), updatedAt: '1999-01-01T00:00:00.000Z', expectedUpdatedAt: undefined }); const rm = await rowOf('sources', 'qa_src_meta'); ck('C5 `updatedAt` enviado por el cliente NO se guarda en data ni cambia la versión real', clean.s === 200 && !('updatedAt' in rm.data) && !('expectedUpdatedAt' in rm.data) && rm.updatedAt.getFullYear() > 2000, `s=${clean.s} claves ${Object.keys(rm.data).join(',')}`)
  const ex = await call('PUT', url('sources', 'qa_src_meta'), A.token, { ...body('meta2'), expectedUpdatedAt: clean.j.updatedAt }); const rm2 = await rowOf('sources', 'qa_src_meta'); ck('C5 con versión válida tampoco se cuela `expectedUpdatedAt` a data', ex.s === 200 && !('expectedUpdatedAt' in rm2.data) && !('updatedAt' in rm2.data))
  const extra = await call('PUT', url('sources', 'qa_src_meta'), A.token, { ...body('meta3'), campoNuevo: 'x' }); ck('C5 un campo desconocido sigue rechazándose (validación del contenido intacta)', extra.s === 400, `s=${extra.s}`)
  const bad409 = await call('PUT', url('sources', 'qa_src_meta'), A.token, { ...body('x'), url: 'http://inseguro.test', expectedUpdatedAt: '2000-01-01T00:00:00.000Z' }); info('C5 contenido inválido + versión vieja: status', bad409.s, bad409.j?.code || '')
  // ============ C6 aislamiento, rol, no editable ============
  const sentinel = (await rowOf('sources', 'qa_src_base')).updatedAt.toISOString(); const baseNow = await getItem('sources', 'qa_src_base')
  for (const [nm, tok, exp] of [['sin token', null, 403], ['usuario normal', U.token, 403], ['terapeuta', T.token, 403]]) { const r = await call('PUT', url('sources', 'qa_src_base'), tok, { ...body('intruso'), expectedUpdatedAt: baseNow.updatedAt }); ck(`C6 ${nm}: PUT con versión → ${exp} y sin cambios`, r.s === exp, `s=${r.s}`); const g2 = await call('GET', `/api/admin/route-catalog/${id}`, tok); ck(`C6 ${nm}: GET /:id → ${exp} (no ve updatedAt ni nada del borrador)`, g2.s === exp && !g2.tx.includes('updatedAt')) }
  ck('C6 el borrador NO cambió con esos intentos', (await rowOf('sources', 'qa_src_base')).updatedAt.toISOString() === sentinel)
  const sa = await call('PUT', url('sources', 'qa_src_base'), S.token, { ...body('superadmin'), expectedUpdatedAt: baseNow.updatedAt }); ck('C6 superadmin (rol permitido) funciona igual: 200 con versión vigente', sa.s === 200)
  const inex = await call('PUT', `/api/admin/route-catalog/99999999/sources/qa_src_x`, A.token, { ...body('x'), expectedUpdatedAt: new Date().toISOString() }); ck('C6 borrador inexistente → 404 (no 409 ni 5xx)', inex.s === 404, `s=${inex.s}`)
  for (const [nm, p] of [['id no numérico', `/api/admin/route-catalog/abc/sources/qa_src_x`], ['id negativo', `/api/admin/route-catalog/-1/sources/qa_src_x`], ['id enorme', `/api/admin/route-catalog/99999999999999999999/sources/qa_src_x`], ['kind inventado', `/api/admin/route-catalog/${id}/hacks/qa_src_x`], ['key con inyección', `/api/admin/route-catalog/${id}/sources/${encodeURIComponent("x'; DROP TABLE \"Users\";--")}`], ['key enorme', `/api/admin/route-catalog/${id}/sources/${'a'.repeat(5000)}`], ['key unicode', `/api/admin/route-catalog/${id}/sources/${encodeURIComponent('ñandú_é')}`]]) { const r = await call('PUT', p, A.token, { ...body('x'), expectedUpdatedAt: new Date().toISOString() }); ck(`C6 ${nm} → 4xx, nunca 5xx`, r.s >= 400 && r.s < 500, `s=${r.s} ${r.tx.slice(0, 60)}`) }
  ck('C6 la tabla de usuarios sigue intacta tras la inyección', (await dbq('SELECT count(*)::int c FROM "Users"'))[0].c > 0)
  // versión no editable
  const cr2 = await call('POST', '/api/admin/route-catalog', A.token); const id2 = cr2.s === 201 ? cr2.j.id : id; await call('PUT', `/api/admin/route-catalog/${id2}/sources/qa_src_pub`, A.token, body('pub')); const pubRow = await dbq('SELECT "updatedAt" FROM "RouteCatalogItems" WHERE "catalogId"=$1 AND "itemKey"=$2', [id2, 'qa_src_pub']); const st2 = pubRow[0]?.updatedAt.toISOString()
  info('C6 segundo borrador:', cr2.s, cr2.j?.id, '(¿se puede crear otro borrador?)')
  await dbq('UPDATE "RouteCatalogs" SET status=$1 WHERE id=$2', ['published', id2]); const np = await call('PUT', `/api/admin/route-catalog/${id2}/sources/qa_src_pub`, A.token, { ...body('editar-publicado'), expectedUpdatedAt: st2 }); ck('C6 versión publicada (no editable) + versión esperada → catalog_not_editable (no 409 item_changed, no cambia)', np.s >= 400 && np.s < 500 && np.j?.code === 'catalog_not_editable', `s=${np.s} ${np.tx.slice(0, 100)}`)
  const pubGet = await call('GET', '/api/route-catalog', U.token); info('C5 catálogo público vigente (publicado por la base):', pubGet.s); ck('C5 el catálogo que ve la persona NO trae updatedAt ni expectedUpdatedAt en ningún elemento', pubGet.s === 200 && !/expectedUpdatedAt/.test(pubGet.tx) && !/"updatedAt"/.test(pubGet.tx), pubGet.tx.slice(0, 100))
  await dbq('UPDATE "RouteCatalogs" SET status=$1 WHERE id=$2', ['draft', id2])
  // ============ ABA: updatedAt dentro del mismo milisegundo ============
  const key = 'qa_src_aba'; const first = await call('PUT', url('sources', key), A.token, body('aba0')); let cur2 = first.j.updatedAt, same2 = 0, oks = 0
  for (let i = 1; i <= 120; i++) { const r = await call('PUT', url('sources', key), A.token, { ...body('aba' + i), expectedUpdatedAt: cur2 }); if (r.s === 200) { oks++; if (r.j.updatedAt === cur2) same2++; cur2 = r.j.updatedAt } else break }
  ck('ABA 120 guardados encadenados con versión: todos 200 y la versión SIEMPRE cambia (un guardado no puede dejar la misma updatedAt)', oks === 120 && same2 === 0, `ok=${oks} iguales=${same2}`)
  // guardar el MISMO contenido (sin cambio real) con versión
  const idem = await call('PUT', url('sources', key), A.token, { ...body('aba120'), expectedUpdatedAt: cur2 }); info('C4 guardar el mismo contenido con versión vigente: status', idem.s, 'updatedAt cambió:', idem.j?.updatedAt !== cur2)
  // ============ C7 regresión: publicar sigue funcionando ============
  const pub = await call('POST', `/api/admin/route-catalog/${id}/publish`, A.token); ck('C7 publicar el borrador sigue respondiendo de forma controlada (422 por incompleto/sintético, no 5xx)', pub.s >= 400 && pub.s < 500, `s=${pub.s} ${pub.j?.code}`)
  ck('C7 la lista de versiones (GET /) responde 200', (await call('GET', '/api/admin/route-catalog', A.token)).s === 200)
  const full = await call('GET', `/api/admin/route-catalog/${id}`, A.token); ck('C7 GET /:id conserva `items` por tipo y `missing` y agrega updatedAt en cada elemento', full.s === 200 && ['contexts', 'sources', 'roles', 'offers', 'resources'].every(k => Array.isArray(full.j.items[k])) && full.j.items.sources.every(i => !!i.updatedAt) && typeof full.j.missing === 'object')
  await DB.end(); console.log(`\nRESUMEN [${LABEL}]: ${total - f}/${total} OK, ${f} FALLA`); process.exit(f ? 1 : 0)
})().catch(e => { console.error('ERROR', e); process.exit(2) })
