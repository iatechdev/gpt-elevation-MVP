import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { doorTarget, splitLastWord } from '../src/content/landingDoors.ts'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const component = read('../src/components/landing/HeroDoors.tsx')
const page = read('../src/pages/LandingPage.tsx')
const css = read('../src/components/landing/landing.css')
const catalog = JSON.parse(read('../../shared/landing-content.json'))
const store = values => ({ getItem: key => values[key] ?? null })

test('ES-63: sin sesión ambas puertas van a /login', () => {
  assert.equal(doorTarget(store({})), '/login')
  assert.equal(doorTarget(store({ elevation_role: 'admin' })), '/login')
  assert.equal(doorTarget(store({ elevation_token: '' })), '/login')
})

test('ES-63: con sesión el destino sigue el mismo mapa por rol que el login (nunca /app, que no existe)', () => {
  const session = role => store({ elevation_token: 't', ...(role ? { elevation_role: role } : {}) })
  assert.equal(doorTarget(session('admin')), '/admin/dashboard')
  assert.equal(doorTarget(session('superadmin')), '/admin/dashboard')
  assert.equal(doorTarget(session('therapist')), '/therapist/dashboard')
  assert.equal(doorTarget(session('board')), '/board/manifest')
  assert.equal(doorTarget(session('user')), '/app/onboarding')
  assert.equal(doorTarget(session()), '/app/onboarding')
  assert.equal(doorTarget(store({ elevation_token: 't', elevation_role: 'user', elevation_onboarding: 'done' })), '/app/dashboard')
})

test('ES-63: un almacenamiento que lanza error cae en /login', () => {
  assert.equal(doorTarget({ getItem() { throw new Error('bloqueado') } }), '/login')
})

test('ES-63: el titular subraya solo la última palabra y no pierde texto', () => {
  assert.deepEqual(splitLastWord('Lo que has vivido cuenta.'), { head: 'Lo que has vivido ', last: 'cuenta.' })
  assert.deepEqual(splitLastWord('What you have lived counts.'), { head: 'What you have lived ', last: 'counts.' })
  assert.deepEqual(splitLastWord('Hola'), { head: '', last: 'Hola' })
  assert.deepEqual(splitLastWord(''), { head: '', last: '' })
  for (const title of ['Una  dos   tres ', 'a\nb']) {
    const { head, last } = splitLastWord(title)
    assert.equal(head + last, title)
  }
})

test('ES-63: el catálogo trae los textos aprobados del diseño en ES y EN', () => {
  const byKey = Object.fromEntries(catalog.map(entry => [entry.key, entry]))
  assert.equal(byKey['landing.hero.title'].es, 'Lo que has vivido cuenta.')
  assert.equal(byKey['landing.hero.title'].en, 'What you have lived counts.')
  assert.equal(byKey['landing.doors.1.label'].es, 'Hacer espacio')
  assert.equal(byKey['landing.doors.2.label'].en, 'Look again')
  assert.equal(byKey['landing.doors.go'].es, 'Empezar')
  for (const key of ['hero.label', 'hero.subtitle', 'doors.1.title', 'doors.1.desc', 'doors.2.title', 'doors.2.desc']) {
    assert.ok(byKey[`landing.${key}`]?.es && byKey[`landing.${key}`]?.en, key)
  }
})

test('ES-63: el componente solo usa claves landing.* existentes, sin HTML inyectado ni datos', () => {
  const keys = new Set(catalog.map(entry => entry.key))
  const used = [...component.matchAll(/text\(['`](landing\.[^'`]+)['`]\)/g)].map(match => match[1])
    .flatMap(key => key.includes('${n}') ? [1, 2].map(n => key.replace('${n}', n)) : [key])
  assert.ok(used.length >= 7)
  for (const key of used) assert.ok(keys.has(key), `clave inexistente: ${key}`)
  assert.doesNotMatch(component, /dangerouslySetInnerHTML|<form|<input|fetch\(|localStorage\.setItem/)
  assert.equal((component.match(/<Link /g) ?? []).length, 1) // un solo enlace, repetido para las dos puertas
  assert.match(component, /const doors = \[1, 2\]/)
})

test('ES-63: LandingPage monta HeroDoors y ya no usa el héroe anterior ni la imagen externa', () => {
  assert.match(page, /<HeroDoors text=\{landing\.text\} \/>/)
  assert.doesNotMatch(page, /unsplash|hero_title|hero_badge|cta_secondary/)
})

test('QA-LAND-01: el héroe y las puertas van en el marco centrado de 1080 px de la maqueta', () => {
  assert.match(page, /<div className="landing-frame">\s*<HeroDoors text=\{landing\.text\} \/>[\s\S]*?<\/div>/);
  assert.match(css, /\.landing-frame \{[^}]*max-width: 1080px[^}]*margin-inline: auto[^}]*border-inline: 1px solid/);
  assert.match(css, /\.landing-frame \{[^}]*--landing-gutter: clamp\(1rem, 2\.6vw, 1\.75rem\)/);
})

test('ES-63: estilos con foco ocre, objetivos de 44 px, una columna < 640 px y sin movimiento', () => {
  assert.match(css, /\.landing-door:focus-visible/)
  assert.match(css, /\.landing-door \{[^}]*min-height: 44px/)
  assert.match(css, /@media \(min-width: 40rem\)[^]*repeat\(2, minmax\(0, 1fr\)\)/)
  assert.match(css, /prefers-reduced-motion: reduce/)
  assert.match(css, /\.landing-scope :is\(button, a\):focus-visible \{ outline: 3px solid var\(--color-secondary\)/)
})
