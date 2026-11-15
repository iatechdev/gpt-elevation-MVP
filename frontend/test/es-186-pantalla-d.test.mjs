// ES-186 parte D · /admin/users: lo que se le dice a quien administra sale de la respuesta REAL del servidor (fixtures generadas por las pruebas con PostgreSQL real de las
// partes A, B y C, que fallan si la forma cambia). Cubre: requestId por intento y comparación del correo devuelto (E212-2), eliminar por solicitud (parte C), request_closed,
// códigos 403, estados de la lista (deletionRequested, D0), E186-5…9 y que ningún texto de la pantalla se quede sin inglés.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as logic from '../src/pages/admin/adminUsersLogic.ts'
import { formatExpiry } from '../src/pages/admin/inviteOutcome.ts'
import { adminText } from '../src/i18n/adminCopy.ts'

const here = dirname(fileURLToPath(import.meta.url))
const fixture = (name) => JSON.parse(readFileSync(resolve(here, 'fixtures', name), 'utf8'))
const source = (name) => readFileSync(resolve(here, '../src/pages/admin', name), 'utf8')
const sent = { email: 'Persona@Example.test ', role: 'user' }

test('invitar: 201 con correo enviado → «sent»; 201 sin correo configurado → «recorded» (nunca promete un correo); un servidor que omite emailSent no cuenta como enviado', () => {
  const created = fixture('es-186-invite-created.json')
  const ok = logic.inviteResult(created.status, created.body, { email: created.body.email, role: 'user' })
  assert.equal(ok.kind, 'sent'); assert.equal(ok.email, created.body.email); assert.equal(ok.expiresAt, created.body.expiresAt)
  const recorded = fixture('es-186-invite-recorded.json')
  assert.equal(logic.inviteResult(recorded.status, recorded.body, { email: recorded.body.email, role: recorded.body.role }).kind, 'recorded')
  assert.equal(logic.inviteResult(201, { ...created.body, emailSent: undefined }, { email: created.body.email, role: 'user' }).kind, 'recorded')
  assert.equal(logic.inviteResult(201, { ...created.body, emailSent: 'true' }, { email: created.body.email, role: 'user' }).kind, 'recorded')
})

test('invitar (E212-2): el MISMO intento repetido es «already»; otro correo, otro rol o una invitación anulada NO son éxito («stale»)', () => {
  const replay = fixture('es-186-invite-replayed.json')
  assert.equal(replay.status, 200); assert.equal(replay.body.replayed, true)
  assert.deepEqual(logic.inviteResult(replay.status, replay.body, { email: replay.body.email.toUpperCase(), role: 'user' }), { kind: 'already', email: replay.body.email })
  // lo que escribió la persona NO es lo que devolvió el servidor (mismo requestId con otro correo)
  const other = fixture('es-186-invite-replayed-other-email.json')
  assert.equal(logic.inviteResult(other.status, other.body, { email: 'distinto@example.test', role: 'user' }).kind, 'stale')
  // tras anular, el servidor devuelve la invitación anulada: no es el éxito de lo que se pidió
  const revoked = fixture('es-186-invite-revoked-replay.json')
  assert.equal(revoked.body.status, 'revoked')
  assert.equal(logic.inviteResult(revoked.status, revoked.body, { email: revoked.body.email, role: 'user' }).kind, 'stale')
  // otro rol con el mismo correo tampoco coincide
  assert.equal(logic.inviteResult(replay.status, replay.body, { email: replay.body.email, role: 'therapist' }).kind, 'stale')
  // un 2xx sin cuerpo utilizable nunca es éxito
  assert.equal(logic.inviteResult(201, null, sent).kind, 'stale')
})

test('invitar: errores por CÓDIGO del servidor; los de correo van al campo, el resto al formulario', () => {
  const taken = fixture('es-186-invite-error.json')
  assert.deepEqual(logic.inviteResult(taken.status, taken.body, sent), { kind: 'error', message: 'Ya existe una cuenta con ese correo.', field: 'email' })
  assert.deepEqual(logic.inviteResult(400, { code: 'invalid_email' }, sent), { kind: 'error', message: 'Correo inválido.', field: 'email' })
  assert.equal(logic.inviteResult(403, { code: 'role_not_allowed' }, sent).message, 'No tienes permiso para invitar con ese rol.')
  assert.equal(logic.inviteResult(429, { code: 'rate_limited' }, sent).message, 'Demasiadas invitaciones seguidas. Espera un rato.')
  assert.equal(logic.inviteResult(400, { code: 'invalid_request_id' }, sent).field, 'form')
  assert.equal(logic.inviteResult(0, null, sent).message, 'Error de conexión.')
  assert.equal(logic.inviteResult(500, {}, sent).message, 'El servidor no pudo completar la acción. Inténtalo de nuevo.')
})

