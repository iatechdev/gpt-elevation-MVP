// ES-402: /app/onboarding no salta al cargar el formulario (CLS ≤ 0,1, CPU×4) a 320/390/1360 px, claro/oscuro, ES/EN; axe 0 y sin desborde horizontal. Chromium, API simulada, DATOS SINTÉTICOS.
// Uso: BASE=http://127.0.0.1:PUERTO PLAYWRIGHT_MODULE=<playwright> AXE_PATH=<axe.min.js> node scripts/es402-check.cjs   (EXPECT_FAIL=1 para documentar main)
const assert = require('node:assert/strict'); const fs = require('node:fs')
;(async () => {
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE); const base = process.env.BASE; const browser = await chromium.launch(); const axeSource = fs.readFileSync(process.env.AXE_PATH, 'utf8'); const results = []; const fails = []
  for (const w of [320, 390, 1360]) for (const lang of ['es', 'en']) for (const scheme of ['light', 'dark']) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 800 }, reducedMotion: 'reduce', colorScheme: scheme }); const page = await ctx.newPage(); const cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
    await page.addInitScript(([l, sc]) => { localStorage.setItem('elevation_token', 't'); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elv_lang', l); localStorage.setItem('elv_theme', sc); window.__c = 0
      new PerformanceObserver(list => { for (const e of list.getEntries()) if (!e.hadRecentInput) window.__c += e.value }).observe({ type: 'layout-shift', buffered: true }) }, [lang, scheme])
    await page.route('**/api/**', async route => { const p = new URL(route.request().url()).pathname
      if (p === '/api/user/context') { await new Promise(r => setTimeout(r, 600)); return route.fulfill({ json: { schemaVersion: 2, version: 0, context: null, savedAt: null, completedAt: null } }) }
      if (p === '/api/session') return route.fulfill({ json: { role: 'user', onboardingCompleted: false } }); return route.fulfill({ json: [] }) })
    const tag = `${w}px ${lang} ${scheme}`
    try {
      await page.goto(base + '/app/onboarding', { waitUntil: 'networkidle' }); await page.locator('.cg-onboarding .elv-btn, .cg-onboarding button').first().waitFor(); await page.waitForTimeout(1500)
      const cls = await page.evaluate(() => window.__c); assert.ok(cls <= 0.1, `CLS ${cls.toFixed(3)} > 0,1`)
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'sin desborde horizontal')
      await page.addScriptTag({ content: axeSource }); const v = await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] }, rules: { 'target-size': { enabled: true } } })).violations.map(x => x.id + ' ' + x.nodes.length)); assert.deepEqual(v, [], 'axe 0')
      results.push(`PASS ${tag} (CLS ${cls.toFixed(3)})`)
    } catch (e) { fails.push(tag); results.push(`FAIL ${tag} → ${e.message.split('\n')[0]}`) }
    await ctx.close()
  }
  console.log(results.join('\n')); console.log(`\n${results.length - fails.length}/${results.length} OK`); await browser.close(); if (fails.length && !process.env.EXPECT_FAIL) process.exitCode = 1
})()
