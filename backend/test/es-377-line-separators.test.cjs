// ES-377 · U+2028 (separador de línea) y U+2029 (separador de párrafo) se tratan como un salto de línea normal, en normalizeText y en la barrera hacia el proveedor (stripInvisible), con la misma regla.
// Antes pasaban crudos al modelo. Consumidores auditados (ver el PR): comparadores y detectores ya trataban U+2028/9 como espacio (\s), así que sus resultados no cambian; los que cortan por línea ahora los ven.
const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeText, stripInvisible, fenceUntrusted } = require('../utils/promptSafety');

const LS = '\u2028'; const PS = '\u2029'; const ZWSP = '​'; const ZWJ = '‍';

test('ES-377: U+2028/U+2029 pasan a salto de línea en normalizeText y en la barrera', () => {
  for (const [name, text, expected, barrier] of [
    ['LS', `uno${LS}dos`, 'uno\ndos'], ['PS', `uno${PS}dos`, 'uno\ndos'], ['mezclados', `a${LS}${PS}b`, 'a\n\nb'], ['con CRLF', `a\r\nb${LS}c`, 'a\nb\nc', 'a\r\nb\nc'],
    ['con ZWSP en medio', `a${ZWSP}${LS}b`, 'a\nb'], ['inglés', `Line one${LS}Line two`, 'Line one\nLine two'], ['persa con ZWNJ aparte', `می${PS}خواهم`, 'می\nخواهم'],
  ]) {
    assert.equal(normalizeText(text), expected, `normalizeText ${name}`);
    assert.equal(stripInvisible(text).replace(/​/g, ''), barrier ?? expected, `stripInvisible ${name} (la barrera no toca CR: solo U+2028/9)`);
  }
  assert.ok(!/[\u2028\u2029]/.test(fenceUntrusted('a message', `x${LS}y${PS}z`).block), 'el bloque que va al proveedor no lleva U+2028/9');
});

test('ES-377: al principio o al final se recortan como cualquier espacio (trim ya los trataba así)', () => {
  assert.equal(normalizeText(`${LS}hola${PS}`), 'hola');
  assert.equal(normalizeText(`${LS}${PS}`), '');
});

test('ES-377: normalizeText es idempotente y la barrera no cambia lo ya normalizado (fuzz determinista)', () => {
  const pieces = ['a', 'ب', LS, PS, '\n', '\r\n', ZWSP, ZWJ, '‮', '\u0001', ' ', '.', '👩'];
  let seed = 377; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  for (let i = 0; i < 4000; i += 1) {
    let text = ''; const length = 1 + Math.floor(rnd() * 9); for (let j = 0; j < length; j += 1) text += pieces[Math.floor(rnd() * pieces.length)];
    const once = normalizeText(text);
    assert.equal(normalizeText(once), once, `idempotencia con ${JSON.stringify(text)}`);
    assert.equal(stripInvisible(once), once, `la barrera no cambia lo normalizado ${JSON.stringify(text)}`);
    assert.ok(!/[\u2028\u2029]/.test(once));
  }
});

test('ES-377: consumidores: los comparadores no cambian (\s ya los trataba como espacio) y los que cortan por línea los ven', () => {
  const flat = (s) => normalizeText(s).replace(/\s+/g, ' ').toLowerCase(); // forma de evidence.norm / aiProposals.flat / skillMap.normalizeForQuote
  const before = (s) => String(s).normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase();
  for (const text of [`Escribí el informe${LS}final`, `Escribí el informe${PS}${PS}final`, 'Escribí el informe final']) assert.equal(flat(text), before(text));
  assert.equal(flat(`Escribí el informe${LS}final`), flat('Escribí el informe final'), 'una cita con U+2028 sigue coincidiendo con el texto de origen con espacio');
  assert.deepEqual(normalizeText(`uno${LS}dos${PS}tres`).split('\n'), ['uno', 'dos', 'tres'], 'los detectores por línea ven tres líneas');
  assert.equal(normalizeText(`uno${LS}dos`).replace(/[\r\n]+/g, ' '), 'uno dos', 'matching.clean (reemplaza saltos por espacio) ahora también cubre U+2028/9');
});
