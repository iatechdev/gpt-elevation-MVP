// ES-359 (PR4): el menú del chat sobre el cajón del marco. A ≤ 900 px el «☰» de la barra del chat abre el cajón del marco (el encabezado del marco está oculto en el chat) con «Conversación» arriba;
// en escritorio sigue la hoja propia. El navegador real lo mide scripts/es359-chat.cjs (536 comprobaciones); aquí, el modelo y las costuras.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { registerDrawerExtra, onDrawerRequest, requestDrawer } from '../src/shell/drawerExtra.ts'

const read = file => fs.readFileSync(new URL(file, import.meta.url), 'utf8')
const page = read('../src/pages/ChatPage.tsx'), menu = read('../src/space/ChatMenu.tsx'), frame = read('../src/shell/Frame.tsx'), frames = read('../src/shell/frames.tsx'), drawer = read('../src/shell/NavDrawer.tsx')

test('PR4: drawerExtra — se registra, el último gana, solo el dueño lo retira y requestDrawer avisa con el botón que abrió', () => {
  const a = { render: () => null, omit: ['/app/progress'] }, b = { render: () => null }
  const offA = registerDrawerExtra(a); const offB = registerDrawerExtra(b)
  offA() // a ya no es el actual: retirarlo no quita a b
  const seen = []; const off = onDrawerRequest(el => seen.push(el)); const marker = { id: 'btn' }
  requestDrawer(marker); off(); requestDrawer({ id: 'otro' })
  assert.deepEqual(seen, [marker], 'una sola notificación y deja de avisar al desuscribirse'); offB()
})

test('PR4: el chat registra «Conversación» (sin repetir «Mi progreso»), abre el cajón en ≤ 900 px y conserva la hoja de escritorio', () => {
  assert.match(page, /registerDrawerExtra\(\{\s*omit: \['\/app\/progress'\]/); assert.match(page, /<ConversationGroup onClose=\{close\}/)
  assert.match(page, /onClick=\{event => \{ if \(narrow\) requestDrawer\(event\.currentTarget\); else setMenuOpen\(true\) \}\}/)
  assert.match(page, /\{!narrow && <ChatMenu open=\{menuOpen\}/); assert.match(page, /if \(narrow && menuOpen\) setMenuOpen\(false\)/)
  assert.match(page, /aria-expanded=\{narrow \? undefined : menuOpen\}/)
  assert.equal((page.match(/navigate\('\/app\/progress'\)/g) ?? []).length, 2); assert.match(page, /live\.current\.canLeave\(\)/) // la guardia de mensaje sin enviar, en ambos caminos
})

test('PR4: «Cerrar sesión» de los menús del marco abre la despedida (check-out) y el chat cierra con signOut()', () => {
  assert.match(page, /registerLeaveGuard\(\(\) => \{ if \(!live\.current\.canLeave\(\)\) \{ notifyStay\(\); return true \} setShowCheckout\(true\); return true \}, \{ ownLinks: true \}\)/)
  assert.ok(page.includes('await signOut(BACKEND)') && !page.includes("localStorage.removeItem('elevation_token')"))
  assert.match(page, /await handleLogout\(\)/)
})

test('PR4: el marco abre el cajón a pedido y devuelve el foco al botón que lo abrió; el cajón acepta `extra` como función de cierre', () => {
  assert.match(frame, /useEffect\(\(\) => onDrawerRequest\(opener => \{ drawerOpener\.current = opener; setDrawerOpen\(true\) \}\), \[\]\)/)
  assert.match(frame, /drawerOpener\.current = menuButton\.current; setDrawerOpen\(true\)/); assert.match(frame, /opener=\{drawerOpener\}/)
  assert.ok(drawer.includes("typeof extra === 'function' ? extra(onClose) : extra"))
  assert.ok(frames.includes('const drawerOnly') && frames.includes('extra: extra?.render'))
})

test('PR4: ConversationGroup sin textos nuevos (todo de copy.ts e i18n) y «Recomendaciones» se abre tras cerrar el menú (foco)', () => {
  const group = menu.slice(menu.indexOf('export function ConversationGroup'), menu.indexOf('/** Cuerpo del menú'))
  assert.match(group, /requestAnimationFrame\(action\)/)
  for (const part of ['{c.conversation}', '{c.progress}', "{t('rec_title')}", "{t('admin_title')}", '{c.enterSends}', '<UsageText />']) assert.ok(group.includes(part), part)
  const jsx = group.split('\n').filter(line => !line.trim().startsWith('//')).join('\n').replace(/=>/g, '').replace(/<[^>]*>/g, '<>')
  assert.doesNotMatch(jsx, /<>\s*[A-Za-záéíóú]{3,}/, 'texto literal en el grupo')
})
