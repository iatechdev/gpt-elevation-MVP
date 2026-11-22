// ES-361 · normalizeText conserva el ZWNJ/ZWJ LEGÍTIMO (persa, escrituras índicas, emoji compuestos) con la misma regla que la barrera hacia el proveedor de IA (ES-352), y sigue quitando todo lo malicioso.
// Idempotente, sin regresión de comparadores (evidencia: norm usa normalizeText a ambos lados). Datos sintéticos. 0 IA, 0 base de datos.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { normalizeText, stripInvisible, fenceUntrusted } = require('../utils/promptSafety');

const ZWNJ = '\u200C'; const ZWJ = '\u200D';
const LEGIT = {
  'persa (ZWNJ entre letras)': `می${ZWNJ}خواهم`,
  'persa: plural con ZWNJ': `کتاب${ZWNJ}ها`,
  'hindi (ZWJ tras virama)': `क्${ZWJ}ष`,
  'malayalam (ZWNJ tras virama)': `ക്${ZWNJ}ഷ`,
  'emoji: profesional': `👩${ZWJ}💻`,
  'emoji: familia': `👨${ZWJ}👩${ZWJ}👧${ZWJ}👦`,
  'emoji con tono de piel': `👩🏽${ZWJ}💻`,
  'emoji con selector de variación': `🏳\uFE0F${ZWJ}🌈`,
  'español': 'La acción cambió, ¿no?',
  'inglés': 'I said it twice.',
};
const MALICIOUS = {
  'ZWSP': 'a\u200Bb', 'RLO': 'a\u202Eb', 'LRO': 'a\u202Db', 'FEFF': '\uFEFFab', 'WORD JOINER': 'a\u2060b', 'LRM/RLM': 'a\u200Eb\u200F', 'aislados (aislamiento bidi)': 'a\u2066b\u2069',
  'cadena de ZWJ (canal de bits)': `a${ZWJ}${ZWJ}${ZWNJ}b`, 'ZWJ al borde': `a${ZWJ}`, 'ZWNJ al inicio': `${ZWNJ}a`, 'ZWJ junto a espacios': `a ${ZWJ} b`, 'ZWJ entre signos': `.${ZWJ}.`,
};

test('ES-361: los ZWNJ/ZWJ legítimos sobreviven a normalizeText (antes se perdían) y coinciden con lo que la barrera deja pasar', () => {
  for (const [name, text] of Object.entries(LEGIT)) {
    assert.equal(normalizeText(text), text.normalize('NFC'), name);
    assert.equal(stripInvisible(normalizeText(text)), normalizeText(text), `${name}: la barrera no quita lo que normalizeText conservó`);
    assert.ok(fenceUntrusted('a message', normalizeText(text)).block.includes(normalizeText(text)), `${name}: llega íntegro al proveedor dentro del bloque delimitado`);
  }
});

test('ES-361: lo malicioso se sigue quitando (ZWSP, RLO/LRO, FEFF, joiners sueltos o en cadena), igual que antes', () => {
  for (const [name, text] of Object.entries(MALICIOUS)) {
    const out = normalizeText(text);
    assert.ok(!/[\u00AD\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF]/.test(out), `${name}: sin invisibles (${JSON.stringify(out)})`);
    assert.equal(out, stripInvisible(out), `${name}: normalizeText y la barrera coinciden`);
  }
  assert.equal(normalizeText(MALICIOUS['cadena de ZWJ (canal de bits)']), 'ab');
  assert.equal(normalizeText(`  ${ZWJ}hola${ZWJ}  `), 'hola');
});

test('ES-361: un ZWJ legítimo y uno malicioso juntos: solo se conserva el legítimo', () => {
  assert.equal(normalizeText(`مي${ZWNJ}خواهم ${ZWJ} y 👩${ZWJ}💻\u200B!`), `مي${ZWNJ}خواهم  y 👩${ZWJ}💻!`);
  assert.equal(normalizeText(`a\u200B${ZWJ}b`), `a${ZWJ}b`, 'quitar el ZWSP deja un ZWJ entre letras: se evalúa DESPUÉS y queda como legítimo, igual que en la barrera');
  assert.equal(stripInvisible(`a\u200B${ZWJ}b`), normalizeText(`a\u200B${ZWJ}b`));
});

test('ES-361: idempotente y estable (misma salida al normalizar dos veces, también con controles y saltos entre medias)', () => {
  const pieces = ['a', 'ب', '👩', ZWNJ, ZWJ, '\u200B', '\u202E', '\u0001', ' ', '\r\n', '\n', '.', '🏽', '\uFE0F', 'क्', 'é'];
  let seed = 361; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  for (let i = 0; i < 4000; i += 1) {
    let text = ''; const length = 1 + Math.floor(rnd() * 9); for (let j = 0; j < length; j += 1) text += pieces[Math.floor(rnd() * pieces.length)];
    const once = normalizeText(text);
    assert.equal(normalizeText(once), once, `idempotencia con ${JSON.stringify(text)}`);
    assert.equal(stripInvisible(once), once, `la barrera no cambia lo ya normalizado ${JSON.stringify(text)}`);
  }
});

test('ES-361: comparadores de evidencia: norm() aplica normalizeText a ambos lados, así una cita con ZWNJ sigue coincidiendo con el texto de origen', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'utils', 'evidence.js'), 'utf8');
  assert.match(source, /const norm = \(s\) => normalizeText\(s\)\.replace\(\/\\s\+\/g, ' '\)\.toLowerCase\(\);/);
  const origin = `Me gustó escribir کتاب${ZWNJ}ها para mi equipo`; const quote = `escribir کتاب${ZWNJ}ها`;
  const norm = (s) => normalizeText(s).replace(/\s+/g, ' ').toLowerCase();
  assert.ok(norm(origin).includes(norm(quote)));
  assert.ok(norm(origin).includes(norm(`escribir \u200Bکتاب${ZWNJ}ها`)), 'una cita con un ZWSP de más también coincide (el ZWSP se quita a ambos lados)');
});

test('ES-361: la detección de crisis no cambia (safety.js normaliza por su cuenta y no usa normalizeText)', () => {
  const safety = fs.readFileSync(path.join(__dirname, '..', 'utils', 'safety.js'), 'utf8');
  assert.doesNotMatch(safety, /normalizeText/);
  const { detectCrisis } = require('../utils/safety');
  if (typeof detectCrisis === 'function') {
    for (const text of ['quiero morir', `quiero${ZWNJ} morir`, 'quiero m\u200Borir', 'I want to di\u200De']) assert.equal(typeof detectCrisis(text), typeof detectCrisis('quiero morir'), JSON.stringify(text));
  }
});
