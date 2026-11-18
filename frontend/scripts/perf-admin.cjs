// ES-199 (PERF-05, resto): rendimiento en ejecución de la lista «Personas» de administración (/admin/users). Con el build de producción servido en local, CPU ×4 y 390 px (tarjetas) y 1360 px (tabla),
// mide con N cuentas sintéticas el tiempo de pintar la lista, de cambiar cada filtro y de limpiarlos (hasta que el navegador pinta el siguiente cuadro) y las tareas largas (> 50 ms).
// OJO: el servidor devuelve TODAS las cuentas (GET /api/admin/usuarios no pagina hoy); N indica hasta dónde aguanta la pantalla, no el tamaño del piloto (6 personas).
// SOLO en equipo local o de QA, NUNCA en CI; Playwright no es dependencia del repositorio. Datos sintéticos, API simulada (page.route).
// Uso:  npx vite build && npx vite preview --host 127.0.0.1 --port 4199 --strictPort   y luego
//   PERF_URL=http://127.0.0.1:4199 PLAYWRIGHT_MODULE=<ruta a playwright> node scripts/perf-admin.cjs [--sizes 30,200,1000,3000] [--runs 3] [--json]
const assert = require('node:assert/strict')

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i === -1 ? fallback : process.argv[i + 1] }
const SIZES = arg('sizes', '30,200,1000,3000').split(',').map(Number)
const RUNS = Number(arg('runs', 3))
const median = values => { const s = [...values].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2 }
const ROLES = ['user', 'user', 'user', 'therapist', 'admin']
const people = n => Array.from({ length: n }, (_, i) => ({ id: i + 1, name: `Persona sintética ${i + 1}`, email: `persona${i + 1}@ejemplo.test`, role: ROLES[i % 5], active: i % 7 !== 0, therapistId: i % 5 === 0 ? 4 : null,
  createdAt: new Date(Date.UTC(2026, 0, 1 + (i % 300))).toISOString(), plan: i % 3 === 0 ? { id: 1, slug: 'basico', name_es: 'Básico', name_en: 'Basic' } : null,
  sesiones: 0, ratingPromedio: null, moodPromedio: null, isLocked: i % 11 === 0, lockedUntil: null, loginAttempts: 0, deletionRequested: i % 13 === 0 }))

;(async () => {
  const { chromium } = process.env.PLAYWRIGHT_MODULE ? require(process.env.PLAYWRIGHT_MODULE) : await import('playwright')
  const base = process.env.PERF_URL ?? 'http://127.0.0.1:4199'
  assert.ok(['127.0.0.1', 'localhost'].includes(new URL(base).hostname), 'Solo vista previa local')
  const browser = await chromium.launch({ headless: true })
  const rows = []
  for (const width of [390, 1360]) for (const size of SIZES) {
    const perRun = []
    for (let run = 0; run < RUNS; run += 1) {
      const context = await browser.newContext({ viewport: { width, height: 844 }, locale: 'es-CO', reducedMotion: 'reduce' })
      const page = await context.newPage()
      const cdp = await context.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
      await page.addInitScript(() => { localStorage.setItem('elevation_token', 't'); localStorage.setItem('elevation_role', 'admin'); localStorage.setItem('elv_lang', 'es')
        window.__long = []; try { new PerformanceObserver(list => { for (const e of list.getEntries()) window.__long.push(e.duration) }).observe({ type: 'longtask', buffered: true }) } catch { /* sin longtask */ } })
      await page.route('**/api/**', route => {
        const path = new URL(route.request().url()).pathname
        if (path === '/api/session') return route.fulfill({ json: { role: 'admin', onboardingCompleted: true } })
        if (path === '/api/admin/usuarios') return route.fulfill({ json: people(size) })
        if (path.startsWith('/api/admin/')) return route.fulfill({ json: [] })
        return route.fulfill({ json: {} })
      })
      await page.goto(`${base}/admin/users`, { waitUntil: 'domcontentloaded' })
      const t0 = Date.now()
      await page.locator('#au-filter-role').waitFor({ timeout: 90000 })
      await page.locator(width >= 900 ? '.cg-table tbody tr' : '.au-narrow .cg-item').first().waitFor({ timeout: 90000 })
      const load = Date.now() - t0
      await page.waitForTimeout(600)
      const timed = async action => {
        await page.evaluate(() => { window.__long.length = 0 })
        const start = await page.evaluate(() => performance.now())
        await action()
        const end = await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(performance.now())))))
        return { ms: end - start, long: await page.evaluate(() => window.__long.filter(d => d > 50).length) }
      }
      const out = {}
      out.role = await timed(() => page.locator('#au-filter-role').selectOption('therapist'))
      out.status = await timed(() => page.locator('#au-filter-status').selectOption('active'))
      out.role2 = await timed(() => page.locator('#au-filter-role').selectOption(''))
      out.manage = await timed(async () => { await page.getByRole('button', { name: /^Gestionar/ }).first().click(); await page.locator('dialog[open]').waitFor() })
      perRun.push({ load, ...Object.fromEntries(Object.entries(out).flatMap(([k, v]) => [[k, v.ms], [k + 'Long', v.long]])) })
      await context.close()
    }
    rows.push({ width, size, ...Object.fromEntries(Object.keys(perRun[0]).map(k => [k, Math.round(median(perRun.map(r => r[k])))])) })
  }
  await browser.close()
  if (process.argv.includes('--json')) console.log(JSON.stringify(rows, null, 2))
  else { console.log('ancho | cuentas | pintar lista ms | filtro de rol ms (largas) | filtro de estado ms (largas) | quitar filtro ms (largas) | abrir «Gestionar» ms (largas)')
    for (const r of rows) console.log(`${r.width} | ${r.size} | ${r.load} | ${r.role} (${r.roleLong}) | ${r.status} (${r.statusLong}) | ${r.role2} (${r.role2Long}) | ${r.manage} (${r.manageLong})`) }
})().catch(error => { console.error(error); process.exit(1) })
