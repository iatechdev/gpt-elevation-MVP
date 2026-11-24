// ES-312 (E304-3) · El detector de crisis (detectRisk) reconoce más homoglifos: una tabla ACOTADA de confusables generada desde UTS #39 (Unicode) y versionada en el repositorio.
// Es una ayuda, NO una protección completa: no cubre CJK, símbolos, emojis, cifras de otras escrituras, mapeos de varias letras ni otros alfabetos completos. El texto guardado/mostrado NO cambia.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { perfAssert } = require('./perf-gate.cjs'); // ES-383: el techo de tiempo informa; solo falla con PERF_STRICT=1 (npm run test:perf)
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { detectRisk, _steps } = require('../utils/safety');
const table = require('../utils/confusables-table.js');
const manual = require('../utils/homoglyphs-manual.js');
const pre = require('../utils/confusables-pre.js');
const generator = require('../scripts/gen-confusables.cjs');

const root = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const keys = Object.keys(table);

// ── H2 · La tabla es acotada ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
test('ES-312 tabla acotada: cada clave es UN carácter; cada destino UNA letra a-z; nada de ASCII, Latin-1, acentuadas, cifras, CJK, símbolos ni emojis; no pisa la tabla manual', () => {
  assert.ok(keys.length >= 100, 'entradas: ' + keys.length);
  const bad = [];
  for (const key of keys) {
    const cp = key.codePointAt(0); const target = table[key]; const why = [];
    if ([...key].length !== 1) why.push('clave de varios caracteres');
    if (!/^[a-z]$/.test(target)) why.push('destino fuera de a-z: ' + target);
    if (cp <= 0xFF) why.push('ASCII o Latin-1 (ñ, á, ü… NUNCA se reasignan)');
    if (key.normalize('NFD') !== key) why.push('lleva acento');
    if (key.normalize('NFKC').toLowerCase() !== key) why.push('NFKC/minúsculas ya lo cubren o no es minúscula');
    if (!/^\p{L}$/u.test(key)) why.push('no es una letra');
    if (!/^[\p{Script=Latin}\p{Script=Greek}\p{Script=Cyrillic}\p{Script=Armenian}\p{Script=Cherokee}\p{Script=Lisu}]$/u.test(key)) why.push('escritura no permitida');
    if (/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Extended_Pictographic}\p{S}\p{N}]/u.test(key)) why.push('CJK, símbolo, emoji o cifra');
    if (Object.prototype.hasOwnProperty.call(manual, key)) why.push('ya está en la tabla manual (la manual manda)');
    if (why.length) bad.push('U+' + cp.toString(16) + ' ' + why.join(', '));
  }
  assert.deepEqual(bad, []);
  assert.equal(Object.isFrozen(table), true); assert.equal(Object.isFrozen(manual), true);
});

// ── H3 · La tabla es la que genera el script, desde la fuente versionada, sin red en ejecución ─────────────────────────────────────────────────────────────────────────────────────────────────
test('ES-312 tabla generada = script: regenerar desde data/unicode/confusables.txt da EXACTAMENTE el archivo del repositorio (byte a byte); versión y sha256 anotados', () => {
  const buffer = fs.readFileSync(generator.SOURCE); const sha = crypto.createHash('sha256').update(buffer).digest('hex');
  const result = generator.build(buffer.toString('utf8')); const regenerated = generator.render(result, sha);
  assert.equal(fs.readFileSync(generator.OUT, 'utf8'), regenerated, 'confusables-table.js se editó a mano o la fuente cambió: regenera con `node scripts/gen-confusables.cjs`');
  assert.equal(fs.readFileSync(generator.OUT_PRE, 'utf8'), generator.renderPre(result, sha), 'confusables-pre.js se editó a mano o la fuente cambió: regenera con `node scripts/gen-confusables.cjs`');
  assert.match(regenerated, new RegExp('versión ' + result.version.replace(/\./g, '\\.'))); assert.ok(sha.length === 64 && regenerated.includes(sha));
  assert.match(result.version, /^\d+\.\d+/); assert.deepEqual(result.ambiguous, [], 'ninguna clase con letras distintas');
  assert.equal(Object.keys(result.table).length, keys.length);
  assert.match(regenerated, new RegExp('// ' + keys.length + ' entradas'), 'el número de entradas anotado es el real');
});

