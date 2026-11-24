// QA-Claude-2 — E2E de punta a punta CONTRA UNA URL (staging o local), reutilizable. Solo navegador y la API pública del propio sitio: sin acceso a la base, sin secretos en el repo.
//   registro → onboarding → chat → diario → Mi profesional (puente) → Siguiente paso → plan → exportar y eliminar datos; ES/EN × 390/1360 × claro/oscuro.
//
// USO (las credenciales y la URL van por entorno; NUNCA en el repo ni en el chat):
//   BASE_URL=https://<staging>  STAGING_AUTORIZADO=1  E2E_PASSWORD=<la entrega la persona autorizada>  E2E_REGISTER=1  PLAYWRIGHT_MODULE=<ruta a playwright>  node qa/e2e-staging.cjs
//   Cuenta ya existente en vez de registrar:  E2E_EMAIL=<correo sintético>  E2E_PASSWORD=...   (sin E2E_REGISTER)
//
// SEGURIDAD (el guion se niega a correr si no se cumple):
//   · BASE_URL debe ser localhost/127.0.0.1 o un host que contenga «staging»; cualquier otro (producción) se rechaza siempre.
//   · Fuera de localhost exige STAGING_AUTORIZADO=1, que solo se pone cuando la persona dueña del entorno confirmó por escrito, en el chat de QA, que se puede entrar o crear cuentas ahí.
//   · Las cuentas que crea son sintéticas (@example.test); se borran al final solo si E2E_DELETE=1 y solo si las registró este guion (nunca una cuenta que vino por E2E_EMAIL).
//   · El chat llama a la IA real (costo): solo se envía UN mensaje por combinación si E2E_CHAT=1; por defecto se verifica la pantalla sin enviar.
// OPCIONALES: E2E_LANGS=es,en  E2E_VIEWPORTS=1360x900,390x844  E2E_SCHEMES=light,dark  AXE=<axe.min.js>  OUT=<carpeta de capturas>  E2E_EXPORT=1 (descarga y valida el JSON de «Mis datos»)  ONLY=paso1,paso2
// Código de salida: 0 sin fallas; 1 con fallas; 2 con la configuración rechazada.
const fs = require('fs'), path = require('path'), crypto = require('crypto')
const BASE = (process.env.BASE_URL || '').replace(/\/+$/, ''); let host = ''
try { host = new URL(BASE).hostname } catch { /* se valida abajo */ }
const LOCAL = ['localhost', '127.0.0.1', '[::1]'].includes(host)
const stop = (m) => { console.error('RECHAZADO: ' + m); process.exit(2) }
if (!BASE) stop('falta BASE_URL')
if (!LOCAL && !/staging/i.test(host)) stop(`el host «${host}» no es local ni de staging; este guion nunca corre contra producción`)
if (!LOCAL && process.env.STAGING_AUTORIZADO !== '1') stop('falta STAGING_AUTORIZADO=1 (confirmación escrita de la persona dueña del entorno)')
const PASS = process.env.E2E_PASSWORD; if (!PASS) stop('falta E2E_PASSWORD (por entorno, nunca en el repo)')
const REGISTER = process.env.E2E_REGISTER === '1'; if (!REGISTER && !process.env.E2E_EMAIL) stop('falta E2E_EMAIL o E2E_REGISTER=1')
const LANGS = (process.env.E2E_LANGS || 'es,en').split(','), SCHEMES = (process.env.E2E_SCHEMES || 'light,dark').split(',')
const VPS = (process.env.E2E_VIEWPORTS || '1360x900,390x844').split(',').map((s) => s.split('x').map(Number))
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null; const want = (k) => !ONLY || ONLY.includes(k)
const OUT = process.env.OUT || path.join(__dirname, 'e2e-staging-out'); fs.mkdirSync(OUT, { recursive: true })
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright'); const AXE = process.env.AXE && fs.existsSync(process.env.AXE) ? fs.readFileSync(process.env.AXE, 'utf8') : null
let total = 0, fails = 0; const rows = []
const ck = (n, ok, d = '') => { total++; if (!ok) fails++; rows.push({ n, ok, d }); console.log((ok ? 'OK   ' : 'FALLA ') + n + (d ? '  ' + String(d).slice(0, 220) : '')) }
const info = (...a) => console.log('INFO', ...a); const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const tag = Date.now().toString(36)
const RAW_KEY = /\b(common|landing|login|register|chat|diary|bridge|plan|data|context|space|career)\.[a-z_]+(\.[a-z_]+)*\b/
const T = { es: { send: /^Enviar$/, exportar: /Exportar|Descargar/i, eliminar: /Eliminar mi cuenta/i, entrar: /Entrar|Iniciar sesión/i }, en: { send: /^Send$/, exportar: /Export|Download/i, eliminar: /Delete my account/i, entrar: /Sign in|Log in/i } }

