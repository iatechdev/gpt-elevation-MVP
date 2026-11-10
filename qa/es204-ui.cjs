// QA-Claude-2 — ES-256 (PR #204): consola de PRODUCCIÓN sin mensaje ni pila (onCaughtError seguro) y foco estable tras «Reintentar» con éxito. Plan E1–E7 (comentario 11476 de ES-256).
// Sin servidor ni IA. Los errores se provocan con una MUTACIÓN MÍA en mi clon (no en el PR): `window.__qaBoom` lanza dentro de SourcesPanel (bloque aislado por SectionBoundary) y
// `window.__qaBoomRoute` lanza al renderizar BridgePage (pantalla entera, RouteErrorBoundary), con un correo y un token ficticios en el mensaje.
// Builds en BUILDS: pr-mut (PR, producción), pr-default (PR con rootErrors revertido: React por defecto), pr-dev (PR, modo desarrollo), main-mut (main).
// Env: PLAYWRIGHT_MODULE, AXE, BUILDS, ONLY (E1,E2,E3,E4,E5,E6,E7).
const { chromium } = require(process.env.PLAYWRIGHT_MODULE); const fs = require('fs'), http = require('http'), path = require('path')
const AXE = fs.readFileSync(process.env.AXE, 'utf8'); const BUILDS = process.env.BUILDS; const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null; const want = k => !ONLY || ONLY.includes(k)
let f = 0, total = 0; const ck = (n, ok, x = '') => { total++; if (!ok) f++; console.log((ok ? 'OK   ' : 'FALLA ') + n, x) }; const info = (...a) => console.log('INFO', ...a); const sleep = ms => new Promise(r => setTimeout(r, ms))
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2', '.png': 'image/png' }
const servers = {}; const serve = dir => servers[dir] ||= new Promise(res => { const s = http.createServer((q, r) => { let p = path.join(dir, decodeURIComponent(q.url.split('?')[0])); if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(dir, 'index.html'); r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r) }); s.listen(0, '127.0.0.1', () => res({ s, port: s.address().port })) })
const T = { es: { section: /Algo salió mal en esta sección/, screen: /Algo salió mal en esta pantalla/, retry: 'Reintentar', offline: /Sin conexión/, version: /versión nueva/ }, en: { section: /Something went wrong in this section/, screen: /Something went wrong on this screen/, retry: 'Retry', offline: /No connection/, version: /new version/i } }
const LEAK = /personal@example|tok_QA|SECRET|boom-block|boom-route/; const STACK = /\n\s+at\s|\bat\s+\S+\s+\(|\.js:\d+(:\d+)?/
let B
const open = async (build, { lang = 'es', width = 1360, flags = {}, p = '/app/bridge', query = '' } = {}) => { const { port } = await serve(path.join(BUILDS, build)); const c = await B.newContext({ viewport: { width, height: 800 }, reducedMotion: 'reduce', isMobile: width < 500 }); const page = await c.newPage(); page.logs = []; page.errs = []
  page.on('console', m => page.logs.push({ type: m.type(), text: m.text() })); page.on('pageerror', e => page.errs.push(String(e.message).slice(0, 200)))
  await page.route('**/api/**', r => { const u = new URL(r.request().url()).pathname; if (u === '/api/session') return r.fulfill({ json: { role: 'user', onboardingCompleted: true } }); if (u === '/api/consents') return r.fulfill({ json: { consents: [] } }); if (u === '/api/career-context') return r.fulfill({ json: { active: null, versions: [] } }); return r.fulfill({ json: u.endsWith('/evidence') ? { evidence: [] } : {} }) })
  await page.addInitScript(([l, fl]) => { localStorage.setItem('elevation_token', 'synthetic-browser-token'); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elv_lang', l); Object.assign(window, fl) }, [lang, flags]); page.base = `http://127.0.0.1:${port}`
  await page.goto(page.base + p + query, { waitUntil: 'networkidle' }); await sleep(800); return { c, page } }
const body = async p => (await p.locator('body').innerText()).replace(/\s+/g, ' ')
const act = p => p.evaluate(() => { const e = document.activeElement; return { tag: e?.tagName || '', id: e?.id || '', text: (e?.textContent || '').trim().slice(0, 30), inBody: e === document.body } })
const axeRun = async p => { await p.evaluate(AXE); return p.evaluate(async () => (await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } })).violations.map(v => v.id + '×' + v.nodes.length + '[' + v.nodes.slice(0, 2).map(x => x.target.join(' ')).join(' | ').slice(0, 80) + ']')) }
const scan = async (build, kind, lang = 'es', width = 1360) => { const flags = kind === 'block' ? { __qaBoom: 'X' } : { __qaBoomRoute: true }; const { c, page } = await open(build, { lang, width, flags, query: '?email=juana@example.invalid&token=QUERYSECRET' }); const all = page.logs.concat(page.errs.map(e => ({ type: 'pageerror', text: e }))); const leaks = all.filter(l => LEAK.test(l.text) || STACK.test(l.text)); const own = page.logs.filter(l => l.text.startsWith('[boundary]')); const qleak = all.filter(l => /QUERYSECRET|juana@/.test(l.text)); const shown = await body(page); await c.close(); return { all, leaks, own, qleak, shown } }

