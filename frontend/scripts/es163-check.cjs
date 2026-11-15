// ES-163 + ES-307 (PR 3, Cartografía): /app/diary, /app/diary/new y /app/diary/:id en navegador real (Chromium), API simulada con la MISMA idempotencia del servidor (requestId por persona), datos sintéticos.
// Matriz ES/EN × 390/1360 px × claro/oscuro del sistema: axe WCAG 2.x A/AA (lista, nueva, detalle y diálogo de borrar), un h1, sin desborde, objetivos >= 24 px.
// Interacciones (ES 1360 claro; EN 390 oscuro): doble clic en Guardar = un solo envío; ACK perdido (el servidor guardó pero la respuesta no llegó) → «Reintentar guardar» con el MISMO requestId
// = una sola entrada; el diálogo de borrar dice las palabras del criterio y conserva la nota de límites; ningún borrador ni requestId en almacenamiento.
// No corre en CI; evidencia del PR. Uso: `npx vite build && npx vite preview --port 5299 --strictPort` y luego
//   PLAYWRIGHT_MODULE=<playwright> AXE_PATH=<axe.min.js> BASE=http://localhost:5299 node scripts/es163-check.cjs
const fs = require('fs')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const axeSource = fs.readFileSync(process.env.AXE_PATH, 'utf8')
const BASE = process.env.BASE || 'http://localhost:5299'
let failures = 0
const report = (ok, label, extra = '') => { if (!ok) failures++; console.log((ok ? 'OK    ' : 'FALLA ') + label + (extra ? ' ' + extra : '')) }
const T = {
  es: { save: 'Guardar entrada', retry: 'Reintentar guardar', retryHint: /Se guardará una sola vez/, unknown: /No pudimos verificar el guardado/, del: 'Borrar', delWarn: 'No se puede deshacer. Lo que escribiste se borra de tu diario.', delLimit: /Borrar la entrada no borra mensajes ya confirmados/, saved: 'Guardado' },
  en: { save: 'Save entry', retry: 'Try saving again', retryHint: /only once/, unknown: /We could not verify the save/, del: 'Delete', delWarn: 'This cannot be undone. What you wrote is deleted from your journal.', delLimit: /Deleting the entry does not delete previously confirmed messages/, saved: 'Saved' },
}
const seed = () => [
  { id: 1, date: '2026-10-28', content: 'Hoy hablé con mi jefa sobre el cambio de área.', createdAt: '2026-10-28T10:00:00.000Z', updatedAt: '2026-10-28T10:00:00.000Z', requestId: null },
  { id: 2, date: '2026-10-26', content: 'Reunión con el equipo de datos.', createdAt: '2026-10-26T10:00:00.000Z', updatedAt: '2026-10-26T10:00:00.000Z', requestId: null },
]
const publicEntry = ({ requestId, ...entry }) => entry

