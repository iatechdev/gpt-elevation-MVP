// ES-310 (PR 4): Catálogo de rutas (/admin/route-catalog) en Cartografía, en navegador real (Chromium) con API simulada y datos sintéticos. No corre en CI; evidencia del PR.
// Mide, en claro/oscuro × ES/EN × 1360/390/320 px: axe wcag2a/2aa/21a/21aa/22aa = 0 (lista, borrador, editor, conflicto, diálogo de confirmación, versión publicada de solo lectura),
// un solo h1, sin estilos en línea, sin desborde, objetivos >= 24 px, «Crear borrador» deshabilitado con su razón, chips con palabra (y ✓ en «Completo»), «Revisar publicación»
// deshabilitado con su razón, aviso de conflicto con «Ver su versión»/«Conservar la mía», diálogo (foco al abrir, Tab atrapado, Esc cierra, foco devuelto),
// confirmación al salir con cambios sin guardar (enlace de la barra lateral) y CLS <= 0,1 a 390 px con CPU×4.
// Uso: npx vite build --outDir dist-310c && npx vite preview --outDir dist-310c --host 127.0.0.1 --port 4314 --strictPort
//   PLAYWRIGHT_MODULE=<playwright> AXE_PATH=<axe.min.js> BASE=http://127.0.0.1:4314 node scripts/es310-catalogo-check.cjs
const fs = require('fs')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const axeSource = fs.readFileSync(process.env.AXE_PATH, 'utf8')
const BASE = process.env.BASE || 'http://127.0.0.1:4314'
let failures = 0
const report = (ok, label, extra = '') => { if (!ok) failures++; console.log((ok ? 'OK    ' : 'FALLA ') + label + (extra ? ' ' + extra : '')) }
const day = d => new Date(Date.UTC(2026, 10, 17 - d, 15, 0)).toISOString()
const bi = (es, en) => ({ es, en })
const catalogs = [
  { id: 4, version: 4, status: 'draft', publishedAt: null, itemCount: 5 },
  { id: 3, version: 3, status: 'published', publishedAt: day(3), itemCount: 5 },
  { id: 2, version: 2, status: 'archived', publishedAt: day(40), itemCount: 4 },
]
const items = {
  contexts: [{ itemKey: 'ctx_educacion_formacion', labels: bi('Educación y formación (ejemplo)', 'Education and training (example)'), note: bi('Nota sintética', 'Synthetic note'), updatedAt: day(2) }],
  sources: [{ itemKey: 'fuente_ejemplo_muy_larga_para_probar_desborde_ab', type: 'official', title: 'Fuente sintética', updatedAt: day(2) }],
  roles: [
    { itemKey: 'rol_ejemplo', labels: bi('Rol de ejemplo', 'Example role'), industry: bi('Educación', 'Education'), market: 'CO', languagesRequired: ['es'], tasks: [{ text: bi('Tarea sintética', 'Synthetic task') }], contexts: ['ctx_educacion_formacion'], sourceKeys: [], updatedAt: day(1) },
    { itemKey: 'rol_completo', labels: bi('Rol completo (ejemplo)', 'Complete role (example)'), synthetic: true, updatedAt: day(1) },
  ],
  offers: [], resources: [],
}
const missing = { 'roles/rol_ejemplo': ['industry.es', 'review.by'] }
const detail = (id, status, withMissing) => ({ ...catalogs.find(c => c.id === id), status, items, missing: withMissing ? missing : {} })

