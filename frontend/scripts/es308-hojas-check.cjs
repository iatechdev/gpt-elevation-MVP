// ES-308 (PR 1): «Mis hojas de vida» y «Habilidades de la hoja de vida» en Cartografía. Chromium, API simulada (page.route), datos SINTÉTICOS.
// Por tema (claro/oscuro) × idioma (ES/EN) × ancho (1360, 390, 320): un solo h1, sin desborde horizontal, axe wcag2a/2aa/21aa/22aa + target-size + label-content-name-mismatch = 0
// (también con el diálogo abierto), diálogos (el foco entra, Tab queda atrapado, Esc cierra y el foco vuelve al botón), estados (cargando, error con reintento, vacío),
// borrar una versión y promover habilidades (el mismo requestId), y CLS ≤ 0,1 a 390 px con CPU ×4.
// Uso: npx vite build && npx vite preview --host 127.0.0.1 --port 4308 --strictPort   y luego
//   ES308_URL=http://127.0.0.1:4308 PLAYWRIGHT_MODULE=<ruta a playwright> AXE_PATH=<axe.min.js> node scripts/es308-hojas-check.cjs
const assert = require('node:assert/strict'); const fs = require('node:fs')
;(async () => {
  const { chromium } = process.env.PLAYWRIGHT_MODULE ? require(process.env.PLAYWRIGHT_MODULE) : await import('playwright')
  const base = process.env.ES308_URL ?? 'http://127.0.0.1:4308'; const axeSource = fs.readFileSync(process.env.AXE_PATH, 'utf8')
  assert.ok(['127.0.0.1', 'localhost'].includes(new URL(base).hostname), 'Solo vista previa local')
  const browser = await chromium.launch(); let checks = 0; const check = name => { checks++; console.log('PASS', name) }
  const resumesData = () => ({ resumes: [{ id: 2, version: 2, size: 53248, createdAt: '2026-11-02T10:00:00Z' }, { id: 1, version: 1, size: 40960, createdAt: '2026-11-01T10:00:00Z' }], maxVersions: 5 })
  const skillsData = () => ({ skills: [
    { name: 'Gestión de proyectos', support: 'Coordiné un equipo de seis personas en el lanzamiento.', classified: { skillKey: 'sint_1', labels: { es: 'Gestión del tiempo', en: 'Time management' } }, resume: { id: 2, version: 2, createdAt: '2026-11-02T10:00:00Z' }, added: false },
    { name: 'Comunicación con clientes', support: 'Presenté avances semanales a la dirección.', classified: { skillKey: 'sint_2', labels: { es: 'Comunicación', en: 'Communication' } }, resume: { id: 2, version: 2, createdAt: '2026-11-02T10:00:00Z' }, added: false },
    { name: 'Herramienta sin clasificar', support: null, classified: null, resume: { id: 2, version: 2, createdAt: '2026-11-02T10:00:00Z' }, added: false },
    { name: 'Análisis de datos', support: 'Armé el tablero mensual.', classified: { skillKey: 'sint_3', labels: { es: 'Análisis de datos', en: 'Data analysis' } }, resume: { id: 1, version: 1, createdAt: '2026-11-01T10:00:00Z' }, added: true }] })
  const open = async (route, { width, lang = 'es', scheme = 'light', cpu = 1, mode = {} } = {}) => {
    const context = await browser.newContext({ viewport: { width, height: 800 }, reducedMotion: 'reduce' }); const page = await context.newPage(); const calls = []
    await page.addInitScript(([l, s]) => { localStorage.setItem('elevation_token', 't'); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elv_lang', l); localStorage.setItem('elv_theme', s) }, [lang, scheme])
    await page.addInitScript(() => { window.__cls = 0; try { new PerformanceObserver(list => { for (const e of list.getEntries()) if (!e.hadRecentInput) window.__cls += e.value }).observe({ type: 'layout-shift', buffered: true }) } catch { /* sin soporte */ } })
    if (cpu > 1) { const cdp = await context.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu }) }
    let resumes = resumesData()
    await page.route('**/api/**', async route => { const req = route.request(); const p = new URL(req.url()).pathname; calls.push(req.method() + ' ' + p); if (mode.delay) await new Promise(r => setTimeout(r, mode.delay))
      if (p === '/api/session') return route.fulfill({ json: { role: 'user', onboardingCompleted: true } })
      if (p === '/api/consents') return route.fulfill({ json: { consents: [{ purpose: 'resume_ai_reading', status: 'granted' }] } })
      if (p === '/api/user/resumes') return mode.fail ? route.fulfill({ status: 503, json: {} }) : route.fulfill({ json: mode.empty ? { resumes: [], maxVersions: 5 } : resumes })
      if (/^\/api\/user\/resumes\/\d+$/.test(p) && req.method() === 'DELETE') { resumes = { ...resumes, resumes: resumes.resumes.filter(r => String(r.id) !== p.split('/').pop()) }; return route.fulfill({ status: 200, json: { ok: true } }) }
      if (p === '/api/user/resume-skills') return mode.fail ? route.fulfill({ status: 503, json: {} }) : route.fulfill({ json: mode.empty ? { skills: [] } : skillsData() })
      if (p === '/api/user/resume-skills/promote') { mode.promoteBody = JSON.parse(req.postData() || '{}'); return route.fulfill({ json: { created: [{ id: 9, name: 'Gestión de proyectos', skillKey: 'sint_1', replayed: false }], skipped: [] } }) }
      return route.fulfill({ json: [] }) })
    await page.goto(base + route, { waitUntil: 'domcontentloaded' })
    return { context, page, calls }
  }
  const axe = async page => { await page.evaluate(axeSource); return page.evaluate(async () => {
    const tags = await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] })
    const rules = await window.axe.run(document, { runOnly: { type: 'rule', values: ['label-content-name-mismatch', 'target-size'] } })
    return [...tags.violations, ...rules.violations].map(v => v.id + ':' + v.nodes.length + ' ' + v.nodes.map(n => n.target.join(' ')).slice(0, 3).join(' | ')) }) }
  const noOverflow = page => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)
  const activeInside = (page, selector) => page.evaluate(sel => !!document.activeElement && !!document.querySelector(sel)?.contains(document.activeElement), selector)
  const labels = { es: { del: 'Borrar', skills: 'Revisar' }, en: { del: 'Delete' } }
  for (const scheme of ['light', 'dark']) for (const lang of ['es', 'en']) for (const width of [1360, 390, 320]) {
    const tag = `${scheme} ${lang} ${width}px`
    { // Hojas de vida
      const { context, page } = await open('/app/context/resumes', { width, lang, scheme }); await page.locator('#rs-versions').waitFor()
      assert.equal(await page.locator('h1').count(), 1, `un solo h1 en hojas (${tag})`); assert.ok(await noOverflow(page), `sin desborde en hojas (${tag})`)
      assert.deepEqual(await axe(page), [], `axe 0 en hojas (${tag})`)
      const del = page.locator('.cg-items li').first().locator('button').nth(2); await del.focus(); await page.keyboard.press('Enter'); await page.locator('dialog[open]').waitFor()
      assert.ok(await activeInside(page, 'dialog[open]'), `el foco entra al diálogo de borrar (${tag})`)
      for (let i = 0; i < 6; i++) { await page.keyboard.press('Tab'); assert.ok(await activeInside(page, 'dialog[open]'), `Tab queda atrapado en el diálogo (${tag})`) }
      assert.deepEqual(await axe(page), [], `axe 0 con el diálogo de borrar abierto (${tag})`)
      await page.keyboard.press('Escape'); await page.waitForTimeout(80)
      assert.equal(await page.locator('dialog[open]').count(), 0, `Esc cierra (${tag})`)
      assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? ''), await del.getAttribute('aria-label'), `el foco vuelve al botón que abrió (${tag})`)
      await context.close()
    }
    { // Habilidades de la hoja de vida
      const { context, page } = await open('/app/evidence/resume-skills', { width, lang, scheme }); await page.locator('.pg-pick').first().waitFor()
      assert.equal(await page.locator('h1').count(), 1, `un solo h1 en habilidades (${tag})`); assert.ok(await noOverflow(page), `sin desborde en habilidades (${tag})`)
      assert.equal(await page.locator('.pg-pick input:checked').count(), 0, `ninguna marcada por defecto (${tag})`)
      assert.equal(await page.locator('.pg-pick input:disabled').count(), 2, `no seleccionables: sin clasificar y ya añadida (${tag})`)
      assert.deepEqual(await axe(page), [], `axe 0 en habilidades (${tag})`)
      await page.locator('.pg-pick input:not(:disabled)').first().check(); const review = page.locator('.pg-sticky .cg-btn'); assert.equal(await review.isEnabled(), true)
      await review.focus(); await page.keyboard.press('Enter'); await page.locator('dialog[open]').waitFor()
      assert.ok(await activeInside(page, 'dialog[open]'), `el foco entra al diálogo de confirmar (${tag})`)
      for (let i = 0; i < 6; i++) { await page.keyboard.press('Tab'); assert.ok(await activeInside(page, 'dialog[open]'), `Tab queda atrapado (${tag})`) }
      assert.deepEqual(await axe(page), [], `axe 0 con el diálogo de confirmar abierto (${tag})`)
      await page.keyboard.press('Escape'); await page.waitForTimeout(80)
      assert.equal(await page.locator('dialog[open]').count(), 0, `Esc cierra (${tag})`); assert.ok(await page.evaluate(() => document.activeElement?.classList.contains('cg-btn')), `el foco vuelve al botón (${tag})`)
      await context.close()
    }
  }
  check('hojas y habilidades: claro/oscuro × ES/EN × 1360/390/320 — un h1, sin desborde, axe 0 (también con diálogo), Tab atrapado, Esc y foco devuelto')
  { // Flujos: borrar una versión y promover habilidades
    const { context, page, calls } = await open('/app/context/resumes', { width: 390 }); await page.locator('#rs-versions').waitFor()
    await page.locator('.cg-items li').first().locator('button').nth(2).click(); await page.locator('dialog[open]').waitFor()
    await page.locator('dialog[open] .cg-btn--danger').click(); await page.locator('.cg-items li').nth(0).waitFor(); await page.waitForTimeout(150)
    assert.ok(calls.includes('DELETE /api/user/resumes/2'), 'borró la versión pedida'); assert.equal(await page.locator('.cg-items li').count(), 1, 'la lista se recarga con una versión menos')
    assert.equal(await page.locator('[role=status].cg-banner').count(), 1, 'aviso de borrado visible'); await context.close()
    const mode = {}; const s = await open('/app/evidence/resume-skills', { width: 390, mode }); await s.page.locator('.pg-pick').first().waitFor()
    await s.page.locator('.pg-pick input:not(:disabled)').nth(0).check(); await s.page.locator('.pg-pick input:not(:disabled)').nth(1).check()
    await s.page.locator('.pg-sticky .cg-btn').click(); await s.page.locator('dialog[open] .cg-btn:not(.cg-btn--ghost)').click(); await s.page.waitForURL('**/app/evidence**')
    assert.deepEqual([...mode.promoteBody.names].sort(), ['Comunicación con clientes', 'Gestión de proyectos'], 'promueve solo lo marcado'); assert.match(mode.promoteBody.requestId, /\S{8,}/, 'con requestId'); await s.context.close()
    check('flujos: borrar versión (DELETE + recarga + aviso) y promover habilidades marcadas con requestId')
  }
  { // Estados: error con reintento, vacío y cargando
    for (const [route, key] of [['/app/context/resumes', 'resumes'], ['/app/evidence/resume-skills', 'skills']]) {
      const f = await open(route, { width: 390, mode: { fail: true } }); await f.page.locator('[role=alert].cg-banner--error').first().waitFor()
      assert.ok(await f.page.getByRole('button').filter({ hasText: /Reintentar|Retry|Intentar|Try/ }).count() >= 1, `error con reintento (${key})`); assert.deepEqual(await axe(f.page), [], `axe 0 en error (${key})`); await f.context.close()
      const e = await open(route, { width: 390, mode: { empty: true } }); await e.page.locator('h1').waitFor(); await e.page.waitForTimeout(400)
      assert.deepEqual(await axe(e.page), [], `axe 0 en vacío (${key})`); assert.ok(await noOverflow(e.page)); await e.context.close()
      const l = await open(route, { width: 390, mode: { delay: 900 } }); await l.page.locator('h1').waitFor(); assert.deepEqual(await axe(l.page), [], `axe 0 cargando (${key})`); await l.context.close()
    }
    check('estados: error con reintento, vacío y cargando — axe 0 (hojas y habilidades)')
  }
  for (const route of ['/app/context/resumes', '/app/evidence/resume-skills']) { // CLS a 390 con CPU ×4
    const { context, page } = await open(route, { width: 390, cpu: 4, mode: { delay: 80 } }); await page.locator('.cg-items, .cg-card').first().waitFor({ timeout: 30000 }); await page.waitForTimeout(1500)
    const cls = await page.evaluate(() => window.__cls); console.log(`   CLS ${route} a 390 px, CPU ×4: ${cls.toFixed(3)}`); assert.ok(cls <= 0.1, `CLS ${cls} ≤ 0,1 (${route})`); await context.close()
  }
  check('CLS ≤ 0,1 a 390 px con CPU ×4 (hojas y habilidades)')
  await browser.close(); console.log(`\nES-308 PR 1: ${checks} comprobaciones OK`)
})().catch(error => { console.error(error); process.exit(1) })
