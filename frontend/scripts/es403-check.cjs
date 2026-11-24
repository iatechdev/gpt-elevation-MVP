// ES-403: «Actualizar mi hoja de vida» (/app/context/resumes/update) no hereda la reserva de una pantalla de alto de /app/onboarding (añadía ~145 px de hueco antes del pie a 390×800),
// y /app/onboarding conserva su reserva (sin reabrir el CLS de ES-402). Chromium, API simulada, DATOS SINTÉTICOS.
// Uso: BASE=http://127.0.0.1:PUERTO PLAYWRIGHT_MODULE=<playwright> node scripts/es403-check.cjs   (EXPECT_FAIL=1 para documentar main)
const assert = require('node:assert/strict')
;(async () => {
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE); const base = process.env.BASE; const browser = await chromium.launch(); const results = []; const fails = []
  const context = { preferredLanguage: 'es', residenceCountry: 'CO', targetMarket: 'CO', timeZone: 'America/Bogota', profession: 'Docente', interests: 'Datos', availabilityMinutesPerWeek: 300, careerGoal: null, careerConstraints: null, sector: null, totalYearsExperience: null, experience: [], education: [], declaredSkills: [], languages: [] }
  for (const w of [320, 390, 1360]) for (const lang of ['es', 'en']) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 800 }, reducedMotion: 'reduce' }); const page = await ctx.newPage()
    await page.addInitScript(l => { localStorage.setItem('elevation_token', 't'); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elv_lang', l) }, lang)
    await page.route('**/api/**', route => { const p = new URL(route.request().url()).pathname
      if (p === '/api/session') return route.fulfill({ json: { role: 'user', onboardingCompleted: true } })
      if (p === '/api/user/context') return route.fulfill({ json: { schemaVersion: 2, version: 3, context, savedAt: '2026-11-20T10:00:00Z', completedAt: '2026-11-20T10:00:00Z' } })
      if (p === '/api/user/resumes') return route.fulfill({ json: { resumes: [], maxVersions: 3 } }); return route.fulfill({ json: [] }) })
    const tag = `${w}px ${lang}`
    try {
      await page.goto(base + '/app/context/resumes/update', { waitUntil: 'networkidle' }); await page.locator('.cv-update .participant-context-scope.cg-onboarding').waitFor(); await page.waitForTimeout(500)
      const update = await page.evaluate(() => { const box = document.querySelector('.participant-context-scope.cg-onboarding'); const inner = box.firstElementChild.getBoundingClientRect(); return { min: getComputedStyle(box).minHeight, box: Math.round(box.getBoundingClientRect().height), content: Math.round(inner.height) } })
      assert.ok(update.box <= update.content + 80, `sin hueco: caja ${update.box} px frente a contenido ${update.content} px (min-height ${update.min})`)
      await page.goto(base + '/app/onboarding', { waitUntil: 'networkidle' }); await page.locator('.cg-onboarding--start').waitFor(); await page.waitForTimeout(500)
      const start = await page.evaluate(() => ({ box: Math.round(document.querySelector('.participant-context-scope.cg-onboarding').getBoundingClientRect().height), vh: innerHeight }))
      assert.ok(start.box >= start.vh - 1, `onboarding conserva su pantalla de alto (${start.box} de ${start.vh})`)
      results.push(`PASS ${tag} (actualizar: caja ${update.box} / contenido ${update.content}; onboarding ${start.box} de ${start.vh})`)
    } catch (e) { fails.push(tag); results.push(`FAIL ${tag} → ${e.message.split('\n')[0]}`) }
    await ctx.close()
  }
  console.log(results.join('\n')); console.log(`\n${results.length - fails.length}/${results.length} OK`); await browser.close(); if (fails.length && !process.env.EXPECT_FAIL) process.exitCode = 1
})()
