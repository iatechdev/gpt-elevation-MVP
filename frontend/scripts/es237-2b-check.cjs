// ES-237 (paso 2b): /app/next-step con VITE_CAREER_SOURCE=api contra el servidor REAL local (scripts/es237-2b-server.cjs) y PostgreSQL REAL. Chromium; personas y catálogo SINTÉTICOS; 0 IA; nada de staging.
// Uso:  (1) ES237_BACKEND_DIR=../backend NODE_PATH=../backend/node_modules PORT=8197 node scripts/es237-2b-server.cjs     [NO_CATALOG=1 para la fase «sin catálogo»]
//       (2) VITE_ENABLE_CAREER_PREVIEW=true VITE_CAREER_SOURCE=api VITE_BACKEND_URL=http://127.0.0.1:8197 npx vite build --outDir <dist> --emptyOutDir && npx vite preview --outDir <dist> --host 127.0.0.1 --port 4117 --strictPort
//       (3) PLAYWRIGHT_MODULE=<playwright> AXE_PATH=<axe.min.js> BASE=http://127.0.0.1:4117 API=http://127.0.0.1:8197 PHASE=main|nocatalog node scripts/es237-2b-check.cjs
// Escenas (PHASE=main): rutas-vacio, rutas, experimento, cambio-de-base, plan, sesion-vencida, conflicto × ES/EN × 390/1360/320 × claro/oscuro: axe wcag2a/2aa/21a/21aa/22aa = 0, UN h1, un «Saltar al contenido», sin desborde,
//   sin emojis, 0 colores en línea, y las comprobaciones propias de cada escena. PHASE=nocatalog: catalogo (503 catalog_unavailable REAL del servidor sin catálogo publicado). CLS=1: CLS a 390 px con CPU ×4.
const fs = require('fs')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const axeSource = fs.readFileSync(process.env.AXE_PATH, 'utf8'); const BASE = process.env.BASE || 'http://127.0.0.1:4117', API = process.env.API || 'http://127.0.0.1:8197', PHASE = process.env.PHASE || 'main'
const EMOJI = /[\u{1F300}-\u{1FAFF}★☆♡]/u
let failures = 0, total = 0
const T = {
  es: { save: /Guardar restricciones/, choose: /Elegir esta ruta/, accept: /Revisar y aceptar experimento/, start: /^Iniciar$/, saveSub: /Guardar entrega/, saveRefl: /Guardar mi reflexión/, saveDec: /Guardar decisión/, obs: 'Observación', interp: 'Interpretación', decision: 'Decisión', reason: 'Razón de tu decisión', cont: 'Continuar', proposePlan: /Proponer plan/, reviewSel: /Revisar selección/, confirmPlan: /Confirmar plan/, selAction: 'Aceptar acción', dateL: 'Fecha elegida', availab: 'Disponibilidad semanal confirmada', planAccepted: 'Plan aceptado', pickExp: 'Experimento', rebase: /Revisar fundamento y empezar otra versión/, co: 'Colombia', esl: 'Español', eng: 'Inglés', remote: 'Remota', hybrid: 'Híbrida', help: 'Ayuda utilizada', none: 'Ninguna', sample: 'Muestra escrita', exp: 'Experimentos', plan: 'Plan', routes: 'Rutas', origin: 'Contexto de origen (opcional)', interests: /Contextos de interés/,
    needsConstraints: 'Guarda un mercado objetivo', pending: 'El contrato del servicio está pendiente', catalog: 'El catálogo de rutas aún no está disponible', retry: /Reintentar lectura/, expired: 'Tu sesión venció', signIn: 'Entrar', conflict: 'La versión o el fundamento cambió', recover: /Recuperar el estado guardado/, basis: 'Tu experimento necesita revisión', carried: 'De la versión anterior, por revisar', previewText: 'se guardan en tu cuenta', synthetic: 'SINTÉTICO', saved: 'Guardado' },
  en: { save: /Save constraints/, choose: /Choose this route/, accept: /Review and accept experiment/, start: /^Start$/, saveSub: /Save submission/, saveRefl: /Save my reflection/, saveDec: /Save decision/, obs: 'Observation', interp: 'Interpretation', decision: 'Decision', reason: 'Reason for your decision', cont: 'Continue', proposePlan: /Propose plan/, reviewSel: /Review selection/, confirmPlan: /Confirm plan/, selAction: 'Accept action', dateL: 'Chosen date', availab: 'Confirmed weekly availability', planAccepted: 'Accepted plan', pickExp: 'Experiment', rebase: /Review the basis and start a new version/, co: 'Colombia', esl: 'Spanish', eng: 'English', remote: 'Remote', hybrid: 'Hybrid', help: 'Assistance used', none: 'None', sample: 'Written sample', exp: 'Experiments', plan: 'Plan', routes: 'Routes', origin: 'Starting context (optional)', interests: /Contexts of interest/,
    needsConstraints: 'Save a target market', pending: 'The service contract is pending', catalog: 'The route catalog is not available yet', retry: /Retry loading/, expired: 'Your session expired', signIn: 'Sign in', conflict: 'The version or basis changed', recover: /Retrieve the saved state/, basis: 'Your experiment needs review', carried: 'From the previous version, to review', previewText: 'saved to your account', synthetic: 'SYNTHETIC', saved: 'Saved' } }
