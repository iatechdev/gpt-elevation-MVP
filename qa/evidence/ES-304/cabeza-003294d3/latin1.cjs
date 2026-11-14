const path = require('path'); const { spawnSync } = require('child_process');
const REPO = 'C:/Users/Usuario/Documents/qa-pr-253'; const SUT = REPO + '/backend';
const loadRef = (ref) => { const src = spawnSync('git', ['-C', REPO, 'show', `${ref}:backend/utils/safety.js`], { encoding: 'utf8', maxBuffer: 1 << 24 }).stdout; const m = { exports: {} }; new Function('module', 'exports', 'require', src)(m, m.exports, (p) => (p.startsWith('.') ? require(path.resolve(SUT + '/utils', p)) : require(p))); return m.exports.detectRisk; };
const NEW = require(SUT + '/utils/safety.js').detectRisk; const PREV = loadRef('b58eae7e'); const MAIN = loadRef('origin/main');
const esc = (s) => s.replace(/[^\x20-\x7e]/g, (c) => '<' + c.codePointAt(0).toString(16) + '>');
const rows = [];
for (let c = 0xA0; c <= 0xFF; c++) { const ch = String.fromCodePoint(c); const forms = { 'sustituye la «o»': 'quiero morir'.replace(/o/g, ch), 'sustituye la «i»': 'suicidio'.replace(/i/g, ch), 'sustituye la «a»': 'voy a matarme'.replace(/a/g, ch), 'intercalado': [...'quiero morir'].join(ch), 'como separador de palabras': 'quiero' + ch + 'morir' }; for (const [k, t] of Object.entries(forms)) { const a = NEW(t).level, b = PREV(t).level, m = MAIN(t).level; if (a !== b) rows.push(`U+${c.toString(16).toUpperCase()} ${k}: main ${m} | cabeza anterior ${b} | nueva ${a}  ${esc(t)}`); } }
console.log(rows.join('\n')); console.log('total', rows.length, '| pierden (anterior alto → nueva nulo):', rows.filter((r) => /anterior high \| nueva null/.test(r)).length);
