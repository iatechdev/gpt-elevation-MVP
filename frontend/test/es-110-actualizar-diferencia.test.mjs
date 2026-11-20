// ES-110 («Actualizar mi hoja de vida»): la diferencia PURA de habilidades (Nuevas / Siguen / Ya no aparecen) y la aplicación de las elecciones. Sin UI.
// Reglas: lo que ya no aparece se MANTIENE por defecto; lo escrito a mano nunca «desaparece»; se compara sin acentos ni mayúsculas; nada de lo no ofrecido se toca; tope de 40; idempotente; sin mutar los argumentos.
import test from 'node:test'
import assert from 'node:assert/strict'
import { MAX_DECLARED_SKILLS, applyChoices, defaultChoices, diffSkills, skillKey } from '../src/context/resume/resumeDiff.ts'

const s = (name, resumeVersion = 1, support = `cita de ${name}`) => ({ name, support, resumeVersion })
const names = list => list.map(item => item.name)
const frozen = value => JSON.parse(JSON.stringify(value))

test('skillKey: sin acentos, sin mayúsculas, espacios normalizados; vacío = vacío', () => {
  assert.equal(skillKey('  Gestión   de PROYECTOS '), 'gestion de proyectos'); assert.equal(skillKey('Análisis'), skillKey('analisis')); assert.equal(skillKey('   '), '')
  assert.notEqual(skillKey('SQL'), skillKey('SQLite'))
})

test('diferencia: nada contra nada, y una hoja idéntica = sin cambios', () => {
  const empty = diffSkills([], [], 2); assert.deepEqual([empty.added, empty.remain, empty.gone, empty.overflow, empty.unchanged], [[], [], [], 0, true])
  const same = diffSkills([s('SQL', 2), s('Excel', 2)], [s('sql', 2), s('EXCEL', 2)], 2); assert.equal(same.unchanged, true, 'ya vinculadas a la versión nueva: no hay nada que decidir'); assert.deepEqual(same.remain.map(r => r.linked), [true, true])
})

test('diferencia: nuevas / siguen / ya no aparecen, por nombre sin acentos ni mayúsculas', () => {
  const current = [s('Power BI', 1), s('Gestión de proyectos', 1), s('Excel', 1)]
  const suggested = [s('power bi', 2, 'nueva cita'), s('GESTION DE PROYECTOS', 2), s('Python', 2)]
  const diff = diffSkills(current, suggested, 2)
  assert.deepEqual(names(diff.added), ['Python']); assert.deepEqual(diff.remain.map(r => r.current.name), ['Power BI', 'Gestión de proyectos']); assert.deepEqual(names(diff.gone), ['Excel'])
  assert.equal(diff.remain[0].suggested.support, 'nueva cita'); assert.equal(diff.unchanged, false); assert.equal(diff.version, 2); assert.equal(diff.overflow, 0)
  assert.deepEqual(diff.remain.map(r => [r.linked, r.handwritten]), [[false, false], [false, false]])
})

test('lo escrito a mano (sin hoja de vida) NUNCA «ya no aparece»; si la hoja nueva la trae, «sigue» pero no se ofrece vincular por defecto', () => {
  const current = [s('Python', null, null), s('Inglés técnico', null, null), s('SQL', 1)]
  const diff = diffSkills(current, [s('python', 2), s('Docker', 2)], 2)
  assert.deepEqual(names(diff.gone), ['SQL'], 'solo lo que vino de una hoja de vida'); assert.deepEqual(names(diff.added), ['Docker'])
  assert.deepEqual(diff.remain.map(r => [r.current.name, r.handwritten, r.linked]), [['Python', true, false]])
  assert.deepEqual(defaultChoices(diff).link, [], 'nada se vincula por defecto (tampoco la escrita a mano)')
  assert.equal(diffSkills([s('Python', null, null)], [], 2).gone.length, 0); assert.equal(diffSkills([s('Python', null, null)], [], 2).unchanged, true)
})

test('duplicados: dentro del contexto y dentro de lo sugerido gana el primero; los nombres vacíos se ignoran', () => {
  const diff = diffSkills([s('SQL', 1), s('sql', 1), s(' ', 1)], [s('Excel', 2), s('excel', 2, 'otra'), s('', 2)], 2)
  assert.deepEqual(names(diff.gone), ['SQL']); assert.deepEqual(names(diff.added), ['Excel']); assert.equal(diff.added[0].support, 'cita de Excel')
})

