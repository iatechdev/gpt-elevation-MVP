// ES-359 (PR6): con una sesión abierta, «Crear cuenta» no redirige en silencio ni deja crear otra cuenta encima: muestra el aviso aprobado con «Seguir con mi sesión» y
// «Cerrar sesión para crear una cuenta nueva», y oculta el formulario. «Entrar» con sesión abierta sigue llevando a la sesión (sin texto nuevo no aprobado).
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { accessEs, accessEn } from '../src/access/accessCopy.ts'
import { withName } from '../src/access/sessionNotice.ts'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const page = read('../src/pages/LoginPage.tsx')
const css = read('../src/access/accessCartografia.css')
const KEYS = ['access.session_open', 'access.session_open_noname', 'access.session_continue', 'access.session_signout_new', 'access.session_form_hidden']

test('ES-359 PR6: los textos aprobados existen en ES y EN con las mismas claves y el marcador {name}', () => {
  for (const key of KEYS) { assert.ok(accessEs[key] && accessEn[key], key); assert.notEqual(accessEs[key], accessEn[key], `${key}: ES ≠ EN`) }
  assert.equal(accessEs['access.session_open'], 'Ya tienes una sesión abierta como {name}.')
  assert.equal(accessEn['access.session_open'], 'You already have a session open as {name}.')
  assert.equal(accessEs['access.session_continue'], 'Seguir con mi sesión'); assert.equal(accessEn['access.session_continue'], 'Continue with my session')
  assert.equal(accessEs['access.session_signout_new'], 'Cerrar sesión para crear una cuenta nueva'); assert.equal(accessEn['access.session_signout_new'], 'Sign out to create a new account')
  assert.equal(accessEs['access.session_form_hidden'], 'El formulario de registro queda oculto mientras haya una sesión abierta.')
  assert.equal(accessEn['access.session_form_hidden'], 'The sign-up form stays hidden while a session is open.')
  assert.ok(!accessEs['access.session_open_noname'].includes('{name}') && !accessEn['access.session_open_noname'].includes('{name}'), 'la forma corta no deja el marcador sin sustituir')
})

test('ES-359 PR6: «Crear cuenta» con sesión verificada muestra el aviso (no redirige) y «Entrar» sigue redirigiendo', () => {
  assert.match(page, /if \(entry\.result\.status === 'verified'\) \{/)
  assert.match(page, /if \(!isRegistering\) return <Navigate to=\{destination\} replace \/>/)
  // el aviso: nombre, seguir (al mismo destino que antes), cerrar sesión y nota del formulario oculto; sin el formulario dentro del aviso
  const block = page.slice(page.indexOf("const shownName = readName()"), page.indexOf('// ES-128'))
  assert.match(block, /withName\(t\('access\.session_open'\), shownName\)/) // el nombre entra como texto literal (función de reemplazo), no con una cadena de reemplazo
  assert.match(block, /<Link className="ac-ghost" to=\{destination\}>\{t\('access\.session_continue'\)\}<\/Link>/)
  assert.match(block, /signOut\(BACKEND\)/); assert.match(block, /access\.session_signout_new/); assert.match(block, /access\.session_form_hidden/)
  assert.ok(!/<form\b|AccessField/.test(block), 'el formulario de registro NO se dibuja con una sesión abierta')
})

test('ES-359 PR6: tras cerrar sesión el formulario reaparece y el foco va a su primer campo; el nombre solo se muestra, nunca se envía', () => {
  assert.match(page, /useEffect\(\(\) => \{ if \(signedOutHere && !verified && entry\.result\.status !== 'checking'\) nameInput\.current\?\.focus\(\) \}/)
  assert.match(page, /readName = \(\) => \{ try \{ return \(localStorage\.getItem\('elevation_name'\)/)
  const submit = page.slice(page.indexOf('const body = isRegistering'), page.indexOf('try {', page.indexOf('const body = isRegistering')))
  assert.ok(!/elevation_name|readName/.test(submit), 'el nombre guardado no entra en el cuerpo del registro')
})

test('ES-359 PR6: estilos solo con tokens --cg-*, sin colores fijos, y la acción secundaria tiene foco visible', () => {
  const added = css.slice(css.indexOf('ES-359 (PR6)'))
  assert.ok(added.includes('.ac-ghost') && added.includes('.ac-actions'))
  assert.ok(!/#[0-9a-fA-F]{3,8}\b|rgb\(|hsl\(/.test(added), 'sin colores fijos')
  assert.match(added, /\.ac-ghost:focus-visible \{ outline: var\(--cg-focus\) solid var\(--cg-mark\)/)
})

test('ES-359 PR6 (revisión de pares): el nombre se pone como TEXTO LITERAL, sin interpretar patrones especiales de reemplazo (dólar-ampersand, dólar-1, dólar-dólar…)', () => {
  for (const lang of [accessEs, accessEn]) for (const name of ['$&', '$1', '$$', "$'", '$`', 'Marta $& Pérez', '$<name>', '{name}']) {
    const text = withName(lang['access.session_open'], name)
    assert.ok(text.includes(name), `contiene el nombre literal: ${name}`)
    assert.equal(text.split(name).length, 2, `el nombre aparece UNA vez: ${name}`)
    assert.equal(text, lang['access.session_open'].replace('{name}', () => name))
  }
  assert.equal(withName('Hola {name}.', '$&'), 'Hola $&.') // con una cadena de reemplazo daría «Hola {name}.»
  assert.equal(withName('Hola {name}.', 'Ana'), 'Hola Ana.')
})
