// ES-195 (PERF-01): medición de rendimiento con Lighthouse de 6 pantallas, repetible. SOLO en equipo local o de QA, NUNCA en CI; Lighthouse NO es dependencia del repositorio.
//
// Qué hace: sirve `dist/` con compresión gzip y reserva de rutas de la SPA (como lo haría un hosting estático decente) y responde `/api/**` con DATOS SINTÉTICOS fijos
// (no es el backend real: mide el peso y el trabajo del frontend, no la latencia de Railway ni de Supabase; eso es ES-202). Abre Chrome, deja una sesión sintética
// en localStorage y corre Lighthouse (móvil, 4G lenta simulada, CPU x4 = valores por defecto de Lighthouse para móvil) 3 veces por pantalla; informa la MEDIANA.
//
// Uso (desde frontend/):
//   1) npm i lighthouse@13.5.0 --prefix <carpeta fuera del repo>        (una vez; versión exacta, publicada el 2026-09-18)
//   2) npx vite build
//   3) LH_DIR=<carpeta fuera del repo> CHROME_PATH=<chrome o chromium> node scripts/perf-lighthouse.mjs [--runs 3] [--only landing,login] [--out resultado.json]
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import zlib from 'node:zlib'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dist = path.join(root, 'dist')
const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i === -1 ? fallback : process.argv[i + 1] }
const RUNS = Number(arg('runs', 3))
const ONLY = arg('only', '')?.split(',').filter(Boolean)
const OUT = arg('out', '')

export const SCREENS = [
  { id: 'landing', label: 'Landing', path: '/', role: null },
  { id: 'login', label: 'Entrar', path: '/login', role: null },
  { id: 'space', label: 'Mi espacio', path: '/app/dashboard', role: 'user' },
  { id: 'chat', label: 'Chat', path: '/app/chat', role: 'user' },
  { id: 'skillmap', label: 'Skill Map', path: '/app/skill-map', role: 'user' },
  { id: 'panel', label: 'Panel profesional', path: '/therapist/dashboard', role: 'therapist' },
]

export const median = values => { const s = [...values].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2 }

// ---- datos sintéticos (formas mínimas de las respuestas que cada pantalla pide; sin personas reales) ----
// Mapa de competencias sintético: 18 habilidades (9 transversales y 9 de dominio) con evaluación propia y una revisada; claves y textos inventados, sin personas.
const skillMap = () => ({
  catalogVersion: 1,
  skills: Array.from({ length: 18 }, (_, i) => {
    const level = (i % 4) + 1
    const track = (authoring, state) => ({ level, state, stale: false, catalogOutdated: false, confidence: 'medium', confidenceReason: { es: 'Sintético', en: 'Synthetic' }, evidenceCount: 2, authoring, rationale: null, needsReview: false })
    return {
      skillKey: `sintetica_${i + 1}`, type: i < 9 ? 'transversal' : 'domain', labels: { es: `Capacidad sintética ${i + 1}`, en: `Synthetic capability ${i + 1}` },
      rubric: { levels: Object.fromEntries([1, 2, 3, 4].map(n => [String(n), { es: `Nivel ${n}`, en: `Level ${n}` }])), source: 'sintético', verifiedAt: '2026-11-01' },
      self: i % 3 === 2 ? null : track('person', 'initial'), review: i % 5 === 0 ? track('person', 'reviewed') : null, state: i % 3 === 2 ? 'no_evidence' : 'initial',
    }
  }),
})
const apiBody = (route, role) => {
  if (route === '/api/session') return { role, onboardingCompleted: true }
  if (route === '/api/therapist/pacientes') return []
  if (route === '/api/sessions/therapist/upcoming') return []
  if (route === '/api/therapist/alerts') return { inactivePatients: [], notableProgress: [] }
  if (route === '/api/therapist/prompt') return { hasPrompt: false, content: null, active: null, pending: null, rejected: null }
  if (route === '/api/consents') return { consents: [] }
  if (route === '/api/ai/usage') return { configured: false }
  if (route === '/api/skill-map') return skillMap()
  return null
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.png': 'image/png', '.ico': 'image/x-icon', '.webp': 'image/webp' }
const COMPRESSIBLE = /^(text\/|application\/json|image\/svg)/

export function startServer(log = new Map()) {
  const cache = new Map()
  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://x'); const pathname = decodeURIComponent(url.pathname)
    if (pathname === '/__seed') { // deja la sesión sintética del rol pedido en localStorage del origen
      const role = url.searchParams.get('role') ?? 'user'
      res.writeHead(200, { 'content-type': 'text/html' })
      return res.end(`<!doctype html><script>localStorage.setItem('elevation_token','sintetico');localStorage.setItem('elevation_role','${role}');localStorage.setItem('elv_lang','es')</script>ok`)
    }
    if (pathname.startsWith('/api/')) {
      log.set(pathname, (log.get(pathname) ?? 0) + 1)
      const role = req.headers.authorization?.includes('sintetico') ? (url.searchParams.get('role') ?? currentRole) : currentRole
      const body = apiBody(pathname, role)
      res.writeHead(body === null ? 200 : 200, { 'content-type': 'application/json', 'cache-control': 'no-store' })
      return res.end(JSON.stringify(body ?? []))
    }
    let file = path.join(dist, pathname)
    if (!file.startsWith(dist) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(dist, 'index.html')
    const ext = path.extname(file); const type = MIME[ext] ?? 'application/octet-stream'
    const immutable = pathname.startsWith('/assets/')
    const headers = { 'content-type': type, 'cache-control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache' }
    const raw = fs.readFileSync(file)
    if (COMPRESSIBLE.test(type) && /\bgzip\b/.test(req.headers['accept-encoding'] ?? '')) {
      if (!cache.has(file)) cache.set(file, zlib.gzipSync(raw, { level: 9 }))
      res.writeHead(200, { ...headers, 'content-encoding': 'gzip', vary: 'accept-encoding' }); return res.end(cache.get(file))
    }
    res.writeHead(200, headers); res.end(raw)
  })
  return server
}

