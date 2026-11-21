// ES-359 (M3, informe de regresión de QA-5 sobre main): la superadministración no ve pantallas cuyas APIs el servidor le niega.
// El servidor no cambió: sigue negando (backend/test/integration/es-334-postgres.cjs). Esto prueba la compuerta del cliente y los enlaces.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { canEnter, gateDecision, zoneForPath } from '../src/shell/access.ts'
import { ADMIN_GROUPS, BOARD_GROUPS, PERSON_GROUPS, PROFESSIONAL_GROUPS, groupsFor, visibleGroups } from '../src/shell/navGroups.ts'
import { ACCOUNT_DATA, ADMIN_MENU, BOARD_MENU, PERSON_MENU, PERSON_NAV, PROFESSIONAL_MENU, visibleFor } from '../src/shell/nav.ts'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const ROLES = ['user', 'therapist', 'admin', 'superadmin', 'board']
const decide = (role, path, declared) => gateDecision({ status: 'verified', role }, path, declared)

// Pantallas cuyas APIs solo abre el servidor al rol «user» (medido con el servidor real: superadministración recibe 403 en cada una).
const PARTICIPANT_ONLY = ['/app/onboarding', '/app/context/resumes', '/app/context/resumes/update', '/app/evidence/resume-skills', '/app/my-therapist', '/app/session/7', '/app/next-step', '/app/next-step/plan', '/app/next-step/experiments/3']
const PROFESSIONAL = ['/therapist/dashboard', '/therapist/patient/9', '/therapist/session/9']
// Pantallas de persona que SÍ funcionan para superadministración (su chat y su diario, ES-334) y no se tocan.
const STILL_OPEN_TO_SUPERADMIN = ['/app/chat', '/app/diary', '/app/dashboard', '/app/evidence', '/app/evidence/12', '/app/skill-map', '/app/bridge', '/app/checkin', '/app/data', '/app/plan', '/app/professional-reviews']

test('M3: superadministración ve «sin acceso» (no un panel roto) en las pantallas solo-persona y en las del profesional; la persona y el profesional siguen entrando', () => {
  for (const path of PARTICIPANT_ONLY) {
    assert.equal(zoneForPath(path), 'participant', path)
    assert.equal(decide('superadmin', path, 'person'), 'noAccess', `superadmin ${path}`)
    assert.equal(decide('user', path, 'person'), 'allow', `user ${path}`)
    for (const role of ['admin', 'therapist', 'board']) assert.equal(decide(role, path, 'person'), 'noAccess', `${role} ${path}`)
  }
  for (const path of PROFESSIONAL) {
    assert.equal(decide('superadmin', path, 'professional'), 'noAccess', `superadmin ${path}`)
    assert.equal(decide('therapist', path, 'professional'), 'allow', `therapist ${path}`)
    for (const role of ['user', 'admin', 'board']) assert.equal(decide(role, path, 'professional'), 'noAccess', `${role} ${path}`)
  }
})

test('M3: nada de lo que superadministración usaba se perdió (chat, diario, panel, evidencias, administración, junta, datos…)', () => {
  for (const path of STILL_OPEN_TO_SUPERADMIN) assert.notEqual(decide('superadmin', path, undefined), 'noAccess', path)
  for (const path of ['/admin/dashboard', '/admin/users', '/admin/content', '/admin/manifest']) assert.equal(decide('superadmin', path, 'admin'), 'allow', path)
  assert.equal(decide('superadmin', '/board/manifest', 'board'), 'allow')
  assert.equal(canEnter('superadmin', 'person'), true); assert.equal(canEnter('superadmin', 'admin'), true); assert.equal(canEnter('superadmin', 'board'), true)
  assert.equal(canEnter('superadmin', 'participant'), false); assert.equal(canEnter('superadmin', 'professional'), false)
  assert.equal(canEnter('user', 'participant'), true); assert.equal(canEnter('therapist', 'professional'), true)
})

test('M3: ningún rol ve un enlace (barra, grupos, cajón o menú de cuenta) a una pantalla que su compuerta no le deja abrir', () => {
  const links = (role) => {
    const groups = role === 'therapist' ? PROFESSIONAL_GROUPS : role === 'board' ? BOARD_GROUPS : ['admin'].includes(role) ? ADMIN_GROUPS : PERSON_GROUPS
    const menu = role === 'therapist' ? PROFESSIONAL_MENU : role === 'board' ? BOARD_MENU : role === 'admin' ? ADMIN_MENU : PERSON_MENU
    return [...visibleGroups(groups, role).flatMap(group => group.items), ...visibleFor(menu, role), ...(role === 'user' || role === 'superadmin' ? visibleFor(PERSON_NAV, role) : [])]
  }
  for (const role of ROLES) for (const item of links(role)) {
    const path = item.to.split('#')[0]
    if (!path || path === '/' || path === '/manifiesto' || path === '/login') continue
    assert.notEqual(decide(role, path, undefined), 'noAccess', `${role} ve el enlace ${item.to} pero la compuerta lo niega`)
  }
  // superadministración, dentro de /admin, usa los grupos de administración completos
  assert.equal(visibleGroups(ADMIN_GROUPS, 'superadmin').flatMap(group => group.items).length, ADMIN_GROUPS.flatMap(group => group.items).length)
  assert.ok(ACCOUNT_DATA.to === '/app/data')
})

test('M3: superadministración no ve en la barra de persona «Siguiente paso», «Mis hojas de vida» ni «Mi profesional»; la persona usuaria sí', () => {
  const hrefs = groups => groups.flatMap(group => group.items.map(item => item.to))
  for (const href of ['/app/next-step', '/app/context/resumes', '/app/my-therapist']) {
    assert.ok(hrefs(groupsFor('user')).includes(href), `user ${href}`)
    assert.equal(hrefs(groupsFor('superadmin')).includes(href), false, `superadmin ${href}`)
  }
  assert.equal(visibleFor(PERSON_NAV, 'superadmin').some(item => item.to === '/app/next-step'), false)
  assert.equal(visibleFor(PERSON_NAV, 'user').some(item => item.to === '/app/next-step'), true)
  assert.ok(read('../src/shell/frames.tsx').includes("visibleFor(PERSON_NAV, readRole('user'))")) // la barra superior del marco de persona también filtra por rol
})