async function open(browser, { width, lang, scheme, path = '/app/diary', mode = 'ok', delay = 0 }) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: scheme, reducedMotion: 'reduce' })
  const page = await ctx.newPage()
  const state = { entries: seed(), posts: [], mode, delay, nextId: 3, pageErrors: [] }
  page.on('pageerror', e => state.pageErrors.push(e.message))
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url()); const p = url.pathname; const method = route.request().method()
    if (p === '/api/session') return route.fulfill({ json: { role: 'user', onboardingCompleted: true } })
    if (p === '/api/diary' && method === 'GET') return route.fulfill({ json: { entries: state.entries.filter(e => !e.deleted).map(publicEntry) } })
    if (p === '/api/diary' && method === 'POST') {
      const body = JSON.parse(route.request().postData() || '{}'); state.posts.push(body)
      if (state.delay) await new Promise(r => setTimeout(r, state.delay))
      const existing = body.requestId && state.entries.find(e => e.requestId === body.requestId)
      let response
      if (existing) response = existing.content === body.content && existing.date === body.date ? { status: 200, json: publicEntry(existing) } : { status: 409, json: { code: 'request_id_reuse' } }
      else {
        const now = new Date().toISOString(); const entry = { id: state.nextId++, date: body.date, content: body.content, createdAt: now, updatedAt: now, requestId: body.requestId ?? null }
        state.entries.unshift(entry); response = { status: 201, json: publicEntry(entry) }
      }
      if (state.mode === 'lose-ack') { state.mode = 'ok'; return route.abort('connectionreset') } // el servidor guardó, la respuesta no llegó
      return route.fulfill(response)
    }
    const one = p.match(/^\/api\/diary\/(\d+)$/)
    if (one) {
      const entry = state.entries.find(e => e.id === Number(one[1]) && !e.deleted)
      if (method === 'DELETE') { if (!entry) return route.fulfill({ status: 404, json: {} }); entry.deleted = true; return route.fulfill({ json: { id: entry.id, deleted: true } }) }
      return entry ? route.fulfill({ json: publicEntry(entry) }) : route.fulfill({ status: 404, json: {} })
    }
    return route.fulfill({ json: {} })
  })
  await page.addInitScript(l => { localStorage.setItem('elevation_token', 'synthetic-browser-token'); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elv_lang', l) }, lang)
  await page.goto(BASE + path, { waitUntil: 'networkidle' })
  return { ctx, page, state }
}
async function axeAndLayout(page, label) {
  await page.addScriptTag({ content: axeSource })
  const axe = await page.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } }).then(r => r.violations.map(v => v.id + ':' + v.nodes.length)))
  const r = await page.evaluate(() => ({
    h1: document.querySelectorAll('h1').length, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    small: [...document.querySelectorAll('main a[href], main button, main input:not([type=checkbox]), main textarea, dialog button')].filter(el => { const b = el.getBoundingClientRect(); const s = getComputedStyle(el); return b.width > 1 && b.height > 1 && s.visibility !== 'hidden' && (b.width < 24 || b.height < 24) }).map(el => (el.getAttribute('aria-label') || el.innerText || el.id).trim().slice(0, 24)),
  }))
  report(r.h1 === 1 && r.overflow <= 0 && axe.length === 0, label, `h1=${r.h1} desborde=${r.overflow} axe=[${axe}]`)
  report(r.small.length === 0, `${label}: objetivos >= 24 px`, `pequeños=[${r.small}]`)
}
const storageKeys = page => page.evaluate(() => JSON.stringify([Object.keys(localStorage).sort(), Object.keys(sessionStorage).sort()]))

