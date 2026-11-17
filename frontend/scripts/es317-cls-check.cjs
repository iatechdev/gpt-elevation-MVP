// ES-317: CLS de /app/skill-map con un catálogo de 12 capacidades (no con el mapa vacío). Chromium, API simulada con latencia (page.route), datos SINTÉTICOS.
// Por ancho (390 con CPU ×4 y 1360; ES y EN): suma el CLS total y lo desglosa por elemento que se desplaza (layout-shift sources). Con ES317_MAX falla si el total supera el umbral.
// Uso: npx vite build && npx vite preview --host 127.0.0.1 --port 4317 --strictPort   y luego
//   ES317_URL=http://127.0.0.1:4317 PLAYWRIGHT_MODULE=<ruta a playwright> [ES317_MAX=0.1] [ES317_LATENCY=120] node scripts/es317-cls-check.cjs
const assert = require('node:assert/strict')
const NAMES = {
  es: ['Análisis de datos', 'Comunicación', 'Experimentación', 'Pensamiento crítico', 'Colaboración', 'Gestión del tiempo', 'Resolución de problemas', 'Aprendizaje continuo', 'Adaptabilidad', 'Orientación a resultados', 'Liderazgo', 'Creatividad'],
  en: ['Data analysis', 'Communication', 'Experimentation', 'Critical thinking', 'Collaboration', 'Time management', 'Problem solving', 'Continuous learning', 'Adaptability', 'Results orientation', 'Leadership', 'Creativity'],
}
const TERR = ['dir', 'con', 'com', 'ing', 'inn']
const track = level => (level ? { level, state: 'initial', stale: false, catalogOutdated: false, confidence: 'medium', confidenceReason: { es: 'Respaldo sintético', en: 'Synthetic support' }, evidenceCount: 2, authoring: 'person', rationale: null, needsReview: false } : null)
const skills = n => Array.from({ length: n }, (_, i) => ({ skillKey: 'sint_' + i, type: i % 3 ? 'transversal' : 'domain', labels: { es: NAMES.es[i], en: NAMES.en[i] }, territories: [TERR[i % TERR.length]],
  rubric: { levels: Object.fromEntries([1, 2, 3, 4].map(k => [String(k), { es: `Criterio ${k}`, en: `Criterion ${k}` }])), source: 'sintético', verifiedAt: '2026-11-01' }, self: track((i % 4) + 1), review: null, state: 'initial' }))
