// ES-164: la lista de evidencias filtra por ESTADO (todas / borrador / confirmada) y tres textos dicen el efecto real.
// Estructura y textos; el comportamiento (filtro, foco, anuncio, axe) lo mide scripts/es164-check.cjs en navegador.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { evidenceEs, evidenceEn } from '../src/evidence/copy.ts'

const page = readFileSync(new URL('../src/pages/EvidencePages.tsx', import.meta.url), 'utf8')

test('ES-164: filtro por estado con radios nativos, fieldset/legend y conteo en región aria-live; filtra en el cliente', () => {
  assert.match(page, /<fieldset className="evidence-filter"><legend>\{t\('evidence\.filter_status'\)\}<\/legend>/)
  assert.match(page, /\(\['all', 'draft', 'confirmed'\] as const\)\.map\(value => <label key=\{value\}><input type="radio" name="evidence-status"/)
  assert.match(page, /<p role="status" aria-live="polite" className="evidence-count">/)
  assert.match(page, /state\.rows\.filter\(row => filter === 'all' \|\| row\.status === filter\)/)
  assert.match(page, /\{t\('evidence\.filter_none'\)\} <button type="button" className="elv-link" onClick=\{\(\) => setFilter\('all'\)\}>/)
  // el filtro no cambia las llamadas al servidor
  assert.ok(!/api\.list\([^)]*filter/.test(page))
})

test('ES-164: textos ES/EN del filtro, borrar, revisar e incierto, sin promesas ni evaluación de la persona', () => {
  assert.equal(evidenceEs['evidence.filter_status'], 'Estado'); assert.equal(evidenceEn['evidence.filter_status'], 'Status')
  assert.equal(evidenceEs['evidence.filter_none'], 'No hay evidencias con este estado.'); assert.equal(evidenceEn['evidence.filter_none'], 'No entries with this status.')
  assert.equal(evidenceEs['evidence.filter_show_all'], 'Ver todas'); assert.equal(evidenceEn['evidence.filter_show_all'], 'Show all')
  assert.equal(evidenceEs['evidence.delete_body'], 'Se borra con todas sus versiones. Los niveles que registraste sobre ella quedan sin respaldo. No se puede deshacer.')
  assert.equal(evidenceEn['evidence.delete_body'], 'It is deleted with all its versions. Any levels you recorded on it are left without support. This cannot be undone.')
  assert.equal(evidenceEs['evidence.review_effect'], 'Al confirmar, esta versión queda como respaldo de tu nivel.')
  assert.equal(evidenceEn['evidence.review_effect'], 'Once confirmed, this version supports your level.')
  assert.equal(evidenceEs['evidence.uncertain_write'], 'Tu texto sigue aquí. Reintenta y no se duplica.')
  assert.equal(evidenceEn['evidence.uncertain_write'], 'Your text is still here. Retry and it will not be duplicated.')
  // la línea de revisión no promete un nivel concreto
  for (const text of [evidenceEs['evidence.review_effect'], evidenceEn['evidence.review_effect']]) assert.ok(!/\d|%|garantiz|guarantee|will reach|alcanzar/i.test(text))
  for (const key of Object.keys(evidenceEs)) assert.ok(evidenceEn[key], `falta EN para ${key}`)
})

test('ES-164: la línea «queda como respaldo de tu nivel» va sobre el aviso de la revisión', () => {
  assert.match(page, /<p>\{l\('review_effect'\)\}<\/p><p className="evidence-warning">\{l\('warning'\)\}<\/p>/)
})
