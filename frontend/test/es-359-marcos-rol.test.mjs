// ES-359 (PR5): profesional, administración, superadministración y junta con la misma estructura que persona (barra lateral por grupos + SU cajón en ≤ 900 px).
// Pruebas estructurales y de modelo; el navegador real lo mide scripts/es359-marcos-rol.cjs y la puerta de alcanzabilidad con backend real la corre QA.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { ADMIN_GROUPS, BOARD_GROUPS, PERSON_GROUPS, PROFESSIONAL_GROUPS, groupsFor, visibleGroups } from '../src/shell/navGroups.ts'
import { ADMIN_MENU, BOARD_MENU, PERSON_MENU, PROFESSIONAL_MENU } from '../src/shell/nav.ts'
import { canEnter, zoneForPath } from '../src/shell/access.ts'
import { shellCopy } from '../src/shell/copy.ts'
import { ROLE_FRAME_PATHS, isRoleFramePath } from '../src/shell/personLayoutState.ts'

const read = file => fs.readFileSync(new URL(file, import.meta.url), 'utf8')
const frames = read('../src/shell/frames.tsx'), app = read('../src/App.tsx'), css = read('../src/shell/shell.css'), layout = read('../src/shell/PersonLayout.tsx'), dash = read('../src/pages/therapist/TherapistDashboard.tsx')
const hrefs = groups => groups.flatMap(g => g.items.map(i => i.to))

test('ES-359 PR5: grupos del diseño aprobado — profesional «Principal», administración Resumen/Personas/Contenido/Junta, junta solo el manifiesto', () => {
  assert.deepEqual(PROFESSIONAL_GROUPS.map(g => [g.title, g.items.map(i => i.to)]), [['main', ['/therapist/dashboard', '/facilitation', '/app/professional-reviews']]])
  assert.deepEqual(ADMIN_GROUPS.map(g => [g.title, g.items.map(i => i.to)]), [
    ['grpOverview', ['/admin/dashboard', '/admin/metrics', '/admin/pilot-metrics']], ['grpPeople', ['/admin/users']],
    ['grpContent', ['/admin/prompts', '/admin/content', '/admin/route-catalog', '/admin/skill-catalog']], ['boardGroup', ['/admin/manifest']],
  ])
  assert.deepEqual(BOARD_GROUPS.map(g => [g.title, g.items.map(i => i.to)]), [[null, ['/manifiesto']]])
  assert.deepEqual(PROFESSIONAL_MENU.map(i => i.to), ['/app/data', '/manifiesto']) // «Revisiones profesionales» pasó del menú de cuenta a la barra lateral
  assert.deepEqual(ADMIN_MENU.map(i => i.to), ['/app/data']); assert.deepEqual(BOARD_MENU.map(i => i.to), ['/app/data'])
})

test('ES-359 PR5: groupsFor por rol — cada rol ve SU navegación; persona y superadministración (zona de persona) la de persona', () => {
  assert.deepEqual(hrefs(groupsFor('therapist')), hrefs(PROFESSIONAL_GROUPS)); assert.deepEqual(hrefs(groupsFor('admin')), hrefs(ADMIN_GROUPS)); assert.deepEqual(hrefs(groupsFor('board')), hrefs(BOARD_GROUPS))
  assert.deepEqual(hrefs(groupsFor('user')), hrefs(PERSON_GROUPS)); assert.deepEqual(hrefs(groupsFor('superadmin')), hrefs(PERSON_GROUPS))
  assert.deepEqual(hrefs(visibleGroups(ADMIN_GROUPS, 'superadmin')), hrefs(ADMIN_GROUPS)) // dentro de /admin la superadministración usa los grupos de administración
})

