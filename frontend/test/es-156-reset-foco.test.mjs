// ES-156: la pantalla de nueva contraseña mueve el foco al mensaje tras CADA rechazo y muestra el resumen «n de 5» como única región aria-live.
// Pruebas de código fuente (el comportamiento real en navegador lo mide scripts/es156-check.cjs).
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const page = read('../src/access/PasswordResetPages.tsx')
const reqs = read('../src/access/PasswordRequirements.tsx')
const reset = page.slice(page.indexOf('export function ResetPasswordPage'))

test('ES-156: cada rama de rechazo avanza el contador que mueve el foco al mensaje', () => {
  const submit = reset.slice(reset.indexOf('const submit'), reset.indexOf('if (done)'))
  // requisitos locales, política del servidor, límite de intentos / fallo genérico y error de red
  assert.equal((submit.match(/setRejections\(n => n \+ 1\)/g) || []).length, 4)
  assert.match(reset, /useEffect\(\(\) => \{ if \(rejections > 0\) messageRef\.current\?\.focus\(\) \}, \[rejections\]\)/)
  assert.match(reset, /<Message innerRef=\{messageRef\}/)
  // el foco ya no salta al campo, y la contraseña escrita no se borra en ningún rechazo
  assert.ok(!/passwordInput/.test(reset))
  assert.ok(!/setPassword\(''\)/.test(submit.replace("if (res.ok) { setDone(true); setPassword(''); return }", '')))
})

test('ES-156: el mensaje es enfocable solo cuando recibe el ref y teclear no roba el foco', () => {
  assert.match(page, /tabIndex=\{innerRef \? -1 : undefined\}/)
  assert.match(page, /role=\{notice\.ok \? 'status' : 'alert'\}/)
  // el efecto depende solo del contador: onChange del campo no lo toca
  assert.ok(!/onChange=\{[^}]*setRejections/.test(reset))
})

test('ES-156: el resumen es visible en esta pantalla, único aria-live, y sigue oculto en el registro', () => {
  assert.match(reset, /<PasswordRequirements[^>]*\bvisibleSummary\b/)
  assert.equal((reqs.match(/aria-live=/g) || []).length, 1)
  assert.match(reqs, /visibleSummary = false/)
  const login = read('../src/pages/LoginPage.tsx')
  assert.ok(!/visibleSummary/.test(login), 'el registro no cambia')
})
