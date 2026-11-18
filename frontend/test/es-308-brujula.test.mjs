// ES-308 (PR 3): la Brújula pasa a Cartografía dentro del marco de persona. Estructura y compromisos que no deben perderse.
// Además cierra E310-1 (QA, PR #310): las pruebas unitarias no detectaban (a) sacar /app/evidence de las rutas migradas ni (b) que el reintento de Evidencias regenerara el requestId.
// El comportamiento lo mide scripts/es308-brujula-check.cjs en navegador.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { MIGRATED_PERSON_PATHS, isMigratedPersonPath } from '../src/shell/personLayoutState.ts'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const page = read('../src/compass/CompassPage.tsx')
const css = read('../src/compass/compass.css')
const evidence = read('../src/pages/EvidencePages.tsx')

test('ES-308 PR 3: /app/compass está registrada como migrada (tema claro/oscuro del sistema, sin elv-theme)', () => {
  assert.ok(MIGRATED_PERSON_PATHS.includes('/app/compass'))
  assert.equal(isMigratedPersonPath('/app/compass'), true)
  assert.equal(isMigratedPersonPath('/app/compassx'), false)
})

test('ES-308 PR 3: la pantalla usa PersonScreen y piezas de Cartografía; no dibuja encabezado, idioma, «Saltar» ni main propios, ni clases elv-*, ni estilos en línea', () => {
  assert.match(page, /import \{ PersonScreen \} from '\.\.\/space\/PersonScreen'/)
  assert.match(page, /<PersonScreen title=\{tr\('title'\)\}/)
  assert.match(page, /import \{[^}]*\bDialog\b[^}]*\} from '\.\.\/cartografia'/)
  assert.doesNotMatch(page, /elv-|compass-scope|compass-skip|compass-main|<main\b|<header\b|style=\{\{/)
  assert.doesNotMatch(page, /setLang|tr\('skip'\)|tr\('language'\)/) // el idioma y «Saltar al contenido» los pone el marco (PersonLayout)
  assert.doesNotMatch(page, /<dialog\b|showModal|dialog\.current/) // el diálogo es el <Dialog> de Cartografía (foco, Tab atrapado, Esc, foco devuelto)
})

test('ES-308 PR 3: retirar abre el <Dialog> de Cartografía, Cancelar y Esc lo cierran (no mientras hay una operación) y retirar lo cierra antes de la petición', () => {
  assert.match(page, /<Button variant="ghost" disabled=\{!!busy\} onClick=\{\(\) => setWithdrawOpen\(true\)\}>\{tr\('withdraw'\)\}<\/Button>/)
  assert.match(page, /<Dialog open=\{withdrawOpen\} onClose=\{\(\) => \{ if \(!busy\) setWithdrawOpen\(false\) \}\} title=\{tr\('withdraw_confirm'\)\}/)
  assert.match(page, /\{tr\('cancel'\)\}<\/Button><Button variant="danger" onClick=\{\(\) => void withdraw\(\)\}>\{tr\('withdraw_confirm'\)\}/)
  assert.match(page, /setWithdrawOpen\(false\); locked\.current = true; setBusy\('withdrawing'\)/)
})

test('ES-308 PR 3: la vista previa exacta conserva casilla de autorización, vencimiento y la autorización deshabilitada al vencer', () => {
  assert.match(page, /<CheckField label=\{tr\('authorize'\)\} checked=\{authorized\} disabled=\{!!busy \|\| expired\}/)
  assert.match(page, /<time dateTime=\{review\.preview\.expiresAt\}>/)
  assert.match(page, /\{expired && <p className="cg-error" role="alert">\{tr\('expired'\)\}<\/p>\}/)
  // el aviso sigue siendo una región viva que recibe el foco al cambiar
  assert.match(page, /ref=\{noticeRef\} tabIndex=\{-1\} role=\{failed \? 'alert' : 'status'\} aria-live="polite"/)
  assert.match(page, /useEffect\(\(\) => \{ if \(notice\) noticeRef\.current\?\.focus\(\) \}, \[notice\]\)/)
})

