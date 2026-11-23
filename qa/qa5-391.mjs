// [QA-Claude-5] PR #391 (ES-110): propiedades y casos duros de resumeDiff.ts (función pura). Sin dependencias; PRNG con semilla.
// Uso: QA_SRC=<ruta a resumeDiff.ts> QA_SERVER=<ruta a backend/utils/resumeSkills.js> node --experimental-strip-types --no-warnings qa/qa5-391.mjs
import fs from 'node:fs'
const SRC = process.env.QA_SRC; const SERVER = process.env.QA_SERVER; const N = +(process.env.QA_N || 3000)
let total = 0, fails = 0; const ck = (id, cond, detail = '') => { total++; if (!cond) fails++; console.log(`${cond ? 'OK   ' : 'FALLA'} ${id} ${cond ? '' : String(detail).slice(0, 300)}`) }
const source = fs.readFileSync(SRC, 'utf8')

// ── D1 pureza: estática (identificadores prohibidos) + dinámica (globales bloqueadas)
const code = source.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')
const forbidden = ['fetch', 'XMLHttpRequest', 'WebSocket', 'localStorage', 'sessionStorage', 'indexedDB', 'document', 'window', 'navigator', 'Date', 'Math.random', 'console', 'process', 'require', 'eval', 'setTimeout', 'crypto', 'anthropic', 'axios']
const hits = forbidden.filter(w => new RegExp(`(^|[^\\w$.])${w.replace('.', '\\.')}`).test(code))
const imports = [...code.matchAll(/^\s*import\s+(type\s+)?[^'"]*from\s+['"]([^'"]+)['"]/gm)].map(m => [!!m[1], m[2]]); const dyn = /import\s*\(/.test(code)
ck('D1 el módulo no menciona red, almacenamiento, DOM, reloj, azar, consola, procesos ni IA', hits.length === 0, hits.join(','))
ck('D1 solo importa TIPOS (import type) y ningún import dinámico', imports.every(([t]) => t) && !dyn, JSON.stringify(imports))
const trap = name => Object.defineProperty(globalThis, name, { configurable: true, get() { throw new Error('toca ' + name) }, set() { throw new Error('toca ' + name) } })
let trapped = true; for (const g of ['fetch', 'XMLHttpRequest', 'localStorage', 'sessionStorage', 'indexedDB', 'document', 'window', 'WebSocket', 'navigator']) { try { trap(g) } catch { trapped = false } }
const mod = await import('file:///' + SRC.replace(/\\/g, '/') + '?v=' + Date.now())
const { diffSkills, applyChoices, defaultChoices, skillKey, MAX_DECLARED_SKILLS } = mod
ck('D1 exporta lo esperado y las globales de red/almacenamiento estaban bloqueadas', trapped && [diffSkills, applyChoices, defaultChoices, skillKey].every(f => typeof f === 'function') && MAX_DECLARED_SKILLS === 40)

// ── utilidades
let seed = 0x9e3779b9 ^ (+process.env.QA_SEED || 12345); const rnd = () => { seed ^= seed << 13; seed >>>= 0; seed ^= seed >>> 17; seed ^= seed << 5; seed >>>= 0; return seed / 4294967296 }
const pick = a => a[Math.floor(rnd() * a.length)]; const int = (a, b) => a + Math.floor(rnd() * (b - a + 1)); const shuffle = a => { const r = [...a]; for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [r[i], r[j]] = [r[j], r[i]] } return r }
const BASE = ['Power BI', 'SQL', 'Gestión de proyectos', 'Análisis de datos', 'Excel avanzado', 'Python', 'Storytelling con datos', 'Inglés técnico', 'Liderazgo de equipos', 'Diseño UX', 'Árbol de decisión', 'Año fiscal', 'Ñandú', 'Docker', 'Scrum', 'Estadística', 'Comunicación', 'Negociación', '__proto__', 'constructor', 'toString', 'hasOwnProperty', 'C++', 'C#', '日本語', '🙂 emoji']
const accentless = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '')
const variant = name => { let v = name; if (rnd() < 0.4) v = accentless(v); if (rnd() < 0.3) v = v.toUpperCase(); if (rnd() < 0.2) v = v.toLowerCase(); if (rnd() < 0.3) v = '  ' + v.replace(/ /g, rnd() < 0.5 ? '   ' : ' ') + ' '; if (rnd() < 0.2) v = v.normalize('NFD'); return v }
const skill = (name, v) => ({ name, support: rnd() < 0.3 ? null : 'cita ' + name.slice(0, 20), resumeVersion: v })
const ctxSkill = () => skill(variant(pick(BASE)), pick([null, null, 1, 1, 2, 3]))
const sugSkill = ver => skill(variant(pick(BASE)), ver)
const deep = o => JSON.stringify(o)
const freezeDeep = o => { if (o && typeof o === 'object') { Object.values(o).forEach(freezeDeep); Object.freeze(o) } return o }
const dedupe = list => { const seen = new Set(); return list.filter(s => { const k = skillKey(s.name); if (!k || seen.has(k)) return false; seen.add(k); return true }) }
const keyset = list => new Set(list.map(s => skillKey(s.name)))

