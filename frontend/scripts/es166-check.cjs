// ES-166 + ES-167: «vista previa verificada» de /app/next-step, /experiments, /experiments/:id y /plan (simulación sintética de ES-34).
// SOLO MIDE: no toca frontend/src/career/ (propiedad de ES-34). Construye dos bundles de prueba (bandera VITE_ENABLE_CAREER_PREVIEW apagada y encendida) y los sirve en 127.0.0.1.
// Con la bandera APAGADA: «Este recorrido aún no está disponible», sin rejilla, sin pestañas y sin tarjeta en el dashboard (ES y EN).
// Con la bandera ENCENDIDA recorre el viaje completo de la simulación (restricciones → rutas → experimento → plan propuesto → plan aceptado) y en CADA estado mide,
// para ES/EN × 390/1360 px × claro/oscuro del sistema: axe WCAG 2.x A/AA, un h1, sin desborde, objetivos >= 24 px, y la franja «vista preliminar» + etiqueta «SINTÉTICO» presentes.
// Además: foco visible en los primeros tabuladores, ninguna petición de escritura (la simulación no guarda nada) y recorrido solo con teclado hasta el botón de elegir ruta.
// HALLAZGO DECLARADO (no corregido: es código de ES-34): en el plan, «propuesta sin aceptar», a 1360 px, 3 enlaces de recurso miden 20 px de alto (< 24 px); el script lo marca FALLA a propósito. Ver ES-237.
// No corre en CI; evidencia del PR. Uso:  PLAYWRIGHT_MODULE=<playwright> AXE_PATH=<axe.min.js> node scripts/es166-check.cjs
const fs = require('fs')
const path = require('path')
const http = require('http')
const { spawnSync } = require('child_process')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const axeSource = fs.readFileSync(process.env.AXE_PATH, 'utf8')
const root = path.resolve(__dirname, '..')
let failures = 0
const report = (ok, label, extra = '') => { if (!ok) failures++; console.log((ok ? 'OK    ' : 'FALLA ') + label + (extra ? ' ' + extra : '')) }
const date = days => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10)
const servers = []; const tags = []

async function serve(directory) {
  const server = http.createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname)
    let file = path.resolve(directory, '.' + pathname)
    if (file !== directory && !file.startsWith(directory + path.sep)) { res.writeHead(403); res.end(); return }
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(directory, 'index.html')
    res.setHeader('Content-Type', { '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.html': 'text/html', '.svg': 'image/svg+xml' }[path.extname(file)] || 'application/octet-stream')
    res.end(fs.readFileSync(file))
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); servers.push(server)
  return `http://127.0.0.1:${server.address().port}`
}
function build(flag) {
  const directory = path.resolve(root, 'node_modules', '.es166-' + flag)
  const result = spawnSync(process.execPath, [path.join(root, 'node_modules/vite/bin/vite.js'), 'build', '--outDir', directory, '--emptyOutDir'],
    { cwd: root, encoding: 'utf8', env: { ...process.env, VITE_ENABLE_CAREER_PREVIEW: flag === 'on' ? 'true' : 'false' } })
  if (result.status !== 0) throw new Error(result.stderr || result.stdout)
  return directory
}

