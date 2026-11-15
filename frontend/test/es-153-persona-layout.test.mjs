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
  assert.equal(isMigratedPersonPath('/app/skill-mapa'), false); assert.equal(isMigratedPersonPath('/app/bridge'), false)
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

test('ES-153 regresión de contraste (QA-2): el color de enlace del marco tiene especificidad cero, así ninguna clase de enlace-botón de una pantalla pierde contra él', () => {
  const css = read('../src/cartografia/cartografia.css')
  // `.cg a` sin capa (0,1,1) ganaba a .elv-btn-primary (capa daisyUI: una regla sin capa siempre gana) y empataba con a.map-access-cta; en `@layer base` con :where (0,0,1) pierde contra ambos.
  assert.doesNotMatch(css, /^\.cg a[\s:{[][^\n]*color\s*:/m)
  assert.match(css, /^@layer base { :where\(\.cg\) a \{ color: var\(--cg-mark\);/m)
})

test('ES-153 E280-2/3/4: el pie no se pinta con el esqueleto, el marco y la pantalla se precargan en paralelo con la sesión y el aviso del chat bajo queda fijo y visible', () => {
  assert.match(read('../src/shell/shell.css'), /\.cg-frame:has\(\.cg-screen-loading\) \.cg-footer \{ visibility: hidden; \}/)
  assert.match(app, /const PersonLayout = lazy\(loadPersonLayout\)/)
  assert.doesNotMatch(app, /import \{ PersonLayout \} from/)
  assert.match(app, /void loadPersonLayout\(\); void PERSON_PRELOAD\[window\.location\.pathname\]\?\.\(\)/)
  for (const path of ['/app/evidence', '/app/exercises', '/app/diary', '/app/space/tools', '/app/chat', '/app/progress', '/app/dashboard', '/app/skill-map']) assert.ok(app.includes(`'${path}': () => import(`), `precarga de ${path}`)
  const space = read('../src/space/space.css')
  const short = space.slice(space.indexOf('(max-width: 600px) and (max-height: 760px)'))
  assert.match(short, /.chat-shell { height: auto;/); assert.match(short, /.chat-input-bar { position: sticky; bottom: 0;[^}]*max-height: none; overflow: visible;/)
})
