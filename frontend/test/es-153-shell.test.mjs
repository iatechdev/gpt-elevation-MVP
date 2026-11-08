// ES-153: marcos y navegación por rol. Matriz rol × URL protegida, navegación por marco, textos ES/EN y reglas de los componentes.
// El comportamiento en navegador (foco, teclado, 390/1360 px, axe, 403/401 simulados) lo cubre scripts/es153-browser-check.cjs; ver el PR.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { canEnter, gateDecision, zoneForPath, ZONE_ROLES } from '../src/shell/access.ts'
import { ADMIN_BOARD_GROUP, ADMIN_NAV, BOARD_NAV, PERSON_MENU, PERSON_NAV, PROFESSIONAL_MENU, PROFESSIONAL_NAV, PUBLIC_NAV, visibleFor } from '../src/shell/nav.ts'
import { shellCopy } from '../src/shell/copy.ts'

const read = path => fs.readFileSync(new URL(path, import.meta.url), 'utf8')
const ROLES = ['user', 'therapist', 'admin', 'superadmin', 'board']
const app = read('../src/App.tsx')

// URL protegida → roles que deben ver la pantalla (el resto ve «sin acceso»; la API además responde 403 por su cuenta).
const MATRIX = {
  '/app/chat': ['user'], '/app/skill-map': ['user'], '/app/evidence/12': ['user'], '/app/next-step/plan': ['user'], '/app/session/3': ['user'],
  '/app/data': ROLES, '/app/professional-reviews': ROLES, '/facilitation/participants/4': ROLES,
  '/therapist/dashboard': ['therapist'], '/therapist/patient/9': ['therapist'], '/therapist/session/9': ['therapist'],
  '/admin/dashboard': ['admin', 'superadmin'], '/admin/prompts': ['admin', 'superadmin'], '/admin/content': ['admin', 'superadmin'],
  '/admin/metrics': ['admin', 'superadmin'], '/admin/route-catalog/5': ['admin', 'superadmin'], '/admin/skill-catalog': ['admin', 'superadmin'],
  '/admin/pilot-metrics': ['admin', 'superadmin'],
  '/admin/users': ['admin', 'superadmin'], '/admin/manifest': ['admin', 'superadmin'], // ES-207: la edición del manifiesto pasa a admin + superadmin
  '/board/manifest': ['board', 'superadmin'],
}
// Guardián declarado en App.tsx por grupo de rutas.
const GUARD = (path) => (path.startsWith('/admin') ? 'admin' : path.startsWith('/board') ? 'board' : path.startsWith('/therapist') ? 'professional' : undefined)

test('ES-153 matriz: cada URL protegida con cada rol (cliente); el servidor decide además en cada API', () => {
  for (const [path, allowed] of Object.entries(MATRIX)) {
    for (const role of ROLES) {
      const decision = gateDecision({ status: 'verified', role }, path, GUARD(path))
      assert.equal(decision, allowed.includes(role) ? 'allow' : 'noAccess', `${role} en ${path}`)
    }
  }
})

test('ES-153 estados de la compuerta: sin sesión → /login; verificando y sin conexión no muestran el contenido', () => {
  for (const path of Object.keys(MATRIX)) {
    assert.equal(gateDecision({ status: 'anonymous' }, path, GUARD(path)), 'login')
    assert.equal(gateDecision({ status: 'checking' }, path, GUARD(path)), 'checking')
    assert.equal(gateDecision({ status: 'unavailable' }, path, GUARD(path)), 'unavailable')
  }
})

test('ES-153 zonas: /admin/manifest y /admin/users son de admin y superadmin (ES-207); rutas desconocidas no tienen zona', () => {
  assert.equal(zoneForPath('/admin/users'), 'admin'); assert.equal(zoneForPath('/admin/manifest'), 'admin')
  assert.equal(zoneForPath('/admin/dashboard'), 'admin'); assert.equal(zoneForPath('/board/manifest'), 'board')
  assert.equal(zoneForPath('/therapist/dashboard'), 'professional'); assert.equal(zoneForPath('/app/chat'), 'person')
  assert.equal(zoneForPath('/app/data'), 'member'); assert.equal(zoneForPath('/facilitation'), 'member')
  assert.equal(zoneForPath('/adminx'), null); assert.equal(zoneForPath('/'), null); assert.equal(zoneForPath('/pricing'), null)
  assert.equal(canEnter('board', 'admin'), false); assert.equal(canEnter('admin', 'board'), false); assert.equal(canEnter('superadmin', 'board'), true)
  assert.equal('adminSuper' in ZONE_ROLES, false) // ES-207: ya no hay zona solo de superadmin
})

test('ES-153 guardianes: delegan en RoleGate y ya no deciden con el rol guardado en el navegador', () => {
  for (const file of ['ProtectedRoute', 'AdminRoute', 'TherapistRoute', 'BoardRoute']) {
    const source = read(`../src/components/${file}.tsx`)
    assert.ok(source.includes('RoleGate'), file)
    assert.equal(source.includes('localStorage'), false, `${file} no lee el rol del navegador`)
    assert.equal(/<Navigate to="\/"/.test(source), false, `${file} no redirige en silencio`)
  }
  const gate = read('../src/shell/RoleGate.tsx'), hook = read('../src/shell/useVerifiedSession.ts')
  assert.ok(gate.includes('useVerifiedSession') && hook.includes('readVerifiedSession') && hook.includes('pathname')) // verifica el servidor en cada entrada a una ruta
  assert.ok(hook.includes('invalidateStoredSession')) // 401 limpia la sesión
  assert.ok(read('../src/shell/GateScreens.tsx').includes('sessionDestination')) // el enlace lleva a su inicio, no a una redirección silenciosa
})

