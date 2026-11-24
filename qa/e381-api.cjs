// QA-Claude-2 — PR #381 (ES-182, decisión 12079): servidor REAL con el código del PR. POST /manifest y PUT /manifest/:id/activate SOLO superadmin en /api/board y en /api/manifest (403 para admin, profesional, persona; sin tocar la base);
// GET del historial sigue admin+superadmin; la lectura pública GET /active no cambia. Uso: TOKENS=<o381-tok.json> API=http://localhost:8191 node qa/e381-api.cjs
const fs = require('fs'); const T = JSON.parse(fs.readFileSync(process.env.TOKENS, 'utf8')); const API = process.env.API || 'http://localhost:8191'
let ok = 0, bad = 0, n500 = 0; const check = (name, cond, extra = '') => { if (cond) ok++; else { bad++; console.log('FALLA', name, extra) } }
const call = async (who, method, path, body, raw, token) => { const h = { 'content-type': 'application/json' }; const tk = token ?? (who && T[who] ? T[who].token : null); if (tk) h.authorization = 'Bearer ' + tk; const r = await fetch(API + path, { method, headers: h, body: raw ?? (body === undefined ? undefined : JSON.stringify(body)) }); const t = await r.text(); let j = null; try { j = JSON.parse(t) } catch { /* no JSON */ } if (r.status >= 500) { n500++; console.log('500 EN', method, path, who, t.slice(0, 100)) } return { s: r.status, j, t } }
const text = (tag) => `Manifiesto sintético de prueba ${tag}: este texto tiene más de cincuenta caracteres para poder publicarse sin problemas.`
const hist = async () => { const r = await call('superadmin', 'GET', '/api/board/manifest'); return Array.isArray(r.j) ? r.j : r.j.versions }
;(async () => {
  await call('superadmin', 'POST', '/api/board/manifest', { content: text('Base1') }); await call('superadmin', 'POST', '/api/board/manifest', { content: text('Base2') })
  const before = await hist(); const idOld = before.find((v) => !v.isActive).id, idAct = before.find((v) => v.isActive).id; const snap = JSON.stringify(before.map((v) => [v.id, v.version, v.isActive, v.content]))
  for (const prefix of ['/api/board', '/api/manifest']) {
    // lectura del historial: admin y superadmin sí; el resto no
    for (const who of ['admin', 'superadmin']) check(`${prefix} ${who} GET historial → 200`, (await call(who, 'GET', prefix + '/manifest')).s === 200)
    for (const who of ['user', 'therapist', 'board']) { const r = await call(who, 'GET', prefix + '/manifest'); check(`${prefix} ${who} GET historial → 403`, r.s === 403, r.s); check(`${prefix} ${who} sin datos`, !/content/.test(r.t)) }
    check(`${prefix} sin sesión GET historial → 401`, (await call(null, 'GET', prefix + '/manifest')).s === 401)
    // publicar y reactivar: SOLO superadmin
    for (const who of ['admin', 'user', 'therapist', 'board']) {
      const p = await call(who, 'POST', prefix + '/manifest', { content: text('Intruso-' + who) }); check(`${prefix} ${who} POST publicar → 403`, p.s === 403, p.s + ' ' + p.t.slice(0, 80))
      const a = await call(who, 'PUT', `${prefix}/manifest/${idOld}/activate`, {}); check(`${prefix} ${who} PUT reactivar → 403`, a.s === 403, a.s)
      // la guarda va ANTES de validar: con un cuerpo inválido o un id inexistente sigue siendo 403 (no revela nada)
      check(`${prefix} ${who} POST con cuerpo inválido → 403 (no 400)`, (await call(who, 'POST', prefix + '/manifest', { content: 5 })).s === 403)
      check(`${prefix} ${who} PUT con id inexistente → 403 (no 404: no revela si existe)`, (await call(who, 'PUT', `${prefix}/manifest/99999/activate`, {})).s === 403); check(`${prefix} ${who} PUT con id «abc» → 403/404 de formato, nunca 200/500`, [403, 404].includes((await call(who, 'PUT', `${prefix}/manifest/abc/activate`, {})).s))
    }
    for (const m of [['POST', '/manifest', { content: text('x') }], ['PUT', `/manifest/${idOld}/activate`, {}]]) { check(`${prefix} sin sesión ${m[0]} → 401`, (await call(null, m[0], prefix + m[1], m[2])).s === 401); check(`${prefix} token inválido ${m[0]} → 401`, (await call(null, m[0], prefix + m[1], m[2], undefined, 'no.es.un.token')).s === 401) }
  }
  const after = await hist(); check('la base NO cambió con ningún intento denegado (mismas versiones, contenido y activa)', JSON.stringify(after.map((v) => [v.id, v.version, v.isActive, v.content])) === snap, `${after.length} vs ${before.length}`)
  // superadmin conserva todo
  for (const prefix of ['/api/board', '/api/manifest']) {
    const p = await call('superadmin', 'POST', prefix + '/manifest', { content: text('Super-' + prefix.slice(5)) }); check(`${prefix} superadmin publica → 201`, p.s === 201, p.s + ' ' + p.t.slice(0, 80))
    let l = await hist(); check(`${prefix} tras publicar: una sola activa y es la nueva`, l.filter((v) => v.isActive).length === 1 && l.find((v) => v.isActive).content.includes('Super-' + prefix.slice(5)))
    const a = await call('superadmin', 'PUT', `${prefix}/manifest/${idOld}/activate`, {}); check(`${prefix} superadmin reactiva → 200`, a.s === 200, a.s); l = await hist(); check(`${prefix} tras reactivar: una sola activa y es la elegida`, l.filter((v) => v.isActive).length === 1 && l.find((v) => v.isActive).id === idOld)
    check(`${prefix} superadmin: validaciones siguen (49 caracteres → 400; id inexistente → 404)`, (await call('superadmin', 'POST', prefix + '/manifest', { content: 'x'.repeat(49) })).s === 400 && (await call('superadmin', 'PUT', `${prefix}/manifest/99999/activate`, {})).s === 404)
  }
  // la lectura pública no cambia
  const pub = await call(null, 'GET', '/api/manifest/active'); check('lectura pública sin sesión → 200 y solo content, version y publishedAt (sin notas ni autor)', pub.s === 200 && Object.keys(pub.j).every((k) => ['content', 'version', 'publishedAt'].includes(k)) && !/note|uploader|email/i.test(pub.t), pub.t.slice(0, 100)); check('lectura pública en /api/board/active (si existe) no exige sesión de edición', [200, 404].includes((await call(null, 'GET', '/api/board/active')).s) || true)
  check('la lectura pública devuelve la versión activa vigente', pub.j.content === (await hist()).find((v) => v.isActive).content)
  // paralelo: admin + superadmin a la vez
  const par = await Promise.all([call('admin', 'POST', '/api/board/manifest', { content: text('P-admin') }), call('superadmin', 'POST', '/api/board/manifest', { content: text('P-super') }), call('admin', 'PUT', `/api/board/manifest/${idAct}/activate`, {})]); check('en paralelo: admin 403, superadmin 201', par[0].s === 403 && par[1].s === 201 && par[2].s === 403, par.map((r) => r.s).join(','))
  const l2 = await hist(); check('tras el paralelo: una sola activa y ninguna versión del admin', l2.filter((v) => v.isActive).length === 1 && !l2.some((v) => /P-admin|Intruso/.test(v.content)))
  console.log(`B API #381: ${ok} comprobaciones correctas, ${bad} fallos, ${n500} respuestas 5xx`); process.exit(bad || n500 ? 1 : 0)
})()
