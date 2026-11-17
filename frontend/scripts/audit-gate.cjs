// Puerta de auditoría de dependencias del frontend (reemplaza `npm audit --omit=dev --audit-level=high` en la CI).
// Sigue BLOQUEANDO cualquier vulnerabilidad alta o crítica de producción, salvo una lista de excepciones EXPLÍCITA, con motivo y FECHA DE CADUCIDAD:
// pasada la fecha, la excepción deja de valer y la puerta falla aunque el aviso siga. Una advertencia distinta (alta/crítica) siempre falla.
// No usa `npm audit fix`. Uso: `node scripts/audit-gate.cjs` (desde frontend/). Para pruebas: AUDIT_GATE_NOW=<ISO> fija «hoy».
// Detalle y revisión pendiente: docs/AUDITORIA-DEPENDENCIAS.md
const { spawnSync } = require('node:child_process')

/** Excepciones vigentes. Agregar una exige motivo y fecha; quitarla es borrar la línea. `until` es inclusive (hasta el final de ese día, UTC). */
const EXCEPTIONS = [{
  id: 'GHSA-fc5q-39xc-vjpf', // picomatch: ReDoS en extglobs repetidos; llega por vite → tinyglobby → fdir → picomatch (4.0.7 es la última versión y sigue marcada)
  until: '2026-12-01',
  reason: 'picomatch solo lo usa la herramienta de build (vite/tinyglobby/fdir) para casar rutas de archivos propios en tiempo de compilación; no está en el bundle que se sirve al cliente. '
    + 'Sin versión corregida de picomatch; la única salida de npm es bajar vite a 6.2.7 (cambio mayor). Revisar cuando haya parche de picomatch o de vite.',
}]

const HIGH = new Set(['high', 'critical'])
const ghsa = via => { const match = /(GHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4})/i.exec(via.url ?? ''); return match ? match[1] : `source:${via.source}` }

/** Devuelve { ok, blocked, allowed, expired } a partir del JSON de `npm audit --json`. Pura: no lee la red ni el reloj salvo `now`. */
function evaluate(report, now = new Date(), exceptions = EXCEPTIONS) {
  const vulnerabilities = report && typeof report === 'object' && report.vulnerabilities && typeof report.vulnerabilities === 'object' ? report.vulnerabilities : null
  if (!vulnerabilities) return { ok: false, blocked: ['El informe de npm audit no tiene el formato esperado'], allowed: [], expired: [] }
  const roots = (name, seen = new Set()) => {
    if (seen.has(name)) return []
    seen.add(name)
    const entry = vulnerabilities[name]
    if (!entry || !Array.isArray(entry.via)) return [{ unknown: name }]
    return entry.via.flatMap(via => (typeof via === 'string' ? roots(via, seen) : [{ id: ghsa(via), title: via.title ?? '', severity: via.severity, package: via.name ?? name }]))
  }
  const advisories = new Map(); const blocked = []
  for (const [name, entry] of Object.entries(vulnerabilities)) {
    if (!entry || !HIGH.has(entry.severity)) continue
    const found = roots(name)
    if (found.length === 0 || found.some(item => item.unknown)) { blocked.push(`${name} (${entry.severity}): origen del aviso desconocido`); continue }
    for (const item of found) if (HIGH.has(item.severity)) advisories.set(item.id, item)
  }
  const today = now.getTime(); const allowed = []; const expired = []
  for (const [id, item] of advisories) {
    const exception = exceptions.find(candidate => candidate.id === id)
    const label = `${id} (${item.package}: ${item.title})`
    if (!exception) { blocked.push(`${label}: sin excepción`); continue }
    const lastDay = Date.parse(`${exception.until}T23:59:59.999Z`)
    if (!Number.isFinite(lastDay) || today > lastDay) { expired.push(`${label}: la excepción caducó el ${exception.until}`); continue }
    allowed.push(`${label}: permitido hasta ${exception.until}`)
  }
  return { ok: blocked.length === 0 && expired.length === 0, blocked, allowed, expired }
}

function main() {
  const now = process.env.AUDIT_GATE_NOW ? new Date(process.env.AUDIT_GATE_NOW) : new Date()
  if (Number.isNaN(now.getTime())) { console.error('AUDIT_GATE_NOW no es una fecha válida'); process.exit(2) }
  const run = spawnSync('npm', ['audit', '--omit=dev', '--json'], { encoding: 'utf8', shell: process.platform === 'win32', maxBuffer: 64 * 1024 * 1024 })
  let report
  try { report = JSON.parse(run.stdout) } catch { console.error('No se pudo leer la salida de npm audit (¿sin red o sin lockfile?):\n' + (run.stderr || run.stdout || '').slice(0, 800)); process.exit(2) }
  if (report.error) { console.error('npm audit falló: ' + JSON.stringify(report.error).slice(0, 400)); process.exit(2) }
  const result = evaluate(report, now)
  for (const line of result.allowed) console.log('EXCEPCIÓN VIGENTE  ' + line)
  for (const line of result.expired) console.error('EXCEPCIÓN CADUCADA ' + line)
  for (const line of result.blocked) console.error('BLOQUEA            ' + line)
  console.log(result.ok ? 'Auditoría de dependencias: sin altas ni críticas fuera de las excepciones vigentes.' : 'Auditoría de dependencias: FALLA.')
  process.exit(result.ok ? 0 : 1)
}

if (require.main === module) main()
module.exports = { evaluate, EXCEPTIONS }
