// [QA-Claude] ES-314: ¿las etiquetas del mapa nuevo (cola del equipo) coinciden con las del modal antiguo (MatchingModal.tsx) para los mismos valores?
const fs = require('fs'); const SUT = 'C:/Users/Usuario/Documents/qa-pr-test/frontend/src/';
const modal = fs.readFileSync(SUT + 'components/MatchingModal.tsx', 'utf8'); const copy = fs.readFileSync(SUT + 'pages/progressCopy.ts', 'utf8'); const lab = fs.readFileSync(SUT + 'progress/answerLabels.ts', 'utf8');
const blk = (n) => { const i = modal.indexOf('const ' + n + ' = ['); return modal.slice(i, modal.indexOf('\n]', i) + 2); };
const rows = (b) => [...b.matchAll(/key:\s*'([^']+)',\s*es:\s*'([^']+)',\s*en:\s*'([^']+)'/g)].map((m) => ({ k: m[1], es: m[2], en: m[3] }));
const texts = (b) => Object.fromEntries([...b.matchAll(/(pr_[a-z_]+):\s*'((?:[^'\\]|\\.)*)'/g)].map((m) => [m[1], m[2]]));
const blockC = (n) => { const i = copy.indexOf('export const ' + n); return copy.slice(i, copy.indexOf('\n}', i)); }; const ES = texts(blockC('progressEs')); const EN = texts(blockC('progressEn'));
const mapSrc = lab.slice(lab.indexOf('export const ANSWER_LABEL_KEYS'), lab.indexOf('// Opciones que ofrece')); const MAP = eval('(' + mapSrc.slice(mapSrc.indexOf('=') + 1).replace(/:\s*Record<[^>]+>/g, '').trim().replace(/;$/, '') + ')');
const out = [];
for (const [name, kind] of [['TOPICS', 'area'], ['APPROACHES', 'style'], ['LANGUAGES', 'language']]) for (const r of rows(blk(name))) { const key = MAP[kind][r.k]; if (!key) { out.push(`${kind}=${r.k}: SIN etiqueta en el mapa`); continue; } const same = ES[key] === r.es && EN[key] === r.en; out.push(`${same ? '=' : '≠'} ${kind}=${r.k}: modal «${r.es}»/«${r.en}» · cola «${ES[key]}»/«${EN[key]}»`); }
console.log(out.join('\n'));
