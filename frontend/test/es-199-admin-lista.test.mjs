// ES-199 (PERF-05, resto): la lista «Personas» de administración formatea fechas con un formateador por idioma (mismo resultado que toLocaleDateString) y no se repinta por un estado ajeno.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'

const read = path => fs.readFileSync(new URL(path, import.meta.url), 'utf8')
const logicSource = ts.transpileModule(read('../src/pages/admin/adminUsersLogic.ts'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText
const { formatAltaDate } = await import('data:text/javascript;base64,' + Buffer.from(logicSource).toString('base64'))

test('ES-199: formatAltaDate da exactamente lo mismo que toLocaleDateString con las mismas opciones (es-CO y en-US, fechas de borde)', () => {
  const options = { day: '2-digit', month: 'short', year: 'numeric' }
  for (const locale of ['es-CO', 'en-US']) for (const iso of ['2026-01-01T00:00:00.000Z', '2026-12-31T23:59:59.999Z', '2026-02-28T05:00:00Z', '2024-02-29T12:00:00Z', '2026-11-18T22:11:32Z']) {
    assert.equal(formatAltaDate(iso, locale), new Date(iso).toLocaleDateString(locale, options), `${locale} ${iso}`)
  }
})

test('ES-199: el formateador se crea una vez por idioma (no una vez por fila)', () => {
  const source = read('../src/pages/admin/adminUsersLogic.ts')
  assert.match(source, /const dateFormatters = new Map<string, Intl\.DateTimeFormat>\(\)/)
  assert.equal((source.match(/new Intl\.DateTimeFormat\(/g) ?? []).length, 1)
  const people = read('../src/pages/admin/AdminUsersPeople.tsx')
  assert.doesNotMatch(people, /toLocaleDateString/)
  assert.match(people, /const date = \(iso: string\) => formatAltaDate\(iso, locale\)/)
})

test('ES-199: PeoplePanel está memoizado y AdminUsers le pasa referencias estables (lista, onManage), así abrir «Gestionar» no repinta la lista', () => {
  const people = read('../src/pages/admin/AdminUsersPeople.tsx')
  const users = read('../src/pages/admin/AdminUsers.tsx')
  const api = read('../src/pages/admin/adminUsersApi.ts')
  assert.match(people, /export const PeoplePanel = memo\(function PeoplePanel\(/)
  assert.match(users, /const manage = useCallback\(\(id: number, from: HTMLElement\) => \{ opener\.current = from; setNotification\(''\); setManagingId\(id\) \}, \[\]\)/)
  assert.match(users, /onManage=\{manage\}/)
  assert.match(api, /return useMemo\(\(\) => \(\{ items, state, reload, retry \}\), \[items, state, reload, retry\]\)/)
})
