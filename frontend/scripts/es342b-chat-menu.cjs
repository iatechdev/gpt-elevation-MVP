// ES-342 (PARTE B): menú reagrupado (B1) y barra superior (B2) del chat, en Chromium con API simulada y DATOS SINTÉTICOS.
//  B1 orden Conversación → Principal → «Menú de usuario» plegado → Preferencias → pie «Cerrar sesión» fijo; «Mi progreso» una sola vez; idioma y tema solo en el menú (≤ 900 px);
//     foco al abrir dentro del diálogo, Esc cierra y devuelve el foco a «Menú», Tab atrapado; cabecera y pie dentro de la pantalla; sin desborde; axe 0.
//  B2 «☰» ≥ 46×46 con nombre accesible «Menú» (☰ + palabra a ≥ 901 px), un solo h1 visible (700, condensado), «Pausar» ghost ≥ 46 px, barra de uso con --cg-mark, texto de uso en sans; CLS ≤ 0,1 (390 px, CPU×4).
// Uso: npx vite build --outDir dist-342b && npx vite preview --outDir dist-342b --host 127.0.0.1 --port 4343 --strictPort   y luego
//   ES342B_URL=http://127.0.0.1:4343 PLAYWRIGHT_MODULE=<playwright> AXE_PATH=<axe.min.js> [SHOTS=<carpeta>] node scripts/es342b-chat-menu.cjs
const assert = require('node:assert/strict'); const fs = require('node:fs')
const thread = [{ role: 'user', text: 'Hola' }, { role: 'bot', text: 'Cuéntame más.' }]
const T = { es: { menu: 'Menú', close: 'Cerrar', conv: 'Conversación', main: 'Principal', prefs: 'Preferencias', user: 'Menú de usuario', out: 'Cerrar sesión', progress: 'Mi progreso', pause: 'Pausar' },
  en: { menu: 'Menu', close: 'Close', conv: 'Conversation', main: 'Main', prefs: 'Preferences', user: 'User menu', out: 'Sign out', progress: 'My progress', pause: 'Pause' } }
const mock = (page, role) => page.route('**/api/**', route => { const p = new URL(route.request().url()).pathname
  return route.fulfill({ json: p === '/api/session' ? { role, onboardingCompleted: true } : p === '/api/ai/usage' ? { configured: true, limit: 100, used: 42, resetsAt: '2026-11-30T00:00:00Z' } : p === '/api/messages' ? thread : [] }) })
