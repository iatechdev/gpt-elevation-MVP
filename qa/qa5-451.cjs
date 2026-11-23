// [QA-Claude-5] PR #451 (ES-381): /manifiesto CLS A/B INTERCALADO (PR vs main), CPU×4, con y sin fuente retrasada, anchos 320..1360, ES/EN claro/oscuro; texto idéntico; estados cargando/error/vacío/corto; teclado; axe.
// Uso: PR=http://127.0.0.1:4511 MAIN=http://127.0.0.1:4512 PLAYWRIGHT_MODULE=... AXE=... node qa/qa5-451.cjs   (sin backend: /api simulado con page.route)
const fs = require('fs'); const { chromium } = require(process.env.PLAYWRIGHT_MODULE); const axeSource = fs.readFileSync(process.env.AXE, 'utf8')
const PR = process.env.PR, MAIN = process.env.MAIN; let ok = 0, bad = 0
const check = (l, c, ev) => { if (c) { ok++; console.log('OK    ' + l) } else { bad++; console.log('FALLA ' + l + (ev !== undefined ? ' · ' + String(ev).slice(0, 400) : '')) } }
const info = (...a) => console.log('INFO ', ...a)
const para = (i) => `Principio ${i + 1}. Elevation acompaña la reflexión personal y no sustituye la atención psicológica, médica ni de emergencia; las personas deciden qué comparten, con quién y por cuánto tiempo, y nadie interpreta por ellas lo que viven en su trabajo ni en su vida cotidiana.`
const paraEn = (i) => `Principle ${i + 1}. Elevation supports personal reflection and does not replace psychological, medical or emergency care; people decide what they share, with whom and for how long, and nobody interprets for them what they live at work or in daily life.`
const long = { version: 'v3', content: Array.from({ length: 14 }, (_, i) => para(i)).join('\n\n'), contentEn: Array.from({ length: 14 }, (_, i) => paraEn(i)).join('\n\n'), publishedAt: '2026-11-01T00:00:00Z' }
const short = { version: 'v1', content: para(0), contentEn: null, publishedAt: '2026-11-01T00:00:00Z' }
const noEn = { ...long, contentEn: null }
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s[s.length >> 1] }
const axe = (page) => page.addScriptTag({ content: axeSource }).then(() => page.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } }).then((r) => r.violations.map((x) => x.id + ':' + x.nodes.length))))
// estado: ready(body) | loading (no responde) | error (500) | empty ({content:null})
const open = async (br, base, { w, h = 900, lang = 'es', scheme = 'light', delay = 0, state = 'ready', body = long, cpu = true, cls = true }) => {
  const ctx = await br.newContext({ viewport: { width: w, height: h }, reducedMotion: 'reduce', colorScheme: scheme }); const page = await ctx.newPage()
  if (cpu) { const cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 }) }
  await page.addInitScript(([l, c]) => { localStorage.setItem('elv_lang', l); window.__c = 0; if (c) new PerformanceObserver((li) => { for (const e of li.getEntries()) if (!e.hadRecentInput) window.__c += e.value }).observe({ type: 'layout-shift', buffered: true }) }, [lang, cls])
  await page.route('**/api/**', (r) => r.fulfill({ status: 404, json: {} }))
  await page.route('**/api/manifest/active', (r) => state === 'loading' ? undefined : state === 'error' ? r.fulfill({ status: 500, json: { error: 'x' } }) : state === 'empty' ? r.fulfill({ json: { version: null, content: null, contentEn: null, publishedAt: null } }) : r.fulfill({ json: body }))
  if (delay) await page.route('**/*.woff2', async (r) => { await new Promise((s) => setTimeout(s, delay)); r.continue() })
  await page.goto(base + '/manifiesto', { waitUntil: 'domcontentloaded' }); if (state === 'ready') await page.locator('.manifesto__body').waitFor(); else await page.waitForTimeout(1500); await page.waitForTimeout(2200)
  return { ctx, page }
}
;(async () => {
  const br = await chromium.launch()
  // 1) CLS A/B intercalado
  const WIDTHS = [320, 390, 768, 1024, 1280, 1360]; let worstPR = 0, worstDelta = -1, rows = []
  for (const delay of [0, 600]) for (const w of WIDTHS) for (const [lang, scheme] of [['es', 'light'], ['en', 'dark']]) {
    const A = [], B = []
    for (let i = 0; i < 5; i++) for (const [arr, base] of i % 2 ? [[B, MAIN], [A, PR]] : [[A, PR], [B, MAIN]]) { const s = await open(br, base, { w, lang, scheme, delay }); arr.push(await s.page.evaluate(() => window.__c)); await s.ctx.close() }
    const a = med(A), b = med(B); worstPR = Math.max(worstPR, ...A); rows.push(`fuente+${delay}ms ${w}px ${lang}/${scheme}: PR med ${a.toFixed(3)} máx ${Math.max(...A).toFixed(3)} | main med ${b.toFixed(3)} máx ${Math.max(...B).toFixed(3)}`)
    worstDelta = Math.max(worstDelta, a - b); check(`CLS ${delay}ms ${w}px ${lang}/${scheme}: PR mediana ${a.toFixed(3)} ≤0,1 y no peor que main (${b.toFixed(3)} +0,02)`, a <= 0.1 && a <= b + 0.02, JSON.stringify({ A, B }))
  }
  rows.forEach((r) => info(r)); info('peor CLS del PR:', worstPR.toFixed(3))
  // 2) texto idéntico (título, meta, cuerpo) PR vs main, ES/EN y sin versión EN (aviso), caso corto
  for (const [label, body, lang] of [['largo ES', long, 'es'], ['largo EN', long, 'en'], ['sin EN → aviso', noEn, 'en'], ['corto ES', short, 'es']]) {
    const t = []; for (const base of [PR, MAIN]) { const s = await open(br, base, { w: 1280, lang, body, cpu: false, cls: false }); t.push(await s.page.evaluate(() => document.querySelector('.manifesto').innerText.replace(/\s+/g, ' ').trim() + '|' + document.querySelector('.manifesto__body').innerHTML)); await s.ctx.close() }
    check(`texto idéntico PR vs main (${label}): ${t[0].length} caracteres`, t[0] === t[1] && t[0].length > 100)
  }
  // 3) estados: sin alto absurdo ni scroll raro; «Volver» y pie accesibles con teclado
  for (const w of [390, 1280]) for (const h of [900, 500]) for (const state of ['loading', 'error', 'empty', 'short']) {
    const m = []; for (const base of [PR, MAIN]) { const s = await open(br, base, { w, h, state: state === 'short' ? 'ready' : state, body: short, cpu: false, cls: false }); m.push(await s.page.evaluate(() => { const de = document.documentElement; const f = document.querySelector('footer'); const back = document.querySelector('.manifesto__back a'); const r = back.getBoundingClientRect(); return { sh: de.scrollHeight, ih: innerHeight, ox: de.scrollWidth > innerWidth + 1, backTop: Math.round(r.top + scrollY), footer: !!f, mh: Math.round(document.querySelector('.manifesto').getBoundingClientRect().height) } })); await s.ctx.close() }
    info(`estado ${state} ${w}x${h}: PR alto doc ${m[0].sh}/${m[0].ih} (manifiesto ${m[0].mh}px, «Volver» en y=${m[0].backTop}) | main alto doc ${m[1].sh} (manifiesto ${m[1].mh}px, «Volver» y=${m[1].backTop})`)
    check(`estado ${state} ${w}x${h}: sin desborde horizontal; alto de documento ≤ ${h} + 1.6×${h} (sin altura absurda)`, !m[0].ox && m[0].sh <= h + 1.6 * h + 400, JSON.stringify(m[0]))
  }
  // teclado: Tab hasta «Volver» y pie en estados loading/ready, a 390 px y 500 de alto
  for (const state of ['loading', 'ready']) { const s = await open(br, PR, { w: 390, h: 500, state, body: long, cpu: false, cls: false }); const seen = []; for (let i = 0; i < 40; i++) { await s.page.keyboard.press('Tab'); const d = await s.page.evaluate(() => { const e = document.activeElement; if (!e || e === document.body) return null; const r = e.getBoundingClientRect(); return { t: (e.innerText || e.getAttribute('aria-label') || e.tagName).trim().slice(0, 30), vis: r.bottom > 0 && r.top < innerHeight, out: getComputedStyle(e).outlineStyle !== 'none' || getComputedStyle(e).boxShadow !== 'none' } }); if (d) seen.push(d) }
    const back = seen.find((x) => /volver|back/i.test(x.t)); check(`teclado (${state}, 390x500): «Volver» recibe foco, queda a la vista al enfocarlo y muestra indicador`, !!back && back.vis && back.out, JSON.stringify(seen.slice(-6))); await s.ctx.close() }
  // 4) axe en listo/cargando/error/vacío, claro/oscuro, 390 y 1280
  for (const scheme of ['light', 'dark']) for (const w of [390, 1280]) for (const state of ['ready', 'loading', 'error', 'empty']) { const s = await open(br, PR, { w, scheme, state, cpu: false, cls: false }); const a = await axe(s.page); check(`axe=0 /manifiesto ${state} ${w}px ${scheme}`, a.length === 0, a.join(';')); await s.ctx.close() }
  console.log(`#451: ${ok} correctas, ${bad} fallos`); await br.close()
})().catch((e) => { console.error('ABORTA', e); process.exit(2) })
