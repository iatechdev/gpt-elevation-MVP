// [QA-Claude-3] Puerta nueva (pedida por Infra-Claude, ES-45): recorrido por rol que comprueba que TODA función es alcanzable desde el menú. Local (backend real de main + build de main), datos sintéticos, solo navegación.
// Por rol y viewport: (1) enlaces del MARCO (fuera de <main>, abriendo el menú de usuario y el menú móvil), (2) BFS por enlaces de contenido hasta profundidad 3; compara con la lista de rutas del rol (App.tsx, sin parámetros).
// Uso: via qa/run.sh main <db> . Salida: líneas MENU <rol> <viewport> y un resumen de rutas NO alcanzables desde el menú / desde ningún enlace.
const L = require('./lib3.cjs'); const { info, mk, open, sleep } = L
const ROUTES = {
  user: ['/app/dashboard', '/app/chat', '/app/checkin', '/app/diary', '/app/diary/new', '/app/exercises', '/app/bridge', '/app/progress', '/app/skill-map', '/app/evidence', '/app/evidence/new', '/app/evidence/resume-skills', '/app/context/resumes', '/app/compass', '/app/next-step', '/app/next-step/experiments', '/app/next-step/plan', '/app/route-catalog', '/app/plan', '/app/data', '/app/my-therapist', '/app/feedback', '/app/professional-reviews', '/app/space/tools'],
  therapist: ['/therapist/dashboard', '/facilitation'],
  admin: ['/admin/dashboard', '/admin/users', '/admin/content', '/admin/metrics', '/admin/prompts', '/admin/manifest', '/admin/route-catalog', '/admin/skill-catalog', '/admin/pilot-metrics'],
  superadmin: ['/admin/dashboard', '/admin/users', '/admin/content', '/admin/metrics', '/admin/prompts', '/admin/manifest', '/admin/route-catalog', '/admin/skill-catalog', '/admin/pilot-metrics', '/app/dashboard', '/app/chat', '/therapist/dashboard'],
  facilitator: ['/facilitation'],
}
const HOME = { user: '/app/dashboard', therapist: '/therapist/dashboard', admin: '/admin/dashboard', superadmin: '/admin/dashboard', facilitator: '/facilitation' }
const PUBLIC = ['/profesionales', '/pricing', '/manifiesto', '/privacidad', '/terminos', '/login', '/']
const norm = h => { try { const u = new URL(h, 'http://x'); return u.pathname.replace(/\/+$/, '') || '/' } catch { return null } }
const collect = async p => { // enlaces del marco y del contenido; abre los menús plegados del marco
  for (let i = 0; i < 2; i++) { const btns = p.locator('header button[aria-expanded="false"], nav button[aria-expanded="false"], .cg-frame button[aria-expanded="false"]:not(main button), [aria-label*="enú" i][aria-expanded="false"], [aria-label*="enu" i][aria-expanded="false"], .cg-usermenu__button'); const n = await btns.count(); for (let k = 0; k < Math.min(n, 4); k++) { await btns.nth(k).click({ timeout: 1500 }).catch(() => {}); await sleep(250) } }
  return p.evaluate(() => [...document.querySelectorAll('a[href]')].map(a => ({ href: a.getAttribute('href'), text: (a.innerText || a.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 40), inMain: !!a.closest('main'), vis: !!(a.offsetWidth || a.offsetHeight) })))
}
;(async () => {
  await L.DB.connect(); await L.launch(); const srv = await L.serve(); const summary = []
  const U = { user: await mk('user', 'Persona-menu'), therapist: await mk('therapist', 'Prof-menu'), admin: await mk('admin', 'Admin-menu'), superadmin: await mk('superadmin', 'Super-menu'), facilitator: await mk('facilitator', 'Junta-menu') }
  for (const [role, routes] of Object.entries(ROUTES)) for (const [w, vp] of [[1360, 'escritorio'], [390, 'móvil']]) {
    const frame = new Map(), anyLink = new Map(), seen = new Set(), queue = [[HOME[role], 0]]
    while (queue.length && seen.size < 60) {
      const [path, d] = queue.shift(); if (seen.has(path)) continue; seen.add(path)
      const p = await open(U[role], { lang: 'es', w, url: path, wait: 1200 }); const here = await p.evaluate(() => location.pathname); const links = await collect(p); await p.c.close()
      for (const l of links) { const n = norm(l.href); if (!n || /^(https?:|mailto:)/.test(l.href || '')) continue; if (!l.inMain) frame.set(n, l.text || frame.get(n) || ''); else if (!frame.has(n)) anyLink.set(n, l.text); if (d < 3 && !seen.has(n) && /^\/(app|admin|therapist|facilitation|board)/.test(n) && !/\/:|\d{2,}/.test(n)) queue.push([n, d + 1]) }
    }
    const menu = new Set([...frame.keys()]); const all = new Set([...frame.keys(), ...anyLink.keys()])
    const notMenu = routes.filter(r => !menu.has(r)); const notAny = routes.filter(r => !all.has(r) && !seen.has(r))
    console.log(`MENU ${role} ${vp}: ${routes.length} funciones; en el menú del marco: ${routes.length - notMenu.length}; alcanzables solo por enlaces del contenido: ${notMenu.filter(r => all.has(r)).length}; NO alcanzables por ningún enlace: ${notAny.length}`)
    console.log(`  enlaces del marco: ${[...frame.entries()].filter(([k]) => /^\/(app|admin|therapist|facilitation|board)/.test(k)).map(([k, t]) => `${k}${t ? ' «' + t + '»' : ''}`).join(' | ')}`)
    if (notMenu.length) console.log(`  FUERA DEL MENÚ: ${notMenu.join(', ')}`); if (notAny.length) console.log(`  SIN ENLACE ALGUNO: ${notAny.join(', ')}`)
    summary.push({ role, vp, notMenu, notAny })
  }
  const pub = await open(null, { lang: 'es', url: '/', wait: 1200 }); const pl = (await collect(pub)).map(l => norm(l.href)); await pub.c.close(); console.log('PÚBLICAS enlazadas desde la portada: ' + PUBLIC.map(r => `${r}:${pl.includes(r) ? 'sí' : 'no'}`).join(' '))
  L.fs.writeFileSync('C:/Users/Usuario/tools/qa3/out/menu-alcance.json', JSON.stringify(summary, null, 1)); await L.done(); srv?.close?.(); process.exit(0)
})().catch(e => { console.error('FALLO', e); process.exit(1) })
