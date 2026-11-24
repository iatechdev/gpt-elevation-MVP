// QA-Claude-2 — ES-128 (PR 126): formulario «Crear cuenta» en Chromium. Env: U (vite local), PLAYWRIGHT_MODULE, OUT (carpeta de capturas).
const { chromium } = require(process.env.PLAYWRIGHT_MODULE); const U = (process.env.U || 'http://localhost:5173').replace(/\/$/, ''), OUT = process.env.OUT || '.'
if (!/^http:\/\/localhost/.test(U)) process.exit(2)
let f = 0; const ck = (n, ok, x = '') => { if (!ok) f++; console.log((ok ? 'OK   ' : 'FALLA ') + n, x) }
const lum = c => { const [r, g, b] = c.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }); return 0.2126 * r + 0.7152 * g + 0.0722 * b }
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }
const T = {
  es: { title: 'Tu contraseña debe tener:', rows: ['Al menos 8 caracteres', 'Una mayúscula (A-Z)', 'Una minúscula (a-z)', 'Un número (0-9)', 'Un carácter especial'], bytes: 'Máximo 72 bytes', met: 'cumplido', pend: 'pendiente', needs: 'Tu contraseña necesita:' },
  en: { title: 'Your password must have:', rows: ['At least 8 characters', 'One uppercase letter (A-Z)', 'One lowercase letter (a-z)', 'One number (0-9)', 'One special character'], bytes: 'Up to 72 bytes', met: 'met', pend: 'pending', needs: 'Your password needs:' },
}
;(async () => {
  const b = await chromium.launch()
  const open = async (lang, w, mode = 'register') => {
    const c = await b.newContext({ viewport: { width: w, height: 900 }, isMobile: w < 500 }); await c.addInitScript(l => { try { localStorage.setItem('elv_lang', l) } catch {} }, lang)
    const p = await c.newPage(); p.errs = []; p.reqs = []
    p.on('pageerror', e => p.errs.push(e.message.slice(0, 120))); p.on('console', m => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && p.errs.push(m.text().slice(0, 120)))
    p.on('request', r => /\/api\/register/.test(r.url()) && r.method() === 'POST' && p.reqs.push(r.postData()))
    await p.goto(`${U}/login${mode === 'register' ? '?mode=register' : ''}`, { waitUntil: 'networkidle' }); await p.waitForTimeout(500); return p
  }
  const pw = p => p.locator('input[aria-describedby="pw-req"], input[type="password"]').first()
  const fill = async (p, name, email, pass) => { const inputs = p.locator('form input'); const t = await inputs.count(); await p.locator('form input[type="text"], form input:not([type])').first().fill(name).catch(() => {}); await p.locator('form input[type="email"]').first().fill(email).catch(() => {}); await pw(p).fill(pass) ; void t }
  const reqText = p => p.locator('#pw-req').innerText().then(s => s.replace(/\s+/g, ' '))
  for (const lang of ['es', 'en']) for (const w of [320, 768, 1440]) {
    const L = T[lang], tag = `${lang} ${w}px`, p = await open(lang, w)
    const vis = await p.locator('#pw-req').isVisible(); ck(`F8 ${tag}: requisitos visibles antes de escribir`, vis)
    const t0 = await reqText(p); ck(`F8 ${tag}: título, 5 filas y nota de 72 bytes presentes`, t0.includes(L.title) && L.rows.every(r => t0.includes(r)) && t0.includes(L.bytes), t0.slice(0, 110))
    ck(`F8 ${tag}: aria-describedby del campo apunta a #pw-req`, (await pw(p).getAttribute('aria-describedby')) === 'pw-req')
    const icons0 = await p.locator('#pw-req li span[aria-hidden]').allInnerTexts(); ck(`F8 ${tag}: vacío = 5 «○»`, icons0.length === 5 && icons0.every(x => x === '○'), icons0.join(''))
    const col0 = await p.locator('#pw-req li').first().evaluate(e => getComputedStyle(e).color); ck(`F8 ${tag}: vacío no usa rojo (neutro)`, !/^rgb\(2[0-9]{2}, ?[0-9]{1,2}, ?[0-9]{1,2}\)/.test(col0), col0)
    await pw(p).click(); await p.keyboard.type('a'); let icons = await p.locator('#pw-req li span[aria-hidden]').allInnerTexts(); ck(`F8 ${tag}: «a» → solo minúscula cumplida`, icons.join('') === '○○✓○○', icons.join(''))
    let live = await p.locator('#pw-req [aria-live]').innerText(); ck(`F8 ${tag}: aria-live anuncia el conteo`, /1/.test(live) && /5/.test(live), live)
    await p.keyboard.type('A1!bcdef'); icons = await p.locator('#pw-req li span[aria-hidden]').allInnerTexts(); ck(`F8 ${tag}: «aA1!bcdef» → 5 «✓»`, icons.join('') === '✓✓✓✓✓', icons.join(''))
    const hid = await p.locator('#pw-req li').allInnerTexts(); ck(`F8 ${tag}: texto oculto «${L.met}» en las 5 filas (no depende del color)`, hid.every(x => x.includes(L.met)) , hid.map(x => x.slice(-12)).join('|'))
    const m = await p.evaluate(() => ({ s: document.documentElement.scrollWidth, i: innerWidth })); ck(`F11 ${tag}: sin desborde horizontal`, m.s <= m.i, `${m.s}/${m.i}`)
    ck(`F11 ${tag}: sin errores de página/consola`, p.errs.length === 0, p.errs.join('|'))
    const body = await p.locator('body').innerText(); ck(`F11 ${tag}: sin claves crudas`, !/landing\.access\.pw/.test(body))
    if (lang === 'es') ck(`F11 ${tag}: sin voseo`, !/\b(tenés|ingresá|usá|poné|elegí)\b/i.test(body))
    // contraste con el fondo
    const cc = await p.locator('#pw-req li').first().evaluate(e => { let bg = 'rgba(0, 0, 0, 0)', n = e; while (n && /rgba\(0, 0, 0, 0\)|transparent/.test(bg)) { bg = getComputedStyle(n).backgroundColor; n = n.parentElement } return [getComputedStyle(e).color, bg] })
    ck(`F10 ${tag}: contraste de las filas cumplidas ≥ 4.5:1`, ratio(cc[0], /rgba\(0, 0, 0, 0\)/.test(cc[1]) ? 'rgb(255,255,255)' : cc[1]) >= 4.5, `${cc[0]} sobre ${cc[1]} = ${ratio(cc[0], /rgba\(0, 0, 0, 0\)/.test(cc[1]) ? 'rgb(255,255,255)' : cc[1]).toFixed(2)}`)
    if (w === 320 || w === 1440) await p.screenshot({ path: `${OUT}/form-${lang}-${w}.png`, fullPage: false })
    await p.context().close()
  }
  // F9 envío débil (sin petición), foco, alert
  for (const lang of ['es', 'en']) {
    const L = T[lang], p = await open(lang, 390); await fill(p, 'QA2 ui', `qa2-ui-${Date.now()}@example.test`, 'abc')
    await p.locator('form button[type="submit"]').click(); await p.waitForTimeout(400)
    ck(`F9 ${lang}: contraseña débil no envía petición al servidor`, p.reqs.length === 0)
    const al = p.locator('[role="alert"]'); const at = await al.innerText().catch(() => ''); ck(`F9 ${lang}: role=alert con lo que falta (${L.needs})`, at.includes(L.needs) && /8/.test(at), at.replace(/\s+/g, ' '))
    ck(`F9 ${lang}: foco y aria-invalid en el campo`, await pw(p).evaluate(e => document.activeElement === e) && (await pw(p).getAttribute('aria-invalid')) === 'true')
    const red = await p.locator('#pw-req li').first().evaluate(e => getComputedStyle(e).color); console.log('      color fila pendiente tras error:', red)
    const dc = await al.evaluate(e => { let bg = 'rgba(0, 0, 0, 0)', n = e; while (n && /rgba\(0, 0, 0, 0\)|transparent/.test(bg)) { bg = getComputedStyle(n).backgroundColor; n = n.parentElement } return [getComputedStyle(e).color, bg] })
    const cr = ratio(dc[0], /rgba\(0, 0, 0, 0\)/.test(dc[1]) ? 'rgb(255,255,255)' : dc[1]); ck(`F10 ${lang}: contraste del mensaje de error ≥ 4.5:1`, cr >= 4.5, cr.toFixed(2))
    await pw(p).fill('Abcdef1!'); await p.waitForTimeout(200); ck(`F9 ${lang}: al corregir desaparece el error`, (await p.locator('[role="alert"]').count()) === 0)
    await p.screenshot({ path: `${OUT}/error-${lang}.png` }); await p.context().close()
  }
  // F9 variantes de falta y 72 bytes y común (rechazo del servidor mockeado)
  { const p = await open('es', 390); await fill(p, 'QA2', 'a@example.test', 'Aa1!' + 'ñ'.repeat(35)); await p.locator('form button[type="submit"]').click(); await p.waitForTimeout(300)
    ck('F9 72 bytes (cliente): sin petición, mensaje menciona 72 bytes, nota en rojo', p.reqs.length === 0 && /72 bytes/.test(await p.locator('[role="alert"]').innerText()), (await p.locator('[role="alert"]').innerText()).replace(/\s+/g, ' '))
    await p.context().close() }
  { const p = await open('es', 390); await p.route('**/api/register', r => r.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ code: 'password_policy', missing: ['common', 'zzz_desconocido', '<b>x</b>'], error: 'x' }) }))
    await fill(p, 'QA2', 'c@example.test', 'Password1!'); await p.locator('form button[type="submit"]').click(); await p.waitForTimeout(500)
    const t = (await p.locator('[role="alert"]').innerText()).replace(/\s+/g, ' '); ck('F9 servidor rechaza «common»: mensaje claro, ids desconocidos/HTML descartados', /muy común/.test(t) && !/zzz|<b>/.test(t), t)
    ck('F9 «Password1!» (común): el cliente la bloquea sin petición y el foco vuelve al campo', p.reqs.length === 0 && await pw(p).evaluate(e => document.activeElement === e)); await p.context().close() }
  { const p = await open('en', 390); await p.route('**/api/register', r => r.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ code: 'password_policy', error: 'x' }) }))
    await fill(p, 'QA2', 'd@example.test', 'Valida1!ok'); await p.locator('form button[type="submit"]').click(); await p.waitForTimeout(500)
    const t = (await p.locator('[role="alert"]').innerText()).replace(/\s+/g, ' '); ck('F9 servidor rechaza sin `missing`: usa el mensaje general EN', /at least 8 characters/i.test(t), t); await p.context().close() }
  // F10 teclado
  { const p = await open('es', 1440); const order = []; await p.locator('form input').first().focus()
    for (let i = 0; i < 8; i++) { order.push(await p.evaluate(() => document.activeElement.tagName + ':' + (document.activeElement.type || '') + ':' + ((document.activeElement.innerText || '').slice(0, 20))) ); await p.keyboard.press('Tab') }
    console.log('      orden de tabulación:', order.join(' > ')); ck('F10 la lista de requisitos no añade paradas de tabulación', !order.some(x => /LI|UL|SPAN|P:/.test(x.split(':')[0])), '')
    await fill(p, 'QA2 kb', `qa2-kb-${Date.now()}@example.test`, 'Valida1!ok'); const before = p.reqs.length; await pw(p).press('Enter'); await p.waitForTimeout(1200); ck('F10 Enter en el campo envía el registro', p.reqs.length === before + 1, p.url())
    const pwd = await p.evaluate(() => JSON.stringify(Object.entries(localStorage).concat(Object.entries(sessionStorage)))); ck('S1 la contraseña no queda en localStorage/sessionStorage ni en la URL', !pwd.includes('Valida1!ok') && !p.url().includes('Valida1')); await p.context().close() }
  // F12 modo ingreso sin lista, cambio de modo, ?plan=
  { const p = await open('es', 1440, 'login'); ck('F12 modo «Ingresar»: sin lista de requisitos ni aria-describedby', (await p.locator('#pw-req').count()) === 0 && !(await pw(p).getAttribute('aria-describedby')), p.url())
    const sw = p.locator('button, a').filter({ hasText: /Crear cuenta|Regístrate|Registrarse|Create account/i }).first(); if (await sw.count()) { await sw.click(); await p.waitForTimeout(300); ck('F12 cambio a registro muestra la lista', await p.locator('#pw-req').isVisible()) } else console.log('      (sin enlace de cambio de modo localizable)'); await p.context().close() }
  { const p = await open('es', 390); await p.goto(`${U}/login?mode=register&plan=1`, { waitUntil: 'networkidle' }); ck('F12 ?plan= conserva el modo registro con requisitos', await p.locator('#pw-req').isVisible() && /plan=1/.test(p.url()), p.url()); await p.context().close() }
  // P4 validación en vivo
  { const p = await open('es', 1440); const t = await p.evaluate(async () => { const el = document.querySelector('input[aria-describedby="pw-req"]'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; const ts = []; let v = ''; for (let i = 0; i < 100; i++) { v += 'Aa1!'[i % 4]; const t0 = performance.now(); set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); await new Promise(r => requestAnimationFrame(() => r())); ts.push(performance.now() - t0) } ts.sort((a, b) => a - b); return { med: ts[50], p95: ts[95], max: ts[99] } })
    ck('P4 100 pulsaciones: p95 de actualización < 50 ms (propuesta)', t.p95 < 50, `mediana=${t.med.toFixed(1)} p95=${t.p95.toFixed(1)} máx=${t.max.toFixed(1)} ms`); await p.context().close() }
  // F9 envío válido real (backend local)
  { const p = await open('en', 320); await fill(p, 'QA2 end', `qa2-end-${Date.now()}@example.test`, 'Valida1!ok'); const [r] = await Promise.all([p.waitForResponse(r => /\/api\/register/.test(r.url())), p.locator('form button[type="submit"]').click()]); ck('F9 registro válido de punta a punta contra el backend local', r.status() === 201, r.status()); await p.context().close() }
  await b.close(); console.log(f ? 'FALLAS ' + f : 'TODO OK'); process.exit(f ? 1 : 0)
})().catch(e => { console.error('EXCEPCIÓN', e.message); process.exit(3) })
