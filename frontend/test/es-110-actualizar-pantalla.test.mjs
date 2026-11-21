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
  assert.match(origin, /origin\.needsReview && <Banner title=\{t\('evidence\.rs_review'\)\}><p><strong>\{t\('evidence\.rs_origin_deleted'\)\}<\/strong><\/p><p>\{t\('evidence\.rs_origin_deleted_text'\)\}<\/p>/)
  assert.doesNotMatch(origin, /rs_review_text/); assert.match(origin, /rs_review_hint/)
})
