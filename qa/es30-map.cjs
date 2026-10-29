// QA-Claude-2 — ES-30 (#86): mapa por territorios, responsive, teclado, Revocar todos. Requiere mock (:8099) y vite (:5173)
// con VITE_SKILL_MAP_SAMPLE_TERRITORIES=true. Salida: resultados OK/FALLA por comprobación y capturas en OUT.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE)
const path = require('path'), fs = require('fs')
const OUT = process.env.OUT, BASE = 'http://localhost:5173/app/skill-map'; fs.mkdirSync(OUT, { recursive: true })
let fails = 0; const ck = (name, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? 'OK   ' : 'FALLA'} ${name} ${extra}`) }
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' }
const newPage = async (browser, { lang = 'es', width = 1280, scheme = 'light' } = {}) => {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: scheme })
  await ctx.addInitScript(([l]) => { localStorage.setItem('elevation_token', 'sintetico'); localStorage.setItem('elv_lang', l) }, [lang])
  const page = await ctx.newPage(); page.errs = []
  page.on('console', m => { if (m.type() === 'error') page.errs.push(m.text().slice(0, 140)) }); page.on('pageerror', e => page.errs.push(e.message.slice(0, 140)))
  return page
}
const go = async (page) => { await page.goto(BASE, { waitUntil: 'networkidle' }); await page.waitForTimeout(500) }
const revBtnOf = (p, re) => p.locator('.skill-map-tools button', { hasText: re })
;(async () => {
  const browser = await chromium.launch()
  // 1) Escritorio 1280, ES
  let page = await newPage(browser); await go(page)
  const svg = page.locator('svg.skill-map-svg')
  ck('F30-1 mapa visible a 1280', await svg.isVisible())
  ck('F30-1 5 territorios', await page.locator('svg .skill-map-territory').count() === 5)
  ck('F30-1 4 capacidades (nodos)', await page.locator('svg .skill-map-chip').count() === 4)
  ck('F30-1 8 líneas (4 capacidades x 2 territorios)', await page.locator('svg .skill-map-link').count() === 8)
  ck('F30-3 aviso de asignación de ejemplo (solo DEV)', (await page.locator('.skill-map-note').allInnerTexts()).some(t => /ejemplo/i.test(t)))
  const body = await page.locator('body').innerText()
  ck('F30-3/F30-7 sin "%" ni "déficit" en pantalla', !/%|déficit|deficit/i.test(body))
  const chipLabels = await page.locator('svg .skill-map-chip').evaluateAll(els => els.map(e => e.getAttribute('aria-label')))
  console.log('   nodos:', JSON.stringify(chipLabels))
  ck('F30-8 orden de nodos = orden del catálogo (no por nivel)', chipLabels.map(l => l.split(':')[0]).join('|') === 'Comunicación|Análisis de datos|Liderazgo|Diseño de servicios')
  ck('F30-3 los 4 estados con texto', ['Con evidencia', 'Requiere revisión humana', 'Desactualizado', 'Sin evidencia vigente'].every(s => chipLabels.some(l => l.includes(s))))
  const dots = await page.locator('svg .skill-map-chip circle').evaluateAll(els => els.map(e => ({ c: e.getAttribute('class'), dash: getComputedStyle(e).strokeDasharray, fill: getComputedStyle(e).fill })))
  console.log('   puntos:', JSON.stringify(dots))
  ck('F30-3 forma distinta (relleno vs hueco punteado)', new Set(dots.map(d => d.c)).size === 2 && dots.some(d => d.dash && d.dash !== 'none'))
  await page.locator('svg .skill-map-chip').nth(1).click(); await page.waitForTimeout(300)
  ck('F30-4 clic abre el detalle', (await page.locator('#skill-detail-title').innerText()) === 'Análisis de datos')
  await page.locator('svg .skill-map-chip').nth(2).focus(); await page.keyboard.press('Enter'); await page.waitForTimeout(300)
  ck('F30-5 Enter abre el detalle', (await page.locator('#skill-detail-title').innerText()) === 'Liderazgo')
  await page.locator('svg .skill-map-chip').nth(3).focus(); await page.keyboard.press('Space'); await page.waitForTimeout(300)
  ck('F30-5 Espacio abre el detalle', (await page.locator('#skill-detail-title').innerText()) === 'Diseño de servicios')
  const detail = await page.locator('.skill-map-detail').innerText()
  ck('F30-4 nivel null sin evidencia: sin "Nivel 0"', /Sin evidencia vigente/.test(detail) && !/Nivel 0|Nivel null/.test(detail))
  await page.screenshot({ path: path.join(OUT, 'map-1280-es.png'), fullPage: true })
  await page.locator('.skill-map-view-toggle').focus()
  const reached = new Set(); for (let i = 0; i < 10; i++) { await page.keyboard.press('Tab'); const a = await page.evaluate(() => document.activeElement.getAttribute('aria-label') || ''); if (a.includes(':')) reached.add(a) }
  ck('F30-5 los 4 nodos alcanzables con Tab', reached.size >= 4, String(reached.size))
  await page.locator('.skill-map-view-toggle').click(); await page.waitForTimeout(200)
  ck('F30-5 botón alterna a lista (mapa oculto)', !(await svg.isVisible()) && await page.locator('.skill-map-territory-list').isVisible())
  ck('F30-5 botón cambia a "Ver como mapa"', (await page.locator('.skill-map-view-toggle').innerText()) === 'Ver como mapa')
  ck('F30-1 lista muestra "También en" (8 filas)', await page.locator('.skill-map-pick-also').count() === 8)
  ck('F30-9 lista: 5 tarjetas de territorio', await page.locator('.skill-map-territory-card').count() === 5)
  ck('consola sin errores (1280)', page.errs.length === 0, page.errs.join('|'))
  await page.context().close()
  // 2) Responsive
  for (const w of [320, 375, 768, 1023, 1024, 1280]) {
    page = await newPage(browser, { width: w }); await go(page)
    const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth, small: [...document.querySelectorAll('button,summary,a')].filter(b => b.offsetParent && (b.getBoundingClientRect().height < 44 || b.getBoundingClientRect().width < 44)).map(b => (b.textContent || '').trim().slice(0, 25)) }))
    const mapVisible = await page.locator('svg.skill-map-svg').isVisible(), toggle = await page.locator('.skill-map-view-toggle').isVisible()
    ck(`F30-5 ${w}px sin desborde`, m.sw <= m.iw, `${m.sw}/${m.iw}`)
    ck(`F30-5 ${w}px mapa y botón ${w >= 1024 ? 'visibles' : 'ocultos'}`, mapVisible === (w >= 1024) && toggle === (w >= 1024), `mapa=${mapVisible} botón=${toggle}`)
    if (m.small.length) console.log(`   controles <44px a ${w}px:`, JSON.stringify(m.small))
    if (w === 375 || w === 320) await page.screenshot({ path: path.join(OUT, `map-${w}-es.png`), fullPage: true })
    ck(`consola ${w}px`, page.errs.length === 0, page.errs.join('|'))
    await page.context().close()
  }
  // 3) Inglés
  page = await newPage(browser, { lang: 'en' }); await go(page)
  const en = await page.locator('body').innerText() + ' ' + await page.locator('svg').first().textContent()
  ck('F30-7 EN: territorios traducidos', /Leadership & Management/.test(en) && /Strategy Consulting/.test(en), en.split('\n').slice(0, 3).join(' / '))
  ck('F30-7 EN: sin español residual (muestra)', !/Revocar|Ver como|Sin evidencia|Territorio/.test(en))
  await page.screenshot({ path: path.join(OUT, 'map-1280-en.png'), fullPage: true }); await page.context().close()
  // 4) Revocar todos
  const revokeCase = async ({ status = 200, lang = 'es', onGet } = {}) => {
    const p = await newPage(browser, { lang }); const st = { put: null }
    await p.route('**/api/consents/professional_bridge', async r => { st.put = { method: r.request().method(), body: r.request().postData(), auth: !!r.request().headers()['authorization'] }; await r.fulfill({ status, contentType: 'application/json', body: '{}', headers: CORS }) })
    if (onGet) await p.route('**/api/consents', async r => { if (r.request().method() === 'GET') await r.fulfill(onGet); else await r.continue() })
    await go(p); return { p, st }
  }
  let { p, st } = await revokeCase()
  const rev = revBtnOf(p, /Revocar todos/)
  ck('F30-6 botón activo con permiso concedido', await rev.isEnabled())
  await rev.focus(); await p.keyboard.press('Enter'); await p.waitForTimeout(300)
  ck('F30-6 diálogo abierto', await p.locator('dialog.skill-map-dialog[open]').count() === 1)
  ck('F30-6 foco inicial en "Cancelar"', (await p.evaluate(() => document.activeElement.textContent.trim())) === 'Cancelar')
  await p.keyboard.press('Escape'); await p.waitForTimeout(300)
  ck('F30-6 Esc cierra y devuelve el foco a "Revocar todos"', await p.locator('dialog[open]').count() === 0 && (await p.evaluate(() => document.activeElement.textContent.trim())) === 'Revocar todos')
  ck('F30-6 cancelar no envía nada', st.put === null)
  await rev.click(); await p.waitForTimeout(200); await p.locator('dialog button', { hasText: 'Sí, revocar' }).click(); await p.waitForTimeout(600)
  ck('F30-6 PUT exacto con Authorization', !!st.put && st.put.method === 'PUT' && st.put.body === '{"status":"revoked"}' && st.put.auth, JSON.stringify(st.put))
  ck('F30-6 mensaje de éxito y botón desactivado', /Listo: ya no cruza nada/.test(await p.locator('.skill-map-revoke-status').innerText()) && await rev.isDisabled())
  await p.screenshot({ path: path.join(OUT, 'map-revoked.png') }); await p.context().close()
  for (const [code, re] of [[500, /No pudimos revocar/], [401, /sesi|Inicia|venci/i], [409, /No pudimos revocar|Inténtalo/]]) {
    ;({ p, st } = await revokeCase({ status: code }))
    await revBtnOf(p, /Revocar todos/).click(); await p.waitForTimeout(200)
    await p.locator('dialog button', { hasText: 'Sí, revocar' }).click(); await p.waitForTimeout(600)
    const msg = await p.locator('.skill-map-revoke-status').innerText(), all = await p.locator('body').innerText()
    ck(`F30-6 PUT ${code}: mensaje propio sin texto crudo`, re.test(msg) && !/\{\}|undefined|Error:/.test(all), JSON.stringify(msg))
    if (code !== 401) ck(`F30-6 PUT ${code}: se puede reintentar`, await revBtnOf(p, /Revocar todos/).isEnabled())
    await p.context().close()
  }
  for (const s of ['revoked', 'undecided']) {
    ;({ p } = await revokeCase({ onGet: { status: 200, contentType: 'application/json', body: JSON.stringify({ consents: [{ purpose: 'professional_bridge', status: s }] }), headers: CORS } }))
    ck(`F30-6 permiso ${s}: botón desactivado y aviso`, await revBtnOf(p, /Revocar todos/).isDisabled() && /No hay nada autorizado/.test(await p.locator('.skill-map-revoke-status').innerText()))
    await p.context().close()
  }
  ;({ p } = await revokeCase({ lang: 'en' })); await revBtnOf(p, /Revoke all/).click(); await p.waitForTimeout(200)
  const dlg = await p.locator('dialog').innerText()
  ck('F30-7 diálogo EN', /Revoke all permissions\?/.test(dlg) && !/Revocar/.test(dlg)); await p.context().close()
  // 5) Sin territorio asignado (como hoy en producción: claves sin asignación)
  p = await newPage(browser)
  const mk = (key, n) => ({ skillKey: key, type: 'domain', labels: { es: n, en: n }, rubric: { levels: { 1: { es: 'a', en: 'a' }, 2: { es: 'b', en: 'b' }, 3: { es: 'c', en: 'c' }, 4: { es: 'd', en: 'd' } }, source: 's', verifiedAt: '2026-10-01T00:00:00Z' }, state: 'no_evidence', self: null, review: null })
  await p.route('**/api/skill-map', r => r.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify({ catalogVersion: 3, skills: [mk('zz1', 'Capacidad uno'), mk('zz2', 'Capacidad dos')] }) }))
  await go(p)
  ck('F30-2 «Sin territorio asignado» en mapa (<1024 lista; 1280 sin nodos)', await p.locator('svg .skill-map-chip').count() === 0 && await p.locator('svg .skill-map-link').count() === 0)
  await p.locator('.skill-map-view-toggle').click(); await p.waitForTimeout(200)
  ck('F30-2 lista con 2 capacidades sin territorio', await p.locator('#terr-none').count() === 1 && await p.locator('#terr-none ~ ul li').count() === 2)
  await p.screenshot({ path: path.join(OUT, 'map-unassigned.png'), fullPage: true }); await p.context().close()
  // 6) Estados del mapa: vacío, 500, 401, 403
  for (const [code, payload] of [[200, { catalogVersion: 3, skills: [] }], [500, {}], [401, {}], [403, {}]]) {
    p = await newPage(browser); await p.route('**/api/skill-map', r => r.fulfill({ status: code, contentType: 'application/json', headers: CORS, body: JSON.stringify(payload) })); await go(p)
    const t = await p.locator('body').innerText()
    ck(`F30-4 /api/skill-map ${code}${code === 200 ? ' vacío' : ''}: sin texto crudo`, !/\[object|undefined|\{\}/.test(t), JSON.stringify(t.split('\n').filter(x => /no |No |sesión|permis|vac|catálogo|Inicia/i.test(x)).slice(0, 2)))
    await p.context().close()
  }
  console.log(fails ? `\nFALLAS: ${fails}` : '\nTODO OK'); await browser.close(); process.exit(fails ? 1 : 0)
})()
