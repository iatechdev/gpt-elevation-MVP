// ES-129: presupuesto de tamaño del frontend. Se ejecuta después de `vite build` (npm run build:check) y en CI.
//   - Carga inicial de JS (script de entrada + modulepreload de index.html), comprimida con gzip.
//   - ES-130: CSS inicial (hojas de estilo enlazadas en index.html), comprimido con gzip.
//   - Ningún bloque JS pasa del límite que usa Vite para su aviso de «chunk grande».
// Los límites son una PROPUESTA de Dev-Claude (medido: 135 kB gzip la carga inicial, 433 kB el mayor bloque); los aprueba Mauricio.
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { fileURLToPath } from 'node:url'

export const LIMITS = { initialJsGzipKb: 150, initialCssGzipKb: 20, chunkRawKb: 500 }

const kb = bytes => bytes / 1000

export function checkBundle(distDir, limits = LIMITS) {
  const html = fs.readFileSync(path.join(distDir, 'index.html'), 'utf8')
  const initial = [...html.matchAll(/<(?:script|link)\b[^>]*\b(?:src|href)="\/(assets\/[^"]+\.js)"/g)].map(m => m[1])
  if (!initial.length) throw new Error('index.html no referencia ningún JS de entrada')
  const gzipKb = initial.reduce((sum, file) => sum + kb(zlib.gzipSync(fs.readFileSync(path.join(distDir, file)), { level: 9 }).length), 0)
  const initialCss = [...html.matchAll(/<link\b[^>]*\brel="stylesheet"[^>]*\bhref="\/(assets\/[^"]+\.css)"/g)].map(m => m[1])
  const cssGzipKb = initialCss.reduce((sum, file) => sum + kb(zlib.gzipSync(fs.readFileSync(path.join(distDir, file)), { level: 9 }).length), 0)
  const chunks = fs.readdirSync(path.join(distDir, 'assets')).filter(f => f.endsWith('.js'))
    .map(f => ({ file: f, rawKb: kb(fs.statSync(path.join(distDir, 'assets', f)).size) }))
  const biggest = chunks.reduce((a, b) => (b.rawKb > a.rawKb ? b : a))
  // ES-196: React vive en UN solo bloque (sin duplicados entre vendors y entrada) y los vendors estables tienen bloque propio.
  const reactCopies = chunks.filter(c => fs.readFileSync(path.join(distDir, 'assets', c.file), 'utf8').includes('react.transitional.element')).map(c => c.file)
  const vendorChunks = chunks.filter(c => c.file.startsWith('vendor-')).map(c => c.file)
  const problems = []
  if (reactCopies.length > 1) problems.push(`React duplicado en ${reactCopies.length} bloques: ${reactCopies.join(', ')}`)
  if (!vendorChunks.some(f => f.startsWith('vendor-react-')) || !vendorChunks.some(f => f.startsWith('vendor-router-'))) problems.push('faltan los bloques de vendors (vendor-react, vendor-router): revisa codeSplitting en vite.config.ts')
  if (gzipKb > limits.initialJsGzipKb) problems.push(`carga inicial de JS: ${gzipKb.toFixed(1)} kB gzip > ${limits.initialJsGzipKb} kB`)
  if (cssGzipKb > limits.initialCssGzipKb) problems.push(`CSS inicial: ${cssGzipKb.toFixed(1)} kB gzip > ${limits.initialCssGzipKb} kB`)
  if (biggest.rawKb > limits.chunkRawKb) problems.push(`bloque ${biggest.file}: ${biggest.rawKb.toFixed(1)} kB > ${limits.chunkRawKb} kB`)
  return { initial, gzipKb, initialCss, cssGzipKb, biggest, chunkCount: chunks.length, reactCopies, vendorChunks, problems }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = checkBundle(path.resolve(process.argv[2] ?? 'dist'))
  console.log(`Carga inicial: ${result.initial.length} archivos JS, ${result.gzipKb.toFixed(1)} kB gzip (límite ${LIMITS.initialJsGzipKb})`)
  console.log(`CSS inicial: ${result.initialCss.length} archivos, ${result.cssGzipKb.toFixed(1)} kB gzip (límite ${LIMITS.initialCssGzipKb})`)
  console.log(`Mayor bloque: ${result.biggest.file}, ${result.biggest.rawKb.toFixed(1)} kB (límite ${LIMITS.chunkRawKb}); ${result.chunkCount} bloques en total`)
  console.log(`Vendors: ${result.vendorChunks.join(', ')}; React en ${result.reactCopies.length} bloque(s)`)
  if (result.problems.length) {
    for (const p of result.problems) console.error('PRESUPUESTO EXCEDIDO — ' + p)
    process.exit(1)
  }
  console.log('Presupuesto de tamaño: OK')
}
