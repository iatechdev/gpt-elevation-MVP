// [QA-Claude-3] Mutaciones de #342 (solo qa/). Worktree de pruebas ($QA3_DIR/wt) con main + #342 fusionados; corre `npm test` y revierte.
const fs = require('fs'), cp = require('child_process'), path = require('path')
const W = (process.env.QA3_DIR || 'C:/Users/Usuario/tools/qa3') + '/wt/frontend'
const rd = f => fs.readFileSync(path.join(W, f), 'utf8'), wr = (f, s) => fs.writeFileSync(path.join(W, f), s)
const PC = 'src/components/landing/PlanCards.tsx', LP = 'src/components/landing/LandingPlans.tsx'
const M = [
  ['M1 quitar migrated de PublicFrame en /pricing', 'src/pages/PricingPage.tsx', s => s.replace('<PublicFrame migrated>', '<PublicFrame>')],
  ['M2 nombre accesible del enlace sin el texto visible (label-content-name-mismatch)', PC, s => s.replace("aria-label={`${text('landing.pricing.register')} · ${plan[`name_${lang}`]}`}", "aria-label={`${plan[`name_${lang}`]}`}")],
  ['M3 perder aria-describedby del estado en el enlace', PC, s => s.replace("aria-describedby={disabled ? 'landing-pricing-action-status' : undefined}\n          aria-disabled", "aria-describedby={undefined}\n          aria-disabled")],
  ['M4 «Gratis» para precios bajos (precio inventado)', 'src/pricing/plans.ts', s => s.replace('plan.priceCents === 0 ? free', 'plan.priceCents < 600 ? free')],
  ['M5 quitar los marcadores de carga (salto de layout)', LP, s => s.replace('Array.from({ length: expected === 0 ? 1 : slots }', 'Array.from({ length: 0 }')],
  ['M13 no guardar el número de planes (el marcador no se adapta)', LP, s => s.replace("sessionStorage.setItem(COUNT_KEY, String(Math.min(catalog.plans.length, 8)))", 'void 0')],
  ['M14 el ancla #planes recupera el hueco de cabecera', 'src/pricing/pricing.css', s => s.replace('scroll-margin-top: 1rem', 'scroll-margin-top: 7rem')],
  ['M6 quitar la reserva de altura .pp-state', 'src/pricing/pricing.css', s => s.replace(/min-height: calc\(14rem \+ 27px\);/, '')],
  ['M7 el plan elegido ya no se marca', PC, s => s.replace("selected === plan.id ? 'pp-plan--sel' : ''", "''")],
  ['M8 quitar el chip «Destacado»', PC, s => s.replace("{plan.isHighlighted && <Chip>{text('landing.pricing.featured')}</Chip>}", '')],
  ['M9 estilo en línea con color fijo', PC, s => s.replace('<div className="pp-grid">', '<div className="pp-grid" style={{ color: "#123456" }}>')],
  ['M10 el enlace deshabilitado sigue navegable (sin preventDefault)', PC, s => s.replace('if (disabled) event.preventDefault()', 'void 0')],
  ['M11 el botón con sesión no se deshabilita con solicitud pendiente', PC, s => s.replace('<Button className="pp-cta" disabled={disabled}', '<Button className="pp-cta" disabled={false}')],
  ['M12 volver a LandingHeader propio en /pricing', 'src/pages/PricingPage.tsx', s => s.replace("import { PublicFrame } from '../shell/frames'", "import { PublicFrame } from '../shell/frames'\nimport { LandingHeader } from '../components/landing/LandingHeader'").replace('<PublicFrame migrated>', '<PublicFrame migrated><LandingHeader />')],
]
const run = () => { const r = cp.spawnSync('npm', ['test'], { cwd: W, encoding: 'utf8', shell: true }); const o = (r.stdout || '') + (r.stderr || ''); const m = k => (o.match(new RegExp('# ' + k + ' (\\d+)')) || [])[1]; return { pass: m('pass'), fail: m('fail'), names: [...o.matchAll(/^not ok \d+ - (.{0,110})/gm)].map(x => x[1]).slice(0, 2) } }
{ const c = run(); console.log('CONTROL sin mutar: pass=' + c.pass + ' fail=' + c.fail) }
for (const [name, file, fn] of M) {
  const orig = rd(file); const mut = fn(orig)
  if (mut === orig) { console.log('SIN EFECTO (no aplicó):', name); continue }
  wr(file, mut); const r = run(); wr(file, orig)
  console.log(`${Number(r.fail) > 0 ? 'DETECTADA' : 'NO DETECTADA'} | ${name} | pass=${r.pass} fail=${r.fail} ${r.names.join(' ; ')}`)
}
