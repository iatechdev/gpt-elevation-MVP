// ES-326 (E301-4): pantalla pública /accept-invitation con la casilla del aviso de privacidad y los términos (misma que el registro) y envío de acceptedTerms + termsVersion.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { invitationFailure, readInvitationToken } from '../src/access/invitation.ts'
import { fieldErrors, firstInvalid } from '../src/access/fieldErrors.ts'
import { accessEs, accessEn } from '../src/access/accessCopy.ts'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')

test('ES-326: el token se lee solo del fragmento y con la forma del servidor (base64url de 43 caracteres)', () => {
  const token = 'A'.repeat(43)
  assert.equal(readInvitationToken(`#token=${token}`), token)
  for (const bad of ['', '#', '#token=', '#token=corto', `#token=${token}%0A`, `#otro=${token}`, `#token=${'A'.repeat(200)}`]) assert.equal(readInvitationToken(bad), null, bad)
})

test('ES-326: cada rechazo del servidor lleva a su mensaje (mismos códigos de aceptación que el registro)', () => {
  assert.equal(invitationFailure(400, 'password_policy'), 'password_policy'); assert.equal(invitationFailure(400, 'invitation_invalid'), 'invitation_invalid')
  for (const code of ['terms_required', 'terms_not_accepted', 'terms_version_invalid']) assert.equal(invitationFailure(400, code), 'terms', code)
  assert.equal(invitationFailure(400, 'terms_version_mismatch'), 'terms_changed'); assert.equal(invitationFailure(429, undefined), 'rate_limited'); assert.equal(invitationFailure(500, undefined), 'failed')
  assert.equal(invitationFailure(400, 'terms_not_available'), 'failed', 'un código desconocido no se interpreta como aceptación')
})

test('ES-326: validación por campo del modo «invite»: nombre, contraseña y casilla; el correo no se pide; el foco va al primero inválido', () => {
  assert.deepEqual(fieldErrors({ name: '', email: '', password: '', terms: false }, 'invite'), { name: 'name', password: 'password', terms: 'terms' })
  assert.deepEqual(fieldErrors({ name: ' Ana ', email: '', password: 'x', terms: false }, 'invite'), { terms: 'terms' })
  assert.deepEqual(fieldErrors({ name: 'Ana', email: '', password: 'x', terms: true }, 'invite'), {})
  assert.equal(firstInvalid(fieldErrors({ name: 'Ana', email: '', password: '', terms: false }, 'invite')), 'password')
  // El registro y el inicio de sesión no cambian.
  assert.deepEqual(fieldErrors({ name: '', email: 'x', password: '', terms: false }, 'register'), { name: 'name', email: 'email', password: 'password', terms: 'terms' })
  assert.deepEqual(fieldErrors({ name: '', email: 'a@b.co', password: 'x' }, 'login'), {})
})

test('ES-326: textos ES y EN completos, sin «consentimiento», y la casilla reutiliza los textos de ES-301', () => {
  const keys = ['access.invite_title', 'access.invite_intro', 'access.invite_submit', 'access.invite_busy', 'access.invite_done_title', 'access.invite_done', 'access.invite_invalid_title', 'access.invite_invalid']
  for (const [lang, copy] of [['es', accessEs], ['en', accessEn]]) {
    for (const key of keys) assert.ok(typeof copy[key] === 'string' && copy[key].length > 3, `${lang}.${key}`)
    assert.doesNotMatch(keys.map(key => copy[key]).join(' '), /consentimiento|consent/i, lang)
  }
  assert.equal(accessEs['access.invite_title'], 'Crea tu cuenta'); assert.equal(accessEn['access.invite_title'], 'Create your account')
  assert.match(accessEs['access.invite_invalid'], /Pídele a quien te invitó/); assert.match(accessEn['access.invite_invalid'], /Ask the person who invited you/)
})

test('ES-326: cableado — la ruta es pública, la pantalla usa TermsCheck y envía la aceptación con la versión vigente, y quita el token de la URL', () => {
  const app = read('../src/App.tsx'), page = read('../src/access/AcceptInvitationPage.tsx')
  assert.match(app, /<Route path="\/accept-invitation" element=\{<AcceptInvitationPage \/>\} \/>/)
  const route = app.slice(app.indexOf('path="/accept-invitation"') - 80, app.indexOf('path="/accept-invitation"') + 80); assert.doesNotMatch(route, /RoleGate|Protected|AdminRoute/, 'pública')
  assert.match(page, /<TermsCheck /); assert.match(page, /acceptedTerms: true, termsVersion: TERMS_VERSION/); assert.match(page, /\/api\/invitations\/accept/)
  assert.match(page, /window\.history\.replaceState\(null, '', window\.location\.pathname\)/)
  assert.match(page, /disabled=\{busy\}/, 'la casilla se deshabilita mientras se envía (igual que el registro)')
  assert.doesNotMatch(page, /localStorage|sessionStorage|document\.cookie/, 'no guarda nada en el navegador')
  assert.doesNotMatch(page, /elevation_token/, 'no inicia sesión: el éxito lleva a /login')
})
