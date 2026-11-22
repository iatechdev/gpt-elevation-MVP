// ES-359 (B3, informe de regresión de QA-5 sobre main): en /admin/content un 403 es falta de permiso, no un fallo recuperable: se muestra el mensaje sin «Reintentar».
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')

test('B3: en /admin/content un 403 muestra la falta de permiso SIN «Reintentar»; red y 5xx conservan el reintento', () => {
  const source = read('../src/pages/admin/AdminContent.tsx')
  assert.ok(source.includes('setForbidden(r.status === 403)'))
  assert.ok(source.includes("{!forbidden && <Button variant=\"ghost\" onClick={load}>{tr('Reintentar')}</Button>}"))
  assert.ok(source.includes("setLoading(true); setLoadError(''); setForbidden(false)")) // cada carga parte limpia
  assert.ok(source.includes(".catch(() => { setDocs([]); setLoadError('No se pudieron cargar los documentos.') })")) // red: error recuperable, con reintento (forbidden queda en false)
})
