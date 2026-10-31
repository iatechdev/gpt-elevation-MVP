// ES-125: las dos pantallas que piden recomendaciones envían el idioma activo de la interfaz.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8')

test('ES-125: dashboard y chat piden las recomendaciones con { lang }', () => {
  for (const file of ['pages/UserDashboard.tsx', 'pages/ChatPage.tsx']) {
    const source = read(file)
    assert.match(source, /\/api\/recommendations\/generate'.*method: 'POST', body: JSON\.stringify\(\{ lang \}\)/, file)
    assert.match(source, /const \{[^}]*\blang\b[^}]*\} = useLanguage\(\)/, file)
  }
})
