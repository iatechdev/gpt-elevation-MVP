// ES-321 (E297-1): el orden del DOM del encabezado de persona sigue el orden visual en la disposición móvil (≤ 900 px). Reglas estructurales; el recorrido real con Tab, el cruce de 900 px,
// el alto, axe y el CLS los mide scripts/es321-focus-order-check.cjs.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')

test('ES-321: el corte móvil del DOM es el mismo que el del CSS (max-width: 900px) y la lectura es síncrona (sin parpadeo)', () => {
  const hook = read('../src/shell/narrowHeader.ts'), css = read('../src/shell/shell.css')
  assert.ok(hook.includes("NARROW_HEADER_QUERY = '(max-width: 900px)'"))
  assert.ok(/@media \(max-width: 900px\)/.test(css), 'el CSS usa el mismo corte')
  assert.ok(hook.includes('useSyncExternalStore(subscribe, read, () => false)') && hook.includes("addEventListener('change'") && hook.includes("typeof window.matchMedia === 'function'"), 'useSyncExternalStore, escucha de cambios y respaldo sin matchMedia')
  assert.ok(!hook.includes('useState') && !hook.includes('useEffect'), 'sin estado ni lectura diferida')
})

test('ES-321: Frame dibuja marca → menú → preferencias → navegación en móvil y marca → navegación → preferencias → menú en escritorio; solo con mobileOrder', () => {
  const frame = read('../src/shell/Frame.tsx')
  assert.ok(frame.includes('const narrow = useNarrowHeader() && mobileOrder') && frame.includes('mobileOrder = false'), 'opt-in: los demás marcos no cambian')
  const header = frame.slice(frame.indexOf('<header className="cg-header"'), frame.indexOf('</header>'))
  const mobile = header.indexOf('narrow ? <div className="cg-header__end">{account}{preferences ?? <LangSwitch />}</div>')
  const desktop = header.indexOf('<>{nav}<div className="cg-header__end">{preferences ?? <LangSwitch />}{account}</div></>')
  const tail = header.indexOf('{narrow && nav}')
  assert.ok(mobile > 0 && desktop > mobile && tail > desktop, 'móvil: menú y preferencias y luego la navegación; escritorio: el orden de siempre')
  assert.ok(header.indexOf('<Link className="cg-brand"') < mobile, 'la marca va siempre primero')
})

test('ES-321: solo el marco de persona activa mobileOrder; sin textos ni estilos nuevos', () => {
  const frames = read('../src/shell/frames.tsx')
  assert.equal((frames.match(/mobileOrder/g) ?? []).length, 1, 'una sola activación')
  assert.ok(frames.slice(frames.indexOf('export function PersonChrome'), frames.indexOf('export function PersonFrame')).includes('footer={footer} mobileOrder>'))
  assert.ok(!frames.slice(frames.indexOf('export function ProfessionalFrame')).includes('mobileOrder'))
  const css = read('../src/shell/shell.css'); assert.ok(css.includes('.cg-nav--grid3 { grid-column: 1 / -1; grid-row: 3;') && css.includes('.cg-usermenu { grid-column: 2; grid-row: 1; justify-self: end; }'), 'la rejilla no cambia: cada pieza se coloca por su clase')
})
