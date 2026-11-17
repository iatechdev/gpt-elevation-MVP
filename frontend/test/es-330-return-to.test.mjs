// ES-330: volver a la ruta protegida original tras iniciar sesión, SIN redirección abierta. Validador, almacenamiento y cableado de los guardianes.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { RETURN_TTL_MS, forgetReturn, peekReturn, rememberReturn, returnPathFor, safeReturnPath, signedOut } from '../src/access/returnTo.ts'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const user = { role: 'user', onboardingCompleted: true }
const memory = () => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), size: () => m.size } }
const withStorage = fn => { const previous = globalThis.window; const store = memory(); globalThis.window = { sessionStorage: store }; try { return fn(store) } finally { globalThis.window = previous } }

test('ES-330: acepta solo rutas internas de la lista permitida, con su búsqueda', () => {
  for (const ok of ['/app/skill-map', '/app/evidence/12/edit', '/app/route-catalog/roles/data-analyst', '/admin/users', '/therapist/patient/7', '/facilitation/participants/3', '/app/diary?x=1', '/app'])
    assert.equal(safeReturnPath(ok), ok, ok)
})

test('ES-330: rechaza redirección abierta, esquemas, saltos de ruta y entradas hostiles', () => {
  const bad = ['//evil.com', '//evil.com/app', '/\evil.com', '/app\..\login', 'https://evil.com/app/x', 'http://evil.com', 'javascript:alert(1)', 'data:text/html,x', 'vbscript:x', '/javascript:alert(1)',
    'app/skill-map', '', '/', '/login', '/forgot-password', '/pricing', '/app/../login', '/app/%2e%2e/login', '/app/%2F%2Fevil.com', '/app/x%5Cy', '/appx/skill-map', '/application',
    '/app/x\nSet-Cookie: a=b', '/app/x\r', '/app/\u0000', '/app/x#frag', '/app/' + 'a'.repeat(400), 'HTTPS://EVIL.COM', ' /app/x', '/ /app/x']
  for (const value of bad) assert.equal(safeReturnPath(value), null, JSON.stringify(value))
  for (const value of [undefined, null, 12, {}, [], ['/app/x'], true]) assert.equal(safeReturnPath(value), null)
})

test('ES-330: la ruta debe corresponder al ROL REAL; si no, null (inicio de su rol)', () => {
  assert.equal(returnPathFor('/app/skill-map', user), '/app/skill-map')
  assert.equal(returnPathFor('/admin/users', user), null, 'persona pidiendo administración')
  assert.equal(returnPathFor('/therapist/dashboard', user), null)
  assert.equal(returnPathFor('/app/skill-map', { role: 'admin', onboardingCompleted: false }), null, 'administración pidiendo una pantalla de persona')
  assert.equal(returnPathFor('/admin/users', { role: 'admin', onboardingCompleted: false }), '/admin/users')
  assert.equal(returnPathFor('/admin/users', { role: 'superadmin', onboardingCompleted: false }), '/admin/users')
  assert.equal(returnPathFor('/therapist/dashboard', { role: 'therapist', onboardingCompleted: false }), '/therapist/dashboard')
  assert.equal(returnPathFor('/admin/users', { role: 'therapist', onboardingCompleted: false }), null)
  assert.equal(returnPathFor('/app/data', { role: 'therapist', onboardingCompleted: false }), '/app/data', 'Mis datos es de cualquier sesión válida')
  assert.equal(returnPathFor('/app/skill-map', { role: 'board', onboardingCompleted: false }), null)
  assert.equal(returnPathFor('//evil.com', { role: 'admin', onboardingCompleted: true }), null)
  assert.equal(returnPathFor('/app/skill-map', { role: 'user', onboardingCompleted: false }), null, 'sin onboarding terminado se entra primero al onboarding')
})

test('ES-330: se recuerda ruta y búsqueda, caduca, se borra y no sobrevive a cerrar sesión a propósito', () => withStorage(store => {
  assert.equal(peekReturn(), null)
  rememberReturn('/app/skill-map', '?tab=2', 1000); assert.equal(peekReturn(1000), '/app/skill-map?tab=2')
  assert.equal(peekReturn(1000 + RETURN_TTL_MS), '/app/skill-map?tab=2'); assert.equal(peekReturn(1001 + RETURN_TTL_MS), null, 'caduca')
  rememberReturn('//evil.com', '', 1000 + 5); assert.equal(peekReturn(1000), '/app/skill-map?tab=2', 'un valor inválido no reemplaza ni se guarda')
  forgetReturn(); assert.equal(store.size(), 0)
  rememberReturn('/app/data', '', 5_000); assert.equal(peekReturn(5_000), '/app/data')
  signedOut(6_000); assert.equal(store.size(), 0, 'cerrar sesión borra lo recordado')
  rememberReturn('/app/data', '', 6_001); assert.equal(store.size(), 0, 'y la compuerta que ve la sesión cerrada no recuerda la pantalla de la que se sale')
  rememberReturn('/app/data', '', 6_000 + 3_001); assert.equal(peekReturn(6_000 + 3_001), '/app/data', 'pasado el instante de salida vuelve a funcionar')
}))

test('ES-330: un valor manipulado en sessionStorage nunca sale como destino', () => withStorage(store => {
  for (const raw of ['not json', '{"path":"//evil.com","at":1}', '{"path":"https://evil.com","at":1}', '{"path":"/app/x","at":"1"}', '{"path":"/app/x","at":99999999999999}', '[]', 'null', '{"path":"/login","at":1}'])
    { store.setItem('elevation_return_to', raw); assert.equal(peekReturn(1), null, raw) }
}))

test('ES-330: sin sessionStorage (bloqueado) no se rompe: se vuelve al inicio del rol', () => {
  const previous = globalThis.window
  globalThis.window = { get sessionStorage() { throw new Error('bloqueado') } }
  try { rememberReturn('/app/x', ''); assert.equal(peekReturn(), null); forgetReturn(); signedOut() } finally { globalThis.window = previous }
})

test('ES-330: cableado — la compuerta recuerda, LoginPage valida con el rol real tras la intención de plan, cerrar sesión no recuerda', () => {
  const gate = read('../src/shell/RoleGate.tsx'), login = read('../src/pages/LoginPage.tsx'), out = read('../src/access/signOut.ts')
  assert.match(gate, /rememberReturn\(pathname, search\)/); assert.match(gate, /decision === 'login'/)
  assert.match(login, /planDestination\(params\.toString\(\)\) \?\? returnPathFor\(peekReturn\(\), entry\.result\.session\) \?\? sessionDestination\(entry\.result\.session\)/)
  assert.match(login, /forgetReturn\(\)/); assert.match(out, /signedOut\(\)/)
  assert.ok(!/location\.(href|assign|replace)|window\.open/.test(read('../src/access/returnTo.ts')), 'el módulo no navega por su cuenta: la salida es siempre <Navigate> interno')
})
