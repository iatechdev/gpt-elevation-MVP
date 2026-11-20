// ES-336 (F1): /privacidad y /terminos con el texto PUBLICADO de la API y con el respaldo del repo. Chromium, API simulada (page.route), datos sintéticos. No corre en CI; evidencia del PR.
// Mide: sin respuesta útil (404, 500, JSON inválido, HTML, contenido con forma inválida, origen que no es «db», otro documento o idioma, tiempo agotado) la página muestra SIEMPRE el texto del repo
// (un h1, secciones, nunca vacía); con la semilla (igual al repo) no hay cambio visible ni CLS; con un contenido distinto se pinta el publicado (texto plano: `<script>` se ve como texto, no se ejecuta);
// axe wcag2a/2aa/21a/21aa/22aa = 0 en ES/EN × 390/1360 × claro/oscuro con el contenido publicado; sin errores de página.
// Uso: npx vite build && npx vite preview --host 127.0.0.1 --port 5301 --strictPort   y luego
//   PLAYWRIGHT_MODULE=<playwright> AXE_PATH=<axe.min.js> BASE=http://127.0.0.1:5301 node scripts/es336-check.cjs
const fs = require('fs')
const assert = require('node:assert/strict')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const axeSource = fs.readFileSync(process.env.AXE_PATH, 'utf8')
const BASE = process.env.BASE || 'http://127.0.0.1:5301'
const seed = JSON.parse(fs.readFileSync(require('path').join(__dirname, '..', '..', 'backend', 'seeds', 'legalSeed.json'), 'utf8'))
let failures = 0
const report = (ok, label, extra = '') => { if (!ok) failures++; console.log((ok ? 'OK    ' : 'FALLA ') + label + (extra ? ' ' + extra : '')) }
const published = { title: 'Aviso PUBLICADO de prueba', banner: 'Versión publicada · sintética', updated: 'Última actualización: hoy', sections: [{ heading: 'Sección publicada', paragraphs: ['Texto publicado con **negrita** y <script>window.__xss = 1</script> como texto.'] }, { bullets: ['uno', 'dos'] }] }

async function open(browser, { lang = 'es', scheme = 'light', width = 1360, doc = 'privacy', respond }) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: scheme, reducedMotion: 'reduce' }); const page = await ctx.newPage(); const errors = []
  page.on('pageerror', e => errors.push(e.message))
  await page.addInitScript(l => { localStorage.setItem('elv_lang', l); window.__cls = 0; new PerformanceObserver(list => { for (const e of list.getEntries()) if (!e.hadRecentInput) window.__cls += e.value }).observe({ type: 'layout-shift', buffered: true }) }, lang)
  await page.route('**/api/legal/**', route => respond(route, new URL(route.request().url())))
  await page.goto(BASE + (doc === 'privacy' ? '/privacidad' : '/terminos'), { waitUntil: 'domcontentloaded' })
  await page.locator('h1').first().waitFor({ timeout: 20000 })
  return { ctx, page, errors }
}
const sections = page => page.locator('.lg-section').count()
const ok200 = (route, body) => route.fulfill({ status: 200, contentType: 'application/json', json: body })

