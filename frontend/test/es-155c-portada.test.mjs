// ES-155 (tramo C): la portada «Cartografía». Reglas del producto que NO pueden romperse: ejemplo siempre rotulado y sin red ni persistencia, sin promesas de empleo ni de resultados, sin fotografía ni testimonios
// inventados (marcador visible), relieve decorativo oculto a lectores, textos de `landing.portada.*` completos en ES/EN. El comportamiento y axe 2.2 AA los mide scripts/es155c-check.cjs.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { createLoader } from './support/loadTsx.mjs'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const catalog = JSON.parse(read('../../shared/landing-content.json'))
const portada = catalog.filter(entry => entry.key.startsWith('landing.portada.'))
const byKey = Object.fromEntries(catalog.map(entry => [entry.key, entry]))
const root = new URL('../src/components/portada/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const load = createLoader()
const { Hero } = load(`${root}Portada.tsx`)
const { TryScene, Steps, PhotoSlot } = load(`${root}PortadaBody.tsx`)
const text = lang => key => byKey[key][lang]
const html = (element) => renderToStaticMarkup(createElement(MemoryRouter, null, element))

test('ES-155 C: cada clave landing.portada.* usada por los componentes existe en ES y EN y no está vacía', () => {
  const used = new Set()
  for (const file of ['Portada.tsx', 'PortadaBody.tsx']) {
    const src = read(`../src/components/portada/${file}`)
    for (const match of src.matchAll(/\bp\('([a-z0-9_]+)'\)/g)) used.add(match[1])
    for (const match of src.matchAll(/p\(`st\$\{n\}(b?)`\)/g)) for (const n of ['1', '2', '3']) used.add(`st${n}${match[1]}`)
  }
  assert.ok(used.size >= 30, `claves usadas: ${used.size}`)
  for (const key of used) { const entry = byKey[`landing.portada.${key}`]; assert.ok(entry && entry.es.trim() && entry.en.trim(), key) }
  assert.deepEqual(portada.filter(entry => !entry.es.trim() || !entry.en.trim()), [])
})

test('ES-155 C: ningún texto de la portada promete empleo, ingresos ni resultados, ni inventa testimonios o cifras', () => {
  const forbidden = /empleo garantizado|garantiz|asegura(mos)? (que )?(consigas|encontr)|conseguir(á|ás)? (un )?trabajo|aumenta(rás)? tu sueldo|\b\d+\s?%|testimoni|reseñas? de|resultados garantizados|guarantee|you will (get|land|find)|testimonial|salary|certificad[oa] por/i
  for (const entry of portada) for (const lang of ['es', 'en']) assert.ok(!forbidden.test(entry[lang]), `${entry.key} (${lang}): ${entry[lang]}`)
  // lo que sí dice: que nadie certifica el nivel y que la pista es una sugerencia
  assert.match(byKey['landing.portada.st3b'].es, /Nadie lo certifica/); assert.match(byKey['landing.portada.hint_body'].es, /sugerencia, no una evaluación/)
})

test('ES-155 C (render): el ejemplo va rotulado y avisa que la pista es fija; la escena es editable y limitada; «Escribir la mía» lleva al registro', () => {
  for (const lang of ['es', 'en']) {
    const out = html(createElement(TryScene, { text: text(lang) }))
    assert.ok(out.includes(`>${byKey['landing.portada.try_example'][lang]}<`), `rótulo de ejemplo (${lang})`)
    assert.ok(out.includes(byKey['landing.portada.try_note'][lang]), `aviso «pista fija, nada se envía ni se guarda» (${lang})`)
    assert.match(out, /<textarea[^>]*maxLength="360"|<textarea[^>]*maxlength="360"/i); assert.ok(out.includes(byKey['landing.portada.try_value'][lang]))
    assert.match(out, /href="\/login\?mode=register"/); assert.match(out, /aria-live="polite"/)
  }
})

test('ES-155 C (render): el relieve del hero es decorativo (aria-hidden), la leyenda tiene cuatro símbolos y el hueco de fotografía es un marcador sin imagen', () => {
  const hero = html(createElement(Hero, { text: text('es') }))
  assert.match(hero, /class="pt-hero__relief" aria-hidden="true"/); assert.equal((hero.match(/class="pt-sym /g) ?? []).length, 4)
  assert.ok(hero.includes('Tu experiencia tiene <em>relieve.</em>'), 'h1 con el énfasis')
  const photo = html(createElement(PhotoSlot, { text: text('es') }))
  assert.ok(photo.includes('role="note"') && photo.includes('Espacio reservado para fotografía real') && !/<img|<picture|<svg|url\(/.test(photo), 'marcador sin imagen')
  assert.match(byKey['landing.portada.photo'].es, /no se genera con IA/)
  const steps = html(createElement(Steps, { text: text('en') }))
  assert.equal((steps.match(/<li>/g) ?? []).length, 3); assert.ok(steps.includes('id="como-funciona"'))
})

test('ES-155 C: la pieza de ejemplo no hace red ni guarda nada; la portada no usa estilos en línea ni emojis ni colores fijos; el cuerpo y lo conservado van en bloques aparte', () => {
  const body = read('../src/components/portada/PortadaBody.tsx')
  assert.ok(!/fetch\(|XMLHttpRequest|sendBeacon|localStorage|sessionStorage|indexedDB|document\.cookie/.test(body), 'la pieza no toca red ni almacenamiento')
  for (const file of ['Portada.tsx', 'PortadaBody.tsx', 'useAfterFirstPaint.ts', 'useScrollToHash.ts']) {
    const src = read(`../src/components/portada/${file}`)
    assert.ok(!src.includes('style={{'), `${file} sin estilos en línea`); assert.ok(!/\p{Extended_Pictographic}/u.test(src), `${file} sin emojis`)
  }
  for (const file of ['portada.css', 'portadaBody.css', 'portadaTail.css']) assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(read(`../src/components/portada/${file}`)), `${file} solo tokens --cg-*`)
  const page = read('../src/pages/LandingPage.tsx')
  assert.ok(page.includes("lazy(() => import('../components/portada/PortadaBody'))") && page.includes("lazy(() => import('../components/landing/LandingTail'))") && page.includes('<PublicFrame migrated>'))
  assert.ok(!/ExampleStrip|HeroDoors|LandingJourney|LandingHeader/.test(page), 'lo reemplazado ya no se monta (los componentes se conservan)')
  const tail = read('../src/components/landing/LandingTail.tsx')
  for (const part of ['LandingPlans', 'LandingTrust', 'LandingFaq', 'LandingProject', 'LandingJoin', 'LandingFooter']) assert.ok(tail.includes(`<${part}`), `se conserva ${part}`)
  assert.ok(read('../src/components/portada/useAfterFirstPaint.ts').includes('requestIdleCallback'), 'el canvas espera al reposo')
})
