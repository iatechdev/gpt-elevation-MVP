// ES-112: Mi espacio con pestañas, «Pausar» y barra de uso de IA. Contrato de /api/ai/usage, pausa del lado del cliente, textos ES/EN y estructura accesible.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { copy } from '../src/space/copy.ts'
import { parseUsage, usedPercent, isExhausted, renewalDate } from '../src/space/usage.ts'
import { setPaused } from '../src/space/pause.ts'

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8')
const ready = (extra = {}) => ({ configured: true, period: 'month', periodKey: '2026-10', limit: 1000, used: 340, remaining: 660, resetsAt: '2026-11-01T00:00:00.000Z', ...extra })

test('ES-112 textos: ES y EN con las mismas claves y marcadores; sin cifras ni promesas inventadas', () => {
  assert.deepEqual(Object.keys(copy.es).sort(), Object.keys(copy.en).sort())
  const mine = ['conversation', 'convPrivate', 'pause', 'resume', 'menu', 'menuLabel', 'usage', 'usageRenews', 'usageValue', 'usageNone', 'usageError', 'usageLoading', 'paused', 'exhausted', 'tabs']
  const placeholders = (text) => [...String(text).matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join(',')
  for (const key of mine) {
    assert.ok(copy.es[key] && copy.en[key], key); assert.equal(placeholders(copy.es[key]), placeholders(copy.en[key]), key)
    for (const text of [copy.es[key], copy.en[key]]) assert.doesNotMatch(text, /msgs?\b|mensajes restantes|messages left|ilimitad|unlimited|garantiz|guarantee/i, key)
  }
  assert.match(copy.es.paused, /No se envía nada/); assert.match(copy.en.paused, /Nothing is sent/)
  assert.match(copy.es.usageNone, /no se muestra la barra/); assert.match(copy.es.convPrivate, /Solo visible para ti/)
})

test('ES-112 uso de IA: solo se acepta lo que el servidor calcula; sin límite definido no hay barra y no se inventa nada', () => {
  assert.deepEqual(parseUsage({ configured: false }), { configured: false })
  const usage = parseUsage(ready())
  assert.equal(usage.configured, true); assert.equal(usedPercent(usage), 34); assert.equal(isExhausted(usage), false)
  assert.equal(isExhausted(parseUsage(ready({ used: 1000, remaining: 0 }))), true); assert.equal(usedPercent(parseUsage(ready({ used: 5000 }))), 100)
  assert.equal(isExhausted({ configured: false }), false)
  for (const bad of [null, 'x', [], {}, { configured: 'yes' }, ready({ limit: 0 }), ready({ limit: -5 }), ready({ used: -1 }), ready({ used: 1.5 }), ready({ resetsAt: 'no-fecha' }), ready({ resetsAt: 5 }), { configured: true }]) assert.throws(() => parseUsage(bad), undefined, JSON.stringify(bad))
  assert.match(renewalDate('2026-11-01T00:00:00.000Z', 'es'), /1.*noviembre/i); assert.match(renewalDate('2026-11-01T00:00:00.000Z', 'en'), /November.*1|1.*November/)
})

test('ES-112 pausa: es solo del cliente, no falla sin almacenamiento y no toca el servidor', () => {
  assert.doesNotThrow(() => { setPaused(true); setPaused(false) })
  const pause = read('../src/space/pause.ts'); assert.doesNotMatch(pause, /fetch|request\(|XMLHttpRequest|localStorage/)
  assert.match(pause, /sessionStorage/)
})

test('ES-112 estructura: pestañas como enlaces, menú con las rutas que ya existían, barra de uso con rol y valores, escritura bloqueada al pausar o agotar', () => {
  const nav = read('../src/space/SpaceNav.tsx'); const bar = read('../src/space/ChatBar.tsx'); const controls = read('../src/space/ChatControls.tsx'); const page = read('../src/pages/ChatPage.tsx')
  assert.match(nav, /className="space-tabs"/); assert.match(nav, /to="\/app\/chat"/); assert.match(nav, /to="\/app\/diary"/)
  assert.match(nav, /to="\/app\/space\/tools"/); assert.doesNotMatch(nav, /next-step/); assert.match(nav, /<details className="space-menu">/)
  assert.match(bar, /role="progressbar"/); assert.match(bar, /aria-valuenow=/); assert.match(bar, /aria-pressed=\{paused\}/); assert.match(bar, /role="status"/)
  assert.doesNotMatch(bar, /msgs|localStorage/)
  assert.match(controls, /blocked\.paused \|\| blocked\.exhausted/); assert.match(controls, /\|\| off/)
  assert.match(page, /<ChatBar sent=\{messages\.length\} \/>/)
  assert.doesNotMatch(read('../src/space/usageStore.ts'), /localStorage/)
})

test('ES-112 línea visual: Mi espacio usa los valores del tema de la landing y sin terracota ni verde olivo anteriores', () => {
  const css = read('../src/space/space.css')
  for (const token of ['#FAFAF9', '#F2EFE7', '#E4E2DC', '#1A1A18', '#7D6218', '#B8963E', '#325D40', '#7A3030']) assert.ok(css.includes(token), token)
  assert.doesNotMatch(css, /#4a6741|#6b7d5c|#0d9488|#B5503C/i)
  const page = read('../src/pages/ChatPage.tsx'); assert.doesNotMatch(page, /borderLeft: '2px solid #0d9488'/); assert.match(page, /✦ \{t\('logo'\)\}/) // tarjetas del acompañante y de la persona
})
