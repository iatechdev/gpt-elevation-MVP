// QA-Claude-2 — PR #343 mutaciones de la prueba estructural es-291 sobre el clon: FRONTEND=<clon>/frontend node qa/mut343.cjs
const fs = require('fs'), path = require('path'), { execSync } = require('child_process'); const FE = process.env.FRONTEND; const S = path.join(FE, 'src/pages/admin/adminOverview.tsx'), C = path.join(FE, 'src/pages/admin/adminOverview.css')
const oS = fs.readFileSync(S, 'utf8'), oC = fs.readFileSync(C, 'utf8'); const restore = () => { fs.writeFileSync(S, oS); fs.writeFileSync(C, oC) }
const fails = () => { try { execSync('node --test test/es-291-region-grafica.test.mjs', { cwd: FE, stdio: 'pipe', timeout: 120000, shell: true }); return false } catch (e) { return true } }
const M = (name, file, a, b) => { restore(); const src = fs.readFileSync(file, 'utf8'); if (!src.includes(a)) { console.log(`M ${name}: SIN ANCLA`); return } fs.writeFileSync(file, src.replace(a, () => b)); console.log(`M ${name}: ${fails() ? 'DETECTADO' : 'SOBREVIVE'}`); restore() }
console.log('sin mutar: la prueba', fails() ? 'FALLA (mal)' : 'pasa')
const tag = (cls) => (oS.match(new RegExp(`<div className="${cls}"[^>]*>`)) || [''])[0]
for (const cls of ['ao-tablewrap', 'ao-people']) { const t = tag(cls); if (!t) { console.log(`sin ancla ${cls}`); continue }
  M(`quitar tabIndex de ${cls}`, S, t, t.replace(/ tabIndex=\{0\}/, '')); M(`quitar role=region de ${cls}`, S, t, t.replace(/ role="region"/, '')); M(`quitar aria-label de ${cls}`, S, t, t.replace(/ aria-label=\{tr\('[^']+'\)\}/, '')) }
M('reintroducir overflowX en la gráfica', S, '<svg', '<div style={{ overflowX: \'auto\' }}></div><svg')
M('quitar la clase ao-chart del svg', S, 'className="ao-chart"', 'className="otra"')
const m = oC.match(/\.ao-tablewrap \{[^}]*overflow(-x)?: auto/); if (m) M('el css de ao-tablewrap ya no desplaza', C, m[0], m[0].replace(/overflow(-x)?: auto/, 'overflow$1: visible'))
restore(); console.log('clon restaurado')
