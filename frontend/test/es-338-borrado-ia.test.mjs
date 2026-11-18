// ES-338: el texto de consecuencias de eliminar la cuenta no afirma que se borre lo que ya recibió el proveedor de IA (plazos del proveedor no verificados; la purga es manual).
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../src/space/dataCopy.ts', import.meta.url), 'utf8')

test('ES-338: consecuencias de eliminar la cuenta (ES/EN) sin la afirmación inexacta sobre la IA y con la salvedad del proveedor', () => {
  assert.ok(!source.includes('incluidos los que usa la IA'), 'ES: frase retirada'); assert.ok(!source.includes('including what the AI uses'), 'EN: frase retirada')
  assert.ok(source.includes('Se borran tus datos en Elevation, incluidos los que se usan para generar respuestas con IA. Lo que ya se envió al proveedor de IA se rige por los plazos de ese proveedor, que aún no podemos confirmar.'))
  assert.ok(source.includes('Your data in Elevation is deleted, including what is used to generate AI replies. What was already sent to the AI provider follows that provider’s own timelines, which we cannot confirm yet.'))
})

test('ES-338: se conservan las demás consecuencias (sesión, no se puede deshacer, sin fecha de borrado)', () => {
  for (const text of ['Cerramos tu sesión y tu cuenta queda en proceso de eliminación.', 'No se puede deshacer. Si quieres conservar algo, descárgalo antes.', 'Todavía no podemos indicarte una fecha para completar el borrado.',
    'We sign you out and your account is being deleted.', 'This cannot be undone. If you want to keep something, download it first.', 'We cannot give you a date for completing the deletion yet.']) assert.ok(source.includes(text), text)
})
