// ES-155 (tramo B): entrar, crear cuenta y recuperar acceso con Cartografía. Validación por campo y orden del foco (lógica pura) + estructura (sin estilos en línea ni emojis,
// sin casilla ni la palabra «consentimiento» hasta ES-301, el contrato con el servidor no cambia, claves ES/EN completas). El comportamiento y axe los mide scripts/es155-check.cjs.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fieldErrors, firstInvalid } from '../src/access/fieldErrors.ts'
import { accessEn, accessEs } from '../src/access/accessCopy.ts'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const empty = { name: '', email: '', password: '' }

test('ES-155: cada campo con problema se nombra y el foco va al primero en el orden en que se ven (nombre, correo, contraseña)', () => {
  assert.deepEqual(fieldErrors(empty, 'register'), { name: 'name', email: 'email', password: 'password' })
  assert.equal(firstInvalid(fieldErrors(empty, 'register')), 'name')
  assert.equal(firstInvalid(fieldErrors({ ...empty, name: 'Ana' }, 'register')), 'email')
  assert.equal(firstInvalid(fieldErrors({ name: 'Ana', email: 'a@b.co', password: '' }, 'register')), 'password')
  assert.equal(firstInvalid(fieldErrors({ name: 'Ana', email: 'a@b.co', password: 'x' }, 'register')), null)
  assert.equal(firstInvalid(fieldErrors(empty, 'login')), 'email', 'entrar no pide nombre')
  assert.deepEqual(fieldErrors({ ...empty, email: 'a@b.co' }, 'login'), { password: 'password' })
  assert.deepEqual(fieldErrors(empty, 'forgot'), { email: 'email' }, 'recuperar solo pide el correo')
})

test('ES-155: el correo se valida con una forma simple y los espacios alrededor no cuentan; el servidor sigue siendo la autoridad', () => {
  for (const bad of ['', 'a', 'a@', '@b.co', 'a@b', 'a b@c.co', 'a@b c.co']) assert.equal(fieldErrors({ ...empty, email: bad, password: 'x' }, 'login').email, 'email', JSON.stringify(bad))
  for (const good of ['a@b.co', ' a@b.co ', 'nombre.apellido+tag@dominio.com.co']) assert.equal(fieldErrors({ ...empty, email: good, password: 'x' }, 'login').email, undefined, good)
})

test('ES-155: sin estilos en línea, sin emojis, sin ternarios de idioma y sin la casilla ni la palabra «consentimiento» (llega con ES-301)', () => {
  for (const file of ['../src/pages/LoginPage.tsx', '../src/access/PasswordResetPages.tsx', '../src/access/AccessCard.tsx', '../src/access/accessCopy.ts']) {
    const src = read(file)
    assert.ok(!src.includes('style={{') && !src.includes('React.CSSProperties'), `${file} sin estilos en línea`)
    assert.ok(!/\p{Extended_Pictographic}/u.test(src), `${file} sin emojis`)
    assert.ok(!/lang === 'es' \?/.test(src), `${file} sin textos decididos por idioma`)
    assert.ok(!/type="checkbox"/.test(src), `${file} sin casilla hasta ES-301`)
  }
  for (const text of [...Object.values(accessEs), ...Object.values(accessEn)]) assert.ok(!/consentimiento|consent\b|consent[^a-z]/i.test(text), text)
  assert.deepEqual(Object.keys(accessEs).sort(), Object.keys(accessEn).sort())
})

test('ES-155: el contrato con el servidor no cambia (rutas, cuerpos y requisitos de contraseña de ES-128) y el rechazo lleva el foco al aviso', () => {
  const page = read('../src/pages/LoginPage.tsx')
  assert.ok(page.includes('{ name, email, password }') && page.includes('{ email, password }') && page.includes('`${BACKEND}/api/${endpoint}`'))
  assert.ok(page.includes('passwordProblems(password)') && page.includes('<PasswordRequirements id="pw-req"'))
  assert.ok(page.includes('authFailureKey(res.status, data, isRegistering)'), 'el mismo aviso para cada fallo: no revela si la cuenta existe')
  assert.ok(page.includes('messageRef.current?.focus()') && page.includes('firstInvalid(found)'))
  const reset = read('../src/access/PasswordResetPages.tsx')
  assert.ok(reset.includes('/api/password-reset/request') && reset.includes('/api/password-reset/confirm') && reset.includes('res.status === 202'))
  assert.equal((reset.match(/emailInput\.current\?\.focus\(\)/g) ?? []).length, 3, 'el foco vuelve al correo en correo inválido, rechazo y error de red')
})

test('ES-155: las pantallas usan el marco público de Cartografía (un solo main) y no la hoja del tema anterior', () => {
  const card = read('../src/access/AccessCard.tsx')
  assert.ok(card.includes('<PublicFrame migrated>') && !/<main[ >]/.test(card))
  assert.ok(!read('../src/pages/LoginPage.tsx').includes('accessAdmin.css') && !read('../src/pages/LoginPage.tsx').includes('elv-theme'))
  assert.ok(!/#[0-9a-fA-F]{3,6}\b/.test(read('../src/access/accessCartografia.css')), 'la hoja no trae colores fijos: todo sale de --cg-*')
})

test('ES-155 (E263): cada campo con error lleva aria-invalid y aria-describedby, el foco va al primero, «Mostrar» alterna type y la contraseña nunca se guarda en el navegador', () => {
  const card = read('../src/access/AccessCard.tsx')
  assert.ok(card.includes('aria-invalid={error || invalid ? true : undefined}'), 'aria-invalid por campo')
  assert.ok(card.includes('id={`${id}-error`}') && card.includes('role="alert"') && card.includes('aria-describedby={describedBy}'), 'el error se lee y se enlaza al campo')
  const page = read('../src/pages/LoginPage.tsx')
  assert.ok(/const first = firstInvalid\(found\)\s*\n\s*if \(first\) \{ inputs\[first\]\.current\?\.focus\(\); return \}/.test(page), 'foco al primer campo con error y no se envía')
  assert.ok(page.includes("type={showPassword ? 'text' : 'password'}"), 'Mostrar alterna el tipo del campo')
  const reset = read('../src/access/PasswordResetPages.tsx')
  assert.ok(reset.includes("type={show ? 'text' : 'password'}"))
  for (const [name, src] of [['LoginPage', page], ['PasswordResetPages', reset]]) {
    assert.ok(!/sessionStorage/.test(src), `${name} no usa sessionStorage`)
    for (const match of src.matchAll(/localStorage\.setItem\(([^)]*)\)/g)) assert.ok(!/password/i.test(match[1]), `${name} no guarda la contraseña: ${match[0]}`)
  }
  assert.deepEqual([...page.matchAll(/localStorage\.setItem\('([^']+)'/g)].map(match => match[1]).sort(), ['elevation_name', 'elevation_role', 'elevation_token'], 'solo se guarda la sesión')
})
