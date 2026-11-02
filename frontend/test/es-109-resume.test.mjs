// ES-109: hoja de vida en «Tu punto de partida». Lógica pura, textos ES/EN, llamadas a la API (fetch simulado) y estructura accesible del código.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { resumeEs, resumeEn, fill } from '../src/context/resume/resumeCopy.ts'
import {
  applySuggestions, cleanExtras, countSuggested, emptyFlags, formatPeriod, insertAt, parsePeriod, removeAllSuggested, removeAt, summarize, MAX_SKILLS,
} from '../src/context/resume/resumeLogic.ts'
import { analyzeResume, checkFile, listResumes, MAX_RESUME_BYTES, readResumeConsent } from '../src/context/resume/resumeApi.ts'
import { emptyContext } from '../src/context/participantContext.ts'

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8')
const ctx = (extra = {}) => ({ ...emptyContext, ...extra })
const exp = (role, a = 2021, b = 2026) => ({ role, organization: 'Estudio Norte', startYear: a, endYear: b, isCurrent: false })
const suggestions = (extra = {}) => ({ profession: 'Líder de diseño', interests: null, sector: 'Tecnología', totalYearsExperience: 8,
  experience: [exp('Líder de diseño')], education: [{ kind: 'education', title: 'Diseño Industrial', institution: null, year: 2016 }],
  declaredSkills: [{ name: 'SQL', support: null, resumeVersion: 3 }, { name: 'Power BI', support: null, resumeVersion: 3 }], languages: [{ name: 'Español', level: 'nativo' }], ...extra })

