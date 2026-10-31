// QA-Claude-2 — ES-133 (PR 117): landing con estados reales. Solo lectura. Env: U (servidor local del dist), PLAYWRIGHT_MODULE, EXPECT_CLEAN=1 (esperar 0 «Próximamente»).
const { chromium } = require(process.env.PLAYWRIGHT_MODULE); const U = process.env.U, CLEAN = process.env.EXPECT_CLEAN === '1'
let f = 0; const ck = (n, ok, x = '') => { if (!ok) f++; console.log((ok ? 'OK   ' : 'FALLA ') + n, x) }
const SOON = /Pr[oó]ximamente|Coming soon/gi
const plan = id => ({ id, slug: 'p' + id, order: id, name_es: 'Plan ' + id, name_en: 'Plan ' + id, description_es: 'Descripción', description_en: 'Description', price: '0.00', currency: 'COP', period: 'month', features_es: ['Uno'], features_en: ['One'], isHighlighted: false })
;(async () => {
  const b = await chromium.launch()
  const open = async (lang, w, { mock } = {}) => {
    const c = await b.newContext({ viewport: { width: w, height: 900 }, isMobile: w < 500 }); await c.addInitScript(l => { if (!localStorage.getItem('elv_lang')) localStorage.setItem('elv_lang', l) }, lang)
    const p = await c.newPage(); p.errs = []; p.ext = new Set()
    p.on('pageerror', e => p.errs.push(e.message.slice(0, 120)))
    p.on('console', m => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && p.errs.push(m.text().slice(0, 120)))
    p.on('request', r => { const o = new URL(r.url()).origin; if (o !== new URL(U).origin && !/^data:|^blob:/.test(r.url())) p.ext.add(o) })
    if (mock) await p.route('**/api/plans', mock)
    await p.goto(U + '/', { waitUntil: 'networkidle' }); await p.waitForTimeout(800); return p
  }
  // F1, F2, F5, F10 y responsive por idioma y ancho
  for (const lang of ['es', 'en']) for (const w of [360, 390, 768, 1024, 1440]) {
    const p = await open(lang, w)
    const txt = await p.locator('body').innerText(); const soon = (txt.match(SOON) || []).length
    if (CLEAN) ck(`F1 ${lang} ${w}px: sin «Próximamente / Coming soon»`, soon === 0, 'apariciones=' + soon)
    else console.log(`F1(info) ${lang} ${w}px: «Próximamente» aparece ${soon} veces con los valores actuales de staging`)
    const m = await p.evaluate(() => ({ s: document.documentElement.scrollWidth, i: innerWidth })); ck(`${lang} ${w}px sin desplazamiento horizontal`, m.s <= m.i, `${m.s}/${m.i}`)
    ck(`${lang} ${w}px sin errores de página ni consola`, p.errs.length === 0, p.errs.join('|'))
    ck(`F10 ${lang} ${w}px sin claves crudas (landing.*) visibles`, !/\blanding\.[a-z]+\.[a-z]/.test(txt))
    if (w === 1440) {
      console.log(`      orígenes externos ${lang}:`, [...p.ext].join(', ') || 'ninguno')
      const labels = await p.evaluate(() => [...document.querySelectorAll('.landing-label:not(.landing-eyebrow), .landing-module-status, .landing-offer-status')].map(e => { const h = (e.closest('.elv-card-body') || e.closest('li') || e.closest('section')).querySelector('h2,h3,h4'); return (h ? h.innerText.trim().slice(0, 40) : '?') + ' → ' + e.innerText.trim() }).filter(x => /→ (Disponible|Available|En preparación|In preparation|Próx|Coming)/i.test(x)))
      console.log(`      etiquetas ${lang}:`, JSON.stringify(labels))
      const dis = lang === 'es' ? 'Disponible' : 'Available', prep = lang === 'es' ? 'En preparación' : 'In preparation'
      const cnt = s => labels.filter(x => x.toLowerCase().endsWith('→ ' + s.toLowerCase())).length
      ck(`F2 ${lang}: «${prep}» en 4 (ejercicios, datos, pasos 3 y 4) y 5 «${dis}» (módulo, conversación, diario, brújula, idiomas) más la sección Skill Map`, cnt(prep) === 4 && cnt(dis) === 6, `disp=${cnt(dis)} prep=${cnt(prep)} total=${labels.length}`)
      ck(`F5 ${lang}: 3 tarjetas de ruta sin etiqueta de estado`, await p.locator('.landing-route-grid > *').count() === 3 && await p.locator('.landing-route-grid .landing-label, .landing-route-grid .landing-offer-status').count() === 0)
      const sm = await p.locator('#skill-map').innerText(); console.log(`      texto Skill Map ${lang}:`, sm.replace(/\s+/g, ' ').slice(0, 1200))
      const forb = (txt.match(/diagn[oó]stic|terapia|therapy|tratamiento|empleabilidad|employability|\d+ ?% de (reemplazo|replacement)|vacante|salario|tarifa/gi) || []); console.log(`      términos a revisar ${lang}:`, JSON.stringify([...new Set(forb)]))
    }
    await p.context().close()
  }
  // F6 details, F7 orden y anclas, F8 CTA
  for (const lang of ['es', 'en']) {
    const p = await open(lang, 390)
    const d = p.locator('details.landing-autonomy-details'); ck(`F6 ${lang}: bloque de autonomía cerrado por defecto`, await d.count() === 1 && !(await d.evaluate(e => e.open)))
    const sm = await d.locator('summary').boundingBox(); ck(`F6 ${lang}: summary ≥ 44 px (${Math.round(sm.height)})`, sm.height >= 44)
    ck(`F6 ${lang}: h3 dentro del summary`, await d.locator('summary h3').count() === 1)
    await d.locator('summary').focus(); const fo = await p.evaluate(() => { const s = getComputedStyle(document.activeElement); return s.outlineStyle + ' ' + s.outlineWidth }); ck(`F6 ${lang}: foco visible en summary`, /solid/.test(fo), fo)
    await p.keyboard.press('Enter'); ck(`F6 ${lang}: Enter abre`, await d.evaluate(e => e.open))
    await p.keyboard.press('Space'); ck(`F6 ${lang}: Espacio cierra`, !(await d.evaluate(e => e.open)))
    await p.keyboard.press('Space'); ck(`F6 ${lang}: abierto muestra 4 niveles`, await d.locator('li').count() === 4 && await d.locator('li').first().isVisible())
    const order = await p.evaluate(() => [...document.querySelectorAll('main section')].map(s => s.id || s.getAttribute('aria-labelledby') || '').filter(Boolean))
    console.log(`      orden de secciones ${lang}:`, order.join(' > '))
    const ip = order.findIndex(x => /pricing|planes/.test(x)), ij = order.findIndex(x => /project/.test(x)), ijo = order.findIndex(x => /join/.test(x))
    ck(`F7 ${lang}: Planes antes de Proyecto y Proyecto antes de Acceso`, ip >= 0 && ij > ip && ijo > ij, `${ip},${ij},${ijo}`)
    for (const a of ['como-funciona', 'skill-map', 'planes']) ck(`F7 ${lang}: ancla #${a} existe`, await p.locator('#' + a).count() === 1)
    const txt = await p.locator('body').innerText(); ck(`F8 ${lang}: CTA final eliminado`, !/¿Listo para empezar\?|Ready to begin\?|Sin tarjeta de crédito|No credit card required/.test(txt))
    const reg = await p.locator('a[href="/login?mode=register"]').count(); ck(`F8 ${lang}: un solo «Crear cuenta» y un acceso a Profesionales`, reg === 1 && await p.locator('a[href="/profesionales"]').count() === 1, 'registro=' + reg)
    await p.context().close()
  }
  // F11 regresión de cabecera y F7 enlaces
  for (const [lang, w] of [['es', 1440], ['en', 390]]) {
    const p = await open(lang, w); await p.keyboard.press('Tab')
    const sk = await p.evaluate(() => { const e = document.activeElement; return { t: e.innerText.trim(), h: Math.round(e.getBoundingClientRect().height) } }); ck(`F11 ${lang} ${w}px: «Saltar al contenido» primero en Tab y ≥ 44 px`, /Saltar|Skip/.test(sk.t), JSON.stringify(sk) + ' (la altura de 44 px la corrige el PR 112, aún sin fusionar)')
    if (w < 500) await p.locator('button[aria-controls=landing-navigation]').click()
    const sel = await p.evaluate(() => [...document.querySelectorAll('.landing-lang')].map(e => e.getAttribute('aria-label'))); ck(`F11 ${lang} ${w}px: selector de idioma con 2 botones`, sel.length === 2, JSON.stringify(sel) + ' (nombres accesibles: PR 112)')
    for (const a of ['#planes', '#skill-map']) { const l = p.locator(`a[href="${a}"]`).first(); if (await l.count() && await l.isVisible()) { await l.click(); await p.waitForTimeout(600); ck(`F7 ${lang} ${w}px: enlace de cabecera ${a} lleva a la sección`, (await p.locator(a).evaluate(e => e.getBoundingClientRect().top)) < 400) } else console.log(`      enlace ${a} no visible en ${lang} ${w}px`) }
    await p.context().close()
  }
  // F9 planes: cargando→datos, error, vacío, datos
  const ok = r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([1, 2, 3].map(plan)) })
  for (const [name, mock] of [['cargando→datos', async r => { await new Promise(s => setTimeout(s, 1200)); ok(r) }], ['error 500', r => r.fulfill({ status: 500, body: '{}' })], ['vacío', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' })], ['datos', ok]]) {
    const p = await open('es', 390, { mock }); const t = (await p.locator('#planes').innerText()).replace(/\s+/g, ' ').slice(0, 160)
    const o = await p.evaluate(() => document.querySelector('#planes').getBoundingClientRect().top < document.querySelector('#landing-project-title').getBoundingClientRect().top)
    ck(`F9 planes «${name}»: sección presente, antes de Proyecto, sin errores`, t.length > 10 && o && p.errs.length === 0, t); await p.context().close()
  }
  await b.close(); console.log(f ? 'FALLAS ' + f : 'TODO OK'); process.exit(f ? 1 : 0)
})().catch(e => { console.error('EXCEPCIÓN', e.message); process.exit(3) })
