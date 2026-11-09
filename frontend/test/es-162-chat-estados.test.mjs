// ES-162: etiqueta de quién habla, anuncio de la respuesta nueva, copiar el mensaje sin confirmar, respuesta lenta con «Dejar de esperar», aviso sin conexión y «Enter envía».
// Reglas puras + estructura del código; el comportamiento en navegador (reloj simulado, portapapeles rechazado, lector, teclado) lo mide scripts/es162-check.cjs.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { enterShouldSend, isNetworkFailure, readEnterSends, SLOW_AFTER_MS, writeEnterSends } from '../src/space/chatKeys.ts'
import { noticeForError, noticeText } from '../src/space/notices.ts'
import { SpaceError } from '../src/space/api.ts'
import { copy } from '../src/space/copy.ts'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const memory = () => { const data = new Map(); return { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, v), removeItem: k => data.delete(k), data } }

test('ES-162: Enter envía solo con la preferencia activada, sin Shift/Ctrl/Alt/Meta y nunca durante la composición de un IME', () => {
  assert.equal(enterShouldSend({ key: 'Enter' }, false), false) // desactivado por defecto: Enter = línea nueva
  assert.equal(enterShouldSend({ key: 'Enter' }, true), true)
  assert.equal(enterShouldSend({ key: 'Enter', shiftKey: true }, true), false) // Shift+Enter = línea nueva
  for (const mod of ['ctrlKey', 'altKey', 'metaKey']) assert.equal(enterShouldSend({ key: 'Enter', [mod]: true }, true), false, mod)
  assert.equal(enterShouldSend({ key: 'Enter', isComposing: true }, true), false) // IME: Enter confirma el texto compuesto
  assert.equal(enterShouldSend({ key: 'Enter', keyCode: 229 }, true), false) // navegadores que no marcan isComposing en keydown
  for (const key of ['a', 'Tab', 'Escape', ' ']) assert.equal(enterShouldSend({ key }, true), false, key)
})

test('ES-162: la preferencia «Enter envía» parte desactivada, se recuerda y no rompe si el almacenamiento falla', () => {
  const store = memory()
  assert.equal(readEnterSends(store), false)
  writeEnterSends(true, store); assert.equal(readEnterSends(store), true)
  writeEnterSends(false, store); assert.equal(readEnterSends(store), false); assert.equal(store.data.size, 0)
  const broken = { getItem() { throw new Error('bloqueado') }, setItem() { throw new Error('bloqueado') }, removeItem() { throw new Error('bloqueado') } }
  assert.equal(readEnterSends(broken), false); assert.doesNotThrow(() => writeEnterSends(true, broken))
})

test('ES-162: sin respuesta del servidor (TypeError de fetch) es «sin conexión»; la cancelación de la persona y los demás fallos no lo son', () => {
  assert.equal(isNetworkFailure(new TypeError('Failed to fetch')), true)
  assert.equal(isNetworkFailure(new DOMException('abort', 'AbortError')), false)
  assert.equal(isNetworkFailure(new SpaceError(500)), false); assert.equal(isNetworkFailure(new Error('otro')), false)
  assert.deepEqual(noticeForError(new TypeError('Failed to fetch')), { k: 'offline' })
  assert.deepEqual(noticeForError(new Error('otro')), { k: 'sendError' })
  assert.deepEqual(noticeForError(new SpaceError(500)), { k: 'sendError' })
  assert.deepEqual(noticeForError(new SpaceError(409, 'turn_in_progress')), { k: 'pending' })
  assert.equal(noticeForError(new SpaceError(429, 'ai_budget_exhausted', false, 'person', '2026-12-01T00:00:00Z')).k, 'budget') // el límite de uso no cambia
})

test('ES-162: textos ES/EN completos, con la demora sin prometer cancelar al servidor y sin promesas de plazo ni de resultado', () => {
  const keys = ['you', 'copy', 'copied', 'copyFailed', 'slow', 'stopWaiting', 'stopped', 'offline', 'enterSends']
  for (const lang of ['es', 'en']) for (const key of keys) assert.ok(copy[lang][key]?.trim(), `${lang}.${key}`)
  assert.equal(copy.es.you, 'Tú'); assert.equal(copy.en.you, 'You')
  for (const lang of ['es', 'en']) {
    const all = keys.map(key => copy[lang][key]).join(' ')
    assert.ok(!/cancel(a|amos|ar|ed|s)\b.*(servidor|server)|(servidor|server).*cancel/i.test(all), 'no promete cancelar al servidor')
    assert.ok(!/\d+\s*(s|segundos|seconds|minutos|minutes|horas|hours)\b|garant|guarantee|siempre|always|nunca|never/i.test(all), lang)
  }
  assert.match(copy.es.slow, /dejar de esperar/); assert.match(copy.en.slow, /stop waiting/)
  assert.match(copy.es.slow, /Consultar estado/); assert.match(copy.en.slow, /Check status/) // apunta al botón que existe
  assert.match(copy.es.stopped, /sigue aquí/); assert.match(copy.en.stopped, /still here/)
  // los avisos se traducen al pintar (cambiar de idioma cambia el texto)
  assert.equal(noticeText({ k: 'offline' }, 'es'), copy.es.offline); assert.equal(noticeText({ k: 'stopped' }, 'en'), copy.en.stopped)
})