test('una habilidad vinculada a la versión nueva que la hoja nueva ya no trae también «ya no aparece»', () => {
  const diff = diffSkills([s('SQL', 2)], [], 2); assert.deepEqual(names(diff.gone), ['SQL'])
})

test('tope de 40: las nuevas que no caben se cuentan (overflow) y al aplicar se informan como omitidas, sin descartar nada ya guardado', () => {
  const current = Array.from({ length: 38 }, (_, i) => s(`Hab ${i}`, 1)); const suggested = [...current.slice(0, 5), s('Nueva A', 2), s('Nueva B', 2), s('Nueva C', 2), s('Nueva D', 2)]
  const diff = diffSkills(current, suggested, 2); assert.equal(diff.added.length, 4); assert.equal(diff.overflow, 2)
  const result = applyChoices(current, diff, { add: names(diff.added), link: [], remove: [] })
  assert.equal(result.skills.length, MAX_DECLARED_SKILLS); assert.equal(result.skipped, 2); assert.deepEqual(names(result.skills).slice(0, 38), names(current)); assert.deepEqual(names(result.skills).slice(38), ['Nueva A', 'Nueva B'])
})

test('elecciones por defecto (maqueta aprobada): NADA marcado; aplicar sin elegir deja el contexto igual, y «Mantener» es lo que queda para lo que ya no aparece', () => {
  const current = [s('A', 1), s('B', 1), s('C', 1)]; const diff = diffSkills(current, [s('A', 2), s('D', 2)], 2)
  assert.deepEqual(defaultChoices(diff), { add: [], link: [], remove: [] })
  assert.deepEqual(applyChoices(current, diff, defaultChoices(diff)).skills, current, 'B y C (ya no aparecen) se mantienen con su versión original; A no se vincula ni D se añade sin elegirlo')
  const chosen = applyChoices(current, diff, { add: ['D'], link: ['A'], remove: [] })
  assert.deepEqual(chosen.skills.map(x => [x.name, x.resumeVersion]), [['A', 2], ['B', 1], ['C', 1], ['D', 2]])
})

test('vincular: fija la versión nueva y toma la cita nueva, conserva el nombre de la persona; sin cita nueva conserva la que había', () => {
  const diff = diffSkills([s('Gestión de proyectos', 1, 'cita vieja'), s('SQL', 1, 'cita SQL')], [s('gestion de proyectos', 2, 'cita nueva'), { name: 'sql', support: null, resumeVersion: 2 }], 2)
  const result = applyChoices([s('Gestión de proyectos', 1, 'cita vieja'), s('SQL', 1, 'cita SQL')], diff, { add: [], link: ['Gestión de proyectos', 'SQL'], remove: [] })
  assert.deepEqual(result.skills, [{ name: 'Gestión de proyectos', support: 'cita nueva', resumeVersion: 2 }, { name: 'SQL', support: 'cita SQL', resumeVersion: 2 }])
})

test('quitar: solo lo que «ya no aparece»; un nombre que «sigue», una escrita a mano o inventada se ignora', () => {
  const current = [s('A', 1), s('B', 1), s('Mano', null, null)]; const diff = diffSkills(current, [s('A', 2)], 2)
  const result = applyChoices(current, diff, { add: [], link: [], remove: ['A', 'B', 'Mano', 'Inventada'] })
  assert.deepEqual(names(result.skills), ['A', 'Mano'], 'solo B (ya no aparece) se quita')
})

test('añadir: solo lo que la hoja nueva ofrece; un nombre inventado o ya presente no se añade ni duplica', () => {
  const diff = diffSkills([s('A', 1)], [s('A', 2), s('B', 2)], 2)
  const result = applyChoices([s('A', 1)], diff, { add: ['B', 'b', 'Inventada', 'A'], link: [], remove: [] })
  assert.deepEqual(names(result.skills), ['A', 'B'])
})