test('ES-109 textos: ES y EN tienen las mismas claves y los mismos marcadores; el aviso del PDF y de 5 MB está en ambos; nada promete empleo ni resultados', () => {
  assert.deepEqual(Object.keys(resumeEs).sort(), Object.keys(resumeEn).sort())
  const placeholders = (text) => [...String(text).matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join(',')
  for (const key of Object.keys(resumeEs)) {
    assert.ok(resumeEs[key].length > 0 && resumeEn[key].length > 0, key)
    assert.equal(placeholders(resumeEs[key]), placeholders(resumeEn[key]), `marcadores de ${key}`)
    for (const text of [resumeEs[key], resumeEn[key]]) assert.doesNotMatch(text, /garantiz|guarantee|empleo seguro|job offer|conseguir(á|as) trabajo|you will get a job|salario|salary|vacante|nivel (experto|avanzado) verificado/i, key)
  }
  assert.match(resumeEs.resume_pdf_notice, /Solo se aceptan archivos PDF · hasta 5 MB/); assert.match(resumeEn.resume_pdf_notice, /Only PDF files are accepted · up to 5 MB/)
  assert.match(resumeEs.resume_wh_1, /correo, teléfono, dirección, enlaces y perfiles, documento de identidad/); assert.match(resumeEn.resume_wh_1, /email, phone, address, links and profiles, ID number/)
  assert.match(resumeEs.resume_best_effort, /mejor esfuerzo/); assert.match(resumeEn.resume_best_effort, /best-effort/) // no promete eliminar el 100 %
  assert.match(resumeEs.resume_skills_help, /no evidencia verificada/); assert.match(resumeEn.resume_skills_help, /not verified evidence/)
  assert.equal(fill('{n} de {max}', { n: 3, max: 5 }), '3 de 5')
  // Un mensaje por cada código de error del servidor y del cliente.
  for (const code of ['empty', 'not_pdf', 'too_large', 'encrypted', 'corrupt', 'too_many_pages', 'no_text', 'timeout', 'sanitize_failed', 'provider_unavailable', 'ai_budget_exhausted', 'ai_budget_not_configured', 'consent_required', 'resume_limit', 'rate_limited', 'analysis_in_progress', 'request_already_processed', 'network', 'internal_error']) assert.ok(resumeEs[`resume_err_${code}`] && resumeEn[`resume_err_${code}`], code)
})

test('ES-109 años: «2021–2026», «2021-actual», «2021» ⇄ startYear/endYear/isCurrent, y lo no válido se rechaza', () => {
  const year = new Date().getFullYear()
  assert.deepEqual(parsePeriod('2021–2026'), { startYear: 2021, endYear: 2026, isCurrent: false })
  for (const text of ['2021-2026', '2021 - 2026', '2021 — 2026', '2021 a 2026', '2021 to 2026', '2021 hasta 2026']) assert.deepEqual(parsePeriod(text), { startYear: 2021, endYear: 2026, isCurrent: false }, text)
  for (const text of ['2021–actual', '2021-presente', '2021 - current', '2021 to present', '2021-hoy']) assert.deepEqual(parsePeriod(text), { startYear: 2021, endYear: null, isCurrent: true }, text)
  assert.deepEqual(parsePeriod('2021'), { startYear: 2021, endYear: null, isCurrent: false }); assert.deepEqual(parsePeriod('  '), { startYear: null, endYear: null, isCurrent: false })
  for (const bad of ['abc', '2026–2021', '1900–2000', `${year + 1}`, '21–22', '2021–2022–2023', '2021.5', '2021-actual-2023']) assert.equal(parsePeriod(bad), null, bad)
  for (const period of [{ startYear: 2021, endYear: 2026, isCurrent: false }, { startYear: 2021, endYear: null, isCurrent: true }, { startYear: 2021, endYear: null, isCurrent: false }]) assert.deepEqual(parsePeriod(formatPeriod(period)), period)
  assert.equal(formatPeriod({ startYear: 2021, endYear: null, isCurrent: true }, 'current'), '2021–current')
  assert.deepEqual(parsePeriod('2021–'), { startYear: 2021, endYear: null, isCurrent: false }) // mientras se escribe «2021–2026» no se muestra un error a medias
})

test('ES-109 sugerencias: se aplican a lo vacío, NUNCA pisan lo que la persona escribió y quedan aparte; no duplican y respetan los topes', () => {
  const merged = applySuggestions(ctx(), emptyFlags(ctx()), suggestions())
  assert.equal(merged.draft.profession, 'Líder de diseño'); assert.equal(merged.flags.profession, true); assert.equal(merged.flags.interests, false)
  assert.deepEqual(merged.flags.declaredSkills, [true, true]); assert.deepEqual(merged.pending, {}); assert.equal(countSuggested(merged.flags), 3 + 1 + 1 + 2 + 1)
  // La persona ya escribió su profesión y un cargo: se conservan; la sugerencia distinta queda aparte; la idéntica no molesta.
  const mine = ctx({ profession: 'Diseñadora', sector: 'tecnología', experience: [exp('Líder de diseño')] })
  const again = applySuggestions(mine, emptyFlags(mine), suggestions())
  assert.equal(again.draft.profession, 'Diseñadora'); assert.deepEqual(again.pending, { profession: 'Líder de diseño' }); assert.equal(again.flags.profession, false)
  assert.equal(again.draft.sector, 'tecnología'); assert.equal('sector' in again.pending, false, 'igual sin distinguir mayúsculas: no se ofrece')
  assert.equal(again.draft.experience.length, 1, 'el mismo cargo y años no se duplica'); assert.deepEqual(again.flags.experience, [false])
  assert.equal(JSON.stringify(mine), JSON.stringify(ctx({ profession: 'Diseñadora', sector: 'tecnología', experience: [exp('Líder de diseño')] })), 'no muta lo recibido')
  // Valores en null del análisis no vacían nada.
  const kept = applySuggestions(mine, emptyFlags(mine), suggestions({ profession: null, sector: null, totalYearsExperience: null }))
  assert.equal(kept.draft.profession, 'Diseñadora'); assert.deepEqual(kept.pending, {})
  // Tope de habilidades.
  const many = ctx({ declaredSkills: Array.from({ length: MAX_SKILLS - 1 }, (_, i) => ({ name: `H${i}`, support: null, resumeVersion: null })) })
  assert.equal(applySuggestions(many, emptyFlags(many), suggestions()).draft.declaredSkills.length, MAX_SKILLS)
})

test('ES-109 resumen y «quitar todas»: cuenta campos con sugerencias y sin información; quitar todas deja intacto lo editado o escrito', () => {
  assert.deepEqual(summarize(suggestions()), { found: 8 - 1, empty: 1, total: 8 }) // intereses queda vacío
  assert.deepEqual(summarize(suggestions({ profession: null, sector: null, totalYearsExperience: null, experience: [], education: [], declaredSkills: [], languages: [] })), { found: 0, empty: 8, total: 8 })
  const merged = applySuggestions(ctx({ interests: 'Datos abiertos' }), emptyFlags(ctx({ interests: 'Datos abiertos' })), suggestions())
  const edited = { ...merged.draft, declaredSkills: merged.draft.declaredSkills.map((s, i) => (i === 0 ? { ...s, name: 'SQL avanzado' } : s)) }
  const flags = { ...merged.flags, declaredSkills: [false, true] } // la primera la editó la persona: deja de ser «sugerida»
  const cleared = removeAllSuggested(edited, flags)
  assert.equal(cleared.draft.profession, null); assert.equal(cleared.draft.sector, null); assert.equal(cleared.draft.totalYearsExperience, null)
  assert.deepEqual(cleared.draft.declaredSkills.map(s => s.name), ['SQL avanzado']); assert.equal(cleared.draft.interests, 'Datos abiertos'); assert.equal(cleared.draft.experience.length, 0)
  assert.equal(countSuggested(cleared.flags), 0)
})

test('ES-109 listas: quitar e insertar mantienen las marcas alineadas (Deshacer devuelve la misma posición y marca)', () => {
  const merged = applySuggestions(ctx(), emptyFlags(ctx()), suggestions())
  const removed = removeAt(merged.draft, merged.flags, 'declaredSkills', 0)
  assert.deepEqual(removed.draft.declaredSkills.map(s => s.name), ['Power BI']); assert.deepEqual(removed.flags.declaredSkills, [true])
  const back = insertAt(removed.draft, removed.flags, 'declaredSkills', 0, merged.draft.declaredSkills[0], true)
  assert.deepEqual(back.draft.declaredSkills.map(s => s.name), ['SQL', 'Power BI']); assert.deepEqual(back.flags.declaredSkills, [true, true])
})

test('ES-109 limpieza antes de guardar: filas vacías se descartan, las incompletas se señalan y los límites coinciden con el servidor', () => {
  const dirty = ctx({ sector: '  ', experience: [exp(' '), { role: '', organization: null, startYear: null, endYear: null, isCurrent: false }, exp('Diseñadora UX')],
    education: [{ kind: 'education', title: '', institution: null, year: null }], languages: [{ name: '', level: null }, { name: ' Inglés ', level: ' ' }], declaredSkills: [{ name: ' SQL ', support: null, resumeVersion: null }, { name: '', support: null, resumeVersion: null }] })
  const out = cleanExtras(dirty)
  assert.deepEqual(out.errors, ['experience']) // la fila con organización y años pero sin cargo está incompleta
  assert.deepEqual(out.draft.experience.map(e => e.role), ['', 'Diseñadora UX']); assert.equal(out.draft.sector, null); assert.deepEqual(out.draft.education, [])
  assert.deepEqual(out.draft.languages, [{ name: 'Inglés', level: null }]); assert.deepEqual(out.draft.declaredSkills.map(s => s.name), ['SQL'])
  const ok = cleanExtras(ctx({ experience: [exp('Diseñadora UX')], totalYearsExperience: 8 })); assert.deepEqual(ok.errors, [])
  const year = new Date().getFullYear()
  const bad = cleanExtras(ctx({ education: [{ kind: 'education', title: 'x'.repeat(161), institution: null, year: null }, { kind: 'certification', title: 'ok', institution: null, year: year + 1 }],
    declaredSkills: [{ name: 'SQL', support: null, resumeVersion: null }, { name: 'sql', support: null, resumeVersion: null }], totalYearsExperience: 61, languages: Array.from({ length: 11 }, (_, i) => ({ name: `L${i}`, level: null })) }))
  assert.deepEqual([...bad.errors].sort(), ['declaredSkills', 'education', 'languages', 'totalYearsExperience'])
  assert.deepEqual(cleanExtras(ctx({ sector: 'x'.repeat(81) })).errors, ['sector'])
})

test('ES-109 archivo: se rechaza en el navegador lo vacío, lo que no es PDF y lo que pasa de 5 MB; 5 MB exactos sí', () => {
  const file = (name, size, type = 'application/pdf') => ({ name, size, type })
  assert.equal(checkFile(file('cv.pdf', 1000)), null); assert.equal(checkFile(file('CV.PDF', 1000, '')), null)
  assert.equal(checkFile(file('cv.pdf', 0)), 'empty'); assert.equal(checkFile(file('cv.docx', 1000, 'application/msword')), 'not_pdf'); assert.equal(checkFile(file('foto.png', 1000, 'image/png')), 'not_pdf')
  assert.equal(checkFile(file('cv.pdf', MAX_RESUME_BYTES)), null); assert.equal(checkFile(file('cv.pdf', MAX_RESUME_BYTES + 1)), 'too_large')
  assert.equal(MAX_RESUME_BYTES, 5 * 1024 * 1024)
})

function stubFetch(handler) {
  const calls = []
  globalThis.localStorage = { getItem: () => 'token-sintetico' }
  globalThis.fetch = async (url, options = {}) => { calls.push({ url: String(url), options }); return handler(String(url), options) }
  return calls
}
const reply = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body, blob: async () => new Blob(['x']) })
const pdf = () => new File(['%PDF-1.4 sintético'], 'Mi Hoja De Vida Privada.pdf', { type: 'application/pdf' })

