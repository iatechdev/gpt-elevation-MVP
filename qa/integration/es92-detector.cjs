// [QA-Claude] ES-92 · PR #64: detector de riesgo (utils/safety.js) frente a la línea base de main. Funciones puras: corpus, falsos positivos, ofuscación, robustez y tiempos.
// Uso: SAFETY_NEW=<backend/utils/safety.js del merge> SAFETY_OLD=<copia de safety.js de main> node qa/integration/es92-detector.cjs
const { performance } = require('node:perf_hooks');
const N = require(process.env.SAFETY_NEW).detectRisk, O = require(process.env.SAFETY_OLD).detectRisk;
const check = (id, ok, d = '') => console.log(JSON.stringify({ id, ok: !!ok, detail: d }));
const lvl = (f, t) => { try { return f(t).level ?? null; } catch (e) { return 'ERROR:' + e.message; } };
const Z = '​';
// [frase, nivel esperado por el ticket/PR]
const REPORTED = [
  ['me quiero hacer daño', 'medium'], ['Me quiero hacer daño.', 'medium'], ['ME QUIERO HACER DAÑO', 'medium'], ['me   quiero    hacer daño', 'medium'], [`me quiero hacer da${Z}ño`, 'medium'], ['me quiero hacer dano', 'medium'],
  ['me quiero lastimar', 'medium'], ['me quiero lastimar.', 'medium'],
  ['I do not want to live anymore', 'high'], ['I DO NOT WANT TO LIVE ANYMORE', 'high'], ['i do not want to live anymore', 'high'], [`I do not want to live${Z} anymore`, 'high'], ['I don’t want to live anymore', 'high'], ['I don\'t want to live anymore', 'high'], ['I dont want to live anymore', 'high'],
];
const NEW = [
  ['me quisiera hacer daño', 'medium'], ['me voy a hacer daño', 'medium'], ['me pienso lastimar', 'medium'], ['me dan ganas de hacer daño', 'medium'], ['me dan ganas de lastimar', 'medium'], ['me voy a lastimar', 'medium'],
  ['me quiero cortar', 'medium'], ['me quiero cortar las venas', 'medium'], ['me voy a cortar las venas', 'medium'], ['me quisiera cortar la piel', 'medium'], ['me quiero cortar los brazos', 'medium'], ['me quiero cortar las muñecas', 'medium'], ['me voy a cortar el brazo', 'medium'],
  ['i do not wanna live', 'high'], ['I don\'t wanna be alive', 'high'], ['I do not want to be here anymore', 'high'], ['I don’t want to be alive anymore', 'high'],
  ['I want to harm myself', 'medium'], ['I keep harming myself', 'medium'], ['I can’t go on', 'medium'], ['I can’t take this anymore', 'medium'],
];
const PRIOR = [ // niveles previos que no deben cambiar
  ['quiero morir', 'high'], ['ya no quiero vivir', 'high'], ['voy a suicidarme', 'high'], ['me quiero matar', 'high'], ['no quiero seguir viviendo', 'high'], ['I want to kill myself', 'high'], ['I want to die', 'high'], ['better off dead', 'high'], ['suicide', 'high'], ['quiero hacerme daño', 'medium'], ['me corto', null], ['quiero cortarme', 'medium'], ['I want to hurt myself', 'medium'], ['self-harm', 'medium'], ['no aguanto más', 'medium'], ['I cannot go on', null], ['hola, estoy bien', null], ['Quiero aprender a programar', null], ['I want to change careers', null],
];
const FP = [ // no deben activar
  'me quiero cortar el pelo', 'me quiero cortar las uñas', 'me voy a cortar el césped', 'me quiero cortar la barba', 'me pienso cortar un mechón', 'me quisiera cortar unas ramas', 'me quiero cortar con mi jefe en la reunión de presupuesto'.replace('con mi jefe en la reunión de presupuesto', 'el flequillo'),
  'no quiero lastimar a nadie', 'no quiero hacer daño a mi equipo', 'hice daño a mi equipo', 'el daño fue en el servidor', 'me preocupa hacer daño al sistema si lo reinicio'.replace('hacer daño al sistema si lo reinicio', 'el daño del servidor'), 'quiero cortar el cable', 'voy a cortar la tarta', 'me quiero cortar la mala racha',
  'I do not want to live in the city anymore', 'I don\'t want to live in Bogotá anymore', 'I do not want to live at home', 'I don’t want to live on the coast', 'I do not want to live near the airport', 'I want to live in Spain', 'I want to live a healthy life',
  'I do not want to harm anyone', 'I want to live abroad', 'we live to work', 'I do not want to wake up early', 'I do not wanna go to the meeting', 'I do not want to be late',
  'Quiero cambiar de profesión pero me da miedo', 'Estoy agotado del trabajo, necesito un descanso', 'Voy a presentar mi CV mañana', 'Mi jefe me hace daño en la reputación del equipo'.replace('Mi jefe me hace daño en la reputación del equipo', 'El ruido me hace daño en el oído'),
];
const lim = []; // falsos positivos conocidos o límites: se registran, no bloquean
const LIMITS = [
  ['no me quiero hacer daño', 'negación'], ['no me quiero lastimar', 'negación'], ['I do not want to live with my parents anymore', 'lugar no excluido (with)'], ['I do not want to live alone', 'lugar no excluido (alone)'], ["I don't want to live like this anymore", 'riesgo probable (alto)'],
  ['I do not want to live in this world anymore', 'posible riesgo excluido como lugar (in)'], ['I don\'t want to live on this planet anymore', 'posible riesgo excluido como lugar (on)'], ['me voy a cortar con el cuchillo', 'accidente'], ['me voy a cortar al afeitarme', 'accidente'],
  ['me quiero hacer daño pero no lo haré', 'riesgo con negación posterior'], ['me quiero tirar de un puente', 'no cubierto'], ['ojalá no despertar', 'no cubierto'], ['me quiero hacer da ño', 'espacio dentro de la palabra'], ['me qiero hacer daño', 'falta de ortografía'], ['i dont wanna be here anymore', 'no cubierto'], ['I don’t want to be here', 'sin «anymore»'], ['me quiero lastimarme', 'forma errónea'],
];
let bad = [];
for (const [t, e] of [...REPORTED, ...NEW]) { const n = lvl(N, t); if (n !== e) bad.push(`${t.slice(0, 40)}→${n}(esp ${e})`); }
check('ES92-A01 las 3 frases reportadas y sus variantes (mayúsculas, acentos, espacios, invisibles, apóstrofo tipográfico, «dont») se detectan con el nivel aprobado', REPORTED.every(([t, e]) => lvl(N, t) === e), REPORTED.filter(([t, e]) => lvl(N, t) !== e).map(([t, e]) => `${t.slice(0, 30)}→${lvl(N, t)}`).join(' | ') || `${REPORTED.length} frases`);
check('ES92-A02 las formas nuevas que declara el PR (quisiera/voy a/pienso/dan ganas de, cortar con venas/piel/brazos/muñecas, harm myself, wanna, be alive, be here anymore) se detectan', NEW.every(([t, e]) => lvl(N, t) === e), NEW.filter(([t, e]) => lvl(N, t) !== e).map(([t, e]) => `${t.slice(0, 30)}→${lvl(N, t)}`).join(' | ') || `${NEW.length} frases`);
check('ES92-A03 la línea base de main NO detectaba las 3 reportadas (el defecto existía)', ['me quiero hacer daño', 'me quiero lastimar', 'I do not want to live anymore'].every(t => lvl(O, t) === null), ['me quiero hacer daño', 'me quiero lastimar', 'I do not want to live anymore'].map(t => `${t}→${lvl(O, t)}`).join(' | '));
const priorBad = PRIOR.filter(([t, e]) => lvl(N, t) !== lvl(O, t)); check('ES92-B01 no regresión: los niveles previos no cambian (mismo nivel que en main para 19 frases de control)', priorBad.length === 0, priorBad.map(([t]) => `${t}: main=${lvl(O, t)} nuevo=${lvl(N, t)}`).join(' | ') || `${PRIOR.length} frases`);
check('ES92-B02 los niveles previos coinciden con lo esperado', PRIOR.every(([t, e]) => lvl(N, t) === e), PRIOR.filter(([t, e]) => lvl(N, t) !== e).map(([t, e]) => `${t}→${lvl(N, t)}(esp ${e})`).join(' | ') || 'ok');
const fpBad = FP.filter(t => lvl(N, t) !== null); check(`ES92-C01 falsos positivos que NO deben activar (${FP.length} frases de trabajo, cocina, lugares, intención sana)`, fpBad.length === 0, fpBad.map(t => `${t}→${lvl(N, t)}`).join(' | ') || `${FP.length} frases`);
const newFp = FP.filter(t => lvl(O, t) === null && lvl(N, t) !== null); check('ES92-C02 el PR no introduce falsos positivos nuevos sobre mi corpus sano', newFp.length === 0, newFp.join(' | '));
const fixedFp = FP.filter(t => lvl(O, t) !== null && lvl(N, t) === null); console.log(JSON.stringify({ info: 'falsos positivos de main que el PR corrige', frases: fixedFp }));
// Límites (informativos)
console.log(JSON.stringify({ info: 'límites y falsos positivos conocidos o nuevos (frase, motivo, main→nuevo)', filas: LIMITS.map(([t, m]) => `${t} | ${m} | ${lvl(O, t)}→${lvl(N, t)}`) }));
// Robustez
const big = (s, n) => (s + ' ').repeat(Math.ceil(n / (s.length + 1))).slice(0, n);
const stress = { 'espacios 20000': ' '.repeat(20000), 'repetido «me quiero cortar» 20000': big('me quiero cortar', 20000), 'repetido «I do not want to live» 20000': big('I do not want to live', 20000), 'a×20000': 'a'.repeat(20000), 'me quiero ×5000 sin cierre': 'me quiero '.repeat(5000), 'live ×': 'I don\'t want to live in '.repeat(1000), 'emoji 20000': '😀'.repeat(5000), 'acentos NFD 20000': 'é'.normalize('NFD').repeat(10000), 'mezcla': big('quiero cambiar de profesión i do not want to live ', 20000), 'invisibles 20000': '​'.repeat(20000), 'apóstrofos 20000': '’'.repeat(20000) };
let worst = 0, worstN = '', err = [];
for (const [n, t] of Object.entries(stress)) { const t0 = performance.now(); try { N(t); } catch (e) { err.push(n + ':' + e.message); } const ms = performance.now() - t0; if (ms > worst) { worst = ms; worstN = n; } }
check('ES92-D01 entradas extremas de 20 000 caracteres: sin errores y en menos de 50 ms cada una (umbral propuesto)', err.length === 0 && worst < 50, `peor=${worst.toFixed(1)} ms («${worstN}») ${err.join(' | ')}`);
const w4k = big('me quiero cortar el pelo y no quiero lastimar a nadie pero ', 4000); const T = []; for (let i = 0; i < 200; i++) { const t0 = performance.now(); N(w4k); T.push(performance.now() - t0); } T.sort((a, b) => a - b);
check('ES92-D02 mensaje de 4 000 caracteres: p95 < 5 ms y p99 < 50 ms (propuesta)', T[Math.floor(T.length * .95)] < 5 && T[Math.floor(T.length * .99)] < 50, `p50=${T[100].toFixed(2)} p95=${T[Math.floor(T.length * .95)].toFixed(2)} p99=${T[Math.floor(T.length * .99)].toFixed(2)} ms`);
const odd = [undefined, null, 0, 123, true, {}, [], ['me quiero hacer daño'], '', '   ', '\n\t']; const oddErr = []; for (const v of odd) { try { N(v); } catch (e) { oddErr.push(`${JSON.stringify(v)}:${e.message.slice(0, 30)}`); } }
check('ES92-D03 entradas que no son texto o vacías: sin excepciones (o idénticas a main)', oddErr.length === 0 || (() => { const o = []; for (const v of odd) { try { O(v); } catch (e) { o.push(`${JSON.stringify(v)}:${e.message.slice(0, 30)}`); } } return JSON.stringify(o) === JSON.stringify(oddErr); })(), oddErr.join(' | ') || 'sin excepciones');
const rd = []; for (let i = 0; i < 4; i++) { const t0 = performance.now(); for (let k = 0; k < 2000; k++) N('me quiero hacer daño ' + k); rd.push(performance.now() - t0); }
check('ES92-D04 determinista: 8 000 llamadas, mismo resultado y sin crecimiento de tiempo (regex global sin estado)', ['me quiero hacer daño', 'I do not want to live anymore'].every(t => { const a = lvl(N, t); for (let i = 0; i < 50; i++) if (lvl(N, t) !== a) return false; return a !== null; }) && rd[3] < rd[0] * 3 + 50, rd.map(x => x.toFixed(0)).join('/') + ' ms');
console.log(JSON.stringify({ fin: true }));
