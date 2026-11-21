// ES-110 (PR 2): «Actualizar mi hoja de vida». Contrato de textos aprobados (ES-110 12753/12755/12767 + el del tope de 40), claves que la pantalla usa, ruta y entrada, y la forma del origen «versión borrada».
// El comportamiento en navegador (flujos, axe, 3 anchos) está en scripts/es110-actualizar-check.cjs y el guardado contra servidor real en scripts/es110-actualizar-api-check.cjs.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { resumeEs, resumeEn } from '../src/context/resume/resumeCopy.ts'
import { contextEs, contextEn } from '../src/context/contextCopy.ts'
import { evidenceEs, evidenceEn } from '../src/evidence/copy.ts'

const read = path => fs.readFileSync(new URL(path, import.meta.url), 'utf8')
const page = read('../src/context/resume/ResumeUpdatePage.tsx')
const placeholders = text => [...String(text).matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join(',')

test('los 13 textos aprobados (ES/EN) están tal cual y el del tope de 40 lleva su marcador', () => {
  const approved = {
    resume_update: ['Actualizar mi hoja de vida', 'Update my résumé'], resume_update_help: ['Se guarda como una versión nueva; la anterior se conserva.', 'It is saved as a new version; the previous one is kept.'],
    resume_changes_title: ['Cambios frente a tu contexto actual', 'Changes compared with your current context'], resume_new_skills: ['Habilidades nuevas', 'New skills'],
    resume_still_skills: ['Siguen en tu hoja de vida', 'Still in your résumé'], resume_gone_skills: ['Ya no aparecen en esta versión', 'No longer in this version'],
    resume_link_version: ['Vincular a la versión {n}', 'Link to version {n}'], resume_keep: ['Mantener en mi contexto', 'Keep in my context'], resume_quit: ['Quitar de mi contexto', 'Remove from my context'],
    resume_confirmed_same: ['Tu evidencia confirmada no cambia.', 'Your confirmed evidence does not change.'], resume_no_change: ['Tu hoja no cambió las habilidades.', 'Your résumé did not change your skills.'],
  }
  for (const [key, [spanish, english]] of Object.entries(approved)) { assert.equal(resumeEs[key], spanish, key); assert.equal(resumeEn[key], english, key) }
  assert.deepEqual([evidenceEs['evidence.rs_origin_deleted'], evidenceEn['evidence.rs_origin_deleted']], ['Origen: versión borrada', 'Source: deleted version'])
  assert.deepEqual([evidenceEs['evidence.rs_origin_deleted_text'], evidenceEn['evidence.rs_origin_deleted_text']], ['Esta evidencia salió de una versión que borraste; revísala.', 'This evidence came from a version you deleted; review it.'])
  assert.equal(placeholders(resumeEs.resume_overflow), 'n'); assert.equal(placeholders(resumeEn.resume_overflow), 'n'); assert.match(resumeEs.resume_overflow, /40/); assert.match(resumeEn.resume_overflow, /40/)
  assert.deepEqual([resumeEs.resume_overflow_one, resumeEn.resume_overflow_one], ['1 habilidad nueva no cabe: tu contexto admite hasta 40.', '1 new skill does not fit: your context holds up to 40.'])
  assert.ok(page.includes("n === 1 ? t('resume_overflow_one')"))
})

test('ES y EN tienen las mismas claves y marcadores en los textos nuevos, y ninguno promete empleo, evaluación ni niveles', () => {
  const keys = ['resume_update', 'resume_update_help', 'resume_changes_title', 'resume_new_skills', 'resume_still_skills', 'resume_gone_skills', 'resume_link_version', 'resume_keep', 'resume_quit', 'resume_confirmed_same', 'resume_no_change', 'resume_overflow']
  for (const key of keys) { assert.ok(resumeEs[key] && resumeEn[key], key); assert.equal(placeholders(resumeEs[key]), placeholders(resumeEn[key]), key); for (const text of [resumeEs[key], resumeEn[key]]) assert.doesNotMatch(text, /garantiz|guarantee|empleo|job offer|salario|salary|evalu/i, key) }
})

test('toda clave t(...) de la pantalla existe en ES y EN (no queda ninguna sin texto)', () => {
  const keys = [...page.matchAll(/\bt\(\s*(?:'([a-z_.]+)'|`([a-z_.]+)`)\s*\)/g)].map(m => m[1] ?? m[2]); assert.ok(keys.length >= 25, `solo ${keys.length} claves`)
  const globalEs = read('../src/i18n/es.ts'), globalEn = read('../src/i18n/en.ts') // el diccionario global no se importa en Node (rutas sin extensión): se comprueba la clave en su fuente
  const have = (lang, key) => ((lang === 'es' ? { ...resumeEs, ...contextEs, ...evidenceEs } : { ...resumeEn, ...contextEn, ...evidenceEn })[key]) !== undefined || new RegExp(String.raw`\b${key}: '`).test(lang === 'es' ? globalEs : globalEn)
  for (const key of [...new Set(keys)]) { assert.ok(have('es', key), `ES sin «${key}»`); assert.ok(have('en', key), `EN sin «${key}»`) }
  // Los avisos que la pantalla pasa dinámicamente (t(notice)) son solo estas claves:
  for (const key of ['context_conflict', 'resume_schema_outdated', 'context_save_error', 'context_load_error']) { assert.ok(page.includes(`'${key}'`), key); assert.ok(have('es', key) && have('en', key), key) }
})

test('entrada y ruta: botón primario en «Hojas de vida» (sin «Subir una nueva versión» en la lista) y ruta /app/context/resumes/update en el marco de persona', () => {
  const list = read('../src/context/resume/ResumesPage.tsx'), app = read('../src/App.tsx'), layout = read('../src/shell/personLayoutState.ts')
  assert.match(list, /UPDATE_PATH = '\/app\/context\/resumes\/update'/); assert.match(list, /<Link className="cg-btn" to=\{UPDATE_PATH\}>\{t\('resume_update'\)\}<\/Link><p className="cg-hint">\{t\('resume_update_help'\)\}<\/p>/)
  assert.doesNotMatch(list, /resume_upload_new/)
  assert.match(app, /path="\/app\/context\/resumes\/update" element=\{<ResumeUpdatePage \/>\}/); assert.match(app, /const ResumeUpdatePage = lazy\(/)
  assert.ok(layout.includes("'/app/context/resumes'"), 'las subrutas de /app/context/resumes ya están en el marco migrado (prefijo)')
})

test('la pantalla nunca guarda sola ni toca evidencia: un solo PUT del contexto con expectedVersion, solo desde «Guardar», y sin tocar /api/evidence', () => {
  assert.equal([...page.matchAll(/contextRequest\(\{/g)].length, 1, 'un único guardado')
  assert.match(page, /expectedVersion: snapshot\.version, action: 'save_draft'/); assert.doesNotMatch(page, /\/api\/evidence|evidenceApi|promote\(/)
  assert.match(page, /defaultChoices\(diffSkills\(/, 'las elecciones parten de lo que fija la maqueta (nada marcado)')
  assert.match(page, /applyChoices\(snapshot\.context\.declaredSkills, diff, choices\)/)
  assert.doesNotMatch(page, /localStorage|sessionStorage|indexedDB/, 'ni el texto de la hoja ni las sugerencias se guardan en el navegador')
})

test('el origen «versión borrada» sustituye al párrafo anterior en la evidencia y conserva «Para revisión» y «Nada se borra solo»', () => {
  const origin = read('../src/evidence/ResumeOrigin.tsx')
  assert.match(origin, /origin\.needsReview && declared && <Banner title=\{t\('evidence\.rs_review'\)\}><p><strong>\{t\('evidence\.rs_origin_deleted'\)\}<\/strong><\/p><p>\{t\('evidence\.rs_origin_deleted_text'\)\}<\/p>/)
  assert.doesNotMatch(origin, /rs_review_text/); assert.match(origin, /rs_review_hint/)
})

// ── E398-4: las decisiones de la pantalla viven en resumeUpdateLogic.ts y se prueban aquí (antes solo las mataba el E2E de QA) ──
import { entryOf, outcomeAfterFailure, pendingLinks, sameSkills } from '../src/context/resume/resumeUpdateLogic.ts'
import { diffSkills } from '../src/context/resume/resumeDiff.ts'
import { parseOrphaned, parseDeclared } from '../src/evidence/resumeSkills.ts'
const sk = (name, resumeVersion = 1) => ({ name, support: null, resumeVersion })

test('«Siguen»: solo se ofrece vincular lo que no está ya en la versión nueva y no está escrito a mano (G9)', () => {
  const diff = diffSkills([sk('SQL', 1), sk('Power BI', 4), sk('Dibujo', null), sk('Excel', 1)], [sk('sql', 4), sk('Power BI', 4), sk('Dibujo', 4)], 4)
  assert.deepEqual(diff.remain.map(item => item.current.name), ['SQL', 'Power BI', 'Dibujo'])
  assert.deepEqual(pendingLinks(diff).map(item => item.current.name), ['SQL'], 'ni la ya vinculada (Power BI v4) ni la escrita a mano (Dibujo)')
  assert.deepEqual(pendingLinks(diffSkills([sk('Excel', 4)], [sk('Excel', 4)], 4)), [])
})

test('entrada: sin contexto guardado va al formulario; con el tope de versiones (5 de 5) pide elegir cuál borrar; si no, sube (G7, G16)', () => {
  assert.equal(entryOf({ version: 0, context: null }, { count: 0, max: 5 }), 'onboarding')
  assert.equal(entryOf({ version: 3, context: null }, { count: 0, max: 5 }), 'onboarding', 'versión > 0 pero sin contexto = tampoco hay con qué comparar')
  assert.equal(entryOf({ version: 3, context: {} }, { count: 5, max: 5 }), 'limit'); assert.equal(entryOf({ version: 3, context: {} }, { count: 6, max: 5 }), 'limit')
  assert.equal(entryOf({ version: 3, context: {} }, { count: 4, max: 5 }), 'upload'); assert.equal(entryOf({ version: 1, context: {} }, { count: 0, max: 5 }), 'upload')
  assert.equal(entryOf({ version: 0, context: null }, { count: 5, max: 5 }), 'onboarding', 'sin contexto manda antes que el tope')
})

test('guardar: respuesta perdida (0, 5xx, 409) cuyo contexto releído ya es lo elegido = guardado; si no, conflicto o error; 401/403 = sesión (G5)', () => {
  const applied = [sk('SQL', 4), sk('Python', 4)], same = [sk('sql', 4), sk('PYTHON', 4)], other = [sk('SQL', 1)]
  for (const status of [0, 500, 502, 503, 409]) assert.equal(outcomeAfterFailure({ status }, same, applied), 'saved', `status ${status}`)
  assert.equal(outcomeAfterFailure({ status: 409 }, other, applied), 'conflict'); assert.equal(outcomeAfterFailure({ status: 409 }, null, applied), 'conflict', 'sin poder releer, un 409 sigue siendo conflicto')
  assert.equal(outcomeAfterFailure({ status: 0 }, other, applied), 'error'); assert.equal(outcomeAfterFailure({ status: 503 }, null, applied), 'error')
  assert.equal(outcomeAfterFailure({ status: 400, code: 'schema_outdated' }, null, applied), 'schema'); assert.equal(outcomeAfterFailure({ status: 400, code: 'otro' }, null, applied), 'error')
  assert.equal(outcomeAfterFailure({ status: 400 }, same, applied), 'error', 'un 400 nunca es «se perdió la respuesta»: no se relee ni se da por guardado')
  for (const status of [401, 403]) assert.equal(outcomeAfterFailure({ status }, same, applied), 'expired', 'ni con lo releído igual: sin sesión no se dice «guardado»')
  assert.equal(sameSkills([sk('a', 1)], [sk('A', 1)]), true); assert.equal(sameSkills([sk('a', 1)], [sk('a', 2)]), false); assert.equal(sameSkills([sk('a')], [sk('a'), sk('b')]), false); assert.equal(sameSkills([sk('a'), sk('b')], [sk('b'), sk('a')]), false)
})

test('«Recargar contexto» solo relee el contexto (el análisis y las elecciones se conservan), el foco va al h1 y los radios se llaman como la habilidad (G6, G14, G15)', () => {
  const reread = page.slice(page.indexOf('const reread = async'), page.indexOf('async function save()'))
  assert.match(reread, /contextRequest\(\)/); assert.match(reread, /setSnapshot\(fresh\)/)
  assert.doesNotMatch(reread, /setFound|setChoices|setPhase|analyzeResume|listResumes/, 'no vuelve a analizar ni borra lo elegido')
  assert.match(page, /useEffect\(\(\) => \{ if \(phase !== 'loading'\) heading\.current\?\.focus\(\) \}, \[phase\]\)/); assert.match(page, /titleRef=\{heading\}/)
  assert.match(page, /role="radiogroup" aria-label=\{skill\.name\}/)
})

test('`orphaned` (#390): se lee con tolerancia, se pinta sin casilla con «Origen: versión borrada», y la lista vacía no dice una explicación falsa', () => {
  assert.deepEqual(parseOrphaned({ skills: [] }), [], 'respuesta antigua sin el campo'); assert.deepEqual(parseOrphaned(null), []); assert.deepEqual(parseOrphaned({ orphaned: 'x' }), [])
  const good = { name: 'Excel', origin: 'deleted', classified: { skillKey: 'excel', labels: { es: 'Excel', en: 'Excel' } }, added: false }
  assert.deepEqual(parseOrphaned({ orphaned: [good, { name: '' }, null, { name: 'X', added: 'si' }, { name: 'Sin catálogo', classified: { skillKey: '' }, added: true }] }),
    [{ name: 'Excel', classified: good.classified, added: false }, { name: 'Sin catálogo', classified: null, added: true }])
  assert.deepEqual(parseDeclared({ skills: [], orphaned: [good] }), [], 'las huérfanas nunca entran en la lista de las que se pueden añadir')
  const list = read('../src/evidence/ResumeSkillsPage.tsx')
  assert.match(list, /api\.overview\(signal\)/); assert.match(list, /!skills\.length && !orphaned\.length \? <section/, 'con huérfanas no se dice «no hay habilidades para revisar»')
  assert.match(list, /orphaned\.length > 0 && <OrphanedList items=\{orphaned\} \/>/); assert.match(list, /l\('rs_origin_deleted'\)/)
  const block = list.slice(list.indexOf('function OrphanedList')); assert.doesNotMatch(block, /CheckField|checkbox/, 'sin casilla: no se pueden añadir')
})

test('«revísala» solo en borradores: la evidencia confirmada dice su origen sin pedir revisión (E398-3)', () => {
  const origin = read('../src/evidence/ResumeOrigin.tsx')
  assert.match(origin, /origin\.needsReview && !declared && <small className="cg-hint"><strong>\{t\('evidence\.rs_origin_deleted'\)\}<\/strong><\/small>/)
  assert.match(origin, /origin\.needsReview && declared && <Banner/); assert.equal((origin.match(/rs_origin_deleted_text/g) ?? []).length, 1)
})
