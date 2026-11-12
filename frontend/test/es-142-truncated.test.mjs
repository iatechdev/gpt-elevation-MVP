// ES-142: aviso «La respuesta se cortó» y botón «Continuar» bajo la última respuesta que el modelo dejó cortada.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { history, makeIntent } from '../src/space/api.ts'
import { copy } from '../src/space/copy.ts'

const read = path => fs.readFileSync(new URL(path, import.meta.url), 'utf8')
const TOKEN = 'header.payload.signature-abcdefghijklmnopqrstuvwxyz0123'
const withBackend = async (rows, run) => {
  const realFetch = globalThis.fetch; const realStorage = globalThis.localStorage
  globalThis.localStorage = { getItem: () => TOKEN }
  globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => rows })
  try { return await run() } finally { globalThis.fetch = realFetch; globalThis.localStorage = realStorage }
}

test('ES-142: el historial conserva la marca solo cuando es exactamente true', async () => {
  const rows = [
    { role: 'user', text: 'plan' },
    { role: 'bot', text: 'cortada', truncated: true },
    { role: 'bot', text: 'completa', truncated: false },
    { role: 'bot', text: 'sin marca' },
    { role: 'bot', text: 'rara', truncated: 'true' },
  ]
  const result = await withBackend(rows, () => history(TOKEN))
  assert.deepEqual(result.map(m => m.truncated), [undefined, true, undefined, undefined, undefined])
  assert.deepEqual(result.map(m => m.text), ['plan', 'cortada', 'completa', 'sin marca', 'rara']) // el texto llega tal cual
})

test('ES-142: los textos nuevos existen en ES y EN y la continuación es un mensaje válido', () => {
  for (const key of ['truncated', 'truncatedHint', 'continue', 'continueMessage']) {
    assert.ok(copy.es[key] && copy.en[key], key)
    assert.notEqual(copy.es[key], copy.en[key], key)
  }
  for (const lang of ['es', 'en']) {
    const intent = makeIntent(copy[lang].continueMessage, lang, [])
    assert.equal(intent.message, copy[lang].continueMessage)
    assert.equal(intent.contextEntryIds, undefined) // sin diario
    assert.equal(makeIntent(copy[lang].continueMessage, lang, [], undefined, 'compass').mode, 'compass')
  }
})

test('ES-142: el aviso solo aparece en el último mensaje, si es del asistente y está marcado', () => {
  const controls = read('../src/space/ChatControls.tsx')
  assert.match(controls, /last\?\.role !== 'bot' \|\| !last\.truncated\) return null/)
  assert.match(controls, /chat\.expired \|\| !chat\.loaded/)
  assert.match(controls, /disabled=\{chat\.busy \|\| !!chat\.intent \|\| off\}/)
  assert.match(controls, /role="status"/)
  assert.match(read('../src/pages/ChatPage.tsx'), /i === messages\.length - 1 && msg\.role !== 'user' && <TruncatedNotice chat=\{chat\} \/>/)
})

test('ES-142: «Continuar» no toca el borrador ni el diario y reutiliza el flujo de envío', () => {
  const hook = read('../src/space/usePersonalChat.ts')
  assert.match(hook, /makeIntent\(c\.continueMessage, lang, \[\], undefined, mode\)/)
  assert.match(hook, /input\.trim\(\) !== sent\.message\) \{ setIntent\(null\)/) // otro borrador: se conserva
  assert.match(hook, /await confirm\(body\)/)
  assert.match(hook, /await confirm\(intent\)/)
  assert.match(hook, /last\?\.role !== 'bot' \|\| !last\.truncated\) return/)
})

test('ES-142: no hay textos fijos en español ni inglés en el componente nuevo', () => {
  const controls = read('../src/space/ChatControls.tsx')
  const block = controls.slice(controls.indexOf('export function TruncatedNotice'), controls.indexOf('export function ChatInput'))
  assert.doesNotMatch(block, /["'>]\s*(Continuar|Continue|Continúa|Please)|La respuesta|The response/)
  assert.match(block, /\{c\.truncated\}/); assert.match(block, /\{c\.truncatedHint\}/); assert.match(block, /c\.continue\}/)
})
