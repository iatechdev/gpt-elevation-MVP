// [QA-Claude-3] PR #383 (ES-332 seguimiento): «Mi panel» (/app/dashboard) con el backend REAL de main: peticiones al cargar, al cambiar de idioma, al salir y volver, y al reintentar; datos idénticos a main.
// Uso: via qa/run.sh <build> <db> (LABEL=pr|main). Imprime líneas N383 comparables entre PR y main (diff).
const L = require('./lib3.cjs'); const { ck, info, mk, open, dbq, call, sleep, axeRun } = L
const EP = { progress: '/api/user/progress', upcoming: '/api/sessions/user/upcoming', therapist: '/api/sessions/user/my-therapist', recommendations: '/api/recommendations', plan: '/api/user/plan/me' }
const count = p => Object.fromEntries(Object.entries(EP).map(([k, u]) => [k, p.reqs.filter(r => r.m === 'GET' && r.u.split('?')[0] === u).length]))
const txt = p => p.evaluate(() => (document.querySelector('main')?.innerText || '').replace(/\s+/g, ' '))
const out = []; const say = (k, v) => { out.push(k + ' = ' + JSON.stringify(v)); console.log(`N383 ${L.LABEL} ${k} = ${JSON.stringify(v)}`) }
;(async () => {
  await L.DB.connect(); await L.launch(); const srv = await L.serve()
  const U = await mk('user', 'A-383'); for (let i = 0; i < 4; i++) await dbq(`INSERT INTO "MoodLogs"(checkin_mood,checkout_mood,date,"UserId","createdAt","updatedAt") VALUES (${2 + (i % 3)},${3 + (i % 2)},(now()::date - ${i}),$1,now(),now())`, [U.id])
  // N1 carga
  const p = await open(U, { lang: 'es', url: '/app/dashboard', wait: 3500 }); say('carga', count(p)); const t1 = await txt(p)
  // N2 idioma: botón EN del marco
  const before = JSON.stringify(count(p)); await p.locator('button, a', { hasText: /^EN$/ }).first().click().catch(() => {}); await sleep(2000); const afterLang = count(p); say('tras cambiar a EN (acumulado)', afterLang); const t2 = await txt(p)
  // N3 salir y volver
  await p.goto(L.WEB + '/app/chat', { waitUntil: 'domcontentloaded' }); await sleep(1500); const nChat = JSON.stringify(count(p)); await p.goBack(); await sleep(3000); say('tras salir y volver (acumulado de la pestaña actual)', count(p)); await p.c.close()
  // N4 reintento por lectura: primera petición 500, luego bien
  for (const [k, u] of Object.entries(EP)) {
    let n = 0; const q = await open(U, { lang: 'es', url: '/app/dashboard', wait: 3500, routes: async pg => pg.route(x => new URL(x).pathname === u, async rt => { if (rt.request().method() === 'GET' && n++ === 0) await rt.fulfill({ status: 500, json: { error: 'x' } }); else await rt.continue() }) })
    const alerts = await q.evaluate(() => [...document.querySelectorAll('main [role=alert]')].map(a => a.innerText.replace(/\s+/g, ' ').slice(0, 60))); const c0 = count(q)
    const btn = q.locator('main button', { hasText: /reintentar/i }); const nb = await btn.count(); if (nb) { await btn.first().click(); await sleep(2500) }
    const c1 = count(q); const delta = Object.fromEntries(Object.keys(EP).map(x => [x, c1[x] - c0[x]])); const left = await q.evaluate(() => document.querySelectorAll('main [role=alert]').length)
    say('fallo ' + k, { avisos: alerts.length, botones: nb, peticionesDelReintento: delta, avisosDespues: left }); await q.c.close()
  }
  // N5 contenido con datos
  const h = s => L.crypto.createHash('sha1').update(s.replace(/[0-9]{1,2}[:.][0-9]{2}/g, '#')).digest('hex').slice(0, 10); say('hash contenido ES con datos', h(t1)); say('hash contenido EN con datos', h(t2))
  // N6 axe/CLS con datos
  const ax = []; for (const lang of ['es', 'en']) for (const [w, scheme] of [[1360, 'light'], [390, 'dark']]) { const a = await open(U, { lang, w, scheme, theme: scheme, url: '/app/dashboard', wait: 3000 }); ax.push(await axeRun(a)); await a.c.close() } say('axe (4 estados)', ax.map(a => a.length))
  let seq = 0; const r = await L.clsRuns(async () => { const s = await mk('user', 'R-383-' + (seq++)); return s }, '/app/dashboard', +(process.env.RUNS || 2)); say('CLS 390 CPU×4', r.cls); say('util', r.util)
  L.fs.writeFileSync('C:/Users/Usuario/tools/qa3/out/n383-' + L.LABEL + '.txt', out.join('\n')); await L.done(); srv?.close?.(); process.exit(0)
})().catch(e => { console.error('FALLO', e); process.exit(1) })
