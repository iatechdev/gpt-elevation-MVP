// ES-199 (PERF-05): «Textos públicos» (340 campos) no repinta todas las filas por cada tecla. Cada fila guarda su texto y está memoizada con propiedades primitivas o estables.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const admin = fs.readFileSync(new URL('../src/pages/admin/AdminContent.tsx', import.meta.url), 'utf8')

test('ES-199: LandingRow está memoizada, guarda su propio texto y solo avisa al padre cuando hay que limpiar un mensaje', () => {
  assert.match(admin, /const LandingRow = memo\(function LandingRow\(\{ fieldKey, label, initial, saving, busy, message, onSave, onEdited \}/)
  assert.match(admin, /const \[value, setValue\] = useState\(initial\)/)
  // teclear actualiza solo el estado de la fila; el padre solo se entera si había un mensaje que limpiar
  assert.match(admin, /onChange=\{e => \{ setValue\(e\.target\.value\); if \(message\) onEdited\(fieldKey\) \}\}/)
  assert.match(admin, /onClick=\{\(\) => onSave\(fieldKey, value\)\}/)
})

test('ES-199: LandingTab ya no guarda el texto de cada campo en su estado ni recalcula la lista en cada render, y pasa a las filas solo valores primitivos y manejadores estables', () => {
  const tab = admin.slice(admin.indexOf('function LandingTab()'))
  assert.doesNotMatch(tab, /onChange=\{e => \{ setContent\(c => \(\{ \.\.\.c, \[f\.key\]/)
  assert.match(tab, /const fields = useMemo\(\(\) => \[/)
  assert.match(tab, /\], \[interfaceLang\]\)/)
  assert.match(tab, /const saveField = useCallback\(async \(key: string, value: string \| undefined\) => \{/)
  assert.match(tab, /\}, \[lang, token\]\)\n/)
  assert.match(tab, /const clearMessage = useCallback\(\(key: string\) => setMsgs\(m => \(\{ \.\.\.m, \[key\]: '' \}\)\), \[\]\)/)
  assert.match(tab, /<LandingRow key=\{f\.key\} fieldKey=\{f\.key\} label=\{f\.label\} initial=\{content\[f\.key\] \?\? ''\} saving=\{saving === f\.key\} busy=\{saving !== null\} message=\{msgs\[f\.key\] \?\? ''\} onSave=\{saveField\} onEdited=\{clearMessage\} \/>/)
})

test('ES-199: guardar envía el valor de LA FILA (no uno viejo del padre) y sigue ignorando un segundo guardado mientras hay uno en curso', () => {
  assert.match(admin, /body: JSON\.stringify\(\{ key, lang, value \}\)/)
  assert.match(admin, /if \(savingRef\.current\) return/)
  assert.match(admin, /savingRef\.current = true/)
})