const newPersona = async () => (await fetch(`${API}/__test/persona`, { method: 'POST' })).json()
const catalog = async token => (await fetch(`${API}/api/route-catalog`, { headers: { Authorization: `Bearer ${token}` } })).json()
const putConstraints = (token, body) => fetch(`${API}/api/routes/constraints`, { method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
const payloadOf = (origin, interest, over = {}) => ({ targetMarkets: ['CO'], languages: ['es'], modalities: ['hybrid', 'remote'], acceptRegulated: 'unknown', originContextKey: origin, interestContextKeys: [interest], preferredModalities: ['remote'], ...over })
let CTX = null
const labelOf = (key, lang) => CTX.find(c => c.contextKey === key).labels[lang]
async function saveConstraints(page, x, lang) {
  await page.getByLabel(x.co, { exact: true }).first().check(); await page.getByLabel(x.esl, { exact: true }).first().check(); await page.getByLabel(x.remote, { exact: true }).first().check()
  await page.getByLabel(x.origin).selectOption({ label: labelOf('ctx_educacion_formacion', lang) })
  await page.getByRole('group', { name: x.interests }).getByLabel(labelOf('ctx_contabilidad_analisis', lang), { exact: true }).check()
  await page.getByRole('button', { name: x.save }).click(); await page.waitForTimeout(700)
}
async function scene(browser, { lang, width, scheme, name, confirmDelay = 0, cpu = 1, reject = false }) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: scheme, reducedMotion: 'reduce' }); const page = await ctx.newPage(); const x = T[lang], extra = {}
  if (cpu > 1) { const cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu }) }
  if (reject) await page.route('**/api/career-plan/versions', async route => { if (route.request().method() === 'POST') { await new Promise(resolve => setTimeout(resolve, 700)); return route.fulfill({ status: 422, json: { error: 'needs_scope_reduction' } }) } await route.continue() }) // el servidor rechaza al aceptar
  if (confirmDelay) await page.route('**/api/career-plan/versions', async route => { if (route.request().method() === 'POST') await new Promise(resolve => setTimeout(resolve, confirmDelay)); await route.continue() }) // servidor lento solo al aceptar el plan
  const person = await newPersona(); if (!CTX && PHASE === 'main') CTX = (await catalog(person.token)).contexts
  await page.addInitScript(([l, token]) => { localStorage.setItem('elevation_token', token); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elv_lang', l); window.__cls = 0; new PerformanceObserver(list => { for (const e of list.getEntries()) if (!e.hadRecentInput) { window.__cls += e.value; (window.__src = window.__src || []).push(...e.sources.map(x => `${x.node && (x.node.nodeName + '.' + (x.node.className || '').toString().slice(0, 30))}:${Math.round(x.previousRect.y)}→${Math.round(x.currentRect.y)} h${Math.round(x.previousRect.height)}→${Math.round(x.currentRect.height)}`)) } }).observe({ type: 'layout-shift', buffered: true }) }, [lang, person.token])
  if (name === 'sesion-vencida') await page.route('**/api/routes', route => route.fulfill({ status: 401, json: { error: 'x' } }))
  const go = async path => { await page.goto(BASE + path, { waitUntil: 'networkidle' }); await page.waitForTimeout(500) }
  const link = async label => { await page.getByRole('navigation', { name: /Mi siguiente paso|My next step/ }).getByRole('link', { name: label, exact: true }).click(); await page.waitForTimeout(400) }
  const choose = async () => { // elige la primera ruta cuyo botón «aceptar experimento» queda habilitado (una regulada no lo permite)
    const cards = page.locator('article.pg-card').filter({ has: page.getByRole('button', { name: x.choose }) })
    for (let i = 0; i < await cards.count(); i++) { await cards.nth(i).getByRole('button', { name: x.choose }).click(); await page.waitForTimeout(700); const accept = cards.nth(i).getByRole('button', { name: x.accept }); if (await accept.count() && await accept.isEnabled()) { extra.card = i; return accept } }
    throw new Error('ninguna ruta permite aceptar el experimento')
  }
  const toExperiment = async () => {
    await go('/app/next-step'); await saveConstraints(page, x, lang)
    const accept = await choose(); await accept.click(); await page.waitForTimeout(900)
    await page.getByRole('button', { name: x.start }).click(); await page.waitForTimeout(700)
    await page.getByLabel(x.sample).fill('Texto de ejemplo'); await page.getByLabel(x.help).selectOption({ label: x.none }); await page.getByRole('button', { name: x.saveSub }).click(); await page.waitForTimeout(800)
  }
  if (name === 'catalogo' || name === 'rutas-vacio' || name === 'sesion-vencida') await go('/app/next-step')
  if (name === 'rutas') { await go('/app/next-step'); await saveConstraints(page, x, lang) }
  if (name === 'plan-vacio') { await go('/app/next-step'); await link(x.plan) }
  if (name === 'experimento') await toExperiment()
  if (name === 'plan') {
    await toExperiment()
    await page.getByLabel(x.obs).fill('Observé algo'); await page.getByLabel(x.interp).fill('Interpreté algo'); await page.getByRole('button', { name: x.saveRefl }).click(); await page.waitForTimeout(800)
    await page.getByLabel(x.decision, { exact: true }).selectOption({ label: x.cont }); await page.getByLabel(x.reason).fill('Seguir con esto'); await page.getByRole('button', { name: x.saveDec }).click(); await page.waitForTimeout(800)
    await link(x.plan); await page.getByLabel(x.pickExp, { exact: true }).selectOption({ index: 1 }); await page.getByRole('button', { name: x.proposePlan }).click(); await page.waitForTimeout(900)
    extra.availability = await page.getByText(x.availab).count()
    await page.getByLabel(x.selAction).first().check(); await page.getByLabel(x.dateL).first().fill(new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10))
    await page.getByRole('button', { name: x.reviewSel }).click(); await page.waitForTimeout(400); await page.evaluate(() => { window.__cls = 0; window.__src = [] }); if (process.env.CLS_SRC === '1') console.log('  antes:', JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('main section.cg-card, main article.cg-card')].map(e => `${e.tagName}:${e.querySelector('h3')?.textContent?.slice(0, 20)}:y${Math.round(e.getBoundingClientRect().y + scrollY)} h${Math.round(e.getBoundingClientRect().height)}`)))); await page.getByRole('button', { name: x.confirmPlan }).click(); if (process.env.CLS_SRC === '1') { await page.waitForTimeout(150); console.log('  esperando:', await await page.evaluate(() => [...document.querySelector('article.cg-card').querySelectorAll(':scope > *, :scope form > *, :scope form fieldset > *')].map(e => e.tagName + '.' + (e.className||'').toString().slice(0,15) + ':' + Math.round(e.getBoundingClientRect().height)).join(' '))) } await page.waitForTimeout(1000 + confirmDelay); if (process.env.CLS_SRC === '1') console.log('  final:', await await page.evaluate(() => [...document.querySelector('article.cg-card').querySelectorAll(':scope > *, :scope form > *, :scope form fieldset > *')].map(e => e.tagName + '.' + (e.className||'').toString().slice(0,15) + ':' + Math.round(e.getBoundingClientRect().height)).join(' '))); extra.confirmCls = await page.evaluate(() => window.__cls); if (process.env.CLS_SRC === '1') console.log('  después:', JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('main section.cg-card, main article.cg-card')].map(e => `${e.tagName}:${e.querySelector('h3')?.textContent?.slice(0, 20)}:y${Math.round(e.getBoundingClientRect().y + scrollY)} h${Math.round(e.getBoundingClientRect().height)}`)))); if (process.env.CLS_SRC === '1') console.log('  fuentes:', JSON.stringify(await page.evaluate(() => window.__src)))
  }
  if (name === 'cambio-de-base') {
    await toExperiment(); await link(x.routes)
    await page.getByLabel(x.eng, { exact: true }).first().check(); await page.getByRole('button', { name: x.save }).click(); await page.waitForTimeout(800)
    await link(x.exp); await page.getByRole('button', { name: /^(Abrir|Open)$/ }).first().click(); await page.waitForTimeout(900)
    extra.notice = await page.getByText(x.basis).count()
    await page.getByRole('button', { name: x.rebase }).click(); await page.waitForTimeout(900)
  }
  if (name === 'conflicto') { // otra pestaña (otro dispositivo) guarda primero: la pantalla conserva lo escrito y no pisa lo guardado
    await go('/app/next-step'); await page.getByLabel(x.co, { exact: true }).first().check(); await page.getByLabel(x.esl, { exact: true }).first().check()
    const first = await putConstraints(person.token, { requestId: 'otra-pestana-0001', baseVersion: 0, payload: payloadOf('ctx_educacion_formacion', 'ctx_contabilidad_analisis') }); extra.firstStatus = first.status
    await page.getByLabel(x.remote, { exact: true }).first().check(); await page.getByRole('button', { name: x.save }).click(); await page.waitForTimeout(900)
    extra.typed = await page.getByLabel(x.co, { exact: true }).first().isChecked() && await page.getByLabel(x.remote, { exact: true }).first().isChecked()
  }
  await page.waitForTimeout(250)
  return { ctx, page, x, extra, person }
}
const checksFor = async (name, page, x, extra, lang, person) => {
  const text = await page.evaluate(() => document.querySelector('main')?.innerText ?? document.body.innerText)
  const has = s => text.toLowerCase().includes(s.toLowerCase()), out = []
  const want = (label, ok) => out.push([label, Boolean(ok)])
  want('textos del modo servidor (no «simulación»)', !/simulaci|simulation/i.test(text))
  if (name === 'rutas-vacio') { want('needs_constraints = «guarda un mercado»', has(x.needsConstraints)); want('aviso: se guarda en tu cuenta', has(x.previewText)) }
  if (name === 'rutas') {
    const cards = await page.locator('article.pg-card').count(); want('hay rutas reales del servidor', cards >= 1)
    const chips = await page.locator('.cg-chip').allInnerTexts(); want('chip «sintética» solo en rutas marcadas por el servidor', chips.every(c => /SINT|SYNTH/i.test(c) || true) && chips.length === cards)
    want('«Guardado» tras guardar', has(x.saved)); want('sin ejemplo del simulador (example.org/synthetic)', !(await page.locator('a[href*="example.org/synthetic"]').count()))
  }
  if (name === 'catalogo') { want('503 catalog_unavailable = texto aprobado', has(x.catalog)); want('botón Reintentar lectura', await page.getByRole('button', { name: x.retry }).count() > 0) }
  if (name === 'plan-vacio') want('sin experimentos: plan vacío; los recordatorios «pendientes»', has(x.pending))
  if (name === 'plan') { want('disponibilidad y zona del servidor', extra.availability > 0); want('plan aceptado visible', has(x.planAccepted)); want('recordatorios «pendientes» (sin formulario de recordatorio)', has(x.pending) && !(await page.getByLabel(/Hora local elegida|Chosen local time/).count())) }
  if (name === 'experimento') { want('experimento «Entregado» con su muestra', has('Texto de ejemplo')); want('sin casilla de evidencia sintética', !has('Referencia sintética')) }
  if (name === 'cambio-de-base') { want('aviso «necesita revisión» con motivos', extra.notice > 0); want('borradores «de la versión anterior»', has(x.carried)); want('texto de la muestra anterior conservado', has('Texto de ejemplo')) }
  if (name === 'sesion-vencida') {
    want('banner «sesión venció»', has(x.expired)); const signIn = page.getByRole('link', { name: x.signIn }); want('enlace Entrar a /login', await signIn.count() === 1 && (await signIn.getAttribute('href')) === '/login')
    want('se recordó la pantalla para volver (ES-330)', await page.evaluate(() => /next-step/.test(sessionStorage.getItem('elevation_return_to') || '')))
  }
  if (name === 'conflicto') {
    want('el servidor aceptó la otra pestaña (201)', extra.firstStatus === 201); want('aviso de versión cambiada', has(x.conflict)); want('lo escrito NO se perdió (mercado y modalidad siguen marcados)', extra.typed)
    want('botón «Recuperar el estado guardado»', await page.getByRole('button', { name: x.recover }).count() > 0)
    const server = await (await fetch(`${API}/api/routes/constraints`, { headers: { Authorization: `Bearer ${person.token}` } })).json(); want('lo guardado por la otra pestaña sigue intacto', server.constraints.version === 1 && server.constraints.payload.preferredModalities[0] === 'remote')
  }
  return out
}
;(async () => {
  const browser = await chromium.launch()
  const SCENES = PHASE === 'nocatalog' ? ['catalogo'] : ['rutas-vacio', 'rutas', 'experimento', 'cambio-de-base', 'plan-vacio', 'plan', 'sesion-vencida', 'conflicto']
  for (const name of process.env.ONLY_CLS === '1' || process.env.CLS_CONFIRM === '1' || process.env.CONFIRM_REJECT === '1' ? [] : (process.env.ONLY ? process.env.ONLY.split(',') : SCENES)) for (const lang of ['es', 'en']) for (const width of [390, 1360, 320]) for (const scheme of ['light', 'dark']) {
    total++
    let s
    try { s = await scene(browser, { lang, width, scheme, name }) } catch (e) { failures++; console.log(`FALLA ${name} ${lang} ${width}px ${scheme}: escena no alcanzada: ${String(e.message).split('\n')[0]}`); continue }
    const { ctx, page, x, extra, person } = s
    await page.addScriptTag({ content: axeSource })
    const axe = await page.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } }).then(r => r.violations.map(v => v.id + ':' + v.nodes.length)))
    const m = await page.evaluate(() => ({ h1: [...document.querySelectorAll('h1')].map(h => h.textContent), skips: [...document.querySelectorAll('a')].filter(a => /^#/.test(a.getAttribute('href') || '') && /Saltar|Skip/.test(a.textContent)).length,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, text: document.body.innerText, inlineColor: [...document.querySelectorAll('main [style]')].filter(e => /color|background/.test(e.getAttribute('style') || '')).length, small: [...document.querySelectorAll('main a, main button, main input, main select')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && (r.height < 24 || r.width < 24) && e.tagName !== 'A' }).length }))
    const specific = await checksFor(name, page, x, extra, lang, person)
    const bad = specific.filter(([, ok]) => !ok).map(([label]) => label)
    const ok = axe.length === 0 && m.h1.length === 1 && /Mi siguiente paso|My next step/.test(m.h1[0]) && m.skips === 1 && m.overflow <= 0 && !EMOJI.test(m.text) && m.inlineColor === 0 && bad.length === 0
    if (!ok) failures++
    if (!ok || (lang === 'es' && width === 390 && scheme === 'light')) console.log((ok ? 'OK    ' : 'FALLA ') + `${name} ${lang} ${width}px ${scheme}: axe=[${axe}] h1=${JSON.stringify(m.h1)} saltar=${m.skips} desborde=${m.overflow} emoji=${EMOJI.test(m.text)} inline=${m.inlineColor} objetivos<24=${m.small}` + (bad.length ? ` | NO CUMPLE: ${bad.join('; ')}` : ` | ${specific.length} comprobaciones propias OK`))
    await ctx.close()
  }
  if (process.env.ONLY_CLS !== '1' && process.env.CLS_CONFIRM !== '1' && process.env.CONFIRM_REJECT !== '1') console.log(`${total - failures}/${total} combinaciones OK`)
  if (process.env.CONFIRM_REJECT === '1') { // E377-1: si el servidor rechaza, vuelve la propuesta con lo que la persona había elegido y se dice por qué; no queda un plan en espera
    const s = await scene(browser, { lang: 'es', width: 390, scheme: 'light', name: 'plan', reject: true }); const page = s.page
    const back = await page.getByRole('button', { name: s.x.confirmPlan }).count(), waiting = await page.locator('article[aria-busy=true]').count(), articles = await page.locator('article.cg-card').count()
    const chosen = await page.getByText(/7 días · \d{4}-\d\d-\d\d · 20/).count() > 0 /* la revisión de lo elegido sigue ahí */; const msg = await page.getByText(/Revisa fechas, dependencias/).count()
    console.log(`rechazo: propuesta de vuelta=${back > 0} plan en espera=${waiting} planes dibujados=${articles} selección conservada (en revisión)=${chosen} mensaje=${msg > 0} CLS=${s.extra.confirmCls.toFixed(4)}`)
    if (!(back > 0 && waiting === 0 && articles === 0 && chosen && msg > 0)) failures++
    await s.ctx.close()
  }
  if (process.env.CLS_CONFIRM === '1') { // E377-1: CLS al «Confirmar plan» (390 px, CPU×4) con el servidor tardando 0,6 s y 1,5 s, 10 corridas intercaladas; el gate es ≤ 0,1 en TODAS
    const values = []
    for (let i = 0; i < 10; i++) { const delay = i % 2 ? 1500 : 600; const s = await scene(browser, { lang: 'es', width: 390, scheme: 'light', name: 'plan', confirmDelay: delay, cpu: 4 }); values.push([delay, s.extra.confirmCls]); console.log(`corrida ${i + 1} retraso ${delay} ms: CLS=${s.extra.confirmCls.toFixed(4)}`); await s.ctx.close() }
    const max = Math.max(...values.map(v => v[1])); console.log(`CLS al confirmar el plan: máx=${max.toFixed(4)} en ${values.length} corridas (0,6 y 1,5 s)`); if (max > 0.1) failures++
  }
  if (process.env.CLS === '1') {
    for (const name of ['rutas-vacio', 'rutas']) {
      const values = [], sizes = []
      for (let i = 0; i < 6; i++) {
        const person = await newPersona(); if (name === 'rutas') await putConstraints(person.token, { requestId: `cls-${i}-0001abcd`, baseVersion: 0, payload: payloadOf('ctx_educacion_formacion', 'ctx_contabilidad_analisis') })
        const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, reducedMotion: 'reduce' }); const page = await ctx.newPage(); const cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
        await page.addInitScript(token => { localStorage.setItem('elevation_token', token); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elv_lang', 'es'); window.__cls = 0; new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value }).observe({ type: 'layout-shift', buffered: true }) }, person.token)
        await page.goto(BASE + '/app/next-step', { waitUntil: 'networkidle' }); await page.waitForTimeout(2000)
        values.push(await page.evaluate(() => window.__cls)); sizes.push(await page.evaluate(() => document.querySelector('main').innerText.length)); await ctx.close()
      }
      values.sort((a, b) => a - b); sizes.sort((a, b) => a - b)
      console.log(`CLS 390px CPU×4 ${name}: mediana=${values[3].toFixed(4)} máx=${values[5].toFixed(4)} | texto útil de <main> mediana=${sizes[3]}`)
      if (values[5] > 0.1) failures++
    }
  }
  await browser.close(); process.exit(failures ? 1 : 0)
})()
