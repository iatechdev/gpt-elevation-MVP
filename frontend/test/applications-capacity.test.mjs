import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { parseCapacity, capacityNotice } from '../src/pages/admin/applicationsCapacity.ts'

const open = { full: false, pending: 3, maxPending: 200, bytes: 1024 * 1024, maxBytes: 1024 * 1024 * 1024 }
const closed = { ...open, full: true, pending: 200, bytes: 812 * 1024 * 1024 }

test('ES-107: sin tope alcanzado no hay aviso; con el tope alcanzado el aviso trae las cifras reales', () => {
  assert.equal(capacityNotice(open), null)
  assert.equal(capacityNotice(null), null)
  const notice = capacityNotice(closed)
  assert.equal(notice.title, 'El formulario público está cerrado')
  assert.match(notice.body, /200 de 200 pendientes/)
  assert.match(notice.body, /812 de 1024 MB/)
  assert.match(notice.body, /Por ahora no estamos recibiendo solicitudes/)
})

test('ES-107: una respuesta que no es el contrato no produce aviso ni cifras inventadas', () => {
  assert.deepEqual(parseCapacity(closed), closed)
  for (const bad of [null, undefined, 'x', 1, [], {}, { full: 'true' }, { ...closed, pending: -1 }, { ...closed, maxBytes: NaN }, { ...closed, bytes: '5' }, { full: true }]) {
    assert.equal(parseCapacity(bad), null, JSON.stringify(bad))
  }
})

test('ES-107: el panel consulta el cupo al cargar y tras cada revisión, muestra el aviso con role=status y ignora un fallo de la consulta', () => {
  const source = fs.readFileSync(new URL('../src/pages/admin/ProfessionalApplicationsPanel.tsx', import.meta.url), 'utf8')
  assert.match(source, /professional-applications\/capacity/)
  assert.match(source, /role="status"[^>]*data-testid="capacity-notice"|data-testid="capacity-notice"[^>]*role="status"/)
  // La consulta del cupo vive dentro de load(), que también corre tras aprobar, rechazar y eliminar.
  assert.match(source, /const load = useCallback[\s\S]*capacity[\s\S]*\[filter, token\]/)
  assert.match(source, /setCapacity\(null\)/)
})
