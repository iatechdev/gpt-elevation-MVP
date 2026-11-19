// ES-279 (pantalla) · Lógica del aviso de conflicto de edición simultánea en «Textos públicos» y su cableado. La medición con DOS superadministradores reales, PostgreSQL real y navegador la hace
// scripts/es279-conflicto-check.cjs (con CONTROL=1 sobre main demuestra el pisado en silencio).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { expectedFor, readSaveOutcome, readVersions } from '../src/pages/admin/landingVersions.ts'
import { adminEnglish } from '../src/i18n/adminCopy.ts'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')
const content = read('../src/pages/admin/AdminContent.tsx'); const conflict = read('../src/pages/admin/LandingConflict.tsx'); const panel = read('../src/pages/admin/LandingPendingPanel.tsx')

test('ES-279: readVersions toma key → updatedAt y descarta lo mal formado; algo que no es lista = null (error de carga, nunca «sin protección» en silencio)', () => {
  assert.deepEqual(readVersions([{ key: 'hero_title', lang: 'es', value: 'x', updatedAt: '2026-11-19T10:00:00.000Z', updatedBy: 'A' }, { key: 5, updatedAt: 'x' }, { key: 'k', updatedAt: '' }, null, 'x', { key: 'cta_primary', updatedAt: '2026-11-19T11:00:00.000Z' }]), { hero_title: '2026-11-19T10:00:00.000Z', cta_primary: '2026-11-19T11:00:00.000Z' })
  assert.equal(readVersions({ error: 'x' }), null); assert.equal(readVersions(null), null); assert.equal(readVersions('texto'), null); assert.deepEqual(readVersions([]), {})
})

test('ES-279: expectedFor devuelve la versión leída o null si el texto aún no tenía registro (nunca undefined, ni prototipo)', () => {
  const versions = { hero_title: '2026-11-19T10:00:00.000Z' }
  assert.equal(expectedFor(versions, 'hero_title'), '2026-11-19T10:00:00.000Z'); assert.equal(expectedFor(versions, 'cta_primary'), null)
  for (const key of ['toString', '__proto__', 'constructor', 'hasOwnProperty']) assert.equal(expectedFor(versions, key), null, key)
})

test('ES-279: readSaveOutcome — 200 con o sin updatedAt, 409 version_conflict con current (o null si el texto ya no existe), 403, y cualquier otra cosa es error', () => {
  assert.deepEqual(readSaveOutcome(200, { message: 'ok', updatedAt: '2026-11-19T10:00:00.000Z' }), { kind: 'saved', updatedAt: '2026-11-19T10:00:00.000Z' })
  assert.deepEqual(readSaveOutcome(200, { message: 'ok' }), { kind: 'saved', updatedAt: null }); assert.deepEqual(readSaveOutcome(200, null), { kind: 'saved', updatedAt: null })
  const current = { value: 'Texto ajeno', updatedAt: '2026-11-19T10:05:00.000Z', updatedBy: 'Admin Alfa' }
  assert.deepEqual(readSaveOutcome(409, { code: 'version_conflict', error: 'x', current }), { kind: 'conflict', current })
  assert.deepEqual(readSaveOutcome(409, { code: 'version_conflict', current: null }), { kind: 'conflict', current: null })
  assert.deepEqual(readSaveOutcome(409, { code: 'version_conflict', current: { value: 5 } }), { kind: 'conflict', current: null }, 'current inutilizable = el texto ya no existe')
  assert.deepEqual(readSaveOutcome(409, { code: 'version_conflict', current: { value: 'v', updatedAt: '2026-11-19T10:05:00.000Z' } }), { kind: 'conflict', current: { value: 'v', updatedAt: '2026-11-19T10:05:00.000Z', updatedBy: null } })
  assert.deepEqual(readSaveOutcome(403, {}), { kind: 'forbidden' })
  for (const [status, body] of [[409, { code: 'otra' }], [409, null], [400, { code: 'invalid_input' }], [500, {}], [0, null], [401, {}]]) assert.deepEqual(readSaveOutcome(status, body), { kind: 'error' }, String(status))
})

test('ES-279: el cableado envía la versión, no pierde lo escrito y los dos botones hacen lo aprobado (leído del fuente)', () => {
  assert.match(content, /\/api\/landing-content\/versions\?lang=\$\{lang\}/, 'lee /versions al cargar'); assert.match(content, /expectedUpdatedAt: sent/); assert.match(content, /expectedFor\(versionsRef\.current, key\)/)
  assert.match(content, /versionsRef\.current = \{ \.\.\.versionsRef\.current, \[key\]: outcome\.updatedAt \}/, 'renueva la versión tras cada guardado')
  assert.match(content, /conflicts\[key\]\?\.current\?\.updatedAt \?\? null/, '«Conservar la mía» reenvía con current.updatedAt o null')
  const useTheirs = content.slice(content.indexOf('const useTheirs'), content.indexOf('const keepMineRow'))
  assert.doesNotMatch(useTheirs, /saveField|fetch\(/, '«Usar la suya» NO guarda'); assert.match(useTheirs, /versionsRef\.current = \{ \.\.\.versionsRef\.current, \[key\]: theirs\.updatedAt \}/)
  assert.match(content, /if \(v\.status !== 403\) \{ if \(!v\.ok\) throw new Error\('versions'\)/, 'sin /versions (que no sea 403) es error de carga: no se edita sin protección')
  assert.match(content, /conflict\?: |conflict: Conflict \| null/); assert.match(content, /aria-invalid=\{conflict \? true : undefined\} aria-describedby=\{conflict \? conflictId\(fieldKey\) : undefined\}/)
  assert.match(panel, /conflicts\[item\.key\]/, 'el panel de pendientes también muestra el conflicto')
})

test('ES-279: el aviso usa role=alert (Banner de error), foco en la primera acción, aria-expanded en «Ver su versión», «Usar la suya» solo con su versión abierta y sin «Ver su versión» si el texto ya no existe', () => {
  assert.match(conflict, /<Banner kind="error"/); assert.match(conflict, /aria-expanded=\{open\}/); assert.match(conflict, /querySelector\('button'\)\?\.focus\(\)/)
  assert.match(conflict, /\{current && <Button[^>]*aria-expanded/); assert.match(conflict, /\{current && open && <Button[^>]*onClick=\{onUseTheirs\}/)
})

test('ES-279: cada texto nuevo tiene su traducción al inglés exacta de la aprobada (comentario 12124) y no hay claves sueltas', () => {
  const expected = {
    'Otra persona guardó este texto mientras lo editabas. Tus cambios siguen en esta pantalla.': 'Someone else saved this text while you were editing it. Your changes are still on this screen.',
    'Ver su versión': 'See their version', 'Ocultar su versión': 'Hide their version', 'Conservar la mía': 'Keep mine', 'Usar la suya': 'Use theirs',
    'Su versión coincide con lo que tienes en pantalla.': 'Their version matches what you have on screen.', 'Su versión': 'Their version', 'Guardado por': 'Saved by',
  }
  for (const [es, en] of Object.entries(expected)) { assert.equal(adminEnglish[es], en, es); assert.ok(conflict.includes(`tr('${es}')`), 'se usa: ' + es) }
})
