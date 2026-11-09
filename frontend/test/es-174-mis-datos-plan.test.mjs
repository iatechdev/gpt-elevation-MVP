// ES-174: «Mis datos» (palabra de confirmación, diálogo, estados) y «Mi plan» (plan actual, solicitud pendiente, cambio). Sin DOM: lógica pura + contratos del código;
// el comportamiento en navegador (diálogo, teclado, 390/1360 px, ES/EN, axe) lo verifica scripts/es174-check.cjs.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { SpaceError } from '../src/space/api.ts'
import { dataCopy } from '../src/space/dataCopy.ts'
import { planCopy } from '../src/space/planCopy.ts'
import { confirmMatches } from '../src/space/dataRights.ts'
import { parseCurrent } from '../src/space/currentPlan.ts'
import { zoneForPath } from '../src/shell/access.ts'
import { PERSON_MENU } from '../src/shell/nav.ts'

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8')

test('ES-174: la confirmación acepta la palabra sin distinguir mayúsculas, tildes ni espacios, y rechaza lo demás', () => {
  for (const input of ['ELIMINAR', 'eliminar', '  Eliminar  ', 'elimínar', 'ELIMINAR\n']) assert.equal(confirmMatches(input, 'ELIMINAR'), true, JSON.stringify(input))
  for (const input of ['DELETE', 'eliminar mi cuenta', 'ELIMINA', '', '   ', 'ELIMINARR', 'E L I M I N A R']) assert.equal(confirmMatches(input, 'ELIMINAR'), false, JSON.stringify(input))
  for (const input of ['DELETE', 'delete', ' Delete ']) assert.equal(confirmMatches(input, 'DELETE'), true, input)
  assert.equal(confirmMatches('ELIMINAR', 'DELETE'), false) // la palabra del otro idioma no sirve
  assert.equal(confirmMatches('ELIMINAR', ''), false)
})

test('ES-174: los textos de Mis datos tienen la palabra de cada idioma, las 4 consecuencias y ningún plazo inventado', () => {
  assert.equal(dataCopy.es.confirmWord, 'ELIMINAR'); assert.equal(dataCopy.en.confirmWord, 'DELETE')
  for (const lang of ['es', 'en']) {
    assert.equal(dataCopy[lang].consequences.length, 4); assert.match(dataCopy[lang].typeLabel, /\{word\}/)
    const all = [dataCopy[lang].deleteDone, dataCopy[lang].deleteBody, ...dataCopy[lang].consequences].join(' ')
    assert.doesNotMatch(all, /\b\d+\s*(días|dias|days|horas|hours|semanas|weeks)\b/i, lang)
  }
  assert.match(dataCopy.es.consequences.join(' '), /Todavía no podemos indicarte una fecha/); assert.match(dataCopy.en.consequences.join(' '), /cannot give you a date/)
  assert.match(dataCopy.es.deleteDone, /queda en proceso de eliminación/); assert.match(dataCopy.en.deleteDone, /is being deleted/)
  assert.doesNotMatch(dataCopy.en.consequences.join(' ') + dataCopy.en.deleteBody, /Cerramos|cuenta|datos/i)
})

