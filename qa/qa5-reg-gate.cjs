// [QA-Claude-5] Regresión local sobre main: PUERTA DE ALCANZABILIDAD POR ROL. Un perfil (ROLE) × ES/EN × 1360/390 × cada ruta estática: acceso esperado (tabla access.ts) vs observado, axe, desborde, errores de JS, y los enlaces del menú (barra lateral / cajón) contra navGroups. Backend real + PG desechable + build fresco. Datos sintéticos.
// Uso: ROLE=user|therapist|admin|superadmin|board PLAYWRIGHT_MODULE=... AXE=... BASE=http://127.0.0.1:4402 node qa/qa5-reg-gate.cjs  (cred-reg.json de qa5-reg-seed.cjs)
const fs = require('fs'); const { chromium } = require(process.env.PLAYWRIGHT_MODULE); const axeSource = fs.readFileSync(process.env.AXE, 'utf8')
const BASE = process.env.BASE; const ROLE = process.env.ROLE; const U = JSON.parse(fs.readFileSync((process.env.QA_TOOLS || '.') + '/qa5/cred-reg.json', 'utf8')).users[ROLE]
const ZONES = { person: ['user', 'superadmin'], professional: ['therapist', 'superadmin'], admin: ['admin', 'superadmin'], board: ['board', 'superadmin'], member: ['user', 'admin', 'superadmin', 'therapist', 'board'] }
const PART = ['/app/onboarding', '/app/context', '/app/evidence/resume-skills', '/app/my-therapist', '/app/session', '/app/next-step']; const Z428 = process.env.ZMODE === '428'; if (Z428) { ZONES.professional = ['therapist']; ZONES.participant = ['user'] }
const R = (zone, ...p) => p.map((path) => ({ path, zone: Z428 && zone === 'person' && PART.some((b) => path === b || path.startsWith(b + '/')) ? 'participant' : zone }))
const ROUTES = [...R('public', '/', '/login', '/forgot-password', '/reset-password', '/accept-invitation', '/profesionales', '/pricing', '/manifiesto', '/privacidad', '/terminos'),
  ...R('person', '/app/feedback', '/app/route-catalog', '/app/compass', '/app/next-step', '/app/exercises', '/app/bridge', '/app/diary', '/app/diary/new', '/app/space/tools', '/app/onboarding', '/app/context/resumes', '/app/context/resumes/update', '/app/checkin', '/app/chat', '/app/progress', '/app/dashboard', '/app/evidence', '/app/evidence/new', '/app/evidence/resume-skills', '/app/skill-map', '/app/my-therapist'),
  ...R('member', '/app/data', '/app/plan', '/app/professional-reviews', '/facilitation'),
  ...R('admin', '/admin', '/admin/dashboard', '/admin/prompts', '/admin/content', '/admin/users', '/admin/metrics', '/admin/manifest', '/admin/route-catalog', '/admin/skill-catalog', '/admin/pilot-metrics'),
  ...R('professional', '/therapist/dashboard'), ...R('board', '/board/')]
const NAV = { user: ['/app/dashboard', '/app/checkin', '/app/chat', '/app/diary', '/app/bridge', '/app/space/tools', '/app/exercises', '/app/skill-map', '/app/evidence', '/app/next-step', '/app/compass', '/app/route-catalog', '/app/context/resumes', '/app/progress', '/app/plan', '/app/my-therapist', '/app/professional-reviews'],
  therapist: ['/therapist/dashboard', '/facilitation', '/app/professional-reviews'], admin: ['/admin/dashboard', '/admin/metrics', '/admin/pilot-metrics', '/admin/users', '/admin/prompts', '/admin/content', '/admin/route-catalog', '/admin/skill-catalog', '/admin/manifest'], board: ['/manifiesto'] }
