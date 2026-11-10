// ES-206: h1 en el panel y el chat de la persona, textos en español sin anglicismos visibles, concordancia y objetivos táctiles.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const read = file => fs.readFileSync(path.join(here, file), 'utf8')

test('ES-206 punto 1: /app/dashboard y /app/chat tienen un h1 (visualmente oculto)', () => {
  assert.match(read('../src/pages/UserDashboard.tsx'), /<h1 className="sr-only">\{lang === 'es' \? 'Mi panel' : 'My dashboard'\}<\/h1>/)
  assert.match(read('../src/pages/ChatPage.tsx'), /<h1 className="sr-only">\{lang === 'es' \? 'Conversación' : 'Conversation'\}<\/h1>/)
})

test('ES-206 punto 2: «Mis datos» y «Volver al inicio» miden al menos 24 px de alto', () => {
  assert.match(read('../src/access/sessionControl.css'), /\.session-control-data \{[^}]*min-height: 44px/)
  assert.match(read('../src/career/career.css'), /\.career-header a \{[^}]*min-height:44px/)
})

test('ES-206 punto 3: panel del terapeuta con concordancia y sin «prompt» en el botón en español', () => {
  const es = read('../src/i18n/es.ts'), en = read('../src/i18n/en.ts'), dash = read('../src/pages/therapist/TherapistDashboard.tsx')
  assert.match(es, /therapist_assigned: 'personas asignadas'/); assert.match(es, /therapist_assigned_one: 'persona asignada'/)
  assert.match(en, /therapist_assigned: 'people assigned'/); assert.match(en, /therapist_assigned_one: 'person assigned'/)
  assert.match(es, /therapist_create_prompt: 'Crear guía'/)
  // ES-177 (B1): el recuento ya no es una frase con concordancia sino una cifra rotulada «Personas»: no hay frase que concordar.
  const copy = read('../src/i18n/therapistCopy.ts')
  assert.match(dash, /<SummaryBlock /); assert.match(copy, /panel_people: 'Personas'/); assert.match(copy, /panel_people: 'People'/)
})

test('ES-206 punto 4: «plan requests», «matching pending» y los roles del filtro salen por el traductor de administración', () => {
  const users = read('../src/pages/admin/AdminUsers.tsx'), copy = read('../src/i18n/adminCopy.ts')
  assert.equal(/plan request\{/.test(users) || /matching pending</.test(users), false)
  for (const key of ['solicitud de plan', 'solicitudes de plan', 'asignación pendiente', 'asignaciones pendientes', 'Persona usuaria', 'Junta ética']) {
    assert.ok(copy.includes(`'${key}'`), key); assert.ok(users.includes(`"${key}"`) || users.includes(`'${key}'`), `AdminUsers usa ${key}`)
  }
  assert.equal(/Sprint \d/.test(read('../src/pages/admin/AdminDashboard.tsx')), false, 'el pie «Sprint 9» ya no existe')
})
