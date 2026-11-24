// QA-Claude-2 — ES-153 verificación posterior en STAGING: recorrido de tabulación detallado (admin y persona). Solo lectura; no imprime claves.
const fs = require('fs'); const { chromium } = require(process.env.PLAYWRIGHT_MODULE); const BASE = process.env.STAGING_URL.replace(/\/$/, '')
if (!/^https:\/\/backend-staging-/.test(BASE)) process.exit(2)
const lines = fs.readFileSync(process.env.CRED_FILE, 'utf8').split(/\r?\n/)
const sec = e => { const l = lines.find(x => x.includes(e)); return l.slice(l.indexOf(e) + e.length).replace(/^[\s:=|,;\-–>]+/, '').replace(/^(?:clave|contraseña|password)\s*[:=]\s*/i, '').split(/\s{2,}/)[0].trim() }
const ACC = [['qa.admin@example.test', 'admin', '/admin/users'], ['qa.persona@example.test', 'user', '/app/dashboard'], ['qa.terapeuta@example.test', 'therapist', '/therapist/dashboard']]
;(async () => {
  const b = await chromium.launch()
  for (const [email, role, path] of ACC) {
    const r = await fetch(BASE + '/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: sec(email) }) }); const j = await r.json(); await new Promise(s => setTimeout(s, 800))
    const c = await b.newContext({ viewport: { width: 1440, height: 900 } }); await c.addInitScript(([t, ro]) => { localStorage.setItem('elevation_token', t); localStorage.setItem('elevation_role', ro); localStorage.setItem('elv_lang', 'es') }, [j.token, role])
    const p = await c.newPage(); await p.goto(BASE + path, { waitUntil: 'networkidle' }); await p.waitForTimeout(1000)
    const total = await p.evaluate(() => document.querySelectorAll('a[href], button:not([disabled]), input:not([type=hidden]):not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])').length)
    console.log(`\n== ${role} ${path}: elementos enfocables en el DOM = ${total}`)
    const trail = []
    for (let i = 0; i < 25; i++) { await p.keyboard.press('Tab'); trail.push(await p.evaluate(() => { const e = document.activeElement, cs = getComputedStyle(e), r = e.getBoundingClientRect(); return `${e.tagName}${e.id ? '#' + e.id : ''} «${(e.innerText || e.getAttribute('aria-label') || e.getAttribute('title') || '').trim().slice(0, 22)}» foco=${(cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || cs.boxShadow !== 'none' ? 'visible' : 'NO visible'} y=${Math.round(r.top)}` })) }
    trail.forEach((t, i) => console.log(String(i + 1).padStart(2), t))
    if (role === 'user') { const t = await p.evaluate(() => { const a = document.querySelector('a[href="#space-main"]'); const target = document.getElementById('space-main'); return { link: !!a, target: !!target, tabindex: target && target.getAttribute('tabindex'), tag: target && target.tagName } }); console.log('salto → #space-main:', JSON.stringify(t)) }
    await c.close()
  }
  await b.close()
})().catch(e => { console.error('EXCEPCIÓN', e.message); process.exit(3) })
