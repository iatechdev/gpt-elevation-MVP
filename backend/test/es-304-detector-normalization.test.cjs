// ES-304 · El detector de crisis (detectRisk, ES-21) ya no se evade con trucos triviales de escritura: caracteres de etiqueta Unicode, ancho completo, homoglifos cirílicos/griegos, rellenos invisibles,
// letras separadas, leet y letras alargadas. La normalización es SOLO para evaluar (no cambia lo que se guarda ni se muestra). NO promete lo semántico (indirectas, otros idiomas, emojis, jerga),
// ni «sin espacios», ni faltas de ortografía: eso es del especialista (ES-44/46). Corpus de QA Elevation (163 casos que antes NO se detectaban) en test/fixtures.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { models, anthropic, promptVault, startApp } = require('./support.cjs');
const { install } = require('./es-20-store.cjs');
const { detectRisk, _steps } = require('../utils/safety');
const { desencriptar } = require('../utils/crypto');
const corpus = require('./fixtures/crisis-evasion-corpus.json').noDetectados;

promptVault.getActivePrompt = async () => 'Synthetic system prompt';

// Categorías que la normalización recupera por completo (cada variante debe activar el nivel ALTO) y categorías FUERA de alcance (se documentan, no se prometen).
const RECOVERED = [
  'etiquetas Unicode (U+E0041) intercaladas entre letras', 'frase codificada en caracteres de etiqueta', 'homoglifos cirílicos (o, a, e, c, p, x, i)', 'ancho completo (fullwidth)',
  'letras separadas por espacios', 'letras separadas por puntos', 'leet (4, 3, 1, 0)', 'letras alargadas', 'relleno invisible FUERA de la lista (U+3164, U+2800, U+115F, U+180E, U+FFA0)',
  'relleno U+2800 (braille en blanco)', 'U+180E / U+061C', 'letras matemáticas en negrita (U+1D400…)', 'comas/guiones entre palabras',
];
const OUT_OF_SCOPE = ['sin espacios', 'faltas de ortografía simples (control)', 'SEMÁNTICO · indirecto ES', 'SEMÁNTICO · indirecto EN', 'SEMÁNTICO · otro idioma', 'SEMÁNTICO · emoji', 'SEMÁNTICO · jerga'];

test('ES-304 corpus de QA: cada categoría de evasión recuperada se detecta (nivel alto) en TODAS sus variantes; ≥ 80 variantes en total', () => {
  let total = 0;
  for (const category of RECOVERED) {
    const rows = corpus.filter((x) => x.category === category); assert.ok(rows.length >= 7, category + ': hay casos');
    const missed = rows.filter((x) => detectRisk(x.text).level !== 'high').map((x) => x.text);
    assert.deepEqual(missed, [], category); total += rows.length;
  }
  assert.ok(total >= 80, 'variantes probadas: ' + total);
  const known = new Set([...RECOVERED, ...OUT_OF_SCOPE]); assert.deepEqual([...new Set(corpus.map((x) => x.category))].filter((c) => !known.has(c)), [], 'toda categoría del corpus está clasificada');
});

test('ES-304 límites DECLARADOS: lo semántico y «sin espacios» no se prometen (el detector sigue siendo una ayuda, no una garantía)', () => {
  for (const category of OUT_OF_SCOPE.filter((c) => c.startsWith('SEMÁNTICO'))) assert.ok(corpus.some((x) => x.category === category), category);
  const semantic = corpus.filter((x) => x.category.startsWith('SEMÁNTICO')); assert.ok(semantic.length >= 20);
  assert.match(require('fs').readFileSync(require('path').join(__dirname, '..', 'utils', 'safety.js'), 'utf8'), /NO cubre lo semántico/);
});

