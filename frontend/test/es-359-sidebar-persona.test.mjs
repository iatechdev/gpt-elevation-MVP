// ES-359 (PR2): barra lateral de PERSONA por grupos (diseño aprobado en ES-359). Modelo de navegación reutilizable (PR3 cajón, PR5 profesional/admin).
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PERSON_GROUPS, groupsFor } from '../src/shell/navGroups.ts'
import { PERSON_MENU } from '../src/shell/nav.ts'
import { shellCopy } from '../src/shell/copy.ts'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const app = read('../src/App.tsx')
const links = PERSON_GROUPS.flatMap(group => group.items)

test('ES-359 PR2: los 6 grupos aprobados con sus enlaces, en orden', () => {
  assert.deepEqual(PERSON_GROUPS.map(g => g.title), [null, 'grpSupport', 'grpCareer', 'grpFollow', 'grpPro'])
  assert.deepEqual(PERSON_GROUPS[0].items.map(i => i.to), ['/app/dashboard'])
  assert.deepEqual(PERSON_GROUPS[1].items.map(i => i.label), ['today', 'chat', 'diary', 'bridge', 'tools', 'exercises'])
  assert.deepEqual(PERSON_GROUPS[2].items.map(i => i.label), ['map', 'evidence', 'next', 'compass', 'routeCatalog', 'resumes'])
  assert.deepEqual(PERSON_GROUPS[3].items.map(i => i.label), ['progress', 'plan'])
  assert.deepEqual(PERSON_GROUPS[4].items.map(i => i.label), ['myProfessional', 'reviews'])
})

test('ES-359 PR2: las 3 entradas que no tenían enlace (Ejercicios, Brújula, Catálogo de rutas) existen y apuntan a rutas reales de App.tsx; ninguna ruta se repite', () => {
  for (const to of ['/app/exercises', '/app/compass', '/app/route-catalog']) assert.ok(links.some(l => l.to === to), to)
  for (const link of links) assert.ok(app.includes(`path="${link.to}"`), `${link.to} es una ruta de App.tsx`)
  assert.equal(new Set(links.map(l => l.to)).size, links.length, 'sin enlaces repetidos')
})

test('ES-359 PR2: persona y superadministración ven los grupos; los demás roles ninguno todavía (PR5)', () => {
  assert.equal(groupsFor('user').length, 5); assert.equal(groupsFor('superadmin').length, 5)
  for (const role of ['therapist', 'admin', 'board']) assert.equal(groupsFor(role).length, 0, role)
})

test('ES-359 PR2: textos ES/EN de grupos y de las 4 entradas, con las mismas claves', () => {
  const GROUPS = { grpSupport: ['Acompañamiento', 'Support'], grpCareer: ['Mi carrera', 'My career'], grpFollow: ['Seguimiento', 'Follow-up'], grpPro: ['Con mi profesional', 'With my professional'], grpOverview: ['Resumen', 'Overview'], grpPeople: ['Personas', 'People'], grpContent: ['Contenido', 'Content'] }
  for (const [key, [es, en]] of Object.entries(GROUPS)) { assert.equal(shellCopy.es[key], es); assert.equal(shellCopy.en[key], en) }
  for (const key of ['panel', 'exercises', 'compass', 'routeCatalog']) assert.ok(shellCopy.es[key] && shellCopy.en[key], key)
  assert.deepEqual(Object.keys(shellCopy.es).sort(), Object.keys(shellCopy.en).sort())
})

test('ES-359 PR2: los 8 enlaces que pasan a la barra lateral siguen en el menú de usuario SOLO en móvil (narrowOnly) hasta el cajón; Mis datos, Tu opinión y el Manifiesto se quedan siempre', () => {
  const moved = PERSON_MENU.filter(i => i.narrowOnly).map(i => i.to).sort()
  assert.deepEqual(moved, ['/app/bridge', '/app/checkin', '/app/context/resumes', '/app/my-therapist', '/app/plan', '/app/professional-reviews', '/app/progress', '/app/space/tools'])
  for (const link of moved) assert.ok(links.some(l => l.to === link), `${link} está en la barra lateral`)
  assert.deepEqual(PERSON_MENU.filter(i => !i.narrowOnly).map(i => i.to), ['/app/data', '/app/feedback', '/manifiesto'])
})

test('ES-359 PR2: marcado y estilos — un <nav> con nombre, títulos de grupo, aria-current por NavLink, 40 px, barra + negrita (no solo color), solo tokens, escritorio ≥ 901 px', () => {
  const frame = read('../src/shell/Frame.tsx'); const css = read('../src/shell/shell.css')
  assert.match(frame, /<nav className="cg-side cg-side--groups" aria-label=\{label\}>/); assert.match(frame, /aria-labelledby=\{group\.title \? titleId : undefined\}/)
  assert.match(frame, /<NavLink to=\{item\.to\}>\{c\[item\.label\]\}<\/NavLink>/)
  const added = css.slice(css.indexOf('ES-359 (PR2)'))
  assert.match(added, /\.cg-sidelist a \{[^}]*min-height: 2\.5rem/); assert.match(added, /\[aria-current='page'\] \{ box-shadow: inset 4px 0 0 var\(--cg-mark\); font-weight: 800/)
  assert.match(added, /@media \(min-width: 901px\) \{[\s\S]*14\.5rem[\s\S]*\.cg-frame--wide-side \.cg-header > \.cg-nav \{ display: none; \}/)
  assert.ok(!/#[0-9a-fA-F]{3,8}\b|rgb\(|hsl\(/.test(added), 'sin colores fijos')
  assert.match(read('../src/shell/frames.tsx'), /<SideNav groups=\{groupsFor\(readRole\('user'\)\)\} label=\{c\.main\} \/>\} sidebarWide footer=\{footer\} mobileOrder>/)
})
