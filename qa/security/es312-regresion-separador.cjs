// [QA-Claude] ES-312 · PR #360 · H6: un carácter de la tabla usado como RELLENO/RUIDO entre palabras o letras: main lo detecta (lo trata como separador), la cabeza ya no (lo toma por letra).
//   QA_SUT=<repo> node qa/security/es312-regresion-separador.cjs
const fs = require('fs'); const path = require('path'); const { spawnSync } = require('child_process');
const REPO = process.env.QA_SUT || 'C:/Users/Usuario/Documents/qa-pr-253'; const SUT = path.join(REPO, 'backend');
const NEW = require(path.join(SUT, 'utils', 'safety.js')).detectRisk; const TABLE = require(path.join(SUT, 'utils', 'confusables-table.js'));
const src = spawnSync('git', ['-C', REPO, 'show', 'origin/main:backend/utils/safety.js'], { encoding: 'utf8', maxBuffer: 1 << 24 }).stdout; const m = { exports: {} };
new Function('module', 'exports', 'require', src)(m, m.exports, (p) => (p.startsWith('.') ? require(path.resolve(path.join(SUT, 'utils'), p)) : require(p))); const OLD = m.exports.detectRisk;
const shapes = { 'entre palabras sin espacios': (k, s) => s.replace(/ /g, k), 'entre palabras con espacios': (k, s) => s.replace(/ /g, ' ' + k + ' '), 'al final de la frase': (k, s) => s + k, 'antes de la frase': (k, s) => k + s, 'entre cada letra': (k, s) => [...s].join(k) };
const phrases = ['quiero morir', 'voy a matarme', 'suicidio', 'no quiero vivir', 'kill myself', 'i want to die'];
const out = {}; const chars = {}; let tot = 0, down = 0;
for (const [sn, f] of Object.entries(shapes)) { out[sn] = { total: 0, down: 0, up: 0 }; for (const k of Object.keys(TABLE)) for (const s of phrases) { const t = f(k, s); const a = NEW(t), b = OLD(t); out[sn].total++; tot++; const r = (x) => ({ high: 2, medium: 1 }[x.level] || 0); if (r(a) < r(b)) { out[sn].down++; down++; chars[k] = (chars[k] || 0) + 1; } else if (r(a) > r(b)) out[sn].up++; } }
for (const [sn, v] of Object.entries(out)) console.log(`${sn}: ${v.down} bajadas de ${v.total} (${(100 * v.down / v.total).toFixed(1)} %), ${v.up} subidas`);
console.log(`TOTAL ${down} bajadas de ${tot}; caracteres de la tabla implicados: ${Object.keys(chars).length}/${Object.keys(TABLE).length}`);
for (const k of ['ı', 'ᴏ', 'г', 'σ', 'ɪ']) for (const t of ['quiero' + k + 'morir', 'quiero ' + k + ' morir', 'quiero morir' + k]) console.log(JSON.stringify(t), 'cabeza', NEW(t).level, 'main', OLD(t).level);
