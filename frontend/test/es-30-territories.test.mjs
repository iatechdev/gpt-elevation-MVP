import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

// Se ejecuta el TS de producción (no una reimplementación); tsc comprueba los tipos aparte.
function moduleUrl(file, replacements = []) {
  let code = ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
  }).outputText
  for (const [from, to] of replacements) code = code.replaceAll(from, to)
  return 'data:text/javascript;base64,' + Buffer.from(code).toString('base64')
}
const modelUrl = moduleUrl('../src/skill-map/model.ts')
const { resolveTerritories, territories } = await import(moduleUrl('../src/skill-map/territories.ts'))
const { parseSkillMap } = await import(modelUrl)
const { skillStatus, hasLevel } = await import(moduleUrl('../src/skill-map/status.ts', [["'./model'", JSON.stringify(modelUrl)]]))
const layout = await import(moduleUrl('../src/skill-map/layout.ts'))
const { readBridgeStatus, revokeBridge, ConsentError } = await import(moduleUrl('../src/skill-map/consent.ts'))
const { skillMapEs, skillMapEn } = await import(moduleUrl('../src/skill-map/copy.ts'))

const track = (over = {}) => ({ level: 2, state: 'initial', stale: false, catalogOutdated: false, confidence: 'low',
  confidenceReason: { es: 'Respaldo sintético', en: 'Synthetic support' }, evidenceCount: 1, authoring: 'person', rationale: null, needsReview: false, ...over })
const skill = (key, over = {}) => ({ skillKey: key, type: 'transversal', labels: { es: key, en: key }, rubric: {}, self: track(), review: null, state: 'initial', ...over })

