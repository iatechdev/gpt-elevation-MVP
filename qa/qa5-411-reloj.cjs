// [QA-Claude-5] #411: «Mi panel» con el RELOJ DEL NAVEGADOR fijado (19:30 en Bogotá; 01:00 en Auckland UTC+13; 21:00 en Nueva York), datos sembrados por SQL en el día de la zona; backend real. Datos sintéticos.
const fs = require('fs'); const crypto = require('crypto'); const { chromium } = require(process.env.PLAYWRIGHT_MODULE); const axeSource = fs.readFileSync(process.env.AXE, 'utf8'); const { Client } = require('pg')
const BASE = process.env.BASE, API = process.env.API; let ok = 0, bad = 0; const check = (l, c, ev) => { if (c) { ok++; console.log('OK    ' + l) } else { bad++; console.log('FALLA ' + l + (ev !== undefined ? ' · ' + String(ev).slice(0, 300) : '')) } }
const pass = 'Qa5-' + crypto.randomBytes(8).toString('hex') + 'A1!'
const call = async (tk, m, p, b) => { const r = await fetch(API + p, { method: m, headers: { 'content-type': 'application/json', ...(tk ? { Authorization: 'Bearer ' + tk } : {}) }, body: b === undefined ? undefined : JSON.stringify(b) }); let j = null; try { j = await r.json() } catch {} return { status: r.status, body: j } }
const CTX = (tz) => ({ preferredLanguage: 'es', residenceCountry: null, targetMarket: null, timeZone: tz, profession: null, interests: null, availabilityMinutesPerWeek: null, careerGoal: null, careerConstraints: null, sector: null, totalYearsExperience: null, experience: [], education: [], declaredSkills: [], languages: [] })
;(async () => {
  const db = new Client({ connectionString: process.env.DATABASE_URL }); await db.connect(); const br = await chromium.launch()
  const CASES = [
    { name: 'sin contexto (respaldo America/Bogota) a las 19:30 de Bogotá del 20-nov', zone: null, now: '2026-11-21T00:30:00Z', days: ['2026-11-20', '2026-11-19', '2026-11-16', '2026-11-15'], week: 3 },
    { name: 'Pacific/Auckland (UTC+13) a la 01:00 del 21-nov', zone: 'Pacific/Auckland', now: '2026-11-20T12:00:00Z', days: ['2026-11-21', '2026-11-20', '2026-11-16', '2026-11-15'], week: 3 },
    { name: 'America/New_York (UTC−5) a las 21:00 del 20-nov', zone: 'America/New_York', now: '2026-11-21T02:00:00Z', days: ['2026-11-20', '2026-11-19', '2026-11-16', '2026-11-15'], week: 3 },
  ]
  for (const c of CASES) {
    const email = `qa5-${crypto.randomBytes(4).toString('hex')}@example.test`; await call(null, 'POST', '/api/register', { name: 'Persona Sintetica', email, password: pass, acceptedTerms: true, termsVersion: '2026-11-v2' })
    const s = (await call(null, 'POST', '/api/login', { email, password: pass })).body; await db.query('UPDATE "Users" SET "onboardingCompleted"=true WHERE email=$1', [email]); const id = (await db.query('SELECT id FROM "Users" WHERE email=$1', [email])).rows[0].id
    if (c.zone) { const r = await call(s.token, 'PUT', '/api/user/context', { schemaVersion: 2, expectedVersion: 0, action: 'continue', context: CTX(c.zone) }); check(`${c.name}: contexto guardado`, r.status < 300, r.status) }
    for (const d of c.days) await db.query('INSERT INTO "MoodLogs" ("UserId", date, checkin_mood, "createdAt", "updatedAt") VALUES ($1,$2,4, now(), now())', [id, d])
    const before = JSON.stringify((await db.query('SELECT date, checkin_mood FROM "MoodLogs" WHERE "UserId"=$1 ORDER BY date', [id])).rows)
    const pr = await call(s.token, 'GET', '/api/user/progress'); const zone = c.zone || 'America/Bogota'; check(`${c.name}: el servidor devuelve timeZone ${zone}`, pr.body.timeZone === zone, pr.body.timeZone)
    for (const [lang, width] of [['es', 1360], ['en', 390]]) {
      const ctx = await br.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' }); const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(e.message))
      await page.clock.setFixedTime(new Date(c.now)); await page.addInitScript(([tk, l]) => { localStorage.setItem('elevation_token', tk); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elv_lang', l); localStorage.setItem('elevation_name', 'Persona Sintetica') }, [s.token, lang])
      await page.goto(BASE + '/app/dashboard'); await page.waitForSelector('.pc-trend', { timeout: 25000 }); await page.waitForTimeout(900)
      const st = await page.evaluate(() => ({ week: document.querySelector('.pc-big').textContent.trim(), cells: [...document.querySelectorAll('.pc-trend tbody td')].map((x) => x.textContent.trim()), ox: document.documentElement.scrollWidth > innerWidth + 1 }))
      check(`[${lang} ${width}px] ${c.name}: hoy (zona) en la ÚLTIMA columna, ayer en la anterior, antes de ayer vacío; «esta semana» = ${c.week}`, st.cells.length === 7 && st.cells[6] !== '—' && st.cells[5] !== '—' && st.cells[4] === '—' && Number(st.week) === c.week, JSON.stringify(st))
      await page.addScriptTag({ content: axeSource }); const v = await page.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } }).then((r) => r.violations.map((x) => x.id)))
      check(`[${lang} ${width}px] ${c.name}: sin desborde, sin errores de JS, axe = 0`, !st.ox && errs.length === 0 && v.length === 0, JSON.stringify({ ox: st.ox, errs, v })); await ctx.close() }
    const after = JSON.stringify((await db.query('SELECT date, checkin_mood FROM "MoodLogs" WHERE "UserId"=$1 ORDER BY date', [id])).rows); check(`${c.name}: el histórico no cambió al abrir la pantalla`, before === after) }
  console.log(`#411 reloj: ${ok} correctas, ${bad} fallos`); await db.end(); await br.close(); process.exit(bad ? 1 : 0)
})().catch((e) => { console.error('ABORTA', e); process.exit(2) })
