// ES-244 (F5c): «Compartir con mi profesional» ya no asume el estado anterior cuando el resultado de un cambio es incierto: relee el estado real, lo muestra y,
// si no puede leerlo, no enseña un interruptor engañoso. El comportamiento real (respuesta perdida en ambos sentidos contra servidor y base reales) lo mide
// scripts/es244-api-integration.cjs. Aquí: estructura y textos.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { therapistEs, therapistEn } from '../src/i18n/therapistCopy.ts'

const card = readFileSync(new URL('../src/components/TherapistSharingCard.tsx', import.meta.url), 'utf8').replace(/\r\n/g, '\n')

test('ES-244: un fallo sin respuesta definitiva (red, tiempo agotado, 5xx) no cuenta como «no se guardó»: se relee el estado real', () => {
  const toggle = card.slice(card.indexOf('const toggle = async'), card.indexOf('const closeDialog'))
  assert.match(toggle, /else if \(res\.status >= 500\) \{\s*uncertain = true/)
  assert.match(toggle, /\} catch \{\s*uncertain = true/)
  assert.match(toggle, /if \(uncertain\) await verify\(next\)/)
  // solo una respuesta definitiva (4xx) muestra «No se pudo guardar»
  const definitive = toggle.slice(toggle.indexOf('} else {\n        const body'))
  assert.match(definitive, /localizeServerError\(body\.error, lang, t\('mt_share_error'\)\)/)
  assert.equal((toggle.match(/mt_share_error/g) || []).length, 1, 'el mensaje de error solo sale con respuesta definitiva')
  assert.match(toggle, /AbortSignal\.timeout\(15000\)/)
})

test('ES-244: verify declara éxito solo si lo leído coincide con lo pedido; si no, deja lo leído y «Comprobar»; si no puede leer, no muestra interruptor', () => {
  const verify = card.slice(card.indexOf('const verify = async'), card.indexOf('const toggle = async'))
  assert.match(verify, /if \(real === null\) \{ setUnknown\(true\); setUnsure\(target\); return \}/)
  assert.match(verify, /setStatus\(real\)/)
  assert.match(verify, /if \(\(real === 'granted'\) === \(target === 'granted'\)\) \{ setUnsure\(null\); setMessage\(\{ kind: 'ok'/)
  assert.match(verify, /mt_share_not_seen_on' : 'mt_share_not_seen_off'/)
  assert.match(card, /\{unknown && unsure \? \(\s*<button type="button" onClick=\{\(\) => void verify\(unsure\)\}/) // en lugar del interruptor
  assert.match(card, /unsure === 'granted' \? 'mt_share_unsure_on' : 'mt_share_unsure_off'/)
  // el cambio se pide con el estado deseado (PUT idempotente en el servidor): repetirlo no duplica
  assert.match(card, /JSON\.stringify\(\{ status: next \}\)/)
})

test('ES-244: textos ES/EN; retirar incierto avisa que el profesional puede seguir viendo los datos; sin promesas', () => {
  assert.match(therapistEs.mt_share_unsure_on, /No pudimos confirmar si quedó activado\. Comprueba antes de reintentar\./)
  assert.match(therapistEn.mt_share_unsure_on, /We could not confirm whether it was turned on\. Check before trying again\./)
  for (const text of [therapistEs.mt_share_unsure_off, therapistEs.mt_share_not_seen_off]) assert.match(text, /tu profesional siga viendo tus datos/)
  for (const text of [therapistEn.mt_share_unsure_off, therapistEn.mt_share_not_seen_off]) assert.match(text, /professional may still see your data/)
  assert.equal(therapistEs.mt_share_check, 'Comprobar'); assert.equal(therapistEn.mt_share_check, 'Check')
  assert.deepEqual(Object.keys(therapistEs).sort(), Object.keys(therapistEn).sort())
})
