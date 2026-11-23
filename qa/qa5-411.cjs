// [QA-Claude-5] PR #411 (E393-3 / ES-329): el día de ánimo, calificación, racha y «Mi panel» es el de la ZONA de la persona. Backend REAL (reloj real; zonas elegidas para que su día difiera del UTC) + PostgreSQL desechable + build fresco + Chromium.
// Uso: PLAYWRIGHT_MODULE=... AXE=... BASE=... API=... DATABASE_URL=<pg> NODE_PATH=<backend/node_modules> node qa/qa5-411.cjs
const fs = require('fs'); const crypto = require('crypto'); const { chromium } = require(process.env.PLAYWRIGHT_MODULE); const axeSource = fs.readFileSync(process.env.AXE, 'utf8'); const { Client } = require('pg')
const BASE = process.env.BASE, API = process.env.API
let ok = 0, bad = 0; const check = (l, c, ev) => { if (c) { ok++; console.log('OK    ' + l) } else { bad++; console.log('FALLA ' + l + (ev !== undefined ? ' · ' + String(ev).slice(0, 400) : '')) } }
const dayIn = (zone, ms = Date.now()) => new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(ms)
const back = (key, n) => { const [y, m, d] = key.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d - n)).toISOString().slice(0, 10) }
const pass = 'Qa5-' + crypto.randomBytes(8).toString('hex') + 'A1!'
const call = async (tk, m, p, b) => { const r = await fetch(API + p, { method: m, headers: { 'content-type': 'application/json', ...(tk ? { Authorization: 'Bearer ' + tk } : {}) }, body: b === undefined ? undefined : JSON.stringify(b) }); let j = null; try { j = await r.json() } catch {} return { status: r.status, body: j } }
const EMPTY = () => ({ preferredLanguage: 'es', residenceCountry: null, targetMarket: null, timeZone: null, profession: null, interests: null, availabilityMinutesPerWeek: null, careerGoal: null, careerConstraints: null, sector: null, totalYearsExperience: null, experience: [], education: [], declaredSkills: [], languages: [] })
const mkUser = async (zone) => {
  const email = `qa5-${crypto.randomBytes(4).toString('hex')}@example.test`
  await call(null, 'POST', '/api/register', { name: 'Persona Sintetica', email, password: pass, acceptedTerms: true, termsVersion: '2026-11-v2' })
  const s = (await call(null, 'POST', '/api/login', { email, password: pass })).body
  await new Client({ connectionString: process.env.DATABASE_URL }).connect().then(async (c) => { await c.query('UPDATE "Users" SET "onboardingCompleted"=true WHERE email=$1', [email]); const u = (await c.query('SELECT id FROM "Users" WHERE email=$1', [email])).rows[0]; s.id = u.id; await c.end() })
  let ctxStatus = null; if (zone !== undefined) { const r = await call(s.token, 'PUT', '/api/user/context', { schemaVersion: 2, expectedVersion: 0, action: 'continue', context: { ...EMPTY(), timeZone: zone } }); ctxStatus = r.status }
  return { ...s, email, ctxStatus }
}
;(async () => {
  const db = new Client({ connectionString: process.env.DATABASE_URL }); await db.connect()
  const utc = dayIn('UTC'); console.log('INFO  hora UTC del servidor:', new Date().toISOString(), '· día UTC', utc)
  const ZONES = ['Pacific/Kiritimati', 'Pacific/Pago_Pago', 'America/Bogota', 'America/New_York', 'UTC']
  const users = {}
  for (const z of ZONES) { users[z] = await mkUser(z); check(`contexto con zona ${z} guardado`, users[z].ctxStatus < 300, users[z].ctxStatus) }
  users.none = await mkUser(undefined)
  for (const [z, u] of Object.entries(users)) {
    const zone = z === 'none' ? 'America/Bogota' : z; const want = dayIn(zone)
    const ci = await call(u.token, 'POST', '/api/mood/checkin', { mood: 4 }); const co = await call(u.token, 'POST', '/api/mood/checkout', { mood: 5 }); const rt = await call(u.token, 'POST', '/api/rating', { rating: 5 })
    const row = (await db.query('SELECT date, checkin_mood, checkout_mood FROM "MoodLogs" WHERE "UserId"=$1', [u.id])).rows; const rr = (await db.query('SELECT date FROM "SessionRatings" WHERE "UserId"=$1', [u.id])).rows
    const fmt = (d) => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10))
    check(`${z === 'none' ? 'sin contexto (respaldo America/Bogota)' : z}: check-in y check-out se guardan en UN solo día = ${want} (UTC ${utc}${want !== utc ? ', distinto' : ', igual'})`, ci.status < 300 && co.status < 300 && row.length === 1 && fmt(row[0].date) === want && row[0].checkin_mood === 4 && row[0].checkout_mood === 5, JSON.stringify({ ci: ci.status, co: co.status, rows: row, want }))
    check(`${z === 'none' ? 'sin contexto' : z}: la calificación se guarda en el día ${want}`, rt.status < 300 && rr.length === 1 && fmt(rr[0].date) === want, JSON.stringify(rr))
    const pr = await call(u.token, 'GET', '/api/user/progress'); check(`${z === 'none' ? 'sin contexto' : z}: /api/user/progress devuelve timeZone = ${zone} y racha 1`, pr.status === 200 && pr.body.timeZone === zone && pr.body.stats.streak === 1, JSON.stringify({ tz: pr.body.timeZone, st: pr.body.stats }))
    // racha de calendario: dos días anteriores sembrados (día de la zona −1, −2) → racha 3; un hueco (−4) no suma
    for (const n of [1, 2, 4]) await db.query('INSERT INTO "MoodLogs" ("UserId", date, checkin_mood, "createdAt", "updatedAt") VALUES ($1,$2,3, now(), now())', [u.id, back(want, n)])
    const pr2 = await call(u.token, 'GET', '/api/user/progress'); check(`${z === 'none' ? 'sin contexto' : z}: racha de calendario = 3 (hoy, −1, −2; el hueco en −4 no cuenta)`, pr2.body.stats.streak === 3, pr2.body.stats.streak)
  }
  // idempotencia del mismo día (upsert): un segundo check-in el mismo día no crea fila nueva
  { const u = users['Pacific/Kiritimati']; await call(u.token, 'POST', '/api/mood/checkin', { mood: 2 }); const n = (await db.query('SELECT count(*) c FROM "MoodLogs" WHERE "UserId"=$1 AND date=$2', [u.id, dayIn('Pacific/Kiritimati')])).rows[0].c; check('un segundo check-in el mismo día de la persona actualiza la fila (no duplica)', Number(n) === 1, n) }
  // cambio de zona: la persona cambia su zona; lo ya guardado no se reescribe
  { const u = users['America/New_York']; const before = (await db.query('SELECT date FROM "MoodLogs" WHERE "UserId"=$1 ORDER BY date', [u.id])).rows.map((r) => String(r.date).slice(0, 10)).join(',')
    const cur = await call(u.token, 'GET', '/api/user/context'); const ver = cur.body && (cur.body.version ?? cur.body.expectedVersion ?? (cur.body.context && cur.body.context.version)); const r = await call(u.token, 'PUT', '/api/user/context', { schemaVersion: 2, expectedVersion: ver ?? 1, action: 'continue', context: { ...EMPTY(), timeZone: 'Pacific/Kiritimati' } })
    const pr = await call(u.token, 'GET', '/api/user/progress'); const after = (await db.query('SELECT date FROM "MoodLogs" WHERE "UserId"=$1 ORDER BY date', [u.id])).rows.map((r) => String(r.date).slice(0, 10)).join(',')
    check('cambiar la zona del contexto cambia la zona devuelta y NO reescribe el histórico', r.status < 300 ? pr.body.timeZone === 'Pacific/Kiritimati' && before === after : 'info ' + r.status, JSON.stringify({ put: r.status, tz: pr.body.timeZone, before, after })) }
  // ── UI: «Mi panel» con la zona que difiere del UTC
  const br = await chromium.launch()
  const pick = ['Pacific/Kiritimati', 'Pacific/Pago_Pago'].find((z) => dayIn(z) !== utc) || 'Pacific/Kiritimati'; const u = users[pick]
  for (const lang of ['es', 'en']) for (const width of [1360, 390]) {
    const ctx = await br.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' }); const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(e.message))
    await page.addInitScript(([tk, l]) => { localStorage.setItem('elevation_token', tk); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elv_lang', l); localStorage.setItem('elevation_name', 'Persona Sintetica') }, [u.token, lang])
    await page.goto(BASE + '/app/dashboard'); await page.waitForSelector('.pc-trend', { timeout: 25000 }); await page.waitForTimeout(900)
    const s = await page.evaluate(() => ({ week: document.querySelector('.pc-big') && document.querySelector('.pc-big').textContent.trim(), cells: [...document.querySelectorAll('.pc-trend tbody td')].map((c) => c.textContent.trim()), heads: [...document.querySelectorAll('.pc-trend thead th')].length, ox: document.documentElement.scrollWidth > innerWidth + 1 }))
    const filled = s.cells.map((c, i) => [i, c]).filter(([, c]) => c !== '—')
    check(`[${lang} ${width}px] «Mi panel» (${pick}): hoy cae en la ÚLTIMA columna de la tendencia (con dato) y «esta semana» ≥ 1`, s.cells.length === 7 && s.cells[6] !== '—' && Number(s.week) >= 1, JSON.stringify(s))
    check(`[${lang} ${width}px] la tendencia y los días sembrados (−1, −2) caen en las columnas 5 y 4 (día de la zona), sin desborde ni errores`, s.cells[5] !== '—' && s.cells[4] !== '—' && !s.ox && errs.length === 0, JSON.stringify({ cells: s.cells, ox: s.ox, errs }))
    await page.addScriptTag({ content: axeSource }); const v = await page.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } }).then((r) => r.violations.map((x) => x.id + ':' + x.nodes.length)))
    check(`[${lang} ${width}px] axe = 0 en /app/dashboard`, v.length === 0, v.join(';')); await ctx.close() }
  console.log(`API+UI #411: ${ok} correctas, ${bad} fallos`); await db.end(); await br.close(); process.exit(bad ? 1 : 0)
})().catch((e) => { console.error('ABORTA', e); process.exit(2) })