async function open(browser, base, { path: pathname = '/app/next-step', lang = 'es', width = 1360 } = {}) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' })
  const writes = []; const pageErrors = []
  await context.addInitScript(l => { localStorage.setItem('elevation_token', 'synthetic-session-a'); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elv_lang', l) }, lang)
  await context.route('**/api/**', route => {
    const request = route.request(); const p = new URL(request.url()).pathname
    if (request.method() !== 'GET') { writes.push(request.method() + ' ' + p); return route.abort() }
    if (p === '/api/session') return route.fulfill({ json: { role: 'user', onboardingCompleted: true } })
    const body = p === '/api/recommendations' || p === '/api/messages' ? [] : p === '/api/user/progress' ? { moodLogs: [] } : p === '/api/user/plan/me' ? { plan: null, limits: null } : {}
    return route.fulfill({ json: body })
  })
  const page = await context.newPage(); page.setDefaultTimeout(10000); page.on('pageerror', e => pageErrors.push(e.message))
  await page.goto(base + pathname); await page.waitForLoadState('networkidle')
  return { context, page, writes, pageErrors }
}
async function axeAndLayout(page, label, { preview = true } = {}) {
  await page.addScriptTag({ content: axeSource })
  const axe = await page.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } }).then(r => r.violations.map(v => v.id + ':' + v.nodes.length)))
  const r = await page.evaluate(() => ({
    h1: document.querySelectorAll('h1').length, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    small: [...document.querySelectorAll('a[href], button, select, textarea, input:not([type=checkbox]):not([type=radio])')].filter(el => { const b = el.getBoundingClientRect(); const s = getComputedStyle(el); return b.width > 1 && b.height > 1 && s.visibility !== 'hidden' && (b.width < 24 || b.height < 24) }).map(el => (el.tagName.toLowerCase() + (el.type ? '[' + el.type + ']' : '') + ' «' + (el.getAttribute('aria-label') || el.innerText || el.id || (el.labels && el.labels[0] && el.labels[0].innerText) || '').trim().slice(0, 28) + '» ' + (el.tagName === 'A' ? el.outerHTML.slice(0, 90) + ' ' : '') + Math.round(el.getBoundingClientRect().width) + 'x' + Math.round(el.getBoundingClientRect().height))),
    note: !!document.querySelector('[role=note]') && /(sint[eé]tic|synthetic)/i.test(document.querySelector('[role=note]').textContent), tag: /SINT[ÉE]TICO|SYNTHETIC/.test(document.body.innerText),
  }))
  report(r.h1 === 1 && r.overflow <= 0 && axe.length === 0, label, `h1=${r.h1} desborde=${r.overflow} axe=[${axe}]`)
  report(r.small.length === 0, `${label}: objetivos >= 24 px`, `pequeños=[${r.small}]`)
  if (preview) { report(r.note, `${label}: franja «vista preliminar con datos sintéticos»`); tags.push(`${label}=${r.tag}`) }
}
// Mide el estado actual en toda la matriz y deja la página como estaba (ES, 1360, claro).
async function matrix(page, state) {
  for (const lang of ['es', 'en']) {
    await page.getByRole('button', { name: lang === 'es' ? 'Español' : 'English', exact: true }).click()
    for (const width of [390, 1360]) for (const scheme of ['light', 'dark']) {
      await page.setViewportSize({ width, height: 900 }); await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' })
      await axeAndLayout(page, `${state} ${lang} ${width}px ${scheme}`)
    }
  }
  await page.getByRole('button', { name: 'Español', exact: true }).click(); await page.setViewportSize({ width: 1360, height: 900 }); await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' })
}
async function focusRing(page, label) {
  await page.evaluate(() => document.activeElement && document.activeElement.blur())
  let visible = 0; let stops = 0
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Tab')
    const r = await page.evaluate(() => { const el = document.activeElement; if (!el || el === document.body) return null; const s = getComputedStyle(el); return (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) || (s.boxShadow && s.boxShadow !== 'none') })
    if (r !== null) { stops++; if (r) visible++ }
  }
  report(stops >= 4 && visible === stops, `${label}: foco visible en los primeros ${stops} tabuladores`, `${visible}/${stops}`)
}
async function constraints(page) {
  await page.getByRole('checkbox', { name: 'Colombia', exact: true }).check(); await page.getByRole('checkbox', { name: 'Dinamarca', exact: true }).check()
  await page.getByRole('checkbox', { name: 'Español', exact: true }).check(); await page.getByRole('checkbox', { name: 'Inglés', exact: true }).check()
  await page.getByLabel('Contexto de origen (opcional)').selectOption('education')
  await page.getByRole('group', { name: 'Contextos de interés', exact: true }).getByRole('checkbox', { name: 'Análisis', exact: true }).check()
  await page.getByRole('button', { name: 'Guardar restricciones', exact: true }).click()
}

