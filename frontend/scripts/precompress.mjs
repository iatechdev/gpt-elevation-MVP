// ES-201: precomprime con brotli (calidad máxima) los estáticos de dist/ después de `vite build`. El servidor (backend/utils/frontendStatic.js) sirve el `.br` cuando el
// navegador envía `Accept-Encoding: br`; si no existe o el navegador no lo acepta, sigue el gzip de siempre. Sin dependencias: solo `zlib` de Node.
// Uso: node scripts/precompress.mjs [dist]   (lo ejecuta `npm run build`)
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { fileURLToPath } from 'node:url'

// Solo texto que se comprime bien. Las fuentes (.woff2) ya vienen comprimidas y las imágenes binarias no ganan nada.
export const COMPRESSIBLE = new Set(['.js', '.css', '.html', '.svg', '.json', '.txt', '.xml', '.map'])
export const MIN_BYTES = 1024

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => (entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)]))
}

/** Escribe `<archivo>.br` junto a cada archivo comprimible de `dist` (si de verdad pesa menos). Devuelve un resumen. */
export function compressDist(dist) {
  const summary = { files: 0, skipped: 0, rawBytes: 0, brotliBytes: 0 }
  for (const file of walk(dist)) {
    if (!COMPRESSIBLE.has(path.extname(file)) || file.endsWith('.br')) continue
    const raw = fs.readFileSync(file)
    if (raw.length < MIN_BYTES) { summary.skipped += 1; continue }
    const packed = zlib.brotliCompressSync(raw, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11, [zlib.constants.BROTLI_PARAM_SIZE_HINT]: raw.length } })
    if (packed.length >= raw.length) { summary.skipped += 1; continue }
    fs.writeFileSync(`${file}.br`, packed)
    summary.files += 1; summary.rawBytes += raw.length; summary.brotliBytes += packed.length
  }
  return summary
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dist = path.resolve(process.argv[2] ?? 'dist')
  if (!fs.existsSync(path.join(dist, 'index.html'))) { console.error('Falta dist/index.html: corre antes `vite build`'); process.exit(1) }
  const { files, skipped, rawBytes, brotliBytes } = compressDist(dist)
  console.log(`Brotli: ${files} archivos (${skipped} omitidos), ${(rawBytes / 1000).toFixed(1)} kB → ${(brotliBytes / 1000).toFixed(1)} kB`)
}
