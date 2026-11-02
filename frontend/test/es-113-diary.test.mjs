import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import ts from 'typescript'
import { journalCopy, journalDate } from '../src/space/journalCopy.ts'

let code = ts.transpileModule(readFileSync(new URL('../src/space/JournalRecent.tsx', import.meta.url), 'utf8'), { compilerOptions: {
  jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022,
} }).outputText
for (const name of ['react', 'react/jsx-runtime', 'react-router-dom']) code = code.replaceAll(`'${name}'`, JSON.stringify(import.meta.resolve(name))).replaceAll(`"${name}"`, JSON.stringify(import.meta.resolve(name)))
for (const name of ['api', 'copy', 'journalCopy']) code = code.replaceAll(`'./${name}'`, JSON.stringify(new URL(`../src/space/${name}.ts`, import.meta.url).href))
const { JournalRecentList } = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'))
const row = { id: 7, date: '2026-10-29', content: '<img src=x onerror=alert(1)>\nSynthetic only', createdAt: '2026-10-29T00:00:00Z', updatedAt: '2026-10-29T00:00:00Z' }
const render = (lang, entries = [row]) => renderToStaticMarkup(createElement(MemoryRouter, null, createElement(JournalRecentList, { entries, lang, selected: 7 })))

test('ES-113: actual recent-entry TSX escapes private text and identifies the selected real route ES/EN', () => {
  for (const lang of ['es', 'en']) {
    const html = render(lang)
    assert.ok(html.includes('&lt;img'))
    assert.ok(!html.includes('<img'))
    assert.match(html, /href="\/app\/diary\/7"/)
    assert.match(html, /aria-current="page"/)
    assert.ok(html.includes(journalDate(row.date, lang)))
    assert.ok(!html.includes('UserId'))
  }
})
test('ES-113: empty list never invents entries, saved status or Bridge authorization', () => {
  for (const lang of ['es', 'en']) {
    const html = render(lang, [])
    assert.ok(!html.includes('/app/diary/7'))
    assert.ok(!html.includes('aria-current'))
    assert.ok(!html.includes('Saved'))
    assert.ok(!html.includes('Guardado'))
  }
})
test('ES-113: bilingual copy discloses manual saving and closing-tab limit; calendar date has no timezone shift', () => {
  assert.deepEqual(Object.keys(journalCopy.es).sort(), Object.keys(journalCopy.en).sort())
  for (const lang of ['es', 'en']) for (const text of Object.values(journalCopy[lang])) assert.ok(text.trim())
  assert.match(journalCopy.es.draftWarning, /antes de cerrar/)
  assert.match(journalCopy.en.draftWarning, /before closing/)
  assert.match(journalDate('2026-01-01', 'es'), /1 de enero de 2026/)
  assert.match(journalDate('2026-01-01', 'en'), /January 1, 2026/)
})
