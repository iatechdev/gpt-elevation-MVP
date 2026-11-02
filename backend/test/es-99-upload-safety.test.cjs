// ES-99: saneado del nombre y verificación del contenido de los documentos del alta del profesional (funciones puras).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ALLOWED_TYPES, contentMatches, safeDocumentName, storageName } = require('../utils/uploadSafety');

test('ES-99: el nombre que se guarda no trae rutas, caracteres de control ni puntos iniciales y nunca queda vacío', () => {
  assert.equal(safeDocumentName('../../etc/passwd.pdf'), 'passwd.pdf');
  assert.equal(safeDocumentName('C:\\Users\\x\\título.pdf'), 'título.pdf');
  assert.equal(safeDocumentName('mal\u0007nombre\u202e.pdf'), 'malnombre.pdf'); // control y marca de dirección de texto
  assert.equal(safeDocumentName('.htaccess'), 'htaccess');
  assert.equal(safeDocumentName('   '), 'documento');
  assert.equal(safeDocumentName(undefined), 'documento');
  assert.equal(safeDocumentName('a/'), 'documento');
  assert.ok(safeDocumentName('x'.repeat(500) + '.pdf').length <= 150);
  assert.match(storageName('título con espacios (1).pdf'), /^[a-zA-Z0-9._-]+$/);
  assert.ok(!storageName('../../x.pdf').includes('..') || !storageName('../../x.pdf').includes('/'));
  assert.ok(storageName('y'.repeat(500)).length <= 100);
});

test('ES-99: el contenido debe corresponder al tipo declarado (PDF, JPEG, PNG, WEBP); lo demás no pasa', () => {
  const pdf = Buffer.from('%PDF-1.4 x');
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2]);
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('x')]);
  const webp = Buffer.concat([Buffer.from('RIFF'), Buffer.from([1, 0, 0, 0]), Buffer.from('WEBPVP8 ')]);
  assert.deepEqual([...ALLOWED_TYPES].sort(), ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);
  assert.ok(contentMatches('application/pdf', pdf) && contentMatches('image/jpeg', jpeg) && contentMatches('image/png', png) && contentMatches('image/webp', webp));
  for (const [type, buffer] of [['application/pdf', jpeg], ['image/png', pdf], ['image/jpeg', png], ['image/webp', Buffer.from('RIFF....WAVE')], ['image/png', Buffer.from('MZ')],
    ['application/pdf', Buffer.alloc(0)], ['application/pdf', Buffer.from('%PDF')], ['text/plain', Buffer.from('hola')], ['application/x-msdownload', Buffer.from('MZ')]]) {
    assert.equal(contentMatches(type, buffer), false, type);
  }
  assert.equal(contentMatches('application/pdf', 'no es un buffer'), false);
  assert.equal(contentMatches('__proto__', pdf), false);
  assert.equal(contentMatches('constructor', pdf), false);
});