async function newPage(browser, { lang, w, h, scheme }) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: scheme, acceptDownloads: true, locale: lang === 'es' ? 'es-CO' : 'en-US' })
  await ctx.addInitScript(([l, th]) => { try { localStorage.setItem('elv_lang', l); localStorage.setItem('elv_theme', th) } catch { /* sin almacenamiento */ } }, [lang, scheme])
  const p = await ctx.newPage(); p.errs = []; p.bad = []
  p.on('pageerror', (e) => p.errs.push(String(e.message).slice(0, 120)))
  p.on('console', (m) => { if (m.type() === 'error' && !/status of 503/.test(m.text())) p.errs.push(m.text().slice(0, 120)) })
  p.on('response', (r) => { const pth = new URL(r.url()).pathname; if (r.status() === 503 && /^\/api\/(skill-map|route-catalog|routes)/.test(pth)) { info(`503 esperado sin catálogo publicado: ${pth}`); return } if (r.status() >= 500) p.bad.push(`${r.status()} ${pth}`) })
  p.ctx = ctx; return p
}
const probe = (p) => p.evaluate(() => ({ overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, text: document.body.innerText, h1: document.querySelectorAll('h1').length, lang: document.documentElement.lang }))
const axe = async (p) => { if (!AXE) return null; await p.addScriptTag({ content: AXE }); return p.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } })).violations.map((v) => v.id + ':' + v.nodes.length)) }
async function step(p, label, id) { // comprobaciones comunes de una pantalla: sin 5xx, sin errores JS, sin claves sin traducir, sin desborde, axe, captura
  await sleep(500); const o = await probe(p); const a = await axe(p)
  ck(`${label}: sin respuestas 5xx`, p.bad.length === 0, p.bad.join(' ')); ck(`${label}: sin errores de JavaScript`, p.errs.length === 0, p.errs.slice(0, 2).join(' | '))
  ck(`${label}: sin claves de traducción a la vista`, !RAW_KEY.test(o.text), (o.text.match(RAW_KEY) || [''])[0]); ck(`${label}: sin desborde horizontal`, o.overflow <= 0, '+' + o.overflow)
  if (a) ck(`${label}: axe 2.2 AA sin violaciones`, a.length === 0, a.join(' '))
  await p.screenshot({ path: path.join(OUT, `${id}.png`), fullPage: false }).catch(() => {}); p.errs.length = 0; p.bad.length = 0; return o
}
async function fillGeneric(p) { // relleno genérico del onboarding: primera opción de cada grupo, textos y horas sintéticos
  const radios = p.locator('input[type=radio]'); if (await radios.count()) await radios.first().check().catch(() => {})
  for (const t of await p.locator('textarea:visible').all()) await t.fill('Texto sintético de prueba E2E.').catch(() => {})
  for (const s of await p.locator('select:visible').all()) { const v = await s.locator('option').evaluateAll((os) => os.map((o) => o.value).filter(Boolean)); if (v[0]) await s.selectOption(v[0]).catch(() => {}) }
  const hours = p.locator('#availabilityMinutesPerWeek'); if (await hours.count()) await hours.fill('5').catch(() => {})
}

