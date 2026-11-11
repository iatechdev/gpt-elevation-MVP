// (Las pruebas de los resultados de invitar / restablecer pasaron a es-186-pantalla-d.test.mjs, que usa las mismas fixtures del servidor real.)
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

test('ES-186 parche: la pantalla usa invitaciones y reset-link, sin campos de contraseña ni guardar enlaces', () => {
  const text = ['AdminUsers', 'AdminUsersInvite', 'AdminUsersManage', 'AdminUsersApi', 'adminUsersLogic'].map((n) => readFileSync(resolve(src, `pages/admin/${n === 'AdminUsersApi' ? 'adminUsersApi.ts' : n === 'adminUsersLogic' ? 'adminUsersLogic.ts' : n + '.tsx'}`), 'utf8')).join('\n')
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
  const tsx = readFileSync(resolve(src, 'pages/admin/AdminUsersInvite.tsx'), 'utf8')
  assert.match(tsx, /role=\{msg\.kind === 'error' \? 'alert' : 'status'\}/)
  assert.match(tsx, /<label[^>]*htmlFor="invite-role"/); assert.match(tsx, /<select id="invite-role"/)
  assert.doesNotMatch(tsx, /\.replace\(\/\.\$\/, ''\)/, 'no se recorta el último carácter de la fecha')
})
