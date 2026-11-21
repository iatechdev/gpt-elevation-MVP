// ES-153 (paso 3): PreferencesBar (idioma + tema) y rejilla móvil de 3 columnas en el marco de persona. Reglas estructurales; el comportamiento (alto del encabezado, Tab, tema sin parpadeo,
// almacenamiento bloqueado, axe, CLS) lo mide scripts/es153-prefs-check.cjs.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { shellCopy } from '../src/shell/copy.ts'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const KEYS = ['preferences', 'theme', 'themeSystem', 'themeLight', 'themeDark', 'themeLegacy']

test('ES-153 P3: las seis claves de texto nuevas existen en ES y EN, con lo aprobado, y no entran en los enlaces de navegación', () => {
  for (const key of KEYS) { assert.ok(shellCopy.es[key] && shellCopy.en[key], key); assert.ok(!(key in {}), key) }
  assert.deepEqual(KEYS.map(key => shellCopy.es[key]), ['Preferencias', 'Tema', 'Auto', 'Claro', 'Oscuro', 'Esta pantalla aún solo tiene tema claro.'])
  assert.deepEqual(KEYS.map(key => shellCopy.en[key]), ['Preferences', 'Theme', 'Auto', 'Light', 'Dark', 'This screen only has the light theme for now.'])
  const nav = read('../src/shell/nav.ts')
  for (const key of KEYS) assert.ok(nav.includes(`'${key}'`), `${key} excluida de NavKey`)
})

test('ES-153 P3: ThemeSwitch usa botones con aria-pressed; en pantalla heredada aria-disabled (no disabled: sigue en el orden de Tab) + aria-describedby, y el clic no hace nada', () => {
  const frame = read('../src/shell/Frame.tsx')
  const part = frame.slice(frame.indexOf('export function ThemeSwitch'), frame.indexOf('export function NavLinks'))
  assert.ok(part.includes('role="group" aria-label={c.theme}') && part.includes('aria-describedby={legacy ? note : undefined}'))
  assert.ok(part.includes('aria-pressed={theme === option.id}') && part.includes('aria-disabled={legacy || undefined}'))
  assert.ok(part.includes('onClick={() => { if (!legacy) setTheme(option.id) }}'))
  assert.ok(!/\sdisabled[=\s>{]/.test(part.replace(/aria-disabled/g, '')), 'sin el atributo disabled (rompería el orden de Tab)')
  assert.ok(part.includes('<LangSwitch />') || frame.includes('<LangSwitch /><ThemeSwitch legacy={legacy} />'), 'idioma y tema juntos en PreferencesBar')
  assert.ok(frame.includes('role="group" aria-label={c.preferences}'))
  assert.ok(frame.includes('const prefs = preferences === undefined ? <LangSwitch /> : preferences'), 'sin la propiedad, los marcos públicos conservan solo el idioma (ES-359: preferences={null} = sin preferencias en el encabezado)')
})

test('ES-153 P3: el marco de persona usa el tema elegido solo en pantallas migradas (el resto sigue claro fijo), la rejilla de 3 columnas y PreferencesBar', () => {
  const frames = read('../src/shell/frames.tsx')
  assert.ok(frames.includes("theme={migrated ? theme : 'light'}") && frames.includes('preferences={null}') && frames.includes('legacyTheme={!migrated}')) // ES-359: idioma y tema viven DENTRO del menú de cuenta (AccountMenu: LangSwitch + ThemeSwitch)
  assert.ok(read('../src/shell/AccountMenu.tsx').includes('<LangSwitch />') && read('../src/shell/AccountMenu.tsx').includes('<ThemeSwitch legacy={legacyTheme} />'))
  assert.ok(frames.includes('className="cg-nav cg-nav--grid3"'))
  assert.ok(!frames.slice(frames.indexOf('export function ProfessionalFrame')).includes('PreferencesBar'), 'solo el marco de persona')
})

test('ES-153 P3: el tema es UN almacén compartido (useSyncExternalStore + storage); si el almacenamiento falla, vive en memoria; lectura síncrona (sin parpadeo)', () => {
  const state = read('../src/cartografia/themeState.ts')
  assert.ok(state.includes('useSyncExternalStore(subscribe, readTheme') && state.includes("window.addEventListener('storage'"))
  assert.ok(state.includes('let memory: CgTheme | null = null') && state.includes('memory = saveTheme(theme) ? null : theme'))
  assert.ok(!state.includes('useState') && !state.includes('useEffect'), 'sin estado por componente ni lectura diferida')
})

test('ES-153 P3: CSS — rejilla de 3 columnas de alto fijo en móvil, 0,82 rem a ≤ 360 px, el menú arriba a la derecha, sin colores ni tokens nuevos y el chat usa el nuevo presupuesto de altura', () => {
  const css = read('../src/shell/shell.css')
  assert.ok(css.includes('.cg-nav--grid3 { grid-column: 1 / -1; grid-row: 3; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr));'))
  assert.ok(css.includes('min-height: 2.75rem') && css.includes('@media (max-width: 360px)') && css.includes('font-size: 0.82rem'))
  assert.ok(css.includes('.cg-usermenu { grid-column: 2; grid-row: 1; justify-self: end; }') && css.includes('.cg-prefs { grid-column: 1 / -1; grid-row: 2; }'))
  const added = css.slice(css.indexOf('/* ES-153 (paso 3): el encabezado de persona en móvil.'))
  assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(added) && !added.includes('--cg-new'), 'solo tokens existentes')
  // ES-333 (PR 1): el chat ya no resta una constante al alto del viewport («calc(100dvh - 18.1rem)»): usa el alto que deja el marco (columna de 100dvh); el encabezado móvil de esta prueba puede crecer o encogerse sin romper el chat.
  const space = read('../src/space/space.css'); assert.ok(!space.includes('calc(100dvh -') && !space.includes('18.1rem'))
  assert.ok(space.includes('.cg-frame:has(.chat-shell) .cg-main { flex: 1 1 0; min-height: 0; display: flex; flex-direction: column; padding: 0; }') && space.includes('.cg-main .chat-shell { flex: 1 1 0; height: auto; min-height: 0; overflow: visible; }'))
})
