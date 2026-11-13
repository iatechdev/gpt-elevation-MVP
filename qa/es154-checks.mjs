// QA-Claude-2 — ES-154 (PR #140): comprobaciones propias del catálogo textos.json y de format.ts. Env: REPO (raíz del repo del head). Ejecutar con: node --experimental-strip-types qa/es154-checks.mjs
import fs from 'node:fs'
const REPO = process.env.REPO
const { interpolate, placeholdersOf, formatNumber, formatDate, pluralForm } = await import('file:///' + REPO.replace(/\\/g, '/') + '/frontend/src/i18n/format.ts')
let f = 0; const ck = (n, ok, x = '') => { if (!ok) f++; console.log((ok ? 'OK   ' : 'FALLA ') + n, x) }
const src = JSON.parse(fs.readFileSync(REPO + '/docs/ux/plataforma/textos.json', 'utf8'))
const es = JSON.parse(fs.readFileSync(REPO + '/frontend/src/i18n/catalog/es.json', 'utf8')), en = JSON.parse(fs.readFileSync(REPO + '/frontend/src/i18n/catalog/en.json', 'utf8'))
// estructura de la fuente
const entries = []; const walk = (o, p) => { for (const [k, v] of Object.entries(o)) { if (v && typeof v === 'object' && ('es' in v || 'en' in v)) entries.push([p + k, v]); else if (v && typeof v === 'object') walk(v, p + k + '.') } }
walk(src.textos || {}, ''); if (src.rutas) walk(src.rutas, 'rutas.')
console.log('INFO claves en la fuente:', entries.length, '| en el catálogo ES:', Object.keys(es).length, 'EN:', Object.keys(en).length)
const sinEs = entries.filter(([, v]) => !v.es || !String(v.es).trim()).map(([k]) => k), sinEn = entries.filter(([, v]) => !v.en || !String(v.en).trim()).map(([k]) => k)
ck('C2 claves sin texto ES o EN: solo las 2 faltas conocidas', sinEs.length + sinEn.length <= 2, `sin ES=${sinEs.length} sin EN=${sinEn.length} ${sinEs.concat(sinEn).slice(0, 3).join(',')}`)
const marcDif = entries.filter(([, v]) => v.es && v.en && placeholdersOf(String(v.es)).join() !== placeholdersOf(String(v.en)).join()).map(([k]) => k); ck('C2 marcadores {x} idénticos en ES y EN', marcDif.length === 0, marcDif.slice(0, 4).join(','))
const igual = entries.filter(([, v]) => v.es && v.en && String(v.es).trim() === String(v.en).trim() && String(v.es).length > 25).map(([k]) => k); console.log('INFO textos largos idénticos en ES y EN (posible EN sin traducir):', igual.length, igual.slice(0, 5).join(','))
const ejemplo = entries.filter(([, v]) => /\(ejemplo\)|\(example\)/i.test(String(v.es) + String(v.en))).length; console.log('INFO textos marcados «(ejemplo)»:', ejemplo)
const enEnEs = entries.filter(([, v]) => v.es && /\b(the|and|your|please|with|you)\b/i.test(String(v.es)) && !/[áéíóúñ¿¡]/i.test(String(v.es)) && String(v.es).length > 20).map(([k]) => k); console.log('INFO textos ES que parecen inglés:', enEnEs.length, enEnEs.slice(0, 5).join(','))
const secretos = JSON.stringify(src).match(/sk-[A-Za-z0-9]{16,}|eyJ[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{12,}|-----BEGIN [A-Z ]*PRIVATE KEY|[A-Za-z0-9._%+-]+@(?!example\.)[A-Za-z0-9.-]+\.[a-z]{2,}/g) || []; ck('S1 la fuente no contiene secretos ni correos reales', secretos.length === 0, secretos.slice(0, 3).join(' | '))
const aprob = JSON.stringify(es).match(/\b\d{3}[ .-]\d{3}[ .-]\d{4}\b/g) || []; console.log('INFO posibles teléfonos en el catálogo ES:', aprob.length, aprob.slice(0, 3).join(' | '))
// t(): sustitución
ck('C3 sustituye {name} y {n}', interpolate('Hola {name}, {n} pasos', { name: 'Ana', n: 3 }) === 'Hola Ana, 3 pasos')
ck('C3 marcador sin valor queda visible y nunca «undefined»', interpolate('Hola {name}', {}) === 'Hola {name}' && !interpolate('Hola {name}', { other: 1 }).includes('undefined'))
ck('C3 params con HTML se devuelven como texto (React lo escapa)', interpolate('Hola {name}', { name: '<img src=x onerror=alert(1)>' }) === 'Hola <img src=x onerror=alert(1)>', '(el escape lo hace React; ver comprobación de dangerouslySetInnerHTML)')
ck('C3 marcador con nombre de prototipo no inyecta funciones', !/function|\[native/.test(interpolate('x {constructor} {toString} {__proto__}', { a: 1 })), interpolate('x {constructor} {toString}', { a: 1 }))
ck('C3 plantilla con $& o $1 se trata como literal', interpolate('Costo {n}', { n: '$&$1' }) === 'Costo $&$1', interpolate('Costo {n}', { n: '$&$1' }))
// formatos
ck('C4 formatNumber ES usa coma decimal y EN punto', formatNumber(1234.5, 'es') !== formatNumber(1234.5, 'en') && formatNumber(0.5, 'es').includes(',') && formatNumber(0.5, 'en').includes('.'), `${formatNumber(1234.5, 'es')} | ${formatNumber(1234.5, 'en')}`)
ck('C4 formatDate válida distinta por idioma e inválida → cadena vacía', formatDate('2026-11-08T12:00:00', 'es') !== formatDate('2026-11-08T12:00:00', 'en') && formatDate('no-fecha', 'es') === '' && formatDate(NaN, 'en') === '', `${formatDate('2026-11-08T12:00:00', 'es')} | ${formatDate('2026-11-08T12:00:00', 'en')}`)
const pl = (n, l) => pluralForm(n, l, { one: 'uno', other: 'otros' }); ck('C4 plurales: 1 → uno; 0, 2, 1.5 → otros (ES y EN)', ['es', 'en'].every(l => pl(1, l) === 'uno' && pl(0, l) === 'otros' && pl(2, l) === 'otros' && pl(1.5, l) === 'otros'))
console.log(f ? `\nFALLAS ${f}` : '\nTODO OK'); process.exit(f ? 1 : 0)
