// ES-372 (O428-1): «Mi contexto» (→ /app/onboarding, zona participante, solo rol user) no se ofrece a los demás roles: terminaba en «Tu rol no tiene acceso».
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { canEnter, zoneForPath } from '../src/shell/access.ts'

const page = fs.readFileSync(new URL('../src/pages/UserDashboard.tsx', import.meta.url), 'utf8')

test('ES-372: /app/onboarding es de la zona participante y solo el rol user entra', () => {
  assert.equal(zoneForPath('/app/onboarding'), 'participant')
  assert.equal(canEnter('user', 'participant'), true)
  for (const role of ['admin', 'superadmin', 'therapist', 'board']) assert.equal(canEnter(role, 'participant'), false, role)
})

test('ES-372: el enlace «Mi contexto» solo se pinta si el rol entra a la zona participante; sin rol legible se asume user', () => {
  assert.match(page, /\{canEnter\(storedRole\(\), 'participant'\) && <Link className="pc-link context-dashboard-link" to="\/app\/onboarding">\{t\('context_link'\)\}<\/Link>\}/)
  assert.match(page, /const storedRole = \(\): Role => \{ try \{ const value = localStorage\.getItem\('elevation_role'\); return value === 'admin' \|\| value === 'superadmin' \|\| value === 'therapist' \|\| value === 'board' \? value : 'user' \} catch \{ return 'user' \} \}/)
  assert.doesNotMatch(page, /<nav className="pc-links"[^>]*>\s*<Link className="pc-link context-dashboard-link"/)
})
