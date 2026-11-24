// [QA-Claude-3] JS y CSS iniciales (gzip) de un build: suma los archivos que index.html carga al arrancar (script, modulepreload, stylesheet). Uso: node qa/jsgz.cjs <carpeta-dist> [...]
const fs = require('fs'), path = require('path'), zlib = require('zlib')
for (const dir of process.argv.slice(2)) {
  const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8'); const refs = [...html.matchAll(/(?:src|href)="(\/[^"]+\.(?:js|css))"/g)].map(m => m[1]); let js = 0, css = 0, nj = 0
  for (const r of new Set(refs)) { const b = fs.readFileSync(path.join(dir, r)); const g = zlib.gzipSync(b, { level: 9 }).length; if (r.endsWith('.js')) { js += g; nj++ } else css += g }
  console.log(path.basename(dir), `JS inicial: ${nj} archivos, ${(js / 1000).toFixed(1)} kB gzip (límite 150) | CSS inicial: ${(css / 1000).toFixed(1)} kB gzip (límite 20)`)
}
