// ES-301 · Lógica pura de la aceptación del aviso de privacidad y términos (utils/terms.js). La prueba con PostgreSQL real y HTTP está en test/integration/es-301-postgres.cjs.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const terms = require('../utils/terms');

const withConfig = (config, fn) => { const real = terms.current; terms.current = () => config; try { return fn(); } finally { terms.current = real; } };
const code = (body, config) => withConfig(config, () => { try { terms.validate(body); return null; } catch (error) { assert.ok(error instanceof terms.TermsError); assert.equal(error.status, 400); return error.code; } });
const V = { version: '2026-11-v1', required: true };

test('ES-301: la constante es un MARCADOR (sin texto legal inventado) y no se puede cambiar en caliente', () => {
  assert.deepEqual({ ...terms.TERMS }, { version: null, required: false }, 'la versión inicial la fija Alejo con el texto aprobado');
  assert.ok(Object.isFrozen(terms.TERMS)); assert.equal(terms.validate({}), null, 'hoy el registro sin aceptación sigue igual');
})

test('ES-301: hoy (sin versión publicada) enviar una aceptación se rechaza: no se guarda «aceptó X» de un texto que no existe', () => {
  assert.equal(code({ acceptedTerms: true, termsVersion: 'v1' }, { version: null, required: false }), 'terms_not_available')
  assert.equal(code({ acceptedTerms: true, termsVersion: 'v1' }, { version: '', required: false }), 'terms_not_available')
})

test('ES-301: con versión vigente y registro obligatorio, cada forma inválida da su código estable', () => {
  const cases = [[{}, 'terms_required'], [{ acceptedTerms: false, termsVersion: V.version }, 'terms_not_accepted'], [{ acceptedTerms: 'true', termsVersion: V.version }, 'terms_not_accepted'],
    [{ acceptedTerms: 1, termsVersion: V.version }, 'terms_not_accepted'], [{ acceptedTerms: null, termsVersion: V.version }, 'terms_not_accepted'], [{ termsVersion: V.version }, 'terms_not_accepted'],
    [{ acceptedTerms: true }, 'terms_version_invalid'], [{ acceptedTerms: true, termsVersion: 5 }, 'terms_version_invalid'], [{ acceptedTerms: true, termsVersion: [V.version] }, 'terms_version_invalid'],
    [{ acceptedTerms: true, termsVersion: { v: 1 } }, 'terms_version_invalid'], [{ acceptedTerms: true, termsVersion: '' }, 'terms_version_invalid'], [{ acceptedTerms: true, termsVersion: 'a b' }, 'terms_version_invalid'],
    [{ acceptedTerms: true, termsVersion: 'x'.repeat(33) }, 'terms_version_invalid'], [{ acceptedTerms: true, termsVersion: '2026-10-v0' }, 'terms_version_mismatch']]
  for (const [body, expected] of cases) assert.equal(code(body, V), expected, JSON.stringify(body))
})

test('ES-301: aceptación válida → versión de la constante y fecha del servidor (lo que el cliente manda como fecha se ignora)', () => {
  const before = Date.now()
  const out = withConfig(V, () => terms.validate({ acceptedTerms: true, termsVersion: V.version, acceptedAt: '2000-01-01', role: 'admin' }))
  assert.equal(out.termsVersion, V.version); assert.ok(out.acceptedAt instanceof Date && out.acceptedAt.getTime() >= before && out.acceptedAt.getTime() <= Date.now())
  assert.deepEqual(Object.keys(out).sort(), ['acceptedAt', 'termsVersion'], 'nada más pasa del cuerpo')
})

test('ES-301: `required` solo tiene efecto con una versión fijada (una constante a medias no cierra el registro)', () => {
  assert.equal(code({}, { version: null, required: true }), null); assert.equal(code({}, { version: '', required: true }), null)
  assert.equal(code({}, { version: V.version, required: false }), null); assert.equal(code({}, V), 'terms_required')
})

test('ES-301: los errores informan la versión vigente solo cuando ayuda y los mensajes son bilingües', () => {
  withConfig(V, () => {
    for (const body of [{}, { acceptedTerms: true, termsVersion: 'otra' }]) { try { terms.validate(body); assert.fail('debía rechazar') } catch (error) { assert.equal(error.currentVersion, V.version); assert.match(error.message, / \/ /) } }
    try { terms.validate({ acceptedTerms: false, termsVersion: V.version }); assert.fail('debía rechazar') } catch (error) { assert.equal(error.currentVersion, undefined) }
  })
})

test('ES-301: el registro valida la aceptación ANTES de consultar la base y el servidor no confía en el cliente para la versión ni la fecha (estructura)', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'routes', 'auth.js'), 'utf8').replace(/\r\n/g, '\n')
  const register = source.slice(source.indexOf("router.post('/register'"), source.indexOf("router.post('/login'"))
  assert.ok(register.indexOf('terms.validate(req.body)') > 0 && register.indexOf('terms.validate(req.body)') < register.indexOf('User.findOne'), 'se valida antes de consultar si el correo existe')
  assert.match(register, /termsVersion: accepted\.termsVersion, acceptedAt: accepted\.acceptedAt/)
  assert.doesNotMatch(register, /req\.body\.(acceptedAt|termsVersion)/, 'la ruta nunca guarda directamente lo que mande el cliente')
  assert.match(register, /role: 'user'/)
})
