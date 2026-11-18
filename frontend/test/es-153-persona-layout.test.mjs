// ES-153 (paso 1): PersonLayout sobre /app/*. Reglas estructurales; el comportamiento (marco fijo entre pantallas, foco, tema, axe, 390/320 px) lo mide scripts/es153-layout-check.cjs.
import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
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
  assert.equal(isMigratedPersonPath('/app/skill-mapa'), false); assert.equal(isMigratedPersonPath('/app/compass'), false)
})

test('ES-153 P1: SpaceShell, SpaceDialog y SpaceNav ya no existen (nadie dibuja encabezado, idioma ni main propios); chat y dashboard no montan SpaceNav; un solo <main> en las pantallas de persona', () => {
  // ES-319: SpaceShell y SpaceDialog se retiraron (sin importadores); lo que afirmaba esta prueba (nada dibuja encabezado, idioma, SpaceNav ni main) se conserva.
  for (const gone of ['SpaceShell', 'SpaceDialog', 'SpaceNav']) assert.equal(existsSync(new URL(`../src/space/${gone}.tsx`, import.meta.url)), false, gone)
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
  // ES-333 (PR 1): el mismo compromiso (la caja con «Límites del asistente» queda pegada abajo y a la vista, y la página solo se desplaza si el marco no cabe) ya no depende de una media query ni de una altura fija: el marco es una columna de 100dvh que se desplaza, el hilo reparte el alto restante y la caja es sticky. La altura real la mide scripts/es333-chat-alturas.cjs.
  // ES-333 (PR 2): el marco es la columna de 100dvh y el <div> del Suspense, <main>, el contenedor y el hilo reparten el alto restante; barra y caja (flex: none, sin scroll propio) quedan siempre a la vista y el marco solo se desplaza si ni así cabe.
  assert.ok(space.includes('.cg-frame:has(.chat-shell) { height: 100dvh; overflow-y: auto; }'))
  assert.ok(space.includes('.cg-main .chat-shell { flex: 1 1 0; height: auto; min-height: 0; overflow: visible; }') && space.includes('.cg-main .chat-input-bar { max-height: none; overflow: visible; }'))
  assert.doesNotMatch(space, /max-height: 760px/)
})

test('ES-153 P2: SpaceNav y SpaceSkip están retirados (sin archivo, sin importaciones, sin CSS propio); el salto y la navegación los pone el marco de persona', () => {
  assert.equal(existsSync(new URL('../src/space/SpaceNav.tsx', import.meta.url)), false)
  assert.equal(existsSync(new URL('../src/space/SpaceSkip.tsx', import.meta.url)), false)
  const css = read('../src/space/space.css')
  assert.ok(!/space-nav|space-tabs|space-menu/.test(css), 'sin reglas de la barra antigua')
  assert.ok(css.includes('.space-skip'), 'el enlace de salto de la solicitud profesional conserva su estilo')
})

// ES-319: ningún archivo de src importa lo retirado; space.css ya no lleva reglas de diálogo nativo, rejillas ni planes sin uso; E289-1: los botones del diálogo de «Retirar todo» no se deshabilitan con el foco dentro.
test('ES-319: sin importadores de lo retirado; space.css podado; «Retirar todo» usa aria-disabled en el diálogo', () => {
  const walk = dir => readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(new URL(`${e.name}/`, dir)) : [new URL(e.name, dir)])
  for (const file of walk(new URL('../src/', import.meta.url)).filter(u => /\.(tsx?|css)$/.test(u.pathname))) assert.doesNotMatch(readFileSync(file, 'utf8'), /from ['"][^'"]*\/Space(Shell|Dialog|Nav)['"]/, file.pathname)
  const css = read('../src/space/space.css')
  assert.doesNotMatch(css, /\.space-(grid|plan|dialog|dashboard-nav|error|danger|warning|body)\b|\.space-scope dialog|\.bridge\b/)
  const bridge = read('../src/bridge/BridgePage.tsx')
  assert.match(bridge, /aria-disabled=\{busy\} onClick=\{closeAll\}/); assert.match(bridge, /aria-disabled=\{busy\} onClick=\{\(\) => void withdrawAll\(\)\}/); assert.match(bridge, /if \(busy\) return\n/)
})

// ES-333 (E316-1 / E316-2): contraste de los avisos del hilo y mutantes que las pruebas unitarias no detectaban.
test('ES-333: /app/chat está en MIGRATED_PERSON_PATHS y sin pie (E316-2)', () => {
  assert.ok(MIGRATED_PERSON_PATHS.includes('/app/chat'))
  assert.equal(isMigratedPersonPath('/app/chat'), true)
  assert.equal(personFooterHidden('/app/chat'), true)
})

test('ES-333: «Administración» del chat solo para admin y superadmin (E316-2) y los avisos del hilo usan el color del sistema (E316-1)', () => {
  const chat = read('../src/pages/ChatPage.tsx')
  assert.match(chat, /onAdmin=\{\['admin', 'superadmin'\]\.includes\(role\) \? openAdmin : undefined\}/)
  const css = read('../src/space/space.css')
  assert.match(css, /\.chat-shell \.space-callout \{ color: var\(--cg-ink\); \}/)
})