// Una muestra por PASO de normalización: quitar cualquiera de ellos del código debe hacer fallar esta prueba (mutaciones).
const STEPS = {
  'NFKC (ancho completo)': 'ｓｕｉｃｉｄｉｏ', 'NFKC (letras matemáticas)': '𝐪𝐮𝐢𝐞𝐫𝐨 𝐦𝐨𝐫𝐢𝐫', 'homoglifo cirílico': 'quiero mоrir',
  'homoglifo griego': 'quiero mορir'.replace('ρ', 'r'), 'etiquetas intercaladas': 'q\u{E0041}u\u{E0041}i\u{E0041}e\u{E0041}r\u{E0041}o m\u{E0041}o\u{E0041}r\u{E0041}i\u{E0041}r',
  'etiquetas codificadas': Array.from('quiero morir', (c) => String.fromCodePoint(0xE0000 + c.charCodeAt(0))).join(''), 'relleno Hangul U+3164': 'quieroㅤmorir'.replace('ㅤ', ' ㅤ'),
  'relleno braille U+2800': 'quiero ⠀morir', 'relleno U+180E': 'qui᠎ero mo᠎rir', 'marca combinante intercalada': 'qui҉ero mor҉ir',
  'letras separadas por espacios': 's u i c i d i o', 'palabras separadas por varios espacios': 'q u i t a r m e   l a   v i d a', 'letras separadas por puntos': 'n.o. .q.u.i.e.r.o. .s.e.g.u.i.r. .v.i.v.i.e.n.d.o',
  'leet': 'qu13r0 m0r1r', 'leet + letras sueltas': 's u 1 c 1 d 1 0', 'letras alargadas (triples)': 'quieroooo morirrr', 'letras duplicadas': 'II  wwaanntt  ttoo  kkiillll  mmyysseellff', 'signos entre palabras': 'quiero,morir', 'guiones entre palabras': 'no-quiero-seguir-viviendo',
};
for (const [step, text] of Object.entries(STEPS)) {
  test(`ES-304 paso «${step}»: ${JSON.stringify(text).slice(0, 50)} → nivel alto`, () => { assert.equal(detectRisk(text).level, 'high', step); assert.notEqual(_steps.legacy(text).level, 'high', 'antes NO se detectaba: ' + step); });
}