// ── D2 propiedades
const v = { partition: 0, handwritten: 0, defaults: 0, offered: 0, idem: 0, commute: 0, cap: 0, overflow: 0, pure: 0, zero: 0, order: 0, nameKept: 0, others: 0 }; const firstFail = {}
const bad = (k, info) => { v[k]++; firstFail[k] = firstFail[k] || info }
for (let i = 0; i < N; i++) {
  const nCur = pick([0, 1, 3, 6, 10, 25, 40, 41]); const nSug = pick([0, 1, 3, 6, 10, 20]); const version = pick([2, 3, 4])
  const base = Array.from({ length: nCur }, ctxSkill); const sug0 = Array.from({ length: nSug }, () => sugSkill(version))
  const cur = freezeDeep(JSON.parse(deep(base))); const sug = freezeDeep(JSON.parse(deep(sug0)))
  let diff; try { diff = diffSkills(cur, sug, version) } catch (e) { bad('pure', 'diff lanzó/modificó: ' + e.message); continue }
  const mine = dedupe(base), theirs = dedupe(sug0)
  const A = keyset(diff.added), R = keyset(diff.remain.map(r => r.current)), G = keyset(diff.gone)
  const disj = ![...A].some(k => R.has(k) || G.has(k)) && ![...R].some(k => G.has(k))
  const sugCovered = theirs.every(s => { const k = skillKey(s.name); return A.has(k) !== R.has(k) }), curCovered = mine.filter(s => s.resumeVersion !== null).every(s => { const k = skillKey(s.name); return R.has(k) !== G.has(k) })
  if (!(disj && sugCovered && curCovered)) bad('partition', deep({ base, sug0 }))
  if (diff.gone.some(s => s.resumeVersion === null)) bad('handwritten', deep(diff.gone))
  const room = Math.max(0, 40 - mine.length); if (diff.overflow !== Math.max(0, diff.added.length - room)) bad('overflow', deep([diff.overflow, diff.added.length, room]))
  const def = defaultChoices(diff); if (def.add.length || def.link.length || def.remove.length) bad('defaults', deep(def))
  let outDef; try { outDef = applyChoices(cur, diff, def) } catch (e) { bad('pure', 'apply lanzó: ' + e.message); continue }
  if (deep(outDef.skills) !== deep(dedupe(base)) || outDef.skipped !== 0) bad('defaults', 'las elecciones por defecto cambiaron el contexto ' + deep([outDef.skills.length, mine.length]))
  // elecciones aleatorias, incluidos nombres inventados y de otro grupo
  const pickNames = (list, p) => list.filter(() => rnd() < p).map(s => variant(s.name))
  const bogus = ['no existe ' + i, 'ZZZ', '', '   ']
  const choices = { add: [...pickNames(diff.added, 0.6), ...pickNames(diff.gone, 0.5), ...pickNames(diff.remain.map(r => r.current), 0.3), ...bogus.slice(0, int(0, 3))], link: [...pickNames(diff.remain.map(r => r.current), 0.6), ...pickNames(diff.added, 0.4), ...pickNames(diff.gone, 0.4), pick(bogus)], remove: [...pickNames(diff.gone, 0.6), ...pickNames(diff.added, 0.4), ...pickNames(diff.remain.map(r => r.current), 0.4), pick(bogus)] }
  let out; try { out = applyChoices(cur, diff, freezeDeep(JSON.parse(deep(choices)))) } catch (e) { bad('pure', 'apply(elecciones) lanzó: ' + e.message); continue }
  // solo se actúa sobre lo que el diff ofrece: equivale a filtrar las elecciones a sus grupos
  const keysIn = (names, group) => names.filter(n => group.has(skillKey(n)))
  const filtered = { add: keysIn(choices.add, A), link: keysIn(choices.link, R), remove: keysIn(choices.remove, G) }
  const outF = applyChoices(cur, diff, filtered); if (deep(outF) !== deep(out)) bad('offered', deep({ choices, filtered }))
  // los que no se eligieron salen idénticos; los vinculados conservan nombre
  const chosenLink = new Set(filtered.link.map(skillKey)), chosenRem = new Set(filtered.remove.map(skillKey))
  for (const s of mine) { const k = skillKey(s.name); const o = out.skills.find(x => skillKey(x.name) === k); if (chosenRem.has(k) && G.has(k)) { if (o) bad('others', 'quitada sigue ' + s.name) } else if (chosenLink.has(k) && R.has(k)) { if (!o || o.name !== s.name || o.resumeVersion !== version) bad('nameKept', deep([s, o])) } else if (!o || deep(o) !== deep(s)) bad('others', deep([s, o])) }
  // idempotencia (mismo diff) y tras recalcular
  const twice = applyChoices(out.skills, diff, choices); if (deep(twice.skills) !== deep(out.skills)) bad('idem', deep({ a: out.skills.length, b: twice.skills.length }))
  // conmutatividad: orden de las elecciones, y «añadir luego vincular» = «vincular luego añadir»
  const sh = { add: shuffle(choices.add), link: shuffle(choices.link), remove: shuffle(choices.remove) }; if (deep(applyChoices(cur, diff, sh).skills.map(s => skillKey(s.name)).sort()) !== deep(out.skills.map(s => skillKey(s.name)).sort())) bad('commute', 'orden de elecciones')
  const al = applyChoices(applyChoices(cur, diff, { add: choices.add, link: [], remove: [] }).skills, diff, { add: [], link: choices.link, remove: choices.remove }), la = applyChoices(applyChoices(cur, diff, { add: [], link: choices.link, remove: choices.remove }).skills, diff, { add: choices.add, link: [], remove: [] })
  if (deep(al.skills.map(s => [skillKey(s.name), s.resumeVersion]).sort()) !== deep(la.skills.map(s => [skillKey(s.name), s.resumeVersion]).sort())) bad('commute', 'añadir/vincular')
  // tope de 40 sin descartar lo ya guardado
  const wantAll = applyChoices(cur, diff, { add: diff.added.map(s => s.name), link: [], remove: [] })
  if (mine.length <= 40 && wantAll.skills.length > 40) bad('cap', wantAll.skills.length)
  if (!mine.every(s => wantAll.skills.some(x => skillKey(x.name) === skillKey(s.name)))) bad('cap', 'se descartó algo guardado')
  if (mine.length <= 40 && wantAll.skipped !== Math.max(0, diff.added.length - Math.max(0, 40 - mine.length))) bad('cap', 'skipped ' + wantAll.skipped + ' vs ' + diff.overflow)
  if (deep(wantAll.skills.slice(mine.length).map(s => skillKey(s.name))) !== deep(diff.added.slice(0, wantAll.skills.length - mine.length).map(s => skillKey(s.name)))) bad('order', 'orden de la hoja')
  // sin duplicados por clave en el resultado y vacío ignorado
  const ks = out.skills.map(s => skillKey(s.name)); if (new Set(ks).size !== ks.length || ks.includes('')) bad('zero', 'duplicados o vacíos en la salida')
  // tras aplicar todo y recalcular: no queda nada nuevo ni por vincular
  const all = applyChoices(cur, diff, { add: diff.added.map(s => s.name), link: diff.remain.map(r => r.current.name), remove: [] }); const re = diffSkills(all.skills, sug, version)
  if (all.skipped === 0 && (re.added.length || re.remain.some(r => !r.linked && !r.handwritten ? true : false) && false)) bad('idem', 'tras aplicar todo aún hay nuevas')
  if (all.skipped === 0 && re.added.length) bad('idem', 'aún hay nuevas')
  if (re.remain.some(r => !r.linked && r.current && diff.remain.some(x => skillKey(x.current.name) === skillKey(r.current.name) && !x.handwritten) )) bad('idem', 'siguen sin vincular tras aplicar')
}
const label = { partition: 'partición (nuevas xor siguen; siguen xor ya no aparecen; grupos disjuntos)', handwritten: 'lo escrito a mano nunca «ya no aparece»', defaults: 'por defecto NADA marcado y aplicar lo por defecto deja el contexto igual («Mantener»)', offered: 'solo se actúa sobre nombres que el diff ofrece (inventados o de otro grupo no hacen nada)', idem: 'idempotencia (aplicar dos veces = una; tras aplicar todo no queda nada pendiente)', commute: 'conmutatividad (orden de elecciones; añadir/vincular)', cap: 'tope de 40 sin descartar lo guardado y `skipped` coherente', overflow: '`overflow` coherente', pure: 'pureza: entradas congeladas en profundidad (sin lanzar ni mutar)', zero: 'sin duplicados ni claves vacías en la salida', order: 'orden de la hoja al añadir', nameKept: 'vincular conserva el nombre de la persona y fija la versión nueva', others: 'lo no elegido sale idéntico y lo quitado ya no está' }
for (const k of Object.keys(label)) ck(`D2 ${label[k]} (${N} casos)`, v[k] === 0, `${v[k]} violaciones; primera: ${firstFail[k]}`)

