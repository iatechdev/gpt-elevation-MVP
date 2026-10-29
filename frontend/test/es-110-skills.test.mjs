// ES-110: habilidades de la hoja de vida → «Mis evidencias». Textos ES/EN, contrato de lo que llega del servidor, API y estructura accesible.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { evidenceEs, evidenceEn } from '../src/evidence/copy.ts'
import { parseDeclared, parsePromote, resumeSkillsApi, selectable, whyNot, SkillsError, formatDate } from '../src/evidence/resumeSkills.ts'
import { parseEvidence, parseList, draftFromPayload, draftPayload } from '../src/evidence/model.ts'

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8')
const skill = (extra = {}) => ({ name: 'Power BI', support: 'Construí tableros en Power BI', classified: { skillKey: 'power_bi', labels: { es: 'Power BI', en: 'Power BI' } }, resume: { id: 31, version: 3, createdAt: '2026-10-12T12:00:00.000Z' }, added: false, ...extra })
const row = (extra = {}) => ({ id: 7, version: 1, status: 'draft', authoring: 'person', createdAt: '2026-10-29T12:00:00.000Z', payload: { title: 'Power BI', artifactRefs: [{ kind: 'text', excerpt: 'Construí tableros en Power BI' }] }, ...extra })

test('ES-110 textos: ES y EN con las mismas claves y marcadores; dicen que la hoja de vida no demuestra dominio; nada promete empleo ni niveles', () => {
  assert.deepEqual(Object.keys(evidenceEs).sort(), Object.keys(evidenceEn).sort())
  const placeholders = text => [...String(text).matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join(',')
  const mine = Object.keys(evidenceEs).filter(key => /^evidence\.(rs_|action_|delete_|deleted_|edit_(title|chat_only|new_version))/.test(key))
  assert.ok(mine.length >= 45, `faltan textos de ES-110 (${mine.length})`)
  for (const key of mine) {
    assert.ok(evidenceEs[key].length > 0 && evidenceEn[key].length > 0, key); assert.equal(placeholders(evidenceEs[key]), placeholders(evidenceEn[key]), key)
    for (const text of [evidenceEs[key], evidenceEn[key]]) assert.doesNotMatch(text, /garantiz|guarantee|empleo seguro|job offer|conseguir(á|as) trabajo|you will get a job|salario|salary|vacante|nivel (experto|avanzado|alto)\b/i, key)
  }
  assert.match(evidenceEs['evidence.rs_level_none_why'], /no demuestra dominio/); assert.match(evidenceEn['evidence.rs_level_none_why'], /does not prove mastery/)
  assert.match(evidenceEs['evidence.rs_intro'], /Todavía no es evidencia/); assert.match(evidenceEn['evidence.rs_intro'], /not evidence yet/)
  assert.match(evidenceEs['evidence.rs_none_picked'], /Ninguna está marcada/); assert.match(evidenceEs['evidence.rs_review_hint'], /Nada se borra solo/)
})

test('ES-110 contrato: lo que llega del servidor se valida; una habilidad nunca trae nivel y lo que no encaja se rechaza', () => {
  assert.equal(parseDeclared({ skills: [skill(), skill({ name: 'Storytelling', classified: null, support: null })] }).length, 2)
  assert.deepEqual(parseDeclared({ skills: [] }), [])
  for (const bad of [null, [], {}, { skills: 'x' }, { skills: [null] }, { skills: [skill({ name: '' })] }, { skills: [skill({ added: 'no' })] }, { skills: [skill({ resume: { id: 0, version: 3, createdAt: '2026-10-12' } })] },
    { skills: [skill({ resume: { id: 1, version: 3, createdAt: 'no-fecha' } })] }, { skills: [skill({ classified: { skillKey: '', labels: {} } })] }, { skills: [skill({ support: 5 })] }]) assert.throws(() => parseDeclared(bad), undefined, JSON.stringify(bad)?.slice(0, 60))
  assert.deepEqual(parsePromote({ created: [{ id: 3, name: 'SQL', skillKey: 'sql', replayed: false }], skipped: [{ name: 'X', reason: 'unclassified' }] }).created[0].id, 3)
  for (const bad of [null, {}, { created: [{ id: 0, name: 'x' }], skipped: [] }, { created: [], skipped: 'x' }]) assert.throws(() => parsePromote(bad))
  assert.match(formatDate('2026-10-12T12:00:00.000Z', 'es'), /12.*oct.*2026/i); assert.match(formatDate('2026-10-12T12:00:00.000Z', 'en'), /Oct.*12.*2026/)
})

test('ES-110 qué se puede añadir: catálogo vigente, texto de respaldo y aún no añadida; el motivo de lo demás es claro', () => {
  assert.equal(selectable(skill()), true); assert.equal(whyNot(skill()), null)
  assert.deepEqual([selectable(skill({ added: true })), whyNot(skill({ added: true }))], [false, 'added'])
  assert.deepEqual([selectable(skill({ classified: null })), whyNot(skill({ classified: null }))], [false, 'unclassified'])
  assert.deepEqual([selectable(skill({ support: null })), whyNot(skill({ support: null }))], [false, 'no_support'])
  assert.equal(whyNot(skill({ added: true, classified: null })), 'added')
})

test('ES-110 API: lista con la sesión; elegir envía solo requestId y nombres; sin sesión no hay llamada; los errores no se vuelven éxito', async () => {
  const calls = []
  const api = resumeSkillsApi('https://api.example.invalid/', 'token-sintetico', async (url, options) => {
    calls.push({ url, options }); assert.equal(options.headers.Authorization, 'Bearer token-sintetico'); assert.equal(options.cache, 'no-store')
    if (url.endsWith('/promote')) return Response.json({ created: [{ id: 5, name: 'SQL', skillKey: 'sql', replayed: false }], skipped: [] })
    return Response.json({ skills: [skill()] })
  })
  assert.equal((await api.list()).length, 1); assert.equal(calls[0].url, 'https://api.example.invalid/api/user/resume-skills')
  assert.deepEqual((await api.promote(['SQL'], '11111111-1111-4111-8111-111111111111')).created.map(c => c.id), [5])
  assert.equal(calls[1].options.method, 'POST'); assert.deepEqual(JSON.parse(calls[1].options.body), { requestId: '11111111-1111-4111-8111-111111111111', names: ['SQL'] })
  const anonymous = resumeSkillsApi('https://api.example.invalid', '', async () => { throw new Error('sin sesión no se llama') })
  await assert.rejects(anonymous.list(), error => error instanceof SkillsError && error.status === 401); await assert.rejects(anonymous.promote(['SQL'], 'x'), error => error.status === 401)
  for (const status of [400, 403, 500, 503]) {
    const failing = resumeSkillsApi('https://api.example.invalid', 't', async () => Response.json({ code: 'x' }, { status }))
    await assert.rejects(failing.list(), error => error.status === status); await assert.rejects(failing.promote(['SQL'], 'x'), error => error.status === status)
  }
  const garbage = resumeSkillsApi('https://api.example.invalid', 't', async () => Response.json({ nada: true })); await assert.rejects(garbage.list()); await assert.rejects(garbage.promote(['SQL'], 'x'))
})

test('ES-110 evidencia: acepta origen de la hoja de vida y «viene del chat», rechaza lo mal formado; editar devuelve exactamente lo guardado', () => {
  const origin = { kind: 'resume', version: 3, date: '2026-10-12T12:00:00.000Z', needsReview: false }
  assert.deepEqual(parseEvidence(row({ origin })).origin, origin); assert.equal(parseEvidence(row({ fromChat: true })).fromChat, true); assert.equal(parseEvidence(row()).origin, undefined)
  for (const bad of [{ origin: { ...origin, kind: 'chat' } }, { origin: { ...origin, version: 0 } }, { origin: { ...origin, date: 'x' } }, { origin: { ...origin, needsReview: 'si' } }, { origin: 'x' }, { fromChat: false }, { fromChat: 'yes' }]) assert.throws(() => parseEvidence(row(bad)), undefined, JSON.stringify(bad))
  assert.equal(parseList({ evidence: [row({ origin }), row({ id: 8, fromChat: true })] }).length, 2)
  // Ida y vuelta del formulario: lo que se guardó es lo que se edita, sin inventar campos.
  const fromResume = row().payload
  assert.deepEqual(draftPayload(draftFromPayload(fromResume), 'draft').payload, fromResume)
  const full = { title: 'Rediseño', situation: 'S', responsibility: { text: 'R', source: 'self_report' }, actions: [{ text: 'A1', source: 'self_report' }, { text: 'A2', source: 'self_report' }], alternatives: ['Alt'],
    goal: 'G', delivered: { text: 'D', source: 'self_report' }, observedEffect: { known: true, claim: { text: 'E', source: 'self_report' } }, learning: 'L', autonomy: 'assisted',
    artifactRefs: [{ kind: 'url', url: 'https://example.invalid/a', note: 'n' }, { kind: 'text', excerpt: 'x' }] }
  assert.deepEqual(draftPayload(draftFromPayload(full), 'confirmed').payload, full)
  assert.deepEqual(draftPayload(draftFromPayload({ title: 'Solo', observedEffect: { known: false }, learning: 'L' }), 'draft').payload, { title: 'Solo', observedEffect: { known: false }, learning: 'L' })
})

test('ES-110 estructura: bandeja con nada marcado por defecto, sin nivel, diálogo accesible y reintento con el mismo requestId; lista con borrar confirmado y editar solo si no viene del chat', () => {
  const page = read('../src/evidence/ResumeSkillsPage.tsx'); const origin = read('../src/evidence/ResumeOrigin.tsx'); const list = read('../src/pages/EvidencePages.tsx'); const css = read('../src/evidence/evidence.css')
  assert.match(page, /useState<Set<string>>\(new Set\(\)\)/) // por defecto ninguna marcada
  assert.doesNotMatch(page + origin, /level\b(?!_none)|nivel (alto|medio|bajo)/i) // ningún nivel numérico ni de dominio
  assert.match(page, /role="dialog" aria-modal="true" aria-labelledby="rs-confirm-title"/); assert.match(page, /event\.key === 'Escape'/); assert.match(page, /opener\.current\?\.focus\(\)/)
  assert.match(page, /requestId\.current = newId\(\)/) // la selección nueva es una solicitud nueva; reintentar la misma no duplica
  assert.match(page, /api\.promote\(chosen\.map\(skill => skill\.name\), requestId\.current\)/); assert.match(page, /disabled=\{!selectable\(skill\)\}/)
  assert.match(page, /aria-live="polite"/); assert.match(page, /role="status" aria-busy="true"/)
  assert.doesNotMatch(page + origin, /localStorage|sessionStorage|document\.cookie|indexedDB/) // la sesión la lee el módulo común; estas pantallas no guardan nada en el navegador
  assert.match(origin, /evidence-badge-dashed/); assert.match(origin, /evidence-badge-solid/); assert.match(css, /dashed/) // «declarada» y «respaldada» difieren por forma
  assert.match(origin, /declared = row\.status === 'draft'/) // sigue «declarada» hasta que la persona la respalda y confirma
  assert.match(list, /role="alertdialog"/); assert.match(list, /!row\.fromChat && <Link/); assert.match(list, /api\.remove\(id\)/); assert.match(list, /opener\.current\?\.focus\(\)/)
  assert.match(list, /edit_chat_only/); assert.doesNotMatch(list, /edit_pending/) // el aviso de «edición pendiente» ya no aplica
})