test('requestId por intento: el mismo para un doble clic o un reintento; nuevo si cambia el correo o el rol, o tras renovar', () => {
  let n = 0
  const attempt = logic.createAttempt(() => `req-test-${String(++n).padStart(4, '0')}`)
  const first = attempt.idFor('ana@example.test', 'user')
  assert.equal(attempt.idFor('ana@example.test', 'user'), first, 'doble clic')
  assert.equal(attempt.idFor('  ANA@example.test ', 'user'), first, 'mismo correo con otras mayúsculas o espacios')
  assert.notEqual(attempt.idFor('otra@example.test', 'user'), first, 'otro correo = otro intento')
  const second = attempt.idFor('otra@example.test', 'user')
  assert.notEqual(attempt.idFor('otra@example.test', 'therapist'), second, 'otro rol = otro intento')
  const third = attempt.idFor('otra@example.test', 'therapist')
  attempt.renew()
  assert.notEqual(attempt.idFor('otra@example.test', 'therapist'), third, 'tras un éxito se renueva')
  for (const id of ['req-test-0001', logic.newRequestId()]) assert.match(id, logic.REQUEST_ID)
  assert.throws(() => logic.newRequestId(() => 'corto'), /inválido/)
  assert.throws(() => logic.newRequestId(() => 'x'.repeat(65)), /inválido/)
})

test('eliminar (parte C): 202 solicitud (y repetida), 200 eliminada, 409 has_dependent_data; un 2xx inesperado no se anuncia como éxito', () => {
  const r = fixture('es-186-delete-requested.json'); const again = fixture('es-186-delete-repeated.json')
  assert.deepEqual(logic.deleteResult(r.status, r.body), { kind: 'requested', repeated: false })
  assert.deepEqual(logic.deleteResult(again.status, again.body), { kind: 'requested', repeated: true })
  const d = fixture('es-186-delete-deleted.json'); assert.deepEqual(logic.deleteResult(d.status, d.body), { kind: 'deleted' })
  const b = fixture('es-186-delete-blocked.json'); assert.deepEqual(logic.deleteResult(b.status, b.body), { kind: 'blocked' })
  assert.equal(logic.deleteResult(200, { message: 'algo' }).kind, 'error'); assert.equal(logic.deleteResult(202, {}).kind, 'error')
  assert.equal(logic.deleteResult(403, { code: 'superadmin_only' }).message, 'Solo la superadministración puede hacer esto.')
  assert.equal(logic.deleteResult(409, { code: 'deletion_pending' }).message, 'La cuenta ya tiene una solicitud de eliminación.')
  assert.equal(logic.deleteResult(0, null).message, 'Error de conexión.')
})

test('eliminar (ES-274): los textos dicen que se conserva lo que escribió el profesional y que puede identificar; nunca prometen anonimato ni plazo; mencionan la política de retención en definición (ES y EN)', () => {
  for (const key of ['deletionRequested', 'deleteDialog', 'deletionLocked']) {
    const es = logic.MSG[key]; const en = adminText(es, 'en')
    assert.match(es, /Solo se conservan las notas y registros que escribió su profesional, que pueden contener datos que la identifiquen\. La política de retención está en definición\./, key)
    assert.match(en, /Only the notes and records written by their professional are kept, and they may contain data that identifies the person\. The retention policy is being defined\./, key + ' (EN)')
    for (const text of [es, en]) assert.doesNotMatch(text, /\b\d+\s*(días|dias|horas|semanas|days|hours|weeks)\b|inmediat|se completa en el proceso|anonim|desvincul|unlink/i, key)
  }
  for (const name of ['es-186-delete-requested.json', 'es-186-delete-repeated.json']) {
    const message = fixture(name).body.message
    assert.match(message, /Solo se conservan las notas y registros que escribió su profesional.*Only the notes and records written by their professional are kept/s, name)
    assert.doesNotMatch(message, /anonim|desvincul|unlink/i, name)
  }
})

