// ES-247: permisos por fuente de El Puente con resultado incierto + foco durante el guardado (E190-1).
// Estructura y textos; el comportamiento real (respuesta perdida contra servidor y base reales, foco en Chromium) lo mide scripts/es247-api-integration.cjs.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { bridgeCopy } from '../src/bridge/copy.ts'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const panel = read('../src/bridge/SourcesPanel.tsx')

test('ES-247: si guardar falla (salvo sesión vencida) se relee el permiso real antes de informar', () => {
  assert.match(panel, /if \(error instanceof SourcesError && error\.kind === 'expired'\) onExpired\(\); else await verify\(source, granted\)/)
  assert.match(panel, /if \(fresh\[source\] === granted\) \{ settle\(source, granted\); return \}/)
  // no se afirma nada cuando ni siquiera se puede leer: la fuente queda «Sin confirmar» con «Comprobar»
  assert.match(panel, /setUnsure\(\{ source, granted \}\)/)
  assert.match(panel, /doubt && unsure\n\s+\? <button type="button" className="bridge-cta" data-source=\{source\}[^\n]*c\.src_check/)
  assert.match(panel, /const on = perms\[source\] && !doubt/)
})

test('ES-247 E190-1: durante el guardado el foco pasa a la sección o al diálogo (tabindex -1) y vuelve al interruptor', () => {
  assert.match(panel, /<section ref=\{section\} tabIndex=\{-1\}/)
  assert.match(panel, /role="dialog" aria-modal="true" aria-labelledby="bridge-dlg-title" tabIndex=\{-1\}/)
  assert.match(panel, /\(asking \? dialog\.current : section\.current\)\?\.focus\(\)/)
})

test('ES-247 textos ES/EN: el aviso de retiro incierto dice que la IA puede seguir leyendo; mismas claves', () => {
  assert.match(bridgeCopy.es.src_unsure_off, /la IA todavía pueda leer \{source\}/)
  assert.match(bridgeCopy.en.src_unsure_off, /AI may still be able to read \{source\}/)
  assert.match(bridgeCopy.es.src_not_seen_off, /la IA aún puede leer/)
  assert.equal(bridgeCopy.es.src_check, 'Comprobar'); assert.equal(bridgeCopy.en.src_check, 'Check')
  assert.deepEqual(Object.keys(bridgeCopy.es).sort(), Object.keys(bridgeCopy.en).sort())
})
