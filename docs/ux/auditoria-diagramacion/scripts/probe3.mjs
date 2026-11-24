import { chromium } from 'file:///C:/Users/Usuario/tools/playwright/node_modules/playwright/index.mjs'
import fs from 'fs'
const BASE = 'https://backend-staging-e3a6.up.railway.app'
const PW = fs.readFileSync(process.argv[2], 'utf8').trim()
const screens = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'))
const r = await fetch(BASE + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'qa-sint-ux-es@example.test', password: PW }) })
const s = await r.json()
const b = await chromium.launch()
const out = []
const lum = c => { const m = c.match(/[\d.]+/g); if (!m) return null; const [R, G, B] = m.slice(0, 3).map(Number); return Math.round(0.2126 * R + 0.7152 * G + 0.0722 * B) }
for (const sc of screens) {
  const c = await b.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' })
  await c.addInitScript(([s, auth]) => { try { localStorage.setItem('elv_lang', 'es'); localStorage.setItem('elv_theme', 'dark'); if (auth) { localStorage.setItem('elevation_token', s.token); localStorage.setItem('elevation_role', s.role); localStorage.setItem('elevation_name', s.name || '') } } catch {} }, [s, !!sc.auth])
  const pg = await c.newPage()
  try {
    await pg.goto(BASE + sc.path, { waitUntil: 'load', timeout: 40000 }); await pg.waitForTimeout(1800)
    const m = await pg.evaluate(() => {
      const main = document.querySelector('main'); const walk = e => { for (let p = e; p; p = p.parentElement) { const bg = getComputedStyle(p).backgroundColor; if (bg && !/rgba\(0, 0, 0, 0\)|transparent/.test(bg)) return bg } return 'none' }
      const frame = document.querySelector('.cg-frame, .cg'); const inner = main && main.firstElementChild
      return { frameBg: frame ? getComputedStyle(frame).backgroundColor : null, mainBg: main ? walk(main) : null, mainClass: main ? main.className : null, innerBg: inner ? walk(inner) : null, innerClass: inner ? (inner.className + '').slice(0, 40) : null, text: main ? getComputedStyle(main).color : null, innerText: inner ? getComputedStyle(inner).color : null, theme: document.querySelector('.cg')?.getAttribute('data-theme') }
    })
    out.push({ screen: sc.id, ...m, frameLum: m.frameBg && lum(m.frameBg), innerLum: m.innerBg && lum(m.innerBg), innerTextLum: m.innerText && lum(m.innerText) })
  } catch (e) { out.push({ screen: sc.id, error: String(e).slice(0, 80) }) }
  await c.close()
}
fs.writeFileSync(process.argv[4], JSON.stringify(out, null, 1))
for (const o of out) console.log(o.screen, o.error || `frame ${o.frameLum} inner ${o.innerLum} text ${o.innerTextLum} ${o.mainClass} | ${o.innerClass}`)
await b.close()