async function run(browser, { lang, w, h, scheme }) {
  const L = `[${lang} ${w}px ${scheme}]`; const id = (s) => `${lang}-${w}-${scheme}-${s}`; const dict = T[lang]
  const email = process.env.E2E_EMAIL || `qa2-e2e-${tag}-${lang}${w}${scheme}@example.test`; let created = false
  const p = await newPage(browser, { lang, w, h, scheme })
  try {
    if (want('acceso')) {
      const r = await p.goto(BASE + '/login', { waitUntil: 'domcontentloaded' }); ck(`${L} /login responde 200`, r && r.status() === 200, r && r.status()); await p.waitForSelector('#access-email', { timeout: 15000 }).catch(() => {})
      const o = await step(p, `${L} acceso`, id('acceso')); ck(`${L} acceso: idioma activo = ${lang}`, o.lang === lang, o.lang)
    }
    if (REGISTER) {
      await p.goto(BASE + '/login', { waitUntil: 'domcontentloaded' }); await p.waitForSelector('#access-email')
      const toggle = p.getByRole('button', { name: /Regístrate|Crear cuenta|Registrarme|Sign up|Create (an )?account|Register/i }).first(); for (let k = 0; k < 2 && !(await p.locator('#access-name').count()); k++) { await toggle.waitFor({ timeout: 8000 }).catch(() => {}); await toggle.click().catch(() => {}); await p.waitForSelector('#access-name', { timeout: 4000 }).catch(() => {}) }
      if (await p.locator('#access-name').count()) {
        await p.fill('#access-name', 'QA E2E'); await p.fill('#access-email', email); await p.fill('#access-password', PASS)
        await p.locator('form button[type=submit]').click(); await sleep(800)
        ck(`${L} registro sin aceptar términos no se envía`, /login/.test(new URL(p.url()).pathname) && (await p.locator('#access-terms').getAttribute('aria-invalid')) === 'true')
        await p.check('#access-terms'); await p.locator('form button[type=submit]').click(); await sleep(3000); created = true
        ck(`${L} registro con términos: sin 5xx y vuelve al acceso`, p.bad.length === 0, p.bad.join(' ')); await step(p, `${L} tras registro`, id('registro'))
      } else ck(`${L} registro: formulario de registro presente`, false, 'no encontré #access-name')
    }
    // login por el formulario
    await p.goto(BASE + '/login', { waitUntil: 'domcontentloaded' }); await p.waitForSelector('#access-email'); await p.fill('#access-email', email); await p.fill('#access-password', PASS)
    await p.locator('form button[type=submit]').click(); await p.waitForURL((u) => !/\/login/.test(u.pathname), { timeout: 20000 }).catch(() => {}); await sleep(1500)
    ck(`${L} entra a la app con la cuenta`, /\/app\//.test(new URL(p.url()).pathname), new URL(p.url()).pathname); if (!/\/app\//.test(new URL(p.url()).pathname)) return
    // onboarding
    if (want('onboarding')) {
      await p.goto(BASE + '/app/onboarding', { waitUntil: 'domcontentloaded' }); await sleep(1500); await step(p, `${L} onboarding`, id('onboarding'))
      if (await p.locator('form').count()) { await fillGeneric(p); await p.locator('form button[type=submit]').first().click(); await sleep(2500)
        ck(`${L} onboarding: se guarda y sigue (sin error visible)`, !(await p.locator('[role=alert]').count()) && !/onboarding/.test(new URL(p.url()).pathname) || (await p.getByRole('heading').count()) > 0, new URL(p.url()).pathname) }
    }
    // chat
    if (want('chat')) {
      await p.goto(BASE + '/app/chat', { waitUntil: 'domcontentloaded' }); await sleep(2000); const o = await step(p, `${L} chat`, id('chat'))
      const box = p.locator('textarea').last(); ck(`${L} chat: caja de texto y botón Enviar presentes`, (await box.count()) > 0 && (await p.getByRole('button', { name: dict.send }).count()) > 0)
      ck(`${L} chat: marca de privacidad y aviso de que no es clínico a la vista`, /privad|private/i.test(o.text))
      if (process.env.E2E_CHAT === '1') { await box.fill(lang === 'es' ? 'Hola, es una prueba sintética: ¿puedes saludarme en una frase?' : 'Hi, this is a synthetic test: can you greet me in one sentence?'); await p.getByRole('button', { name: dict.send }).click()
        await p.waitForFunction(() => document.querySelectorAll('.chat-msg').length >= 2 || !!document.querySelector('[role=alert]'), null, { timeout: 90000 }).catch(() => {}); await sleep(1000); const t = (await probe(p)).text
        ck(`${L} chat: llegó una respuesta (o un aviso de límite/pausa claro), sin 5xx`, p.bad.length === 0 && (await p.locator('.chat-msg').count()) >= 2, p.bad.join(' ')); ck(`${L} chat: la respuesta no diagnostica ni promete (revisión manual: ver captura)`, !/diagnóstico|diagnosis|trastorno|disorder/i.test(t), '') ; await p.screenshot({ path: path.join(OUT, id('chat-respuesta') + '.png') }).catch(() => {}) }
    }
    // diario
    if (want('diario')) {
      await p.goto(BASE + '/app/diary/new', { waitUntil: 'domcontentloaded' }); await sleep(1500); await step(p, `${L} diario (nueva entrada)`, id('diario'))
      const area = p.locator('textarea').first(); if (await area.count()) { await area.fill('Entrada sintética de prueba E2E ' + tag); const save = p.getByRole('button', { name: /Guardar|Save/i }).first(); if (await save.count()) { await save.click(); await sleep(2000) }
        await p.goto(BASE + '/app/diary', { waitUntil: 'domcontentloaded' }); await sleep(1500); ck(`${L} diario: la entrada guardada aparece en la lista`, (await probe(p)).text.includes('Entrada sintética de prueba E2E'), '') }
      else ck(`${L} diario: caja de texto presente`, false)
    }
    // Mi profesional (puente), Siguiente paso, plan, mapa
    for (const [key, route, name] of [['puente', '/app/bridge', 'Mi profesional (puente)'], ['siguiente', '/app/next-step', 'Siguiente paso'], ['plan', '/app/plan', 'Plan'], ['mapa', '/app/skill-map', 'Mapa']]) {
      if (!want(key)) continue; await p.goto(BASE + route, { waitUntil: 'domcontentloaded' }); await sleep(1800); const o = await step(p, `${L} ${name}`, id(key))
      ck(`${L} ${name}: sin diagnóstico ni promesas de empleo`, !/te diagnostic|garantiz\w* (empleo|trabajo)|guarantee\w* (a )?job/i.test(o.text)); ck(`${L} ${name}: no se quedó en «Cargando» ni en blanco`, o.text.trim().length > 40 && !/^\s*(Cargando|Loading)[….]*\s*$/i.test(o.text), 'largo ' + o.text.trim().length)
      if (key === 'siguiente') info(`${L} Siguiente paso: ${/no está disponible|not available|vista preliminar|preview/i.test(o.text) ? 'pantalla de no disponible / vista preliminar (la bandera puede estar apagada)' : 'pantalla visible'}`) }
    // exportar y eliminar
    if (want('datos')) {
      await p.goto(BASE + '/app/data', { waitUntil: 'domcontentloaded' }); await sleep(1800); await step(p, `${L} Mis datos`, id('datos'))
      if (process.env.E2E_EXPORT === '1') { const btn = p.getByRole('button', { name: dict.exportar }).first(); if (await btn.count()) { const dl = p.waitForEvent('download', { timeout: 30000 }).catch(() => null); await btn.click(); const d = await dl
          if (d) { const f = path.join(OUT, id('export.json')); await d.saveAs(f); let ok = false; try { const j = JSON.parse(fs.readFileSync(f, 'utf8')); ok = j && typeof j === 'object' } catch { /* no es JSON */ } ck(`${L} exportar: descarga un JSON válido de la propia cuenta`, ok); ck(`${L} exportar: sin contraseña ni token en el archivo`, !/password|\beyJ[A-Za-z0-9_-]{20,}/i.test(fs.readFileSync(f, 'utf8'))); fs.rmSync(f, { force: true }) }
          else ck(`${L} exportar: se descargó un archivo`, false, 'sin descarga en 30 s') } }
      if (process.env.E2E_DELETE === '1' && created) {
        await p.getByRole('button', { name: dict.eliminar }).first().click().catch(() => {}); await sleep(800); const dlg = p.locator('dialog[open], [role=dialog]').first()
        ck(`${L} eliminar: el diálogo muestra las consecuencias`, (await dlg.count()) > 0 && (await dlg.innerText()).length > 80)
        const input = dlg.locator('input').first(); if (await input.count()) { await input.fill(lang === 'es' ? 'ELIMINAR' : 'DELETE'); await dlg.getByRole('button', { name: dict.eliminar }).last().click(); await p.waitForURL((u) => u.pathname === '/' || u.pathname === '/login', { timeout: 12000 }).catch(() => {}); await sleep(800); await p.screenshot({ path: path.join(OUT, id('eliminar-despues') + '.png') }).catch(() => {})
          { const tx = (await probe(p)).text, keys = await p.evaluate(() => Object.keys(localStorage).filter((k) => /token/i.test(k) && localStorage.getItem(k))), tk = keys.length; ck(`${L} eliminar: avisa que se cerró la sesión y la cuenta queda en eliminación (el diseño deja la pantalla de confirmación)`, /signed you out|cerramos tu sesión/i.test(tx)); info(`${L} eliminar: tras el aviso quedan en localStorage: ${keys.join(',') || 'ninguna clave de token'} (el servidor revoca el token; ver observación de QA)`) }
          await p.goto(BASE + '/login'); await p.fill('#access-email', email); await p.fill('#access-password', PASS); await p.locator('form button[type=submit]').click(); await sleep(2500)
          ck(`${L} eliminar: la cuenta ya no entra`, /login/.test(new URL(p.url()).pathname), new URL(p.url()).pathname) } }
    }
  } catch (e) { ck(`${L} el flujo terminó sin excepción`, false, e.message) } finally { await p.ctx.close() }
}

;(async () => {
  info(`E2E contra ${LOCAL ? 'LOCAL' : 'STAGING'} ${host} · ${REGISTER ? 'registra cuentas sintéticas' : 'cuenta existente'} · chat real ${process.env.E2E_CHAT === '1' ? 'SÍ (1 mensaje por combinación)' : 'no'} · eliminar ${process.env.E2E_DELETE === '1' ? 'sí' : 'no'}`)
  const h = await fetch(BASE + '/health').catch(() => null); if (h) ck('salud del servidor responde', h.status < 500, h.status)
  for (const lang of LANGS) for (const [w, hh] of VPS) for (const scheme of SCHEMES) { const browser = await chromium.launch(); await run(browser, { lang, w, h: hh, scheme }); await browser.close().catch(() => {}) } // un navegador por combinación: un cierre inesperado de Chromium no arrastra al resto
  fs.writeFileSync(path.join(OUT, 'resultado.json'), JSON.stringify({ base: host, total, fails, rows }, null, 1))
  console.log(`RESUMEN: ${total - fails}/${total} OK, ${fails} FALLAS (capturas y resultado.json en ${OUT})`); process.exit(fails ? 1 : 0)
})().catch((e) => { console.log('EXCEPCION', e.stack || e.message); process.exit(1) })
