import { test } from 'node:test'
import assert from 'node:assert/strict'
function luminance(hex) {
  const [r, g, b] = hex.slice(1).match(/../g).map(value => parseInt(value, 16) / 255)
    .map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4)
  return .2126 * r + .7152 * g + .0722 * b
}
test('ES-14: text, muted text, errors and primary action meet AA contrast', () => {
  for (const [foreground, background] of [['#1c1917', '#f9f9f7'], ['#57534e', '#ffffff'], ['#b91c1c', '#f9f9f7'], ['#ffffff', '#4a6741']]) {
    const [light, dark] = [luminance(foreground), luminance(background)].sort((a, b) => b - a)
    const ratio = (light + .05) / (dark + .05)
    console.log(`${foreground} on ${background}: ${ratio.toFixed(2)}:1`)
    assert.ok(ratio >= 4.5)
  }
})
