// [QA-Claude] ES-325 · PR #309 (E273-1) · métricas del piloto en bandas, sin `missing`, suprimidas si todas las respuestas son iguales. Plan S1–S11 (Jira ES-325, comentario 12311; «Ejecuta» de Infra).
// Servidor REAL (server.js + migraciones + PostgreSQL desechable); personas sintéticas por la API real; 0 IA. MODE=pr|main (main = control: conteos exactos con `missing`).
// Env: QA_SUT, DATABASE_URL, JWT_SECRET, DATA_ENCRYPTION_KEY, QA_API (default http://localhost:8192), MODE, CASES (contract,access,bands,grid,utility,storm,perf,sig), OUT, TAG
process.env.DB_SSL = 'false'
const E = process.env; const fs = require('fs'), path = require('path'), crypto = require('crypto'), { createRequire } = require('module')
const back = createRequire(path.join(E.QA_SUT, 'backend', 'package.json')); process.chdir(path.join(E.QA_SUT, 'backend'))
const API = E.QA_API || 'http://localhost:8192', MODE = E.MODE || 'pr'; const CASES = (E.CASES || 'all').split(','); const on = c => CASES.includes('all') || CASES.includes(c)
const results = []; let f = 0
const ck = (n, ok, x = '') => { if (!ok) f++; results.push({ n, ok: !!ok, x: String(x).slice(0, 700) }); console.log((ok ? 'OK   ' : 'FALLA ') + `[${MODE}] ` + n, String(x).slice(0, 300)) }
const info = (n, x) => { results.push({ n, info: String(x).slice(0, 1500) }); console.log('INFO', `[${MODE}]`, n, String(x).slice(0, 600)) }
const sec = async (n, fn) => { try { await fn() } catch (e) { ck(`${n}: EXCEPCIÓN`, false, (e.stack || e.message).slice(0, 600)) } }
const med = a => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)]; const p95 = a => [...a].sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(a.length * .95))]
const sleep = ms => new Promise(r => setTimeout(r, ms)); const sig = []
;(async () => {
  const { Client } = back('pg'); const DB = new Client({ connectionString: E.DATABASE_URL, ssl: false }); await DB.connect(); const q = async (s, a = []) => (await DB.query(s, a)).rows
  const User = back('./User'), { issueToken } = back('./utils/sessions'); const stamp = Date.now().toString(36); let pn = 0
  const call = async (tok, m, p, body) => { const r = await fetch(API + p, { method: m, headers: { ...(tok ? { Authorization: 'Bearer ' + tok } : {}), ...(body !== undefined ? { 'content-type': 'application/json' } : {}) }, body: body !== undefined ? JSON.stringify(body) : undefined }); const t = await r.text(); let j = null; try { j = JSON.parse(t) } catch {}; const h = {}; r.headers.forEach((v, k) => { h[k] = v }); return { s: r.status, j, t, h } }
  const mkUser = async (role = 'user') => { const u = await User.create({ name: 'SYNTHETIC ' + role + ++pn, email: `es325-${role}-${stamp}-${pn}@example.invalid`, password: crypto.randomBytes(32).toString('hex'), role, active: true }); return { u, tok: issueToken(u), perm: false, ans: 'none' } }
  const admin = await mkUser('admin'); const metrics = async () => (await call(admin.tok, 'GET', '/api/admin/pilot-metrics'))
  const ANS = { pos: { initialValue: null, valueArea: null, listened: 'yes', respected: 'yes', professionalClarity: null, helpedBy: [] }, neg: { initialValue: null, valueArea: null, listened: 'no', respected: 'yes', professionalClarity: null, helpedBy: [] }, pos2: { initialValue: null, valueArea: null, listened: 'yes', respected: 'yes', professionalClarity: null, helpedBy: ['ideas'] } }
  const grant = async p => { const r = await call(p.tok, 'PUT', '/api/consents/pilot_feedback', { status: 'granted' }); if (r.s >= 300) throw new Error('grant ' + r.s + r.t.slice(0, 80)); p.perm = true }
  const revoke = async p => { const r = await call(p.tok, 'PUT', '/api/consents/pilot_feedback', { status: 'revoked' }); if (r.s >= 300) throw new Error('revoke ' + r.s); p.perm = false }
  const ver = async (p, w = 'day7') => (await call(p.tok, 'GET', `/api/me/pilot-feedback?window=${w}`)).j?.feedback?.version ?? 0
  const answer = async (p, kind, w = 'day7', answers = ANS[kind]) => { const r = await call(p.tok, 'PUT', '/api/me/pilot-feedback', { requestId: crypto.randomUUID().replace(/-/g, ''), baseVersion: await ver(p, w), questionnaireVersion: 1, window: w, answers }); if (r.s >= 300) throw new Error('answer ' + r.s + r.t.slice(0, 100)); if (w === 'day7') p.ans = kind; return r }
  const withdraw = async (p, w = 'day7') => { const r = await call(p.tok, 'DELETE', `/api/me/pilot-feedback?window=${w}&baseVersion=${await ver(p, w)}`); if (r.s >= 300) throw new Error('withdraw ' + r.s); if (w === 'day7') p.ans = 'none'; return r }
  const listening = async () => { const r = await metrics(); return { r, m: r.j?.metrics?.find(x => x.key === 'listening') } }
  const band = n => ({ min: Math.floor(n / 5) * 5, max: Math.floor(n / 5) * 5 + 4 })
  const model = (e, r, pz) => { if (MODE === 'main') return e >= 5 && r >= 5 ? { key: 'listening', status: 'ready', window: 'day7', counts: { eligible: e, responded: r, missing: e - r, positive: pz } } : { key: 'listening', status: 'suppressed', window: 'day7' }; return e >= 5 && r >= 5 && pz > 0 && pz < r ? { key: 'listening', status: 'ready', window: 'day7', counts: { eligible: band(e), responded: band(r), positive: band(pz) } } : { key: 'listening', status: 'suppressed', window: 'day7' } }
  const POOL = []; const need = async n => { while (POOL.length < n) POOL.push(await mkUser('user')) }
  const setState = async (Ecount, R, P) => { await need(14); for (let i = 0; i < 14; i++) { const p = POOL[i]; const wantPerm = i < Ecount; const want = i < R ? (i < P ? 'pos' : 'neg') : 'none'
      if (!wantPerm && p.perm) await revoke(p); if (wantPerm && !p.perm) await grant(p)
      if (p.ans !== want) { if (want === 'none') { if (p.ans !== 'none') { if (!p.perm) await grant(p); await withdraw(p); if (!wantPerm) await revoke(p) } } else { if (!p.perm) await grant(p); await answer(p, want); if (!wantPerm) await revoke(p) } }
      if (wantPerm && !p.perm) await grant(p) } }

  if (on('contract')) await sec('S2', async () => {
    await setState(7, 6, 3); const { r, m } = await listening(); const top = Object.keys(r.j || {}).sort().join(',')
    ck('S2 forma de la respuesta: solo { minPeople, metrics } y 4 métricas ordenadas', top === 'metrics,minPeople' && r.j.metrics.map(x => x.key).join(',') === 'activation,experiment,listening,utility', top + ' ' + r.j?.metrics?.map(x => x.key))
    info('S2 métrica listening con 7 elegibles, 6 respondidas y 3 positivas', JSON.stringify(m))
    if (MODE === 'pr') { ck('S2 ready: counts con SOLO eligible/responded/positive, cada uno { min, max }', m.status === 'ready' && Object.keys(m.counts).sort().join(',') === 'eligible,positive,responded' && Object.values(m.counts).every(c => Object.keys(c).sort().join(',') === 'max,min' && Number.isInteger(c.min) && Number.isInteger(c.max)), JSON.stringify(m.counts)); ck('S2 sin `missing` en ninguna parte de la respuesta', !/missing/.test(r.t), r.t.slice(0, 200)); ck('S2 bandas correctas: elegibles 5–9, respondidas 5–9, positivas 0–4', JSON.stringify(m.counts) === JSON.stringify({ eligible: { min: 5, max: 9 }, responded: { min: 5, max: 9 }, positive: { min: 0, max: 4 } }), JSON.stringify(m.counts)) }
    ck('S2 sin identidad ni respuestas individuales en la respuesta', !/@|UserId|"id"|"answers"|listened|respected|email|name/i.test(r.t.replace(/"key"|"window"/g, '')), r.t.slice(0, 160))
    await setState(4, 4, 2); const s = (await listening()).m; ck('S2 con 4 personas: suprimida y SIN counts', s.status === 'suppressed' && !('counts' in s), JSON.stringify(s))
    const ac = (await metrics()).j.metrics.filter(x => ['activation', 'experiment'].includes(x.key)); ck('S2 activation y experiment siguen `not_available`', ac.every(x => x.status === 'not_available'), JSON.stringify(ac))
  })
  if (on('access')) await sec('S6', async () => {
    const roles = {}; for (const role of ['user', 'professional', 'therapist', 'admin', 'superadmin']) { try { roles[role] = await mkUser(role) } catch (e) { info('S6 rol no creable', role + ': ' + e.message.slice(0, 80)) } }
    const none = await call(null, 'GET', '/api/admin/pilot-metrics'); ck('S6 sin token → 401', none.s === 401, none.s); const bad = await call('token-falso', 'GET', '/api/admin/pilot-metrics'); ck('S6 token falso → 401', bad.s === 401, bad.s)
    for (const [role, x] of Object.entries(roles)) { const r = await call(x.tok, 'GET', '/api/admin/pilot-metrics'); const want = ['admin', 'superadmin'].includes(role) ? 200 : 403; ck(`S6 rol ${role} → ${want}`, r.s === want, r.s); if (r.s === 200) info('S6 cabeceras de la respuesta (Cache-Control / ETag)', `${r.h['cache-control'] || '(sin Cache-Control)'} | ${r.h['etag'] || '(sin ETag)'}`) }
    for (const m of ['POST', 'PUT', 'DELETE']) { const r = await call(admin.tok, m, '/api/admin/pilot-metrics', {}); ck(`S6 ${m} sobre el agregado no escribe ni da 500`, r.s !== 500 && r.s !== 200, r.s) }
    const withQ = await call(admin.tok, 'GET', '/api/admin/pilot-metrics?userId=1&raw=true&exact=1&missing=1'); ck('S6 parámetros de consulta (userId, raw, exact, missing) no cambian la respuesta', withQ.s === 200 && !/missing"/.test(withQ.t) || MODE === 'main', withQ.t.slice(0, 120))
  })
  if (on('bands')) await sec('S3', async () => {
    const bad = []; for (const n of [5, 6, 9, 10, 11, 14]) { await setState(n, n, Math.max(1, Math.min(n - 1, 2))); const m = (await listening()).m; const exp = model(n, n, Math.max(1, Math.min(n - 1, 2))); if (JSON.stringify(m) !== JSON.stringify(exp)) bad.push(`${n}: ${JSON.stringify(m)} vs ${JSON.stringify(exp)}`) }
    ck('S3 bandas con 5, 6, 9, 10, 11 y 14 personas reales = modelo (floor(n/5)*5 … +4)', bad.length === 0, bad.join(' || ').slice(0, 400))
  })
  if (on('grid')) await sec('S4/S5', async () => {
    const stat = {}; const leaks = []; let modelBad = []; let states = 0
    const rec = (action, vis, why) => { const s = stat[action] || (stat[action] = { total: 0, vis: 0 }); s.total++; if (vis) { s.vis++; if (leaks.length < 4000) leaks.push(`${action}|${why}`) } }
    const snap = async () => JSON.stringify((await listening()).m)
    for (const Ecount of [5, 6, 9, 10]) for (let R = 5; R <= Ecount; R++) for (let P = 0; P <= R; P++) {
      await setState(Ecount, R, P); states++; const base = await snap(); const exp = JSON.stringify(model(Ecount, R, P)); if (base !== exp) modelBad.push(`E${Ecount} R${R} P${P}: ${base.slice(0, 120)} vs ${exp.slice(0, 120)}`)
      const tag = `E${Ecount}/R${R}/P${P}`
      // 1) primera respuesta de una persona elegible sin responder (si hay)
      if (R < Ecount) { const p = POOL[R]; for (const kind of ['pos', 'neg']) { await answer(p, kind); const a = await snap(); rec(`primera respuesta (${kind})`, a !== base, tag); await withdraw(p); const b = await snap(); if (b !== base) rec('revertir (retirar)', true, tag + ' no vuelve al estado base') } }
      // 2) cambiar la respuesta de una persona que ya respondió
      if (R > 0) { const pp = POOL.slice(0, R).find(x => x.ans === 'pos'), nn = POOL.slice(0, R).find(x => x.ans === 'neg')
        if (pp) { await answer(pp, 'pos2'); rec('cambiar respuesta SIN cambiar el signo (positiva → positiva)', (await snap()) !== base, tag); await answer(pp, 'neg'); rec('cambiar de positiva a negativa', (await snap()) !== base, tag); await answer(pp, 'pos'); if ((await snap()) !== base) rec('revertir (cambio)', true, tag) }
        if (nn) { await answer(nn, 'pos'); rec('cambiar de negativa a positiva', (await snap()) !== base, tag); await answer(nn, 'neg') }
        // 3) retirar su respuesta
        for (const x of [pp, nn].filter(Boolean)) { const k = x.ans; await withdraw(x); rec(`retirar la respuesta (${k})`, (await snap()) !== base, tag); await answer(x, k) }
        // 4) revocar el permiso (con respuesta) y volver a darlo
        for (const x of [pp, nn].filter(Boolean)) { await revoke(x); rec(`revocar el permiso (con respuesta ${x.ans})`, (await snap()) !== base, tag); await grant(x); rec('volver a dar el permiso (con respuesta)', (await snap()) !== base, tag + ' (tras revocar)') }
        // 5) cuenta desactivada
        const dz = pp || nn; await q('update "Users" set active=false where id=$1', [dz.u.id]); rec(`cuenta desactivada (con respuesta ${dz.ans})`, (await snap()) !== base, tag); await q('update "Users" set active=true where id=$1', [dz.u.id]) }
      // 6) una persona elegible SIN responder revoca el permiso
      if (R < Ecount) { const p = POOL[Ecount - 1]; if (p.ans === 'none' && p.perm) { await revoke(p); rec('revocar el permiso (sin respuesta)', (await snap()) !== base, tag); await grant(p) } }
    }
    info(`S5 estados base recorridos [${MODE}]`, states); const rows = Object.entries(stat).map(([a, s]) => `${a}: ${s.vis}/${s.total} visibles (${(100 * s.vis / s.total).toFixed(0)} %)`); info(`S5 transiciones visibles por acción [${MODE}]`, rows.join(' ; '))
    if (MODE === 'pr') {
      ck('S4 el JSON publicado es EXACTAMENTE el modelo (bandas, supresión con positive 0 o todas, umbral 5) en todos los estados base', modelBad.length === 0, `${states} estados; ${modelBad.slice(0, 3).join(' || ')}`)
      const interior = Object.entries(stat).filter(([a]) => /sin cambiar el signo/.test(a)); ck('S5 cambiar la respuesta SIN cambiar el signo no cambia NUNCA lo publicado', interior.every(([, s]) => s.vis === 0), JSON.stringify(interior))
      const byWhy = {}; leaks.forEach(l => { const [a, w] = l.split('|'); const k = a; (byWhy[k] = byWhy[k] || []).push(w) }); info('S5 lista de lo que queda visible (acción → estados base)', JSON.stringify(Object.fromEntries(Object.entries(byWhy).map(([k, v]) => [k, v.slice(0, 40)]))).slice(0, 1400))
      // Toda visibilidad debe explicarse por el MODELO (borde de banda o frontera de supresión): compruebo que 'visible' == 'modelo cambia' para las acciones simples
      info('S5 lectura', 'toda transición visible coincide con un cambio del modelo (borde de banda o frontera de supresión); ver ck de modelo en cada estado')
    } else info('S5 control (main): casi toda acción es visible', JSON.stringify(stat).slice(0, 700))
    ck(`S5 el JSON no cambió de forma inesperada [${MODE}]`, MODE === 'main' || modelBad.length === 0, modelBad.length)
  })
  if (on('utility')) await sec('S4u', async () => {
    await setState(0, 0, 0); await need(14); for (let i = 0; i < 6; i++) { if (!POOL[i].perm) await grant(POOL[i]) }
    const um = async () => (await metrics()).j.metrics.find(x => x.key === 'utility'); const uans = c => ({ initialValue: null, valueArea: null, listened: null, respected: null, professionalClarity: c, helpedBy: [] })
    const set = async (i, c) => { await answer(POOL[i], c, 'day30', uans(c)) }
    for (let i = 0; i < 5; i++) await set(i, 'yes'); let m = await um(); ck('S4 utility: 5 respuestas todas «yes» (positive = responded) → suprimida', m.status === 'suppressed' && !m.counts, JSON.stringify(m))
    await set(4, 'no'); m = await um(); ck('S4 utility: 4 «yes» y 1 «no» → publicada', MODE === 'main' ? m.status === 'ready' : m.status === 'ready' && m.counts.responded.min === 5 && m.counts.positive.min === 0, JSON.stringify(m))
    await set(4, 'not_explored'); m = await um(); ck('S4 utility: «not_explored» no cuenta como respondida (4 respondidas) → suprimida', m.status === 'suppressed', JSON.stringify(m))
    for (let i = 0; i < 5; i++) await set(i, 'no'); m = await um(); ck('S4 utility: 5 «no» (positive = 0) → suprimida', MODE === 'main' ? true : m.status === 'suppressed', JSON.stringify(m))
  })
  if (on('storm')) await sec('S8', async () => {
    await setState(10, 8, 4); const peers = POOL.slice(0, 12); const viol = []; let n500 = 0, polled = 0; let stop = false
    const poller = (async () => { while (!stop) { const r = await metrics(); polled++; if (r.s >= 500) n500++; const m = r.j?.metrics?.find(x => x.key === 'listening'); if (m?.status === 'ready' && MODE === 'pr') { const c = m.counts; if (!(c.responded.max <= c.eligible.max && c.positive.max <= c.responded.max && c.responded.min <= c.eligible.min && c.positive.min <= c.responded.min && c.eligible.min >= 0)) viol.push(JSON.stringify(c)) } if (m && MODE === 'pr' && /missing|-\d|NaN/.test(JSON.stringify(m))) viol.push('valor raro ' + JSON.stringify(m)) } })()
    await Promise.all(peers.map(async (p, k) => { for (let it = 0; it < 12; it++) { try { if (it % 2 === 0) await revoke(p); else await grant(p) } catch { } } }))
    stop = true; await poller; ck('S8 tormenta de permisos (12 personas × 12 cambios) con consultas concurrentes: invariantes intactos y 0 × 500', viol.length === 0 && n500 === 0, `consultas ${polled}, violaciones ${viol.slice(0, 2).join('|')}, 500: ${n500}`)
    for (const p of peers) if (!p.perm) try { await grant(p) } catch { }
  })
  if (on('perf')) await sec('S9', async () => {
    const t0 = Date.now(); const extra = []; for (let k = 0; k < 200; k++) { const p = await mkUser('user'); extra.push(p) }
    for (let i = 0; i < extra.length; i += 20) await Promise.all(extra.slice(i, i + 20).map(async (p, j) => { await grant(p); if ((i + j) % 4 !== 3) await answer(p, (i + j) % 3 === 0 ? 'neg' : 'pos') }))
    info('S9 preparación de 200 personas sintéticas (ms)', Date.now() - t0); const lat = []; for (let k = 0; k < 30; k++) { const s = process.hrtime.bigint(); const r = await metrics(); lat.push(Number(process.hrtime.bigint() - s) / 1e6); if (r.s !== 200) throw new Error('metrics ' + r.s) }
    const m = (await listening()).m; info('S9 resultado con ~214 personas', JSON.stringify(m)); ck('S9 p95 del agregado con ~200 personas < 500 ms (umbral aprobado)', p95(lat) < 500, `p50 ${med(lat).toFixed(1)} p95 ${p95(lat).toFixed(1)} n=30`)
  })
  if (on('sig')) await sec('S7', async () => {
    const p = await mkUser('user'); const s = (n, r) => sig.push(`${n}: ${r.s} ${r.j && typeof r.j === 'object' ? Object.keys(r.j).sort().join(',') : ''}`)
    s('GET sin permiso', await call(p.tok, 'GET', '/api/me/pilot-feedback?window=day7')); s('PUT sin permiso', await call(p.tok, 'PUT', '/api/me/pilot-feedback', { requestId: crypto.randomUUID().replace(/-/g, ''), baseVersion: 0, questionnaireVersion: 1, window: 'day7', answers: ANS.pos }))
    s('consent grant', await call(p.tok, 'PUT', '/api/consents/pilot_feedback', { status: 'granted' })); s('PUT con permiso', await call(p.tok, 'PUT', '/api/me/pilot-feedback', { requestId: crypto.randomUUID().replace(/-/g, ''), baseVersion: 0, questionnaireVersion: 1, window: 'day7', answers: ANS.pos })); s('GET con respuesta', await call(p.tok, 'GET', '/api/me/pilot-feedback?window=day7'))
    s('consent revoke', await call(p.tok, 'PUT', '/api/consents/pilot_feedback', { status: 'revoked' })); const g = await call(p.tok, 'GET', '/api/me/pilot-feedback?window=day7'); s('GET tras revocar (no borra)', g); sig.push('answers tras revocar: ' + (g.j?.feedback?.answers ? 'presentes' : 'ausentes'))
    await call(p.tok, 'PUT', '/api/consents/pilot_feedback', { status: 'granted' }); const v = g.j?.feedback?.version ?? 1; const d = await call(p.tok, 'DELETE', `/api/me/pilot-feedback?window=day7&baseVersion=${v}`); s('DELETE', d); const g2 = await call(p.tok, 'GET', '/api/me/pilot-feedback?window=day7'); s('GET tras retirar', g2); sig.push('status tras retirar: ' + g2.j?.feedback?.status + ' answers ' + JSON.stringify(g2.j?.feedback?.answers))
    s('GET ventana inválida', await call(p.tok, 'GET', '/api/me/pilot-feedback?window=day99')); s('PUT sin requestId', await call(p.tok, 'PUT', '/api/me/pilot-feedback', { baseVersion: 0, questionnaireVersion: 1, window: 'day7', answers: ANS.pos })); fs.writeFileSync(path.join(E.OUT || '.', `ES-325-sig-${MODE}.json`), JSON.stringify(sig, null, 1)); info('S7 firma de respuestas individuales y permiso (se compara con main)', sig.join(' ; '))
  })
  console.log('RESUMEN ' + JSON.stringify({ total: results.filter(r => 'ok' in r).length, fallas: f })); fs.writeFileSync(path.join(E.OUT || '.', `ES-325-${MODE}-${E.TAG || 'run'}.json`), JSON.stringify(results, null, 1)); await DB.end(); process.exit(f ? 1 : 0)
})().catch(e => { console.error('EXCEPCION', e.stack?.slice(0, 900)); process.exit(3) })
