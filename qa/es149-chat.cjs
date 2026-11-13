// QA-Claude-2 — ES-149 (PR #143): aviso permanente de límites en el chat. Backend REAL local (:8090) + vite (:5173) + Anthropic SIMULADO (:8097). Solo local, datos sintéticos.
// Env: PLAYWRIGHT_MODULE, PLAYWRIGHT_BROWSERS_PATH, SHARED (t2/shared/landing-content.json), AXE (axe-core/axe.min.js), OUT (capturas), DIST (t2/frontend/dist).
const { chromium } = require(process.env.PLAYWRIGHT_MODULE); const fs = require('fs'), path = require('path')
const API = 'http://localhost:8090', UI = 'http://localhost:5173', FAKE = 'http://127.0.0.1:8097', OUT = process.env.OUT; fs.mkdirSync(OUT, { recursive: true })
let f = 0; const ck = (n, ok, x = '') => { if (!ok) f++; console.log((ok ? 'OK   ' : 'FALLA ') + n, x) }; const info = (...a) => console.log('INFO', ...a)
const PASS = require('crypto').randomBytes(10).toString('hex') + 'Aa1!', tag = Date.now().toString(36)
const call = async (m, p, t, b) => { const r = await fetch(API + p, { method: m, headers: { 'content-type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}) }, body: b === undefined ? undefined : JSON.stringify(b) }); return { s: r.status, j: await r.json().catch(() => null) } }
let n = 0; const person = async () => { const email = `qa2-a149-${tag}-${++n}@example.test`; await call('POST', '/api/register', null, { name: 'QA2 ' + n, email, password: PASS }); await new Promise(r => setTimeout(r, 400)); return (await call('POST', '/api/login', null, { email, password: PASS })).j?.token }
const lum = c => { const [r, g, b] = c.match(/[\d.]+/g).slice(0, 3).map(Number).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }); return 0.2126 * r + 0.7152 * g + 0.0722 * b }
const cr = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }
const L = JSON.parse(fs.readFileSync(process.env.SHARED, 'utf8')); const rows = Array.isArray(L) ? L : (L.entries || L.items || Object.values(L).find(Array.isArray))
const notice = rows.find(r => r.key === 'landing.footer.notice'), trust = rows.find(r => r.key === 'landing.trust.1.body')
const EXP = { es: notice.es + ' La IA puede equivocarse.', en: notice.en + ' AI can be wrong.' }
;(async () => {
  info('landing.trust.1.body:', JSON.stringify({ es: trust?.es, en: trust?.en }).slice(0, 220))
  const b = await chromium.launch(); const token = await person()
  const open = async (lang, w, h = 900, p0 = '/app/chat') => { const c = await b.newContext({ viewport: { width: w, height: h }, isMobile: w < 500 }); await c.addInitScript(([t, l]) => { localStorage.setItem('elevation_token', t); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elv_lang', l) }, [token, lang]); const p = await c.newPage(); p.errs = []; p.on('pageerror', e => p.errs.push(e.message.slice(0, 100))); await p.goto(UI + p0, { waitUntil: 'networkidle' }); await p.waitForSelector('textarea.space-message', { timeout: 15000 }).catch(() => {}); await p.waitForTimeout(500); return p }
  for (const lang of ['es', 'en']) for (const w of [1360, 390]) {
    const p = await open(lang, w); const nt = p.locator('.chat-limits'); const cnt = await nt.count(); const txt = cnt ? (await nt.first().innerText()).trim() : ''
    ck(`A1 ${lang}/${w}: el aviso está presente al abrir el chat vacío, sin acciones`, cnt === 1 && await nt.first().isVisible(), `n=${cnt}`)
    ck(`A2 ${lang}/${w}: el texto es exactamente el aprobado (landing.footer.notice + frase de error de la IA)`, txt === EXP[lang], txt === EXP[lang] ? '' : `«${txt}»`)
    ck(`A2 ${lang}/${w}: sin claves crudas`, !/limits|limitsLabel|landing\./.test(txt))
    const box = await nt.first().boundingBox(), ta = await p.locator('textarea.space-message').boundingBox(), vp = p.viewportSize()
    ck(`A1/A6 ${lang}/${w}: el aviso queda dentro de la ventana, debajo de la caja y sin solaparla`, !!box && box.y + box.height <= vp.height + 1 && box.y >= ta.y + ta.height - 1 && box.x >= 0 && box.x + box.width <= vp.width, `aviso y=${Math.round(box.y)}-${Math.round(box.y + box.height)} caja y=${Math.round(ta.y)}-${Math.round(ta.y + ta.height)} ventana=${vp.height}`)
    const sw = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth); ck(`A6 ${lang}/${w}: sin desborde horizontal`, sw <= 0, 'exceso=' + sw)
    const a = await nt.first().evaluate(e => ({ role: e.getAttribute('role'), label: e.getAttribute('aria-label'), tab: e.tabIndex, color: getComputedStyle(e).color, size: parseFloat(getComputedStyle(e).fontSize), bg: (() => { let n = e; while (n) { const x = getComputedStyle(n).backgroundColor; if (!/rgba\(0, 0, 0, 0\)|transparent/.test(x)) return x; n = n.parentElement } return 'rgb(255,255,255)' })() }))
    const ratio = cr(a.color, a.bg); ck(`A4 ${lang}/${w}: role=note con aria-label, no focusable`, a.role === 'note' && !!a.label && a.tab === -1, JSON.stringify({ role: a.role, label: a.label, tab: a.tab }))
    ck(`A4 ${lang}/${w}: contraste AA (>= 4,5:1) del texto del aviso`, ratio >= 4.5, `${ratio.toFixed(2)}:1 color=${a.color} fondo=${a.bg} ${a.size}px`)
    ck(`A4 ${lang}/${w}: aria-label en el idioma activo`, lang === 'es' ? a.label === 'Límites del asistente' : a.label === 'Assistant limits', a.label)
    ck(`A3 ${lang}/${w}: sin números, líneas de ayuda ni promesas`, !/\d/.test(txt) && !/línea de ayuda|helpline|hotline|garantiz|guarantee|promet|promis|cura\b|terapia/i.test(txt))
    const stopsInside = await p.evaluate(() => document.querySelectorAll('.chat-limits a,.chat-limits button,.chat-limits [tabindex]').length); ck(`A4 ${lang}/${w}: el aviso no añade paradas de tabulación`, stopsInside === 0)
    const order = await p.evaluate(() => { const t = document.querySelector('textarea.space-message'), n = document.querySelector('.chat-limits'); return !!(t.compareDocumentPosition(n) & Node.DOCUMENT_POSITION_FOLLOWING) }); ck(`A4 ${lang}/${w}: orden de lectura caja -> aviso`, order)
    await p.screenshot({ path: path.join(OUT, `chat-${lang}-${w}.png`) })
    ck(`A5 ${lang}/${w}: sin errores de JavaScript en la página`, p.errs.length === 0, p.errs.join(' | ')); await p.context().close()
  }
  { const p = await open('es', 390); await p.addScriptTag({ path: process.env.AXE }); const r = await p.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice'] } })); const v = r.violations.map(x => `${x.id}(${x.nodes.length}):${x.impact}`); const mine = r.violations.filter(x => x.nodes.some(nd => /chat-limits/.test(nd.html))); info('A4 axe violaciones en la pantalla del chat (390, ES):', v.join(', ') || 'ninguna'); ck('A4 axe: 0 violaciones que afecten al aviso', mine.length === 0, mine.map(x => x.id).join(',')); await p.context().close() }
  { const p = await open('es', 390, 700); await fetch(FAKE + '/__reset', { method: 'POST' }); const big = 'Mensaje de prueba sintético. '.repeat(20)
    for (let i = 0; i < 8; i++) { await fetch(FAKE + '/__queue', { method: 'POST', body: JSON.stringify({ entries: [{ text: 'Respuesta simulada ' + i + ' de prueba. ' + 'Texto de relleno para alargar. '.repeat(12) }] }) }); await p.locator('textarea.space-message').fill(big + i); await p.locator('.chat-composer-row button').click(); await p.waitForTimeout(1300) }
    const msgs = await p.locator('.chat-scroll').evaluate(e => ({ sh: e.scrollHeight, ch: e.clientHeight })); info('A1 historial largo: scrollHeight', msgs.sh, 'clientHeight', msgs.ch)
    const nt = p.locator('.chat-limits'); const bx = await nt.boundingBox(); const vp = p.viewportSize(); ck('A1 con historial largo el aviso sigue visible sin hacer scroll', await nt.isVisible() && bx.y + bx.height <= vp.height + 1 && bx.y >= 0, `y=${Math.round(bx.y)}-${Math.round(bx.y + bx.height)} ventana=${vp.height}`)
    const reply = await p.locator('.chat-scroll').innerText(); ck('A5 el envío y la respuesta simulada funcionan (8 mensajes)', /Respuesta simulada 7/.test(reply), reply.slice(-60).replace(/\n/g, ' '))
    await p.locator('textarea.space-message').fill('x'.repeat(5000)); const val = (await p.locator('textarea.space-message').inputValue()).length; ck('A5 el límite de caracteres sigue funcionando (<= 4.000)', val <= 4000, 'longitud=' + val)
    await p.setViewportSize({ width: 390, height: 360 }); await p.waitForTimeout(400); const ta = await p.locator('textarea.space-message').boundingBox(); const b2 = await nt.boundingBox(); info('A6 ventana 390x360 (teclado abierto): caja y=', Math.round(ta.y), '-', Math.round(ta.y + ta.height), 'aviso y=', Math.round(b2.y), '-', Math.round(b2.y + b2.height))
    const bar = await p.locator('.chat-input-bar').evaluate(e => ({ sh: e.scrollHeight, ch: e.clientHeight, ov: getComputedStyle(e).overflowY })); ck('A6 con poca altura la caja sigue alcanzable (contenedor con scroll propio o todo visible)', ta.y >= 0 && (bar.ov === 'auto' || bar.ov === 'scroll' || b2.y + b2.height <= 360), JSON.stringify(bar))
    await p.screenshot({ path: path.join(OUT, 'chat-es-390x360.png') }); await p.context().close() }
  { const p = await open('es', 1360, 900, '/app/dashboard'); ck('Alcance: el aviso no aparece en el panel (solo en el chat)', (await p.locator('.chat-limits').count()) === 0); await p.context().close() }
  const dist = process.env.DIST; const js = fs.readdirSync(path.join(dist, 'assets')).filter(x => x.endsWith('.js')).map(x => fs.readFileSync(path.join(dist, 'assets', x), 'utf8')).join('\n'); const i = js.indexOf('La IA puede equivocarse'); ck('A3 bundle: el texto del aviso está en el build y sin teléfonos cerca', i > 0 && !/\+?\d[\d\s().-]{8,}\d/.test(js.slice(i - 400, i + 200)), 'índice=' + i)
  await b.close(); console.log(f ? `\nFALLAS ${f}` : '\nTODO OK'); process.exit(f ? 1 : 0)
})().catch(e => { console.error('EXCEPCIÓN', e.stack?.slice(0, 500)); process.exit(3) })
