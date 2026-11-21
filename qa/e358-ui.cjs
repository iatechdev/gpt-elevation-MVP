// [QA-Claude-3] PR #358 (ES-240) en navegador: /app/my-therapist con el backend REAL del PR (o main de control). Via qa/run.sh ONLY=F1,F2,A1,R
const L = require('./lib3.cjs'); const { ck, info, dbq, mk, open, sleep, axeRun } = L
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null; const want = k => !ONLY || ONLY.includes(k)
const URLX = '/app/my-therapist'; const PR = L.LABEL === 'pr'
const txt = p => p.evaluate(() => (document.querySelector('main')?.innerText || '').replace(/\s+/g, ' '))
const seed = async () => {
  const A = await mk('user', 'A-358UI'), C = await mk('user', 'C-358UI'), P1 = await mk('therapist', 'Prof-358UI'); await dbq('UPDATE "Users" SET "therapistId"=$1 WHERE id=$2', [P1.id, A.id])
  try { await dbq(`INSERT INTO "TherapistProfiles"("UserId",specialties,approach,languages,bio,"createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,now(),now())`, [P1.id, 'Ansiedad sintética', 'Enfoque sintético', 'es,en', 'Bio sintética']) } catch {}
  for (let i = 0; i < 2; i++) await dbq(`INSERT INTO "TherapySessions"("patientId","therapistId","scheduledAt",status,duration,"meetingUrl","createdAt","updatedAt") VALUES ($1,$2,$3,'scheduled',50,'https://meet.example.test/x',now(),now())`, [A.id, P1.id, new Date(Date.UTC(2031, 0, 10 + i, 15)).toISOString()])
  for (let i = 0; i < 2; i++) await dbq(`INSERT INTO "TherapySessions"("patientId","therapistId","scheduledAt",status,duration,"patientMoodAfter","createdAt","updatedAt") VALUES ($1,$2,$3,'completed',50,$4,now(),now())`, [A.id, P1.id, new Date(Date.UTC(2025, 5, 1 + i, 15)).toISOString(), 3 + i])
  return { A, C, P1 }
}
const failRoute = (which, times = 1) => async pg => { let n = 0; await pg.route(u => new URL(u).pathname === '/api/sessions/user/my-therapist/' + which, async rt => { if (n++ < times) await rt.fulfill({ status: 500, json: { error: 'x' } }); else await rt.continue() }) }
;(async () => {
  await L.DB.connect(); await L.launch(); const srv = await L.serve(); const { A, C } = await seed()
  if (want('F1')) {
    const p = await open(A, { lang: 'es', url: URLX }); const t = await txt(p); info('A con profesional:', t.slice(0, 300)); ck('F358-1 con profesional: perfil, próximas y anteriores visibles; 1 h1; sin errores', /bio sint/i.test(t) && /próximas sesiones/i.test(t) && /sesiones anteriores/i.test(t) && (await p.evaluate(() => document.querySelectorAll('h1').length)) === 1 && p.errs.length === 0, t.slice(0, 120))
    ck('F358-2 dos peticiones separadas (profile y sessions) y ninguna a la lectura completa', PR ? p.reqs.some(r => /my-therapist\/profile/.test(r.u)) && p.reqs.some(r => /my-therapist\/sessions/.test(r.u)) && !p.reqs.some(r => /my-therapist$/.test(r.u)) : p.reqs.some(r => /my-therapist$/.test(r.u)), p.reqs.filter(r => /my-therapist/.test(r.u)).map(r => r.u).join(','))
    const dom = await p.evaluate(() => document.body.innerText); ck('F358-3 sin fuga en el DOM: ni nota privada, grabación ni motivo', !/SENTINELA|recordingUrl|therapistNote/i.test(dom), ''); await p.c.close()
    const pc = await open(C, { lang: 'es', url: URLX }); const tc = await txt(pc); ck('F358-4 sin profesional: estado «Aún no tienes un profesional asignado» y «Buscar mi profesional»', /aún no tienes un profesional/i.test(tc) && /buscar mi profesional/i.test(tc), tc.slice(0, 160)); await pc.c.close()
    const pe = await open(A, { lang: 'en', url: URLX }); const te = await txt(pe); ck('F358-5 EN: textos en inglés (Upcoming sessions / Past sessions)', /upcoming sessions/i.test(te) && /past sessions/i.test(te), te.slice(0, 120)); await pe.c.close()
  }
  if (want('F2') && PR) { // errores por sección
    for (const [lang, perf, sesf] of [['es', 'No pudimos cargar la información de tu profesional', 'No pudimos cargar tus sesiones'], ['en', 'We could not load your professional', 'We could not load your sessions']]) {
      const p = await open(A, { lang, url: URLX, routes: failRoute('profile') }); const t = await txt(p); const r0 = p.reqs.length
      ck(`F358-10 ${lang}: falla /profile: error del perfil con «Reintentar»; las sesiones SÍ se ven; el error de sesiones no aparece`, t.includes(perf) && !t.includes(sesf) && /(próximas|upcoming) sessions|próximas sesiones/i.test(t) && (await p.locator('main button', { hasText: /reintentar|try again/i }).count()) === 1, t.slice(0, 200))
      await p.locator('main button', { hasText: /reintentar|try again/i }).first().click(); await sleep(1500); const t2 = await txt(p); const after = p.reqs.slice(r0).filter(r => /my-therapist/.test(r.u)).map(r => r.u)
      ck(`F358-11 ${lang}: «Reintentar» pide SOLO el perfil (1 petición a /profile, 0 a /sessions) y lo muestra`, after.length === 1 && /profile$/.test(after[0]) && /ansiedad sint|anxiety|sint/i.test(t2) && !t2.includes(perf), after.join(','))
      await p.c.close()
      const q = await open(A, { lang, url: URLX, routes: failRoute('sessions') }); const tq = await txt(q); const q0 = q.reqs.length
      ck(`F358-12 ${lang}: falla /sessions: error de sesiones con «Reintentar»; el perfil SÍ se ve`, tq.includes(sesf) && !tq.includes(perf) && /sint/i.test(tq) && (await q.locator('main button', { hasText: /reintentar|try again/i }).count()) === 1, tq.slice(0, 200))
      await q.locator('main button', { hasText: /reintentar|try again/i }).first().click(); await sleep(1500); const aq = q.reqs.slice(q0).filter(r => /my-therapist/.test(r.u)).map(r => r.u); ck(`F358-13 ${lang}: «Reintentar» pide SOLO las sesiones`, aq.length === 1 && /sessions$/.test(aq[0]) && !(await txt(q)).includes(sesf), aq.join(',')); await q.c.close()
      const r = await open(A, { lang, url: URLX, routes: async pg => { await failRoute('profile', 9)(pg); await failRoute('sessions', 9)(pg) } }); const tr = await txt(r); ck(`F358-14 ${lang}: fallan ambas: los dos errores, cada uno con su «Reintentar»`, tr.includes(perf) && tr.includes(sesf) && (await r.locator('main button', { hasText: /reintentar|try again/i }).count()) === 2, tr.slice(0, 200)); await r.c.close()
      const s = await open(A, { lang, url: URLX, routes: async pg => pg.route(u => new URL(u).pathname.startsWith('/api/sessions/user/my-therapist/'), rt => rt.fulfill({ status: 401, json: { error: 'x' } })) }); ck(`F358-15 ${lang}: sesión vencida (401) no deja la pantalla rota (sin errores de página)`, s.errs.length === 0, s.errs.join()); await s.c.close()
    }
    const sl = await open(A, { lang: 'es', url: URLX, wait: 200, routes: async pg => pg.route(u => new URL(u).pathname === '/api/sessions/user/my-therapist/sessions', async rt => { await sleep(2500); rt.continue() }) }); const tl = await txt(sl); ck('F358-16 cargando por sección: el perfil ya se ve mientras las sesiones cargan («Cargando…» en la sección)', /cargando/i.test(tl) && /sint/i.test(tl), tl.slice(0, 200)); await sl.c.close()
  }
  if (want('A1')) {
    const ax = []; const states = [['con profesional', A, null], ['sin profesional', C, null]]
    for (const lang of ['es', 'en']) for (const [w, scheme] of [[1360, 'light'], [390, 'dark'], [320, 'light'], [1360, 'dark']]) {
      for (const [k, U] of [['con profesional', A], ['sin profesional', C]]) { const p = await open(U, { lang, w, scheme, theme: scheme, url: URLX }); const ov = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth); const f = await p.evaluate(() => ({ h1: document.querySelectorAll('h1').length, skips: [...document.querySelectorAll('a')].filter(a => /^(Saltar|Skip)/i.test(a.innerText.trim())).length, small: [...document.querySelectorAll('main a, main button')].filter(e => { const r = e.getBoundingClientRect(); return r.width && (r.width < 24 || r.height < 24) }).length })); ax.push({ k, lang, w, scheme, ax: await axeRun(p), ov, f }); await p.c.close() }
      if (PR) { const pe = await open(A, { lang, w, scheme, theme: scheme, url: URLX, routes: async pg => { await failRoute('profile', 9)(pg) } }); ax.push({ k: 'error de perfil', lang, w, scheme, ax: await axeRun(pe), ov: 0, f: { h1: 1, skips: 1, small: 0 } }); await pe.c.close(); const ps = await open(A, { lang, w, scheme, theme: scheme, url: URLX, routes: async pg => { await failRoute('sessions', 9)(pg) } }); ax.push({ k: 'error de sesiones', lang, w, scheme, ax: await axeRun(ps), ov: 0, f: { h1: 1, skips: 1, small: 0 } }); await ps.c.close() }
    }
    const bad = ax.filter(a => a.ax.length || a.ov > 0 || a.f.h1 !== 1 || a.f.skips !== 1 || a.f.small > 0); ck(`A358-1 axe 0, 1 h1, 1 «Saltar», sin desborde y objetivos ≥ 24 px en ${ax.length} estados`, bad.length === 0, bad.slice(0, 4).map(a => `${a.k} ${a.lang} ${a.w} ${a.scheme}: ${a.ax.join(';')} ov=${a.ov} ${JSON.stringify(a.f)}`).join(' | '))
  }
  if (want('R')) {
    const n = +(process.env.RUNS || 2); let seq = 0
    for (const [nm, who] of [['con profesional', 'A'], ['sin profesional', 'C']]) { const r = await L.clsRuns(async () => { const s = await mk('user', 'R-358-' + (seq++)); if (who === 'A') { const t = (await dbq('SELECT "therapistId" FROM "Users" WHERE id=$1', [A.id]))[0].therapistId; await dbq('UPDATE "Users" SET "therapistId"=$1 WHERE id=$2', [t, s.id]) } return s }, URLX, n); console.log(`R358 ${L.LABEL} ${nm} cls=${JSON.stringify(r.cls)} util=${JSON.stringify(r.util)} src=${JSON.stringify(r.src)}`) }
  }
  if (want('O')) { // CLS con retrasos por petición en los dos órdenes de llegada (PR: /profile y /sessions; main: la lectura completa con el retraso mayor)
    const out = []
    for (const [nm, dp, ds] of [['perfil primero', 300, 1500], ['sesiones primero', 1500, 300], ['ambas lentas', 1500, 1500], ['ambas rápidas', 0, 0]]) for (let i = 0; i < 3; i++) {
      const c = await L.getBR().newContext({ viewport: { width: 390, height: 900 } }); await c.addInitScript(([tk, rl]) => { localStorage.setItem('elevation_token', tk); localStorage.setItem('elevation_role', rl); localStorage.setItem('elv_lang', 'es'); window.__cls = 0; try { new PerformanceObserver(x => { for (const e of x.getEntries()) if (!e.hadRecentInput) window.__cls += e.value }).observe({ type: 'layout-shift', buffered: true }) } catch {} }, [A.token, 'user'])
      const pg = await c.newPage(); await pg.route(u => new URL(u).pathname.includes('/api/sessions/user/my-therapist'), async rt => { const p = new URL(rt.request().url()).pathname; await sleep(/profile$/.test(p) ? dp : /sessions$/.test(p) ? ds : Math.max(dp, ds)); await rt.continue() })
      const cdp = await c.newCDPSession(pg); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 }); await pg.goto(L.WEB + URLX, { waitUntil: 'domcontentloaded' }); await pg.waitForSelector('main h1', { timeout: 40000 }).catch(() => {}); await sleep(4500); out.push([nm, +(await pg.evaluate(() => window.__cls)).toFixed(4)]); await c.close()
    }
    for (const nm of ['perfil primero', 'sesiones primero', 'ambas lentas', 'ambas rápidas']) console.log(`O358 ${L.LABEL} ${nm} cls=${JSON.stringify(out.filter(o => o[0] === nm).map(o => o[1]))}`)
  }
  await L.done(); srv?.close?.(); process.exit(0)
})().catch(e => { console.error('FALLO', e); process.exit(1) })
