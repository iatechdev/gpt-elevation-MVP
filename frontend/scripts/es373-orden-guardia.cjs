// ES-373 (O427-2): al cerrar sesión desde el chat con texto sin enviar, la pregunta «Si sales, perderás…» sale PRIMERO y UNA sola vez, a ≤900 y a ≥901 px; cancelarla no abre la despedida ni cierra sesión.
// Chromium, API simulada, DATOS SINTÉTICOS (sin IA). Evidencia (no corre en CI). Uso: PLAYWRIGHT_MODULE=<playwright> BASE=http://127.0.0.1:4373 node scripts/es373-orden-guardia.cjs
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright'); const BASE = process.env.BASE || 'http://127.0.0.1:4373'
let failures = 0, total = 0; const check = (ok, label) => { total++; if (!ok) { failures++; console.log('FALLA ' + label) } }
const T = { es: { title: '¿Cómo te vas?', out: 'Cerrar sesión', skip: 'Saltar', menu: 'Menú', leave: 'Si sales' }, en: { title: 'How are you leaving?', out: 'Sign out', skip: 'Skip', menu: 'Menu', leave: 'Leaving will discard' } }
async function run(browser, { lang, width, text, accept, via }) {
  const t = T[lang]; const ctx = await browser.newContext({ viewport: { width, height: 800 }, reducedMotion: 'reduce' }); const page = await ctx.newPage(); const errors = []; const posts = []
  page.on('pageerror', e => errors.push(e.message)); page.on('request', r => { if (r.method() === 'POST') posts.push(new URL(r.url()).pathname) })
  await page.addInitScript(([l, title, ok]) => { window.__asked = []; window.confirm = msg => { window.__asked.push({ msg, farewellOpen: document.body.textContent.includes(title) }); return ok }; localStorage.setItem('elevation_token', 't'); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elevation_name', 'Persona Sintética'); localStorage.setItem('elv_lang', l) }, [lang, t.title, accept])
  await page.route('**/api/**', r => { const p = new URL(r.request().url()).pathname; if (p === '/api/session') return r.fulfill({ json: { role: 'user', onboardingCompleted: true } }); if (p === '/api/logout') return r.fulfill({ status: 200, json: {} })
    if (/usage/.test(p)) return r.fulfill({ json: { configured: true, limit: 100, used: 1, resetsAt: new Date(Date.now() + 864e5).toISOString() } }); if (r.request().method() !== 'GET') return r.fulfill({ json: {} }); return r.fulfill({ json: [] }) })
  await page.goto(BASE + '/app/chat', { waitUntil: 'networkidle' }); await page.waitForTimeout(400)
  if (text) await page.locator('.chat-shell textarea').first().fill('Texto de ejemplo sin enviar')
  if (width <= 900) { await page.locator('.chat-menu-btn').click(); await page.locator('dialog.cg-drawer[open]').waitFor(); await page.locator('dialog.cg-drawer[open]').getByRole('button', { name: t.out, exact: true }).click() }
  else { await page.getByRole('button', { name: t.menu, exact: true }).first().click(); await page.getByRole('button', { name: t.out, exact: true }).last().click() }
  await page.waitForTimeout(500)
  const farewell = await page.evaluate(title => document.body.textContent.includes(title), t.title)
  let afterSkip = null
  if (farewell && via === 'skip') { await page.getByRole('button', { name: t.skip, exact: true }).click(); await page.waitForTimeout(700); afterSkip = { asked: (await page.evaluate(() => window.__asked ?? [])).length, url: new URL(page.url()).pathname, logout: posts.includes('/api/logout') } }
  const result = { asked: await page.evaluate(() => window.__asked), farewell, url: new URL(page.url()).pathname, logout: posts.includes('/api/logout'), afterSkip, errors }; await ctx.close(); return result
}
;(async () => {
  const browser = await chromium.launch()
  for (const lang of ['es', 'en']) for (const width of [390, 1360]) {
    const tag = `${lang} ${width}px`
    // con texto sin enviar, aceptando: una sola pregunta, ANTES de la despedida; luego «Saltar» no vuelve a preguntar
    let r = await run(browser, { lang, width, text: true, accept: true, via: 'skip' })
    check(r.asked.length === 1 && r.asked[0].farewellOpen === false && r.asked[0].msg.startsWith(T[lang].leave), `${tag}: con texto, la pregunta sale UNA vez y ANTES de la despedida (${JSON.stringify(r.asked)})`)
    check(r.farewell === true, `${tag}: aceptar abre la despedida`)
    check(r.afterSkip && r.afterSkip.asked === 1 && r.afterSkip.url === '/' && r.afterSkip.logout, `${tag}: «Saltar» cierra sesión SIN volver a preguntar (${JSON.stringify(r.afterSkip)})`)
    // cancelar: ni despedida ni cierre de sesión
    r = await run(browser, { lang, width, text: true, accept: false })
    check(r.asked.length === 1 && r.farewell === false && r.logout === false && r.url === '/app/chat', `${tag}: cancelar no abre la despedida ni cierra sesión (${JSON.stringify(r)})`)
    // sin texto: sin pregunta; la despedida se abre
    r = await run(browser, { lang, width, text: false, accept: true, via: 'skip' })
    check(r.asked.length === 0 && r.farewell === true && r.afterSkip && r.afterSkip.logout, `${tag}: sin texto no hay pregunta y la despedida abre (${JSON.stringify(r)})`)
    check(r.errors.length === 0, `${tag}: sin errores de JavaScript ${r.errors}`)
  }
  console.log(failures === 0 ? `TODO OK (${total} comprobaciones)` : `${failures} FALLA(S) de ${total}`); await browser.close(); process.exit(failures ? 1 : 0)
})()
