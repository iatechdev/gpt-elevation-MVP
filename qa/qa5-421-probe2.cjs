// [QA-Claude-5] #421: sondas de fallos de «Retirar acceso» / «Actualizar evidencias» (texto mostrado) y alcanzabilidad por rol desde el menú. Backend real. Datos sintéticos.
const fs = require('fs'); const { chromium } = require(process.env.PLAYWRIGHT_MODULE)
const BASE = process.env.BASE; const U = JSON.parse(fs.readFileSync((process.env.QA_TOOLS || '.') + '/qa5/cred421.json', 'utf8')).users
const open = async (br, user, lang, path, route) => { const ctx = await br.newContext({ viewport: { width: 1360, height: 900 }, reducedMotion: 'reduce' }); const page = await ctx.newPage(); const u = U[user]
  await page.addInitScript(([tk, rl, name, l]) => { localStorage.setItem('elevation_token', tk); localStorage.setItem('elevation_role', rl); localStorage.setItem('elevation_name', name); localStorage.setItem('elv_lang', l) }, [u.token, u.role, u.name, lang]); if (route) await route(page); await page.goto(BASE + path); await page.waitForTimeout(1800); return { ctx, page } }
const txt = (page) => page.evaluate(() => document.body.textContent.replace(/\s+/g, ' '))
;(async () => {
  const br = await chromium.launch()
  for (const lang of ['es', 'en']) {
    { const { ctx, page } = await open(br, 'pA', lang, '/app/professional-reviews', async (pg) => { await pg.route('**/api/me/review-shares/*', (r) => (r.request().method() === 'DELETE' ? r.fulfill({ status: 500, json: {} }) : r.continue())) })
      await page.click(`button:has-text("${lang === 'es' ? 'Retirar acceso' : 'Withdraw access'}")`); await page.waitForTimeout(1000); const s = await txt(page); const alerts = await page.evaluate(() => [...document.querySelectorAll('[role=alert]')].map((e) => e.textContent.trim()))
      console.log(`[${lang}] retirar acceso con error 500 → avisos role=alert: ${JSON.stringify(alerts)} · ¿«No pudimos retirar el acceso» en pantalla?: ${/No pudimos retirar el acceso|We could not withdraw access/.test(s)} · ¿«Tu código no se gastó» (texto de autorizar)?: ${/Tu código no se gastó|Your code was not used up/.test(s)}`); await ctx.close() }
    { const { ctx, page } = await open(br, 'pA', lang, '/app/professional-reviews', async (pg) => { await pg.route('**/api/evidence', (r) => r.fulfill({ status: 500, json: {} })) })
      await page.click(`button:has-text("${lang === 'es' ? 'Actualizar evidencias' : 'Update evidence'}")`); await page.waitForTimeout(1000); const s = await txt(page); const alerts = await page.evaluate(() => [...document.querySelectorAll('[role=alert]')].map((e) => e.textContent.trim()))
      console.log(`[${lang}] actualizar evidencias con la lista de evidencias en 500 → avisos role=alert: ${JSON.stringify(alerts)} · «Tu código no se gastó» visible: ${/Tu código no se gastó|Your code was not used up/.test(s)}`); await ctx.close() }
  }
  // alcanzabilidad por rol desde el menú del marco
  for (const [user, start] of [['pA', '/app/dashboard'], ['rev1', '/therapist/dashboard']]) { const { ctx, page } = await open(br, user, 'es', start)
    const links = await page.evaluate(() => [...document.querySelectorAll('a[href="/app/professional-reviews"]')].map((a) => ({ t: a.textContent.trim(), vis: a.getBoundingClientRect().width > 0 })))
    console.log(`alcanzabilidad ${user} desde ${start}: enlaces a /app/professional-reviews ${JSON.stringify(links)}`)
    if (links.some((l) => l.vis)) { await page.locator('a[href="/app/professional-reviews"]').first().click(); await page.waitForTimeout(1500); console.log(`  → tras el clic: ${new URL(page.url()).pathname} · h2: ${await page.evaluate(() => [...document.querySelectorAll('h2')].slice(0, 2).map((h) => h.textContent.trim()).join(' | '))}`) }
    await ctx.close() }
  await br.close()
})().catch((e) => { console.error('ABORTA', e); process.exit(2) })
