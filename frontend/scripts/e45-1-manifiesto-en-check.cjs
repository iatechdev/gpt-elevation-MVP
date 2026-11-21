// E45-1 (ES-182): Manifiesto con versión en inglés. Chromium, API simulada, datos sintéticos. Evidencia; no corre en CI.
// Público: ES (sin aviso), EN con contentEn (texto EN, sin aviso), EN sin contentEn (aviso + texto ES con lang="es"); axe, sin desborde en 1360/390/320, claro/oscuro.
// Administración (superadmin): el campo en inglés es opcional; <50 caracteres muestra el error y no envía; vacío no envía contentEn; con texto lo envía recortado; marca «EN» en el historial.
// Uso: PLAYWRIGHT_MODULE=… AXE_PATH=… BASE=http://127.0.0.1:4343 node scripts/e45-1-manifiesto-en-check.cjs
const fs = require('node:fs')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const BASE = process.env.BASE || 'http://127.0.0.1:4343'; const axeSource = fs.readFileSync(process.env.AXE_PATH, 'utf8')
let failures = 0; const log = (ok, msg) => { if (!ok) failures++; console.log(`${ok ? 'OK   ' : 'FALLA'} ${msg}`) }
const ES_TXT = 'Texto sintético del manifiesto en español. '.repeat(3), EN_TXT = 'Synthetic manifesto text in English. '.repeat(3)
const NOTICE = { es: 'Este texto aún no está disponible en inglés', en: 'This text is not yet available in English; the Spanish version is shown.' }
async function open(browser, path, { width = 1360, lang, scheme = 'light', role, active, versions, posts }) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: scheme, reducedMotion: 'reduce' }); const page = await ctx.newPage()
  await page.addInitScript(([l, r]) => { localStorage.setItem('elv_lang', l); if (r) { localStorage.setItem('elevation_token', 'tok'); localStorage.setItem('elevation_role', r); localStorage.setItem('elevation_name', 'Admin Sintética') } }, [lang, role || ''])
  await page.route('**/api/**', async route => { const req = route.request(); const p = new URL(req.url()).pathname
    if (p === '/api/manifest/active') return route.fulfill({ json: active })
    if (p === '/api/session') return route.fulfill({ json: { role: role || 'user', onboardingCompleted: true } })
    if (p === '/api/board/manifest' && req.method() === 'POST') { posts && posts.push(JSON.parse(req.postData() || '{}')); return route.fulfill({ status: 201, json: { version: 'v3' } }) }
    if (p === '/api/board/manifest') return route.fulfill({ json: versions || [] })
    return route.fulfill({ json: {} }) })
  await page.goto(BASE + path, { waitUntil: 'networkidle' }); await page.waitForTimeout(400)
  return { ctx, page } }
