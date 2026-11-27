// Genera TEXTOS.md (tabla clave→texto ES/EN con estado) y elevation-es408.html (un solo archivo).
const fs = require('fs')
process.chdir(__dirname)
const { T, RETIRAR } = require('./textos.js')
const keys = T.map(r => r[0]); const dup = keys.filter((k, i) => keys.indexOf(k) !== i)
if (dup.length) throw new Error('claves repetidas: ' + dup.join(', '))
const cell = s => String(s).replace(/\n/g, ' ⏎ ').replace(/\|/g, '\\|')
const count = s => T.filter(r => r[1] === s).length
let md = '# ES-408 · Textos ES/EN (clave → texto)\n\n[UX/UI-Claude] Generado desde `textos.js` con `node build.cjs` (misma fuente que el prototipo). Estado: **igual** (existe hoy y no cambia en su sentido), **cambia**, **nuevo**. Las claves nuevas son propuestas de nombre. Los textos EN y los «igual» deben cotejarse contra `shared/landing-content.json` y `evidence/copy.ts` al implementar: el EN de las claves existentes se escribió para el prototipo.\n\n'
md += `Total: ${T.length} · igual ${count('igual')} · cambia ${count('cambia')} · nuevo ${count('nuevo')} · grupos a retirar ${RETIRAR.length}\n\n| Clave | Estado | ES | EN |\n|---|---|---|---|\n`
md += T.map(r => `| \`${r[0]}\` | ${r[1]} | ${cell(r[2])} | ${cell(r[3])} |`).join('\n')
md += '\n\n## Retirar (de la portada; confirmar antes de borrar claves del CMS)\n\n| Clave(s) | Motivo |\n|---|---|\n' + RETIRAR.map(r => `| ${cell(r[0])} | ${cell(r[1])} |`).join('\n') + '\n'
fs.writeFileSync('TEXTOS.md', md)
let css = fs.readFileSync('styles.css', 'utf8').replace(/url\((\.\.\/auditoria-diagramacion\/prototipo\/fonts\/[^)]+\.woff2)\)/g, (m, p) => 'url(data:font/woff2;base64,' + fs.readFileSync(p).toString('base64') + ')')
const inline = f => '<script>' + fs.readFileSync(f, 'utf8').split('</scr' + 'ipt>').join('<\\/scr' + 'ipt>') + '</scr' + 'ipt>'
const html = fs.readFileSync('index.html', 'utf8').replace('<link rel="stylesheet" href="styles.css">', () => '<style>' + css + '</style>').replace('<script src="textos.js"></script>', () => inline('textos.js')).replace('<script src="app.js"></script>', () => inline('app.js'))
fs.writeFileSync('elevation-es408.html', html)
console.log('TEXTOS.md', T.length, 'claves ·', 'elevation-es408.html', Math.round(html.length / 1024), 'KB')