// ── claves = fold del servidor
const serverLine = fs.readFileSync(SERVER, 'utf8').split('\n').find(l => l.startsWith('const fold = ')); const fold = new Function(serverLine.replace(/^const fold = /, 'return ').replace(/;\s*$/, ''))()
let diffs = 0; let ex = ''; const pool = [...BASE, 'Ä', 'ǅ', 'ß', 'İ', 'ﬁ', 'Å', '́', 'é', '  ', '\t', '\n', ' x ', '​X', 'ǆ']
for (let i = 0; i < 20000; i++) { const s = Array.from({ length: int(0, 6) }, () => pick(pool)).join(pick(['', ' ', '  ', '\n'])); if (skillKey(s) !== fold(s)) { diffs++; ex = ex || JSON.stringify(s) } }
ck('D2 skillKey (cliente) = fold (servidor) en 20 000 cadenas (acentos, NFD, ß, İ, ligaduras, espacios, NBSP)', diffs === 0, ex)

// ── D3 casos duros
const S = (name, ver = 1, sup = 'x') => ({ name, support: sup, resumeVersion: ver })
const throws = fn => { try { fn(); return null } catch (e) { return e.message } }
ck('D3 acentos / mayúsculas / NFC-NFD / espacios múltiples = misma habilidad', (() => { const d = diffSkills([S('Gestión de   Proyectos')], [S('gestion de proyectos'), S('GESTIÓN DE PROYECTOS'.normalize('NFD'))], 2); return d.added.length === 0 && d.remain.length === 1 && d.gone.length === 0 })())
ck('D3 ñ y n se tratan igual (como en el servidor) — documentado', skillKey('Año') === skillKey('Ano') && fold('Año') === fold('Ano'))
ck('D3 vacíos y solo espacios se ignoran; claves repetidas: gana la primera', (() => { const d = diffSkills([S('SQL'), S('sql', 1, 'otra'), S(' '), S('')], [S('Excel'), S('excel', 2, 'o'), S('')], 2); return d.added.length === 1 && d.added[0].name === 'Excel' && d.gone.length === 1 && d.gone[0].support === 'x' })())
ck('D3 nombres hostiles (__proto__, constructor, toString, hasOwnProperty, NUL, emoji, 10 000 caracteres) sin excepción y sin contaminar Object.prototype', (() => { const names = ['__proto__', 'constructor', 'toString', 'hasOwnProperty', 'a\u0000b', '🙂', 'x'.repeat(10000), 'valueOf', '__defineGetter__']; const e = throws(() => { const d = diffSkills(names.map(n => S(n)), names.map(n => S(n, 2)), 2); const o = applyChoices(names.map(n => S(n)), d, { add: names, link: names, remove: names }); if (o.skills.length !== names.length) throw new Error('longitud ' + o.skills.length) }); return e === null && ({}).polluted === undefined && Object.keys(Object.prototype).length === 0 })(), '')
{ const cur = Array.from({ length: 1000 }, (_, i) => S('Habilidad ' + i)); const sug = Array.from({ length: 1000 }, (_, i) => S('Nueva ' + i, 2)); const t = Date.now(); const d = diffSkills(cur, sug, 2); const o = applyChoices(cur, d, { add: d.added.map(s => s.name), link: [], remove: d.gone.map(s => s.name) }); const ms = Date.now() - t
  ck('D3 1 000 sugeridas y 1 000 en el contexto: < 500 ms; todas «ya no aparecen» quitadas; contexto vacío + 1 000 nuevas → 40 (tope) y skipped 960', ms < 500 && d.added.length === 1000 && d.gone.length === 1000 && o.skills.length === 40 && o.skipped === 960 && d.overflow === 1000, JSON.stringify({ ms, a: d.added.length, g: d.gone.length, len: o.skills.length, sk: o.skipped, ov: d.overflow }))
  const o2 = applyChoices(cur, d, { add: d.added.map(s => s.name), link: [], remove: [] }); ck('D3 con 1 000 guardadas (> 40) y nada que quitar: no se descarta NINGUNA y no se añade nada (skipped 1 000)', o2.skills.length === 1000 && o2.skipped === 1000, JSON.stringify([o2.skills.length, o2.skipped])) }