NAV.superadmin = NAV.admin
const NOACC = /Tu rol no tiene acceso a esta pantalla|Your role does not have access to this screen/
const axe = (page) => page.addScriptTag({ content: axeSource }).then(() => page.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } }).then((r) => r.violations.map((x) => x.id + ':' + x.nodes.length + ' ' + (x.nodes[0] && x.nodes[0].target.join(' ').slice(0, 80))))))
const lines = []; const out = (s) => { lines.push(s); console.log(s) }
;(async () => {
  const br = await chromium.launch(); const incoming = new Set(); let n = 0
  for (const lang of ['es', 'en']) for (const width of [1360, 390]) {
    const ctx = await br.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' }); const page = await ctx.newPage(); let errs = [], cons = []
    page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') cons.push(m.text().slice(0, 140)) })
    await page.addInitScript(([tk, rl, nm, l]) => { localStorage.setItem('elevation_token', tk); localStorage.setItem('elevation_role', rl); localStorage.setItem('elevation_name', nm); localStorage.setItem('elv_lang', l) }, [U.token, U.role, U.name, lang])
    for (const route of ROUTES) {
      errs = []; cons = []; n++
      await page.goto(BASE + route.path, { waitUntil: 'load' }).catch(() => {}); await page.waitForTimeout(1500)
      const d = await page.evaluate(() => ({ path: location.pathname, text: document.body.textContent.replace(/\s+/g, ' ').slice(0, 4000), len: document.body.textContent.trim().length, h1: !!document.querySelector('h1'), h2: !!document.querySelector('h2'), ox: document.documentElement.scrollWidth > innerWidth + 1,
        links: [...document.querySelectorAll('a[href^="/"]')].map((a) => a.getAttribute('href').split(/[?#]/)[0]) }))
      d.links.forEach((l) => incoming.add(l))
      const noAcc = NOACC.test(d.text); const top = (p) => '/' + (p.split('/')[1] || ''); const samePrefix = top(d.path) === top(route.path) && !d.path.startsWith('/login')
      const observed = route.zone === 'public' ? 'allow' : (noAcc || !samePrefix) ? 'denied' : 'allow'
      const expected = route.zone === 'public' ? 'allow' : ZONES[route.zone].includes(ROLE) ? 'allow' : 'denied'
      const v = await axe(page).catch((e) => ['axe-error ' + e.message.slice(0, 60)])
      const tag = `${ROLE} ${lang} ${width}px ${route.path}`
      const problems = []
      if (observed !== expected) problems.push(`ACCESO esperado ${expected} ≠ observado ${observed} (ruta final ${d.path}${noAcc ? ', pantalla «sin acceso»' : ''})`)
      if (v.length) problems.push('axe ' + v.join('; '))
      if (d.ox) problems.push('desborde horizontal')
      if (errs.length) problems.push('error JS ' + errs.slice(0, 2).join(' | '))
      if (expected === 'allow' && observed === 'allow' && !d.h1 && !d.h2) problems.push('sin h1/h2')
      if (expected === 'allow' && observed === 'allow' && d.len < 60) problems.push('pantalla casi vacía')
      out(`${problems.length ? 'FALLA' : 'OK   '} ${tag} → ${observed}${d.path !== route.path ? ' (' + d.path + ')' : ''}${problems.length ? ' · ' + problems.join(' · ') : ''}${cons.length ? ' [consola: ' + cons.slice(0, 2).join(' | ') + ']' : ''}`)
    }
    // menú: enlaces visibles de la barra lateral (1360) o del cajón (390) contra navGroups
    const landing = { user: '/app/dashboard', therapist: '/therapist/dashboard', admin: '/admin/dashboard', superadmin: '/admin/dashboard', board: '/manifiesto' }[ROLE]
    await page.goto(BASE + landing); await page.waitForTimeout(1800)
    if (width < 700) { const b = page.locator('button[aria-label="Menú"], button[aria-label="Menu"]').first(); if (await b.count()) { await b.click(); await page.waitForTimeout(700) } }
    const seen = await page.evaluate(() => [...new Set([...document.querySelectorAll('nav a[href^="/"], aside a[href^="/"]')].filter((a) => a.getBoundingClientRect().width > 0).map((a) => a.getAttribute('href').split(/[?#]/)[0]))])
    const want = NAV[ROLE]; const missing = want.filter((x) => !seen.includes(x)); const extra = seen.filter((x) => !want.includes(x) && !['/', '/app/dashboard', '/manifiesto', '/privacidad', '/terminos', '/pricing', '/profesionales'].includes(x))
    out(`${missing.length ? 'FALLA' : 'OK   '} ${ROLE} ${lang} ${width}px MENÚ: enlaces visibles ${seen.length}; faltan ${JSON.stringify(missing)}; extra ${JSON.stringify(extra)}`)
    await ctx.close()
  }
  const orphans = ROUTES.filter((r) => r.zone !== 'public' && (r.zone === 'member' || ZONES[r.zone].includes(ROLE)) && !incoming.has(r.path) && !incoming.has(r.path.replace(/\/$/, ''))).map((r) => r.path)
  out(`INFO ${ROLE}: rutas permitidas sin NINGÚN enlace entrante en las pantallas visitadas: ${JSON.stringify(orphans)}`)
  fs.writeFileSync(`${process.env.QA_TOOLS || '.'}/qa5/out/gate-${process.env.ZMODE || 'x'}-${ROLE}.txt`, lines.join('\n')); console.log(`GATE ${ROLE}: ${lines.filter((l) => l.startsWith('OK')).length} correctas, ${lines.filter((l) => l.startsWith('FALLA')).length} con hallazgo, ${n} cargas`); await br.close()
})().catch((e) => { console.error('ABORTA', e); process.exit(2) })
