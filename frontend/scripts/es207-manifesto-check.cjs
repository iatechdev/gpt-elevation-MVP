// ES-207: /manifiesto en navegador. Estados (éxito, vacío, error con reintento), ES/EN, 390 y 1360 px: axe (WCAG 2.x A/AA), un h1,
// sin scroll horizontal, objetivos ≥ 24 px, teclado (saltar al contenido, Reintentar), y redirecciones/enlaces por rol. No corre en CI; evidencia del PR.
// API simulada. Uso: `npx vite preview --port 5299 --strictPort` y luego
//   PLAYWRIGHT_MODULE=<playwright> AXE_PATH=<axe.min.js> BASE=http://localhost:5299 node scripts/es207-manifesto-check.cjs
const fs = require('fs')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const axeSource = fs.readFileSync(process.env.AXE_PATH, 'utf8')
const BASE = process.env.BASE || 'http://localhost:5299'
const TEXT = 'Principio uno.\nSegunda línea del mismo párrafo.\n\nPrincipio dos. Texto largo sin espacios: ' + 'x'.repeat(10) + ' y más texto para comprobar el ajuste en 390 píxeles de ancho.\n\n<b>No es HTML</b>'
const READY = JSON.stringify({ version: 'v3', content: TEXT, publishedAt: '2026-11-08T12:00:00.000Z' })
let failures = 0
const report = (ok, label, extra = '') => { if (!ok) failures++; console.log((ok ? 'OK    ' : 'FALLA ') + label + (extra ? ' ' + extra : '')) }

async function open(browser, { width, lang, mode, role }) {
  const ctx = await browser.newContext({ viewport: { width, height: 800 } })
  const page = await ctx.newPage()
  let calls = 0
  await page.route('**/api/**', route => {
    const p = new URL(route.request().url()).pathname
    if (p === '/api/manifest/active') {
      calls++
      if (mode === 'error' && calls === 1) return route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"x"}' })
      if (mode === 'empty') return route.fulfill({ status: 200, contentType: 'application/json', body: '{"content":null}' })
      return route.fulfill({ status: 200, contentType: 'application/json', body: READY })
    }
    const body = p === '/api/session' ? JSON.stringify({ role: role || 'user', onboardingCompleted: true }) : '[]'
    return route.fulfill({ status: 200, contentType: 'application/json', body })
  })
  await page.addInitScript(([l, r]) => {
    localStorage.setItem('elv_lang', l)
    if (r) {
      localStorage.setItem('elevation_token', 'aaa.bbb.ccc-abcdefghijklmnopqrstuvwxyz0123456789')
      localStorage.setItem('elevation_role', r)
      localStorage.setItem('elevation_name', 'Synthetic QA')
    }
  }, [lang, role || ''])
  return { ctx, page }
}