async function open(browser, { width, lang, scheme, path = '/admin/route-catalog', cpu = 1, conflict = false, ready }) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: scheme, reducedMotion: 'reduce' })
  const page = await ctx.newPage(); const errors = []
  page.on('pageerror', e => errors.push(e.message))
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()) })
  await page.addInitScript(l => {
    localStorage.setItem('elevation_token', 'synthetic-browser-token'); localStorage.setItem('elevation_role', 'admin'); localStorage.setItem('elv_lang', l)
    window.__cls = 0; window.__src = []; new PerformanceObserver(list => { for (const e of list.getEntries()) if (!e.hadRecentInput) { window.__cls += e.value; for (const a of e.sources || []) window.__src.push(e.value.toFixed(3) + ' ' + (a.node?.nodeName || '?') + '.' + String(a.node?.className || '').slice(0, 40)) } }).observe({ type: 'layout-shift', buffered: true })
  }, lang)
  await page.route('**/api/**', route => {
    const url = new URL(route.request().url()); const p = url.pathname; const method = route.request().method()
    if (p === '/api/session') return route.fulfill({ json: { role: 'admin', onboardingCompleted: true } })
    if (p === '/api/admin/route-catalog' && method === 'GET') return route.fulfill({ json: { catalogs } })
    if (/^\/api\/admin\/route-catalog\/4$/.test(p)) return route.fulfill({ json: detail(4, 'draft', true) })
    if (/^\/api\/admin\/route-catalog\/3$/.test(p)) return route.fulfill({ json: detail(3, 'published', false) })
    if (method === 'PUT' && conflict) return route.fulfill({ status: 409, json: { code: 'item_changed', current: { itemKey: 'rol_ejemplo', labels: bi('Su nuevo nombre', 'Their new name'), updatedAt: day(0) } } })
    if (method === 'PUT') return route.fulfill({ json: { ...items.roles[0], updatedAt: day(0) } })
    return route.fulfill({ status: 404, json: {} })
  })
  if (cpu > 1) { const cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu }) }
  await page.goto(BASE + path, { waitUntil: 'networkidle' })
  await page.locator('h1').first().waitFor({ timeout: 8000 })
  await page.locator(ready ?? '.cg-item, form, .cg-banner').first().waitFor({ timeout: 8000 })
  return { ctx, page, errors }
}
const axe = async page => { await page.evaluate(axeSource); return page.evaluate(async () => (await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] })).violations.map(v => v.id + ':' + v.nodes.length + ' ' + v.nodes.slice(0, 3).map(n => n.target.join(' ')).join(' | '))) }
const overflow = page => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
const smallTargets = page => page.evaluate(() => [...document.querySelectorAll('main button, main a[href], main input:not([type=hidden]), main select, main textarea, dialog[open] button')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.width < 24 || r.height < 24) }).map(e => e.tagName + ':' + (e.textContent || e.id || '').trim().slice(0, 20)))
const common = async (page, tag, errors, name) => {
  report(await page.locator('h1').count() === 1, `h1 único, ${name} (${tag})`)
  report(await page.evaluate(() => document.querySelectorAll('main [style]').length) === 0, `sin estilos en línea, ${name} (${tag})`)
  const ov = await overflow(page); report(ov <= 0, `sin desborde horizontal, ${name} (${tag})`, String(ov))
  const small = await smallTargets(page); report(small.length === 0, `objetivos >= 24 px, ${name} (${tag})`, small.join(','))
  const v = await axe(page); report(v.length === 0, `axe en 0, ${name} (${tag})`, v.join(','))
  report(errors.length === 0, `sin errores de página, ${name} (${tag})`, errors.join('; '))
}

