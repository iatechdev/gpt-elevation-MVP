// ES-359 (PR4): el menú del chat sobre el cajón del marco. Chromium, API simulada, DATOS SINTÉTICOS (sin IA). Evidencia (no corre en CI).
// ≤ 900 px: UN solo menú (el «☰» de la barra del chat (abre el cajón del marco)); su cajón lleva ARRIBA «Conversación» (Mi progreso, Recomendaciones, Administración si admin/superadmin, uso de IA, «Enter envía»), sin «Mi progreso» repetido;
// foco/Esc; «Recomendaciones» abre la hoja y el foco vuelve al «☰ Menú»; «Cerrar sesión» abre la despedida (no cierra directo). ≥ 901 px: botón «Menú» de la barra con la hoja (Conversación, Principal, Menú de usuario, Preferencias, Cerrar sesión).
// Uso: npx vite build --outDir dist-chat && npx vite preview --outDir dist-chat --host 127.0.0.1 --port 4371 --strictPort
//   PLAYWRIGHT_MODULE=<playwright> AXE_PATH=<axe.min.js> BASE=http://127.0.0.1:4371 node scripts/es359-chat.cjs
const fs = require('fs'); const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const axeSource = fs.readFileSync(process.env.AXE_PATH, 'utf8'); const BASE = process.env.BASE || 'http://127.0.0.1:4371'
let failures = 0, total = 0
const check = (ok, label) => { total++; if (!ok) { failures++; console.log('FALLA ' + label) } }
const T = { es: { conv: 'Conversación', progress: 'Mi progreso', recs: 'Recomendaciones para ti', admin: 'Panel de Administración', enter: 'Enter envía', menu: 'Menú', user: 'Menú de usuario', out: 'Cerrar sesión', prefs: 'Preferencias' }, en: { conv: 'Conversation', progress: 'My progress', recs: 'Recommendations for you', admin: 'Admin Panel', enter: 'Enter sends', menu: 'Menu', user: 'User menu', out: 'Sign out', prefs: 'Preferences' } }
async function open(browser, { role, lang, width, scheme }) {
  const ctx = await browser.newContext({ viewport: { width, height: 800 }, colorScheme: scheme, reducedMotion: 'reduce' }); const page = await ctx.newPage(); const errors = []; const calls = []
  page.on('pageerror', e => errors.push(e.message)); page.on('request', r => { if (r.method() === 'POST') calls.push(new URL(r.url()).pathname) })
  await page.addInitScript(([l, s, r]) => { localStorage.setItem('elevation_token', 't'); localStorage.setItem('elevation_role', r); localStorage.setItem('elevation_name', 'Persona Sintética'); localStorage.setItem('elv_lang', l); localStorage.setItem('elv_theme', s) }, [lang, scheme, role])
  await page.route('**/api/**', r => { const p = new URL(r.request().url()).pathname
    if (p === '/api/session') return r.fulfill({ json: { role, onboardingCompleted: true } })
    if (p === '/api/logout') return r.fulfill({ status: 200, json: {} })
    if (/usage/.test(p)) return r.fulfill({ json: { configured: true, limit: 100, used: 42, resetsAt: new Date(Date.now() + 864e5 * 5).toISOString() } })
    if (r.request().method() !== 'GET') return r.fulfill({ json: {} })
    return r.fulfill({ json: [] }) })
  await page.goto(BASE + '/app/chat', { waitUntil: 'networkidle' }); await page.waitForTimeout(500)
  return { ctx, page, errors, calls }
}
const axe = async page => { await page.evaluate(axeSource); return page.evaluate(async () => (await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] })).violations.map(v => v.id + ':' + v.nodes.length)) }
const focusClass = page => page.evaluate(() => document.activeElement?.className?.toString() ?? '')
;(async () => {
  const browser = await chromium.launch()
  for (const role of ['user', 'superadmin']) for (const lang of ['es', 'en']) for (const scheme of ['light', 'dark']) for (const width of [390, 320, 768, 1360]) {
    const t = T[lang]; const tag = `${role} ${lang} ${scheme} ${width}px`; const { ctx, page, errors, calls } = await open(browser, { role, lang, width, scheme })
    check(await page.locator('.chat-shell').count() === 1, `${tag}: el chat se dibuja`)
    if (width <= 900) {
      check(await page.locator('.chat-menu-btn:visible').count() === 1 && await page.locator('.cg-menubtn:visible').count() === 0, `${tag}: UN solo botón de menú visible (el de la barra del chat; el encabezado del marco está oculto)`)
      check((await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 0, `${tag}: sin desborde`)
      let v = await axe(page); check(v.length === 0, `${tag}: axe 0 con el cajón cerrado ${v}`)
      await page.locator('.chat-menu-btn').click(); await page.locator('dialog.cg-drawer[open]').waitFor(); await page.waitForTimeout(200)
      const d = await page.evaluate(() => { const dl = document.querySelector('dialog.cg-drawer[open]'); const heads = [...dl.querySelectorAll('h3')].map(e => e.textContent.trim())
        return { heads, first: heads[0], btns: [...dl.querySelectorAll('.chat-menu-list button')].map(b => b.textContent.trim()), links: [...dl.querySelectorAll('nav a')].map(a => a.getAttribute('href')), enter: !!dl.querySelector('.chat-enter input'), usage: !!dl.querySelector('.space-usage-text, .space-note'), overX: document.documentElement.scrollWidth - innerWidth } })
      check(d.first === t.conv, `${tag}: «${t.conv}» va arriba (${d.heads})`)
      check(JSON.stringify(d.btns) === JSON.stringify(role === 'superadmin' ? [t.progress, t.recs, t.admin] : [t.progress, t.recs]), `${tag}: acciones de Conversación (${d.btns})`)
      check(!d.links.includes('/app/progress'), `${tag}: «Mi progreso» no se repite entre los grupos`); check(d.links.includes('/app/dashboard') && d.links.includes('/app/skill-map'), `${tag}: el resto de la navegación sigue en el cajón (${d.links})`)
      check(d.enter && d.usage, `${tag}: «${t.enter}» y el uso de IA en el cajón`); check(d.overX <= 0, `${tag}: sin desborde con el cajón abierto`)
      v = await axe(page); check(v.length === 0, `${tag}: axe 0 con el cajón abierto ${v}`)
      await page.locator('dialog.cg-drawer[open] .chat-enter input').check(); check(await page.locator('dialog.cg-drawer[open]').count() === 1, `${tag}: la casilla no cierra el cajón`)
      check(await page.evaluate(() => Object.keys(localStorage).some(k => /enter/i.test(k))), `${tag}: «${t.enter}» se guarda en este navegador`)
      await page.keyboard.press('Escape'); await page.waitForTimeout(150); check((await focusClass(page)).includes('chat-menu-btn'), `${tag}: Esc cierra y el foco vuelve al «☰ ${t.menu}» (${await focusClass(page)})`)
      await page.locator('.chat-menu-btn').click(); await page.locator('dialog.cg-drawer[open]').waitFor(); await page.getByRole('button', { name: t.recs, exact: true }).click(); await page.waitForTimeout(500)
      check(await page.locator('dialog.cg-drawer[open]').count() === 0, `${tag}: «${t.recs}» cierra el cajón`); check(await page.locator('dialog[open], [role=dialog]').count() >= 1, `${tag}: se abre la hoja de recomendaciones`)
      await page.keyboard.press('Escape'); await page.waitForTimeout(250); check((await focusClass(page)).includes('chat-menu-btn'), `${tag}: al cerrar la hoja el foco vuelve al «☰ ${t.menu}» (${await focusClass(page)})`)
      await page.locator('.chat-menu-btn').click(); await page.locator('dialog.cg-drawer[open]').waitFor(); await page.locator('dialog.cg-drawer[open]').getByRole('button', { name: t.out }).click(); await page.waitForTimeout(400)
      check(!calls.includes('/api/logout'), `${tag}: «${t.out}» NO cierra la sesión directo`); check(await page.locator('[role=dialog], dialog[open]').count() >= 1, `${tag}: se abre la despedida`)
    } else {
      check(await page.locator('.cg-menubtn').count() === 0 && await page.locator('.chat-menu-btn').count() === 1, `${tag}: escritorio, botón «${t.menu}» de la barra del chat`)
      await page.locator('.chat-menu-btn').click(); await page.waitForTimeout(300)
      const d = await page.evaluate(() => { const dl = document.querySelector('dialog[open], [role=dialog]'); return { heads: dl ? [...dl.querySelectorAll('h3')].map(e => e.textContent.trim()) : [], text: dl?.textContent ?? '' } })
      check(d.heads[0] === t.conv && d.heads.includes(t.prefs), `${tag}: hoja con Conversación, Principal, Preferencias (${d.heads})`); check(d.text.includes(t.out) && d.text.includes(t.user), `${tag}: hoja con «${t.user}» y «${t.out}»`)
      const v = await axe(page); check(v.length === 0, `${tag}: axe 0 con la hoja abierta ${v}`)
      await page.keyboard.press('Escape'); await page.waitForTimeout(250); check((await focusClass(page)).includes('chat-menu-btn'), `${tag}: Esc cierra y el foco vuelve al botón (${await focusClass(page)})`)
    }
    check(errors.length === 0, `${tag}: sin errores de JavaScript ${errors.slice(0, 2)}`)
    await ctx.close()
  }
  console.log(failures === 0 ? `TODO OK (${total} comprobaciones)` : `${failures} FALLA(S) de ${total}`); await browser.close(); process.exit(failures ? 1 : 0)
})()
