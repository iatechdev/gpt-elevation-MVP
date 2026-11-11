import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { landingFieldLabel } from '../src/pages/admin/landingLabels.ts'

const catalog = JSON.parse(fs.readFileSync(new URL('../../shared/landing-content.json', import.meta.url), 'utf8'))

test('ES-185: every catalog key has a distinct readable label in both interface languages', () => {
  for (const lang of ['es', 'en']) {
    const labels = catalog.map(({ key }) => landingFieldLabel(key, lang))
    assert.equal(new Set(labels).size, labels.length)
    for (const label of labels) assert.doesNotMatch(label, /landing\.|_/)
  }
  assert.equal(landingFieldLabel('landing.nav.skip', 'es'), 'Navegación · Saltar al contenido')
  assert.equal(landingFieldLabel('landing.faq.q1', 'en'), 'Frequently asked questions · Question 1')
  assert.throws(() => landingFieldLabel('landing.unknown_field', 'es'), /Missing landing field label/)
})
