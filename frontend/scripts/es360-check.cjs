// ES-360: revisión de copies. Chromium, API simulada (page.route), datos sintéticos, solo vista previa local. Mide en el DOM RENDERIZADO (no en el catálogo):
//  · portada ES/EN × 1360/390/320 × claro/oscuro: hero con dos acciones, demostración fija de solo lectura (5 estados, ninguna petición POST/PUT/PATCH/DELETE, recargar vuelve al inicio, sin «Anotada»),
//    una sola escala de estado, sin planes ni petición a planes, sin nota de foto, ningún marcador interno, «SkillMap», teclado (Enter en «Probar un ejemplo» lleva el foco a la sección),
//    pie con «Aviso de privacidad» → /privacidad; axe wcag2a/2aa/21a/21aa/22aa + target-size + label-content-name-mismatch; sin desborde horizontal;
//  · registro / inicio de sesión / recuperar contraseña: títulos y botones del diseño, sin «solo tú los ves» ni «Máximo 72 bytes», aviso de contraseña larga solo al superar el límite, enlace al aviso completo;
//  · /#privacidad (ancla antigua) no deja pantalla vacía;
//  · CLS a 390 px con CPU ×4 (A/B intercalado contra main, MAIN=…): «/», registro e inicio de sesión.
// Uso: PLAYWRIGHT_MODULE=<ruta a playwright> AXE_PATH=<axe.min.js> PR=http://127.0.0.1:4361 [MAIN=http://127.0.0.1:4362] [RUNS=6] node scripts/es360-check.cjs
const assert = require('node:assert/strict')
const fs = require('node:fs')

