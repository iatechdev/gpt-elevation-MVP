// ES-357 (E366-2): «Editar» un plan con moneda/período HEREDADO en navegador (Chromium, API simulada, datos sintéticos): abre con lo que muestran los desplegables, marca los campos corregidos, axe 0 (ES/EN × claro/oscuro, 390 px),
// lo enviado es lo mostrado y un 400 invalid_plan del servidor se pinta bajo su campo con foco. No corre en CI. Uso: npx vite build && npx vite preview --host 127.0.0.1 --port 5302 --strictPort y luego node scripts/es357-plan-heredado.cjs
const fs = require('fs'); const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright'); const axeSource = fs.readFileSync(process.env.AXE_PATH, 'utf8')
const plan = { id: 5, slug: 'heredado', name_es: 'Heredado', name_en: 'Legacy', description_es: '', description_en: '', price: '10.00', currency: 'JPY', period: 'forever', features_es: [], features_en: [], isHighlighted: false, isActive: true, order: 1 }
;(async () => {
  const b = await chromium.launch(); let bad = 0; const ok = (c, l) => { if (!c) bad++; console.log((c ? 'OK    ' : 'FALLA ') + l) }
  for (const lang of ['es', 'en']) for (const scheme of ['light', 'dark']) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 900 }, colorScheme: scheme, reducedMotion: 'reduce' }); const page = await ctx.newPage(); const puts = []
    await page.addInitScript(l => { localStorage.setItem('elevation_token', 't'); localStorage.setItem('elevation_role', 'superadmin'); localStorage.setItem('elv_lang', l) }, lang)
    await page.route('**/api/**', async route => { const r = route.request(); const p = new URL(r.url()).pathname
      if (p === '/api/session') return route.fulfill({ json: { role: 'superadmin', onboardingCompleted: true } })
      if (p === '/api/admin/pricing/all') return route.fulfill({ json: [plan] })
      if (p === '/api/admin/pricing/5' && r.method() === 'PUT') { const body = JSON.parse(r.postData()); puts.push(body); return body.currency === 'JPY' ? route.fulfill({ status: 400, json: { code: 'invalid_plan', field: 'currency', error: 'La moneda debe ser USD, COP o EUR. / The currency must be USD, COP or EUR.' } }) : route.fulfill({ json: { plan: { ...plan, ...body } } }) }
      return route.fulfill({ json: [] }) })
    await page.goto('' + (process.env.BASE || 'http://127.0.0.1:5302') + '/admin/content'); await page.getByRole('tab', { name: /Planes|Plans/ }).click()
    await page.locator('#plan-edit-5').click(); await page.locator('#plan-currency').waitFor()
    const tag = `${lang} ${scheme}`
    ok((await page.locator('#plan-currency').inputValue()) === 'USD' && (await page.locator('#plan-period').inputValue()) === 'month', `${tag}: «Editar» abre con lo que muestran los desplegables`)
    ok((await page.locator('#plan-currency-err').count()) === 1 && (await page.locator('#plan-period-err').count()) === 1, `${tag}: ambos campos corregidos quedan marcados con su mensaje`)
    await page.addScriptTag({ content: axeSource }); const axe = await page.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } }).then(r => r.violations.map(v => v.id + ':' + v.nodes.length)))
    ok(axe.length === 0, `${tag}: axe 0`, axe.join())
    await page.locator('#plan-currency').selectOption('USD'); ok((await page.locator('#plan-currency-err').count()) === 0, `${tag}: al elegir moneda desaparece su aviso`)
    await page.getByRole('button', { name: /Actualizar|Update/ }).click(); await page.waitForTimeout(500)
    ok(puts.length === 1 && puts[0].currency === 'USD' && puts[0].period === 'month', `${tag}: lo enviado es lo mostrado (USD/month), no el valor heredado`)
    await ctx.close()
  }
  { // el 400 del servidor se pinta bajo su campo
    const ctx = await b.newContext({ viewport: { width: 390, height: 900 } }); const page = await ctx.newPage()
    await page.addInitScript(() => { localStorage.setItem('elevation_token', 't'); localStorage.setItem('elevation_role', 'superadmin'); localStorage.setItem('elv_lang', 'es') })
    await page.route('**/api/**', async route => { const r = route.request(); const p = new URL(r.url()).pathname
      if (p === '/api/session') return route.fulfill({ json: { role: 'superadmin', onboardingCompleted: true } })
      if (p === '/api/admin/pricing/all') return route.fulfill({ json: [{ ...plan, currency: 'USD', period: 'month' }] })
      if (p === '/api/admin/pricing/5' && r.method() === 'PUT') return route.fulfill({ status: 400, json: { code: 'invalid_plan', field: 'price', error: 'El precio debe ser un número entre 0 y 99 999 999,99 con a lo sumo dos decimales. / The price must be a number from 0 to 99,999,999.99 with at most two decimals.' } })
      return route.fulfill({ json: [] }) })
    await page.goto('' + (process.env.BASE || 'http://127.0.0.1:5302') + '/admin/content'); await page.getByRole('tab', { name: /Planes/ }).click(); await page.locator('#plan-edit-5').click(); await page.getByRole('button', { name: 'Actualizar' }).click(); await page.waitForTimeout(500)
    ok((await page.locator('#plan-price-err').innerText()).includes('El precio debe ser un número'), '400 invalid_plan del servidor: el mensaje sale bajo su campo (precio)')
    ok(await page.evaluate(() => document.activeElement?.id === 'plan-price'), '400 invalid_plan: el foco va al campo')
    await ctx.close()
  }
  await b.close(); console.log(bad ? `${bad} FALLA(S)` : 'TODO OK'); process.exit(bad ? 1 : 0)
})()