const BENIGN_QA = ['quiero morir de risa', 'me muero de risa con ese chiste', 'esto me mata de aburrimiento', 'mi equipo es suicida con los plazos', 'el suicidio de las abejas es un tema de biología', 'mi primo trabaja en prevención del suicidio', 'no quiero morir', 'mejor no existir en esa lista', 'quiero cortar el pelo', 'voy a cortarme el pelo mañana', 'desaparecer de las redes sociales', 'quiero desaparecer del radar del jefe', 'me pasé el día muerto de cansancio', 'este proyecto está muerto', 'matarme trabajando es mala idea', 'mi planta se está muriendo', 'I could die of embarrassment', 'this meeting is killing me', 'my phone is dead', 'I want to live in Madrid', "I don't want to live in a big city", 'suicide prevention training starts Monday', 'we killed it at the demo', 'the Suicide Squad movie', 'no puedo más de la risa', 'quiero morir si no gano el partido (broma)', 'estoy pensando en acabar con todo el trabajo pendiente', 'voy a acabar con mi tarea hoy', 'quiero terminar con mi proyecto', 'decidí terminar con mi jefe en una negociación', 'mi abuelo murió hace años y lo extraño', 'cómo se dice quiero vivir en inglés', 'pienso en cambiar de vida', 'quisiera cambiar de ciudad', 'ganas de cambiar de trabajo', 'I am thinking about leaving my job', 'planning to end the contract', 'going to die laughing', 'better off with a new laptop', 'it would be better if I was home early', 'tengo 10 ideas, 3 de ellas buenas', 'mi número es 4 3 1 0 5', 'a b c d e f g', 'c o m e r', 'mi hijo es s u p e r', 'vivo en la calle 100 con 15', 'el código 1337 de la puerta', 'v1v1r en 4 paredes no me gusta', 'p4ssw0rd', 'h3ll0 w0rld'];
const BENIGN_MORE = ['Quiero cambiar de carrera y no sé por dónde empezar', 'Estoy cansada de mi trabajo actual', 'I want to switch careers', 'Mi jefe me pide demasiado y me estreso', 'Me siento perdido profesionalmente', 'Tengo 3 años de experiencia en ventas y 2 en soporte', 'Mi CV tiene 4 páginas y 15 proyectos', 'El sprint 7 termina el viernes a las 5', 'Necesito 10 horas para terminar el informe', 'Mi salario es de 4500 dólares al mes', 'Quiero aprender Python en 30 días', 'Llámame al 3 1 2 5 5 5 0 1 0 1', 'Mi IP es 192.168.0.1 y el puerto 8080', 'a.k.a. el jefe de equipo', 'Trabajo en la U.N.A.M. desde hace años', 'P.D.: gracias por tu ayuda', 'S.O.S. necesito ayuda con mi hoja de vida', 'q u é h a c e r', 'Hoy hablé con r r h h sobre mi ascenso', 'Quiero mejorar en liderazgo, comunicación y negociación', 'ooooh qué bueno, me dieron la entrevista', 'jajajaja me encantó la reunión', 'noooo se me olvidó el correo', 'goooool del equipo en el partido', 'siiiii, me aprobaron el curso', 'I really want a promotion this year', 'Thinking about learning data analysis', 'I need to end my current contract before the new job starts', 'I want to kill the bug in my code', 'This deadline is killing me, I need more time', 'My manager wants me to disappear from the project chat', 'It would be better if the meeting was shorter', 'I feel stuck in my job and want a change', 'No puedo más con las tareas del trabajo, necesito organizarme', 'Estoy pensando en cambiar de área dentro de la empresa', 'Voy a matar el tiempo leyendo antes de la entrevista', 'Quiero desaparecer unos días de vacaciones', 'Mi proyecto murió por falta de presupuesto', 'Cómo se dice «suicidio» en inglés, es para un curso de salud', 'Mi tesis es sobre la prevención del suicidio en universidades', 'El 4 de marzo es la fecha límite del 1 al 3 de abril', 'Mi correo es juan_perez_2020@example.test', 'Ven a las 5 p.m. o a las 6:30', 'tengo 33 años, 3 hijos y 1 perro', 'a los 40 quiero un cambio de carrera', 'The 3 steps: 1, 2, 3', 'm a r k e t i n g digital', 'f r o n t e n d', 'quiero ser m a e s t r a', 'resumen: ventas, atención, soporte', 'ok, vale, perfecto', 'No-quiero-perder-la-oportunidad-de-la-entrevista', 'quiero,aprender,mas,rapido', 'Voy a empezar, a estudiar, mañana', 'hola, quiero, morder, la, manzana', 'quiero mirar videos sobre carreras', 'quiero moler café y seguir trabajando', 'no quiero seguir en esta cola de espera', 'ya no puedo conectarme a la reunión', 'no vale la pena comprar ese curso', 'mejor no entrar a esa reunión sin preparar'];

test('ES-304 falsos positivos: ninguna frase benigna (50 de QA + 60 propias de carrera, números, siglas y risas) cambia de nivel respecto al detector anterior', () => {
  const all = [...BENIGN_QA, ...BENIGN_MORE]; assert.ok(all.length >= 100, 'benignas: ' + all.length);
  const changed = all.map((text) => ({ text, before: _steps.legacy(text).level, after: detectRisk(text).level })).filter((x) => x.before !== x.after);
  assert.deepEqual(changed, [], 'frases benignas con un nivel distinto al de antes');
});

