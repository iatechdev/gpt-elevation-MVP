// ES-352 · Utilidad compartida de caracteres invisibles y de dirección en NOMBRES (utils/invisibleText.js) y su uso en la solicitud profesional.
// Decisión de Infra (reversible): en nombres se RECHAZAN controles, U+200B, U+200E/200F, U+202A–202E, U+2066–2069, U+2028/2029 y U+FEFF (más tags y U+2060); se PERMITEN ZWNJ, ZWJ y selectores de variación.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { nameProblem, isValidName, codePoints, MAX_NAME } = require('../utils/invisibleText');
const { validateApplication } = require('../utils/professionalApplication');

const REJECTED = {
  'NUL': 'Ana\u0000', 'salto de línea': 'Ana\nPérez', 'tabulación': 'Ana\tPérez', 'DEL': 'Ana\u007F', 'control C1': 'Ana\u0085',
  'ZWSP U+200B': 'An\u{200B}a', 'LRM U+200E': 'Ana\u{200E}', 'RLM U+200F': 'Ana\u{200F}', 'LRE U+202A': '\u{202A}Ana', 'RLE U+202B': '\u{202B}Ana', 'PDF U+202C': 'Ana\u{202C}', 'LRO U+202D': '\u{202D}Ana', 'RLO U+202E': '\u{202E}anA',
  'LRI U+2066': '\u{2066}Ana', 'RLI U+2067': '\u{2067}Ana', 'FSI U+2068': '\u{2068}Ana', 'PDI U+2069': 'Ana\u{2069}', 'LS U+2028': 'Ana\u{2028}Pérez', 'PS U+2029': 'Ana\u{2029}Pérez',
  'BOM U+FEFF al inicio': '\u{FEFF}Ana', 'BOM U+FEFF dentro': 'An\u{FEFF}a', 'tag U+E0041': 'Ana\u{E0041}', 'tag cancel U+E007F': 'Ana\u{E007F}', 'word joiner U+2060': 'An\u{2060}a',
};
const ACCEPTED = {
  'español con acentos y ñ': 'María José Núñez-Peña', 'inglés con apóstrofo': "Ann O'Brien-Smith", 'diéresis': 'Zoë Müller',
  'persa con ZWNJ U+200C': 'می\u{200C}خواهم', 'árabe': 'محمد بن سلمان', 'hebreo': 'דוד כהן', 'cirílico': 'Ольга Иванова', 'griego': 'Αθανάσιος', 'chino': '王小明', 'japonés': 'さくら',
  'índica con ZWJ U+200D': 'क्\u{200D}ष', 'índica con ZWNJ': 'क्\u{200C}ष', 'devanagari con marcas': 'अनुराग',
  'emoji compuesto (familia, ZWJ) junto a letras': 'Ana 👨\u{200D}👩\u{200D}👧', 'emoji de profesión (ZWJ)': 'Ana 👩\u{200D}💻', 'bandera (indicadores regionales)': 'Ana 🇨🇴',
  'selector de variación U+FE0F': 'Ana ❤\u{FE0F}', 'tono de piel': 'Ana 👍🏽', 'espacios interiores': 'Ana   Pérez', 'espacios en los bordes (se recortan)': '  Ana  ', 'un solo carácter': 'Li', 'solo emoji (ES-324 lo admite)': '🙂', 'solo emoji compuesto (ZWJ)': '👨\u{200D}👩\u{200D}👧', 'número': 'R2D2',
};

for (const [name, text] of Object.entries(REJECTED)) test(`ES-352: se rechaza el nombre con ${name}`, () => { assert.equal(nameProblem(text), 'forbidden'); assert.equal(isValidName(text), false); });
for (const [name, text] of Object.entries(ACCEPTED)) test(`ES-352: se acepta el nombre ${name}`, () => { assert.equal(nameProblem(text), null, JSON.stringify(text)); assert.equal(isValidName(text), true); });

test('ES-352: «vacío» a la vista se rechaza (solo espacios, solo ZWSP, solo marcas de dirección, solo signos)', () => {
  assert.equal(nameProblem(''), 'empty'); assert.equal(nameProblem('   '), 'empty'); assert.equal(nameProblem('\u{3000}\u{A0}'), 'empty');
  for (const text of ['\u{200B}', ' \u{200B} ', '\u{202E}', '\u{FEFF}', '\u{2028}']) assert.equal(nameProblem(text), 'forbidden', JSON.stringify(text));
  for (const text of ['!!!', '---', '...', '\u{200C}', '\u{200D}', '\u{FE0F}']) assert.equal(nameProblem(text), 'no_visible', JSON.stringify(text));
  for (const value of [undefined, null, 5, {}, [], true]) assert.equal(nameProblem(value), 'type');
});

