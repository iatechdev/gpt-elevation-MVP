// ES-136: «Cerrar sesión» visible en todas las pantallas autenticadas; el cierre revoca la sesión en el servidor y siempre limpia la local.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { signOut, SIGN_OUT_TIMEOUT_MS } from '../src/access/signOut.ts'
import { sessionCopy } from '../src/access/sessionCopy.ts'

const read = f => fs.readFileSync(new URL(f, import.meta.url), 'utf8')
const makeStore = initial => { const m = new Map(Object.entries(initial)); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), has: k => m.has(k) } }
function setup(keys = {}) {
  const local = makeStore({ elevation_token: 'tok-1', elevation_role: 'user', elevation_name: 'Ana', elevation_checkin_date: '2026-11-01', ...keys })
  const session = makeStore({ elevation_pending_chat: '{"x":1}' })
  const events = []
  globalThis.localStorage = local; globalThis.sessionStorage = session
  globalThis.window = { dispatchEvent: e => events.push(e.type) }
  return { local, session, events }
}

test('ES-136 signOut: llama POST /api/logout con el token y limpia sesión local, chat pendiente y fecha de check-in', async () => {
  const { local, session, events } = setup(); const calls = []
  const result = await signOut('https://api.test', async (url, init) => { calls.push({ url, init }); return { ok: true } })
  assert.equal(calls.length, 1); assert.equal(calls[0].url, 'https://api.test/api/logout')
  assert.equal(calls[0].init.method, 'POST'); assert.equal(calls[0].init.headers.Authorization, 'Bearer tok-1')
  assert.equal(result.revoked, true)
  for (const k of ['elevation_token', 'elevation_role', 'elevation_name', 'elevation_checkin_date']) assert.equal(local.has(k), false, k)
  assert.equal(session.has('elevation_pending_chat'), false); assert.deepEqual(events, ['elevation-session-change'])
})

test('ES-136 signOut: aunque el servidor falle (red, 401, 500, sin respuesta) la sesión local se borra igual', async () => {
  for (const fetcher of [async () => { throw new TypeError('Failed to fetch') }, async () => ({ ok: false, status: 401 }), async () => ({ ok: false, status: 500 })]) {
    const { local, session } = setup()
    const result = await signOut('https://api.test', fetcher)
    assert.equal(result.revoked, false); assert.equal(local.has('elevation_token'), false); assert.equal(session.has('elevation_pending_chat'), false)
  }
  const { local } = setup()
  const hang = (url, init) => new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted'))))
  const t0 = Date.now(); const result = await signOut('https://api.test', hang)
  assert.equal(result.revoked, false); assert.equal(local.has('elevation_token'), false); assert.ok(Date.now() - t0 >= SIGN_OUT_TIMEOUT_MS - 100)
})

test('ES-136 signOut: sin token no llama al servidor y deja todo limpio', async () => {
  const { local } = setup({ elevation_token: '' }); let called = false
  await signOut('https://api.test', async () => { called = true; return { ok: true } })
  assert.equal(called, false); assert.equal(local.has('elevation_name'), false)
})

test('ES-136 textos: «Cerrar sesión», «Saliendo…» y «Mis datos» en ES y EN, con tuteo', () => {
  assert.deepEqual(Object.keys(sessionCopy.es), Object.keys(sessionCopy.en))
  assert.equal(sessionCopy.es.signOut, 'Cerrar sesión'); assert.equal(sessionCopy.en.signOut, 'Sign out')
  assert.equal(sessionCopy.es.signingOut, 'Saliendo…'); assert.equal(sessionCopy.en.signingOut, 'Signing out…')
})

test('ES-136 estructura: el control de sesión está en dashboard, administración, junta y terapeuta; destino «/»; sin cierres locales sueltos', () => {
  // ES-153: administración, junta y profesional salen desde su marco (shell/frames.tsx → SignOutButton / UserMenu, que llaman a signOut()).
  for (const f of ['../src/layouts/AdminLayout.tsx', '../src/layouts/BoardLayout.tsx', '../src/layouts/TherapistLayout.tsx']) assert.match(read(f), /<(Admin|Board|Professional)Frame/, f)
  const frames = read('../src/shell/frames.tsx'), chrome = read('../src/shell/Frame.tsx')
  assert.equal((frames.match(/<SignOutButton \/>/g) ?? []).length, 2); assert.ok(frames.includes('<UserMenu'))
  assert.equal((chrome.match(/await signOut\(BACKEND\)/g) ?? []).length, 2); assert.equal((chrome.match(/navigate\('\/', \{ replace: true \}\)/g) ?? []).length, 2)
  assert.ok(chrome.includes('aria-busy={leaving}') && chrome.includes('disabled={leaving}'))
  assert.ok(read('../src/pages/UserDashboard.tsx').includes('<SessionControl'))
  const control = read('../src/access/SessionControl.tsx')
  assert.ok(control.includes("navigate('/', { replace: true })")); assert.ok(control.includes('aria-busy={leaving}')); assert.ok(control.includes('to="/app/data"'))
  assert.ok(control.includes('disabled={leaving}')) // un segundo clic no repite la llamada
  for (const f of [...['../src/layouts/AdminLayout.tsx', '../src/layouts/BoardLayout.tsx', '../src/layouts/TherapistLayout.tsx', '../src/shell/frames.tsx', '../src/shell/Frame.tsx'], '../src/pages/UserDashboard.tsx'])
    assert.equal(read(f).includes("localStorage.removeItem('elevation_token')"), false, f + ' no borra la sesión por su cuenta')
  const dash = read('../src/pages/UserDashboard.tsx')
  assert.ok(dash.includes('<SessionControl onRequestSignOut={() => setShowCheckout(true)} />')) // la despedida (check-out) se conserva
  assert.equal((dash.match(/signOut\(API\)/g) ?? []).length, 2) // «Cerrar sesión» y «Saltar» de la despedida revocan en el servidor
})