test('ES-308 PR 3: compass.css solo tiene lo que las piezas no cubren, sin colores fijos ni el ámbito antiguo', () => {
  assert.doesNotMatch(css, /#[0-9a-fA-F]{3,8}\b|\.compass-scope|elv-/)
  assert.ok(existsSync(new URL('../src/compass/compass.css', import.meta.url)))
})

// ---- E310-1 (QA, PR #310) ----
test('E310-1 (a): /app/evidence y sus subrutas siguen en las rutas migradas (sacarla devolvería el lienzo claro heredado)', () => {
  assert.ok(MIGRATED_PERSON_PATHS.includes('/app/evidence'))
  for (const path of ['/app/evidence', '/app/evidence/new', '/app/evidence/12', '/app/evidence/12/edit', '/app/evidence/resume-skills']) assert.equal(isMigratedPersonPath(path), true, path)
  assert.ok(MIGRATED_PERSON_PATHS.includes('/app/context/resumes')) // misma familia (ES-308 PR 1)
})

test('E310-1 (b): reintentar un guardado incierto de Evidencias reenvía el MISMO cuerpo: el requestId solo se crea en bodyFor y el reintento no lo regenera', () => {
  assert.equal((evidence.match(/crypto\.randomUUID\(\)/g) || []).length, 2) // las dos ramas de bodyFor (editar y crear); nada más crea ids
  const bodyFor = evidence.match(/const bodyFor = [^\n]+/)?.[0] ?? ''
  assert.equal((bodyFor.match(/crypto\.randomUUID\(\)/g) || []).length, 2)
  assert.equal((evidence.match(/bodyFor\(/g) || []).length, 2) // guardar borrador + confirmar (cada uno crea una revisión nueva, no un reintento)
  // «Reintentar» llama a write con el intento pendiente tal cual (cuerpo y acuse)
  assert.match(evidence, /<Button onClick=\{\(\) => void write\(pending\)\}>\{l\('retry'\)\}<\/Button>/)
  // write no crea ids ni cuerpos: usa el del intento y reutiliza el acuse si ya lo hubo
  const write = evidence.slice(evidence.indexOf('const write = async (attempt'), evidence.indexOf('const bodyFor ='))
  assert.ok(write.length > 100)
  assert.doesNotMatch(write, /randomUUID|bodyFor\(/)
  assert.match(write, /ack \?\?= edit \? await api\.update\(edit\.id, attempt\.body as UpdateBody\) : await api\.create\(attempt\.body\)/)
  assert.match(write, /setPending\(\{ body: attempt\.body, \.\.\.\(ack \? \{ ack \} : \{\}\) \}\)/)
})

// ---- E340-1 (QA, PR #340): el aviso de reemplazo de la Brújula no tenía prueba unitaria ----
test('E340-1: el aviso «esta autorización reemplaza la versión activa completa» solo aparece con un contexto activo y es un Banner de Cartografía con el texto del catálogo', async () => {
  const { compassEs, compassEn } = await import('../src/compass/copy.ts')
  // solo si hay versión activa (sin ella no hay nada que reemplazar), dentro de la tarjeta «Nuevo contexto directo», justo tras el límite
  assert.match(page, /<h2 id="new-heading">\{tr\('new'\)\}<\/h2><p>\{tr\('limit'\)\}<\/p>\{context\.active && <Banner title=\{tr\('replaces'\)\} \/>\}/)
  assert.equal((page.match(/tr\('replaces'\)/g) || []).length, 1) // un solo lugar: no se duplica ni se muestra sin condición
  assert.match(page, /import \{[^}]*\bBanner\b[^}]*\} from '\.\.\/cartografia'/)
  // el texto (ES y EN) dice que la nueva versión sustituye a la activa completa y que lo no seleccionado queda fuera: no promete conservar nada
  assert.equal(compassEs['compass.replaces'], 'Esta autorización reemplaza la versión activa completa. Los campos no seleccionados no estarán en la nueva versión.')
  assert.equal(compassEn['compass.replaces'], 'This authorization replaces the entire active version. Unselected fields will not be in the new version.')
})
