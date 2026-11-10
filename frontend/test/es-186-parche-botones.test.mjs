// ES-186 (parche): «Invitar persona» y «Enviar enlace de restablecimiento» usan los endpoints vigentes (nunca los retirados por ES-192) y lo que se dice
// a quien administra sale de la respuesta REAL del servidor (fixtures generados por la prueba con Postgres real del backend, que falla si la forma cambia).
import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync, mkdirSync, rmSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { build } from 'rolldown'

const here = dirname(fileURLToPath(import.meta.url))
const src = resolve(here, '../src')
const fixture = (n) => JSON.parse(readFileSync(resolve(here, 'fixtures', n), 'utf8'))
const out = resolve(here, '.tmp-es186')
let mod
before(async () => {
  mkdirSync(out, { recursive: true })
  await build({ input: resolve(src, 'pages/admin/inviteOutcome.ts'), platform: 'node', output: { format: 'esm', file: resolve(out, 'bundle.mjs') }, logLevel: 'warn' })
  mod = await import(pathToFileURL(resolve(out, 'bundle.mjs')).href)
})
after(() => rmSync(out, { recursive: true, force: true }))

test('ES-186 parche: invitación con correo enviado → dice el correo y cuándo caduca (solo si el servidor lo confirma)', () => {
  const { status, body } = fixture('es-186-invite-sent.json')
  const outcome = mod.inviteOutcome(status, body)
  assert.equal(outcome.kind, 'sent'); assert.equal(outcome.email, body.email); assert.equal(outcome.expiresAt, body.expiresAt)
})

test('ES-186 parche: invitación SIN correo configurado → «registrada, pero no se envió»; nunca promete un correo', () => {
  const { status, body } = fixture('es-186-invite-recorded.json')
  assert.equal(body.emailSent, false)
  const outcome = mod.inviteOutcome(status, body)
  assert.equal(outcome.kind, 'recorded')
  assert.match(outcome.message, /no se envió ningún correo/)
  assert.doesNotMatch(outcome.message, /Invitación enviada/)
  // un servidor que omita `emailSent` tampoco se interpreta como enviado
  assert.equal(mod.inviteOutcome(201, { ...body, emailSent: undefined }).kind, 'recorded')
  assert.equal(mod.inviteOutcome(201, { ...body, emailSent: 'true' }).kind, 'recorded')
})

test('ES-186 parche: errores por código del servidor (correo repetido, inválido, rol, límite) y por estado', () => {
  const taken = fixture('es-186-invite-error.json')
  assert.deepEqual(mod.inviteOutcome(taken.status, taken.body), { kind: 'error', message: 'Ya existe una cuenta con ese correo.' })
  assert.equal(mod.inviteOutcome(400, { code: 'invalid_email' }).message, 'Correo inválido.')
  assert.equal(mod.inviteOutcome(403, { code: 'role_not_allowed' }).message, 'No tienes permiso para invitar con ese rol.')
  assert.equal(mod.inviteOutcome(403, null).message, 'No tienes permiso para invitar con ese rol.')
  assert.equal(mod.inviteOutcome(429, { code: 'rate_limited' }).message, 'Demasiadas invitaciones seguidas. Espera un rato.')
  assert.equal(mod.inviteOutcome(500, {}).message, 'No se pudo crear la invitación.')
})

test('ES-186 parche: enlace de restablecimiento → 202 sin prometer el correo; 403/404/5xx con texto propio', () => {
  const { status, body } = fixture('es-186-reset-link.json')
  assert.equal(status, 202); assert.deepEqual(Object.keys(body), ['message'])
  const ok = mod.resetLinkOutcome(status)
  assert.equal(ok.ok, true); assert.match(ok.message, /Si la cuenta puede recibirlo y el envío de correo está configurado/)
  assert.equal(mod.resetLinkOutcome(403).ok, false); assert.match(mod.resetLinkOutcome(403).message, /superadministración/)
  assert.equal(mod.resetLinkOutcome(404).message, 'Usuario no encontrado.')
  // E186-4: el 403 a OTRO superadmin (forma real del servidor) no dice que quien pide no sea superadmin
  const other = fixture('es-186-reset-link-superadmin-403.json')
  const m = mod.resetLinkOutcome(other.status, other.body).message
  assert.match(m, /otro superadmin/); assert.doesNotMatch(m, /^Solo la superadministración/)
  assert.equal(mod.resetLinkOutcome(500).message, 'No se pudo enviar el enlace.')
})

function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    return statSync(full).isDirectory() ? files(full) : /\.(tsx?|jsx?)$/.test(name) ? [full] : []
  })
}

test('ES-186 parche: ninguna pantalla llama a los endpoints retirados por ES-192 (POST /api/admin/usuarios, PUT …/reset-password)', () => {
  for (const file of files(src)) {
    const text = readFileSync(file, 'utf8')
    assert.doesNotMatch(text, /api\/admin\/usuarios\/\$\{[^}]+\}\/reset-password/, `${file}: llama a reset-password (410)`)
    assert.doesNotMatch(text, /fetch\(`\$\{API\}\/api\/admin\/usuarios`,\s*\{\s*method:\s*'POST'/, `${file}: crea cuentas con contraseña (410)`)
  }
})

test('ES-186 parche: AdminUsers usa invitaciones y reset-link, sin campos de contraseña ni guardar enlaces', () => {
  const text = readFileSync(resolve(src, 'pages/admin/AdminUsers.tsx'), 'utf8')
  assert.match(text, /api\/admin\/invitations/); assert.match(text, /reset-link/)
  assert.doesNotMatch(text, /type="password"|type:\s*'password'/)
  assert.doesNotMatch(text, /localStorage\.setItem|sessionStorage\.setItem|console\.log/)
  assert.doesNotMatch(text, /[\u{1F300}-\u{1FAFF}]/u.source ? /🔑/ : /x^/, 'sin el emoji del botón anterior')
})

// E186-1: la fecha de caducidad no se recorta (antes `.replace(/.$/, '')` borraba «m.» / «M»).
test('ES-186 parche: la fecha de caducidad se muestra completa en ES y EN', () => {
  const iso = '2026-11-13T12:16:00.000Z'
  for (const lang of ['es', 'en']) {
    const shown = mod.formatExpiry(iso, lang)
    assert.equal(shown, new Date(iso).toLocaleString(lang === 'en' ? 'en-US' : 'es-CO', { dateStyle: 'medium', timeStyle: 'short' }))
    assert.match(shown, lang === 'en' ? /\d{4}.*\d:\d\d\s?(AM|PM)$/ : /\d{4}.*\d:\d\d\s?[ap]\. ?m\.$/i, shown)
  }
})

// E186-2 y E186-3: mensajes del diálogo de invitar en regiones vivas y el select «Rol» con nombre accesible.
test('ES-186 parche: el diálogo de invitar anuncia errores y éxito y nombra el selector de rol', () => {
  const tsx = readFileSync(resolve(src, 'pages/admin/AdminUsers.tsx'), 'utf8')
  assert.match(tsx, /\{errorModal && <div role="alert"/); assert.match(tsx, /\{exitoModal && <div role="status"/)
  assert.match(tsx, /<label htmlFor="invite-role"/); assert.match(tsx, /<select id="invite-role"/)
  assert.doesNotMatch(tsx, /\.replace\(\/\.\$\/, ''\)/, 'no se recorta el último carácter de la fecha')
})
