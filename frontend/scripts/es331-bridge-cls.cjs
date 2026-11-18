// ES-331 (M-T14-1): CLS de /app/bridge a 390 px (CPU ×4) y 1360 px, con DATOS SINTÉTICOS (contexto aprobado con 2 campos, 3 permisos concedidos, 2 versiones de hoja de vida) y API simulada.
// Informa el CLS por corrida y los ELEMENTOS que se desplazan (layout-shift sources). 10 corridas por tanda; el umbral de calidad es ≤ 0,1 (mediana y máximo).
// Uso: npx vite build && npx vite preview --host 127.0.0.1 --port 4331 --strictPort   y luego
//   ES331_URL=http://127.0.0.1:4331 PLAYWRIGHT_MODULE=<playwright> [RUNS=10] [DELAY=80] node scripts/es331-bridge-cls.cjs
const { chromium } = require(process.env.PLAYWRIGHT_MODULE)
const LANG = process.env.LANG_UI || 'es'; const base = process.env.ES331_URL; const ANALYZE = process.env.ANALYZE === '1'; // ANALYZE=1: tras cargar, se pulsa «Analizar mi chat» y la propuesta llega a los 1,5 s (el análisis real tarda segundos; si llegara < 500 ms tras el clic, el navegador no la cuenta)
  const RUNS = Number(process.env.RUNS || 10); const DELAY = Number(process.env.DELAY || 80)
const field = (key, text) => ({ key, text, origin: { type: 'chat_turn', id: 1 } })
const version = { version: 2, status: 'active', approvedAt: '2026-11-10T10:00:00Z', revokedAt: null, needsReview: false, fields: [field('values', 'Coordino equipos pequeños con calma.'), field('interests', 'Me interesa pasar del análisis de datos a producto.')] }
const ctxBody = { active: version, versions: [version] }
;(async () => {
  const browser = await chromium.launch(); const out = {}
  for (const [w, h, cpu] of [[390, 844, 4], [320, 568, 4], [1360, 900, 1]]) {
    const runs = []; const sources = {}
    for (let i = 0; i < RUNS; i++) {
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: 'reduce' }); const page = await ctx.newPage()
      await page.addInitScript(lang => { localStorage.setItem('elevation_token', 't'); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elv_lang', lang); window.__cls = 0; window.__shifts = []
        try { new PerformanceObserver(list => { for (const e of list.getEntries()) if (!e.hadRecentInput) { window.__cls += e.value; window.__shifts.push({ v: e.value, t: Math.round(e.startTime), s: (e.sources || []).map(x => { const n = x.node; return n ? (n.nodeName || '') + '.' + String(n.className || '').slice(0, 40) + (n.textContent ? ' «' + n.textContent.trim().slice(0, 24) + '»' : '') : '?' }) }) } }).observe({ type: 'layout-shift', buffered: true }) } catch { /* sin soporte */ } }, LANG)
      if (cpu > 1) { const cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu }) }
      await page.route('**/api/**', async route => { const p = new URL(route.request().url()).pathname; await new Promise(r => setTimeout(r, DELAY + Math.round(Math.random() * 60)))
        const json = body => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
        if (p === '/api/session') return json({ role: 'user', onboardingCompleted: true })
        if (p === '/api/career-context') return json(ctxBody)
        if (p === '/api/consents') return json({ consents: ['insights_chat', 'insights_diary', 'resume_ai_reading'].map(purpose => ({ purpose, status: 'granted' })) })
        if (p === '/api/user/resumes') return json({ resumes: [{ id: 2, version: 2, size: 53248, createdAt: '2026-11-02T10:00:00Z' }, { id: 1, version: 1, size: 40960, createdAt: '2026-11-01T10:00:00Z' }], maxVersions: 5 })
        if (p === '/api/insights/proposals') { await new Promise(r => setTimeout(r, 1500)); return json({ insights: [1, 2, 3].map(n => ({ key: 'motivations', text: `Propuesta sintética ${n}: coordino equipos con calma.`, origins: [{ type: 'chat_turn', id: n, quote: `Cita sintética ${n} de la conversación.` }] })) }) }
        return json([]) })
      await page.goto(base + '/app/bridge', { waitUntil: 'networkidle' }); await page.waitForTimeout(2000)
      if (ANALYZE) { await page.getByRole('button', { name: 'Analizar mi chat' }).click(); await page.waitForTimeout(3500) }
      const r = await page.evaluate(() => ({ cls: window.__cls, shifts: window.__shifts })); runs.push(r.cls)
      for (const s of r.shifts) for (const n of s.s) sources[n] = (sources[n] || 0) + s.v
      await ctx.close()
    }
    runs.sort((a, b) => a - b); const med = runs[Math.floor(runs.length / 2)]
    out[`${w}px CPU×${cpu}`] = { runs: runs.map(x => +x.toFixed(3)), mediana: +med.toFixed(3), max: +runs[runs.length - 1].toFixed(3), fuentes: Object.entries(sources).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => `${(v / RUNS).toFixed(3)} ${k}`) }
  }
  console.log(JSON.stringify(out, null, 1)); await browser.close()
})().catch(e => { console.error(e); process.exit(1) })