;(async () => {
  const { chromium } = process.env.PLAYWRIGHT_MODULE ? require(process.env.PLAYWRIGHT_MODULE) : await import('playwright')
  const PR = process.env.PR ?? 'http://127.0.0.1:4361'; const MAIN = process.env.MAIN
  for (const base of [PR, MAIN].filter(Boolean)) assert.ok(['127.0.0.1', 'localhost'].includes(new URL(base).hostname), 'Solo vista previa local')
  const axeSource = fs.readFileSync(process.env.AXE_PATH, 'utf8')
  const browser = await chromium.launch({ headless: true })
  const errors = []; let count = 0
  const check = label => { count++; console.log('PASS ' + label) }
  const INTERNAL = /sintétic|synthetic|dato de prueba|plan de prueba|espacio reservado|space reserved|fotograf|POR COMPLETAR|POR REVISAR|TODO|lorem|\[\[|\{\{|undefined|NaN|Skill Map|solo tú|only you|cambia de plan|change plans|Disponibilidad por confirmar|Próximamente|Consulta disponibilidad|Coming soon|Anotada|Noted\.|Máximo 72 bytes|72 bytes|qa-/i

  async function open(base, route, { width = 1360, lang = 'es', scheme = 'light', cpu = 1, mocks = {} } = {}) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: scheme, reducedMotion: 'reduce', isMobile: width < 600 })
    const page = await context.newPage(); const requests = []
    page.on('pageerror', e => errors.push(e.message))
    page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()) })
    page.on('request', r => { const u = new URL(r.url()); if (u.pathname.startsWith('/api/') || r.method() !== 'GET') requests.push(`${r.method()} ${u.pathname}`) })
    await page.addInitScript(([l]) => { localStorage.setItem('elv_lang', l) }, [lang])
    await page.route('**/api/**', route => {
      const p = new URL(route.request().url()).pathname
      if (p === '/api/landing-content') return route.fulfill({ json: {} })
      if (p === '/api/session') return route.fulfill({ status: 401, json: { error: 'x' } })
      return route.fulfill({ json: mocks[p] ?? [] })
    })
    if (cpu > 1) { const cdp = await context.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu }) }
    await page.addInitScript(() => { window.__ls = []; new PerformanceObserver(list => { for (const e of list.getEntries()) if (!e.hadRecentInput) window.__ls.push(e.value) }).observe({ type: 'layout-shift', buffered: true }) })
    await page.goto(base + route, { waitUntil: 'networkidle' })
    return { context, page, requests }
  }
  const axe = async page => { await page.evaluate(axeSource); return page.evaluate(async () => {
    const tags = await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] })
    const rules = await window.axe.run(document, { runOnly: { type: 'rule', values: ['label-content-name-mismatch', 'target-size'] } })
    return [...tags.violations, ...rules.violations].map(v => v.id + ':' + v.nodes.length).filter((v, i, all) => all.indexOf(v) === i)
  }) }
  const overflow = page => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  const text = page => page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '))
  const attrs = page => page.evaluate(() => [...document.querySelectorAll('[title],[aria-label],[alt],[placeholder]')].map(e => [e.title, e.getAttribute('aria-label'), e.getAttribute('alt'), e.getAttribute('placeholder')].filter(Boolean).join(' | ')).join(' | '))
  const T = {
    es: { h1: 'Reconoce lo que sabes hacer a partir de tu experiencia.', cta: 'Probar un ejemplo', up: 'Crear cuenta', demo: 'Mira cómo funciona con un ejemplo', tag: 'Ejemplo fijo · no se guarda', see: 'Ver la sugerencia', yes: 'Sí, la respalda', no: 'No estoy de acuerdo', rise: 'Ver cómo sube',
      avail: 'Disponible', soon: 'En preparación', priv: 'Aviso de privacidad', pilot: 'Elevation está en piloto cerrado', signin: 'Iniciar sesión', hint: 'Posible sugerencia' },
    en: { h1: 'Recognise what you can do, starting from your experience.', cta: 'Try an example', up: 'Create account', demo: 'See how it works with an example', tag: 'Fixed example · not saved', see: 'See the suggestion', yes: 'Yes, it supports it', no: 'I disagree', rise: 'See it rise',
      avail: 'Available', soon: 'In preparation', priv: 'Privacy notice', pilot: 'Elevation is in a closed pilot', signin: 'Sign in', hint: 'Possible suggestion' },
  }

  // 1. Portada
  for (const [width, lang, scheme] of [[1360, 'es', 'light'], [1360, 'en', 'dark'], [390, 'es', 'dark'], [390, 'en', 'light'], [320, 'es', 'light'], [320, 'en', 'dark']]) {
    const tag = `${width}px ${lang} ${scheme}`; const c = T[lang]
    const { context, page, requests } = await open(PR, '/', { width, lang, scheme })
    await page.locator('#como-funciona').waitFor(); await page.locator('footer.landing-footer').waitFor({ timeout: 15000 })
    assert.equal(await page.locator('h1').count(), 1, `un h1 (${tag})`)
    assert.equal((await page.locator('h1').textContent()).replace(/\s+/g, ' ').trim(), c.h1, `título del hero (${tag})`)
    assert.ok(await page.locator('.pt-hero').getByRole('link', { name: c.cta, exact: true }).count() === 1 && await page.locator('.pt-hero').getByRole('link', { name: c.up, exact: true }).count() === 1, `dos acciones en el hero (${tag})`)
    const body = await text(page) + ' ' + await attrs(page)
    assert.doesNotMatch(body, INTERNAL, `ningún marcador interno ni texto retirado (${tag}): ${(body.match(INTERNAL) ?? [])[0]}`)
    assert.ok(!/\bplan(es)?\b|\bplans?\b|USD|\$\s?\d/i.test(await page.locator('main').innerText()), `sin planes ni precios en la portada (${tag})`)
    assert.equal(await page.locator('#planes, .pp-plans, .pt-photo, textarea').count(), 0, `sin sección de planes, nota de foto ni cuadro editable (${tag})`)
    assert.ok(!requests.some(r => /pricing|plans|plan-requests/.test(r)), `ninguna petición a planes (${tag}): ${requests.join(',')}`)
    assert.ok((await page.locator('footer.landing-footer a[href="/privacidad"]').textContent()).trim() === c.priv, `pie: «${c.priv}» → /privacidad (${tag})`)
    assert.equal(await page.locator('.cg-header a[href="/privacidad"]').count(), 1, `marco: «Privacidad» → /privacidad, no /#privacidad (${tag})`)
    assert.equal(await page.locator('a[href="/#privacidad"]').count(), 0, `ningún enlace a /#privacidad (${tag})`)
    // una sola escala de estado: solo «Disponible» / «En preparación» como chips; el pilot
    const chips = await page.locator('.cg-chip').allTextContents(); const labels = chips.map(s => s.replace('✓', '').trim()).filter(s => s !== c.tag)
    assert.deepEqual([...new Set(labels)].sort(), [c.avail, c.soon].sort(), `una sola escala de estado (${tag}): ${labels.join(',')}`)
    assert.equal(labels.filter(s => s === c.avail).length, 4); assert.equal(labels.filter(s => s === c.soon).length, 5)
    assert.ok((await page.locator('main').innerText()).toLowerCase().includes(c.pilot.toLowerCase()), `próximo paso: piloto cerrado (${tag})`) // innerText respeta text-transform: uppercase de los títulos
    assert.equal(await overflow(page), 0, `sin desborde horizontal (${tag})`)
    assert.deepEqual(await axe(page), [], `axe 0 en la portada (${tag})`)
    if (process.env.ES360_SHOTS && scheme === 'light') await page.screenshot({ path: `${process.env.ES360_SHOTS}/portada-${lang}-${width}.png`, fullPage: true })
    await context.close(); check(`portada ${tag}`)
  }

  // 2. Demostración fija: estados, teclado, sin red, recargar vuelve al inicio
  for (const lang of ['es', 'en']) {
    const c = T[lang]
    const { context, page, requests } = await open(PR, '/', { width: 1360, lang })
    await page.locator('#ejemplo').waitFor()
    assert.equal(await page.locator('#ejemplo textarea, #ejemplo input, #ejemplo [contenteditable]').count(), 0, 'sin campo editable'); assert.equal(await page.locator('#ejemplo blockquote').count(), 1)
    assert.ok((await page.locator('#ejemplo').innerText()).toLowerCase().includes(c.tag.toLowerCase()), 'rótulo «Ejemplo fijo · no se guarda»')
    assert.equal(await page.locator('.pt-hint').count(), 0, 'sin tarjeta de pista antes de pulsar')
    // teclado: Tab hasta «Probar un ejemplo», Enter → foco en la sección #ejemplo
    await page.locator('.pt-hero a', { hasText: c.cta }).focus(); await page.keyboard.press('Enter')
    assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.id), 'ejemplo', 'Enter en «Probar un ejemplo» lleva el foco a la sección')
    const before = requests.length
    await page.getByRole('button', { name: c.see, exact: true }).click(); assert.ok((await page.locator('.pt-hint').innerText()).toLowerCase().includes(c.hint.toLowerCase()))
    await page.getByRole('button', { name: c.yes, exact: true }).click(); assert.ok(!/Anotada|Noted\./.test(await page.locator('.pt-hint').innerText()))
    await page.getByRole('button', { name: c.rise, exact: true }).click(); await page.locator('.pt-rise canvas, .pt-rise svg, .pt-rise .cg-relief').first().waitFor()
    assert.deepEqual(await axe(page), [], `axe 0 con la demostración abierta (${lang})`)
    await page.reload({ waitUntil: 'networkidle' }); await page.locator('#ejemplo').waitFor(); assert.equal(await page.locator('.pt-hint').count(), 0, 'recargar vuelve al inicio')
    await page.getByRole('button', { name: c.see, exact: true }).click(); await page.getByRole('button', { name: c.no, exact: true }).click()
    assert.ok(/descarta|discarded/.test(await page.locator('.pt-hint').innerText()))
    assert.deepEqual(requests.slice(before).filter(r => !r.startsWith('GET ')), [], `ninguna escritura al interactuar (${lang})`)
    await context.close(); check(`demostración ${lang}`)
  }

  // 3. Registro, inicio de sesión y recuperar contraseña
  for (const [lang, scheme, width] of [['es', 'light', 1360], ['en', 'dark', 390], ['es', 'dark', 320]]) {
    const tag = `${width}px ${lang} ${scheme}`
    const { context, page } = await open(PR, '/login?mode=register', { width, lang, scheme })
    await page.locator('input[type=password]').waitFor()
    const reg = await text(page) + ' ' + await attrs(page)
    assert.doesNotMatch(reg, INTERNAL, `registro sin textos retirados (${tag}): ${(reg.match(INTERNAL) ?? [])[0]}`)
    assert.ok(lang === 'es' ? /Tu profesional no puede leer tus conversaciones con el asistente ni tu diario/.test(reg) && /proveedor externo/.test(reg) : /Your professional cannot read your conversations with the assistant or your journal/.test(reg) && /external provider/.test(reg), `nota de privacidad del diseño (${tag})`)
    assert.ok(/Por ahora no hay pago en línea|There is no online payment for now/.test(reg) && !/es gratis|is free/i.test(reg), `texto vigente de pago, no «gratis» (${tag})`)
    assert.equal(await page.locator('.ac-note a[href="/privacidad"]').first().textContent().then(s => s.trim()), lang === 'es' ? 'aviso de privacidad' : 'privacy notice', `enlace «aviso de privacidad» (${tag})`)
    // contraseña: sin «72 bytes» en la lista; el aviso aparece solo al superar el límite
    assert.ok(!/bytes/i.test(await page.locator('.ac-req').innerText()), `la lista de requisitos no menciona bytes (${tag})`)
    await page.locator('input[type=password]').fill('Abcdef1!'); assert.ok(!/demasiado larga|too long/i.test(await page.locator('.ac-req').innerText()), `contraseña válida: sin aviso (${tag})`)
    await page.locator('input[type=password]').fill('Abc1!' + 'ñ'.repeat(40)); assert.ok(/demasiado larga|too long/i.test(await page.locator('.ac-req').innerText()), `contraseña larga: con aviso (${tag})`)
    await page.locator('input[type=password]').fill('')
    assert.equal(await overflow(page), 0, `registro sin desborde (${tag})`); assert.deepEqual(await axe(page), [], `axe 0 en el registro (${tag})`)
    await context.close()
    const login = await open(PR, '/login', { width, lang, scheme }); await login.page.locator('input[type=password]').waitFor()
    const out = await text(login.page); const c = T[lang]
    assert.ok(out.toLowerCase().includes(c.signin.toLowerCase()) && !/Entrar a mi espacio|Enter my space|Un espacio solo para ti|A space just for you/.test(out), `inicio de sesión (${tag})`)
    assert.equal(await login.page.locator('form button[type=submit]').textContent().then(s => s.trim()), c.signin, `botón «${c.signin}» (${tag})`)
    assert.equal(await overflow(login.page), 0); assert.deepEqual(await axe(login.page), [], `axe 0 en el inicio de sesión (${tag})`); await login.context.close()
    const forgot = await open(PR, '/forgot-password', { width, lang, scheme }); await forgot.page.locator('input[type=email]').waitFor()
    assert.equal(await forgot.page.locator('form button[type=submit]').textContent().then(s => s.trim()), lang === 'es' ? 'Enviar enlace para restablecer la contraseña' : 'Send link to reset your password', `botón de recuperar (${tag})`)
    assert.equal(await overflow(forgot.page), 0); assert.deepEqual(await axe(forgot.page), [], `axe 0 al recuperar (${tag})`); await forgot.context.close()
    check(`registro, inicio de sesión y recuperar ${tag}`)
  }

  // 4. Ancla antigua /#privacidad: no deja pantalla vacía
  { const { context, page } = await open(PR, '/#privacidad'); await page.locator('footer.landing-footer').waitFor({ timeout: 15000 })
    assert.ok((await page.locator('main').innerText()).length > 500, '/#privacidad muestra la portada'); await context.close(); check('/#privacidad') }

  // 5. CLS A/B a 390 px, CPU ×4
  if (MAIN) {
    const med = a => { const s = [...a].sort((x, y) => x - y); return s[s.length >> 1] }
    const RUNS = Number(process.env.RUNS || 6)
    for (const route of ['/', '/login?mode=register', '/login']) {
      const pr = [], mn = []
      for (let i = 0; i < RUNS; i++) for (const [arr, base] of [[pr, PR], [mn, MAIN]]) {
        const { context, page } = await open(base, route, { width: 390, cpu: 4, scheme: 'light' }); await page.waitForTimeout(1500)
        arr.push(await page.evaluate(() => window.__ls.reduce((a, b) => a + b, 0))); await context.close()
      }
      const worst = Math.max(...pr)
      console.log(`CLS ${route}: PR mediana ${med(pr).toFixed(4)} máx ${worst.toFixed(4)} | main mediana ${med(mn).toFixed(4)} máx ${Math.max(...mn).toFixed(4)} (n=${RUNS} intercalado)`)
      assert.ok(worst <= 0.1, `CLS ≤ 0,1 en ${route}`)
      assert.ok(med(pr) <= med(mn) + 0.02, `CLS no peor que main +0,02 en ${route}`)
    }
    check('CLS A/B')
  }

  await browser.close()
  assert.deepEqual(errors, [], 'sin errores de JS ni de consola')
  console.log(`\n${count} grupos de comprobaciones: OK`)
})().catch(error => { console.error(error); process.exit(1) })
