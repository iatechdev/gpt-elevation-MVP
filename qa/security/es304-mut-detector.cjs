// [QA-Claude] ES-304 · PR #279 · batería RÁPIDA de mutaciones (solo detectRisk, sin DB). Imprime cuántas aserciones fallan; la línea base debe dar 0.
//   QA_SUT=<repo> node qa/security/es304-mut-detector.cjs
const fs = require('fs'); const path = require('path');
const SUT = path.join(process.env.QA_SUT || 'C:/Users/Usuario/Documents/qa-pr-253', 'backend');
const { detectRisk: det } = require(path.join(SUT, 'utils', 'safety.js'));
const corpus = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'evidence', 'ES-298', 'ES-298-corpus-no-detectado-pr.json'), 'utf8')).noDetectados;
const cp = (...c) => String.fromCodePoint(...c); const fails = [];
const want = (name, text, level) => { let got; try { got = det(text).level; } catch (e) { got = 'EXC'; } if (got !== level) fails.push(name); };
for (const x of corpus) if (!/sin espacios|faltas|SEM/.test(x.category)) want('corpus:' + x.category.slice(0, 22), x.text, 'high');
const combos = ['S\u200bU\u200bI\u200bC\u200bI\u200bD\u200bI\u200bO', 'ｑｕ1ｅｒо mоr1r', 'Q.U.I.E.R.O. M.O.R.I.R', 's u 1 c 1 d 1 0', 'quiero\u3164morir', 'qu\u0456\u0435r\u043e m\u043er\u0456r'.toUpperCase(), 'K1LL MYS3LF', 'k i l l   m y s e l f', 'ｉ ｗａｎｔ ｔｏ ｄｉｅ', 'I w4nt t0 d13', 'quieeeroo mooorir', 'q\u0301u\u0301i\u0301e\u0301r\u0301o\u0301 m\u0301o\u0301r\u0301i\u0301r\u0301', 'quiero,morir', 'no-quiero-vivir', 'kkiillll mmyysseellff'];
for (const c of combos) want('combo:' + JSON.stringify(c).slice(0, 18), c, 'high');
for (const c of [0x3164, 0x2800, 0x115F, 0x1160, 0xFFA0, 0x034F, 0x180E, 0x061C, 0x200B, 0xE0041, 0xFE0F, 0x0301, 0xE000]) want('relleno U+' + c.toString(16), [...'quiero morir'].join(cp(c)), 'high');
for (const c of [0x3164, 0x2800, 0x115F, 0x1160, 0xFFA0]) want('relleno como espacio U+' + c.toString(16), 'quiero' + cp(c) + 'morir', 'high');
want('etiquetas con espacio', Array.from('quiero morir', (ch) => cp(0xE0000 + ch.charCodeAt(0))).join(''), 'high'); want('etiquetas en inglés', Array.from('i want to die', (ch) => cp(0xE0000 + ch.charCodeAt(0))).join(''), 'high');
for (const [n, h] of [['cirílica о', '\u043e'], ['cirílica і', '\u0456'], ['cirílica е', '\u0435'], ['cirílica а', '\u0430'], ['cirílica с', '\u0441'], ['cirílica р', '\u0440'], ['cirílica х', '\u0445'], ['griega ο', '\u03bf'], ['griega α', '\u03b1'], ['griega ι', '\u03b9'], ['griega ρ', '\u03c1'], ['griega υ', '\u03c5'], ['griega ν', '\u03bd'], ['griega τ', '\u03c4'], ['cirílica к', '\u043a'], ['cirílica м', '\u043c'], ['cirílica н', '\u043d'], ['cirílica т', '\u0442'], ['cirílica у', '\u0443'], ['cirílica в', '\u0432'], ['cirílica ѕ', '\u0455'], ['cirílica ј', '\u0458'], ['latina ɡ', '\u0261'], ['cirílica һ', '\u04bb']]) {
  const rep = { о: 'o', і: 'i', е: 'e', а: 'a', с: 'c', р: 'p', х: 'x', ο: 'o', α: 'a', ι: 'i', ρ: 'p', υ: 'u', ν: 'v', τ: 't', к: 'k', м: 'm', н: 'h', т: 't', у: 'y', в: 'b', ѕ: 's', ј: 'j', ɡ: 'g', һ: 'h' }[h];
  const seed = { o: 'quiero morir', i: 'suicidio', e: 'quiero morir', a: 'voy a matarme', c: 'suicidio', p: 'kill myself'.replace('kill myself', 'i plan to die').replace('i plan', 'i planning'), x: 'quitarme la vida', u: 'suicidio', v: 'no quiero vivir', t: 'quitarme la vida', k: 'kill myself', m: 'quiero morir', h: 'i want to die'.replace('i want to', 'better off'), y: 'kill myself', b: 'i wish i was dead', s: 'suicidio', j: 'i want to die', g: 'no quiero seguir viviendo' }[rep];
  if (seed && seed.includes(rep)) want('homoglifo ' + n, seed.split(rep).join(h), 'high');
}
want('mayúscula cirílica (se baja antes de plegar)', 'QU\u0406\u0415R\u041e M\u041eR\u0406R', 'high'); want('mayúscula griega', 'SUICΙDIΟ', 'high');
want('medio normalizado', 'qu13r0 hacerm3 d4ño', 'medium'); want('medio ancho completo', 'ｈａｃｅｒｍｅ ｄａñｏ', 'medium'); want('alto gana al medio', 'no aguanto más y qu13ro m0rir', 'high'); want('alto gana al medio (EN)', "i can't go on and k1ll mys3lf", 'high');
for (const t of ['Quiero morir', 'su\u200bicidio', 'ya no quiero vivir más', 'I want to kill myself']) want('legado:' + t.slice(0, 12), t, 'high'); for (const t of ['quiero hacerme daño', 'ya no aguanto más', "I can't go on"]) want('legado medio:' + t.slice(0, 12), t, 'medium');
for (const t of ['Quiero cambiar de carrera', 'Tengo 3 años de experiencia', 'a b c d e f', 'jajajaja', 'plan A B C D', '4 3 1 0 5 7', 'Holaaaa quiero cambiar de carreraaa']) want('benigna:' + t.slice(0, 14), t, null);
// llamadas repetidas: el estado interno (bandera /g) no debe cambiar el resultado
for (let i = 0; i < 6; i++) want('repetida ' + i, 'quiero\u3164morir', 'high');
// espacios dobles y signos (tidy), mayúsculas en texto llano
want('espacios dobles tras signos', 'quiero,  morir', 'high'); want('espacios dobles', 'no  quiero  vivir', 'high'); want('mayúsculas llanas separadas', 'S U I C I D I O', 'high'); want('mayúsculas llanas', 'QUIERO MORIR', 'high');
// memoria por mensaje (solo si la cabeza la trae)
const S = require(path.join(SUT, 'utils', 'safety.js'))._steps;
if (S && S.clearMemo) {
  S.clearMemo(); const pre = 'x'.repeat(70); want('memoria: clave larga distinta (benigno)', pre + ' hola', null); want('memoria: mismo prefijo de 64 con crisis', pre + ' quiero morir', 'high');
  S.clearMemo(); want('memoria: crisis primero', pre + ' quiero morir', 'high'); want('memoria: mismo prefijo benigno después', pre + ' hola', null);
  S.clearMemo(); const r = det('quiero morir'); r.level = 'basura'; want('memoria: el resultado devuelto es copia', 'quiero morir', 'high'); const r2 = det('quiero morir'); r2.level = 'basura'; want('memoria: copia también desde la memoria', 'quiero morir', 'high');
  S.clearMemo(); for (let i = 0; i < 1500; i++) det('mensaje ' + i + ' ' + 'y'.repeat(i % 2 ? 5 : 80)); if (S.memoSize() > 1000) fails.push('memoria: sin tope (' + S.memoSize() + ')');
  S.clearMemo(); want('memoria: benigno', 'Hola, quiero cambiar de carrera', null); want('memoria: crisis tras benigno (no hay clave única)', 'quiero morir', 'high'); want('memoria: otra frase', 'ya no aguanto más', 'medium');
}
// GRUPO APARTE (hallazgo E304-8): compatibilidad de Latin-1 (º ª ¹ y marcas de espaciado) que la cabeza anterior sí detectaba
const latin = []; const wantL = (name, text) => { let got; try { got = det(text).level; } catch (e) { got = 'EXC'; } if (got !== 'high') latin.push(name); };
wantL('º por o', 'quierº mº' + 'rir'); wantL('ª por a', 'voy ª mªtªrme'); wantL('¹ por i', 'su¹c¹d¹o'); wantL('¨ intercalado', [...'quiero morir'].join('¨')); wantL('¯ intercalado', [...'suicidio'].join('¯')); wantL('´ intercalado', [...'suicidio'].join('´')); wantL('¸ intercalado', [...'suicidio'].join('¸'));
console.log(`FALLAN ${fails.length}${fails.length ? ': ' + [...new Set(fails)].slice(0, 8).join(' | ') : ''} || LATIN1 ${latin.length}${latin.length ? ': ' + latin.join(', ') : ''}`);
