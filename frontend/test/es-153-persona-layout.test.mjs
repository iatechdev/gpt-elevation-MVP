// ES-153 (paso 1): PersonLayout sobre /app/*. Reglas estructurales; el comportamiento (marco fijo entre pantallas, foco, tema, axe, 390/320 px) lo mide scripts/es153-layout-check.cjs.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { MIGRATED_PERSON_PATHS, isMigratedPersonPath, personFooterHidden } from '../src/shell/personLayoutState.ts'
import { shellCopy } from '../src/shell/copy.ts'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const app = read('../src/App.tsx')
const block = app.slice(app.indexOf('<Route element={<PersonLayout />}>'), app.indexOf('{/* HU-067 — sala de videollamada para el paciente'))
const appPaths = [...app.matchAll(/<Route path="(\/app\/[^"]+)"/g)].map(match => match[1])

test('ES-153 P1: todo /app/* va dentro de PersonLayout salvo la sala de sesión, que queda fuera', () => {
  assert.ok(block.length > 500 && block.trimEnd().endsWith('</Route>'))
  const inside = [...block.matchAll(/<Route path="(\/app\/[^"]+)"/g)].map(match => match[1])
  const outside = appPaths.filter(path => !inside.includes(path))
  assert.deepEqual(outside, ['/app/session/:id'])
  assert.ok(app.indexOf('<Route element={<PersonLayout />}>') > app.indexOf('<Route element={<ProtectedRoute />}>'), 'la compuerta de rol envuelve el layout')
  assert.match(app, /<Route path="\/app\/session\/:id"\s+element=\{<UserSessionRoom \/>\}/)
})

test('ES-153 P1: el marco no se desmonta entre pantallas (Suspense y límite de error van DENTRO del main), el chat no lleva pie y PersonFrame no duplica el marco', () => {
  const layout = read('../src/shell/PersonLayout.tsx')
  assert.match(layout, /<PersonChrome[^>]*>\s*<RouteErrorBoundary resetKey=\{pathname\}><Suspense fallback=\{<ScreenLoading \/>\}><Outlet \/><\/Suspense><\/RouteErrorBoundary>\s*<\/PersonChrome>/)
  assert.match(layout, /role="status" aria-live="polite"/)
  const frames = read('../src/shell/frames.tsx')
  assert.match(frames, /return inLayout \? <>\{children\}<\/> : <PersonChrome/)
  assert.equal(personFooterHidden('/app/chat'), true); assert.equal(personFooterHidden('/app/diary'), false)
  assert.ok(shellCopy.es.loadingScreen === 'Cargando la pantalla…' && shellCopy.en.loadingScreen === 'Loading the screen…')
})

test('ES-153 P1: el mecanismo «ya migró» es una lista de rutas que existen en App.tsx; las demás conservan el lienzo claro heredado', () => {
  assert.ok(MIGRATED_PERSON_PATHS.length >= 1)
  for (const path of MIGRATED_PERSON_PATHS) assert.ok(appPaths.includes(path), `${path} no es una ruta de App.tsx`)
  assert.equal(isMigratedPersonPath('/app/skill-map'), true); assert.equal(isMigratedPersonPath('/app/skill-map/x'), true)
  assert.equal(isMigratedPersonPath('/app/skill-mapa'), false); assert.equal(isMigratedPersonPath('/app/diary'), false)
})

test('ES-153 P1: SpaceShell ya no dibuja encabezado, idioma, SpaceNav ni main; chat y dashboard no montan SpaceNav; un solo <main> en las pantallas de persona', () => {
  const shell = read('../src/space/SpaceShell.tsx')
  assert.doesNotMatch(shell, /<header|<main|SpaceNav|SpaceSkip|setLang/); assert.match(shell, /space-body/)
  for (const file of ['../src/pages/ChatPage.tsx', '../src/pages/UserDashboard.tsx']) assert.doesNotMatch(read(file), /SpaceNav|id="space-main"/)
  for (const file of ['../src/career/CareerShell.tsx', '../src/compass/CompassPage.tsx', '../src/context/resume/ResumesPage.tsx', '../src/evidence/Shell.tsx', '../src/exercises/ExercisePage.tsx',
    '../src/pages/UserProgress.tsx', '../src/pilot/FeedbackPage.tsx', '../src/routeCatalog/PersonCatalog.tsx', '../src/facilitation/PersonReviews.tsx', '../src/pages/ChatPage.tsx']) assert.doesNotMatch(read(file), /<main\b/, file)
})

test('ES-153 P1: «Ejercicios opcionales» y la Brújula del chat siguen alcanzables desde «Mis herramientas»; el chat conserva sus «Límites del asistente»', () => {
  const tools = read('../src/space/SpaceToolsPage.tsx')
  assert.match(tools, /path: '\/app\/exercises'[^}]*to: '\/app\/exercises\?from=dashboard'/)
  assert.match(tools, /VITE_ENABLE_COMPASS_CHAT === 'true'[^\]]*to: '\/app\/chat\?mode=compass'/)
  assert.match(read('../src/pages/ChatPage.tsx'), /<ChatLimitsNotice \/>/)
})

test('ES-153 regresión de contraste (QA-2): la regla de enlaces del marco no pisa a.elv-btn* (primary, secondary, danger…)', () => {
  const css = read('../src/cartografia/cartografia.css')
  // Ningún selector `.cg a {color}` sin excluir los enlaces-botón heredados: (0,1,1) le gana a `.elv-btn-primary` (0,1,0) y deja azul sobre fondo oscuro (2,14:1).
  const linkRules = css.split('\n').filter(line => /^\.cg a[\s:{[]/.test(line) && /\bcolor\s*:/.test(line))
  assert.ok(linkRules.length >= 1, 'existe la regla de color de enlaces del marco')
  for (const line of linkRules) assert.match(line, /^\.cg a:not\(\[class\*='elv-btn'\]\)/, `la regla excluye a.elv-btn*: ${line}`)
})
