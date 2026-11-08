// QA-Claude-2 — comprobación puntual en STAGING: foco inicial y solapamiento de encabezado (solo lectura). Lee claves del archivo local sin imprimirlas.
const fs = require('fs'); const { chromium } = require(process.env.PLAYWRIGHT_MODULE); const BASE = process.env.STAGING_URL.replace(/\/$/, '')
if (!/^https:\/\/backend-staging-/.test(BASE)) process.exit(2)
const lines = fs.readFileSync(process.env.CRED_FILE, 'utf8').split(/\r?\n/)
const sec = e => { const l = lines.find(x => x.includes(e)); return l.slice(l.indexOf(e) + e.length).replace(/^[\s:=|,;\-–>]+/, '').replace(/^(?:clave|contraseña|password)\s*[:=]\s*/i, '').split(/\s{2,}/)[0].trim() }
;(async () => {
  const b = await chromium.launch()
  for (const [email, role, path] of [['qa.persona@example.test', 'user', '/app/dashboard'], ['qa.terapeuta@example.test', 'therapist', '/therapist/dashboard'], ['qa.admin@example.test', 'admin', '/admin/users']]) {
    const r = await fetch(BASE + '/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: sec(email) }) }); const j = await r.json(); await new Promise(s => setTimeout(s, 700))
    for (const w of [390, 1440]) {
      const c = await b.newContext({ viewport: { width: w, height: 900 }, isMobile: w < 500 }); await c.addInitScript(([t, ro]) => { localStorage.setItem('elevation_token', t); localStorage.setItem('elevation_role', ro); localStorage.setItem('elv_lang', 'es') }, [j.token, role])
      const p = await c.newPage(); await p.goto(BASE + path, { waitUntil: 'networkidle' }); await p.waitForTimeout(1200)
      const m = await p.evaluate(() => { const a = document.activeElement, h = document.querySelector('h1, h2'), hd = document.querySelector('header'); const hr = hd && hd.getBoundingClientRect(), tr = h && h.getBoundingClientRect(); return { active: a === document.body ? 'body' : (a.tagName + ' «' + (a.innerText || a.getAttribute('aria-label') || '').trim().slice(0, 30) + '»'), headerBottom: hr && Math.round(hr.bottom), titleTop: tr && Math.round(tr.top), title: h && h.innerText.slice(0, 30), position: hd && getComputedStyle(hd).position } })
      console.log(`${role} ${w}px ${path}: foco inicial=${m.active} | encabezado(${m.position}) termina en ${m.headerBottom}px, «${m.title}» empieza en ${m.titleTop}px ${m.headerBottom > m.titleTop + 4 ? '→ SOLAPA' : ''}`); await c.close()
    }
  }
  await b.close()
})().catch(e => { console.error('EXCEPCIÓN', e.message); process.exit(3) })