test('ES-162: la demora es de 15 s (aprobado) y «Dejar de esperar» corta la espera del navegador con AbortController, no al servidor', () => {
  assert.equal(SLOW_AFTER_MS, 15000)
  const hook = read('../src/space/usePersonalChat.ts')
  assert.match(hook, /new AbortController\(\)/); assert.match(hook, /signal: controller\.signal/)
  assert.match(hook, /const stop = \(\) => \{ if \(abortRef\.current\) \{ stoppedRef\.current = true; abortRef\.current\.abort\(\) \} \}/)
  // solo una cancelación PEDIDA por la persona se trata como «dejaste de esperar»; el envío queda sin confirmar (la intención no se borra)
  assert.match(hook, /stoppedRef\.current && error instanceof DOMException && error\.name === 'AbortError'\) \{ setRetryable\(false\); setNotice\(\{ k: 'stopped' \}\); return \}/)
  assert.match(hook, /window\.setTimeout\(\(\) => setSlow\(true\), SLOW_AFTER_MS\)/)
  // un fallo de red conserva el mismo requestId y ofrece «Reintentar»
  assert.match(hook, /setRetryable\(\(error instanceof SpaceError && error\.retryable\) \|\| isNetworkFailure\(error\)\)/)
})

test('ES-162: la respuesta nueva se anuncia solo tras un envío (nunca al cargar el historial) y es la única región aria-live añadida', () => {
  const hook = read('../src/space/usePersonalChat.ts')
  const confirm = hook.slice(hook.indexOf('const confirm = async'), hook.indexOf('const post = async'))
  assert.match(confirm, /if \(sent && last\?\.role === 'bot'\) \{ setAnnouncement\(last\.text\)/)
  assert.equal((hook.match(/setAnnouncement\(/g) || []).length, 1) // el efecto de carga/idioma nunca lo toca
  const controls = read('../src/space/ChatControls.tsx')
  assert.equal((controls.match(/aria-live="polite" aria-atomic="true"/g) || []).length, 1)
  assert.match(controls, /<span key=\{chat\.announceKey\}>\{chat\.announcement\}<\/span>/)
})

test('ES-162: «Copiar» usa el portapapeles dentro del clic y, si falla, selecciona el texto y pide copiarlo a mano', () => {
  const controls = read('../src/space/ChatControls.tsx')
  assert.match(controls, /await navigator\.clipboard\.writeText\(message\); setState\('ok'\)/)
  assert.match(controls, /catch \{ if \(target\.current\) window\.getSelection\(\)\?\.selectAllChildren\(target\.current\); setState\('fail'\) \}/)
  assert.match(controls, /<CopyPending key=\{chat\.intent\.requestId\}/) // el estado «Copiado» no sobrevive a otro envío
})

test('ES-162: etiqueta «Tú» en los turnos de la persona y casilla «Enter envía» desactivada por defecto con IME respetado', () => {
  const page = read('../src/pages/ChatPage.tsx')
  assert.ok(page.indexOf('{copy[lang].you}') > 0 && page.indexOf('{copy[lang].you}') < page.indexOf('{msg.text}'), 'la etiqueta va antes del texto de la persona')
  const controls = read('../src/space/ChatControls.tsx')
  assert.match(controls, /useState\(readEnterSends\)/)
  assert.match(controls, /enterShouldSend\(\{ key: event\.key, shiftKey: event\.shiftKey, ctrlKey: event\.ctrlKey, altKey: event\.altKey, metaKey: event\.metaKey, isComposing: event\.nativeEvent\.isComposing, keyCode: event\.nativeEvent\.keyCode \}, enterSends\)/)
  assert.match(controls, /event\.preventDefault\(\); if \(canSend\) void chat\.send\(\)/) // con Enter no se envía un mensaje vacío ni con el envío bloqueado
  assert.match(controls, /<input className="elv-checkbox" type="checkbox" checked=\{enterSends\}/)
})
