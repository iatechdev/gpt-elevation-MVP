// ES-369 (QA-424-1/2): la marca del check-in es de una persona y de un día en su zona. Chromium, API simulada, DATOS SINTÉTICOS. Evidencia (no corre en CI).
// A: misma persona con la marca de hoy → «ya registrado» (sin formulario). B: otra persona en el mismo navegador → formulario de registro. Día siguiente → formulario.
// Zona: a las 22:00 del 20 en Bogotá (ya 21 en UTC) la marca de A, escrita con la zona recordada, sigue vigente ese día y cambia a medianoche local.
// Almacenamiento bloqueado (getItem lanza): la pantalla se dibuja sin errores de JavaScript.
// Uso: PLAYWRIGHT_MODULE=<playwright> BASE=http://127.0.0.1:4381 node scripts/es369-checkin-marca.cjs
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright'); const BASE = process.env.BASE || 'http://127.0.0.1:4381'
let failures = 0, total = 0
const check = (ok, label) => { total++; if (!ok) { failures++; console.log('FALLA ' + label) } }
const tokenOf = id => 'h.' + Buffer.from(JSON.stringify({ id, name: 'Ana', role: 'user' })).toString('base64url') + '.s'
async function open(browser, { id, seed = {}, now, block = false, lang = 'es' }) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' }); const page = await ctx.newPage(); const errors = []
  page.on('pageerror', e => errors.push(e.message))
  if (now) await page.clock.install({ time: new Date(now) })
  await page.addInitScript(([token, entries, blocked, l]) => {
    if (blocked) { Storage.prototype.getItem = () => { throw new Error('SecurityError') } ; return }
    localStorage.setItem('elevation_token', token); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elv_lang', l)
    for (const [k, v] of Object.entries(entries)) localStorage.setItem(k, v)
  }, [tokenOf(id), seed, block, lang])
  await page.route('**/api/**', r => { const p = new URL(r.request().url()).pathname
    if (p === '/api/session') return r.fulfill({ json: { role: 'user', onboardingCompleted: true } })
    if (p === '/api/user/progress') return r.fulfill({ json: { stats: null, moodLogs: [], ratings: [], recommendations: [], timeZone: 'America/Bogota' } })
    if (p === '/api/sessions/user/upcoming') return r.fulfill({ json: { session: null } })
    if (p === '/api/sessions/user/my-therapist') return r.fulfill({ json: { therapist: null } })
    if (p === '/api/user/plan/me') return r.fulfill({ json: { plan: null, limits: null } })
    return r.fulfill({ json: [] }) })
  await page.goto(BASE + '/app/dashboard', { waitUntil: 'networkidle' }); await page.waitForTimeout(600)
  return { ctx, page, errors }
}
const formShown = page => page.locator('#main fieldset, #main [role=radiogroup], #main input[type=radio]').count().then(n => n > 0)
;(async () => {
  const browser = await chromium.launch(); const today = new Date().toISOString().slice(0, 10)
  const mark = (id, day) => ({ elevation_checkin: JSON.stringify({ id: String(id), day }) })
  let o = await open(browser, { id: 7, seed: mark(7, today) }); check(!(await formShown(o.page)), 'A con su marca de hoy: sin formulario (ya registrado)'); check(o.errors.length === 0, 'A: sin errores ' + o.errors); await o.ctx.close()
  o = await open(browser, { id: 8, seed: mark(7, today) }); check(await formShown(o.page), 'B con la marca de A en el mismo navegador: SÍ ve el formulario'); check(o.errors.length === 0, 'B: sin errores ' + o.errors); await o.ctx.close()
  o = await open(browser, { id: 7, seed: mark(7, '2000-01-01') }); check(await formShown(o.page), 'A con la marca de otro día: formulario'); await o.ctx.close()
  o = await open(browser, { id: 7, seed: { elevation_checkin_date: new Date().toDateString() } }); check(await formShown(o.page), 'la marca antigua (fecha suelta) ya no vale'); await o.ctx.close()
  // zona: 03:00Z del 21 = 22:00 del 20 en Bogotá. La zona recordada hace que la marca del día 20 siga vigente a esa hora.
  const night = '2026-11-21T03:00:00Z'
  o = await open(browser, { id: 7, now: night, seed: { elevation_tz: JSON.stringify({ id: '7', zone: 'America/Bogota' }), ...mark(7, '2026-11-20') } }); check(!(await formShown(o.page)), 'zona: a las 22:00 locales la marca del día 20 sigue vigente'); await o.ctx.close()
  o = await open(browser, { id: 7, now: '2026-11-21T05:30:00Z', seed: { elevation_tz: JSON.stringify({ id: '7', zone: 'America/Bogota' }), ...mark(7, '2026-11-20') } }); check(await formShown(o.page), 'zona: pasada la medianoche local el día cambia y vuelve el formulario'); await o.ctx.close()
  o = await open(browser, { id: 7, block: true }); check(o.errors.length === 0, 'almacenamiento bloqueado: sin errores de JavaScript ' + o.errors.slice(0, 2)); check(await o.page.locator('#main').count() === 1, 'almacenamiento bloqueado: la pantalla se dibuja'); await o.ctx.close()
  console.log(failures === 0 ? `TODO OK (${total} comprobaciones)` : `${failures} FALLA(S) de ${total}`); await browser.close(); process.exit(failures ? 1 : 0)
})()