test('ES-352: la longitud se cuenta en puntos de código (no en unidades UTF-16 ni bytes) y el límite es 100', () => {
  assert.equal(MAX_NAME, 100); assert.equal(codePoints('𝒜'), 1); assert.equal('𝒜'.length, 2);
  assert.equal(nameProblem('Ж'.repeat(100)), null); assert.equal(nameProblem('Ж'.repeat(101)), 'too_long');
  assert.equal(nameProblem('𝒜'.repeat(100)), null, '100 puntos de código astrales = 200 unidades UTF-16');
  assert.equal(nameProblem('𝒜'.repeat(101)), 'too_long');
  assert.equal(nameProblem('A' + ' '.repeat(500) + 'B'), 'too_long'); assert.equal(nameProblem(' ' + 'a'.repeat(100) + ' '), null, 'el recorte va antes de contar');
  assert.equal(nameProblem('a'.repeat(60), 50), 'too_long'); assert.equal(nameProblem('a'.repeat(50), 50), null);
});

test('ES-352: el motivo no repite lo recibido (la respuesta no devuelve el texto)', () => {
  for (const text of ['\u{202E}secreto', 'x'.repeat(500)]) assert.ok(!/secreto|xxx/.test(String(nameProblem(text))));
});

// ---- solicitud profesional (nombre) -------------------------------------------------------------------------------------------------------------------------------
const pdf = { buffer: Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(64)]) };
const body = (name) => ({ name, email: 'pro@example.invalid', country: 'Colombia', profession: 'Psicología', consent: 'true' });

test('ES-352: la solicitud profesional rechaza el nombre con caracteres invisibles o de dirección (campo «name») y acepta ZWNJ/ZWJ legítimos', () => {
  for (const text of Object.values(REJECTED)) { const out = validateApplication(body(text), pdf); assert.equal(out.ok, false, JSON.stringify(text)); assert.deepEqual(out.fields, ['name']); }
  for (const text of ['\u{200B}', '!!!', '\u{200C}\u{200D}']) assert.deepEqual(validateApplication(body(text), pdf).fields, ['name'], JSON.stringify(text));
  for (const text of Object.values(ACCEPTED).filter((t) => t.trim().length <= 120)) { const out = validateApplication(body(text), pdf); assert.equal(out.ok, true, JSON.stringify(text)); assert.equal(out.values.name, text.trim(), 'se guarda lo que escribió la persona (sin borrar en silencio)'); }
  assert.deepEqual(validateApplication(body('   '), pdf).fields, ['name'], 'vacío sigue siendo campo obligatorio faltante');
});

// ---- mutaciones (la prueba debe fallar si la regla se debilita) ---------------------------------------------------------------------------------------------------
test('ES-352 mutaciones: cada carácter de la decisión cuenta; quitar uno lo deja pasar y esta prueba lo vería', () => {
  const src = require('node:fs').readFileSync(require.resolve('../utils/invisibleText.js'), 'utf8');
  const parts = ['\\p{Cc}', '\\u{200B}', '\\u{200E}\\u{200F}', '\\u{2028}\\u{2029}', '\\u{202A}-\\u{202E}', '\\u{2060}', '\\u{2066}-\\u{2069}', '\\u{FEFF}', '\\u{E0000}-\\u{E007F}'];
  for (const part of parts) {
    assert.ok(src.includes(part), part);
    const line = src.split(String.fromCharCode(10)).find((l) => l.startsWith('const FORBIDDEN_IN_NAME')); assert.ok(line.includes(part), part)
    const mutated = src.replace(line, line.replace(part, ''));
    const m = { exports: {} }; new Function('module', 'exports', 'require', mutated)(m, m.exports, require);
    const survived = Object.entries(REJECTED).filter(([, text]) => m.exports.nameProblem(text) === null).map(([name]) => name);
    assert.ok(survived.length > 0, `quitar «${part}» debería dejar pasar algún nombre rechazado`);
  }
  // la prohibición de ZWNJ/ZWJ sería un error: las pruebas de ACCEPTED lo detectan
  const strict = src.replace('\\u{200B}', '\\u{200B}\\u{200C}\\u{200D}');
  const m = { exports: {} }; new Function('module', 'exports', 'require', strict)(m, m.exports, require);
  assert.equal(m.exports.nameProblem('می\u{200C}خواهم'), 'forbidden', 'si alguien prohibiera ZWNJ, el persa dejaría de pasar (la prueba ACCEPTED lo atrapa)');
});