test('sin elegir nada el contexto no cambia (copia idéntica) y no se mutan los argumentos', () => {
  const current = [s('A', 1), s('B', 1)], suggested = [s('A', 2), s('C', 2)]; const before = frozen([current, suggested])
  const diff = diffSkills(current, suggested, 2); const diffBefore = frozen(diff)
  const result = applyChoices(current, diff, { add: [], link: [], remove: [] })
  assert.deepEqual(result.skills, current); assert.notEqual(result.skills, current); assert.deepEqual(frozen([current, suggested]), before); assert.deepEqual(frozen(diff), diffBefore)
  applyChoices(current, diff, defaultChoices(diff)); assert.deepEqual(frozen([current, suggested]), before, 'tampoco al aplicar')
})

test('idempotente: aplicar dos veces las mismas elecciones da lo mismo; volver a diferenciar tras aplicar no ofrece nada nuevo', () => {
  const current = [s('A', 1), s('B', 1), s('Mano', null, null)], suggested = [s('A', 2), s('C', 2), s('mano', 2)]
  const diff = diffSkills(current, suggested, 2); const choices = { add: ['C'], link: ['A', 'Mano'], remove: ['B'] }
  const once = applyChoices(current, diff, choices).skills
  const twice = applyChoices(once, diffSkills(once, suggested, 2), { ...choices }).skills
  assert.deepEqual(twice, once)
  const again = diffSkills(once, suggested, 2); assert.deepEqual([again.added, again.gone], [[], []]); assert.ok(again.remain.every(r => r.linked || r.handwritten))
})

test('propiedades (800 casos al azar con semilla fija): tope, sin duplicados, nada fuera de lo ofrecido, lo no elegido se conserva', () => {
  let seed = 20261120; const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32 }
  const pool = ['SQL', 'Excel', 'Power BI', 'Python', 'Gestión', 'Análisis', 'Docker', 'Liderazgo', 'Inglés', 'Diseño', 'Datos', 'Ventas']
  const draw = (limit, versions) => { const out = []; const n = Math.floor(rand() * limit); for (let i = 0; i < n; i++) { const name = pool[Math.floor(rand() * pool.length)] + (rand() < 0.2 ? ` ${Math.floor(rand() * 60)}` : ''); out.push(s(rand() < 0.3 ? name.toUpperCase() : name, versions[Math.floor(rand() * versions.length)])) } return out }
  for (let run = 0; run < 800; run++) {
    const current = draw(rand() < 0.1 ? 60 : 12, [1, 1, 2, null].map(v => v)), suggested = draw(rand() < 0.1 ? 60 : 12, [2]); const version = 2
    const before = frozen([current, suggested]); const diff = diffSkills(current, suggested, version)
    const pick = list => list.filter(() => rand() < 0.5).map(x => x.name ?? x.current?.name)
    const choices = { add: pick(diff.added), link: pick(diff.remain), remove: [...pick(diff.gone), 'Inventada', ...pick(diff.remain)] }
    const { skills, skipped } = applyChoices(current, diff, choices)
    const keys = skills.map(x => skillKey(x.name))
    assert.ok(skills.length <= Math.max(MAX_DECLARED_SKILLS, new Set(current.map(x => skillKey(x.name)).filter(Boolean)).size), 'nunca pasa del tope por culpa de la hoja nueva')
    assert.equal(new Set(keys).size, keys.length, 'sin duplicados')
    const offered = new Set([...diff.added.map(x => skillKey(x.name)), ...current.map(x => skillKey(x.name))]); assert.ok(keys.every(k => offered.has(k)), 'nada fuera de lo ofrecido')
    const removable = new Set(diff.gone.map(x => skillKey(x.name))); const removed = new Set(choices.remove.map(skillKey))
    for (const item of current) { const key = skillKey(item.name); if (!key) continue; if (!(removable.has(key) && removed.has(key))) assert.ok(keys.includes(key), `se conserva ${item.name}`) }
    assert.ok(diff.gone.every(x => x.resumeVersion !== null), 'lo escrito a mano nunca «ya no aparece»')
    assert.equal(skipped >= 0, true); assert.deepEqual(frozen([current, suggested]), before)
    assert.deepEqual(applyChoices(skills, diffSkills(skills, suggested, version), choices).skills.map(x => skillKey(x.name)).sort().join('|'), [...keys].sort().join('|'), 'idempotente en los nombres')
  }
})