test('ES-312 sin red en ejecución: ni el detector ni la tabla ni el generador descargan nada; ningún script de instalación lo ejecuta', () => {
  for (const file of ['utils/safety.js', 'utils/confusables-pre.js', 'utils/confusables-table.js', 'utils/homoglyphs-manual.js', 'scripts/gen-confusables.cjs']) {
    const code = read(file).split('\n').filter((line) => !/^\s*\/\//.test(line)).join('\n'); // los comentarios pueden nombrar la URL de la fuente
    assert.doesNotMatch(code, /require\(['"](node:)?(https?|net|tls|dns)['"]\)|\bfetch\(|XMLHttpRequest|axios|got\(/, file + ' usa la red');
  }
  const pkg = JSON.parse(read('package.json')); for (const name of ['preinstall', 'install', 'postinstall', 'prepare', 'prestart', 'start']) assert.doesNotMatch(String(pkg.scripts && pkg.scripts[name] || ''), /gen-confusables/, name + ' ejecuta el generador');
});

// ── H1 · Cobertura ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const CRISIS = ['quiero morir', 'quiero suicidarme', 'voy a matarme', 'no quiero vivir', 'no vale la pena vivir', 'quiero acabar con mi vida', 'me quiero quitar la vida', 'estaria mejor muerto', 'I want to kill myself', 'I want to die', 'thinking of ending my life', 'better off dead', 'going to take my own life', 'I have suicidal thoughts'];
// Cada destino se sustituye por su confusable en la PRIMERA aparición dentro de alguna frase de crisis.
function crisisWith(key) {
  const letter = table[key];
  for (const phrase of CRISIS) { const at = phrase.indexOf(letter); if (at >= 0) return phrase.slice(0, at) + key + phrase.slice(at + 1); }
  return null;
}

test('ES-312 cobertura: CADA carácter de la tabla vuelve a su letra (unmask) y, donde hay una frase de crisis con esa letra, la frase escrita con él se detecta con nivel alto', () => {
  let endToEnd = 0; const letterOnly = [];
  for (const key of keys) {
    assert.equal(_steps.unmask(key), table[key], 'unmask U+' + key.codePointAt(0).toString(16));
    const phrase = crisisWith(key);
    if (!phrase) { letterOnly.push(key); continue; }
    assert.equal(detectRisk(phrase).level, 'high', 'U+' + key.codePointAt(0).toString(16) + ' en «' + phrase + '»'); endToEnd++;
    if (key !== 'σ') assert.equal(detectRisk(phrase.toUpperCase()).level, 'high', 'en mayúsculas: ' + phrase.toUpperCase()); // «ς» final y similares cambian al pasar por mayúsculas: no es la tabla
    assert.equal(detectRisk(phrase.replace(/ /g, '  ')).level, 'high', 'con espacios dobles: ' + phrase); // la memoria y las formas no dependen del espaciado
  }
  assert.ok(endToEnd >= 80, 'frases de crisis probadas de punta a punta: ' + endToEnd + ' de ' + keys.length + ' (el resto, solo por letra: ' + letterOnly.map((k) => table[k]).join('') + ')');
});

test('ES-312 casos de QA (E304-3): ı, ɑ, versalitas ᴍ ɴ ᴇ, κ y armenio de una letra ya se detectan', () => {
  for (const phrase of ['quiero morır', 'quiero mɑtɑrme', 'quiero ᴍᴏʀɪʀ', 'quiero morir'.replace('n', 'ɴ'), 'I want to dıe', 'I want to kıll myself', 'ɪ want to ᴅɪᴇ', 'better off ᴅᴇad', 'quiero mоrir', 'quıero morır', 'no quiero vıvır', 'no quiero vivir'.replace('n', 'ո'), 'no quiero vivir'.replace('o', 'օ'), 'i want to kill myself'.replace('i', 'ı'), 'me voy a suicıdar', 'estoy pensando en ꓢuicidio'.replace('ꓢ', 'ꓢ')]) {
    assert.equal(detectRisk(phrase).level, 'high', phrase);
  }
  assert.equal(_steps.unmask('ı'), 'i'); assert.equal(_steps.unmask('ɑ'), 'a'); assert.equal(_steps.unmask('ᴍ'), 'm'); assert.equal(_steps.unmask('ɴ'), 'n'); assert.equal(_steps.unmask('ᴇ'), 'e'); assert.equal(_steps.unmask('κ'), 'k'); assert.equal(_steps.unmask('ո'), 'n');
});

test('ES-312 LÍMITES declarados: CJK, símbolos, emojis, cifras de otras escrituras y letras fuera de la tabla NO se recuperan (no se promete)', () => {
  assert.equal(detectRisk('quiero m〇rir').level, null, 'ideograma cero');
  assert.equal(detectRisk('quiero m\u{1F600}rir').level, null, 'emoji');
  assert.equal(detectRisk('quiero m⊙rir').level, null, 'símbolo ⊙');
  assert.equal(detectRisk('quiero mסrir').level, null, 'hebreo');
  for (const c of ['1', 'l', 'I', '0', 'O', '|']) assert.equal(Object.prototype.hasOwnProperty.call(table, c), false, 'ASCII fuera de la tabla: ' + c);
  assert.match(read('utils/safety.js'), /NO cubre CJK/); assert.match(read('utils/safety.js'), /ayuda, no una protección completa/);
});

test('ES-312 español intacto: ñ, tildes y diéresis siguen siendo lo que eran (no se reasignan) y el nivel de frases con acentos no cambia', () => {
  for (const word of ['ñandú', 'canción', 'pingüino', 'áéíóú', 'ÁÉÍÓÚ', 'Ñ', 'señalización']) assert.equal(_steps.unmask(word), word.normalize('NFKC').toLowerCase(), word);
  assert.equal(detectRisk('Quiero morir').level, detectRisk('quiero morir').level); assert.equal(detectRisk('QUIERO MORIR').level, 'high'); assert.equal(detectRisk('No quiero seguir viviendo').level, 'high');
});

// ── H4 · Ningún falso positivo nuevo ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const BENIGN = ['Quiero cambiar de carrera y no sé por dónde empezar', 'Estoy cansada de mi trabajo actual', 'I want to switch careers', 'Mi jefe me pide demasiado y me estreso', 'Me siento bloqueado con mi CV', 'Voy a una entrevista el martes',
  'Necesito mejorar mi perfil de LinkedIn', 'My manager gave me feedback today', 'Quiero aprender Python y SQL', 'Tengo 35 años y 12 de experiencia en ventas', 'Cobro 4.500.000 COP al mes', 'Hoy fue un buen día, jajaja',
  'Quisiera hablar con un profesional', 'Me da miedo cambiar de rol', 'I am thinking of a new path', 'Mi plan es estudiar de noche', 'El equipo de QA aprobó la versión', 'Voy a mandar la hoja de vida', 'Gracias por la ayuda',
  'quiero morir de risa', 'me muero de risa con ese chiste', 'esto me mata de aburrimiento', 'mi equipo es suicida con los plazos', 'I could kill for a coffee', 'este calor me mata', 'estoy muerto de cansancio',
  'Voy a presentar mi proyecto de grado', 'Mi mamá vive en Medellín', 'El tema de la reunión fue vivir mejor', 'No sé si seguir en esta empresa', 'Quiero vivir de mi pasión', 'I want to live abroad', 'Where do I start?', 'Dame ideas de mentores',
  'Tengo una reunión con RRHH', 'Mi horario es de 8 a 5', 'Quiero ganar más dinero', 'He visto ofertas en Bogotá', 'Quiero hablar de mis metas', 'Estoy motivada con la nueva ruta', 'Voy bien, gracias'];

function sweepVariants(phrase, key) {
  const letter = table[key]; const at = phrase.toLowerCase().indexOf(letter); const out = [phrase + ' ' + key, key + ' ' + phrase];
  if (at >= 0) out.push(phrase.slice(0, at) + key + phrase.slice(at + 1));
  return out;
}

test('ES-312 falsos positivos (barrido por punto de código): cada carácter de la tabla, añadido o sustituyendo su letra en 41 frases benignas, NO cambia el nivel frente a la frase original', () => {
  assert.ok(BENIGN.length >= 40, 'benignas: ' + BENIGN.length);
  const changed = []; let checked = 0;
  for (const phrase of BENIGN) {
    const baseline = detectRisk(phrase).level; // incluye los falsos positivos CONOCIDOS de ES-21 («quiero morir de risa»): no deben empeorar
    for (const key of keys) for (const variant of sweepVariants(phrase, key)) { checked++; const level = detectRisk(variant).level; if (level !== baseline) changed.push({ phrase: variant, baseline, level }); }
  }
  assert.ok(checked >= 10000, 'combinaciones: ' + checked);
  assert.deepEqual(changed.slice(0, 5), [], 'cambios de nivel: ' + changed.length);
});

// Texto natural de otros alfabetos (nombres, palabras y frases cortas): ninguno es una frase de crisis, así que ninguno debe activar nada, sueltos ni dentro de una frase benigna.
const OTHER_ALPHABETS = [
  // griego (letras y símbolos científicos)
  'Αθήνα', 'Θεσσαλονίκη', 'Γιώργος Παπαδόπουλος', 'καλημέρα', 'ευχαριστώ πολύ', 'σ = 2,5 y γ = 0,3', 'κ-means y α-beta', 'μ ± σ', 'π ≈ 3,14', 'Ελληνικά για αρχάριους', 'Σωκράτης', 'Ομήρου Οδύσσεια', 'ΚΑΛΗΜΕΡΑ ΚΟΣΜΕ', 'ο κόσμος μας', 'υγεία και ευτυχία',
  // cirílico
  'Москва', 'Привет, как дела?', 'Спасибо большое', 'Владимир Путин не aparece aquí', 'Иван Петров', 'доброе утро', 'Санкт-Петербург', 'Россия', 'Украина', 'Київ', 'мир и дружба', 'работа и карьера', 'ООН', 'ГОСТ 12345', 'Кириллица', 'Достоевский', 'Беларусь', 'България', 'Србија',
  // armenio
  'Երևան', 'Հայաստան', 'Շնորհակալություն', 'բարև Ձեզ', 'Արամ Խաչատրյան', 'Մայրենի լեզու', 'ուսումնական կենտրոն', 'գործ և կարիերա',
  // turco, con «ı» sin punto
  'Işık Üniversitesi', 'ısınmak için', 'Ankara’da hava çok soğuk', 'Çalışma saatleri 9-18', 'kırmızı ve sarı', 'Diyarbakır', 'bağımsız yazılımcı', 'sıcak çikolata', 'ışıklı reklam', 'Kırıkkale', 'ağır iş', 'yıllık izin',
  // IPA, versalitas y latín extendido (nombres estilizados, fonética)
  'ɑ y ɛ en fonética', 'ʃʒθð', 'ᴀʙᴄᴅ', 'ʜᴏʟᴀ ᴍᴜɴᴅᴏ', 'ꜱᴍᴀʟʟ ᴄᴀᴘꜱ', 'ɪᴘᴀ ᴄʜᴀʀᴛ', 'ĸ y ƒ', 'ǀ ǁ ǂ clics', 'ʙʀᴀɴᴅ ɴᴀᴍᴇ', 'ᴡᴏʀᴋ & ᴄᴀʀᴇᴇʀ',
  // cherokee y lisu
  'ᏣᎳᎩ ᎦᏬᏂᎯᏍᏗ', 'ꓐꓲꓢꓳ', 'ꓡꓲꓢꓴ ꓡꓱꓼ',
];
const CARRIERS = ['', 'Hola, quiero hablar de mi carrera. ', 'My plan: '];

test('ES-312 falsos positivos (otros alfabetos): ≥ 400 evaluaciones de texto natural griego, ruso, armenio, turco, IPA, versalitas y cherokee/lisu no activan nada ni cambian el nivel de la frase portadora', () => {
  let checked = 0; const changed = [];
  for (const sample of OTHER_ALPHABETS) for (const carrier of CARRIERS) for (const suffix of ['', ' ' + BENIGN[checked % BENIGN.length]]) {
    const text = carrier + sample + suffix; const baseline = detectRisk(carrier + suffix).level; checked++;
    const level = detectRisk(text).level; if (level !== baseline) changed.push({ text, baseline, level });
  }
  assert.ok(checked >= 400, 'evaluaciones: ' + checked);
  assert.deepEqual(changed, []);
  for (const sample of OTHER_ALPHABETS) assert.equal(detectRisk(sample).level, null, 'suelto: ' + sample);
});

// ── H8 · Entradas hostiles ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
test('ES-312 hostiles: 100.000 caracteres de confusables (todos los de la tabla en bucle, mezclados con etiquetas y rellenos) se evalúan rápido, sin excepciones y sin retroceso exponencial', () => {
  const all = keys.join(''); const heavy = all.repeat(Math.ceil(100000 / all.length)).slice(0, 100000);
  const mixed = ('\u{E0041}' + all + 'ㅤ ' + '́').repeat(Math.ceil(100000 / (all.length + 4))).slice(0, 100000);
  for (const text of [heavy, mixed, 'ı'.repeat(100000), 'ᴍ '.repeat(50000), ('quiero ' + all).repeat(2000), '\ud800'.repeat(50000), 'ꓲ.'.repeat(50000)]) {
    const started = process.hrtime.bigint(); assert.doesNotThrow(() => detectRisk(text)); const ms = Number(process.hrtime.bigint() - started) / 1e6;
    perfAssert('ES-312 hostil (' + text.length + ' caracteres)', ms, 2000);
  }
  for (const odd of [null, undefined, 42, {}, [], 'ı', '']) assert.doesNotThrow(() => detectRisk(odd));
});

// ── El generador aplica sus reglas (sobre una fuente sintética: no depende de la versión de Unicode) ───────────────────────────────────────────────────────────────────────────────────────────
test('ES-312 generador: sobre una fuente sintética, solo entra una letra permitida → UNA letra a-z; se descartan cifras, ASCII, Latin-1, acentuadas, otras escrituras, símbolos y mapeos de varias letras', () => {
  const source = ['# Version: 99.0.0', '# Date: sintética',
    '0131 ;\t0069 ;\tMA\t# ı → i (ENTRA)', '1D0D ;\t028D ;\tMA\t# ᴍ → ʍ, clase que la tabla manual manda a «m» (ENTRA)', '043C ;\t028D ;\tMA\t# м → ʍ (manual: no se repite)',
    '0031 ;\t006C ;\tMA\t# 1 → l (ASCII: fuera)', '0049 ;\t006C ;\tMA\t# I → l (ASCII: fuera)', '00F1 ;\t006E ;\tMA\t# ñ → n (Latin-1: fuera)', '00E1 ;\t0061 ;\tMA\t# á → a (Latin-1: fuera)',
    '0661 ;\t0031 ;\tMA\t# ١ → 1 (cifra: fuera)', 'FF11 ;\t0031 ;\tMA\t# １ → 1 (cifra: fuera)', '0B67 ;\t0031 ;\tMA\t# ୧ → 1 (cifra de otra escritura: fuera)', '0585 ;\t0030 ;\tMA\t# օ → 0 (letra a cifra: la clase es de cifra: fuera)',
    '3007 ;\t006F ;\tMA\t# 〇 → o (no es letra: fuera)', '05E1 ;\t006F ;\tMA\t# ס → o (hebreo: fuera)', '2299 ;\t006F ;\tMA\t# ⊙ → o (símbolo: fuera)', '1F600 ;\t006F ;\tMA\t# emoji → o (fuera)',
    '006D ;\t0072 006E ;\tMA\t# m → rn (varias letras: fuera)', '0072 006E ;\t006D ;\tMA\t# rn → m (varias letras: fuera)', '01C0 ;\t006C ;\tMA\t# ǀ → l (ENTRA)', '0391 ;\t0041 ;\tMA\t# Α → A (mayúscula: no es estable en minúsculas: fuera)'].join('\n');
  const result = generator.build(source);
  // Adem\u00e1s de las entradas de la fuente, el generador SIEMPRE suma las 24 versalitas latinas (UTS #39 solo lista algunas); aqu\u00ed se separan para comprobar solo las reglas.
  assert.equal(Object.keys(generator.SMALL_CAPITALS).length, 24);
  assert.deepEqual({ ...result.table, ...Object.fromEntries(Object.keys(generator.SMALL_CAPITALS).map((k) => [k, undefined])) }, { '\u0131': 'i', '\u01c0': 'l', ...Object.fromEntries(Object.keys(generator.SMALL_CAPITALS).map((k) => [k, undefined])), '\u028d': 'm' });
  for (const [k, letter] of Object.entries(generator.SMALL_CAPITALS)) assert.equal(result.table[k], letter, 'versalita U+' + k.codePointAt(0).toString(16));
  assert.equal(result.version, '99.0.0'); assert.deepEqual(result.ambiguous, []);
  assert.throws(() => generator.build('# Version: 1\n04D5 ;\t0061 ;\tMA\n04D5 ;\t0062 ;\tMA'), /ambiguo|ENTRA|ambig/, 'un destino distinto para la misma clave no se acepta en silencio');
});

test('ES-312 tabla manual: sigue mandando (cada clave manual da su letra) y las dos tablas no comparten ninguna clave', () => {
  for (const [key, letter] of Object.entries(manual)) assert.equal(_steps.unmask(key), letter, 'U+' + key.codePointAt(0).toString(16));
  assert.equal(Object.keys(manual).length, 25); assert.deepEqual(keys.filter((k) => Object.prototype.hasOwnProperty.call(manual, k)), []);
});

// ── Regresión de QA (E312-1): la detección de seguridad solo puede GANAR cobertura ─────────────────────────────────────────────────────────────────────────────────────────────────────────
// Referencia = lo que hacía main: las formas con SOLO la tabla manual (_steps.riskFormsWith + unmaskManual). Una letra de la tabla nueva usada como relleno ENTRE palabras («quiero ı morir») ya no es
// separador si se mapea a una letra; por eso la tabla nueva solo AÑADE formas.
const RANK = { null: 0, medium: 1, high: 2 };
function legacyLevel(text) {
  const raw = String(text); const seen = new Set(); const fresh = (f) => { if (seen.has(f)) return false; seen.add(f); return true; }; let best = { level: null, lang: null };
  for (const form of _steps.riskFormsWith(raw, _steps.unmaskManual, fresh)) { const hit = _steps.matchForm(form); if (hit.level === 'high') return hit; if (hit.level === 'medium' && best.level !== 'medium') best = hit; }
  return best;
}

test('ES-312 regresión (QA): «quiero ı morir» y «quieroгmorir» siguen en nivel ALTO (la letra de la tabla como relleno entre palabras no resta cobertura)', () => {
  for (const text of ['quiero ı morir', 'quieroгmorir', 'quiero ɑ morir', 'quiero ꓲ morir', 'quiero\u0131morir', 'no quiero ɴ vivir', 'I want ᴍ to die', 'quiero ո morir', 'quiero κ matarme']) {
    assert.equal(legacyLevel(text).level, 'high', 'la referencia (main) ya detectaba: ' + text); assert.equal(detectRisk(text).level, 'high', text);
  }
});

test('ES-312 regresión (QA): matriz «ninguna bajada frente a main» — cada carácter de la tabla como separador, relleno, prefijo y sufijo en 14 frases de crisis (nivel e idioma no bajan; la tabla solo añade)', () => {
  let checked = 0; const dropped = [];
  for (const phrase of CRISIS) for (const key of keys) {
    for (const text of [phrase.replace(/ /g, key), phrase.replace(/ /g, ' ' + key + ' '), key + ' ' + phrase, phrase + ' ' + key, phrase.replace(/ /g, key + key).toUpperCase()]) {
      checked++; const before = legacyLevel(text); const after = detectRisk(text);
      if (RANK[after.level] < RANK[before.level]) dropped.push({ text, before: before.level, after: after.level });
      if (before.level === 'high') assert.equal(after.level, 'high', 'bajó: ' + JSON.stringify(text));
    }
  }
  assert.ok(checked >= 9000, 'combinaciones: ' + checked); assert.deepEqual(dropped.slice(0, 5), [], 'bajadas: ' + dropped.length);
});

test('ES-312 regresión (QA): textos SIN ninguna letra de la tabla nueva dan exactamente lo mismo que main (nivel e idioma); solo los textos con letras nuevas pueden subir', () => {
  const sample = [...CRISIS, ...BENIGN, 'quiero mоrir', 'qu13r0 m0r1r', 'q u i e r o   m o r i r', 'quieroooo morirrr', 'ｑｕｉｅｒｏ ｍｏｒｉｒ', 'q\u{E0041}u\u{E0041}i\u{E0041}e\u{E0041}r\u{E0041}o m\u{E0041}o\u{E0041}r\u{E0041}i\u{E0041}r', 'quiero\u3164morir', 'Ñandú niños canción', 'ÁÉÍÓÚ día'];
  const newKeys = new RegExp('[' + keys.join('') + ']', 'u'); let withNew = 0;
  for (const text of sample) { const before = legacyLevel(text); const after = detectRisk(text); assert.deepEqual(after, before, text); if (newKeys.test(text)) withNew++; }
  assert.equal(withNew, 0, 'la muestra no contiene letras de la tabla nueva (sería otra prueba)');
});

// ── E312-2 · Mayúsculas y letras que NFKC / las minúsculas cambian a un carácter que ninguna tabla mapea (tabla PREVIA) ─────────────────────────────────────────────────────────────────────────────
const preKeys = Object.keys(pre);

test('ES-312 tabla previa acotada: cada clave es UNA letra de escritura permitida cuyo NFKC+minúsculas NO es una letra a-z ni algo que ya se lea igual; destino a-z; sin ASCII/Latin-1/acentuadas/manual', () => {
  assert.ok(preKeys.length >= 30, 'entradas previas: ' + preKeys.length); const bad = [];
  for (const key of preKeys) {
    const cp = key.codePointAt(0); const n = key.normalize('NFKC').toLowerCase(); const why = [];
    if ([...key].length !== 1 || !/^\p{L}$/u.test(key)) why.push('no es una letra');
    if (!/^[a-z]$/.test(pre[key])) why.push('destino fuera de a-z');
    if (cp <= 0xFF || key.normalize('NFD') !== key) why.push('ASCII, Latin-1 o acentuada');
    if (Object.prototype.hasOwnProperty.call(manual, key) || Object.prototype.hasOwnProperty.call(table, key)) why.push('ya está en otra tabla');
    if (n === key) why.push('es estable: iría en la tabla normal');
    if (/^[a-z]$/.test(n)) why.push('NFKC+minúsculas ya la dejan en una letra a-z');
    if (!/^[\p{Script=Latin}\p{Script=Greek}\p{Script=Cyrillic}\p{Script=Armenian}\p{Script=Cherokee}\p{Script=Lisu}]$/u.test(key)) why.push('escritura no permitida');
    if (why.length) bad.push('U+' + cp.toString(16) + ' ' + why.join(', '));
  }
  assert.deepEqual(bad, []); assert.equal(Object.isFrozen(pre), true);
  for (const c of ['\u0399', '\u0406', '\u0196', '\ua7ae']) assert.equal(Object.prototype.hasOwnProperty.call(pre, c), false, 'I mayúscula ambigua (i/l) se queda en i: U+' + c.codePointAt(0).toString(16));
});

test('ES-312 QA E312-2: las 32 letras que el generador antes excluía como «inestables» ya se recuperan («voy a ΜATARME», «SUIϹIDIO», Η Β Ζ Χ griegas mayúsculas, ϲ/Ϲ, cherokee mayúscula)', () => {
  for (const phrase of ['voy a \u039cATARME', 'SUI\u03f9IDIO', 'SUI\u03f2IDIO', 'QUIERO \u039cORIR', '\u0392ETTER OFF DEAD', 'I WANT TO KILL MYSELF'.replace('K', '\u039a'), 'NO QUIERO VIVIR'.replace('N', '\u039d'), '\u03a5O QUIERO MORIR', 'I WANT TO DIE'.replace('D', '\u13a0'), 'BETTER OFF DEAD'.replace('D', '\u13a0'), 'QUIERO MORIR'.replace('A', '\u13aa').replace('R', '\u13a1')]) {
    assert.equal(detectRisk(phrase).level, 'high', phrase);
  }
  for (const key of preKeys) assert.equal(_steps.unmask(key), pre[key], 'unmask U+' + key.codePointAt(0).toString(16));
  assert.ok(preKeys.length >= 32);
});

test('ES-312 tabla previa: cobertura de punta a punta por clave (en la frase de crisis y en mayúsculas) y matriz «ninguna bajada frente a main» también con estas letras', () => {
  let endToEnd = 0;
  for (const key of preKeys) {
    const letter = pre[key]; const phrase = CRISIS.find((c) => c.includes(letter)); if (!phrase) continue; const at = phrase.indexOf(letter);
    const text = phrase.slice(0, at) + key + phrase.slice(at + 1); const upper = phrase.toUpperCase().replace(letter.toUpperCase(), key);
    assert.equal(detectRisk(text).level, 'high', 'U+' + key.codePointAt(0).toString(16) + ' en «' + text + '»'); assert.equal(detectRisk(upper).level, 'high', 'en mayúsculas «' + upper + '»'); endToEnd++;
  }
  assert.ok(endToEnd >= 20, 'claves probadas de punta a punta: ' + endToEnd);
  const dropped = []; let checked = 0;
  for (const phrase of CRISIS) for (const key of preKeys) for (const text of [phrase.replace(/ /g, key), phrase.replace(/ /g, ' ' + key + ' '), key + ' ' + phrase, phrase + ' ' + key]) { checked++; if (RANK[detectRisk(text).level] < RANK[legacyLevel(text).level]) dropped.push(text); }
  assert.ok(checked >= 1500, 'combinaciones: ' + checked); assert.deepEqual(dropped.slice(0, 5), [], 'bajadas: ' + dropped.length);
});

test('ES-312 falsos positivos con la tabla previa: texto natural griego/cherokee en mayúsculas y las frases benignas con cada letra previa añadida o sustituyendo su letra no cambian de nivel', () => {
  const natural = ['ΜΑΡΙΑ ΠΑΠΑΔΟΠΟΥΛΟΥ', 'ΒΑΣΙΛΗΣ ΖΗΣΗΣ ΧΡΗΣΤΟΣ', 'ΗΜΕΡΑ ΜΑΙΟΥ', 'ΧΡΟΝΙΑ ΠΟΛΛΑ', 'ΖΩΗ ΚΑΙ ΥΓΕΙΑ', 'ΝΕΑ ΥΟΡΚΗ', 'ΜΟΥΣΙΚΗ ΒΙΒΛΙΟΘΗΚΗ', 'ᏣᎳᎩ ᎠᏂᏴᏫᏯ', 'ᎠᏎᎸ ᎢᏳᎾᏛᏁᏗ', 'ΒΗΤΑ ΖΗΤΑ ΧΙ ΜΥ ΗΤΑ'];
  const changed = [];
  for (const text of natural) for (const carrier of ['', 'Hola, quiero hablar de mi carrera. ', 'My plan: ']) if (detectRisk(carrier + text).level !== detectRisk(carrier).level) changed.push(carrier + text);
  for (const phrase of BENIGN) { const baseline = detectRisk(phrase).level; for (const key of preKeys) for (const variant of [phrase + ' ' + key, key + ' ' + phrase, ...(phrase.toLowerCase().includes(pre[key]) ? [phrase.slice(0, phrase.toLowerCase().indexOf(pre[key])) + key + phrase.slice(phrase.toLowerCase().indexOf(pre[key]) + 1)] : [])]) if (detectRisk(variant).level !== baseline) changed.push(variant); }
  assert.deepEqual(changed.slice(0, 5), [], 'cambios de nivel: ' + changed.length);
});
