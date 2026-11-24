import { chromium } from 'file:///C:/Users/Usuario/tools/playwright/node_modules/playwright/index.mjs'
import fs from 'fs'
const BASE = 'https://backend-staging-e3a6.up.railway.app'
const PW = fs.readFileSync(process.argv[2], 'utf8').trim()
const r = await fetch(BASE + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'qa-sint-ux-es@example.test', password: PW }) })
const s = await r.json()
const b = await chromium.launch(); const out = {}
const mk = async (w, h) => { const c = await b.newContext({ viewport: { width: w, height: h } }); await c.addInitScript(([s]) => { try { localStorage.setItem('elv_lang', 'es'); localStorage.setItem('elevation_token', s.token); localStorage.setItem('elevation_role', s.role); localStorage.setItem('elevation_name', s.name || '') } catch {} }, [s]); return c }
const pc = () => [...document.querySelectorAll('.pc-link')].map(e => Math.round(e.getBoundingClientRect().height))
// A: entrada directa a /app/dashboard
{ const c = await mk(1440, 900); const p = await c.newPage(); await p.goto(BASE + '/app/dashboard', { waitUntil: 'load' }); await p.waitForTimeout(2500); out.pcLink_directo = await p.evaluate(pc); out.hojasCss_directo = await p.evaluate(() => document.styleSheets.length); await c.close() }
// B: llegar a /app/dashboard desde otra ruta (SPA): primero /app/next-step, luego clic en Mi panel
{ const c = await mk(1440, 900); const p = await c.newPage(); await p.goto(BASE + '/app/next-step', { waitUntil: 'load' }); await p.waitForTimeout(2500); const n0 = await p.evaluate(() => document.styleSheets.length); await p.click('.cg-side--groups a[href="/app/dashboard"]'); await p.waitForTimeout(2500); out.pcLink_spa = await p.evaluate(pc); out.hojasCss_spa = [n0, await p.evaluate(() => document.styleSheets.length)]; await c.close() }
// C: contenedores internos de la portada a 1440
{ const c = await b.newContext({ viewport: { width: 1440, height: 900 } }); const p = await c.newPage(); await p.goto(BASE + '/', { waitUntil: 'load' }); await p.waitForTimeout(3500)
  out.portada = await p.evaluate(() => { const seen = new Map(); for (const e of document.querySelectorAll('main *')) { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); if (r.width > 300 && r.width < 1300 && /^(section|div|article|ul|header|footer)$/i.test(e.tagName) && (cs.marginLeft !== '0px' || cs.maxWidth !== 'none')) { const k = Math.round(r.width) + ' L' + Math.round(r.left) + ' maxW ' + cs.maxWidth; if (!seen.has(k)) seen.set(k, e.className.toString().slice(0, 40)) } } return [...seen.entries()].slice(0, 25) }); await c.close() }
fs.writeFileSync(process.argv[3], JSON.stringify(out, null, 1)); console.log(JSON.stringify(out, null, 1)); await b.close()