test('enlace de restablecimiento: se decide por el code del servidor (superadmin_only / superadmin_target), no por su texto', () => {
  const ok = fixture('es-186-reset-link.json'); assert.equal(logic.resetLinkResult(ok.status, ok.body).ok, true)
  const target = fixture('es-186-reset-link-superadmin-403.json')
  assert.equal(target.body.code, 'superadmin_target'); assert.match(logic.resetLinkResult(target.status, target.body).message, /otro superadmin/)
  const only = fixture('es-186-reset-link-superadmin-only.json')
  assert.equal(only.body.code, 'superadmin_only'); assert.equal(logic.resetLinkResult(only.status, only.body).message, 'Solo la superadministración puede hacer esto.')
  // el texto del servidor ya no importa: sin code, un 403 es un permiso genérico
  assert.equal(logic.resetLinkResult(403, { error: 'Solo el superadmin puede enviar enlaces de restablecimiento.' }).message, 'No tienes permiso para hacer esto.')
  assert.equal(logic.resetLinkResult(404, {}).message, 'No se encontró.')
})

test('emparejamientos y solicitudes: 409 request_closed se dice y recarga la lista; otro error no la recarga', () => {
  const closed = fixture('es-186-matching-closed.json')
  assert.deepEqual(logic.resolveResult(closed.status, closed.body), { kind: 'closed', message: 'Otra persona ya resolvió esta solicitud. La lista se actualizó.' })
  assert.deepEqual(logic.resolveResult(200, {}), { kind: 'ok' })
  assert.equal(logic.resolveResult(409, { code: 'person_unavailable' }).kind, 'error')
  assert.equal(logic.resolveResult(404, {}).message, 'No se encontró.')
})

test('lista de personas (D0): la forma REAL trae deletionRequested; el estado manda eliminación > inactiva > bloqueada > activa y los filtros usan ese estado', () => {
  const list = fixture('es-186-user-list.json')
  const item = list.body[0]
  assert.equal(item.deletionRequested, true); assert.equal(typeof item.isLocked, 'boolean'); assert.ok(Object.hasOwn(item, 'lockedUntil') && Object.hasOwn(item, 'plan') && Object.hasOwn(item, 'therapistId'))
  assert.equal(logic.statusOf(item), 'deletion')
  assert.equal(logic.statusOf({ active: false, isLocked: true, deletionRequested: false }), 'inactive')
  assert.equal(logic.statusOf({ active: true, isLocked: true, deletionRequested: false }), 'locked')
  assert.equal(logic.statusOf({ active: true, isLocked: false, deletionRequested: false }), 'active')
  const people = [item, { ...item, id: 2, role: 'therapist', deletionRequested: false, active: true }, { ...item, id: 3, deletionRequested: false, active: true, isLocked: true }]
  assert.deepEqual(logic.filterPeople(people, '', 'locked').map((p) => p.id), [3])
  assert.deepEqual(logic.filterPeople(people, 'therapist', '').map((p) => p.id), [2])
  assert.deepEqual(logic.filterPeople(people, '', '').length, 3)
  assert.deepEqual(logic.assignableRoles('admin'), ['user', 'therapist']); assert.equal(logic.assignableRoles('superadmin').length, 5)
})

test('E186-9: la hora local que ya termina en punto no recibe otro («8:01 a. m.» + «.»)', () => {
  const es = formatExpiry('2026-11-13T13:01:00.000Z', 'es')
  assert.match(es, /[ap]\. ?m\.$/i, es)
  assert.equal(logic.endSentence(es), es, 'no se duplica el punto'); assert.equal(logic.endSentence('10 nov'), '10 nov.')
  assert.ok(!logic.endSentence(es).endsWith('..'))
})

test('E186-8: los roles se muestran con nombre traducible, nunca el identificador técnico', () => {
  assert.deepEqual(Object.keys(logic.ROLE_LABEL).sort(), [...logic.ROLES].sort())
  for (const role of logic.ROLES) { assert.notEqual(logic.ROLE_LABEL[role], role); assert.notEqual(adminText(logic.ROLE_LABEL[role], 'en'), logic.ROLE_LABEL[role], `${role} sin inglés`) }
})

test('ES/EN: todo texto de la lógica (mensajes por código, estados, pestañas y MSG) tiene su inglés', () => {
  const codes = ['deletion_pending', 'superadmin_only', 'superadmin_target', 'target_rank', 'last_superadmin', 'has_dependent_data', 'request_closed', 'invalid_email', 'email_taken', 'role_not_allowed', 'rate_limited', 'invalid_request_id', 'invalid_id', 'person_unavailable']
  const texts = new Set([...Object.values(logic.MSG), ...Object.values(logic.TAB_LABEL), ...Object.values(logic.STATUS_LABEL), ...Object.values(logic.ROLE_LABEL),
    ...codes.map((code) => logic.errorMessage(409, { code })), logic.errorMessage(0), logic.errorMessage(403), logic.errorMessage(404), logic.errorMessage(409), logic.errorMessage(500), logic.errorMessage(400),
    logic.resetLinkResult(202, {}).message])
  const missing = [...texts].filter((text) => adminText(text, 'en') === text)
  assert.deepEqual(missing, [], 'sin traducción: ' + missing.join(' | '))
})

