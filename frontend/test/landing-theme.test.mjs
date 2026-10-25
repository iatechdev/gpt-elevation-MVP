import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const css = readFileSync(new URL('../src/components/landing/landing.css', import.meta.url), 'utf8')
const themes = [...css.matchAll(/@plugin 'daisyui\/theme' \{([^}]+)\}/g)].map(([, block]) => ({
  name: block.match(/name: '([^']+)'/)[1],
  colors: Object.fromEntries([...block.matchAll(/--color-([\w-]+): (#[\da-f]{6});/gi)].map(([, name, hex]) => [name, hex])),
  block,
}))

function luminance(hex) {
  const rgb = hex.slice(1).match(/../g).map(value => parseInt(value, 16) / 255)
    .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722
}
function contrast(a, b) {
  const values = [luminance(a), luminance(b)].sort((a, b) => b - a)
  return (values[0] + 0.05) / (values[1] + 0.05)
}

test('Landing themes keep normal text and semantic content at WCAG AA contrast', () => {
  assert.equal(themes.length, 2)
  for (const { name, colors } of themes) {
    for (const base of ['base-100', 'base-200']) {
      for (const foreground of ['base-content', 'neutral', 'secondary']) {
        const ratio = contrast(colors[base], colors[foreground])
        assert.ok(ratio >= 4.5, `${name}: ${foreground} / ${base}: ${ratio.toFixed(2)}:1`)
      }
    }
    for (const color of ['primary', 'secondary', 'neutral', 'info', 'success', 'warning', 'error']) {
      assert.ok(contrast(colors[color], colors[color + '-content']) >= 4.5, `${name}: ${color} content`)
    }
  }
  console.log('Dark ochre on paper:', contrast('#7D6218', '#FAFAF9').toFixed(2) + ':1')
  console.log('Decorative ochre on paper:', contrast('#B8963E', '#FAFAF9').toFixed(2) + ':1 (not text)')
})

test('Themes do not become global defaults; daisyUI classes are namespaced', () => {
  assert.match(css, /themes: false/)
  assert.match(css, /root: '\.landing-scope'/)
  assert.match(css, /prefix: 'elv-'/)
  for (const { block } of themes) {
    assert.match(block, /default: false/)
    assert.match(block, /prefersdark: false/)
  }
})
