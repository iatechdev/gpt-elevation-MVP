// ES-333 (PR 2): CLS de /app/chat a 390 px con CPU ×4 (carga con hilo de 12 mensajes y uso de IA; 80–140 ms por llamada). RUNS corridas; umbral ≤ 0,1. DATOS SINTÉTICOS, API simulada.
// Uso: ES333_URL=http://127.0.0.1:4334 PLAYWRIGHT_MODULE=<playwright> [RUNS=10] node scripts/es333-chat-cls.cjs
const { chromium } = require(process.env.PLAYWRIGHT_MODULE); const RUNS = Number(process.env.RUNS || 10)
;(async () => { const b = await chromium.launch(); const out = []
const msgs = Array.from({ length: 12 }, (_, i) => ({ role: i % 2 ? 'bot' : 'user', text: i % 2 ? 'Gracias por contarme eso. ¿Qué parte de lo que viviste esta semana te gustaría mirar con más calma?' : 'Esta semana me sentí con poca energía.' }))
for (let i = 0; i < RUNS; i++) { const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' }); const page = await ctx.newPage()
  await page.addInitScript(() => { localStorage.setItem('elevation_token', 't'); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elv_lang', 'es'); window.__cls = 0; try { new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value }).observe({ type: 'layout-shift', buffered: true }) } catch { /* sin soporte */ } })
  const cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
  await page.route('**/api/**', async r => { const p = new URL(r.request().url()).pathname; await new Promise(x => setTimeout(x, 80 + Math.round(Math.random() * 60))); return r.fulfill({ json: p === '/api/session' ? { role: 'user', onboardingCompleted: true } : p === '/api/ai/usage' ? { configured: true, limit: 100, used: 37, resetsAt: '2026-12-01T00:00:00Z' } : p === '/api/messages' ? msgs : [] }) })
  await page.goto(process.env.ES333_URL + '/app/chat', { waitUntil: 'networkidle' }); await page.waitForTimeout(2000); out.push(await page.evaluate(() => window.__cls)); await ctx.close() }
out.sort((a, b) => a - b); console.log('CLS carga 390 px CPU×4:', out.map(x => +x.toFixed(3)).join(' '), '| mediana', out[Math.floor(out.length / 2)].toFixed(3), '| máx', out[out.length - 1].toFixed(3)); await b.close() })()
