// QA-Claude-2 — contraste WCAG independiente de los tokens ES-37.
// Uso: node qa/es37-contrast.cjs <ruta a tokens.css>
const fs = require('fs')
const css = fs.readFileSync(process.argv[2], 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
const block = (sel) => { const i = css.indexOf(sel + ' {'); if (i < 0) return ''; return css.slice(css.indexOf('{', i) + 1, css.indexOf('}', i)) }
const vars = (b) => Object.fromEntries([...b.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map(m => [m[1], m[2].trim()]))
const light = vars(block(':root')), darkOver = vars(block('.elv-dark'))
const resolve = (v, map, depth = 0) => { const m = /^var\((--[\w-]+)\)$/.exec(v || ''); return m && depth < 6 ? resolve(map[m[1]], map, depth + 1) : v }
const mk = (over) => { const map = { ...light, ...over }; return (n) => resolve(map[n], map) }
const lum = (h) => { const n = parseInt(h.slice(1).length === 3 ? h.slice(1).replace(/./g, c => c + c) : h.slice(1), 16); return [16, 8, 0].map(s => ((n >> s) & 255) / 255).map(c => c <= .03928 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4).reduce((a, c, i) => a + c * [.2126, .7152, .0722][i], 0) }
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + .05) / (y + .05) }
const themes = { claro: mk({}), oscuro: mk(darkOver) }
// [fg, bg, mínimo, descripción]
const pairs = [
  ['--elv-text-1', '--elv-bg', 4.5], ['--elv-text-1', '--elv-card', 4.5], ['--elv-text-1', '--elv-surface', 4.5], ['--elv-text-1', '--elv-muted-bg', 4.5],
  ['--elv-text-2', '--elv-bg', 4.5], ['--elv-text-2', '--elv-card', 4.5], ['--elv-text-2', '--elv-surface', 4.5], ['--elv-text-2', '--elv-muted-bg', 4.5],
  ['--elv-text-3', '--elv-bg', 4.5], ['--elv-text-3', '--elv-card', 4.5], ['--elv-text-3', '--elv-surface', 4.5], ['--elv-text-3', '--elv-muted-bg', 4.5],
  ['--elv-action-text', '--elv-action', 4.5], ['--elv-text-1', '--elv-action-soft', 4.5], ['--elv-text-2', '--elv-action-soft', 4.5],
  ['--elv-link', '--elv-bg', 4.5], ['--elv-link', '--elv-card', 4.5], ['--elv-link', '--elv-surface', 4.5], ['--elv-link', '--elv-action-soft', 4.5],
  ['--elv-ai', '--elv-ai-bg', 4.5], ['--elv-ai', '--elv-card', 4.5], ['--elv-success', '--elv-success-bg', 4.5], ['--elv-success', '--elv-card', 4.5],
  ['--elv-warning', '--elv-warning-bg', 4.5], ['--elv-warning', '--elv-card', 4.5], ['--elv-error', '--elv-error-bg', 4.5], ['--elv-error', '--elv-card', 4.5],
  ['--elv-info', '--elv-info-bg', 4.5], ['--elv-info', '--elv-card', 4.5],
  ['--elv-line-control', '--elv-bg', 3], ['--elv-line-control', '--elv-card', 3], ['--elv-focus', '--elv-bg', 3], ['--elv-focus', '--elv-card', 3], ['--elv-action', '--elv-bg', 3],
  // informativo: ocre decorativo NO es texto
  ['--elv-brand', '--elv-bg', 0], ['--elv-brand', '--elv-card', 0], ['--elv-line', '--elv-bg', 0],
]
let fail = 0
for (const [tn, get] of Object.entries(themes)) for (const [f, b, min] of pairs) {
  const fg = get(f), bg = get(b); if (!/^#/.test(fg || '') || !/^#/.test(bg || '')) { console.log(tn, f, b, 'NO RESUELTO', fg, bg); fail++; continue }
  const r = ratio(fg, bg), ok = r >= min
  if (!ok) fail++
  console.log(`${ok ? 'OK  ' : 'FALLA'} ${tn.padEnd(6)} ${f} ${fg} sobre ${b} ${bg} = ${r.toFixed(2)}:1 (mín ${min || 'informativo'})`)
}
console.log('FALLAS:', fail); process.exit(fail ? 1 : 0)
