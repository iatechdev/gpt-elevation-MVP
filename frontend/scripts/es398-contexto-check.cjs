// ES-398: sin disponibilidad semanal, «Revisar y aceptar experimento» dice qué falta y enlaza a «Mi contexto»; no bloquea y, completada la disponibilidad, se acepta. Chromium contra el servidor REAL local y PostgreSQL REAL; persona SINTÉTICA; 0 IA.
// Archivo propio (no toca scripts/es237-2b-check.cjs). Uso: (1) ES237_BACKEND_DIR=../backend NODE_PATH=../backend/node_modules PORT=<p> node scripts/es237-2b-server.cjs
//   (2) VITE_ENABLE_CAREER_PREVIEW=true VITE_CAREER_SOURCE=api VITE_BACKEND_URL=http://127.0.0.1:<p> npx vite build --outDir <dist> --emptyOutDir && npx vite preview --outDir <dist> --host 127.0.0.1 --port <q> --strictPort
//   (3) PLAYWRIGHT_MODULE=<playwright> AXE_PATH=<axe.min.js> BASE=http://127.0.0.1:<q> API=http://127.0.0.1:<p> node scripts/es398-contexto-check.cjs
const fs = require('fs')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const axeSource = fs.readFileSync(process.env.AXE_PATH, 'utf8'), BASE = process.env.BASE, API = process.env.API
const T = {
  es: { save: /Guardar restricciones/, choose: /Elegir esta ruta/, accept: /Revisar y aceptar experimento/, start: /^Iniciar$/, recover: /Recuperar el estado guardado/, co: 'Colombia', esl: 'Español', remote: 'Remota', origin: 'Contexto de origen (opcional)', needs: 'Falta información de tu contexto', link: 'Mi contexto', conflict: 'La versión o el fundamento cambió' },
  en: { save: /Save constraints/, choose: /Choose this route/, accept: /Review and accept experiment/, start: /^Start$/, recover: /Retrieve the saved state/, co: 'Colombia', esl: 'Spanish', remote: 'Remote', origin: 'Starting context (optional)', needs: 'Some of your context is missing', link: 'My context', conflict: 'The version or basis changed' },
}
let failures = 0, total = 0
const settle = async page => { await page.waitForLoadState('networkidle').catch(() => {}); await page.waitForTimeout(150) }
async function scene(browser, lang, width, scheme) {
  const x = T[lang], out = []; const want = (label, ok) => out.push([label, Boolean(ok)])
  const person = await (await fetch(`${API}/__test/persona?noavail=1`, { method: 'POST' })).json()
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: scheme, reducedMotion: 'reduce' }); const page = await ctx.newPage()
  await page.addInitScript(([l, token]) => { localStorage.setItem('elevation_token', token); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elv_lang', l) }, [lang, person.token])
  await page.goto(BASE + '/app/next-step', { waitUntil: 'networkidle' }); await settle(page)
  await page.getByLabel(x.co, { exact: true }).first().check(); await page.getByLabel(x.esl, { exact: true }).first().check(); await page.getByLabel(x.remote, { exact: true }).first().check()
  await page.getByLabel(x.origin).selectOption({ index: 1 }); await page.getByRole('button', { name: x.save }).click(); await settle(page)
  // La ruta se identifica por su título: al elegirla su tarjeta cambia y deja de ser «la primera con Elegir».
  const cards = page.locator('article.pg-card').filter({ has: page.getByRole('button', { name: x.choose }) }); await cards.first().waitFor({ timeout: 15000 })
  const title = ((await cards.first().locator('h3').textContent()) || '').trim(), card = page.locator('article.pg-card').filter({ has: page.getByRole('heading', { name: title, exact: true }) })
  await card.getByRole('button', { name: x.choose }).click(); await settle(page)
  const accept = card.getByRole('button', { name: x.accept }); await accept.waitFor({ timeout: 8000 }); await accept.click()
  const link = page.getByRole('link', { name: x.link, exact: true }); await link.waitFor({ timeout: 10000 }); await settle(page)
  const text = await page.evaluate(() => document.querySelector('main')?.innerText ?? ''), has = s => text.toLowerCase().includes(s.toLowerCase())
  want('aviso de contexto incompleto (no «versión o fundamento cambió»)', has(x.needs) && !has(x.conflict))
  want('un enlace «Mi contexto» a /app/onboarding', await link.count() === 1 && (await link.getAttribute('href')) === '/app/onboarding')
  want('sin botón «Recuperar» y la pantalla no queda bloqueada', !(await page.getByRole('button', { name: x.recover }).count()) && await accept.isEnabled())
  await page.addScriptTag({ content: axeSource }); const axe = await page.evaluate(() => axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] }).then(r => r.violations.map(v => v.id)))
  want('axe = 0', axe.length === 0); want('objetivo del enlace ≥ 24 px', (await link.boundingBox()).height >= 24)
  await link.focus(); want('el enlace recibe el foco por teclado', await link.evaluate(el => el === document.activeElement)); await page.keyboard.press('Enter'); await settle(page); want('Enter navega a Mi contexto', page.url().includes('/app/onboarding'))
  await fetch(`${API}/__test/disponibilidad?userId=${person.userId}`, { method: 'POST' }); await page.goto(BASE + '/app/next-step', { waitUntil: 'networkidle' }); await settle(page)
  const again = page.getByRole('button', { name: x.accept }).first(); await again.waitFor({ timeout: 8000 }); await again.click(); await page.getByRole('button', { name: x.start }).waitFor({ timeout: 10000 }).catch(() => {})
  want('tras completar la disponibilidad, el experimento se acepta', await page.getByRole('button', { name: x.start }).count() > 0)
  await ctx.close()
  for (const [label, ok] of out) { total += 1; if (!ok) failures += 1; console.log(`${ok ? 'OK   ' : 'FALLA'} ${lang} ${width}px ${scheme}: ${label}`) }
}
;(async () => {
  const browser = await chromium.launch()
  for (const lang of ['es', 'en']) for (const width of [390, 1360, 320]) for (const scheme of ['light', 'dark']) { try { await scene(browser, lang, width, scheme) } catch (error) { total += 1; failures += 1; console.log(`FALLA ${lang} ${width}px ${scheme}: escena no alcanzada: ${String(error.message).split('\n')[0]}`) } }
  await browser.close(); console.log(`${total - failures}/${total} comprobaciones OK`); process.exit(failures ? 1 : 0)
})()
