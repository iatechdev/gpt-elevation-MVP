// [QA-Claude] ES-312 · PR #360 · H9 mutaciones. Aplica cada mutación (cadena exacta ÚNICA) a safety.js o a la tabla, corre la prueba del PR y mi guion (es312-detector.cjs h1–h5), y restaura con git checkout.
//   QA_SUT=<repo> QA_OUT=<carpeta> node qa/security/es312-mutaciones.cjs
const fs = require('fs'); const path = require('path'); const { spawnSync } = require('child_process');
const REPO = process.env.QA_SUT || 'C:/Users/Usuario/Documents/qa-pr-253'; const B = path.join(REPO, 'backend'); const OUT = process.env.QA_OUT || '.';
const SAFETY = path.join(B, 'utils', 'safety.js'); const TABLE = path.join(B, 'utils', 'confusables-table.js'); const PRE = path.join(B, 'utils', 'confusables-pre.js'); const SCRIPT = path.join(__dirname, 'es312-detector.cjs');
const restore = () => spawnSync('git', ['-C', REPO, 'checkout', '-q', '--', 'backend'], { encoding: 'utf8' });
const patch = (file, from, to) => { const t = fs.readFileSync(file, 'utf8'); const n = t.split(from).length - 1; if (n !== 1) throw new Error(`la cadena no es única (${n}): ${from.slice(0, 60)}`); fs.writeFileSync(file, t.replace(from, () => to)); };
const dropScript = (file, re) => { const t = fs.readFileSync(file, 'utf8').split('\n').filter((l) => { const m = l.match(/^  '\\u\{([0-9a-f]+)\}': '[a-z]+',$/); return !(m && re.test(String.fromCodePoint(parseInt(m[1], 16)))); }).join('\n'); fs.writeFileSync(file, t); };
const runPr = () => { const r = spawnSync(process.execPath, ['--test', 'test/es-312-confusables.test.cjs'], { cwd: B, encoding: 'utf8', timeout: 600000 }); const pass = (r.stdout.match(/^# pass (\d+)/m) || [])[1]; const fail = (r.stdout.match(/^# fail (\d+)/m) || [])[1]; return `${pass}/${fail}`; };
const runMine = () => { const r = spawnSync(process.execPath, [SCRIPT], { cwd: path.join(__dirname, '..', '..'), encoding: 'utf8', env: { ...process.env, CASES: 'h1,h2,h3,h4,h5', QA_OUT: OUT, QA_SUT: REPO }, maxBuffer: 1 << 26, timeout: 900000 }); const o = {}; for (const l of r.stdout.split('\n')) { try { const j = JSON.parse(l); if (j.ok !== undefined) o[j.id.slice(0, 60)] = (j.ok ? 'ok' : 'FALLA') + (j.ok ? '' : ':' + String(j.detail).slice(0, 120)); } catch { /* línea de resumen */ } } return o; };
const T1 = "'\\u{131}': 'i',"; const T2 = "'\\u{138}': 'k',";
const MUT = [
  ['m1 tabla generada vacía', () => patch(SAFETY, 'const HOMOGLYPHS = { ...TABLE_HOMOGLYPHS, ...MANUAL_HOMOGLYPHS };', 'const HOMOGLYPHS = { ...MANUAL_HOMOGLYPHS };')],
  ['m2 quitar el paso de homoglifos', () => patch(SAFETY, '.replace(scan, (c) => table[c] || c)', '.replace(scan, (c) => c)')],
  ['m3 no emitir la segunda pasada (tabla completa)', () => patch(SAFETY, 'yield* riskFormsWith(raw, unmask, fresh, nfkcFull, hasPre ? nfkcFull.toLowerCase() : lowered); }', '}')],
  ['m4 mapeo erróneo de un carácter (ı → o)', () => patch(TABLE, T1, "'\\u{131}': 'o',")],
  ['m5 intercambiar dos destinos (ı↔ĸ)', () => { patch(TABLE, T1, "'\\u{131}': 'k',"); patch(TABLE, T2, "'\\u{138}': 'i',"); }],
  ['m6 añadir una clave ASCII (a → b)', () => patch(TABLE, T1, "'a': 'b',\n  " + T1)],
  ['m7 destino en mayúscula (ı → I)', () => patch(TABLE, T1, "'\\u{131}': 'I',")],
  ['m8 destino de varias letras (ı → ii)', () => patch(TABLE, T1, "'\\u{131}': 'ii',")],
  ['m9 quitar el armenio', () => dropScript(TABLE, /\p{Script=Armenian}/u)],
  ['m10 quitar cherokee', () => dropScript(TABLE, /\p{Script=Cherokee}/u)],
  ['m11 incluir CJK (一 → a)', () => patch(TABLE, T1, "'\\u{4e00}': 'a',\n  " + T1)],
  ['m12 quitar la minúscula previa', () => patch(SAFETY, "const plain = PLAIN.test(raw); const nfkc = plain ? raw : raw.normalize('NFKC'); const lowered = plain ? raw.toLowerCase() : nfkc.toLowerCase();", "const plain = PLAIN.test(raw); const nfkc = plain ? raw : raw.normalize('NFKC'); const lowered = plain ? raw.toLowerCase() : nfkc;")],
  ['m13 alterar la primera forma (no se emite)', () => patch(SAFETY, 'const first = flat(raw); if (fresh(first)) yield first;', 'const first = flat(raw); fresh(first);')],
  ['m14 clave de Latin-1 (ñ → n)', () => patch(TABLE, T1, "'ñ': 'n',\n  " + T1)],
  ['m15 no escanear las claves nuevas (pasada completa con el escaneo manual)', () => patch(SAFETY, 'const FULL_SCAN = scanOf(HOMOGLYPHS);', 'const FULL_SCAN = scanOf(MANUAL_HOMOGLYPHS);')],
  ['m16 la tabla generada manda sobre la manual (equivalente: sin claves comunes)', () => patch(SAFETY, 'const HOMOGLYPHS = { ...TABLE_HOMOGLYPHS, ...MANUAL_HOMOGLYPHS };', 'const HOMOGLYPHS = { ...MANUAL_HOMOGLYPHS, ...TABLE_HOMOGLYPHS };')],
  ['m17 la pasada de siempre usa la tabla completa (vuelve la regresión E312-1)', () => patch(SAFETY, 'const unmaskManual = makeUnmask(MANUAL_HOMOGLYPHS, MANUAL_SCAN);', 'const unmaskManual = makeUnmask(HOMOGLYPHS, FULL_SCAN);')],
  ['m18 la segunda pasada nunca se evalúa', () => patch(SAFETY, 'if (!plain && (hasPre || NEW_KEYS.test(lowered)))', 'if (false)')],
  ['m19 la segunda pasada solo con letras de la tabla manual', () => patch(SAFETY, "const NEW_KEYS = new RegExp(scanOf(TABLE_HOMOGLYPHS).source, 'u');", "const NEW_KEYS = new RegExp(scanOf(MANUAL_HOMOGLYPHS).source, 'u');")],
  ['m20 tabla PREVIA vacía', () => patch(SAFETY, "const PRE_HOMOGLYPHS = require('./confusables-pre.js');", 'const PRE_HOMOGLYPHS = {};')],
  ['m21 la PREVIA solo antes de NFKC (no otra vez después)', () => patch(SAFETY, "preMap(preMap(String(text)).normalize('NFKC'))", "preMap(String(text)).normalize('NFKC')")],
  ['m22 nunca se activa la pasada por letras PREVIAS', () => patch(SAFETY, 'const hasPre = !plain && (PRE_TEST.test(raw) || PRE_TEST.test(nfkc));', 'const hasPre = false;')],
  ['m23 destino erróneo en la PREVIA (Μ → n)', () => patch(PRE, "'\\u{39c}': 'm',", "'\\u{39c}': 'n',")],
  ['m24 clave ASCII en la PREVIA (A → b)', () => patch(PRE, "'\\u{184}': 'b',", "'A': 'b',\n  '\\u{184}': 'b',")],
];
restore(); const base = runMine(); const basePr = runPr(); console.log('BASE prueba del PR (pasan/fallan):', basePr, '| mi guion fallas:', Object.entries(base).filter(([, v]) => v !== 'ok').map(([k]) => k.slice(0, 30)).join(' | '));
let survived = 0;
for (const [name, apply] of MUT) {
  restore(); let applied = true; try { apply(); } catch (e) { applied = false; console.log(`${name}: NO APLICA (${e.message})`); }
  if (!applied) continue;
  const pr = runPr(); const mine = runMine(); const diff = Object.entries(mine).filter(([k, v]) => v !== base[k]).map(([k]) => k.slice(0, 28));
  const prDetect = pr.split('/')[1] !== '0' || pr.startsWith('undefined'); const mineDetect = diff.length > 0; if (!prDetect && !mineDetect) survived++;
  console.log(`${name}: prueba del PR ${pr} → ${prDetect ? 'DETECTADA' : 'no detecta'} | mi guion: ${mineDetect ? 'DETECTADA (' + diff.slice(0, 3).join(' | ') + ')' : 'no detecta'}`);
}
restore(); console.log(`SOBREVIVEN: ${survived} de ${MUT.length}`);