;(async () => {
  const browser = await chromium.launch()
  for (const mode of ['ready', 'empty', 'error']) for (const lang of ['es', 'en']) for (const width of [390, 1360]) {
    const { ctx, page } = await open(browser, { width, lang, mode })
    const label = mode + ' ' + lang + ' ' + width + 'px'
    try {
      await page.goto(BASE + '/manifiesto', { waitUntil: 'networkidle' })
      await page.waitForTimeout(300)
      if (mode === 'error') {
        const alertText = await page.locator('[role=alert]').first().innerText()
        report(/No pudimos cargar|could not load/i.test(alertText), label + ' muestra el error')
        await page.getByRole('button', { name: lang === 'es' ? 'Reintentar' : 'Try again' }).focus()
        await page.keyboard.press('Enter')
        await page.waitForTimeout(400)
      }
      await page.addScriptTag({ content: axeSource })
      const axe = await page.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } }).then(r => r.violations.map(v => v.id + ':' + v.nodes.length)))
      const r = await page.evaluate(() => {
        const small = [...document.querySelectorAll('a[href], button')].filter(el => { const b = el.getBoundingClientRect(); const s = getComputedStyle(el); return b.width > 1 && b.height > 1 && s.visibility !== 'hidden' && (b.width < 24 || b.height < 24) }).map(el => el.innerText.trim().slice(0, 20))
        const body = document.querySelector('.manifesto__body')
        return {
          h1: document.querySelectorAll('h1').length, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, small,
          paragraphs: body ? body.querySelectorAll('p').length : 0, rawTag: body ? !!body.querySelector('b') : false,
          scrollInner: body ? body.scrollHeight > body.clientHeight + 1 : false, text: document.body.innerText, label: (document.querySelector('.manifesto__meta') || {}).innerText || '',
        }
      })
      let ok = r.h1 === 1 && r.overflow <= 0 && r.small.length === 0 && axe.length === 0
      if (mode === 'ready' || mode === 'error') {
        const versionText = lang === 'es' ? /Versión v3 · publicada el 8 de noviembre de 2026/i : /Version v3 · published November 8, 2026/i
        ok = ok && r.paragraphs === 3 && !r.rawTag && !r.scrollInner && versionText.test(r.label) && r.text.includes('<b>No es HTML</b>')
      }
      if (mode === 'empty') ok = ok && (lang === 'es' ? /Aún no hay un manifiesto publicado/.test(r.text) : /No manifesto has been published yet/.test(r.text))
      report(ok, label, 'h1=' + r.h1 + ' desborde=' + r.overflow + ' pequeños=' + r.small.length + ' axe=[' + axe + '] párrafos=' + r.paragraphs)
    } catch (error) { report(false, label, error.message.slice(0, 100)) }
    await ctx.close()
  }
  { // Teclado: «Saltar al contenido» es lo primero alcanzable y lleva el foco al main.
    const { ctx, page } = await open(browser, { width: 1360, lang: 'es', mode: 'ready' })
    await page.goto(BASE + '/manifiesto', { waitUntil: 'networkidle' })
    await page.keyboard.press('Tab')
    const first = await page.evaluate(() => document.activeElement.textContent.trim())
    await page.keyboard.press('Enter')
    const id = await page.evaluate(() => document.activeElement.id)
    report(/Saltar al contenido/.test(first) && id === 'main', 'teclado: saltar al contenido', first + ' -> #' + id)
    await ctx.close()
  }
  for (const [role, expectSignOut] of [[undefined, false], ['user', false], ['board', true]]) { // marco según la sesión
    const { ctx, page } = await open(browser, { width: 1360, lang: 'es', mode: 'ready', role })
    await page.goto(BASE + '/manifiesto', { waitUntil: 'networkidle' })
    const signOut = await page.getByRole('button', { name: 'Salir' }).count()
    const title = await page.locator('h1').innerText()
    report((signOut > 0) === expectSignOut && title.toLowerCase() === 'manifiesto ético', 'marco de ' + (role || 'anónimo'), 'salir=' + signOut + ' h1=' + title)
    await ctx.close()
  }
  {
    const { ctx, page } = await open(browser, { width: 1360, lang: 'es', mode: 'ready', role: 'board' })
    await page.goto(BASE + '/board/manifest', { waitUntil: 'networkidle' })
    report(new URL(page.url()).pathname === '/manifiesto', 'junta: /board/manifest redirige a /manifiesto', page.url())
    await ctx.close()
  }
  {
    const { ctx, page } = await open(browser, { width: 1360, lang: 'es', mode: 'ready', role: 'admin' })
    await page.goto(BASE + '/admin/manifest', { waitUntil: 'networkidle' })
    const link = await page.getByRole('link', { name: 'Ver página pública' }).count()
    report(link === 1 && new URL(page.url()).pathname === '/admin/manifest', 'admin: edición accesible con enlace «Ver página pública»', 'enlaces=' + link)
    await ctx.close()
  }
  {
    const { ctx, page } = await open(browser, { width: 1360, lang: 'es', mode: 'ready', role: 'user' })
    await page.goto(BASE + '/admin/manifest', { waitUntil: 'networkidle' })
    report(/no tiene acceso/i.test(await page.locator('body').innerText()), 'persona: /admin/manifest muestra «sin acceso»')
    await ctx.close()
  }
  await browser.close()
  process.exit(failures ? 1 : 0)
})()