;(async () => {
  const offDir = build('off'); const onDir = build('on'); const off = await serve(offDir); const on = await serve(onDir)
  const browser = await chromium.launch()
  try {
    // 1) Bandera apagada (producción por defecto).
    for (const lang of ['es', 'en']) {
      const msg = lang === 'es' ? 'Este recorrido aún no está disponible.' : 'This journey is not available yet.'
      for (const route of ['/app/next-step', '/app/next-step/experiments', '/app/next-step/experiments/1', '/app/next-step/plan']) {
        const { context, page, writes } = await open(browser, off, { path: route, lang })
        await page.getByText(msg, { exact: true }).waitFor()
        report(await page.locator('.career-grid').count() === 0 && await page.locator('.career-scope nav').count() === 0 && await page.locator('[role=note]').count() === 0, `bandera apagada ${lang} ${route}: «${msg}», sin rejilla, pestañas ni franja`)
        await axeAndLayout(page, `bandera apagada ${lang} ${route}`, { preview: false })
        report(writes.length === 0, `bandera apagada ${lang} ${route}: ninguna escritura`)
        await context.close()
      }
      const { context, page } = await open(browser, off, { path: '/app/dashboard', lang })
      report(await page.locator('.career-entry').count() === 0, `bandera apagada ${lang}: el dashboard no muestra la tarjeta del recorrido`)
      await context.close()
    }

    // 2) Bandera encendida: recorrido completo, midiendo cada estado.
    const { context, page, writes, pageErrors } = await open(browser, on)
    await page.getByText('Tus restricciones', { exact: true }).waitFor()
    await matrix(page, 'restricciones'); await focusRing(page, 'restricciones')
    await constraints(page); await page.waitForFunction(() => document.querySelectorAll('.career-grid article').length === 3)
    await matrix(page, 'rutas'); await focusRing(page, 'rutas')
    // Solo teclado: de la lista de rutas al botón «Elegir esta ruta» sin ratón.
    await page.evaluate(() => document.activeElement && document.activeElement.blur())
    let reached = false
    for (let i = 0; i < 60 && !reached; i++) { await page.keyboard.press('Tab'); reached = await page.evaluate(() => /Elegir esta ruta/.test(document.activeElement?.textContent || '')) }
    report(reached, 'rutas: «Elegir esta ruta» se alcanza solo con teclado')
    const first = page.locator('.career-grid article').first()
    await first.getByRole('button', { name: 'Elegir esta ruta', exact: true }).click()
    await first.getByRole('button', { name: 'Revisar y aceptar experimento', exact: true }).click(); await page.waitForURL(/\/experiments\/\d+$/)
    await page.getByRole('button', { name: 'Iniciar', exact: true }).waitFor()
    await matrix(page, 'experimento (listo)'); await focusRing(page, 'experimento')
    await page.getByRole('button', { name: 'Iniciar', exact: true }).click()
    await page.getByLabel('Muestra escrita', { exact: true }).fill('SYNTHETIC SAMPLE — no personal data'); await page.getByLabel('Ayuda utilizada', { exact: true }).selectOption('drafting')
    await page.getByRole('button', { name: 'Guardar entrega', exact: true }).click(); await page.getByLabel('Observación', { exact: true }).waitFor()
    await matrix(page, 'experimento (entregado)')
    await page.getByLabel('Observación', { exact: true }).fill('Synthetic observation'); await page.getByLabel('Interpretación', { exact: true }).fill('Synthetic interpretation')
    await page.getByRole('button', { name: 'Guardar mi reflexión', exact: true }).click()
    await page.getByLabel('Decisión', { exact: true }).selectOption('continue'); await page.getByLabel('Razón de tu decisión', { exact: true }).fill('Synthetic reason')
    await page.getByRole('button', { name: 'Guardar decisión', exact: true }).click()
    await matrix(page, 'experimento (decidido)')
    await page.getByRole('button', { name: 'Proponer plan', exact: true }).click(); await page.waitForURL(/\/plan$/)
    await page.getByLabel('Experimento', { exact: true }).waitFor()
    await matrix(page, 'plan (sin propuesta)'); await focusRing(page, 'plan')
    await page.getByLabel('Experimento', { exact: true }).selectOption({ index: 1 }); await page.getByRole('button', { name: 'Proponer plan', exact: true }).click()
    for (const [i, horizon] of [7, 30, 90].entries()) {
      const group = page.getByRole('group', { name: `${horizon} días`, exact: true }); await group.getByRole('checkbox', { name: 'Aceptar acción', exact: true }).check(); await group.getByLabel('Fecha elegida', { exact: true }).fill(date([3, 20, 70][i]))
    }
    await matrix(page, 'plan (propuesta sin aceptar)')
    await page.getByRole('button', { name: 'Revisar selección', exact: true }).click(); await page.getByRole('button', { name: 'Confirmar plan', exact: true }).click()
    await page.getByRole('heading', { name: /Plan aceptado · Versión/ }).waitFor()
    await matrix(page, 'plan (aceptado)')
    await page.getByRole('link', { name: 'Experimentos', exact: true }).first().click(); await page.waitForURL(/\/experiments$/)
    await matrix(page, 'lista de experimentos')
    report(writes.length === 0, 'el recorrido completo no envió ninguna petición de escritura (la simulación no guarda nada)', writes.join(' | '))
    report(pageErrors.length === 0, 'el recorrido completo no produjo errores de página', pageErrors.join(' | '))
    await context.close()
  } finally {
    await browser.close(); for (const server of servers) server.close()
  }
  const withTag = tags.filter(t => t.endsWith('=true')).length; console.log(`INFO  etiqueta «SINTÉTICO» visible en ${withTag}/${tags.length} mediciones (solo donde hay datos de ejemplo listados)`)
  console.log(failures ? `\n${failures} FALLAS` : '\nTODO OK')
  process.exit(failures ? 1 : 0)
})().catch(e => { console.error(e); process.exit(2) })
