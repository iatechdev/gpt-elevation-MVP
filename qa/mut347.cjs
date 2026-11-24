// QA-Claude-2 — PR #347 (ES-199) mutaciones sobre el clon: FRONTEND=<clon>/frontend MAIN_BUNDLES=<carpeta con layout.mjs, reliefSeparate.mjs, reliefPlace.mjs de main> node qa/mut347.cjs
// Primero la prueba del PR (es-199-relieve); si sobrevive, mi comparador de equivalencia (qa/e347-equiv.mjs) con los módulos mutados contra los de main.
const fs = require('fs'), path = require('path'), { execSync } = require('child_process'); const FE = path.resolve(process.env.FRONTEND); const MAINB = path.resolve(process.env.MAIN_BUNDLES); const P = (f) => path.join(FE, 'src/skill-map', f)
const files = ['layout.ts', 'reliefSeparate.ts', 'reliefPlace.ts']; const orig = Object.fromEntries(files.map((f) => [f, fs.readFileSync(P(f), 'utf8')])); const restore = () => files.forEach((f) => fs.writeFileSync(P(f), orig[f]))
const sh = (cmd, cwd) => { try { execSync(cmd, { cwd: cwd || FE, stdio: 'pipe', timeout: 900000, shell: true, maxBuffer: 1e8 }); return false } catch (e) { return true } }
const TMP = path.join(FE, '..', '..', 'o347', 'mutroot'); const M = (name, file, a, b) => { restore(); const s = fs.readFileSync(P(file), 'utf8'); if (!s.includes(a)) { console.log(`M ${name}: SIN ANCLA «${a.slice(0, 50)}»`); return } fs.writeFileSync(P(file), s.replace(a, () => b))
  let r = sh('node --test test/es-199-relieve.test.mjs'), how = 'por la prueba del PR (es-199)'
  if (!r) { fs.rmSync(TMP, { recursive: true, force: true }); fs.mkdirSync(TMP, { recursive: true }); fs.cpSync(MAINB, path.join(TMP, 'main'), { recursive: true }); fs.mkdirSync(path.join(TMP, 'pr'), { recursive: true }); sh(`node "${process.env.BUNDLER}" . "${path.join(TMP, 'pr')}"`); r = sh(`node "${path.join(__dirname, 'e347-equiv.mjs')}" "${TMP}"`, __dirname); how = 'solo por mi comparador de equivalencia' }
  console.log(`M ${name}: ${r ? 'DETECTADO ' + how : 'SOBREVIVE'}`); restore() }
const L = 'layout.ts', S = 'reliefSeparate.ts', PL = 'reliefPlace.ts'
console.log('sin mutar: la prueba del PR', sh('node --test test/es-199-relieve.test.mjs') ? 'FALLA (mal)' : 'pasa')
M('a la espiral no reanuda (siempre desde 0)', L, 'const from = resume.get(anchorKey) ?? { r: 0, i: 0 }', 'const from = { r: 0, i: 0 }')
M('b la espiral reanuda un punto DESPUÉS (salta uno)', L, 'if (free(p)) { spot = p; resume.set(anchorKey, { r, i }) }', 'if (free(p)) { spot = p; resume.set(anchorKey, { r, i: i + 1 }) }')
M('c celda de la cuadrícula mayor que la caja (CELL=256 → 2048 pero consulta igual)', L, 'const CELL = 256', 'const CELL = 8')
M('d holgura de hits 10 → 0', L, 'x < other.x + other.w + 10 && x + CHIP_W + 10 > other.x', 'x < other.x + other.w && x + CHIP_W > other.x')
M('e la cuadrícula solo mira su propia celda', L, 'x0 = Math.floor((x - 10) / CELL), x1 = Math.floor((x + CHIP_W + 10) / CELL), y0 = Math.floor((y - 10) / CELL), y1 = Math.floor((y + CHIP_H + 10) / CELL)', 'x0 = Math.floor(x / CELL), x1 = Math.floor(x / CELL), y0 = Math.floor(y / CELL), y1 = Math.floor(y / CELL)')
M('f separate no refresca la caja del par movido (j)', S, 'keepInside(work[i]); keepInside(work[j]); refresh(i); refresh(j)', 'keepInside(work[i]); keepInside(work[j]); refresh(i)')
M('g separate compara oy antes que ox con otro umbral (> 0.5 en la pasada)', S, 'if (ox <= 0) continue', 'if (ox <= 0.5) continue')
M('h el aviso crowded exige > 0 en vez de > 0.5', S, 'if (ox > 0.5 && oy > 0.5)', 'if (ox > 0 && oy > 0)')
M('i la caché ignora los territorios (clave solo por habilidades)', PL, 'let placed = byTerritories.get(territories)', 'let placed = byTerritories.values().next().value')
M('j la caché devuelve siempre la primera colocación aunque cambie el arreglo (clave por longitud)', PL, 'let byTerritories = placedCache.get(skills)', 'let byTerritories = placedCache.get({ length: skills.length }) ?? placedCache.get(skills)')
restore(); console.log('clon restaurado')
