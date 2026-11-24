// QA-Claude-5 · #377: los 3 textos nuevos del paso 3 coinciden LITERALMENTE con los aprobados (ES-237, comentario 12710) y no hay otro texto nuevo en copy.ts respecto a main.
// Uso: node qa/qa5-377-textos.cjs <ruta copy.ts del PR> <ruta copy.ts de main>
const fs = require('fs'); const [pr, main] = process.argv.slice(2).map(p => fs.readFileSync(p, 'utf8'))
const approved = {
  availability: ['Disponibilidad semanal confirmada', 'Confirmed weekly availability'], resource: ['Recursos del catálogo', 'Catalog resources'],
  preview: ['Vista preliminar. Tus restricciones, elecciones, experimentos y plan se guardan en tu cuenta; los recordatorios todavía no.', 'Preview. Your constraints, choices, experiments and plan are saved to your account; reminders are not yet.'],
}
const QUOTED = new RegExp("'((?:[^'\\\\]|\\\\.)*)'", 'g')
const strs = s => new Set([...s.matchAll(QUOTED)].map(m => m[1]))
const a = strs(pr), b = strs(main)
const newTexts = [...a].filter(x => !b.has(x)); const want = new Set(Object.values(approved).flat())
let bad = 0
for (const t of newTexts) if (!want.has(t) && t.length > 2 && /\s/.test(t)) { bad++; console.log('NO APROBADO (texto nuevo en copy.ts):', t.slice(0, 120)) }
for (const [k, [es, en]] of Object.entries(approved)) { if (!(pr.includes("'" + es + "'") && pr.includes("'" + en + "'"))) { bad++; console.log('FALTA/DISTINTO el aprobado', k) } }
console.log(bad ? 'FALLA: ' + bad : 'OK: los 3 textos aprobados están literales y no hay textos nuevos fuera de la lista (' + newTexts.length + ' cadenas nuevas en total)')
process.exit(bad ? 1 : 0)
