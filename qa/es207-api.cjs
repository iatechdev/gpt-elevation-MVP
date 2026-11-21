// QA-Claude-2 — ES-207 (PR #150): control de acceso y fuga de datos del manifiesto, contra un backend LOCAL del head con Postgres desechable.
// Env: BACKEND (ruta del backend), DATABASE_URL, API (http://localhost:8090).
const { createRequire } = require('module'); const { Client } = createRequire(process.env.BACKEND + '/package.json')('pg'); const crypto = require('crypto'); const jwt = createRequire(process.env.BACKEND + '/package.json')('jsonwebtoken')
const API = process.env.API; let f = 0; const ck = (n, ok, x = '') => { if (!ok) f++; console.log((ok ? 'OK   ' : 'FALLA ') + n, x) }
const call = async (m, p, t, b, h) => { const r = await fetch(API + p, { method: m, headers: { 'content-type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}), ...(h || {}) }, body: b === undefined ? undefined : JSON.stringify(b) }); const txt = await r.text(); let j = null; try { j = JSON.parse(txt) } catch {} return { s: r.status, j, txt, h: r.headers } }
const sleep = ms => new Promise(r => setTimeout(r, ms))
;(async () => {
  const db = new Client({ connectionString: process.env.DATABASE_URL }); await db.connect(); const tag = Date.now().toString(36), pw = 'Sint3tica-QA-pass1!'
  const T = {}, U = {}
  for (const role of ['user', 'therapist', 'board', 'admin', 'superadmin']) { const email = `qa2-m207-${role}-${tag}@example.test`; await call('POST', '/api/register', null, { name: 'QA2 ' + role, email, password: pw }); await db.query('UPDATE "Users" SET role=$1 WHERE email=$2', [role, email]); await sleep(250); const l = await call('POST', '/api/login', null, { email, password: pw }); T[role] = l.j?.token; U[role] = email; ck(`Preparación: sesión de ${role}`, !!T[role] && l.j?.role === role, `HTTP ${l.s} rol=${l.j?.role}`); await sleep(700) }
  const body = { content: 'Versión QA2. Principio uno: cuidar la privacidad.\n\nPrincipio dos: no clínico.', note: 'nota interna QA2 secreta' }
  // F1 sin versión activa
  const e0 = await call('GET', '/api/manifest/active'); ck('F1 sin versión activa: 200 {content:null} y sin sesión', e0.s === 200 && e0.j?.content === null, `HTTP ${e0.s} ${e0.txt.slice(0, 80)}`)
  // S2 matriz de roles en ambos montajes
  const mounts = [['/api/manifest/manifest', 'manifest'], ['/api/board/manifest', 'board']]
  for (const [path, nm] of mounts) {
    const sin = await call('POST', path, null, body); ck(`S2 ${nm}: POST sin token → rechazado (401/403)`, sin.s === 401 || sin.s === 403, 'HTTP ' + sin.s + ' (el API entero responde 403 sin cabecera Authorization y 401 con token inválido: es ES-206 punto 5)')
    const bad = await call('POST', path, 'basura.token.x', body); ck(`S2 ${nm}: POST con token inválido → 401`, bad.s === 401, 'HTTP ' + bad.s)
    for (const role of ['user', 'therapist', 'board']) { const r = await call('POST', path, T[role], body); const g = await call('GET', path, T[role]); ck(`S2 ${nm}: ${role} no crea ni lee historial → 403`, r.s === 403 && g.s === 403, `POST ${r.s} GET ${g.s}`) }
  }
  const before = (await db.query('SELECT count(*)::int AS n FROM "EthicManifests"').catch(() => ({ rows: [{ n: -1 }] }))).rows[0].n; console.log('INFO versiones de manifiesto en la base tras los rechazos:', before)
  ck('S2 los rechazos no crearon ninguna versión', before === 0)
  const ids = []
  for (const role of ['admin', 'superadmin']) for (const [path, nm] of mounts) { const r = await call('POST', path, T[role], { ...body, content: body.content + ` (${role}/${nm})` }); ck(`S2 ${nm}: ${role} crea versión → 200/201`, r.s === 200 || r.s === 201, `HTTP ${r.s} ${JSON.stringify(r.j).slice(0, 80)}`); ids.push(r.j?.id ?? r.j?.manifest?.id ?? r.j?.version?.id); await sleep(150) }
  const hist = await call('GET', '/api/manifest/manifest', T.admin); ck('S2 admin ve el historial (200)', hist.s === 200, `HTTP ${hist.s} claves=${Object.keys(hist.j || {}).join(',').slice(0, 60)}`)
  const rows = Array.isArray(hist.j) ? hist.j : hist.j?.versions || hist.j?.manifests || []; const first = rows[rows.length - 1] || rows[0]; console.log('INFO historial: filas', rows.length, 'campos', Object.keys(first || {}).join(','))
  const actId = first?.id ?? ids.find(Boolean)
  for (const [path, nm] of [[`/api/manifest/manifest/${actId}/activate`, 'manifest'], [`/api/board/manifest/${actId}/activate`, 'board']]) {
    for (const role of ['user', 'therapist', 'board']) { const r = await call('PUT', path, T[role]); ck(`S2 ${nm}: ${role} no activa → 403`, r.s === 403, 'HTTP ' + r.s) }
    const sin = await call('PUT', path, null); ck(`S2 ${nm}: activar sin token → rechazado (401/403)`, sin.s === 401 || sin.s === 403, 'HTTP ' + sin.s) }
  const act = await call('PUT', `/api/manifest/manifest/${actId}/activate`, T.admin); ck('S2 admin activa una versión (200)', act.s === 200, `HTTP ${act.s} ${act.txt.slice(0, 80)}`)
  const otherId = rows.map(r => r.id).find(i => i !== actId); const act2 = await call('PUT', `/api/board/manifest/${otherId}/activate`, T.superadmin); ck('S2 superadmin activa por /api/board (200)', act2.s === 200, `HTTP ${act2.s}`)
  // S1 lectura pública sin fugas
  const pub = await call('GET', '/api/manifest/active'); const keys = Object.keys(pub.j || {}).sort().join(',')
  ck('F1/S1 lectura pública sin sesión: 200 con SOLO version, content, publishedAt', pub.s === 200 && keys === 'content,publishedAt,version', `HTTP ${pub.s} claves=${keys}`)
  ck('S1 sin nota interna, autor, correo, IDs ni hash en la respuesta pública', !/nota interna|secret|@example|"id"|author|createdBy|hash|UserId/i.test(pub.txt), pub.txt.slice(0, 160))
  ck('S1 sin Set-Cookie ni cabeceras de identidad', !pub.h.get('set-cookie'), `cache-control=${pub.h.get('cache-control')}`)
  const pubBoard = await call('GET', '/api/board/active'); ck('D1 /api/board/active ya no es público (exige admin/superadmin)', pubBoard.s === 401 || pubBoard.s === 403 || pubBoard.s === 404, 'HTTP ' + pubBoard.s)
  // D1 ninguna otra ruta del router
  const extra = []; for (const p of ['/api/board', '/api/board/profile', '/api/board/members', '/api/board/reviews', '/api/board/prompts', '/api/board/users', '/api/board/anything']) { const r = await call('GET', p, T.admin); extra.push(`${p}=${r.s}`) } console.log('INFO D1 GET con admin en rutas inexistentes/otras del montaje:', extra.join(' '))
  ck('D1 ninguna ruta extra de /api/board responde 200 a admin', extra.every(x => !x.endsWith('=200')))
  // S3 rol alterado
  const secret = process.env.JWT_SECRET; console.log('INFO S3: el JWT se firma con el secreto del servidor, que QA no conoce; se prueba el payload alterado sin firma válida')
  const parts = T.user.split('.'); const forged = parts[0] + '.' + Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(parts[1], 'base64url').toString()), role: 'admin' })).toString('base64url') + '.' + parts[2]
  const fr = await call('POST', '/api/manifest/manifest', forged, body); ck('S3 JWT con rol elevado en el payload → 401', fr.s === 401, 'HTTP ' + fr.s)
  const none = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url') + '.' + Buffer.from(JSON.stringify({ id: 1, role: 'superadmin' })).toString('base64url') + '.'; const nr = await call('POST', '/api/board/manifest', none, body); ck('S3 JWT alg=none → 401', nr.s === 401, 'HTTP ' + nr.s)
  // usuario cuyo rol cambia en la base: el token viejo de admin ya no sirve si bajó a user
  // S4 texto hostil
  const hostile = '<script>alert(1)</script><img src=x onerror=alert(2)> [x](javascript:alert(3)) '.repeat(3) + 'A'.repeat(20000) + ' 😀 ‮evil'
  const hv = await call('POST', '/api/manifest/manifest', T.admin, { content: hostile, note: 'n' }); console.log('INFO S4 versión hostil de 20.000+ caracteres: POST →', hv.s, hv.j?.error || hv.j?.code || ''); ck('S4 contenido hostil/largo: 4xx controlado o 2xx, nunca 5xx', hv.s < 500)
  if (hv.s < 300) { const p2 = await call('GET', '/api/manifest/active'); ck('S4 la API devuelve el contenido hostil tal cual como texto JSON (la nueva versión queda activa al publicar)', p2.s === 200 && typeof p2.j?.content === 'string' && p2.j.content.includes('<script>'), `HTTP ${p2.s} longitud=${p2.j?.content?.length}`) }
  const vac = await call('POST', '/api/manifest/manifest', T.admin, { content: '   ', note: '' }); ck('S4 contenido vacío → 400', vac.s === 400, 'HTTP ' + vac.s)
  const big = await call('POST', '/api/manifest/manifest', T.admin, { content: 'x'.repeat(2_000_000) }); ck('S4 contenido de 2 MB → 4xx controlado, no 5xx', big.s >= 400 && big.s < 500, 'HTTP ' + big.s)
  // F2 error interno
  await db.query('ALTER TABLE "EthicManifests" RENAME TO "EthicManifests_x"'); const er = await call('GET', '/api/manifest/active'); await db.query('ALTER TABLE "EthicManifests_x" RENAME TO "EthicManifests"')
  ck('F2 fallo interno → 500 genérico (no 200 vacío) y sin detalle de la base', er.s === 500 && !/relation|sequelize|SELECT|EthicManifest/i.test(er.txt), `HTTP ${er.s} ${er.txt.slice(0, 100)}`)
  const ok = await call('GET', '/api/manifest/active'); ck('F2 tras restaurar la tabla vuelve a responder 200', ok.s === 200)
  // limpieza: los usuarios viven en una base desechable
  await db.end(); console.log(f ? `\nFALLAS ${f}` : '\nTODO OK'); process.exit(f ? 1 : 0)
})().catch(e => { console.error('EXCEPCIÓN', e.stack?.slice(0, 400)); process.exit(3) })
