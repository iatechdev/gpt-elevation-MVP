// ES-152: sistema de diseño «Cartografía». Contrastes calculados desde los tokens reales, reglas de la hoja y de los componentes.
// El comportamiento en navegador (foco del diálogo, teclado de pestañas, axe, capturas) se verifica aparte con Playwright; ver el PR.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { contrastRatio } from '../src/cartografia/contrast.ts'
import { contourSegments, reliefField } from '../src/cartografia/relief.ts'
import { cgCopy } from '../src/cartografia/copy.ts'

const dir = new URL('../src/cartografia/', import.meta.url)
const css = fs.readFileSync(new URL('cartografia.css', dir), 'utf8')
const fontsCss = fs.readFileSync(new URL('fonts.css', dir), 'utf8')

const block = selectorStart => {
  const start = css.indexOf(selectorStart)
  assert.ok(start >= 0, selectorStart)
  return css.slice(start, css.indexOf('}', start))
}
const tokens = source => Object.fromEntries([...source.matchAll(/--cg-(ground|panel|ink|muted|line|contour|mark|err|good):\s*(#[0-9a-f]{6})/gi)].map(m => [m[1], m[2]]))

const light = tokens(block('.cg {'))
const darkExplicit = tokens(block(".cg[data-theme='dark'] {"))
const darkMedia = tokens(block(".cg:not([data-theme='light']) {"))

test('ES-152 tokens: el tema oscuro por preferencia del sistema y el elegido a mano tienen los mismos valores', () => {
  assert.equal(Object.keys(light).length, 9)
  assert.deepEqual(darkMedia, darkExplicit)
  assert.ok(css.includes('@media (prefers-color-scheme: dark)'))
  assert.ok(css.includes('color-scheme: dark'))
})

for (const [name, theme] of [['claro', light], ['oscuro', darkExplicit]]) {
  test(`ES-152 contraste AA (${name}): todo texto y control sobre su fondo`, () => {
    const min = (a, b, limit, what) => {
      const ratio = contrastRatio(a, b)
      assert.ok(ratio !== null && ratio >= limit, `${what}: ${a} sobre ${b} = ${ratio?.toFixed(2)} (mínimo ${limit})`)
    }
    for (const bg of ['ground', 'panel']) {
      for (const fg of ['ink', 'muted', 'mark', 'err', 'good']) min(theme[fg], theme[bg], 4.5, `texto ${fg} sobre ${bg}`)
    }
    min(theme.ground, theme.ink, 4.5, 'botón primario (texto sobre tinta)')
    min(theme.ground, theme.mark, 4.5, 'botón primario en hover (texto sobre marca)')
    min(theme.ground, theme.err, 4.5, 'botón destructivo (texto sobre error)')
    min(theme.ink, theme.panel, 3, 'borde de campos (tinta sobre panel)')
    min(theme.mark, theme.ground, 3, 'anillo de foco sobre la hoja')
    min(theme.mark, theme.panel, 3, 'anillo de foco sobre el panel')
    min(theme.contour, theme.ground, 3, 'curvas de nivel')
  })
}

test('ES-152 objetivos táctiles y foco: 46 px en botones y campos, foco de 3 px', () => {
  assert.match(css, /--cg-touch:\s*2\.875rem/)
  assert.match(css, /--cg-focus:\s*3px/)
  for (const selector of ['.cg-btn {', '.cg-input, .cg-select, .cg-textarea {', '.cg-tab {', '.cg-check {', '.cg-linkbtn {']) assert.match(block(selector), /min-height:\s*var\(--cg-touch\)/, selector)
  assert.match(css, /:focus-visible\s*\{\s*outline:\s*var\(--cg-focus\) solid var\(--cg-mark\)/)
})

test('ES-152 el estado nunca va solo en color: error, chip, requisitos y aviso llevan símbolo o palabra', () => {
  assert.match(css, /\.cg-error::before\s*\{\s*content:\s*'\\26A0/)
  assert.match(css, /\.cg-banner--error \.cg-banner__title::before\s*\{\s*content:\s*'\\26A0/)
  const pieces = fs.readFileSync(new URL('pieces.tsx', dir), 'utf8')
  assert.ok(pieces.includes('✓') && pieces.includes('○'))
  assert.match(pieces, /cg-sr">\{item\.met \? metLabel : unmetLabel\}/)
})

test('ES-152 movimiento reducido: la animación del relieve de espera se apaga', () => {
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)\s*\{[^}]*animation:\s*none !important/)
})

test('ES-152 sin estilos en línea ni colores fijos en los componentes: todo sale de tokens', () => {
  for (const file of fs.readdirSync(dir).filter(name => name.endsWith('.tsx'))) {
    const source = fs.readFileSync(new URL(file, dir), 'utf8')
    assert.equal(/\bstyle=\{/.test(source), false, `${file} usa style={...}`)
    assert.equal(/#[0-9a-fA-F]{6}\b/.test(source.replace(/\\u[0-9a-fA-F]{4}/g, '')), false, `${file} trae un color fijo`)
  }
  const components = css.slice(css.indexOf('/* tipografía */'))
  const allowed = new Set(['rgb(0 0 0 / 0.25)', 'rgb(14 22 19 / 0.6)'])
  for (const [literal] of components.matchAll(/#[0-9a-f]{3,8}\b|rgb\([^)]*\)/gi)) assert.ok(allowed.has(literal), `color fijo en componentes: ${literal}`)
})

test('ES-152 diálogo: showModal, aria-modal, título enlazado, Escape delegado y retorno del foco al disparador', () => {
  const source = fs.readFileSync(new URL('interactive.tsx', dir), 'utf8')
  for (const needle of ['showModal()', 'aria-modal="true"', 'aria-labelledby={titleId}', 'onCancel', 'event.preventDefault(); onClose()', 'onKeyDown={trap}', 'target.focus()', 'document.activeElement']) {
    assert.ok(source.includes(needle), needle)
  }
})

test('ES-152 pestañas: patrón WAI-ARIA con flechas, Inicio y Fin y una sola parada de Tab', () => {
  const source = fs.readFileSync(new URL('interactive.tsx', dir), 'utf8')
  for (const needle of ['role="tablist"', 'role="tab"', 'role="tabpanel"', 'aria-selected', 'aria-controls', 'aria-labelledby', "'ArrowRight'", "'ArrowLeft'", "'Home'", "'End'", 'tabIndex={current === tab.id ? 0 : -1}']) {
    assert.ok(source.includes(needle), needle)
  }
})

test('ES-152 tipografías: autoalojadas, font-display swap, sin terceros, archivos presentes y licencia OFL', () => {
  const faces = fontsCss.split('@font-face').length - 1
  assert.equal(faces, 6)
  assert.equal((fontsCss.match(/font-display: swap/g) ?? []).length, faces)
  assert.equal(/https?:|googleapis|gstatic/.test(fontsCss + css), false)
  for (const family of ['Barlow Condensed', 'Barlow', 'Spectral']) assert.ok(fontsCss.includes(`font-family: '${family}'`), family)
  for (const [, pkg, file] of fontsCss.matchAll(/url\('@fontsource\/([^/]+)\/files\/([^']+)'\)/g)) {
    const base = new URL(`../node_modules/@fontsource/${pkg}/`, import.meta.url)
    assert.ok(fs.existsSync(new URL(`files/${file}`, base)), file)
    assert.match(fs.readFileSync(new URL('LICENSE', base), 'utf8'), /SIL Open Font License, Version 1\.1/, pkg)
  }
  assert.ok(css.startsWith('/*') && css.includes("@import './fonts.css'"))
})

test('ES-152 textos: ES y EN con las mismas claves y ninguna vacía', () => {
  assert.deepEqual(Object.keys(cgCopy.es).sort(), Object.keys(cgCopy.en).sort())
  for (const lang of ['es', 'en']) for (const [key, value] of Object.entries(cgCopy[lang])) assert.ok(String(value).trim(), `${lang}.${key}`)
})

test('ES-152 relieve: sin picos queda plano; con un pico de nivel 3 aparecen curvas y suben hacia el centro', () => {
  const size = 40, cell = 0.05
  const grid = field => {
    const values = new Float32Array(size * size)
    for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) values[j * size + i] = field(i * cell, j * cell, 2, 2)
    return values
  }
  const flat = grid(reliefField([], false))
  assert.equal(contourSegments(flat, size, size, 8, 0.125).length, 0)
  const peak = grid(reliefField([{ x: 0.5, y: 0.5, level: 3 }], false))
  assert.ok(contourSegments(peak, size, size, 8, 0.125).length > 0)
  assert.ok(peak[20 * size + 20] > peak[2 * size + 2])
})

test('ES-152 la página de componentes cuelga de una ruta sin navegación y se carga bajo demanda', () => {
  const app = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
  assert.match(app, /const DesignSystemPage = lazy\(\(\) => import\('\.\/cartografia\/DesignSystemPage\.tsx'\)/)
  assert.match(app, /<Route path="\/design-system" element=\{<DesignSystemPage \/>\}/)
})
