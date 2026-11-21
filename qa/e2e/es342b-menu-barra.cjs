// [QA-Claude] ES-342 · PR #394 (Parte B) · menú del chat B1 + barra superior B2, PROPIO. Build FRESCO servido con proxy /api hacia el backend REAL (PostgreSQL local, persona sintética registrada por la API).
//   BASE=http://localhost:5273 (PR) | http://localhost:5274 (main = control)  TAG=pr|main  OUT=<carpeta>  QA_DB=postgres://…/q394  node qa/e2e/es342b-menu-barra.cjs
// Casos M1–M6 y M9 del plan. Sin IA; datos sintéticos @example.invalid; solo localhost.
process.env.PLAYWRIGHT_BROWSERS_PATH = process.env.PLAYWRIGHT_BROWSERS_PATH || 'C:/Users/Usuario/tools/pw-browsers'
const E = process.env; const { chromium } = require('C:/Users/Usuario/tools/playwright/node_modules/playwright'); const fs = require('fs'), path = require('path'), { createRequire } = require('module')
const BASE = E.BASE; const TAG = E.TAG || 'pr'; const OUT = E.OUT || '.'; const AXE = fs.readFileSync('C:/Users/Usuario/Documents/Central/node_modules/axe-core/axe.min.js', 'utf8')
const DB = E.QA_DB || 'postgres://elevation:elevation_local@127.0.0.1:54459/q394'; const API = 'http://localhost:8191'; const results = []; let fails = 0
const ck = (id, ok, d = '') => { if (!ok) fails++; results.push({ id, ok: !!ok, d: String(d).slice(0, 600) }); console.log((ok ? 'OK   ' : 'FALLA ') + id + (d ? ' :: ' + String(d).slice(0, 300) : '')) }
const info = (id, d) => { results.push({ id, info: String(d).slice(0, 2500) }); console.log('INFO ' + id + ' :: ' + String(d).slice(0, 700)) }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const L = { es: { menu: 'Menú', close: 'Cerrar', conv: 'Conversación', main: 'Principal', prefs: 'Preferencias', user: 'Menú de usuario', out: 'Cerrar sesión', progress: 'Mi progreso', pause: 'Pausar', admin: /administraci/i, recs: /recomendaciones/i, enter: /enter/i },
  en: { menu: 'Menu', close: 'Close', conv: 'Conversation', main: 'Main', prefs: 'Preferences', user: 'User menu', out: 'Sign out', progress: 'My progress', pause: 'Pause', admin: /admin/i, recs: /recommend/i, enter: /enter/i } }
const api = async (m, p, body, token) => { const r = await fetch(API + p, { method: m, headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined }); return { s: r.status, j: await r.json().catch(() => ({})) } }
const persona = async (tag, role) => { const email = `es342b-${tag}-${Date.now().toString(36)}@example.invalid`; const password = 'Sintetica-Clave-2026!'
  const r = await api('POST', '/api/register', { name: 'Persona Sintetica ' + tag, email, password, acceptedTerms: true, termsVersion: '2026-11-v2' }); if (r.s !== 201) throw new Error('registro ' + r.s + JSON.stringify(r.j).slice(0, 200))
  const { Client } = createRequire("C:/Users/Usuario/Documents/qa-pr-253/backend/package.json")('pg'); const c = new Client({ connectionString: DB }); await c.connect(); await c.query(`UPDATE "Users" SET "onboardingCompleted"=true, role=$2 WHERE email=$1`, [email, role]); await c.end()
  const l = await api('POST', '/api/login', { email, password }); if (!l.j.token) throw new Error('login ' + l.s); return { token: l.j.token, role } }
