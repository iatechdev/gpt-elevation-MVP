// QA-Claude-2 — PR #362 (ES-324) mutaciones de validName: BACKEND=<clon>/backend QA_PG=... node qa/mut362.cjs. Primero es-324 (PG) del PR; si sobrevive, mi matriz (qa/e362-nombre.cjs).
const fs = require('fs'), path = require('path'), { execSync } = require('child_process'); const BE = path.resolve(process.env.BACKEND); const F = path.join(BE, 'routes/auth.js'); const orig = fs.readFileSync(F, 'utf8')
const run = (cmd, env) => { try { execSync(cmd, { cwd: BE, stdio: 'pipe', timeout: 600000, shell: true, maxBuffer: 1e8, env: { ...process.env, ...env } }); return false } catch (e) { return true } }
const fix = (x) => x.split("@P@").join(String.fromCharCode(92) + "p");
const A = fix("const validName = (name) => typeof name === 'string' && name.trim().length > 0 && [...name.trim()].length <= MAX_NAME && !/@P@{Cc}/u.test(name);"); if (!orig.includes(A)) { console.log('SIN ANCLA validName'); process.exit(1) }
const M = (name, b) => { fs.writeFileSync(F, orig.replace(A, () => b)); let r = run('node --test test/integration/es-324-postgres.cjs', { ES324_TEST_DATABASE_URL: process.env.QA_PG + '/postgres' }), how = 'por es-324 (PR)'; if (!r) { let out = ''; try { out = execSync(`node --test ${path.join(__dirname, 'e362-nombre.cjs')}`, { cwd: BE, stdio: 'pipe', timeout: 600000, shell: true, maxBuffer: 1e8, env: { ...process.env, QA362_DB: process.env.QA_PG + '/postgres', LABEL: 'pr' } }).toString() } catch (e) { out = String(e.stdout) } const line = out.split(String.fromCharCode(10)).find((l) => l.startsWith('RESUMEN')); const nf = line ? Number(line.split(' OK, ')[1].split(' ')[0]) : NaN; r = Number.isNaN(nf) || nf > (Number(process.env.BASE_FAILS) || 0); how = 'solo por mi matriz' } console.log(`M ${name}: ${r ? 'DETECTADO ' + how : 'SOBREVIVE'}`); fs.writeFileSync(F, orig) }
const V = (body) => fix(`const validName = (name) => ${body};`)
M('se quita el límite de longitud', V("typeof name === 'string' && name.trim().length > 0 && !/@P@{Cc}/u.test(name)"))
M('el límite es 101 (MAX_NAME + 1)', V("typeof name === 'string' && name.trim().length > 0 && [...name.trim()].length <= MAX_NAME + 1 && !/@P@{Cc}/u.test(name)"))
M('el límite es 99 (MAX_NAME − 1)', V("typeof name === 'string' && name.trim().length > 0 && [...name.trim()].length <= MAX_NAME - 1 && !/@P@{Cc}/u.test(name)"))
M('cuenta unidades UTF-16 (.length) en vez de puntos de código', V("typeof name === 'string' && name.trim().length > 0 && name.trim().length <= MAX_NAME && !/@P@{Cc}/u.test(name)"))
M('se quita la regla de controles', V("typeof name === 'string' && name.trim().length > 0 && [...name.trim()].length <= MAX_NAME"))
M('@P@{Cc} → @P@{C} (rechazaría el ZWNJ persa y los de formato)', V("typeof name === 'string' && name.trim().length > 0 && [...name.trim()].length <= MAX_NAME && !/@P@{C}/u.test(name)"))
M('se quita el trim (mide el crudo)', V("typeof name === 'string' && name.length > 0 && [...name].length <= MAX_NAME && !/@P@{Cc}/u.test(name)"))
M('el nombre vacío tras trim ya no se rechaza', V("typeof name === 'string' && [...name.trim()].length <= MAX_NAME && !/@P@{Cc}/u.test(name)"))
M('el control solo mira el nombre recortado (los saltos de línea a los lados pasan)', V("typeof name === 'string' && name.trim().length > 0 && [...name.trim()].length <= MAX_NAME && !/@P@{Cc}/u.test(name.trim())"))
fs.writeFileSync(F, orig); console.log('clon restaurado')
