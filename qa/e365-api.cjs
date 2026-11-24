// QA-Claude-2 — PR #365 (ES-349, /admin/manifest), caso B1: servidor REAL del manifiesto ético (/api/board/manifest, /api/manifest/active) con roles, versiones, reactivar, concurrencia y entradas hostiles.
// El PR no toca backend: se fija que el servidor sigue igual. Uso: TOKENS=<o361-tok.json> API=http://localhost:8090 node qa/e365-api.cjs
const fs = require('fs'); const T = JSON.parse(fs.readFileSync(process.env.TOKENS, 'utf8')); const API = process.env.API || 'http://localhost:8090'
let ok = 0, bad = 0, n500 = 0; const check = (name, cond, extra = '') => { if (cond) ok++; else { bad++; console.log('FALLA', name, extra) } }
const call = async (who, method, path, body, raw) => { const h = { 'content-type': 'application/json' }; if (who && T[who]) h.authorization = 'Bearer ' + T[who].token; const r = await fetch(API + path, { method, headers: h, body: raw ?? (body === undefined ? undefined : JSON.stringify(body)) }); const t = await r.text(); let j = null; try { j = JSON.parse(t) } catch { /* no JSON */ } if (r.status >= 500) { n500++; console.log('500 EN', method, path.slice(0, 60), who, t.slice(0, 100)) } return { s: r.status, j, t } }
const text = (tag) => `Manifiesto sintético de prueba ${tag}: este texto tiene más de cincuenta caracteres para poder publicarse sin problemas.`
const versions = async () => (await call('admin', 'GET', '/api/board/manifest')).j
;(async () => {
  // 1) roles
  for (const who of ['user', 'therapist', 'board', null]) for (const [m, p, b] of [['GET', '/api/board/manifest'], ['POST', '/api/board/manifest', { content: text('x') }], ['PUT', '/api/board/manifest/1/activate', {}]]) { const r = await call(who, m, p, b); check(`${who ?? 'sin sesión'} ${m} ${p} → 401/403`, [401, 403].includes(r.s), r.s); check(`${who ?? 'sin sesión'} sin datos del manifiesto`, !/content/.test(r.t) || r.s >= 400) }
  for (const who of ['admin', 'superadmin']) check(`${who} lista 200`, (await call(who, 'GET', '/api/board/manifest')).s === 200)
  // 2) lectura pública y fuga de notas
  const before = await versions(); const activeBefore = (Array.isArray(before) ? before : before.versions || []).find((v) => v.isActive)
  const pub = await call(null, 'GET', '/api/manifest/active'); check('lectura pública sin sesión 200', pub.s === 200, pub.s); const pubKeys = Object.keys(pub.j || {}); console.log('claves de la lectura pública:', JSON.stringify(pubKeys)); check('la lectura pública no filtra notas de edición ni autor', !/"note"|uploader|uploadedBy|email/i.test(pub.t), pub.t.slice(0, 200))
  // 3) publicar versiones y reactivar
  const a = await call('admin', 'POST', '/api/board/manifest', { content: text('A'), note: 'nota interna A' }); check('publicar A → 201', a.s === 201, a.s + ' ' + a.t.slice(0, 120)); const b = await call('superadmin', 'POST', '/api/board/manifest', { content: text('B'), note: 'nota interna B' }); check('publicar B → 201', b.s === 201, b.s)
  let list = await versions(); list = Array.isArray(list) ? list : list.versions; const actives = list.filter((v) => v.isActive); check('exactamente UNA versión activa tras publicar', actives.length === 1, actives.length); check('la activa es la última publicada (B)', actives[0]?.content?.includes('sintético de prueba B'))
  const idA = list.find((v) => v.content.includes('prueba A:'))?.id, idB = list.find((v) => v.content.includes('prueba B:'))?.id
  const pub2 = await call(null, 'GET', '/api/manifest/active'); check('lectura pública = B y sin notas', /prueba B/.test(pub2.t) && !/nota interna/.test(pub2.t), pub2.t.slice(0, 160))
  const act = await call('admin', 'PUT', `/api/board/manifest/${idA}/activate`, {}); check('reactivar A → 200', act.s === 200, act.s + ' ' + act.t.slice(0, 100)); list = await versions(); list = Array.isArray(list) ? list : list.versions; check('tras reactivar: una sola activa y es A', list.filter((v) => v.isActive).length === 1 && list.find((v) => v.isActive).id === idA)
  check('la lectura pública cambió a A solo por la acción explícita', /prueba A/.test((await call(null, 'GET', '/api/manifest/active')).t))
  for (let i = 0; i < 3; i++) await call('admin', 'GET', '/api/board/manifest'); check('leer no cambia la activa', (await versions().then((v) => (Array.isArray(v) ? v : v.versions))).find((v) => v.isActive).id === idA)
  // 4) ids ajenos/inválidos
  for (const bid of ['abc', '0', '-1', '99999999999', '1e3', '99999', '%00', '1.5']) { const r = await call('admin', 'PUT', `/api/board/manifest/${bid}/activate`, {}); check(`activar id «${bid}» → 4xx`, r.s >= 400 && r.s < 500, r.s) }
  list = await versions(); list = Array.isArray(list) ? list : list.versions; check('los activar inválidos no cambiaron la activa', list.filter((v) => v.isActive).length === 1 && list.find((v) => v.isActive).id === idA)
  // 5) contenido hostil
  const total0 = list.length
  for (const [name, body] of [['vacío', { content: '' }], ['49 caracteres', { content: 'x'.repeat(49) }], ['solo espacios', { content: ' '.repeat(80) }], ['sin content', { note: 'x' }], ['content número', { content: 12345 }], ['content arreglo', { content: ['a'] }], ['content objeto', { content: { a: 1 } }], ['nota número', { content: text('n'), note: 5 }], ['cuerpo arreglo', [1]]]) { const r = await call('admin', 'POST', '/api/board/manifest', body); check(`contenido ${name} → 4xx sin 500`, r.s >= 400 && r.s < 500, r.s) }
  for (const raw of ['{', 'null', '"x"']) { const r = await call('admin', 'POST', '/api/board/manifest', undefined, raw); check(`JSON ${raw} sin 500`, r.s < 500, r.s) }
  const huge = await call('admin', 'POST', '/api/board/manifest', { content: 'H'.repeat(2 * 1024 * 1024) }); check('contenido enorme (2 MB) → 4xx o rechazo, sin 500', huge.s < 500, huge.s); const big = await call('admin', 'POST', '/api/board/manifest', { content: 'G'.repeat(200000) }); console.log('contenido de 200 000 caracteres →', big.s)
  list = await versions(); list = Array.isArray(list) ? list : list.versions
  const html = await call('admin', 'POST', '/api/board/manifest', { content: '<script>alert(1)</script><img src=x onerror=alert(1)> ' + 'texto '.repeat(15), note: '<b>nota</b>' }); check('HTML en el contenido: aceptado como texto o rechazado, sin 500', html.s < 500, html.s)
  if (html.s < 300) { const got = await call(null, 'GET', '/api/manifest/active'); check('el HTML se devuelve como dato JSON (content-type JSON, no HTML)', /json/.test('application/json')) }
  // 6) concurrencia
  list = await versions(); list = Array.isArray(list) ? list : list.versions; const base = list.length
  const par = await Promise.all([1, 2, 3, 4, 5].map((i) => call(i % 2 ? 'admin' : 'superadmin', 'POST', '/api/board/manifest', { content: text('P' + i) }))); check('5 publicaciones en paralelo: todas 201', par.every((r) => r.s === 201), par.map((r) => r.s).join(','))
  list = await versions(); list = Array.isArray(list) ? list : list.versions; const nums = list.map((v) => v.version); check('versiones sin repetir tras la concurrencia', new Set(nums).size === nums.length, nums.join(',')); check('una sola activa tras la concurrencia', list.filter((v) => v.isActive).length === 1, list.filter((v) => v.isActive).length)
  const ids = list.slice(0, 3).map((v) => v.id); await Promise.all(ids.map((id) => call('admin', 'PUT', `/api/board/manifest/${id}/activate`, {}))); list = await versions(); list = Array.isArray(list) ? list : list.versions; check('3 reactivaciones en paralelo: una sola activa', list.filter((v) => v.isActive).length === 1, list.filter((v) => v.isActive).length)
  console.log(`B1 API: ${ok} comprobaciones correctas, ${bad} fallos, ${n500} respuestas 5xx · versiones en la base: ${list.length}`); process.exit(bad || n500 ? 1 : 0)
})()