test('ES-153 navegación: cada marco muestra solo las rutas de su rol y todas existen en App.tsx', () => {
  const paths = [...PUBLIC_NAV, ...PERSON_NAV, ...PERSON_MENU, ...PROFESSIONAL_NAV, ...PROFESSIONAL_MENU, ...ADMIN_NAV, ...ADMIN_BOARD_GROUP, ...BOARD_NAV]
    .map(item => item.to.split('#')[0]).filter(path => path && path !== '/')
  for (const path of new Set(paths)) {
    const pattern = new RegExp(`path="${path.replace(/\//g, '\\/')}(?:["/:]|\\b)`)
    const nested = /^\/(admin|board)\//.test(path) &&new RegExp(`path="${path.split('/').pop()}"`).test(app)
    assert.ok(pattern.test(app) || nested, `ruta sin pantalla: ${path}`)
  }
  assert.deepEqual(visibleFor(ADMIN_NAV, 'admin').map(item => item.to).includes('/admin/users'), true)
  assert.deepEqual(visibleFor(ADMIN_NAV, 'superadmin').map(item => item.to).includes('/admin/users'), true)
  assert.equal(visibleFor(ADMIN_BOARD_GROUP, 'admin').length, 1); assert.equal(visibleFor(ADMIN_BOARD_GROUP, 'superadmin').length, 1) // ES-207
  assert.deepEqual(BOARD_NAV.map(item => item.to), ['/manifiesto']) // la junta solo ve el manifiesto (página pública)
  assert.equal(PERSON_NAV.length, 5); assert.equal(PROFESSIONAL_NAV.length, 2)
  // Una persona usuaria no ve enlaces de otros roles, ni un profesional los de administración.
  for (const item of [...PERSON_NAV, ...PERSON_MENU]) assert.equal(/^\/(admin|board|therapist)/.test(item.to), false, item.to)
  for (const item of [...PROFESSIONAL_NAV, ...PROFESSIONAL_MENU]) assert.equal(/^\/(admin|board)/.test(item.to), false, item.to)
})

test('ES-153 textos: ES y EN con las mismas claves, sin vacías; el pie conserva «no es terapia ni diagnóstico»', () => {
  assert.deepEqual(Object.keys(shellCopy.es).sort(), Object.keys(shellCopy.en).sort())
  for (const lang of ['es', 'en']) for (const [key, value] of Object.entries(shellCopy[lang])) assert.ok(String(value).trim(), `${lang}.${key}`)
  assert.match(shellCopy.es.foot1, /No es terapia ni diagnóstico/); assert.match(shellCopy.en.foot1, /not therapy or diagnosis/)
  assert.equal(shellCopy.es.noAccess, 'Tu rol no tiene acceso a esta pantalla.')
  for (const item of [...PUBLIC_NAV, ...PERSON_NAV, ...PERSON_MENU, ...PROFESSIONAL_NAV, ...PROFESSIONAL_MENU, ...ADMIN_NAV, ...ADMIN_BOARD_GROUP, ...BOARD_NAV]) assert.ok(item.label in shellCopy.es, item.label)
})

test('ES-153 marco: saltar al contenido, un solo <main> con foco al cambiar de ruta, pie con aviso y sin estilos en línea', () => {
  const frame = read('../src/shell/Frame.tsx'), frames = read('../src/shell/frames.tsx')
  assert.ok(frame.includes('href="#main"') && frame.includes('id="main"') && frame.includes('tabIndex={-1}'))
  assert.equal((frame.match(/<main /g) ?? []).length, 1)
  assert.ok(frame.includes('main.current?.focus(') && frame.includes('[pathname]'))
  assert.ok(frame.includes('SiteFooter') && frame.includes('c.foot1'))
  for (const name of ['PublicFrame', 'PersonFrame', 'ProfessionalFrame', 'AdminFrame', 'BoardFrame', 'BareFrame']) assert.ok(frames.includes(`export function ${name}`), name)
  assert.ok(frames.includes('header={false} footer={false}')) // sala de sesión: sin encabezado ni pie
  for (const file of ['Frame.tsx', 'frames.tsx', 'GateScreens.tsx', 'RoleGate.tsx']) assert.equal(/\bstyle=\{/.test(read(`../src/shell/${file}`)), false, file)
})

test('ES-153 menú de usuario: botón con aria-expanded, Escape cierra y devuelve el foco, clic fuera cierra, salir con texto', () => {
  const frame = read('../src/shell/Frame.tsx')
  for (const needle of ['aria-expanded={open}', 'aria-controls={id}', "event.key === 'Escape'", 'button.current?.focus()', "document.addEventListener('mousedown'", 'hidden={!open}', 'c.signOut']) assert.ok(frame.includes(needle), needle)
})

test('ES-153 administración en móvil: la barra lateral pasa a una fila que se ajusta; objetivos de 46 px', () => {
  const css = read('../src/shell/shell.css')
  assert.match(css, /@media \(max-width: 900px\)[\s\S]*\.cg-sidenav \{ display: flex; flex-wrap: wrap/)
  for (const selector of ['.cg-lang__btn', '.cg-usermenu__button', '.cg-signout']) assert.ok(css.includes(selector), selector)
  assert.equal((css.match(/min-height: var\(--cg-touch\)/g) ?? []).length >= 6, true)
  assert.equal(/#[0-9a-fA-F]{3,8}\b/.test(css), false) // solo tokens
})

test('ES-153 sala de sesión: las dos salas siguen sin marco (pantalla completa) y dentro de su compuerta', () => {
  assert.match(app, /<Route path="\/therapist\/session\/:id" element=\{<SessionRoom \/>\} \/>/)
  assert.match(app, /<Route path="\/app\/session\/:id"\s+element=\{<UserSessionRoom \/>\} \/>/)
})