test('ES-109 API: el análisis envía solo requestId y el PDF con nombre neutro, con la sesión, y traduce cada respuesta del servidor', async () => {
  const meta = { id: 7, version: 2, size: 18, createdAt: '2026-10-29T12:00:00.000Z' }
  const calls = stubFetch(() => reply(200, { resume: meta, reused: false, suggestions: suggestions(), discarded: 2 }))
  const ok = await analyzeResume(pdf(), '11111111-1111-4111-8111-111111111111')
  assert.equal(ok.status, 'ok'); assert.deepEqual(ok.resume, meta); assert.equal(ok.suggestions.profession, 'Líder de diseño'); assert.equal(ok.discarded, 2)
  const { url, options } = calls[0]
  assert.match(url, /\/api\/user\/resumes\/analyze$/); assert.equal(options.method, 'POST'); assert.equal(options.headers.Authorization, 'Bearer token-sintetico'); assert.equal(options.cache, 'no-store')
  assert.equal(options.body.get('requestId'), '11111111-1111-4111-8111-111111111111'); assert.equal(options.body.get('cv').name, 'cv.pdf') // el nombre original no viaja
  assert.deepEqual([...options.body.keys()].sort(), ['cv', 'requestId'])
  for (const [status, code, extra, retryable] of [[400, 'not_pdf', {}, false], [422, 'no_text', {}, false], [403, 'consent_required', {}, false], [409, 'resume_limit', {}, false], [429, 'ai_budget_exhausted', {}, false],
    [502, 'provider_unavailable', { retryable: true, resume: meta }, true], [500, 'internal_error', {}, false]]) {
    stubFetch(() => reply(status, { code, ...extra }))
    const result = await analyzeResume(pdf(), 'x')
    assert.deepEqual([result.status, result.code, result.http, result.retryable], ['error', code, status, retryable], code)
    if (extra.resume) assert.deepEqual(result.resume, meta)
  }
  stubFetch(() => reply(500, { code: 'codigo-que-no-existe' })); assert.equal((await analyzeResume(pdf(), 'x')).code, 'internal_error')
  stubFetch(() => reply(200, { nada: true })); assert.equal((await analyzeResume(pdf(), 'x')).code, 'internal_error') // una respuesta fuera de contrato no produce sugerencias
  stubFetch(() => { throw new TypeError('fetch failed') }); assert.deepEqual(await analyzeResume(pdf(), 'x'), { status: 'error', code: 'network', http: 0, retryable: true })
  const controller = new AbortController(); stubFetch(() => { controller.abort(); throw Object.assign(new Error('abort'), { name: 'AbortError' }) })
  assert.equal((await analyzeResume(pdf(), 'x', controller.signal)).code, 'cancelled')
})

