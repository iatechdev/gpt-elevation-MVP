// ES-310 (PR 5) · /admin/users para una cuenta admin (no superadmin): lo que la interfaz muestra deriva de los MISMOS ayudantes de rol (assignableRoles, invitableRoles, isSuper,
// filterableRoles), sin listas de roles duplicadas en los componentes, y esos ayudantes coinciden con lo que el servidor permite. La comprobación contra el servidor real
// (403 en enlace de restablecimiento, solicitar eliminación y roles fuera de lista, con PostgreSQL real) está en backend/test/integration/es-310-admin-403-postgres.cjs y usa la
// misma fuente: frontend/test/fixtures/es-310-admin-permisos.json.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as logic from '../src/pages/admin/adminUsersLogic.ts'

const here = dirname(fileURLToPath(import.meta.url))
const read = (p) => readFileSync(resolve(here, p), 'utf8')
const permisos = JSON.parse(read('fixtures/es-310-admin-permisos.json'))
const screen = (name) => read(`../src/pages/admin/${name}`)
const SCREENS = ['AdminUsers.tsx', 'AdminUsersPeople.tsx', 'AdminUsersManage.tsx', 'AdminUsersInvite.tsx', 'AdminUsersQueues.tsx']

test('los ayudantes de la interfaz coinciden con la fuente común (lo que el servidor permite a admin y a superadmin)', () => {
  assert.deepEqual(logic.assignableRoles('admin'), permisos.admin.rolesQueSePuedenAsignar)
  assert.deepEqual(logic.invitableRoles('admin'), permisos.admin.rolesQueSePuedenInvitar)
  assert.deepEqual(logic.ROLES.filter((role) => !logic.assignableRoles('admin').includes(role)).sort(), [...permisos.admin.rolesQueElServidorRechaza].sort())
  assert.deepEqual([...logic.assignableRoles('superadmin')].sort(), [...permisos.superadmin.rolesQueSePuedenAsignar].sort())
  assert.equal(logic.isSuper('superadmin'), true)
  for (const actor of ['admin', 'user', 'therapist', 'board', '', 'SUPERADMIN']) assert.equal(logic.isSuper(actor), false, actor)
  // el filtro de la lista es solo vista: admin no ve superadministración ni junta ética; superadmin ve las cinco
  assert.deepEqual(logic.filterableRoles('admin'), ['user', 'therapist', 'admin']); assert.equal(logic.filterableRoles('superadmin').length, 5)
})

test('los ayudantes de la interfaz coinciden con las constantes del servidor (ROLES_PRIVILEGIADOS e INVITER_ROLES)', () => {
  const adminUsers = read('../../backend/routes/adminUsers.js'), invitations = read('../../backend/routes/invitations.js')
  const privileged = /const ROLES_PRIVILEGIADOS = \[([^\]]*)\]/.exec(adminUsers)?.[1].match(/'[a-z]+'/g)?.map((x) => x.slice(1, -1))
  assert.deepEqual([...privileged].sort(), [...permisos.admin.rolesQueElServidorRechaza].sort(), 'roles que el servidor niega a admin')
  const inviter = /const INVITER_ROLES = \{[\s\S]*?admin: \[([^\]]*)\]/.exec(invitations)?.[1].match(/'[a-z]+'/g)?.map((x) => x.slice(1, -1))
  assert.deepEqual(inviter, permisos.admin.rolesQueSePuedenInvitar, 'roles que el servidor deja invitar a admin')
  assert.match(adminUsers, /if \(req\.user\.role !== 'superadmin'\) \{ await recordDenied\(req\.user, 'user\.reset_link'/, 'reset-link: solo superadmin en el servidor')
  assert.match(adminUsers, /if \(adminRole !== 'superadmin'\) \{\s*await recordDenied\(req\.user, 'user\.delete'/, 'eliminar / solicitar eliminación: solo superadmin en el servidor')
})

test('los componentes no escriben listas de roles ni comparan con «superadmin»: todo sale de los ayudantes', () => {
  for (const file of SCREENS) {
    const text = screen(file)
    assert.doesNotMatch(text, /'superadmin'|"superadmin"/, `${file}: compara con «superadmin» en vez de usar isSuper`)
    assert.doesNotMatch(text, /\[\s*'user'\s*,\s*'therapist'/, `${file}: lista de roles escrita a mano`)
    assert.doesNotMatch(text, /role === 'admin'|actorRole === /, `${file}: decide por el rol sin pasar por un ayudante`)
  }
  assert.match(screen('AdminUsersManage.tsx'), /assignableRoles\(actorRole\)/); assert.match(screen('AdminUsersManage.tsx'), /isSuper\(actorRole\) &&/)
  assert.match(screen('AdminUsersInvite.tsx'), /invitableRoles\(actorRole\)/); assert.match(screen('AdminUsersPeople.tsx'), /filterableRoles\(actorRole\)/)
})

test('para admin NO se pintan «Enviar enlace de restablecimiento» ni «Solicitar eliminación…/Eliminar…»: solo existen dentro del bloque isSuper', () => {
  const manage = screen('AdminUsersManage.tsx')
  const gate = manage.indexOf('isSuper(actorRole) && (')
  assert.ok(gate > 0)
  for (const text of ["tr('Enviar enlace de restablecimiento')", "tr('Solicitar eliminación…')", "tr('Eliminar…')", "setMode('delete')", 'void sendReset()']) {
    assert.equal(manage.indexOf(text) > gate, true, `${text} debe estar dentro del bloque isSuper`)
  }
  // «Desbloquear», «Desactivar…/Activar», «Rol» + «Guardar» y «Profesional asignado» + «Asignar» siguen disponibles para admin (antes del bloque isSuper)
  for (const text of ["tr('Desbloquear')", "tr('Desactivar…')", "tr('Guardar')", "tr('Asignar')"]) assert.ok(manage.indexOf(text) > 0 && manage.indexOf(text) < gate, text)
})

test('los diálogos y tablas de la pantalla no usan estilos en línea, colores fijos ni las piezas retiradas', () => {
  for (const file of SCREENS) {
    const text = screen(file)
    assert.doesNotMatch(text, /style=\{\{/, `${file}: estilo en línea`)
    assert.doesNotMatch(text, /styles\/tokens|adminUsersStyles|AdminDialog/, `${file}: usa piezas retiradas`)
  }
  assert.doesNotMatch(read('../src/pages/admin/adminUsers.css'), /#[0-9a-fA-F]{3,8}\b|rgb\(|rgba\(/, 'adminUsers.css: colores fijos')
  assert.match(read('../src/pages/admin/adminUsers.css'), /var\(--cg-line\)/)
})
