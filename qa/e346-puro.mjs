// QA-Claude-2 — PR #346: tabla de verdad de withFarewell/isFarewell/gateDecision (función pura) — uso: FRONTEND=<clon>/frontend node qa/e346-puro.mjs
import path from 'node:path'; import { pathToFileURL } from 'node:url'
const FE = path.resolve(process.env.FRONTEND); const { withFarewell, gateDecision } = await import(pathToFileURL(path.join(FE, 'src/shell/access.ts')).href); const { startFarewell, endFarewell, isFarewell } = await import(pathToFileURL(path.join(FE, 'src/access/farewell.ts')).href)
let n = 0, f = 0; const ck = (name, ok, d = '') => { n++; if (!ok) { f++; console.log('FALLA', name, d) } }
const DEC = ['allow', 'login', 'noAccess', 'wait', 'retry', 'checking', 'unavailable'], seen = new Set()
for (const st of [{ status: 'checking' }, { status: 'unavailable' }, { status: 'anonymous' }, { status: 'verified', role: 'user' }, { status: 'verified', role: 'admin' }, { status: 'verified', role: 'therapist' }]) for (const p of ['/app/data', '/app/dashboard', '/admin/users', '/therapist/dashboard', '/', '/login']) for (const z of [undefined, 'member', 'admin']) { try { seen.add(gateDecision(st, p, z)) } catch { /* combinación inválida */ } }
console.log('decisiones posibles de gateDecision:', [...seen].join(', '))
for (const d of seen) { ck(`sin marca: ${d} no cambia`, withFarewell(d, false) === d); ck(`con marca: ${d} → ${d === 'login' ? 'allow' : d}`, withFarewell(d, true) === (d === 'login' ? 'allow' : d), `fue ${withFarewell(d, true)}`) }
endFarewell(); ck('sin marca isFarewell(/app/data)=false', !isFarewell('/app/data'))
startFarewell('/app/data'); for (const [p, exp] of [['/app/data', true], ['/app/data/', false], ['/app/data/x', false], ['/app/datax', false], ['/app/dashboard', false], ['/', false], ['', false], ['/APP/DATA', false], ['/app/data?x=1', false]]) ck(`marca en /app/data: isFarewell(${JSON.stringify(p)}) = ${exp}`, isFarewell(p) === exp)
startFarewell('/app/data'); startFarewell('/app/dashboard'); ck('una segunda marca reemplaza a la primera (una sola ruta)', !isFarewell('/app/data') && isFarewell('/app/dashboard')); endFarewell(); ck('endFarewell borra', !isFarewell('/app/dashboard')); endFarewell(); ck('endFarewell repetido es inocuo', !isFarewell('/app/dashboard'))
console.log(`RESUMEN puro: ${n - f}/${n} OK, ${f} FALLAS`); process.exit(f ? 1 : 0)
