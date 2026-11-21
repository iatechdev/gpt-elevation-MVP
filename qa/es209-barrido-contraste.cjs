// QA-Claude-2 — ES-209 (PR #142): barrido de contraste de TEXTO renderizado (colores computados) con datos sintéticos de staging.
// El front del head (o de main) corre en local (vite) y su /api se proxifica a staging; solo lectura. No imprime claves ni tokens.
// Env: APP_URL (http://localhost:5173), STAGING_URL, CRED_FILE, PLAYWRIGHT_MODULE, LABEL.
const fs = require('fs'); const { chromium } = require(process.env.PLAYWRIGHT_MODULE); const APP = process.env.APP_URL.replace(/\/$/, ''), BASE = process.env.STAGING_URL.replace(/\/$/, '')
if (!/^https:\/\/backend-staging-/.test(BASE)) process.exit(2)
const lines = fs.readFileSync(process.env.CRED_FILE, 'utf8').split(/\r?\n/)
const sec = e => { const l = lines.find(x => x.includes(e)); return l.slice(l.indexOf(e) + e.length).replace(/^[\s:=|,;\-–>]+/, '').replace(/^(?:clave|contraseña|password)\s*[:=]\s*/i, '').split(/\s{2,}/)[0].trim() }
const ACC = { persona: ['qa.persona@example.test', 'user'], terapeuta: ['qa.terapeuta@example.test', 'therapist'], admin: ['qa.admin@example.test', 'admin'], superadmin: ['qa.superadmin@example.test', 'superadmin'] }
const PAGES = {
  persona: ['/app/dashboard', '/app/chat', '/app/checkin', '/app/diary', '/app/skill-map', '/app/compass', '/app/exercises', '/app/data', '/app/my-therapist', '/app/progress', '/app/evidence', '/app/route-catalog', '/app/bridge'],
  terapeuta: ['/therapist/dashboard', '/facilitation'],
  admin: ['/admin/dashboard', '/admin/users', '/admin/content', '/admin/prompts', '/admin/metrics', '/admin/skill-catalog', '/admin/route-catalog'],
  superadmin: ['/admin/dashboard', '/admin/users', '/admin/content', '/admin/prompts', '/admin/metrics', '/board'],
}
const lum = c => { const [r, g, b] = c.match(/[\d.]+/g).slice(0, 3).map(Number).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }); return 0.2126 * r + 0.7152 * g + 0.0722 * b }
const cr = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }
;(async () => {
  const tokens = {}
  for (const [k, [email, role]] of Object.entries(ACC)) { const r = await fetch(BASE + '/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: sec(email) }) }); const j = await r.json().catch(() => ({})); if (r.status !== 200) { console.log('login', k, r.status); process.exit(1) } tokens[k] = j.token; await new Promise(s => setTimeout(s, 800)) }
  const b = await chromium.launch(); const bad = new Map(); let screens = 0, combos = 0
  for (const role of Object.keys(PAGES)) for (const lang of ['es', 'en']) for (const w of [390, 1440]) {
    const c = await b.newContext({ viewport: { width: w, height: 900 }, isMobile: w < 500 }); await c.addInitScript(([t, ro, l]) => { localStorage.setItem('elevation_token', t); localStorage.setItem('elevation_role', ro); localStorage.setItem('elv_lang', l) }, [tokens[role], ACC[role][1], lang])
    // CORS: el front corre en localhost y su API es staging; se añaden las cabeceras CORS solo en este navegador de prueba (no se toca staging).
    await c.route(BASE + '/api/**', async route => { const h = { 'access-control-allow-origin': APP, 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS' }; if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: h }); const r = await route.fetch(); await route.fulfill({ response: r, headers: { ...r.headers(), ...h } }) })
    const p = await c.newPage()
    for (const path of PAGES[role]) {
      await p.goto(APP + path, { waitUntil: 'networkidle' }).catch(() => {}); await p.waitForTimeout(900); screens++
      const items = await p.evaluate(() => { const out = [], seen = new Set(), bgOf = e => { let n = e; while (n) { const b = getComputedStyle(n).backgroundColor; if (!/rgba\(0, 0, 0, 0\)|transparent/.test(b)) return b; n = n.parentElement } return 'rgb(255,255,255)' }
        for (const e of document.querySelectorAll('body *')) { if (![...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) continue; const r = e.getBoundingClientRect(); if (r.width === 0 || r.height === 0) continue; const cs = getComputedStyle(e); if (cs.visibility === 'hidden' || cs.opacity === '0' || e.closest('[aria-hidden="true"]')) continue; if (e.matches(':disabled, [aria-disabled="true"]')) continue
          const key = cs.color + '|' + bgOf(e) + '|' + cs.fontSize + '|' + cs.fontWeight; if (seen.has(key)) continue; seen.add(key); out.push({ c: cs.color, b: bgOf(e), s: parseFloat(cs.fontSize), w: cs.fontWeight, t: e.innerText.trim().slice(0, 30) }) } return out })
      combos += items.length
      for (const x of items) { const need = (x.s >= 24 || (x.s >= 18.66 && +x.w >= 700)) ? 3 : 4.5; const r = cr(x.c, x.b); if (r < need) { const k = `${x.c} sobre ${x.b} ${x.s}px`; const e = bad.get(k) || { ratio: r.toFixed(2), n: 0, ej: [] }; e.n++; if (e.ej.length < 3) e.ej.push(`${role}/${lang}/${w}${path}: «${x.t}»`); bad.set(k, e) } }
    }
    await c.close()
  }
  await b.close()
  console.log(`${process.env.LABEL || 'barrido'}: ${screens} pantallas, ${combos} combinaciones de color/tamaño medidas, ${bad.size} combinaciones por debajo de AA`)
  for (const [k, v] of [...bad.entries()].sort((a, b) => b[1].n - a[1].n)) console.log(` ${v.ratio}:1 x${v.n} ${k} | ${v.ej.join(' ; ')}`)
  process.exit(0)
})().catch(e => { console.error('EXCEPCIÓN', e.stack?.slice(0, 300)); process.exit(3) })
