// ES-309 (PR 1): panel profesional (/therapist/dashboard) en Cartografía. Sin DOM: contratos del código; el comportamiento (axe claro/oscuro, 320 px, diálogo de la guía, CLS)
// lo verifican scripts/es309-check.cjs, es177-panel-check.cjs, es177-b2-check.cjs, es265-check.cjs y es285-check.cjs.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { isMigratedProfessionalPath, MIGRATED_PROFESSIONAL_PATHS } from '../src/shell/professionalLayoutState.ts'

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8')
const dir = '../src/pages/therapist/'
const files = ['TherapistDashboard.tsx', 'PanelSections.tsx', 'ValidationBlock.tsx', 'GuideBlock.tsx'].map((name) => [name, read(dir + name)])
const css = read(dir + 'panel.css')

test('ES-309: el panel está en la lista de rutas migradas del área Profesional y la ficha todavía no; cada ruta de la lista existe en App.tsx', () => {
  assert.equal(isMigratedProfessionalPath('/therapist/dashboard'), true)
  assert.equal(isMigratedProfessionalPath('/therapist/patient/12'), false, 'la ficha migra en el PR 2')
  assert.equal(isMigratedProfessionalPath('/therapist/session/3'), false, 'la sala de sesión (ES-179) queda fuera')
  const app = read('../src/App.tsx')
  for (const path of MIGRATED_PROFESSIONAL_PATHS) assert.ok(app.includes(`path="${path}"`), `${path} en App.tsx`)
})

test('ES-309: el marco Profesional pide tema del sistema y quita elv-theme solo para las pantallas migradas', () => {
  const frames = read('../src/shell/frames.tsx'), layout = read('../src/layouts/TherapistLayout.tsx')
  assert.match(frames, /export function ProfessionalFrame\(\{ children, migrated = false \}/)
  assert.match(frames, /mainClassName=\{migrated \? '' : 'elv-theme'\} theme=\{migrated \? 'system' : 'light'\}/)
  assert.match(layout, /<ProfessionalFrame migrated=\{isMigratedProfessionalPath\(pathname\)\}>/)
})

test('ES-309: los cuatro archivos del panel no llevan estilos en línea, colores fijos ni clases del tema anterior', () => {
  for (const [name, source] of files) {
    assert.doesNotMatch(source, /style=\{|CSSProperties|#[0-9a-fA-F]{3,8}\b|rgb\(|elv-|th-notice|th-two-col|th-sticky|panelStyles/, name)
  }
  assert.match(files[0][1], /className="pg tp"/); assert.match(files[0][1], /className="tp-two"/)
})

test('ES-309: panel.css usa solo tokens --cg-* (sin colores fijos), con reduced-motion y forced-colors', () => {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '')
  assert.doesNotMatch(clean, /#[0-9a-fA-F]{3,8}\b|rgb\(|--color-|--space-|--elv-/)
  assert.match(css, /prefers-reduced-motion/); assert.match(css, /forced-colors/)
  assert.match(css, /@media \(min-width: 1000px\) \{ \.tp-two/) // dos columnas desde 1000 px
})

test('ES-309: se conservan el orden del DOM, «Persona n» sin nombre ni correo y los estados por bloque', () => {
  const dash = files[0][1], sections = files[1][1]
  const order = [...dash.matchAll(/<(SummaryBlock|UpcomingBlock|PeopleBlock|AlertsBlock|ValidationBlock|GuideBlock)\b/g)].map((m) => m[1])
  assert.deepEqual(order, ['SummaryBlock', 'UpcomingBlock', 'PeopleBlock', 'AlertsBlock', 'ValidationBlock', 'GuideBlock'])
  assert.match(sections, /personLabel\(p, t\('therapist_person'\)\)/); assert.match(sections, /\{noAccess && <> — <span>\{t\('panel_no_access'\)\}<\/span><\/>\}/)
  assert.doesNotMatch(sections, /\.email/)
  assert.match(sections, /aria-busy=\{state\.status === 'loading'\}/); assert.match(sections, /role="alert"/); assert.match(sections, /panel_retry/)
  assert.match(sections, /<Figures items=\{cards\} \/>/)
})

test('ES-309: la guía usa el Dialog compartido con los mismos textos, foco y reenvío; el cuadro de texto conserva sus descripciones', () => {
  const guide = files[3][1]
  assert.match(guide, /<Dialog\s+open=\{open\}\s+onClose=\{close\}/)
  assert.match(guide, /form="panel-guide-form"/); assert.match(guide, /id="panel-guide-form"/)
  assert.match(guide, /aria-describedby="panel-guide-counter panel-guide-error"/)
  assert.match(guide, /id="panel-guide-error" role="alert"/)
  assert.doesNotMatch(guide, /showModal|<dialog|dialog\.current/)
  // «Entrar» tras una sesión vencida sigue yendo al botón (E243-1) y la guía no se reenvía a ciegas (E218-3)
  assert.match(guide, /querySelector\('dialog\.cg-dialog\[open\]'\)/); assert.match(guide, /async function reconcile\(\)/)
})

test('ES-309: la validación usa chips con la palabra del estado y la etiqueta del archivo se asocia por for/id', () => {
  const val = files[2][1]
  assert.match(val, /<Chip tone=\{STATUS_TONE\[d\.status\]\}>\{t\(STATUS_KEY\[d\.status\]\)\}<\/Chip>/)
  assert.match(val, /htmlFor="panel-val-file"/); assert.match(val, /id="panel-val-file"/)
  assert.match(val, /<SelectField label=\{t\('panel_val_type'\)\}/)
})

test('ES-309: no hay almacenamiento del navegador nuevo en el panel', () => {
  for (const [name, source] of files) assert.doesNotMatch(source.replace(/localStorage\.getItem\('elevation_token'\)/g, ''), /localStorage|sessionStorage|indexedDB|document\.cookie/, name)
})
