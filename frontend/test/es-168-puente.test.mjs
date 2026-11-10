// ES-168: El Puente. El diálogo de activar una fuente (sobre todo el DIARIO) dice la verdad completa; «Retirar todo» retira lo cruzado Y los permisos y lo dice;
// el motivo de «para revisión» por una fuente retirada y el refresco de permisos al volver a la pestaña. Estructura y textos; el comportamiento lo mide scripts/es168-check.cjs.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { bridgeCopy } from '../src/bridge/copy.ts'
import { parseContext } from '../src/compass/model.ts'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const panel = read('../src/bridge/SourcesPanel.tsx')
const page = read('../src/bridge/BridgePage.tsx')

test('ES-168: el diálogo de activar una fuente lista conteo, proveedor de IA, saltos por riesgo, confirmar cada idea y retirar', () => {
  assert.match(panel, /<li>\{c\[`dlg_count_\$\{asking\}` as keyof Copy\]\}<\/li><li>\{c\.dlg_2\}<\/li><li>\{c\.dlg_risk\}<\/li><li>\{c\.dlg_3\}<\/li><li>\{c\.dlg_4\}<\/li>/)
  const es = bridgeCopy.es; const en = bridgeCopy.en
  assert.match(es.dlg_count_diary, /hasta 10 de tus entradas propias/); assert.match(en.dlg_count_diary, /Up to 10 of your own journal entries/)
  assert.match(es.dlg_count_chat, /hasta 20/); assert.match(en.dlg_count_chat, /Up to 20/)
  for (const [lang, c] of [['es', es], ['en', en]]) {
    assert.match(c.dlg_2, lang === 'es' ? /proveedor de IA/ : /AI provider/)
    assert.match(c.dlg_risk, lang === 'es' ? /riesgo.*se saltan/ : /risky.*skipped/)
    assert.match(c.dlg_3, lang === 'es' ? /Nada se guarda ni llega a tu profesional sin que confirmes cada idea/ : /Nothing is saved or reaches your professional unless you confirm each idea/)
    assert.match(c.dlg_4, lang === 'es' ? /retirar/ : /withdraw/)
    // sin promesas de resultado profesional ni afirmaciones que el proveedor no garantiza
    for (const key of ['dlg_2', 'dlg_3', 'dlg_count_diary', 'dlg_risk']) assert.ok(!/garantiz|guarante|empleo|job offer|no se guarda en otro sitio|not stored elsewhere/i.test(c[key]), `${lang}.${key}`)
  }
})

test('ES-168: «Retirar todo» (un solo botón) pide confirmación con las dos consecuencias y retira lo cruzado y los permisos', () => {
  assert.equal(bridgeCopy.es.revokeAll, 'Retirar todo'); assert.equal(bridgeCopy.en.revokeAll, 'Withdraw everything')
  assert.match(page, /\{active\.length > 0 && <li>\{c\.withdrawAllCrossed\}<\/li>\}\{anyPerm && <li>\{c\.withdrawAllPerms\}<\/li>\}<li>\{c\.withdrawAllKeep\}<\/li>/)
  assert.match(bridgeCopy.es.withdrawAllCrossed, /tu profesional dejará de ver/); assert.match(bridgeCopy.es.withdrawAllPerms, /dejará de leer tu chat, tu diario y tu hoja de vida/)
  assert.match(bridgeCopy.es.withdrawAllKeep, /No borra/); assert.match(bridgeCopy.en.withdrawAllKeep, /does not delete/)
  // el orden: primero lo cruzado, después cada permiso activo; se relee todo y solo entonces se declara éxito
  const flow = page.slice(page.indexOf('const withdrawAll = async'))
  assert.ok(flow.indexOf('api.revoke()') < flow.indexOf('setPermission(opts, source, false)'))
  assert.match(flow, /const clean = !fresh\.active && sourceIds\.every\(source => !after\[source\]\)/)
  assert.match(flow, /clean \? \{ kind: 'ok', text: c\.withdrawAllDone \} : \{ kind: 'error', text: c\.withdrawAllUncertain \}/)
  // el botón de borrar contexto antiguo («Revocar todos» con confirmación en línea) ya no existe
  assert.ok(!/revokeAllQ\}<\/p><div><button/.test(page))
})

test('ES-168: el motivo «una fuente se retiró» sale de reviewReason del servidor (ES-229) y solo ese valor se acepta', () => {
  const base = { active: null, versions: [] }
  const version = extra => ({ version: 1, status: 'active', approvedAt: '2026-11-05T12:00:00.000Z', revokedAt: null, fields: [{ key: 'values', text: 'Texto', origin: { type: 'direct' } }], needsReview: true, ...extra })
  const withReason = parseContext({ ...base, active: version({ reviewReason: 'source_revoked' }), versions: [version({ reviewReason: 'source_revoked' })] })
  assert.equal(withReason.active.reviewReason, 'source_revoked')
  const other = parseContext({ ...base, active: version({ reviewReason: 'otra cosa' }), versions: [version({ reviewReason: 'otra cosa' })] })
  assert.equal(other.active.reviewReason, undefined)
  assert.match(page, /version\.reviewReason === 'source_revoked' \? c\.reviewSourceRevoked : c\.reviewText/)
})

test('ES-168 (G4): al volver a la pestaña se releen los permisos y se avisa solo si cambiaron', () => {
  assert.match(panel, /document\.addEventListener\('visibilitychange', refresh\)/)
  assert.match(panel, /document\.removeEventListener\('visibilitychange', refresh\)/)
  assert.match(panel, /sourceIds\.some\(source => fresh\[source\] !== permsRef\.current\?\.\[source\]\)/)
  assert.ok(bridgeCopy.es.permsChanged && bridgeCopy.en.permsChanged)
})

test('ES-168: todas las claves del Puente existen en ES y EN', () => {
  for (const key of Object.keys(bridgeCopy.es)) assert.ok(key in bridgeCopy.en, `falta EN para ${key}`)
  for (const key of Object.keys(bridgeCopy.en)) assert.ok(key in bridgeCopy.es, `falta ES para ${key}`)
})