;(async () => {
  B = await chromium.launch()
  // ============ E1 consola de producción (BLOQUEANTE) ============
  if (want('E1')) for (const kind of ['block', 'route']) { for (const lang of ['es', 'en']) { const t = T[lang]
    const r = await scan('pr-mut', kind, lang); ck(`E1 ${kind} ${lang}: PR en producción → ningún mensaje de consola (error/warn/log/info/debug) ni pageerror lleva el correo, el token, el texto del mensaje ni líneas de pila`, r.leaks.length === 0, r.leaks.map(l => l.type + ':' + l.text.slice(0, 100)).join(' || '))
    ck(`E1 ${kind} ${lang}: el aviso se ve (${kind === 'block' ? 'sección' : 'pantalla'}) y queda la línea propia «[boundary] <Nombre> <ruta> <componentes>» sin mensaje`, (kind === 'block' ? t.section : t.screen).test(r.shown) && r.own.length >= 1 && /^\[boundary\] Error \/app\/bridge( |$)/.test(r.own[0].text), JSON.stringify(r.own.map(l => l.text.slice(0, 120))))
    ck(`E1 ${kind} ${lang}: la ruta se registra SIN la query (?email=…&token=…)`, r.qleak.length === 0, r.qleak.map(l => l.text.slice(0, 100)).join(' || ')) }
    const d = await scan('pr-default', kind); ck(`E1 ${kind} CONTROL (PR con rootErrors revertido = React por defecto): la consola SÍ muestra el mensaje o la pila → la prueba muerde`, d.leaks.length > 0, d.leaks.length ? d.leaks[0].type + ':' + d.leaks[0].text.slice(0, 90) : 'sin fuga (la prueba NO muerde)')
    const m = await scan('main-mut', kind); ck(`E1 ${kind} CONTROL (main, misma mutación): la consola SÍ muestra el mensaje o la pila`, m.leaks.length > 0, m.leaks.length ? m.leaks[0].type + ':' + m.leaks[0].text.slice(0, 90) : 'sin fuga (la prueba NO muerde)') }
  // ============ E2 desarrollo ============
  if (want('E2')) for (const kind of ['block', 'route']) { const r = await scan('pr-dev', kind); info(`E2 ${kind}: el build con --mode development sigue siendo de producción para Vite (DEV=false) y no sirve para medir el modo desarrollo; se lee del código: rootErrors.ts usa {} (React por defecto) cuando import.meta.env.DEV es verdadero. Fugas medidas: ${r.leaks.length}`) }

  // ============ E3 foco tras Reintentar con éxito (BLOQUEANTE) ============
  if (want('E3')) for (const lang of ['es', 'en']) for (const width of [1360, 390]) { const t = T[lang], tg = `${lang}/${width}`
    for (const kind of ['block', 'route']) for (const how of ['ratón', 'teclado']) { const { c, page } = await open('pr-mut', { lang, width, flags: kind === 'block' ? { __qaBoom: 'X' } : { __qaBoomRoute: true } }); await page.evaluate(() => { window.__qaBoom = false; window.__qaBoomRoute = false })
      const btn = page.getByRole('button', { name: t.retry, exact: true }); if (how === 'ratón') await btn.click(); else { await btn.focus(); await page.keyboard.press('Enter') }
      await sleep(1500); let a = await act(page); const h1 = await page.locator('h1').first().evaluate(e => e === document.activeElement).catch(() => false)
      const expected = kind === 'route' ? h1 : (!a.inBody && a.tag !== 'BODY')
      ck(`E3 ${tg} ${kind} ${how}: tras «${t.retry}» con éxito el foco NO cae a body (${kind === 'route' ? 'en el título h1' : 'en un elemento del bloque'})`, expected && !a.inBody, JSON.stringify(a))
      await sleep(900); const a2 = await act(page); ck(`E3 ${tg} ${kind} ${how}: el foco se mantiene 1 s después (re-montaje)`, !a2.inBody, JSON.stringify(a2)); await c.close() }
    { // pantalla con retraso de red de los chunks (1,5 s) durante el reintento
      const { c, page } = await open('pr-mut', { lang, width, flags: { __qaBoomRoute: true } }); await page.evaluate(() => { window.__qaBoomRoute = false }); await page.route('**/assets/*.js', async r => { await sleep(1500); await r.continue() }); await page.getByRole('button', { name: t.retry, exact: true }).click(); await sleep(4500); const a = await act(page)
      ck(`E3 ${tg} pantalla con red lenta (1,5 s por archivo): el foco termina en el título, no en body`, !a.inBody, JSON.stringify(a)); await c.close() } }

  // ============ E4 casos donde NO debe moverse el foco ============
  if (want('E4')) for (const lang of ['es']) { const t = T[lang]
    { const { c, page } = await open('pr-mut', { lang, flags: { __qaBoom: 'X' } }); await page.getByRole('button', { name: t.retry, exact: true }).click(); await sleep(1200); const al = await page.getByRole('alert').count(); const a = await act(page)
      ck(`E4 ${lang}: si el bloque vuelve a fallar tras «${t.retry}», sigue habiendo un solo aviso (role=alert) y el aviso reaparece con su botón`, al === 1 && await page.getByRole('button', { name: t.retry, exact: true }).count() === 1, `alertas=${al} foco=${JSON.stringify(a)}`)
      info(`E4 ${lang}: foco tras un reintento que vuelve a fallar: ${JSON.stringify(a)}`); await c.close() }
    { const { c, page } = await open('pr-mut', { lang, flags: { __qaBoomRoute: true } }); await page.evaluate(() => { window.__qaBoomRoute = false; history.pushState({}, '', '/app/dashboard'); window.dispatchEvent(new PopStateEvent('popstate')) }); await sleep(2000); const a = await act(page)
      info(`E4 ${lang}: cambio de ruta que limpia el aviso de pantalla (sin pulsar «${t.retry}») → foco ${JSON.stringify(a)} (no debe saltar al título por el reintento)`); ck(`E4 ${lang}: el cambio de ruta no usa el foco de «${t.retry}» (el foco no fue forzado a h1 de la pantalla anterior)`, !(a.tag === 'H1' && /bridge|puente/i.test(await page.url())), JSON.stringify(a)); await c.close() } }

  // ============ E5 sin red ============
  if (want('E5')) for (const lang of ['es', 'en']) { const t = T[lang]
    const { port } = await serve(path.join(BUILDS, 'pr-mut')); const c = await B.newContext({ viewport: { width: 1360, height: 800 }, reducedMotion: 'reduce' }); const page = await c.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message.slice(0, 100)))
    await page.route('**/api/**', r => { const u = new URL(r.request().url()).pathname; return r.fulfill({ json: u === '/api/session' ? { role: 'user', onboardingCompleted: true } : u === '/api/consents' ? { consents: [] } : {} }) })
    await page.addInitScript(l => { localStorage.setItem('elevation_token', 'synthetic-browser-token'); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elv_lang', l) }, lang)
    await page.goto(`http://127.0.0.1:${port}/app/dashboard`, { waitUntil: 'networkidle' }); await sleep(600); await c.setOffline(true); await page.evaluate(() => { history.pushState({}, '', '/app/skill-map'); window.dispatchEvent(new PopStateEvent('popstate')) }); await sleep(2500)
    const b1 = await body(page); ck(`E5 ${lang}: sin conexión → «${t.offline.source}» (y no «versión nueva»)`, t.offline.test(b1) && !t.version.test(b1), b1.slice(0, 120))
    const reload = page.getByRole('button', { name: /^(Recargar|Reload)$/ }); ck(`E5 ${lang}: el aviso sin conexión ofrece «Recargar/Reload» y no hay errores de página`, await reload.count() === 1 && errs.length === 0, errs.join('|'))
    await c.setOffline(false); await reload.click(); await sleep(4000); ck(`E5 ${lang}: con red, «Recargar» recupera la pantalla (hay título y ya no dice sin conexión)`, !t.offline.test(await body(page)) && await page.locator('h1').count() >= 1, (await body(page)).slice(0, 100)); await c.close() }

  // ============ E6 A/B contra main (mismo comportamiento visible) ============
  if (want('E6')) for (const kind of ['block', 'route']) { const norm = async build => { const { c, page } = await open(build, { flags: kind === 'block' ? { __qaBoom: 'X' } : { __qaBoomRoute: true } }); const o = { alerts: await page.getByRole('alert').count(), retry: await page.getByRole('button', { name: 'Reintentar', exact: true }).count(), h1: await page.locator('h1').count(), text: (await body(page)).replace(/\s+/g, ' ').slice(0, 400) }; await c.close(); return o }
    const a = await norm('pr-mut'), b = await norm('main-mut'); ck(`E6 ${kind}: lo visible (avisos, botón, título, texto) es IDÉNTICO entre el PR y main`, JSON.stringify(a) === JSON.stringify(b), JSON.stringify(a).slice(0, 160)); ck(`E6 ${kind}: ${kind === 'block' ? 'el resto de la pantalla sigue viva (título presente), un solo aviso' : 'un solo aviso de pantalla'}`, a.alerts === 1 && a.retry === 1 && (kind === 'block' ? a.h1 >= 1 : true), JSON.stringify(a).slice(0, 120)) }

  // ============ E7 accesibilidad ============
  if (want('E7')) for (const lang of ['es', 'en']) for (const width of [1360, 390]) { const tg = `${lang}/${width}`; const t = T[lang]
    for (const kind of ['block', 'route']) { const { c, page } = await open('pr-mut', { lang, width, flags: kind === 'block' ? { __qaBoom: 'X' } : { __qaBoomRoute: true } }); const ax = await axeRun(page); ck(`E7 ${tg} ${kind}: axe del aviso = 0`, ax.length === 0, ax.join(' ')); ck(`E7 ${tg} ${kind}: aviso sin desborde horizontal`, (await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)) <= 0, '')
      await page.evaluate(() => { window.__qaBoom = false; window.__qaBoomRoute = false }); await page.getByRole('button', { name: t.retry, exact: true }).click(); await sleep(1500); const ax2 = await axeRun(page); ck(`E7 ${tg} ${kind}: axe tras recuperar = 0`, ax2.length === 0, ax2.join(' ')); await c.close() } }

  await B.close(); for (const k of Object.keys(servers)) (await servers[k]).s.close(); console.log(f ? `\nFALLAS ${f} de ${total}` : `\nTODO OK (${total}/${total})`); process.exit(f ? 1 : 0)
})().catch(e => { console.error('EXCEPCIÓN', e.stack?.slice(0, 900)); process.exit(3) })
