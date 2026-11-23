// [QA-Claude-5] PR #415 (ES-364): CLS A/B INTERCALADO PR vs main (merge-base), CPU×4, backend REAL (/api/session real: token vencido = 401 real; válido = 200 real; «no disponible» = 503 simulado en la ruta). Datos sintéticos.
// Uso: PLAYWRIGHT_MODULE=... PR=http://127.0.0.1:4402 MAIN=http://127.0.0.1:4403 API=http://127.0.0.1:8402 RUNS=4 DELAYS=150,900 WIDTHS=390,1360,320 node qa/qa5-415-cls.cjs
const fs = require('fs'); const crypto = require('crypto'); const { chromium } = require(process.env.PLAYWRIGHT_MODULE)
const PR = process.env.PR, MAIN = process.env.MAIN, API = process.env.API, RUNS = Number(process.env.RUNS || 4), DELAYS = (process.env.DELAYS || '150,900').split(',').map(Number), WIDTHS = (process.env.WIDTHS || '390,1360,320').split(',').map(Number)
const pass = 'Qa5-' + crypto.randomBytes(8).toString('hex') + 'A1!'
const call = async (tk, m, p, b) => { const r = await fetch(API + p, { method: m, headers: { 'content-type': 'application/json', ...(tk ? { Authorization: 'Bearer ' + tk } : {}) }, body: b === undefined ? undefined : JSON.stringify(b) }); let j = null; try { j = await r.json() } catch {} return { status: r.status, body: j } }
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s[s.length >> 1] }
let EXPIRED, VALID, OK_ROLE
async function once(br, base, { width, path, state, delay, lang = 'es', scheme = 'light' }) {
  const ctx = await br.newContext({ viewport: { width, height: Number(process.env.HEIGHT || 800) }, reducedMotion: 'reduce', colorScheme: scheme }); const page = await ctx.newPage(); const cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
  const token = state === 'expired' || state === 'unavailable' ? EXPIRED : VALID
  await page.addInitScript(([tk, l]) => { window.__c = 0; localStorage.setItem('elevation_token', tk); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elv_lang', l); localStorage.setItem('elevation_name', 'Persona Sintetica')
    new PerformanceObserver((list) => { for (const e of list.getEntries()) if (!e.hadRecentInput) window.__c += e.value }).observe({ type: 'layout-shift', buffered: true }) }, [token, lang])
  await page.route('**/api/session', async (route) => { await new Promise((r) => setTimeout(r, delay)); if (state === 'unavailable') return route.fulfill({ status: 503, json: {} }); return route.continue() })
  await page.route('**/api/user/context', async (route) => { await new Promise((r) => setTimeout(r, delay)); return route.continue() })
  await page.goto(base + path, { waitUntil: 'load' }); await page.waitForTimeout(1500 + delay)
  const c = await page.evaluate(() => window.__c); await ctx.close(); return c
}
;(async () => {
  const email = `qa5-${crypto.randomBytes(4).toString('hex')}@example.test`; await call(null, 'POST', '/api/register', { name: 'Persona Sintetica', email, password: pass, acceptedTerms: true, termsVersion: '2026-11-v2' })
  const a = (await call(null, 'POST', '/api/login', { email, password: pass })).body; VALID = a.token; EXPIRED = VALID.slice(0, -4) + 'AAAA' // firma alterada: el servidor real responde 401 (el segundo inicio de sesión no revocó el primer token en este entorno)
  await new (require('pg').Client)({ connectionString: process.env.DATABASE_URL }).connect().then(async (c) => { await c.query('UPDATE "Users" SET "onboardingCompleted"=true WHERE email=$1', [email]); await c.end() })
  const s1 = await call(EXPIRED, 'GET', '/api/session'), s2 = await call(VALID, 'GET', '/api/session'); console.log(`INFO  /api/session real: token vencido → ${s1.status}; token válido → ${s2.status}`)
  if (s1.status !== 401 || s2.status !== 200) { console.log('FALLA preparación de sesiones'); process.exit(2) }
  const br = await chromium.launch(); let bad = 0
  const COMBOS = [['/login', 'expired'], ['/login', 'unavailable'], ['/login?mode=register', 'expired'], ['/login?mode=register', 'unavailable'], ['/login?mode=register', 'valid']]
  for (const width of WIDTHS) for (const [path, state] of COMBOS) {
    const pr = [], mn = []
    for (let i = 0; i < RUNS; i++) for (const d of DELAYS) for (const [arr, base] of [[pr, PR], [mn, MAIN]]) arr.push(await once(br, base, { width, path, state, delay: d }))
    const okPR = Math.max(...pr) <= 0.1; if (!okPR) bad++
    console.log(`${okPR ? 'OK   ' : 'FALLA'} ${width}px ${path} ${state}: PR mediana ${med(pr).toFixed(3)} máx ${Math.max(...pr).toFixed(3)} | main mediana ${med(mn).toFixed(3)} máx ${Math.max(...mn).toFixed(3)} (n=${pr.length} c/u)`)
  }
  await br.close(); console.log(bad ? `FALLAN ${bad}` : 'CLS del PR ≤ 0,1 en todas las combinaciones'); process.exit(bad ? 1 : 0)
})().catch((e) => { console.error('ABORTA', e); process.exit(2) })
