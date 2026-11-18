// ES-346: tras «eliminar mi cuenta» se ejecuta el cierre de sesión de «Cerrar sesión» ANTES del aviso; la marca de despedida (en memoria) solo deja ver ese aviso.
// El comportamiento completo (storage limpio, aviso visible, otras rutas a /login, fallo del servidor conserva la sesión) lo mide scripts/es346-eliminar-sesion.cjs.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { startFarewell, endFarewell, isFarewell } from '../src/access/farewell.ts'
import { gateDecision, withFarewell } from '../src/shell/access.ts'

const here = path.dirname(fileURLToPath(import.meta.url))
const read = rel => fs.readFileSync(path.join(here, rel), 'utf8')

test('ES-346: la marca de despedida es de una sola ruta y se puede borrar', () => {
  assert.equal(isFarewell('/app/data'), false)
  startFarewell('/app/data'); assert.equal(isFarewell('/app/data'), true); assert.equal(isFarewell('/app/dashboard'), false); assert.equal(isFarewell('/app/data/x'), false)
  endFarewell(); assert.equal(isFarewell('/app/data'), false)
})
test('ES-346: la marca no se guarda en el navegador', () => {
  assert.doesNotMatch(read('../src/access/farewell.ts').replace(/\/\/.*$/gm, ''), /localStorage|sessionStorage|document\.cookie/)
})
test('ES-346: DataPage cierra la sesión (signOut) tras la solicitud y antes de mostrar el aviso', () => {
  const page = read('../src/space/DataPage.tsx')
  const remove = page.slice(page.indexOf('const remove = async'), page.indexOf('const closeDialog'))
  assert.ok(remove.indexOf('await requestDeletion(token)') < remove.indexOf('startFarewell(pathname)'))
  assert.ok(remove.indexOf('startFarewell(pathname)') < remove.indexOf('await signOut(BACKEND)'))
  assert.ok(remove.indexOf('await signOut(BACKEND)') < remove.indexOf('setDone(true)'))
  assert.doesNotMatch(page, /invalidateStoredSession/)
})
test('ES-346: la decisión de la compuerta solo cambia «login» por «allow» con la marca de la ruta (gateDecision real)', () => {
  const at = path => { const decision = gateDecision({ status: 'anonymous' }, path, 'member'); return withFarewell(decision, isFarewell(path)) }
  assert.equal(at('/app/data'), 'login') // sin marca
  startFarewell('/app/data')
  assert.equal(at('/app/data'), 'allow') // con marca y en la ruta marcada
  assert.equal(at('/app/dashboard'), 'login'); assert.equal(at('/app/data/otra'), 'login'); assert.equal(at('/admin/users'), 'login') // otras rutas y subrutas
  for (const state of [{ status: 'checking' }, { status: 'unavailable' }]) assert.equal(withFarewell(gateDecision(state, '/app/data', 'member'), true), gateDecision(state, '/app/data', 'member')) // verificando / sin conexión no cambian
  assert.equal(withFarewell('noAccess', true), 'noAccess'); assert.equal(withFarewell('allow', false), 'allow')
  endFarewell(); assert.equal(at('/app/data'), 'login')
  assert.match(read('../src/shell/RoleGate.tsx'), /const decision = withFarewell\(gated, isFarewell\(pathname\)\)/)
})
