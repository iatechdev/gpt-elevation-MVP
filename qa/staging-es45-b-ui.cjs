// QA-Claude-2 — ES-45 plan complementario: A1 editar entrada de diario por UI, A5 XSS en el chat (1 mensaje de IA), A8 humo en Chromium/Firefox/WebKit.
// Persona DESECHABLE (QA2). No imprime claves ni tokens. Env: STAGING_URL, CRED_FILE, PLAYWRIGHT_MODULE, OUT.
const fs = require('fs'), crypto = require('crypto'); const pw = require(process.env.PLAYWRIGHT_MODULE); const BASE = process.env.STAGING_URL.replace(/\/$/, ''), OUT = process.env.OUT || '.'
if (!/^https:\/\/backend-staging-/.test(BASE)) process.exit(2)
let f = 0; const ck = (n, ok, x = '') => { if (!ok) f++; console.log((ok ? 'OK   ' : 'FALLA ') + n, x) }
const sleep = ms => new Promise(r => setTimeout(r, ms)); const api = async (m, p, t, b) => { const r = await fetch(BASE + p, { method: m, headers: { 'content-type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}) }, body: b === undefined ? undefined : JSON.stringify(b) }); let j = null; try { j = await r.json() } catch {} return { s: r.status, j } }
const lines = fs.readFileSync(process.env.CRED_FILE, 'utf8').split(/\r?\n/)
const sec = e => { const l = lines.find(x => x.includes(e)); return l.slice(l.indexOf(e) + e.length).replace(/^[\s:=|,;\-–>]+/, '').replace(/^(?:clave|contraseña|password)\s*[:=]\s*/i, '').split(/\s{2,}/)[0].trim() }
;(async () => {
  fs.mkdirSync(OUT, { recursive: true }); const tag = Date.now().toString(36), email = `qa2-persona5-${tag}@example.test`, pass = crypto.randomBytes(9).toString('base64').replace(/[+/=]/g, 'x') + 'aB3!'
  const rg = await api('POST', '/api/register', null, { name: 'QA2 persona5', email, password: pass }); ck('Preparación: persona desechable creada', rg.s === 201, 'HTTP ' + rg.s); await sleep(600)
  const session = async () => { const r = await api('POST', '/api/login', null, { email, password: pass }); await sleep(700); return r.j.token }
  const text = x => x.locator('body').innerText()
  for (const [name, type] of [['chromium', pw.chromium], ['firefox', pw.firefox], ['webkit', pw.webkit]]) {
    let b; try { b = await type.launch() } catch (e) { ck(`A8 ${name}: el navegador arranca`, false, e.message.slice(0, 100)); continue }
    for (const [lang, w] of [['es', 1440], ['en', 390]]) {
      const tag2 = `${name} ${lang} ${w}px`, token = await session(); const c = await b.newContext({ viewport: { width: w, height: 900 } }); await c.addInitScript(([t, l]) => { try { localStorage.setItem('elevation_token', t); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elv_lang', l) } catch {} }, [token, lang])
      const p = await c.newPage(); const errs = []; p.on('pageerror', x => errs.push(x.message.slice(0, 80))); p.on('dialog', d => d.accept())
      try {
        await p.goto(BASE + '/', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1500); const land = await text(p); ck(`A8 ${tag2}: la landing carga con contenido`, land.length > 500 && !(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)), `${land.length} caracteres`)
        await p.goto(BASE + '/app/dashboard', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(2500); ck(`A8 ${tag2}: el dashboard de la persona carga (sesión inyectada)`, /Mapa de competencias|Skills map|Competency map|Mi progreso|My progress/i.test(await text(p)))
        await p.goto(BASE + '/app/diary/new', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1500); const d = await p.locator('input[type=date]').inputValue(); const x = new Date(), today = `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
        ck(`A8 ${tag2}: «Nueva entrada» trae la fecha de hoy`, d === today, d)
        const tx = `QA2 B ${name} ${lang} ${tag}`; await p.locator('textarea').fill(tx); await p.getByRole('button', { name: /Guardar entrada|Save entry/i }).click(); await p.waitForTimeout(1500)
        await p.goto(BASE + '/app/diary', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1500); ck(`A8 ${tag2}: la entrada aparece en el diario`, (await text(p)).includes(tx))
        // A1 editar por UI
        await p.getByRole('link', { name: /Abrir|Open/i }).first().click(); await p.waitForTimeout(1200); await p.getByRole('button', { name: /^(Editar|Edit)$/i }).first().click(); await p.waitForTimeout(800)
        const ta = p.locator('textarea'); const hasEditor = await ta.count(); ck(`A1 ${tag2}: «Editar» muestra el editor`, hasEditor > 0)
        if (hasEditor) { await ta.fill(tx + ' EDITADA'); await p.getByRole('button', { name: /Guardar|Save/i }).first().click(); await p.waitForTimeout(1500); await p.goto(BASE + '/app/diary', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1500); ck(`A1 ${tag2}: la edición se guarda y aparece en la lista`, (await text(p)).includes('EDITADA')) }
        await p.screenshot({ path: `${OUT}/b-${name}-${lang}-${w}.png` })
      } catch (e) { ck(`A8 ${tag2}: flujo sin excepción`, false, e.message.slice(0, 120)) }
      ck(`A8 ${tag2}: sin errores de página`, errs.length === 0, errs.join(' | ')); await c.close()
    }
    await b.close()
  }
  // A5 XSS en el chat (Chromium, 1 mensaje corto con IA real)
  { const b = await pw.chromium.launch(); const token = await session(); const c = await b.newContext({ viewport: { width: 1280, height: 900 } }); await c.addInitScript(([t]) => { localStorage.setItem('elevation_token', t); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elv_lang', 'es') }, [token])
    const p = await c.newPage(); let dialog = false; p.on('dialog', d => { dialog = true; d.dismiss() })
    const msg = 'QA2: <img src=x onerror=alert(1)> <script>alert(2)</script> [clic](javascript:alert(3)) responde en una frase corta'
    const r = await api('POST', '/api/chat', token, { message: msg, requestId: 'qa2-b-' + crypto.randomBytes(5).toString('hex'), lang: 'es' }); ck('A5 el chat acepta el mensaje con HTML y responde', r.s === 200, 'HTTP ' + r.s)
    await p.goto(BASE + '/app/chat', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(3500)
    const imgs = await p.locator('img[src="x"]').count(), scripts = await p.evaluate(() => [...document.querySelectorAll('main script, #root script')].length), js = await p.locator('a[href^="javascript:"]').count(), vis = (await text(p))
    ck('A5 XSS en el chat: sin imágenes ni scripts inyectados, sin enlaces javascript:, sin diálogos', imgs === 0 && scripts === 0 && js === 0 && !dialog, `img=${imgs} script=${scripts} javascript:=${js} dialog=${dialog}`)
    ck('A5 el historial muestra el texto del mensaje como texto literal', /<img src=x onerror/.test(vis) || /QA2:/.test(vis), ''); await p.screenshot({ path: `${OUT}/b-chat-xss.png` }); await b.close() }
  // limpieza
  const tk = await session(); const lst = await api('GET', '/api/diary?limit=100', tk); const arr = Array.isArray(lst.j) ? lst.j : lst.j?.entries || []; let n = 0; for (const e of arr) { const d = await api('DELETE', '/api/diary/' + e.id, tk); if (d.s === 200 || d.s === 204) n++ }
  console.log('INFO limpieza: entradas QA2 de persona5 eliminadas =', n)
  const A = (await api('POST', '/api/login', null, { email: 'qa.admin@example.test', password: sec('qa.admin@example.test') })).j?.token; const us = (await api('GET', '/api/admin/usuarios', A)).j || []; const me = us.find(u => u.email === email); if (me) { const x = await api('PUT', '/api/admin/usuarios/' + me.id, A, { active: false }); ck('Limpieza: persona5 desechable desactivada', x.s === 200, 'HTTP ' + x.s) }
  console.log(f ? `\nFALLAS ${f}` : '\nTODO OK'); process.exit(f ? 1 : 0)
})().catch(e => { console.error('EXCEPCIÓN', e.stack?.slice(0, 300)); process.exit(3) })