test('E186-5/E186-7 y sin alert(): diálogos accesibles, 401 lleva al inicio de sesión y toda la red pasa por una sola puerta', () => {
  const dir = resolve(here, '../src/pages/admin')
  const mine = readdirSync(dir).filter((f) => /^(AdminUsers.*|AdminDialog)\.tsx$|^adminUsers.*\.ts$/.test(f))
  assert.ok(mine.length >= 8, mine.join())
  for (const file of mine) {
    const text = source(file)
    assert.doesNotMatch(text, /\b(alert|confirm|prompt)\(/, `${file}: sin diálogos del navegador`)
    assert.doesNotMatch(text, /catch\s*\{\s*\/\*\s*silent/i, `${file}: no se traga errores`)
    assert.doesNotMatch(text, /type="password"|localStorage\.setItem|console\.log/, file)
    if (file.endsWith('.tsx')) assert.doesNotMatch(text, /\bfetch\(/, `${file}: la red pasa por adminRequest`)
  }
  const dialog = source('AdminDialog.tsx')
  assert.match(dialog, /role="dialog"/); assert.match(dialog, /aria-modal="true"/); assert.match(dialog, /aria-labelledby/); assert.match(dialog, /modalKeyDown\(/)
  assert.match(dialog, /opener\.current\.focus\(\)/, 'el foco vuelve al botón que abrió el diálogo')
  const api = source('adminUsersApi.ts')
  assert.match(api, /res\.status === 401\) invalidateStoredSession\(token\)/)
  assert.match(api, /status: 0, data: null/, 'sin red: estado 0, no una excepción')
  // cada pestaña tiene su rol ARIA y su propio error con «Reintentar»
  const shell = source('AdminUsers.tsx')
  for (const aria of ['role="tablist"', 'role="tab"', 'role="tabpanel"', 'aria-selected', 'aria-controls']) assert.ok(shell.includes(aria), aria)
  assert.match(source('AdminUsersQueues.tsx'), /role="alert"[\s\S]*Reintentar/); assert.match(source('AdminUsersPeople.tsx'), /role="alert"[\s\S]*Reintentar/)
})

test('seguridad y privacidad de la pantalla: el nombre exacto sigue siendo obligatorio para eliminar y las acciones privilegiadas solo se ofrecen a superadmin', () => {
  const manage = source('AdminUsersManage.tsx')
  assert.match(manage, /deleteInput !== person\.name/); assert.match(manage, /disabled=\{deleteInput !== person\.name/)
  assert.match(manage, /isSuper &&/, 'enlace de restablecimiento y eliminar solo para superadmin')
  assert.match(manage, /requestsDeletion \? tr\('Solicitar eliminación…'\) : tr\('Eliminar…'\)/)
  assert.doesNotMatch(manage, /\.destroy|permanentemente/i, 'ya no se promete un borrado inmediato')
  const invite = source('AdminUsersInvite.tsx')
  assert.match(invite, /attempt\.idFor\(email, role\)/); assert.match(invite, /requestId/); assert.match(invite, /attempt\.renew\(\)/)
})

test('E228-1: tras el 409 has_dependent_data se ofrece «Desactivar en su lugar» (solo si la cuenta está activa), que pasa por la confirmación de desactivar, con foco y en ES/EN', () => {
  const manage = source('AdminUsersManage.tsx')
  assert.ok(manage.includes("setMode('main'); setDeleteInput(''); setBlocked(true)"), 'el 409 cierra el diálogo de eliminar y marca el bloqueo')
  assert.ok(manage.includes("blocked && mode === 'main' && person.active && !locked"), 'solo con cuenta activa y sin eliminación en curso')
  assert.ok(manage.includes("autoFocus onClick={() => { setBlocked(false); setMsg(null); setMode('deactivate') }}"), 'con foco y hacia la confirmación existente')
  assert.ok(manage.includes("{tr('Desactivar en su lugar')}"))
  assert.ok(manage.includes("setMode('delete'); setMsg(null); setBlocked(false)"), 'volver a abrir eliminar limpia el bloqueo')
  assert.equal(adminText('Desactivar en su lugar', 'en'), 'Deactivate instead')
  assert.equal((manage.match(/body: { active }/g) || []).length, 1, 'la acción final sigue siendo la de desactivar, no un camino nuevo al servidor')
})