test('ES-116 territorios: vienen del catálogo (skill.territories); una capacidad puede estar en varios; ids desconocidos se ignoran', () => {
  const skills = [skill('a', { territories: ['dir', 'con'] }), skill('b', { territories: ['nope'] }), skill('c', { territories: ['dir', 'dir'] }), skill('d')]
  const out = resolveTerritories(skills)
  const by = Object.fromEntries(out.groups.map(g => [g.territory.id, g.skills.map(s => s.skillKey)]))
  assert.deepEqual(by.dir, ['a', 'c']); assert.deepEqual(by.con, ['a']); assert.deepEqual(by.ing, [])
  assert.deepEqual(out.unassigned.map(s => s.skillKey), ['b', 'd']) // sin ninguno válido (o un servidor anterior sin el campo) → sin territorio asignado
  assert.equal(territories.length, 5)
})
test('ES-116 el frontend ya no trae asignación propia ni de ejemplo (la gestiona el backoffice)', () => {
  const src = readFileSync(new URL('../src/skill-map/territories.ts', import.meta.url), 'utf8')
  assert.equal(/skillTerritories|sampleSkillTerritories/.test(src), false)
  const page = readFileSync(new URL('../src/pages/SkillMapPage.tsx', import.meta.url), 'utf8')
  assert.equal(/SAMPLE_TERRITORIES|skillTerritories/.test(page), false)
})
test('ES-116 contrato: parseSkillMap acepta territories opcional y rechaza formas inválidas', () => {
  const rubric = { levels: Object.fromEntries([1, 2, 3, 4].map(n => [n, { es: 'a', en: 'a' }])), source: 's', verifiedAt: '2026-10-01' }
  const mk = (extra) => ({ catalogVersion: 1, skills: [{ skillKey: 'k', type: 'transversal', labels: { es: 'K' }, rubric, self: null, review: null, state: 'no_evidence', ...extra }] })
  assert.doesNotThrow(() => parseSkillMap(mk({}))) // servidor anterior
  assert.doesNotThrow(() => parseSkillMap(mk({ territories: [] })))
  assert.deepEqual(parseSkillMap(mk({ territories: ['dir', 'con'] })).skills[0].territories, ['dir', 'con'])
  for (const territories of ['dir', [1], [''], ['x'.repeat(17)], Array(9).fill('dir'), null, { 0: 'dir' }]) assert.throws(() => parseSkillMap(mk({ territories })), undefined, JSON.stringify(territories))
})
test('ES-30 estado: nunca promedia ni inventa nivel; null/caducado no cuentan como evidencia', () => {
  assert.equal(skillStatus(skill('a')), 'evidence')
  assert.equal(skillStatus(skill('a', { self: null })), 'none')
  assert.equal(skillStatus(skill('a', { self: track({ level: null, evidenceCount: 0 }) })), 'none')
  assert.equal(skillStatus(skill('a', { self: track({ stale: true, level: 4 }) })), 'stale')
  assert.equal(skillStatus(skill('a', { self: track({ needsReview: true }) })), 'needs_review')
  assert.equal(skillStatus(skill('a', { self: track({ stale: true }), review: track({ level: 3 }) })), 'evidence') // pistas separadas: la vigente manda solo para el estado
  assert.equal(hasLevel('none'), false); assert.equal(hasLevel('stale'), false); assert.equal(hasLevel('evidence'), true)
})
test('ES-30 disposición: ninguna capacidad tapa un territorio ni a otra, y todo cabe en el lienzo (de 1 a 40 capacidades)', () => {
  const ids = Object.keys(layout.territoryBoxes)
  for (const n of [1, 4, 9, 20, 40]) {
    const chips = Array.from({ length: n }, (_, i) => ({ key: `s${i}`, links: [ids[i % 5], ids[(i * 2 + 1) % 5]].filter((v, k, a) => a.indexOf(v) === k).slice(0, 1 + (i % 2)) }))
    const { positions, height } = layout.layoutChips(chips)
    const boxes = chips.map(c => ({ x: positions[c.key].x - layout.CHIP_W / 2, y: positions[c.key].y - layout.CHIP_H / 2, w: layout.CHIP_W, h: layout.CHIP_H }))
    const hit = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
    boxes.forEach((b, i) => {
      assert.ok(b.x >= 0 && b.x + b.w <= layout.CANVAS_W && b.y >= 0 && b.y + b.h <= height, `n=${n} fuera del lienzo`)
      for (const t of Object.values(layout.territoryBoxes)) assert.equal(hit(b, t), false, `n=${n} tapa un territorio`)
      boxes.slice(i + 1).forEach(o => assert.equal(hit(b, o), false, `n=${n} se solapan`))
    })
  }
  assert.deepEqual(layout.layoutChips([{ key: 'a', links: ['dir', 'con'] }]), layout.layoutChips([{ key: 'a', links: ['dir', 'con'] }])) // determinista
})
test('ES-30 disposición: los territorios del Figma no se solapan entre sí', () => {
  const b = Object.values(layout.territoryBoxes)
  b.forEach((x, i) => b.slice(i + 1).forEach(y => assert.equal(x.x < y.x + y.w && x.x + x.w > y.x && x.y < y.y + y.h && x.y + x.h > y.y, false)))
  const p = layout.edgePoint(layout.territoryBoxes.dir, { x: 700, y: 120 })
  assert.ok(p.x <= 360 + 0.001) // la línea sale por el borde derecho
})
test('ES-30 «Revocar todos»: solo PUT /api/consents/professional_bridge con {status:"revoked"}; sin IDs ni competencias', async () => {
  const calls = []
  await revokeBridge({ baseUrl: 'https://api.example.invalid/', token: 'sintetico', fetcher: async (url, options) => { calls.push([url, options]); return new Response('{}', { status: 200 }) } })
  assert.equal(calls.length, 1)
  const [url, options] = calls[0]
  assert.equal(url, 'https://api.example.invalid/api/consents/professional_bridge')
  assert.equal(options.method, 'PUT'); assert.equal(options.body, '{"status":"revoked"}'); assert.equal(options.cache, 'no-store')
  assert.equal(options.headers.Authorization, 'Bearer sintetico')
  for (const [status, reason] of [[401, 'expired'], [409, 'error'], [500, 'error']]) {
    await assert.rejects(revokeBridge({ baseUrl: 'x', token: 't', fetcher: async () => new Response('{}', { status }) }), e => e instanceof ConsentError && e.reason === reason)
  }
  await assert.rejects(revokeBridge({ baseUrl: 'x', token: '', fetcher: async () => { throw new Error('no debe llamar') } }), e => e.reason === 'expired')
})
test('ES-30 estado del permiso: lee solo lo propio y no inventa estados', async () => {
  const body = (consents) => async () => new Response(JSON.stringify({ consents }), { status: 200 })
  assert.equal(await readBridgeStatus({ baseUrl: 'x', token: 't', fetcher: body([{ purpose: 'professional_bridge', status: 'granted' }]) }), 'granted')
  assert.equal(await readBridgeStatus({ baseUrl: 'x', token: 't', fetcher: body([{ purpose: 'professional_bridge', status: 'revoked' }]) }), 'revoked')
  assert.equal(await readBridgeStatus({ baseUrl: 'x', token: 't', fetcher: body([{ purpose: 'professional_bridge', status: 'raro' }]) }), 'unknown')
  assert.equal(await readBridgeStatus({ baseUrl: 'x', token: 't', fetcher: body([{ purpose: 'otro', status: 'granted' }]) }), 'unknown')
  await assert.rejects(readBridgeStatus({ baseUrl: 'x', token: 't', fetcher: async () => new Response('<html>', { status: 200 }) }), e => e.reason === 'error')
  await assert.rejects(readBridgeStatus({ baseUrl: 'x', token: 't', fetcher: async () => new Response('{}', { status: 401 }) }), e => e.reason === 'expired')
})
test('ES-30 textos: ES y EN con las mismas claves, sin vacíos ni «déficit/porcentaje»', () => {
  assert.deepEqual(Object.keys(skillMapEs).sort(), Object.keys(skillMapEn).sort())
  for (const [k, v] of [...Object.entries(skillMapEs), ...Object.entries(skillMapEn)]) { assert.ok(v.trim().length > 0, k); assert.equal(/%|déficit|deficit|puntaje|score/i.test(v), false, k) }
})

test('ES-30 (QA H-86-03) tras «Revocar todos» el mapa se vuelve a leer sin pasar por «cargando»; (H-86-01) los roles usan tinta sobre los tintes', () => {
  const page = readFileSync(new URL('../src/pages/SkillMapPage.tsx', import.meta.url), 'utf8')
  assert.ok(page.includes("setBridge('revoked'); setRevoke('done'); void reloadMap()"))
  assert.ok(page.includes('const reloadMap = async'))
  const css = readFileSync(new URL('../src/skill-map/skillMap.css', import.meta.url), 'utf8')
  assert.match(css, /\.skill-map-territory-roles \{[^}]*fill: var\(--elv-text-1\)/)
  assert.match(css, /\.skill-map-roles \{[^}]*color: var\(--elv-text-1\)/)
})
