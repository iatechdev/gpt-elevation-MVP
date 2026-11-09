// ES-232: los catálogos de textos de compass, evidencias, mapa de habilidades, contexto y hoja de vida ya no van en el arranque. Este script comprueba en navegador real (Chromium, API
// simulada, carga EN FRÍO: contexto nuevo por pantalla) que cada pantalla afectada muestra su texto en ES y EN y que NUNCA aparece una clave cruda ni siquiera un instante:
// un MutationObserver instalado antes de cargar la página registra cada nodo de texto que parezca una clave (compass.x, evidence.x, skill_map.x, context_x, resume_x).
// También verifica que el arranque (home) no descarga esos catálogos y que cambiar de idioma con la pantalla abierta traduce sin claves crudas.
// No corre en CI; evidencia del PR. Uso: `npx vite build && npx vite preview --port 5299 --strictPort` y luego
//   PLAYWRIGHT_MODULE=<playwright> BASE=http://localhost:5299 node scripts/es232-check.cjs
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const BASE = process.env.BASE || 'http://localhost:5299'
let failures = 0
const report = (ok, label, extra = '') => { if (!ok) failures++; console.log((ok ? 'OK    ' : 'FALLA ') + label + (extra ? ' ' + extra : '')) }
const RAW_KEY = /(?:^|[\s(«"'])(compass\.[a-z_]+|evidence\.[a-z_]+|skill_map\.[a-z_.]+|context_[a-z_]+|resume_[a-z_]+)(?=$|[\s.,;:)»"'])/
// Pantallas afectadas y un texto propio de cada una (ES / EN).
const ROUTES = [
  { path: '/app/compass', es: 'Brújula profesional', en: 'Career compass' },
  { path: '/app/evidence', es: 'Mis evidencias', en: 'My evidence' },
  { path: '/app/evidence/new', es: 'Nueva evidencia', en: 'New evidence' },
  { path: '/app/evidence/resume-skills', es: /habilidades|evidencia/i, en: /skills|evidence/i },
  { path: '/app/context/resumes', es: 'Mis hojas de vida', en: 'My résumés' },
  { path: '/app/onboarding', es: 'Tu punto de partida', en: 'Your starting point' },
  { path: '/app/skill-map', es: 'Mapa de competencias', en: 'Skills map' },
  { path: '/app/dashboard', es: /Brújula|evidencia|competencias/i, en: /compass|evidence|skills/i },
]

async function openCold(browser, lang, route) {
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 }, reducedMotion: 'reduce' })
  const page = await ctx.newPage()
  const requests = []; const errors = []
  page.on('request', r => requests.push(new URL(r.url()).pathname)); page.on('pageerror', e => errors.push(e.message))
  await page.route('**/api/**', route => {
    const p = new URL(route.request().url()).pathname
    if (p === '/api/session') return route.fulfill({ json: { role: 'user', onboardingCompleted: true } })
    if (p === '/api/ai/usage') return route.fulfill({ json: { configured: true, period: 'month', periodKey: '2026-11', limit: 1000, used: 10, remaining: 990, resetsAt: '2026-12-01T00:00:00.000Z' } })
    if (p === '/api/career-context') return route.fulfill({ json: { active: null, versions: [] } })
    if (p === '/api/evidence' || p === '/api/user/resumes') return route.fulfill({ json: p === '/api/user/resumes' ? { resumes: [], maxVersions: 5 } : [] })
    if (p === '/api/messages' || p === '/api/diary') return route.fulfill({ json: p === '/api/diary' ? { entries: [] } : [] })
    return route.fulfill({ json: {} })
  })
  await page.addInitScript(l => {
    localStorage.setItem('elevation_token', 'synthetic-browser-token'); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elv_lang', l)
    // Registro de cualquier texto con forma de clave que aparezca en pantalla, aunque dure un instante.
    window.__rawKeys = new Set()
    const re = /(?:^|[\s(«"'])(compass\.[a-z_]+|evidence\.[a-z_]+|skill_map\.[a-z_.]+|context_[a-z_]+|resume_[a-z_]+)(?=$|[\s.,;:)»"'])/
    const scan = node => { const t = node.nodeType === 3 ? node.nodeValue : node.nodeType === 1 ? node.textContent : ''; const m = re.exec(t || ''); if (m) window.__rawKeys.add(m[1]) }
    new MutationObserver(list => { for (const m of list) { if (m.type === 'characterData') scan(m.target); for (const n of m.addedNodes) scan(n) } }).observe(document, { subtree: true, childList: true, characterData: true })
  }, lang)
  await page.goto(BASE + route.path, { waitUntil: 'networkidle' })
  return { ctx, page, requests, errors }
}

;(async () => {
  const browser = await chromium.launch()
  for (const lang of ['es', 'en']) for (const route of ROUTES) {
    const tag = `${lang} ${route.path}`
    const { ctx, page, errors } = await openCold(browser, lang, route)
    const body = await page.locator('body').innerText()
    const expected = route[lang]
    report(typeof expected === 'string' ? body.includes(expected) : expected.test(body), `muestra su texto en ${lang.toUpperCase()} ${tag}`, typeof expected === 'string' ? `«${expected}»` : String(expected))
    const raw = await page.evaluate(() => [...window.__rawKeys])
    report(raw.length === 0 && !RAW_KEY.test(body), `ninguna clave cruda (ni un instante) ${tag}`, raw.length ? `vistas=${raw.join(',')}` : '')
    report(errors.length === 0, `sin errores de página ${tag}`, errors.join(' | ').slice(0, 160))
    await ctx.close()
  }
  // El arranque no descarga los catálogos perezosos: en la portada no se pide ningún módulo de esas pantallas.
  {
    const { ctx, requests } = await openCold(browser, 'es', { path: '/' })
    const lazyChunks = requests.filter(p => /\/assets\/(register|EvidencePages|SkillMapPage|CompassPage|ResumesPage|ParticipantContextForm)-/.test(p))
    report(lazyChunks.length === 0, 'la portada no descarga los módulos de compass/evidencias/mapa/hojas de vida', lazyChunks.join(','))
    await ctx.close()
  }
  // Cambiar de idioma con la pantalla abierta traduce sin claves crudas.
  {
    const { ctx, page } = await openCold(browser, 'es', ROUTES[1])
    await page.getByRole('button', { name: 'EN', exact: true }).first().click().catch(() => {})
    await page.waitForFunction(() => document.body.innerText.includes('My evidence'), null, { timeout: 5000 }).catch(() => {})
    const body = await page.locator('body').innerText()
    const raw = await page.evaluate(() => [...window.__rawKeys])
    report(body.includes('My evidence') && raw.length === 0 && !RAW_KEY.test(body), 'cambiar ES→EN con Evidencias abierta traduce sin claves crudas', raw.join(','))
    await ctx.close()
  }
  await browser.close()
  console.log(failures ? `\n${failures} FALLAS` : '\nTODO OK')
  process.exit(failures ? 1 : 0)
})().catch(e => { console.error(e); process.exit(2) })
