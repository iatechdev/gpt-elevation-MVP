// QA-Claude-2 — ES-37: modo oscuro en vivo (Career) y foco visible por teclado. Requiere mock (:8099) y vite (:5173).
const { chromium } = require(process.env.PLAYWRIGHT_MODULE)
;(async () => {
  const browser = await chromium.launch(), ctx = await browser.newContext({ colorScheme: 'light', viewport: { width: 1024, height: 800 } })
  await ctx.addInitScript(() => { localStorage.setItem('elevation_token', 'sintetico'); localStorage.setItem('elv_lang', 'es') })
  const page = await ctx.newPage()
  await page.goto('http://localhost:5173/app/next-step', { waitUntil: 'networkidle' }); await page.waitForTimeout(400)
  const state = () => page.evaluate(() => ({ dark: !!document.querySelector('.elv-dark'), bg: getComputedStyle(document.querySelector('.career-scope')).backgroundColor }))
  console.log('claro   ', JSON.stringify(await state()))
  await page.emulateMedia({ colorScheme: 'dark' }); await page.waitForTimeout(400)
  console.log('oscuro (en vivo)', JSON.stringify(await state()))
  await page.emulateMedia({ colorScheme: 'light' }); await page.waitForTimeout(400)
  console.log('claro (en vivo) ', JSON.stringify(await state()))
  for (const [route, scheme] of [['/app/skill-map', 'light'], ['/app/compass', 'light'], ['/app/next-step', 'dark']]) {
    await page.emulateMedia({ colorScheme: scheme }); await page.goto('http://localhost:5173' + route, { waitUntil: 'networkidle' }); await page.waitForTimeout(300)
    const out = []
    for (let i = 0; i < 6; i++) { await page.keyboard.press('Tab'); out.push(await page.evaluate(() => { const e = document.activeElement, s = getComputedStyle(e); return (e.tagName + ':' + (e.textContent || '').trim().slice(0, 18)) + ' outline=' + s.outlineStyle + ' ' + s.outlineWidth + ' ' + s.outlineColor }))}
    console.log(route, scheme, '\n  ' + out.join('\n  '))
  }
  await browser.close()
})()
