// QA-Claude-2 — ES-152/153 verificación posterior en STAGING: saltar al contenido, teclado, textos pendientes (ES-204/206), contraste y rutas antiguas. Solo lectura.
const fs = require('fs'); const { chromium } = require(process.env.PLAYWRIGHT_MODULE); const BASE = process.env.STAGING_URL.replace(/\/$/, '')
if (!/^https:\/\/backend-staging-/.test(BASE)) process.exit(2)
const lines = fs.readFileSync(process.env.CRED_FILE, 'utf8').split(/\r?\n/)
const sec = e => { const l = lines.find(x => x.includes(e)); return l.slice(l.indexOf(e) + e.length).replace(/^[\s:=|,;\-–>]+/, '').replace(/^(?:clave|contraseña|password)\s*[:=]\s*/i, '').split(/\s{2,}/)[0].trim() }
const lum = c => { const [r, g, b] = c.match(/[\d.]+/g).slice(0, 3).map(Number).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }); return 0.2126 * r + 0.7152 * g + 0.0722 * b }
const cr = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }
const ACC = { persona: ['qa.persona@example.test', 'user', '/app/dashboard'], terapeuta: ['qa.terapeuta@example.test', 'therapist', '/therapist/dashboard'], admin: ['qa.admin@example.test', 'admin', '/admin/users'], superadmin: ['qa.superadmin@example.test', 'superadmin', '/admin/dashboard'] }
let f = 0; const ck = (n, ok, x = '') => { if (!ok) f++; console.log((ok ? 'OK   ' : 'FALLA ') + n, x) }
const login = async email => { const r = await fetch(BASE + '/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: sec(email) }) }); const j = await r.json(); await new Promise(s => setTimeout(s, 800)); return j }
;(async () => {
  const b = await chromium.launch()
  for (const [k, [email, role, path]] of Object.entries(ACC)) {
    const j = await login(email)
    for (const [lang, w] of [['es', 1440], ['es', 390], ['en', 1440]]) {
      const c = await b.newContext({ viewport: { width: w, height: 900 }, isMobile: w < 500 })
      await c.addInitScript(([t, ro, l]) => { localStorage.setItem('elevation_token', t); localStorage.setItem('elevation_role', ro); localStorage.setItem('elv_lang', l) }, [j.token, role, lang])
      const p = await c.newPage(); await p.goto(BASE + path, { waitUntil: 'networkidle' }); await p.waitForTimeout(1000); const tag = `${k} ${lang} ${w}px`
      const o = await p.evaluate(() => { const h = document.querySelector('header'), t = document.querySelector('h1, h2'); const hb = h && h.getBoundingClientRect().bottom, tt = t && t.getBoundingClientRect().top; return { fixed: h && getComputedStyle(h).position, hb: Math.round(hb), tt: Math.round(tt), title: t && t.innerText.slice(0, 25) } })
      ck(`F3 ${tag}: el encabezado no tapa el título «${o.title}»`, !(o.fixed === 'fixed' || o.fixed === 'sticky') || o.hb <= o.tt + 2, `encabezado ${o.fixed} hasta ${o.hb}px, título en ${o.tt}px`)
      await p.keyboard.press('Tab'); const sk = await p.evaluate(() => { const e = document.activeElement; return { t: (e.innerText || e.getAttribute('aria-label') || '').trim().slice(0, 30), href: e.getAttribute('href') } })
      ck(`F3/F4 ${tag}: primer Tab = «Saltar al contenido»`, /saltar|skip/i.test(sk.t), JSON.stringify(sk))
      if (/saltar|skip/i.test(sk.t)) { await p.keyboard.press('Enter'); await p.waitForTimeout(200); const mv = await p.evaluate(() => { const a = document.activeElement; return !!a && (a.id === 'main' || a.tagName === 'MAIN' || !!a.closest('main')) }); ck(`F4 ${tag}: el salto lleva el foco al contenido principal`, mv) }
      const seen = new Set(); let noOutline = 0
      for (let i = 0; i < 14; i++) { await p.keyboard.press('Tab'); const s = await p.evaluate(() => { const e = document.activeElement, cs = getComputedStyle(e); return { id: e.tagName + (e.innerText || e.getAttribute('aria-label') || '').slice(0, 15), vis: (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || cs.boxShadow !== 'none' } }); seen.add(s.id); if (!s.vis) noOutline++ }
      ck(`F4 ${tag}: la tabulación avanza (≥ 8 elementos distintos) y todos muestran foco visible`, seen.size >= 8 && noOutline === 0, `distintos=${seen.size} sin foco visible=${noOutline}`)
      const txt = await p.locator('body').innerText()
      if (w === 1440) ck(`F3 ${tag}: sin «Sprint 9», «plan requests» ni «THERAPIST» fijos en la interfaz`, lang === 'en' ? !/Sprint 9/.test(txt) : !/Sprint 9|plan requests|THERAPIST/.test(txt), (txt.match(/Sprint 9|plan requests|THERAPIST/gi) || []).join(','))
      const h1 = await p.locator('h1').count(); ck(`F3 ${tag}: exactamente un h1`, h1 === 1, 'h1=' + h1)
      const small = await p.evaluate(() => [...document.querySelectorAll('button, a[href], input:not([type=hidden]), select, textarea')].filter(e => { const r = e.getBoundingClientRect(), s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && (r.height < 24 || r.width < 24) }).map(e => (e.innerText || e.getAttribute('aria-label') || e.tagName).trim().slice(0, 20)))
      if (w < 500) ck(`F3 ${tag}: objetivos táctiles ≥ 24 px`, small.length === 0, small.join(' | '))
      if (w === 1440 && lang === 'es') {
        const low = await p.evaluate(() => { const out = [], seen = new Set(), bgOf = e => { let n = e; while (n) { const b = getComputedStyle(n).backgroundColor; if (!/rgba\(0, 0, 0, 0\)|transparent/.test(b)) return b; n = n.parentElement } return 'rgb(255,255,255)' }
          for (const e of document.querySelectorAll('p, span, li, a, label, td, th, h2, h3, button')) { if (![...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) continue; const r = e.getBoundingClientRect(); if (r.width === 0 || r.height === 0) continue; const cs = getComputedStyle(e); const key = cs.color + '|' + bgOf(e) + '|' + cs.fontSize; if (seen.has(key)) continue; seen.add(key); out.push({ c: cs.color, b: bgOf(e), s: parseFloat(cs.fontSize), w: cs.fontWeight, t: e.innerText.trim().slice(0, 25) }) } return out })
        const bad = low.filter(x => cr(x.c, x.b) < (x.s >= 24 || (x.s >= 18.66 && +x.w >= 700) ? 3 : 4.5))
        ck(`F5 ${tag}: contraste de combinaciones de color/tamaño ≥ AA (${low.length} combinaciones)`, bad.length === 0, bad.slice(0, 4).map(x => `«${x.t}» ${cr(x.c, x.b).toFixed(2)}:1 ${x.s}px`).join(' ; '))
      }
      if (w < 500) { const btn = p.locator('button[aria-expanded]').first(); if (await btn.count()) { await btn.click(); await p.waitForTimeout(300); const open = await btn.getAttribute('aria-expanded'); await p.keyboard.press('Escape'); await p.waitForTimeout(300); const after = await btn.getAttribute('aria-expanded'); ck(`F4 ${tag}: el menú móvil abre y Escape lo cierra`, open === 'true' && after === 'false', `${open}→${after}`) } else console.log(`      ${tag}: sin botón de menú detectable`) }
      await c.close()
    }
  }
  for (const [k, paths] of [['admin', ['/admin/usuarios', '/admin/users', '/facilitation', '/admin/dashboard']], ['persona', ['/dashboard', '/app', '/app/diary/new', '/inexistente-xyz']]]) {
    const [email, role] = ACC[k]; const j = await login(email)
    const c = await b.newContext({ viewport: { width: 1280, height: 800 } }); await c.addInitScript(([t, ro]) => { localStorage.setItem('elevation_token', t); localStorage.setItem('elevation_role', ro); localStorage.setItem('elv_lang', 'es') }, [j.token, role])
    for (const pa of paths) { const p = await c.newPage(); await p.goto(BASE + pa, { waitUntil: 'networkidle' }); await p.waitForTimeout(500); const t = (await p.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 70); ck(`F7 ${k} ${pa} → pantalla clara (no en blanco ni error técnico)`, t.length > 20 && !/Cannot GET|Unexpected token|undefined/.test(t), `${new URL(p.url()).pathname} | «${t}»`); await p.close() }
    await c.close()
  }
  await b.close(); console.log(f ? 'FALLAS ' + f : 'TODO OK')
})().catch(e => { console.error('EXCEPCIÓN', e.message); process.exit(3) })
