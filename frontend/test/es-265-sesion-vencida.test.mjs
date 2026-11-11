// ES-265: un 401 en un bloque del panel profesional invalida la sesión (patrón común de las demás áreas); un 403 se dice sin «Reintentar».
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const read = (p) => readFileSync(resolve(here, p), 'utf8')

test('ES-265: useSection invalida la sesión con el token usado en un 401 y marca el 403 como «denied»', () => {
  const src = read('../src/pages/therapist/useSection.ts')
  assert.ok(src.includes("import { invalidateStoredSession } from '../../access/session'"))
  assert.ok(src.includes('if (res.status === 401) invalidateStoredSession(token)'), '401 → invalidar con el token de esa petición (no borra un login más nuevo)')
  assert.ok(src.includes("error.message === '403'"))
  assert.ok(src.includes('reload, denied'))
})

test('ES-265: el bloque con 403 no ofrece «Reintentar» y su texto existe en ES y EN', () => {
  const panel = read('../src/pages/therapist/PanelSections.tsx'), copy = read('../src/i18n/therapistCopy.ts')
  assert.ok(panel.includes("state.denied ? 'panel_section_forbidden' : 'panel_section_error'"))
  assert.ok(panel.includes('{!state.denied && <button ref={retry}'))
  assert.equal((copy.match(/\bpanel_section_forbidden:/g) ?? []).length, 2)
})
