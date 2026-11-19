// ES-310 (PR 1): el marco de Administración distingue las pantallas migradas a Cartografía. La lista empieza VACÍA: sin cambio visual hoy; cada PR de pantalla agrega su ruta.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const code = ts.transpileModule(read('../src/shell/adminLayoutState.ts'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
const { MIGRATED_ADMIN_PATHS, isMigratedAdminPath } = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'))

test('ES-310 marco: la lista de rutas migradas contiene solo las pantallas ya migradas a Cartografía', () => {
  assert.deepEqual([...MIGRATED_ADMIN_PATHS], ['/admin/route-catalog', '/admin/users', '/admin/dashboard', '/admin/metrics', '/admin/prompts', '/admin/content', '/admin/skill-catalog', '/admin/manifest'])
  for (const path of ['/admin/route-catalog', '/admin/users', '/admin/dashboard', '/admin/metrics', '/admin/prompts', '/admin/content', '/admin/skill-catalog', '/admin/manifest']) assert.equal(isMigratedAdminPath(path), true, path)
  for (const path of ['/admin/pilot-metrics']) assert.equal(isMigratedAdminPath(path), false, path)
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

// CLS del marco: la causa medida era el cambio de tipografía de la barra lateral (Arial Narrow → Barlow Condensed: de 4 a 3 renglones = 48 px a 390 px).
test('ES-310 marco: el marco antepone reservas de tipografía con el ancho de Barlow (sin chocar con los nombres de progress.css)', () => {
  const css = read('../src/shell/shell.css')
  assert.match(css, /font-family: 'Barlow Condensed Frame'[^}]*size-adjust: 6\d%/); assert.match(css, /font-family: 'Barlow Frame'[^}]*size-adjust: 9\d%/)
  assert.match(css, /\.cg\.cg-frame \{[^}]*--cg-font-cond: 'Barlow Condensed', 'Barlow Condensed Frame', 'Arial Narrow'[^}]*--cg-font-sans: 'Barlow', 'Barlow Frame'/)
  assert.doesNotMatch(css, /font-family: 'Barlow (Condensed )?Fallback'/, 'nombre reservado por progress.css y mapCartografia.css')
})

// E331-1: las reservas solo cubren lo que Barlow cubre; «→» (Barlow no lo tiene) sigue cayendo en system-ui como en main, y el marco de persona no cambia.
test('ES-310 marco: cada reserva de tipografía lleva el unicode-range latino de Barlow y no incluye la flecha «→» (U+2192)', () => {
  const faces = read('../src/shell/shell.css').match(/@font-face \{ font-family: 'Barlow (?:Condensed )?Frame';[^}]*\}/g)
  assert.equal(faces.length, 5)
  for (const face of faces) { assert.match(face, /unicode-range: U\+0000-00FF,[^;]*U\+2000-206F[^;]*;/); assert.doesNotMatch(face, /U\+2190|U\+2192|U\+2190-21FF/) }
})
