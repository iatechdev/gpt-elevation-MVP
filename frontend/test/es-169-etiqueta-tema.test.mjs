// ES-169: el tema del emparejamiento se llama «Estrés y carga» / «Stress and workload», no «Ansiedad» (producto no clínico). La clave interna 'anxiety' no cambia (contrato con el servidor).
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('ES-169: MatchingModal no muestra «Ansiedad»/«Anxiety» y conserva la clave del servidor', () => {
  const src = readFileSync(new URL('../src/components/MatchingModal.tsx', import.meta.url), 'utf8')
  assert.ok(src.includes("{ key: 'anxiety',        es: 'Estrés y carga',    en: 'Stress and workload' }"))
  assert.ok(!/es: 'Ansiedad'|en: 'Anxiety'/.test(src))
})