;(async () => {
  const browser = await chromium.launch()
  const repoTitle = { es: { privacy: 'Aviso de privacidad', terms: 'Términos de uso' }, en: { privacy: 'Privacy notice', terms: 'Terms of use' } }
  const cases = {
    '404 not_published': route => route.fulfill({ status: 404, json: { code: 'not_published' } }),
    '500': route => route.fulfill({ status: 500, json: { code: 'legal_unavailable' } }),
    'JSON inválido': route => route.fulfill({ status: 200, contentType: 'application/json', body: '{no es json' }),
    'HTML (SPA)': route => route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><html><body>x</body></html>' }),
    'forma inválida': route => ok200(route, { source: 'db', docKey: 'privacy', lang: 'es', content: { title: 5, sections: 'x' } }),
    'origen distinto de db': route => ok200(route, { source: 'repo', docKey: 'privacy', lang: 'es', content: published }),
    'otro documento': route => ok200(route, { source: 'db', docKey: 'terms', lang: 'es', content: published }),
    'otro idioma': (route, url) => ok200(route, { source: 'db', docKey: 'privacy', lang: url.searchParams.get('lang') === 'es' ? 'en' : 'es', content: published }),
    'corte de red': route => route.abort('failed'),
  }
  for (const lang of ['es', 'en']) for (const [name, respond] of Object.entries(cases)) {
    const { ctx, page, errors } = await open(browser, { lang, respond: (route, url) => respond(route, url) })
    await page.waitForTimeout(700)
    report((await page.locator('h1').textContent()) === repoTitle[lang].privacy && (await sections(page)) > 3 && errors.length === 0, `respaldo del repo con «${name}» (${lang}): título, secciones, sin errores`)
    await ctx.close()
  }
  { // tiempo agotado: la respuesta nunca llega; el texto del repo ya está en pantalla desde el principio
    const { ctx, page } = await open(browser, { respond: () => new Promise(() => {}) })
    report((await page.locator('h1').textContent()) === repoTitle.es.privacy && (await sections(page)) > 3, 'respuesta que no llega: se ve el texto del repo desde el primer momento'); await ctx.close()
  }
  for (const doc of ['privacy', 'terms']) for (const lang of ['es', 'en']) { // la semilla es igual al repo: no hay cambio visible ni CLS
    const respond = (route, url) => { const key = url.pathname.split('/').pop(); const l = url.searchParams.get('lang'); const found = seed.documents.find(d => d.docKey === key && d.lang === l); return found ? ok200(route, { docKey: key, lang: l, version: seed.version, source: 'db', content: found.content }) : route.fulfill({ status: 404, json: {} }) }
    const { ctx, page } = await open(browser, { doc, lang, width: 390, respond })
    const before = await page.locator('article').innerText(); await page.waitForTimeout(900)
    const base = await open(browser, { doc, lang, width: 390, respond: route => route.fulfill({ status: 404, json: {} }) }); await base.page.waitForTimeout(1200); const baseCls = await base.page.evaluate(() => window.__cls); await base.ctx.close()
    report((await page.locator('article').innerText()) === before, `semilla = repo (${doc}/${lang}): el texto no cambia al llegar la respuesta`)
    const cls = await page.evaluate(() => window.__cls)
    report(cls <= baseCls + 0.01, `semilla = repo (${doc}/${lang}): CLS ${cls.toFixed(4)} no supera al del respaldo (${baseCls.toFixed(4)}) + 0,01`)
    await ctx.close()
  }
  for (const lang of ['es', 'en']) for (const width of [390, 1360]) for (const scheme of ['light', 'dark']) { // contenido publicado distinto: se pinta como texto y pasa axe
    const respond = (route, url) => ok200(route, { docKey: 'privacy', lang: url.searchParams.get('lang'), version: 'prueba-v9', source: 'db', content: published })
    const { ctx, page, errors } = await open(browser, { lang, width, scheme, respond })
    await page.getByRole('heading', { name: published.title }).waitFor({ timeout: 15000 })
    const text = await page.locator('article').textContent() // innerText saldría en mayúsculas (CSS)
    const tag = `${lang} ${width}px ${scheme}`
    report(text.includes('<script>window.__xss = 1</script>') && (await page.evaluate(() => window.__xss)) === undefined, `contenido publicado (${tag}): <script> se ve como texto y no se ejecuta`)
    report((await page.locator('h1').count()) === 1 && text.includes('Sección publicada') && errors.length === 0, `contenido publicado (${tag}): un h1, sección publicada, sin errores`)
    await page.addScriptTag({ content: axeSource })
    const axe = await page.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } }).then(r => r.violations.map(v => v.id + ':' + v.nodes.length)))
    report(axe.length === 0, `contenido publicado (${tag}): axe 0`, axe.length ? `axe=[${axe}]` : '')
    report(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `contenido publicado (${tag}): sin desborde`)
    await ctx.close()
  }
  await browser.close()
  console.log(failures ? `\n${failures} FALLA(S)` : '\nTODO OK'); process.exit(failures ? 1 : 0)
})().catch(e => { console.error(e); process.exit(1) })
