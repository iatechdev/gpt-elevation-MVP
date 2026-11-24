import { chromium } from 'file:///C:/Users/Usuario/tools/playwright/node_modules/playwright/index.mjs'
import fs from 'fs'
const BASE = 'https://backend-staging-e3a6.up.railway.app'
const PW = fs.readFileSync(process.argv[2], 'utf8').trim()
const r = await fetch(BASE + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'qa-sint-ux-es@example.test', password: PW }) })
const s = await r.json()
const b = await chromium.launch()
const out = {}
async function ctx(w, h, auth = true) {
  const c = await b.newContext({ viewport: { width: w, height: h } })
  await c.addInitScript(([s, auth]) => { try { localStorage.setItem('elv_lang', 'es'); if (auth) { localStorage.setItem('elevation_token', s.token); localStorage.setItem('elevation_role', s.role); localStorage.setItem('elevation_name', s.name || '') } } catch {} }, [s, auth])
  return c
}
// 1) privacidad/terminos: carga con 'load' y tiempos; peticiones pendientes
for (const p of ['/privacidad', '/terminos']) {
  const c = await ctx(1440, 900, false); const pg = await c.newPage()
  const pend = new Set(); pg.on('request', q => pend.add(q.url())); pg.on('requestfinished', q => pend.delete(q.url())); pg.on('requestfailed', q => pend.delete(q.url()))
  const t0 = Date.now(); await pg.goto(BASE + p, { waitUntil: 'load', timeout: 45000 }); const tLoad = Date.now() - t0
  await pg.waitForTimeout(8000)
  const m = await pg.evaluate(() => { const mn = document.querySelector('main'); const r = mn.getBoundingClientRect(); const lg = mn.querySelector('.lg, article, section'); const lr = lg ? lg.getBoundingClientRect() : null; const ps = [...mn.querySelectorAll('p,li')].filter(e => e.textContent.length > 80).slice(0, 30); const cpl = ps.map(e => { const cs = getComputedStyle(e); const lh = parseFloat(cs.lineHeight) || 20; const ln = Math.max(1, Math.round(e.getBoundingClientRect().height / lh)); return ln > 1 ? Math.round(e.textContent.length / ln) : 0 }).filter(Boolean).sort((a, b) => a - b); return { mainL: r.left, mainW: r.width, colL: lr && lr.left, colW: lr && lr.width, cplMed: cpl[Math.floor(cpl.length / 2)], h1: document.querySelector('h1')?.textContent, docH: document.documentElement.scrollHeight } })
  out[p] = { tLoad, pendientesTras8s: [...pend].slice(0, 5), ...m }
  await pg.screenshot({ path: process.argv[3] + '/capturas/' + p.slice(1) + '_es-light_1440.jpg', type: 'jpeg', quality: 55, fullPage: true }).catch(() => {})
  await c.close()
}
// 2) progreso y feedback: por que main 15px mas angosto
for (const p of ['/app/progress', '/app/feedback', '/app/dashboard']) {
  const c = await ctx(1440, 900); const pg = await c.newPage(); await pg.goto(BASE + p, { waitUntil: 'load' }); await pg.waitForTimeout(3000)
  out[p] = await pg.evaluate(() => { const d = document.documentElement; const wide = [...document.querySelectorAll('body *')].filter(e => e.getBoundingClientRect().width > 0 && getComputedStyle(e).overflowY !== 'visible' && e.scrollHeight > e.clientHeight + 2).slice(0, 4).map(e => e.tagName + '.' + (e.className + '').slice(0, 30) + ' ' + getComputedStyle(e).overflowY); return { clientW: d.clientWidth, innerW: innerWidth, scrollW: d.scrollWidth, htmlOverflow: getComputedStyle(d).overflow, bodyOverflow: getComputedStyle(document.body).overflow, scrollbarGutter: getComputedStyle(d).scrollbarGutter, scrollers: wide, bodyW: document.body.getBoundingClientRect().width } })
  await c.close()
}
// 3) alcanzabilidad de la barra lateral con altura corta
for (const [p, h] of [['/app/dashboard', 700], ['/app/chat', 700], ['/app/chat', 900], ['/app/diary', 700]]) {
  const c = await ctx(1440, h); const pg = await c.newPage(); await pg.goto(BASE + p, { waitUntil: 'load' }); await pg.waitForTimeout(2500)
  await pg.evaluate(() => window.scrollTo(0, 1e6)); await pg.waitForTimeout(400)
  out[p + '@' + h] = await pg.evaluate(() => { const links = [...document.querySelectorAll('.cg-side--groups a')]; const last = links[links.length - 1]; const r = last.getBoundingClientRect(); const side = document.querySelector('.cg-side--groups'); const sr = side.getBoundingClientRect(); return { vh: innerHeight, docH: document.documentElement.scrollHeight, scrollY: scrollY, enlaces: links.length, ultimo: last.textContent, ultimoTop: Math.round(r.top), ultimoBottom: Math.round(r.bottom), barraAlto: Math.round(sr.height), barraTop: Math.round(sr.top), ultimoVisible: r.bottom <= innerHeight && r.top >= 0 } })
  await c.close()
}
// 4) chat: alto y desplazamiento
{
  const c = await ctx(1440, 900); const pg = await c.newPage(); await pg.goto(BASE + '/app/chat', { waitUntil: 'load' }); await pg.waitForTimeout(2500)
  out.chat = await pg.evaluate(() => { const sh = document.querySelector('.chat-shell'); const cs = getComputedStyle(sh); const hdr = document.querySelector('.cg-header'); return { shellH: sh.getBoundingClientRect().height, shellTop: sh.getBoundingClientRect().top, vh: innerHeight, docH: document.documentElement.scrollHeight, cgHeaderH: hdr && hdr.getBoundingClientRect().height, chatHeaderH: document.querySelector('.chat-header')?.getBoundingClientRect().height, footerVisible: !!document.querySelector('.cg-footer'), footerTop: document.querySelector('.cg-footer')?.getBoundingClientRect().top, shellOverflow: cs.overflow, shellHeightCss: cs.height } })
  await c.close()
}
// 5) tamanos de fuente minimos por pantalla clave (texto visible < 13px)
for (const p of ['/', '/app/dashboard', '/app/chat', '/manifiesto']) {
  const c = await ctx(1440, 900, p !== '/' && p !== '/manifiesto'); const pg = await c.newPage(); await pg.goto(BASE + p, { waitUntil: 'load' }); await pg.waitForTimeout(2500)
  out['fs' + p] = await pg.evaluate(() => { const m = {}; for (const e of document.querySelectorAll('body *')) { if (![...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim().length > 2)) continue; const r = e.getBoundingClientRect(); if (!r.width) continue; const f = parseFloat(getComputedStyle(e).fontSize); if (f < 13) { const k = f + 'px'; m[k] = (m[k] || 0) + 1 } } return m })
  await c.close()
}
fs.writeFileSync(process.argv[3] + '/probe2.json', JSON.stringify(out, null, 1))
console.log(JSON.stringify(out, null, 1))
await b.close()
