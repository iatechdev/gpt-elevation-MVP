// ES-379 · «Enviar enlace de restablecimiento»: la pantalla dice lo que el servidor confirma (emailSent), con inglés, y conserva el texto vago si falta el campo.
// Las fixtures son la respuesta REAL del servidor (las genera backend/test/integration/es-379-postgres.cjs con ES379_WRITE_FIXTURE=1 y falla si la forma cambia).
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as logic from '../src/pages/admin/adminUsersLogic.ts'
import { adminText } from '../src/i18n/adminCopy.ts'

const here = dirname(fileURLToPath(import.meta.url))
const fixture = (name) => JSON.parse(readFileSync(resolve(here, 'fixtures', name), 'utf8'))
const VAGUE = 'Solicitud registrada. Si la cuenta puede recibirlo y el envío de correo está configurado, la persona recibirá el enlace.'

test('ES-379: con emailSent:true se dice que se envió y cuándo vence (fixture REAL del servidor)', () => {
  const sent = fixture('es-379-reset-link-sent.json')
  assert.equal(sent.status, 202); assert.equal(sent.body.emailSent, true)
  const result = logic.resetLinkResult(sent.status, sent.body)
  assert.equal(result.ok, true)
  assert.equal(result.message, `Enlace enviado al correo de la cuenta. Vence en ${sent.body.expiresInMinutes} minutos.`)
  assert.equal(adminText(result.message, 'en'), `Link sent to the account's email. It expires in ${sent.body.expiresInMinutes} minutes.`)
})

test('ES-379: con emailSent:false NO se dice que se envió: es un error con inglés (fixture REAL del servidor)', () => {
  const notSent = fixture('es-379-reset-link-not-sent.json')
  assert.equal(notSent.status, 202); assert.equal(notSent.body.emailSent, false)
  const result = logic.resetLinkResult(notSent.status, notSent.body)
  assert.equal(result.ok, false)
  assert.equal(result.message, 'No se pudo enviar el correo (el envío no está configurado o falló). El enlace no se creó para nadie; pide a quien opera el servidor que lo emita.')
  assert.equal(adminText(result.message, 'en'), 'The email could not be sent (sending is not configured or failed). Contact whoever operates the server to issue a link.')
  assert.ok(!/se envió|recibirá/.test(result.message))
})

test('ES-379: sin emailSent (servidor anterior o respuesta en caché) se conserva el texto vago de respaldo', () => {
  for (const body of [{}, null, { message: 'x' }, { emailSent: 'true' }, { emailSent: null }, { emailSent: 1 }]) {
    const result = logic.resetLinkResult(202, body)
    assert.deepEqual(result, { ok: true, message: VAGUE }, JSON.stringify(body))
  }
  assert.equal(adminText(VAGUE, 'en') === VAGUE, false, 'el respaldo también tiene inglés')
})

test('ES-379: emailSent:true con minutos ausentes o absurdos no inventa una vigencia: cae al texto vago', () => {
  for (const expiresInMinutes of [undefined, null, 0, -5, 1.5, '30', 99999, NaN]) {
    const result = logic.resetLinkResult(202, { emailSent: true, expiresInMinutes })
    assert.equal(result.message, VAGUE, String(expiresInMinutes))
  }
})

test('ES-379: los errores HTTP no cambian (403, 404, 500) y emailSent no los disfraza de éxito', () => {
  assert.equal(logic.resetLinkResult(403, { code: 'superadmin_only' }).ok, false)
  assert.equal(logic.resetLinkResult(404, {}).message, 'No se encontró.')
  assert.equal(logic.resetLinkResult(500, { emailSent: true, expiresInMinutes: 30 }).ok, false)
  assert.equal(logic.resetLinkResult(200, { emailSent: true, expiresInMinutes: 30 }).message, logic.errorMessage(200, { emailSent: true, expiresInMinutes: 30 }))
})

test('ES-379: el texto de «no enviado» está en MSG (lo cubre la prueba de inglés de toda la pantalla) y el de «enviado» tiene su patrón en inglés', () => {
  assert.equal(adminText(logic.MSG.resetNotSent, 'en') === logic.MSG.resetNotSent, false)
  for (const minutes of [1, 15, 30, 60, 1440]) assert.match(adminText(logic.resetSentText(minutes), 'en'), new RegExp(`^Link sent to the account's email\\. It expires in ${minutes} minutes\\.$`))
})

test('ES-379: la pantalla muestra el aviso en la región viva con role=alert para error y role=status para éxito, y solo recarga la lista si salió', () => {
  const source = readFileSync(resolve(here, '..', 'src', 'pages', 'admin', 'AdminUsersManage.tsx'), 'utf8')
  assert.match(source, /role=\{msg\.kind === 'error' \? 'alert' : 'status'\}/)
  assert.match(source, /setMsg\(\{ kind: outcome\.ok \? 'ok' : 'error', text: outcome\.message \}\)/)
  assert.match(source, /if \(outcome\.ok\) onChanged\(\)/)
})
