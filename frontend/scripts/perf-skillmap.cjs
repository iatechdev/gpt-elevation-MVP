// ES-199 (PERF-05, resto): rendimiento en ejecución del Skill Map (/app/skill-map). Con el build de producción servido en local, CPU ×4 y 390 px, mide con N capacidades sintéticas
// (N = tamaño del catálogo, con y sin territorio) el tiempo de cada interacción (hasta que el navegador pinta el siguiente cuadro) y las tareas largas (> 50 ms):
// carga inicial, cambiar de vista (relieve → lista → radar → relieve), elegir una capacidad en la lista y en el radar.
// SOLO en equipo local o de QA, NUNCA en CI; Playwright no es dependencia del repositorio. Datos sintéticos, API simulada (page.route).
// Uso:  npx vite build && npx vite preview --host 127.0.0.1 --port 4199 --strictPort   y luego
//   PERF_URL=http://127.0.0.1:4199 PLAYWRIGHT_MODULE=<ruta a playwright> node scripts/perf-skillmap.cjs [--sizes 30,150,400] [--runs 3] [--json]
const assert = require('node:assert/strict')

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i === -1 ? fallback : process.argv[i + 1] }
const SIZES = arg('sizes', '30,150,400').split(',').map(Number)
const RUNS = Number(arg('runs', 3))
const median = values => { const s = [...values].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2 }
const TERRITORIES = ['dir', 'con', 'com', 'ing', 'inn']
const track = (level, evidenceCount) => ({ level, state: 'reviewed', stale: false, catalogOutdated: false, confidence: 'medium', confidenceReason: { es: 'Sintético', en: 'Synthetic' }, evidenceCount, authoring: 'person', rationale: null, needsReview: false })
const skills = n => Array.from({ length: n }, (_, i) => {
  const level = i % 5 === 0 ? null : (i % 4) + 1
  return { skillKey: `sintetica-${i}`, type: i % 3 === 0 ? 'transversal' : 'domain', labels: { es: `Capacidad sintética ${i + 1}`, en: `Synthetic skill ${i + 1}` },
    rubric: { levels: { 1: { es: 'Nivel 1', en: 'Level 1' }, 2: { es: 'Nivel 2', en: 'Level 2' }, 3: { es: 'Nivel 3', en: 'Level 3' }, 4: { es: 'Nivel 4', en: 'Level 4' } }, source: 'Sintético', verifiedAt: '2026-11-01T00:00:00Z' },
    self: level ? track(level, 1) : null, review: null, state: level ? 'reviewed' : 'no_evidence', territories: [TERRITORIES[i % 5]] }
})

;(async () => {
  const { chromium } = process.env.PLAYWRIGHT_MODULE ? require(process.env.PLAYWRIGHT_MODULE) : await import('playwright')
  const base = process.env.PERF_URL ?? 'http://127.0.0.1:4199'
  assert.ok(['127.0.0.1', 'localhost'].includes(new URL(base).hostname), 'Solo vista previa local')
  const browser = await chromium.launch({ headless: true })
  const rows = []
  for (const size of SIZES) {
    const perRun = []
    for (let run = 0; run < RUNS; run += 1) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-CO', reducedMotion: 'reduce' })
      const page = await context.newPage()
      const cdp = await context.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
      await page.addInitScript(() => { localStorage.setItem('elevation_token', 't'); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elv_lang', 'es')
        window.__long = []; try { new PerformanceObserver(list => { for (const e of list.getEntries()) window.__long.push(e.duration) }).observe({ type: 'longtask', buffered: true }) } catch { /* sin longtask */ } })
      await page.route('**/api/**', route => {
        const path = new URL(route.request().url()).pathname
        if (path === '/api/session') return route.fulfill({ json: { role: 'user', onboardingCompleted: true } })
        if (path === '/api/skill-map') return route.fulfill({ json: { catalogVersion: 1, skills: skills(size) } })
        if (path.startsWith('/api/consents')) return route.fulfill({ json: { consents: [{ purpose: 'skill_map_bridge', status: 'granted' }] } })
        return route.fulfill({ json: {} })
      })
      const t0 = Date.now()
      await page.goto(`${base}/app/skill-map`, { waitUntil: 'domcontentloaded' })
      await page.locator('.skill-map-catalog').waitFor({ timeout: 60000 })
      const load = Date.now() - t0
      await page.waitForTimeout(800)
      const longAfterLoad = await page.evaluate(() => window.__long.filter(d => d > 50).length)
      // Una interacción = acción + hasta que el navegador pinta el siguiente cuadro (doble requestAnimationFrame).
      const timed = async action => {
        await page.evaluate(() => { window.__long.length = 0 })
        const start = await page.evaluate(() => performance.now())
        await action()
        const end = await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(performance.now())))))
        const long = await page.evaluate(() => window.__long.filter(d => d > 50).length)
        return { ms: end - start, long }
      }
      const view = name => page.locator('.skill-map-views button').nth(name)
      const out = {}
      out.toList = await timed(() => view(1).click())
      out.pickList = await timed(() => page.locator('.skill-map-pick').first().click())
      out.toRadar = await timed(() => view(2).click())
      out.toRelief = await timed(() => view(0).click())
      perRun.push({ load, longAfterLoad, ...Object.fromEntries(Object.entries(out).flatMap(([k, v]) => [[k, v.ms], [k + 'Long', v.long]])) })
      await context.close()
    }
    const keys = Object.keys(perRun[0])
    rows.push({ size, ...Object.fromEntries(keys.map(k => [k, Math.round(median(perRun.map(r => r[k])))])) })
  }
  await browser.close()
  if (process.argv.includes('--json')) console.log(JSON.stringify(rows, null, 2))
  else { console.log('capacidades | carga ms | tareas largas tras carga | a lista ms (largas) | elegir en lista ms (largas) | a radar ms (largas) | a relieve ms (largas)')
    for (const r of rows) console.log(`${r.size} | ${r.load} | ${r.longAfterLoad} | ${r.toList} (${r.toListLong}) | ${r.pickList} (${r.pickListLong}) | ${r.toRadar} (${r.toRadarLong}) | ${r.toRelief} (${r.toReliefLong})`) }
})().catch(error => { console.error(error); process.exit(1) })
