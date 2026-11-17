// ES-308 (PR 2): «Mis evidencias» (lista con filtro, detalle, nueva/editar con revisión) en Cartografía. Chromium, API simulada (page.route), datos SINTÉTICOS.
// Por tema (claro/oscuro) × idioma (ES/EN) × ancho (1360, 390, 320): un solo h1, sin desborde horizontal, axe wcag2a/2aa/21aa/22aa + target-size + label-content-name-mismatch = 0
// (lista, diálogo de borrar abierto, detalle, formulario vacío, formulario con errores y revisión), diálogo (foco entra, Tab atrapado, Esc cierra y el foco vuelve al botón),
// filtro («Ver todas» devuelve el foco al radio «Todas»), borrar, crear con requestId, reintento tras respuesta perdida con el MISMO requestId, enlace del resumen de errores al campo,
// estados (cargando, error con reintento, vacío) y CLS ≤ 0,1 a 390 px con CPU ×4.
// Uso: npx vite build && npx vite preview --host 127.0.0.1 --port 4309 --strictPort   y luego
//   ES308E_URL=http://127.0.0.1:4309 PLAYWRIGHT_MODULE=<ruta a playwright> AXE_PATH=<axe.min.js> node scripts/es308-evidencias-check.cjs
const assert = require('node:assert/strict'); const fs = require('node:fs')
;(async () => {
  const { chromium } = process.env.PLAYWRIGHT_MODULE ? require(process.env.PLAYWRIGHT_MODULE) : await import('playwright')
  const base = process.env.ES308E_URL ?? 'http://127.0.0.1:4309'; const axeSource = fs.readFileSync(process.env.AXE_PATH, 'utf8')
  assert.ok(['127.0.0.1', 'localhost'].includes(new URL(base).hostname), 'Solo vista previa local')
  const browser = await chromium.launch(); let checks = 0; const check = name => { checks++; console.log('PASS', name) }
  const claim = text => ({ text, source: 'self_report' })
  const row = (id, extra = {}) => ({ id, version: 1, status: 'confirmed', authoring: 'person', createdAt: '2026-11-03T10:00:00Z',
    payload: { title: 'Lancé el boletín interno ' + id, situation: 'El equipo no tenía un canal común.', responsibility: claim('Yo coordiné el contenido.'), actions: [claim('Definí el calendario.'), claim('Redacté la primera edición.')],
      alternatives: ['Usar el correo de siempre'], goal: 'Que todo el equipo leyera lo mismo.', delivered: claim('Tres ediciones enviadas.'), observedEffect: { known: true, claim: claim('Bajaron las preguntas repetidas.') },
      learning: 'Un calendario simple basta.', autonomy: 'assisted', artifactRefs: [{ kind: 'url', url: 'https://ejemplo.test/boletin', note: 'Archivo del boletín' }] }, ...extra })
  const rows = () => [row(1), row(2, { status: 'draft', origin: { kind: 'resume', version: 2, date: '2026-11-02T10:00:00Z', needsReview: true }, payload: { title: 'Gestión de proyectos', observedEffect: { known: false }, artifactRefs: [{ kind: 'text', excerpt: 'Coordiné un equipo de seis personas.' }] } }), row(3, { fromChat: true })]
  const open = async (route, { width, lang = 'es', scheme = 'light', cpu = 1, mode = {} } = {}) => {
    const context = await browser.newContext({ viewport: { width, height: 800 }, reducedMotion: 'reduce' }); const page = await context.newPage(); const calls = []
    await page.addInitScript(([l, s]) => { localStorage.setItem('elevation_token', 't'); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elv_lang', l); localStorage.setItem('elv_theme', s) }, [lang, scheme])
    await page.addInitScript(() => { window.__cls = 0; try { new PerformanceObserver(list => { for (const e of list.getEntries()) if (!e.hadRecentInput) window.__cls += e.value }).observe({ type: 'layout-shift', buffered: true }) } catch { /* sin soporte */ } })
    if (cpu > 1) { const cdp = await context.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu }) }
    let data = mode.noDraft ? rows().filter(r => r.status !== 'draft') : rows(); mode.posts = []; let postCount = 0
    await page.route('**/api/**', async route => { const req = route.request(); const p = new URL(req.url()).pathname; calls.push(req.method() + ' ' + p); if (mode.delay) await new Promise(r => setTimeout(r, mode.delay))
      if (p === '/api/session') return route.fulfill({ json: { role: 'user', onboardingCompleted: true } })
      if (p === '/api/consents') return route.fulfill({ json: { consents: [{ purpose: 'resume_ai_reading', status: 'granted' }] } })
      if (p === '/api/user/resume-skills') return route.fulfill({ json: { skills: [] } })
      if (p === '/api/evidence' && req.method() === 'GET') return mode.fail ? route.fulfill({ status: 503, json: {} }) : route.fulfill({ json: { evidence: mode.empty ? [] : data } })
      if (p === '/api/evidence' && req.method() === 'POST') { const body = JSON.parse(req.postData() || '{}'); mode.posts.push(body); postCount++
        if (mode.lostFirstPost && postCount === 1) return route.fulfill({ status: 503, json: {} })
        const created = { ...row(99), version: 1, status: body.status, payload: body.payload }; data = [...data, created]; return route.fulfill({ json: { id: 99, version: 1 } }) }
      let m = p.match(/^\/api\/evidence\/(\d+)$/)
      if (m && req.method() === 'DELETE') { data = data.filter(r => String(r.id) !== m[1]); return route.fulfill({ status: 200, json: { ok: true } }) }
      if (m && req.method() === 'GET') { const found = data.filter(r => String(r.id) === m[1]); if (!found.length) return route.fulfill({ status: 404, json: {} }); return route.fulfill({ json: { id: Number(m[1]), currentVersion: found[0].version, versions: found } }) }
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
  const fillRequired = async page => { await page.locator('#title').fill('Mi evidencia'); await page.locator('#situation').fill('Una situación real.'); await page.locator('#responsibility').fill('Mi parte fue esta.')
    await page.locator('#actions-0').fill('Hice esto.'); await page.locator('#delivered').fill('Entregué esto.'); await page.locator('input[name=effect][value=unknown]').check({ force: true }) }
  for (const scheme of ['light', 'dark']) for (const lang of ['es', 'en']) for (const width of [1360, 390, 320]) {
    const tag = `${scheme} ${lang} ${width}px`
    { // Lista + diálogo de borrar
      const { context, page } = await open('/app/evidence', { width, lang, scheme }); await page.locator('.pg-card').first().waitFor()
      assert.equal(await page.locator('h1').count(), 1, `un solo h1 en la lista (${tag})`); assert.ok(await noOverflow(page), `sin desborde en la lista (${tag})`)
      assert.equal(await page.locator('.pg-card').count(), 3, `tres evidencias (${tag})`); assert.deepEqual(await axe(page), [], `axe 0 en la lista (${tag})`)
      const del = page.locator('.pg-card').first().locator('button[aria-label]'); await del.focus(); await page.keyboard.press('Enter'); await page.locator('dialog[open]').waitFor()
      assert.ok(await activeInside(page, 'dialog[open]'), `el foco entra al diálogo de borrar (${tag})`)
      for (let i = 0; i < 6; i++) { await page.keyboard.press('Tab'); assert.ok(await activeInside(page, 'dialog[open]'), `Tab queda atrapado en el diálogo (${tag})`) }
      assert.deepEqual(await axe(page), [], `axe 0 con el diálogo de borrar abierto (${tag})`)
      await page.keyboard.press('Escape'); await page.waitForTimeout(80)
      assert.equal(await page.locator('dialog[open]').count(), 0, `Esc cierra (${tag})`)
      assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? ''), await del.getAttribute('aria-label'), `el foco vuelve al botón que abrió (${tag})`)
      await context.close()
    }
    { // Detalle
      const { context, page } = await open('/app/evidence/2', { width, lang, scheme }); await page.locator('.pg-card').first().waitFor()
      assert.equal(await page.locator('h1').count(), 1, `un solo h1 en el detalle (${tag})`); assert.ok(await noOverflow(page), `sin desborde en el detalle (${tag})`); assert.deepEqual(await axe(page), [], `axe 0 en el detalle (${tag})`); await context.close()
    }
    { // Nueva: vacía, con errores y revisión
      const { context, page } = await open('/app/evidence/new', { width, lang, scheme }); await page.locator('#title').waitFor()
      assert.equal(await page.locator('h1').count(), 1, `un solo h1 en nueva (${tag})`); assert.ok(await noOverflow(page), `sin desborde en nueva (${tag})`); assert.deepEqual(await axe(page), [], `axe 0 en nueva vacía (${tag})`)
      await page.locator('form button[type=submit]').click(); await page.locator('[role=alert].cg-banner--error').waitFor(); assert.deepEqual(await axe(page), [], `axe 0 con errores (${tag})`)
      assert.ok(await noOverflow(page), `sin desborde con errores (${tag})`)
      await fillRequired(page); await page.locator('form button[type=submit]').click(); await page.locator('.pg-card h2').first().waitFor(); assert.deepEqual(await axe(page), [], `axe 0 en la revisión (${tag})`)
      assert.ok(await noOverflow(page), `sin desborde en la revisión (${tag})`); await context.close()
    }
  }
  check('lista, detalle y nueva: claro/oscuro × ES/EN × 1360/390/320 — un h1, sin desborde, axe 0 (también con diálogo, errores y revisión), Tab atrapado, Esc y foco devuelto')
  { // Filtro: «Ver todas» devuelve el foco al radio «Todas»
    const { context, page } = await open('/app/evidence', { width: 390, mode: { noDraft: true } }); await page.locator('.pg-card').first().waitFor()
    assert.equal(await page.locator('input[name=evidence-status]').count(), 3, 'tres radios del filtro')
    await page.locator('input[name=evidence-status][value=draft]').check({ force: true }); await page.waitForTimeout(100)
    assert.equal(await page.locator('.pg-card').count(), 0, 'sin borradores no hay tarjetas'); await page.locator('p > .cg-linkbtn').click(); await page.waitForTimeout(150)
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('value')), 'all', '«Ver todas» pasa el foco al radio «Todas»'); assert.equal(await page.locator('.pg-card').count(), 2)
    await page.locator('input[name=evidence-status][value=confirmed]').check({ force: true }); assert.equal(await page.locator('.pg-card').count(), 2, 'filtra por confirmadas'); await context.close()
    check('filtro por estado: filtra en el cliente y «Ver todas» devuelve el foco al radio «Todas»')
  }
  { // Borrar
    const { context, page, calls } = await open('/app/evidence', { width: 390 }); await page.locator('.pg-card').first().waitFor()
    await page.locator('.pg-card').first().locator('button[aria-label]').click(); await page.locator('dialog[open]').waitFor(); await page.locator('dialog[open] .cg-btn--danger').click()
    await page.waitForFunction(() => document.querySelectorAll('.pg-card').length === 2); assert.ok(calls.includes('DELETE /api/evidence/1'), 'borró la evidencia pedida')
    assert.equal(await page.locator('[role=status].cg-banner').count(), 1, 'aviso de borrado visible'); await context.close()
    check('borrar: DELETE + recarga + aviso')
  }
  { // Crear con requestId y reintento tras respuesta perdida con el MISMO requestId
    const mode = { lostFirstPost: true }; const { context, page } = await open('/app/evidence/new', { width: 390, mode }); await page.locator('#title').waitFor()
    await fillRequired(page); await page.locator('form button[type=submit]').click(); await page.locator('.pg-card h2').first().waitFor(); await page.locator('.cg-check input').check()
    await page.locator('.pg-actions .cg-btn:not(.cg-btn--ghost)').click(); await page.locator('[role=alert].cg-banner--error').waitFor()
    await page.locator('.pg-actions .cg-btn:not(.cg-btn--ghost)').click(); await page.waitForFunction(() => /confirm|Confirm|guard|saved/i.test(document.querySelector('[role=status] h2')?.textContent ?? ''))
    assert.equal(mode.posts.length, 2, 'dos envíos (el primero se perdió)'); assert.equal(mode.posts[0].requestId, mode.posts[1].requestId, 'el reintento usa el MISMO requestId'); assert.match(mode.posts[0].requestId, /\S{8,}/); assert.equal(mode.posts[1].status, 'confirmed')
    await context.close()
    check('crear: confirmar con requestId; respuesta perdida → «Reintentar» envía el mismo requestId')
  }
  { // El enlace del resumen de errores lleva al campo
    const { context, page } = await open('/app/evidence/new', { width: 390 }); await page.locator('#title').waitFor(); await page.locator('form button[type=submit]').click(); await page.locator('[role=alert].cg-banner--error a').first().waitFor()
    await page.locator('[role=alert].cg-banner--error a[href="#title"]').click(); await page.waitForTimeout(100)
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'title', 'el enlace del resumen enfoca el campo'); assert.equal(await page.locator('#title').getAttribute('aria-invalid'), 'true')
    assert.ok((await page.locator('#title').getAttribute('aria-describedby')).includes('title-err'), 'el error está asociado al campo'); await context.close()
    check('errores: el enlace del resumen enfoca el campo y el error queda asociado (aria-invalid + aria-describedby)')
  }
  { // Estados: error con reintento, vacío y cargando
    const f = await open('/app/evidence', { width: 390, mode: { fail: true } }); await f.page.locator('[role=alert].cg-banner--error').first().waitFor()
    assert.ok(await f.page.locator('[role=alert] button').count() >= 1, 'error con reintento'); assert.deepEqual(await axe(f.page), [], 'axe 0 en error'); await f.context.close()
    const e = await open('/app/evidence', { width: 390, mode: { empty: true } }); await e.page.locator('h1').waitFor(); await e.page.waitForTimeout(400); assert.deepEqual(await axe(e.page), [], 'axe 0 en vacío'); assert.ok(await noOverflow(e.page)); await e.context.close()
    const l = await open('/app/evidence', { width: 390, mode: { delay: 900 } }); await l.page.locator('h1').waitFor(); assert.deepEqual(await axe(l.page), [], 'axe 0 cargando'); await l.context.close()
    check('estados: error con reintento, vacío y cargando — axe 0')
  }
  for (const route of ['/app/evidence', '/app/evidence/2', '/app/evidence/new']) { // CLS a 390 con CPU ×4
    const { context, page } = await open(route, { width: 390, cpu: 4, mode: { delay: 80 } }); await page.locator('.pg-card, form').first().waitFor({ timeout: 30000 }); await page.waitForTimeout(1500)
    const cls = await page.evaluate(() => window.__cls); console.log(`   CLS ${route} a 390 px, CPU ×4: ${cls.toFixed(3)}`); assert.ok(cls <= 0.1, `CLS ${cls} ≤ 0,1 (${route})`); await context.close()
  }
  check('CLS ≤ 0,1 a 390 px con CPU ×4 (lista, detalle, nueva)')
  await browser.close(); console.log(`\nES-308 PR 2: ${checks} comprobaciones OK`)
})().catch(error => { console.error(error); process.exit(1) })
