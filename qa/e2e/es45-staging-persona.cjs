// [QA-Claude] ES-45 · repaso en STAGING de los flujos de persona, SOLO LECTURA, con las 2 cuentas sintéticas @example.invalid ya existentes (autorizado por Mauricio en el chat de QA el 20-nov: «cuentas existentes»;
// sin crear cuentas nuevas, sin borrar nada, sin cambiar datos). Solo https://backend-staging-e3a6.up.railway.app. Las contraseñas viven en el archivo local STG_SECRETS (fuera del repo) y NUNCA se imprimen.
//   STG_SECRETS=<archivo> OUT=<carpeta> node qa/e2e/es45-staging-persona.cjs
process.env.PLAYWRIGHT_BROWSERS_PATH = process.env.PLAYWRIGHT_BROWSERS_PATH || 'C:/Users/Usuario/tools/pw-browsers'
const E = process.env; const { chromium } = require('C:/Users/Usuario/tools/playwright/node_modules/playwright'); const fs = require('fs'), path = require('path')
const STG = 'https://backend-staging-e3a6.up.railway.app'; const OUT = E.OUT || '.'; const AXE = fs.readFileSync('C:/Users/Usuario/Documents/Central/node_modules/axe-core/axe.min.js', 'utf8')
const secrets = JSON.parse(fs.readFileSync(E.STG_SECRETS, 'utf8')); const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const rows = []; const log = (o) => { rows.push(o); console.log(JSON.stringify(o).slice(0, 700)) }
const axeRun = async (p) => { await p.evaluate(AXE); return p.evaluate(async () => (await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } })).violations.map((v) => v.id + ':' + v.nodes.length)) }
;(async () => {
  const health = await (await fetch(STG + '/api/health')).json(); log({ id: 'staging', health })
  const lr = await fetch(STG + '/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: secrets.a.email, password: secrets.a.password }) }); const lj = await lr.json().catch(() => ({}))
  log({ id: 'login cuenta sintética a', status: lr.status, claves: Object.keys(lj), rol: lj.role, idioma: lj.language, consentimientos: lj.termsAccepted ?? lj.consents ?? null }); if (!lj.token) { console.log('SIN TOKEN: no sigo'); process.exit(1) }
  const BR = await chromium.launch(); let n = 0
  const visit = async (lang, w, url, auth) => {
    const ctx = await BR.newContext({ viewport: { width: w, height: 900 }, reducedMotion: 'reduce' }); await ctx.addInitScript(([t, l, a]) => { if (a) localStorage.setItem('elevation_token', t); localStorage.setItem('elv_lang', l) }, [lj.token, lang, auth])
    const p = await ctx.newPage(); const errs = [], bad = []; p.on('pageerror', (e) => errs.push(e.message.slice(0, 160))); p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text().slice(0, 160)) })
    p.on('response', (r) => { const u = new URL(r.url()); if (u.origin === STG && r.status() >= 400 && u.pathname.startsWith('/api')) bad.push(r.request().method() + ' ' + u.pathname + ' ' + r.status()) })
    let status = null; try { const r = await p.goto(STG + url, { waitUntil: 'domcontentloaded', timeout: 30000 }); status = r && r.status() } catch (e) { status = 'ERR ' + e.message.slice(0, 80) }
    await p.waitForSelector('h1, h2, main', { timeout: 15000 }).catch(() => {}); await sleep(1800)
    const text = (await p.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' '); const finalUrl = p.url().replace(STG, '')
    const ax = await axeRun(p).catch((e) => ['axe-fallo:' + e.message.slice(0, 40)]); const hscroll = await p.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)
    const links = auth && url === '/app' ? await p.$$eval('a[href]', (as) => [...new Set(as.map((a) => a.getAttribute('href')))].slice(0, 60)) : []
    const file = `es45-${String(++n).padStart(2, '0')}-${lang}-${w}-${url.replace(/[^a-z0-9]+/gi, '_')}.png`; await p.screenshot({ path: path.join(OUT, file), fullPage: false })
    log({ id: `${lang} ${w}px ${url}`, auth, status, finalUrl, axe: ax, scrollHorizontal: hscroll, erroresConsola: errs.slice(0, 3), apiMalas: bad.slice(0, 4), texto: text.slice(0, 300), links, captura: file }); await ctx.close()
  }
  // 1) públicas sin sesión
  if (E.URLS) { // segunda pasada: rutas reales de la app (solo GET de pantallas, sin pulsar nada)
    const urls = E.URLS.split(','); for (const lang of ['es', 'en']) for (const url of urls) await visit(lang, 1280, url, !/^\/(terminos|privacidad|manifiesto)/.test(url))
    for (const url of urls.slice(0, 6)) await visit('es', 390, url, true)
  } else {
  for (const lang of ['es', 'en']) for (const url of ['/', '/login', '/login?mode=register', '/terms', '/privacy']) await visit(lang, 1280, url, false)
  // 2) con sesión: raíz de la app y los enlaces que aparezcan
  await visit('es', 1280, '/app', true)
  const first = rows.find((r) => r.id === 'es 1280px /app'); const nav = (first && first.links || []).filter((h) => h && h.startsWith('/') && !/logout|salir/i.test(h))
  log({ id: 'enlaces de la app', nav })
  const urls = [...new Set(['/app', ...nav, '/app/privacy', '/app/profile', '/app/settings', '/app/account', '/app/feedback'])]
  for (const lang of ['es', 'en']) for (const url of urls) await visit(lang, 1280, url, true)
  for (const url of ['/app', '/app/privacy', '/app/profile']) await visit('es', 390, url, true)
  }
  await BR.close(); fs.writeFileSync(path.join(OUT, 'es45-persona.json'), JSON.stringify(rows, null, 1))
  const malas = rows.filter((r) => (r.apiMalas && r.apiMalas.length) || (r.erroresConsola && r.erroresConsola.length) || (r.axe && r.axe.length) || r.scrollHorizontal); console.log('RESUMEN páginas ' + rows.filter((r) => r.captura).length + ' con algo que revisar: ' + malas.length)
  for (const m of malas) console.log('REVISAR ' + m.id + ' axe=' + JSON.stringify(m.axe) + ' consola=' + JSON.stringify(m.erroresConsola) + ' api=' + JSON.stringify(m.apiMalas) + ' hscroll=' + m.scrollHorizontal)
})().catch((e) => { console.error('ERROR', e.message); process.exit(1) })
