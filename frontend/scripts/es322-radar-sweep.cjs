// ES-322 (E266-5): barrido del Radar de 640 a 1360 px de 8 en 8, ES y EN, con 12 capacidades de nombre largo y con N = 5 y 8.
// Mide, por ancho: solapes entre las cajas de los ejes, ejes con scrollWidth > clientWidth y palabras partidas en dos líneas (sin guion). Con BASE_MIN muestra el ancho mínimo sin fallos.
// Chromium, API simulada (page.route), datos SINTÉTICOS (los nombres imitan al catálogo, no son el catálogo publicado).
// Uso: npx vite build && npx vite preview --host 127.0.0.1 --port 4322 --strictPort   y luego
//   ES322_URL=http://127.0.0.1:4322 PLAYWRIGHT_MODULE=<ruta a playwright> [FROM=640 TO=1360 STEP=8] node scripts/es322-radar-sweep.cjs
const assert = require('node:assert/strict')

const NAMES = {
  es: ['Análisis de datos', 'Comunicación', 'Experimentación', 'Pensamiento crítico', 'Colaboración', 'Gestión del tiempo', 'Resolución de problemas', 'Aprendizaje continuo', 'Adaptabilidad', 'Orientación a resultados', 'Liderazgo', 'Creatividad'],
  en: ['Data analysis', 'Communication', 'Experimentation', 'Critical thinking', 'Collaboration', 'Time management', 'Problem solving', 'Continuous learning', 'Adaptability', 'Results orientation', 'Leadership', 'Creativity'],
}
const track = level => (level ? { level, state: 'initial', stale: false, catalogOutdated: false, confidence: 'medium', confidenceReason: { es: 'Respaldo sintético', en: 'Synthetic support' }, evidenceCount: 2, authoring: 'person', rationale: null, needsReview: false } : null)
const skills = n => Array.from({ length: n }, (_, i) => {
  const level = (i % 4) + 1
  return { skillKey: 'sint_' + i, type: 'transversal', labels: { es: NAMES.es[i], en: NAMES.en[i] }, territories: ['dir'],
    rubric: { levels: Object.fromEntries([1, 2, 3, 4].map(k => [String(k), { es: `Criterio ${k}`, en: `Criterion ${k}` }])), source: 'sintético', verifiedAt: '2026-11-01' }, self: track(level), review: null, state: 'initial', review: null }
})

;(async () => {
  const { chromium } = process.env.PLAYWRIGHT_MODULE ? require(process.env.PLAYWRIGHT_MODULE) : await import('playwright')
  const base = process.env.ES322_URL ?? 'http://127.0.0.1:4322'
  assert.ok(['127.0.0.1', 'localhost'].includes(new URL(base).hostname), 'Solo vista previa local')
  const from = Number(process.env.FROM ?? 640), to = Number(process.env.TO ?? 1360), step = Number(process.env.STEP ?? 8)
  const browser = await chromium.launch(); const bad = []; let runs = 0
  for (const lang of ['es', 'en']) for (const n of [12, 8, 5]) {
    const context = await browser.newContext({ viewport: { width: from, height: 900 }, reducedMotion: 'reduce' }); const page = await context.newPage()
    await page.addInitScript(l => { localStorage.setItem('elevation_token', 't'); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elv_lang', l) }, lang)
    await page.route('**/api/**', route => {
      const p = new URL(route.request().url()).pathname
      if (p === '/api/session') return route.fulfill({ json: { role: 'user', onboardingCompleted: true } })
      if (p === '/api/skill-map') return route.fulfill({ json: { catalogVersion: 1, skills: skills(n) } })
      if (p === '/api/consents') return route.fulfill({ json: { consents: [] } })
      return route.fulfill({ json: [] })
    })
    await page.goto(base + '/app/skill-map', { waitUntil: 'networkidle' })
    await page.locator('.skill-map-views').getByRole('button', { name: 'Radar', exact: true }).click()
    await page.locator('.radar-poly').first().waitFor()
    for (let width = from; width <= to; width += step) {
      await page.setViewportSize({ width, height: 900 }); await page.waitForTimeout(60)
      const r = await page.evaluate(() => {
        const poly = document.querySelector('.radar-poly'); const axes = [...poly.querySelectorAll('.radar-axis')]
        const boxes = axes.map(a => a.getBoundingClientRect()); let overlaps = 0
        for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) { const a = boxes[i], b = boxes[j]; if (a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5) overlaps++ }
        const overflow = axes.filter(a => a.scrollWidth > a.clientWidth + 1).length
        let split = 0
        poly.querySelectorAll('.radar-axis b').forEach(b => {
          if (getComputedStyle(b).position === 'absolute') return
          const node = b.firstChild; if (!node) return; const text = node.textContent; const re = /\S+/g; let m
          while ((m = re.exec(text))) { const range = document.createRange(); range.setStart(node, m.index); range.setEnd(node, m.index + m[0].length); if (range.getClientRects().length > 1 && !m[0].includes('-')) split++ }
        })
        return { mode: poly.className.replace(/.*is-/, ''), overlaps, overflow, split }
      })
      runs++
      if (r.overlaps || r.overflow || r.split) bad.push({ lang, n, width, ...r })
    }
    await context.close()
  }
  await browser.close()
  const worst = {}
  for (const b of bad) { const k = `${b.lang}/N=${b.n}`; worst[k] = Math.max(worst[k] ?? 0, b.width) }
  console.log(`${runs} medidas; fallos: ${bad.length}`)
  for (const [k, w] of Object.entries(worst)) console.log(`  ${k}: último ancho con fallo = ${w} px`)
  if (bad.length) { console.log(JSON.stringify(bad.slice(0, 6))); process.exit(1) }
  console.log('ES-322: 0 solapes, 0 desbordes y 0 palabras partidas de 640 a 1360 px')
})().catch(e => { console.error(e); process.exit(1) })