const dialogItems = page => page.evaluate(() => { const d = document.querySelector('dialog[open]'); return [...d.querySelectorAll('button, a[href], input')].filter(e => e.getClientRects().length).map(e => (e.getAttribute('aria-label') || e.textContent || e.type).trim()) })
;(async () => {
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE); const base = process.env.ES342B_URL; const browser = await chromium.launch(); const axeSource = fs.readFileSync(process.env.AXE_PATH, 'utf8'); let n = 0
  if (process.env.SHOTS) fs.mkdirSync(process.env.SHOTS, { recursive: true })
  for (const scheme of ['light', 'dark']) for (const lang of ['es', 'en']) for (const [w, h] of [[1360, 900], [390, 800], [320, 568]]) for (const role of ['user', 'superadmin']) {
    if (role === 'superadmin' && (scheme === 'dark' || w === 1360)) continue
    const k = T[lang]; const tag = `${scheme} ${lang} ${w}×${h} ${role}`
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: scheme }); const page = await ctx.newPage()
    await page.addInitScript(([l, sc, r]) => { localStorage.setItem('elevation_token', 't'); localStorage.setItem('elevation_role', r); localStorage.setItem('elv_lang', l); localStorage.setItem('elv_theme', sc) }, [lang, scheme, role])
    await mock(page, role)
    await page.goto(base + '/app/chat', { waitUntil: 'networkidle' }); await page.locator('.chat-menu-btn').waitFor(); await page.locator('.space-meter').waitFor(); await page.waitForTimeout(600)
    // ---- B2: barra superior
    const bar = await page.evaluate(() => {
      const q = s => document.querySelector(s), r = e => { const b = e.getBoundingClientRect(); return { w: Math.round(b.width), h: Math.round(b.height) } }
      const probe = document.createElement('i'); probe.style.color = 'var(--cg-mark)'; q('.chat-shell').append(probe); const mark = getComputedStyle(probe).color; probe.remove()
      const btn = q('.chat-menu-btn'), h1s = [...document.querySelectorAll('h1')].filter(e => e.getClientRects().length), h1 = q('.space-chatbar-head h1'), pause = q('.chat-pause'), meter = q('.space-meter i'), usage = q('.space-usage-desktop .space-usage-text')
      return { btn: r(btn), label: btn.getAttribute('aria-label'), word: getComputedStyle(q('.chat-menu-btn__w')).display, h1n: h1s.length, h1w: getComputedStyle(h1).fontWeight, h1f: getComputedStyle(h1).fontFamily, h1s: parseFloat(getComputedStyle(h1).fontSize), pauseSize: r(pause), pauseGhost: pause.classList.contains('cg-btn--ghost'), pauseFont: getComputedStyle(pause).fontFamily,
        meter: getComputedStyle(meter).backgroundColor, mark, usageFont: usage ? getComputedStyle(usage).fontFamily : null, usageCase: usage ? getComputedStyle(usage).textTransform : null, overX: document.documentElement.scrollWidth - innerWidth }
    })
    assert.ok(bar.btn.w >= 46 && bar.btn.h >= 46, `B2 ☰ ≥ 46×46 (${tag}): ${bar.btn.w}×${bar.btn.h}`); assert.equal(bar.label, k.menu, `B2 nombre accesible del botón (${tag})`)
    assert.equal(bar.word !== 'none', w >= 901, `B2 palabra «Menú» visible solo a ≥ 901 px (${tag})`)
    assert.equal(bar.h1n, 1, `B2 un solo h1 visible (${tag})`); assert.equal(bar.h1w, '700', `B2 h1 en 700 (${tag})`); assert.ok(/condensed/i.test(bar.h1f), `B2 h1 en la fuente condensada (${tag}): ${bar.h1f}`); assert.ok(bar.h1s >= 16 && bar.h1s <= 18, `B2 h1 ≈ 1,05 rem (${tag}): ${bar.h1s}`)
    assert.ok(bar.pauseGhost && bar.pauseSize.h >= 46, `B2 «Pausar» es un botón ghost de Cartografía ≥ 46 px (${tag})`); assert.ok(!/monospace|Cascadia/i.test(bar.pauseFont), `B2 «Pausar» ya no usa la monoespaciada (${tag})`)
    assert.equal(bar.meter, bar.mark, `B2 barra de uso con --cg-mark (${tag})`)
    if (bar.usageFont) { assert.ok(!/monospace|Cascadia/i.test(bar.usageFont) && bar.usageCase === 'none', `B2 texto de uso en sans y sin mayúsculas forzadas (${tag})`) }
    assert.ok(bar.overX <= 0, `sin desborde horizontal (${tag}): ${bar.overX}px`)
    // ---- B1: menú
    await page.locator('.chat-menu-btn').click(); await page.locator('dialog[open] .chat-menu').waitFor(); await page.waitForTimeout(250)
    const m = await page.evaluate(() => {
      const d = document.querySelector('dialog[open]'), b = x => d.querySelector(x).getBoundingClientRect(), r = d.getBoundingClientRect(), body = d.querySelector('.cg-dialog__body')
      const heads = [...d.querySelectorAll('.chat-menu-h')].map(e => e.textContent.trim()), disc = d.querySelector('.chat-menu-disc'), um = d.querySelector(`#${disc.getAttribute('aria-controls')}`)
      return { title: d.querySelector('.cg-dialog__head h2').textContent.trim(), heads, active: d.contains(document.activeElement) ? document.activeElement.textContent.trim() : null, expanded: disc.getAttribute('aria-expanded'), umHidden: um.hidden, discText: disc.textContent.trim(),
        head: b('.cg-dialog__head'), foot: b('.cg-dialog__actions'), dlg: { top: r.top, bottom: r.bottom, left: r.left, right: r.right }, scroll: body.scrollHeight - body.clientHeight, outLabel: d.querySelector('.cg-dialog__actions button').textContent.trim(), outClass: d.querySelector('.cg-dialog__actions button').className,
        closeLabel: d.querySelector('.cg-dialog__head button').textContent.trim(), langIn: !!d.querySelector('.cg-lang'), themeIn: !!d.querySelector('.cg-seg'), outsideLang: [...document.querySelectorAll('.cg-lang')].filter(e => !d.contains(e) && e.getClientRects().length).length,
        overX: document.documentElement.scrollWidth - innerWidth, bodyOverX: body.scrollWidth - body.clientWidth }
    })
    assert.equal(m.title, k.menu, `B1 título «${k.menu}» (${tag})`); assert.deepEqual(m.heads, [k.conv, k.main, k.prefs], `B1 orden de grupos (${tag}): ${m.heads}`)
    assert.equal(m.closeLabel, k.close, `B1 «Cerrar» arriba (${tag})`); assert.equal(m.outLabel, k.out, `B1 «Cerrar sesión» en el pie (${tag})`); assert.ok(/cg-btn--danger/.test(m.outClass), `B1 «Cerrar sesión» es botón de peligro (${tag})`)
    assert.ok(m.head.top >= -1 && m.foot.bottom <= h + 1, `B1 cabecera y pie dentro de la pantalla (${tag}): cabecera ${Math.round(m.head.top)}, pie ${Math.round(m.foot.bottom)} de ${h}`)
    assert.equal(m.expanded, 'false', `B1 «${k.user}» plegado al abrir (${tag})`); assert.ok(m.umHidden, `B1 la lista del menú de usuario está oculta (${tag})`); assert.equal(m.discText.replace(/[▴▾]/g, '').trim(), k.user)
    assert.ok(m.langIn && m.themeIn, `B1 idioma y tema dentro del menú (${tag})`); if (w <= 900) assert.equal(m.outsideLang, 0, `B1 idioma solo en el menú (${tag})`)
    assert.equal(m.active, k.close, `B1 el foco entra al diálogo, en «Cerrar» (${tag}): ${m.active}`)
    assert.ok(m.overX <= 0 && m.bodyOverX <= 0, `B1 sin desborde (${tag}): ${m.overX}/${m.bodyOverX}`)
    if (w >= 901) assert.ok(m.dlg.top > 8 && m.dlg.bottom < h - 8 && Math.abs((m.dlg.left + m.dlg.right) / 2 - w / 2) < 2, `B1 en escritorio la hoja va centrada (${tag})`)
    else assert.ok(Math.abs(m.dlg.bottom - h) < 2, `B1 en móvil la hoja va anclada abajo (${tag})`)
    const closed = await dialogItems(page); assert.equal(closed.filter(x => x === k.progress).length, 1, `B1 «${k.progress}» una sola vez (${tag})`)
    assert.equal(closed.length, role === 'superadmin' ? 17 : 16, `B1 controles con el menú de usuario cerrado (${tag}): ${closed.length} → ${closed.join(' | ')}`)
    // axe con el menú abierto (cerrado y desplegado)
    await page.addScriptTag({ content: axeSource }); const axe = () => page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } })).violations.map(v => v.id + ':' + v.nodes.length))
    assert.deepEqual(await axe(), [], `axe 0 con el menú abierto (${tag})`)
    if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/menu-${tag.replace(/[ ×]/g, '-')}.png` })
    // desplegar «Menú de usuario»
    await page.locator('.chat-menu-disc').click(); await page.waitForTimeout(150)
    const open = await dialogItems(page); assert.equal(open.length, closed.length + 10, `B1 desplegado suma 10 enlaces (${tag}): ${open.length - closed.length}`); assert.equal(open.filter(x => x === k.progress).length, 1, `B1 «${k.progress}» sigue una sola vez desplegado (${tag})`)
    assert.equal(await page.locator('.chat-menu-disc').getAttribute('aria-expanded'), 'true', `B1 aria-expanded (${tag})`)
    assert.deepEqual(await axe(), [], `axe 0 con «${k.user}» desplegado (${tag})`)
    if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/menu-mas-${tag.replace(/[ ×]/g, '-')}.png` })
    const ov = await page.evaluate(() => { const d = document.querySelector('dialog[open]'), body = d.querySelector('.cg-dialog__body'), f = d.querySelector('.cg-dialog__actions').getBoundingClientRect(); return { x: document.documentElement.scrollWidth - innerWidth, bx: body.scrollWidth - body.clientWidth, footBottom: f.bottom } })
    assert.ok(ov.x <= 0 && ov.bx <= 0, `B1 sin desborde desplegado (${tag})`); assert.ok(ov.footBottom <= h + 1, `B1 el pie sigue a la vista al desplegar (${tag})`)
    // teclado: Shift+Tab desde «Cerrar» va al último control («Cerrar sesión»); Tab desde allí vuelve a «Cerrar»; Esc cierra y devuelve el foco
    await page.locator('.cg-dialog__head button').focus(); await page.keyboard.press('Shift+Tab'); assert.equal(await page.evaluate(() => document.activeElement.textContent.trim()), k.out, `B1 Tab atrapado hacia atrás (${tag})`)
    await page.keyboard.press('Tab'); assert.equal(await page.evaluate(() => document.activeElement.textContent.trim()), k.close, `B1 Tab atrapado hacia delante (${tag})`)
    await page.keyboard.press('Escape'); await page.waitForTimeout(200)
    assert.equal(await page.locator('dialog[open]').count(), 0, `B1 Esc cierra (${tag})`); assert.equal(await page.evaluate(() => document.activeElement.className), 'chat-menu-btn', `B1 el foco vuelve a «Menú» (${tag})`)
    // al reabrir, «Menú de usuario» vuelve a estar plegado
    await page.keyboard.press('Enter'); await page.locator('dialog[open] .chat-menu').waitFor(); assert.equal(await page.locator('.chat-menu-disc').getAttribute('aria-expanded'), 'false', `B1 plegado de nuevo al reabrir (${tag})`)
    await page.locator('.cg-dialog__head button').click(); await page.waitForTimeout(150)
    console.log(`PASS ${tag}: ☰ ${bar.btn.w}×${bar.btn.h} · h1 ${bar.h1s}px · grupos ${m.heads.join(' → ')} · ${closed.length} controles cerrado / ${open.length} desplegado · scroll ${Math.round(m.scroll)} px · axe 0`); await ctx.close(); n++
  }
  // CLS a 390 px con CPU×4: cargar, abrir el menú, desplegar «Menú de usuario».
  for (const lang of ['es', 'en']) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 800 } }); const page = await ctx.newPage(); const cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
    await page.addInitScript(l => { localStorage.setItem('elevation_token', 't'); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elv_lang', l); window.__cls = 0; new PerformanceObserver(list => { for (const e of list.getEntries()) if (!e.hadRecentInput) window.__cls += e.value }).observe({ type: 'layout-shift', buffered: true }) }, lang)
    await mock(page, 'user'); await page.goto(base + '/app/chat', { waitUntil: 'networkidle' }); await page.waitForTimeout(600); const load = await page.evaluate(() => window.__cls)
    await page.locator('.chat-menu-btn').click(); await page.locator('.chat-menu-disc').click(); await page.waitForTimeout(500)
    const cls = await page.evaluate(() => window.__cls); assert.ok(cls <= 0.1, `CLS ≤ 0,1 (${lang}): ${cls}`); console.log(`PASS CLS ${lang}: total ${cls.toFixed(4)} (carga ${load.toFixed(4)}; abrir y desplegar el menú suma ${(cls - load).toFixed(4)})`); await ctx.close(); n++
  }
  console.log(`\nES-342 B: ${n} comprobaciones OK`); await browser.close()
})().catch(e => { console.error(e.message); process.exit(1) })
