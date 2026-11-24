// QA-Claude-2 — PR #368 (seguimiento de #347) mutaciones: FRONTEND=<clon>/frontend node qa/mut368.cjs. Muestra si la prueba NUEVA (es-199-relieve-cache) detecta cada mutación y, aparte, si la detecta la suite previa es-199-relieve.
const fs = require('fs'), path = require('path'), { execSync } = require('child_process'); const FE = path.resolve(process.env.FRONTEND); const P = (f) => path.join(FE, 'src/skill-map', f)
const files = ['reliefPlace.ts', 'reliefSeparate.ts']; const orig = Object.fromEntries(files.map((f) => [f, fs.readFileSync(P(f), 'utf8')])); const restore = () => files.forEach((f) => fs.writeFileSync(P(f), orig[f]))
const fails = (t) => { try { execSync(`node --test test/${t}`, { cwd: FE, stdio: 'pipe', timeout: 120000, shell: true }); return false } catch (e) { return true } }
const M = (name, file, a, b) => { restore(); const s = fs.readFileSync(P(file), 'utf8'); if (!s.includes(a)) { console.log(`M ${name}: SIN ANCLA «${a.slice(0, 50)}»`); return } fs.writeFileSync(P(file), s.replace(a, () => b)); const nueva = fails('es-199-relieve-cache.test.mjs'), previa = fails('es-199-relieve.test.mjs'); console.log(`M ${name}: nueva=${nueva ? 'DETECTA' : 'no'} · previa=${previa ? 'detecta' : 'no'}${!nueva && !previa ? '  ← SOBREVIVE' : ''}`); restore() }
console.log('sin mutar:', fails('es-199-relieve-cache.test.mjs') || fails('es-199-relieve.test.mjs') ? 'FALLA (mal)' : 'pasan')
const PL = 'reliefPlace.ts', SP = 'reliefSeparate.ts'
M('la caché ignora los territorios (toma la primera entrada)', PL, 'let placed = byTerritories.get(territories)', 'let placed = byTerritories.values().next().value')
M('sin caché: siempre recalcula', PL, 'if (!placed) { placed = placeSkills(skills, territories); byTerritories.set(territories, placed) }\n  return placed', 'return placeSkills(skills, territories)')
M('la caché se indexa solo por territorios (ignora skills)', PL, 'let byTerritories = placedCache.get(skills)', 'let byTerritories = placedCache.get(territories)')
M('crowded exige > 0 (cualquier solape cuenta)', SP, 'if (ox > 0.5 && oy > 0.5)', 'if (ox > 0 && oy > 0)')
M('crowded exige > 1', SP, 'if (ox > 0.5 && oy > 0.5)', 'if (ox > 1 && oy > 0.5)')
M('crowded con || en vez de &&', SP, 'if (ox > 0.5 && oy > 0.5)', 'if (ox > 0.5 || oy > 0.5)')
M('crowded solo mira el eje x', SP, 'if (ox > 0.5 && oy > 0.5)', 'if (ox > 0.5)')
M('crowded siempre falso', SP, 'if (ox > 0.5 && oy > 0.5)', 'if (false)')
M('separate sin pasadas (PASSES = 0)', SP, 'const PASSES = 160', 'const PASSES = 0')
restore(); console.log('clon restaurado')
