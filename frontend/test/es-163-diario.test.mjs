// ES-163: guardar una entrada nueva del diario es idempotente con requestId (reintentar un guardado incierto no duplica), y el borrado avisa en las palabras del criterio.
// Pruebas de estructura y de textos; el comportamiento (doble clic, ACK perdido, reintento con el mismo requestId) lo mide scripts/es163-check.cjs en navegador.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { journalCopy } from '../src/space/journalCopy.ts'
import { copy } from '../src/space/copy.ts'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const page = read('../src/space/JournalPage.tsx')

test('ES-163: cada borrador NUEVO lleva un requestId que se reutiliza al reintentar y se renueva tras confirmar; editar (PUT) no lo envía', () => {
  assert.match(page, /const requestId = useRef\(crypto\.randomUUID\(\)\)/)
  assert.match(page, /JSON\.stringify\(saved \? \{ date, content \} : \{ date, content, requestId: requestId\.current \}\)/)
  assert.match(page, /setSaved\(row\); setEditing\(false\); setNotice\(c\.saved\); requestId\.current = crypto\.randomUUID\(\)/)
  // el identificador nunca se guarda en almacenamiento ni en la URL (el borrador vive solo en la pestaña)
  assert.ok(!/localStorage\.setItem|sessionStorage\.setItem/.test(page.replace(/localStorage\.getItem/g, '')))
})

test('ES-163: «Reintentar guardar» solo aparece tras un guardado incierto de una entrada NUEVA y repite el envío con el mismo requestId', () => {
  assert.match(page, /const save = async \(retry = false\) => \{\s*if \(lock\.current \|\| \(uncertain && !retry\) \|\| conflict\) return/)
  assert.match(page, /if \(retry\) \{ setUncertain\(null\); setInspection\(false\) \}/)
  assert.match(page, /\{uncertain === 'create' && <><button className="elv-btn elv-btn-primary" disabled=\{busy\} onClick=\{\(\) => void save\(true\)\}>\{j\.retrySave\}<\/button><p className="space-note">\{j\.retryHint\}<\/p><\/>\}/)
  // el candado y el bloqueo de campos siguen: no hay doble envío mientras se guarda
  assert.match(page, /disabled=\{busy \|\| !!uncertain\}/)
  assert.ok((page.match(/requestId\.current/g) || []).length === 2) // una vez al enviar, una al renovar
})

test('ES-163: textos ES/EN de «Reintentar guardar» y del borrado, sin promesas y con la nota de límites intacta', () => {
  assert.equal(journalCopy.es.retrySave, 'Reintentar guardar'); assert.equal(journalCopy.en.retrySave, 'Try saving again')
  assert.match(journalCopy.es.retryHint, /una sola vez/); assert.match(journalCopy.en.retryHint, /only once/)
  assert.equal(copy.es.deleteWarning, 'No se puede deshacer. Lo que escribiste se borra de tu diario.')
  assert.equal(copy.en.deleteWarning, 'This cannot be undone. What you wrote is deleted from your journal.')
  for (const lang of ['es', 'en']) assert.ok(copy[lang].deleteLimit?.length > 40, `${lang}: la nota de límites del borrado se conserva`) // «no borra mensajes ya confirmados…»
  const dialog = read('../src/space/JournalPage.tsx').match(/dialog === 'delete' \? `\$\{c\.deleteWarning\} \$\{c\.deleteLimit\}`/)
  assert.ok(dialog, 'el diálogo de borrar muestra el aviso y la nota de límites')
})
