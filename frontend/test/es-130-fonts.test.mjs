// ES-130: las fuentes se sirven desde el propio dominio; index.html no depende de terceros para pintar.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8')
const fonts = fs.readFileSync(new URL('../src/styles/fonts.css', import.meta.url), 'utf8')
const index = fs.readFileSync(new URL('../src/index.css', import.meta.url), 'utf8')

test('ES-130 index.html: sin hoja de Google Fonts ni preconnect a terceros', () => {
  assert.equal(html.includes('fonts.googleapis.com'), false)
  assert.equal(html.includes('fonts.gstatic.com'), false)
  assert.equal(html.includes('rel="preconnect"'), false)
})

test('ES-130 fonts.css: cada familia que usa la app tiene @font-face local con font-display swap', () => {
  for (const family of ['Inter', 'Playfair Display', 'Noto Serif']) {
    assert.ok(fonts.includes(`font-family: '${family}'`), family)
  }
  const faces = fonts.split('@font-face').length - 1
  assert.equal(faces, (fonts.match(/font-display: swap/g) ?? []).length)
  assert.equal(fonts.includes('http'), false)
  assert.ok(index.includes("@import './styles/fonts.css'"))
})

test('ES-130 archivos: cada woff2 referenciado existe y trae su licencia OFL', () => {
  for (const [, file] of fonts.matchAll(/url\('\.\.\/assets\/fonts\/([^']+)'\)/g)) {
    assert.ok(fs.existsSync(new URL(`../src/assets/fonts/${file}`, import.meta.url)), file)
  }
  for (const licence of ['OFL-Playfair-Display.txt', 'OFL-Noto-Serif.txt']) {
    assert.ok(fs.existsSync(new URL(`../src/assets/fonts/${licence}`, import.meta.url)), licence)
  }
})

test('ES-130 CLS: el respaldo de Inter ajusta métricas y las pantallas con Inter local lo usan', () => {
  const landing = fs.readFileSync(new URL('../src/components/landing/landing.css', import.meta.url), 'utf8')
  const access = fs.readFileSync(new URL('../src/styles/accessAdmin.css', import.meta.url), 'utf8')
  assert.match(landing, /font-family: 'Elevation Landing Inter Fallback';/)
  for (const prop of ['size-adjust', 'ascent-override', 'descent-override', 'line-gap-override']) assert.ok(landing.includes(prop), prop)
  assert.ok(landing.includes("'Elevation Landing Inter', 'Elevation Landing Inter Fallback'"))
  assert.ok(access.includes("'Elevation Landing Inter', 'Elevation Landing Inter Fallback'"))
})
