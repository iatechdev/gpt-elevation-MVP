// [QA-Claude-5] PR #393 (ES-329): lógica de semana/tendencia de «Mi panel» contra un ORÁCULO independiente (aritmética de días enteros, sin Date para el calendario).
// Uso: FRONT=<pr393/frontend> node qa/qa5-393-logic.mjs   (se relanza a sí mismo con TZ distinta por cada zona)
import { spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import path from 'node:path'

const ZONES = ['UTC', 'America/Bogota', 'America/Los_Angeles', 'Pacific/Auckland', 'Asia/Kolkata', 'Etc/GMT+12', 'Etc/GMT-14', 'Europe/Madrid', 'Australia/Lord_Howe']
const DAY = 86400000
if (!process.env.QA_ZONE_CHILD) {
  let bad = 0
  for (const tz of ZONES) {
    const r = spawnSync(process.execPath, [new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'), tz], { env: { ...process.env, TZ: tz, QA_ZONE_CHILD: '1' }, encoding: 'utf8' })
    process.stdout.write(r.stdout); if (r.status) { bad++; process.stdout.write(r.stderr) }
  }
  console.log(bad ? `RESUMEN: ${bad} zonas con fallos` : `RESUMEN: ${ZONES.length}/${ZONES.length} zonas OK`)
  process.exit(bad ? 1 : 0)
}
const FRONT = process.env.FRONT
const mod = await import(pathToFileURL(path.join(FRONT, 'src/pages/dashboardWeek.ts')).href)
const { entriesThisWeek, lastSevenDays, todayKey, weekStartKey } = mod
const tz = process.env.TZ
let fails = 0; const fail = (m) => { fails++; if (fails <= 8) console.log(`  FALLA [${tz}] ${m}`) }
// ── oráculo: días desde 1970-01-01 (jueves) ↔ AAAA-MM-DD con el algoritmo civil de Hinnant
const civil = (z) => { z += 719468; const era = Math.floor(z / 146097); const doe = z - era * 146097; const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365); let y = yoe + era * 400; const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100)); const mp = Math.floor((5 * doy + 2) / 153); const d = doy - Math.floor((153 * mp + 2) / 5) + 1; const m = mp < 10 ? mp + 3 : mp - 9; if (m <= 2) y++; return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` }
const days = (key) => { let [y, m, d] = key.split('-').map(Number); if (m <= 2) y--; const era = Math.floor(y / 400); const yoe = y - era * 400; const doy = Math.floor((153 * (m > 2 ? m - 3 : m + 9) + 2) / 5) + d - 1; const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy; return era * 146097 + doe - 719468 }
const wd = (n) => (((n + 4) % 7) + 7) % 7 // 0 = domingo
const mondayOf = (n) => n - ((wd(n) + 6) % 7)
const START = days('2019-12-25'), END = days('2032-01-10')
// oráculo del propio oráculo (autocomprobación): fechas conocidas
if (civil(days('2024-02-29')) !== '2024-02-29' || wd(days('2026-11-20')) !== 5 || wd(days('2026-11-22')) !== 0) { console.log('  FALLA el oráculo no es fiable'); process.exit(2) }
const names = { es: ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'], en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] }
let n = 0
for (let d = START; d <= END; d++) {
  const key = civil(d); n++
  if (weekStartKey(key) !== civil(mondayOf(d))) fail(`weekStartKey(${key})=${weekStartKey(key)} esperado ${civil(mondayOf(d))}`)
  const mon = mondayOf(d)
  // registros: de 10 días antes a 3 después; en AAAA-MM-DD y con hora ISO
  const logs = []; for (let k = -10; k <= 3; k++) { const kd = civil(d + k); logs.push({ date: kd }, { date: `${kd}T00:00:00.000Z` }) }
  const exp = logs.filter((l) => days(l.date.slice(0, 10)) >= mon).length
  if (entriesThisWeek(logs, key) !== exp) fail(`entriesThisWeek(${key})=${entriesThisWeek(logs, key)} esperado ${exp}`)
  const seven = lastSevenDays(key)
  if (seven.length !== 7) fail(`lastSevenDays largo ${seven.length}`)
  seven.forEach((s, i) => {
    const want = civil(d - (6 - i)); if (s.dateStr !== want) fail(`lastSevenDays(${key})[${i}]=${s.dateStr} esperado ${want}`)
    const lab = (loc) => s.date.toLocaleDateString(loc, { weekday: 'short', timeZone: 'UTC' }).replace('.', '')
    const w = wd(d - (6 - i)); if (lab('es') !== names.es[w] && lab('es') !== names.es[w] + '.' && lab('es-CO') !== names.es[w]) fail(`etiqueta es ${s.dateStr}: ${lab('es')} esperado ${names.es[w]}`)
    if (lab('en') !== names.en[w]) fail(`etiqueta en ${s.dateStr}: ${lab('en')} esperado ${names.en[w]}`)
  })
}
// todayKey: cada hora de varios días (incluye cambios de hora locales) = el día UTC del instante
let hrs = 0
for (const iso of ['2026-03-08T00:00:00Z', '2026-03-29T00:00:00Z', '2026-10-25T00:00:00Z', '2026-11-01T00:00:00Z', '2026-11-20T00:00:00Z', '2026-12-31T00:00:00Z', '2028-02-28T00:00:00Z']) {
  const t0 = Date.parse(iso); for (let h = -30; h <= 54; h++) { const ms = t0 + h * 3600000 + (h % 2 ? 1799999 : 0); hrs++; const want = civil(Math.floor(ms / DAY)); if (todayKey(new Date(ms)) !== want) fail(`todayKey(${new Date(ms).toISOString()})=${todayKey(new Date(ms))} esperado ${want}`) }
}
// casos de la hoja de ruta del Dev: lunes en UTC−5, domingo, y 19:00–23:59 de Bogotá
const mondayLog = entriesThisWeek([{ date: '2026-11-16' }], '2026-11-18'); if (mondayLog !== 1) fail(`registro del lunes 16 con hoy=18 → ${mondayLog} (esperado 1)`)
const sundayCount = entriesThisWeek([{ date: '2026-11-16' }, { date: '2026-11-15' }, { date: '2026-11-22' }], '2026-11-22'); if (sundayCount !== 2) fail(`domingo 22: semana del 16 al 22 → ${sundayCount} (esperado 2: el 16 y el 22; el 15 es de la semana anterior)`)
// entradas raras no lanzan
for (const bad of [[], [{ date: null }], [{ date: undefined }], [{ date: '' }], [{ date: 20261116 }], [{ date: 'basura' }]]) { try { entriesThisWeek(bad, '2026-11-18') } catch (e) { fail(`entriesThisWeek lanzó con ${JSON.stringify(bad)}: ${e.message}`) } }
console.log(`${fails ? 'FALLA' : 'OK   '} [${tz}] ${n} días × semana/tendencia/etiquetas es-en + ${hrs} instantes todayKey${fails ? ` · ${fails} fallos` : ''}`)
process.exit(fails ? 1 : 0)
