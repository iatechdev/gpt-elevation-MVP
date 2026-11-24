// QA-Claude-2 — PR #366 (ES-278 H1) mutaciones de pricingValidation.js: BACKEND=<clon>/backend FRONTEND=<clon>/frontend QA_PG=... BASE_FAILS=<fallas conocidas de mi matriz en el PR> node qa/mut366.cjs
// Primero es-278 (unitaria y PG) del PR; si sobrevive, mi matriz (qa/e366-moneda.cjs): detecta si hay MÁS fallas que BASE_FAILS.
const fs = require('fs'), path = require('path'), { execSync } = require('child_process'); const BE = path.resolve(process.env.BACKEND); const F = path.join(BE, 'utils/pricingValidation.js'); const orig = fs.readFileSync(F, 'utf8')
const run = (cmd, env) => { try { return { ok: true, out: execSync(cmd, { cwd: BE, stdio: 'pipe', timeout: 900000, shell: true, maxBuffer: 1e8, env: { ...process.env, ...env } }).toString() } } catch (e) { return { ok: false, out: String(e.stdout) } } }
const M = (name, a, b) => { if (!orig.includes(a)) { console.log(`M ${name}: SIN ANCLA «${a.slice(0, 50)}»`); return } fs.writeFileSync(F, orig.replace(a, () => b))
  const u = run('node --test test/es-278-moneda-periodo.test.cjs'), pg = run('node --test test/integration/es-278-postgres.cjs', { ES278_TEST_DATABASE_URL: process.env.QA_PG + '/postgres' }); let how = [!u.ok && 'es-278 unitaria', !pg.ok && 'es-278 PG'].filter(Boolean).join(' + '), det = !u.ok || !pg.ok
  if (!det) { const m = run(`node --test ${path.join(__dirname, 'e366-moneda.cjs')}`, { LABEL: 'pr', QA278_DB: process.env.QA_PG + '/postgres', FRONTEND: process.env.FRONTEND }); const line = m.out.split(String.fromCharCode(10)).find((l) => l.startsWith('RESUMEN')); const nf = line ? Number(line.split(' OK, ')[1].split(' ')[0]) : NaN; if (Number.isNaN(nf) || nf > (Number(process.env.BASE_FAILS) || 0)) { det = true; how = 'solo por mi matriz' } }
  console.log(`M ${name}: ${det ? 'DETECTADO por ' + how : 'SOBREVIVE'}`); fs.writeFileSync(F, orig) }
const CC = "!CURRENCIES.includes(body.currency.toUpperCase())", PP = "!PERIODS.includes(body.period)"
M('se añade MXN a las monedas', "['USD', 'COP', 'EUR']", "['USD', 'COP', 'EUR', 'MXN']")
M('se añade «week» a los períodos', "['month', 'year', 'forever']", "['month', 'year', 'forever', 'week']")
M('se quita la comprobación de la lista de períodos', ' || ' + PP, '')
M('se quita la comprobación de la lista de monedas', ' || ' + CC, '')
M('la moneda se compara sin pasar a mayúsculas (rechaza «usd»)', 'CURRENCIES.includes(body.currency.toUpperCase())', 'CURRENCIES.includes(body.currency)')
M('la moneda ya no se guarda en mayúsculas', 'values.currency = body.currency.toUpperCase()', 'values.currency = body.currency')
M('el período acepta mayúsculas («Month»)', 'PERIODS.includes(body.period)', 'PERIODS.includes(body.period.toLowerCase())')
M('includes invertido en la moneda', '!CURRENCIES.includes(body.currency.toUpperCase())', 'CURRENCIES.includes(body.currency.toUpperCase())')
M('el mensaje de moneda pierde la parte en inglés', 'La moneda debe ser USD, COP o EUR. / The currency must be USD, COP or EUR.', 'La moneda debe ser USD, COP o EUR.')
M('el mensaje de período no dice los valores válidos', 'El período debe ser month, year o forever. / The period must be month, year or forever.', 'El período no es válido. / The period is not valid.')
M('la edición (PUT) ya no valida la moneda: solo al crear', "if (has('currency')) {", "if (creating && has('currency')) {")
M('«forever» sale de la lista (la pantalla lo ofrece)', "['month', 'year', 'forever']", "['month', 'year']")
fs.writeFileSync(F, orig); console.log('clon restaurado')
