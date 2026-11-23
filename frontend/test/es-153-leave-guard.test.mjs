// ES-153 (paso 1, P1 de Codex): los enlaces del marco de persona y «Salir» consultan los borradores sin guardar. Registro puro + cableado; el comportamiento real
// (evidencia, notas de ejercicio, diario, rechazar/aceptar, una sola pregunta) lo mide scripts/es153-draft-check.cjs.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { leaveBlocked, registerLeaveGuard } from '../src/shell/leaveGuard.ts'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')

test('ES-153 P1: leaveBlocked bloquea si alguna guardia bloquea, no pregunta a las guardias dadas de baja y respeta ownLinks solo en enlaces', () => {
  assert.equal(leaveBlocked('/app/skill-map'), false)
  const asked = []
  const off = registerLeaveGuard(to => { asked.push(['a', to]); return true })
  assert.equal(leaveBlocked('/app/skill-map'), true); assert.deepEqual(asked, [['a', '/app/skill-map']])
  off(); assert.equal(leaveBlocked('/app/skill-map'), false)
  const own = registerLeaveGuard(to => { asked.push(['own', to]); return true }, { ownLinks: true })
  assert.equal(leaveBlocked('/app/chat'), false, 'un enlace del marco no repite la pregunta del diario')
  assert.equal(leaveBlocked('/', 'action'), true, '«Salir» sí consulta al diario')
  own(); assert.equal(leaveBlocked('/', 'action'), false)
  let first = 0; let second = 0
  const g1 = registerLeaveGuard(() => { first++; return false }); const g2 = registerLeaveGuard(() => { second++; return true })
  assert.equal(leaveBlocked('/x'), true); assert.deepEqual([first, second], [1, 1]); g1(); g2()
})

test('ES-153 P1: cada guardia de borrador de las pantallas de persona se registra en el marco; el encabezado y «Salir» consultan el registro', () => {
  for (const [file, name] of [['../src/evidence/navigationGuard.ts', 'registerEvidenceGuard'], ['../src/exercises/navigationGuard.ts', 'registerExerciseGuard'],
    ['../src/compass/navigationGuard.ts', 'registerCompassGuard'], ['../src/context/contextNavigationGuard.ts', 'registerContextNavigationGuard']]) {
    const src = read(file)
    assert.match(src, /registerLeaveGuard\(\(\) => cancel\(\)\)/, `${name} registra su guardia en el marco`); assert.match(src, /leave\(\); if \(active === guard\)/, `${name} la da de baja`)
  }
  assert.match(read('../src/career/CareerShell.tsx'), /registerLeaveGuard\(to => \{[\s\S]*setPending\(to\); return true/)
  for (const file of ['../src/space/hooks.ts', '../src/pilot/hooks.ts']) assert.match(read(file), /registerLeaveGuard\((?:cancel|\(\) => \{ const stay = cancel\(\); if \(stay\) notifyStay\(\); return stay \}), \{ ownLinks: true \}\)/) // ES-374: la guardia de space/hooks.ts avisa además con notifyStay(); aserción conservada: sigue registrándose con ownLinks
  const frame = read('../src/shell/Frame.tsx')
  assert.match(frame, /<header className="cg-header" data-compact=\{compact \|\| undefined\} onClickCapture=\{guardLeave\}>/); assert.match(frame, /leaveBlocked\(href\)/)
  // ES-359: el menú de cuenta y el cajón comparten useSignOut: «Cerrar sesión» (el antiguo «Salir») consulta la guardia en un solo lugar
  assert.equal((read('../src/shell/useSignOut.ts').match(/leaveBlocked\('\/', 'action'\)/g) ?? []).length, 1, '«Cerrar sesión» consulta la guardia')
  assert.ok(read('../src/shell/AccountMenu.tsx').includes('useSignOut()'), 'el menú de cuenta usa ese cierre')
})
