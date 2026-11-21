// ES-237 paso 2b: del servidor a la pantalla. El comportamiento contra el servidor real y PostgreSQL lo mide scripts/es237-api-integration.cjs; aquí: el adaptador (puro) y la estructura de las pantallas.
// Reglas: nada se inventa (sintética solo si el servidor lo marca), los textos aprobados van tal cual, los textos del modo servidor no hablan de «simulación» y el simulador no cambia.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { adapt, emptyState, experimentOf, routeOf } from '../src/career/adapter.ts'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const route = (over = {}) => ({ roleKey: 'rol_a', slot: 'continuity', labels: { es: 'Rol A', en: 'Role A' }, market: 'CO', regulated: { isRegulated: false, status: 'not_regulated' },
  sources: [{ sourceKey: 's1', title: 'Fuente uno', url: 'https://example.invalid/s1', stale: false }], tasks: [{ text: { es: 'Tarea uno', en: 'Task one' } }],
  dimensions: { preferenceFit: { status: 'partial' }, demonstratedTransfer: { status: 'strong' }, viability: { status: 'conditional' } }, ...over })
const payload = (over = {}) => ({ lifecycle: 'ready', roleKey: 'rol_a', taskIndex: 0, minutes: 20, templateVersion: 1, basisHash: 'h', task: { text: { es: 'Tarea uno', en: 'Task one' } }, ...over })
const view = (over = {}, status = 'current', reasons = []) => ({ experiment: { id: 7, choiceId: 3, currentVersion: 1 }, current: { id: 1, experimentId: 7, version: 1, lifecycle: 'ready', payload: payload(over), createdAt: 'x' }, basis: { status, reasons }, versions: [{ id: 1, experimentId: 7, version: 1, lifecycle: 'ready', payload: payload(over), createdAt: 'x' }], nextAfter: null, humanReview: { status: 'not_requested', requests: [] } })
const raw = (over = {}) => ({ catalog: { contexts: [{ contextKey: 'ctx_a', labels: { es: 'Contexto A', en: 'Context A' } }], roles: [{ roleKey: 'rol_a', labels: { es: 'Rol A', en: 'Role A' } }] }, constraints: null, routes: { status: 'needs_constraints', routes: [], constraintsVersion: 0, basisHash: null, humanReview: { offered: false } }, choices: [], experiments: [], routeReviewOpen: false, catalogUnavailable: false, ...over })

test('adaptador: una persona nueva = needs_constraints, sin rutas, sin experimentos, con los contextos del catálogo', () => {
  const state = adapt(raw())
  assert.equal(state.loaded, true); assert.equal(state.source, 'api'); assert.equal(state.basis, 0); assert.deepEqual(state.routes, []); assert.equal(state.routesStatus, 'needs_constraints')
  assert.deepEqual(state.contexts, [{ key: 'ctx_a', label: { es: 'Contexto A', en: 'Context A' }, synthetic: false }])
  assert.deepEqual(emptyState().plans, []); assert.equal(emptyState().notifications, false)
})

test('adaptador: «sintética» solo si el servidor lo marca en la ruta o en una fuente; nada se infiere', () => {
  assert.equal(routeOf(route()).synthetic, false)
  assert.equal(routeOf(route({ synthetic: true })).synthetic, true)
  assert.equal(routeOf(route({ sources: [{ sourceKey: 's', title: 'T', url: 'https://x.invalid', synthetic: true }] })).synthetic, true)
  const r = routeOf(route()); assert.equal(r.id, 'rol_a'); assert.equal(r.preference, 'partialMatch'); assert.equal(r.supported, true); assert.deepEqual(r.tasks, [{ es: 'Tarea uno', en: 'Task one' }])
})

test('adaptador: contexto y transferencia desconocidos quedan desconocidos (no se vuelven coincidencia ni evidencia)', () => {
  const r = routeOf(route({ dimensions: {}, labels: {}, sources: [] }))
  assert.equal(r.preference, 'unknown'); assert.equal(r.supported, false); assert.deepEqual(r.title, { es: 'rol_a', en: 'rol_a' }); assert.equal(r.stale, false)
})

