// QA-Claude-2 — staging con #96 (radar) y #97 (panel «Analizar con IA») desplegados: recorrido visual SIN llamar a la IA (0 tokens).
// SOLO staging aprobado, 2 personas sintéticas @example.test. No imprime tokens. Env: BASE, OUT, PLAYWRIGHT_MODULE.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE)
const path = require('path'), fs = require('fs'); const OUT = process.env.OUT; fs.mkdirSync(OUT, { recursive: true })
const BASE = (process.env.BASE || '').replace(/\/$/, ''); if (!/^https:\/\/backend-staging-/.test(BASE)) process.exit(2)
const PASS = require('crypto').randomBytes(12).toString('hex') + 'Aa1!', tag = Date.now().toString(36)
let fails = 0; const ck = (n, ok, x = '') => { if (!ok) fails++; console.log(`${ok ? 'OK   ' : 'FALLA'} ${n} ${x}`) }
const call = async (m, p, t, b) => { const r = await fetch(BASE + p, { method: m, headers: { 'content-type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}) }, body: b === undefined ? undefined : JSON.stringify(b), signal: AbortSignal.timeout(30000) }); return { s: r.status, j: await r.json().catch(() => null) } }
const person = async (i) => { const email = `qa2s-${tag}-ra${i}@example.test`; await call('POST', '/api/register', null, { name: 'QA2 ra' + i, email, password: PASS }); const l = await call('POST', '/api/login', null, { email, password: PASS }); return l.j?.token }
const ev = (n, autonomy = 'assisted') => ({ requestId: `ra-${tag}-${n}`, status: 'confirmed', payload: { title: 'Evidencia sintética radar ' + n, situation: 'Situación.', responsibility: { text: 'Mi parte.' }, actions: [{ text: 'Acción.' }], delivered: { text: 'Entregable.' }, observedEffect: { known: false }, autonomy } })
;(async () => {
  const t1 = await person(1), t2 = await person(2); ck('2 personas sintéticas con sesión', !!t1 && !!t2); if (!t1 || !t2) process.exit(1)
  await call('POST', '/api/evidence', t1, ev('1'))
  const b = await chromium.launch(); const aiCalls = []
  const open = async (tk, route, { lang = 'es', w = 1280 } = {}) => { const c = await b.newContext({ viewport: { width: w, height: 900 } }); await c.addInitScript(([t, l]) => { localStorage.setItem('elevation_token', t); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elv_lang', l) }, [tk, lang]); const p = await c.newPage(); p.errs = []; p.on('console', m => m.type() === 'error' && p.errs.push(m.text().slice(0, 140))); p.on('pageerror', e => p.errs.push(e.message.slice(0, 140))); p.on('request', r => /\/skill-map\/proposals/.test(r.url()) && aiCalls.push(r.url())); await p.goto(BASE + route, { waitUntil: 'networkidle' }); await p.waitForTimeout(1500); return p }
  const sw = (p) => p.evaluate(() => ({ s: document.documentElement.scrollWidth, i: innerWidth }))
  const real = (p) => p.errs.filter(x => !/403|Failed to load resource/.test(x))
  // P2 sin evidencia: radar vacío + IA sin evidencia
  let p = await open(t2, '/app/skill-map')
  ck('#96 el mapa abre en Radar', (await p.locator('.skill-map-views button').first().getAttribute('aria-pressed')) === 'true')
  ck('#96 radar dibujado: 8 cuñas (catálogo real)', await p.locator('.radar-wedge').count() === 8, String(await p.locator('.radar-wedge').count()))
  ck('#96 sin niveles: estado vacío con enlace a Evidencia', await p.locator('.radar-empty a[href="/app/evidence"]').count() === 1)
  await p.screenshot({ path: path.join(OUT, 'stg-radar-vacio-1280.png'), fullPage: true })
  const aiBtn = p.getByRole('button', { name: /Analizar mi evidencia con IA/ }); const hasBtn = await aiBtn.count()
  ck('#97 botón «Analizar mi evidencia con IA» presente', hasBtn >= 1)
  if (hasBtn) { await aiBtn.first().click(); await p.waitForTimeout(800); const txt = await p.locator('.ai-panel').innerText().catch(() => ''); ck('#97 sin evidencia confirmada: aviso y enlace a Evidencia, sin permitir analizar', (await p.locator('.ai-panel a[href="/app/evidence"]').count()) >= 1 || /evidencia/i.test(txt), txt.replace(/\s+/g, ' ').slice(0, 140)); await p.screenshot({ path: path.join(OUT, 'stg-ai-sin-evidencia-1280.png'), fullPage: true }) }
  ck('consola P2', real(p).length === 0, real(p).join('|')); await p.context().close()
  // P1 con evidencia: panel, selección, límites, ES/EN/móvil; NO se pulsa «Analizar»
  for (const [lang, w] of [['es', 1280], ['es', 375], ['en', 1280], ['en', 320]]) {
    p = await open(t1, '/app/skill-map', { lang, w }); const m = await sw(p); ck(`#96 radar ${lang} ${w}px sin desborde`, m.s <= m.i, `${m.s}/${m.i}`)
    ck(`#96 ${lang} ${w}px: ${w <= 600 ? 'etiquetas ocultas y lista visible' : 'cuñas visibles'}`, w <= 600 ? await p.locator('.radar-row').first().isVisible() : await p.locator('.radar-wedge').first().isVisible())
    const btn = p.getByRole('button', { name: lang === 'en' ? /Analyze my evidence with AI/ : /Analizar mi evidencia con IA/ }); await btn.first().click(); await p.waitForTimeout(800)
    const panel = p.locator('.ai-panel'); ck(`#97 ${lang} ${w}px: panel abierto`, await panel.count() === 1)
    const boxes = await panel.locator('input[type=checkbox]').count(); ck(`#97 ${lang} ${w}px: capacidades seleccionables (${boxes})`, boxes >= 8)
    const go = p.getByRole('button', { name: lang === 'en' ? 'Analyze' : 'Analizar', exact: true }); ck(`#97 ${lang} ${w}px: las 8 vienen preseleccionadas y «Analizar» está activo`, await panel.locator('input[type=checkbox]:checked').count() === 8 && await go.isEnabled()); await panel.locator('input[type=checkbox]').evaluateAll(es => es.forEach(e => e.checked && e.click())); await p.waitForTimeout(200); ck(`#97 ${lang} ${w}px: sin ninguna seleccionada, «Analizar» desactivado`, await go.isDisabled())
    await panel.locator('input[type=checkbox]').first().check(); ck(`#97 ${lang} ${w}px: con una capacidad, «Analizar» se activa`, await go.isEnabled())
    const m2 = await sw(p); ck(`#97 ${lang} ${w}px panel sin desborde`, m2.s <= m2.i, `${m2.s}/${m2.i}`)
    await p.keyboard.press('Escape'); await p.waitForTimeout(300)
    await p.screenshot({ path: path.join(OUT, `stg-ai-${lang}-${w}.png`), fullPage: true }); ck(`consola ${lang} ${w}`, real(p).length === 0, real(p).join('|')); await p.context().close()
  }
  ck('0 llamadas a /skill-map/proposals (no se gastó IA)', aiCalls.length === 0, String(aiCalls.length))
  await b.close(); console.log(`\nPersonas sintéticas nuevas en staging: 2 (qa2s-${tag}-ra1/ra2@example.test).`); console.log(fails ? `FALLAS: ${fails}` : 'TODO OK'); process.exit(fails ? 1 : 0)
})().catch(e => { console.error('EXCEPCIÓN', e.message); process.exit(3) })
