// ES-149: aviso permanente de límites del asistente en el chat (QA-41-01), ES/EN, con el texto aprobado de la landing.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { copy } from '../src/space/copy.ts'

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8')
const catalog = JSON.parse(read('../../shared/landing-content.json'))
const entry = (key) => catalog.find(e => e.key === key)

test('ES-149 texto: el aviso es landing.footer.notice más la frase aprobada «La IA puede equivocarse» (sin frases nuevas)', () => {
  // ES-360: el aviso del cierre de la portada (landing.footer.notice) cambió por el diseño 12863 («Elevation ofrece acompañamiento…»). El aviso del CHAT (ES-149) no entra en ese diseño y conserva su texto aprobado,
  // que dice «no clínicos» (lo exige el test siguiente). Aserción conservada: «aviso aprobado + La IA puede equivocarse», sin frases nuevas. Unificar ambos avisos queda como propuesta aparte.
  const notice = { es: 'El asistente de IA de Elevation ofrece acompañamiento y orientación profesional no clínicos; no sustituye la atención psicológica, médica ni de emergencia.', en: 'Elevation\'s AI assistant offers non-clinical support and career guidance; it does not replace psychological, medical or emergency care.' }
  const trust = entry('landing.trust.1.body')
  assert.ok(entry('landing.footer.notice') && trust)
  assert.equal(copy.es.limits, `${notice.es} La IA puede equivocarse.`); assert.equal(copy.en.limits, `${notice.en} AI can be wrong.`)
  assert.ok(trust.es.includes('La IA puede equivocarse.')); assert.ok(trust.en.includes('AI can be wrong.'))
})

test('ES-149 límites: dice no clínico, que no sustituye atención de emergencia y que la IA se equivoca; sin teléfonos ni promesas', () => {
  for (const lang of ['es', 'en']) {
    const text = copy[lang].limits
    assert.doesNotMatch(text, /\d{3}/); assert.doesNotMatch(text, /garantiz|guarantee|cura|cure/i)
    assert.ok(copy[lang].limitsLabel.length > 0)
  }
  assert.match(copy.es.limits, /no clínicos/); assert.match(copy.es.limits, /emergencia/)
  assert.match(copy.en.limits, /non-clinical/); assert.match(copy.en.limits, /emergency/)
})

test('ES-149 diseño: el aviso va dentro de la barra de mensaje, debajo de la caja, siempre montado y como nota accesible', () => {
  const page = read('../src/pages/ChatPage.tsx'); const notice = read('../src/space/ChatLimitsNotice.tsx')
  assert.match(page, /<div className="chat-input-bar">\s*<ChatInput chat=\{chat\} enterSends=\{enterSends\} \/>\s*<ChatLimitsNotice \/>\s*<\/div>/)
  // ES-333 (PR 2): con alto visible < 400 px (teclado muy corto) el aviso se oculta SOLO mientras se escribe y reaparece al cerrar el teclado; fuera de eso es permanente.
  const css = read('../src/space/space.css'); assert.match(css, /@media \(max-height: 399px\) \{ \.chat-input-bar:has\(textarea:focus\) \.chat-composer-top, \.chat-input-bar:has\(textarea:focus\) \.chat-limits \{ display: none; \} \}/)
  assert.match(notice, /role="note" aria-label=\{c\.limitsLabel\}/); assert.match(notice, /\{c\.limits\}/)
  assert.doesNotMatch(notice, /useState|useEffect|fetch|tabIndex|onClick/)
})