test('adaptador: una elección con la base cambiada deja de ser vigente y conserva su versión real de restricciones', () => {
  const constraints = { id: 1, version: 3, status: 'current', createdAt: 'x', payload: { targetMarkets: ['CO'], languages: ['es'], modalities: ['remote'], acceptRegulated: 'unknown', originContextKey: 'ctx_a', interestContextKeys: [], preferredModalities: [] } }
  const choices = [{ id: 3, roleKey: 'rol_a', slot: 'continuity', decision: 'accepted', basisChanged: false, constraintsVersion: 3 }, { id: 4, roleKey: 'rol_b', slot: 'exploration', decision: 'rejected', basisChanged: true, constraintsVersion: 2 }]
  const state = adapt(raw({ constraints, routes: { status: 'partial', routes: [route()], constraintsVersion: 3, basisHash: 'hash', humanReview: { offered: false } }, choices }))
  assert.equal(state.basis, 3); assert.equal(state.constraints.origin, 'ctx_a'); assert.deepEqual(state.constraints.arrangements, ['remote'])
  assert.deepEqual(state.choices.map(c => [c.id, c.decision, c.basis, c.version]), [[3, 'chosen', 3, 3], [4, 'rejected', -1, 2]])
  assert.equal(state.choices[1].route.title.es, 'rol_b', 'una ruta que ya no se propone se muestra con su clave, sin inventar un nombre')
})

test('adaptador: experimento vigente vs. «necesita revisión» (motivos del servidor; los desconocidos se descartan)', () => {
  const ok = experimentOf(view(), 3, routeOf(route())); assert.equal(ok.basis, 3); assert.deepEqual(ok.reasons, []); assert.equal(ok.phase, 'ready'); assert.equal(ok.task.es, 'Tarea uno'); assert.equal(ok.minutes, 20)
  const old = experimentOf(view({}, 'needs_review', ['rules_changed', 'experiment_changed', 'catalog_unavailable']), 3, routeOf(route())); assert.equal(old.basis, -1); assert.deepEqual(old.reasons, ['rules_changed'])
})

test('adaptador: entrega, reflexión, decisión y borradores de la versión anterior (carriedOver) se leen tal cual; la evidencia se cuenta, no se muestra', () => {
  const full = payload({ lifecycle: 'decided', submission: { sample: 'Muestra', evidenceRefs: [], assistance: { degree: 'planning', source: 'self_report' }, version: 3 }, reflection: { observation: 'O', interpretation: 'I', source: 'self_report' }, decision: { value: 'adjust', reason: 'R' },
    carriedOver: { status: 'previous_version_to_review', submission: { fromVersion: 2, sample: 'Antes', assistance: 'none', evidenceRefs: [{ evidenceId: 1, version: 1 }], retiredEvidence: 2 }, decision: { fromVersion: 2, value: 'continue', reason: 'Antes R' } } })
  const e = experimentOf(view(full), 1, routeOf(route()))
  assert.equal(e.sample, 'Muestra'); assert.equal(e.assistance, 'planning'); assert.equal(e.evidence, false); assert.equal(e.observation, 'O'); assert.equal(e.decision, 'adjust'); assert.equal(e.reason, 'R')
  assert.deepEqual(e.carried.submission, { from: 2, sample: 'Antes', assistance: 'none', evidence: true, retired: 2 }); assert.deepEqual(e.carried.decision, { from: 2, decision: 'continue', reason: 'Antes R' }); assert.equal(e.carried.reflection, undefined)
})

test('adaptador: la revisión humana pendiente trae su id para poder retirarla; una de una entrega anterior no cuenta', () => {
  const pending = { ...view(), humanReview: { status: 'pending_authorization', requests: [{ id: 9, status: 'pending_authorization', needsReview: false }, { id: 8, status: 'withdrawn', needsReview: false }] } }
  assert.deepEqual([experimentOf(pending, 1, routeOf(route())).review, experimentOf(pending, 1, routeOf(route())).reviewId], [true, 9])
  const stale = { ...view(), humanReview: { status: 'not_requested', requests: [{ id: 9, status: 'pending_authorization', needsReview: true }] } }
  assert.equal(experimentOf(stale, 1, routeOf(route())).review, false)
})