ck('D3 version del diff = la nueva; unchanged correcto (todo vinculado = sin cambios; escrita a mano que coincide = sin cambios)', diffSkills([S('SQL', 2)], [S('sql', 2)], 2).unchanged === true && diffSkills([S('Python', null, null)], [S('python', 2)], 2).unchanged === true && diffSkills([S('SQL', 1)], [S('sql', 2)], 2).unchanged === false)
ck('D3 contexto con clave sugerida solo por mayúsculas/acentos → «sigue» y NO «ya no aparece» ni «nueva»', (() => { const d = diffSkills([S('Análisis')], [S('ANALISIS', 2)], 2); return d.remain.length === 1 && !d.added.length && !d.gone.length })())
// D4 la función solo trabaja con habilidades declaradas
ck('D4 la salida solo tiene los campos de DeclaredSkill (name, support, resumeVersion): nada de evidencia, ni estado, ni nivel', (() => { const d = diffSkills([S('SQL', 1), S('Excel', 1)], [S('sql', 2), S('Docker', 2)], 2); const o = applyChoices([S('SQL', 1), S('Excel', 1)], d, { add: ['Docker'], link: ['SQL'], remove: ['Excel'] }); return o.skills.every(s => deep(Object.keys(s).sort()) === deep(['name', 'resumeVersion', 'support'])) })())
ck('D4 vincular: toma la cita nueva solo si la hoja trae una; añadir fija la versión nueva; las no elegidas conservan su versión original', (() => { const cur = [S('SQL', 1, 'vieja'), S('Excel', 1, 'e'), S('Py', null, null)]; const d = diffSkills(cur, [S('sql', 2, 'nueva'), S('excel', 2, null), S('py', 2), S('Go', 2, 'g')], 2); const o = applyChoices(cur, d, { add: ['Go'], link: ['SQL', 'Excel'], remove: [] }).skills; const by = Object.fromEntries(o.map(s => [s.name, s])); return by.SQL.support === 'nueva' && by.SQL.resumeVersion === 2 && by.Excel.support === 'e' && by.Excel.resumeVersion === 2 && by.Go.resumeVersion === 2 && by.Py.resumeVersion === null })())
console.log(`RESUMEN: ${total - fails}/${total} OK, ${fails} FALLAS`); process.exit(fails ? 1 : 0)
