// [QA-Claude] ES-314 · PR #281 · T5 (consistencia con el catálogo del servidor), T9 (vocabulario) y base de T7 (mutaciones). Estático, sin servidor ni navegador.
//   QA_SUT=<repo> node qa/integration/es314-estatico.cjs
const fs = require('fs'); const path = require('path'); const SUT = process.env.QA_SUT || 'C:/Users/Usuario/Documents/qa-pr-test';
const read = (r) => fs.readFileSync(path.join(SUT, r), 'utf8'); const fails = []; const info = [];
const eq = (name, ok, d = '') => { if (!ok) fails.push(name + (d ? ' :: ' + d : '')); };
// catálogo del servidor
const srv = read('backend/routes/matching.js'); const catSrc = srv.slice(srv.indexOf('const ANSWER_CATALOG = {'), srv.indexOf('};', srv.indexOf('const ANSWER_CATALOG = {')) + 2);
const CATALOG = eval('(' + catSrc.replace('const ANSWER_CATALOG = ', '').replace(/;$/, '') + ')');
// mapa del frontend
const lab = read('frontend/src/progress/answerLabels.ts'); const mapSrc = lab.slice(lab.indexOf('export const ANSWER_LABEL_KEYS'), lab.indexOf('// Opciones que ofrece'));
const MAP = eval('(' + mapSrc.slice(mapSrc.indexOf('=') + 1).replace(/:\s*Record<[^>]+>/g, '').trim().replace(/;$/, '') + ')');
// textos ES/EN
const copy = read('frontend/src/pages/progressCopy.ts'); const block = (name) => { const i = copy.indexOf(`export const ${name}`); const j = copy.indexOf('\n}', i); return copy.slice(i, j); };
const texts = (b) => Object.fromEntries([...b.matchAll(/(pr_[a-z_]+):\s*'((?:[^'\\]|\\.)*)'/g)].map((m) => [m[1], m[2]])); const ES = texts(block('progressEs')); const EN = texts(block('progressEn'));
for (const kind of ['area', 'style', 'language']) {
  for (const v of CATALOG[kind]) { const key = MAP[kind] && MAP[kind][v]; eq(`servidor→mapa ${kind}=${v}`, !!key, 'el valor del servidor no tiene etiqueta'); if (key) { eq(`ES ${key}`, !!ES[key], 'falta texto ES'); eq(`EN ${key}`, !!EN[key], 'falta texto EN'); eq(`ES≠clave ${key}`, ES[key] && ES[key] !== key); eq(`EN≠ES ${key}`, !(ES[key] === EN[key] && !/^(Hábitos|Habits)$/.test(ES[key])) || ['Depresión'].includes(ES[key]) === false); } }
  for (const v of Object.keys(MAP[kind] || {})) eq(`mapa→servidor ${kind}=${v}`, CATALOG[kind].includes(v), 'el mapa trae un valor que el servidor NO acepta');
}
// opciones del cuestionario ⊂ catálogo
for (const [name, kind] of [['AREA_OPTIONS', 'area'], ['STYLE_OPTIONS', 'style'], ['LANGUAGE_OPTIONS', 'language']]) { const i = lab.indexOf(`export const ${name}`); const line = lab.slice(i, lab.indexOf('\n', i)); for (const m of line.matchAll(/\['([^']+)', '(pr_[a-z_]+)'\]/g)) { eq(`opción ${name}=${m[1]} en el catálogo`, CATALOG[kind].includes(m[1])); eq(`opción ${name}=${m[1]} apunta a la clave del mapa`, MAP[kind][m[1]] === m[2], `${MAP[kind][m[1]]} vs ${m[2]}`); } }
// vocabulario
const clinical = []; for (const [k, v] of [...Object.entries(ES), ...Object.entries(EN)]) if (/^pr_[asl]_/.test(k) && /ansiedad|anxiety(?! )/i.test(v)) clinical.push(`${k}=${v}`); eq('T9 ningún texto de respuesta dice «Ansiedad»/«Anxiety»', clinical.length === 0, clinical.join(', '));
info.push(`catálogo del servidor: area ${CATALOG.area.length}, style ${CATALOG.style.length}, language ${CATALOG.language.length}; claves del mapa: area ${Object.keys(MAP.area).length}, style ${Object.keys(MAP.style).length}, language ${Object.keys(MAP.language).length}`);
info.push(`ES: ${ES.pr_a_anxiety} / ${ES.pr_a_stress}; EN: ${EN.pr_a_anxiety} / ${EN.pr_a_stress} (convivencia «Estrés y carga» y «Manejo del estrés»)`);
console.log(info.join('\n')); console.log(`FALLAN ${fails.length}${fails.length ? ': ' + fails.slice(0, 8).join(' | ') : ''}`);