test('E336-2: RoutesView.status incluye needs_constraints, el PRIMER estado de toda persona, y el cliente de servidor lo trata como «sin restricciones»', () => {
  const api = read('../src/career/api.ts')
  assert.match(api, /type RoutesStatus = 'needs_constraints' \| 'ok' \| 'partial' \| 'no_pertinent_catalog'/)
  assert.match(api, /RoutesView = \{ status: RoutesStatus;/)
  assert.match(read('../src/career/adapter.ts'), /routesStatus: raw\.routes\?\.status \?\? 'needs_constraints'/)
})

test('E336-1 y E336-3: cancelar a mitad del cuerpo relanza el AbortError y el roleKey siempre va codificado en la ruta', () => {
  const api = read('../src/career/api.ts')
  assert.match(api, /catch \(error\) \{\s*if \(signal\?\.aborted\) throw error/)
  assert.match(api, /roles\/\$\{encodeURIComponent\(roleKey\)\}/)
  assert.doesNotMatch(api, /roles\/\$\{roleKey\}/)
})

test('copy: los 2 textos de error aprobados (ES-237, 12494) van tal cual en ES y EN, y la sesión vencida usa los de Facilitación', () => {
  const copy = read('../src/career/copy.ts')
  assert.match(copy, /catalogUnavailable: \['El catálogo de rutas aún no está disponible', 'The route catalog is not available yet'\]/)
  assert.match(copy, /routesChanged: \['Tus restricciones cambiaron; revisa las rutas', 'Your constraints changed; review the routes'\]/)
  assert.match(copy, /sessionExpired: \['Tu sesión venció\. Inicia sesión de nuevo para continuar\.', 'Your session expired\. Sign in again to continue\.'\], signIn: \['Entrar', 'Sign in'\]/)
})

test('copy: en modo servidor ningún texto habla de «simulación» ni de «sintético» (dejarían de ser ciertos); el simulador conserva los suyos', () => {
  const copy = read('../src/career/copy.ts'), block = copy.slice(copy.indexOf('const serverCopy'), copy.indexOf('export const tr'))
  assert.ok(block.length > 300)
  assert.doesNotMatch(block, /simulaci|simulation|sint[eé]tic|synthetic/i)
  assert.match(copy, /preview: \['Vista preliminar con datos sintéticos\. Los cambios no se guardan en tu cuenta\.'/, 'el texto del simulador no cambia')
  assert.match(copy, /export const tr = \(lang: Locale, key: CopyKey, server = false\)/)
})

test('pantallas: el chip «sintética», la ficha real, el plan y la evidencia dependen del modo servidor; el simulador conserva lo suyo', () => {
  const pages = read('../src/career/CareerPages.tsx')
  assert.match(pages, /const real = c\.state\.source === 'api'/); assert.match(pages, /route\.synthetic \? c\.t\('synthetic'\) : ''/)
  assert.match(pages, /source\.url\.startsWith\('https:\/\/'\)/, 'solo se enlazan fuentes https')
  assert.match(pages, /example\.org\/synthetic-source/, 'el ejemplo del simulador sigue ahí (modo simulador)')
  assert.match(pages, /c\.state\.source !== 'api' && <CheckField/, 'sin referencias de evidencia inventadas en modo servidor')
  // Paso 3: el plan va contra el servidor; solo los recordatorios y las notificaciones siguen «pendientes» (sin endpoint de consentimiento ni correo) y el simulador del recordatorio no se muestra en modo servidor.
  assert.match(pages, /\{real && <p role="status">\{c\.t\('pending'\)\}<\/p>\}/); assert.match(pages, /\{!real && <><CheckField disabled=\{blocked\} checked=\{c\.state\.notifications\}/); assert.match(pages, /type: 'propose', experimentId: selected\.id/)
  assert.match(pages, /c\.state\.catalogUnavailable \? \(<div role="alert">/)
})

test('marco: VITE_CAREER_SOURCE=api elige el cliente de servidor (el simulador es el valor por defecto); 401 recuerda la pantalla y ofrece «Entrar» (ES-330)', () => {
  const shell = read('../src/career/CareerShell.tsx')
  assert.match(shell, /const serverMode = import\.meta\.env\.VITE_CAREER_SOURCE === 'api'/)
  assert.match(shell, /serverMode \? createServerClient\(\{ baseUrl: import\.meta\.env\.VITE_BACKEND_URL \|\| '', token \}\) : createFixture\(/)
  assert.match(shell, /rememberReturn\(location\.pathname, location\.search\)/); assert.match(shell, /<Link className="cg-btn" to="\/login">\{t\('signIn'\)\}<\/Link>/)
  assert.match(shell, /code === 'lostAck' \|\| code === 'conflict' \|\| code === 'routesChanged'/, 'tras «tus restricciones cambiaron» hay que releer antes de seguir')
})

test('cliente de servidor: los recordatorios y las notificaciones responden «pending» (el plan sí va al servidor, paso 3), sin simular, y un gesto incierto conserva su requestId', () => {
  const client = read('../src/career/serverClient.ts')
  assert.match(client, /default: throw new FixtureError\('pending'\)/); assert.match(client, /case 'plan': \{/); assert.match(client, /case 'complete': case 'pause': \{/)
  assert.match(client, /frozen\.get\(key\) \?\? plan\(input, requestId\)/); assert.match(client, /proposed \?\?= await proposePlan/); assert.match(client, /proposed \?\?= await proposeExperiment/)
  assert.doesNotMatch(client, /localStorage|sessionStorage|console\.|document\.cookie|userId/)
})

test('paso 3: con datos reales la disponibilidad solo se muestra si el servidor la trae confirmada; sin dato no hay cifra ni zona inventadas', () => {
  const pages = read('../src/career/CareerPages.tsx')
  assert.match(pages, /if \(c\.state\.source === 'api'\) return av && av\.weeklyMinutes > 0 && av\.timeZone \?/)
  assert.match(pages, /availabilityLine\(c, plan\.availability\) && <p>/)
  assert.match(pages, /America\/Bogota`/, 'la línea fija del simulador sigue solo en modo simulador')
})

test('E377-3: en modo servidor el aviso de plan inválido no nombra una cifra fija (la disponibilidad real puede ser otra); el simulador conserva el suyo', async () => {
  const { tr } = await import('../src/career/copy.ts')
  for (const lang of ['es', 'en']) {
    assert.doesNotMatch(tr(lang, 'invalidPlan', true), /\d/, `modo servidor (${lang}): sin cifras`)
    assert.match(tr(lang, 'invalidPlan', false), /60/, `simulador (${lang}): conserva «60»`)
  }
  assert.match(tr('es', 'invalidPlan', true), /disponibilidad semanal/); assert.match(tr('en', 'invalidPlan', true), /weekly availability/)
  assert.match(tr('es', 'invalidPlan', true), /precio desconocido/); assert.match(tr('en', 'invalidPlan', true), /unknown price/)
})

test('E377-1: al confirmar el plan la propuesta se reemplaza al instante por el plan en espera (misma forma), la lista de versiones ya está y la propuesta sigue montada para volver si el servidor rechaza', () => {
  const pages = read('../src/career/CareerPages.tsx')
  assert.match(pages, /onPending\(waiting\(\)\)\n\s+const result = await c\.save\(\{ type: 'plan'/, 'el plan en espera se muestra ANTES de esperar al servidor')
  assert.match(pages, /if \(result\.ok\) \{ setReview\(false\); setSelected\(\[\]\); onAccepted\(\) \} else onPending\(null\)/, 'si el servidor rechaza, la propuesta vuelve')
  assert.match(pages, /<div hidden=\{waiting !== null\}><PlanProposal /, 'la propuesta se oculta, no se desmonta (conserva lo escrito)')
  assert.match(pages, /\(c\.state\.plans\.length > 0 \|\| waiting\) && <SelectField label=\{c\.t\('versions'\)\}/, 'la lista de versiones ya existe mientras se espera (evita el salto de ~100 px)')
  assert.match(pages, /\[\.\.\.c\.state\.plans, \.\.\.\(waiting \? \[waiting\] : \[\]\)\]/); assert.match(pages, /aria-busy=\{waiting !== null\}/)
  assert.match(pages, /const plan = waiting \?\? saved/)
})
