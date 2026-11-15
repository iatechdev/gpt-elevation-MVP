// ES-310 (PR 1): el marco de Administración distingue las pantallas migradas a Cartografía. La lista empieza VACÍA: sin cambio visual hoy; cada PR de pantalla agrega su ruta.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const code = ts.transpileModule(read('../src/shell/adminLayoutState.ts'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
const { MIGRATED_ADMIN_PATHS, isMigratedAdminPath } = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'))

test('ES-310 marco: la lista de rutas migradas empieza vacía (este PR no cambia el aspecto de ninguna pantalla)', () => {
  assert.deepEqual([...MIGRATED_ADMIN_PATHS], [])
  for (const path of ['/admin/dashboard', '/admin/metrics', '/admin/prompts', '/admin/route-catalog', '/admin/users', '/admin/skill-catalog']) assert.equal(isMigratedAdminPath(path), false, path)
})

test('ES-310 marco: una ruta migrada coincide con ella y sus subrutas, no con prefijos parecidos; la barra final no importa', () => {
  const list = ['/admin/users', '/admin/route-catalog']
  for (const path of ['/admin/users', '/admin/users/', '/admin/users/7', '/admin/route-catalog/3/roles/x']) assert.equal(isMigratedAdminPath(path, list), true, path)
  for (const path of ['/admin/users-old', '/admin/user', '/admin', '/admin/dashboard', '/', '']) assert.equal(isMigratedAdminPath(path, list), false, path)
})

test('ES-310 marco: AdminFrame con `migrated` pide tema del sistema y quita elv-theme; `pilotPreview` se conserva; AdminLayout lo decide por la ruta', () => {
  const frames = read('../src/shell/frames.tsx'); const layout = read('../src/layouts/AdminLayout.tsx')
  assert.match(frames, /migrated \? '' : 'elv-theme'/); assert.match(frames, /theme=\{migrated \? 'system' : 'light'\}/); assert.match(frames, /pilot-admin-layout/)
  assert.match(layout, /isMigratedAdminPath\(pathname\)/); assert.match(layout, /pilotPreview=\{pilotPreview\}/)
})
