// ES-195 (PERF-01): informe de peso del frontend, repetible. `npm run perf:report` construye (en una carpeta temporal, con sourcemaps) y reporta:
//   1. cada bloque JS/CSS: tamaño bruto y gzip (nivel 9), ordenado de mayor a menor;
//   2. la carga inicial (lo que referencia index.html) en bruto y gzip, junto al presupuesto vigente de `npm run build:check`;
//   3. de qué está hecho el bloque de entrada: módulos agrupados por paquete (node_modules/<paquete>) o por carpeta de src/, con el tamaño del CÓDIGO FUENTE
//      de cada grupo (sourcesContent). Ese tamaño es el del fuente, NO el del bundle minificado: sirve para ordenar y comparar, no para sumar al peso real.
// Sin dependencias nuevas. No cambia dist/ ni ningún archivo del repositorio. Uso: npm run perf:report [-- --json]
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import zlib from 'node:zlib'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { LIMITS } from './check-bundle-size.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const kb = bytes => bytes / 1000
const fmt = bytes => kb(bytes).toFixed(2).padStart(9)
const gz = buf => zlib.gzipSync(buf, { level: 9 }).length

/** Agrupa las rutas de un sourcemap: paquete de node_modules o carpeta de src (dos niveles). */
export function groupOf(source) {
  const clean = source.replace(/\\/g, '/')
  const nm = clean.lastIndexOf('node_modules/')
  if (nm !== -1) {
    const parts = clean.slice(nm + 'node_modules/'.length).split('/')
    return parts[0].startsWith('@') ? `${parts[0]}/${parts[1]}` : parts[0]
  }
  const src = clean.lastIndexOf('/src/')
  if (src !== -1) return 'src/' + clean.slice(src + 5).split('/').slice(0, -1).slice(0, 2).join('/')
  return '(otros)'
}

export function summarizeMap(map) {
  const groups = new Map()
  ;(map.sources ?? []).forEach((source, i) => {
    const size = Buffer.byteLength(map.sourcesContent?.[i] ?? '', 'utf8')
    const group = groupOf(source)
    const row = groups.get(group) ?? { group, modules: 0, sourceBytes: 0 }
    row.modules += 1; row.sourceBytes += size
    groups.set(group, row)
  })
  return [...groups.values()].sort((a, b) => b.sourceBytes - a.sourceBytes)
}

export function chunkRows(dist) {
  const dir = path.join(dist, 'assets')
  return fs.readdirSync(dir).filter(f => /\.(js|css)$/.test(f)).map(file => {
    const buf = fs.readFileSync(path.join(dir, file))
    return { file, type: path.extname(file).slice(1), raw: buf.length, gzip: gz(buf) }
  }).sort((a, b) => b.raw - a.raw)
}

export function initialFiles(dist) {
  const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8')
  const find = re => [...html.matchAll(re)].map(m => m[1])
  return {
    js: find(/<(?:script|link)\b[^>]*\b(?:src|href)="\/(assets\/[^"]+\.js)"/g),
    css: find(/<link\b[^>]*\brel="stylesheet"[^>]*\bhref="\/(assets\/[^"]+\.css)"/g),
  }
}

function main() {
  const json = process.argv.includes('--json')
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'perf-report-'))
  try {
    const build = spawnSync('npx', ['vite', 'build', '--outDir', out, '--emptyOutDir', '--sourcemap'], { cwd: root, encoding: 'utf8', shell: process.platform === 'win32' })
    if (build.status !== 0) { console.error((build.stdout + build.stderr).slice(-1500)); process.exit(1) }
    const rows = chunkRows(out)
    const initial = initialFiles(out)
    const sizeOf = files => files.reduce((acc, f) => { const buf = fs.readFileSync(path.join(out, f)); return { raw: acc.raw + buf.length, gzip: acc.gzip + gz(buf) } }, { raw: 0, gzip: 0 })
    const initialJs = sizeOf(initial.js), initialCss = sizeOf(initial.css)
    const entry = initial.js.find(f => /index-/.test(f)) ?? initial.js[0]
    const entryMap = JSON.parse(fs.readFileSync(path.join(out, entry + '.map'), 'utf8'))
    const groups = summarizeMap(entryMap)
    const report = {
      generatedAt: new Date().toISOString(), node: process.version,
      initial: { js: { files: initial.js, ...initialJs }, css: { files: initial.css, ...initialCss } },
      budget: LIMITS, chunks: rows.map(({ file, type, raw, gzip }) => ({ file, type, raw, gzip })), entryChunk: entry, entryGroups: groups,
    }
    if (json) { console.log(JSON.stringify(report, null, 2)); return }
    console.log(`ES-195 · informe de peso (${report.generatedAt}, Node ${process.version}); kB = 1000 bytes\n`)
    console.log('Carga inicial (lo que referencia index.html)')
    console.log(`  JS : ${fmt(initialJs.raw)} kB bruto · ${fmt(initialJs.gzip)} kB gzip   (presupuesto vigente: ${LIMITS.initialJsGzipKb} kB gzip)  [${initial.js.join(', ')}]`)
    console.log(`  CSS: ${fmt(initialCss.raw)} kB bruto · ${fmt(initialCss.gzip)} kB gzip   (presupuesto vigente: ${LIMITS.initialCssGzipKb} kB gzip)  [${initial.css.join(', ')}]\n`)
    console.log(`Bloques (${rows.length}) — bruto / gzip, kB`)
    for (const r of rows) console.log(`  ${fmt(r.raw)} ${fmt(r.gzip)}  ${r.type.padEnd(3)} ${r.file}`)
    console.log(`\nBloque de entrada ${entry}: ${groups.length} grupos; tamaño del CÓDIGO FUENTE (no del bundle) por grupo`)
    for (const g of groups.slice(0, 25)) console.log(`  ${fmt(g.sourceBytes)} kB fuente · ${String(g.modules).padStart(4)} módulos  ${g.group}`)
    if (groups.length > 25) console.log(`  … y ${groups.length - 25} grupos más (usa --json para verlos)`)
  } finally { fs.rmSync(out, { recursive: true, force: true }) }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