;(async () => {
  const browser = await chromium.launch()
  for (const lang of ['es', 'en']) for (const width of [390, 1360]) for (const scheme of ['light', 'dark']) {
    const t = T[lang]; const tag = `${lang} ${width}px ${scheme}`
    for (const [path, name] of [['/app/diary', 'lista'], ['/app/diary/new', 'nueva'], ['/app/diary/1', 'detalle']]) {
      const { ctx, page } = await open(browser, { width, lang, scheme, path })
      await page.locator('h1').first().waitFor()
      await axeAndLayout(page, `diario ${name} ${tag}`)
      if (name === 'detalle') {
        await page.getByRole('button', { name: t.del, exact: true }).click(); await page.locator('dialog[open]').waitFor()
        await axeAndLayout(page, `diálogo de borrar ${tag}`)
      }
      await ctx.close()
    }
  }

  for (const [lang, width, scheme] of [['es', 1360, 'light'], ['en', 390, 'dark']]) {
    const t = T[lang]; const tag = `${lang} ${width}px ${scheme}`
    // 1) Doble clic en Guardar = un solo envío.
    {
      const { ctx, page, state } = await open(browser, { width, lang, scheme, path: '/app/diary/new', delay: 700 })
      await page.locator('#entry-content').fill('Entrada con doble clic'); const keys = await storageKeys(page)
      const save = page.getByRole('button', { name: t.save, exact: true })
      await save.dblclick({ delay: 20 }).catch(() => {})
      await page.waitForURL(/\/app\/diary\/\d+$/, { timeout: 8000 })
      report(state.posts.length === 1 && state.entries.filter(e => e.content === 'Entrada con doble clic').length === 1, `doble clic en Guardar = un solo envío y una entrada ${tag}`, `POST=${state.posts.length}`)
      report(await storageKeys(page) === keys, `ningún borrador ni requestId se guarda en el almacenamiento ${tag}`)
      await ctx.close()
    }
    // 2) ACK perdido: «Reintentar guardar» con el mismo requestId = una sola entrada.
    {
      const { ctx, page, state } = await open(browser, { width, lang, scheme, path: '/app/diary/new', mode: 'lose-ack' })
      await page.locator('#entry-content').fill('Entrada con respuesta perdida')
      await page.getByRole('button', { name: t.save, exact: true }).click()
      await page.getByText(t.unknown).first().waitFor({ timeout: 8000 })
      report(await page.getByRole('button', { name: t.retry, exact: true }).isVisible() && await page.getByText(t.retryHint).isVisible(), `guardado incierto: «${t.retry}» con su explicación ${tag}`)
      report(await page.inputValue('#entry-content') === 'Entrada con respuesta perdida' && await page.locator('#entry-content').isDisabled(), `lo escrito se conserva (campos bloqueados) ${tag}`)
      report(state.entries.filter(e => e.content === 'Entrada con respuesta perdida').length === 1, `el servidor ya tenía la entrada (ACK perdido) ${tag}`)
      await axeAndLayout(page, `diario con guardado incierto ${tag}`)
      await page.getByRole('button', { name: t.retry, exact: true }).click()
      await page.waitForURL(/\/app\/diary\/\d+$/, { timeout: 8000 })
      const mine = state.entries.filter(e => e.content === 'Entrada con respuesta perdida')
      const ids = new Set(state.posts.map(b => b.requestId))
      report(mine.length === 1 && state.posts.length === 2 && ids.size === 1 && [...ids][0], `reintentar usa el MISMO requestId y NO duplica la entrada ${tag}`, `entradas=${mine.length} POST=${state.posts.length} ids=${ids.size}`)
      // la entrada se lee del servidor tras navegar: sondeo por intervalo hasta 10 s (no una espera fija); si falla, adjunta captura y DOM
      const seen = await page.waitForFunction(() => document.body.innerText.includes('Entrada con respuesta perdida'), null, { timeout: 10000, polling: 100 }).then(() => true, () => false)
      if (seen) report(true, `tras reintentar se ve la entrada guardada ${tag}`)
      else {
        const shot = `es163-fail-${lang}-${width}-${scheme}.png`; await page.screenshot({ path: shot, fullPage: true }).catch(() => {})
        const dom = await page.evaluate(() => document.body.innerHTML.slice(0, 1500)).catch(() => '')
        report(false, `tras reintentar se ve la entrada guardada ${tag}`, `| ${page.url()} | captura=${shot} | DOM=${dom.replace(/\s+/g, ' ')}`)
      }
      report(state.pageErrors.length === 0, `sin errores de página ${tag}`, state.pageErrors.join(' | '))
      await ctx.close()
    }
    // 3) Borrar: palabras del criterio + nota de límites.
    {
      const { ctx, page, state } = await open(browser, { width, lang, scheme, path: '/app/diary/1' })
      await page.getByRole('button', { name: t.del, exact: true }).click(); await page.locator('dialog[open]').waitFor()
      const text = await page.locator('dialog[open]').innerText()
      report(text.includes(t.delWarn) && t.delLimit.test(text), `el diálogo de borrar dice «${t.delWarn}» y conserva la nota de límites ${tag}`)
      await page.locator('dialog[open]').getByRole('button', { name: t.del, exact: true }).click()
      await page.waitForFunction(() => !document.querySelector('dialog[open]'), null, { timeout: 5000 })
      report(state.entries.find(e => e.id === 1).deleted === true, `confirmar borra la entrada ${tag}`)
      await ctx.close()
    }
  }
  // ES-307 (PR 3): 320 px, diálogos (foco, Tab atrapado, Esc, foco devuelto), Spectral en el texto de la persona, ⚠ del aviso, «Entradas» y CLS a 390 px con CPU×4.
  for (const lang of ['es', 'en']) for (const scheme of ['light', 'dark']) {
    const t = T[lang]; const tag = `${lang} 320px ${scheme}`
    for (const [path, name] of [['/app/diary', 'lista'], ['/app/diary/new', 'nueva'], ['/app/diary/1', 'detalle']]) {
      const { ctx, page } = await open(browser, { width: 320, lang, scheme, path }); await page.locator('h1').first().waitFor(); await axeAndLayout(page, `diario ${name} ${tag}`); await ctx.close()
    }
  }
  for (const lang of ['es', 'en']) for (const scheme of ['light', 'dark']) {
    const t = T[lang]; const tag = `${lang} 1360px ${scheme}`
    const entries = lang === 'es' ? 'Entradas' : 'Entries'
    { // detalle: diálogo de borrar
      const { ctx, page } = await open(browser, { width: 1360, lang, scheme, path: '/app/diary/1' }); await page.locator('h1').first().waitFor()
      report((await page.locator('aside h2').innerText()).trim().toLowerCase() === entries.toLowerCase(), `encabezado de la lista «${entries}» ${tag}`)
      report(await page.locator('.pg-sheet').evaluate(el => { const l = el.getBoundingClientRect(); const r = document.querySelector('.pg-recent').getBoundingClientRect(); return l.left > r.left }), `dos columnas desde 900 px: lista a la izquierda, hoja a la derecha ${tag}`)
      report((await page.locator('.pg-reading').evaluate(el => getComputedStyle(el).fontFamily)).includes('Spectral'), `texto de la persona en Spectral (lectura) ${tag}`)
      const del = page.getByRole('button', { name: t.del, exact: true }); await del.focus(); await del.click(); await page.locator('dialog[open]').waitFor()
      const first = await page.evaluate(() => document.activeElement?.textContent?.trim())
      report(!!(await page.evaluate(() => document.activeElement?.closest('dialog'))) && first?.length > 0, `diálogo borrar: el foco entra (${first}) ${tag}`)
      const trapped = []; for (let i = 0; i < 4; i++) { await page.keyboard.press('Tab'); trapped.push(await page.evaluate(() => !!document.activeElement?.closest('dialog'))) }
      await page.keyboard.press('Shift+Tab'); trapped.push(await page.evaluate(() => !!document.activeElement?.closest('dialog')))
      report(trapped.every(Boolean), `diálogo borrar: Tab y Shift+Tab atrapados ${tag}`)
      await page.keyboard.press('Escape')
      report(await page.locator('dialog[open]').count() === 0 && (await page.evaluate(() => document.activeElement?.textContent?.trim().toLowerCase())) === t.del.toLowerCase(), `diálogo borrar: Esc cierra y el foco vuelve a «${t.del}» ${tag}`)
      await ctx.close()
    }
    { // nueva con texto: cancelar → diálogo de salir; Esc conserva; descartar vuelve a la lista
      const { ctx, page } = await open(browser, { width: 1360, lang, scheme, path: '/app/diary/new' }); await page.locator('h1').first().waitFor()
      const note = 'BORRADOR_SINTETICO_307C'; await page.locator('#entry-content').fill(note)
      report((await page.locator('#entry-content').evaluate(el => getComputedStyle(el).fontFamily)).includes('Spectral'), `texto que se escribe en Spectral ${tag}`)
      const cancel = page.getByRole('button', { name: lang === 'es' ? 'Cancelar' : 'Cancel', exact: true }); await cancel.click(); await page.locator('dialog[open]').waitFor()
      await page.keyboard.press('Escape')
      report(await page.locator('dialog[open]').count() === 0 && await page.locator('#entry-content').inputValue() === note, `diálogo salir: Esc conserva el borrador ${tag}`)
      report(!(await storageKeys(page)).includes(note) && !(await page.evaluate(() => location.href)).includes(note), `borrador fuera del almacenamiento y de la URL ${tag}`)
      await cancel.click(); await page.locator('dialog[open]').getByRole('button').last().click(); await page.waitForURL('**/app/diary')
      report(true, `diálogo salir: descartar vuelve a la lista ${tag}`)
      await ctx.close()
    }
    { // fecha vacía → error con role=alert y foco; guardado incierto con ⚠
      const { ctx, page } = await open(browser, { width: 1360, lang, scheme, path: '/app/diary/new' }); await page.locator('h1').first().waitFor()
      await page.locator('#entry-content').fill('algo'); await page.locator('#entry-date').fill('')
      await page.getByRole('button', { name: t.save, exact: true }).click()
      report(await page.locator('#entry-date-error[role=alert]').count() === 1 && await page.evaluate(() => document.activeElement?.id) === 'entry-date', `error de fecha: role=alert y foco en el campo ${tag}`)
      await ctx.close()
    }
  }
  for (const route of ['/app/diary', '/app/diary/1']) { // CLS a 390 px con CPU×4
    const ctx = await browser.newContext({ viewport: { width: 390, height: 800 } }); const page = await ctx.newPage()
    await page.route('**/api/**', async r => { const p = new URL(r.request().url()).pathname; await new Promise(s => setTimeout(s, 80)); return r.fulfill({ json: p === '/api/session' ? { role: 'user', onboardingCompleted: true } : p === '/api/diary' ? { entries: seed() } : p === '/api/diary/1' ? seed()[0] : {} }) })
    await page.addInitScript(() => { localStorage.setItem('elv_lang', 'es'); localStorage.setItem('elevation_token', 'aaa.bbb.ccc-abcdefghijklmnopqrstuvwxyz0123456789'); localStorage.setItem('elevation_role', 'user')
      window.__cls = 0; new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value }).observe({ type: 'layout-shift', buffered: true }) })
    const cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
    await page.goto(BASE + route, { waitUntil: 'networkidle' }); await page.waitForTimeout(1500)
    const cls = await page.evaluate(() => window.__cls); report(cls <= 0.1, `CLS ${route} 390 px CPU×4`, cls.toFixed(3)); await ctx.close()
  }
  await browser.close()
  console.log(failures ? `\n${failures} FALLAS` : '\nTODO OK')
  process.exit(failures ? 1 : 0)
})().catch(e => { console.error(e); process.exit(2) })
