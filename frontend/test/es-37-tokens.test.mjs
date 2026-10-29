import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const css = readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf8')

const parseVars = (block) => {
  const out = {}
  for (const m of block.matchAll(/--(elv-[a-z0-9-]+):\s*([^;]+);/g)) out[m[1]] = m[2].trim()
  return out
}
const rootBlock = css.match(/:root\s*\{([\s\S]*?)\n\}/)[1]
const darkBlock = css.match(/\.elv-dark\s*\{([\s\S]*?)\n\}/)[1]
const prim = parseVars(rootBlock)
const resolve = (vars, name) => {
  let v = vars[name]
  while (v && v.startsWith('var(')) v = vars[v.slice(6, -1)] ?? prim[v.slice(6, -1)]
  return v
}
const light = Object.fromEntries(Object.keys(prim).map((k) => [k, resolve(prim, k)]))
const dark = { ...light, ...parseVars(darkBlock) }

const lum = (h) => {
  const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}

// [primer plano, fondo, mínimo]: 4.5 texto, 3 controles/bordes de control/foco
const pairs = [
  ['elv-text-1', 'elv-bg', 4.5], ['elv-text-1', 'elv-card', 4.5], ['elv-text-1', 'elv-surface', 4.5],
  ['elv-text-2', 'elv-bg', 4.5], ['elv-text-2', 'elv-card', 4.5], ['elv-text-2', 'elv-muted-bg', 4.5],
  ['elv-text-3', 'elv-bg', 4.5], ['elv-text-3', 'elv-card', 4.5],
  ['elv-action-text', 'elv-action', 4.5], ['elv-link', 'elv-bg', 4.5], ['elv-action', 'elv-action-soft', 4.5],
  ['elv-ai', 'elv-ai-bg', 4.5], ['elv-success', 'elv-success-bg', 4.5], ['elv-warning', 'elv-warning-bg', 4.5],
  ['elv-error', 'elv-error-bg', 4.5], ['elv-error', 'elv-bg', 4.5], ['elv-info', 'elv-info-bg', 4.5],
  ['elv-line-control', 'elv-bg', 3], ['elv-line-control', 'elv-card', 3], ['elv-focus', 'elv-bg', 3], ['elv-focus', 'elv-card', 3],
]

for (const [name, vars] of [['claro', light], ['oscuro', dark]]) {
  test(`ES-37 contraste AA (${name})`, () => {
    for (const [fg, bg, min] of pairs) {
      // el oscuro no redefine los pares de marca que solo existen en claro
      const r = ratio(vars[fg], vars[bg])
      assert.ok(r >= min, `${name}: ${fg} ${vars[fg]} sobre ${bg} ${vars[bg]} = ${r.toFixed(2)} (mín ${min})`)
    }
  })
}

test('ES-37 los semánticos del modo oscuro existen también en claro', () => {
  for (const k of Object.keys(parseVars(darkBlock))) assert.ok(k in light, `${k} falta en :root`)
})

test('ES-37 el ocre de marca #B8963E es solo decorativo (no llega a 4,5:1 sobre papel); el texto usa #7D6218', () => {
  assert.ok(ratio('#b8963e', '#fafaf9') < 4.5)
  assert.ok(ratio(light['elv-link'], light['elv-bg']) >= 4.5)
  assert.notEqual(light['elv-action'], light['elv-brand'])
})

// Paso B: los CSS de Skill Map, Career y Compass ya no definen colores propios ni temas daisyUI por dominio.
for (const file of ['skill-map/skillMap.css', 'career/career.css', 'compass/compass.css']) {
  test(`ES-37 ${file} usa solo tokens (sin hex ni --color-* propios)`, () => {
    const src = readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8')
    assert.deepEqual(src.match(/#[0-9a-fA-F]{3,8}\b/g)?.filter((h) => h.toLowerCase() !== '#0009') ?? [], [], 'hay colores hex sueltos')
    assert.equal(/--color-[a-z0-9-]+\s*:/.test(src), false, 'redefine variables de daisyUI')
  })
}

test('ES-37 el tema único cubre los tres dominios y se importa en index.css', () => {
  assert.match(css, /\.elv-theme,\s*\.skill-map-scope,\s*\.career-scope,\s*\.compass-scope\s*\{/)
  assert.match(readFileSync(new URL('../src/index.css', import.meta.url), 'utf8'), /@import '\.\/styles\/tokens\.css'/)
})

test('ES-37 paleta de la landing: papel, tinta, gris y ocre coinciden con index.css', () => {
  const landing = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8').toLowerCase()
  for (const k of ['elv-bg', 'elv-text-1', 'elv-text-2', 'elv-line', 'elv-brand']) assert.ok(landing.includes(light[k]), `${k} ${light[k]} no está en la landing`)
})
