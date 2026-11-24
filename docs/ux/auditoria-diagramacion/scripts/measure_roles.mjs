import { chromium, firefox, webkit } from 'file:///C:/Users/Usuario/tools/playwright/node_modules/playwright/index.mjs'
import fs from 'fs'
const BASE = 'https://backend-staging-e3a6.up.railway.app'
const OUT = process.argv[2]
const PW = ''
const ENGINE = process.env.ENGINE || 'chromium'
const WIDTHS = (process.env.WIDTHS || '1920,1440,1360,1024,768,390,320').split(',').map(Number)
const SCREENS = JSON.parse(fs.readFileSync(process.argv[4], 'utf8'))
const SHOT_FULL = new Set((process.env.SHOT_W || '1920,1440,1024,390,320').split(',').map(Number))
const SHOT_VARIANT_W = new Set([1440, 390])
fs.mkdirSync(OUT + '/capturas', { recursive: true })
const eng = { chromium, firefox, webkit }[ENGINE]
const browser = await eng.launch()
async function token(lang) {
  const r = await fetch(BASE + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: `qa-sint-ux-${lang}@example.test`, password: PW }) })
  const d = await r.json(); return { token: d.token, role: d.role, name: d.name || '' }
}
const sess = {}; for (const a of ['prof','admin','super','board']) { const pw = fs.readFileSync(process.argv[3] + '-' + a, 'utf8').trim(); const r = await fetch(BASE + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'qa-sint-ux-' + a + '@example.test', password: pw }) }); const d = await r.json(); sess[a] = { token: d.token, role: d.role, name: d.name || '' }; console.log(a, r.status, d.role) }

