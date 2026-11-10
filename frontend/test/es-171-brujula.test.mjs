// ES-171: Brújula. Un resultado incierto al confirmar conserva la revisión (Comprobar / Reintentar con el MISMO requestId y token),
// el conflicto tiene aviso propio y retirar dice la consecuencia real. Estructura y textos; el comportamiento lo mide scripts/es171-check.cjs en navegador.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { compassEs, compassEn } from '../src/compass/copy.ts'

const page = readFileSync(new URL('../src/compass/CompassPage.tsx', import.meta.url), 'utf8')

test('ES-171: sin respuesta definitiva la revisión se conserva y el éxito automático exige el acuse del servidor', () => {
  assert.match(page, /const doubtful = !acknowledged && !\(failure instanceof CompassError && failure\.status < 500\)/)
  assert.match(page, /if \(!doubtful\) \{ setReview\(null\); setAuthorized\(false\) \}/)
  assert.match(page, /if \(value && acknowledged && applied\(value, acknowledged, mine\)\)/)
  assert.match(page, /if \(doubtful\) \{ setUnsure\(true\); message\('confirm_uncertain', true\) \}/)
})

test('ES-171: Reintentar reenvía la MISMA revisión (requestId y token) y el requestId solo se crea al generar una vista previa', () => {
  assert.match(page, /api\.confirm\(\{ fields: mine\.fields, token: mine\.preview\.token, requestId: mine\.requestId \}\)/)
  assert.equal((page.match(/crypto\.randomUUID\(\)/g) || []).length, 2) // blank() y la vista previa; confirm/check/retry no crean ids
  assert.match(page, /requestId: crypto\.randomUUID\(\), baseVersion: context\?\.active\?\.version \?\? 0/)
  // con el token vencido no hay «Reintentar»: solo «Renovar vista previa»
  assert.match(page, /\{expired \? <button className="elv-btn" onClick=\{\(\) => void preview\(\)\}>\{tr\('renew'\)\}<\/button> : confirmActions\}/)
  assert.match(page, /const confirmActions = unsure \? <><button className="elv-btn" disabled=\{!!busy\} onClick=\{\(\) => void check\(\)\}>\{tr\('check'\)\}<\/button>/)
  // «Comprobar» relee y solo reconoce una versión NUEVA con exactamente los campos de la vista previa (no una anterior idéntica)
  assert.match(page, /value\.active\.version > mine\.baseVersion && pairs\(value\.active\.fields\) === pairs\(mine\.preview\.representation\)/)
})

test('ES-171: conflicto con aviso propio y textos ES/EN de incierto, comprobar y retirar', () => {
  assert.match(page, /error\.code === 'conflict' \? 'conflict'/)
  assert.equal(compassEs['compass.confirm_uncertain'], 'No pudimos verificar la confirmación. Tu selección sigue aquí.')
  assert.equal(compassEn['compass.confirm_uncertain'], 'We could not verify the confirmation. Your selection is still here.')
  assert.equal(compassEs['compass.conflict'], 'Hay una versión más reciente de tu contexto. La recargamos; revisa antes de continuar.')
  assert.equal(compassEn['compass.conflict'], 'There is a newer version of your context. We reloaded it; review it before continuing.')
  assert.equal(compassEs['compass.check'], 'Comprobar'); assert.equal(compassEn['compass.check'], 'Check')
  assert.equal(compassEs['compass.withdraw_help'], 'Tu profesional dejará de ver este contexto. No borra tus textos guardados ni otros permisos, que se gestionan por separado.')
  assert.equal(compassEn['compass.withdraw_help'], 'Your professional will stop seeing this context. It does not delete your saved texts or other permissions, which are managed separately.')
  for (const key of Object.keys(compassEs)) assert.ok(compassEn[key], `falta EN para ${key}`)
  // «no se duplica» solo se afirma donde el servidor es idempotente por requestId; sin promesas de resultado profesional
  for (const text of [compassEs['compass.check_none'], compassEn['compass.check_none']]) assert.ok(!/garantiz|guarantee|empleo|job offer/i.test(text))
})

test('ES-171: la retirada no se reintenta sola (una pérdida de respuesta nunca dispara otro POST)', () => {
  assert.match(page, /try \{ await api\.revoke\(\); acknowledged = true \} catch \{ \/\* A lost response must never trigger another POST automatically\. \*\/ \}/)
})