test('ES-359 PR5: alcanzabilidad por rol (≤ 2 acciones: enlace de la barra o «Menú» → enlace) — las rutas de referencia (Infra, 12756) están y cada enlace es de una zona que el rol puede entrar', () => {
  const reach = { therapist: [...hrefs(PROFESSIONAL_GROUPS), ...PROFESSIONAL_MENU.map(i => i.to)], admin: [...hrefs(ADMIN_GROUPS), ...ADMIN_MENU.map(i => i.to)], superadmin: [...hrefs(ADMIN_GROUPS), ...ADMIN_MENU.map(i => i.to)], board: [...hrefs(BOARD_GROUPS), ...BOARD_MENU.map(i => i.to)] }
  const expected = {
    admin: ['/admin/dashboard', '/admin/metrics', '/admin/pilot-metrics', '/admin/users', '/admin/prompts', '/admin/content', '/admin/route-catalog', '/admin/skill-catalog', '/admin/manifest', '/app/data'],
    therapist: ['/therapist/dashboard', '/facilitation', '/app/professional-reviews', '/manifiesto', '/app/data'], board: ['/manifiesto', '/app/data'],
  }
  expected.superadmin = expected.admin
  for (const [role, routes] of Object.entries(expected)) for (const route of routes) assert.ok(reach[role].includes(route), `${role}: ${route}`)
  for (const [role, links] of Object.entries(reach)) for (const link of links) {
    assert.ok(canEnter(role, zoneForPath(link) ?? 'member'), `${role} puede entrar a ${link}`)
    assert.ok(app.includes(`path="${link}"`) || link.startsWith('/admin/') || link === '/therapist/dashboard', `${link} es una ruta de App.tsx`)
  }
  for (const link of ['/admin/dashboard', '/admin/metrics', '/admin/pilot-metrics', '/admin/users', '/admin/prompts', '/admin/content', '/admin/route-catalog', '/admin/skill-catalog', '/admin/manifest'].map(l => l.replace('/admin/', ''))) {
    assert.ok(app.includes(`path="${link}"`) || app.includes(`path="/admin/${link}"`), `ruta admin ${link}`)
  }
})