test('ES-109 API: lectura del consentimiento y del histórico validan lo que reciben', async () => {
  stubFetch(() => reply(200, { consents: [{ purpose: 'necessary', status: 'granted' }, { purpose: 'resume_ai_reading', status: 'granted' }] })); assert.equal(await readResumeConsent(), true)
  stubFetch(() => reply(200, { consents: [{ purpose: 'resume_ai_reading', status: 'revoked' }] })); assert.equal(await readResumeConsent(), false)
  stubFetch(() => { throw new Error('x') }); assert.equal(await readResumeConsent(), false)
  stubFetch(() => reply(200, { resumes: [{ id: 1, version: 1, size: 10, createdAt: '2026-10-29T00:00:00Z' }, { id: 'x' }, null], maxVersions: 5 }))
  assert.deepEqual((await listResumes()).resumes.map(r => r.id), [1])
  stubFetch(() => reply(503, {})); assert.equal(await listResumes(), null)
})

test('ES-109 estructura: la tarjeta cumple lo aprobado (aviso PDF antes del botón, consentimiento previo, estado honesto, foco y lector de pantalla, sin almacenamiento local)', () => {
  const starter = read('../src/context/resume/ResumeStarter.tsx'); const extras = read('../src/context/resume/ContextExtras.tsx'); const page = read('../src/context/resume/ResumesPage.tsx')
  assert.ok(starter.indexOf('resume_pdf_notice') < starter.indexOf('resume_choose'), 'el aviso del PDF va ANTES del botón de elegir archivo')
  assert.match(starter, /disabled=\{!consent \|\| disabled\}/) // sin autorización no se analiza
  assert.match(starter, /useState\(false\) \/\/ siempre parte desmarcada/); assert.doesNotMatch(starter, /readResumeConsent/) // nunca viene premarcada
  assert.match(starter, /setResumeConsent\(true\)[\s\S]*analyzeResume\(/) // la autorización se registra antes de enviar
  assert.match(starter, /role="alert"/); assert.match(starter, /aria-busy=\{stage === 'analyzing'\}/); assert.match(starter, /heading\.current\?\.focus\(\)/)
  assert.match(starter, /className="rs-bar" aria-hidden="true"/) // barra indeterminada: sin porcentajes inventados
  assert.doesNotMatch(starter + extras + page, /localStorage|sessionStorage|document\.cookie|indexedDB/)
  assert.match(starter, /onDrop=/); assert.match(starter, /type="file" accept="application\/pdf,\.pdf"/)
  assert.match(extras, /aria-label=\{fill\(t\('resume_skill_remove'\)/); assert.match(extras, /resume_undo/); assert.match(extras, /role="status"/)
  assert.match(page, /role="alertdialog"/); assert.match(page, /opener\.current\?\.focus\(\)/) // el foco vuelve a quien abrió la confirmación
  const form = read('../src/context/ParticipantContextForm.tsx')
  assert.match(form, /schemaVersion: 2/); assert.match(form, /schema_outdated/); assert.match(form, /cleanExtras\(draft\)/)
  assert.match(form, /registerContextNavigationGuard/) // salir con lo sugerido sin guardar pide confirmación
})