const axe = async page => { await page.addScriptTag({ content: axeSource }); const r = await page.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } })); return r.violations.map(v => `${v.id} x${v.nodes.length}`) }
;(async () => {
  const browser = await chromium.launch()
  const cases = [
    { name: 'ES con contentEn: sin aviso, texto ES', lang: 'es', active: { version: 'v2', content: ES_TXT, contentEn: EN_TXT, publishedAt: '2026-11-01T00:00:00Z' }, notice: false, text: 'manifiesto en español', bodyLang: null },
    { name: 'EN con contentEn: texto EN, sin aviso', lang: 'en', active: { version: 'v2', content: ES_TXT, contentEn: EN_TXT, publishedAt: '2026-11-01T00:00:00Z' }, notice: false, text: 'manifesto text in English', bodyLang: null },
    { name: 'EN sin contentEn (null): aviso + texto ES con lang="es"', lang: 'en', active: { version: 'v2', content: ES_TXT, contentEn: null, publishedAt: '2026-11-01T00:00:00Z' }, notice: true, text: 'manifiesto en español', bodyLang: 'es' },
    { name: 'EN con contentEn vacío «   »: se trata como ausente', lang: 'en', active: { version: 'v2', content: ES_TXT, contentEn: '   ', publishedAt: '2026-11-01T00:00:00Z' }, notice: true, text: 'manifiesto en español', bodyLang: 'es' },
    { name: 'EN con respuesta antigua sin la clave contentEn', lang: 'en', active: { version: 'v2', content: ES_TXT, publishedAt: '2026-11-01T00:00:00Z' }, notice: true, text: 'manifiesto en español', bodyLang: 'es' },
    { name: 'ES sin contentEn: sin aviso', lang: 'es', active: { version: 'v2', content: ES_TXT, contentEn: null, publishedAt: null }, notice: false, text: 'manifiesto en español', bodyLang: null },
  ]
  for (const c of cases) for (const scheme of ['light', 'dark']) for (const width of [1360, 390, 320]) {
    const { ctx, page } = await open(browser, '/manifiesto', { ...c, scheme, width })
    const m = await page.evaluate(() => ({ body: document.body.innerText, bodyLang: document.querySelector('.manifesto__body')?.getAttribute('lang') ?? null, scrollW: document.documentElement.scrollWidth, innerW: window.innerWidth, h1: document.querySelectorAll('h1').length, main: document.querySelectorAll('main').length }))
    const hasNotice = m.body.includes(NOTICE[c.lang]); const bad = await axe(page)
    const ok = hasNotice === c.notice && m.body.includes(c.text) && m.bodyLang === c.bodyLang && m.scrollW <= m.innerW && m.h1 === 1 && m.main === 1 && bad.length === 0
    log(ok, `${c.name} · ${scheme} ${width}${ok ? '' : ` notice=${hasNotice} bodyLang=${m.bodyLang} scroll=${m.scrollW}/${m.innerW} axe[${bad}]`}`); await ctx.close() }
  // administración
  const versions = [{ id: 2, version: 'v2', isActive: true, note: null, content: ES_TXT, contentEn: EN_TXT, createdAt: '2026-11-01T00:00:00Z', uploader: { id: 1, name: 'Alejo', email: 'a@x.test' } },
    { id: 1, version: 'v1', isActive: false, note: null, content: ES_TXT, contentEn: null, createdAt: '2026-10-01T00:00:00Z', uploader: { id: 1, name: 'Alejo', email: 'a@x.test' } }]
  for (const lang of ['es', 'en']) for (const scheme of ['light', 'dark']) for (const width of [1360, 390]) {
    const posts = []; const { ctx, page } = await open(browser, '/admin/manifest', { lang, scheme, width, role: 'superadmin', active: {}, versions, posts })
    const marks = await page.evaluate(() => [...document.querySelectorAll('.cg-chip')].filter(e => e.textContent.includes('EN')).length)
    await page.getByRole('button', { name: lang === 'es' ? /Nueva versión|Subir|nueva/i : /New version|Upload|new/i }).first().click(); await page.waitForTimeout(300)
    const label = lang === 'es' ? 'Versión en inglés (opcional)' : 'English version (optional)'
    const field = page.getByLabel(label); const hasField = await field.count() === 1
    await page.locator('#bm-content').fill(ES_TXT)
    await field.fill('muy corto'); await page.getByRole('button', { name: lang === 'es' ? /^Publicar/ : /^Publish/ }).click(); await page.waitForTimeout(300)
    const errShown = await page.evaluate(() => document.body.innerText.includes('50')) && posts.length === 0
    await field.fill('   '); await page.getByRole('button', { name: lang === 'es' ? /^Publicar/ : /^Publish/ }).click(); await page.waitForTimeout(500)
    const emptyOk = posts.length === 1 && !('contentEn' in posts[0])
    const bad = await axe(page)
    const ok = marks >= 2 && hasField && errShown && emptyOk && bad.length === 0
    log(ok, `admin ${lang} ${scheme} ${width}: marca EN (activa + historial)=${marks}, campo=${hasField}, <50 no envía=${errShown}, vacío no envía contentEn=${emptyOk}, axe[${bad}]`); await ctx.close() }
  { const posts = []; const { ctx, page } = await open(browser, '/admin/manifest', { lang: 'es', role: 'superadmin', active: {}, versions, posts })
    await page.getByRole('button', { name: /Nueva versión|Subir|nueva/i }).first().click(); await page.locator('#bm-content').fill(ES_TXT); await page.getByLabel('Versión en inglés (opcional)').fill('  ' + EN_TXT + '  ')
    await page.getByRole('button', { name: /^Publicar/ }).click(); await page.waitForTimeout(500)
    log(posts.length === 1 && posts[0].contentEn === EN_TXT.trim(), 'con texto EN válido: se envía contentEn recortado') ; await ctx.close() }
  await browser.close(); console.log(failures ? `\n${failures} FALLAS` : '\nTODO OK'); process.exit(failures ? 1 : 0)
})()
