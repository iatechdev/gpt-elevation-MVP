// ES-374: a ≤ 900 px, al CANCELAR «Si sales, perderás…» (con texto sin enviar) el cajón del menú se cierra y el foco vuelve a la caja de mensaje; el texto no se pierde y no se cierra la sesión.
// También al cancelar la pregunta por un enlace del cajón. Aceptar sigue abriendo la despedida. Chromium, API simulada, DATOS SINTÉTICOS (sin IA).
// Uso: BASE=http://127.0.0.1:PUERTO PLAYWRIGHT_MODULE=<playwright> node scripts/es374-check.cjs   (EXPECT_FAIL=1 para documentar main)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright'); const BASE = process.env.BASE
let failures = 0, total = 0; const check = (ok, label) => { total++; if (!ok) { failures++; console.log('FALLA ' + label) } else console.log('PASS ' + label) }
const T = { es: { title: '¿Cómo te vas?', out: 'Cerrar sesión' }, en: { title: 'How are you leaving?', out: 'Sign out' } }
async function run(browser, { lang, width, accept, via }) {
  const t = T[lang]; const ctx = await browser.newContext({ viewport: { width, height: 800 }, reducedMotion: 'reduce' }); const page = await ctx.newPage(); const posts = []
  page.on('request', r => { if (r.method() === 'POST') posts.push(new URL(r.url()).pathname) })
  await page.addInitScript(([l, ok]) => { window.__asked = 0; window.confirm = () => { window.__asked++; return ok }; localStorage.setItem('elevation_token', 't'); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elevation_name', 'Persona Sintética'); localStorage.setItem('elv_lang', l) }, [lang, accept])
  await page.route('**/api/**', r => { const p = new URL(r.request().url()).pathname; if (p === '/api/session') return r.fulfill({ json: { role: 'user', onboardingCompleted: true } }); if (p === '/api/logout') return r.fulfill({ status: 200, json: {} })
    if (/usage/.test(p)) return r.fulfill({ json: { configured: true, limit: 100, used: 1, resetsAt: new Date(Date.now() + 864e5).toISOString() } }); if (r.request().method() !== 'GET') return r.fulfill({ json: {} }); return r.fulfill({ json: [] }) })
  await page.goto(BASE + '/app/chat', { waitUntil: 'networkidle' }); await page.waitForTimeout(400)
  await page.locator('.chat-shell textarea').first().fill('Texto de ejemplo sin enviar')
  await page.locator('.chat-menu-btn').click(); const drawer = page.locator('dialog.cg-drawer[open]'); await drawer.waitFor()
  if (via === 'logout') await drawer.getByRole('button', { name: t.out, exact: true }).click()
  else await drawer.locator('.cg-drawer__list a').first().click()
  await page.waitForTimeout(700)
  const s = await page.evaluate(title => ({ drawerOpen: !!document.querySelector('dialog.cg-drawer[open]'), focus: document.activeElement && document.activeElement.className, value: document.querySelector('.chat-shell textarea').value, farewell: document.body.textContent.includes(title), path: location.pathname, asked: window.__asked }), t.title)
  await ctx.close(); return { ...s, logout: posts.includes('/api/logout') }
}
;(async () => {
  const browser = await chromium.launch()
  for (const lang of ['es', 'en']) for (const width of [320, 390, 900]) for (const via of ['logout', 'link']) {
    const tag = `${lang} ${width}px ${via}`
    const r = await run(browser, { lang, width, accept: false, via })
    check(r.drawerOpen === false, `${tag}: cancelar cierra el cajón`)
    check(/space-message/.test(r.focus ?? ''), `${tag}: el foco queda en la caja de mensaje (${r.focus})`)
    check(r.value === 'Texto de ejemplo sin enviar' && r.farewell === false && r.logout === false && r.path === '/app/chat' && r.asked === 1, `${tag}: el texto se conserva, sin despedida, sin cierre de sesión, una sola pregunta (${JSON.stringify(r)})`)
  }
  for (const lang of ['es', 'en']) { const r = await run(browser, { lang, width: 390, accept: true, via: 'logout' }); check(r.farewell === true && r.asked === 1, `${lang} 390px aceptar: abre la despedida con una sola pregunta (${JSON.stringify(r)})`) }
  console.log(failures === 0 ? `TODO OK (${total} comprobaciones)` : `${failures} FALLA(S) de ${total}`); await browser.close(); process.exit(failures && !process.env.EXPECT_FAIL ? 1 : 0)
})()