test('ES-359 PR5: los marcos de profesional, administración y junta usan barra lateral por grupos y SU cajón; nada de la barra antigua de administración (QA-400-03)', () => {
  assert.match(frames, /drawer=\{\{ groups: drawerGroups\(groups, PROFESSIONAL_MENU, c, \[\]\)/); assert.match(frames, /drawer=\{\{ groups: drawerGroups\(groups, ADMIN_MENU, c, \[\]\)/); assert.match(frames, /drawer=\{\{ groups: drawerGroups\(groups, BOARD_MENU, c, \[\]\)/)
  assert.equal((frames.match(/sidebar=\{<SideNav groups=\{groups\} label=\{[^}]+\} \/>\} sidebarWide/g) ?? []).length, 4) // persona + los tres marcos nuevos
  assert.match(frames, /const groups = visibleGroups\(ADMIN_GROUPS, role\)/); assert.match(frames, /const groups = groupsFor\('therapist'\)/); assert.match(frames, /const groups = groupsFor\('board'\)/)
  assert.doesNotMatch(frames, /cg-sidenav|NavLinks items=\{visibleFor|ADMIN_BOARD_GROUP/); assert.doesNotMatch(css, /\.cg-sidenav/)
  assert.equal((frames.match(/drawerGroups\(groups, PERSON_MENU/g) ?? []).length, 1) // el menú de persona solo lo recibe el cajón de persona (el de ningún otro rol)
})

test('ES-359 PR5: «Mis datos» y «Revisiones profesionales» se dibujan en el marco del ROL (profesional, administración, junta); persona y superadministración, en el de persona', () => {
  assert.deepEqual([...ROLE_FRAME_PATHS], ['/app/data', '/app/professional-reviews'])
  for (const path of ROLE_FRAME_PATHS) assert.ok(app.includes(`path="${path}"`), path)
  assert.equal(isRoleFramePath('/app/data'), true); assert.equal(isRoleFramePath('/app/professional-reviews'), true); assert.equal(isRoleFramePath('/app/dashboard'), false); assert.equal(isRoleFramePath('/app/data-x'), false)
  assert.match(layout, /const Chrome = isRoleFramePath\(pathname\) \? MemberChrome : PersonChrome/)
  assert.match(frames, /if \(role === 'therapist'\) return <ProfessionalFrame migrated=\{migrated\}>/); assert.match(frames, /if \(role === 'admin'\) return <AdminFrame migrated=\{migrated\}>/); assert.match(frames, /if \(role === 'board'\) return <BoardFrame migrated=\{migrated\}>/)
  assert.match(frames, /return <PersonChrome migrated=\{migrated\} footer=\{footer\}>\{children\}<\/PersonChrome>/) // persona y superadministración
  assert.match(frames, /export function BoardFrame\(\{ children, migrated = false \}/); assert.ok(frames.includes("legacyTheme={!migrated} />}\n      sidebar={<SideNav groups={groups} label={c.boardRole} />} sidebarWide")) // la junta también sigue `migrated` (tema del sistema y sin elv-theme en «Mis datos»)
})

test('ES-359 PR5: sin textos nuevos — los títulos «Principal» y «Junta» son claves que ya existían y todos los grupos existen en ES y EN', () => {
  assert.equal(shellCopy.es.main, 'Principal'); assert.equal(shellCopy.en.main, 'Main'); assert.equal(shellCopy.es.boardGroup, 'Junta'); assert.equal(shellCopy.en.boardGroup, 'Board')
  for (const group of [...PROFESSIONAL_GROUPS, ...ADMIN_GROUPS, ...BOARD_GROUPS]) { if (group.title) { assert.ok(shellCopy.es[group.title] && shellCopy.en[group.title], group.title) } for (const item of group.items) assert.ok(shellCopy.es[item.label] && shellCopy.en[item.label], item.label) }
  assert.deepEqual(Object.keys(shellCopy.es).sort(), Object.keys(shellCopy.en).sort())
})

test('ES-359 PR5: a 320 px la marca con el chip de rol («Professional») cabe junto a «☰ Menú» (el botón no se encoge y la marca se ajusta) — sin desborde', () => {
  assert.match(css, /\.cg-header\[data-compact\] \.cg-menubtn \{ flex: none; \}/)
  assert.match(css, /@media \(max-width: 380px\) \{\n  \.cg-header\[data-compact\] \.cg-brand \{ font-size: 1\.35rem; min-width: 0; \}\n  \.cg-header\[data-compact\] \.cg-brand__role \{ font-size: 0\.7rem;/)
  assert.doesNotMatch(css.slice(css.indexOf('ES-359 (PR5): con el chip'), css.indexOf('ES-359 (PR5): con el chip') + 640), /#[0-9a-fA-F]{3,8}\b|rgb\(/) // solo tokens
})

test('ES-359 PR5 (QA-400-02): el Inicio de profesional muestra sus bloques juntos (un solo «Cargando...» hasta que todos responden o pasan 2 s) para que ninguno se desplace; cada bloque sigue cargando y fallando por separado', () => {
  assert.match(dash, /const \[revealed, setRevealed\] = useState\(false\)/)
  assert.match(dash, /if \(!revealed && \[people, upcoming, alerts, validation, guide\]\.every\(section => section\.status !== 'loading'\)\) setRevealed\(true\)/) // listos O con error: un fallo no retiene a los demás
  assert.match(dash, /window\.setTimeout\(\(\) => setRevealed\(true\), 2000\)/); assert.match(dash, /window\.clearTimeout\(timer\)/) // tope: un endpoint colgado no deja el panel en «Cargando»
  assert.match(dash, /\{!revealed \? <section className="cg-card tp-block" aria-busy="true"><p role="status" className="tp-muted">\{t\('therapist_loading'\)\}<\/p><\/section> : <>/)
  for (const need of ["useSection<PanelPerson[]>('/api/therapist/pacientes')", "useSection<UpcomingSession[]>('/api/sessions/therapist/upcoming')", "useSection<AlertsData>('/api/therapist/alerts')", "useSection<ValidationDoc[]>('/api/therapist/validation/status')", "useSection<PromptData>('/api/therapist/prompt')"]) assert.ok(dash.includes(need), need)
})
