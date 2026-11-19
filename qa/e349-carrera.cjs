// [QA-Claude-3] PR #349 (ES-237 paso 2b). Servidor REAL local de Dev (routers reales + PostgreSQL embebido, API=127.0.0.1:8197) y builds con VITE_CAREER_SOURCE=api. Datos SINTÉTICOS, 0 IA.
// Uso: ONLY=S,U,R DIST=<build> LABEL=pr|main PLAYWRIGHT_MODULE=... AXE=... node qa/e349-carrera.cjs   (S usa solo fetch; U y R usan el navegador y L.serve)
const L = require('./lib3.cjs'); const { ck, info, sleep } = L
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null; const want = k => !ONLY || ONLY.includes(k)
const API = process.env.API8197 || 'http://127.0.0.1:8197'
const persona = async () => (await fetch(API + '/__test/persona', { method: 'POST' })).json()
const f = async (m, p, tk, b, h = {}) => { const r = await fetch(API + p, { method: m, headers: { ...(b !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(tk ? { Authorization: 'Bearer ' + tk } : {}), ...h }, ...(b !== undefined ? { body: JSON.stringify(b) } : {}) }); const tx = await r.text(); let j = null; try { j = JSON.parse(tx) } catch {} return { s: r.status, j, tx } }
const uuid = () => L.crypto.randomUUID()
const payload = (ctx, over = {}) => ({ targetMarkets: ['CO'], languages: ['es'], modalities: ['hybrid', 'remote'], acceptRegulated: 'unknown', originContextKey: ctx.origin, interestContextKeys: [ctx.interest], preferredModalities: ['remote'], ...over })
;(async () => {
  const A = await persona(), B = await persona(); const cat = await f('GET', '/api/route-catalog', A.token); info('catálogo:', cat.s, 'contextos:', cat.j?.contexts?.length, 'roles:', cat.j?.roles?.length)
  const keys = (cat.j?.contexts || []).map(c => c.contextKey); const ctx = { origin: keys.find(k => /educacion/.test(k)) || keys[0], interest: keys.find(k => /contabilidad/.test(k)) || keys[1] }
  if (want('S')) {
    // ---- S1 aislamiento ----
    const rq = uuid(); const put = await f('PUT', '/api/routes/constraints', A.token, { requestId: rq, baseVersion: 0, payload: payload(ctx) }); ck('S349-0 A guarda restricciones (201/200)', put.s === 200 || put.s === 201, String(put.s))
    const bC = await f('GET', '/api/routes/constraints', B.token); ck('S349-1 B no ve las restricciones de A', bC.s === 200 && (bC.j?.constraints === null || bC.j?.constraints?.version === 0), bC.tx.slice(0, 100))
    const aR = await f('GET', '/api/routes', A.token); info('rutas de A:', aR.s, aR.j?.status, 'rutas:', Object.values(aR.j?.routes || {}).flat?.().length ?? '?')
    const bR = await f('GET', '/api/routes', B.token); ck('S349-2 B sin restricciones: estado needs_constraints (el primer estado), sin rutas de A', bR.s === 200 && bR.j?.status === 'needs_constraints', `${bR.s} ${bR.j?.status}`)
    const slots = aR.j?.routes ? (Array.isArray(aR.j.routes) ? aR.j.routes : Object.entries(aR.j.routes).flatMap(([slot, arr]) => (Array.isArray(arr) ? arr : [arr]).map(r => ({ ...r, slot: r.slot || slot })))) : []
    const first = slots.find(r => r && r.roleKey); info('primera ruta:', JSON.stringify(first || {}).slice(0, 160))
    if (first) {
      const cr = uuid(); const body = { requestId: cr, roleKey: first.roleKey, slot: first.slot, decision: 'accepted', basisHash: aR.j.basisHash }
      const ch = await f('POST', '/api/routes/choices', A.token, body); ck('S349-3 A elige una ruta (201)', ch.s === 201 || ch.s === 200, `${ch.s} ${ch.tx.slice(0, 100)}`)
      const reps = await Promise.all(Array.from({ length: 10 }, () => f('POST', '/api/routes/choices', A.token, body))); const list = await f('GET', '/api/routes/choices', A.token)
      ck('S349-4 mismo requestId ×10 en paralelo = 1 sola elección', (list.j?.choices || []).length === 1 && reps.every(r => r.s < 500), `elecciones=${(list.j?.choices || []).length} estados=${[...new Set(reps.map(r => r.s))]}`)
      const choiceId = ch.j?.choice?.id; const bGet = await f('GET', `/api/routes/choices/${choiceId}`, B.token); ck('S349-5 B pide la elección de A por id → 404 sin datos', bGet.s === 404 && !/roleKey/.test(bGet.tx), `${bGet.s}`)
      const bChoices = await f('GET', '/api/routes/choices', B.token); ck('S349-6 la lista de B no contiene la elección de A', (bChoices.j?.choices || []).length === 0, bChoices.tx.slice(0, 80))
      const stale = await f('POST', '/api/routes/choices', A.token, { ...body, requestId: uuid(), basisHash: 'x'.repeat(64) }); ck('S349-7 basisHash caducado → 409/4xx (sin 5xx)', stale.s >= 400 && stale.s < 500, `${stale.s} ${stale.tx.slice(0, 80)}`)
      const other = await f('POST', '/api/routes/choices', A.token, { ...body, decision: 'rejected' }); ck('S349-8 mismo requestId con OTRO contenido → 409', other.s === 409, String(other.s))
      // experimentos
      const prop = await f('POST', '/api/experiments/proposals', A.token, { choiceId, taskIndex: 0, minutes: 20 }); info('propuesta:', prop.s, prop.tx.slice(0, 160))
      if (prop.s === 200 || prop.s === 201) {
        const erq = uuid(); const eb = { requestId: erq, proposal: prop.j.proposal, token: prop.j.token }; const e1 = await f('POST', '/api/experiments', A.token, eb); ck('S349-9 A crea un experimento', e1.s === 201 || e1.s === 200, `${e1.s} ${e1.tx.slice(0, 100)}`)
        const dup = await Promise.all(Array.from({ length: 10 }, () => f('POST', '/api/experiments', A.token, eb))); const el = await f('GET', '/api/experiments', A.token); ck('S349-10 requestId repetido ×10 = 1 experimento', (el.j?.experiments || []).length === 1 && dup.every(r => r.s < 500), `n=${(el.j?.experiments || []).length}`)
        const id = e1.j?.experimentId; const bExp = await f('GET', `/api/experiments/${id}`, B.token); ck('S349-11 B pide el experimento de A → 404 sin datos', bExp.s === 404, String(bExp.s)); const bVer = await f('POST', `/api/experiments/${id}/versions`, B.token, { requestId: uuid(), expectedVersion: 1, change: { action: 'start' } }); ck('S349-12 B no puede cambiar el experimento de A (404/403)', [403, 404].includes(bVer.s), String(bVer.s))
        const stale2 = await f('POST', `/api/experiments/${id}/versions`, A.token, { requestId: uuid(), expectedVersion: 99, change: { action: 'start' } }); ck('S349-13 expectedVersion viejo → 409', stale2.s === 409, `${stale2.s} ${stale2.tx.slice(0, 80)}`)
        const ok = await f('POST', `/api/experiments/${id}/versions`, A.token, { requestId: uuid(), expectedVersion: 1, change: { action: 'start' } }); ck('S349-14 iniciar con la versión correcta', ok.s === 201 || ok.s === 200, `${ok.s} ${ok.tx.slice(0, 100)}`)
        const bad = await f('POST', `/api/experiments/${id}/versions`, A.token, { requestId: uuid(), expectedVersion: 2, change: { action: 'start' } }); ck('S349-15 transición inválida (iniciar dos veces) → 409/4xx sin 5xx', bad.s >= 400 && bad.s < 500, `${bad.s} ${bad.tx.slice(0, 80)}`)
        const forged = await f('POST', '/api/experiments', B.token, { ...eb, requestId: uuid() }); ck('S349-16 B no puede usar la propuesta/token firmada de A', forged.s >= 400 && forged.s < 500, `${forged.s}`)
      }
    }
    // hostiles y roles
    for (const [nm, p] of [['roleKey con barras', '/api/route-catalog/roles/..%2F..%2Fetc'], ['roleKey con SQL', "/api/route-catalog/roles/x'%3BDROP%20TABLE"], ['id de elección «abc»', '/api/routes/choices/abc'], ['id de experimento 99999999999', '/api/experiments/99999999999'], ['cursor hostil', "/api/experiments?after=1'--"], ['cursor negativo', '/api/routes/choices?after=-5']]) { const r = await f('GET', p, A.token); ck(`S349-20 ${nm}: sin 5xx`, r.s < 500, String(r.s)) }
    for (const [nm, tk] of [['sin sesión', null], ['token falso', 'x.y.z']]) for (const p of ['/api/routes', '/api/routes/constraints', '/api/experiments', '/api/route-catalog']) { const r = await f('GET', p, tk); ck(`S349-21 ${nm} GET ${p}: 401/403`, r.s === 401 || r.s === 403, String(r.s)) }
    const uid = await f('PUT', '/api/routes/constraints', B.token, { requestId: uuid(), baseVersion: 0, userId: A.userId, payload: payload(ctx) }); ck('S349-22 userId de otra persona en el cuerpo: 400 o ignorado (nunca escribe sobre A)', uid.s === 400 || (await f('GET', '/api/routes/constraints', A.token)).j?.constraints?.version === 1, String(uid.s))
    const big = await f('PUT', '/api/routes/constraints', B.token, { requestId: uuid(), baseVersion: 0, payload: payload(ctx, { originContextKey: '<script>alert(1)</script>'.repeat(500) }) }); ck('S349-23 texto hostil/enorme: 4xx sin 5xx', big.s >= 400 && big.s < 500, String(big.s))
    // ---- S2 conflicto de baseVersion ----
    const C = await persona(); const p1 = await f('PUT', '/api/routes/constraints', C.token, { requestId: uuid(), baseVersion: 0, payload: payload(ctx) }); const [w1, w2] = await Promise.all([f('PUT', '/api/routes/constraints', C.token, { requestId: uuid(), baseVersion: 1, payload: payload(ctx, { preferredModalities: ['hybrid'] }) }), f('PUT', '/api/routes/constraints', C.token, { requestId: uuid(), baseVersion: 1, payload: payload(ctx, { preferredModalities: ['remote'], languages: ['es', 'en'] }) })])
    ck('S349-30 dos PUT con el mismo baseVersion: uno gana (200/201) y el otro 409', [w1.s, w2.s].filter(s => s === 409).length === 1 && [w1.s, w2.s].filter(s => s < 300).length === 1, `${p1.s} ${w1.s}/${w2.s}`)
    const rr = uuid(); const pp = { requestId: rr, baseVersion: 2, payload: payload(ctx, { languages: ['es', 'en'], preferredModalities: ['hybrid'] }) }; const x1 = await f('PUT', '/api/routes/constraints', C.token, pp), x2 = await f('PUT', '/api/routes/constraints', C.token, pp); ck('S349-31 reintento con el MISMO requestId (aunque el servidor ya lo guardó) no crea otra versión', (x1.s < 300) && (x2.s < 300 || x2.s === 409) && (await f('GET', '/api/routes/constraints', C.token)).j?.constraints?.version === 3, `${x1.s}/${x2.s}`)
  }
  if (want('U')) { // UI contra el servidor real: respuesta perdida y reintento con el MISMO requestId
    await L.launch(); const srv = await L.serve(); const U = await persona(); const me = { token: U.token, name: 'x', role: 'user' }; const sawIds = []
    const p = await L.open(me, { lang: 'es', url: '/app/next-step', routes: async pg => { let n = 0; await pg.route(u => new URL(u).pathname === '/api/routes/constraints', async rt => { if (rt.request().method() === 'PUT') { const b = JSON.parse(rt.request().postData() || '{}'); sawIds.push(b.requestId); if (n++ === 0) { await rt.fetch(); await rt.abort('failed'); return } } await rt.continue() }) } })
    info('pantalla inicial:', (await p.evaluate(() => (document.querySelector('main')?.innerText || '').replace(/\s+/g, ' ').slice(0, 200))))
    await p.getByLabel('Colombia', { exact: true }).first().check(); await p.getByLabel('Español', { exact: true }).first().check(); await p.getByLabel('Remota', { exact: true }).first().check(); await p.getByRole('group', { name: /Contextos de interés/ }).locator('input[type=checkbox]').first().check()
    await p.getByRole('button', { name: /Guardar restricciones/ }).click(); await sleep(2500); const t1 = await p.evaluate(() => (document.querySelector('main')?.innerText || '').replace(/\s+/g, ' ')); info('tras respuesta perdida:', t1.slice(0, 300))
    ck('U349-1 respuesta perdida al guardar restricciones: la pantalla no afirma «Guardado» y ofrece Recuperar/Reintentar', !/Guardado/.test(t1) && /(recuperar|reintentar|comprob|no estoy)/i.test(t1), t1.slice(0, 160))
    const rec = p.getByRole('button', { name: /Recuperar el estado guardado/ }); const putsBefore = sawIds.length; if (await rec.count()) { await rec.first().click(); await sleep(2500) } const after = await f('GET', '/api/routes/constraints', U.token)
    ck('U349-2 «Recuperar» relee el estado (GET) y NO reenvía la escritura: 1 solo PUT, UNA versión guardada, y la pantalla ya no avisa de cambios sin guardar', putsBefore === 1 && sawIds.length === 1 && after.j?.constraints?.version === 1 && !/Cambios sin guardar/.test(await p.evaluate(() => document.querySelector('main')?.innerText || '')), `puts=${sawIds.length} versión=${after.j?.constraints?.version}`)
    const t2 = await p.evaluate(() => (document.querySelector('main')?.innerText || '').replace(/\s+/g, ' ')); ck('U349-3 tras el reintento se ven rutas reales del servidor (sin ejemplos del simulador)', !(await p.locator('a[href*="example.org/synthetic"]').count()), t2.slice(0, 120))
    ck('U349-4 condición de Infra: ninguna ruta sin evidencia confirmada dice «Sustentada por tu evidencia registrada»; sí «Aún sin evidencia»', !/Sustentada por tu evidencia registrada/.test(t2) && /Aún sin evidencia/.test(t2), (t2.match(/.{0,40}(Sustentada|Aún sin evidencia).{0,40}/) || [''])[0])
    await p.c.close(); srv?.close?.()
  }
  if (want('R')) {
    await L.launch(); const srv = await L.serve(); const n = +(process.env.RUNS || 2)
    for (const [nm, withC] of [['sin restricciones', false], ['con restricciones', true]]) { let k = 0; const r = await L.clsRuns(async () => { const u = await persona(); if (withC) await f('PUT', '/api/routes/constraints', u.token, { requestId: uuid(), baseVersion: 0, payload: payload(ctx) }); return { token: u.token, role: 'user' } }, '/app/next-step', n); console.log(`R349 ${L.LABEL} ${nm} cls=${JSON.stringify(r.cls)} util=${JSON.stringify(r.util)}`) }
    srv?.close?.()
  }
  await L.done(); process.exit(0)
})().catch(e => { console.error('FALLO', e); process.exit(1) })
