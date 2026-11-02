import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

// Se ejecuta el TS de producción (no una reimplementación); tsc comprueba los tipos aparte.
function moduleUrl(file) {
  const code = ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText
  return 'data:text/javascript;base64,' + Buffer.from(code).toString('base64')
}
const { skillCatalogApi, SkillCatalogError, skillRow } = await import(moduleUrl('../src/skill-catalog/api.ts'))
const { emptyForm, fromSkill, toBody, validate, missingLabel, isDirty, KEY_RE } = await import(moduleUrl('../src/skill-catalog/model.ts'))
const { skillCatalogEs, skillCatalogEn } = await import(moduleUrl('../src/skill-catalog/copy.ts'))
const read = (f) => readFileSync(new URL(f, import.meta.url), 'utf8')

const row = (over = {}) => ({ skillKey: 'comunicacion', type: 'transversal', labels: { es: 'Comunicación', en: 'Communication' },
  rubric: { levels: { 1: { es: 'a', en: 'a' }, 2: { es: 'b', en: 'b' } }, source: 'Fuente', verifiedBy: 'Alguien', verifiedAt: '2026-10-01' }, territories: ['dir', 'com'], missing: ['rubric.levels.3.es'], ...over })
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

test('ES-116 formulario: un borrador admite contenido incompleto (lo vacío se omite) y los territorios se envían sin repetir', () => {
  const f = emptyForm(); f.labelEs = '  Comunicación  '; f.territories = ['dir', 'dir', 'com']
  assert.deepEqual(toBody(f), { type: 'transversal', labels: { es: 'Comunicación' }, rubric: { levels: {} }, territories: ['dir', 'com'] })
  f.levels[2].en = 'Level two'; f.verifiedAt = '2026-10-01'; f.source = 'S'
  assert.deepEqual(toBody(f).rubric, { levels: { 2: { en: 'Level two' } }, source: 'S', verifiedAt: '2026-10-01' })
})
test('ES-116 formulario: ida y vuelta fromSkill → toBody conserva todo y el orden de territorios no cuenta como cambio', () => {
  const f = fromSkill(skillRow(row()))
  assert.equal(f.labelEs, 'Comunicación'); assert.equal(f.levels[1].es, 'a'); assert.equal(f.levels[3].es, '')
  const g = { ...f, territories: ['com', 'dir'] }
  assert.equal(isDirty(f, g), false)
  assert.equal(isDirty(f, { ...f, labelEn: 'Other' }), true)
  assert.equal(isDirty(f, { ...f, territories: ['dir'] }), true)
})
test('ES-116 validación en línea = reglas del servidor (clave, 80/300/200 caracteres, fecha válida y no futura)', () => {
  const f = emptyForm()
  assert.deepEqual(validate(f, 'comunicacion', true, '2026-10-29'), {})
  for (const key of ['Mala-Clave', 'ab', 'x'.repeat(49), '1abc', '']) assert.equal(validate(f, key, true).key, true, key)
  assert.equal(validate(f, '', false).key, undefined) // la clave solo se valida al crear
  assert.equal(validate({ ...emptyForm(), labelEs: 'x'.repeat(81) }, 'okey', true).label_es, true)
  assert.equal(validate({ ...emptyForm(), labelEn: 'x'.repeat(81) }, 'okey', true).label_en, true)
  const long = emptyForm(); long.levels[3].es = 'x'.repeat(301); assert.equal(validate(long, 'okey', true).level, true)
  assert.equal(validate({ ...emptyForm(), source: 'x'.repeat(201) }, 'okey', true).source, true)
  assert.equal(validate({ ...emptyForm(), verifiedBy: 'x'.repeat(201) }, 'okey', true).verified_by, true)
  for (const verifiedAt of ['ayer', '2026-13-45', '2999-01-01', '2026-10-30']) assert.equal(validate({ ...emptyForm(), verifiedAt }, 'okey', true, '2026-10-29').verified_at, true, verifiedAt)
  assert.deepEqual(validate({ ...emptyForm(), verifiedAt: '2026-10-29' }, 'okey', true, '2026-10-29'), {})
  assert.ok(KEY_RE.test('trabajo_en_equipo'))
})
test('ES-116 «falta» del servidor se traduce a textos legibles', () => {
  assert.deepEqual(missingLabel('rubric.levels.2.en'), { key: 'missing_level', level: '2', lang: 'EN' })
  assert.deepEqual(missingLabel('labels.es'), { key: 'missing_label', lang: 'ES' })
  for (const [path, key] of [['rubric.source', 'missing_source'], ['rubric.verifiedBy', 'missing_verified_by'], ['rubric.verifiedAt', 'missing_verified_at'], ['otra.cosa', 'missing_other']]) assert.equal(missingLabel(path).key, key)
  for (const key of ['missing_label', 'missing_level', 'missing_source', 'missing_verified_by', 'missing_verified_at', 'missing_other']) assert.ok(skillCatalogEs[`skcat.${key}`], key)
})
test('ES-116 cliente: solo rutas del catálogo con el token propio; PUT con el cuerpo exacto; sin ids de personas', async () => {
  const calls = []
  const fetcher = async (url, options) => {
    calls.push([url, options.method, options.body ? JSON.parse(options.body) : undefined, options.headers.Authorization, options.cache])
    if (options.method === 'POST' && url.endsWith('/publish')) return json(200, { id: 3, version: 3, status: 'published', publishedAt: '2026-10-29T10:00:00Z', skillCount: 1 })
    if (options.method === 'POST') return json(201, { id: 3, version: 3, status: 'draft', publishedAt: null, skillCount: 1 })
    if (options.method === 'PUT') return json(200, { skillKey: 'comunicacion', ...JSON.parse(options.body), missing: [] })
    if (options.method === 'DELETE') return json(200, { removed: true })
    if (url.endsWith('/skill-catalog')) return json(200, { catalogs: [{ id: 3, version: 3, status: 'draft', publishedAt: null, skillCount: 1 }] })
    return json(200, { id: 3, version: 3, status: 'draft', publishedAt: null, skillCount: 1, skills: [row()] })
  }
  const api = skillCatalogApi('https://api.example.invalid/', 'sintetico', fetcher)
  assert.equal((await api.list())[0].status, 'draft')
  assert.equal((await api.get(3)).skills[0].territories.length, 2)
  assert.equal((await api.create()).id, 3)
  const body = toBody(fromSkill(skillRow(row())))
  await api.save(3, 'comunicacion', body); await api.remove(3, 'comunicacion'); assert.equal((await api.publish(3)).version, 3)
  assert.deepEqual(calls.map(c => [c[1], c[0].replace('https://api.example.invalid/api/admin/skill-catalog', '')]), [['GET', ''], ['GET', '/3'], ['POST', ''], ['PUT', '/3/skills/comunicacion'], ['DELETE', '/3/skills/comunicacion'], ['POST', '/3/publish']])
  assert.deepEqual(calls[3][2], body)
  assert.ok(calls.every(c => c[3] === 'Bearer sintetico' && c[4] === 'no-store'))
  assert.equal(JSON.stringify(calls).includes('userId'), false)
  await assert.rejects(api.save(3, '../x', body), /Invalid key/)
  await assert.rejects(skillCatalogApi('x', '', fetcher).list(), e => e instanceof SkillCatalogError && e.status === 401)
})
test('ES-116 cliente: errores del servidor se conservan como código (sin mostrar texto crudo) y respuestas malformadas fallan', async () => {
  const err = (status, body) => skillCatalogApi('x', 't', async () => json(status, body))
  await assert.rejects(err(409, { code: 'draft_exists', draftId: 7, error: 'texto' }).create(), e => e.status === 409 && e.code === 'draft_exists' && e.draftId === 7)
  await assert.rejects(err(422, { code: 'incomplete_catalog', missing: { comunicacion: ['rubric.source', 5] } }).publish(1), e => e.code === 'incomplete_catalog' && e.missing.comunicacion.length === 1)
  await assert.rejects(err(403, null).list(), e => e.status === 403 && e.code === '')
  for (const bad of [null, {}, { catalogs: 'x' }, { catalogs: [{ id: 0 }] }, { catalogs: [{ id: 1, version: 1, status: 'raro', skillCount: 0 }] }]) await assert.rejects(err(200, bad).list())
  await assert.rejects(err(200, { id: 1, version: 1, status: 'draft', skillCount: 0, skills: [{ skillKey: 'MAL' }] }).get(1))
  await assert.rejects(err(200, { removed: false }).remove(1, 'abc'))
})
test('ES-116 textos: ES y EN con las mismas claves y sin vacíos; el CSS no define colores propios', () => {
  assert.deepEqual(Object.keys(skillCatalogEs).sort(), Object.keys(skillCatalogEn).sort())
  for (const [k, v] of [...Object.entries(skillCatalogEs), ...Object.entries(skillCatalogEn)]) assert.ok(v.trim().length > 0, k)
  assert.equal(/#[0-9a-fA-F]{3,8}\b/.test(read('../src/skill-catalog/skillCatalog.css')), false)
  const page = read('../src/skill-catalog/SkillCatalogPages.tsx')
  assert.equal(/error\.message|\.message\b/.test(page), false) // nunca se imprime el texto crudo del servidor
})
test('ES-116 rutas y menú: tres rutas protegidas para administración y enlace en el menú', () => {
  const app = read('../src/App.tsx')
  for (const path of ['/admin/skill-catalog', '/admin/skill-catalog/:id', '/admin/skill-catalog/:id/skills/:skillKey']) assert.match(app, new RegExp(`path="${path.replace(/[/:]/g, m => '\\' + m)}" element=\\{<AdminRoute><SkillCatalogManager />`))
  const side = read('../src/components/AdminSidebar.tsx')
  assert.match(side, /to: '\/admin\/skill-catalog', labelKey: 'skcat\.menu'/)
  assert.match(read('../src/i18n/es.ts'), /\.\.\.skillCatalogEs/); assert.match(read('../src/i18n/en.ts'), /\.\.\.skillCatalogEn/)
})

test('ES-116 (QA H-88-02) la clave «new» está reservada en el cliente y (H-88-03) el formulario se bloquea mientras guarda', () => {
  const f = emptyForm(); f.labelEs = 'Comunicación'
  assert.equal(validate(f, 'new', true).key, true)
  assert.equal(validate(f, 'new_skill', true).key, undefined)
  const page = read('../src/skill-catalog/SkillCatalogPages.tsx')
  assert.ok(page.includes('<fieldset className="skcat-lock" disabled={busy} aria-busy={busy}>'))
  assert.ok(read('../src/skill-catalog/skillCatalog.css').includes('.skcat-lock'))
})