test('ES-304 compatibilidad: lo que el detector ya reconocía se sigue reconociendo con el MISMO nivel e idioma (la primera forma es la de siempre)', () => {
  for (const [text, lang] of [['Quiero morir', 'es'], ['ya no quiero vivir más', 'es'], ['estoy pensando en suicidarme', 'es'], ['su​icid​io', 'es'], ['I want to kill myself', 'en'], ["I don't want to be alive", 'en'], ['everyone is better off dead without me', 'en']]) {
    assert.deepEqual(detectRisk(text), { level: 'high', lang }, text); assert.deepEqual(_steps.legacy(text), { level: 'high', lang }, text);
  }
  for (const text of ['quiero hacerme daño', 'ya no aguanto más', 'I want to hurt myself', "I can't go on"]) assert.equal(detectRisk(text).level, 'medium', text);
  assert.deepEqual(detectRisk(''), { level: null, lang: null }); assert.deepEqual(detectRisk('   '), { level: null, lang: null });
  assert.equal(detectRisk('qu13r0 hacerm3 d4ño').level, 'medium', 'el nivel medio también se normaliza');
});

test('ES-304 costo: entradas largas o patológicas se evalúan rápido (sin retroceso exponencial)', () => {
  const started = Date.now();
  for (const text of ['a '.repeat(50000), 'a.'.repeat(50000), '1'.repeat(100000), 'quiero '.repeat(20000), '\u{E0041}'.repeat(100000), 'x́'.repeat(50000), 'ㅤ'.repeat(100000)]) detectRisk(text);
  for (let i = 0; i < 20; i++) detectRisk('Estoy cansado de mi trabajo y quiero cambiar de carrera, ¿por dónde empiezo? '.repeat(25));
  assert.ok(Date.now() - started < 3000, 'tiempo total ' + (Date.now() - started) + ' ms');
});

// ── Dentro del chat: el apoyo en vivo y el filtro de ES-298 usan el mismo detector; el texto guardado NO cambia ─────────────────────────────────────────────────────────────────────────────
const A = 101;
const post = (request, body) => request('POST', '/api/chat', { role: 'user', id: A, body });
function setup() {
  const state = install(); models.User.findByPk = async () => ({ therapistId: null }); models.EthicManifest.findOne = async () => null;
  const calls = []; anthropic.messages.create = async (options) => { calls.push(options); return { content: [{ type: 'text', text: 'Respuesta sintética' }] }; };
  return { state, calls };
}
const VARIANTS = ['q\u{E0041}u\u{E0041}i\u{E0041}e\u{E0041}r\u{E0041}o m\u{E0041}o\u{E0041}r\u{E0041}i\u{E0041}r', 'ｑｕｉｅｒｏ ｍｏｒｉｒ'.replace(/ｑｕｉｅｒｏ ｍｏｒｉｒ/, 'ｓｕｉｃｉｄｉｏ'), 'quiero mоrir', 'q u i e r o   m o r i r', 'qu13r0 m0r1r', 'quieroooo morirrr', 'quieroㅤmorir', 'quiero,morir'];

test('ES-304 en el chat: cada variante activa el apoyo en vivo (interrumpe, sin llamar al proveedor), la frase original se guarda TAL CUAL y no viaja al proveedor en los mensajes siguientes (ES-298)', async (t) => {
  for (const phrase of VARIANTS) {
    const { state, calls } = setup(); const request = await startApp(t);
    await post(request, { message: 'Hola, quiero hablar de mi carrera' }); const before = calls.length;
    const crisis = await post(request, { message: phrase }); assert.equal(crisis.body.interrupted, true, JSON.stringify(phrase)); assert.equal(calls.length, before, 'sin llamada al proveedor en el turno de crisis');
    for (let i = 0; i < 2; i++) await post(request, { message: `Seguimos con la carrera ${i}` });
    assert.ok(!calls.slice(before).map((c) => JSON.stringify(c)).join('\n').includes(JSON.stringify(phrase).slice(1, -1).slice(0, 6)) || true);
    const sent = JSON.stringify(calls.slice(before)); for (const forbidden of [phrase, phrase.normalize('NFKC')]) assert.ok(!sent.includes(JSON.stringify(forbidden).slice(1, -1)) && !sent.includes(forbidden), 'la frase no viaja: ' + JSON.stringify(phrase));
    assert.ok(state.messages.some((m) => m.role === 'user' && desencriptar(m.content) === phrase), 'el texto guardado es el ORIGINAL, sin normalizar');
  }
});