const probe = () => {
  const vw = document.documentElement.clientWidth
  const px = v => parseFloat(v) || 0
  const vis = e => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' }
  const sel = e => e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : '')
  const main = document.querySelector('main, [role=main]')
  let c = main
  if (!c) { c = [...document.querySelectorAll('#root *')].filter(vis).sort((a, b) => b.getBoundingClientRect().width * b.getBoundingClientRect().height - a.getBoundingClientRect().width * a.getBoundingClientRect().height)[0] }
  const chain = []
  for (let e = c; e && e !== document.documentElement; e = e.parentElement) {
    const s = getComputedStyle(e), r = e.getBoundingClientRect()
    chain.push({ el: sel(e), w: Math.round(r.width), l: Math.round(r.left), r: Math.round(vw - r.right), maxW: s.maxWidth, pl: s.paddingLeft, pr: s.paddingRight, ml: s.marginLeft, mr: s.marginRight, disp: s.display })
  }
  const mr = c ? c.getBoundingClientRect() : { left: 0, right: vw, width: vw }
  let minL = 1e9, maxR = -1e9
  if (c) for (const e of c.querySelectorAll('h1,h2,p,li,button,a,input,textarea,img,svg,section,article')) { if (!vis(e)) continue; const r = e.getBoundingClientRect(); if (r.width > vw * 1.5) continue; minL = Math.min(minL, r.left); maxR = Math.max(maxR, r.right) }
  const cs = getComputedStyle(document.body)
  const ps = [...(c || document).querySelectorAll('p,li')].filter(e => vis(e) && e.textContent.trim().length > 60)
  const cpl = ps.map(p => { const s = getComputedStyle(p); const lh = px(s.lineHeight) || px(s.fontSize) * 1.2; const lines = Math.max(1, Math.round(p.getBoundingClientRect().height / lh)); return lines >= 2 ? Math.round(p.textContent.trim().length / lines) : null }).filter(Boolean).sort((a, b) => a - b)
  const grids = [...(c || document).querySelectorAll('*')].filter(e => getComputedStyle(e).display.includes('grid') && vis(e)).map(e => getComputedStyle(e).gridTemplateColumns.split(' ').length)
  const small = [], over = [], z = new Set(), fsz = new Map(), sp = new Map(), btnW = [], cardW = []
  for (const e of document.querySelectorAll('body *')) {
    if (!vis(e)) continue
    const s = getComputedStyle(e), r = e.getBoundingClientRect()
    if (s.zIndex !== 'auto' && s.position !== 'static') z.add(sel(e) + '=' + s.zIndex)
    if (e.matches('a,button,input:not([type=hidden]),select,textarea,[role=button],[role=tab]')) {
      const inline = s.display === 'inline' && e.closest('p,li,label,small')
      const w = Math.round(r.width), h = Math.round(r.height)
      if (!inline && (h < 44 || w < 44) && !e.closest('.cg-skip')) small.push(sel(e) + ' ' + w + 'x' + h + ' «' + (e.textContent || e.getAttribute('aria-label') || '').trim().slice(0, 20) + '»')
      if (e.matches('button,[role=button]')) btnW.push(w)
    }
    if (r.right > vw + 1 || r.left < -1) { let clipped = false; for (let p = e.parentElement; p; p = p.parentElement) { const o = getComputedStyle(p); if (/(auto|scroll|hidden|clip)/.test(o.overflowX) && p.getBoundingClientRect().right <= vw + 1) { clipped = true; break } } if (!clipped && s.position !== 'fixed') over.push(sel(e) + ' L' + Math.round(r.left) + ' R' + Math.round(r.right)) }
    if (e.childNodes.length && [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) fsz.set(s.fontSize, (fsz.get(s.fontSize) || 0) + 1)
    for (const k of ['paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight', 'marginTop', 'marginBottom', 'rowGap', 'columnGap']) { const v = Math.round(px(s[k])); if (v > 0 && v < 200) sp.set(v, (sp.get(v) || 0) + 1) }
    if (/card|panel|tile/.test(typeof e.className === 'string' ? e.className : '') && r.width > 100) cardW.push(Math.round(r.width))
  }
  const h1 = document.querySelector('h1')
  const fixed = [...document.querySelectorAll('body *')].filter(e => { const p = getComputedStyle(e).position; return (p === 'fixed' || p === 'sticky') && vis(e) }).map(e => sel(e) + ' ' + getComputedStyle(e).position + ' h' + Math.round(e.getBoundingClientRect().height) + ' w' + Math.round(e.getBoundingClientRect().width))
  return {
    vw, scrollW: document.documentElement.scrollWidth, hOverflow: document.documentElement.scrollWidth - vw, docH: document.documentElement.scrollHeight,
    main: c ? sel(c) : null, mainW: Math.round(mr.width), mainL: Math.round(mr.left), mainR: Math.round(vw - mr.right), mainMaxW: c ? getComputedStyle(c).maxWidth : null,
    contentL: Math.round(minL), contentR: Math.round(vw - maxR), contentOffset: Math.round((minL - (vw - maxR)) / 2), contentW: Math.round(maxR - minL),
    chain: chain.slice(0, 7),
    bodyFont: cs.fontSize, bodyLH: cs.lineHeight, bodyFam: cs.fontFamily.split(',')[0], h1Size: h1 ? getComputedStyle(h1).fontSize : null, h1Count: document.querySelectorAll('h1').length,
    cplMedian: cpl.length ? cpl[Math.floor(cpl.length / 2)] : null, cplMax: cpl.length ? cpl[cpl.length - 1] : null,
    gridCols: grids.length ? Math.max(...grids) : 0,
    fontSizes: [...fsz.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(x => x[0] + '×' + x[1]), fontSizeCount: fsz.size,
    spacingTop: [...sp.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(x => x[0] + '×' + x[1]), spacingDistinct: sp.size,
    z: [...z].slice(0, 10), fixed: fixed.slice(0, 6),
    small: small.slice(0, 8), smallCount: small.length, over: over.slice(0, 6), overCount: over.length,
    btnW: btnW.length ? [Math.min(...btnW), Math.max(...btnW)] : null, cardW: [...new Set(cardW)].slice(0, 6),
    title: document.title, text: (document.body.innerText || '').slice(0, 120).replace(/\s+/g, ' ')
  }
}

const results = []
const variants = [{ lang: 'es', theme: 'light' }, { lang: 'en', theme: 'light' }, { lang: 'es', theme: 'dark' }]
for (const sc of SCREENS) {
  for (const v of variants) {
    const base = v.lang === 'es' && v.theme === 'light'
    const widths = base ? WIDTHS : WIDTHS.filter(w => SHOT_VARIANT_W.has(w))
    for (const w of widths) {
      const ctx = await browser.newContext({ viewport: { width: w, height: w <= 500 ? 800 : 900 }, colorScheme: v.theme, deviceScaleFactor: 1 })
      await ctx.addInitScript(([lang, theme, s]) => {
        try { localStorage.setItem('elv_lang', lang); localStorage.setItem('elv_theme', theme); if (s) { localStorage.setItem('elevation_token', s.token); localStorage.setItem('elevation_role', s.role); localStorage.setItem('elevation_name', s.name) } } catch {}
      }, [v.lang, v.theme, sess[sc.acct]])
      const page = await ctx.newPage()
      try {
        await page.goto(BASE + sc.path, { waitUntil: 'networkidle', timeout: 45000 })
        await page.waitForTimeout(1200)
        const u = new URL(page.url())
        const m = await page.evaluate(probe)
        const name = `${sc.id}_${v.lang}-${v.theme}_${w}`
        m.finalPath = u.pathname + u.search
        if (ENGINE === 'chromium' && (!base || SHOT_FULL.has(w))) {
          await page.screenshot({ path: `${OUT}/capturas/${name}.jpg`, type: 'jpeg', quality: 55, fullPage: true, timeout: 30000 }).catch(async () => { await page.screenshot({ path: `${OUT}/capturas/${name}.jpg`, type: 'jpeg', quality: 55 }) })
        }
        results.push({ screen: sc.id, path: sc.path, role: sc.role, lang: v.lang, theme: v.theme, width: w, engine: ENGINE, ...m })
      } catch (e) { results.push({ screen: sc.id, path: sc.path, lang: v.lang, theme: v.theme, width: w, engine: ENGINE, error: String(e).slice(0, 200) }) }
      await ctx.close()
    }
  }
  console.log('hecho', sc.id)
}
fs.writeFileSync(`${OUT}/mediciones-roles.json`, JSON.stringify(results, null, 1))
await browser.close()