const ctrlLabel = (e) => (e.getAttribute('aria-label') || e.innerText || (e.closest('label') && e.closest('label').innerText) || e.value || '').replace(/\s+/g, ' ').trim()
;(async () => {
  const users = { user: await persona('u', 'user'), superadmin: await persona('s', 'superadmin') }; const BR = await chromium.launch(); const tags = []
  for (const scheme of ['light', 'dark']) for (const lang of ['es', 'en']) for (const [w, h] of [[1360, 900], [390, 800], [320, 568]]) for (const role of ['user', 'superadmin']) {
    if (role === 'superadmin' && (scheme === 'dark' || w === 1360)) continue
    const k = L[lang]; const tag = `${TAG} ${scheme} ${lang} ${w}×${h} ${role}`; tags.push(tag)
    const ctx = await BR.newContext({ viewport: { width: w, height: h }, colorScheme: scheme }); const p = await ctx.newPage(); const errs = []
    p.on('pageerror', (e) => errs.push(e.message.slice(0, 120))); await p.addInitScript(([t, r, l, s]) => { localStorage.setItem('elevation_token', t); localStorage.setItem('elevation_role', r); localStorage.setItem('elv_lang', l); localStorage.setItem('elv_theme', s) }, [users[role].token, role, lang, scheme])
    await p.goto(BASE + '/app/chat', { waitUntil: 'networkidle' }); await p.locator('.chat-menu-btn, button:has-text("Menú"), button:has-text("Menu")').first().waitFor({ timeout: 20000 }); await sleep(900)
    // ── B2 barra
    const bar = await p.evaluate(() => { const vis = (e) => e.getClientRects().length > 0; const r = (e) => { const b = e.getBoundingClientRect(); return { w: Math.round(b.width), h: Math.round(b.height) } }
      const h1s = [...document.querySelectorAll('h1')].filter(vis); const h1 = document.querySelector('.space-chatbar-head h1, .space-chatbar-head h2'); const btn = document.querySelector('.chat-menu-btn')
      const pause = [...document.querySelectorAll('.space-chatbar button')].find((b) => /pausar|pause|reanudar|resume/i.test(b.innerText)); const meter = document.querySelector('.space-meter i'); const usage = document.querySelector('.space-usage p, .space-usage-desktop, .space-usage span, .space-usage')
      const probe = document.createElement('i'); probe.style.color = 'var(--cg-mark)'; (document.querySelector('.space-meter') || document.body).append(probe); const mark = getComputedStyle(probe).color; probe.remove()
      return { h1n: h1s.length, h1t: h1 && h1.innerText, h1tag: h1 && h1.tagName, h1w: h1 && getComputedStyle(h1).fontWeight, h1f: h1 && getComputedStyle(h1).fontFamily.slice(0, 60), h1s: h1 && parseFloat(getComputedStyle(h1).fontSize), h1x: h1 && getComputedStyle(h1).textTransform,
        btn: btn && r(btn), btnLabel: btn && btn.getAttribute('aria-label'), btnText: btn && btn.innerText.replace(/\s+/g, ' '), btnWordShown: btn && [...btn.children].some((c) => /men/i.test(c.textContent) && getComputedStyle(c).display !== 'none'),
        pauseClass: pause && pause.className, pauseSize: pause && r(pause), pauseFont: pause && getComputedStyle(pause).fontFamily.slice(0, 50), pauseW: pause && getComputedStyle(pause).fontWeight,
        meter: meter && getComputedStyle(meter).backgroundColor, mark, usageFont: usage && getComputedStyle(usage).fontFamily.slice(0, 50), usageCase: usage && getComputedStyle(usage).textTransform, usageText: usage && usage.innerText.replace(/\s+/g, ' ').slice(0, 90), overX: document.documentElement.scrollWidth - innerWidth } })
    info(`M5 barra ${tag}`, JSON.stringify(bar))
    if (TAG === 'pr') {
      ck(`M5 un solo h1 visible «${k.conv}» en la barra (${tag})`, bar.h1n === 1 && bar.h1tag === 'H1' && bar.h1t.toLowerCase().includes(k.conv.toLowerCase().slice(0, 8)), `${bar.h1n} h1; ${bar.h1tag} «${bar.h1t}»`)
      ck(`M5 h1: 700, condensada, ≈ 1,05 rem (${tag})`, bar.h1w === '700' && /condensed/i.test(bar.h1f) && bar.h1s >= 16 && bar.h1s <= 19, `${bar.h1w} ${bar.h1f} ${bar.h1s}px`)
      ck(`M5 ☰ ≥ 46×46 y nombre accesible «${k.menu}» (${tag})`, bar.btn && bar.btn.w >= 46 && bar.btn.h >= 46 && bar.btnLabel === k.menu, `${bar.btn && bar.btn.w}×${bar.btn && bar.btn.h} «${bar.btnLabel}»`)
      ck(`M5 palabra «Menú» visible solo a ≥ 901 px (${tag})`, bar.btnWordShown === (w >= 901), `visible=${bar.btnWordShown}`)
      ck(`M5 «Pausar» = ghost de Cartografía ≥ 46 px, sin monoespaciada (${tag})`, /cg-btn--ghost/.test(bar.pauseClass || '') && bar.pauseSize.h >= 46 && !/mono|Cascadia/i.test(bar.pauseFont), `${bar.pauseClass} ${bar.pauseSize && bar.pauseSize.h}px ${bar.pauseFont}`)
      ck(`M5 barra de uso con --cg-mark (${tag})`, bar.meter === bar.mark, `${bar.meter} vs ${bar.mark}`)
      ck(`M5 texto de uso en sans y sin mayúsculas forzadas (${tag})`, !bar.usageFont || (!/mono|Cascadia/i.test(bar.usageFont) && bar.usageCase === 'none'), `${bar.usageFont} ${bar.usageCase} «${bar.usageText}»`)
    }
    ck(`sin desborde horizontal en la pantalla (${tag})`, bar.overX <= 0, bar.overX + ' px')
    // ── B1 menú
    const btn = p.locator('.chat-menu-btn').first(); await btn.focus(); await btn.click(); await p.locator('dialog[open]').waitFor(); await sleep(450)
    const snap = async () => p.evaluate(() => { const d = document.querySelector('dialog[open]'); const vis = (e) => e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden'; const lab = (e) => (e.getAttribute('aria-label') || e.innerText || (e.closest('label') && e.closest('label').innerText) || e.value || '').replace(/\s+/g, ' ').trim()
      const ctr = [...d.querySelectorAll('button, a[href], input, select, textarea, [role=button], [role=radio], [role=tab]')].filter(vis).map(lab); const heads = [...d.querySelectorAll('h2, h3, [role=heading]')].filter(vis).map((e) => e.tagName + ':' + e.innerText.trim())
      const r = d.getBoundingClientRect(); const foot = d.querySelector('.cg-dialog__actions'); const head = d.querySelector('.cg-dialog__head'); const body = d.querySelector('.cg-dialog__body'); const fr = foot && foot.getBoundingClientRect(); const hr = head && head.getBoundingClientRect()
      return { ctr, heads, rect: { t: Math.round(r.top), b: Math.round(r.bottom), l: Math.round(r.left), r: Math.round(r.right) }, vh: innerHeight, vw: innerWidth, footIn: !!fr && fr.top >= 0 && fr.bottom <= innerHeight + 1, headIn: !hr || (hr.top >= 0 && hr.bottom <= innerHeight), scrolls: body ? body.scrollHeight - body.clientHeight : null, footText: foot ? foot.innerText.replace(/\s+/g, ' ') : '', headText: head ? head.innerText.replace(/\s+/g, ' ') : '', active: document.activeElement && lab(document.activeElement), activeInDialog: d.contains(document.activeElement), overX: document.documentElement.scrollWidth - innerWidth } })
    const s1 = await snap(); info(`M1 menú cerrado-despliegue ${tag}`, JSON.stringify({ n: s1.ctr.length, heads: s1.heads, head: s1.headText, foot: s1.footText, active: s1.active }))
    if (TAG === 'pr') {
      const heads = s1.heads.map((x) => x.split(':')[1]); const ord = [k.menu, k.conv, k.main, k.prefs].map((t) => heads.findIndex((x) => x.toLowerCase() === t.toLowerCase()))
      ck(`M1 orden Menú → Conversación → Principal → Preferencias (${tag})`, ord.every((v, i) => v >= 0 && (i === 0 || v > ord[i - 1])), heads.join(' | '))
      ck(`M1 cabecera «${k.menu}» + «${k.close}» arriba y pie «${k.out}» fijos (${tag})`, new RegExp(k.close, 'i').test(s1.headText) && new RegExp(k.out, 'i').test(s1.footText) && s1.footIn && s1.headIn, `head «${s1.headText}» foot «${s1.footText}» pie dentro ${s1.footIn}`)
      const prog = s1.ctr.filter((c) => c.toLowerCase() === k.progress.toLowerCase()).length; ck(`M2 «${k.progress}» UNA sola vez (${tag})`, prog === 1, prog + ' veces')
      ck(`M2 «Recomendaciones», nota de uso y «Enter envía» presentes (${tag})`, s1.ctr.some((c) => k.recs.test(c)) && s1.ctr.some((c) => k.enter.test(c)), '')
      const admin = s1.ctr.some((c) => k.admin.test(c)); ck(`M2 «Administración» solo con rol (${tag})`, admin === (role === 'superadmin'), `admin visible=${admin}`)
      const nClosed = s1.ctr.length; ck(`M2 controles con «${k.user}» plegado: ${role === 'superadmin' ? 17 : 16} (${tag})`, nClosed === (role === 'superadmin' ? 17 : 16), nClosed + '')
      const disc = p.locator('dialog[open] .chat-menu-disc'); ck(`M1 «${k.user}» plegado al abrir (aria-expanded=false) (${tag})`, (await disc.getAttribute('aria-expanded')) === 'false', '')
      ck(`M2 idioma y tema solo dentro de «Preferencias» (${tag})`, s1.ctr.filter((c) => /^(ES|EN)$/.test(c)).length === 2 && (await p.locator('.space-chatbar, .chat-top').locator('button', { hasText: /^(ES|EN)$/ }).count()) === 0, '')
      ck(`M3 posición de la hoja (${tag})`, w <= 900 ? Math.abs(s1.rect.b - s1.vh) <= 2 : (s1.rect.t > 0 && s1.rect.b < s1.vh && Math.abs((s1.rect.t + s1.rect.b) / 2 - s1.vh / 2) < s1.vh * 0.12), JSON.stringify(s1.rect) + ' vh ' + s1.vh)
      ck(`M3 sin desborde horizontal con el menú abierto (${tag})`, s1.overX <= 0, s1.overX + ' px')
      ck(`M4 el foco entra en el menú (${tag})`, s1.activeInDialog, `foco en «${s1.active}»`)
      // despliegue
      await disc.click(); await sleep(250); const s2 = await snap(); ck(`M2 desplegado: ${role === 'superadmin' ? 27 : 26} controles (${tag})`, s2.ctr.length === (role === 'superadmin' ? 27 : 26), s2.ctr.length + ''); ck(`M1 aria-expanded=true al desplegar y el pie sigue visible (${tag})`, (await disc.getAttribute('aria-expanded')) === 'true' && s2.footIn, '')
      await p.screenshot({ path: path.join(OUT, `es342b-${tag.replace(/[^a-z0-9]+/gi, '_')}-desplegado.png`) })
      const ax2 = await (async () => { await p.evaluate(AXE); return p.evaluate(async () => (await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } })).violations.map((v) => v.id + ':' + v.nodes.length)) })(); ck(`M9 axe desplegado = 0 (${tag})`, ax2.length === 0, ax2.join(','))
      await disc.click(); await sleep(150)
      // teclado
      const seq = []; await p.evaluate(() => { const d = document.querySelector('dialog[open]'); const c = d.querySelector('.cg-dialog__head button') || d.querySelector('button'); c && c.focus() })
      for (let i = 0; i < 45; i++) { const a = await p.evaluate(() => { const d = document.querySelector('dialog[open]'); const e = document.activeElement; return { l: (e.getAttribute('aria-label') || e.innerText || (e.closest('label') && e.closest('label').innerText) || e.value || '').replace(/\s+/g, ' ').trim(), inside: d.contains(e) } }); seq.push(a); if (i > 2 && seq[0].l === a.l) break; await p.keyboard.press('Tab') }
      ck(`M4 Tab atrapado dentro del menú y cíclico (${tag})`, seq.every((a) => a.inside) && seq.length > 6, `${seq.length} pasos; fuera: ${seq.filter((a) => !a.inside).length}`)
      const order = seq.slice(0, seq.length - 1).map((a) => a.l); info(`M4 orden de Tab ${tag}`, order.join(' → '))
      const iClose = order.findIndex((x) => x.toLowerCase() === k.close.toLowerCase()), iMain = order.findIndex((x) => /mapa|map$/i.test(x)), iDisc = order.findIndex((x) => x.toLowerCase().startsWith(k.user.toLowerCase())), iEs = order.findIndex((x) => x === 'ES'), iOut = order.findIndex((x) => x.toLowerCase() === k.out.toLowerCase())
      ck(`M4 orden pedido: Cerrar → … → Principal → despliegue → idioma → … → Cerrar sesión (${tag})`, iClose === 0 && iMain > iClose && iDisc > iMain && iEs > iDisc && iOut === order.length - 1 || (iClose === 0 && iOut === order.length - 1 && iMain > 0 && iDisc > iMain && iEs > iDisc), `Cerrar ${iClose}, Mapa ${iMain}, despliegue ${iDisc}, ES ${iEs}, Cerrar sesión ${iOut} de ${order.length}`)
      await p.evaluate(() => { const d = document.querySelector('dialog[open]'); (d.querySelector('.cg-dialog__head button') || d.querySelector('button')).focus() }); await p.keyboard.press('Shift+Tab'); const back = await p.evaluate(() => { const e = document.activeElement; return (e.getAttribute('aria-label') || e.innerText || '').replace(/\s+/g, ' ').trim() })
      ck(`M4 Shift+Tab desde el primero va al último («${k.out}») (${tag})`, back.toLowerCase() === k.out.toLowerCase(), `«${back}»`)
      await p.keyboard.press('Escape'); await sleep(350); const closed = (await p.locator('dialog[open]').count()) === 0; const ret = await p.evaluate(() => document.activeElement && document.activeElement.className)
      ck(`M4 Esc cierra y devuelve el foco al botón Menú (${tag})`, closed && /chat-menu-btn/.test(ret || ''), `cerrado=${closed} foco=${ret}`)
      await btn.click(); await p.locator('dialog[open]').waitFor(); await sleep(250); ck(`M1 al reabrir el despliegue vuelve plegado (${tag})`, (await p.locator('dialog[open] .chat-menu-disc').getAttribute('aria-expanded')) === 'false', '')
      const ax1 = await (async () => { await p.evaluate(AXE); return p.evaluate(async () => (await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } })).violations.map((v) => v.id + ':' + v.nodes.length)) })(); ck(`M9 axe menú cerrado-despliegue = 0 (${tag})`, ax1.length === 0, ax1.join(','))
    } else { // control: lo que main ofrece (para comparar funciones)
      const items = s1.ctr; fs.writeFileSync(path.join(OUT, `main-controles-${scheme}-${lang}-${w}-${role}.json`), JSON.stringify(items))
    }
    if (TAG === 'pr') fs.writeFileSync(path.join(OUT, `pr-controles-${scheme}-${lang}-${w}-${role}.json`), JSON.stringify(await (async () => { await p.locator('dialog[open] .chat-menu-disc').click(); await sleep(200); return (await snap()).ctr })()))
    ck(`sin excepciones de página (${tag})`, errs.length === 0, errs.join(' | ')); await ctx.close()
  }
  // CLS a 390 con CPU×4 al abrir y desplegar
  for (const lang of ['es', 'en']) { const ctx = await BR.newContext({ viewport: { width: 390, height: 800 } }); const p = await ctx.newPage(); await p.addInitScript(([t, l]) => { localStorage.setItem('elevation_token', t); localStorage.setItem('elv_lang', l); window.__cls = 0; new PerformanceObserver((list) => { for (const e of list.getEntries()) if (!e.hadRecentInput) window.__cls += e.value }).observe({ type: 'layout-shift', buffered: true }) }, [users.user.token, lang])
    const cdp = await ctx.newCDPSession(p); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 }); await p.goto(BASE + '/app/chat', { waitUntil: 'networkidle' }); await sleep(1200); await p.locator('.chat-menu-btn').first().click(); await sleep(600)
    const d = p.locator('dialog[open] .chat-menu-disc'); if (await d.count()) { await d.click(); await sleep(500) }; const cls = await p.evaluate(() => window.__cls); ck(`M9 CLS ≤ 0,1 a 390 px con CPU×4 al abrir y desplegar (${TAG} ${lang})`, cls <= 0.1, cls.toFixed(4)); await ctx.close() }
  await BR.close(); fs.writeFileSync(path.join(OUT, `es342b-${TAG}.json`), JSON.stringify(results, null, 1)); console.log(`RESUMEN ${TAG}: ${results.filter((r) => 'ok' in r).length - fails}/${results.filter((r) => 'ok' in r).length} OK, ${fails} fallan`)
})().catch((e) => { console.error('ERROR', e.stack.slice(0, 600)); process.exit(1) })
