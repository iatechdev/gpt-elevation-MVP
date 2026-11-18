// ES-337: el aviso de privacidad publicado describe con exactitud lo que se envía al modelo (texto aprobado por el tech lead suplente; sigue «borrador sin revisión legal»).
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { LEGAL } from '../src/legal/legalCopy.ts'
import { TERMS_VERSION } from '../src/legal/version.ts'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const flat = doc => doc.sections.map(section => [section.heading, ...(section.bullets ?? []), ...(section.paragraphs ?? [])].join('\n')).join('\n')

test('ES-337: la versión sube a 2026-11-v2 en cliente y servidor', () => {
  assert.equal(TERMS_VERSION, '2026-11-v2'); assert.match(read('../../backend/utils/terms.js'), /version: '2026-11-v2', required: true/)
})

test('ES-337: el aviso ES/EN enumera cada flujo que envía datos al modelo, con sus límites, y ya no afirma que la IA no ve el diario ni las conversaciones', () => {
  const es = flat(LEGAL.es.privacy), en = flat(LEGAL.en.privacy)
  for (const pattern of [/últimos 20 mensajes/, /entradas de diario que tú elijas/, /No enviamos tu nombre ni tu correo/, /indicio grave de crisis[\s\S]*no se envía al modelo/, /últimos 7 días/, /Análisis de habilidades:\*\* las evidencias que confirmaste \(título/, /hasta 10 entradas de tu diario/, /sin datos de contacto/, /Emparejamiento/, /cifras agregadas/, /Anthropic/]) assert.match(es, pattern, String(pattern))
  for (const pattern of [/last 20 messages/, /journal entries you choose/, /do not send your name or email/, /serious sign of crisis[\s\S]*not sent to the model/, /last 7 days/, /Skills analysis:\*\* the evidence you confirmed \(title/, /up to 10 entries from your journal/, /without contact details/, /Matching/, /aggregate figures/, /Anthropic/]) assert.match(en, pattern, String(pattern))
  assert.doesNotMatch(es, /solo ve tus evidencias confirmadas|no tu diario, tu ánimo ni tus conversaciones/); assert.doesNotMatch(en, /only sees your confirmed evidence|not your journal, mood or conversations/)
  assert.match(es, /Nada de lo que la IA lee llega a un profesional sin tu permiso/); assert.match(en, /Nothing the AI reads reaches a professional without your permission/)
})

test('ES-337: la contraseña se describe como resumen irreversible (hash), no «cifrada»', () => {
  assert.match(flat(LEGAL.es.privacy), /resumen irreversible/); assert.doesNotMatch(flat(LEGAL.es.privacy), /se guarda cifrada/)
  assert.match(flat(LEGAL.en.privacy), /irreversible digest/); assert.doesNotMatch(flat(LEGAL.en.privacy), /stored encrypted/)
})

test('ES-337: lo pendiente NO se completó por suposición (proveedores, país, transferencia, no-entrenamiento) y el texto sigue como borrador sin revisión legal', () => {
  assert.match(flat(LEGAL.es.privacy), /\[\[VERIFICAR con Infra: nombres, país de cada uno, si hay transferencia internacional y, por contrato, que no usan tus datos para entrenar modelos\.\]\]/)
  assert.match(flat(LEGAL.en.privacy), /\[\[VERIFY with Infra: names, country of each, any international transfer and, by contract, that they do not use your data to train models\.\]\]/)
  assert.match(LEGAL.es.privacy.draft, /sin revisión legal/); assert.match(LEGAL.en.privacy.draft, /without legal review/)
})