test('ES-174: Mis datos conserva lo escrito si falla, trata la solicitud repetida como éxito y muestra el estado caducado', () => {
  const page = read('../src/space/DataPage.tsx')
  // Solo el caso «función apagada» limpia la palabra; cualquier otro error deja el diálogo abierto y el texto intacto.
  assert.match(page, /if \(k === 'unavailable'\) \{ setOff\(true\); setOpen\(false\); setWord\(''\) \}/)
  assert.equal((page.match(/setWord\(''\)/g) ?? []).length, 2) // unavailable y cerrar/cancelar
  assert.match(page, /catch \(error\) \{ fail\(error, 'delete'\) \}/)
  assert.match(page, /failed === 'delete' \? c\.retry/)
  assert.match(page, /const closeDialog = \(\) => \{ if \(busy === 'delete'\) return/) // no se cierra mientras envía
  assert.match(page, /setExpired\(true\)/); assert.match(page, /c\.expiredNote/); assert.match(page, /c\.prepareAgain/)
  // La sesión local se cierra al salir de la confirmación (desmontaje), no al instante: si no, la compuerta lleva a /login y la persona no ve el resultado.
  assert.match(page, /useEffect\(\(\) => \(\) => \{ if \(deletedToken\.current\) invalidateStoredSession\(deletedToken\.current\) \}, \[\]\)/)
  assert.doesNotMatch(page, /invalidateStoredSession\(token\)/)
  assert.doesNotMatch(page, /localStorage\.setItem|sessionStorage|console\./)
  const dialog = read('../src/space/SpaceDialog.tsx')
  assert.match(dialog, /showModal\(\)/); assert.match(dialog, /aria-labelledby=\{titleId\}/); assert.match(dialog, /event\.key !== 'Tab'/)
})

test('ES-174: el plan propio se lee con forma estricta y nunca se inventa uno', () => {
  assert.equal(parseCurrent({ plan: null, limits: {} }), null)
  assert.deepEqual(parseCurrent({ plan: { id: 3, name_es: 'Base', name_en: 'Basic', price: '0.00', otro: 1 } }), { id: 3, name_es: 'Base', name_en: 'Basic' })
  for (const bad of [null, {}, [], { plan: 'x' }, { plan: {} }, { plan: { id: 0, name_es: 'a', name_en: 'b' } }, { plan: { id: 1.5, name_es: 'a', name_en: 'b' } },
    { plan: { id: 1, name_es: '', name_en: 'b' } }, { plan: { id: 1, name_es: 'a' } }, { plan: { id: '1', name_es: 'a', name_en: 'b' } }]) {
    assert.throws(() => parseCurrent(bad), (error) => error instanceof SpaceError && error.status === 502, JSON.stringify(bad))
  }
})

test('ES-174: los textos de Mi plan existen en ES y EN, sin pago en línea ni cancelación prometidos', () => {
  assert.deepEqual(Object.keys(planCopy.es).sort(), Object.keys(planCopy.en).sort())
  for (const lang of ['es', 'en']) for (const [key, text] of Object.entries(planCopy[lang])) assert.ok(text.trim(), `${lang}.${key}`)
  assert.match(planCopy.es.pendingBody, /\{plan\}/); assert.match(planCopy.en.pendingBody, /\{plan\}/)
  assert.match(planCopy.es.pendingBody, /no se puede cancelar/); assert.match(planCopy.en.pendingBody, /cannot be cancelled/)
  assert.match(planCopy.es.approval, /no hay pago en línea/); assert.match(planCopy.en.approval, /no online payment/)
  assert.doesNotMatch(planCopy.en.pendingBody + planCopy.en.approval + planCopy.en.noPlan + planCopy.en.unknown, /solicitud|Aún|tienes/i)
})

test('ES-174: Mi plan solo lee el plan y pide cambios por los endpoints existentes; no ofrece cancelar', () => {
  const page = read('../src/space/PlanPage.tsx')
  assert.match(page, /\/api\/user\/plan\/me/); assert.match(page, /usePlanRequests\(base, !!token, token\)/); assert.match(page, /usePlans\(base\)/)
  assert.doesNotMatch(page, /method: 'DELETE'|method: 'PUT'|localStorage.setItem|console./)
  assert.doesNotMatch(page, /<button[^>]*>\s*\{c\.cancel/)
  // El botón de cada plan se inactiva si es el actual, hay solicitud pendiente o se está enviando; el motivo queda enlazado con aria-describedby.
  assert.match(page, /const off = isCurrent \|\| blocked/); assert.match(page, /aria-describedby=\{why \? `plan-why-\$\{plan\.id\}` : undefined\}/)
  assert.match(page, /const blocked = !requests\.ready \|\| !!requests\.pending \|\| requests\.state === 'sending'/)
})

test('ES-174: /app/plan es de cualquier sesión válida, está en la ruta y el menú lleva a la pantalla propia', () => {
  assert.equal(zoneForPath('/app/plan'), 'member'); assert.equal(zoneForPath('/app/data'), 'member'); assert.equal(zoneForPath('/app/plan/x'), 'member')
  assert.ok(PERSON_MENU.some((item) => item.to === '/app/plan' && item.label === 'plan'))
  assert.equal(PERSON_MENU.some((item) => item.to === '/pricing'), false)
  assert.match(read('../src/App.tsx'), /path="\/app\/plan" element=\{<PlanPage \/>\}/); assert.match(read('../src/App.tsx'), /const PlanPage = lazy\(/)
  assert.match(read('../src/space/SpaceNav.tsx'), /to="\/app\/plan"/)
})