let currentRole = 'user'

async function main() {
  if (!process.env.LH_DIR) throw new Error('Falta LH_DIR (carpeta donde instalaste lighthouse@13.5.0; ver el encabezado)')
  if (!fs.existsSync(path.join(dist, 'index.html'))) throw new Error('Falta dist/: corre antes `npx vite build`')
  const req = createRequire(path.join(path.resolve(process.env.LH_DIR), 'package.json'))
  const lhPkg = JSON.parse(fs.readFileSync(req.resolve('lighthouse/package.json'), 'utf8'))
  const { default: lighthouse } = await import(pathToFileURL(req.resolve('lighthouse')).href)
  const chromeLauncher = await import(pathToFileURL(req.resolve('chrome-launcher')).href)
  const apiLog = new Map()
  const server = startServer(apiLog)
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const base = `http://127.0.0.1:${server.address().port}`
  const chrome = await chromeLauncher.launch({ chromePath: process.env.CHROME_PATH, chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu'] })
  const results = []
  try {
    for (const screen of SCREENS.filter(s => !ONLY.length || ONLY.includes(s.id))) {
      currentRole = screen.role ?? 'user'
      if (screen.role) { // sesión sintética del rol; Lighthouse vacía caché y almacenamiento (carga en frío) pero NO local_storage (clearStorageTypes)
        const seed = await fetch(`http://127.0.0.1:${chrome.port}/json/new?${encodeURIComponent(`${base}/__seed?role=${screen.role}`)}`, { method: 'PUT' })
        if (!seed.ok) throw new Error('No se pudo abrir la página de sesión sintética')
        await new Promise(r => setTimeout(r, 1500))
      }
      const runs = []
      for (let i = 0; i < RUNS; i += 1) {
        apiLog.clear()
        const { lhr } = await lighthouse(`${base}${screen.path}`, { port: chrome.port, output: 'json', logLevel: 'error', clearStorageTypes: ['appcache', 'cookies', 'file_systems', 'indexeddb', 'shader_cache', 'websql', 'service_workers', 'cache_storage'], onlyCategories: ['performance'] })
        const a = lhr.audits
        const requests = a['network-requests'].details.items
        runs.push({
          lcp: a['largest-contentful-paint'].numericValue, tbt: a['total-blocking-time'].numericValue, cls: a['cumulative-layout-shift'].numericValue,
          fcp: a['first-contentful-paint'].numericValue, transfer: a['total-byte-weight'].numericValue, requests: requests.length, finalUrl: lhr.finalDisplayedUrl,
          score: lhr.categories.performance.score, screenshot: i === 0 ? a['final-screenshot']?.details?.data : undefined, apiCalls: [...apiLog.keys()],
        })
      }
      const pick = k => median(runs.map(r => r[k]))
      results.push({ ...screen, runs, median: { lcp: pick('lcp'), tbt: pick('tbt'), cls: pick('cls'), fcp: pick('fcp'), transfer: pick('transfer'), requests: pick('requests'), score: pick('score') }, finalUrl: runs[0].finalUrl, apiCalls: runs[0].apiCalls })
      console.log(`${screen.label}: LCP ${(pick('lcp') / 1000).toFixed(2)} s · TBT ${Math.round(pick('tbt'))} ms · CLS ${pick('cls').toFixed(3)} · ${(pick('transfer') / 1000).toFixed(0)} kB · ${pick('requests')} peticiones  (${runs[0].finalUrl.replace(base, '')})`)
    }
  } finally { await chrome.kill(); server.close() }
  for (const r of results) for (const run of r.runs) if (run.screenshot) { r.screenshot = run.screenshot; delete run.screenshot }
  const report = { generatedAt: new Date().toISOString(), lighthouse: lhPkg.version, node: process.version, runsPerScreen: RUNS, results }
  if (OUT) fs.writeFileSync(OUT, JSON.stringify(report, null, 2))
  return report
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { console.error('FAIL', error.message); process.exit(1) })
