// ES-200 (PERF-06): inventario de peticiones al backend por pantalla. SOLO en equipo local o de QA, NUNCA en CI; Playwright no es dependencia del repositorio.
// Usa el servidor sintético de `perf-lighthouse.mjs` (dist/ + datos fijos de /api/**) y retrasa CADA respuesta de /api/** un tiempo fijo (por defecto 120 ms) para que las
// cascadas se vean en los tiempos de inicio: una petición que empieza después de que termine otra es una cascada (depende de ella o espera a que se pinte algo).
// Mide el frontend, no la latencia de Railway ni de Supabase. Datos sintéticos.
// Uso (desde frontend/):  npx vite build && PLAYWRIGHT_MODULE=<ruta a playwright> node scripts/perf-requests.mjs [--delay 120] [--only chat,panel] [--json]
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { startServer, SCREENS, setCurrentRole } from './perf-lighthouse.mjs'

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i === -1 ? fallback : process.argv[i + 1] }
const DELAY = Number(arg('delay', 120))
const ONLY = (arg('only', '') ?? '').split(',').filter(Boolean)

// Pantallas adicionales de la persona y del profesional (además de las 6 de PERF-01), con el rol que las abre.
export const EXTRA = [
  { id: 'evidence', label: 'Evidencias', path: '/app/evidence', role: 'user' },
  { id: 'diary', label: 'Diario', path: '/app/diary', role: 'user' },
  { id: 'progress', label: 'Progreso', path: '/app/progress', role: 'user' },
  { id: 'plan', label: 'Mi plan', path: '/app/plan', role: 'user' },
  { id: 'mytherapist', label: 'Mi profesional', path: '/app/my-therapist', role: 'user' },
  { id: 'checkin', label: 'Check-in', path: '/app/checkin', role: 'user' },
  { id: 'admin', label: 'Administración', path: '/admin/dashboard', role: 'admin' },
]

/** Clave que identifica «la misma petición»: método + ruta + query ordenada. */
export const requestKey = (method, url) => { const u = new URL(url, 'http://x'); u.searchParams.sort(); return `${method} ${u.pathname}${u.search}` }

/** Resume una lista de peticiones {key, start, end} en duplicados y en cascadas (empiezan cuando otra ya terminó). */
export function summarize(requests) {
  const byKey = new Map()
  for (const r of requests) byKey.set(r.key, (byKey.get(r.key) ?? 0) + 1)
  const duplicates = [...byKey].filter(([, n]) => n > 1).map(([key, count]) => ({ key, count }))
  const sorted = [...requests].sort((a, b) => a.start - b.start)
  // «oleadas»: grupos de peticiones que empiezan antes de que termine la primera del grupo
  const waves = []
  for (const r of sorted) {
    const wave = waves[waves.length - 1]
    if (wave && r.start < wave.firstEnd) { wave.items.push(r); wave.firstEnd = Math.min(wave.firstEnd, r.end) } else waves.push({ items: [r], firstEnd: r.end })
  }
  // «datos»: las peticiones que no son la verificación de sesión; el contenido útil llega cuando termina la última
  const data = requests.filter(r => !r.key.endsWith('/api/session'))
  const dataStart = data.length ? Math.min(...data.map(r => r.start)) : null
  const dataEnd = data.length ? Math.max(...data.map(r => r.end)) : null
  return { dataStart, dataEnd, total: requests.length, unique: byKey.size, duplicates, waves: waves.map(w => w.items.length), cascadeDepth: waves.length, bytes: requests.reduce((s, r) => s + (r.bytes ?? 0), 0) }
}

async function main() {
  const require = createRequire(import.meta.url)
  const { chromium } = process.env.PLAYWRIGHT_MODULE ? require(process.env.PLAYWRIGHT_MODULE) : await import('playwright')
  const server = startServer()
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const base = `http://127.0.0.1:${server.address().port}`
  const browser = await chromium.launch()
  const rows = []
  try {
    for (const screen of [...SCREENS, ...EXTRA].filter(s => !ONLY.length || ONLY.includes(s.id))) {
      setCurrentRole(screen.role ?? 'user')
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-CO' })
      const page = await context.newPage()
      const t0 = { v: 0 }
      await page.addInitScript(([role]) => { if (role) { localStorage.setItem('elevation_token', 'sintetico'); localStorage.setItem('elevation_role', role) } localStorage.setItem('elv_lang', 'es') }, [screen.role])
      const requests = []
      await page.route('**/api/**', async (route) => {
        const request = route.request(); const start = Date.now() - t0.v
        const response = await route.fetch(); await new Promise(r => setTimeout(r, DELAY))
        const body = await response.body()
        requests.push({ key: requestKey(request.method(), request.url()), start, end: Date.now() - t0.v, bytes: body.length, aborted: false })
        await route.fulfill({ response, body })
      })
      page.on('requestfailed', req => { if (/\/api\//.test(req.url())) requests.push({ key: requestKey(req.method(), req.url()), start: Date.now() - t0.v, end: Date.now() - t0.v, bytes: 0, aborted: true }) })
      t0.v = Date.now()
      await page.goto(base + screen.path, { waitUntil: 'networkidle' })
      const contentAt = await page.evaluate(() => performance.getEntriesByType('paint').find(p => p.name === 'first-contentful-paint')?.startTime ?? null)
      rows.push({ screen: screen.id, label: screen.label, path: screen.path, fcp: contentAt, ...summarize(requests.filter(r => !r.aborted)), aborted: requests.filter(r => r.aborted).length, list: requests.map(r => `${r.key} @${r.start}-${r.end}`) })
      await context.close()
    }
  } finally { await browser.close(); server.close() }
  if (process.argv.includes('--json')) { console.log(JSON.stringify({ delayMs: DELAY, rows }, null, 2)); return }
  console.log(`Peticiones a /api/** por pantalla (respuesta retrasada ${DELAY} ms; «oleadas» = grupos de peticiones en paralelo, una tras otra)`)
  for (const r of rows) console.log(`${r.label.padEnd(18)} ${String(r.total).padStart(2)} peticiones (${r.unique} distintas) · oleadas ${JSON.stringify(r.waves)} · duplicadas ${r.duplicates.map(d => `${d.key}×${d.count}`).join(', ') || '-'} · datos desde ${r.dataStart ?? '-'} ms hasta ${r.dataEnd ?? '-'} ms · ${(r.bytes / 1000).toFixed(1)} kB`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { console.error('FAIL', error.message); process.exit(1) })
