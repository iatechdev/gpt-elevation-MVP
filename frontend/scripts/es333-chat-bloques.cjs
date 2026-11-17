// ES-333 (medición previa al diseño): altura de cada bloque de /app/chat en main. Chromium, API simulada, datos SINTÉTICOS. No modifica nada.
// Viewports 390×844 y 320×568, ES/EN, con y sin teclado. El teclado se SIMULA reduciendo el alto del viewport (390×844 → alto − 300; 320×568 → alto − 270): no es un teclado real.
// Uso: ES333_URL=http://127.0.0.1:4333 PLAYWRIGHT_MODULE=<playwright> node scripts/es333-chat-bloques.cjs
const { chromium } = require(process.env.PLAYWRIGHT_MODULE)
;(async () => {
  const base = process.env.ES333_URL; const browser = await chromium.launch()
  const messages = Array.from({ length: 8 }, (_, i) => ({ role: i % 2 ? 'bot' : 'user', text: i % 2 ? 'Gracias por contarme eso. ¿Qué parte de lo que viviste esta semana te gustaría mirar con más calma?' : 'Esta semana me sentí con poca energía y no sé por dónde empezar.' }))
  const blocks = { 'encabezado': '.chat-shell > header', 'privacidad+pausa': '.space-chatbar-head', 'barra de uso': '.space-usage', 'banner brújula': '.chat-top > :not(.space-chatbar)', 'hilo (.chat-scroll)': '.chat-scroll', 'compositor completo (.chat-input-bar)': '.chat-input-bar',
    '· fila diario / asistente': '.chat-composer-top', '· campo + Enviar': '.chat-composer-row', '· Enter envía': '.chat-enter', '· aviso de límites': '.chat-limits' }
  const out = []; const warm = new Set()
  for (const lang of ['es', 'en']) for (const [w, h, kb] of [[390, 844, 0], [390, 844, 0], [390, 844, 300], [320, 568, 0], [320, 568, 270]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h - kb } }); const page = await ctx.newPage()
    await page.addInitScript(([l]) => { localStorage.setItem('elevation_token', 't'); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elv_lang', l) }, [lang])
    await page.route('**/api/**', route => { const p = new URL(route.request().url()).pathname
      if (p === '/api/session') return route.fulfill({ json: { role: 'user', onboardingCompleted: true } })
      if (p === '/api/ai/usage') return route.fulfill({ json: { configured: true, limit: 100, used: 37, resetsAt: '2026-12-01T00:00:00Z' } })
      if (p === '/api/messages') return route.fulfill({ json: messages })
      return route.fulfill({ json: [] }) })
    await page.goto(base + '/app/chat', { waitUntil: 'networkidle' }); await page.locator('.chat-limits').waitFor(); await page.getByText('Gracias por contarme').first().waitFor(); await page.locator('textarea').focus(); await page.waitForTimeout(600)
    const m = await page.evaluate(sel => { const r = {}; for (const [k, s] of Object.entries(sel)) { const els = [...document.querySelectorAll(s)]; r[k] = els.length ? Math.round(els.reduce((a, e) => a + e.getBoundingClientRect().height, 0)) : null }
      const bar = document.querySelector('.chat-limits')?.getBoundingClientRect(); const t = document.querySelector('.chat-scroll').getBoundingClientRect(); const ib = document.querySelector('.chat-input-bar').getBoundingClientRect(); r.__hiloVisible = Math.round(Math.max(0, Math.min(t.bottom, ib.top, innerHeight) - Math.max(t.top, 0))); r.__compositorVisible = Math.round(Math.max(0, Math.min(ib.bottom, innerHeight) - Math.max(ib.top, 0))); r.__barPosition = getComputedStyle(document.querySelector('.chat-input-bar')).position; r.__pageScroll = document.documentElement.scrollHeight - innerHeight; r.__viewport = innerHeight; r.__limitsInView = bar ? bar.top >= 0 && bar.bottom <= innerHeight : null; return r }, blocks)
    if (warm.has(lang + w + kb) || kb || w !== 390) out.push({ lang, vp: `${w}×${h}${kb ? ` (teclado ${kb} → alto ${h - kb})` : ''}`, ...m }); warm.add(lang + w + kb); void ({ lang, vp: `${w}×${h}${kb ? ` (teclado ${kb} → alto ${h - kb})` : ''}`, ...m }); await ctx.close()
  }
  console.log(JSON.stringify(out, null, 1)); await browser.close()
})().catch(e => { console.error(e); process.exit(1) })