;(async () => {
  const browser = await chromium.launch()
  for (const width of [1360, 390, 320]) for (const lang of ['es', 'en']) for (const scheme of ['light', 'dark']) {
    const tag = `${width}px ${lang} ${scheme}`
    // 1) Lista de versiones
    { const { ctx, page, errors } = await open(browser, { width, lang, scheme })
      const create = page.locator('main .cg-btn').first()
      report(await create.isDisabled() && await create.getAttribute('aria-describedby') === 'catalog-draft-reason', `«Crear borrador» deshabilitado con razón enlazada (${tag})`)
      report(/4/.test(await page.locator('#catalog-draft-reason').innerText()), `la razón nombra la versión del borrador (${tag})`)
      report(await page.locator('.cg-item').count() === 3 && await page.locator('.cg-chip').count() === 3, `tres versiones con su estado en Chip (${tag})`)
      report(/✓/.test(await page.locator('.cg-chip--ok').first().innerText()), `«Publicada» con ✓ y palabra (${tag})`)
      await common(page, tag, errors, 'lista'); await ctx.close() }
    // 2) Borrador: chips, faltantes, publicar deshabilitado con razón
    { const { ctx, page, errors } = await open(browser, { width, lang, scheme, path: '/admin/route-catalog/4', ready: '#roles' })
      const chips = await page.locator('#roles .cg-chip').allInnerTexts()
      report(chips.length === 2 && /\(2\)/.test(chips[0]) && /✓/.test(chips[1]), `chips «Faltan datos (2)» y «✓ Completo» (${tag})`, chips.join(' | '))
      const publish = page.locator('main .cg-btn--ghost[aria-describedby=catalog-publish-reason]')
      report(await publish.count() === 1 && await publish.isDisabled(), `publicar deshabilitado con razón enlazada (${tag})`)
      await common(page, tag, errors, 'borrador'); await ctx.close() }
    // 3) Editor de un elemento + conflicto 409
    { const { ctx, page, errors } = await open(browser, { width, lang, scheme, path: '/admin/route-catalog/4/roles/rol_ejemplo', conflict: true, ready: '#item-key' })
      const unlabeled = await page.evaluate(() => [...document.querySelectorAll('main form input, main form select, main form textarea')].filter(e => !e.labels?.length || ![...e.labels].some(l => l.textContent.trim())).map(e => e.id || e.name || e.type))
      report(unlabeled.length === 0 && await page.locator('main form label').count() >= 8, `todos los campos con etiqueta visible (${tag})`, unlabeled.join(','))
      await common(page, tag, errors, 'editor')
      await page.locator('#catalog-save').click()
      await page.locator('.catalog-conflict').waitFor()
      report(await page.locator('.cg-banner--error [role=alert], [role=alert] .cg-banner--error').count() >= 1, `conflicto como aviso de error ⚠ (${tag})`)
      const see = page.locator('.catalog-conflict .cg-linkbtn'); await see.click()
      report(await see.getAttribute('aria-expanded') === 'true' && /Su nuevo|Their new/.test(await page.locator('.catalog-conflict').innerText()), `«Ver su versión» muestra la versión ajena (${tag})`)
      report(await page.locator('.catalog-conflict .cg-btn--ghost').count() === 1, `«Conservar la mía» disponible (${tag})`)
      await common(page, tag, errors, 'conflicto')
      await page.locator('.catalog-conflict .cg-btn--ghost').click(); await page.locator('.catalog-conflict').waitFor({ state: 'detached' })
      report(await page.locator('.pg-live .cg-banner').count() === 1, `«Conservar la mía» deja el aviso «Listo: pulsa Guardar» (${tag})`)
      // salir con cambios sin guardar por la barra lateral: pide confirmar
      await page.locator('#item-labels-es').fill('Cambio sin guardar'); let asked = 0
      page.on('dialog', d => { asked++; d.dismiss() })
      await page.locator('.cg-sidenav a').first().click({ force: true }); await page.waitForTimeout(150)
      report(asked === 1 && /route-catalog\/4\/roles/.test(page.url()), `salir con cambios sin guardar pide confirmar y puede cancelarse (${tag})`)
      await ctx.close() }
    // 4) Diálogo de confirmación (quitar elemento)
    { const { ctx, page, errors } = await open(browser, { width, lang, scheme, path: '/admin/route-catalog/4/roles/rol_ejemplo', ready: '#item-key' })
      const opener = page.locator('main .cg-btn--danger'); await opener.focus(); await page.keyboard.press('Enter'); await page.locator('dialog[open]').waitFor()
      report(await page.evaluate(() => !!document.querySelector('dialog[open]')?.contains(document.activeElement)), `foco dentro del diálogo al abrir (${tag})`)
      await common(page, tag, errors, 'diálogo')
      let inside = true; for (let i = 0; i < 8; i++) { await page.keyboard.press('Tab'); inside = inside && await page.evaluate(() => !!document.querySelector('dialog[open]')?.contains(document.activeElement)) }
      report(inside, `Tab atrapado dentro del diálogo (${tag})`)
      await page.keyboard.press('Escape'); await page.waitForFunction(() => !document.querySelector('dialog[open]'))
      report(await page.evaluate(() => document.activeElement?.className.includes('cg-btn--danger')), `Esc cierra y el foco vuelve al botón que abrió (${tag})`)
      await ctx.close() }
    // 5) Versión publicada: solo lectura
    { const { ctx, page, errors } = await open(browser, { width, lang, scheme, path: '/admin/route-catalog/3', ready: '#roles' })
      report(await page.locator('main .cg-btn:has-text("Añadir"), main .cg-btn:has-text("Add item")').count() === 0, `publicada: sin «Añadir» (solo lectura) (${tag})`)
      await common(page, tag, errors, 'publicada'); await ctx.close() }
  }
  // CLS a 390 px con CPU×4
  for (const scheme of ['light', 'dark']) for (const path of ['/admin/route-catalog', '/admin/route-catalog/4']) {
    const { ctx, page } = await open(browser, { width: 390, lang: 'es', scheme, path, cpu: 4, ready: path.endsWith('4') ? '#roles' : undefined })
    await page.waitForTimeout(800)
    const cls = await page.evaluate(() => window.__cls); report(cls <= 0.1, `CLS ${cls.toFixed(3)} <= 0,1 a 390 px con CPU×4 (${scheme}, ${path})`, cls > 0.1 ? 'fuentes: ' + (await page.evaluate(() => window.__src)).join(' ; ') : '')
    await ctx.close()
  }
  await browser.close()
  console.log(failures ? `\n${failures} FALLA(S)` : '\nTodo OK'); process.exit(failures ? 1 : 0)
})()
