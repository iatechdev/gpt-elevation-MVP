// ES-198 (PERF-04): qué fuentes se descargan y cuánto CSS se usa en cada pantalla. SOLO en equipo local o de QA, NUNCA en CI; Playwright no es dependencia del repositorio.
// Usa el mismo servidor sintético que `perf-lighthouse.mjs` (dist/ con gzip + datos fijos de /api/**): mide el frontend, no Railway ni Supabase.
// Uso (desde frontend/):  npx vite build && PLAYWRIGHT_MODULE=<ruta a playwright> node scripts/perf-assets.mjs [--json]
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { startServer, SCREENS } from './perf-lighthouse.mjs'

/** Nombre legible de un archivo de fuente a partir de su URL (sin el hash de Vite). */
export const fontName = url => path.basename(new URL(url, 'http://x').pathname).replace(/\.woff2?$/, '').replace(/-[A-Za-z0-9_-]{8}$/, '')

/** Bytes de CSS usados / totales a partir de la cobertura de Chromium. */
export function coverageTotals(entries) {
  const total = entries.reduce((sum, entry) => sum + entry.text.length, 0)
  const used = entries.reduce((sum, entry) => sum + entry.ranges.reduce((acc, range) => acc + range.end - range.start, 0), 0)
  return { used, total, unused: total - used }
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
    for (const screen of SCREENS) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-CO' })
      const page = await context.newPage()
      await page.addInitScript(([role]) => { if (role) { localStorage.setItem('elevation_token', 'sintetico'); localStorage.setItem('elevation_role', role) } localStorage.setItem('elv_lang', 'es') }, [screen.role])
      const fonts = []
      page.on('response', response => { if (/\.woff2?(\?|$)/.test(response.url())) fonts.push(fontName(response.url())) })
      await page.coverage.startCSSCoverage()
      await page.goto(base + screen.path, { waitUntil: 'networkidle' })
      const css = coverageTotals(await page.coverage.stopCSSCoverage())
      const preloaded = await page.evaluate(() => document.querySelectorAll('link[rel=preload][as=font]').length)
      rows.push({ screen: screen.id, fonts, cssUsedKb: css.used / 1000, cssTotalKb: css.total / 1000, fontPreloads: preloaded })
      await context.close()
    }
  } finally { await browser.close(); server.close() }
  if (process.argv.includes('--json')) { console.log(JSON.stringify(rows, null, 2)); return }
  for (const row of rows) console.log(`${row.screen.padEnd(9)} fuentes: ${row.fonts.join(', ') || '-'} | CSS usado ${row.cssUsedKb.toFixed(0)}/${row.cssTotalKb.toFixed(0)} kB | precargas de fuente: ${row.fontPreloads}`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { console.error('FAIL', error.message); process.exit(1) })