;(async () => {
  const { chromium } = process.env.PLAYWRIGHT_MODULE ? require(process.env.PLAYWRIGHT_MODULE) : await import('playwright')
  const base = process.env.ES317_URL ?? 'http://127.0.0.1:4317'; const max = process.env.ES317_MAX ? Number(process.env.ES317_MAX) : null; const latency = Number(process.env.ES317_LATENCY ?? 120)
  assert.ok(['127.0.0.1', 'localhost'].includes(new URL(base).hostname), 'Solo vista previa local')
  const browser = await chromium.launch(); const failures = []
  if (process.env.AXE_PATH) { // Estado de carga: el botón «Analizar con IA» está reservado y deshabilitado; axe (wcag2a/2aa/21aa/22aa + target-size) = 0 y el pie no se pinta.
    const axeSource = require('node:fs').readFileSync(process.env.AXE_PATH, 'utf8')
    for (const lang of ['es', 'en']) for (const width of [390, 1360]) {
      const context = await browser.newContext({ viewport: { width, height: 800 }, reducedMotion: 'reduce' }); const page = await context.newPage()
      await page.addInitScript(l => { localStorage.setItem('elevation_token', 't'); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elv_lang', l) }, lang)
      await page.route('**/api/**', async route => { const p = new URL(route.request().url()).pathname; if (p === '/api/skill-map') await new Promise(r => setTimeout(r, 6000))
        if (p === '/api/session') return route.fulfill({ json: { role: 'user', onboardingCompleted: true } })
        if (p === '/api/skill-map') return route.fulfill({ json: { catalogVersion: 1, skills: skills(12) } })
        if (p === '/api/consents') return route.fulfill({ json: { consents: [] } })
        return route.fulfill({ json: [] }) })
      await page.goto(base + '/app/skill-map', { waitUntil: 'domcontentloaded' }); await page.locator('.skill-map-scope[data-loading]').waitFor({ timeout: 30000 })
      const st = await page.evaluate(() => { const b = document.querySelector('.skill-map-primary'); return { has: !!b, disabled: !!b && b.disabled, footer: getComputedStyle(document.querySelector('.cg-footer')).visibility } })
      assert.deepEqual(st, { has: true, disabled: true, footer: 'hidden' }, `en carga: botón reservado y deshabilitado y pie oculto (${lang} ${width}px): ${JSON.stringify(st)}`)
      await page.evaluate(axeSource)
      const v = await page.evaluate(async () => { const a = await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] }); const b = await window.axe.run(document, { runOnly: { type: 'rule', values: ['target-size', 'label-content-name-mismatch'] } }); return [...a.violations, ...b.violations].map(x => x.id + ':' + x.nodes.length) })
      assert.deepEqual(v, [], `axe 0 en el estado de carga (${lang} ${width}px)`)
      await page.locator('.skill-map-catalog').waitFor({ timeout: 30000 })
      const after = await page.evaluate(() => ({ disabled: document.querySelector('.skill-map-primary').disabled, footer: getComputedStyle(document.querySelector('.cg-footer')).visibility }))
      assert.deepEqual(after, { disabled: false, footer: 'visible' }, `listo: botón habilitado y pie visible (${lang} ${width}px)`); await context.close()
    }
    console.log('PASS estado de carga: botón reservado y deshabilitado, pie oculto, axe 0; listo: botón habilitado y pie visible')
  } else console.log('INFO sin AXE_PATH: no se comprueba el estado de carga con axe')
  for (const lang of ['es', 'en']) for (const [width, cpu] of [[390, 4], [1360, 4], [1360, 1]]) {
    const context = await browser.newContext({ viewport: { width, height: 800 }, reducedMotion: 'reduce' }); const page = await context.newPage()
    await page.addInitScript(l => { localStorage.setItem('elevation_token', 't'); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elv_lang', l) }, lang)
    await page.addInitScript(() => { window.__shifts = []; const desc = n => { if (!n || !n.nodeType) return '?'; const e = n.nodeType === 1 ? n : n.parentElement; if (!e) return '?'; return e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : '') }
      try { new PerformanceObserver(list => { for (const e of list.getEntries()) if (!e.hadRecentInput) window.__shifts.push({ v: e.value, t: Math.round(e.startTime), s: (e.sources ?? []).map(src => desc(src.node) + ' ' + Math.round(src.previousRect.y) + '→' + Math.round(src.currentRect.y) + ' h' + Math.round(src.previousRect.height) + '→' + Math.round(src.currentRect.height)) }) }).observe({ type: 'layout-shift', buffered: true }) } catch { /* sin soporte */ } })
    if (cpu > 1) { const cdp = await context.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu }) }
    await page.route('**/api/**', async route => { const p = new URL(route.request().url()).pathname; await new Promise(r => setTimeout(r, latency))
      if (p === '/api/session') return route.fulfill({ json: { role: 'user', onboardingCompleted: true } })
      if (p === '/api/skill-map') return route.fulfill({ json: { catalogVersion: 1, skills: skills(12) } })
      if (p === '/api/consents') return route.fulfill({ json: { consents: [] } })
      return route.fulfill({ json: [] }) })
    await page.goto(base + '/app/skill-map', { waitUntil: 'networkidle' }); await page.locator('.skill-map-catalog').waitFor({ timeout: 30000 }); await page.waitForTimeout(1000)
    const shown = await page.evaluate(() => ({ catalog: !!document.querySelector('.skill-map-catalog'), error: !!document.querySelector('.skill-map-error'), cards: document.querySelectorAll('.skill-map-main button, .skill-map-main a').length, h: document.documentElement.scrollHeight })); assert.ok(shown.catalog && !shown.error, 'el mapa se dibuja (no el estado de error): ' + JSON.stringify(shown))
    const shifts = await page.evaluate(() => window.__shifts); const total = shifts.reduce((s, e) => s + e.v, 0)
    console.log(`${lang} ${width}px CPU×${cpu}: CLS ${total.toFixed(3)} en ${shifts.length} desplazamientos (controles ${shown.cards}, alto de la página ${shown.h})`)
    for (const s of shifts) console.log(`   t=${s.t} ms valor ${s.v.toFixed(3)}  ${s.s.join(' ; ')}`)
    if (max !== null && total > max) failures.push(`${lang} ${width}px CPU×${cpu}: ${total.toFixed(3)} > ${max}`)
    await context.close()
  }
  await browser.close()
  if (failures.length) { console.error('\nFALLA:\n  ' + failures.join('\n  ')); process.exit(1) }
  console.log('\nES-317: medición terminada' + (max !== null ? ` (todos ≤ ${max})` : ' (sin umbral)'))
})().catch(error => { console.error(error); process.exit(1) })
