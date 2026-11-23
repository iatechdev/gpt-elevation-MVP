// ES-374: al cancelar «Si sales, perderás…» a ≤ 900 px, el cajón se cierra y el foco vuelve a la caja de mensaje. Comportamiento real en navegador: scripts/es374-check.cjs.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const read = file => fs.readFileSync(new URL(file, import.meta.url), 'utf8')
const drawer = read('../src/shell/drawerExtra.ts'); const frame = read('../src/shell/Frame.tsx'); const hooks = read('../src/space/hooks.ts'); const page = read('../src/pages/ChatPage.tsx')

test('ES-374: el registro del cajón permite cerrarlo desde la pantalla y avisar que la persona se quedó', () => {
  assert.match(drawer, /stay\?: \(\) => void/)
  assert.match(drawer, /export const closeDrawer = \(focus: HTMLElement \| null = null\)/)
  assert.match(drawer, /export const notifyStay = \(\) => \{ current\?\.stay\?\.\(\) \}/)
})

test('ES-374: el marco cierra el cajón y manda el foco al elemento indicado (si no, al botón que lo abrió)', () => {
  assert.match(frame, /import \{ onDrawerClose, onDrawerRequest \} from '\.\/drawerExtra'/)
  assert.match(frame, /onDrawerClose\(focus => \{ if \(focus\) drawerOpener\.current = focus; setDrawerOpen\(false\) \}\)/)
})

test('ES-374: cancelar la pregunta (cierre de sesión o enlace del cajón) avisa; el chat cierra el cajón y enfoca la caja de mensaje', () => {
  assert.match(hooks, /registerLeaveGuard\(\(\) => \{ const stay = cancel\(\); if \(stay\) notifyStay\(\); return stay \}, \{ ownLinks: true \}\)/)
  assert.match(hooks, /cancel\(\)\) \{ event\.preventDefault\(\); event\.stopImmediatePropagation\(\); notifyStay\(\) \}/)
  assert.match(page, /if \(!live\.current\.canLeave\(\)\) \{ notifyStay\(\); return true \}/)
  assert.match(page, /stay: \(\) => \{ closeDrawer\(document\.querySelector<HTMLElement>\('\.chat-shell \.space-message'\)\) \}/)
})
